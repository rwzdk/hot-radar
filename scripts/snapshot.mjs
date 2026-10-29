#!/usr/bin/env node
/**
 * 每日热榜快照生成器
 * 抓取各平台热榜,写入 public/data/snapshot.json。
 * 由 GitHub Actions 定时/推送时执行并提交回仓库;
 * 站点运行时若实时接口不可用,会自动回退读取这份快照。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'snapshot.json');
const API_60S = 'https://60s.viki.moe/v2/';
const TIMEOUT = 15_000;
const RETRY_DELAY = 900;

/** 各榜单: [榜单 id, 60s API 路径]; HackerNews 走自有逻辑 */
const BOARD_JOBS = [
  ['weibo', 'weibo'],
  ['zhihu', 'zhihu'],
  ['douyin', 'douyin'],
  ['toutiao', 'toutiao'],
  ['baidu', 'baidu/hot'],
  ['bili', 'bili'],
  ['tieba', 'baidu/tieba'],
  ['rednote', 'rednote'],
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUrl(raw) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** 把 "293万" / "43.2w" 这类热度文案解析回数值 */
function parseHeatText(text) {
  if (!text) return undefined;
  const m = String(text).trim().match(/^([\d.]+)\s*(万|w)?$/i);
  if (!m) return undefined;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return undefined;
  return m[2] ? Math.round(num * 10_000) : Math.round(num);
}

/** 按榜单归一化条目(与 src/lib/boards.ts 的映射保持一致) */
function normalizeItem(item, id) {
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
    const heat = typeof item.score === 'number' ? item.score : Number(item.score);
    return {
      title,
      url,
      heat: Number.isFinite(heat) ? heat : undefined,
      heatLabel: formatHeat(heat),
    };
  }
  return {
    title,
    url,
    heat: typeof item.hot_value === 'number' ? item.hot_value : undefined,
    heatLabel: item.hot_value_desc ?? formatHeat(item.hot_value),
    extra: item.answer_cnt != null ? `${item.answer_cnt} 回答` : undefined,
    cover: safeUrl(item.cover),
  };
}

async function getJsonOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'hot-radar-snapshot/1.1',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url) {
  try {
    return await getJsonOnce(url);
  } catch (error) {
    console.warn(`  重试 ${url}: ${error.message}`);
    await sleep(RETRY_DELAY);
    return getJsonOnce(url);
  }
}

function formatHeat(value) {
  if (value == null || Number.isNaN(value)) return undefined;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}万`;
  return String(value);
}

async function fetch60s(path, id) {
  const json = await getJson(API_60S + path);
  if (json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error(`60s API code=${json.code}`);
  }
  return json.data.flatMap((item) => {
    const normalized = normalizeItem(item, id);
    return normalized ? [normalized] : [];
  });
}

async function fetchHackerNews() {
  const json = await getJson(
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
  );
  return json.hits
    .filter((hit) => hit.title)
    .map((hit) => ({
      title: hit.title,
      url:
        safeUrl(hit.url) ??
        `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`,
      heat: hit.points ?? 0,
      heatLabel: hit.points != null ? `${hit.points} 分` : undefined,
      extra: `${hit.num_comments ?? 0} 评论 · @${hit.author ?? '-'}`,
      source: 'hackernews',
    }));
}

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

const jobs = [
  ...BOARD_JOBS.map(([id, path]) => [id, () => fetch60s(path, id)]),
  ['hackernews', fetchHackerNews],
];

const previous = await loadPrevious();
const boards = {};
const boardAt = {};

for (const [id, run] of jobs) {
  try {
    const items = await run();
    if (items.length > 0) {
      boards[id] = items.map((item) => ({ ...item, source: id }));
      boardAt[id] = Date.now();
      console.log(`✓ ${id}: ${items.length} 条`);
    } else {
      throw new Error('空数据');
    }
  } catch (error) {
    const old = previous?.boards?.[id];
    if (Array.isArray(old) && old.length > 0) {
      boards[id] = old.map((item) => ({ ...item, source: id }));
      boardAt[id] = previous?.boardAt?.[id] ?? previous?.generatedAt ?? Date.now();
      console.warn(`✗ ${id}: ${error.message},保留上次快照 ${old.length} 条`);
    } else {
      console.warn(`✗ ${id}: ${error.message}`);
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
