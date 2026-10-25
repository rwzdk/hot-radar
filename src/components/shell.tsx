import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PageId } from '../lib/router';
import { useNotices } from '../lib/notices';
import { relativeTime } from '../lib/format';
import {
  BellIcon,
  BoardsIcon,
  GearIcon,
  GithubIcon,
  RadarIcon,
  SearchIcon,
  TargetIcon,
} from './icons';

const NAV: { id: PageId; label: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { id: 'boards', label: '热榜总览', icon: BoardsIcon },
  { id: 'monitor', label: '关键词监控', icon: TargetIcon },
  { id: 'search', label: '全网搜索', icon: SearchIcon },
  { id: 'settings', label: '设置', icon: GearIcon },
];

const PAGE_TITLES: Record<PageId, { title: string; sub: string }> = {
  boards: { title: '热榜总览', sub: 'Boards' },
  monitor: { title: '关键词监控', sub: 'Monitor' },
  search: { title: '全网搜索', sub: 'Search' },
  settings: { title: '设置', sub: 'Settings' },
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="hidden font-mono text-xs tabular-nums text-muted md:inline">
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  );
}

function NoticeBell() {
  const { notices, unread, markAllRead, clear } = useNotices();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-9 cursor-pointer place-items-center rounded-[10px] text-ink-soft transition-colors hover:bg-paper hover:text-ink"
        title="通知中心"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-accent px-1 font-mono text-[10px] leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-88 animate-rise rounded-[14px] border border-line bg-surface shadow-[0_12px_40px_rgba(23,21,15,0.14)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[13px] font-semibold text-ink">通知中心</span>
            <div className="flex gap-1">
              <button
                className="cursor-pointer rounded px-2 py-0.5 text-xs text-muted hover:bg-paper hover:text-ink"
                onClick={markAllRead}
              >
                全部已读
              </button>
              <button
                className="cursor-pointer rounded px-2 py-0.5 text-xs text-muted hover:bg-paper hover:text-danger"
                onClick={clear}
              >
                清空
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notices.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-muted">暂无通知</p>
            ) : (
              notices.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-line/60 px-4 py-3 last:border-0 ${n.read ? '' : 'bg-accent-soft/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium leading-5 text-ink">{n.title}</p>
                    {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                    {n.body}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted">{relativeTime(n.at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Shell({
  page,
  navigate,
  children,
}: {
  page: PageId;
  navigate: (to: string) => void;
  children: ReactNode;
}) {
  const meta = PAGE_TITLES[page];

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-panel max-md:hidden">
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
          <RadarIcon className="size-7 text-panel-ink" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-wide text-panel-ink">热点雷达</p>
            <p className="font-mono text-[10px] tracking-[0.22em] text-panel-muted">HOTRADAR</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`relative flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-panel-soft font-medium text-panel-ink'
                    : 'text-panel-muted hover:bg-panel-soft/60 hover:text-panel-ink'
                }`}
              >
                {active && (
                  <span className="absolute inset-y-2 left-0 w-0.75 rounded-full bg-accent" />
                )}
                <Icon className="size-4.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-panel-line px-5 py-4">
          <a
            href="https://github.com/rwzdk/hot-radar"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-panel-muted transition-colors hover:text-panel-ink"
          >
            <GithubIcon className="size-4" />
            GitHub 仓库
          </a>
          <p className="mt-2 font-mono text-[10px] text-panel-muted/60">v1.0.0 · 纯静态部署</p>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col max-md:ml-0 md:ml-56">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/85 px-5 backdrop-blur lg:px-8">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-[15px] font-semibold tracking-tight">{meta.title}</h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {meta.sub}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Clock />
            <NoticeBell />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="px-5 pb-6 text-center text-xs text-muted lg:px-8">
          热点雷达 · 数据来自各平台公开热榜与 Hacker News,仅供个人学习参考
        </footer>
      </div>
    </div>
  );
}
