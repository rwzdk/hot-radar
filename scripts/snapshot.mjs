#!/usr/bin/env node
/**
 * 每日热榜快照生成器
 * 抓取各平台热榜,写入 public/data/snapshot.json。
 * 由 GitHub Actions 定时执行并提交回仓库;
 * 站点运行时若实时接口不可用,会自动回退读取这份快照。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'snapshot.json');
const API_60S = 'https://60s.viki.moe/v2/';
const TIMEOUT = 15_000;

const BOARDS_60S = ['weibo', 'zhihu', 'douyin', 'toutiao', 'bili'];

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'hot-radar-snapshot/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function formatHeat(value) {
  if (value == null || Number.isNaN(value)) return undefined;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}万`;
  return String(value);
}

async function fetch60s(path) {
  const json = await getJson(API_60S + path);
  if (json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error(`60s API code=${json.code}`);
  }
  return json.data.map((it) => ({
    title: it.title ?? '',
    url: it.link ?? '',
    heat: it.hot_value ?? undefined,
    heatLabel: it.hot_value_desc ?? formatHeat(it.hot_value),
    extra: it.answer_cnt != null ? `${it.answer_cnt} 回答` : undefined,
    cover: it.cover,
  }));
}

async function fetchHackerNews() {
  const json = await getJson(
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
  );
  return json.hits.map((h) => ({
    title: h.title ?? '(无标题)',
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    heat: h.points ?? 0,
    heatLabel: h.points != null ? `${h.points} 分` : undefined,
    extra: `${h.num_comments ?? 0} 评论 · @${h.author ?? '-'}`,
  }));
}

const jobs = [
  ...BOARDS_60S.map((id) => [id, () => fetch60s(id)]),
  ['hackernews', fetchHackerNews],
];

const boards = {};
await Promise.all(
  jobs.map(async ([id, run]) => {
    try {
      const items = await run();
      if (items.length > 0) boards[id] = items;
      console.log(`✓ ${id}: ${items.length} 条`);
    } catch (e) {
      console.warn(`✗ ${id}: ${e.message}`);
    }
  }),
);

const snapshot = {
  generatedAt: Date.now(),
  boards,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log(`\n写入 ${OUT}(共 ${Object.keys(boards).length} 个榜单)`);
