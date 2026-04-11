import React, { createContext, useContext, useState } from 'react';

export type DesignTheme = 'A' | 'B' | 'C' | 'D';

export interface ThemeTokens {
  bg: string;
  bgSub: string;
  bgHover: string;
  card: string;
  sidebar: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentSoft: string;
  border: string;
  borderLight: string;
  planBlock: string;
  planBorder: string;
  planText: string;
  doBlock: string;
  doText: string;
  danger: string;
  dangerLight: string;
  success: string;
  info: string;
  font: string;
  shadow: string;
  checkDone: string;
}

// ── Design A: Curator — slate / cool surface (HTML 참고 팔레트) ──
export const tokenA: ThemeTokens = {
  bg: '#f6fafe',
  bgSub: '#eef4fa',
  bgHover: '#e5eff7',
  card: '#ffffff',
  sidebar: '#eef4fa',
  text: '#26343d',
  textSub: '#52616a',
  textMuted: '#6e7d86',
  accent: '#515f74',
  accentLight: '#d5e3fd',
  accentSoft: '#eef4fa',
  border: '#a4b4be',
  borderLight: '#ddeaf3',
  planBlock: '#d5e3fd',
  planBorder: '#c7d5ee',
  planText: '#455367',
  doBlock: '#515f74',
  doText: '#f6f7ff',
  danger: '#9f403d',
  dangerLight: '#fdecea',
  success: '#006b62',
  info: '#506076',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 1px 3px rgba(38,52,61,0.06)',
  checkDone: '#006b62',
};

// ── Design B: Midnight Focus dark layout ──
export const tokenB: ThemeTokens = {
  bg: '#0D0D16',
  bgSub: '#181826',
  bgHover: '#1E1E30',
  card: '#13131E',
  sidebar: '#090912',
  text: '#E2E2F0',
  textSub: '#6A6A8C',
  textMuted: '#3E3E56',
  accent: '#8B7CF8',
  accentLight: '#25233C',
  accentSoft: '#1C1B30',
  border: '#232338',
  borderLight: '#1B1B2C',
  planBlock: '#1E2040',
  planBorder: '#3A3870',
  planText: '#9B8FFA',
  doBlock: '#3730A3',
  doText: '#E8E6FF',
  danger: '#F87171',
  dangerLight: '#2A1E1E',
  success: '#34D399',
  info: '#60A5FA',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 1px 6px rgba(0,0,0,0.4)',
  checkDone: '#8B7CF8',
};

// ── Design C: Top-Nav — Curator 팔레트 (A와 동일 톤) ──
export const tokenC: ThemeTokens = {
  bg: '#f6fafe',
  bgSub: '#eef4fa',
  bgHover: '#e5eff7',
  card: '#ffffff',
  sidebar: '#ffffff',
  text: '#26343d',
  textSub: '#52616a',
  textMuted: '#6e7d86',
  accent: '#515f74',
  accentLight: '#d5e3fd',
  accentSoft: '#eef4fa',
  border: '#a4b4be',
  borderLight: '#ddeaf3',
  planBlock: '#d5e3fd',
  planBorder: '#c7d5ee',
  planText: '#455367',
  doBlock: '#515f74',
  doText: '#f6f7ff',
  danger: '#9f403d',
  dangerLight: '#fdecea',
  success: '#006b62',
  info: '#506076',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 2px 8px rgba(38,52,61,0.07)',
  checkDone: '#006b62',
};

// ── Design D: Enhanced Dashboard (Curator 팔레트, A와 동일) ──
export const tokenD: ThemeTokens = {
  bg: '#f6fafe',
  bgSub: '#eef4fa',
  bgHover: '#e5eff7',
  card: '#ffffff',
  sidebar: '#eef4fa',
  text: '#26343d',
  textSub: '#52616a',
  textMuted: '#6e7d86',
  accent: '#515f74',
  accentLight: '#d5e3fd',
  accentSoft: '#eef4fa',
  border: '#a4b4be',
  borderLight: '#ddeaf3',
  planBlock: '#d5e3fd',
  planBorder: '#c7d5ee',
  planText: '#455367',
  doBlock: '#515f74',
  doText: '#f6f7ff',
  danger: '#9f403d',
  dangerLight: '#fdecea',
  success: '#006b62',
  info: '#506076',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 1px 3px rgba(38,52,61,0.06)',
  checkDone: '#006b62',
};

export type LayoutMode = 'sidebar' | 'topnav';

export function getLayoutMode(theme: DesignTheme): LayoutMode {
  return theme === 'C' ? 'topnav' : 'sidebar';
}

interface ThemeContextType {
  theme: DesignTheme;
  setTheme: (t: DesignTheme) => void;
  t: ThemeTokens;
  layoutMode: LayoutMode;
}

// Persist context across HMR reloads
const THEME_CTX_KEY = '__THEME_CONTEXT__';
const ThemeContext: React.Context<ThemeContextType | null> =
  (globalThis as any)[THEME_CTX_KEY] ??
  ((globalThis as any)[THEME_CTX_KEY] = createContext<ThemeContextType | null>(null));

function resolveTokens(theme: DesignTheme): ThemeTokens {
  if (theme === 'A') return tokenA;
  if (theme === 'B') return tokenB;
  if (theme === 'C') return tokenC;
  return tokenD;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<DesignTheme>('D');
  const t = resolveTokens(theme);
  const layoutMode = getLayoutMode(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, t, layoutMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}