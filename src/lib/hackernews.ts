import type { BoardItem, WatchResult } from '../types';
import { safeUrl } from './url';

const HN_API = 'https://hn.algolia.com/api/v1';
const REQUEST_TIMEOUT = 12_000;

interface HnHit {
  objectID: string;
  title: string | null;
  url: string | null;
  story_text: string | null;
  author: string | null;
  points: number | null;
  num_comments: number | null;
  created_at: string | null;
}

interface HnResponse {
  hits: HnHit[];
  nbHits: number;
}

async function hnGet(path: string, params: Record<string, string>): Promise<HnResponse> {
  const qs = new URLSearchParams(params).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${HN_API}${path}?${qs}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HN API HTTP ${res.status}`);
    return (await res.json()) as HnResponse;
  } finally {
    clearTimeout(timer);
  }
}

/** HackerNews 首页榜(按热度) */
export async function hnFrontPage(limit = 30): Promise<BoardItem[]> {
  const json = await hnGet('/search', { tags: 'front_page', hitsPerPage: String(limit) });
  return json.hits
    .filter((h) => h.title)
    .map((h) => ({
      title: h.title!,
      url:
        safeUrl(h.url) ?? `https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`,
      heat: h.points ?? 0,
      heatLabel: h.points != null ? `${h.points} 分` : undefined,
      extra: `${h.num_comments ?? 0} 评论 · @${h.author ?? '-'}`,
      source: 'hackernews' as const,
    }));
}

export interface HnSearchOptions {
  /** 按时间排序(最新)还是按相关度 */
  byDate?: boolean;
  /** 只要最近 N 天内的内容 */
  withinDays?: number;
  limit?: number;
}

/** HackerNews 关键词搜索 */
export async function hnSearch(query: string, opts: HnSearchOptions = {}): Promise<WatchResult[]> {
  const { byDate = false, withinDays, limit = 20 } = opts;
  const params: Record<string, string> = {
    query,
    tags: 'story',
    hitsPerPage: String(limit),
  };
  if (withinDays) {
    const since = Math.floor((Date.now() - withinDays * 86_400_000) / 1000);
    params.numericFilters = `created_at_i>${since}`;
  }
  const json = await hnGet(byDate ? '/search_by_date' : '/search', params);
  return json.hits
    .filter((h) => h.title)
    .map((h) => {
      const url =
        safeUrl(h.url) ?? `https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`;
      return {
        id: url,
        title: h.title!,
        url,
        source: 'hackernews' as const,
        content: h.story_text?.slice(0, 500) ?? undefined,
        heat: h.points ?? 0,
        heatLabel: h.points != null ? `${h.points} 分` : undefined,
        publishedAt: h.created_at ? new Date(h.created_at).getTime() : undefined,
        foundAt: Date.now(),
      };
    });
}
