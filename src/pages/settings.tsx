import { useRef, useState } from 'react';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { BOARDS, fetchBoard } from '../lib/boards';
import { testApiKey } from '../lib/ai';
import { clearAll, exportAll, importAll, useLocalState } from '../lib/storage';
import { Button, Card, Input, SectionTitle, Spinner, Toggle } from '../components/ui';
import {
  BellIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  KeyIcon,
  RefreshIcon,
  UploadIcon,
  XIcon,
} from '../components/icons';

interface SourceCheck {
  id: string;
  name: string;
  status: 'pending' | 'ok' | 'fail';
  count?: number;
  ms?: number;
  error?: string;
}

function SettingsAiCard({ settings, setSettings }: {
  settings: Settings;
  setSettings: (fn: (s: Settings) => Settings) => void;
}) {
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function test() {
    setTesting(true);
    setResult(null);
    setResult(await testApiKey(settings.openrouterKey));
    setTesting(false);
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <KeyIcon className="size-4.5 text-accent" />
        <h3 className="text-sm font-semibold">AI 研判服务 · OpenRouter</h3>
        <span
          className={`ml-auto text-xs ${settings.openrouterKey ? 'text-ok' : 'text-warn'}`}
        >
          {settings.openrouterKey ? '● 已配置' : '● 未配置'}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">API Key</span>
          <div className="flex gap-2">
            <input
              type={show ? 'text' : 'password'}
              value={settings.openrouterKey}
              onChange={(e) => setSettings((s) => ({ ...s, openrouterKey: e.target.value.trim() }))}
              placeholder="sk-or-v1-…"
              className="h-9.5 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 font-mono text-sm outline-none placeholder:text-muted focus:border-accent/60"
              spellCheck={false}
            />
            <Button size="sm" onClick={() => setShow((v) => !v)} className="h-9.5">
              {show ? '隐藏' : '显示'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={test}
              disabled={!settings.openrouterKey || testing}
              className="h-9.5"
            >
              {testing ? <Spinner className="size-3.5" /> : <CheckIcon className="size-3.5" />}
              测试
            </Button>
          </div>
          {result && (
            <p className={`mt-1.5 text-xs ${result.ok ? 'text-ok' : 'text-danger'}`}>
              {result.ok ? '✓ ' : '✕ '}
              {result.message}
            </p>
          )}
        </div>

        <Input
          label="模型"
          value={settings.model}
          onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value.trim() }))}
          placeholder="deepseek/deepseek-v3.2"
          className="font-mono"
          hint={
            <>
              任意 OpenRouter 上可用的对话模型,如 <code className="text-accent-deep">deepseek/deepseek-v3.2</code>、
              <code className="text-accent-deep">google/gemini-2.0-flash-001</code>。前往
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noreferrer"
                className="mx-0.5 text-accent-deep underline underline-offset-2"
              >
                openrouter.ai/models
              </a>
              查看模型列表。
            </>
          }
        />

        <p className="rounded-[10px] bg-paper px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          密钥仅保存在你当前浏览器的 localStorage 中,请求由浏览器直连 OpenRouter
          发出,本站没有后端、不会上传。建议在 OpenRouter
          后台单独创建一个设置了消费上限的 Key。
        </p>
      </div>
    </Card>
  );
}

function SettingsNotifyCard({ settings, setSettings }: {
  settings: Settings;
  setSettings: (fn: (s: Settings) => Settings) => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  async function toggle(v: boolean) {
    if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== 'granted') return;
    }
    setSettings((s) => ({ ...s, browserNotify: v }));
  }

  const label =
    permission === 'unsupported'
      ? '当前浏览器不支持系统通知'
      : permission === 'denied'
        ? '浏览器已拒绝通知授权,请在地址栏权限设置中恢复'
        : permission === 'default'
          ? '开启时将请求浏览器授权'
          : '已授权,发现重要热点时弹出系统通知';

  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center gap-2">
        <BellIcon className="size-4.5 text-accent" />
        <h3 className="text-sm font-semibold">浏览器通知</h3>
      </div>
      <Toggle
        checked={settings.browserNotify}
        onChange={toggle}
        label="发现重要热点时发送系统通知"
      />
      <p className="mt-2 text-xs leading-relaxed text-muted">{label}</p>
    </Card>
  );
}

function SettingsDataCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  function doExport() {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hot-radar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doImport(file: File) {
    const text = await file.text();
    if (importAll(text)) {
      location.reload();
    } else {
      setMsg('导入失败:文件格式不正确');
    }
  }

  function doClear() {
    if (!confirm('确定清空全部本地数据(关键词、监控历史、通知、设置)?此操作不可恢复。')) return;
    clearAll();
    location.reload();
  }

  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center gap-2">
        <DatabaseIcon className="size-4.5 text-accent" />
        <h3 className="text-sm font-semibold">数据管理</h3>
        <span className="ml-auto text-xs text-muted">数据仅存于本机浏览器</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={doExport}>
          <DownloadIcon className="size-3.5" /> 导出备份
        </Button>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <UploadIcon className="size-3.5" /> 导入备份
        </Button>
        <Button size="sm" variant="danger" onClick={doClear}>
          <XIcon className="size-3.5" /> 清空数据
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
          }}
        />
      </div>
      {msg && <p className="mt-2 text-xs text-danger">{msg}</p>}
    </Card>
  );
}

function SettingsSourcesCard() {
  const [checks, setChecks] = useState<SourceCheck[] | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const list: SourceCheck[] = BOARDS.map((b) => ({
      id: b.id,
      name: b.name,
      status: 'pending',
    }));
    setChecks(list);
    await Promise.all(
      BOARDS.map(async (b) => {
        const t0 = performance.now();
        try {
          const r = await fetchBoard(b.id);
          setChecks((prev) =>
            (prev ?? []).map((c) =>
              c.id === b.id
                ? {
                    ...c,
                    status: r.items.length > 0 ? 'ok' : 'fail',
                    count: r.items.length,
                    ms: Math.round(performance.now() - t0),
                    error: r.items.length === 0 ? (r.error ?? '空数据') : undefined,
                  }
                : c,
            ),
          );
        } catch (e) {
          setChecks((prev) =>
            (prev ?? []).map((c) =>
              c.id === b.id
                ? { ...c, status: 'fail', error: e instanceof Error ? e.message : '网络错误' }
                : c,
            ),
          );
        }
      }),
    );
    setRunning(false);
  }

  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center gap-2">
        <RefreshIcon className="size-4.5 text-accent" />
        <h3 className="text-sm font-semibold">数据源体检</h3>
        <Button size="sm" className="ml-auto" onClick={run} disabled={running}>
          {running ? <Spinner className="size-3.5" /> : <RefreshIcon className="size-3.5" />}
          {running ? '检测中…' : '开始检测'}
        </Button>
      </div>
      {checks ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {checks.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-[10px] border border-line/70 px-3 py-2 text-[13px]"
            >
              {c.status === 'pending' && <Spinner className="size-3" />}
              {c.status === 'ok' && <CheckIcon className="size-3.5 text-ok" />}
              {c.status === 'fail' && <XIcon className="size-3.5 text-danger" />}
              <span className="font-medium">{c.name}</span>
              {c.status === 'ok' && (
                <span className="ml-auto font-mono text-xs text-muted">
                  {c.count} 条 · {c.ms}ms
                </span>
              )}
              {c.status === 'fail' && (
                <span className="ml-auto truncate text-xs text-danger" title={c.error}>
                  {c.error}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          检测各热榜实时接口的可用性与延迟。全部失败时,榜单页会自动回退到仓库内的每日快照。
        </p>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useLocalState<Settings>('settings', DEFAULT_SETTINGS);

  return (
    <div className="mx-auto max-w-3xl animate-rise space-y-4">
      <SectionTitle title="设置" desc="所有配置保存在本地浏览器,即配即用" />
      <SettingsAiCard settings={settings} setSettings={setSettings} />
      <SettingsNotifyCard settings={settings} setSettings={setSettings} />
      <SettingsDataCard />
      <SettingsSourcesCard />
    </div>
  );
}
