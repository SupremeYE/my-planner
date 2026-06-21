// ⚠️ TEMP — safe-area-inset-top 실측용 디버그 배지. 검증 후 제거 예정 (Stage 1)
// env(safe-area-inset-top) 의 실제 계산값(px)을 화면 우상단에 노출한다.
// 노치 기기 iOS PWA standalone 에서 0 이 아닌 값(약 47~59px)이 나와야 정상.
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../ThemeContext';

export function SafeAreaProbe() {
  const { t } = useTheme();
  const probeRef = useRef<HTMLDivElement>(null);
  const [insetTop, setInsetTop] = useState('?');

  useEffect(() => {
    const measure = () => {
      if (!probeRef.current) return;
      // 프로브의 paddingTop = env(safe-area-inset-top) → 브라우저가 계산한 px 로 읽힘
      setInsetTop(getComputedStyle(probeRef.current).paddingTop);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return (
    <>
      {/* 측정용 보이지 않는 프로브 (paddingTop 으로 inset 값을 흡수) */}
      <div
        ref={probeRef}
        aria-hidden
        style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, paddingTop: 'env(safe-area-inset-top)', pointerEvents: 'none', visibility: 'hidden' }}
      />
      {/* 우상단 디버그 배지 — 풀스크린 산책 화면 위에도 보이도록 최상위 z-index */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top) + 4px)',
          right: 4,
          zIndex: 99999,
          padding: '3px 7px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.2,
          color: t.card,
          backgroundColor: t.accent,
          boxShadow: `0 2px 8px ${t.border}`,
          pointerEvents: 'none',
        }}
      >
        inset-top: {insetTop}
      </div>
    </>
  );
}
