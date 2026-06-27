// 하온 머니 — 예산 기간 계산 단일 출처(single source of truth).
// 캘린더 · 요약 · 차트 · 예산 진행률이 모두 이 함수를 사용해 동일한 기간을 본다.
//  · payday  : 급여일 ~ 다음 급여일 전날 (예: 25일 → 6/25 ~ 7/24)
//  · calendar: 1일 ~ 말일
import { format, startOfMonth, endOfMonth, addDays, differenceInCalendarDays } from 'date-fns';
import type { MoneySettings } from './types';

export interface MoneyPeriod {
  start: string;     // 'yyyy-MM-dd' (포함)
  end: string;       // 'yyyy-MM-dd' (포함)
  label: string;     // '6월' 등(시작 기준 월)
  startDate: Date;
  endDate: Date;
  totalDays: number; // 기간 총 일수
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export function getMoneyPeriod(settings: MoneySettings, ref: Date = new Date()): MoneyPeriod {
  const y = ref.getFullYear(), m = ref.getMonth();
  let startDate: Date, endDate: Date;
  if (settings.periodType === 'calendar') {
    startDate = startOfMonth(ref);
    endDate = endOfMonth(ref);
  } else {
    // payday 는 1~28 로 클램프(말일 오버플로 방지)
    const d = Math.min(Math.max(settings.payday || 1, 1), 28);
    if (ref.getDate() >= d) { startDate = new Date(y, m, d); endDate = addDays(new Date(y, m + 1, d), -1); }
    else { startDate = new Date(y, m - 1, d); endDate = addDays(new Date(y, m, d), -1); }
  }
  return {
    start: fmt(startDate), end: fmt(endDate),
    label: `${startDate.getMonth() + 1}월`,
    startDate, endDate,
    totalDays: differenceInCalendarDays(endDate, startDate) + 1,
  };
}

// 오늘(ref) 기준 기간 종료까지 남은 일수(D-day). 오늘 포함하지 않고 "남은" 일수.
export function daysLeftInPeriod(period: MoneyPeriod, ref: Date = new Date()): number {
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.max(0, differenceInCalendarDays(period.endDate, refDay));
}

// 날짜가 기간 안에 있는지.
export function isInPeriod(date: string, period: MoneyPeriod): boolean {
  return date >= period.start && date <= period.end;
}
