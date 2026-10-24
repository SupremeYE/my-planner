import type { ActivityEntry } from './activityEntries';
import { parseISO } from 'date-fns';
import type { Todo, Event, Tag, WeeklyGoal, TodoTimeBlock } from '../app/store';
import { expandRecurringTodos, isVirtualTodoId } from './recurrenceExpansion';
import { periodCoversDate } from './todoPeriod';
import { getWeekKey, weekKeysMatch } from './weekKeys';
import { weeklyRollup, combineRollups } from '../app/components/period/periodProgress';
import { aggregateActivity } from './timeAggregation';

/** A read-only projection. Provider events have already been expanded by api/events.
 * Do not expand them again: doing so would copy actuals to planned occurrences.
 * Multi-day all-day spans follow CalendarView's inclusive date convention.
 */
export function moaTodayData(date: string, todos: Todo[], goals: WeeklyGoal[], events: Event[], tags: Tag[], blocks: TodoTimeBlock[], activities: ActivityEntry[] = [], actualEvents: Event[] = events) {
  const weekKey = getWeekKey(parseISO(date));
  const weeks = goals.filter(goal => weekKeysMatch(goal.weekKey, weekKey))
    .map(goal => ({ goal, progress: weeklyRollup(goal, todos) }));
  const dayTodos = expandRecurringTodos(todos, date, date)
    // Expanded occurrences own their instance date. Legacy parents/exceptions can
    // retain an origin endDate; do not rewrite that stored value during a read.
    .filter(todo => (isVirtualTodoId(todo.id) || todo.recurrenceParentId
      ? todo.date === date : periodCoversDate(todo, date)) && todo.status !== 'backlog' && todo.status !== 'cancelled');
  // Keep the three selected IDs stable while checking them off (no replacement on completion).
  const top3 = dayTodos.filter(todo => todo.isTop3).slice(0, 3);
  const dayEvents = events.filter(event => event.date === date || (
    event.isAllDay && !event.isOccurrence && periodCoversDate({ date: event.startDate ?? event.date, endDate: event.endDate }, date)
  )).sort((a, b) => Number(!!b.isAllDay) - Number(!!a.isAllDay) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  return { weeks, weekProgress: combineRollups(weeks.map(row => row.progress)), top3, dayTodos, dayEvents,
    activity: aggregateActivity(todos, actualEvents, tags, date, date, blocks, activities) };
}

export function moaMinutes(minutes: number): string {
  if (minutes === 0) return '0분';
  if (minutes < 1) return '1분 미만';
  const rounded = Math.floor(minutes);
  return rounded < 60 ? `${rounded}분` : `${Math.floor(rounded / 60)}시간${rounded % 60 ? ` ${rounded % 60}분` : ''}`;
}
