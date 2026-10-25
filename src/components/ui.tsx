import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { BoardId, Importance } from '../types';
import { boardMeta } from '../lib/boards';

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-deep active:translate-y-px shadow-[0_1px_2px_rgba(216,69,42,0.25)]',
  outline: 'border border-line bg-surface text-ink hover:border-ink/30 hover:bg-paper',
  ghost: 'text-ink-soft hover:bg-paper hover:text-ink',
  danger: 'border border-danger/30 bg-surface text-danger hover:bg-danger/5',
};

export function Button({ variant = 'outline', size = 'md', className = '', ...rest }: ButtonProps) {
  const sizeCls = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9.5 px-4 text-sm';
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT_CLS[variant]} ${sizeCls} ${className}`}
      {...rest}
    />
  );
}

/* ---------- Input ---------- */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
}

export function Input({ label, hint, className = '', ...rest }: InputProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>}
      <input
        className={`h-9.5 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/10 ${className}`}
        {...rest}
      />
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

/* ---------- Card ---------- */

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border border-line bg-surface shadow-[0_1px_2px_rgba(23,21,15,0.04)] ${
        hover ? 'transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(23,21,15,0.08)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {desc && <p className="mt-0.5 text-[13px] text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Badge ---------- */

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'ink';

const TONE_CLS: Record<Tone, string> = {
  neutral: 'bg-paper text-ink-soft border-line',
  accent: 'bg-accent-soft text-accent-deep border-accent/20',
  ok: 'bg-ok/10 text-ok border-ok/25',
  warn: 'bg-warn/10 text-warn border-warn/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  ink: 'bg-panel text-panel-ink border-transparent',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${TONE_CLS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- 数据源徽标 ---------- */

const SOURCE_TONE: Record<BoardId, Tone> = {
  weibo: 'danger',
  zhihu: 'accent',
  douyin: 'ink',
  toutiao: 'warn',
  bili: 'ok',
  hackernews: 'neutral',
};

export function SourceBadge({ source }: { source: BoardId }) {
  return <Badge tone={SOURCE_TONE[source]}>{boardMeta(source).name}</Badge>;
}

/* ---------- 重要度标签 ---------- */

const IMPORTANCE_META: Record<Importance, { label: string; tone: Tone }> = {
  urgent: { label: '紧急', tone: 'danger' },
  high: { label: '重要', tone: 'warn' },
  medium: { label: '一般', tone: 'neutral' },
  low: { label: '边缘', tone: 'neutral' },
};

export function ImportanceTag({ level }: { level: Importance }) {
  const meta = IMPORTANCE_META[level];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* ---------- 相关度量表 ---------- */

export function RelevanceMeter({ value }: { value: number }) {
  const tone = value >= 70 ? 'bg-accent' : value >= 40 ? 'bg-warn' : 'bg-muted';
  return (
    <span className="inline-flex items-center gap-2" title={`相关度 ${value}/100`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-paper">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-xs tabular-nums text-ink-soft">{value}</span>
    </span>
  );
}

/* ---------- 热度条 ---------- */

export function HeatBar({ ratio, label }: { ratio: number; label?: string }) {
  const pct = Math.max(3, Math.min(100, ratio * 100));
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-paper sm:w-20">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-accent/70 to-accent"
          style={{ width: `${pct}%` }}
        />
      </span>
      {label && (
        <span className="truncate font-mono text-xs tabular-nums text-muted">{label}</span>
      )}
    </span>
  );
}

/* ---------- 其他 ---------- */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70 ${className}`}
    />
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-muted">{icon}</div>}
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {desc && <p className="max-w-sm text-[13px] leading-relaxed text-muted">{desc}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft"
    >
      <span
        className={`relative h-5.5 w-10 rounded-full transition-colors duration-200 ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all duration-200 ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  );
}
