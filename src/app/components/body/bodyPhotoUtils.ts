import type { BodyPhoto, WeightRecord, WeightSlot } from '../../store';

export interface WeightBadge { weight: number; slot: WeightSlot; }

// 뱃지 체중 해석 — 결정적 순서(비결정 선택 금지):
//   weight_record_id → 같은 date 의 아침 → 저녁 → 기타 → 없으면 null(체중·slot 뱃지 생략).
export function resolveWeightBadge(photo: BodyPhoto, weightRecords: WeightRecord[]): WeightBadge | null {
  if (photo.weightRecordId) {
    const r = weightRecords.find(w => w.id === photo.weightRecordId);
    if (r) return { weight: r.weight, slot: r.slot };
  }
  const order: WeightSlot[] = ['아침', '저녁', '기타'];
  for (const slot of order) {
    const r = weightRecords.find(w => w.date === photo.date && w.slot === slot);
    if (r) return { weight: r.weight, slot };
  }
  return null;
}
