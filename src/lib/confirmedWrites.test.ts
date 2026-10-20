import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedWrites } from './confirmedWrites';
import { memorySupabase } from '../../scripts/test/fixtures/memory-supabase';
import { SaveFailure } from './saveCoordinator';

type Record = { id: string; text: string; status: string };
const encode = (row: Record) => ({ ...row });
const decode = (row: Record) => ({ ...row });

test('응답 유실 후 생성 재시도는 같은 ID를 읽고 중복/덮어쓰기를 만들지 않는다', async () => {
  const { supabase, controls } = memorySupabase({ todos: [] });
  const writer = confirmedWrites(supabase, 'todos', encode, decode);
  const row = { id: 'stable', text: 'draft', status: 'active' };
  controls.failNext('todos', { status: 0, afterCommit: true });
  await assert.rejects(writer.createConfirmed(row), (error: SaveFailure) => error.retryable);
  assert.deepEqual(await writer.createConfirmed(row), row);
  assert.equal(controls.tables.todos.length, 1);
  await assert.rejects(writer.createConfirmed({ ...row, text: 'different draft' }),
    (error: SaveFailure) => !error.retryable);
  assert.equal(controls.tables.todos[0].text, 'draft');
});

test('수정은 변경된 컬럼만 전송해 다른 기기의 관련 없는 수정을 보존한다', async () => {
  const { supabase, controls } = memorySupabase({ todos: [{ id: 't', text: 'Other device text', status: 'active' }] });
  const writer = confirmedWrites(supabase, 'todos', encode, decode);
  const before = { id: 't', text: 'Old text', status: 'active' };
  const result = await writer.updateConfirmed(before, { ...before, status: 'done' });
  assert.deepEqual(controls.requests[0].payload, { status: 'done' });
  assert.equal(result.text, 'Other device text');
  assert.equal(result.status, 'done');
});

test('권한으로 수정 행이 보이지 않거나 확인 행이 없으면 성공으로 처리하지 않는다', async () => {
  const { supabase } = memorySupabase({ todos: [] });
  const writer = confirmedWrites(supabase, 'todos', encode, decode);
  const before = { id: 'missing', text: 'draft', status: 'active' };
  await assert.rejects(writer.updateConfirmed(before, { ...before, status: 'done' }),
    (error: SaveFailure) => !error.retryable);
});
