// 가고싶은 곳 — 보관함 UI 공유 헬퍼 (Stage 2)
// 색은 전부 디자인 토큰(t.*)에서만 뽑는다. 폴더 color 는 토큰 "키 문자열"(gold/coral/green)을
// 저장하므로(Stage 1 규약), 여기서 키 → 현재 테마 토큰 hex 로 변환한다.
import type { ThemeTokens } from '../../ThemeContext';
import { CONCEPT_BY_KEY } from '../../../constants/places';

// 토큰 hex → rgba (다른 뷰들과 동일 패턴 — 새 hex 추가 없이 틴트만 생성)
export function withAlpha(hex: string, alpha: number): string {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 폴더 색 토큰 키 → 역할. (PROJECT_SPEC 매핑: 골드=accent / 코랄=danger / 그린=success)
export type ColorKey = 'gold' | 'coral' | 'green';
export const COLOR_KEYS: ColorKey[] = ['gold', 'coral', 'green'];
export const COLOR_KEY_LABEL: Record<ColorKey, string> = { gold: '골드', coral: '코랄', green: '그린' };

// 색 키 → 현재 테마의 실제 hex. 미지정/미상이면 accent.
export function colorFromKey(key: string | null | undefined, t: ThemeTokens): string {
  switch (key) {
    case 'coral': return t.danger;
    case 'green': return t.success;
    case 'gold':  return t.accent;
    default:      return t.accent;
  }
}

// 카테고리 텍스트 → 폴백 이모지. (thumbnail_url 없을 때 썸네일 대용)
const CATEGORY_EMOJI: { test: RegExp; emo: string }[] = [
  { test: /카페|커피|coffee|cafe/i, emo: '☕' },
  { test: /베이글|빵|베이커리|디저트/i, emo: '🥐' },
  { test: /냉면|국수|면|라멘|우동/i, emo: '🍜' },
  { test: /맛집|밥|식당|한식|분식/i, emo: '🍚' },
  { test: /바|와인|위스키|칵테일|lp|펍/i, emo: '🍷' },
  { test: /책|서점|책방|도서/i, emo: '📖' },
  { test: /전시|미술|갤러리|박물관/i, emo: '🖼️' },
  { test: /공원|산|바다|해변|자연/i, emo: '🌿' },
  { test: /브런치|샐러드/i, emo: '🍳' },
  { test: /소품|편집|상점|가게/i, emo: '🛍️' },
];

// 장소 표시용 이모지: concept 우선 → 카테고리 매칭 → 기본 핀.
export function placeEmoji(opts: { concept?: string | null; category?: string | null }): string {
  if (opts.concept && CONCEPT_BY_KEY[opts.concept as keyof typeof CONCEPT_BY_KEY]) {
    return CONCEPT_BY_KEY[opts.concept as keyof typeof CONCEPT_BY_KEY].icon;
  }
  if (opts.category) {
    const hit = CATEGORY_EMOJI.find(c => c.test.test(opts.category!));
    if (hit) return hit.emo;
  }
  return '📍';
}

// 출처 표시 라벨 (배지용). 자유 텍스트라 알려진 값만 매핑, 나머지는 그대로.
export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  const s = source.trim();
  if (/insta/i.test(s)) return 'instagram';
  if (/you ?tube|유튜브/i.test(s)) return 'youtube';
  if (/thread|스레드/i.test(s)) return 'threads';
  return s;
}

// 장소 추가 폼 출처 선택지 (자유 입력도 허용하되 빠른 선택용)
export const SOURCE_OPTIONS = ['instagram', 'youtube', '직접 등록'];
