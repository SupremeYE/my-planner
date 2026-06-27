// 하온 머니 — 페이지 셸. 모바일/PC 레이아웃 분기.
//  · CSS(lg:hidden) 이중 마운트 대신 useMediaQuery 조건부 렌더링 → 한쪽만 마운트.
//    두 트리를 동시에 띄우면 useMoney 가 2번 실행돼 Realtime 구독/쿼리가 이중화되므로 한쪽만 렌더한다.
import { useFabAction } from '../../app/FabContext';
import { useMediaQuery } from '../../app/hooks/useMediaQuery';
import { MoneyMobile } from './MoneyMobile';
import { MoneyDesktop } from './MoneyDesktop';

export function MoneyView() {
  // 채팅 입력바가 머니의 메인 입력 수단 — 전역 FAB 숨김(겹침 방지).
  useFabAction({ kind: 'hidden' });
  const isDesktop = useMediaQuery('(min-width: 1024px)');  // Tailwind lg 브레이크포인트와 동일
  return isDesktop ? <MoneyDesktop /> : <MoneyMobile />;
}
