/**
 * 기간 파생 유틸 단위 테스트. node:test + node:assert.
 * (러너 미설정 — esbuild 트랜스파일 후 node --test 로 실행)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Todo } from '../app/store';
import {
  todoEndDate, isTodoIncomplete, deriveTodoPhase, periodCoversDate, isTodoLate, todoRunningDays,
} from './todoPeriod';

const todo = (over: Partial<Todo>): Todo => ({
  id: 't1', text: 'x', date: '2026-08-05', status: 'active', isTop3: false, tags: [], ...over,
});
const TODAY = '2026-08-08';

test('todoEndDate: endDate 우선, 없으면 date', () => {
  assert.equal(todoEndDate(todo({ date: '2026-08-05', endDate: '2026-08-07' })), '2026-08-07');
  assert.equal(todoEndDate(todo({ date: '2026-08-05', endDate: undefined })), '2026-08-05');
  assert.equal(todoEndDate(todo({ date: null, endDate: undefined })), null);
});

test('isTodoIncomplete: done/cancelled/backlog 만 완료취급', () => {
  assert.equal(isTodoIncomplete('active'), true);
  assert.equal(isTodoIncomplete('inProgress'), true);
  assert.equal(isTodoIncomplete('snoozed'), true);
  assert.equal(isTodoIncomplete('done'), false);
  assert.equal(isTodoIncomplete('cancelled'), false);
  assert.equal(isTodoIncomplete('backlog'), false);
});

test('deriveTodoPhase: 단일 날짜 오늘 = inProgress', () => {
  assert.equal(deriveTodoPhase(todo({ date: TODAY, endDate: TODAY }), TODAY), 'inProgress');
});

test('deriveTodoPhase: 시작 전 = upcoming', () => {
  assert.equal(deriveTodoPhase(todo({ date: '2026-08-10', endDate: '2026-08-10' }), TODAY), 'upcoming');
});

test('deriveTodoPhase: 종료 지남 미완료 = late', () => {
  assert.equal(deriveTodoPhase(todo({ date: '2026-08-05', endDate: '2026-08-05' }), TODAY), 'late');
});

test('deriveTodoPhase: 3일 기간 내내 inProgress', () => {
  const t = todo({ date: '2026-08-07', endDate: '2026-08-09' });
  assert.equal(deriveTodoPhase(t, '2026-08-07'), 'inProgress');
  assert.equal(deriveTodoPhase(t, '2026-08-08'), 'inProgress');
  assert.equal(deriveTodoPhase(t, '2026-08-09'), 'inProgress');
  assert.equal(deriveTodoPhase(t, '2026-08-10'), 'late');
});

test('deriveTodoPhase: done/cancelled', () => {
  assert.equal(deriveTodoPhase(todo({ status: 'done' }), TODAY), 'done');
  assert.equal(deriveTodoPhase(todo({ status: 'cancelled' }), TODAY), 'inactive');
  assert.equal(deriveTodoPhase(todo({ date: null }), TODAY), 'inactive');
});

test('periodCoversDate: 범위 포함/제외', () => {
  const t = todo({ date: '2026-08-07', endDate: '2026-08-09' });
  assert.equal(periodCoversDate(t, '2026-08-06'), false);
  assert.equal(periodCoversDate(t, '2026-08-07'), true);
  assert.equal(periodCoversDate(t, '2026-08-09'), true);
  assert.equal(periodCoversDate(t, '2026-08-10'), false);
  assert.equal(periodCoversDate(todo({ date: null }), TODAY), false);
});

test('isTodoLate: 종료 지난 미완료만', () => {
  assert.equal(isTodoLate(todo({ date: '2026-08-05', endDate: '2026-08-05' }), TODAY), true);
  assert.equal(isTodoLate(todo({ date: '2026-08-05', endDate: '2026-08-05', status: 'done' }), TODAY), false);
  assert.equal(isTodoLate(todo({ date: TODAY, endDate: TODAY }), TODAY), false);
});

test('todoRunningDays: 시작=1, 3일째=3, 시작전=0', () => {
  assert.equal(todoRunningDays(todo({ date: TODAY }), TODAY), 1);
  assert.equal(todoRunningDays(todo({ date: '2026-08-06' }), TODAY), 3);
  assert.equal(todoRunningDays(todo({ date: '2026-08-10' }), TODAY), 0);
});
