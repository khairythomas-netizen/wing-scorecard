import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'wingz:theme';

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Theme preference, persisted and reflected in the PWA status bar colour. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.dataset.theme = 'light';
    else delete root.dataset.theme;

    const meta = document.getElementById('themeColor') as HTMLMetaElement | null;
    if (meta) meta.content = theme === 'light' ? '#f7f6f4' : '#08090b';

    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private mode — the choice just will not persist */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
