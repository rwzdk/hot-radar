#!/usr/bin/env node
/**
 * 校验九榜快照完整性。
 * 任一榜单为空时退出 1,避免工作流把缺榜快照提交/部署出去。
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const IDS = [
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

const file = join(process.cwd(), 'public', 'data', 'snapshot.json');
let snapshot;
try {
  snapshot = JSON.parse(await readFile(file, 'utf8'));
} catch (error) {
  console.error(`✗ 无法读取快照 ${file}: ${error.message}`);
  process.exit(1);
}

const missing = IDS.filter(
  (id) => !Array.isArray(snapshot?.boards?.[id]) || snapshot.boards[id].length === 0,
);
if (missing.length > 0) {
  console.error(`✗ 快照缺少榜单: ${missing.join(', ')}`);
  process.exit(1);
}

const summary = IDS.map((id) => `${id}:${snapshot.boards[id].length}`).join(', ');
console.log(`✓ 九榜快照完整 (${summary})`);
