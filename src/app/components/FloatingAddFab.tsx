import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckSquare, Plus, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { QuickAddInput } from './QuickAddInput';

interface FloatingAddFabProps {
  /** QuickAddInput 기본 날짜. 파싱에 날짜가 없을 때 폴백(없으면 null=Inbox) */
  defaultDate?: string | null;
  /** (선택) 상세 할일 추가 — 패널 안 "상세" 단축 버튼으로 노출 (날짜 맥락 모달 등) */
  onAddTodo?: () => void;
  /** (선택) 상세 일정 추가 */
  onAddEvent?: () => void;
  mobileBottomClassName?: string;
  desktopBottomClassName?: string;
}

/**
 * 전역 빠른 캡처 FAB — 어느 화면에서든 우하단 + 버튼으로 통합 입력(QuickAddInput)을 띄운다.
 * PC: FAB 위 팝오버 패널 / 모바일: 하단 바텀시트.
 * 날짜 토큰 유무에 따라 해당 날짜 또는 Inbox 로 저장(QuickAddInput/Stage 1 로직 그대로).
 * onAddTodo/onAddEvent 가 주어지면 "상세 입력" 단축(기존 모달)도 함께 제공한다.
 */
export function FloatingAddFab({
  defaultDate = null,
  onAddTodo,
  onAddEvent,
  mobileBottomClassName = 'bottom-20',
  desktopBottomClassName = 'lg:bottom-6',
}: FloatingAddFabProps) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // PC: 바깥 클릭 닫기 (모바일은 dim 오버레이 탭으로 닫음)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const hasDetail = !!(onAddTodo || onAddEvent);

  const detailRow = hasDetail ? (
    <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${t.border}` }}>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>상세</span>
      {onAddTodo && (
        <button
          type="button"
          onClick={() => { onAddTodo(); setOpen(false); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
          style={{ fontSize: 11, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight }}
        >
          <CheckSquare size={12} /> 할일
        </button>
      )}
      {onAddEvent && (
        <button
          type="button"
          onClick={() => { onAddEvent(); setOpen(false); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
          style={{ fontSize: 11, fontWeight: 600, color: t.info, backgroundColor: t.bgSub }}
        >
          <CalendarDays size={12} /> 일정
        </button>
      )}
    </div>
  ) : null;

  const heading = (
    <p className="mb-2" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.04em' }}>
      빠른 입력
    </p>
  );

  return (
    <>
      {/* FAB 버튼 + PC 팝오버 */}
      <div
        ref={ref}
        className={`fixed lg:absolute right-4 lg:right-6 z-30 ${mobileBottomClassName} ${desktopBottomClassName}`}
      >
        {/* PC 팝오버 (hidden lg:block) */}
        <div
          className="hidden lg:block absolute right-0 bottom-[58px] rounded-2xl p-3"
          style={{
            width: 380,
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            boxShadow: '0 14px 30px rgba(38,52,61,0.18)',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
            pointerEvents: open ? 'auto' : 'none',
            transformOrigin: 'bottom right',
            transition: 'opacity 0.18s ease-out, transform 0.18s ease-out',
          }}
        >
          {open && (
            <>
              {heading}
              <QuickAddInput defaultDate={defaultDate} autoFocus onSubmitted={() => setOpen(false)} />
              {detailRow}
            </>
          )}
        </div>

        {/* FAB 버튼 */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 46,
            height: 46,
            backgroundColor: t.accent,
            color: '#fff',
            boxShadow: '0 10px 24px rgba(38,52,61,0.16)',
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
          aria-label="빠른 입력"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* 모바일 바텀시트 (lg:hidden) */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-2xl px-4 pt-3"
            style={{
              backgroundColor: t.card,
              borderTop: `1px solid ${t.border}`,
              boxShadow: '0 -8px 28px rgba(0,0,0,0.18)',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>빠른 입력</span>
              <button type="button" onClick={() => setOpen(false)} style={{ color: t.textMuted }} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <QuickAddInput defaultDate={defaultDate} autoFocus onSubmitted={() => setOpen(false)} />
            {detailRow}
          </div>
        </div>
      )}
    </>
  );
}
