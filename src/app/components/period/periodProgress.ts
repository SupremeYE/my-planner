// 기간별 목표 진행률 유틸 — Phase 2 / Phase 5
// 정의:
//  - weekly%: 연결된 todos 완료/전체. todos 가 0 개면 weeklyGoal.done 으로 폴백(100/0).
//  - monthly%: 연결 주간들의 가중 합. 주간이 없으면 월말 회고의 수동 달성으로 폴백.
//  - annual%: 그 연간에 연결된 월간들의 todos 를 합산. 월간이 0 개면 0.
// "총합 비율" 방식 — 큰 주간(많은 todos)이 비중을 더 갖는다.

import type { Todo, WeeklyGoal, MonthlyGoal, AnnualGoal } from '../../store';

// 진행률 계산에서 제외할 todos 상태 — 백로그/취소는 분모에서 빠진다.
// 날짜가 없어도 목표에 연결된 TODO는 포함한다. 제외 상태만 분모에서 뺀다.
export const isEffectiveGoalTodo = (t: Todo) => t.status !== 'backlog' && t.status !== 'cancelled';
const DONE = (t: Todo) => t.status === 'done';

export interface RollupCounts {
  done: number;
  total: number;
  pct: number;
  completed: boolean;
  mode: 'todos' | 'children' | 'manual';
}

// Rounding must not display 100% while a TODO is still incomplete (e.g. 199/200).
const toPct = (done: number, total: number) => !total ? 0 : done === total ? 100
  : Math.min(99, Math.round((done / total) * 100));

const counts = (done: number, total: number, mode: RollupCounts['mode']): RollupCounts => ({
  done, total, pct: toPct(done, total), completed: total > 0 && done === total, mode,
});

export function combineRollups(rows: RollupCounts[]): RollupCounts {
  return counts(rows.reduce((s, r) => s + r.done, 0), rows.reduce((s, r) => s + r.total, 0), 'children');
}

export function weeklyTodos(weeklyGoal: WeeklyGoal, todos: Todo[]) {
  return todos.filter(t => t.weeklyGoalId === weeklyGoal.id);
}

export function weeklyRollup(weeklyGoal: WeeklyGoal, todos: Todo[]): RollupCounts {
  const linked = weeklyTodos(weeklyGoal, todos).filter(isEffectiveGoalTodo);
  if (linked.length === 0) {
    // todos 미연결 → 기존 done 체크 그대로
    const done = weeklyGoal.done ? 1 : 0;
    return counts(done, 1, 'manual');
  }
  const done = linked.filter(DONE).length;
  return counts(done, linked.length, 'todos');
}

export function monthlyRollup(
  monthlyGoal: MonthlyGoal,
  weeklyGoals: WeeklyGoal[],
  todos: Todo[],
): RollupCounts {
  const childWeeks = weeklyGoals.filter(w => w.monthlyGoalId === monthlyGoal.id);
  if (childWeeks.length === 0) return counts(monthlyGoal.retroStatus === 'done' ? 1 : 0, 1, 'manual');
  return combineRollups(childWeeks.map(w => weeklyRollup(w, todos)));
}

export function annualRollup(
  annualGoal: AnnualGoal,
  monthlyGoals: MonthlyGoal[],
  weeklyGoals: WeeklyGoal[],
  todos: Todo[],
): RollupCounts {
  const childMonths = monthlyGoals.filter(m => m.annualGoalId === annualGoal.id);
  if (childMonths.length === 0) return counts(0, 0, 'children');
  return combineRollups(childMonths.map(m => monthlyRollup(m, weeklyGoals, todos)));
}

// 직접 자식 카운트 — 카드 라벨용 "연결 하위 N"
export function directChildCount(kind: 'annual' | 'monthly' | 'weekly', id: string, args: {
  monthlyGoals?: MonthlyGoal[];
  weeklyGoals?: WeeklyGoal[];
  todos?: Todo[];
}): number {
  if (kind === 'annual') return (args.monthlyGoals ?? []).filter(m => m.annualGoalId === id).length;
  if (kind === 'monthly') return (args.weeklyGoals ?? []).filter(w => w.monthlyGoalId === id).length;
  return (args.todos ?? []).filter(t => t.weeklyGoalId === id).length;
}
