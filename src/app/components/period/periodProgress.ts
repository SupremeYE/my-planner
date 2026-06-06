// 기간별 목표 진행률 유틸 — Phase 2 / Phase 5
// 정의:
//  - weekly%: 연결된 todos 완료/전체. todos 가 0 개면 weeklyGoal.done 으로 폴백(100/0).
//  - monthly%: 그 월간에 연결된 주간들의 todos 를 합산. 주간이 0 개면 0.
//  - annual%: 그 연간에 연결된 월간들의 todos 를 합산. 월간이 0 개면 0.
// "총합 비율" 방식 — 큰 주간(많은 todos)이 비중을 더 갖는다.

import type { Todo, WeeklyGoal, MonthlyGoal, AnnualGoal } from '../../store';

// 진행률 계산에서 제외할 todos 상태 — 백로그/취소는 분모에서 빠진다.
const EFFECTIVE = (t: Todo) => t.status !== 'backlog' && t.status !== 'cancelled';
const DONE = (t: Todo) => t.status === 'done';

export interface RollupCounts {
  done: number;
  total: number;
  pct: number;
}

const toPct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

export function weeklyTodos(weeklyGoal: WeeklyGoal, todos: Todo[]) {
  return todos.filter(t => t.weeklyGoalId === weeklyGoal.id);
}

export function weeklyRollup(weeklyGoal: WeeklyGoal, todos: Todo[]): RollupCounts {
  const linked = weeklyTodos(weeklyGoal, todos).filter(EFFECTIVE);
  if (linked.length === 0) {
    // todos 미연결 → 기존 done 체크 그대로
    const done = weeklyGoal.done ? 1 : 0;
    return { done, total: 1, pct: done * 100 };
  }
  const done = linked.filter(DONE).length;
  return { done, total: linked.length, pct: toPct(done, linked.length) };
}

export function monthlyRollup(
  monthlyGoal: MonthlyGoal,
  weeklyGoals: WeeklyGoal[],
  todos: Todo[],
): RollupCounts {
  const childWeeks = weeklyGoals.filter(w => w.monthlyGoalId === monthlyGoal.id);
  if (childWeeks.length === 0) return { done: 0, total: 0, pct: 0 };
  let done = 0, total = 0;
  for (const w of childWeeks) {
    const r = weeklyRollup(w, todos);
    done += r.done; total += r.total;
  }
  return { done, total, pct: toPct(done, total) };
}

export function annualRollup(
  annualGoal: AnnualGoal,
  monthlyGoals: MonthlyGoal[],
  weeklyGoals: WeeklyGoal[],
  todos: Todo[],
): RollupCounts {
  const childMonths = monthlyGoals.filter(m => m.annualGoalId === annualGoal.id);
  if (childMonths.length === 0) return { done: 0, total: 0, pct: 0 };
  let done = 0, total = 0;
  for (const m of childMonths) {
    const r = monthlyRollup(m, weeklyGoals, todos);
    done += r.done; total += r.total;
  }
  return { done, total, pct: toPct(done, total) };
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
