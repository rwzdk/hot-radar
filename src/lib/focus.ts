import type { AiAnalysis, Focus, FocusHit, Settings, WatchResult } from '../types';
import { combinedExclude } from '../types';
import { scanKeywords, splitTerms, type ScanOutcome } from './aggregate';
import { scoreFocusBatch } from './ai';
import {
  focusCacheKey,
  focusKey,
  loadFocusResults,
  loadJson,
  removeKey,
  saveJson,
} from './storage';

const MAX_AI_CANDIDATES = 20;
const MAX_CACHE = 300;
const MAX_RESULTS = 200;

/** 关注点用于本地粗筛的词:AI 标签 + 名称分词 */
export function buildFocusTerms(focus: Focus): string[] {
  const terms = [...focus.tags, ...splitTerms(focus.name)]
    .map((term) => term.trim())
    .filter(Boolean);
  return [...new Set(terms)].slice(0, 16);
}

export function focusScanKey(focusId: string): string {
  return `focus:${focusId}`;
}

type FocusCache = Record<string, AiAnalysis>;

function loadFocusCache(focusId: string): FocusCache {
  const raw = loadJson<Record<string, unknown>>(focusCacheKey(focusId), {});
  const cache: FocusCache = {};
  for (const [url, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const ai = value as Partial<AiAnalysis>;
    if (typeof ai.relevance !== 'number') continue;
    cache[url] = ai as AiAnalysis;
  }
  return cache;
}

function saveFocusCache(focusId: string, cache: FocusCache): void {
  const trimmed = Object.fromEntries(
    Object.entries(cache)
      .sort(([, a], [, b]) => (b.analyzedAt ?? 0) - (a.analyzedAt ?? 0))
      .slice(0, MAX_CACHE),
  );
  saveJson(focusCacheKey(focusId), trimmed);
}

/** 关注点描述或标签变化后清空评分缓存 */
export function clearFocusCache(focusId: string): void {
  removeKey(focusCacheKey(focusId));
}

function toFocusHit(
  item: WatchResult,
  focusId: string,
  matchedBy: FocusHit['matchedBy'],
  ai?: AiAnalysis,
): FocusHit {
  return { ...item, focusId, matchedBy, ai };
}

/** 合并关注点历史:保留首次发现时间、正文和已有 AI 结论 */
export function mergeFocusHistory(
  history: FocusHit[],
  fresh: FocusHit[],
): { merged: FocusHit[]; added: FocusHit[] } {
  const byId = new Map(history.map((item) => [item.id, item]));
  const added: FocusHit[] = [];
  for (const item of fresh) {
    const old = byId.get(item.id);
    if (old) {
      const ai = item.ai ?? old.ai;
      byId.set(item.id, {
        ...item,
        focusId: item.focusId,
        foundAt: old.foundAt,
        content: item.content ?? old.content,
        publishedAt: item.publishedAt ?? old.publishedAt,
        ai,
        matchedBy: ai ? 'ai' : item.matchedBy,
      });
    } else {
      byId.set(item.id, item);
      added.push(item);
    }
  }
  const merged = [...byId.values()].sort(
    (a, b) =>
      (b.ai?.relevance ?? -1) - (a.ai?.relevance ?? -1) ||
      (b.heat ?? 0) - (a.heat ?? 0),
  );
  return { merged: merged.slice(0, MAX_RESULTS), added };
}

export interface FocusApplyResult {
  merged: FocusHit[];
  added: FocusHit[];
  usedAi: boolean;
  /** AI 精排失败/未返回时的说明 */
  error?: string;
  /** 超过单轮 AI 上限、留到下一轮的新候选数 */
  pending: number;
}

/** 对已经过标签粗筛的候选做阈值过滤、AI 精排和入库 */
export async function applyFocusCandidates(
  focus: Focus,
  candidates: WatchResult[],
  settings: Settings,
): Promise<FocusApplyResult> {
  const history = loadFocusResults(focus.id);
  if (focus.paused) {
    return { merged: history, added: [], usedAi: false, pending: 0 };
  }

  const historyIds = new Set(history.map((item) => item.id));
  const cache = loadFocusCache(focus.id);
  const seen = new Set<string>();
  const fresh: WatchResult[] = [];
  for (const item of candidates) {
    if (!item.url || seen.has(item.url)) continue;
    if (!focus.sources.includes(item.source)) continue;
    if (historyIds.has(item.url)) continue;
    seen.add(item.url);
    fresh.push(item);
  }

  const aiReady = Boolean(settings.openrouterKey) && focus.autoAi;
  const hits: FocusHit[] = [];
  const uncached: WatchResult[] = [];
  let usedAi = false;
  let error: string | undefined;
  let pending = 0;

  for (const item of fresh) {
    const cached = cache[item.id];
    if (cached) {
      if (cached.relevance >= focus.minScore) {
        hits.push(toFocusHit(item, focus.id, 'ai', cached));
      }
    } else {
      uncached.push(item);
    }
  }

  if (!aiReady) {
    hits.push(...uncached.map((item) => toFocusHit(item, focus.id, 'tag')));
  } else {
    const batch = uncached.slice(0, MAX_AI_CANDIDATES);
    pending = Math.max(0, uncached.length - batch.length);
    try {
      usedAi = true;
      const scores = await scoreFocusBatch(
        { apiKey: settings.openrouterKey, model: settings.model },
        focus,
        batch,
      );
      let scored = 0;
      for (const item of batch) {
        const analysis = scores.get(item.id);
        if (!analysis) {
          hits.push(toFocusHit(item, focus.id, 'tag'));
          continue;
        }
        cache[item.id] = analysis;
        scored++;
        if (analysis.relevance >= focus.minScore) {
          hits.push(toFocusHit(item, focus.id, 'ai', analysis));
        }
      }
      if (scored === 0) error = 'AI 精排没有返回有效条目,已回退标签匹配';
    } catch (err) {
      error = err instanceof Error ? err.message : 'AI 精排失败,已回退标签匹配';
      hits.push(...batch.map((item) => toFocusHit(item, focus.id, 'tag')));
    }
  }

  const { merged, added } = mergeFocusHistory(history, hits);
  if (hits.length > 0) saveJson(focusKey(focus.id), merged);
  if (usedAi) saveFocusCache(focus.id, cache);
  return { merged, added, usedAi, error, pending };
}

export interface FocusScanResult extends FocusApplyResult {
  sourceStats: ScanOutcome['sourceStats'];
}

/** 手动扫描单个关注点;热榜只拉一轮,候选再走 AI 精排 */
export async function scanFocus(
  focus: Focus,
  settings: Settings,
): Promise<FocusScanResult> {
  const key = focusScanKey(focus.id);
  const outcomes = await scanKeywords([key], {
    boards: focus.sources,
    terms: { [key]: buildFocusTerms(focus) },
    hnQueries: { [key]: focus.name },
    excludes: { [key]: combinedExclude(focus.exclude, settings) },
  });
  const outcome = outcomes[key] ?? { results: [], sourceStats: [] };
  const applied = await applyFocusCandidates(focus, outcome.results, settings);
  return { ...applied, sourceStats: outcome.sourceStats };
}
