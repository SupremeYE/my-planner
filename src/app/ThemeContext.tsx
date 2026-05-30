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

// ── Design B: Haon Sunrise — 선라이즈 코랄/피치 라이트 테마 ──
export const tokenB: ThemeTokens = {
  bg: '#FFFFFF',
  bgSub: '#FBF6F1',
  bgHover: '#FFF1E8',
  card: '#FFFFFF',
  sidebar: '#FBF7F3',
  text: '#2D2A3A',
  textSub: '#6F6A80',
  textMuted: '#ADA8BC',
  accent: '#F4A582',      // 선라이즈 코랄
  accentLight: '#FFE6D6', // 부드러운 피치
  accentSoft: '#FFF5EE',
  border: '#F0E8DE',
  borderLight: '#F7F1E8',
  planBlock: '#E6EEF9',   // 새벽 하늘
  planBorder: '#C9DCF1',
  planText: '#4A6B96',
  doBlock: '#F4A582',
  doText: '#FFFFFF',
  danger: '#E07A6B',
  dangerLight: '#FCE9E4',
  success: '#7FB89A',
  info: '#8FB7DA',
  font: "'Gowun Dodum', 'Pretendard Variable', 'Pretendard', sans-serif",
  shadow: '0 4px 20px rgba(244,165,130,0.08), 0 1px 3px rgba(45,42,58,0.04)',
  checkDone: '#7FB89A',
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
  const [theme, setTheme] = useState<DesignTheme>('B');
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