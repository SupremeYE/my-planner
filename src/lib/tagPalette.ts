/**
 * 태그 색상 팔레트 공통 모듈.
 *
 * TodoModal 의 태그 생성 UI(13색 팔레트 + localStorage 저장)와 동일한 상수를
 * 단일 소스로 공유한다. 통합 빠른 입력(QuickAddInput)에서 새 태그를 만들 때도
 * 같은 팔레트·localStorage 키를 재사용해 색이 일관되게 유지된다.
 */
export const DEFAULT_TAG_COLORS = [
  '#E0795B', '#D4735A', '#E8A87C', '#F4A261',
  '#4A82CC', '#3B82F6', '#45B899', '#34D399',
  '#006b62', '#8B7CF8', '#22C55E', '#515f74', '#475569',
];

export const TAG_PALETTE_KEY = 'tagPaletteColors';
export const MAX_TAG_COLORS = 13;

const isValidHex = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);
const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  return (trimmed.startsWith('#') ? trimmed : `#${trimmed}`).toUpperCase();
};

/** localStorage 에 저장된 팔레트를 읽는다. 없거나 깨졌으면 기본 팔레트로 폴백. */
export function loadPaletteColors(): string[] {
  try {
    const raw = localStorage.getItem(TAG_PALETTE_KEY);
    if (!raw) return DEFAULT_TAG_COLORS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TAG_COLORS;
    const filtered = parsed
      .map((v: string) => normalizeHex(v))
      .filter((v: string) => isValidHex(v))
      .slice(0, MAX_TAG_COLORS);
    return filtered.length > 0 ? filtered : DEFAULT_TAG_COLORS;
  } catch {
    return DEFAULT_TAG_COLORS;
  }
}

/**
 * 새 태그에 부여할 색을 고른다.
 * 팔레트에서 아직 안 쓰인 색을 우선, 모두 쓰였으면 사용 개수 기준으로 순환한다.
 */
export function pickNewTagColor(usedColors: string[]): string {
  const palette = loadPaletteColors();
  const used = new Set(usedColors.map(c => normalizeHex(c)));
  const unused = palette.find(c => !used.has(normalizeHex(c)));
  if (unused) return unused;
  return palette[usedColors.length % palette.length] ?? DEFAULT_TAG_COLORS[0];
}
