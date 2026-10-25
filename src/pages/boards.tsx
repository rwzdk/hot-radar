import { useCallback, useEffect, useState } from 'react';
import type { BoardId } from '../types';
import { BOARDS, boardMeta, fetchBoard, type BoardFetchResult } from '../lib/boards';
import { relativeTime } from '../lib/format';
import { Button, Card, HeatBar, Spinner } from '../components/ui';
import { ExternalIcon, FlameIcon, RefreshIcon } from '../components/icons';

/** 会话级榜单缓存,切换标签不重复请求 */
const cache = new Map<BoardId, BoardFetchResult>();
const STALE_MS = 5 * 60_000;

function useBoard(id: BoardId, refreshKey: number) {
  const [state, setState] = useState<BoardFetchResult | null>(cache.get(id) ?? null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (force = false) => {
      const cached = cache.get(id);
      if (!force && cached && Date.now() - cached.fetchedAt < STALE_MS) {
        setState(cached);
        return;
      }
      setLoading(true);
      try {
        const result = await fetchBoard(id);
        cache.set(id, result);
        setState(result);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(false);
  }, [load, refreshKey]);

  return { state, loading, reload: () => load(true) };
}

function BoardRow({ item, rank }: { item: BoardFetchResult['items'][number]; rank: number }) {
  const top = rank <= 3;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-4 border-b border-line/60 px-4 py-3 transition-colors last:border-0 hover:bg-paper/70 sm:px-5"
    >
      <span
        className={`w-7 shrink-0 text-center font-mono text-lg tabular-nums ${
          top ? 'font-semibold text-accent' : 'text-muted'
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
          className="size-10 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-6 text-ink group-hover:text-accent-deep">
          {item.title}
        </p>
        {item.extra && <p className="truncate text-xs text-muted">{item.extra}</p>}
      </div>
      <div className="hidden shrink-0 sm:block">
        <HeatBar ratio={item.heat ? Math.min(1, item.heat / 30_000_000) : 0} label={item.heatLabel} />
      </div>
      <ExternalIcon className="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-0 px-4 py-2 sm:px-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line/60 py-3.5 last:border-0">
          <span className="skeleton size-5 rounded" />
          <span className="skeleton h-4 flex-1" style={{ maxWidth: `${70 - (i % 4) * 10}%` }} />
          <span className="skeleton hidden h-3 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function BoardsPage() {
  const [active, setActive] = useState<BoardId>('weibo');
  const [refreshKey, setRefreshKey] = useState(0);
  const { state, loading, reload } = useBoard(active, refreshKey);

  const meta = boardMeta(active);
  const maxHeat = Math.max(0, ...(state?.items.map((i) => i.heat ?? 0) ?? [0]));

  return (
    <div className="animate-rise space-y-4">
      {/* 平台切换 */}
      <div className="flex flex-wrap items-center gap-2">
        {BOARDS.map((b) => {
          const on = b.id === active;
          return (
            <button
              key={b.id}
              onClick={() => setActive(b.id)}
              className={`h-8 cursor-pointer rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                on
                  ? 'border-panel bg-panel text-panel-ink'
                  : 'border-line bg-surface text-ink-soft hover:border-ink/25 hover:text-ink'
              }`}
            >
              {b.name}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          {state && !loading && (
            <span className="text-xs text-muted">
              {state.from === 'snapshot' ? '快照' : '实时'} · {relativeTime(state.fetchedAt)}更新
            </span>
          )}
          <Button
            size="sm"
            onClick={() => {
              reload();
              setRefreshKey((k) => k + 1);
            }}
            disabled={loading}
          >
            {loading ? <Spinner className="size-3.5" /> : <RefreshIcon className="size-3.5" />}
            刷新
          </Button>
        </div>
      </div>

      {/* 快照兜底提示 */}
      {state?.from === 'snapshot' && (
        <div className="rounded-[10px] border border-warn/25 bg-warn/10 px-4 py-2.5 text-[13px] text-warn">
          实时接口暂时不可用,当前展示最近一次仓库快照(每日由 GitHub Actions 生成)。
        </div>
      )}

      {/* 榜单 */}
      <Card>
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <FlameIcon className="size-4 text-accent" />
            <span className="text-sm font-semibold">{meta.name}热榜</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {meta.en}
            </span>
          </div>
          {state && <span className="font-mono text-xs text-muted">{state.items.length} 条</span>}
        </div>

        {loading && !state && <SkeletonRows />}

        {state && state.items.length === 0 && state.error && (
          <div className="px-5 pb-6 pt-2 text-center">
            <p className="text-sm text-ink-soft">拉取失败:{state.error}</p>
            <Button size="sm" className="mt-3" onClick={reload}>
              重试
            </Button>
          </div>
        )}

        {state && state.items.length > 0 && (
          <div>
            {state.items.map((item, i) => (
              <BoardRow key={item.url + i} item={{ ...item, heat: item.heat }} rank={i + 1} />
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-muted">
        热度条按榜单内相对热度绘制{maxHeat > 0 ? '' : '(该榜未提供数值热度)'}
      </p>
    </div>
  );
}
