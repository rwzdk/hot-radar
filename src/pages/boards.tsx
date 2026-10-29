import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardId } from '../types';
import {
  BOARDS,
  boardMeta,
  fetchBoard,
  loadSnapshot,
  type BoardFetchResult,
  type SnapshotFile,
} from '../lib/boards';
import { relativeTime } from '../lib/format';
import { Button, Card, EmptyState, HeatBar, Spinner } from '../components/ui';
import { ExternalIcon, FlameIcon, RefreshIcon } from '../components/icons';

/** 会话级榜单缓存,切换标签不重复请求 */
const cache = new Map<BoardId, BoardFetchResult>();
const STALE_MS = 5 * 60_000;
const TREND_MAX_AGE = 7 * 86_400_000;

function useBoard(id: BoardId) {
  const [slot, setSlot] = useState<{ id: BoardId; result: BoardFetchResult | null }>(() => ({
    id,
    result: cache.get(id) ?? null,
  }));
  const [loading, setLoading] = useState(false);
  const activeId = useRef(id);
  activeId.current = id;

  // 切换平台时立即丢掉上一个榜的数据,避免标题已切换、列表还是旧榜
  const state = slot.id === id ? slot.result : (cache.get(id) ?? null);

  const load = useCallback(
    async (force = false) => {
      const cached = cache.get(id);
      const cachedAt = cached ? (cached.loadedAt ?? cached.fetchedAt) : 0;
      if (!force && cached && Date.now() - cachedAt < STALE_MS) {
        if (activeId.current === id) {
          setSlot({ id, result: cached });
          setLoading(false);
        }
        return;
      }
      if (activeId.current === id) setLoading(true);
      try {
        const result = await fetchBoard(id);
        cache.set(id, result);
        if (activeId.current === id) setSlot({ id, result });
      } finally {
        if (activeId.current === id) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const refreshIfStale = () => {
      const cached = cache.get(id);
      const cachedAt = cached ? (cached.loadedAt ?? cached.fetchedAt) : 0;
      if (!cached || Date.now() - cachedAt >= STALE_MS) void load(false);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, load]);

  return { state, loading, reload: () => load(true) };
}

/** 前三名气泡块:accent / teal / blue + 不规则圆角 + 旋转 */
const RANK_TOP_CLS = [
  'rounded-blob-1 bg-accent text-white -rotate-5',
  'rounded-blob-2 bg-teal text-white rotate-4',
  'rounded-blob-3 bg-blue text-white -rotate-4',
];

function BoardRow({
  item,
  rank,
  maxHeat,
  prevRank,
  trendReady,
}: {
  item: BoardFetchResult['items'][number];
  rank: number;
  maxHeat: number;
  prevRank?: number;
  trendReady: boolean;
}) {
  const top = rank <= 3;
  const isNew = trendReady && prevRank == null;
  const delta = prevRank != null ? prevRank - rank : 0;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3.5 border-b-[2.5px] border-dashed border-ink/10 px-4 py-3 transition-colors last:border-0 hover:bg-paper sm:gap-4 sm:px-5"
    >
      <span
        className={`grid size-[31px] shrink-0 place-items-center font-mono text-[15px] font-black tabular-nums ${
          top ? `border-toon shadow-toon-sm ${RANK_TOP_CLS[rank - 1]}` : 'text-muted'
        }`}
      >
        {rank}
      </span>
      {item.cover && (
        <img
          src={item.cover}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-10 shrink-0 rounded-btn border-toon-sm object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-extrabold leading-6 text-ink group-hover:text-accent-deep">
            {item.title}
          </p>
          {isNew && (
            <span className="shrink-0 rounded-full border-[2.5px] border-ink bg-teal-soft px-1.5 py-px font-mono text-[10px] font-black leading-4 text-teal">
              新
            </span>
          )}
          {!isNew && delta !== 0 && (
            <span
              className={`shrink-0 font-mono text-[10px] font-black ${
                delta > 0 ? 'text-teal' : 'text-danger'
              }`}
              title={delta > 0 ? `较上次快照上升 ${delta} 位` : `较上次快照下降 ${Math.abs(delta)} 位`}
            >
              {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
            </span>
          )}
        </div>
        {item.extra && <p className="truncate text-xs font-semibold text-muted">{item.extra}</p>}
      </div>
      <div className="hidden shrink-0 sm:block">
        <HeatBar ratio={item.heat && maxHeat > 0 ? item.heat / maxHeat : 0} label={item.heatLabel} />
      </div>
      <ExternalIcon className="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-0 px-4 py-2 sm:px-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b-[2.5px] border-dashed border-ink/10 py-3.5 last:border-0"
        >
          <span className="skeleton size-7 rounded-full" />
          <span className="skeleton h-4 flex-1" style={{ maxWidth: `${70 - (i % 4) * 10}%` }} />
          <span className="skeleton hidden h-3 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function BoardsPage() {
  const [active, setActive] = useState<BoardId>('weibo');
  const [snap, setSnap] = useState<SnapshotFile | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);
  const { state, loading, reload } = useBoard(active);

  const meta = boardMeta(active);
  const maxHeat = Math.max(0, ...(state?.items.map((i) => i.heat ?? 0) ?? [0]));

  useEffect(() => {
    let alive = true;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
    void Promise.race([loadSnapshot(), timeout]).then((snapshot) => {
      if (alive) setSnap(snapshot);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setOnlyNew(false);
  }, [active]);

  const trendAt = snap ? (snap.boardAt?.[active] ?? snap.generatedAt) : null;

  const prevRanks = useMemo(() => {
    if (!snap || trendAt == null || state?.from !== 'live') return null;
    if (Date.now() - trendAt > TREND_MAX_AGE) return null;
    const previous = snap.boards[active];
    if (!previous?.length) return null;
    return new Map(previous.map((item, index) => [item.url, index + 1]));
  }, [snap, active, trendAt, state?.from]);

  const newCount = useMemo(() => {
    if (!prevRanks || !state) return 0;
    return state.items.filter((item) => !prevRanks.has(item.url)).length;
  }, [prevRanks, state]);

  const rows = useMemo(() => {
    const list = (state?.items ?? []).map((item, index) => {
      const rank = index + 1;
      const prevRank = prevRanks?.get(item.url);
      return { item, rank, prevRank };
    });
    return onlyNew && prevRanks ? list.filter((row) => row.prevRank == null) : list;
  }, [state, prevRanks, onlyNew]);

  const snapshotAgeDays =
    trendAt != null ? Math.floor((Date.now() - trendAt) / 86_400_000) : null;

  return (
    <div className="animate-rise space-y-4">
      {/* 平台贴纸切换 */}
      <div className="flex flex-wrap items-center gap-2.5">
        {BOARDS.map((b) => {
          const on = b.id === active;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setActive(b.id)}
              className={`cursor-pointer rounded-full border-toon px-4 py-1.5 text-[13px] font-black transition-all duration-100 ${
                on
                  ? '-rotate-1 bg-accent text-white shadow-toon-sm'
                  : 'bg-surface text-ink-soft shadow-toon-sm hover:-translate-x-px hover:-translate-y-px hover:-rotate-1 hover:bg-yellow hover:text-ink hover:shadow-toon active:translate-x-0.5 active:translate-y-0.5 active:shadow-toon-none'
              }`}
              aria-pressed={on}
            >
              {b.name}
            </button>
          );
        })}
        {prevRanks && newCount > 0 && (
          <button
            type="button"
            onClick={() => setOnlyNew((value) => !value)}
            className={`cursor-pointer rounded-full border-toon px-3.5 py-1.5 text-[12px] font-black transition-all duration-100 ${
              onlyNew
                ? '-rotate-1 bg-teal text-white shadow-toon-sm'
                : 'bg-teal-soft text-teal shadow-toon-sm hover:-translate-x-px hover:-translate-y-px hover:bg-teal hover:text-white'
            }`}
            aria-pressed={onlyNew}
          >
            新上榜 {newCount}
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {state && !loading && (
            <span className="text-xs font-bold text-muted" aria-live="polite">
              {state.from === 'snapshot' ? '快照' : '实时'} · {relativeTime(state.fetchedAt)}更新
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            {loading ? <Spinner className="size-3.5" /> : <RefreshIcon className="size-3.5" />}
            刷新
          </Button>
        </div>
      </div>

      {/* 快照兜底提示 */}
      {state?.from === 'snapshot' && (
        <div className="flex items-center gap-2.5 rounded-2xl border-toon bg-yellow-soft px-4 py-2.5 text-[13px] font-bold text-ink-soft shadow-toon-sm">
          <span className="-rotate-2 shrink-0 rounded-lg border-[2.5px] border-ink bg-yellow px-2 py-0.5 text-[11px] font-black text-ink">
            提示
          </span>
          实时接口暂时不可用,当前展示最近一次快照(每日自动更新)。
        </div>
      )}

      {/* 榜单 */}
      <Card>
        <div className="flex items-center gap-2.5 border-b-[3px] border-dashed border-ink/20 px-5 pb-3 pt-4">
          <span className="grid size-9 -rotate-6 place-items-center rounded-blob-1 border-toon bg-accent-soft shadow-toon-sm">
            <FlameIcon className="size-[21px]" />
          </span>
          <span className="text-[17px] font-black">{meta.name} 热榜</span>
          <span className="font-mono text-[10px] font-black tracking-[2px] text-muted">
            {meta.en.toUpperCase()}
          </span>
          {state && (
            <span className="ml-auto font-mono text-xs font-extrabold text-muted">
              {onlyNew && prevRanks ? `${rows.length}/${state.items.length}` : state.items.length} 条
            </span>
          )}
        </div>

        {loading && !state && <SkeletonRows />}

        {state && state.items.length === 0 && state.error && (
          <div className="px-5 pb-6 pt-2 text-center">
            <p className="text-sm font-bold text-ink-soft">拉取失败:{state.error}</p>
            <Button size="sm" className="mt-3" onClick={reload}>
              重试
            </Button>
          </div>
        )}

        {state && state.items.length > 0 && rows.length === 0 && onlyNew && (
          <EmptyState
            icon={<FlameIcon className="size-7" />}
            title="这次没有新上榜"
            desc="关闭筛选,查看完整榜单"
            action={
              <Button size="sm" onClick={() => setOnlyNew(false)}>
                查看全部
              </Button>
            }
          />
        )}

        {rows.length > 0 && (
          <div>
            {rows.map(({ item, rank, prevRank }) => (
              <BoardRow
                key={item.url + rank}
                item={item}
                rank={rank}
                maxHeat={maxHeat}
                prevRank={prevRank}
                trendReady={Boolean(prevRanks)}
              />
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-xs font-bold text-muted">
        热度条按榜单内相对热度绘制{maxHeat > 0 ? '' : '(该榜未提供数值热度)'}
        {prevRanks && state?.from === 'live' && trendAt != null
          ? ` · 对比 ${relativeTime(trendAt)} 的快照,${newCount} 条新上榜`
          : ''}
        {state?.from === 'live' && snap && !prevRanks && snapshotAgeDays != null && snapshotAgeDays > 7
          ? ` · 快照已 ${snapshotAgeDays} 天未更新,趋势已隐藏`
          : ''}
      </p>
    </div>
  );
}
