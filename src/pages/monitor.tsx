import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiDigest,
  BoardId,
  Focus,
  Importance,
  Keyword,
  WatchResult,
} from '../types';
import { IMPORTANCE_ORDER, combinedExclude } from '../types';
import { BOARDS } from '../lib/boards';
import {
  scanKeyword,
  scanKeywords,
  mergeHistory,
  type ScanOutcome,
} from '../lib/aggregate';
import { analyzeBatch, analyzeDigest, analyzeItem, type BatchProgress } from '../lib/ai';
import {
  applyFocusCandidates,
  buildFocusTerms,
  clearFocusCache,
  focusScanKey,
} from '../lib/focus';
import {
  downloadFile,
  focusKey,
  loadFocusResults,
  loadWatch,
  saveJson,
  uid,
  useLocalState,
  useSettings,
  watchKey,
  removeKey,
} from '../lib/storage';
import { clockTime, formatDateTime, relativeTime } from '../lib/format';
import { useNotices, notifyBrowser } from '../lib/notices';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ImportanceTag,
  Spinner,
  Toggle,
} from '../components/ui';
import { ResultCard } from '../components/result-card';
import { FocusEditor } from '../components/focus-editor';
import { FocusPanel } from '../components/focus-panel';
import {
  DownloadIcon,
  FileTextIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  TargetIcon,
  TrashIcon,
} from '../components/icons';

const SELECT_CLS =
  'h-8 cursor-pointer rounded-btn border-[3px] border-ink bg-surface px-2.5 text-[13px] font-bold text-ink-soft outline-none transition-all duration-100 hover:-translate-y-px hover:bg-paper hover:text-ink hover:shadow-toon-sm focus:shadow-toon-sm';

function ModeSwitch({
  focusMode,
  navigate,
}: {
  focusMode: boolean;
  navigate: (to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => navigate('monitor')}
        aria-pressed={!focusMode}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-toon px-4 py-1.5 text-[13px] font-black transition-all duration-100 ${
          !focusMode
            ? '-rotate-1 bg-yellow text-ink shadow-toon-sm'
            : 'bg-surface text-ink-soft shadow-toon-sm hover:-translate-x-px hover:-translate-y-px hover:bg-paper hover:text-ink'
        }`}
      >
        <SearchIcon className="size-4" /> 关键词监控
      </button>
      <button
        type="button"
        onClick={() => navigate('monitor?mode=focus')}
        aria-pressed={focusMode}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-toon px-4 py-1.5 text-[13px] font-black transition-all duration-100 ${
          focusMode
            ? '-rotate-1 bg-accent text-white shadow-toon-sm'
            : 'bg-surface text-ink-soft shadow-toon-sm hover:-translate-x-px hover:-translate-y-px hover:bg-paper hover:text-ink'
        }`}
      >
        <SparkIcon className="size-4" /> 关注点推送
      </button>
      <span className="ml-auto hidden text-[11px] font-bold text-muted sm:inline">
        {focusMode ? '自然语言描述 + AI 精排' : '精确关键词匹配 + AI 研判'}
      </span>
    </div>
  );
}

function boardName(source: string): string {
  return BOARDS.find((board) => board.id === source)?.name ?? source;
}

function markdownLink(title: string, url: string): string {
  return `[${title.replace(/[\[\]]/g, '\\$&')}](<${url}>)`;
}

function resultMarkdown(item: WatchResult): string {
  const meta = [
    boardName(item.source),
    item.heatLabel ? `热度 ${item.heatLabel}` : '',
    `捕获于 ${formatDateTime(item.foundAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const ai = item.ai ? ` — ${item.ai.summary}(相关度 ${item.ai.relevance})` : '';
  return `- ${markdownLink(item.title, item.url)} · ${meta}${ai}`;
}

function DigestCard({
  digest,
  busy,
  aiReady,
  hasResults,
  onGenerate,
}: {
  digest: AiDigest;
  busy: boolean;
  aiReady: boolean;
  hasResults: boolean;
  onGenerate: () => void;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="grid size-9 shrink-0 -rotate-3 place-items-center rounded-blob-2 border-toon bg-accent-soft shadow-toon-sm">
          <FileTextIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black">AI 热点简报</h3>
          <p className="font-mono text-[10px] font-bold text-muted">
            基于 {digest.covered} 条 · {formatDateTime(digest.generatedAt)}
            {digest.model ? ` · ${digest.model}` : ''}
          </p>
        </div>
        <Button
          size="sm"
          className="ml-auto"
          onClick={onGenerate}
          disabled={!aiReady || busy || !hasResults}
          title={aiReady ? '基于当前结果重新生成' : '请先在设置中配置 AI 密钥'}
        >
          {busy ? <Spinner className="size-3.5" /> : <SparkIcon className="size-3.5" />}
          {busy ? '生成中…' : '重新生成'}
        </Button>
      </div>

      <p className="text-[15px] font-black leading-6 text-ink">{digest.headline}</p>
      <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-ink-soft">
        {digest.overview}
      </p>

      {digest.points.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t-[2.5px] border-dashed border-ink/15 pt-3">
          {digest.points.map((point, index) => (
            <div key={`${point.text}-${index}`} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                <ImportanceTag level={point.level} />
              </span>
              <span className="text-[13px] font-semibold leading-relaxed text-ink-soft">
                {point.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {digest.watch.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-muted">接下来关注</span>
          {digest.watch.map((item, index) => (
            <Badge key={`${item}-${index}`} tone="neutral">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ============ 单个关键词的监控面板 ============ */

function KeywordPanel({
  kw,
  onUpdate,
  onCountChange,
}: {
  kw: Keyword;
  onUpdate: (patch: Partial<Keyword>) => void;
  onCountChange?: (count: number) => void;
}) {
  const [results, setResults] = useLocalState<WatchResult[]>(watchKey(kw.id), []);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const [settings] = useSettings();
  const [digest, setDigest] = useLocalState<AiDigest | null>(`digest:${kw.id}`, null);
  const { push } = useNotices();

  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState<ScanOutcome['sourceStats'] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<BatchProgress | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const [excludeDraft, setExcludeDraft] = useState(kw.exclude ?? '');

  const [fSource, setFSource] = useState<'all' | BoardId>('all');
  const [fImp, setFImp] = useState<'all' | Importance>('all');
  const [fSort, setFSort] = useState<'heat' | 'relevance' | 'time'>('heat');
  const [fText, setFText] = useState('');

  const aiReady = Boolean(settings.openrouterKey);
  const aiConfig = { apiKey: settings.openrouterKey, model: settings.model };

  useEffect(() => {
    onCountChange?.(results.length);
  }, [results.length, onCountChange]);

  function noticeHigh(item: WatchResult) {
    if (!item.ai || !['high', 'urgent'].includes(item.ai.importance)) return;
    push({
      title: `【${item.ai.importance === 'urgent' ? '紧急' : '重要'}】${kw.text}`,
      body: `${item.title.slice(0, 60)} — ${item.ai.summary}`,
      keywordId: kw.id,
    });
    notifyBrowser(`热点雷达 · ${kw.text}`, `${item.title.slice(0, 70)}`);
  }

  async function runAi(items: WatchResult[]): Promise<number> {
    if (!aiReady || items.length === 0) return 0;
    setAiBusy(true);
    setAiProgress({ done: 0, total: items.length });
    setAiError('');
    try {
      const { failed } = await analyzeBatch(
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
      if (failed > 0) setAiError(`${failed} 条研判失败,可稍后重试。`);
      return failed;
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 研判失败,请稍后重试');
      return items.length;
    } finally {
      setAiBusy(false);
      setAiProgress(null);
    }
  }

  async function scan() {
    setScanning(true);
    setAiError('');
    setNewIds(new Set());
    try {
      const outcome = await scanKeyword(kw.text, {
        exclude: combinedExclude(kw.exclude, settings),
      });
      const known = new Set(resultsRef.current.map((item) => item.id));
      const added = outcome.results.filter((item) => !known.has(item.id));
      setResults((prev) => mergeHistory(prev, outcome.results).merged);
      setStats(outcome.sourceStats);
      setNewIds(new Set(added.map((item) => item.id)));
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
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '扫描失败,请稍后重试');
    } finally {
      setScanning(false);
    }
  }

  async function analyzeOne(item: WatchResult) {
    if (!aiReady) return;
    setAnalyzingId(item.id);
    setAiError('');
    try {
      const analysis = await analyzeItem(aiConfig, kw.text, item);
      setResults((prev) => prev.map((r) => (r.id === item.id ? { ...r, ai: analysis } : r)));
      noticeHigh({ ...item, ai: analysis });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '研判失败,请稍后重试');
    } finally {
      setAnalyzingId(null);
    }
  }

  function commitExclude() {
    const next = excludeDraft.trim();
    if (next !== (kw.exclude ?? '')) onUpdate({ exclude: next || undefined });
  }

  async function generateDigest() {
    if (!aiReady || results.length === 0) return;
    setDigestBusy(true);
    setAiError('');
    try {
      setDigest(await analyzeDigest(aiConfig, kw.text, results));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '简报生成失败,请稍后重试');
    } finally {
      setDigestBusy(false);
    }
  }

  function exportMarkdown() {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;
    const safeName = kw.text.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'keyword';
    const lines = [
      `# 热点雷达 · ${kw.text}`,
      '',
      `导出时间:${formatDateTime(now.getTime())}`,
      `累计 ${results.length} 条,已研判 ${analyzedCount} 条`,
    ];

    if (digest) {
      lines.push(
        '',
        '## AI 热点简报',
        '',
        `**${digest.headline}**`,
        '',
        digest.overview,
        '',
        `生成时间:${formatDateTime(digest.generatedAt)} · 基于 ${digest.covered} 条`,
      );
      if (digest.points.length > 0) {
        lines.push('', '### 关键进展', '');
        digest.points.forEach((point) => lines.push(`- ${point.text}`));
      }
      if (digest.watch.length > 0) {
        lines.push('', '### 接下来关注', '');
        digest.watch.forEach((item) => lines.push(`- ${item}`));
      }
    }

    lines.push('', '## 命中内容', '');
    const groups = [
      { label: '紧急', list: filtered.filter((item) => item.ai?.importance === 'urgent') },
      { label: '重要', list: filtered.filter((item) => item.ai?.importance === 'high') },
      { label: '一般', list: filtered.filter((item) => item.ai?.importance === 'medium') },
      { label: '边缘', list: filtered.filter((item) => item.ai?.importance === 'low') },
      { label: '未研判', list: filtered.filter((item) => !item.ai) },
    ];
    const hasContent = groups.some((group) => group.list.length > 0);
    if (!hasContent) {
      lines.push('_(当前过滤条件下没有内容)_');
    } else {
      groups.forEach((group) => {
        if (group.list.length === 0) return;
        lines.push(`### ${group.label}`, '');
        group.list.forEach((item) => lines.push(resultMarkdown(item)));
        lines.push('');
      });
    }

    downloadFile(`hot-radar-${safeName}-${stamp}.md`, lines.join('\n'), 'text/markdown');
  }

  const filtered = useMemo(() => {
    let list = results;
    if (fSource !== 'all') list = list.filter((r) => r.source === fSource);
    if (fImp !== 'all') list = list.filter((r) => r.ai?.importance === fImp);
    const query = fText.trim().toLowerCase();
    if (query) {
      list = list.filter((r) =>
        `${r.title} ${r.ai?.summary ?? ''}`.toLowerCase().includes(query),
      );
    }
    const sorted = [...list];
    if (fSort === 'relevance') sorted.sort((a, b) => (b.ai?.relevance ?? -1) - (a.ai?.relevance ?? -1));
    else if (fSort === 'time') sorted.sort((a, b) => b.foundAt - a.foundAt);
    else sorted.sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));
    return sorted;
  }, [results, fSource, fImp, fSort, fText]);

  const analyzedCount = results.filter((r) => r.ai).length;
  const pendingAi = results.filter((r) => !r.ai).slice(0, 12);

  return (
    <div className="space-y-4">
      {/* 面板头 */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <TargetIcon className="size-6 shrink-0" />
              <h2 className="truncate text-lg font-black tracking-tight">{kw.text}</h2>
              {kw.paused && <Badge tone="neutral">已暂停</Badge>}
            </div>
            <p className="mt-1 font-mono text-xs font-bold text-muted">
              累计 {results.length} 条 · 已研判 {analyzedCount} 条
              {kw.lastScanAt && ` · 上次扫描 ${relativeTime(kw.lastScanAt)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={scan}
              disabled={scanning || kw.paused || aiBusy || digestBusy}
            >
              {scanning ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
              {scanning ? '扫描中…' : '立即扫描'}
            </Button>
            <Button
              onClick={() => runAi(pendingAi)}
              disabled={aiBusy || digestBusy || scanning || !aiReady || pendingAi.length === 0}
              title={aiReady ? '批量研判尚未分析的命中内容' : '请先在设置中配置 AI 密钥'}
            >
              {aiBusy ? <Spinner className="size-4" /> : <SparkIcon className="size-4" />}
              AI 研判{pendingAi.length > 0 ? ` ${pendingAi.length} 条` : ''}
            </Button>
            <Button
              onClick={generateDigest}
              disabled={digestBusy || aiBusy || scanning || !aiReady || results.length === 0}
              title={aiReady ? '基于当前结果生成一份热点简报' : '请先在设置中配置 AI 密钥'}
            >
              {digestBusy ? <Spinner className="size-4" /> : <FileTextIcon className="size-4" />}
              AI 简报
            </Button>
            <Button
              onClick={exportMarkdown}
              disabled={results.length === 0}
              title="导出当前过滤结果为 Markdown"
            >
              <DownloadIcon className="size-4" /> 导出
            </Button>
          </div>
        </div>

        {/* 源命中统计 */}
        {stats && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.map((s) => (
              <Badge key={s.source} tone={s.matched > 0 ? 'accent' : 'neutral'}>
                {s.ok
                  ? s.matched > 0
                    ? `· ${boardName(s.source)} ${s.matched} 命中`
                    : `${boardName(s.source)} 0`
                  : `${boardName(s.source)} 失败`}
              </Badge>
            ))}
          </div>
        )}

        {/* AI 进度条 */}
        {aiBusy && aiProgress && (
          <div className="mt-3">
            <div className="h-3 overflow-hidden rounded-full border-toon-sm bg-surface">
              <div
                className="h-full rounded-full bg-teal transition-all duration-300"
                style={{ width: `${(aiProgress.done / Math.max(1, aiProgress.total)) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-bold text-muted">
              AI 研判中 {aiProgress.done}/{aiProgress.total}
              {aiProgress.current && ` · ${aiProgress.current.slice(0, 30)}…`}
            </p>
          </div>
        )}

        {aiError && (
          <p className="mt-2 text-xs font-bold text-danger" role="status">
            {aiError}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t-[3px] border-dashed border-ink/15 pt-3">
          <Toggle
            checked={kw.autoAi}
            onChange={(v) => onUpdate({ autoAi: v })}
            label="扫描后自动 AI 研判"
          />
          <label className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            排除词
            <input
              value={excludeDraft}
              onChange={(e) => setExcludeDraft(e.target.value)}
              onBlur={commitExclude}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              placeholder="广告,抽奖"
              aria-label="排除词,逗号分隔"
              title="命中这些词的内容会被忽略,逗号或空格分隔"
              className="h-7 w-32 rounded-[9px] border-[2.5px] border-ink bg-surface px-2 text-xs font-bold text-ink outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
            />
          </label>
          <span className={`text-xs font-bold ${aiReady ? 'text-ok' : 'text-warn'}`}>
            {aiReady ? `● AI 已就绪(${settings.model})` : '● 未配置 AI 密钥,前往设置页填写'}
          </span>
        </div>
      </Card>

      {digest && (
        <DigestCard
          digest={digest}
          busy={digestBusy}
          aiReady={aiReady}
          hasResults={results.length > 0}
          onGenerate={generateDigest}
        />
      )}

      {/* 过滤条 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={fText}
          onChange={(e) => setFText(e.target.value)}
          placeholder="过滤标题…"
          aria-label="过滤监控结果"
          className="h-8 w-32 rounded-btn border-[3px] border-ink bg-surface px-2.5 text-[13px] font-bold text-ink outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
        />
        <select
          value={fSource}
          onChange={(e) => setFSource(e.target.value as typeof fSource)}
          className={SELECT_CLS}
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
          className={SELECT_CLS}
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
          className={SELECT_CLS}
        >
          <option value="heat">按热度</option>
          <option value="relevance">按相关度</option>
          <option value="time">按捕获时间</option>
        </select>
        <span className="ml-auto font-mono text-xs font-bold text-muted">{filtered.length} 条</span>
      </div>

      {/* 结果列表 */}
      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<TargetIcon className="size-7" />}
            title={results.length === 0 ? '还没有扫描记录' : '当前过滤条件下没有内容'}
            desc={
              results.length === 0
                ? '点击「立即扫描」,将从各平台热榜与 HackerNews 聚合查找相关内容'
                : '换个来源、重要度或过滤词试试'
            }
            action={
              results.length === 0 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={scan}
                  disabled={scanning || aiBusy || digestBusy || kw.paused}
                >
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
              isNew={newIds.has(item.id)}
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
  const [focuses, setFocuses] = useLocalState<Focus[]>('focuses', []);
  const [settings] = useSettings();
  const { push } = useNotices();
  const [draft, setDraft] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [focusCounts, setFocusCounts] = useState<Record<string, number>>({});
  const [editingFocus, setEditingFocus] = useState<Focus | 'new' | null>(null);
  const [autoScanAt, setAutoScanAt] = useState(0);

  const keywordsRef = useRef(keywords);
  keywordsRef.current = keywords;
  const focusesRef = useRef(focuses);
  focusesRef.current = focuses;
  const autoScanningRef = useRef(false);

  const valid = params.kw && keywords.some((k) => k.id === params.kw);
  const selectedId = valid ? params.kw : keywords[0]?.id;
  const selected = keywords.find((k) => k.id === selectedId);

  const focusMode = Boolean(params.focus) || params.mode === 'focus';
  const validFocus = params.focus && focuses.some((f) => f.id === params.focus);
  const selectedFocusId = validFocus ? params.focus : focuses[0]?.id;
  const selectedFocus = focuses.find((f) => f.id === selectedFocusId);

  /* 页面打开期间的自动扫描:关键词与关注点共享一轮热榜拉取,关注点再走 AI 精排 */
  useEffect(() => {
    const minutes = settings.autoScanMinutes;
    if (!minutes) return;

    async function tick() {
      if (document.visibilityState !== 'visible' || autoScanningRef.current) return;
      const activeKeywords = keywordsRef.current.filter((k) => !k.paused);
      const activeFocuses = focusesRef.current.filter((f) => !f.paused);
      if (activeKeywords.length === 0 && activeFocuses.length === 0) return;
      autoScanningRef.current = true;
      try {
        const focusKeys = activeFocuses.map((focus) => focusScanKey(focus.id));
        const texts = [...activeKeywords.map((kw) => kw.text), ...focusKeys];
        const terms = Object.fromEntries(
          activeFocuses.map((focus) => [focusScanKey(focus.id), buildFocusTerms(focus)]),
        );
        const hnQueries = Object.fromEntries(
          activeFocuses.map((focus) => [focusScanKey(focus.id), focus.name]),
        );
        const excludes = Object.fromEntries([
          ...activeKeywords.map((kw) => [kw.text, combinedExclude(kw.exclude, settings)]),
          ...activeFocuses.map((focus) => [
            focusScanKey(focus.id),
            combinedExclude(focus.exclude, settings),
          ]),
        ]);

        const outcomes = await scanKeywords(texts, { terms, hnQueries, excludes });
        const now = Date.now();

        for (const kw of activeKeywords) {
          const outcome = outcomes[kw.text];
          if (!outcome) continue;
          const { merged, added } = mergeHistory(loadWatch(kw.id), outcome.results);
          saveJson(watchKey(kw.id), merged);
          setKeywords((prev) =>
            prev.map((k) => (k.id === kw.id ? { ...k, lastScanAt: now } : k)),
          );
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
          }
        }

        for (const focus of activeFocuses) {
          const outcome = outcomes[focusScanKey(focus.id)];
          if (!outcome) continue;
          const applied = await applyFocusCandidates(focus, outcome.results, settings);
          setFocuses((prev) =>
            prev.map((f) => (f.id === focus.id ? { ...f, lastScanAt: now } : f)),
          );
          if (applied.added.length > 0) {
            push({
              title: `【关注点】${focus.name} 发现 ${applied.added.length} 条`,
              body: applied.added
                .slice(0, 3)
                .map((item) => item.title.slice(0, 30))
                .join(' / '),
              focusId: focus.id,
            });
            notifyBrowser(
              `热点雷达 · ${focus.name}`,
              `关注点发现 ${applied.added.length} 条新内容`,
            );
          }
        }

        setAutoScanAt(now);
      } catch {
        /* 自动扫描失败静默,等待下个周期 */
      } finally {
        autoScanningRef.current = false;
      }
    }

    const timer = window.setInterval(() => void tick(), minutes * 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [settings, push, setKeywords, setFocuses]);

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
    removeKey(`digest:${id}`);
    setKeywords((list) => list.filter((k) => k.id !== id));
    if (selectedId === id) navigate('monitor');
  }

  function saveFocus(next: Focus) {
    setFocuses((list) => {
      const exists = list.some((focus) => focus.id === next.id);
      return exists ? list.map((focus) => (focus.id === next.id ? next : focus)) : [next, ...list];
    });
    setEditingFocus(null);
    setFocusCounts((prev) => ({
      ...prev,
      [next.id]: loadFocusResults(next.id).length,
    }));
    navigate(`monitor?focus=${next.id}`);
  }

  function updateFocus(id: string, patch: Partial<Focus>) {
    setFocuses((list) =>
      list.map((focus) => (focus.id === id ? { ...focus, ...patch } : focus)),
    );
  }

  function deleteFocus(id: string) {
    if (!confirm('删除该关注点及其全部历史?')) return;
    removeKey(focusKey(id));
    removeKey(`digest:focus:${id}`);
    clearFocusCache(id);
    setFocuses((list) => list.filter((focus) => focus.id !== id));
    if (editingFocus !== 'new' && editingFocus?.id === id) setEditingFocus(null);
    if (selectedFocusId === id) navigate('monitor?mode=focus');
  }

  if (focusMode) {
    return (
      <div className="grid animate-rise gap-4 lg:grid-cols-[270px_1fr]">
        <div className="lg:col-span-2">
          <ModeSwitch focusMode navigate={navigate} />
        </div>

        <div className="space-y-3">
          <Card className="p-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setEditingFocus('new')}
            >
              <PlusIcon className="size-4" /> 新建关注点
            </Button>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-muted">
              用一句自然语言描述兴趣；标签留空时保存会调用一次 AI 提取。
            </p>
          </Card>

          <Card className="p-1.5">
            {focuses.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] font-semibold leading-relaxed text-muted">
                还没有关注点
                <br />
                新建一个，让 AI 帮你盯热点
              </p>
            ) : (
              focuses.map((focus) => {
                const on = focus.id === selectedFocusId && !editingFocus;
                const count = focusCounts[focus.id] ?? loadFocusResults(focus.id).length;
                return (
                  <div
                    key={focus.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-nav border-[3px] border-transparent px-3 py-2.5 transition-all duration-100 ${
                      on ? '-rotate-1 border-ink bg-yellow shadow-toon-sm' : 'hover:bg-paper'
                    }`}
                    onClick={() => {
                      setEditingFocus(null);
                      navigate(`monitor?focus=${focus.id}`);
                    }}
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-blob-3 ${
                        focus.paused ? 'bg-muted' : on ? 'bg-accent' : 'bg-teal'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-extrabold text-ink">{focus.name}</p>
                      <p className="font-mono text-[10px] font-bold text-muted">
                        {focus.paused ? '已暂停' : `≥ ${focus.minScore} 分`} · {count} 条
                        {focus.lastScanAt ? ` · ${relativeTime(focus.lastScanAt)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateFocus(focus.id, { paused: !focus.paused });
                      }}
                      className="cursor-pointer rounded p-1 text-muted transition-colors hover:bg-paper hover:text-ink"
                      title={focus.paused ? '恢复监控' : '暂停监控'}
                      aria-label={focus.paused ? '恢复关注点' : '暂停关注点'}
                    >
                      {focus.paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteFocus(focus.id);
                      }}
                      className="cursor-pointer rounded p-1 text-muted transition-colors hover:bg-accent-soft hover:text-danger"
                      title="删除关注点"
                      aria-label="删除关注点"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </Card>

          {settings.autoScanMinutes > 0 && focuses.some((focus) => !focus.paused) && (
            <p className="px-1 text-[11px] font-bold leading-relaxed text-muted">
              自动扫描:每 {settings.autoScanMinutes} 分钟
              {autoScanAt ? ` · 上次 ${clockTime(autoScanAt)}` : ' · 本页打开期间生效'}
              <br />
              关注点只精排新增候选，相同内容不重复扣费。
            </p>
          )}
        </div>

        <div className="min-w-0">
          {editingFocus ? (
            <FocusEditor
              focus={editingFocus === 'new' ? null : editingFocus}
              settings={settings}
              onSave={saveFocus}
              onCancel={() => setEditingFocus(null)}
            />
          ) : selectedFocus ? (
            <FocusPanel
              key={selectedFocus.id}
              focus={selectedFocus}
              settings={settings}
              onUpdate={(patch) => updateFocus(selectedFocus.id, patch)}
              onEdit={() => setEditingFocus(selectedFocus)}
              onCountChange={(count) =>
                setFocusCounts((prev) =>
                  prev[selectedFocus.id] === count
                    ? prev
                    : { ...prev, [selectedFocus.id]: count },
                )
              }
            />
          ) : (
            <Card>
              <EmptyState
                icon={<SparkIcon className="size-7" />}
                title="选择或新建一个关注点"
                desc="用自然语言描述你关心什么，系统会先标签粗筛，再对新增候选做 AI 精排"
              />
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid animate-rise gap-4 lg:grid-cols-[270px_1fr]">
      <div className="lg:col-span-2">
        <ModeSwitch focusMode={false} navigate={navigate} />
      </div>

      {/* 关键词列表 */}
      <div className="space-y-3">
        <Card className="p-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="输入关注的关键词,如 Claude"
              aria-label="新建监控关键词"
              className="h-9 min-w-0 flex-1 rounded-btn border-[3px] border-ink bg-surface px-3 text-sm font-bold outline-none transition-all duration-100 placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={addKeyword}
              className="w-9 px-0"
              aria-label="添加关键词"
              title="添加关键词"
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-1.5">
          {keywords.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] font-semibold leading-relaxed text-muted">
              还没有监控关键词
              <br />
              添加一个开始追踪热点
            </p>
          ) : (
            keywords.map((k) => {
              const on = k.id === selectedId;
              const count = counts[k.id] ?? loadWatch(k.id).length;
              return (
                <div
                  key={k.id}
                  className={`group flex cursor-pointer items-center gap-2 rounded-nav border-[3px] border-transparent px-3 py-2.5 transition-all duration-100 ${
                    on
                      ? '-rotate-1 border-ink bg-yellow shadow-toon-sm'
                      : 'hover:bg-paper'
                  }`}
                  onClick={() => navigate(`monitor?kw=${k.id}`)}
                >
                  <span
                    className={`size-2.5 shrink-0 rounded-blob-3 ${
                      k.paused ? 'bg-muted' : on ? 'bg-accent' : 'bg-teal'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold text-ink">{k.text}</p>
                    <p className="font-mono text-[10px] font-bold text-muted">
                      {k.paused ? '已暂停' : '监控中'} · {count} 条
                      {k.lastScanAt ? ` · ${relativeTime(k.lastScanAt)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateKeyword(k.id, { paused: !k.paused });
                    }}
                    className="cursor-pointer rounded p-1 text-muted transition-colors hover:bg-paper hover:text-ink"
                    title={k.paused ? '恢复监控' : '暂停监控'}
                    aria-label={k.paused ? '恢复监控' : '暂停监控'}
                  >
                    {k.paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteKeyword(k.id);
                    }}
                    className="cursor-pointer rounded p-1 text-muted transition-colors hover:bg-accent-soft hover:text-danger"
                    title="删除"
                    aria-label="删除关键词"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </Card>

        {settings.autoScanMinutes > 0 && keywords.some((k) => !k.paused) && (
          <p className="px-1 text-[11px] font-bold leading-relaxed text-muted">
            自动扫描:每 {settings.autoScanMinutes} 分钟
            {autoScanAt ? ` · 上次 ${clockTime(autoScanAt)}` : ' · 本页打开期间生效'}
          </p>
        )}
      </div>

      {/* 右侧面板 */}
      {selected ? (
        <KeywordPanel
          key={selected.id}
          kw={selected}
          onUpdate={(patch) => updateKeyword(selected.id, patch)}
          onCountChange={(count) =>
            setCounts((prev) => (prev[selected.id] === count ? prev : { ...prev, [selected.id]: count }))
          }
        />
      ) : (
        <Card>
          <EmptyState
            icon={<TargetIcon className="size-7" />}
            title="选择或创建一个关键词"
            desc="热点雷达会从各平台热榜与 HackerNews 中,持续追踪与关键词相关的内容"
          />
        </Card>
      )}
    </div>
  );
}
