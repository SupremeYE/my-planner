/**
 * 빠른 기록 홈 — '지금 추천' 히어로 승격 로직 (UI·React 무관 순수 모듈).
 *
 * 시간대 윈도우가 겹칠 때(21~23시 diary vs sleep_in) `find` 첫 매칭이 이기므로
 * PROMOTE_ORDER 의 **배열 순서가 곧 우선순위**다. diary 가 sleep_in 보다 앞에 와야
 * 저녁(20~23시)엔 일기, 새벽(0~4·21시 이후)엔 취침이 뜬다.
 *
 * 이 프로젝트엔 테스트 러너가 없어(package.json) 순수 모듈로 분리해
 * node:test 로 보호한다. QuickCaptureHome 은 promotedIdAt() 결과로 레지스트리를 조회한다.
 */

export type PromoteEntry = { id: string; promote: [number, number] };

// ⚠️ 순서 = 우선순위. diary 가 sleep_in 보다 앞.
export const PROMOTE_ORDER: PromoteEntry[] = [
  { id: 'diary',    promote: [20, 23] }, // 저녁 회고
  { id: 'wake_up',  promote: [5, 9] },   // 아침 기상
  { id: 'sleep_in', promote: [21, 4] },  // 밤 취침 (자정 가로지름)
];

/** 시각 h(0~23)가 윈도우 [a,b]에 드는지. a>b 면 자정을 가로지르는 것으로 본다. */
export const inWindow = (h: number, w: [number, number]): boolean => {
  const [a, b] = w;
  return a <= b ? h >= a && h <= b : h >= a || h <= b;
};

/** 해당 시각에 승격될 히어로 id. 없으면 null(히어로 영역 미렌더). */
export const promotedIdAt = (hour: number): string | null =>
  PROMOTE_ORDER.find((e) => inWindow(hour, e.promote))?.id ?? null;
