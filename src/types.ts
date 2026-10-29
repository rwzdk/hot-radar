/** 热榜平台标识 */
export type BoardId = 'weibo' | 'zhihu' | 'douyin' | 'toutiao' | 'bili' | 'hackernews';

/** 热榜条目(榜单页展示) */
export interface BoardItem {
  title: string;
  url: string;
  /** 归一化后的热度数值,用于画热度条 */
  heat?: number;
  /** 原始热度文案,如 "1533万" */
  heatLabel?: string;
  /** 补充信息,如知乎回答数、HN 评论数 */
  extra?: string;
  cover?: string;
  source: BoardId;
}

/** 监控关键词 */
export interface Keyword {
  id: string;
  text: string;
  note?: string;
  /** 命中后需要排除的词,逗号/空格分隔 */
  exclude?: string;
  paused: boolean;
  /** 扫描后是否自动跑 AI 分析 */
  autoAi: boolean;
  createdAt: number;
  lastScanAt?: number;
}

/** AI 分析结果 */
export interface AiAnalysis {
  isReal: boolean;
  /** 0-100,与关键词的直接相关度 */
  relevance: number;
  importance: Importance;
  summary: string;
  reason: string;
  analyzedAt: number;
  model?: string;
}

export type Importance = 'low' | 'medium' | 'high' | 'urgent';

export interface DigestPoint {
  text: string;
  level: Importance;
}

/** 一个关键词的 AI 汇总简报 */
export interface AiDigest {
  headline: string;
  overview: string;
  points: DigestPoint[];
  watch: string[];
  /** 参与汇总的命中条数 */
  covered: number;
  generatedAt: number;
  model?: string;
}

/** 监控/搜索命中的条目 */
export interface WatchResult {
  /** 以 url 作为唯一标识 */
  id: string;
  title: string;
  url: string;
  source: BoardId;
  content?: string;
  heat?: number;
  heatLabel?: string;
  publishedAt?: number;
  /** 首次被扫描到的时间 */
  foundAt: number;
  ai?: AiAnalysis;
}

/** 应用内通知事件 */
export interface NoticeEvent {
  id: string;
  title: string;
  body: string;
  at: number;
  read: boolean;
  keywordId?: string;
}

export interface Settings {
  openrouterKey: string;
  model: string;
  browserNotify: boolean;
  /** 全局排除词(逗号/空格分隔),叠加在每个关键词自己的排除词之上 */
  globalExclude: string;
  /** 页面打开期间自动重新扫描的间隔(分钟),0 = 关闭 */
  autoScanMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  openrouterKey: '',
  model: 'deepseek/deepseek-v3.2',
  browserNotify: false,
  globalExclude: '',
  autoScanMinutes: 0,
};

/** 拼接全局排除词与关键词自己的排除词 */
export function combinedExclude(kwExclude: string | undefined, settings: Settings): string | undefined {
  return [settings.globalExclude, kwExclude]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(',') || undefined;
}

export const IMPORTANCE_ORDER: Importance[] = ['urgent', 'high', 'medium', 'low'];
