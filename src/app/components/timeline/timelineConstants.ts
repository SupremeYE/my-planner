// ─── Timeline shared constants & helpers ───
// DailyView 에서 추출한 타임테이블 전용 상수/순수 함수. 값·동작은 추출 전과 100% 동일.
// (Stage 1: 순수 리팩토링 — Timeline.tsx / 타임라인 모달들이 공유)

// ─── Time helpers ───
export const HOUR_HEIGHT = 60;
export const PX_PER_MIN = HOUR_HEIGHT / 60;
export const TIMELINE_LABEL_WIDTH = 48;
export const TIMELINE_CONTENT_LEFT = 56;
export const TIMELINE_LANE_GAP = 10;
export const PLAN_BAR_BORDER = '#515f74';
export const OVERTIME_BAR_BG = '#FAE8D6';
export const OVERTIME_BAR_BORDER = '#D4735A';
export const CURRENT_TIME_COLOR = '#D4735A';
export const LOG_OFFSET_STORAGE_KEY = 'daily-timeline-log-offsets';

// Log color presets
export const LOG_COLORS = [
  '#515f74', '#D4735A', '#006b62', '#7B9ED9',
  '#A07BE0', '#F4A261', '#059669', '#EF4444',
  '#EC4899', '#6B7280',
];

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getContrastTextColor(hex: string): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#ffffff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.66 ? '#26343d' : '#ffffff';
}
