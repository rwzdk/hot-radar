import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { NoticeEvent } from '../types';
import { uid, useLocalState } from './storage';

interface NoticesApi {
  notices: NoticeEvent[];
  unread: number;
  push: (e: Omit<NoticeEvent, 'id' | 'at' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const NoticesContext = createContext<NoticesApi | null>(null);

const MAX_NOTICES = 60;

export function NoticesProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useLocalState<NoticeEvent[]>('notices', []);

  const push = useCallback(
    (e: Omit<NoticeEvent, 'id' | 'at' | 'read'>) => {
      setNotices((list) =>
        [{ ...e, id: uid(), at: Date.now(), read: false }, ...list].slice(0, MAX_NOTICES),
      );
    },
    [setNotices],
  );

  const markRead = useCallback(
    (id: string) => {
      setNotices((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
    [setNotices],
  );

  const markAllRead = useCallback(() => {
    setNotices((list) => list.map((n) => ({ ...n, read: true })));
  }, [setNotices]);

  const clear = useCallback(() => setNotices([]), [setNotices]);

  const value = useMemo<NoticesApi>(
    () => ({
      notices,
      unread: notices.filter((n) => !n.read).length,
      push,
      markRead,
      markAllRead,
      clear,
    }),
    [notices, push, markRead, markAllRead, clear],
  );

  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>;
}

export function useNotices(): NoticesApi {
  const ctx = useContext(NoticesContext);
  if (!ctx) throw new Error('useNotices 必须在 NoticesProvider 内使用');
  return ctx;
}

/** 发浏览器通知(需已授权);静默失败 */
export function notifyBrowser(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: `${import.meta.env.BASE_URL}logo.svg` });
  } catch {
    /* 某些环境不允许 */
  }
}
