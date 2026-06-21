import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckSquare, Plus, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useFab, type FabAction } from '../FabContext';
import { QuickAddInput } from './QuickAddInput';

interface FloatingAddFabProps {
  mobileBottomClassName?: string;
  desktopBottomClassName?: string;
}

/**
 * 전역 컨텍스트 FAB — 우하단에 항상 1개만 떠서, 현재 페이지가 등록한 주(主) 추가 액션을 수행한다.
 * (라우트→액션 매핑은 각 페이지가 `useFabAction` 으로 등록하는 단일 소스)
 *
 * - 등록 액션이 `kind:'action'` → 누르면 그 페이지의 추가 모달/시트를 바로 연다.
 * - 등록 액션이 `kind:'quick'` 또는 미등록 → 통합 빠른 입력(QuickAddInput) 팝오버/시트를 띄운다.
 */
export function FloatingAddFab({
  mobileBottomClassName = 'bottom-20',
  desktopBottomClassName = 'lg:bottom-6',
}: FloatingAddFabProps) {
  const { t } = useTheme();
  const { action } = useFab();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 미등록이면 기본 빠른 입력(Inbox 캡처)
  const effective: FabAction = action ?? { kind: 'quick', defaultDate: null };
  const isQuick = effective.kind === 'quick';

  // 페이지가 위치 클래스를 지정하면(예: 내부 탭바가 있는 레시피 모듈) 그것으로 대체
  const fabClassName = effective.kind === 'hidden' ? undefined : effective.fabClassName;
  const posClass = fabClassName
    ? `fixed lg:absolute right-4 lg:right-6 z-30 ${fabClassName}`
    : `fixed lg:absolute right-4 lg:right-6 z-30 ${mobileBottomClassName} ${desktopBottomClassName}`;

  // quick 모드가 아니면 팝오버/시트를 쓰지 않으므로 닫아둔다
  useEffect(() => {
    if (!isQuick && open) setOpen(false);
  }, [isQuick, open]);

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

  // ── kind:'hidden' — 이 페이지에서는 FAB 숨김 ──
  if (effective.kind === 'hidden') return null;

  // ── kind:'action' — 누르면 페이지 모달 직접 오픈 (팝오버 없음) ──
  if (effective.kind === 'action') {
    const Icon = effective.icon ?? Plus;
    return (
      <div className={posClass}>
        <button
          type="button"
          onClick={() => effective.onPress()}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 46,
            height: 46,
            backgroundColor: t.accent,
            color: '#fff',
            boxShadow: '0 10px 24px rgba(38,52,61,0.16)',
          }}
          aria-label={effective.label}
          title={effective.label}
        >
          <Icon size={20} />
        </button>
      </div>
    );
  }

  // ── kind:'quick' — 통합 빠른 입력 팝오버/시트 ──
  const defaultDate = effective.defaultDate ?? null;
  const onAddTodo = effective.onAddTodo;
  const onAddEvent = effective.onAddEvent;
  const headingLabel = effective.label ?? '빠른 입력';
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
      {headingLabel}
    </p>
  );

  return (
    <>
      {/* FAB 버튼 + PC 팝오버 */}
      <div
        ref={ref}
        className={posClass}
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
          aria-label={headingLabel}
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
              <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>{headingLabel}</span>
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
