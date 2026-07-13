import React, { createContext, useContext, useState } from 'react';

export type DesignTheme = 'A' | 'B' | 'C' | 'D' | 'H';

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
  // warning: 임박·주의 강조 (danger 와 구분 — danger=위험·삭제, warning=임박·주의).
  // dueSoon/마감 임박, 주의 상태 등에 재사용되는 공통 시맨틱 색. 전 테마 필수.
  warning: string;
  warningLight: string;
  success: string;
  info: string;
  font: string;
  shadow: string;
  checkDone: string;

  // ── 폰트 역할 필드 (Stage 1 배관 — family 만; 굵기 잠금은 추후 단계) ──
  // 역할→폰트는 "테마별 선언"이다. DESIGN.md §4/§8 타이포 규정은 테마 H 전용 계약이며,
  // 다른 테마(A/B/C/D)는 각자의 기존 폰트 정체성을 그대로 보존한다.
  // 이 단계에서는 어떤 컴포넌트도 이 필드를 소비하지 않는다(시각 변화 0). Stage 2에서
  // 하드코딩 폰트를 이 필드로 치환한다.
  fontPageTitle?: string;   // 페이지 대제목
  fontSection?: string;     // 섹션·카드 제목
  fontBody?: string;        // 본문·입력
  fontLabel?: string;       // 라벨·버튼·칩
  // fontNumeric 는 아래 Haon 확장 블록에 이미 선언되어 있다(숫자 강조).
  fontDiary?: string;       // 일기 본문 (H: Ownglyph)
  fontDecorative?: string;  // 손글씨 장식 (H: Pretendard 폴백 — §8)
  // ── Stage 1.95 신규 역할 필드 (등록만; 소비처 없음 — 치환은 Stage 2) ──
  fontReading?: string;     // 독서·구절 명조 본문 (A/B/C/D: Georgia/Noto Serif KR, H: Pretendard)
  fontBrand?: string;       // 스플래시·로그인·로고 브랜드 명조 (A/B/C/D: Gowun Batang, H: Pretendard)
  fontQuote?: string;       // 확언·태그라인 감성 본문 (A/B/C/D: Gowun Dodum, H: Pretendard)
  fontDecoratePen?: string; // 손글씨 장식(펜) (A/B/C/D: Nanum Pen Script, H: Pretendard 폴백)
  fontStat?: string;        // 디스플레이 통계 숫자(%·연도) (A/B/C/D: DM Serif, H: Sora)

  // ── Haon Soft Pastel Glassmorphism 확장 필드 (DESIGN.md) ──
  // 파스텔-글래스 테마(H)에서만 채워지고, 기존 테마는 undefined.
  // 컴포넌트는 `t.appGradient ?? t.bg` 처럼 폴백해 기존 테마 호환을 유지한다.
  appGradient?: string;      // 페이지 캔버스 — 대각선 파스텔 그라디언트
  cardFrosted?: string;      // 프로스티드 글래스 카드 배경 (rgba)
  glassBorder?: string;      // 은은한 밝은 테두리
  glassBlur?: string;        // backdrop-filter 값
  primaryGradient?: string;  // Primary 버튼 코랄→핑크
  accentGradientWarm?: string;
  accentGradientCool?: string;
  shadowCard?: string;       // card-floating
  shadowButton?: string;     // button-colored
  shadowFab?: string;
  radiusCard?: number;       // 카드 radius (24–32)
  fontNumeric?: string;      // 숫자 강조 (Sora)

  // 오늘 기록 카드 (배경 분리용 테두리+그림자)
  recordCardBg?: string;
  recordCardBorder?: string;
  recordCardShadow?: string;
  // 타임블록 기본색(태그 없는 블록) + now 라인 — Timeline 에 prop 으로 전달
  blockDefaultBg?: string;
  blockDefaultBorder?: string;
  blockDefaultText?: string;
  nowLine?: string;

  // 솔리드 표면 (본문 카드·행) — DESIGN v1.1: 본문은 글래스가 아니라
  // 불투명 흰색 + 1px 하이라인 테두리 + 소프트 컬러 그림자 (backdrop-filter 없음).
  // 글래스는 오버레이(상단 날짜 바·모달·팝오버) 전용.
  solidCardBg?: string;
  solidCardBorder?: string;
  solidCardShadow?: string;
  solidCardRadius?: number;
  solidRowBg?: string;
  solidRowBorder?: string;
  solidRowShadow?: string;
  solidRowRadius?: number;

  // 핵심(KEY, isTop3) 할 일 행 강조 — 코랄 톤 배경 틴트 + 코랄 테두리 + 핑크 글로우 그림자.
  // 좌측 바/배지는 primaryGradient 재사용.
  keyRowBg?: string;
  keyRowBorder?: string;
  keyRowShadow?: string;
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
  warning: '#C7902E',
  warningLight: '#F7EEDA',
  success: '#006b62',
  info: '#506076',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 1px 3px rgba(38,52,61,0.06)',
  checkDone: '#006b62',

  // 폰트 역할(기존 렌더 보존): 제목 DM Serif · 본문/라벨 Pretendard · 숫자 Gmarket · 일기 Ownglyph · 장식 Gaegu
  fontPageTitle: "'DM Serif Display', serif",
  fontSection: "'DM Serif Display', serif",
  fontBody: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  fontLabel: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  fontNumeric: "'GmarketSansBold', 'GmarketSans', 'Pretendard', sans-serif",
  fontDiary: "'Ownglyph-Positive', 'Gaegu', 'Pretendard', sans-serif",
  fontDecorative: "'Gaegu', cursive",
  fontReading: "'Georgia', 'Noto Serif KR', serif",
  fontBrand: "'Gowun Batang', serif",
  fontQuote: "'Gowun Dodum', 'Pretendard', sans-serif",
  fontDecoratePen: "'Nanum Pen Script', cursive",
  fontStat: "'DM Serif Display', serif",
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
  warning: '#D9962E',
  warningLight: '#F8EEDA',
  success: '#7FB89A',
  info: '#8FB7DA',
  font: "'Gowun Dodum', 'Pretendard Variable', 'Pretendard', sans-serif",
  shadow: '0 4px 20px rgba(244,165,130,0.08), 0 1px 3px rgba(45,42,58,0.04)',
  checkDone: '#7FB89A',

  // 폰트 역할(선라이즈 정체성 보존): 제목 DM Serif · 본문/라벨 Gowun Dodum · 숫자 Gmarket · 일기 Ownglyph · 장식 Gaegu
  fontPageTitle: "'DM Serif Display', serif",
  fontSection: "'DM Serif Display', serif",
  fontBody: "'Gowun Dodum', 'Pretendard Variable', 'Pretendard', sans-serif",
  fontLabel: "'Gowun Dodum', 'Pretendard Variable', 'Pretendard', sans-serif",
  fontNumeric: "'GmarketSansBold', 'GmarketSans', 'Pretendard', sans-serif",
  fontDiary: "'Ownglyph-Positive', 'Gaegu', 'Pretendard', sans-serif",
  fontDecorative: "'Gaegu', cursive",
  fontReading: "'Georgia', 'Noto Serif KR', serif",
  fontBrand: "'Gowun Batang', serif",
  fontQuote: "'Gowun Dodum', 'Pretendard', sans-serif",
  fontDecoratePen: "'Nanum Pen Script', cursive",
  fontStat: "'DM Serif Display', serif",
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
  warning: '#C7902E',
  warningLight: '#F7EEDA',
  success: '#006b62',
  info: '#506076',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 2px 8px rgba(38,52,61,0.07)',
  checkDone: '#006b62',

  // 폰트 역할(기존 렌더 보존): 제목 DM Serif · 본문/라벨 Pretendard · 숫자 Gmarket · 일기 Ownglyph · 장식 Gaegu
  fontPageTitle: "'DM Serif Display', serif",
  fontSection: "'DM Serif Display', serif",
  fontBody: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  fontLabel: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  fontNumeric: "'GmarketSansBold', 'GmarketSans', 'Pretendard', sans-serif",
  fontDiary: "'Ownglyph-Positive', 'Gaegu', 'Pretendard', sans-serif",
  fontDecorative: "'Gaegu', cursive",
  fontReading: "'Georgia', 'Noto Serif KR', serif",
  fontBrand: "'Gowun Batang', serif",
  fontQuote: "'Gowun Dodum', 'Pretendard', sans-serif",
  fontDecoratePen: "'Nanum Pen Script', cursive",
  fontStat: "'DM Serif Display', serif",
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
  warning: '#C7902E',
  warningLight: '#F7EEDA',
  success: '#006b62',
  info: '#506076',
  font: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  shadow: '0 1px 3px rgba(38,52,61,0.06)',
  checkDone: '#006b62',

  // 폰트 역할(기존 렌더 보존): 제목 DM Serif · 본문/라벨 Pretendard · 숫자 Gmarket · 일기 Ownglyph · 장식 Gaegu
  fontPageTitle: "'DM Serif Display', serif",
  fontSection: "'DM Serif Display', serif",
  fontBody: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  fontLabel: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  fontNumeric: "'GmarketSansBold', 'GmarketSans', 'Pretendard', sans-serif",
  fontDiary: "'Ownglyph-Positive', 'Gaegu', 'Pretendard', sans-serif",
  fontDecorative: "'Gaegu', cursive",
  fontReading: "'Georgia', 'Noto Serif KR', serif",
  fontBrand: "'Gowun Batang', serif",
  fontQuote: "'Gowun Dodum', 'Pretendard', sans-serif",
  fontDecoratePen: "'Nanum Pen Script', cursive",
  fontStat: "'DM Serif Display', serif",
};

// ── Design H: Haon — Soft Pastel Glassmorphism (DESIGN.md 단일 기준) ──
// 파스텔 그라디언트 캔버스 + 프로스티드 글래스 카드 + 코랄→핑크 강조.
// 기존 웜(B)은 그대로 보존하고, 이 테마는 새 옵션으로만 추가한다.
export const tokenH: ThemeTokens = {
  bg: '#FBF8FC',            // near-white 캔버스 (canvasStyle appGradient 베이스와 동일) — 미마이그레이션 페이지 배경 통일
  bgSub: '#F4E7FB',        // lavender-mist
  bgHover: '#EFE3FA',
  card: '#FFFFFF',         // card-solid (밀도 높은 콘텐츠)
  sidebar: 'rgba(255,255,255,0.55)',
  text: '#2E2A5B',         // text-primary (deep indigo-navy)
  textSub: '#6E6A93',      // text-secondary
  textMuted: '#A5A2BE',    // text-muted
  accent: '#FF6F91',       // pink-vivid
  accentLight: '#F6BCBA',  // soft-coral
  accentSoft: '#F4E7FB',   // lavender-mist
  border: 'rgba(46,42,91,0.10)',
  borderLight: 'rgba(46,42,91,0.06)',
  planBlock: '#EAE4FB',    // 쿨 라일락 톤 (PLAN)
  planBorder: 'rgba(200,168,233,0.5)',
  planText: '#5B4FA0',
  doBlock: '#FF6F91',      // 코랄→핑크 강조 (DO)
  doText: '#FFFFFF',
  danger: '#F58A8A',
  dangerLight: '#FCE6E6',
  // DESIGN.md §3 warning #F6C177 (임박·주의). danger(#F58A8A, 위험·삭제)와 구분.
  warning: '#F6C177',
  warningLight: '#FCEFD4',
  success: '#7FCB8F',
  info: '#9BB4F4',
  font: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif",
  shadow: '0 20px 50px rgba(120,90,160,0.18)',
  checkDone: '#7FCB8F',

  // 파스텔-글래스 확장
  // 배경: 옅은 흰 캔버스(#FBF8FC) + 방사형 blob 2개 (채도 낮춤)
  appGradient:
    'radial-gradient(1200px 600px at 15% 0%, rgba(200,168,233,0.20), transparent 60%), ' +
    'radial-gradient(1000px 700px at 100% 100%, rgba(246,188,186,0.18), transparent 55%), #FBF8FC',
  cardFrosted: 'rgba(255,255,255,0.55)',
  glassBorder: '1px solid rgba(255,255,255,0.6)',
  glassBlur: 'blur(20px) saturate(140%)',
  primaryGradient: 'linear-gradient(135deg, #FF9A8B 0%, #FF6F91 100%)',
  accentGradientWarm: 'linear-gradient(135deg, #F6BCBA 0%, #E3AADD 100%)',
  accentGradientCool: 'linear-gradient(135deg, #C8A8E9 0%, #C3C7F4 100%)',
  shadowCard: '0 20px 50px rgba(120,90,160,0.18)',
  shadowButton: '0 8px 20px rgba(255,111,145,0.35)',
  shadowFab: '0 10px 24px rgba(46,42,91,0.30)',
  radiusCard: 28,
  fontNumeric: "'Sora', 'Pretendard', sans-serif",

  // 폰트 역할 — DESIGN.md §4 계약(H 전용): 제목(page-title/section) = GmarketSans,
  // 본문·카드제목·라벨/독서/브랜드/확언 = Pretendard, 숫자·통계 = Sora, 일기 = Ownglyph.
  // 장식·펜 손글씨는 §8 "일기 외 손글씨 금지"에 따라 Pretendard 로 폴백한다.
  // ※ 실렌더 검토 결과 H 제목은 Gmarket 채택(v1.x). fontNumeric 과 동일 폴백 체인 사용.
  fontPageTitle: "'GmarketSansBold', 'GmarketSans', 'Pretendard', sans-serif",
  fontSection: "'GmarketSansBold', 'GmarketSans', 'Pretendard', sans-serif",
  fontBody: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontLabel: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontDiary: "'Ownglyph-Positive', 'Gaegu', 'Pretendard', sans-serif",
  fontDecorative: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif", // §8: 손글씨 금지 → Pretendard 폴백
  fontReading: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontBrand: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontQuote: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontDecoratePen: "'Pretendard', -apple-system, 'Segoe UI', Roboto, sans-serif", // §8: 손글씨 금지 → Pretendard 폴백
  fontStat: "'Sora', 'Pretendard', sans-serif",

  // 오늘 기록 카드 — 솔리드 카드 recipe와 동일(불투명 흰색 + 하이라인 + 소프트 그림자)
  recordCardBg: '#FFFFFF',
  recordCardBorder: '1px solid rgba(122,92,162,0.12)',
  recordCardShadow: '0 8px 20px rgba(120,90,160,0.12)',
  // 타임블록 기본색(태그 없는 블록) = 옅은 라일락 · now 라인 = 소프트 코랄
  blockDefaultBg: 'rgba(200,168,233,0.32)',
  blockDefaultBorder: 'rgba(150,120,200,0.45)',
  blockDefaultText: '#4A3E6B',
  nowLine: '#FF9A8B',

  // 솔리드 표면 recipe (본문 카드·행) — DESIGN v1.1
  solidCardBg: '#FFFFFF',
  solidCardBorder: '1px solid rgba(122,92,162,0.12)',
  solidCardShadow: '0 8px 20px rgba(120,90,160,0.12)',
  solidCardRadius: 20,
  solidRowBg: '#FFFFFF',
  // 항목 카드(할일·일정)는 배경과 확실히 구분되도록 더 진한 테두리 + 이중 그림자로 입체감 강화
  solidRowBorder: '1px solid rgba(122,92,162,0.20)',
  solidRowShadow: '0 2px 4px rgba(120,90,160,0.12), 0 10px 22px rgba(120,90,160,0.16)',
  solidRowRadius: 14,

  // 핵심(KEY) 행 — 옅은 코랄 배경 + 코랄 테두리 + 핑크 글로우 그림자(입체감 유지)
  keyRowBg: '#FFF5F2',
  keyRowBorder: '1px solid rgba(255,111,145,0.35)',
  keyRowShadow: '0 2px 4px rgba(120,90,160,0.10), 0 10px 24px rgba(255,111,145,0.22)',
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
  if (theme === 'H') return tokenH;
  return tokenD;
}

// 기본값은 웜(B) 유지. 파스텔(H)은 옵션으로만 추가.
// 확인용 스위치: localStorage 에 저장된 값이 있으면 그것을 우선 사용한다.
const THEME_STORE_KEY = 'haon.theme';
const VALID_THEMES: DesignTheme[] = ['A', 'B', 'C', 'D', 'H'];

// ⚠️ 임시(확인용): 파스텔-글래스(H) 육안 확인을 위해 기본값을 잠시 H로 둔다.
// 확인이 끝나면 이 값을 다시 'B'(웜)로 되돌린다. (localStorage 저장값이 있으면 그게 우선)
const DEFAULT_THEME: DesignTheme = 'H';

function readInitialTheme(): DesignTheme {
  try {
    const saved = localStorage.getItem(THEME_STORE_KEY) as DesignTheme | null;
    if (saved && VALID_THEMES.includes(saved)) return saved;
  } catch {
    /* SSR/프라이빗 모드 등에서 localStorage 접근 불가 시 무시 */
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<DesignTheme>(readInitialTheme);

  const setTheme = React.useCallback((next: DesignTheme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORE_KEY, next);
    } catch {
      /* 저장 실패는 무시 (테마 전환 자체는 동작) */
    }
  }, []);

  const t = resolveTokens(theme);
  const layoutMode = getLayoutMode(theme);

  // 확인용 콘솔 스위치: window.setHaonTheme('H') / ('B') 로 즉시 전환 + 저장.
  React.useEffect(() => {
    (window as any).setHaonTheme = (next: DesignTheme) => {
      if (!VALID_THEMES.includes(next)) {
        console.warn(`[Haon] 알 수 없는 테마: ${next}. 사용 가능: ${VALID_THEMES.join(', ')}`);
        return;
      }
      setTheme(next);
      console.log(`[Haon] 테마 → ${next}`);
    };
    return () => { delete (window as any).setHaonTheme; };
  }, [setTheme]);

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