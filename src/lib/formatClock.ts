/**
 * 스톱워치/타이머의 경과·잔여 시간을 "시계" 문자열로 포맷하는 단일 헬퍼.
 *
 * 1시간 미만 → `MM:SS` (예: `05:03`)
 * 1시간 이상 → `H:MM:SS` (예: `1:42:12`) — 시 단위를 분리해 `102:12` 같은 판독 불가 표기를 막는다.
 *
 * 이전엔 GlobalFloatingTimer / FocusModal / RoutinesView / TimerProvider 가 각자 MM:SS
 * 포맷 함수를 따로 갖고 있었고, 그중 일부는 분을 그대로 누적해 1시간을 넘기면 `102:12` 로 깨졌다.
 * 이 함수로 통일한다.
 *
 * (음수는 절대값으로 처리 — 초과/잔여를 부호와 함께 쓰는 소비처는 부호를 바깥에서 붙인다.)
 */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(Math.abs(totalSec)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
