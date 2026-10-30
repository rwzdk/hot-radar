import { useState } from 'react';
import type { BoardId, Focus, Settings } from '../types';
import { BOARDS } from '../lib/boards';
import { extractFocusTags } from '../lib/ai';
import { splitTerms } from '../lib/aggregate';
import { clearFocusCache } from '../lib/focus';
import { uid } from '../lib/storage';
import { Button, Card, Spinner, Toggle } from './ui';
import { CheckIcon, SparkIcon, XIcon } from './icons';

function parseTags(value: string): string[] {
  return [...new Set(
    value
      .split(/[,，、\n]+/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  )].slice(0, 12);
}

const FALLBACK_STOPWORDS = new Set([
  '关注',
  '我想',
  '想看',
  '留意',
  '跟踪',
  '以及',
  '相关',
  '热点',
  '新闻',
  '消息',
  '动态',
  '进展',
  '和',
  '与',
  '及',
  '的',
  '了',
  '在',
  '对',
  '为',
  '我',
  '你',
  '他',
  '她',
  '它',
  '我们',
  '你们',
  '他们',
  '这个',
  '那个',
]);

function fallbackTags(name: string, description: string): string[] {
  const terms = [
    ...splitTerms(name),
    ...`${name} ${description}`
      .split(/[\s,，。；、/|和与及]+/)
      .map((term) => term.replace(/^的+|的+$/g, '').trim())
      .filter((term) => term.length >= 2 && !FALLBACK_STOPWORDS.has(term.toLowerCase())),
  ];
  const unique = [...new Set(terms)].slice(0, 10);
  return unique.length > 0 ? unique : [name.slice(0, 20)];
}

export function FocusEditor({
  focus,
  settings,
  onSave,
  onCancel,
}: {
  focus: Focus | null;
  settings: Settings;
  onSave: (focus: Focus) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(focus?.name ?? '');
  const [description, setDescription] = useState(focus?.description ?? '');
  const [tagsDraft, setTagsDraft] = useState(focus?.tags.join(', ') ?? '');
  const [exclude, setExclude] = useState(focus?.exclude ?? '');
  const [sources, setSources] = useState<BoardId[]>(focus?.sources ?? BOARDS.map((b) => b.id));
  const [minScore, setMinScore] = useState(focus?.minScore ?? 70);
  const [autoAi, setAutoAi] = useState(focus?.autoAi ?? true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');

  function toggleSource(id: BoardId) {
    setSources((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  }

  async function save() {
    const nextName = name.trim();
    const nextDescription = description.trim();
    if (!nextName || !nextDescription) {
      setError('关注点名称和描述都不能为空');
      return;
    }
    if (sources.length === 0) {
      setError('至少选择一个数据源');
      return;
    }

    let tags = parseTags(tagsDraft);
    let nextExclude = exclude.trim();
    setError('');
    if (tags.length === 0) {
      if (settings.openrouterKey) {
        setExtracting(true);
        try {
          const extracted = await extractFocusTags(
            { apiKey: settings.openrouterKey, model: settings.model },
            nextDescription,
          );
          tags = extracted.tags;
          if (!nextExclude && extracted.exclude) nextExclude = extracted.exclude;
        } catch {
          tags = fallbackTags(nextName, nextDescription);
        } finally {
          setExtracting(false);
        }
      } else {
        tags = fallbackTags(nextName, nextDescription);
      }
    }

    const next: Focus = {
      id: focus?.id ?? uid(),
      name: nextName,
      description: nextDescription,
      tags,
      exclude: nextExclude || undefined,
      sources,
      minScore,
      autoAi,
      paused: focus?.paused ?? false,
      createdAt: focus?.createdAt ?? Date.now(),
      lastScanAt: focus?.lastScanAt,
      tagsUpdatedAt: Date.now(),
    };
    if (
      focus &&
      (focus.description !== next.description ||
        focus.tags.join('|') !== next.tags.join('|'))
    ) {
      clearFocusCache(focus.id);
    }
    setSaving(true);
    onSave(next);
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-9 -rotate-6 place-items-center rounded-blob-1 border-toon bg-yellow-soft shadow-toon-sm">
          <SparkIcon className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-black">{focus ? '编辑关注点' : '新建关注点'}</h2>
          <p className="text-xs font-semibold text-muted">用一句话描述你关心什么，系统会先粗筛再 AI 精排</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：AI 芯片与算力"
            aria-label="关注点名称"
            className="h-9.5 w-full rounded-btn border-[3px] border-ink bg-surface px-3 text-sm font-bold outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">关注描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="例如：关注英伟达、国产 GPU、AI 芯片供应链和开源大模型的算力进展"
            aria-label="关注点描述"
            className="w-full resize-y rounded-btn border-[3px] border-ink bg-surface px-3 py-2 text-sm font-bold leading-relaxed outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">匹配标签</span>
          <input
            value={tagsDraft}
            onChange={(e) => setTagsDraft(e.target.value)}
            placeholder="留空则由 AI 从描述提取；也可手动填写，逗号分隔"
            aria-label="关注点匹配标签"
            className="h-9.5 w-full rounded-btn border-[3px] border-ink bg-surface px-3 text-sm font-bold outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
          />
          <span className="mt-1.5 block text-xs font-semibold leading-relaxed text-muted">
            标签用于本地粗筛，减少 AI 调用；留空时
            {settings.openrouterKey ? '保存会调用一次 AI 自动提取。' : '未配置 AI，将使用本地分词。'}
          </span>
        </label>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">数据源</span>
          <div className="flex flex-wrap gap-1.5">
            {BOARDS.map((board) => {
              const on = sources.includes(board.id);
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => toggleSource(board.id)}
                  aria-pressed={on}
                  className={`cursor-pointer rounded-full border-[2.5px] px-2.5 py-1 text-[11px] font-black transition-all duration-100 ${
                    on
                      ? 'border-ink bg-teal text-white shadow-toon-sm'
                      : 'border-ink/20 bg-surface text-muted hover:border-ink hover:bg-paper hover:text-ink'
                  }`}
                >
                  {board.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">最低相关度</span>
            <select
              value={String(minScore)}
              onChange={(e) => setMinScore(Number(e.target.value))}
              aria-label="关注点最低相关度"
              className="h-9 cursor-pointer rounded-btn border-[3px] border-ink bg-surface px-2.5 text-[13px] font-bold text-ink outline-none focus:shadow-toon-sm"
            >
              {[50, 60, 70, 80, 90].map((score) => (
                <option key={score} value={score}>
                  {score} 分及以上
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">排除词</span>
            <input
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder="广告,抽奖"
              aria-label="关注点排除词"
              className="h-9 w-full rounded-btn border-[3px] border-ink bg-surface px-3 text-sm font-bold outline-none placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
            />
          </label>
        </div>

        <Toggle
          checked={autoAi}
          onChange={setAutoAi}
          label="扫描时启用 AI 精排（只处理新增候选）"
        />

        {error && <p className="text-xs font-bold text-danger">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t-[2.5px] border-dashed border-ink/15 pt-3">
          <Button variant="primary" onClick={save} disabled={saving || extracting}>
            {saving ? <Spinner className="size-4" /> : extracting ? <Spinner className="size-4" /> : <CheckIcon className="size-4" />}
            {saving ? '保存中…' : extracting ? '提取标签中…' : '保存关注点'}
          </Button>
          <Button onClick={onCancel} disabled={saving || extracting}>
            <XIcon className="size-4" /> 取消
          </Button>
          <span className="ml-auto text-[11px] font-bold text-muted">
            {tagsDraft.trim() ? `${parseTags(tagsDraft).length} 个手动标签` : '标签留空时自动提取'}
          </span>
        </div>
      </div>
    </Card>
  );
}
