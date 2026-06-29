// 하온 머니 — 공통 시트/모달 래퍼(UI-Stage 1~3).
//  · variant='center'(기본): 모바일=하단 풀폭 시트 / PC=화면 가운데 와이드 다이얼로그(2~3단 그리드 허용).
//  · variant='side': 모바일=하단 풀폭 시트(동일) / PC=우측 풀높이 슬라이드인 패널(편한가계부 자산정보처럼).
//  · 모바일 모양은 기존 시트와 100% 동일(items-end · rounded-t · 풀폭). PC만 lg: 로 분기.
//  · 내용(JSX)은 children 으로 재사용 — 컨테이너만 교체. 색은 ThemeContext 토큰 경유(하드코딩 금지).
import React, { useEffect, useState } from 'react';
import { useTheme } from '../../app/ThemeContext';
import { useMediaQuery } from '../../app/hooks/useMediaQuery';

export type MoneySheetSize = 'md' | 'wide';
export type MoneySheetVariant = 'center' | 'side';

// size: 'md'(폭 480) | 'wide'(2단용 ~1040). padClass/maxVh: 모바일을 기존 시트와 정확히 맞추는 오버라이드.
export function MoneySheet({ onClose, size = 'md', variant = 'center', padClass = 'pt-5 px-5 pb-7 lg:p-7', maxVh = 90, children }: {
  onClose: () => void; size?: MoneySheetSize; variant?: MoneySheetVariant; padClass?: string; maxVh?: number; children: React.ReactNode;
}) {
  const { t } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [shown, setShown] = useState(false);
  // 마운트 직후 슬라이드인 트리거(PC side 변형에서만 사용). 모바일/center 에는 영향 없음.
  useEffect(() => { const r = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(r); }, []);

  const pcWidth = size === 'wide' ? 'lg:w-[1040px] lg:max-w-[92vw]' : 'lg:w-[480px] lg:max-w-[92vw]';

  if (variant === 'side') {
    // PC: 우측 풀높이 패널 + 슬라이드인. 모바일: 하단 시트(transform 없음 → 기존과 동일).
    const slide = isDesktop
      ? { transform: shown ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)' }
      : {};
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-stretch lg:justify-end" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()}
          className={`w-full ${pcWidth} rounded-t-3xl lg:rounded-none lg:rounded-l-3xl max-h-[88vh] lg:max-h-none lg:h-full ${padClass}`}
          style={{ background: t.card, overflowY: 'auto', ...slide }}>
          {children}
        </div>
      </div>
    );
  }

  // center(기본) — 화면 가운데 다이얼로그. 모바일은 하단 시트.
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full ${pcWidth} rounded-t-3xl lg:rounded-3xl ${padClass}`}
        style={{ background: t.card, maxHeight: `${maxVh}vh`, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
