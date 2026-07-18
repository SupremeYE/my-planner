// 살림 — 페이지 셸.
//  · 모바일(lg:hidden): 실제 기능 화면 HousekeepingMobile (Stage 4).
//  · PC(hidden lg:block): 데스크톱 전용 레이아웃 HousekeepingDesktop (Stage 7).
//  · 두 트리는 같은 훅(useHousekeeping)을 각자 호출 — 레이아웃만 분기, 데이터/액션 로직 공유.
import { HousekeepingMobile } from './HousekeepingMobile';
import { HousekeepingDesktop } from './HousekeepingDesktop';

export function HousekeepingView() {
  return (
    <>
      {/* 레이아웃 분기 — 한쪽을 고쳐도 다른 쪽 무영향 */}
      <div className="lg:hidden">
        <HousekeepingMobile />
      </div>
      <div className="hidden lg:block lg:h-full lg:overflow-y-auto">
        <HousekeepingDesktop />
      </div>
    </>
  );
}
