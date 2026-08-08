import { type ThemeTokens } from '../ThemeContext';
import { mixHex } from './haonStyles';

// ─── 만다라트 셀 색 팔레트 단일 소스 (DESIGN.md §5 「목표 페이지 — 만다라트」) ───
// 서브목표(중앙 블록 세부)마다 색을 지정 → 좌측 3px 액센트 바 + 외곽 미러 셀 채움에 반영.
// DB 에는 팔레트 '키'만 저장(hex 아님, 마이그레이션 20260808010000). 여기(MANDALART_COLORS)에서만
// 색을 읽는다 — 카테고리 색이 컴포넌트별로 흩어진 전철을 밟지 않도록 하드코딩 hex 를 흩뿌리지 않는다.
//
// 6색: lilac / blue / sage / magenta / purple / teal.
// ⚠️ 코랄 제외 — 코랄(t.accent)은 선택 상태·중심 코어목표 전용(§3). 목표 색으로 쓰면 의미가 흐려진다.
// 각 색은 채도 있는 'bar'(3px 좌측 액센트·미러 셀 앵커) 하나만 고정 hex 로 두고,
// 옅은 fill·중간 mid 톤은 mixHex 로 파생한다(손수 지정 hex 최소화 — seedKind.ts 와 동일 정신).

export type MandalartColorKey = 'lilac' | 'blue' | 'sage' | 'magenta' | 'purple' | 'teal';

export const MANDALART_COLOR_ORDER: MandalartColorKey[] = [
  'lilac', 'blue', 'sage', 'magenta', 'purple', 'teal',
];

export const MANDALART_COLOR_LABELS: Record<MandalartColorKey, string> = {
  lilac: '라일락',
  blue: '블루',
  sage: '세이지',
  magenta: '마젠타',
  purple: '퍼플',
  teal: '틸',
};

// 채도 있는 bar hex(좌측 3px 액센트). lilac↔purple 은 같은 보라 계열이라 톤을 뚜렷이 벌렸다.
const BAR: Record<MandalartColorKey, string> = {
  lilac:   '#A87BD9', // 밝은 라일락 (seedKind 'be' 와 동일 톤)
  blue:    '#6E8BE8', // 페리윙클 블루
  sage:    '#6BAA7A', // 세이지 (앱 공통 웜 그린)
  magenta: '#C765A8', // 마젠타-핑크
  purple:  '#7A52C7', // 진한 퍼플 (lilac 보다 어둡고 채도 높음)
  teal:    '#39A9A0', // 틸-청록
};

export type MandalartColorSet = {
  /** 채워진 서브목표의 좌측 3px 액센트 바 · 미러 셀 앵커의 원색 */
  bar: string;
  /** 옅은 tint (필요 시 배경) */
  fill: string;
  /** 외곽 미러 셀 채움용 중간 톤 (읽히는 정도) */
  mid: string;
};

/**
 * 팔레트 키 → 색 세트. NULL(미지정)은 중립 토큰으로 파생 — 색 지정된 셀만 도드라지게.
 * (bar=textMuted, fill/mid=surfaceMuted → 무채색 기본, 컬러 셀이 배경에서 떠오른다.)
 */
export function mandalartColor(t: ThemeTokens, key: string | null | undefined): MandalartColorSet {
  if (!key || !(key in BAR)) {
    return { bar: t.textMuted, fill: t.surfaceMuted, mid: t.surfaceMuted };
  }
  const bar = BAR[key as MandalartColorKey];
  return {
    bar,
    fill: mixHex(bar, 255, 0.86), // 아주 옅은 tint
    mid: mixHex(bar, 255, 0.66),  // 미러 셀 채움 (딥 인디고 텍스트와 대비 확보)
  };
}
