import type { AiAnalysis, Importance, WatchResult } from '../types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface AiConfig {
  apiKey: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatChoice {
  message?: { content?: unknown };
}

interface ChatResponse {
  choices?: ChatChoice[];
  error?: { message?: string };
}

/**
 * 直连 OpenRouter Chat Completions。
 * OpenRouter 允许浏览器跨域调用,密钥保存在用户自己的浏览器本地。
 */
async function chat(cfg: AiConfig, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'HotRadar',
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `OpenRouter HTTP ${res.status}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  // 部分模型返回内容数组
  if (Array.isArray(content)) {
    return content.map((c: { text?: string }) => c.text ?? '').join('');
  }
  throw new Error('模型未返回内容');
}

/** 验证密钥是否可用(拉取账户信息) */
export async function testApiKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status},密钥无效或已过期` };
    const json = (await res.json()) as {
      data?: { label?: string; usage?: number; limit?: number | null };
    };
    const d = json.data;
    const quota =
      d?.limit == null ? '不限量' : `额度 $${d.limit - (d.usage ?? 0)} / $${d.limit}`;
    return { ok: true, message: `密钥有效(${d?.label ?? '未命名'} · ${quota})` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '网络错误' };
  }
}

function extractJson(raw: string): Record<string, unknown> | null {
  const text = raw.replace(/```(?:json)?/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `你在为一套"关键词热点监控系统"做内容研判。用户会给出一个监控关键词和一条网络内容(标题+正文摘要),请从情报分析师的角度评估这条内容,只输出一个 JSON 对象,不要输出任何其他文字。

字段要求:
- relevance: 0-100 整数,内容与关键词的"直接相关度"。内容必须直接讨论、点名或实质关联该关键词才算高分;只是同领域、同行业的泛泛内容给 30 分以下。
- isReal: 布尔值,是否疑似真实可信的信息。标题党、无信源的爆料、营销软文、谣言类内容给 false。
- importance: "urgent" | "high" | "medium" | "low" 之一。对"正在关注该关键词的人"的及时价值:重大官宣/事故/版本发布为 urgent 或 high,常规讨论为 medium,边缘信息为 low。
- summary: 不超过 50 字的一句话中文摘要,说清这条内容和关键词的关系。
- reason: 不超过 40 字的打分依据。`;

function buildUserPrompt(keyword: string, item: Pick<WatchResult, 'title' | 'content'>): string {
  const body = (item.content ?? '').slice(0, 600);
  return `监控关键词:【${keyword}】\n\n内容标题:${item.title}\n内容摘要:${body || '(无)'}`;
}

const IMPORTANCES: Importance[] = ['low', 'medium', 'high', 'urgent'];

/** 对单条内容做 AI 研判,失败时抛错由调用方降级 */
export async function analyzeItem(
  cfg: AiConfig,
  keyword: string,
  item: Pick<WatchResult, 'title' | 'content'>,
): Promise<AiAnalysis> {
  const raw = await chat(
    cfg,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(keyword, item) },
    ],
    400,
  );
  const parsed = extractJson(raw);
  if (!parsed) throw new Error('AI 返回内容无法解析为 JSON');

  const relevanceRaw = Number(parsed.relevance);
  const importanceRaw = String(parsed.importance ?? 'low');
  return {
    isReal: parsed.isReal !== false,
    relevance: Number.isFinite(relevanceRaw)
      ? Math.min(100, Math.max(0, Math.round(relevanceRaw)))
      : 0,
    importance: (IMPORTANCES as string[]).includes(importanceRaw)
      ? (importanceRaw as Importance)
      : 'low',
    summary: String(parsed.summary ?? '').slice(0, 80),
    reason: String(parsed.reason ?? '').slice(0, 80),
    analyzedAt: Date.now(),
    model: cfg.model,
  };
}

export interface BatchProgress {
  done: number;
  total: number;
  current?: string;
}

/** 批量分析:小并发跑,逐条回调进度。单条失败不影响整体。 */
export async function analyzeBatch(
  cfg: AiConfig,
  keyword: string,
  items: WatchResult[],
  onItem: (item: WatchResult, analysis: AiAnalysis | null) => void,
  onProgress?: (p: BatchProgress) => void,
  concurrency = 3,
): Promise<void> {
  let done = 0;
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      onProgress?.({ done, total: items.length, current: item.title });
      let analysis: AiAnalysis | null = null;
      try {
        analysis = await analyzeItem(cfg, keyword, item);
      } catch {
        analysis = null;
      }
      onItem(item, analysis);
      done++;
      onProgress?.({ done, total: items.length });
    }
  });
  await Promise.all(workers);
}
