import { useEffect, useRef } from 'react';
import { usePlanner } from '../store';
import { useKeyHint } from '../hooks/useKeyHint';

/**
 * Top3(별) 해제 알림의 단일 호스트 — App 에 1회 마운트.
 * store 의 `top3Notice`(nonce 큐)를 구독해 `useKeyHint` pill 로 소비한다. 이 덕분에 날짜 이동으로
 * 별이 해제되는 어떤 경로(미루기·오늘로·배정·드래그·앞으로 생길 것)도 호출부가 알림을 부르지
 * 않아도 자동으로 사유가 뜬다. 새 알림 패턴이 아니라 기존 useKeyHint pill 재사용.
 *
 * nonce 가드로 React strict mode 이중 실행에도 같은 알림을 두 번 표시하지 않는다.
 */
export function Top3NoticeHost() {
  const { top3Notice } = usePlanner();
  const { showKeyHint, keyHintNode } = useKeyHint();
  const lastNonceRef = useRef(0);

  useEffect(() => {
    if (top3Notice && top3Notice.nonce !== lastNonceRef.current) {
      lastNonceRef.current = top3Notice.nonce;
      showKeyHint(top3Notice.msg);
    }
  }, [top3Notice, showKeyHint]);

  return keyHintNode;
}
