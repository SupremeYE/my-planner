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

// ── Design A: Warm Beige sidebar layout ──
export const tokenA: ThemeTokens = {
  bg: '#FAF8F5',
  bgSub: '#F0EBE3',
  bgHover: '#F5F2EC',
  card: '#ffffff',
  sidebar: '#FAF8F5',
  text: '#2D2D2D',
  textSub: '#888888',
  textMuted: '#aaaaaa',
  accent: '#C8A97E',
  accentLight: '#F5E6CC',
  accentSoft: '#FDF4E7',
  border: '#E8E0D4',
  borderLight: '#F0EBE3',
  planBlock: '#F5E6CC',
  planBorder: '#E8D4A8',
  planText: '#C8A97E',
  doBlock: '#2D2D2D',
  doText: '#ffffff',
  danger: '#E05C5C',
  dangerLight: '#FFE8E8',
  success: '#5BC8AF',
  info: '#5B8FE0',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
  checkDone: '#C8A97E',
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

// ── Design C: Crisp Top-Nav — same warm palette, different layout ──
export const tokenC: ThemeTokens = {
  bg: '#F7F4EF',
  bgSub: '#EEEAE2',
  bgHover: '#F2EDE5',
  card: '#FFFFFF',
  sidebar: '#FFFFFF',          // top bar = white
  text: '#1E1C18',
  textSub: '#7A7265',
  textMuted: '#B5AFA6',
  accent: '#C9A84C',           // richer gold
  accentLight: '#F7EDD0',
  accentSoft: '#FDF6E3',
  border: '#E3DDD4',
  borderLight: '#EDE9E1',
  planBlock: '#F7EDD0',
  planBorder: '#DFC87A',
  planText: '#B8922B',
  doBlock: '#1E1C18',
  doText: '#FFFFFF',
  danger: '#D94F4F',
  dangerLight: '#FDEAEA',
  success: '#45B899',
  info: '#4A82CC',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 2px 8px rgba(0,0,0,0.07)',
  checkDone: '#C9A84C',
};

// ── Design D: Enhanced Dashboard (기반: Design A) ──
export const tokenD: ThemeTokens = {
  bg: '#FAF8F5',
  bgSub: '#F0EBE3',
  bgHover: '#F5F2EC',
  card: '#ffffff',
  sidebar: '#FAF8F5',
  text: '#2D2D2D',
  textSub: '#888888',
  textMuted: '#aaaaaa',
  accent: '#C8A97E',
  accentLight: '#F5E6CC',
  accentSoft: '#FDF4E7',
  border: '#E8E0D4',
  borderLight: '#F0EBE3',
  planBlock: '#F5E6CC',
  planBorder: '#E8D4A8',
  planText: '#C8A97E',
  doBlock: '#2D2D2D',
  doText: '#ffffff',
  danger: '#E05C5C',
  dangerLight: '#FFE8E8',
  success: '#5BC8AF',
  info: '#5B8FE0',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
  checkDone: '#C8A97E',
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