import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, UIManager, useColorScheme, View } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export type MessengerThemeColors = {
  background: string;
  surface: string;
  elevated: string;
  text: string;
  mutedText: string;
  border: string;
  input: string;
  primary: string;
  sentBubble: string;
  receivedBubble: string;
  online: string;
  danger: string;
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  colors: MessengerThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const THEME_KEY = 'syncrova.nativeMessenger.themeMode';

const lightColors: MessengerThemeColors = {
  background: '#FFFFFF',
  surface: '#F0F2F5',
  elevated: '#FFFFFF',
  text: '#050505',
  mutedText: '#65676B',
  border: '#CED0D4',
  input: '#F0F2F5',
  primary: '#0084FF',
  sentBubble: '#0084FF',
  receivedBubble: '#E4E6EB',
  online: '#31A24C',
  danger: '#DC2626'
};

const darkColors: MessengerThemeColors = {
  background: '#000000',
  surface: '#1A1A1A',
  elevated: '#242526',
  text: '#E4E6EB',
  mutedText: '#B0B3B8',
  border: '#3A3B3C',
  input: '#3A3B3C',
  primary: '#0084FF',
  sentBubble: '#0084FF',
  receivedBubble: '#3E4042',
  online: '#31A24C',
  danger: '#F87171'
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);
  const resolvedMode = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const colors = resolvedMode === 'dark' ? darkColors : lightColors;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_KEY)
      .then(value => {
        if (!mounted) return;
        if (value === 'light' || value === 'dark' || value === 'system') setModeState(value);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setModeState(nextMode);
    await AsyncStorage.setItem(THEME_KEY, nextMode);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    colors,
    mode,
    resolvedMode,
    setMode
  }), [colors, mode, resolvedMode, setMode]);

  if (!ready) {
    return <View style={{ backgroundColor: colors.background, flex: 1 }} />;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
};
