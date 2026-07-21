import { type ThemeTokens } from '../ThemeContext';
import { type SeedKind } from '../../lib/db';
import { mixHex } from './haonStyles';

// ─── 번쩍노트 '언젠가' — 결(seed-kind) 색 단일 소스 (DESIGN.md §3 '결 색') ───
// 결은 §3 카테고리와 다른 '새 축'. 카테고리 토큰을 재사용하지 않고 자체 named 세트로 둔다.
// 여기(SEED_KIND_COLORS)에서만 결 색을 읽는다 — 카테고리 색이 컴포넌트별로 흩어진 전철을
// 밟지 않도록 하드코딩 hex 를 컴포넌트에 흩뿌리지 않는다.
//
// build dot #6E74E0 ≠ 카테고리 일정 #7B82E3 (드리프트 방지 위해 별도 스와치, DESIGN.md §3).
// none(미분류)은 고정 hex 를 만들지 않고 textMuted 계열로 뉴트럴하게 파생한다.

export type SeedKindColor = { dot: string; fill: string; text: string };

const FIXED: Record<Exclude<SeedKind, 'none'>, SeedKindColor> = {
  do:    { dot: '#D98AC9', fill: '#F7E6F4', text: '#A24E93' }, // 해보고 싶은 (오키드)
  be:    { dot: '#A87BD9', fill: '#EEE3FA', text: '#6E4AA0' }, // 되고 싶은 (라일락)
  build: { dot: '#6E74E0', fill: '#E2E5FB', text: '#4A56A0' }, // 만들고 싶은 (페리윙클-인디고)
};

/** 결 → {dot(3px accent), fill(칩 배경), text(어두운 시블링)}. none 은 토큰 파생. */
export function seedKindColor(t: ThemeTokens, kind: SeedKind): SeedKindColor {
  if (kind === 'none') {
    return { dot: t.textMuted, fill: mixHex(t.textMuted, 255, 0.82), text: t.textSub };
  }
  return FIXED[kind];
}

/** 결 전체 라벨(미분류 포함) — 결 칩/태그용. */
export const SEED_KIND_LABELS: Record<SeedKind, string> = {
  none: '미분류',
  do: '해보고 싶은',
  be: '되고 싶은',
  build: '만들고 싶은',
};

/** 결 칩 팝오버 선택 순서(기본 미분류 먼저). */
export const SEED_KIND_ORDER: SeedKind[] = ['none', 'do', 'be', 'build'];

/** 결 필터 값(미분류는 필터에 노출하지 않음 — '전체'에서만 보인다, DESIGN.md §5). */
export type SeedKindFilter = 'all' | 'do' | 'be' | 'build';
export const SEED_FILTER_ORDER: SeedKindFilter[] = ['all', 'do', 'be', 'build'];
export const SEED_FILTER_LABELS: Record<SeedKindFilter, string> = {
  all: '전체',
  do: '해보고 싶은',
  be: '되고 싶은',
  build: '만들고 싶은',
};
