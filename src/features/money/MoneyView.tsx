// 하온 머니 — 페이지 셸. 모바일(lg:hidden)/PC(hidden lg:block) 레이아웃 분기.
// 두 트리는 각자 useMoney 를 호출 — 레이아웃만 분기, 데이터/액션 로직 공유(beauty 패턴 동일).
import { useFabAction } from '../../app/FabContext';
import { MoneyMobile } from './MoneyMobile';
import { MoneyDesktop } from './MoneyDesktop';

export function MoneyView() {
  // 채팅 입력바가 머니의 메인 입력 수단 — 전역 FAB 숨김(겹침 방지).
  useFabAction({ kind: 'hidden' });
  return (
    <>
      <div className="lg:hidden">
        <MoneyMobile />
      </div>
      <div className="hidden lg:block h-full">
        <MoneyDesktop />
      </div>
    </>
  );
}
