import { useMemo } from 'react';
import {
  parseISO, subDays, differenceInCalendarDays, startOfMonth, endOfMonth, subMonths, format,
} from 'date-fns';
import { usePlanner, getLogicalToday } from '../store';
import { buildActivityInsights } from '../../lib/timeAggregation';

/**
 * 문장형 인사이트(최대 3줄, 공백 알림 우선)를 기간에서 계산하는 공용 훅.
 * 「시간 리포트」와 리뷰 「스트립」이 같은 문장을 내도록 단일 출처로 둔다.
 * period 미지정 시 범위 길이로 주/월 추정(week ≈ 7일 이하).
 */
export function useActivityInsights(startStr: string, endStr: string, period?: 'week' | 'month'): string[] {
  const { todos, events, tags } = usePlanner();
  return useMemo(() => {
    const span = differenceInCalendarDays(parseISO(endStr), parseISO(startStr)) + 1;
    const p: 'week' | 'month' = period ?? (span <= 10 ? 'week' : 'month');
    let prevStart: string; let prevEnd: string;
    if (p === 'week') {
      prevStart = format(subDays(parseISO(startStr), span), 'yyyy-MM-dd');
      prevEnd = format(subDays(parseISO(endStr), span), 'yyyy-MM-dd');
    } else {
      const prevRef = subMonths(parseISO(startStr), 1);
      prevStart = format(startOfMonth(prevRef), 'yyyy-MM-dd');
      prevEnd = format(endOfMonth(prevRef), 'yyyy-MM-dd');
    }
    return buildActivityInsights({
      todos, events, tags, period: p,
      curStart: startStr, curEnd: endStr, prevStart, prevEnd,
      todayStr: getLogicalToday(),
    });
  }, [todos, events, tags, startStr, endStr, period]);
}
