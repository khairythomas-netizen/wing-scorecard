import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'wingz:theme';

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

interface ThemeValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * One source of truth for the theme.
 *
 * This was a plain hook, and calling it from two components created two
 * independent states. The instance holding `toggle` updated the DOM and
 * localStorage, while the instance whose `theme` was passed down as a prop
 * never changed — so the map kept its dark tiles in light mode. State that
 * more than one component needs belongs in a provider, not a hook.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
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
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
