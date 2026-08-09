import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, addMonths, subMonths, getDay, getDaysInMonth, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTheme } from '../ThemeContext';
import { getLogicalToday } from '../store';
import { inputBg, addPopoverStyle, withAlpha } from '../styles/haonStyles';

// ─── DateField (DESIGN.md §5 「날짜 입력」) ───────────────────────────────────
// TimeField 자매 컴포넌트. 날짜 입력기를 직접 만들지 않는다: 모바일 = <input type="date">(OS 위임),
// PC(lg:) = 트리거 + 월그리드 팝오버. 저장은 'yyyy-MM-dd' 문자열.
// · 선택=코랄(accentLight+accent), 오늘=코랄 링 마커, hover=lavenderHover. 새 색 토큰 없음.
// · 표면 = inputBg(§5 Input), 팝오버 = addPopoverStyle(§1 오버레이 글래스).
// · "오늘/미지정" 바로가기는 컴포넌트 밖(소비처)에서 유지 — 여기선 날짜 하나 고르기만.

const WD_SUN = ['일', '월', '화', '수', '목', '금', '토'];

interface DateFieldProps {
  value: string;                     // 'yyyy-MM-dd' | '' (빈 값)
  onChange: (value: string) => void; // '' = 지움
  min?: string;                      // 'yyyy-MM-dd' — 이전 날짜 비활성(예: 종료 필드)
  max?: string;
  clearable?: boolean;
  placeholder?: string;
  weekStartsOn?: 0 | 1;              // 0=일요일 시작(기본), 1=월요일
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function DateField({
  value,
  onChange,
  min,
  max,
  clearable = true,
  placeholder = '날짜 선택',
  weekStartsOn = 0,
  size = 'sm',
  ariaLabel = '날짜',
}: DateFieldProps) {
  const { t } = useTheme();
  const todayStr = getLogicalToday();

  const parsed = value && isValid(parseISO(value)) ? parseISO(value) : null;

  const [open, setOpen] = useState(false);
  // 팝오버에 표시 중인 달(1일 기준). 열 때 선택값(없으면 오늘)의 달로 맞춘다.
  const [displayMonth, setDisplayMonth] = useState<Date>(startOfMonth(parsed ?? parseISO(todayStr)));
  const wrapRef = useRef<HTMLDivElement>(null);

  const focusRing = `0 0 0 3px ${withAlpha(t.accent, 0.25)}`;
  const isMd = size === 'md';

  // 열릴 때 선택값(또는 오늘)의 달로 이동
  useEffect(() => {
    if (open) setDisplayMonth(startOfMonth(parsed ?? parseISO(todayStr)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 바깥 클릭 시 닫기 (PC 팝오버)
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDocDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const weekdays = useMemo(
    () => (weekStartsOn === 1 ? [...WD_SUN.slice(1), WD_SUN[0]] : WD_SUN),
    [weekStartsOn],
  );

  // 월그리드 셀 구성: 선행 빈칸 + 1..말일
  const cells = useMemo(() => {
    const monthStart = startOfMonth(displayMonth);
    const lead = (getDay(monthStart) - weekStartsOn + 7) % 7; // 첫 날 앞 빈칸 수
    const total = getDaysInMonth(displayMonth);
    const out: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), d));
    return out;
  }, [displayMonth, weekStartsOn]);

  const fieldStyle: CSSProperties = {
    background: inputBg(t),
    border: `1px solid ${t.border}`,
    borderRadius: isMd ? 12 : 10,
    color: value ? t.text : t.textMuted,
    fontSize: isMd ? 16 : 14,
    padding: isMd ? '8px 12px' : '6px 10px',
    width: '100%',
    outline: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  };

  const clear = () => { onChange(''); setOpen(false); };

  const isDisabled = (d: Date): boolean => {
    const s = ymd(d);
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  };

  // ── 네이티브 입력 (모바일) ──
  const nativeBlock = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="date"
        value={value || ''}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.boxShadow = focusRing; }}
        onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
        style={{ ...fieldStyle, cursor: 'text', color: t.text }}
      />
      {clearable && value && (
        <button type="button" onClick={clear} aria-label="날짜 지우기"
          style={{ position: 'absolute', right: 8, color: t.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
          <X size={14} />
        </button>
      )}
    </div>
  );

  const triggerLabel = parsed ? format(parsed, 'M월 d일 (EEE)', { locale: ko }) : placeholder;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      {/* 모바일: 네이티브 (OS 위임) */}
      <div className="lg:hidden">{nativeBlock}</div>

      {/* PC(lg): 트리거 + 월그리드 팝오버 */}
      <div className="hidden lg:block" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={() => setOpen(o => !o)}
            style={{ ...fieldStyle, borderColor: open ? t.accent : t.border, boxShadow: open ? focusRing : 'none' }}
          >
            {triggerLabel}
          </button>
          {clearable && value && !open && (
            <button type="button" onMouseDown={e => { e.preventDefault(); clear(); }} aria-label="날짜 지우기"
              style={{ position: 'absolute', right: 8, color: t.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {open && (
          <div style={{ ...addPopoverStyle(t), position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 260, zIndex: 300, padding: 10 }}>
            {/* 헤더: 월 이동 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button type="button" aria-label="이전 달" onClick={() => setDisplayMonth(m => subMonths(m, 1))}
                style={{ display: 'flex', padding: 4, borderRadius: 8, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{format(displayMonth, 'yyyy년 M월')}</span>
              <button type="button" aria-label="다음 달" onClick={() => setDisplayMonth(m => addMonths(m, 1))}
                style={{ display: 'flex', padding: 4, borderRadius: 8, border: 'none', background: 'transparent', color: t.textSub, cursor: 'pointer' }}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
              {weekdays.map(w => (
                <div key={w} style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, padding: '2px 0' }}>{w}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} />;
                const s = ymd(d);
                const selected = s === value;
                const isToday = s === todayStr;
                const disabled = isDisabled(d);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => { onChange(s); setOpen(false); }}
                    style={{
                      aspectRatio: '1 / 1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: selected ? 700 : isToday ? 600 : 400,
                      border: !selected && isToday ? `1.5px solid ${t.accent}` : '1.5px solid transparent',
                      background: selected ? t.accentLight : 'transparent',
                      color: disabled ? t.textMuted : selected ? t.accent : t.text,
                      opacity: disabled ? 0.35 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => {
                      if (!selected && !disabled) e.currentTarget.style.background = t.lavenderHover; // lint-colors-ok: 캘린더 셀 hover 순간 피드백 (§5 Interaction states)
                    }}
                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
