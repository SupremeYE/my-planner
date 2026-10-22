import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moaTodayData, moaMinutes } from './moaToday';
import { weeklyRollup } from '../app/components/period/periodProgress';
import type { Todo, WeeklyGoal, Event } from '../app/store';
const todo = (p: Partial<Todo>): Todo => ({ id: 't', text: 'Task', status: 'active', date: '2027-01-01', isTop3: true, ...p });
const goal: WeeklyGoal = { id: 'w', text: 'Week', weekKey: '2027-W53', done: true };
const data = (todos: Todo[] = [], goals = [goal], events: Event[] = []) => moaTodayData('2027-01-01', todos, goals, events, [], []);

test('Today uses the identical rollup on raw linked TODOs including undated; excludes cancelled/backlog', () => {
  const todos = [todo({ weeklyGoalId: 'w' }), todo({ id: 'done', status: 'done', weeklyGoalId: 'w', date: null }),
    todo({ id: 'cancel', status: 'cancelled', weeklyGoalId: 'w' }), todo({ id: 'back', status: 'backlog', weeklyGoalId: 'w' })];
  assert.deepEqual(data(todos).weeks[0].progress, weeklyRollup(goal, todos));
  assert.equal(data(todos).weekProgress.pct, 50);
  assert.equal(data().weeks[0].progress.mode, 'manual');
  assert.equal(data().weeks[0].progress.pct, 100);
  assert.equal(moaTodayData('2027-01-04', todos, [goal], [], [], []).weeks.length, 0);
});
test('Top3 preserves IDs, completed rows and recurring instance dates without changing the stored parent period', () => {
  const todos = [todo({ id: 'a', status: 'done' }), todo({ id: 'b', date: '2026-12-31', endDate: '2027-01-02' }),
    todo({ id: 'repeat', date: '2026-12-30', endDate: '2026-12-30', recurrenceRule: 'daily' }), todo({ id: 'fourth', isTop3: false }),
    todo({ id: 'cancel', status: 'cancelled' }), todo({ id: 'other', date: '2027-01-02' })];
  const before = structuredClone(todos);
  assert.deepEqual(data(todos).top3.map(t => t.id), ['a', 'b', 'repeat::2027-01-01']);
  assert.deepEqual(todos, before);
  assert.equal(data(['1', '2', '3', '4'].map(id => todo({ id }))).top3.length, 3);
  const exception = todo({ id: 'exception', recurrenceParentId: 'repeat', isException: true, endDate: '2026-12-30', status: 'done' });
  assert.equal(data([...todos, exception]).top3[2].id, 'exception');
});
test('Provider occurrences are not expanded a second time; all-day spans retain calendar boundaries', () => {
  const events: Event[] = [{ id: 'r::2027-01-01', title: 'Repeat', date: '2027-01-01', isOccurrence: true, repeatType: 'daily',
    startDate: '2026-12-01', endDate: '2026-12-01', startTime: '09:00', endTime: '10:00' },
    { id: 'span', title: 'Trip', date: '2026-12-31', startDate: '2026-12-31', endDate: '2027-01-02', isAllDay: true },
    { id: 'tomorrow', title: 'Later', date: '2027-01-02' }];
  assert.deepEqual(data([], [goal], events).dayEvents.map(e => e.id), ['span', 'r::2027-01-01']);
  assert.equal(data([], [goal], events).activity.coverage.recordedMinutes, 0);
});
test('actual summary delegates blocks/legacy dedupe and includes unclassified diagnostics', () => {
  const model = moaTodayData('2027-01-01', [todo({ doStart: '10:00', doEnd: '11:00' })], [], [
    { id: 'plan', title: 'Plan', date: '2027-01-01', startTime: '12:00', endTime: '13:00' },
    { id: 'actual', title: 'Actual', date: '2027-01-01', doStart: '14:00', doEnd: '14:30' }], [],
    [{ id: 'block', todoId: 't', date: '2027-01-01', start: '10:00', end: '10:15', elapsedSec: 900 }]);
  assert.equal(model.activity.coverage.recordedMinutes, 45);
  assert.equal(model.activity.coverage.unclassifiedMinutes, 45);
  assert.equal(model.activity.totalMinutes, 0);
});
test('empty and sub-minute summaries do not invent activity or growth', () => {
  assert.equal(data([], []).weekProgress.pct, 0);
  assert.equal(moaMinutes(0), '0분'); assert.equal(moaMinutes(.5), '1분 미만'); assert.equal(moaMinutes(95), '1시간 35분');
});
