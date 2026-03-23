import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface TimePickerProps {
  value: string;          // "HH:mm" 또는 ""
  onChange: (value: string) => void;
  placeholder?: string;
  minuteStep?: number;    // ▲▼ 버튼 단위 (기본 5). 휠은 항상 1분 단위.
  size?: 'sm' | 'md';
}

export function TimePicker({
  value,
  onChange,
  placeholder = '시간 선택',
  minuteStep = 5,
  size = 'sm',
}: TimePickerProps) {
  const { t } = useTheme();

  // ── 드롭다운 상태 ──
  const [openPanel, setOpenPanel] = useState<'hour' | 'minute' | null>(null);
  const [panelLeft, setPanelLeft] = useState(0);
  const [panelInput, setPanelInput] = useState('');

  const wrapperRef   = useRef<HTMLDivElement>(null);
  const hourColRef   = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const listRef      = useRef<HTMLDivElement>(null);
  const panelInputRef = useRef<HTMLInputElement>(null);

  // ── value 파싱 ──
  const isEmpty = !value;
  const [hStr, mStr] = value ? value.split(':') : ['00', '00'];
  const hour   = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  const minuteSteps = Math.floor(60 / minuteStep);

  // 패널 리스트: 시 0–23, 분 0–59 (직접 입력과 자연스럽게 연동)
  const hourList   = Array.from({ length: 24 }, (_, i) => i);
  const minuteList = Array.from({ length: 60 },  (_, i) => i);

  // ── 현재 시각으로 초기화 ──
  const handleInit = (cb?: () => void) => {
    const now = new Date();
    const h = now.getHours();
    const m = Math.round(now.getMinutes() / minuteStep) * minuteStep % 60;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cb?.();
  };

  // ── 시 증감 (▲▼ 버튼) ──
  const changeHour = (delta: number) => {
    const base = isEmpty ? 0 : hour;
    const m    = isEmpty ? 0 : minute;
    const next = ((base + delta) % 24 + 24) % 24;
    onChange(`${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  // ── 분 증감 (▲▼ 버튼: minuteStep 단위) ──
  const changeMinute = (delta: number) => {
    const h           = isEmpty ? 0 : hour;
    const currentStep = Math.round(minute / minuteStep);
    const nextStep    = ((currentStep + delta) % minuteSteps + minuteSteps) % minuteSteps;
    onChange(`${String(h).padStart(2, '0')}:${String(nextStep * minuteStep).padStart(2, '0')}`);
  };

  // ── 휠 스크롤: 시 1시간, 분 1분 단위 ──
  const handleHourWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isEmpty) { handleInit(); return; }
    changeHour(e.deltaY > 0 ? -1 : 1);
  };

  const handleMinuteWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isEmpty) { handleInit(); return; }
    // 항상 1분 단위 (minuteStep 무시)
    const h    = hour;
    const next = ((minute + (e.deltaY > 0 ? -1 : 1)) + 60) % 60;
    onChange(`${String(h).padStart(2, '0')}:${String(next).padStart(2, '0')}`);
  };

  // ── 패널 열기 ──
  const openPanelFor = (panel: 'hour' | 'minute') => {
    const colRef = panel === 'hour' ? hourColRef : minuteColRef;
    if (colRef.current && wrapperRef.current) {
      const colRect     = colRef.current.getBoundingClientRect();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      setPanelLeft(colRect.left - wrapperRect.left + colRect.width / 2);
    }
    setOpenPanel(prev => (prev === panel ? null : panel));
  };

  const openHourPanel   = () => isEmpty ? handleInit(() => openPanelFor('hour'))   : openPanelFor('hour');
  const openMinutePanel = () => isEmpty ? handleInit(() => openPanelFor('minute')) : openPanelFor('minute');

  // ── 패널 열릴 때: input 세팅 + 선택 항목 스크롤 + input 포커스 ──
  useEffect(() => {
    if (!openPanel) return;
    const current = openPanel === 'hour'
      ? String(isEmpty ? 0 : hour).padStart(2, '0')
      : String(isEmpty ? 0 : minute).padStart(2, '0');
    setPanelInput(current);

    // 선택 항목으로 리스트 스크롤
    requestAnimationFrame(() => {
      if (listRef.current) {
        const el = listRef.current.querySelector(`[data-value="${openPanel === 'hour' ? hour : minute}"]`);
        if (el) (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      panelInputRef.current?.focus();
    });
  }, [openPanel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 패널 input 변경: 입력 시 리스트 스크롤 ──
  const handlePanelInputChange = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 2);
    setPanelInput(clean);
    const n = parseInt(clean, 10);
    if (!isNaN(n) && listRef.current) {
      const el = listRef.current.querySelector(`[data-value="${n}"]`);
      if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // ── 패널 input 확정 ──
  const commitPanelInput = () => {
    const n = parseInt(panelInput, 10);
    if (openPanel === 'hour' && !isNaN(n) && n >= 0 && n <= 23) {
      const m = isEmpty ? 0 : minute;
      onChange(`${String(n).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    } else if (openPanel === 'minute' && !isNaN(n) && n >= 0 && n <= 59) {
      const h = isEmpty ? 0 : hour;
      onChange(`${String(h).padStart(2, '0')}:${String(n).padStart(2, '0')}`);
    }
    setOpenPanel(null);
  };

  const handlePanelInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitPanelInput(); }
    if (e.key === 'Escape') { e.preventDefault(); setOpenPanel(null); }
  };

  // ── 리스트 항목 선택 ──
  const selectHour = (h: number) => {
    const m = isEmpty ? 0 : minute;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setOpenPanel(null);
  };

  const selectMinute = (m: number) => {
    const h = isEmpty ? 0 : hour;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    setOpenPanel(null);
  };

  // ── 외부 클릭 시 패널 닫기 ──
  useEffect(() => {
    if (!openPanel) return;
    const handle = (e: MouseEvent) => {
      if (
        panelRef.current    && !panelRef.current.contains(e.target as Node) &&
        wrapperRef.current  && !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpenPanel(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [openPanel]);

  const handleClear = () => { onChange(''); setOpenPanel(null); };

  // ── 스타일 상수 ──
  const isMd        = size === 'md';
  const numFontSize = isMd ? 18 : 15;
  const spinnerSize = isMd ? 16 : 13;
  const cellW       = isMd ? 48 : 40;
  const cellH       = isMd ? 28 : 22;
  const panelItemH  = isMd ? 34 : 30;
  const panelW      = 80;

  const cellStyle: React.CSSProperties = {
    width: cellW, height: cellH,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: numFontSize, fontWeight: 700,
    cursor: 'pointer', letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
    borderRadius: 4, transition: 'background 0.12s', userSelect: 'none',
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: cellW, height: isMd ? 22 : 18,
    cursor: 'pointer', color: t.textSub,
    background: 'transparent', border: 'none',
    padding: 0, borderRadius: 4, transition: 'color 0.12s', flexShrink: 0,
  };

  // ── 시/분 열 공통 렌더 ──
  const renderCol = (
    type: 'hour' | 'minute',
    colRef: React.RefObject<HTMLDivElement | null>,
    displayVal: number,
    onWheel: (e: React.WheelEvent) => void,
    onInc: () => void,
    onDec: () => void,
    onClickCell: () => void,
  ) => {
    const isActive = openPanel === type;
    return (
      <div
        ref={colRef}
        className="flex flex-col items-center"
        style={{ userSelect: 'none' }}
        onWheel={onWheel}
      >
        <button
          type="button" style={btnStyle}
          onClick={onInc}
          onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
          onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
        >
          <ChevronUp size={spinnerSize} strokeWidth={2.5} />
        </button>

        <div
          style={{
            ...cellStyle,
            background: isActive ? t.accentLight : 'transparent',
            color:      isActive ? t.accent : t.text,
          }}
          onClick={onClickCell}
          onMouseEnter={e => {
            if (!isActive) (e.currentTarget as HTMLElement).style.background = t.accentLight + '80';
          }}
          onMouseLeave={e => {
            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
          title="클릭하여 선택"
        >
          {String(displayVal).padStart(2, '0')}
        </div>

        <button
          type="button" style={btnStyle}
          onClick={onDec}
          onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
          onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
        >
          <ChevronDown size={spinnerSize} strokeWidth={2.5} />
        </button>
      </div>
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>

      {/* ── 메인 피커 UI ── */}
      <div
        className="flex items-center"
        style={{
          border: `1px solid ${openPanel ? t.accent : t.border}`,
          borderRadius: isMd ? 12 : 8,
          backgroundColor: t.bgSub,
          padding: isMd ? '4px 12px' : '2px 8px',
          width: '100%', justifyContent: 'center', gap: 0,
          transition: 'border-color 0.15s',
        }}
      >
        {/* 빈 상태 */}
        {isEmpty && !openPanel ? (
          <button
            type="button"
            onClick={openHourPanel}
            style={{
              flex: 1, padding: isMd ? '10px 0' : '6px 0',
              color: t.textMuted, fontSize: isMd ? 14 : 12,
              background: 'transparent', border: 'none',
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            {placeholder}
          </button>
        ) : (
          <>
            {renderCol(
              'hour', hourColRef,
              isEmpty ? 0 : hour,
              handleHourWheel,
              () => isEmpty ? handleInit() : changeHour(1),
              () => isEmpty ? handleInit() : changeHour(-1),
              openHourPanel,
            )}

            {/* 콜론 */}
            <div style={{
              fontSize: isMd ? 18 : 15, fontWeight: 700,
              color: t.textMuted, padding: '0 3px',
              alignSelf: 'center', paddingBottom: 2, userSelect: 'none',
            }}>:</div>

            {renderCol(
              'minute', minuteColRef,
              isEmpty ? 0 : minute,
              handleMinuteWheel,
              () => isEmpty ? handleInit() : changeMinute(1),
              () => isEmpty ? handleInit() : changeMinute(-1),
              openMinutePanel,
            )}

            {/* 지우기 */}
            <button
              type="button"
              onClick={handleClear}
              style={{
                marginLeft: isMd ? 10 : 6, color: t.textMuted,
                background: 'transparent', border: 'none',
                cursor: 'pointer', padding: 2,
                display: 'flex', alignItems: 'center',
                borderRadius: 4, transition: 'color 0.15s', alignSelf: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = t.text)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
            >
              <X size={isMd ? 13 : 11} strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {/* ── 드롭다운 패널 ── */}
      {openPanel && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: Math.max(0, panelLeft - panelW / 2),
            width: panelW,
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {/* 상단 직접 입력 */}
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${t.border}` }}>
            <input
              ref={panelInputRef}
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={2}
              value={panelInput}
              placeholder={openPanel === 'hour' ? '0–23' : '0–59'}
              onChange={e => handlePanelInputChange(e.target.value)}
              onKeyDown={handlePanelInputKeyDown}
              style={{
                width: '100%',
                fontSize: isMd ? 15 : 13,
                fontWeight: 700,
                color: t.accent,
                background: t.accentLight,
                border: `1.5px solid ${t.accent}`,
                borderRadius: 6,
                textAlign: 'center',
                outline: 'none',
                padding: '4px 0',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.05em',
              }}
            />
            <p style={{
              fontSize: 9, color: t.textMuted,
              textAlign: 'center', marginTop: 3,
              lineHeight: 1,
            }}>
              Enter로 확정
            </p>
          </div>

          {/* 스크롤 리스트 */}
          <div
            ref={listRef}
            style={{
              maxHeight: panelItemH * 5,
              overflowY: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {(openPanel === 'hour' ? hourList : minuteList).map(val => {
              const isSelected = openPanel === 'hour' ? val === hour : val === minute;
              const inputN     = parseInt(panelInput, 10);
              const isTyped    = !isNaN(inputN) && val === inputN && panelInput.length > 0;
              return (
                <button
                  key={val}
                  data-value={val}
                  type="button"
                  onClick={() => openPanel === 'hour' ? selectHour(val) : selectMinute(val)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: panelItemH,
                    fontSize: isMd ? 14 : 12,
                    fontWeight: isSelected || isTyped ? 700 : 400,
                    color: isSelected
                      ? t.accent
                      : isTyped ? t.accent + 'CC' : t.text,
                    backgroundColor: isSelected
                      ? t.accentLight
                      : isTyped ? t.accentLight + '60' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'background 0.08s',
                    letterSpacing: '0.03em',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = t.bgSub;
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = isTyped
                        ? t.accentLight + '60' : 'transparent';
                    }
                  }}
                >
                  {String(val).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
