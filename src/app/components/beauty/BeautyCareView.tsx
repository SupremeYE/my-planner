// 뷰티 케어 — 페이지 셸.
//  · 모바일(lg:hidden): 실제 기능 화면 BeautyCareMobile (Stage 5).
//  · PC(hidden lg:block): 데스크톱 전용 레이아웃 BeautyCareDesktop (Stage 7).
//  · 두 트리는 같은 훅(useBeauty)을 각자 호출 — 레이아웃만 분기, 데이터/액션 로직 공유.
import { BeautyCareMobile } from './BeautyCareMobile';
import { BeautyCareDesktop } from './BeautyCareDesktop';

export function BeautyCareView() {
  return (
    <>
      {/* 레이아웃 분기 — 한쪽을 고쳐도 다른 쪽 무영향 */}
      <div className="lg:hidden">
        <BeautyCareMobile />
      </div>
      <div className="hidden lg:block">
        <BeautyCareDesktop />
      </div>
    </>
  );
}
