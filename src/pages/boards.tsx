import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardId } from '../types';
import {
  BOARDS,
  boardMeta,
  fetchBoard,
  fetchBoards,
  loadBoardCache,
  loadSnapshot,
  snapshotBoardResult,
  type BoardFetchResult,
  type SnapshotFile,
} from '../lib/boards';
import { matchesExclude } from '../lib/aggregate';
import { relativeTime } from '../lib/format';
import { useSettings } from '../lib/storage';
import { Badge, Button, Card, EmptyState, HeatBar, Spinner } from '../components/ui';
import { ExternalIcon, FlameIcon, RefreshIcon } from '../components/icons';

/** 会话级榜单缓存,切换标签不重复请求 */
const cache = new Map<BoardId, BoardFetchResult>();
const STALE_MS = 5 * 60_000;
const SNAPSHOT_RETRY_MS = 2 * 60_000;
const TREND_MAX_AGE = 7 * 86_400_000;

/** 缓存新鲜度时间戳(loadedAt 优先,兼容旧结构) */
function cacheAt(c?: BoardFetchResult | null): number {
  return c ? (c.loadedAt ?? c.fetchedAt) : 0;
}

/** 实时结果缓存 5 分钟;快照兜底结果 2 分钟后再尝试实时 */
function cacheTtl(c?: BoardFetchResult | null): number {
  return c?.from === 'live' ? STALE_MS : SNAPSHOT_RETRY_MS;
}

function useBoard(id: BoardId, snap: SnapshotFile | null) {
  // 模块缓存未命中时从 localStorage 补水,二次访问无需等网络
  if (!cache.has(id)) {
    const local = loadBoardCache(id);
    if (local) cache.set(id, local);
  }
  const [slot, setSlot] = useState<{ id: BoardId; result: BoardFetchResult | null }>(() => ({
    id,
    result: cache.get(id) ?? null,
  }));
  const [loading, setLoading] = useState(false);
  const activeId = useRef(id);
  activeId.current = id;

  // 切换平台时立即丢掉上一个榜的数据;没有 live 缓存时先用仓库快照占位
  const snapshotState = snapshotBoardResult(snap, id);
  const live = slot.id === id ? slot.result : null;
  const cached = cache.get(id);
  const state =
    (live && live.items.length > 0 ? live : null) ??
    (cached && cached.items.length > 0 ? cached : null) ??
    snapshotState ??
    live ??
    cached ??
    null;

  const load = useCallback(
    async (force = false) => {
      const cachedValue = cache.get(id);
      if (
        !force &&
        cachedValue &&
        cachedValue.items.length > 0 &&
        Date.now() - cacheAt(cachedValue) < cacheTtl(cachedValue)
      ) {
        if (activeId.current === id) {
          setSlot({ id, result: cachedValue });
          setLoading(false);
        }
        return;
      }
      if (activeId.current === id) setLoading(true);
      try {
        const result = await fetchBoard(id, { timeoutMs: 20_000 });
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
      const cachedValue = cache.get(id);
      if (
        !cachedValue ||
        cachedValue.items.length === 0 ||
        Date.now() - cacheAt(cachedValue) >= cacheTtl(cachedValue)
      ) {
        void load(false);
      }
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

/* ============ 聚合总览:各源 Top 10 一屏看完 ============ */

function AggregateView({ snap }: { snap: SnapshotFile | null }) {
  const [results, setResults] = useState<Partial<Record<BoardId, BoardFetchResult>>>(() => {
    const seed: Partial<Record<BoardId, BoardFetchResult>> = {};
    for (const b of BOARDS) {
      if (!cache.has(b.id)) {
        const local = loadBoardCache(b.id);
        if (local) cache.set(b.id, local);
      }
      const c = cache.get(b.id);
      const s = snapshotBoardResult(snap, b.id);
      if (c && c.items.length > 0) seed[b.id] = c;
      else if (s) seed[b.id] = s;
    }
    return seed;
  });
  const [loading, setLoading] = useState(false);
  const [settings] = useSettings();
  const exclude = settings.globalExclude;

  // 仓库快照到达后,先补进还没有数据的源,避免默认聚合页出现空白/失败
  useEffect(() => {
    if (!snap) return;
    setResults((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const b of BOARDS) {
        const s = snapshotBoardResult(snap, b.id);
        const existing = next[b.id];
        if (s && (!existing || existing.items.length === 0)) {
          next[b.id] = s;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [snap]);

  const load = useCallback(async (force = false) => {
    // 只拉过期/缺数据的源;单并发 + 700ms 间隔,避免 60s 突发限流
    const stale = BOARDS.map((b) => b.id).filter((id) => {
      if (force) return true;
      const c = cache.get(id);
      return (
        !c ||
        c.items.length === 0 ||
        Date.now() - cacheAt(c) >= cacheTtl(c)
      );
    });
    if (stale.length === 0) return;
    setLoading(true);
    try {
      const fetched = await fetchBoards(stale, {
        concurrency: 1,
        gapMs: 700,
        timeoutMs: 20_000,
      });
      const next: Partial<Record<BoardId, BoardFetchResult>> = {};
      for (const id of stale) {
        const c = fetched[id];
        if (c) {
          cache.set(id, c);
          next[id] = c;
        }
      }
      setResults((prev) => ({ ...prev, ...next }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const refreshIfStale = () => {
      const anyStale = BOARDS.some((b) => {
        const c = cache.get(b.id);
        return (
          !c ||
          c.items.length === 0 ||
          Date.now() - cacheAt(c) >= cacheTtl(c)
        );
      });
      if (anyStale) void load(false);
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
  }, [load]);

  const liveCount = Object.values(results).filter(
    (r) => r?.from === 'live' && r.items.length > 0,
  ).length;
  const snapshotCount = Object.values(results).filter(
    (r) => r?.from === 'snapshot' && r.items.length > 0,
  ).length;

  return (
    <Card>
      <div className="flex items-center gap-2.5 border-b-[3px] border-dashed border-ink/20 px-5 pb-3 pt-4">
        <span className="grid size-9 -rotate-6 place-items-center rounded-blob-1 border-toon bg-accent-soft shadow-toon-sm">
          <FlameIcon className="size-[21px]" />
        </span>
        <span className="text-[17px] font-black">聚合总览</span>
        <span className="font-mono text-[10px] font-black tracking-[2px] text-muted">ALL-IN-ONE</span>
        <span className="font-mono text-xs font-extrabold text-muted" aria-live="polite">
          实时 {liveCount}/{BOARDS.length}
          {snapshotCount > 0 ? ` · 快照 ${snapshotCount}` : ''}
        </span>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => void load(true)} disabled={loading}>
          {loading ? <Spinner className="size-3.5" /> : <RefreshIcon className="size-3.5" />}
          全部刷新
        </Button>
      </div>

      {BOARDS.map((b) => {
        const r = results[b.id];
        const all = r?.items ?? [];
        const items = exclude.trim()
          ? all.filter((it) => !matchesExclude(`${it.title} ${it.extra ?? ''}`, exclude))
          : all;
        const top = items.slice(0, 10);
        const maxHeat = Math.max(0, ...top.map((i) => i.heat ?? 0));
        return (
          <section key={b.id} className="border-b-[3px] border-dashed border-ink/15 last:border-0">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3.5 sm:px-5">
              <Badge tone="neutral">{boardMeta(b.id).name}</Badge>
              <span className="text-[13px] font-black text-ink-soft">{b.name}热榜</span>
              {r && r.from === 'snapshot' && r.items.length > 0 && <Badge tone="warn">快照</Badge>}
              {r && r.items.length === 0 && r.error && (
                <Badge tone="danger" className="max-w-[45%] truncate" title={r.error}>
                  {r.error}
                </Badge>
              )}
              {loading && !r && <Spinner className="size-3" />}
              {r && r.items.length > 0 && (
                <span className="ml-auto font-mono text-[10px] font-bold text-muted">
                  {relativeTime(r.fetchedAt)}
                </span>
              )}
            </div>
            {top.map((item, index) => (
              <BoardRow
                key={item.url + index}
                item={item}
                rank={index + 1}
                maxHeat={maxHeat}
                trendReady={false}
              />
            ))}
            {r && top.length === 0 && (
              <p className="px-5 pb-3 text-xs font-bold text-muted">
                {r.error ? `拉取失败:${r.error}` : '暂无可展示内容'}
              </p>
            )}
          </section>
        );
      })}
    </Card>
  );
}

type BoardTab = BoardId | 'all';

export default function BoardsPage() {
  const [active, setActive] = useState<BoardTab>('all');
  const [snap, setSnap] = useState<SnapshotFile | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);
  const [settings] = useSettings();
  // 聚合页在后台用第一个榜预热 useBoard,切到单榜即秒开
  const activeBoard: BoardId = active === 'all' ? 'weibo' : active;
  const { state, loading, reload } = useBoard(activeBoard, snap);

  const excludeActive = settings.globalExclude.trim() !== '';
  const meta = boardMeta(activeBoard);
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

  const trendAt = snap ? (snap.boardAt?.[activeBoard] ?? snap.generatedAt) : null;

  const prevRanks = useMemo(() => {
    if (!snap || trendAt == null || state?.from !== 'live') return null;
    if (Date.now() - trendAt > TREND_MAX_AGE) return null;
    const previous = snap.boards[activeBoard];
    if (!previous?.length) return null;
    return new Map(previous.map((item, index) => [item.url, index + 1]));
  }, [snap, activeBoard, trendAt, state?.from]);

  // 全局排除词在展示层过滤,排名顺延(屏蔽词功能)
  const visibleItems = useMemo(() => {
    const items = state?.items ?? [];
    if (!excludeActive) return items;
    return items.filter(
      (it) => !matchesExclude(`${it.title} ${it.extra ?? ''}`, settings.globalExclude),
    );
  }, [state, excludeActive, settings.globalExclude]);

  const newCount = useMemo(() => {
    if (!prevRanks || !state) return 0;
    return visibleItems.filter((item) => !prevRanks.has(item.url)).length;
  }, [prevRanks, state, visibleItems]);

  const rows = useMemo(() => {
    const list = visibleItems.map((item, index) => {
      const rank = index + 1;
      const prevRank = prevRanks?.get(item.url);
      return { item, rank, prevRank };
    });
    return onlyNew && prevRanks ? list.filter((row) => row.prevRank == null) : list;
  }, [visibleItems, prevRanks, onlyNew]);

  const snapshotAgeDays =
    trendAt != null ? Math.floor((Date.now() - trendAt) / 86_400_000) : null;

  return (
    <div className="animate-rise space-y-4">
      {/* 平台贴纸切换 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setActive('all')}
          className={`cursor-pointer rounded-full border-toon px-4 py-1.5 text-[13px] font-black transition-all duration-100 ${
            active === 'all'
              ? '-rotate-1 bg-accent text-white shadow-toon-sm'
              : 'bg-surface text-ink-soft shadow-toon-sm hover:-translate-x-px hover:-translate-y-px hover:-rotate-1 hover:bg-yellow hover:text-ink hover:shadow-toon active:translate-x-0.5 active:translate-y-0.5 active:shadow-toon-none'
          }`}
          aria-pressed={active === 'all'}
        >
          <FlameIcon className="mr-0.5 inline size-3.5" /> 聚合
        </button>
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
        {active !== 'all' && prevRanks && newCount > 0 && (
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
        {active !== 'all' && (
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
        )}
        {active === 'all' && excludeActive && (
          <span className="ml-auto text-xs font-bold text-muted">已按全局排除词过滤</span>
        )}
      </div>

      {/* 快照兜底提示 */}
      {active !== 'all' && state?.from === 'snapshot' && (
        <div className="flex items-center gap-2.5 rounded-2xl border-toon bg-yellow-soft px-4 py-2.5 text-[13px] font-bold text-ink-soft shadow-toon-sm">
          <span className="-rotate-2 shrink-0 rounded-lg border-[2.5px] border-ink bg-yellow px-2 py-0.5 text-[11px] font-black text-ink">
            提示
          </span>
          {loading
            ? '正在刷新实时数据,当前先展示最近一次快照。'
            : '实时接口暂时不可用,当前展示最近一次快照(每日自动更新)。'}
        </div>
      )}

      {/* 聚合总览 */}
      {active === 'all' && <AggregateView snap={snap} />}

      {/* 单个榜单 */}
      {active !== 'all' && (
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
                {onlyNew || excludeActive
                  ? `${rows.length}/${state.items.length}`
                  : state.items.length}{' '}
                条
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

          {state && state.items.length > 0 && rows.length === 0 && (
            <EmptyState
              icon={<FlameIcon className="size-7" />}
              title={onlyNew ? '这次没有新上榜' : '全部条目都被排除词过滤了'}
              desc={onlyNew ? '关闭筛选,查看完整榜单' : '调整设置中的全局排除词,或查看其他榜单'}
              action={
                onlyNew ? (
                  <Button size="sm" onClick={() => setOnlyNew(false)}>
                    查看全部
                  </Button>
                ) : undefined
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
      )}

      {active !== 'all' && (
        <p className="text-center text-xs font-bold text-muted">
          热度条按榜单内相对热度绘制{maxHeat > 0 ? '' : '(该榜未提供数值热度)'}
          {prevRanks && state?.from === 'live' && trendAt != null
            ? ` · 对比 ${relativeTime(trendAt)} 的快照,${newCount} 条新上榜`
            : ''}
          {state?.from === 'live' && snap && !prevRanks && snapshotAgeDays != null && snapshotAgeDays > 7
            ? ` · 快照已 ${snapshotAgeDays} 天未更新,趋势已隐藏`
            : ''}
        </p>
      )}
    </div>
  );
}
