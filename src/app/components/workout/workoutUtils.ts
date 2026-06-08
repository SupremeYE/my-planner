// 운동 탭 공용 유틸 — 날짜/요일/부위 메타. 색상값 하드코딩 없음(컴포넌트에서 토큰 사용).
import type { ExerciseBodyPart, WorkoutLog, WorkoutSet } from '../../../lib/db';

// ── 날짜 ──────────────────────────────────────────────────────────────────────
export const pad2 = (n: number) => String(n).padStart(2, '0');

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 두 yyyy-MM-dd 사이 일수 (a - b, 양수면 a가 더 미래)
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

// 오늘 기준 "N일 전" 라벨
export function agoLabel(dateISO: string): string {
  const n = daysBetween(todayISO(), dateISO);
  if (n <= 0) return '오늘';
  if (n === 1) return '어제';
  return `${n}일 전`;
}

export function isoToShortLabel(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00');
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

// ── 요일 (1=월 … 7=일) ────────────────────────────────────────────────────────
export const WEEKDAYS: { dow: number; label: string }[] = [
  { dow: 1, label: '월' }, { dow: 2, label: '화' }, { dow: 3, label: '수' },
  { dow: 4, label: '목' }, { dow: 5, label: '금' }, { dow: 6, label: '토' }, { dow: 7, label: '일' },
];

// JS getDay (0=일..6=토) → 1=월..7=일
export function todayDow(): number {
  const js = new Date().getDay();
  return ((js + 6) % 7) + 1;
}

// ── 부위 ──────────────────────────────────────────────────────────────────────
export const BODY_PARTS: ExerciseBodyPart[] = ['하체', '등', '가슴', '어깨', '팔', '코어', '전신', '유산소', '기타'];
// 근력 추천/표시에서 다루는 주요 부위(유산소·기타 제외)
export const MAIN_BODY_PARTS: ExerciseBodyPart[] = ['하체', '등', '가슴', '어깨', '팔', '코어'];

export const BODY_PART_EMOJI: Record<ExerciseBodyPart, string> = {
  하체: '🦵', 등: '🔙', 가슴: '🫀', 어깨: '🤸', 팔: '💪', 코어: '🧱',
  전신: '🧍', 유산소: '🏃', 기타: '🏋️',
};

// ── 세트 요약 ──────────────────────────────────────────────────────────────────
// 근력 총 볼륨(Σ weight×reps). 값 없으면 0.
export function totalVolume(sets: WorkoutSet[]): number {
  return sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
}

// 세트 한 줄 요약: 근력 "60kg×10 · 60kg×8" / 유산소 "30분 · 5km"
export function summarizeSets(type: '근력' | '유산소', sets: WorkoutSet[]): string {
  if (!sets.length) return '기록 없음';
  if (type === '유산소') {
    return sets.map(s => {
      const parts: string[] = [];
      if (s.durationMin != null) parts.push(`${s.durationMin}분`);
      if (s.distanceKm != null) parts.push(`${s.distanceKm}km`);
      return parts.join(' · ') || '-';
    }).join(' / ');
  }
  return sets.map(s => {
    const w = s.weight != null ? `${s.weight}kg` : '';
    const r = s.reps != null ? `${s.reps}회` : '';
    return [w, r].filter(Boolean).join('×') || '-';
  }).join(' · ');
}

// ── 스트릭(연속 운동 일수) ──────────────────────────────────────────────────────
// 운동한 날짜 집합으로 오늘(또는 어제)부터 거꾸로 연속 일수 계산.
export function calcStreak(performedDates: string[]): number {
  const set = new Set(performedDates);
  if (set.size === 0) return 0;
  const today = todayISO();
  const yesterday = isoNDaysAgo(1);
  // 오늘 안 했어도 어제까지 연속이면 streak 유지
  let cursor = set.has(today) ? today : (set.has(yesterday) ? yesterday : null);
  if (!cursor) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = isoMinusOne(cursor);
  }
  return streak;
}

function isoMinusOne(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 부위별 마지막 운동일 맵 (logs → { 부위: 최신 yyyy-MM-dd })
export function lastTrainedByBodyPart(logs: WorkoutLog[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const log of logs) {
    const bp = log.exercise?.bodyPart;
    if (!bp) continue;
    if (!map[bp] || log.performedOn > map[bp]) map[bp] = log.performedOn;
  }
  return map;
}
