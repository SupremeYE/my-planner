import { useMemo } from 'react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, subMonths, addDays, getDay, isSameDay,
} from 'date-fns';
import { usePlanner } from '../store';
import type { Todo, Tag, Event, TodoTimeBlock } from '../store';
import { aggregateActivity, formatMinutes } from '../../lib/timeAggregation';

export type TimeReportPeriod = 'week' | 'month';

export interface TimeReportData {
  period: TimeReportPeriod;
  dateRange: { start: string; end: string };

  /** track_time ON 태그만, 시간 많은 순 정렬 (실적 0분 카테고리는 제외) */
  byCategory: Array<{
    tagId: string;
    tagName: string;
    tagColor: string;
    totalMinutes: number;
    todoCount: number;
    todos: Array<{ name: string; minutes: number; date: string }>;
  }>;

  totalMinutes: number;

  /** 기간 내 일별 데이터 (주간=7일, 월간=해당 월 전체일) */
  daily: Array<{
    date: string;
    dayLabel: string;
    isToday: boolean;
    byCategory: Record<string, number>; // tagId → minutes
    totalMinutes: number;
  }>;

  insight: {
    type: 'increase' | 'decrease' | 'steady' | 'none';
    categoryName: string;
    diffMinutes: number;
    message: string;
  } | null;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

interface RangeAgg {
  byTag: Map<string, { minutes: number; todos: Array<{ name: string; minutes: number; date: string }> }>;
  total: number;
}

/**
 * 한 기간의 시간추적 태그별 DO 시간 집계 — 공용 엔진 aggregateActivity 로 위임한다.
 * 「시간 리포트」와 리뷰의 「시간 스트립」이 **같은 함수**를 호출하게 만드는 것이 이 통일의 목적.
 * (시간 축만 쓰는 어댑터: byTag 의 timeItems 를 기존 todos 필드명으로 노출.)
 */
function aggregateRange(
  todos: Todo[],
  events: Event[],
  tags: Tag[],
  startStr: string,
  endStr: string,
  timeBlocks: TodoTimeBlock[] = [],
): RangeAgg {
  const agg = aggregateActivity(todos, events, tags, startStr, endStr, timeBlocks);
  const byTag: RangeAgg['byTag'] = new Map();
  agg.byTag.forEach((v, id) => byTag.set(id, { minutes: v.minutes, todos: v.timeItems }));
  return { byTag, total: agg.totalMinutes };
}

export function useTimeReport(period: TimeReportPeriod): TimeReportData {
  const { todos, events, timeBlocks, tags, appSettings } = usePlanner();
  const weekStartsOn = (appSettings.weekStartsOn ?? 1) as 0 | 1;

  return useMemo<TimeReportData>(() => {
    const now = new Date();

    const curStart = period === 'week'
      ? startOfWeek(now, { weekStartsOn })
      : startOfMonth(now);
    const curEnd = period === 'week'
      ? endOfWeek(now, { weekStartsOn })
      : endOfMonth(now);

    const prevRef = period === 'week' ? subWeeks(now, 1) : subMonths(now, 1);
    const prevStart = period === 'week'
      ? startOfWeek(prevRef, { weekStartsOn })
      : startOfMonth(prevRef);
    const prevEnd = period === 'week'
      ? endOfWeek(prevRef, { weekStartsOn })
      : endOfMonth(prevRef);

    const fmtD = (d: Date) => format(d, 'yyyy-MM-dd');
    const curStartStr = fmtD(curStart);
    const curEndStr = fmtD(curEnd);

    const trackTags: Tag[] = tags.filter(t => t.trackTime);
    const tagMap = new Map(trackTags.map(t => [t.id, t]));

    const cur = aggregateRange(todos, events, tags, curStartStr, curEndStr, timeBlocks);
    const prev = aggregateRange(todos, events, tags, fmtD(prevStart), fmtD(prevEnd), timeBlocks);

    // ── byCategory (실적 있는 카테고리만, 시간 많은 순) ──
    const byCategory = Array.from(cur.byTag.entries())
      .map(([tagId, v]) => {
        const tag = tagMap.get(tagId);
        return {
          tagId,
          tagName: tag?.name ?? '(삭제된 태그)',
          tagColor: tag?.color ?? '#999999',
          totalMinutes: v.minutes,
          todoCount: v.todos.length,
          todos: v.todos.sort((a, b) => b.minutes - a.minutes),
        };
      })
      .filter(c => c.totalMinutes > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    // ── daily ──
    const dayCount = period === 'week'
      ? 7
      : Math.round((curEnd.getTime() - curStart.getTime()) / 86400000) + 1;
    const daily = Array.from({ length: dayCount }, (_, i) => {
      const d = addDays(curStart, i);
      const ds = fmtD(d);
      const dayAgg = aggregateRange(todos, events, tags, ds, ds, timeBlocks);
      const byCat: Record<string, number> = {};
      dayAgg.byTag.forEach((v, k) => { if (v.minutes > 0) byCat[k] = v.minutes; });
      return {
        date: ds,
        dayLabel: period === 'week' ? WEEKDAY_KO[getDay(d)] : String(d.getDate()),
        isToday: isSameDay(d, now),
        byCategory: byCat,
        totalMinutes: dayAgg.total,
      };
    });

    // ── insight (이전 동일 기간 대비 변화폭 가장 큰 카테고리) ──
    const periodWord = period === 'week' ? '주' : '달';
    let insight: TimeReportData['insight'];

    if (cur.total <= 0) {
      insight = { type: 'none', categoryName: '', diffMinutes: 0, message: '아직 이번 기간 기록이 없어요' };
    } else {
      const allIds = new Set<string>([...cur.byTag.keys(), ...prev.byTag.keys()]);
      let bestId = '';
      let bestDiff = 0;
      allIds.forEach(id => {
        const diff = (cur.byTag.get(id)?.minutes ?? 0) - (prev.byTag.get(id)?.minutes ?? 0);
        if (Math.abs(diff) > Math.abs(bestDiff)) { bestDiff = diff; bestId = id; }
      });

      const catName = tagMap.get(bestId)?.name ?? '';
      const THRESHOLD = 5; // 분: 이 미만 변화는 "꾸준함"으로 간주

      if (bestId && bestDiff >= THRESHOLD) {
        insight = {
          type: 'increase', categoryName: catName, diffMinutes: bestDiff,
          message: `지난 ${periodWord}보다 ${catName} ${formatMinutes(bestDiff)} 늘었어요 💪`,
        };
      } else if (bestId && bestDiff <= -THRESHOLD) {
        insight = {
          type: 'decrease', categoryName: catName, diffMinutes: bestDiff,
          message: `지난 ${periodWord}보다 ${catName} ${formatMinutes(Math.abs(bestDiff))} 줄었어요`,
        };
      } else {
        insight = {
          type: 'steady', categoryName: '', diffMinutes: 0,
          message: `이번 ${periodWord}도 꾸준히 ${formatMinutes(cur.total)} 활동했어요 ✨`,
        };
      }
    }

    return {
      period,
      dateRange: { start: curStartStr, end: curEndStr },
      byCategory,
      totalMinutes: cur.total,
      daily,
      insight,
    };
  }, [period, todos, events, timeBlocks, tags, weekStartsOn]);
}
