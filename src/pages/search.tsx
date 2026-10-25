import { useState } from 'react';
import type { BoardId, Settings, WatchResult } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { BOARDS } from '../lib/boards';
import { scanKeyword, type ScanOutcome } from '../lib/aggregate';
import { analyzeBatch, analyzeItem } from '../lib/ai';
import { useLocalState } from '../lib/storage';
import { Button, Card, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { ResultCard } from '../components/result-card';
import { SearchIcon, SparkIcon } from '../components/icons';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [boards, setBoards] = useState<BoardId[]>(BOARDS.map((b) => b.id));
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [searchedFor, setSearchedFor] = useState('');

  const [settings] = useLocalState<Settings>('settings', DEFAULT_SETTINGS);
  const aiReady = Boolean(settings.openrouterKey);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDone, setAiDone] = useState(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setOutcome(null);
    try {
      const result = await scanKeyword(q, { boards });
      setOutcome(result);
      setSearchedFor(q);
    } finally {
      setLoading(false);
    }
  }

  const [analyzed, setAnalyzed] = useState<Record<string, WatchResult>>({});

  function withAi(items: WatchResult[]): WatchResult[] {
    return items.map((it) => (analyzed[it.id]?.ai ? { ...it, ai: analyzed[it.id].ai } : it));
  }

  async function runAi() {
    if (!outcome || !aiReady) return;
    const targets = outcome.results.filter((r) => !analyzed[r.id]?.ai).slice(0, 12);
    if (targets.length === 0) return;
    setAiBusy(true);
    setAiDone(0);
    await analyzeBatch(
      { apiKey: settings.openrouterKey, model: settings.model },
      searchedFor,
      targets,
      (item, analysis) => {
        if (analysis) {
          setAnalyzed((prev) => ({ ...prev, [item.id]: { ...item, ai: analysis } }));
        }
      },
      (p) => setAiDone(p.done),
    );
    setAiBusy(false);
  }

  async function analyzeOne(item: WatchResult) {
    if (!aiReady) return;
    setAnalyzingId(item.id);
    try {
      const analysis = await analyzeItem(
        { apiKey: settings.openrouterKey, model: settings.model },
        searchedFor,
        item,
      );
      setAnalyzed((prev) => ({ ...prev, [item.id]: { ...item, ai: analysis } }));
    } catch {
      /* 重试即可 */
    } finally {
      setAnalyzingId(null);
    }
  }

  function toggleBoard(id: BoardId) {
    setBoards((list) => (list.includes(id) ? list.filter((b) => b !== id) : [...list, id]));
  }

  return (
    <div className="mx-auto max-w-3xl animate-rise">
      <SectionTitle title="全网搜索" desc="一次性检索各平台热榜匹配与 HackerNews,不写入监控历史" />

      {/* 搜索框 */}
      <Card className="p-4 sm:p-5">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="输入关键词,回车搜索"
            className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3.5 text-sm outline-none placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
            autoFocus
          />
          <Button variant="primary" onClick={search} disabled={loading || !query.trim()}>
            {loading ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
            搜索
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {BOARDS.map((b) => {
            const on = boards.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggleBoard(b.id)}
                className={`h-7 cursor-pointer rounded-full border px-3 text-xs transition-colors ${
                  on
                    ? 'border-panel bg-panel text-panel-ink'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 结果 */}
      {loading && (
        <Card className="mt-4 p-6 text-center">
          <Spinner className="text-accent" />
          <p className="mt-2 text-sm text-muted">正在聚合各数据源…</p>
        </Card>
      )}

      {outcome && !loading && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-soft">
              「{searchedFor}」共 <span className="font-mono font-semibold">{outcome.results.length}</span> 条结果
            </p>
            <Button
              size="sm"
              onClick={runAi}
              disabled={!aiReady || aiBusy || outcome.results.length === 0}
            >
              {aiBusy ? <Spinner className="size-3.5" /> : <SparkIcon className="size-3.5" />}
              {aiBusy ? `AI 研判中 ${aiDone}` : 'AI 批量研判'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {outcome.sourceStats
              .filter((s) => s.matched > 0)
              .map((s) => (
                <span
                  key={s.source}
                  className="rounded-md border border-accent/20 bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-deep"
                >
                  {s.source} {s.matched}
                </span>
              ))}
          </div>

          <Card>
            {outcome.results.length === 0 ? (
              <EmptyState
                icon={<SearchIcon className="size-9" />}
                title="没有找到相关内容"
                desc="热榜更新有延迟,也可以换一个更宽泛的关键词"
              />
            ) : (
              withAi(outcome.results).map((item) => (
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
      )}

      {!outcome && !loading && (
        <Card className="mt-4">
          <EmptyState
            icon={<SearchIcon className="size-10" />}
            title="搜一次,看全网"
            desc="微博 / 知乎 / 抖音 / 头条 / B站热榜关键词匹配 + HackerNews 全文检索"
          />
        </Card>
      )}
    </div>
  );
}
