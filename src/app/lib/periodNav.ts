// 기간 네비게이터 — 달력 고정 기간 계산 단일 출처(single source of truth).
// 몸무게·수면이 공유. 주/월/년 단위 + offset(0=현재 기간, -1=이전, ...)로 달력 경계 기간을 만든다.
// DESIGN.md §5 "Period navigator" 계약 구현.
import {
  format, addDays, startOfWeek, startOfMonth, endOfMonth, addMonths,
  startOfYear, endOfYear, addYears,
} from 'date-fns';

export type PeriodUnit = '주' | '월' | '년';

export interface PeriodRange {
  start: string;      // yyyy-MM-dd (포함)
  end: string;        // yyyy-MM-dd (포함)
  startDate: Date;
  endDate: Date;
  label: string;      // 주 "이번 주 M.DD–M.DD" / 월 "YYYY년 M월" / 년 "YYYY"
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
// M.DD (예: 7.13) — 월은 그대로, 일은 2자리 패딩
const mdd = (d: Date) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;

export interface PeriodOpts {
  weekStartsOn?: 0 | 1;   // 주 시작 요일(전역 설정). 기본 월요일(1)
  ref?: Date;             // 기준 '오늘'
}

// unit·offset → 달력 경계 기간(시작·끝 포함) + 라벨.
export function getPeriodRange(unit: PeriodUnit, offset: number, opts: PeriodOpts = {}): PeriodRange {
  const weekStartsOn = opts.weekStartsOn ?? 1;
  const ref = opts.ref ?? new Date();

  let startDate: Date, endDate: Date, label: string;

  if (unit === '주') {
    const base = startOfWeek(ref, { weekStartsOn });
    startDate = addDays(base, offset * 7);
    endDate = addDays(startDate, 6);
    const range = `${mdd(startDate)}–${mdd(endDate)}`;
    label = offset === 0 ? `이번 주 ${range}` : offset === -1 ? `지난 주 ${range}` : range;
  } else if (unit === '월') {
    const m = addMonths(startOfMonth(ref), offset);
    startDate = startOfMonth(m);
    endDate = endOfMonth(m);
    label = `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월`;
  } else {
    const y = addYears(startOfYear(ref), offset);
    startDate = startOfYear(y);
    endDate = endOfYear(y);
    label = `${startDate.getFullYear()}`;
  }

  return { start: fmt(startDate), end: fmt(endDate), startDate, endDate, label };
}

// 미래 차단: offset >= 0(현재/이후)이면 다음(›) 불가 — 오늘 이후 기간으로 못 감.
// 뒤로(‹)는 항상 허용(달력처럼 과거 자유 탐색, 기록 0건이어도 이동 가능) — 하한 클램프 없음.
export function canGoNext(offset: number): boolean {
  return offset < 0;
}
