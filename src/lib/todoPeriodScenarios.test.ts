/**
 * 기간 모델 시나리오 실증 — DailyView 필터 조합을 그대로 재현해 요구 시나리오를 검증한다.
 * (프롬프트 '검증 2. 시나리오 실증' 대응. node:test + node:assert)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Todo } from '../app/store';
import { periodCoversDate, todoEndDate, isTodoIncomplete, deriveTodoPhase } from './todoPeriod';

const YESTERDAY = '2026-08-07';
const TODAY = '2026-08-08';
const D3_A = '2026-08-06', D3_B = '2026-08-08', D3_C = '2026-08-09'; // 3일 기간 08-06~08-08 등

const mk = (over: Partial<Todo>): Todo => ({
  id: 't', text: 'x', date: TODAY, endDate: TODAY, status: 'active', isTop3: false, tags: [], ...over,
});

// DailyView 재현: 선택 날짜의 목록(기간 포함, backlog 제외)
const dateTodos = (todos: Todo[], selectedDate: string) =>
  todos.filter(td => periodCoversDate(td, selectedDate) && td.status !== 'backlog');

// DailyView 재현: 오늘 볼 때 '늦음' 이월 + 완료 직후 유지(justCompleted)
const carryover = (todos: Todo[], today: string, justCompleted: Set<string>) =>
  todos.filter(td => !!td.date && todoEndDate(td)! < today
    && (isTodoIncomplete(td.status) || justCompleted.has(td.id)));

test('시나리오1: 어제 미완료 할일이 오늘 화면에 뜬다(늦음 이월)', () => {
  const t = mk({ id: 'y', date: YESTERDAY, endDate: YESTERDAY, status: 'active' });
  const co = carryover([t], TODAY, new Set());
  assert.equal(co.length, 1);
  assert.equal(deriveTodoPhase(t, TODAY), 'late');
  // 오늘 기간에는 포함되지 않는다(그래서 이월로 주입)
  assert.equal(dateTodos([t], TODAY).length, 0);
});

test('시나리오2: 오늘 완료하면 즉시 사라지지 않고 세션 내 유지(취소선)', () => {
  const done = mk({ id: 'y', date: YESTERDAY, endDate: YESTERDAY, status: 'done' });
  const justCompleted = new Set(['y']); // 방금 체크
  const co = carryover([done], TODAY, justCompleted);
  assert.equal(co.length, 1, '완료돼도 justCompleted 로 남아야 함');
});

test('시나리오3: 화면 다시 열면 오늘에서 사라지고 어제에 남는다', () => {
  const done = mk({ id: 'y', date: YESTERDAY, endDate: YESTERDAY, status: 'done' });
  // 리마운트 = justCompleted 비어있음
  assert.equal(carryover([done], TODAY, new Set()).length, 0, '오늘에서 사라진다');
  // 원래 날짜(어제)에는 그대로 (완료 표시로) 남는다
  assert.equal(dateTodos([done], YESTERDAY).length, 1, '어제 화면엔 남는다');
});

test('시나리오4: 3일 기간 할일은 3일 내내 진행중으로 뜬다', () => {
  const t = mk({ id: 'span', date: D3_A, endDate: D3_C });
  for (const d of [D3_A, D3_B, D3_C]) {
    assert.equal(dateTodos([t], d).length, 1, `${d} 화면에 뜬다`);
    assert.equal(deriveTodoPhase(t, d), 'inProgress', `${d} 진행중`);
  }
  // 종료 다음날은 늦음(이월)
  assert.equal(deriveTodoPhase(t, '2026-08-10'), 'late');
  assert.equal(carryover([t], '2026-08-10', new Set()).length, 1);
});

test('시나리오5: 종료일 지난 미완료는 계속 뜨고 늦음 배지가 붙는다', () => {
  const t = mk({ id: 'late', date: '2026-08-01', endDate: '2026-08-03', status: 'active' });
  assert.equal(carryover([t], TODAY, new Set()).length, 1, '계속 이월로 뜬다');
  assert.equal(deriveTodoPhase(t, TODAY), 'late', '늦음 배지');
});

test('부작용 없음: 오늘 시작 단일 할일은 오늘 목록에만, 이월 아님', () => {
  const t = mk({ id: 'today', date: TODAY, endDate: TODAY, status: 'active' });
  assert.equal(dateTodos([t], TODAY).length, 1);
  assert.equal(carryover([t], TODAY, new Set()).length, 0);
  assert.equal(deriveTodoPhase(t, TODAY), 'inProgress');
});
