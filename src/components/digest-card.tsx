import type { AiDigest } from '../types';
import { formatDateTime } from '../lib/format';
import { Badge, Button, Card, ImportanceTag, Spinner } from './ui';
import { FileTextIcon, SparkIcon } from './icons';

export function DigestCard({
  digest,
  busy,
  aiReady,
  hasResults,
  title = 'AI 热点简报',
  onGenerate,
}: {
  digest: AiDigest;
  busy: boolean;
  aiReady: boolean;
  hasResults: boolean;
  title?: string;
  onGenerate: () => void;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="grid size-9 shrink-0 -rotate-3 place-items-center rounded-blob-2 border-toon bg-accent-soft shadow-toon-sm">
          <FileTextIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black">{title}</h3>
          <p className="font-mono text-[10px] font-bold text-muted">
            基于 {digest.covered} 条 · {formatDateTime(digest.generatedAt)}
            {digest.model ? ` · ${digest.model}` : ''}
          </p>
        </div>
        <Button
          size="sm"
          className="ml-auto"
          onClick={onGenerate}
          disabled={!aiReady || busy || !hasResults}
          title={aiReady ? '基于当前结果重新生成' : '请先在设置中配置 AI 密钥'}
        >
          {busy ? <Spinner className="size-3.5" /> : <SparkIcon className="size-3.5" />}
          {busy ? '生成中…' : '重新生成'}
        </Button>
      </div>

      <p className="text-[15px] font-black leading-6 text-ink">{digest.headline}</p>
      <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-ink-soft">
        {digest.overview}
      </p>

      {digest.points.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t-[2.5px] border-dashed border-ink/15 pt-3">
          {digest.points.map((point, index) => (
            <div key={`${point.text}-${index}`} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                <ImportanceTag level={point.level} />
              </span>
              <span className="text-[13px] font-semibold leading-relaxed text-ink-soft">
                {point.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {digest.watch.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-muted">接下来关注</span>
          {digest.watch.map((item, index) => (
            <Badge key={`${item}-${index}`} tone="neutral">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
