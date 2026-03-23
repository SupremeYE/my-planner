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

  const isEmpty = !value;
  const [hStr, mStr] = value ? value.split(':') : ['00', '00'];
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  // 분 단계 배열 (0, 5, 10, ..., 55)
  const minuteSteps = Math.floor(60 / minuteStep);

  const setHour = (delta: number) => {
    const base = isEmpty ? 0 : hour;
    const next = ((base + delta) % 24 + 24) % 24;
    const m = isEmpty ? 0 : minute;
    onChange(`${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const setMinute = (delta: number) => {
    const h = isEmpty ? 0 : hour;
    const currentStep = Math.round(minute / minuteStep);
    const nextStep = ((currentStep + delta) % minuteSteps + minuteSteps) % minuteSteps;
    const nextMin = nextStep * minuteStep;
    onChange(`${String(h).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`);
  };

  const handleClear = () => onChange('');

  // 시간이 비어있을 때 클릭하면 현재 시간(5분 단위 반올림)으로 초기화
  const handleInit = () => {
    const now = new Date();
    const h = now.getHours();
    const rawM = now.getMinutes();
    const m = Math.round(rawM / minuteStep) * minuteStep % 60;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const isMd = size === 'md';

  const cellStyle: React.CSSProperties = {
    width: isMd ? 48 : 40,
    textAlign: 'center',
    fontSize: isMd ? 18 : 15,
    fontWeight: 700,
    color: isEmpty ? t.textMuted : t.text,
    lineHeight: 1,
    padding: isMd ? '6px 0' : '4px 0',
    cursor: 'default',
    letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: isMd ? 48 : 40,
    height: isMd ? 24 : 20,
    cursor: 'pointer',
    color: isEmpty ? t.textMuted : t.textSub,
    background: 'transparent',
    border: 'none',
    padding: 0,
    borderRadius: 6,
    transition: 'color 0.15s, background 0.15s',
  };

  const spinnerSize = isMd ? 16 : 13;
  const colonSize = isMd ? 18 : 15;

  return (
    <div
      className="flex items-center"
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: isMd ? 12 : 8,
        backgroundColor: t.bgSub,
        padding: isMd ? '4px 12px' : '2px 10px',
        gap: 0,
        width: '100%',
        justifyContent: 'center',
      }}
    >
      {/* 빈 상태: 클릭으로 초기화 */}
      {isEmpty ? (
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
          {/* Hour 스피너 */}
          <div className="flex flex-col items-center" style={{ userSelect: 'none' }}>
            <button
              type="button"
              style={btnStyle}
              onClick={() => setHour(1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronUp size={spinnerSize} strokeWidth={2.5} />
            </button>
            <div style={cellStyle}>{String(hour).padStart(2, '0')}</div>
            <button
              type="button"
              style={btnStyle}
              onClick={() => setHour(-1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronDown size={spinnerSize} strokeWidth={2.5} />
            </button>
          </div>

          {/* 콜론 */}
          <div
            style={{
              fontSize: colonSize,
              fontWeight: 700,
              color: t.textMuted,
              padding: '0 4px',
              lineHeight: 1,
              alignSelf: 'center',
              paddingBottom: 2,
            }}
          >
            :
          </div>

          {/* Minute 스피너 */}
          <div className="flex flex-col items-center" style={{ userSelect: 'none' }}>
            <button
              type="button"
              style={btnStyle}
              onClick={() => setMinute(1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronUp size={spinnerSize} strokeWidth={2.5} />
            </button>
            <div style={cellStyle}>{String(minute).padStart(2, '0')}</div>
            <button
              type="button"
              style={btnStyle}
              onClick={() => setMinute(-1)}
              onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = t.textSub)}
            >
              <ChevronDown size={spinnerSize} strokeWidth={2.5} />
            </button>
          </div>

          {/* 지우기 버튼 */}
          <button
            type="button"
            onClick={handleClear}
            style={{
              marginLeft: isMd ? 10 : 8,
              color: t.textMuted,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              transition: 'color 0.15s',
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
