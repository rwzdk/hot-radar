import { useMemo, useState } from 'react';
import type { BoardId, Importance, Keyword, Settings, WatchResult } from '../types';
import { DEFAULT_SETTINGS, IMPORTANCE_ORDER } from '../types';
import { BOARDS } from '../lib/boards';
import { scanKeyword, mergeHistory, type ScanOutcome } from '../lib/aggregate';
import { analyzeBatch, analyzeItem, type BatchProgress } from '../lib/ai';
import { loadWatch, uid, useLocalState, watchKey, removeKey } from '../lib/storage';
import { relativeTime } from '../lib/format';
import { useNotices, notifyBrowser } from '../lib/notices';
import { Badge, Button, Card, EmptyState, Spinner, Toggle } from '../components/ui';
import { ResultCard } from '../components/result-card';
import {
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  TargetIcon,
  TrashIcon,
} from '../components/icons';

/* ============ 单个关键词的监控面板 ============ */

function KeywordPanel({
  kw,
  onUpdate,
}: {
  kw: Keyword;
  onUpdate: (patch: Partial<Keyword>) => void;
}) {
  const [results, setResults] = useLocalState<WatchResult[]>(watchKey(kw.id), []);
  const [settings] = useLocalState<Settings>('settings', DEFAULT_SETTINGS);
  const { push } = useNotices();

  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState<ScanOutcome['sourceStats'] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<BatchProgress | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const [fSource, setFSource] = useState<'all' | BoardId>('all');
  const [fImp, setFImp] = useState<'all' | Importance>('all');
  const [fSort, setFSort] = useState<'heat' | 'relevance' | 'time'>('heat');

  const aiReady = Boolean(settings.openrouterKey);
  const aiConfig = { apiKey: settings.openrouterKey, model: settings.model };

  function noticeHigh(item: WatchResult) {
    if (!item.ai || !['high', 'urgent'].includes(item.ai.importance)) return;
    push({
      title: `【${item.ai.importance === 'urgent' ? '紧急' : '重要'}】${kw.text}`,
      body: `${item.title.slice(0, 60)} — ${item.ai.summary}`,
      keywordId: kw.id,
    });
    notifyBrowser(`热点雷达 · ${kw.text}`, `${item.title.slice(0, 70)}`);
  }

  async function runAi(items: WatchResult[]) {
    if (!aiReady || items.length === 0) return;
    setAiBusy(true);
    setAiProgress({ done: 0, total: items.length });
    await analyzeBatch(
      aiConfig,
      kw.text,
      items,
      (item, analysis) => {
        setResults((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, ai: analysis ?? r.ai ?? undefined } : r,
          ),
        );
        if (analysis) {
          noticeHigh({ ...item, ai: analysis });
        }
      },
      (p) => setAiProgress(p),
    );
    setAiBusy(false);
    setAiProgress(null);
  }

  async function scan() {
    setScanning(true);
    try {
      const outcome = await scanKeyword(kw.text);
      const { merged, added } = mergeHistory(results, outcome.results);
      setResults(merged);
      setStats(outcome.sourceStats);
      onUpdate({ lastScanAt: Date.now() });

      if (added.length > 0) {
        push({
          title: `「${kw.text}」发现 ${added.length} 条新内容`,
          body: added
            .slice(0, 3)
            .map((a) => a.title.slice(0, 30))
            .join(' / '),
          keywordId: kw.id,
        });
        notifyBrowser(`热点雷达 · ${kw.text}`, `发现 ${added.length} 条新内容`);
        if (kw.autoAi) await runAi(added.slice(0, 10));
      }
    } finally {
      setScanning(false);
    }
  }

  async function analyzeOne(item: WatchResult) {
    if (!aiReady) return;
    setAnalyzingId(item.id);
    try {
      const analysis = await analyzeItem(aiConfig, kw.text, item);
      setResults((prev) => prev.map((r) => (r.id === item.id ? { ...r, ai: analysis } : r)));
      noticeHigh({ ...item, ai: analysis });
    } catch {
      /* 静默:用户可重试 */
    } finally {
      setAnalyzingId(null);
    }
  }

  const filtered = useMemo(() => {
    let list = results;
    if (fSource !== 'all') list = list.filter((r) => r.source === fSource);
    if (fImp !== 'all') list = list.filter((r) => r.ai?.importance === fImp);
    const sorted = [...list];
    if (fSort === 'relevance') sorted.sort((a, b) => (b.ai?.relevance ?? -1) - (a.ai?.relevance ?? -1));
    else if (fSort === 'time') sorted.sort((a, b) => b.foundAt - a.foundAt);
    else sorted.sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));
    return sorted;
  }, [results, fSource, fImp, fSort]);

  const analyzedCount = results.filter((r) => r.ai).length;
  const pendingAi = results.filter((r) => !r.ai).slice(0, 12);

  return (
    <div className="space-y-4">
      {/* 面板头 */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <TargetIcon className="size-5 shrink-0 text-accent" />
              <h2 className="truncate text-lg font-semibold tracking-tight">{kw.text}</h2>
              {kw.paused && <Badge>已暂停</Badge>}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">
              累计 {results.length} 条 · 已研判 {analyzedCount} 条
              {kw.lastScanAt && ` · 上次扫描 ${relativeTime(kw.lastScanAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={scan} disabled={scanning || kw.paused}>
              {scanning ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
              {scanning ? '扫描中…' : '立即扫描'}
            </Button>
            <Button onClick={() => runAi(pendingAi)} disabled={aiBusy || !aiReady || pendingAi.length === 0}>
              {aiBusy ? <Spinner className="size-4" /> : <SparkIcon className="size-4" />}
              AI 研判{pendingAi.length > 0 ? ` ${pendingAi.length} 条` : ''}
            </Button>
          </div>
        </div>

        {/* 源命中统计 */}
        {stats && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.map((s) => (
              <Badge key={s.source} tone={s.matched > 0 ? 'accent' : 'neutral'}>
                {s.ok ? (s.matched > 0 ? `· ${s.source} ${s.matched} 命中` : `${s.source} 0`) : `${s.source} 失败`}
              </Badge>
            ))}
          </div>
        )}

        {/* AI 进度条 */}
        {aiBusy && aiProgress && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${(aiProgress.done / Math.max(1, aiProgress.total)) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              AI 研判中 {aiProgress.done}/{aiProgress.total}
              {aiProgress.current && ` · ${aiProgress.current.slice(0, 30)}…`}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/70 pt-3">
          <Toggle
            checked={kw.autoAi}
            onChange={(v) => onUpdate({ autoAi: v })}
            label="扫描后自动 AI 研判"
          />
          <span className={`text-xs ${aiReady ? 'text-ok' : 'text-warn'}`}>
            {aiReady ? `● AI 已就绪(${settings.model})` : '● 未配置 AI 密钥,前往设置页填写'}
          </span>
        </div>
      </Card>

      {/* 过滤条 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={fSource}
          onChange={(e) => setFSource(e.target.value as typeof fSource)}
          className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink-soft outline-none"
        >
          <option value="all">全部来源</option>
          {BOARDS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={fImp}
          onChange={(e) => setFImp(e.target.value as typeof fImp)}
          className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink-soft outline-none"
        >
          <option value="all">全部重要度</option>
          {IMPORTANCE_ORDER.map((i) => (
            <option key={i} value={i}>
              {{ urgent: '紧急', high: '重要', medium: '一般', low: '边缘' }[i]}
            </option>
          ))}
        </select>
        <select
          value={fSort}
          onChange={(e) => setFSort(e.target.value as typeof fSort)}
          className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink-soft outline-none"
        >
          <option value="heat">按热度</option>
          <option value="relevance">按相关度</option>
          <option value="time">按捕获时间</option>
        </select>
        <span className="ml-auto font-mono text-xs text-muted">{filtered.length} 条</span>
      </div>

      {/* 结果列表 */}
      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<TargetIcon className="size-10" />}
            title={results.length === 0 ? '还没有扫描记录' : '当前过滤条件下没有内容'}
            desc={
              results.length === 0
                ? '点击「立即扫描」,将从各平台热榜与 HackerNews 聚合查找相关内容'
                : '换个来源或重要度试试'
            }
            action={
              results.length === 0 ? (
                <Button variant="primary" size="sm" onClick={scan} disabled={scanning}>
                  {scanning ? '扫描中…' : '立即扫描'}
                </Button>
              ) : undefined
            }
          />
        ) : (
          filtered.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              onAnalyze={aiReady ? analyzeOne : undefined}
              analyzing={analyzingId === item.id}
            />
          ))
        )}
      </Card>
    </div>
  );
}

/* ============ 监控页 ============ */

export default function MonitorPage({
  params,
  navigate,
}: {
  params: Record<string, string>;
  navigate: (to: string) => void;
}) {
  const [keywords, setKeywords] = useLocalState<Keyword[]>('keywords', []);
  const [draft, setDraft] = useState('');

  const valid = params.kw && keywords.some((k) => k.id === params.kw);
  const selectedId = valid ? params.kw : keywords[0]?.id;
  const selected = keywords.find((k) => k.id === selectedId);

  function addKeyword() {
    const text = draft.trim();
    if (!text) return;
    if (keywords.some((k) => k.text.toLowerCase() === text.toLowerCase())) {
      setDraft('');
      return;
    }
    const kw: Keyword = {
      id: uid(),
      text,
      paused: false,
      autoAi: true,
      createdAt: Date.now(),
    };
    setKeywords((list) => [kw, ...list]);
    setDraft('');
    navigate(`monitor?kw=${kw.id}`);
  }

  function updateKeyword(id: string, patch: Partial<Keyword>) {
    setKeywords((list) => list.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  }

  function deleteKeyword(id: string) {
    if (!confirm('删除该关键词及其全部监控历史?')) return;
    removeKey(watchKey(id));
    setKeywords((list) => list.filter((k) => k.id !== id));
    if (selectedId === id) navigate('monitor');
  }

  return (
    <div className="grid animate-rise gap-4 lg:grid-cols-[270px_1fr]">
      {/* 关键词列表 */}
      <div className="space-y-3">
        <Card className="p-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="输入关注的关键词,如 Claude"
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-accent/60"
            />
            <Button variant="primary" size="sm" onClick={addKeyword} className="w-9 px-0">
              <PlusIcon className="size-4" />
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {keywords.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
              还没有监控关键词
              <br />
              添加一个开始追踪热点
            </p>
          ) : (
            keywords.map((k) => {
              const on = k.id === selectedId;
              const count = loadWatch(k.id).length;
              return (
                <div
                  key={k.id}
                  className={`group flex cursor-pointer items-center gap-2 border-b border-line/60 px-3.5 py-2.5 transition-colors last:border-0 ${
                    on ? 'bg-accent-soft/50' : 'hover:bg-paper/70'
                  }`}
                  onClick={() => navigate(`monitor?kw=${k.id}`)}
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${k.paused ? 'bg-muted' : on ? 'bg-accent' : 'bg-ok'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{k.text}</p>
                    <p className="font-mono text-[10px] text-muted">
                      {k.paused ? '已暂停' : '监控中'} · {count} 条
                      {k.lastScanAt ? ` · ${relativeTime(k.lastScanAt)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateKeyword(k.id, { paused: !k.paused });
                    }}
                    className="cursor-pointer rounded p-1 text-muted opacity-0 transition-all hover:bg-paper hover:text-ink group-hover:opacity-100"
                    title={k.paused ? '恢复监控' : '暂停监控'}
                  >
                    {k.paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteKeyword(k.id);
                    }}
                    className="cursor-pointer rounded p-1 text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    title="删除"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* 右侧面板 */}
      {selected ? (
        <KeywordPanel
          key={selected.id}
          kw={selected}
          onUpdate={(patch) => updateKeyword(selected.id, patch)}
        />
      ) : (
        <Card>
          <EmptyState
            icon={<TargetIcon className="size-10" />}
            title="选择或创建一个关键词"
            desc="热点雷达会从微博、知乎、抖音、头条、B站热榜与 HackerNews 中,持续追踪与关键词相关的内容"
          />
        </Card>
      )}
    </div>
  );
}
