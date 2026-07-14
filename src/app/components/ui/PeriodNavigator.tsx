import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { periodStepperStyle } from '../../styles/haonStyles';
import { SegmentedControl } from './SegmentedControl';
import { canGoNext, canGoPrev, getPeriodRange, type PeriodUnit } from '../../lib/periodNav';

export interface PeriodNavigatorProps {
  /** 제공 단위 — 2개 이상이면 세그먼트 노출, 1개면 스테퍼만(예: 수면=['주']). 기본 주/월/년. */
  units?: PeriodUnit[];
  unit: PeriodUnit;
  onUnitChange?: (u: PeriodUnit) => void;
  offset: number;                       // 0=현재 기간, -1=이전 ...
  onOffsetChange: (o: number) => void;
  weekStartsOn?: 0 | 1;
  firstRecordDate?: string | null;      // yyyy-MM-dd — 첫 기록에서 과거 이동 정지
  className?: string;
}

/**
 * 기간 네비게이터 — DESIGN.md §5 "Period navigator" 구현.
 * [주/월/년 세그먼트(<SegmentedControl> 재사용)] + [‹ 기간 라벨 › 스테퍼].
 * 미래 차단(offset≥0)·첫 기록 정지·단위 전환 시 offset=0 리셋을 내장. 라벨/기간은 periodNav 단일 출처.
 * 스코프 Theme H·토큰만(스테퍼 표면 isHaon 게이팅), 비-H 폴백 유지.
 */
export function PeriodNavigator({
  units = ['주', '월', '년'],
  unit,
  onUnitChange,
  offset,
  onOffsetChange,
  weekStartsOn = 1,
  firstRecordDate,
  className,
}: PeriodNavigatorProps) {
  const { t } = useTheme();
  const opts = { weekStartsOn };
  const range = getPeriodRange(unit, offset, opts);
  const prevOk = canGoPrev(unit, offset, firstRecordDate, opts);
  const nextOk = canGoNext(offset);

  const handleUnit = (u: PeriodUnit) => {
    if (u === unit) return;
    onUnitChange?.(u);
    onOffsetChange(0); // 단위 전환 시 현재 기간으로 리셋
  };

  return (
    <div className={className}>
      {units.length > 1 && (
        <SegmentedControl<PeriodUnit>
          options={units.map(u => ({ label: u, value: u }))}
          value={unit}
          onChange={handleUnit}
          className="mb-3"
        />
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => prevOk && onOffsetChange(offset - 1)}
          disabled={!prevOk}
          aria-label="이전 기간"
          className="p-1.5 rounded-lg"
          style={periodStepperStyle(t, !prevOk)}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: t.fontLabel }}>
          {range.label}
        </div>
        <button
          type="button"
          onClick={() => nextOk && onOffsetChange(offset + 1)}
          disabled={!nextOk}
          aria-label="다음 기간"
          className="p-1.5 rounded-lg"
          style={periodStepperStyle(t, !nextOk)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
