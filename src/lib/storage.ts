import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'hotradar:';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 存储满了或隐私模式下静默失败
  }
}

export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

/** 带持久化的 useState,并监听其他标签页的修改 */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJson(key, initial));

  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFIX + key && e.newValue) {
        try {
          setValue(JSON.parse(e.newValue) as T);
        } catch {
          /* 忽略坏数据 */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, setValue] as const;
}

/** 导出全部本地数据(用于备份) */
export function exportAll(): string {
  const dump: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      try {
        dump[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
      } catch {
        /* 跳过 */
      }
    }
  }
  return JSON.stringify({ app: 'hot-radar', exportedAt: Date.now(), data: dump }, null, 2);
}

/** 从备份恢复 */
export function importAll(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as { data?: Record<string, unknown> };
    if (!parsed.data) return false;
    for (const [k, v] of Object.entries(parsed.data)) {
      saveJson(k, v);
    }
    return true;
  } catch {
    return false;
  }
}

/** 清空本应用全部数据 */
export function clearAll(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

/** 生成短 id */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 监控历史的存储键 */
export function watchKey(keywordId: string): string {
  return `watch:${keywordId}`;
}

/** 读取某个关键词的历史结果 */
export function loadWatch(keywordId: string): import('../types').WatchResult[] {
  return loadJson<import('../types').WatchResult[]>(watchKey(keywordId), []);
}

export function useReload(callback: () => void) {
  const reload = useCallback(callback, [callback]);
  useEffect(() => {
    const onStorage = () => reload();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);
}
