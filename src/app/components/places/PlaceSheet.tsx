// 가고싶은 곳 — 공용 시트 셸 (모바일=하단 슬라이드업 / PC=중앙 모달)
// AddScrapModal 의 진입·퇴장 애니메이션 패턴을 따른다. 색은 토큰만.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { withAlpha } from './placeHelpers';

interface Props {
  title: string;
  onClose: () => void;
  // children 은 애니메이션 포함 close 함수를 받는다 (저장 후 닫기에 사용).
  children: (close: () => void) => React.ReactNode;
  footer?: (close: () => void) => React.ReactNode;
}

export function PlaceSheet({ title, onClose, children, footer }: Props) {
  const { t } = useTheme();
  const [isIn, setIsIn] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setIsIn(true)); }, []);

  const close = () => { setIsIn(false); setTimeout(onClose, 220); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      style={{ background: withAlpha('#000000', isIn ? 0.35 : 0), transition: 'background .22s' }}
      onClick={close}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full rounded-t-3xl flex flex-col lg:w-[460px] lg:max-w-[92vw] lg:rounded-3xl"
        style={{
          backgroundColor: t.card,
          maxHeight: '92vh',
          boxShadow: `0 -10px 40px -12px ${withAlpha('#000000', 0.25)}`,
          transform: isIn ? 'translateY(0)' : 'translateY(101%)',
          transition: 'transform .25s cubic-bezier(.2,.9,.3,1.04)',
        }}
      >
        {/* 핸들(모바일) */}
        <div className="flex justify-center pt-2.5 lg:hidden">
          <div style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: t.border }} />
        </div>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 lg:pt-5">
          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: t.text }}>{title}</h3>
          <button onClick={close} className="p-1 -mr-1" aria-label="닫기">
            <X size={20} color={t.textSub} />
          </button>
        </div>
        {/* 본문 */}
        <div className="px-5 pb-4 overflow-y-auto" style={{ flex: 1 }}>
          {children(close)}
        </div>
        {/* 푸터 */}
        {footer && (
          <div
            className="px-5 pt-3 pb-5"
            style={{ borderTop: `1px solid ${t.borderLight}`, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
          >
            {footer(close)}
          </div>
        )}
      </div>
    </div>
  );
}

// 폼 공용 라벨
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <label className="block mb-4">
      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
