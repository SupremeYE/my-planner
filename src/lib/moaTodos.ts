import { endOfISOWeek, format, parseISO, startOfISOWeek } from 'date-fns';
import type { Todo, Tag, WeeklyGoal, TodoTimeBlock } from '../app/store';
import { expandRecurringTodos, isVirtualTodoId } from './recurrenceExpansion';
import { todoEndDate } from './todoPeriod';
import { getWeekKey, weekKeysMatch } from './weekKeys';
import { aggregateActivity } from './timeAggregation';
import { SaveFailure } from './saveCoordinator';

export const MOA_CATEGORIES = [{ id: 'work', name: '업무' }, { id: 'life', name: '라이프' }, { id: 'project', name: '개인 프로젝트' }];
export const TIME_TAG_SUGGESTIONS = ['업무', '자기계발', '개인 프로젝트', '운동', '생활', '휴식'];
export function categoryLabel(value?: string) { return MOA_CATEGORIES.find(c => c.id === value || c.name === value)?.name ?? value ?? '구분 없음'; }
export function isRecurringMoaTodo(todo: Todo) { return !!(isVirtualTodoId(todo.id) || todo.recurrenceParentId || todo.recurrenceRule || todo.recurrenceFreq); }
export function selectedTimeTags(ids: string[] = [], tags: Tag[]) { return tags.filter(tag => tag.trackTime && ids.includes(tag.id)); }
export function timeTagLabel(todo: Todo, tags: Tag[]) {
  const matched = selectedTimeTags(todo.tags, tags);
  return matched.length > 1 ? `${matched.map(tag => tag.name).join(' · ')} · 균등 분할` : matched[0]?.name ?? '미분류';
}
export function moaTodoList(todos: Todo[], goals: WeeklyGoal[], date: string, scope: 'today' | 'week' | 'undated') {
  if (scope === 'undated') return todos.filter(todo => !todo.date && !todo.recurrenceParentId && !todo.recurrenceRule && !todo.recurrenceFreq);
  const start = scope === 'today' ? date : format(startOfISOWeek(parseISO(date)), 'yyyy-MM-dd');
  const end = scope === 'today' ? date : format(endOfISOWeek(parseISO(date)), 'yyyy-MM-dd');
  const weekGoalIds = new Set(goals.filter(g => weekKeysMatch(g.weekKey, getWeekKey(parseISO(date)))).map(g => g.id));
  return expandRecurringTodos(todos, start, end).filter(todo => {
    if (!todo.date) return scope === 'week' && !!todo.weeklyGoalId && weekGoalIds.has(todo.weeklyGoalId);
    if (isRecurringMoaTodo(todo)) return todo.date >= start && todo.date <= end;
    return todo.date <= end && (todoEndDate(todo) ?? todo.date) >= start;
  });
}

/** Snapshot only the already-known legacy actual when the first dated block is added.
 * A duration-only new entry never receives invented clock times.
 */
export function preservedLegacyBlock(todo: Todo, existing: TodoTimeBlock[], id: string): TodoTimeBlock | undefined {
  if (existing.length) return undefined;
  const hasLegacy = todo.doElapsedSec != null ? todo.doElapsedSec !== 0 : !!(todo.doStart || todo.doEnd);
  if (!hasLegacy) return undefined;
  if (!todo.date) throw new SaveFailure('기존 실적의 작업 날짜를 확인해야 해요. 날짜를 확인한 뒤 기록해주세요.', false);
  const agg = aggregateActivity([todo], [], [], todo.date, todo.date);
  if (agg.coverage.unresolvedItems.length) throw new SaveFailure('기존 실적의 시각이 불명확해요. 기존 기록을 먼저 확인해주세요.', false);
  const seconds = agg.coverage.recordedMinutes * 60;
  return seconds > 0 ? { id, todoId: todo.id, date: todo.date, start: todo.doStart, end: todo.doEnd, elapsedSec: seconds } : undefined;
}
export async function legacyBlockId(todoId: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`moamoa:preserve-legacy-time:${todoId}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 128; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
