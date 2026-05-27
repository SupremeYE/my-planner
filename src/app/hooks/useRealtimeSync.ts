import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Supabase Realtime 구독 훅
 * 지정한 테이블에 변경(INSERT/UPDATE/DELETE)이 생기면 onRefresh 콜백을 호출한다.
 * 컴포넌트 언마운트 시 자동으로 채널을 해제한다.
 */
export function useRealtimeSync(table: string, onRefresh: () => void) {
  // onRefresh가 렌더마다 새 참조로 교체되어도 구독은 한 번만 등록
  const refreshRef = useRef(onRefresh);
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}:${Math.random()}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => refreshRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);
}
