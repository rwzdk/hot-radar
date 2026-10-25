import { useCallback, useEffect, useState } from 'react';

export type PageId = 'boards' | 'monitor' | 'search' | 'settings';

export interface Route {
  page: PageId;
  params: Record<string, string>;
}

const PAGES: PageId[] = ['boards', 'monitor', 'search', 'settings'];

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const page = (PAGES as string[]).includes(path) ? (path as PageId) : 'boards';
  const params: Record<string, string> = {};
  new URLSearchParams(query).forEach((v, k) => {
    params[k] = v;
  });
  return { page, params };
}

/** 极简 hash 路由:#/monitor?kw=xxx */
export function useHashRoute(): [Route, (to: string) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    location.hash = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`;
  }, []);

  return [route, navigate];
}
