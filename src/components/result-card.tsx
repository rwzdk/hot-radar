import { useState } from 'react';
import type { WatchResult } from '../types';
import { relativeTime } from '../lib/format';
import {
  Badge,
  Button,
  HeatBar,
  ImportanceTag,
  RelevanceMeter,
  SourceBadge,
  Spinner,
} from './ui';
import { CheckIcon, CopyIcon, ExternalIcon, FlameIcon, ShieldIcon, SparkIcon } from './icons';

export function ResultCard({
  item,
  onAnalyze,
  analyzing,
  isNew,
}: {
  item: WatchResult;
  onAnalyze?: (item: WatchResult) => void;
  analyzing?: boolean;
  isNew?: boolean;
}) {
  const ai = item.ai;
  const suspicious = ai && !ai.isReal;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }

  return (
    <div className="border-b-[2.5px] border-dashed border-ink/10 px-4 py-3.5 transition-colors last:border-0 hover:bg-paper sm:px-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* 第一行:来源 + 标题 */}
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={item.source} />
            {isNew && <Badge tone="accent">新</Badge>}
            {suspicious && (
              <Badge tone="danger">
                <ShieldIcon className="size-3" /> 真实性存疑
              </Badge>
            )}
            {item.heatLabel && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums text-muted">
                <FlameIcon className="size-3.5" /> {item.heatLabel}
              </span>
            )}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="group mt-1.5 inline-flex items-baseline gap-1.5 text-sm font-bold leading-6 text-ink hover:text-accent-deep"
          >
            <span className="line-clamp-2">{item.title}</span>
            <ExternalIcon className="size-3 shrink-0 self-center text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
          <p className="mt-0.5 font-mono text-[11px] font-semibold text-muted">
            {relativeTime(item.foundAt)}捕获
            {item.publishedAt && ` · 发布于 ${relativeTime(item.publishedAt)}`}
          </p>
        </div>

        <div className="mt-0.5 flex shrink-0 items-start gap-1.5">
          <button
            type="button"
            onClick={copyLink}
            className="grid size-8 cursor-pointer place-items-center rounded-[11px] border-[2.5px] border-ink bg-surface text-ink-soft shadow-toon-sm transition-all duration-100 hover:-translate-x-px hover:-translate-y-px hover:text-ink hover:shadow-toon active:translate-x-0.5 active:translate-y-0.5 active:shadow-toon-none"
            title={copied ? '已复制' : '复制链接'}
            aria-label={copied ? '已复制链接' : '复制链接'}
          >
            {copied ? <CheckIcon className="size-3.5 text-teal" /> : <CopyIcon className="size-3.5" />}
          </button>
          {onAnalyze && (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => onAnalyze(item)}
              disabled={analyzing}
              title="AI 研判"
            >
              {analyzing ? <Spinner className="size-3.5" /> : <SparkIcon className="size-3.5" />}
              {ai ? '重析' : '研判'}
            </Button>
          )}
        </div>
      </div>

      {/* AI 分析结论 */}
      {ai && (
        <div className="mt-2.5 rounded-btn border-toon-sm bg-yellow-soft px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <ImportanceTag level={ai.importance} />
            <RelevanceMeter value={ai.relevance} />
            <span className="text-xs font-semibold text-muted">vs 相关度</span>
          </div>
          <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-ink-soft">{ai.summary}</p>
          {ai.reason && (
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-muted">依据:{ai.reason}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function HeatInline({ item, max }: { item: WatchResult; max: number }) {
  if (!item.heat || max <= 0) return null;
  return <HeatBar ratio={Math.min(1, item.heat / max)} />;
}
