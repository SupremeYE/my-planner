// 뷰티 케어 — 페이지 셸 (Stage 3: 라우팅/메뉴 노출용 플레이스홀더).
//  · 래퍼만 lg:hidden / hidden lg:block 로 모바일·PC 분기해 둠(지금은 동일 내용).
//  · 데이터·CRUD·FAB·사진·훅(useBeauty) 연결은 다음 스테이지. 여기선 순수 정적.
import { Flower2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

function BeautyCarePlaceholder() {
  const { t } = useTheme();
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: t.bg }}>
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3 lg:px-6 lg:pt-6" style={{ flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: t.text, lineHeight: 1.1 }}>
          케어
        </h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>
          잘 돌보고 있는지, 하온이 지켜볼게요
        </p>
      </div>

      {/* 빈 상태 카드 */}
      <div className="px-4 lg:px-6" style={{ flex: 1 }}>
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{
            padding: '40px 24px',
            borderRadius: 18,
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
          }}
        >
          <div
            className="flex items-center justify-center mb-3"
            style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.accentLight }}
          >
            <Flower2 size={26} style={{ color: t.accent }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>곧 만나요</p>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 6, maxWidth: 300, lineHeight: 1.6 }}>
            준비 중인 메뉴예요
          </p>
        </div>
      </div>
    </div>
  );
}

export function BeautyCareView() {
  return (
    <>
      {/* 레이아웃 분기 — 한쪽을 고쳐도 다른 쪽 무영향 (지금은 동일 플레이스홀더) */}
      <div className="lg:hidden">
        <BeautyCarePlaceholder />
      </div>
      <div className="hidden lg:block">
        <BeautyCarePlaceholder />
      </div>
    </>
  );
}
