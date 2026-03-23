import { useState, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface TimePickerProps {
  value: string;          // "HH:mm" 또는 ""
  onChange: (value: string) => void;
  placeholder?: string;
  minuteStep?: number;    // 기본 5분 단위
  size?: 'sm' | 'md';     // sm: fontSize 13 / md: fontSize 15
}

export function TimePicker({
  value,
  onChange,
  placeholder = '시간 선택',
  minuteStep = 5,
  size = 'sm',
}: TimePickerProps) {
  const { t } = useTheme();

  // ── 편집 모드 state ──
  const [editingHour, setEditingHour] = useState(false);
  const [editingMinute, setEditingMinute] = useState(false);
  const [hourInput, setHourInput] = useState('');
  const [minuteInput, setMinuteInput] = useState('');
  const minuteInputRef = useRef<HTMLInputElement>(null);

  // ── value 파싱 ──
  const isEmpty = !value;
  const [hStr, mStr] = value ? value.split(':') : ['00', '00'];
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  const minuteSteps = Math.floor(60 / minuteStep);

  // ── 현재 시각으로 초기화 ──
  const handleInit = () => {
    const now = new Date();
    const h = now.getHours();
    const rawM = now.getMinutes();
    const m = Math.round(rawM / minuteStep) * minuteStep % 60;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  // ── 시/분 증감 (버튼 + 휠 공용) ──
  const changeHour = (delta: number) => {
    const base = isEmpty ? 0 : hour;
    const next = ((base + delta) % 24 + 24) % 24;
    const m = isEmpty ? 0 : minute;
    onChange(`${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const changeMinute = (delta: number) => {
    const h = isEmpty ? 0 : hour;
    const currentStep = Math.round(minute / minuteStep);
    const nextStep = ((currentStep + delta) % minuteSteps + minuteSteps) % minuteSteps;
    const nextMin = nextStep * minuteStep;
    onChange(`${String(h).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`);
  };

  // ── 휠 스크롤 핸들러 ──
  const handleHourWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isEmpty) { handleInit(); return; }
    changeHour(e.deltaY > 0 ? -1 : 1);
  };

  const handleMinuteWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isEmpty) { handleInit(); return; }
    changeMinute(e.deltaY > 0 ? -1 : 1);
  };

  // ── 직접 입력: 시 ──
  const startEditHour = () => {
    if (isEmpty) handleInit();
    setHourInput(String(isEmpty ? new Date().getHours() : hour).padStart(2, '0'));
    setEditingHour(true);
  };

  const commitHour = () => {
    const n = parseInt(hourInput, 10);
    const h = (!isNaN(n) && n >= 0 && n <= 23) ? n : hour;
    const m = isEmpty ? 0 : minute;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setEditingHour(false);
  };

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitHour();
      // 분 편집으로 이동
      setTimeout(() => {
        setMinuteInput(String(minute).padStart(2, '0'));
        setEditingMinute(true);
        minuteInputRef.current?.focus();
      }, 0);
    }
    if (e.key === 'Escape') setEditingHour(false);
  };

  // ── 직접 입력: 분 ──
  const startEditMinute = () => {
    if (isEmpty) handleInit();
    setMinuteInput(String(isEmpty ? 0 : minute).padStart(2, '0'));
    setEditingMinute(true);
  };

  const commitMinute = () => {
    const n = parseInt(minuteInput, 10);
    if (!isNaN(n) && n >= 0 && n <= 59) {
      const snapped = Math.round(n / minuteStep) * minuteStep % 60;
      const h = isEmpty ? 0 : hour;
      onChange(`${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`);
    }
    setEditingMinute(false);
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitMinute(); }
    if (e.key === 'Escape') setEditingMinute(false);
  };

  const handleClear = () => onChange('');

  // ── 스타일 ──
  const isMd = size === 'md';
  const numFontSize = isMd ? 18 : 15;
  const spinnerSize = isMd ? 16 : 13;
  const cellW = isMd ? 48 : 40;
  const cellH = isMd ? 28 : 22;

  const cellStyle: React.CSSProperties = {
    width: cellW,
    height: cellH,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: numFontSize,
    fontWeight: 700,
    color: t.text,
    cursor: 'text',
    letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
    borderRadius: 4,
    transition: 'background 0.12s',
  };

  const inputStyle: React.CSSProperties = {
    width: cellW,
    height: cellH,
    fontSize: numFontSize,
    fontWeight: 700,
    color: t.accent,
    background: t.accentLight,
    border: `1.5px solid ${t.accent}`,
    borderRadius: 4,
    textAlign: 'center',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
    padding: 0,
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: cellW,
    height: isMd ? 22 : 18,
    cursor: 'pointer',
    color: t.textSub,
    background: 'transparent',
    border: 'none',
    padding: 0,
    borderRadius: 4,
    transition: 'color 0.12s',
    flexShrink: 0,
  };

  return (
    <div
      className="flex items-center"
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: isMd ? 12 : 8,
        backgroundColor: t.bgSub,
        padding: isMd ? '4px 12px' : '2px 8px',
        width: '100%',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      {/* ── 빈 상태: placeholder ── */}
      {isEmpty && !editingHour && !editingMinute ? (
        <button
          type="button"
          onClick={handleInit}
          style={{
            flex: 1,
            padding: isMd ? '10px 0' : '6px 0',
            color: t.textMuted,
            fontSize: isMd ? 14 : 12,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          {placeholder}
        </button>
      ) : (
        <>
          {/* ── 시(Hour) 열 ── */}
          <div
            className="flex flex-col items-center"
            style={{ userSelect: 'none' }}
            onWheel={handleHourWheel}
          >
            <button
              type="button"
              style={btnStyle}
              onClick={() => changeHour(1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronUp size={spinnerSize} strokeWidth={2.5} />
            </button>

            {editingHour ? (
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={2}
                value={hourInput}
                style={inputStyle}
                autoFocus
                onChange={e => setHourInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                onBlur={commitHour}
                onKeyDown={handleHourKeyDown}
              />
            ) : (
              <div
                style={cellStyle}
                onClick={startEditHour}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.accentLight; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title="클릭하여 직접 입력"
              >
                {String(hour).padStart(2, '0')}
              </div>
            )}

            <button
              type="button"
              style={btnStyle}
              onClick={() => changeHour(-1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronDown size={spinnerSize} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── 콜론 ── */}
          <div
            style={{
              fontSize: isMd ? 18 : 15,
              fontWeight: 700,
              color: t.textMuted,
              padding: '0 3px',
              alignSelf: 'center',
              paddingBottom: 2,
              userSelect: 'none',
            }}
          >
            :
          </div>

          {/* ── 분(Minute) 열 ── */}
          <div
            className="flex flex-col items-center"
            style={{ userSelect: 'none' }}
            onWheel={handleMinuteWheel}
          >
            <button
              type="button"
              style={btnStyle}
              onClick={() => changeMinute(1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronUp size={spinnerSize} strokeWidth={2.5} />
            </button>

            {editingMinute ? (
              <input
                ref={minuteInputRef}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={2}
                value={minuteInput}
                style={inputStyle}
                autoFocus
                onChange={e => setMinuteInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                onBlur={commitMinute}
                onKeyDown={handleMinuteKeyDown}
              />
            ) : (
              <div
                style={cellStyle}
                onClick={startEditMinute}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.accentLight; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title="클릭하여 직접 입력"
              >
                {String(minute).padStart(2, '0')}
              </div>
            )}

            <button
              type="button"
              style={btnStyle}
              onClick={() => changeMinute(-1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronDown size={spinnerSize} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── 지우기 ── */}
          <button
            type="button"
            onClick={handleClear}
            style={{
              marginLeft: isMd ? 10 : 6,
              color: t.textMuted,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              transition: 'color 0.15s',
              alignSelf: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = t.text)}
            onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
          >
            <X size={isMd ? 13 : 11} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}
