import type { WatchResult } from '../types';
import { relativeTime } from '../lib/format';
import {
  Badge,
  HeatBar,
  ImportanceTag,
  RelevanceMeter,
  SourceBadge,
  Spinner,
} from './ui';
import { ExternalIcon, ShieldIcon, SparkIcon } from './icons';

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

  return (
    <div className="border-b border-line/60 px-4 py-3.5 transition-colors last:border-0 hover:bg-paper/60 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* 第一行:来源 + 标题 */}
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={item.source} />
            {isNew && <Badge tone="accent">NEW</Badge>}
            {suspicious && (
              <Badge tone="danger">
                <ShieldIcon className="size-3" /> 真实性存疑
              </Badge>
            )}
            {item.heatLabel && (
              <span className="font-mono text-[11px] tabular-nums text-muted">
                🔥 {item.heatLabel}
              </span>
            )}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="group mt-1.5 inline-flex items-baseline gap-1.5 text-sm font-medium leading-6 text-ink hover:text-accent-deep"
          >
            <span className="line-clamp-2">{item.title}</span>
            <ExternalIcon className="size-3 shrink-0 self-center text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
          <p className="mt-0.5 font-mono text-[11px] text-muted">
            {relativeTime(item.foundAt)}捕获
            {item.publishedAt && ` · 发布于 ${relativeTime(item.publishedAt)}`}
          </p>
        </div>

        {onAnalyze && (
          <button
            onClick={() => onAnalyze(item)}
            disabled={analyzing}
            className="mt-0.5 inline-flex h-7.5 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-accent/40 hover:text-accent-deep disabled:opacity-50"
            title="AI 研判"
          >
            {analyzing ? <Spinner className="size-3" /> : <SparkIcon className="size-3" />}
            {ai ? '重析' : '研判'}
          </button>
        )}
      </div>

      {/* AI 分析结论 */}
      {ai && (
        <div className="mt-2.5 rounded-[10px] bg-paper/80 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <ImportanceTag level={ai.importance} />
            <RelevanceMeter value={ai.relevance} />
            <span className="text-xs text-muted">vs 相关度</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{ai.summary}</p>
          {ai.reason && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted">依据:{ai.reason}</p>
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
