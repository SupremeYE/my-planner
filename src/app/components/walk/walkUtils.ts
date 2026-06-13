// 산책 거리/페이스 계산 공용 유틸 — 외부 API 호출 없음. 좌표 배열만으로 로컬 계산한다.
// (가고싶은 곳 drawUtils 의 하버사인과 같은 공식 — 여기선 "미터" 단위 + 경로 누적용)
import type { WalkPoint } from '../../../lib/db';

// ── 두 좌표 사이 하버사인 거리(미터) ──────────────────────────────────────────
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000; // 지구 반지름(m)
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── 경로 전체 누적 거리(미터) — 연속한 좌표 사이 거리를 모두 더한다 ───────────────
export function totalDistanceM(path: WalkPoint[]): number {
  if (!path || path.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    sum += haversineMeters(path[i - 1], path[i]);
  }
  return Math.round(sum);
}

// ── 평균 페이스(초/km) — 거리 0 이면 null(나눗셈 방지) ───────────────────────────
export function avgPaceSecPerKm(distanceM: number, durationS: number): number | null {
  if (distanceM <= 0 || durationS <= 0) return null;
  return Math.round(durationS / (distanceM / 1000));
}

// ── 표시용 포매터 ─────────────────────────────────────────────────────────────
// 거리: 1km 미만은 "320m", 이상은 "1.24km"
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(2)}km`;
}

// 시간: 초 → "M:SS" 또는 "H:MM:SS"
export function formatDuration(durationS: number): string {
  const s = Math.max(0, Math.floor(durationS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// 페이스: 초/km → "6'30\"/km" (null 이면 "—")
export function formatPace(paceSecPerKm: number | null): string {
  if (paceSecPerKm == null || !isFinite(paceSecPerKm)) return '—';
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}'${String(s).padStart(2, '0')}"/km`;
}

// ── "내 코스 다시"용 — 목표 경로 위 진행도 ──────────────────────────────────────
// 현재 위치에서 가장 가까운 목표 경로 점을 찾아, 그 지점까지의 경로 누적거리로 진행도를 낸다.
// (정밀 맵매칭이 아니라 가벼운 근사 — 따라 걷기 안내용으로 충분)
export function routeProgress(
  target: WalkPoint[],
  current: { lat: number; lng: number } | null,
): { pct: number; remainingM: number; totalM: number; nearestIdx: number } {
  const totalM = totalDistanceM(target);
  if (!current || target.length < 2 || totalM <= 0) {
    return { pct: 0, remainingM: totalM, totalM, nearestIdx: 0 };
  }
  // 가장 가까운 목표 점 인덱스
  let nearestIdx = 0;
  let best = Infinity;
  for (let i = 0; i < target.length; i++) {
    const d = haversineMeters(current, target[i]);
    if (d < best) { best = d; nearestIdx = i; }
  }
  // 시작~nearestIdx 누적거리
  let covered = 0;
  for (let i = 1; i <= nearestIdx; i++) covered += haversineMeters(target[i - 1], target[i]);
  const pct = Math.max(0, Math.min(100, (covered / totalM) * 100));
  return { pct, remainingM: Math.max(0, totalM - covered), totalM, nearestIdx };
}

// 세션 한 건에서 거리·페이스를 한 번에 계산(저장 직전 호출용).
export function computeWalkStats(path: WalkPoint[], durationS: number): {
  distanceM: number;
  avgPaceSPerKm: number | null;
} {
  const distanceM = totalDistanceM(path);
  return { distanceM, avgPaceSPerKm: avgPaceSecPerKm(distanceM, durationS) };
}
