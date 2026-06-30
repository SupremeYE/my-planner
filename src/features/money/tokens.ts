// 하온 머니 — 전용 로컬 토큰 모듈
//  · 차트 카테고리 색은 "테마와 무관한 의미론적 상수"(식비=코랄 고정) — 테마가 바뀌어도 카테고리 식별 유지.
//  · 배경/카드/텍스트 등은 ThemeContext 토큰(t.bg/t.card/t.text…)을 그대로 사용한다.
//  · 매핑 불가한 핵심 색(골드/잉크 등 목업 팔레트)만 여기서 상수로 보강한다. (하드코딩 금지 — 전부 이 상수 경유)

// 목업 하온 머니 팔레트 — 테마 토큰으로 매핑이 어려운 골드/잉크를 보강.
export const MONEY_PALETTE = {
  gold: '#C4A882',   // 무지출·생필품·예산
  ink: '#3A352E',    // 텍스트·선택 상태
  coral: '#D4735A',  // 지출·식비·경고
  green: '#6BAA7A',  // 수입·저축·달성
  bg: '#F5F0E8',
  card: '#FDFAF4',
  mute: '#A09889',
} as const;

// 카테고리명 → 차트 색(지출 11 + 수입 4). 프리셋 식별용 고정값. 15색 전부 고유(스택 구분 보장).
export const CATEGORY_COLORS: Record<string, string> = {
  // 지출 11 — 구독(라벤더)·주거(테라코타)로 문화/쇼핑과 분리
  식비: '#D4735A', 생필품: '#C4A882', 교통: '#6BAA7A', 카페: '#7A7265',
  쇼핑: '#E8A84C', 문화: '#8B7EC8', 건강: '#5B9BD5', 통신: '#B8AD9E',
  구독: '#A88BC8', 보험: '#7BA8B8', 주거: '#C8956B',
  // 수입 4 — 지출색과 겹치지 않는 고유값
  급여: '#4E9E6A', 부수입: '#7FB8A0', '용돈/선물': '#E091A8', 투자수익: '#4FA3C7',
};

// 커스텀 카테고리(색 미지정) 순환 배정용 팔레트.
export const CUSTOM_PALETTE = [
  '#D4735A', '#C4A882', '#6BAA7A', '#7A7265', '#E8A84C',
  '#8B7EC8', '#5B9BD5', '#7BA8B8', '#E091A8', '#82B8C4',
];

export const DEFAULT_CATEGORY_COLOR = '#B8AD9E';

// 투자 종목 구분 메타(라벨/수량 단위/식별색) — CATEGORY_COLORS 와 동일 철학의 의미론적 상수.
export const INVEST_KIND_META: Record<'stock' | 'fund' | 'coin', { label: string; unit: string; color: string }> = {
  stock: { label: '주식', unit: '주', color: '#5B9BD5' },
  fund: { label: '펀드', unit: '구좌', color: '#8B7EC8' },
  coin: { label: '코인', unit: '개', color: '#E8A84C' },
};

// 자산 종류(그룹) 메타 — 자산 구성 도넛/그룹 합계의 라벨·식별색(의미론적 상수). 표시 순서대로.
export const ASSET_GROUP_ORDER = ['bank', 'deposit', 'savings', 'investment', 'cash'] as const;
export const ASSET_GROUP_META: Record<(typeof ASSET_GROUP_ORDER)[number], { label: string; color: string }> = {
  bank:       { label: '입출금', color: MONEY_PALETTE.green },   // 급여·생활비 통장
  deposit:    { label: '예금',   color: MONEY_PALETTE.gold },
  savings:    { label: '적금',   color: '#E8A84C' },
  investment: { label: '투자',   color: '#5B9BD5' },
  cash:       { label: '현금',   color: MONEY_PALETTE.mute },
};

// 카테고리 색 해석 우선순위: 명시 color > 이름 매핑 > 기본
export function resolveCategoryColor(cat?: { name?: string | null; color?: string | null } | null): string {
  if (cat?.color) return cat.color;
  if (cat?.name && CATEGORY_COLORS[cat.name]) return CATEGORY_COLORS[cat.name];
  return DEFAULT_CATEGORY_COLOR;
}

// 인덱스 기반 커스텀 색(이름/색 모두 없을 때).
export function paletteColor(index: number): string {
  return CUSTOM_PALETTE[index % CUSTOM_PALETTE.length];
}

// 대분류 색을 흰색 쪽으로 ratio(0~1)만큼 밝힌 변형 — 소분류 드릴다운 "같은 계열" 표현용.
//  · 하드코딩 hex 가 아니라 대분류 색에서 파생. ratio=0 이면 원색, 1 이면 흰색.
export function shadeColor(hex: string, ratio: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * Math.min(1, Math.max(0, ratio)));
  const to2 = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

// 소분류 인덱스(0..count-1)별 명도 변형 색 — 부모색에서 단계적으로 밝게(최대 ~0.55).
export function subcategoryShade(parentColor: string, index: number, count: number): string {
  if (count <= 1) return parentColor;
  const ratio = (index / (count - 1)) * 0.55;
  return shadeColor(parentColor, ratio);
}

// 이모지가 없을 때 카테고리 칩/리스트의 fallback — 이름 첫 글자.
export function categoryInitial(name?: string | null): string {
  return (name ?? '').trim().charAt(0) || '?';
}

// ── 금액 포맷 ──
// 전체 표기: 1,234,000원
export function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

// 축약 표기: 250만 / 1.2만 / 8천 (요약 칩·캘린더용)
export function formatManShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(abs % 100000000 === 0 ? 0 : 1)}억`;
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(abs % 10000 === 0 ? 0 : 1)}만`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}천`;
  return `${sign}${abs}`;
}
