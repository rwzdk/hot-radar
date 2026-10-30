import { useEffect, useMemo, useState } from 'react';
import type {
  AiDigest,
  BoardId,
  Focus,
  FocusHit,
  Importance,
  Settings,
} from '../types';
import { IMPORTANCE_ORDER } from '../types';
import { BOARDS } from '../lib/boards';
import { analyzeDigest } from '../lib/ai';
import { scanFocus } from '../lib/focus';
import { focusKey, useLocalState } from '../lib/storage';
import { relativeTime } from '../lib/format';
import { notifyBrowser, useNotices } from '../lib/notices';
import { Badge, Button, Card, EmptyState, Spinner } from './ui';
import { DigestCard } from './digest-card';
import { ResultCard } from './result-card';
import { FileTextIcon, SearchIcon, SparkIcon } from './icons';

const SELECT_CLS =
  'h-8 cursor-pointer rounded-btn border-[3px] border-ink bg-surface px-2.5 text-[13px] font-bold text-ink-soft outline-none transition-all duration-100 hover:-translate-y-px hover:bg-paper hover:text-ink hover:shadow-toon-sm focus:shadow-toon-sm';

export function FocusPanel({
  focus,
  settings,
  onUpdate,
  onEdit,
  onCountChange,
}: {
  focus: Focus;
  settings: Settings;
  onUpdate: (patch: Partial<Focus>) => void;
  onEdit: () => void;
  onCountChange?: (count: number) => void;
}) {
  const [results, setResults] = useLocalState<FocusHit[]>(focusKey(focus.id), []);
  const [digest, setDigest] = useLocalState<AiDigest | null>(`digest:focus:${focus.id}`, null);
  const { push } = useNotices();

  const [scanning, setScanning] = useState(false);
  const [digestBusy, setDigestBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const [stats, setStats] = useState<{ source: string; total: number; matched: number; ok: boolean }[] | null>(null);

  const [fSource, setFSource] = useState<'all' | BoardId>('all');
  const [fImp, setFImp] = useState<'all' | Importance>('all');
  const [fSort, setFSort] = useState<'score' | 'heat' | 'time'>('score');
  const [fText, setFText] = useState('');

  const aiReady = Boolean(settings.openrouterKey);

  useEffect(() => {
    onCountChange?.(results.length);
  }, [results.length, onCountChange]);

  async function scan() {
    if (focus.paused) return;
    setScanning(true);
    setError('');
    setNote('');
    setNewIds(new Set());
    try {
      const result = await scanFocus(focus, settings);
      setResults(result.merged);
      setStats(result.sourceStats);
      setNewIds(new Set(result.added.map((item) => item.id)));
      onUpdate({ lastScanAt: Date.now() });
      if (result.error) setError(result.error);
      if (result.pending > 0) {
        setNote(`还有 ${result.pending} 条候选超过本轮精排上限，会在下一轮继续。`);
      }
      if (result.added.length > 0) {
        push({
          title: `【关注点】${focus.name} 发现 ${result.added.length} 条`,
          body: result.added
            .slice(0, 3)
            .map((item) => item.title.slice(0, 30))
            .join(' / '),
          focusId: focus.id,
        });
        notifyBrowser(`热点雷达 · ${focus.name}`, `关注点发现 ${result.added.length} 条新内容`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '关注点扫描失败，请稍后重试');
    } finally {
      setScanning(false);
    }
  }

  async function generateDigest() {
    if (!aiReady || results.length === 0) return;
    setDigestBusy(true);
    setError('');
    try {
      setDigest(
        await analyzeDigest(
          { apiKey: settings.openrouterKey, model: settings.model },
          `${focus.name}（${focus.description}）`,
          results,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '简报生成失败，请稍后重试');
    } finally {
      setDigestBusy(false);
    }
  }

  const filtered = useMemo(() => {
    let list = results;
    if (fSource !== 'all') list = list.filter((item) => item.source === fSource);
    if (fImp !== 'all') list = list.filter((item) => item.ai?.importance === fImp);
    const query = fText.trim().toLowerCase();
    if (query) {
      list = list.filter((item) =>
        `${item.title} ${item.ai?.summary ?? ''}`.toLowerCase().includes(query),
      );
    }
    const sorted = [...list];
    if (fSort === 'score') {
      sorted.sort((a, b) => (b.ai?.relevance ?? -1) - (a.ai?.relevance ?? -1));
    } else if (fSort === 'time') {
      sorted.sort((a, b) => b.foundAt - a.foundAt);
    } else {
      sorted.sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));
    }
    return sorted;
  }, [results, fSource, fImp, fSort, fText]);

  const analyzedCount = results.filter((item) => item.ai).length;
  const tagOnlyCount = results.length - analyzedCount;
  const aiOff = !focus.autoAi;
  const aiUnavailable = !aiReady;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 -rotate-3 place-items-center rounded-blob-2 border-toon bg-yellow-soft shadow-toon-sm">
                <SparkIcon className="size-5" />
              </span>
              <h2 className="truncate text-lg font-black tracking-tight">{focus.name}</h2>
              {focus.paused && <Badge tone="neutral">已暂停</Badge>}
            </div>
            <p className="mt-1.5 max-w-2xl text-[13px] font-semibold leading-relaxed text-ink-soft">
              {focus.description}
            </p>
            <p className="mt-1 font-mono text-xs font-bold text-muted">
              累计 {results.length} 条 · AI 精排 {analyzedCount} 条
              {tagOnlyCount > 0 ? ` · 标签命中 ${tagOnlyCount} 条` : ''}
              {focus.lastScanAt ? ` · 上次扫描 ${relativeTime(focus.lastScanAt)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={scan}
              disabled={scanning || digestBusy || focus.paused}
            >
              {scanning ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
              {scanning ? '扫描中…' : '立即扫描'}
            </Button>
            <Button
              onClick={generateDigest}
              disabled={digestBusy || scanning || !aiReady || results.length === 0}
              title={aiReady ? '基于当前关注点结果生成简报' : '请先在设置中配置 AI 密钥'}
            >
              {digestBusy ? <Spinner className="size-4" /> : <FileTextIcon className="size-4" />}
              简报
            </Button>
            <Button onClick={onEdit} disabled={scanning}>
              编辑
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">≥ {focus.minScore} 分</Badge>
          {focus.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
          {focus.exclude && <Badge tone="warn">排除：{focus.exclude}</Badge>}
          <span
            className={`text-xs font-bold ${
              aiUnavailable || aiOff ? 'text-warn' : 'text-ok'
            }`}
          >
            {aiUnavailable
              ? '● 未配置 AI，当前仅标签匹配'
              : aiOff
                ? '● AI 精排已关闭'
                : `● AI 精排已开启（每轮最多 20 条新候选）`}
          </span>
        </div>

        {stats && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.map((stat) => (
              <Badge key={stat.source} tone={stat.matched > 0 ? 'accent' : 'neutral'}>
                {stat.ok
                  ? stat.matched > 0
                    ? `· ${BOARDS.find((board) => board.id === stat.source)?.name ?? stat.source} ${stat.matched} 命中`
                    : `${BOARDS.find((board) => board.id === stat.source)?.name ?? stat.source} 0`
                  : `${BOARDS.find((board) => board.id === stat.source)?.name ?? stat.source} 失败`}
              </Badge>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs font-bold text-danger" role="status">
            {error}
          </p>
        )}
        {note && (
          <p className="mt-2 text-xs font-bold text-warn" role="status">
            {note}
          </p>
        )}
      </Card>

      {digest && (
        <DigestCard
          digest={digest}
          busy={digestBusy}
          aiReady={aiReady}
          hasResults={results.length > 0}
          title="AI 关注点简报"
          onGenerate={generateDigest}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={fText}
          onChange={(e) => setFText(e.target.value)}
          placeholder="过滤标题…"
          aria-label="过滤关注点结果"
          className="h-8 w-32 rounded-btn border-[3px] border-ink bg-surface px-2.5 text-[13px] font-bold text-ink outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
        />
        <select
          value={fSource}
          onChange={(e) => setFSource(e.target.value as typeof fSource)}
          className={SELECT_CLS}
          aria-label="按来源过滤关注点结果"
        >
          <option value="all">全部来源</option>
          {BOARDS.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
        <select
          value={fImp}
          onChange={(e) => setFImp(e.target.value as typeof fImp)}
          className={SELECT_CLS}
          aria-label="按重要度过滤关注点结果"
        >
          <option value="all">全部重要度</option>
          {IMPORTANCE_ORDER.map((level) => (
            <option key={level} value={level}>
              {{ urgent: '紧急', high: '重要', medium: '一般', low: '边缘' }[level]}
            </option>
          ))}
        </select>
        <select
          value={fSort}
          onChange={(e) => setFSort(e.target.value as typeof fSort)}
          className={SELECT_CLS}
          aria-label="关注点结果排序"
        >
          <option value="score">按精排分</option>
          <option value="heat">按热度</option>
          <option value="time">按捕获时间</option>
        </select>
        <span className="ml-auto font-mono text-xs font-bold text-muted">
          {filtered.length} 条
        </span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<SparkIcon className="size-7" />}
            title={results.length === 0 ? '还没有关注点记录' : '当前过滤条件下没有内容'}
            desc={
              results.length === 0
                ? '点击「立即扫描」，先用标签粗筛，再对新增候选做 AI 精排'
                : '换个来源、重要度或过滤词试试'
            }
            action={
              results.length === 0 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={scan}
                  disabled={scanning || digestBusy || focus.paused}
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
              isNew={newIds.has(item.id)}
              badge={
                item.matchedBy === 'tag' ? (
                  <Badge tone="neutral">标签命中</Badge>
                ) : (
                  <Badge tone="accent">
                    精排 {item.ai?.relevance ?? '-'}
                  </Badge>
                )
              }
            />
          ))
        )}
      </Card>
    </div>
  );
}
