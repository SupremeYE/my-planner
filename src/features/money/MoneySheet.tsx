// 하온 머니 — 공통 시트/모달 래퍼(UI-Stage 1).
//  · 모바일: 하단에서 올라오는 풀폭 시트(기존 시트와 100% 동일 — items-end · rounded-t · 풀폭).
//  · PC(lg): 화면 가운데 와이드 다이얼로그. 내부에서 2~3단 그리드 자유 사용(좁은 모바일 폭 탈피).
//  · 내용(JSX)은 children 으로 재사용 — 컨테이너만 교체. 색은 ThemeContext 토큰 경유(하드코딩 금지).
import React from 'react';
import { useTheme } from '../../app/ThemeContext';

export type MoneySheetSize = 'md' | 'wide';

// size: 'md'(기존 시트 폭 480) | 'wide'(2단 레이아웃용 ~1040). 모바일은 항상 풀폭(동일).
export function MoneySheet({ onClose, size = 'md', children }: {
  onClose: () => void; size?: MoneySheetSize; children: React.ReactNode;
}) {
  const { t } = useTheme();
  const pcWidth = size === 'wide' ? 'lg:w-[1040px] lg:max-w-[92vw]' : 'lg:w-[480px] lg:max-w-[92vw]';
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full ${pcWidth} rounded-t-3xl lg:rounded-3xl pt-5 px-5 pb-7 lg:p-7`}
        style={{ background: t.card, maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
