import assert from 'node:assert/strict';
import test from 'node:test';
import type { Todo, WeeklyGoal, MonthlyGoal } from '../app/store';
import { weeklyRollup, monthlyRollup, combineRollups } from '../app/components/period/periodProgress';

const week: WeeklyGoal = { id: 'w', text: 'Weekly', done: false, weekKey: '2026-W53', monthlyGoalId: 'm' };
const month: MonthlyGoal = { id: 'm', text: 'Monthly', month: '2026-12' };
const td = (id: string, status: Todo['status'], date: string | null = null): Todo => ({
  id, text: id, date, status, isTop3: false, weeklyGoalId: 'w',
});

test('연결 TODO가 있으면 수동 done보다 TODO 결과가 우선한다', () => {
  const todos = [td('a', 'done'), td('b', 'active')];
  const r = weeklyRollup({ ...week, done: true }, todos);
  assert.deepEqual([r.done, r.total, r.pct, r.completed, r.mode], [1, 2, 50, false, 'todos']);
  assert.equal(monthlyRollup({ ...month, retroStatus: 'done' }, [week], todos).pct, 50);
});

test('날짜 미지정·진행중·미룬 TODO 포함, 취소와 백로그 제외', () => {
  const todos = [td('a', 'done'), td('b', 'inProgress'), td('c', 'snoozed'), td('d', 'cancelled'), td('e', 'backlog')];
  const r = weeklyRollup(week, todos);
  assert.equal(r.total, 3);
  assert.equal(r.done, 1);
  assert.equal(r.pct, 33);
  assert.equal(weeklyRollup(week, [td('a', 'done'), td('d', 'cancelled')]).completed, true);
});

test('연결 TODO가 없거나 모두 제외 상태면 수동 완료를 사용한다', () => {
  for (const todos of [[], [td('x', 'cancelled'), td('y', 'backlog')]]) {
    assert.equal(weeklyRollup({ ...week, done: true }, todos).pct, 100);
    assert.equal(weeklyRollup(week, todos).pct, 0);
    assert.equal(weeklyRollup(week, todos).mode, 'manual');
  }
  assert.equal(monthlyRollup(month, [], []).pct, 0);
  assert.equal(monthlyRollup({ ...month, retroStatus: 'done' }, [], []).pct, 100);
});

test('홈 요약·주간·월간은 같은 가중 계산을 사용하며 원본 연결을 보존한다', () => {
  const weeks = [week, { ...week, id: 'w2', done: true }];
  const todos = [td('a', 'done'), td('b', 'active'), td('c', 'active')];
  const before = structuredClone({ weeks, todos, month });
  const home = combineRollups(weeks.map(w => weeklyRollup(w, todos)));
  const monthly = monthlyRollup(month, weeks, todos);
  assert.equal(home.pct, 50); // 1/3 + 수동 1/1 = 2/4
  assert.deepEqual(home, monthly);
  assert.deepEqual({ weeks, todos, month }, before);
  assert.equal(weeklyRollup(week, todos.map(t => ({ ...t, status: 'done' }))).completed, true);
});

test('반올림 때문에 미완료 목표가 100%로 보이지 않는다', () => {
  const todos = Array.from({ length: 200 }, (_, i) => td(String(i), i === 199 ? 'active' : 'done'));
  const r = weeklyRollup(week, todos);
  assert.equal(r.pct, 99);
  assert.equal(r.completed, false);
  assert.equal(monthlyRollup(month, [week], todos).pct, 99);
});
