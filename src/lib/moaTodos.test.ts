import test from 'node:test';
import assert from 'node:assert/strict';
import type { Todo, Tag, TodoTimeBlock } from '../app/store';
import { moaTodoList, timeTagLabel, preservedLegacyBlock, legacyBlockId } from './moaTodos';
import { aggregateActivity } from './timeAggregation';
import { confirmedWrites } from './confirmedWrites';
import { memorySupabase } from '../../scripts/test/fixtures/memory-supabase';
const todo = (changes: Partial<Todo> = {}): Todo => ({ id: 't', text: 'Task', date: '2027-01-01', status: 'active', isTop3: false, ...changes });
const tags: Tag[] = [{ id: 'a', name: '업무', color: '#506c4c', trackTime: true }, { id: 'b', name: '생활', color: '#aaa', trackTime: true }, { id: 'aux', name: '읽기', color: '#bbb', trackTime: false }];

test('Moa week/undated projections preserve canonical IDs, ISO aliases and repeating instances', () => {
  const rows = [todo(), todo({ id: 'week', date: null, weeklyGoalId: 'w' }), todo({ id: 'undated', date: null }),
    todo({ id: 'span', date: '2026-12-30', endDate: '2027-01-02' }), todo({ id: 'repeat', date: '2026-12-30', endDate: '2026-12-30', recurrenceRule: 'daily' })];
  const goals = [{ id: 'w', text: 'Week', done: false, weekKey: '2027-W53' }];
  assert.deepEqual(moaTodoList(rows, goals, '2027-01-01', 'today').map(t => t.id), ['t', 'span', 'repeat::2027-01-01']);
  assert.ok(moaTodoList(rows, goals, '2027-01-01', 'week').some(t => t.id === 'week'));
  assert.deepEqual(moaTodoList(rows, goals, '2027-01-01', 'undated').map(t => t.id), ['week', 'undated']);
});
test('single tracked tag owns actual duration; normal tags do not add time; legacy multi-tags split evenly', () => {
  const single = todo({ tags: ['a', 'aux'], doElapsedSec: 3600 });
  assert.equal(timeTagLabel(single, tags), '업무');
  const agg = aggregateActivity([single], [], tags, single.date!, single.date!);
  assert.equal(agg.byTag.get('a')?.minutes, 60); assert.equal(agg.byTag.has('aux'), false);
  const legacy = todo({ ...single, tags: ['a', 'b', 'aux'] });
  const split = aggregateActivity([legacy], [], tags, legacy.date!, legacy.date!);
  assert.equal(split.byTag.get('a')?.minutes, 30); assert.equal(split.byTag.get('b')?.minutes, 30);
  assert.match(timeTagLabel(legacy, tags), /균등 분할/);
});
test('first duration-only entry preserves legacy actual as a dated block; no fabricated clock times', async () => {
  const source = todo({ tags: ['a'], doStart: '09:00', doEnd: '10:00', doElapsedSec: 3600 });
  const id = await legacyBlockId(source.id); assert.equal(id, await legacyBlockId(source.id));
  assert.notEqual(id, await legacyBlockId('other')); assert.match(id, /^[a-f0-9-]{36}$/);
  const baseline = preservedLegacyBlock(source, [], id)!;
  const manual: TodoTimeBlock = { id: 'manual', todoId: source.id, date: '2027-01-02', elapsedSec: 1800 };
  assert.equal(aggregateActivity([source], [], tags, '2027-01-01', '2027-01-02', [baseline, manual]).totalMinutes, 90);
  assert.equal(aggregateActivity([source], [], tags, '2027-01-01', '2027-01-01', [baseline, manual]).totalMinutes, 60);
  assert.equal(manual.start, undefined); assert.equal(manual.end, undefined);
  assert.equal(preservedLegacyBlock(source, [baseline], id), undefined);
});
test('completion marker stays zero and ambiguous legacy actual cannot be silently hidden by a new block', () => {
  assert.equal(preservedLegacyBlock(todo({ doElapsedSec: 0, doStart: '10:00', doEnd: '10:00' }), [], 'b'), undefined);
  assert.throws(() => preservedLegacyBlock(todo({ date: null, doElapsedSec: 60 }), [], 'b'), /날짜/);
  assert.throws(() => preservedLegacyBlock(todo({ doStart: '23:50', doEnd: '00:10' }), [], 'b'), /불명확/);
  assert.throws(() => preservedLegacyBlock(todo({ doElapsedSec: -1 }), [], 'b'), /불명확/);
});
test('confirmed delete preserves failure state and safely repeats an acknowledged-lost delete', async () => {
  const { supabase, controls } = memorySupabase({ records: [{ id: 'x', text: 'keep' }] });
  const writes = confirmedWrites(supabase, 'records', x => x, x => x);
  controls.failNext('records', { status: 503 }); await assert.rejects(() => writes.deleteConfirmed('x'));
  assert.equal(controls.tables.records.length, 1);
  controls.failNext('records', { status: 0, afterCommit: true }); await assert.rejects(() => writes.deleteConfirmed('x'));
  assert.equal(controls.tables.records.length, 0); await writes.deleteConfirmed('x');
  assert.equal(await writes.getConfirmed('x'), null);
});
