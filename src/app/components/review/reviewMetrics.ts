// 리뷰(주간·월간) 공용 지표 헬퍼.

/**
 * 기간 내 몸무게 변화 — DESIGN §7.4 "동일 slot 비교"(폴백≠비교) 준수.
 * 기준 slot = 아침 > 저녁 > 기타 중 그 기간에 존재하는 첫 slot. 그 slot 의 첫↔마지막 기록 차이.
 * 비교 가능한 기록이 2건 미만이면 null(값을 만들지 않음).
 */
export function computeWeightDelta(
  weights: { date: string; slot: string; weight: number }[],
  startStr: string,
  endStr: string,
): { delta: number; slot: string } | null {
  const inRange = weights.filter(w => w.date >= startStr && w.date <= endStr);
  if (!inRange.length) return null;
  const slotOrder = ['아침', '저녁', '기타'];
  const baseSlot = slotOrder.find(s => inRange.some(w => w.slot === s));
  if (!baseSlot) return null;
  const sameSlot = inRange.filter(w => w.slot === baseSlot).sort((a, b) => a.date.localeCompare(b.date));
  if (sameSlot.length < 2) return null;
  const delta = Math.round((sameSlot[sameSlot.length - 1].weight - sameSlot[0].weight) * 10) / 10;
  return { delta, slot: baseSlot };
}
