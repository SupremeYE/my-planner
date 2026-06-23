import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckSquare, Plus, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useFab, type FabAction } from '../FabContext';
import { QuickAddInput } from './QuickAddInput';

interface FloatingAddFabProps {
  mobileBottomClassName?: string;
  desktopBottomClassName?: string;
}

const LONG_PRESS_MS = 480;
const isDesktopViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/**
 * 전역 컨텍스트 FAB — 우하단에 항상 1개만 떠서, 현재 페이지가 등록한 주(主) 추가 액션을 수행한다.
 * (라우트→액션 매핑은 각 페이지가 `useFabAction` 으로 등록하는 단일 소스)
 *
 * - 짧게 탭 = 현재 페이지 컨텍스트 액션
 *   · `kind:'action'` → 그 페이지의 추가 모달/시트를 바로 연다.
 *   · `kind:'quick'` 또는 미등록 → 통합 빠른 입력(QuickAddInput) 팝오버/시트.
 * - 모바일(`lg` 미만) 길게 누르기(long-press) = speed dial 펼침 → "할일 빠르게 추가" 등 보조 액션.
 *   PC(`lg` 이상)는 long-press/speed dial 비활성(탭 = 컨텍스트 액션만).
 */
export function FloatingAddFab({
  mobileBottomClassName = 'bottom-20',
  desktopBottomClassName = 'lg:bottom-6',
}: FloatingAddFabProps) {
  const { t } = useTheme();
  const { action } = useFab();
  const [open, setOpen] = useState(false);          // 빠른 입력 팝오버/시트
  const [quickDate, setQuickDate] = useState<string | null>(null); // 빠른 입력 기본 날짜
  const [speedOpen, setSpeedOpen] = useState(false); // 모바일 speed dial
  const ref = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  // 미등록이면 기본 빠른 입력(Inbox 캡처)
  const effective: FabAction = action ?? { kind: 'quick', defaultDate: null };

  // 페이지가 위치 클래스를 지정하면(예: 내부 탭바가 있는 레시피 모듈) 그것으로 대체
  const fabClassName = effective.kind === 'hidden' ? undefined : effective.fabClassName;
  const posBase = fabClassName
    ? `fixed lg:absolute right-4 lg:right-6 ${fabClassName}`
    : `fixed lg:absolute right-4 lg:right-6 ${mobileBottomClassName} ${desktopBottomClassName}`;
  // speed dial 펼침 시 dim(z-40) 위로 올린다(모바일 한정 — PC 는 speedOpen 이 항상 false)
  const posClass = `${posBase} ${speedOpen ? 'z-50' : 'z-30'}`;

  // PC: 바깥 클릭으로 빠른 입력 팝오버 닫기 (모바일은 dim 오버레이 탭으로 닫음)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // ESC 닫기 (팝오버 + speed dial)
  useEffect(() => {
    if (!open && !speedOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setSpeedOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, speedOpen]);

  // 언마운트 시 타이머 정리
  useEffect(() => () => { if (pressTimer.current) clearTimeout(pressTimer.current); }, []);

  // ── kind:'hidden' — 이 페이지에서는 FAB 숨김 ──
  if (effective.kind === 'hidden') return null;

  const isQuick = effective.kind === 'quick';
  const onAddTodo = isQuick ? effective.onAddTodo : undefined;
  const onAddEvent = isQuick ? effective.onAddEvent : undefined;
  const hasDetail = !!(onAddTodo || onAddEvent);
  const heading = isQuick ? (effective.label ?? '빠른 입력') : '할일 빠르게 추가';
  const Icon = effective.kind === 'action' ? (effective.icon ?? Plus) : Plus;
  const fabLabel = effective.kind === 'action' ? effective.label : heading;

  // 컨텍스트(짧은 탭) 액션
  const runPrimary = () => {
    if (effective.kind === 'action') { effective.onPress(); return; }
    // quick: 토글
    if (open) { setOpen(false); return; }
    setQuickDate(effective.defaultDate ?? null);
    setOpen(true);
  };

  const handleClick = () => {
    if (longPressFired.current) { longPressFired.current = false; return; } // long-press 직후 탭 무시
    if (speedOpen) { setSpeedOpen(false); return; }
    runPrimary();
  };

  // 모바일 long-press → speed dial (터치 + lg 미만에서만)
  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || isDesktopViewport()) return;
    longPressFired.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setSpeedOpen(true);
      if ('vibrate' in navigator) navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  // speed dial 보조 액션 — 어느 페이지에서든 "할일 빠르게 추가"(Inbox 캡처)
  const speedActions = [
    {
      key: 'quick-todo',
      label: '할일 빠르게 추가',
      icon: CheckSquare,
      onPress: () => { setQuickDate(null); setSpeedOpen(false); setOpen(true); },
    },
  ];

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

  return (
    <>
      {/* FAB 버튼 + PC 팝오버 + 모바일 speed dial 항목 */}
      <div ref={ref} className={posClass}>
        {/* PC 빠른 입력 팝오버 (quick 컨텍스트에서만, hidden lg:block) */}
        {isQuick && (
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
                <p className="mb-2" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.04em' }}>
                  {heading}
                </p>
                <QuickAddInput defaultDate={quickDate} autoFocus onSubmitted={() => setOpen(false)} />
                {detailRow}
              </>
            )}
          </div>
        )}

        {/* 모바일 speed dial 항목 (lg:hidden, FAB 위로 펼침) */}
        {speedOpen && (
          <div className="lg:hidden absolute right-0 bottom-[58px] flex flex-col items-end gap-2">
            {speedActions.map(({ key, label, icon: ActIcon, onPress }) => (
              <button
                key={key}
                type="button"
                onClick={onPress}
                className="flex items-center gap-2 active:scale-95 transition-transform"
              >
                <span
                  className="px-2.5 py-1 rounded-lg whitespace-nowrap"
                  style={{ fontSize: 12, fontWeight: 600, color: t.text, backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 4px 12px rgba(38,52,61,0.12)' }}
                >
                  {label}
                </span>
                <span
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 40, height: 40, backgroundColor: t.card, color: t.accent, border: `1px solid ${t.border}`, boxShadow: '0 4px 12px rgba(38,52,61,0.12)' }}
                >
                  <ActIcon size={18} />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* FAB 버튼 (탭 = 컨텍스트 액션 / 모바일 long-press = speed dial) */}
        <button
          type="button"
          onClick={handleClick}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 46,
            height: 46,
            backgroundColor: t.accent,
            color: '#fff',
            boxShadow: '0 10px 24px rgba(38,52,61,0.16)',
            transition: 'transform 0.15s ease',
            transform: open || speedOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            touchAction: 'manipulation',
            WebkitTouchCallout: 'none',
            userSelect: 'none',
          }}
          aria-label={fabLabel}
          title={fabLabel}
        >
          <Icon size={20} />
        </button>
      </div>

      {/* 모바일 speed dial dim (lg:hidden) */}
      {speedOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
          onClick={() => setSpeedOpen(false)}
        />
      )}

      {/* 모바일 빠른 입력 바텀시트 (lg:hidden) */}
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
              <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>{heading}</span>
              <button type="button" onClick={() => setOpen(false)} style={{ color: t.textMuted }} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <QuickAddInput defaultDate={quickDate} autoFocus onSubmitted={() => setOpen(false)} />
            {detailRow}
          </div>
        </div>
      )}
    </>
  );
}
