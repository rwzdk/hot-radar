import type { BoardId, WatchResult } from '../types';
import { fetchBoards } from './boards';
import { hnSearch } from './hackernews';

/** 把关键词拆成可用于匹配的词元(小写、去停用) */
export function splitTerms(keyword: string): string[] {
  const raw = keyword
    .toLowerCase()
    // 保留连字符,避免 deepseek-v3 被拆成过于宽泛的 deepseek
    .split(/[\s,，、/|·.。:;；!！?？_/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return [...new Set(raw.length > 0 ? raw : [keyword.toLowerCase()])];
}

function matches(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

/** 文本是否命中排除词(供榜单页等展示过滤使用) */
export function matchesExclude(text: string, exclude: string | undefined): boolean {
  if (!exclude?.trim()) return false;
  return matches(text, splitTerms(exclude));
}

export interface ScanOptions {
  /** 参与扫描的热榜平台 */
  boards?: BoardId[];
  /** HN 搜索拉取条数 */
  hnLimit?: number;
  /** 命中后需要排除的词 */
  exclude?: string;
}

export interface ScanOutcome {
  results: WatchResult[];
  /** 各数据源命中情况 */
  sourceStats: { source: string; total: number; matched: number; ok: boolean }[];
}

/**
 * 对一个关键词做全网扫描:
 * 1. 拉取各热榜,标题/摘要命中关键词的条目记为命中
 * 2. HackerNews 直接按关键词搜索(结果本身就是相关的)
 */
export async function scanKeyword(keyword: string, opts: ScanOptions = {}): Promise<ScanOutcome> {
  const terms = splitTerms(keyword);
  const excludeTerms = opts.exclude?.trim() ? splitTerms(opts.exclude) : [];
  const hit = (text: string) => matches(text, terms) && !matches(text, excludeTerms);
  const boardIds = opts.boards ?? ['weibo', 'zhihu', 'douyin', 'toutiao', 'bili', 'hackernews'];

  const [boardResults, hnResults] = await Promise.all([
    fetchBoards(boardIds.filter((id) => id !== 'hackernews')),
    boardIds.includes('hackernews')
      ? hnSearch(keyword, { byDate: true, withinDays: 7, limit: opts.hnLimit ?? 15 }).catch(
          () => [],
        )
      : Promise.resolve([]),
  ]);

  const sourceStats: ScanOutcome['sourceStats'] = [];
  const results: WatchResult[] = [];

  for (const [id, fetched] of Object.entries(boardResults)) {
    const matched = fetched.items
      .filter((it) => hit(`${it.title} ${it.extra ?? ''}`))
      .map<WatchResult>((it) => ({
        id: it.url,
        title: it.title,
        url: it.url,
        source: id as BoardId,
        heat: it.heat,
        heatLabel: it.heatLabel,
        foundAt: Date.now(),
      }));
    sourceStats.push({
      source: id,
      total: fetched.items.length,
      matched: matched.length,
      ok: fetched.items.length > 0,
    });
    results.push(...matched);
  }

  if (boardIds.includes('hackernews')) {
    const hnMatched = hnResults.filter((r) => !matches(`${r.title} ${r.content ?? ''}`, excludeTerms));
    sourceStats.push({
      source: 'hackernews',
      total: hnResults.length,
      matched: hnMatched.length,
      ok: true,
    });
    results.push(...hnMatched);
  }

  // 去重(以 url 为准)后按热度排序
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  unique.sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));

  return { results: unique, sourceStats };
}

/** 扫描结果并入历史:保留 AI 分析结论,识别新增条目 */
export function mergeHistory(
  history: WatchResult[],
  fresh: WatchResult[],
): { merged: WatchResult[]; added: WatchResult[] } {
  const byId = new Map(history.map((r) => [r.id, r]));
  const added: WatchResult[] = [];
  for (const item of fresh) {
    const old = byId.get(item.id);
    if (old) {
      // 保留旧的 AI 结论、首次发现时间与正文,刷新热度
      byId.set(item.id, {
        ...item,
        foundAt: old.foundAt,
        content: item.content ?? old.content,
        publishedAt: item.publishedAt ?? old.publishedAt,
        ai: old.ai,
      });
    } else {
      byId.set(item.id, item);
      added.push(item);
    }
  }
  const merged = [...byId.values()].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));
  // 历史最多保留 200 条,控制多关键词场景下的 localStorage 体积
  return { merged: merged.slice(0, 200), added };
}
