/**
 * 시간 블록 집계(dual-read) 단위 테스트. node:test + node:assert.
 * (러너 미설정 — esbuild 트랜스파일 후 node --test 로 실행)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Todo, TodoTimeBlock } from '../app/store';
import { blockDurationSec, dateDoSeconds, totalElapsedForTodo, elapsedByKey } from './timeBlocks';

const todo = (over: Partial<Todo>): Todo => ({
  id: 't1', text: 'x', date: '2026-07-14', status: 'inProgress', isTop3: false, tags: [], ...over,
});
const blk = (over: Partial<TodoTimeBlock>): TodoTimeBlock => ({
  id: 'b' + Math.random(), todoId: 't1', date: '2026-07-14', elapsedSec: 600, ...over,
});

test('blockDurationSec: elapsedSec 우선', () => {
  assert.equal(blockDurationSec(blk({ elapsedSec: 900 })), 900);
});
test('blockDurationSec: elapsedSec 0 이면 start~end', () => {
  assert.equal(blockDurationSec(blk({ elapsedSec: 0, start: '09:00', end: '09:30' })), 1800);
});

test('totalElapsedForTodo: 블록 합', () => {
  const blocks = [blk({ todoId: 't1', elapsedSec: 600 }), blk({ todoId: 't1', elapsedSec: 300, date: '2026-07-15' })];
  assert.equal(totalElapsedForTodo(blocks, todo({})), 900); // 여러 날 누적
});
test('totalElapsedForTodo: 블록 없으면 do_* 폴백', () => {
  assert.equal(totalElapsedForTodo([], todo({ doStart: '09:00', doEnd: '09:20', doElapsedSec: 1200 })), 1200);
});

test('dateDoSeconds: 그날 블록만 합산', () => {
  const blocks = [
    blk({ date: '2026-07-14', elapsedSec: 600 }),
    blk({ date: '2026-07-15', elapsedSec: 999 }),
  ];
  assert.equal(dateDoSeconds(blocks, [todo({})], '2026-07-14'), 600);
});

test('dateDoSeconds: 블록 있으면 같은 날 do_* 는 무시(이중집계 방지)', () => {
  const t = todo({ id: 't1', doStart: '09:00', doEnd: '09:30', doElapsedSec: 1800 });
  const blocks = [blk({ todoId: 't1', date: '2026-07-14', elapsedSec: 600 })];
  // 블록 600 만, do_* 1800 은 무시
  assert.equal(dateDoSeconds(blocks, [t], '2026-07-14'), 600);
});

test('dateDoSeconds: 블록 없는 레거시 do_* 는 폴백 합산', () => {
  const t = todo({ id: 't1', doStart: '09:00', doEnd: '09:30', doElapsedSec: 1800 });
  assert.equal(dateDoSeconds([], [t], '2026-07-14'), 1800);
});

test('elapsedByKey: 태그별 집계 + 레거시 폴백 이중집계 방지', () => {
  const t1 = todo({ id: 't1', tags: ['work'], date: '2026-07-14', doStart: '09:00', doEnd: '10:00', doElapsedSec: 3600 });
  const t2 = todo({ id: 't2', tags: ['rest'], date: '2026-07-14', doStart: '11:00', doEnd: '11:30', doElapsedSec: 1800 });
  const blocks = [blk({ todoId: 't1', date: '2026-07-14', elapsedSec: 1200 })]; // t1 은 블록 있음
  const m = elapsedByKey(blocks, [t1, t2], td => td.tags?.[0] ?? null);
  assert.equal(m.get('work'), 1200); // 블록만 (do_* 3600 무시)
  assert.equal(m.get('rest'), 1800); // t2 는 블록 없어 do_* 폴백
});
