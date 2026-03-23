import { useState, useRef, useEffect } from 'react';
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

  // ── 드롭다운 패널 state ──
  const [openPanel, setOpenPanel] = useState<'hour' | 'minute' | null>(null);
  const [panelLeft, setPanelLeft] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // ── value 파싱 ──
  const isEmpty = !value;
  const [hStr, mStr] = value ? value.split(':') : ['00', '00'];
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  const minuteSteps = Math.floor(60 / minuteStep);
  const hourList = Array.from({ length: 24 }, (_, i) => i);
  const minuteList = Array.from({ length: minuteSteps }, (_, i) => i * minuteStep);

  // ── 현재 시각으로 초기화 ──
  const handleInit = (cb?: () => void) => {
    const now = new Date();
    const h = now.getHours();
    const rawM = now.getMinutes();
    const m = Math.round(rawM / minuteStep) * minuteStep % 60;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cb?.();
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

  // ── 휠 스크롤: PC에서 유지 ──
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

  // ── 패널 열기: 클릭한 열의 위치 기준으로 left 계산 ──
  const openHourPanel = () => {
    if (isEmpty) {
      handleInit(() => openPanelFor('hour'));
    } else {
      openPanelFor('hour');
    }
  };

  const openMinutePanel = () => {
    if (isEmpty) {
      handleInit(() => openPanelFor('minute'));
    } else {
      openPanelFor('minute');
    }
  };

  const openPanelFor = (panel: 'hour' | 'minute') => {
    const colRef = panel === 'hour' ? hourColRef : minuteColRef;
    if (colRef.current && wrapperRef.current) {
      const colRect = colRef.current.getBoundingClientRect();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      // 패널을 해당 열의 중심 기준으로 위치
      const colCenter = colRect.left - wrapperRect.left + colRect.width / 2;
      setPanelLeft(colCenter);
    }
    setOpenPanel(prev => (prev === panel ? null : panel));
  };

  // ── 패널 값 선택 ──
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
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        wrapperRef.current && !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpenPanel(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [openPanel]);

  // ── 패널 열릴 때 선택 항목으로 자동 스크롤 ──
  useEffect(() => {
    if (openPanel && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, [openPanel]);

  // ── 지우기 ──
  const handleClear = () => {
    onChange('');
    setOpenPanel(null);
  };

  // ── 스타일 ──
  const isMd = size === 'md';
  const numFontSize = isMd ? 18 : 15;
  const spinnerSize = isMd ? 16 : 13;
  const cellW = isMd ? 48 : 40;
  const cellH = isMd ? 28 : 22;
  const panelItemH = isMd ? 36 : 32;

  const cellStyle: React.CSSProperties = {
    width: cellW,
    height: cellH,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: numFontSize,
    fontWeight: 700,
    color: t.text,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
    borderRadius: 4,
    transition: 'background 0.12s',
    userSelect: 'none',
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

  // 패널 너비: minuteStep=1이면 더 좁게 써도 됨
  const panelW = 68;

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
          width: '100%',
          justifyContent: 'center',
          gap: 0,
          transition: 'border-color 0.15s',
        }}
      >
        {/* 빈 상태: placeholder */}
        {isEmpty && !openPanel ? (
          <button
            type="button"
            onClick={openHourPanel}
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
            {/* 시(Hour) 열 */}
            <div
              ref={hourColRef}
              className="flex flex-col items-center"
              style={{ userSelect: 'none' }}
              onWheel={handleHourWheel}
            >
              <button
                type="button"
                style={btnStyle}
                onClick={() => { if (isEmpty) handleInit(); else changeHour(1); }}
                onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
              >
                <ChevronUp size={spinnerSize} strokeWidth={2.5} />
              </button>

              <div
                style={{
                  ...cellStyle,
                  background: openPanel === 'hour' ? t.accentLight : 'transparent',
                  color: openPanel === 'hour' ? t.accent : t.text,
                }}
                onClick={openHourPanel}
                onMouseEnter={e => {
                  if (openPanel !== 'hour') (e.currentTarget as HTMLElement).style.background = t.accentLight + '80';
                }}
                onMouseLeave={e => {
                  if (openPanel !== 'hour') (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                title="클릭하여 선택"
              >
                {String(isEmpty ? 0 : hour).padStart(2, '0')}
              </div>

              <button
                type="button"
                style={btnStyle}
                onClick={() => { if (isEmpty) handleInit(); else changeHour(-1); }}
                onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
              >
                <ChevronDown size={spinnerSize} strokeWidth={2.5} />
              </button>
            </div>

            {/* 콜론 */}
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

            {/* 분(Minute) 열 */}
            <div
              ref={minuteColRef}
              className="flex flex-col items-center"
              style={{ userSelect: 'none' }}
              onWheel={handleMinuteWheel}
            >
              <button
                type="button"
                style={btnStyle}
                onClick={() => { if (isEmpty) handleInit(); else changeMinute(1); }}
                onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
              >
                <ChevronUp size={spinnerSize} strokeWidth={2.5} />
              </button>

              <div
                style={{
                  ...cellStyle,
                  background: openPanel === 'minute' ? t.accentLight : 'transparent',
                  color: openPanel === 'minute' ? t.accent : t.text,
                }}
                onClick={openMinutePanel}
                onMouseEnter={e => {
                  if (openPanel !== 'minute') (e.currentTarget as HTMLElement).style.background = t.accentLight + '80';
                }}
                onMouseLeave={e => {
                  if (openPanel !== 'minute') (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                title="클릭하여 선택"
              >
                {String(isEmpty ? 0 : minute).padStart(2, '0')}
              </div>

              <button
                type="button"
                style={btnStyle}
                onClick={() => { if (isEmpty) handleInit(); else changeMinute(-1); }}
                onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
              >
                <ChevronDown size={spinnerSize} strokeWidth={2.5} />
              </button>
            </div>

            {/* 지우기 */}
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

      {/* ── 드롭다운 선택 패널 ── */}
      {openPanel && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: panelLeft - panelW / 2,
            width: panelW,
            maxHeight: panelItemH * 5.5,
            overflowY: 'auto',
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
            zIndex: 200,
            scrollbarWidth: 'none',
          }}
        >
          <style>{`.tp-panel::-webkit-scrollbar { display: none; }`}</style>
          <div className="tp-panel" style={{ overflowY: 'auto', maxHeight: panelItemH * 5.5 }}>
            {(openPanel === 'hour' ? hourList : minuteList).map(val => {
              const isSelected = openPanel === 'hour' ? val === hour : val === minute;
              return (
                <button
                  key={val}
                  ref={isSelected ? selectedItemRef : undefined}
                  type="button"
                  onClick={() => openPanel === 'hour' ? selectHour(val) : selectMinute(val)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: panelItemH,
                    fontSize: isMd ? 15 : 13,
                    fontWeight: isSelected ? 700 : 400,
                    color: isSelected ? t.accent : t.text,
                    backgroundColor: isSelected ? t.accentLight : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'background 0.1s, color 0.1s',
                    letterSpacing: '0.03em',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = t.bgSub;
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
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
