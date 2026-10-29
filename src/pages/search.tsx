import { useMemo, useState } from 'react';
import type { BoardId, WatchResult } from '../types';
import { BOARDS } from '../lib/boards';
import { scanKeyword, type ScanOutcome } from '../lib/aggregate';
import { analyzeBatch, analyzeItem } from '../lib/ai';
import { useLocalState, useSettings } from '../lib/storage';
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { ResultCard } from '../components/result-card';
import { SearchIcon, SparkIcon } from '../components/icons';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [boards, setBoards] = useState<BoardId[]>(BOARDS.map((b) => b.id));
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [searchedFor, setSearchedFor] = useState('');

  const [settings] = useSettings();
  const [recent, setRecent] = useLocalState<string[]>('search:recent', []);
  const aiReady = Boolean(settings.openrouterKey);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDone, setAiDone] = useState(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');
  const [fText, setFText] = useState('');

  async function runSearch(term = query) {
    if (boards.length === 0) {
      setAiError('至少选择一个平台');
      return;
    }
    const q = term.trim();
    if (!q || loading) return;
    setQuery(q);
    setLoading(true);
    setOutcome(null);
    setAiError('');
    try {
      const result = await scanKeyword(q, {
        boards,
        exclude: settings.globalExclude || undefined,
      });
      setOutcome(result);
      setSearchedFor(q);
      setRecent((list) => [q, ...list.filter((item) => item !== q)].slice(0, 6));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '搜索失败,请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  const [analyzed, setAnalyzed] = useState<Record<string, WatchResult>>({});

  async function runAi() {
    if (!outcome || !aiReady) return;
    const targets = outcome.results.filter((r) => !analyzed[r.id]?.ai).slice(0, 12);
    if (targets.length === 0) return;
    setAiBusy(true);
    setAiDone(0);
    setAiError('');
    try {
      const { failed } = await analyzeBatch(
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
      if (failed > 0) setAiError(`${failed} 条研判失败,可稍后重试。`);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 研判失败,请稍后重试');
    } finally {
      setAiBusy(false);
    }
  }

  async function analyzeOne(item: WatchResult) {
    if (!aiReady) return;
    setAnalyzingId(item.id);
    setAiError('');
    try {
      const analysis = await analyzeItem(
        { apiKey: settings.openrouterKey, model: settings.model },
        searchedFor,
        item,
      );
      setAnalyzed((prev) => ({ ...prev, [item.id]: { ...item, ai: analysis } }));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '研判失败,请稍后重试');
    } finally {
      setAnalyzingId(null);
    }
  }

  const filteredResults = useMemo(() => {
    const list = (outcome?.results ?? []).map((item) => {
      const analysis = analyzed[item.id]?.ai;
      return analysis ? { ...item, ai: analysis } : item;
    });
    const q = fText.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) =>
      `${item.title} ${item.ai?.summary ?? ''}`.toLowerCase().includes(q),
    );
  }, [outcome, fText, analyzed]);

  function sourceName(source: string): string {
    return BOARDS.find((board) => board.id === source)?.name ?? source;
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
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="输入关键词,回车搜索"
            aria-label="搜索关键词"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-btn border-[3px] border-ink bg-surface px-3.5 text-sm font-bold outline-none transition-all duration-100 placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
            autoFocus
          />
          <Button
            variant="primary"
            onClick={() => runSearch()}
            disabled={loading || !query.trim() || boards.length === 0}
          >
            {loading ? <Spinner className="size-4" /> : <SearchIcon className="size-4" />}
            搜索
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {BOARDS.map((b) => {
            const on = boards.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBoard(b.id)}
                aria-pressed={on}
                className={`cursor-pointer rounded-full border-toon px-3 py-1 text-xs font-black transition-all duration-100 ${
                  on
                    ? '-rotate-1 bg-teal text-white shadow-toon-sm'
                    : 'bg-surface text-muted shadow-toon-sm hover:-rotate-1 hover:bg-yellow hover:text-ink active:translate-x-0.5 active:translate-y-0.5 active:shadow-toon-none'
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
        {recent.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-muted">最近</span>
            {recent.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void runSearch(item)}
                aria-label={`再次搜索 ${item}`}
                className="cursor-pointer rounded-full bg-paper px-2.5 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:bg-yellow-soft hover:text-ink"
              >
                {item}
              </button>
            ))}
          </div>
        )}
        {boards.length === 0 && (
          <p className="mt-2 text-xs font-bold text-danger">至少选择一个平台</p>
        )}
      </Card>

      {aiError && !outcome && !loading && (
        <p className="mt-3 text-xs font-bold text-danger" role="status">
          {aiError}
        </p>
      )}

      {/* 结果 */}
      {loading && (
        <Card className="mt-4 p-6 text-center">
          <Spinner className="text-accent" />
          <p className="mt-2 text-sm font-bold text-muted">正在聚合各数据源…</p>
        </Card>
      )}

      {outcome && !loading && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-bold text-ink-soft">
              「{searchedFor}」共 <span className="font-mono font-black">{filteredResults.length}</span>
              {fText.trim() ? ` / ${outcome.results.length}` : ''} 条结果
            </p>
            <input
              value={fText}
              onChange={(e) => setFText(e.target.value)}
              placeholder="过滤结果…"
              aria-label="过滤搜索结果"
              className="ml-auto h-8 w-28 rounded-btn border-[3px] border-ink bg-surface px-2.5 text-[12px] font-bold text-ink outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
            />
            <Button
              size="sm"
              onClick={runAi}
              disabled={!aiReady || aiBusy || outcome.results.length === 0}
              title={aiReady ? '批量研判尚未分析的结果' : '请先在设置中配置 AI 密钥'}
            >
              {aiBusy ? <Spinner className="size-3.5" /> : <SparkIcon className="size-3.5" />}
              {aiBusy ? `AI 研判中 ${aiDone}` : 'AI 批量研判'}
            </Button>
          </div>

          {aiError && (
            <p className="text-xs font-bold text-danger" role="status">
              {aiError}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {outcome.sourceStats
              .filter((s) => s.matched > 0)
              .map((s) => (
                <Badge key={s.source} tone="accent">
                  {sourceName(s.source)} {s.matched}
                </Badge>
              ))}
          </div>

          <Card>
            {outcome.results.length === 0 ? (
              <EmptyState
                icon={<SearchIcon className="size-7" />}
                title="没有找到相关内容"
                desc="热榜更新有延迟,也可以换一个更宽泛的关键词"
              />
            ) : filteredResults.length === 0 ? (
              <EmptyState
                icon={<SearchIcon className="size-7" />}
                title="没有符合过滤词的结果"
                desc="清空过滤词,或换一个更宽泛的关键词"
                action={
                  <Button size="sm" onClick={() => setFText('')}>
                    清空过滤
                  </Button>
                }
              />
            ) : (
              filteredResults.map((item) => (
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
            icon={<SearchIcon className="size-7" />}
            title="搜一次,看全网"
            desc="各平台热榜关键词匹配 + HackerNews 全文检索,可按平台筛选"
          />
        </Card>
      )}
    </div>
  );
}
