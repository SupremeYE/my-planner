import { useState } from 'react';
import { MoaTodoEditor } from '../app/components/moamoa/MoaTodoEditor';
import { usePlanner } from '../app/store';
import { useMoaToday } from '../app/components/moamoa/moaShared';

export function useReviewQuick() {
  const { dayEndHour } = usePlanner();
  const today = useMoaToday(dayEndHour);
  const [id, setId] = useState<string | null>(null);
  return { id, today, open: () => setId(crypto.randomUUID()), close: () => setId(null) };
}
export function ReviewQuickSheet(quick: ReturnType<typeof useReviewQuick>) {
  if (!quick.id) return null;
  // Reuse confirmed writes and existing input sheets, never create another sample store.
  return <MoaTodoEditor key={quick.id} id={quick.id} defaultDate={quick.today} onClose={quick.close} onSaved={quick.close} />;
}
