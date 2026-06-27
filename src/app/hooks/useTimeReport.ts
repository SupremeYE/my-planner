import { useMemo } from 'react';
import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, subMonths, addDays, getDay, isSameDay,
} from 'date-fns';
import { usePlanner } from '../store';
import type { Todo, Tag } from '../store';
import { todoDoDurationSeconds } from '../../lib/todoDoDuration';

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

/** 분 → "X시간 Y분" / "X시간" / "Y분" */
function fmtMin(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

interface RangeAgg {
  byTag: Map<string, { minutes: number; todos: Array<{ name: string; minutes: number; date: string }> }>;
  total: number;
}

/** 한 기간(start~end, yyyy-MM-dd 비교) 동안 시간추적 태그별로 todo DO 시간을 집계 */
function aggregateRange(
  todos: Todo[],
  startStr: string,
  endStr: string,
  trackTagIds: Set<string>,
): RangeAgg {
  const byTag = new Map<string, { minutes: number; todos: Array<{ name: string; minutes: number; date: string }> }>();
  let total = 0;

  for (const todo of todos) {
    if (todo.status !== 'done') continue;
    if (!todo.date || todo.date < startStr || todo.date > endStr) continue;

    const sec = todoDoDurationSeconds(todo);
    if (sec <= 0) continue;

    const matched = (todo.tags ?? []).filter(id => trackTagIds.has(id));
    if (matched.length === 0) continue;

    // 시간추적 태그가 여러 개면 균등 분할
    const minutesEach = sec / 60 / matched.length;

    for (const tagId of matched) {
      const entry = byTag.get(tagId) ?? { minutes: 0, todos: [] };
      entry.minutes += minutesEach;
      entry.todos.push({ name: todo.text, minutes: minutesEach, date: todo.date });
      byTag.set(tagId, entry);
      total += minutesEach;
    }
  }

  return { byTag, total };
}

export function useTimeReport(period: TimeReportPeriod): TimeReportData {
  const { todos, tags, appSettings } = usePlanner();
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
    const trackTagIds = new Set(trackTags.map(t => t.id));

    const cur = aggregateRange(todos, curStartStr, curEndStr, trackTagIds);
    const prev = aggregateRange(todos, fmtD(prevStart), fmtD(prevEnd), trackTagIds);

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
      const dayAgg = aggregateRange(todos, ds, ds, trackTagIds);
      const byCat: Record<string, number> = {};
      dayAgg.byTag.forEach((v, k) => { byCat[k] = v.minutes; });
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
          message: `지난 ${periodWord}보다 ${catName} ${fmtMin(bestDiff)} 늘었어요 💪`,
        };
      } else if (bestId && bestDiff <= -THRESHOLD) {
        insight = {
          type: 'decrease', categoryName: catName, diffMinutes: bestDiff,
          message: `지난 ${periodWord}보다 ${catName} ${fmtMin(Math.abs(bestDiff))} 줄었어요`,
        };
      } else {
        insight = {
          type: 'steady', categoryName: '', diffMinutes: 0,
          message: `이번 ${periodWord}도 꾸준히 ${fmtMin(cur.total)} 활동했어요 ✨`,
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
  }, [period, todos, tags, weekStartsOn]);
}
