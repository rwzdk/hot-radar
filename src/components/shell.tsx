import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PageId } from '../lib/router';
import { useNotices } from '../lib/notices';
import { relativeTime } from '../lib/format';
import {
  BellIcon,
  FlameIcon,
  GearIcon,
  GithubIcon,
  RadarIcon,
  SearchIcon,
  SparkIcon,
  TargetIcon,
} from './icons';

const NAV: { id: PageId; label: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { id: 'boards', label: '热榜总览', icon: FlameIcon },
  { id: 'monitor', label: '关键词监控', icon: TargetIcon },
  { id: 'search', label: '全网搜索', icon: SearchIcon },
  { id: 'settings', label: '设置', icon: GearIcon },
];

const PAGE_TITLES: Record<PageId, { title: string; sub: string }> = {
  boards: { title: '热榜总览', sub: 'BOARDS' },
  monitor: { title: '关键词监控', sub: 'MONITOR' },
  search: { title: '全网搜索', sub: 'SEARCH' },
  settings: { title: '设置', sub: 'SETTINGS' },
};

/* 装饰星星(尊重 prefers-reduced-motion) */
function Sparks() {
  return (
    <>
      <div className="animate-float pointer-events-none fixed left-[250px] top-[70px] z-0 hidden lg:block">
        <SparkIcon className="size-[26px]" />
      </div>
      <div
        className="animate-float pointer-events-none fixed right-[60px] top-[150px] z-0 hidden lg:block"
        style={{ animationDelay: '-2.5s' }}
      >
        <SparkIcon fill="#2A9D8F" className="size-[18px]" />
      </div>
      <div
        className="animate-float pointer-events-none fixed bottom-[120px] left-[300px] z-0 hidden lg:block"
        style={{ animationDelay: '-5s' }}
      >
        <SparkIcon fill="#FF6B35" className="size-4" />
      </div>
    </>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="hidden rounded-btn border-toon bg-surface px-3 py-1.5 font-mono text-[13px] font-extrabold tabular-nums text-ink shadow-toon-sm md:inline-block">
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  );
}

function NoticeBell({ navigate }: { navigate: (to: string) => void }) {
  const { notices, unread, markRead, markAllRead, clear } = useNotices();
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-[42px] cursor-pointer place-items-center rounded-blob-1 border-toon bg-yellow shadow-toon-sm transition-all duration-150 hover:-translate-x-px hover:-translate-y-px hover:rotate-3 hover:shadow-toon active:translate-x-0.5 active:translate-y-0.5 active:shadow-toon-none"
        title="通知中心"
        aria-label={`通知中心${unread > 0 ? `,${unread} 条未读` : ''}`}
        aria-expanded={open}
      >
        <BellIcon bodyFill="#fff" className="size-[21px]" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border-[2.5px] border-ink bg-accent px-1 font-mono text-[11px] font-black leading-5 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-rise absolute right-0 top-[52px] z-50 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-card border-toon bg-surface shadow-toon">
          <div className="flex items-center justify-between border-b-[3px] border-dashed border-ink/20 px-4 py-2.5">
            <span className="text-[13px] font-black text-ink">通知中心</span>
            <div className="flex gap-1">
              <button
                className="cursor-pointer rounded px-2 py-0.5 text-xs font-bold text-muted transition-colors hover:bg-paper hover:text-ink"
                onClick={markAllRead}
              >
                全部已读
              </button>
              <button
                className="cursor-pointer rounded px-2 py-0.5 text-xs font-bold text-muted transition-colors hover:bg-paper hover:text-danger"
                onClick={clear}
              >
                清空
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notices.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] font-semibold text-muted">暂无通知</p>
            ) : (
              notices.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    markRead(n.id);
                    if (n.keywordId) {
                      setOpen(false);
                      navigate(`monitor?kw=${n.keywordId}`);
                    }
                  }}
                  className={`block w-full cursor-pointer border-b-[2.5px] border-dashed border-ink/10 px-4 py-3 text-left transition-colors last:border-0 hover:bg-yellow-soft ${
                    n.read ? '' : 'bg-paper'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-bold leading-5 text-ink">{n.title}</span>
                    {!n.read && <span className="mt-1.5 size-2.5 shrink-0 rounded-blob-3 bg-accent" />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs font-semibold leading-relaxed text-ink-soft">
                    {n.body}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] font-bold text-muted">
                    {relativeTime(n.at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileNav({ page, navigate }: { page: PageId; navigate: (to: string) => void }) {
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t-[3px] border-ink bg-surface px-2 pt-1.5 pb-safe md:hidden"
    >
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = page === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-btn border-[2.5px] px-1 py-1 text-[10px] font-black transition-all duration-100 ${
              active
                ? 'border-ink bg-yellow text-ink shadow-toon-sm'
                : 'border-transparent text-ink-soft hover:bg-paper hover:text-ink'
            }`}
          >
            <Icon className="size-5" />
            {item.label}
          </button>
        );
      })}
    </nav>
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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-btn focus:border-toon focus:bg-yellow focus:px-3 focus:py-2 focus:text-sm focus:font-black focus:shadow-toon-sm"
      >
        跳到主要内容
      </a>

      {/* 装饰星星 */}
      <Sparks />

      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-54 flex-col border-r-[3px] border-ink bg-surface max-md:hidden">
        <div className="flex items-center gap-2.5 px-4 pb-5 pt-6">
          <div className="grid size-11 -rotate-6 place-items-center rounded-blob-1 border-toon bg-accent shadow-toon-sm">
            <RadarIcon className="size-[26px]" />
          </div>
          <div className="leading-tight">
            <p className="text-[17px] font-black tracking-wide text-ink">热点雷达</p>
            <p className="font-mono text-[10px] font-extrabold tracking-[3px] text-muted">
              HOTRADAR
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-nav border-[3px] px-3.5 py-2 text-sm font-extrabold transition-all duration-150 ${
                  active
                    ? '-rotate-1.5 border-ink bg-yellow text-ink shadow-toon-sm'
                    : 'border-transparent text-ink-soft hover:-translate-x-px hover:-translate-y-px hover:-rotate-0.5 hover:border-ink hover:bg-paper hover:text-ink hover:shadow-toon-sm'
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t-[3px] border-dashed border-ink/25 px-5 py-4">
          <a
            href="https://github.com/rwzdk/hot-radar"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs font-extrabold text-ink-soft transition-colors hover:text-accent-deep"
          >
            <GithubIcon className="size-4" />
            ★ GitHub 仓库
          </a>
          <p className="mt-2 font-mono text-[10px] font-bold text-muted">v1.1.0 · 纯静态部署</p>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col max-md:ml-0 md:ml-54">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-paper/95 px-4 pb-3.5 pt-4 sm:gap-4 sm:px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <h1 className="truncate text-2xl font-black tracking-wide sm:text-[27px]">
              {meta.title}
            </h1>
            <span className="hidden shrink-0 rotate-2 rounded-full border-toon bg-teal px-2.5 py-1 text-[11px] font-black tracking-[2px] text-white shadow-toon-sm sm:inline-block">
              {meta.sub}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Clock />
            <NoticeBell navigate={navigate} />
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[980px] flex-1 px-4 pb-24 pt-2 sm:px-5 md:pb-10 lg:px-8"
        >
          {children}
        </main>

        <footer className="px-4 pb-24 text-center text-xs font-bold text-muted sm:px-5 md:pb-6 lg:px-8">
          热点雷达 · 数据来自各平台公开热榜与 Hacker News,仅供个人学习参考
        </footer>
      </div>

      <MobileNav page={page} navigate={navigate} />
    </div>
  );
}
