import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '../ThemeContext';

/**
 * 경량 힌트 토스트 훅 — Top3(핵심) 별이 사용자 의도와 다르게 바뀔 때(캡 도달·미루기로 해제 등)
 * 그 사실을 알린다. "조용히 실패하는 경로" 를 없애기 위한 공통 알림 수단.
 *
 * 반드시 이벤트 핸들러(클릭·저장 등)에서만 호출한다 → 리듀서/렌더 밖이므로
 * React strict mode 이중 발화와 무관하고, 같은 문구를 두 번 보여줄 위험도 없다
 * (문자열 state 1개 + 단일 타이머라 재호출 시 갱신될 뿐 중복 표시되지 않음).
 */
export function useKeyHint(): { showKeyHint: (msg: string) => void; keyHintNode: ReactNode } {
  const { t } = useTheme();
  const [hint, setHint] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showKeyHint = useCallback((msg: string) => {
    setHint(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHint(null), 2600);
  }, []);

  const keyHintNode = hint ? (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full pointer-events-none"
      style={{
        bottom: 'calc(80px + env(safe-area-inset-bottom))',
        backgroundColor: t.text,
        color: t.card,
        fontSize: 12,
        fontWeight: 600,
        maxWidth: '90vw',
        textAlign: 'center',
        boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
      }}
    >
      {hint}
    </div>
  ) : null;

  return { showKeyHint, keyHintNode };
}
