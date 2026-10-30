#!/usr/bin/env node
/**
 * 每日热榜快照生成器
 * 抓取各平台热榜,写入 public/data/snapshot.json。
 * 优先直连可公开访问的上游;失败时回退 60s 聚合接口。
 * 任一源失败时保留上次快照,保证九榜都有兜底数据。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'snapshot.json');
const API_60S = 'https://60s.viki.moe/v2/';
const TIMEOUT = 25_000;
const RETRY_DELAY = 1_200;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUrl(raw) {
  if (!raw) return undefined;
  try {
    const url = new URL(String(raw).replace(/&amp;/g, '&'));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** 把 "293万" / "43.2w" / "2412 万热度" 这类热度文案解析回数值 */
function parseHeatText(text) {
  if (!text) return undefined;
  const m = String(text).trim().match(/([\d.]+)\s*(万|w)?/i);
  if (!m) return undefined;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return undefined;
  return m[2] ? Math.round(num * 10_000) : Math.round(num);
}

function formatHeat(value) {
  if (value == null || Number.isNaN(value)) return undefined;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}万`;
  return String(value);
}

async function fetchText(url, headers = {}, timeout = TIMEOUT) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, headers = {}, timeout = TIMEOUT) {
  const text = await fetchText(url, headers, timeout);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('响应不是 JSON');
  }
}

async function fetch60s(path, id) {
  const json = await getJson(API_60S + path, { Accept: 'application/json' });
  if (json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error(`60s API code=${json.code}`);
  }
  return json.data.flatMap((item) => {
    const normalized = normalize60sItem(item, id);
    return normalized ? [normalized] : [];
  });
}

/** 60s 原始字段归一化(与 src/lib/boards.ts 的映射保持一致) */
function normalize60sItem(item, id) {
  const url = safeUrl(item.link ?? item.url);
  const title = item.title?.trim();
  if (!url || !title) return null;
  if (id === 'baidu') {
    const heat = typeof item.score === 'number' ? item.score : Number(item.score);
    return {
      title,
      url,
      heat: Number.isFinite(heat) ? heat : undefined,
      heatLabel: item.score_desc ?? undefined,
      extra: item.type_desc ?? undefined,
      cover: safeUrl(item.cover),
    };
  }
  if (id === 'tieba') {
    const heat = parseHeatText(item.score_desc) ?? parseHeatText(item.score);
    return {
      title,
      url,
      heat,
      heatLabel: item.score_desc ?? undefined,
      cover: safeUrl(item.avatar),
    };
  }
  if (id === 'rednote') {
    const heat = typeof item.score === 'number' ? item.score : parseHeatText(item.score);
    return {
      title,
      url,
      heat,
      heatLabel: item.score_desc ?? formatHeat(heat),
    };
  }
  const heat =
    typeof item.hot_value === 'number'
      ? item.hot_value
      : parseHeatText(item.hot_value_desc ?? '');
  return {
    title,
    url,
    heat,
    heatLabel: item.hot_value_desc ?? formatHeat(heat),
    extra: item.answer_cnt != null ? `${item.answer_cnt} 回答` : undefined,
    cover: safeUrl(item.cover),
  };
}

/** 知乎热榜直连(无 CORS,仅用于 Node 快照生成) */
async function fetchZhihuDirect() {
  const json = await getJson('https://api.zhihu.com/topstory/hot-lists/total?limit=30', {
    Referer: 'https://www.zhihu.com/hot',
  });
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.flatMap((entry) => {
    const target = entry?.target ?? {};
    const title = String(target.title ?? '').trim();
    const rawUrl = String(target.url ?? '');
    const url = safeUrl(
      rawUrl.replace('api.zhihu.com', 'www.zhihu.com').replace('/questions/', '/question/'),
    );
    if (!title || !url) return [];
    const heatText = String(entry?.detail_text ?? '');
    return [
      {
        title,
        url,
        heat: parseHeatText(heatText),
        heatLabel: heatText || undefined,
        extra: target.answer_count != null ? `${target.answer_count} 回答` : undefined,
        cover: safeUrl(entry?.children?.[0]?.thumbnail),
      },
    ];
  });
}

/** B 站热搜直连:优先 wbi 榜单,失败回退 App 榜单 */
async function fetchBiliDirect() {
  const headers = {
    'X-Real-IP': '157.255.219.143',
    'X-Forwarded-For': '157.255.219.143',
    Referer: 'https://www.bilibili.com/',
  };
  let list = [];
  try {
    const wbi = await getJson(
      'https://api.bilibili.com/x/web-interface/wbi/search/square?limit=50',
      headers,
    );
    list = wbi?.data?.trending?.list ?? [];
  } catch {
    /* fall through */
  }
  if (!Array.isArray(list) || list.length === 0) {
    const app = await getJson(
      'https://app.bilibili.com/x/v2/search/trending/ranking?limit=50',
      headers,
    );
    list = app?.data?.list ?? [];
  }
  return (Array.isArray(list) ? list : []).flatMap((item) => {
    const title = String(item?.keyword || item?.show_name || '').trim();
    if (!title) return [];
    const heat = Number(item?.heat_score);
    return [
      {
        title,
        url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(title)}`,
        heat: Number.isFinite(heat) && heat > 0 ? heat : undefined,
        heatLabel: Number.isFinite(heat) && heat > 0 ? formatHeat(heat) : undefined,
      },
    ];
  });
}

/** 抖音热搜直连 */
async function fetchDouyinDirect() {
  const json = await getJson(
    'https://aweme-lq.snssdk.com/aweme/v1/hot/search/list/?aid=1128&version_code=880',
  );
  const list = json?.data?.word_list ?? [];
  return (Array.isArray(list) ? list : []).flatMap((item) => {
    const title = String(item?.word ?? '').trim();
    if (!title) return [];
    const heat = Number(item?.hot_value);
    return [
      {
        title,
        url: `https://www.douyin.com/search/${encodeURIComponent(title)}`,
        heat: Number.isFinite(heat) ? heat : undefined,
        heatLabel: Number.isFinite(heat) ? formatHeat(heat) : undefined,
        cover: safeUrl(item?.word_cover?.url_list?.[0]),
      },
    ];
  });
}

/** 头条热搜直连 */
async function fetchToutiaoDirect() {
  const json = await getJson('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc');
  const list = json?.data ?? [];
  return (Array.isArray(list) ? list : []).flatMap((item) => {
    const title = String(item?.Title ?? '').trim();
    const url = safeUrl(String(item?.Url ?? '').split('?')[0].replace(/\/$/, ''));
    if (!title || !url) return [];
    const heat = Number(item?.HotValue);
    return [
      {
        title,
        url,
        heat: Number.isFinite(heat) ? heat : undefined,
        heatLabel: Number.isFinite(heat) ? formatHeat(heat) : undefined,
        cover: safeUrl(item?.Image?.url),
      },
    ];
  });
}

/** 百度热搜直连:从页面内嵌 s-data JSON 解析 */
async function fetchBaiduDirect() {
  const html = await fetchText('https://top.baidu.com/board?tab=realtime', {
    Accept: 'text/html',
  });
  const match = html.match(/<!--s-data:(.*?)-->/s);
  if (!match) throw new Error('百度页面未找到 s-data');
  const raw = match[1].replace(/\\-/g, '-');
  const list = JSON.parse(raw)?.data?.cards?.[0]?.content ?? [];
  const tags = { '1': '新', '3': '热' };
  return (Array.isArray(list) ? list : []).flatMap((item) => {
    const title = String(item?.word ?? '').trim();
    const rawUrl = String(item?.url ?? '');
    const url = safeUrl(rawUrl.startsWith('http') ? rawUrl : `https://www.baidu.com${rawUrl}`);
    if (!title || !url || item?.isTop) return [];
    const heat = Number(item?.hotScore);
    return [
      {
        title,
        url,
        heat: Number.isFinite(heat) ? heat : undefined,
        heatLabel: Number.isFinite(heat) ? formatHeat(heat) : undefined,
        extra: tags[String(item?.hotTag)] ?? undefined,
        cover: safeUrl(item?.img),
      },
    ];
  });
}

/** 贴吧热议直连 */
async function fetchTiebaDirect() {
  const json = await getJson('https://tieba.baidu.com/hottopic/browse/topicList');
  const list = json?.data?.bang_topic?.topic_list ?? [];
  return (Array.isArray(list) ? list : []).flatMap((item) => {
    const title = String(item?.topic_name ?? '').trim();
    const url = safeUrl(item?.topic_url);
    if (!title || !url) return [];
    const heat = Number(item?.discuss_num);
    return [
      {
        title,
        url,
        heat: Number.isFinite(heat) ? heat : undefined,
        heatLabel: Number.isFinite(heat) ? `${formatHeat(heat)} 讨论` : undefined,
        cover: safeUrl(item?.topic_avatar),
      },
    ];
  });
}

async function fetchHackerNews() {
  const json = await getJson(
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
  );
  return (json?.hits ?? [])
    .filter((hit) => hit.title)
    .map((hit) => ({
      title: hit.title,
      url:
        safeUrl(hit.url) ??
        `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`,
      heat: hit.points ?? 0,
      heatLabel: hit.points != null ? `${hit.points} 分` : undefined,
      extra: `${hit.num_comments ?? 0} 评论 · @${hit.author ?? '-'}`,
    }));
}

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

// 每个源按顺序尝试多种抓取方式;直接上游优先,避免 60s 限流
const jobs = [
  { id: 'weibo', label: '60s', run: () => fetch60s('weibo', 'weibo') },
  { id: 'zhihu', label: '知乎直连', run: fetchZhihuDirect, fallback: () => fetch60s('zhihu', 'zhihu') },
  { id: 'douyin', label: '抖音直连', run: fetchDouyinDirect, fallback: () => fetch60s('douyin', 'douyin') },
  { id: 'toutiao', label: '头条直连', run: fetchToutiaoDirect, fallback: () => fetch60s('toutiao', 'toutiao') },
  { id: 'baidu', label: '百度直连', run: fetchBaiduDirect, fallback: () => fetch60s('baidu/hot', 'baidu') },
  { id: 'bili', label: 'B站直连', run: fetchBiliDirect, fallback: () => fetch60s('bili', 'bili') },
  { id: 'tieba', label: '贴吧直连', run: fetchTiebaDirect, fallback: () => fetch60s('baidu/tieba', 'tieba') },
  { id: 'rednote', label: '60s', run: () => fetch60s('rednote', 'rednote') },
  { id: 'hackernews', label: 'HN', run: fetchHackerNews },
];

const previous = await loadPrevious();
const boards = {};
const boardAt = {};

for (const job of jobs) {
  let items = [];
  let used = '';
  for (const [label, run] of [
    [job.label, job.run],
    ...(job.fallback ? [['60s 回退', job.fallback]] : []),
  ]) {
    try {
      const fetched = await run();
      if (fetched.length === 0) throw new Error('空数据');
      items = fetched;
      used = label;
      break;
    } catch (error) {
      console.warn(`✗ ${job.id} · ${label}: ${error.message}`);
      await sleep(RETRY_DELAY);
    }
  }

  if (items.length > 0) {
    boards[job.id] = items.map((item) => ({ ...item, source: job.id }));
    boardAt[job.id] = Date.now();
    console.log(`✓ ${job.id}: ${items.length} 条 (${used})`);
  } else {
    const old = previous?.boards?.[job.id];
    if (Array.isArray(old) && old.length > 0) {
      boards[job.id] = old.map((item) => ({ ...item, source: job.id }));
      boardAt[job.id] = previous?.boardAt?.[job.id] ?? previous?.generatedAt ?? Date.now();
      console.warn(`↺ ${job.id}: 保留上次快照 ${old.length} 条`);
    } else {
      console.warn(`✗ ${job.id}: 无可用数据且没有历史快照`);
    }
  }
}

const snapshot = {
  generatedAt: Date.now(),
  boardAt,
  boards,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log(`\n写入 ${OUT}(共 ${Object.keys(boards).length} 个榜单)`);
