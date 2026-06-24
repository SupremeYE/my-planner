import { useEffect, useState } from 'react';

/**
 * 뷰포트 미디어 쿼리 매칭 여부를 반환하는 훅.
 * 모바일/PC 분기를 CSS(`lg:hidden`)가 아니라 조건부 렌더링으로 처리할 때 사용 —
 * 매칭되지 않는 쪽 컴포넌트는 아예 마운트되지 않아 불필요한 쿼리 실행을 막는다.
 *
 * @example const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches); // query 변경/마운트 시점 동기화
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
