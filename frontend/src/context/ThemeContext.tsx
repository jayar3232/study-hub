import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  Dispatch,
  SetStateAction,
} from 'react';

export type ThemeKey = 'light' | 'dark';

export interface ThemeOption {
  key: ThemeKey;
  label: string;
  helper: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { key: 'light', label: 'Light mode', helper: 'Clean daytime interface' },
  { key: 'dark', label: 'Dark mode', helper: 'Focused low-light interface' },
];

export interface ThemeContextValue {
  /** The theme actually applied to the DOM (may differ from saved when mobileLightOnly is true). */
  theme: ThemeKey;
  /** The user's saved preference, regardless of mobile lock. */
  savedTheme: ThemeKey;
  /** Metadata object for the currently effective theme. */
  currentTheme: ThemeOption;
  /** Full list of supported themes. */
  themes: ThemeOption[];
  /** When true, mobile is forced to light mode regardless of saved preference. */
  mobileLightOnly: boolean;
  /** Setter — accepts a value or updater function, matching React's `setState` signature. */
  setTheme: Dispatch<SetStateAction<ThemeKey>>;
  /** Convenience toggle between light and dark. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const normalizeTheme = (value: unknown): ThemeKey =>
  THEME_OPTIONS.some((theme) => theme.key === value) ? (value as ThemeKey) : 'light';

const shouldLockMobileToLight = (): boolean => {
  return false;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeKey>(() => {
    const saved = localStorage.getItem('theme');
    return normalizeTheme(saved);
  });
  const [mobileLightOnly, setMobileLightOnly] = useState<boolean>(() => shouldLockMobileToLight());

  useEffect(() => {
    const updateMobileThemeLock = () => setMobileLightOnly(shouldLockMobileToLight());

    updateMobileThemeLock();
    window.addEventListener('resize', updateMobileThemeLock);
    window.addEventListener('orientationchange', updateMobileThemeLock);

    return () => {
      window.removeEventListener('resize', updateMobileThemeLock);
      window.removeEventListener('orientationchange', updateMobileThemeLock);
    };
  }, []);

  const effectiveTheme: ThemeKey = mobileLightOnly ? 'light' : theme;

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.mobileLightOnly = mobileLightOnly ? 'true' : 'false';
  }, [effectiveTheme, mobileLightOnly, theme]);

  const setRequestedTheme: Dispatch<SetStateAction<ThemeKey>> = (value) => {
    setTheme((prev) => {
      const next = typeof value === 'function'
        ? (value as (prev: ThemeKey) => ThemeKey)(prev)
        : value;
      return normalizeTheme(next);
    });
  };

  const toggleTheme = (): void => {
    setTheme((prev) => (normalizeTheme(prev) === 'dark' ? 'light' : 'dark'));
  };

  const currentTheme: ThemeOption =
    THEME_OPTIONS.find((item) => item.key === effectiveTheme) || THEME_OPTIONS[0];

  const value: ThemeContextValue = {
    theme: effectiveTheme,
    savedTheme: theme,
    currentTheme,
    themes: THEME_OPTIONS,
    mobileLightOnly,
    setTheme: setRequestedTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Access the theme context.
 *
 * Throws if called outside a `<ThemeProvider>`. The provider is mounted at the
 * root of the app, so any error here indicates a wiring bug (e.g. a test or
 * storybook render missing the provider).
 */
export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>.');
  }
  return ctx;
};
