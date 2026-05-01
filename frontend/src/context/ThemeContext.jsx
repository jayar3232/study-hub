import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const THEME_OPTIONS = [
  { key: 'light', label: 'Light mode', helper: 'Clean daytime workspace' },
  { key: 'dark', label: 'Dark mode', helper: 'Focused low-light workspace' }
];

const normalizeTheme = (value) => THEME_OPTIONS.some(theme => theme.key === value) ? value : 'dark';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return normalizeTheme(saved);
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(prev => normalizeTheme(prev) === 'dark' ? 'light' : 'dark');

  const currentTheme = THEME_OPTIONS.find(item => item.key === theme) || THEME_OPTIONS[0];

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, themes: THEME_OPTIONS, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
