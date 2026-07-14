import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { isHaon, bottomSheetStyle, sheetBackdropStyle } from '../../styles/haonStyles';

// 운동 탭 공용 바텀시트 셸 — 모바일 슬라이드업 + PC 중앙 카드.
// ScrapDetailSheet 와 동일한 진입/해제 애니메이션 패턴.
interface Props {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  headerRight?: React.ReactNode;   // 헤더 우측 액션(저장 등)
  footer?: React.ReactNode;        // 하단 고정 영역(저장 버튼 등)
  wide?: boolean;                  // PC 에서 넓은 중앙 모달(예: 사진 그리드 4열). 모바일은 동일(full-width).
}

export function SheetShell({ title, onClose, children, headerRight, footer, wide }: Props) {
  const { t } = useTheme();
  const [isIn, setIsIn] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setIsIn(true)); }, []);
  const handleClose = useCallback(() => { setIsIn(false); setTimeout(onClose, 220); }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch lg:items-center lg:justify-center"
      style={{ ...(isHaon(t) ? sheetBackdropStyle() : { backgroundColor: 'rgba(0,0,0,0.45)' }), opacity: isIn ? 1 : 0, transition: 'opacity 0.22s ease' }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`flex flex-col w-full ${wide ? 'lg:w-[760px]' : 'lg:w-[460px]'} lg:max-h-[92vh] lg:rounded-2xl overflow-hidden`}
        style={{
          ...(isHaon(t)
            ? bottomSheetStyle(t)
            : { backgroundColor: t.card, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }),
          transform: isIn ? 'translateY(0)' : 'translateY(24px)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '92vh',
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: t.border, paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <button onClick={handleClose} className="p-1.5 rounded-lg -ml-1.5" aria-label="닫기">
            <ArrowLeft size={20} color={t.text} className="lg:hidden" />
            <X size={20} color={t.text} className="hidden lg:block" />
          </button>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }} className="truncate px-2">
            {title}
          </div>
          <div className="flex items-center justify-end" style={{ minWidth: 30 }}>
            {headerRight ?? <div style={{ width: 30 }} />}
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {children}
        </div>

        {/* 하단 고정 */}
        {footer && (
          <div
            className="flex-shrink-0 border-t px-4 py-3"
            style={{ borderColor: t.border, paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
