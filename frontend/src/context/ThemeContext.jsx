import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const THEME_OPTIONS = [
  { key: 'light', label: 'Light mode', helper: 'Clean daytime workspace' },
  { key: 'dark', label: 'Dark mode', helper: 'Focused low-light workspace' }
];

const normalizeTheme = (value) => THEME_OPTIONS.some(theme => theme.key === value) ? value : 'light';

const shouldLockMobileToLight = () => {
  if (typeof window === 'undefined') return false;

  const capacitor = window.Capacitor;
  const platform = capacitor?.getPlatform?.();
  const isNativeApp = Boolean(capacitor?.isNativePlatform?.()) || (platform && platform !== 'web');
  const isSmallTouchScreen = window.matchMedia?.('(max-width: 767px)')?.matches
    && window.matchMedia?.('(pointer: coarse)')?.matches;

  return Boolean(isNativeApp || isSmallTouchScreen);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return normalizeTheme(saved);
  });
  const [mobileLightOnly, setMobileLightOnly] = useState(() => shouldLockMobileToLight());

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

  const effectiveTheme = mobileLightOnly ? 'light' : theme;

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.mobileLightOnly = mobileLightOnly ? 'true' : 'false';
  }, [effectiveTheme, mobileLightOnly, theme]);

  const setRequestedTheme = (value) => {
    setTheme(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      return normalizeTheme(next);
    });
  };

  const toggleTheme = () => {
    if (mobileLightOnly) {
      setTheme('light');
      return;
    }
    setTheme(prev => normalizeTheme(prev) === 'dark' ? 'light' : 'dark');
  };

  const currentTheme = THEME_OPTIONS.find(item => item.key === effectiveTheme) || THEME_OPTIONS[0];

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, savedTheme: theme, currentTheme, themes: THEME_OPTIONS, mobileLightOnly, setTheme: setRequestedTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
