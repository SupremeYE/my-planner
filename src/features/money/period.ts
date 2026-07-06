// 하온 머니 — 예산 기간 계산 단일 출처(single source of truth).
// 캘린더 · 요약 · 차트 · 예산 진행률이 모두 이 함수를 사용해 동일한 기간을 본다.
//  · payday  : 급여일 ~ 다음 급여일 전날 (예: 25일 → 6/25 ~ 7/24)
//  · calendar: 1일 ~ 말일
import { format, startOfMonth, endOfMonth, addDays, differenceInCalendarDays } from 'date-fns';
import type { MoneySettings } from './types';

export interface MoneyPeriod {
  start: string;     // 'yyyy-MM-dd' (포함)
  end: string;       // 'yyyy-MM-dd' (포함)
  label: string;     // '7월' 등(기간 대부분이 속한 월)
  startDate: Date;
  endDate: Date;
  totalDays: number; // 기간 총 일수
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

// 해당 월(y, m)의 말일 이하로 day 를 클램프 — 급여일 31 등 말일 오버플로 방지.
//  · new Date(y, m+1, 0) = 그 달 마지막 날. m 이 12/−1 이어도 JS Date 가 연도까지 정규화.
function clampDayInMonth(y: number, m: number, day: number): number {
  const last = new Date(y, m + 1, 0).getDate();
  return Math.min(day, last);
}

export function getMoneyPeriod(settings: MoneySettings, ref: Date = new Date()): MoneyPeriod {
  const y = ref.getFullYear(), m = ref.getMonth();
  let startDate: Date, endDate: Date;
  if (settings.periodType === 'calendar') {
    startDate = startOfMonth(ref);
    endDate = endOfMonth(ref);
  } else {
    // 급여일 1~31 허용(각 달 말일로 클램프 — 2월/30일 달 자동 보정).
    const pd = Math.min(Math.max(Math.round(settings.payday || 1), 1), 31);
    const curDay = clampDayInMonth(y, m, pd);
    if (ref.getDate() >= curDay) {
      startDate = new Date(y, m, curDay);
      endDate = addDays(new Date(y, m + 1, clampDayInMonth(y, m + 1, pd)), -1);
    } else {
      startDate = new Date(y, m - 1, clampDayInMonth(y, m - 1, pd));
      endDate = addDays(new Date(y, m, curDay), -1);
    }
  }
  const totalDays = differenceInCalendarDays(endDate, startDate) + 1;
  // 라벨: 기간의 "중간 날짜"가 속한 월 — 급여일 기준(6/25~7/24)도 대부분이 7월이면 '7월'로 표시.
  const midDate = addDays(startDate, Math.floor((totalDays - 1) / 2));
  return {
    start: fmt(startDate), end: fmt(endDate),
    label: `${midDate.getMonth() + 1}월`,
    startDate, endDate, totalDays,
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

// ── 주(week) 분할 — 회고(Plan-Stage 2)용 ──
// 기간을 "달력 주(週)" 경계(전역 설정의 주 시작 요일)에 맞춰 쪼갠다.
//  · 기간 시작·끝이 주 중간이면 첫 주/마지막 주는 부분 주(7일 미만)일 수 있음.
//  · 예) 급여일 25일 기간 6/25~7/24, 월요일 시작 →
//      1주차 6/25~6/28, 2주차 6/29~7/5, 3주차 7/6~7/12(=이번 주), … 5주차 7/20~7/24.
//  · 요일 기준을 앱 전역(캘린더 '주 시작 요일')과 통일해 일간/주간/캘린더가 같은 주를 본다.
export interface MoneyWeek {
  index: number;      // 1-based 주차
  start: string;      // 'yyyy-MM-dd' (포함)
  end: string;        // 'yyyy-MM-dd' (포함)
  startDate: Date;
  endDate: Date;
  totalDays: number;  // 이 주의 일수(첫/마지막 주는 7 미만일 수 있음)
}

export function getMoneyWeeks(period: MoneyPeriod, weekStartsOn: 0 | 1 = 1): MoneyWeek[] {
  const weeks: MoneyWeek[] = [];
  let cursor = period.startDate;
  let index = 1;
  while (cursor <= period.endDate) {
    // cursor 가 속한 달력 주의 마지막 날까지 남은 일수(주 시작 요일 기준).
    const offsetFromWeekStart = (cursor.getDay() - weekStartsOn + 7) % 7;
    const rawEnd = addDays(cursor, 6 - offsetFromWeekStart);
    const endDate = rawEnd > period.endDate ? period.endDate : rawEnd;
    weeks.push({
      index, start: fmt(cursor), end: fmt(endDate), startDate: cursor, endDate,
      totalDays: differenceInCalendarDays(endDate, cursor) + 1,
    });
    cursor = addDays(endDate, 1);
    index++;
  }
  return weeks;
}

// 오늘(ref)이 속한 주차. 기간 밖이면 null(이전 기간 보는 중 등).
export function currentWeek(weeks: MoneyWeek[], ref: Date = new Date()): MoneyWeek | null {
  const today = fmt(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  return weeks.find(w => today >= w.start && today <= w.end) ?? null;
}
