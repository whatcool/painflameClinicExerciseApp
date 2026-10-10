import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { query, run } from '../db/database';
import { darkColors, lightColors, type Colors } from './index';

const THEME_KEY = 'theme';

type ThemeValue = { colors: Colors; isDark: boolean; setDark: (dark: boolean) => void };

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  isDark: false,
  setDark: () => {},
});

/** Saved choice wins; before the patient chooses, follow the phone's setting. */
function initialIsDark() {
  const saved = query<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    THEME_KEY,
  ])[0];
  if (saved) {
    return saved.value === 'dark';
  }
  return Appearance.getColorScheme() === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(initialIsDark);

  const setDark = useCallback((dark: boolean) => {
    run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
      THEME_KEY,
      dark ? 'dark' : 'light',
    ]);
    setIsDark(dark);
  }, []);

  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, setDark }),
    [isDark, setDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Theme-aware styles. Usage:
 *   const useStyles = makeStyles(colors => StyleSheet.create({ ... }));
 *   function MyComponent() { const styles = useStyles(); ... }
 */
export function makeStyles<T>(factory: (colors: Colors) => T) {
  const cache = new Map<Colors, T>();
  return function useStyles(): T {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = factory(colors);
      cache.set(colors, styles);
    }
    return styles;
  };
}
