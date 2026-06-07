// LP 꾸미기 스티커 — 후보 이모지 세트 (나중에 쉽게 교체할 수 있게 상수로 분리)
export const STICKER_EMOJIS = ['🌙', '⭐', '🌸', '🍒', '☁️', '💗', '🦋', '🌿', '✨', '🎀'] as const;

// LP 컨테이너 기준 좌표 범위(%) — 스티커가 밖으로 나가지 않게 제한
export const STICKER_MIN = 8;
export const STICKER_MAX = 92;

// 화면에서 다루는 스티커 (React key·드래그 식별용 id 포함)
export interface Sticker {
  id: string;
  emoji: string;
  x: number; // LP 컨테이너 기준 가로 % (0~100)
  y: number; // LP 컨테이너 기준 세로 % (0~100)
}

// DB(jsonb) 저장 형식 — [{emoji,x,y}, ...] (id 는 저장하지 않음)
export interface StoredSticker {
  emoji: string;
  x: number;
  y: number;
}

export function clampCoord(v: number): number {
  if (Number.isNaN(v)) return 50;
  return Math.min(STICKER_MAX, Math.max(STICKER_MIN, v));
}

let _seq = 0;
function newId(): string {
  _seq += 1;
  return `stk_${Date.now().toString(36)}_${_seq}`;
}

// DB 값(unknown[]) → 화면용 Sticker[] (유효한 항목만, id 부여)
export function normalizeStickers(raw: unknown): Sticker[] {
  if (!Array.isArray(raw)) return [];
  const out: Sticker[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (typeof s.emoji !== 'string') continue;
    const x = typeof s.x === 'number' ? s.x : Number(s.x);
    const y = typeof s.y === 'number' ? s.y : Number(s.y);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    out.push({ id: newId(), emoji: s.emoji, x: clampCoord(x), y: clampCoord(y) });
  }
  return out;
}

// 화면용 Sticker[] → DB 저장 형식 (id 제거, 좌표 소수 1자리 반올림)
export function serializeStickers(list: Sticker[]): StoredSticker[] {
  return list.map(s => ({
    emoji: s.emoji,
    x: Math.round(s.x * 10) / 10,
    y: Math.round(s.y * 10) / 10,
  }));
}

export function createSticker(emoji: string, x: number, y: number): Sticker {
  return { id: newId(), emoji, x: clampCoord(x), y: clampCoord(y) };
}
