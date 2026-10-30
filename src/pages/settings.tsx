import { useRef, useState } from 'react';
import type { Settings } from '../types';
import { BOARDS, fetchBoard } from '../lib/boards';
import { testApiKey } from '../lib/ai';
import { clearAll, downloadFile, exportAll, importAll, useSettings } from '../lib/storage';
import { Button, Card, Input, SectionTitle, Spinner, Toggle } from '../components/ui';
import {
  BellIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  KeyIcon,
  RefreshIcon,
  ShieldIcon,
  TargetIcon,
  UploadIcon,
  XIcon,
} from '../components/icons';

interface SourceCheck {
  id: string;
  name: string;
  status: 'pending' | 'ok' | 'warn' | 'fail';
  count?: number;
  ms?: number;
  error?: string;
}

/** 卡片头部图标:36px 气泡底盒,soft 色轮换 + 微旋转 */
function HeadIcon({ bg, rotate, children }: { bg: string; rotate: string; children: React.ReactNode }) {
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-blob-1 border-toon shadow-toon-sm ${bg} ${rotate}`}
    >
      {children}
    </span>
  );
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
      <div className="mb-4 flex items-center gap-2.5">
        <HeadIcon bg="bg-yellow-soft" rotate="-rotate-6">
          <KeyIcon className="size-5" />
        </HeadIcon>
        <h3 className="text-sm font-black">AI 研判服务 · OpenRouter</h3>
        <span
          className={`ml-auto text-xs font-bold ${settings.openrouterKey ? 'text-ok' : 'text-warn'}`}
        >
          {settings.openrouterKey ? '● 已配置' : '● 未配置'}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">API Key</span>
          <div className="flex gap-2">
            <input
              type={show ? 'text' : 'password'}
              value={settings.openrouterKey}
              onChange={(e) => setSettings((s) => ({ ...s, openrouterKey: e.target.value.trim() }))}
              placeholder="sk-or-v1-…"
              aria-label="OpenRouter API Key"
              autoComplete="off"
              className="h-9.5 min-w-0 flex-1 rounded-btn border-[3px] border-ink bg-surface px-3 font-mono text-sm font-bold outline-none transition-all duration-100 placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
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
            <p className={`mt-1.5 text-xs font-bold ${result.ok ? 'text-ok' : 'text-danger'}`}>
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

        <p className="rounded-btn bg-paper px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-muted">
          建议为热点雷达单独创建一个 Key,并在 OpenRouter 后台设置消费上限。
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
      <div className="mb-3.5 flex items-center gap-2.5">
        <HeadIcon bg="bg-teal-soft" rotate="rotate-3">
          <BellIcon className="size-5" />
        </HeadIcon>
        <h3 className="text-sm font-black">浏览器通知</h3>
      </div>
      <Toggle
        checked={settings.browserNotify}
        onChange={toggle}
        label="发现重要热点时发送系统通知"
      />
      <p className="mt-2 text-xs font-semibold leading-relaxed text-muted">{label}</p>
    </Card>
  );
}

function SettingsScanCard({ settings, setSettings }: {
  settings: Settings;
  setSettings: (fn: (s: Settings) => Settings) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <HeadIcon bg="bg-accent-soft" rotate="rotate-2">
          <TargetIcon className="size-5" />
        </HeadIcon>
        <h3 className="text-sm font-black">扫描偏好</h3>
      </div>
      <div className="space-y-3.5">
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">自动扫描</span>
          <select
            value={String(settings.autoScanMinutes)}
            onChange={(e) => setSettings((s) => ({ ...s, autoScanMinutes: Number(e.target.value) }))}
            aria-label="自动扫描间隔"
            className="h-9 cursor-pointer rounded-btn border-[3px] border-ink bg-surface px-2.5 text-[13px] font-bold text-ink outline-none transition-all duration-100 hover:-translate-y-px hover:bg-paper hover:shadow-toon-sm focus:shadow-toon-sm"
          >
            <option value="0">关闭(手动扫描)</option>
            <option value="5">每 5 分钟</option>
            <option value="10">每 10 分钟</option>
            <option value="30">每 30 分钟</option>
          </select>
          <p className="mt-1.5 text-xs font-semibold leading-relaxed text-muted">
            页面打开期间按间隔自动重新扫描全部监控中的关键词;切到后台或无新内容时不打扰。自动扫描只入库和通知,不消耗 AI 额度。
          </p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">全局排除词</span>
          <input
            value={settings.globalExclude}
            onChange={(e) => setSettings((s) => ({ ...s, globalExclude: e.target.value }))}
            placeholder="广告,抽奖,引流"
            aria-label="全局排除词,逗号分隔"
            title="包含这些词的内容在扫描和榜单展示中被忽略,逗号或空格分隔"
            className="h-9.5 w-full rounded-btn border-[3px] border-ink bg-surface px-3 text-sm font-bold text-ink outline-none transition-all duration-100 placeholder:font-medium placeholder:text-muted focus:shadow-toon-sm"
          />
          <span className="mt-1.5 block text-xs font-semibold leading-relaxed text-muted">
            叠加在每个关键词自己的排除词之上,监控扫描、全网搜索与榜单展示同时生效。
          </span>
        </label>
      </div>
    </Card>
  );
}

function SettingsDataCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  function doExport() {
    downloadFile(
      `hot-radar-backup-${new Date().toISOString().slice(0, 10)}.json`,
      exportAll(),
      'application/json',
    );
  }

  async function doImport(file: File) {
    if (!confirm('导入将覆盖当前的关键词、监控历史与通知,是否继续?')) return;
    const text = await file.text();
    if (importAll(text)) {
      location.reload();
    } else {
      setMsg('导入失败:文件格式不正确');
    }
  }

  function doClear() {
    if (!confirm('确定清空全部数据(关键词、监控历史、通知、设置)?此操作不可恢复。')) return;
    clearAll();
    location.reload();
  }

  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <HeadIcon bg="bg-accent-soft" rotate="-rotate-3">
          <DatabaseIcon className="size-5" />
        </HeadIcon>
        <h3 className="text-sm font-black">数据管理</h3>
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
          aria-label="选择备份文件"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
          }}
        />
      </div>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-muted">
        备份不包含 AI 密钥。
      </p>
      {msg && <p className="mt-2 text-xs font-bold text-danger">{msg}</p>}
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
    for (const b of BOARDS) {
      const t0 = performance.now();
      try {
        const r = await fetchBoard(b.id);
        const live = r.from === 'live' && r.items.length > 0;
        const fallback = r.from === 'snapshot' && r.items.length > 0;
        setChecks((prev) =>
          (prev ?? []).map((c) =>
            c.id === b.id
              ? {
                  ...c,
                  status: live ? 'ok' : fallback ? 'warn' : 'fail',
                  count: r.items.length,
                  ms: Math.round(performance.now() - t0),
                  error: live
                    ? undefined
                    : fallback
                      ? '实时失败,快照可用'
                      : (r.error ?? '空数据'),
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
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    setRunning(false);
  }

  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <HeadIcon bg="bg-teal-soft" rotate="rotate-2">
          <RefreshIcon className="size-5" />
        </HeadIcon>
        <h3 className="text-sm font-black">数据源体检</h3>
        <Button size="sm" className="ml-auto" onClick={run} disabled={running}>
          {running ? <Spinner className="size-3.5" /> : <RefreshIcon className="size-3.5" />}
          {running ? '检测中…' : '开始检测'}
        </Button>
      </div>
      {checks ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {checks.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-btn border-[3px] border-ink px-3 py-2 text-[13px] font-bold"
            >
              {c.status === 'pending' && <Spinner className="size-3" />}
              {c.status === 'ok' && <CheckIcon className="size-3.5 shrink-0 text-ok" />}
              {c.status === 'warn' && <ShieldIcon className="size-3.5 shrink-0 text-warn" />}
              {c.status === 'fail' && <XIcon className="size-3.5 shrink-0 text-danger" />}
              <span className="font-extrabold">{c.name}</span>
              {c.status === 'ok' && (
                <span className="ml-auto font-mono text-xs font-bold text-muted">
                  {c.count} 条 · {c.ms}ms
                </span>
              )}
              {c.status === 'warn' && (
                <span className="ml-auto truncate text-xs font-bold text-warn" title={c.error}>
                  {c.count} 条 · 快照可用
                </span>
              )}
              {c.status === 'fail' && (
                <span className="ml-auto truncate text-xs font-bold text-danger" title={c.error}>
                  {c.error}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs font-semibold leading-relaxed text-muted">
          检测各热榜实时接口的可用性与延迟。全部失败时,榜单页会自动回退到仓库内的每日快照。
        </p>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useSettings();

  return (
    <div className="mx-auto max-w-3xl animate-rise space-y-4">
      <SectionTitle title="设置" desc="配置 AI 研判、扫描、通知与数据备份" />
      <SettingsAiCard settings={settings} setSettings={setSettings} />
      <SettingsScanCard settings={settings} setSettings={setSettings} />
      <SettingsNotifyCard settings={settings} setSettings={setSettings} />
      <SettingsDataCard />
      <SettingsSourcesCard />
    </div>
  );
}
