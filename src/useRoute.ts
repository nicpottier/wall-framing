import { useCallback, useEffect, useState } from 'react';

/** The two screens: the overview of all walls, or the editor for one wall (0-based). */
export type Route = { screen: 'overview' } | { screen: 'wall'; index: number };

export const wallHref = (index: number) => `#/wall/${index + 1}`;

function read(): Route {
  const m = window.location.hash.match(/^#\/wall\/(\d+)$/);
  return m ? { screen: 'wall', index: Number(m[1]) - 1 } : { screen: 'overview' };
}

/** Screen from the address hash (#/wall/3), so links, Back and reloads all work. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  const go = useCallback((next: Route, replace = false) => {
    const url = next.screen === 'wall' ? wallHref(next.index) : window.location.pathname + window.location.search;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setRoute(next);
    window.scrollTo(0, 0);
  }, []);

  return [route, go] as const;
}
