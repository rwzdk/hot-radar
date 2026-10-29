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
}: {
  item: BoardFetchResult['items'][number];
  rank: number;
  maxHeat: number;
}) {
  const top = rank <= 3;
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
        <p className="truncate text-sm font-extrabold leading-6 text-ink group-hover:text-accent-deep">
          {item.title}
        </p>
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
  const [refreshKey, setRefreshKey] = useState(0);
  const { state, loading, reload } = useBoard(active, refreshKey);

  const meta = boardMeta(active);
  const maxHeat = Math.max(0, ...(state?.items.map((i) => i.heat ?? 0) ?? [0]));

  return (
    <div className="animate-rise space-y-4">
      {/* 平台贴纸切换 */}
      <div className="flex flex-wrap items-center gap-2.5">
        {BOARDS.map((b) => {
          const on = b.id === active;
          return (
            <button
              key={b.id}
              onClick={() => setActive(b.id)}
              className={`cursor-pointer rounded-full border-toon px-4 py-1.5 text-[13px] font-black transition-all duration-100 ${
                on
                  ? '-rotate-1 bg-accent text-white shadow-toon-sm'
                  : 'bg-surface text-ink-soft shadow-toon-sm hover:-translate-x-px hover:-translate-y-px hover:-rotate-1 hover:bg-yellow hover:text-ink hover:shadow-toon active:translate-x-0.5 active:translate-y-0.5 active:shadow-toon-none'
              }`}
            >
              {b.name}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          {state && !loading && (
            <span className="text-xs font-bold text-muted">
              {state.from === 'snapshot' ? '快照' : '实时'} · {relativeTime(state.fetchedAt)}更新
            </span>
          )}
          <Button
            variant="secondary"
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
        <div className="flex items-center gap-2.5 rounded-2xl border-toon bg-yellow-soft px-4 py-2.5 text-[13px] font-bold text-ink-soft shadow-toon-sm">
          <span className="-rotate-2 shrink-0 rounded-lg border-[2.5px] border-ink bg-yellow px-2 py-0.5 text-[11px] font-black text-ink">
            提示
          </span>
          实时接口暂时不可用,当前展示最近一次仓库快照(每日由 GitHub Actions 生成)。
        </div>
      )}

      {/* 榜单 */}
      <Card>
        <div className="flex items-center gap-2.5 border-b-[3px] border-dashed border-ink/20 px-5 pb-3 pt-4">
          <span className="grid size-9 -rotate-6 place-items-center rounded-blob-1 border-toon bg-accent-soft shadow-toon-sm">
            <FlameIcon className="size-[21px]" />
          </span>
          <span className="text-[17px] font-black">{meta.name}热榜</span>
          <span className="font-mono text-[10px] font-black tracking-[2px] text-muted">
            {meta.en.toUpperCase()}
          </span>
          {state && (
            <span className="ml-auto font-mono text-xs font-extrabold text-muted">
              {state.items.length} 条
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

        {state && state.items.length > 0 && (
          <div>
            {state.items.map((item, i) => (
              <BoardRow
                key={item.url + i}
                item={{ ...item, heat: item.heat }}
                rank={i + 1}
                maxHeat={maxHeat}
              />
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-xs font-bold text-muted">
        热度条按榜单内相对热度绘制{maxHeat > 0 ? '' : '(该榜未提供数值热度)'}
      </p>
    </div>
  );
}
