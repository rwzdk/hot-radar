import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AiAnalysis,
  AiDigest,
  BoardId,
  DigestPoint,
  Importance,
  Keyword,
  NoticeEvent,
  Settings,
  WatchResult,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { safeUrl } from './url';

const PREFIX = 'hotradar:';
const CACHE_PREFIX = 'hotradar-cache:';
const BOARD_IDS: BoardId[] = [
  'weibo',
  'zhihu',
  'douyin',
  'toutiao',
  'baidu',
  'bili',
  'tieba',
  'rednote',
  'hackernews',
];
const IMPORTANCES: Importance[] = ['low', 'medium', 'high', 'urgent'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shortText(value: unknown, max = 200): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sanitizeAi(value: unknown): AiAnalysis | undefined {
  if (!isRecord(value)) return undefined;
  const importance = IMPORTANCES.includes(value.importance as Importance)
    ? (value.importance as Importance)
    : 'low';
  return {
    isReal: value.isReal !== false,
    relevance: Math.max(0, Math.min(100, Math.round(finiteNumber(value.relevance) ?? 0))),
    importance,
    summary: shortText(value.summary, 200) ?? '',
    reason: shortText(value.reason, 200) ?? '',
    analyzedAt: finiteNumber(value.analyzedAt) ?? Date.now(),
    model: shortText(value.model, 100),
  };
}

function sanitizeWatchItem(value: unknown): WatchResult | null {
  if (!isRecord(value)) return null;
  const url = safeUrl(shortText(value.url, 2000));
  const title = shortText(value.title, 300);
  const source = BOARD_IDS.includes(value.source as BoardId)
    ? (value.source as BoardId)
    : null;
  if (!url || !title || !source) return null;
  return {
    id: shortText(value.id, 300) ?? url,
    title,
    url,
    source,
    content: shortText(value.content, 500),
    heat: finiteNumber(value.heat),
    heatLabel: shortText(value.heatLabel, 50),
    publishedAt: finiteNumber(value.publishedAt),
    foundAt: finiteNumber(value.foundAt) ?? Date.now(),
    ai: sanitizeAi(value.ai),
  };
}

function sanitizeWatchList(value: unknown): WatchResult[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .slice(0, 200)
    .flatMap((item) => {
      const parsed = sanitizeWatchItem(item);
      return parsed ? [parsed] : [];
    });
}

function sanitizeKeywords(value: unknown): Keyword[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const list: Keyword[] = [];
  for (const entry of value.slice(0, 200)) {
    if (!isRecord(entry)) continue;
    const text = shortText(entry.text, 120);
    if (!text) continue;
    let id = shortText(entry.id, 80) ?? uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    list.push({
      id,
      text,
      note: shortText(entry.note, 200),
      exclude: shortText(entry.exclude, 200),
      paused: entry.paused === true,
      autoAi: entry.autoAi !== false,
      createdAt: finiteNumber(entry.createdAt) ?? Date.now(),
      lastScanAt: finiteNumber(entry.lastScanAt),
    });
  }
  return list;
}

function sanitizeNotices(value: unknown): NoticeEvent[] | null {
  if (!Array.isArray(value)) return null;
  const list: NoticeEvent[] = [];
  for (const entry of value.slice(0, 100)) {
    if (!isRecord(entry)) continue;
    const title = shortText(entry.title, 200);
    const body = shortText(entry.body, 500);
    if (!title || !body) continue;
    list.push({
      id: shortText(entry.id, 80) ?? uid(),
      title,
      body,
      at: finiteNumber(entry.at) ?? Date.now(),
      read: entry.read === true,
      keywordId: shortText(entry.keywordId, 80),
    });
  }
  return list;
}

function sanitizeDigest(value: unknown): AiDigest | null {
  if (!isRecord(value)) return null;
  const headline = shortText(value.headline, 120);
  const overview = shortText(value.overview, 500);
  if (!headline || !overview) return null;
  const points: DigestPoint[] = Array.isArray(value.points)
    ? value.points.slice(0, 5).flatMap((point) => {
        if (typeof point === 'string') {
          const text = shortText(point, 120);
          return text ? [{ text, level: 'medium' as Importance }] : [];
        }
        if (!isRecord(point)) return [];
        const text = shortText(point.text, 120);
        if (!text) return [];
        const level = IMPORTANCES.includes(point.level as Importance)
          ? (point.level as Importance)
          : 'medium';
        return [{ text, level }];
      })
    : [];
  const watch = Array.isArray(value.watch)
    ? value.watch.slice(0, 5).flatMap((item) => {
        const text = shortText(item, 120);
        return text ? [text] : [];
      })
    : [];
  return {
    headline,
    overview,
    points,
    watch,
    covered: Math.max(0, Math.round(finiteNumber(value.covered) ?? 0)),
    generatedAt: finiteNumber(value.generatedAt) ?? Date.now(),
    model: shortText(value.model, 100),
  };
}

function sanitizeRecentSearches(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 10).flatMap((item) => {
    const text = shortText(item, 120);
    return text ? [text] : [];
  });
}

function sanitizeSettings(value: unknown): Settings {
  const current = loadJson<Record<string, unknown>>('settings', {});
  const incoming = isRecord(value) ? value : {};
  return {
    openrouterKey: typeof current.openrouterKey === 'string' ? current.openrouterKey : '',
    model:
      shortText(incoming.model, 120) ??
      shortText(current.model, 120) ??
      DEFAULT_SETTINGS.model,
    browserNotify:
      typeof incoming.browserNotify === 'boolean'
        ? incoming.browserNotify
        : current.browserNotify === true,
    globalExclude: shortText(incoming.globalExclude, 200) ?? '',
    autoScanMinutes: [5, 10, 30].includes(finiteNumber(incoming.autoScanMinutes) ?? 0)
      ? (finiteNumber(incoming.autoScanMinutes) as number)
      : 0,
  };
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    notifyLocalUpdate(key);
  } catch {
    // 存储满了或隐私模式下静默失败
  }
}

export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key);
  notifyLocalUpdate(key);
}

/* ---------- 同页数据更新广播 ----------
 * saveJson/removeKey 后通知本页其他 useLocalState 订阅者重新读取,
 * 解决"页面级写入(如自动扫描)后组件视图不刷新"的问题。
 * 订阅方通过 skipPersist 跳过回写,避免 写入→通知→再写入 的死循环。 */
const LOCAL_UPDATE_EVENT = 'hotradar:local-update';

function notifyLocalUpdate(key: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCAL_UPDATE_EVENT, { detail: { key } }));
}

/** 触发浏览器下载 */
export function downloadFile(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 带持久化的 useState,并监听其他标签页的修改 */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJson(key, initial));
  const initialRef = useRef(initial);
  const skipPersist = useRef(false);

  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    saveJson(key, value);
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PREFIX + key) return;
      if (e.newValue === null) {
        skipPersist.current = true;
        setValue(initialRef.current);
        return;
      }
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {
        /* 忽略坏数据 */
      }
    };
    // 同页广播:其他组件写入同一 key 时重新读取(删除时回落到初始值)
    const onLocalUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string }>).detail;
      if (detail?.key !== key) return;
      skipPersist.current = true;
      setValue(loadJson(key, initialRef.current));
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(LOCAL_UPDATE_EVENT, onLocalUpdate);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LOCAL_UPDATE_EVENT, onLocalUpdate);
    };
  }, [key]);

  return [value, setValue] as const;
}

/** 导出全部本地数据(用于备份);AI 密钥永不写入备份 */
export function exportAll(): string {
  const dump: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      try {
        const key = k.slice(PREFIX.length);
        const value = JSON.parse(localStorage.getItem(k)!) as unknown;
        if (key === 'settings' && value && typeof value === 'object') {
          const sanitized = { ...(value as Record<string, unknown>) };
          delete sanitized.openrouterKey;
          dump[key] = sanitized;
        } else {
          dump[key] = value;
        }
      } catch {
        /* 跳过 */
      }
    }
  }
  return JSON.stringify({ app: 'hot-radar', exportedAt: Date.now(), data: dump }, null, 2);
}

/** 从备份恢复;逐类校验,损坏的条目丢弃,设置合并时保留本机 AI 密钥 */
export function importAll(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.data)) return false;
    if (parsed.app != null && parsed.app !== 'hot-radar') return false;

    for (const [key, value] of Object.entries(parsed.data)) {
      if (key === 'settings') {
        saveJson(key, sanitizeSettings(value));
      } else if (key === 'keywords') {
        const list = sanitizeKeywords(value);
        if (list) saveJson(key, list);
      } else if (key === 'notices') {
        const list = sanitizeNotices(value);
        if (list) saveJson(key, list);
      } else if (key === 'search:recent') {
        const list = sanitizeRecentSearches(value);
        if (list) saveJson(key, list);
      } else if (key.startsWith('watch:')) {
        const list = sanitizeWatchList(value);
        if (list) saveJson(key, list);
      } else if (key.startsWith('digest:')) {
        const digest = sanitizeDigest(value);
        if (digest) saveJson(key, digest);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** 清空本应用全部数据(含榜单缓存) */
export function clearAll(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX) || k?.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  keys.forEach((k) => {
    if (k.startsWith(PREFIX)) notifyLocalUpdate(k.slice(PREFIX.length));
  });
}

/** 生成短 id */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 监控历史的存储键 */
export function watchKey(keywordId: string): string {
  return `watch:${keywordId}`;
}

/** 读取某个关键词的历史结果 */
export function loadWatch(keywordId: string): import('../types').WatchResult[] {
  return loadJson<import('../types').WatchResult[]>(watchKey(keywordId), []);
}

export function useReload(callback: () => void) {
  const reload = useCallback(callback, [callback]);
  useEffect(() => {
    const onStorage = () => reload();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);
}
