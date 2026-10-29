import type { BoardId, BoardItem } from '../types';
import { hnFrontPage } from './hackernews';
import { safeUrl } from './url';

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
  { id: 'baidu', name: '百度', en: 'Baidu', api: 'baidu/hot', hasCover: true },
  { id: 'bili', name: 'B 站', en: 'Bilibili', api: 'bili' },
  { id: 'tieba', name: '贴吧', en: 'Tieba', api: 'baidu/tieba' },
  { id: 'rednote', name: '小红书', en: 'Rednote', api: 'rednote' },
  { id: 'hackernews', name: 'Hacker News', en: 'HackerNews' },
];

export function boardMeta(id: BoardId): BoardMeta {
  return (
    BOARDS.find((b) => b.id === id) ?? { id, name: String(id), en: 'Unknown' }
  );
}

export interface BoardFetchResult {
  items: BoardItem[];
  /** live = 实时接口;snapshot = 仓库内每日快照兜底 */
  from: 'live' | 'snapshot';
  /** 数据本身的时间(快照模式为单榜快照时间) */
  fetchedAt: number;
  /** 本次拉取时间,用于缓存新鲜度,避免快照结果被误判为过期 */
  loadedAt: number;
  error?: string;
}

export interface SnapshotFile {
  generatedAt: number;
  /** 单榜最近一次成功抓取时间;某源失败保留旧数据时用于展示真实新鲜度 */
  boardAt?: Partial<Record<BoardId, number>>;
  boards: Partial<Record<BoardId, BoardItem[]>>;
}

const API_60S = 'https://60s.viki.moe/v2/';
const REQUEST_TIMEOUT = 12_000;
const RETRY_DELAY = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true;
  return error instanceof Error && /HTTP 5\d\d/.test(error.message);
}

async function getJsonOnce<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 网络错误/5xx 重试一次;429 直接失败,交给快照兜底 */
async function getJson<T>(url: string): Promise<T> {
  try {
    return await getJsonOnce<T>(url);
  } catch (error) {
    if (!isRetryable(error)) throw error;
    await sleep(RETRY_DELAY);
    return getJsonOnce<T>(url);
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
  // 百度热搜/贴吧(baidu/hot、baidu/tieba)的字段
  url?: string;
  score?: number | string;
  score_desc?: string;
  desc?: string;
  avatar?: string;
  type_desc?: string;
  // 小红书(rednote)的字段
  word_type?: string | number;
}

interface Api60sResponse {
  code: number;
  data: Api60sItem[] | null;
}

/** 把 "293万" / "43.2w" 这类热度文案解析回数值,失败返回 undefined */
function parseHeatText(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.trim().match(/^([\d.]+)\s*(万|w)?$/i);
  if (!m) return undefined;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return undefined;
  return m[2] ? Math.round(num * 10_000) : Math.round(num);
}

function toBoardItem(it: Api60sItem, source: BoardId): BoardItem | null {
  const url = safeUrl(it.link ?? it.url);
  const title = it.title?.trim();
  if (!url || !title) return null;
  return { title, url, source };
}

async function fetchFrom60s(path: string, source: BoardId): Promise<BoardItem[]> {
  const json = await getJson<Api60sResponse>(API_60S + path);
  if (json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error(`60s API 返回 code=${json.code}`);
  }
  return json.data.flatMap((it) => {
    const base = toBoardItem(it, source);
    if (!base) return [];

    if (source === 'baidu') {
      // 百度热搜:score 为数值热度,score_desc 形如 "4893221",type_desc 是 热/新 标签
      const heat = typeof it.score === 'number' ? it.score : Number(it.score);
      return [
        {
          ...base,
          heat: Number.isFinite(heat) ? heat : undefined,
          heatLabel: it.score_desc ?? formatHeat(heat),
          extra: it.type_desc ?? undefined,
          cover: safeUrl(it.cover),
        },
      ];
    }
    if (source === 'tieba') {
      // 贴吧热议:score_desc 形如 "293万",无封面用 avatar
      const heat = parseHeatText(it.score_desc) ?? parseHeatText(String(it.score ?? ''));
      return [
        {
          ...base,
          heat,
          heatLabel: it.score_desc ?? formatHeat(heat),
          cover: safeUrl(it.avatar),
        },
      ];
    }
    if (source === 'rednote') {
      // 小红书热点:score 为数值热度,link 是关键词搜索页
      const heat = typeof it.score === 'number' ? it.score : Number(it.score);
      return [
        {
          ...base,
          heat: Number.isFinite(heat) ? heat : undefined,
          heatLabel: formatHeat(heat),
        },
      ];
    }
    // 微博/知乎/抖音/头条/B站:统一结构
    return [
      {
        ...base,
        heat: typeof it.hot_value === 'number' ? it.hot_value : undefined,
        heatLabel: it.hot_value_desc ?? formatHeat(it.hot_value),
        extra: it.answer_cnt != null ? `${it.answer_cnt} 回答` : undefined,
        cover: safeUrl(it.cover),
      },
    ];
  });
}

function normalizeSnapshot(raw: unknown): SnapshotFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { generatedAt?: unknown; boardAt?: unknown; boards?: unknown };
  if (typeof obj.generatedAt !== 'number' || !obj.boards || typeof obj.boards !== 'object') {
    return null;
  }
  const byBoard = obj.boards as Record<string, unknown>;
  const byBoardAt =
    obj.boardAt && typeof obj.boardAt === 'object'
      ? (obj.boardAt as Record<string, unknown>)
      : {};
  const boardAt: Partial<Record<BoardId, number>> = {};
  const boards: Partial<Record<BoardId, BoardItem[]>> = {};
  for (const meta of BOARDS) {
    const list = byBoard[meta.id];
    if (!Array.isArray(list)) continue;
    const items: BoardItem[] = [];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const it = entry as Record<string, unknown>;
      const url = safeUrl(typeof it.url === 'string' ? it.url : undefined);
      const title = typeof it.title === 'string' ? it.title.trim() : '';
      if (!url || !title) continue;
      items.push({
        title,
        url,
        source: meta.id,
        heat: typeof it.heat === 'number' ? it.heat : undefined,
        heatLabel: typeof it.heatLabel === 'string' ? it.heatLabel : undefined,
        extra: typeof it.extra === 'string' ? it.extra : undefined,
        cover: typeof it.cover === 'string' ? safeUrl(it.cover) : undefined,
      });
    }
    if (items.length > 0) {
      boards[meta.id] = items;
      const at = byBoardAt[meta.id];
      boardAt[meta.id] = typeof at === 'number' ? at : obj.generatedAt;
    }
  }
  return { generatedAt: obj.generatedAt, boardAt, boards };
}

let snapshotCache: Promise<SnapshotFile | null> | null = null;

/* ---------- 榜单 localStorage 缓存 ----------
 * 前缀刻意避开应用数据的 hotradar:,不进 exportAll 备份;
 * 只缓存实时成功结果,快照/失败结果不写缓存。 */
const BOARD_CACHE_PREFIX = 'hotradar-cache:board:';

export function loadBoardCache(id: BoardId): BoardFetchResult | null {
  try {
    const raw = localStorage.getItem(BOARD_CACHE_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardFetchResult;
    if (!parsed || parsed.from !== 'live' || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveBoardCache(id: BoardId, result: BoardFetchResult): void {
  if (result.from !== 'live' || result.items.length === 0) return;
  try {
    localStorage.setItem(BOARD_CACHE_PREFIX + id, JSON.stringify(result));
  } catch {
    /* 存储满/隐私模式下放弃缓存 */
  }
}

/** 读取随仓库构建的每日快照(由 GitHub Actions 生成) */
export function loadSnapshot(): Promise<SnapshotFile | null> {
  if (!snapshotCache) {
    snapshotCache = getJson<unknown>(`${import.meta.env.BASE_URL}data/snapshot.json`)
      .then(normalizeSnapshot)
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
      const now = Date.now();
      const result = { items: await hnFrontPage(), from: 'live' as const, fetchedAt: now, loadedAt: now };
      saveBoardCache(id, result);
      return result;
    } catch (e) {
      const snap = await fallbackSnapshot(id);
      const now = Date.now();
      return snap ?? { items: [], from: 'live', fetchedAt: now, loadedAt: now, error: String(e) };
    }
  }
  try {
    const items = await fetchFrom60s(meta.api!, id);
    if (items.length === 0) throw new Error('空数据');
    const now = Date.now();
    const result = { items, from: 'live' as const, fetchedAt: now, loadedAt: now };
    saveBoardCache(id, result);
    return result;
  } catch (e) {
    const snap = await fallbackSnapshot(id);
    const now = Date.now();
    return (
      snap ?? {
        items: [],
        from: 'live',
        fetchedAt: now,
        loadedAt: now,
        error: e instanceof Error ? e.message : String(e),
      }
    );
  }
}

async function fallbackSnapshot(id: BoardId): Promise<BoardFetchResult | null> {
  const snap = await loadSnapshot();
  const items = snap?.boards[id];
  if (snap && items && items.length > 0) {
    return {
      items: items.map((it) => ({ ...it, source: id })),
      from: 'snapshot',
      fetchedAt: snap.boardAt?.[id] ?? snap.generatedAt,
      loadedAt: Date.now(),
    };
  }
  return null;
}

/** 并行拉取多个榜单,最多 2 并发并留出间隔,降低接口限流概率 */
export async function fetchBoards(ids: BoardId[]): Promise<Record<BoardId, BoardFetchResult>> {
  const result = {} as Record<BoardId, BoardFetchResult>;
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      result[id] = await fetchBoard(id);
      if (cursor < ids.length) await sleep(150);
    }
  }

  await Promise.all(Array.from({ length: Math.min(2, ids.length) }, worker));
  return result;
}
