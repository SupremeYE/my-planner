import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { X, ChevronLeft, ChevronRight, CalendarPlus } from 'lucide-react';
import { format, parseISO, startOfMonth, addMonths, subMonths, addDays, getDay, getDaysInMonth, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTheme } from '../ThemeContext';
import { getLogicalToday } from '../store';
import { inputBg, addPopoverStyle, withAlpha } from '../styles/haonStyles';

// ─── DateField (DESIGN.md §5 「날짜 입력」) ───────────────────────────────────
// TimeField 자매 컴포넌트. 날짜 입력기를 직접 만들지 않는다: 모바일 = <input type="date">(OS 위임),
// PC(lg:) = 트리거 + 월그리드 팝오버. 저장은 'yyyy-MM-dd' 문자열.
//
// 기간(range) 모드는 옵션이다(range prop). 켜면 필드 하나로 시작~종료를 다룬다:
//  · PC: 팝오버 안에서 "기간으로" 토글 → 첫 클릭 시작·둘째 클릭 종료·사이 하이라이트(Notion 방식).
//  · 모바일: 네이티브 위임 원칙 유지 — 범위는 네이티브로 안 되므로 종료 native input 을 조건부로 노출.
//  · 빠른 선택(오늘/내일/주말/없음)은 팝오버 안으로 이동(필드 옆 버튼 제거).
// 단일 날짜 사용처는 range 를 넘기지 않으면 기존 동작 그대로다(영향 없음).
// 색: 선택=코랄(accentLight+accent), 사이밴드=코랄 워시, 오늘=코랄 링, hover=lavenderHover. 새 토큰 없음.

const WD_SUN = ['일', '월', '화', '수', '목', '금', '토'];

interface DateFieldProps {
  value: string;                     // 시작 'yyyy-MM-dd' | '' (빈 값)
  onChange: (value: string) => void; // 시작 변경 ('' = 지움)

  // ── 기간(range) 모드 — 옵션. 미지정 시 단일 날짜 동작 그대로 ──
  range?: boolean;                   // 기간 기능 사용(토글/조건부 종료 필드 노출)
  endValue?: string;                 // 종료 'yyyy-MM-dd' | '' (range 일 때만)
  onEndChange?: (value: string) => void;

  quickSelect?: boolean;             // 팝오버 빠른선택 행(오늘/내일/주말/없음). 기본 true
  min?: string;                      // 'yyyy-MM-dd' — 이전 날짜 비활성
  max?: string;
  clearable?: boolean;               // '없음'(미지정) 허용
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
  range = false,
  endValue = '',
  onEndChange,
  quickSelect = true,
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
  const endParsed = endValue && isValid(parseISO(endValue)) ? parseISO(endValue) : null;
  const hasRange = range && !!value && !!endValue && endValue > value;

  const [open, setOpen] = useState(false);
  // 기간 모드 활성 여부(팝오버 토글 / 모바일 조건부 종료 필드). 종료값이 있으면 켠 채 시작.
  const [rangeActive, setRangeActive] = useState<boolean>(range && !!endValue);
  // 팝오버 선택 단계: 'start' = 다음 클릭이 시작, 'end' = 다음 클릭이 종료.
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  // 팝오버에 표시 중인 달(1일 기준). 열 때 선택값(없으면 오늘)의 달로 맞춘다.
  const [displayMonth, setDisplayMonth] = useState<Date>(startOfMonth(parsed ?? parseISO(todayStr)));
  const wrapRef = useRef<HTMLDivElement>(null);

  const focusRing = `0 0 0 3px ${withAlpha(t.accent, 0.25)}`;
  const isMd = size === 'md';

  // 외부에서 종료값이 사라지면(부모 초기화 등) 기간 활성도 내린다.
  useEffect(() => { if (range && !endValue) setRangeActive(a => (a && open ? a : false)); }, [endValue, range, open]);

  // 열릴 때: 선택값(또는 오늘)의 달로 이동 + 선택 단계 초기화.
  useEffect(() => {
    if (open) {
      setDisplayMonth(startOfMonth(parsed ?? parseISO(todayStr)));
      setSelecting(rangeActive && !!value && !endValue ? 'end' : 'start');
    }
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

  const clearAll = () => { onChange(''); onEndChange?.(''); setOpen(false); };

  const isDisabled = (d: Date): boolean => {
    const s = ymd(d);
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  };

  // 팝오버에서 날짜 셀 클릭
  const pickDate = (s: string) => {
    if (!rangeActive) {
      onChange(s);
      setOpen(false);
      return;
    }
    // 기간 모드
    if (selecting === 'start' || !value || (!!value && !!endValue)) {
      // 새 기간 시작
      onChange(s);
      onEndChange?.('');
      setSelecting('end');
      return;
    }
    // selecting === 'end'
    if (s < value) {
      // 시작보다 이르면 시작을 당긴다(종료는 비운 채 계속 종료 대기)
      onChange(s);
      return;
    }
    onEndChange?.(s);
    setSelecting('start');
    setOpen(false);
  };

  // 빠른 선택
  const quickPick = (s: string) => {
    onChange(s);
    if (rangeActive) { onEndChange?.(''); setSelecting('end'); }
    else setOpen(false);
  };
  const weekendStr = useMemo(() => {
    const base = parseISO(todayStr);
    const addToSat = (6 - getDay(base) + 7) % 7; // 이번(또는 오늘이 토요일이면 오늘) 토요일
    return ymd(addDays(base, addToSat));
  }, [todayStr]);

  const toggleRange = () => {
    if (rangeActive) {
      setRangeActive(false);
      onEndChange?.('');
      setSelecting('start');
    } else {
      setRangeActive(true);
      setSelecting(value ? 'end' : 'start');
    }
  };

  // ── 네이티브 입력 (모바일) ──
  const nativeInput = (
    val: string,
    onVal: (v: string) => void,
    aria: string,
    nmin?: string,
    onClear?: () => void,
  ) => (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="date"
        value={val || ''}
        min={nmin}
        max={max}
        aria-label={aria}
        onChange={e => onVal(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.boxShadow = focusRing; }}
        onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
        style={{ ...fieldStyle, cursor: 'text', color: t.text }}
      />
      {onClear && val && (
        <button type="button" onClick={onClear} aria-label="지우기"
          style={{ position: 'absolute', right: 8, color: t.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
          <X size={14} />
        </button>
      )}
    </div>
  );

  const mobileBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {nativeInput(value, onChange, `${ariaLabel} 시작`, min, clearable ? () => onChange('') : undefined)}
      {/* 모바일 기간: 네이티브 위임 원칙 유지 — 종료는 조건부 native 필드로 노출(사용자 결정 Option A) */}
      {range && value && (
        rangeActive ? (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: t.textSub, fontWeight: 600, whiteSpace: 'nowrap' }}>종료</span>
            <div style={{ flex: 1 }}>{nativeInput(endValue, v => onEndChange?.(v), `${ariaLabel} 종료`, value || min)}</div>
            <button type="button" aria-label="기간 해제 (단일 날짜)" title="단일 날짜로"
              onClick={() => { setRangeActive(false); onEndChange?.(''); }}
              className="p-2 rounded-lg flex-shrink-0"
              style={{ color: t.textMuted, backgroundColor: inputBg(t), boxShadow: `inset 0 0 0 1px ${t.border}` }}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setRangeActive(true)}
            className="flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5"
            style={{ fontSize: 11, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight }}>
            <CalendarPlus size={14} /> 기간으로 (여러 날)
          </button>
        )
      )}
    </div>
  );

  const triggerLabel = parsed
    ? (hasRange && endParsed
        ? `${format(parsed, 'M월 d일', { locale: ko })} → ${format(endParsed, 'M월 d일', { locale: ko })}`
        : format(parsed, 'M월 d일 (EEE)', { locale: ko }))
    : placeholder;

  const quickChip = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick}
      style={{
        flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 0', borderRadius: 8,
        border: `1px solid ${t.border}`, background: t.card, color: t.textSub, cursor: 'pointer',
      }}>
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      {/* 모바일: 네이티브 (OS 위임) */}
      <div className="lg:hidden">{mobileBlock}</div>

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
            <button type="button" onMouseDown={e => { e.preventDefault(); clearAll(); }} aria-label="날짜 지우기"
              style={{ position: 'absolute', right: 8, color: t.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {open && (
          <div style={{ ...addPopoverStyle(t), position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 268, zIndex: 300, padding: 10 }}>
            {/* 빠른 선택 */}
            {quickSelect && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {quickChip('오늘', () => quickPick(todayStr))}
                {quickChip('내일', () => quickPick(ymd(addDays(parseISO(todayStr), 1))))}
                {quickChip('주말', () => quickPick(weekendStr))}
                {clearable && quickChip('없음', clearAll)}
              </div>
            )}

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
                const isStart = s === value;
                const isEnd = rangeActive && !!endValue && s === endValue;
                const inBand = rangeActive && !!value && !!endValue && s > value && s < endValue;
                const selected = isStart || isEnd;
                const isToday = s === todayStr;
                const disabled = isDisabled(d);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDate(s)}
                    style={{
                      aspectRatio: '1 / 1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: selected ? 700 : isToday ? 600 : 400,
                      border: !selected && isToday ? `1.5px solid ${t.accent}` : '1.5px solid transparent',
                      background: selected ? t.accentLight : inBand ? withAlpha(t.accent, 0.12) : 'transparent',
                      color: disabled ? t.textMuted : selected ? t.accent : t.text,
                      opacity: disabled ? 0.35 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => {
                      if (!selected && !inBand && !disabled) e.currentTarget.style.background = t.lavenderHover; // lint-colors-ok: 캘린더 셀 hover 순간 피드백 (§5 Interaction states)
                    }}
                    onMouseLeave={e => {
                      if (!selected) e.currentTarget.style.background = inBand ? withAlpha(t.accent, 0.12) : 'transparent';
                    }}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* 기간으로 토글 */}
            {range && (
              <button type="button" role="switch" aria-checked={rangeActive} onClick={toggleRange}
                style={{
                  marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>기간으로 (여러 날)</span>
                <span aria-hidden style={{
                  width: 34, height: 20, borderRadius: 999, position: 'relative', flexShrink: 0,
                  background: rangeActive ? t.accent : t.surfaceMuted, transition: 'background .15s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: rangeActive ? 16 : 2,
                    width: 16, height: 16, borderRadius: 999, background: '#fff',
                    transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }} />
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
