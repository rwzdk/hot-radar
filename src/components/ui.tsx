import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { BoardId, Importance } from '../types';
import { boardMeta } from '../lib/boards';

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-deep',
  secondary: 'bg-teal text-white hover:bg-teal/90',
  outline: 'bg-surface text-ink hover:bg-paper',
  ghost: 'border-transparent bg-transparent text-ink-soft hover:border-ink hover:bg-surface hover:text-ink hover:shadow-toon-sm',
  danger: 'bg-surface text-danger hover:bg-danger/10',
};

export function Button({ variant = 'outline', size = 'md', className = '', ...rest }: ButtonProps) {
  const sizeCls = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9.5 px-4 text-sm';
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-btn border-[3px] border-ink font-black transition-all duration-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 ${
        variant === 'ghost' ? '' : 'shadow-toon-sm hover:shadow-toon hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-toon-none'
      } ${VARIANT_CLS[variant]} ${sizeCls} ${className}`}
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
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>}
      <input
        className={`h-9.5 w-full rounded-btn border-[3px] border-ink bg-surface px-3 text-sm font-bold text-ink outline-none transition-all duration-100 placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm ${className}`}
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
      className={`rounded-card border-toon bg-surface shadow-toon ${
        hover
          ? 'transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-ink)]'
          : ''
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
        <h2 className="text-base font-black tracking-tight text-ink">{title}</h2>
        {desc && <p className="mt-0.5 text-[13px] font-semibold text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Badge ---------- */

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'ink' | 'blue';

const TONE_CLS: Record<Tone, string> = {
  neutral: 'bg-surface text-ink-soft',
  accent: 'bg-accent-soft text-accent-deep',
  ok: 'bg-teal-soft text-teal',
  warn: 'bg-yellow-soft text-accent-deep',
  danger: 'bg-accent-soft text-danger',
  ink: 'bg-yellow text-ink',
  blue: 'bg-blue-soft text-blue',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border-toon-sm px-2 py-px text-[10px] font-black leading-4 ${TONE_CLS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- 数据源徽标 ---------- */

const SOURCE_TONE: Record<BoardId, Tone> = {
  weibo: 'accent',
  zhihu: 'blue',
  douyin: 'ink',
  toutiao: 'warn',
  baidu: 'warn',
  bili: 'ok',
  tieba: 'blue',
  rednote: 'danger',
  hackernews: 'neutral',
};

export function SourceBadge({ source }: { source: BoardId }) {
  return <Badge tone={SOURCE_TONE[source] ?? 'neutral'}>{boardMeta(source).name}</Badge>;
}

/* ---------- 重要度标签 ---------- */

const IMPORTANCE_META: Record<Importance, { label: string; tone: Tone }> = {
  urgent: { label: '紧急', tone: 'danger' },
  high: { label: '重要', tone: 'warn' },
  medium: { label: '一般', tone: 'neutral' },
  low: { label: '边缘', tone: 'neutral' },
};

export function ImportanceTag({ level }: { level: Importance }) {
  const meta = IMPORTANCE_META[level] ?? IMPORTANCE_META.low;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* ---------- 相关度量表 ---------- */

export function RelevanceMeter({ value }: { value: number }) {
  const tone = value >= 70 ? 'bg-accent' : value >= 40 ? 'bg-yellow' : 'bg-muted';
  return (
    <span className="inline-flex items-center gap-2" title={`相关度 ${value}/100`}>
      <span className="h-[13px] w-16 overflow-hidden rounded-full border-toon-sm bg-surface">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-xs font-bold tabular-nums text-ink-soft">{value}</span>
    </span>
  );
}

/* ---------- 热度条 ---------- */

export function HeatBar({ ratio, label }: { ratio: number; label?: string }) {
  const pct = Math.max(3, Math.min(100, ratio * 100));
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="h-[13px] w-14 shrink-0 overflow-hidden rounded-full border-toon-sm bg-surface sm:w-20">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      {label && (
        <span className="truncate font-mono text-xs font-bold tabular-nums text-muted">{label}</span>
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
      {icon && (
        <div className="mb-1 grid size-14 -rotate-4 place-items-center rounded-blob-1 border-toon bg-yellow-soft shadow-toon-sm">
          {icon}
        </div>
      )}
      <p className="text-sm font-bold text-ink-soft">{title}</p>
      {desc && <p className="max-w-sm text-[13px] font-semibold leading-relaxed text-muted">{desc}</p>}
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
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-soft transition-colors duration-150 hover:text-ink"
    >
      <span
        className={`relative h-6 w-11 rounded-full border-[3px] border-ink transition-all duration-150 group-hover:-translate-y-px group-hover:shadow-toon-sm ${
          checked ? 'bg-teal' : 'bg-surface'
        }`}
      >
        <span
          className={`absolute top-0 size-4.5 rounded-full border-[2.5px] border-ink bg-white transition-all duration-150 ${
            checked ? 'left-[20px]' : 'left-0'
          }`}
        />
      </span>
      {label}
    </button>
  );
}
