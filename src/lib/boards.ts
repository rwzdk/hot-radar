import type { BoardId, BoardItem } from '../types';
import { hnFrontPage } from './hackernews';

export interface BoardMeta {
  id: BoardId;
  name: string;
  en: string;
  /** 60s API 路径,null 表示走自有逻辑(如 HackerNews) */
  api?: string;
  /** 该榜是否常有封面图 */
  hasCover?: boolean;
}

export const BOARDS: BoardMeta[] = [
  { id: 'weibo', name: '微博', en: 'Weibo', api: 'weibo' },
  { id: 'zhihu', name: '知乎', en: 'Zhihu', api: 'zhihu' },
  { id: 'douyin', name: '抖音', en: 'Douyin', api: 'douyin', hasCover: true },
  { id: 'toutiao', name: '今日头条', en: 'Toutiao', api: 'toutiao', hasCover: true },
  { id: 'bili', name: 'B 站', en: 'Bilibili', api: 'bili' },
  { id: 'hackernews', name: 'Hacker News', en: 'HackerNews' },
];

export function boardMeta(id: BoardId): BoardMeta {
  return BOARDS.find((b) => b.id === id)!;
}

export interface BoardFetchResult {
  items: BoardItem[];
  /** live = 实时接口;snapshot = 仓库内每日快照兜底 */
  from: 'live' | 'snapshot';
  fetchedAt: number;
  error?: string;
}

const API_60S = 'https://60s.viki.moe/v2/';
const REQUEST_TIMEOUT = 12_000;

async function getJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 把热度数值格式化为 "1533万" 这类文案 */
export function formatHeat(value?: number): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}万`;
  return String(value);
}

interface Api60sItem {
  title?: string;
  link?: string;
  hot_value?: number;
  hot_value_desc?: string;
  detail?: string;
  cover?: string;
  answer_cnt?: number;
  excerpt?: string;
}

interface Api60sResponse {
  code: number;
  data: Api60sItem[] | null;
}

async function fetchFrom60s(path: string): Promise<BoardItem[]> {
  const json = await getJson<Api60sResponse>(API_60S + path);
  if (json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error(`60s API 返回 code=${json.code}`);
  }
  return json.data.map((it) => ({
    title: it.title ?? '',
    url: it.link ?? '',
    heat: it.hot_value ?? undefined,
    heatLabel: it.hot_value_desc ?? formatHeat(it.hot_value),
    extra: it.answer_cnt != null ? `${it.answer_cnt} 回答` : undefined,
    cover: it.cover,
    source: 'weibo',
  }));
}

interface SnapshotFile {
  generatedAt: number;
  boards: Partial<Record<BoardId, BoardItem[]>>;
}

let snapshotCache: Promise<SnapshotFile | null> | null = null;

/** 读取随仓库构建的每日快照(由 GitHub Actions 生成) */
export function loadSnapshot(): Promise<SnapshotFile | null> {
  if (!snapshotCache) {
    snapshotCache = getJson<SnapshotFile>(`${import.meta.env.BASE_URL}data/snapshot.json`)
      .catch(() => null)
      .then((snap) => {
        // 快取失败就置空,下次(如重新部署后)再试
        if (snap === null) snapshotCache = null;
        return snap;
      });
  }
  return snapshotCache;
}

/** 拉取单个榜单:实时优先,失败时回退快照 */
export async function fetchBoard(id: BoardId): Promise<BoardFetchResult> {
  const meta = BOARDS.find((b) => b.id === id)!;
  if (id === 'hackernews') {
    try {
      return { items: await hnFrontPage(), from: 'live', fetchedAt: Date.now() };
    } catch (e) {
      const snap = await fallbackSnapshot(id);
      return snap ?? { items: [], from: 'live', fetchedAt: Date.now(), error: String(e) };
    }
  }
  try {
    const items = (await fetchFrom60s(meta.api!)).map((it) => ({ ...it, source: id }));
    if (items.length === 0) throw new Error('空数据');
    return { items, from: 'live', fetchedAt: Date.now() };
  } catch (e) {
    const snap = await fallbackSnapshot(id);
    return (
      snap ?? {
        items: [],
        from: 'live',
        fetchedAt: Date.now(),
        error: e instanceof Error ? e.message : String(e),
      }
    );
  }
}

async function fallbackSnapshot(id: BoardId): Promise<BoardFetchResult | null> {
  const snap = await loadSnapshot();
  const items = snap?.boards[id];
  if (snap && items && items.length > 0) {
    return { items, from: 'snapshot', fetchedAt: snap.generatedAt };
  }
  return null;
}

/** 并行拉取多个榜单,逐个容错 */
export async function fetchBoards(ids: BoardId[]): Promise<Record<BoardId, BoardFetchResult>> {
  const entries = await Promise.all(
    ids.map(async (id) => [id, await fetchBoard(id)] as const),
  );
  return Object.fromEntries(entries) as Record<BoardId, BoardFetchResult>;
}
