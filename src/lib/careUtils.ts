// 뷰티 케어 · 살림 공용 파생 계산 (Stage 2) — 순수 함수, UI 의존 0.
// 날짜 정렬/경과일은 HabitsView 의 getStreak 와 같은 date-fns 기반으로 일관 처리.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { BeautySpecialCare, HouseholdItem } from '../app/store';

export type CareStatus = 'fresh' | 'soon' | 'over';

/**
 * 날짜 배열에서 "가장 최근 날짜로부터 오늘까지" 경과일.
 * 비어 있으면 null(= 한 번도 안 함).
 * getStreak 와 동일하게 'yyyy-MM-dd' 문자열을 정렬해 최댓값을 취한다.
 */
export function daysSince(dates: string[]): number | null {
  if (!dates?.length) return null;
  const latest = [...dates].sort().reverse()[0];
  return differenceInCalendarDays(new Date(), parseISO(latest));
}

/**
 * 경과일 + 권장주기 → 신선도 상태 (목업 기준).
 *   fresh: 경과 <= cycle*0.6,  soon: <= cycle,  over: > cycle
 * 주기(cycleDays)가 없거나 0 이하면 판정 불가 → 'fresh' (재촉하지 않음).
 * 아직 한 번도 안 했으면(ds=null) 'over' (= 해야 할 일).
 */
export function careStatus(ds: number | null, cycleDays?: number | null): CareStatus {
  if (!cycleDays || cycleDays <= 0) return 'fresh';
  if (ds == null) return 'over';
  if (ds <= cycleDays * 0.6) return 'fresh';
  if (ds <= cycleDays) return 'soon';
  return 'over';
}

/** "곧 떨어져요": 임계 이하지만 아직 남아 있음 (소진은 별도). */
export function isLowStock(item: Pick<HouseholdItem, 'quantity' | 'thresholdQty'>): boolean {
  return item.quantity > 0 && item.quantity <= item.thresholdQty;
}

/** 소진: 수량 0 이하. */
export function isDepleted(item: Pick<HouseholdItem, 'quantity'>): boolean {
  return item.quantity <= 0;
}

/**
 * 셀프케어 하트% 게이지 (0~100).
 *
 * 공식: 등록된 스페셜케어 중 status !== 'over' 인 비율 * 100.
 *   - 근거: 케어마다 cycle_days(권장주기)가 다르므로, "권장주기를 넘기지 않은
 *     케어의 비율"로 보면 주기가 짧은 케어(주 1회)와 긴 케어(월 1회)를 공정하게
 *     한 게이지에 합칠 수 있다. 특정 기간 창(최근 N일)에 의존하지 않아,
 *     주기가 긴 케어가 부당하게 불리해지지 않는다.
 *   - careStatus 와 동일 규칙: 주기 없는 케어는 절대 over 아님(항상 분자 포함),
 *     한 번도 안 한 케어는 over(분자 제외).
 *   - 등록된 케어가 없으면 0 (할 셀프케어 자체가 없음 = 채울 하트 없음).
 *   - 게이지(이 점수)와 "최근 7일 카운트/스파크"는 별개 레이어다. 7일 카운트는
 *     훅에서 롤링 7일로 따로 계산하며, 이 함수는 주기 기반 게이지만 책임진다.
 */
export function selfCareScore(specialCares: BeautySpecialCare[]): number {
  if (!specialCares?.length) return 0;
  const onTrack = specialCares.filter(
    c => careStatus(daysSince(c.doneDates), c.cycleDays) !== 'over',
  ).length;
  return Math.round((onTrack / specialCares.length) * 100);
}
