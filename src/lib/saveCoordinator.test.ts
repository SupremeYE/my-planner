import assert from 'node:assert/strict';
import test from 'node:test';
import { SaveCoordinator, SaveFailure, mergeConfirmedRows, saveFailure } from './saveCoordinator';

test('저장 중 같은 요청을 합치고 서버 확인 후에만 화면 값을 확정한다', async () => {
  const saves = new SaveCoordinator(); let release!: (value: string) => void;
  const gate = new Promise<string>(resolve => { release = resolve; });
  let calls = 0; let visible = 'old';
  const request = { key: 'todos:1', label: '할일', intent: 'done',
    execute: () => { calls++; return gate; }, commit: (value: string) => { visible = value; } };
  const first = saves.run(request); const second = saves.run({ ...request });
  assert.equal(first, second);
  assert.equal(saves.snapshot()[0].status, 'saving');
  assert.equal(visible, 'old');
  release('done'); await first;
  assert.equal(calls, 1); assert.equal(visible, 'done');
  assert.equal(saves.snapshot()[0].status, 'saved');
});

test('일시 오류 재시도는 같은 요청을 사용하고 실패 중 값은 보존한다', async () => {
  const saves = new SaveCoordinator(); const value = { text: 'one' };
  const id = saves.creationId('todos', value); let calls = 0; let visible = false;
  await saves.run({ key: `todos:${id}`, label: '할일', intent: 'create',
    execute: async () => { if (++calls === 1) throw new SaveFailure('temporary', true); return id; },
    commit: () => { visible = true; } });
  assert.equal(visible, false);
  assert.equal(saves.creationId('todos', value), id);
  assert.equal(saves.snapshot()[0].retryable, true);
  await saves.retry(`todos:${id}`);
  assert.equal(calls, 2); assert.equal(visible, true);
});

test('권한·제약 오류는 자동/수동 재시도하지 않으며 원시 메시지를 표시하지 않는다', async () => {
  const saves = new SaveCoordinator(); let calls = 0;
  const request = { key: 'monthlyGoals:1', label: '월간', intent: 'edit', execute: async () => {
    calls++; throw saveFailure({ code: '42501', message: 'sensitive raw database payload' }, 403);
  }, commit: () => assert.fail('must not commit') };
  await saves.run(request); await saves.retry(request.key); await saves.run(request);
  assert.equal(calls, 1);
  assert.equal(saves.snapshot()[0].retryable, false);
  assert.ok(!saves.snapshot()[0].message!.includes('sensitive'));
});

test('별도 변경을 저장 중인 항목에 겹쳐 보내면 명시적으로 거절한다', async () => {
  const saves = new SaveCoordinator(); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = saves.run({ key: 'todos:1', label: '할일', intent: 'done', execute: () => gate, commit: () => {} });
  const blocked = await saves.run({ key: 'todos:1', label: '할일', intent: 'rename',
    execute: async () => assert.fail('must not overlap'), commit: () => {} });
  assert.equal(blocked, null);
  assert.ok(saves.snapshot().some(s => s.key === 'busy'));
  release(); await first;
});

test('알림을 닫아도 불확실한 생성 ID를 바꾸지 않으며 동기화는 보호된 값만 보존한다', async () => {
  const saves = new SaveCoordinator(); const id = saves.creationId('todos', { text: 'draft' });
  await saves.run({ key: `todos:${id}`, label: '할일', intent: 'create',
    execute: async () => { throw new SaveFailure('uncertain', true); }, commit: () => {} });
  const rows = mergeConfirmedRows([{ id, status: 'done' }, { id: 'other', status: 'done' }],
    [{ id, status: 'active' }], saves.protectedIds('todos'));
  assert.deepEqual(rows, [{ id: 'other', status: 'done' }, { id, status: 'active' }]);
  saves.dismiss(`todos:${id}`);
  assert.equal(saves.creationId('todos', { text: 'draft' }), id);
});
