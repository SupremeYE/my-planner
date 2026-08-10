import { useState, useEffect, useLayoutEffect } from 'react';
import type { RefObject } from 'react';

/**
 * 팝오버(컨텍스트 메뉴) 위치 훅 — 클릭 좌표(뷰포트 기준)에서 열되,
 * 실제 렌더 크기를 측정해 화면 밖으로 넘치면 좌/상으로 뒤집는다(flip).
 * createPortal(body 렌더)과 함께 쓰면 overflow:hidden·transform 조상에 갇히지 않는다.
 * 스크롤/리사이즈 시엔 위치가 어긋나므로 닫는다.
 *
 * DailyView 의 할일/일정 컨텍스트 메뉴와 공용 TodoActionMenu 가 공유한다.
 */
export function useMenuPosition(
  rawPos: { x: number; y: number },
  ref: RefObject<HTMLElement>,
  onClose: () => void,
): { x: number; y: number } {
  const [pos, setPos] = useState(rawPos);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const M = 8; // 뷰포트 여백
    const { width, height } = el.getBoundingClientRect();
    let x = rawPos.x;
    let y = rawPos.y;
    if (x + width > window.innerWidth - M) x = rawPos.x - width; // 오른쪽 넘침 → 좌측 flip
    if (x < M) x = M;
    if (y + height > window.innerHeight - M) y = rawPos.y - height; // 아래 공간 부족 → 위로 flip
    if (y < M) y = M;
    setPos({ x, y });
  }, [rawPos.x, rawPos.y, ref]);
  useEffect(() => {
    // 캡처 단계로 중첩 스크롤 컨테이너의 스크롤까지 잡아 닫는다(위치 고정 캡처라 어긋남 방지).
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  return pos;
}
