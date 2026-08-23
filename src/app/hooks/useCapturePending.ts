import { useCallback, useEffect, useState } from 'react';
import { captureInbox } from '../../lib/captureInbox';
import { useRealtimeSync } from './useRealtimeSync';

/**
 * 캡처 인박스 pending 건수 — 네비 배지용. capture_inbox Realtime 구독으로 즉시 갱신.
 * (미정리 할일 배지 countInboxActive 와는 별개 축 — 이건 서버가 분류해 쌓은 미승인 캡처 수.)
 */
export function useCapturePending(): number {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => { captureInbox.countPending().then(setCount); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('capture_inbox', refresh);
  return count;
}
