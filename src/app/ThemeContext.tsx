import React, { createContext, useContext, useState, useCallback } from 'react';

export type DesignTheme = 'A' | 'B' | 'C' | 'D' | 'haon' | 'daydreamer';

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
  // 선택(selected) 상태 강조용 — 신규 테마(haon/daydreamer)에서 사용. 기존 A~D는 미정의(옵셔널).
  sel?: string;
  selInk?: string;
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

// ── Haon Warm-Glass — 웜글래스 (기본 테마) ──
export const tokenHaon: ThemeTokens = {
  bg: '#F0E9DC',
  bgSub: '#F5EFE6',
  bgHover: '#EAE0D0',
  card: 'rgba(253,250,244,0.74)',
  sidebar: 'rgba(245,239,230,0.80)',
  text: '#3A352E',
  textSub: '#7d7163',
  textMuted: '#b3a791',
  accent: '#D4735A',         // 코랄
  accentLight: '#e89072',
  accentSoft: 'rgba(212,115,90,0.13)',
  border: 'rgba(160,110,80,0.16)',
  borderLight: 'rgba(160,110,80,0.10)',
  planBlock: '#F6DDD2',      // 코랄 계열 블록
  planBorder: 'rgba(212,115,90,0.30)',
  planText: '#a8492f',
  doBlock: '#6BAA7A',        // 그린 계열 블록
  doText: '#FFFFFF',
  danger: '#D4735A',
  dangerLight: '#F7E0D8',
  success: '#6BAA7A',
  info: '#C4A882',           // 골드
  font: "'Gowun Dodum', 'Pretendard Variable', 'Pretendard', sans-serif",
  shadow: '0 4px 20px rgba(160,110,80,0.10), 0 1px 3px rgba(58,53,46,0.05)',
  checkDone: '#6BAA7A',
  sel: 'rgba(212,115,90,0.18)',
  selInk: '#a8492f',
};

// ── Daydreamer — 핑크퍼플 (선택 테마) ──
export const tokenDaydreamer: ThemeTokens = {
  bg: '#f4eaf2',
  bgSub: '#efe1ed',
  bgHover: '#ecd9e8',
  card: 'rgba(255,255,255,0.40)',
  sidebar: 'rgba(249,241,247,0.70)',
  text: '#2a1230',
  textSub: '#7c5573',
  textMuted: '#bda6bb',
  accent: '#e30071',         // 핑크
  accentLight: '#ff2fa0',
  accentSoft: 'rgba(227,0,113,0.10)',
  border: 'rgba(214,0,122,0.15)',
  borderLight: 'rgba(214,0,122,0.08)',
  planBlock: '#FBD9EA',      // 핑크 계열 블록
  planBorder: 'rgba(227,0,113,0.30)',
  planText: '#a8005c',
  doBlock: '#8a3ad6',        // 퍼플 계열 블록
  doText: '#FFFFFF',
  danger: '#e0395a',
  dangerLight: '#fbe0e6',
  success: '#46b98a',
  info: '#9d6ad8',
  font: "'Gowun Dodum', 'Pretendard Variable', 'Pretendard', sans-serif",
  shadow: '0 4px 20px rgba(227,0,113,0.08), 0 1px 3px rgba(42,18,48,0.05)',
  checkDone: '#8a3ad6',
  sel: 'rgba(227,0,113,0.16)',
  selInk: '#a8005c',
};

export type LayoutMode = 'sidebar' | 'topnav';

export function getLayoutMode(theme: DesignTheme): LayoutMode {
  // C만 top-nav, 나머지(A/B/D/haon/daydreamer)는 sidebar 레이아웃
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
  if (theme === 'D') return tokenD;
  if (theme === 'daydreamer') return tokenDaydreamer;
  return tokenHaon; // 기본값
}

const THEME_STORAGE_KEY = 'haon.theme';
const VALID_THEMES: DesignTheme[] = ['A', 'B', 'C', 'D', 'haon', 'daydreamer'];

function readStoredTheme(): DesignTheme {
  if (typeof window === 'undefined') return 'haon';
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v && (VALID_THEMES as string[]).includes(v)) return v as DesignTheme;
  } catch {
    /* localStorage 접근 불가 시 기본값 */
  }
  return 'haon';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 초기값: localStorage 저장값 있으면 복원, 없으면 'haon'(기본)
  const [theme, setThemeState] = useState<DesignTheme>(readStoredTheme);

  // setTheme 시 localStorage에 저장
  const setTheme = useCallback((next: DesignTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* 저장 실패는 무시(시각만 반영) */
    }
  }, []);

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