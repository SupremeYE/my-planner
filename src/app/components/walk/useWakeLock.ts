// 화면 꺼짐 방지(Wake Lock) 훅 — 산책 추적 중 화면이 자동으로 꺼지지 않게.
// 미지원 기기/브라우저에서는 조용히 폴백(에러 없이 no-op). visibilitychange 시 재요청.
import { useCallback, useEffect, useRef } from 'react';

export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<any>(null);

  const request = useCallback(async () => {
    try {
      const nav = navigator as any;
      if (!nav.wakeLock?.request) return; // 미지원 → 폴백
      if (sentinelRef.current) return;     // 이미 보유
      const sentinel = await nav.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      sentinel.addEventListener?.('release', () => { sentinelRef.current = null; });
    } catch {
      // 권한/정책으로 거부될 수 있음 — 화면 유지는 best-effort 라 무시
      sentinelRef.current = null;
    }
  }, []);

  const release = useCallback(async () => {
    try { await sentinelRef.current?.release?.(); } catch { /* noop */ }
    sentinelRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) { release(); return; }
    request();
    // 화면 복귀(탭 전환 후 등) 시 락이 풀려 있으면 재요청
    const onVis = () => { if (document.visibilityState === 'visible' && active) request(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      release();
    };
  }, [active, request, release]);
}
