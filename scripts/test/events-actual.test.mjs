// Pure read-adapter regression: no Supabase client, credentials or network access.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { outputFiles } = await build({
  absWorkingDir: root, bundle: true,
  stdin: { contents: 'export { getRepeatedEvents } from "./src/api/events"; export { aggregateActivity } from "./src/lib/timeAggregation";', resolveDir: root },
  platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'no-supabase', setup(build) {
    build.onResolve({ filter: /\/lib\/supabase$/ }, () => ({ path: 'supabase', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents:
      'export const supabase = new Proxy({}, { get() { throw new Error("Network access forbidden in read tests"); } });' }));
  } }],
});
const { getRepeatedEvents, aggregateActivity } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const master = {
  id: 'master', title: 'Recurring plan', start_at: '2026-08-03T09:00:00', end_at: '2026-08-03T10:00:00',
  do_start: '09:15', do_end: '09:45', repeat_type: 'daily', repeat_end_date: '2026-08-06',
  tags: ['work'],
};

test('반복 계획을 펼칠 때 첫 회차 실적을 다른 회차에 복제하지 않는다', () => {
  const events = getRepeatedEvents([master], '2026-08-03', '2026-08-05');
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(e => [e.date, e.doStart, e.doEnd]), [
    ['2026-08-03', '09:15', '09:45'],
    ['2026-08-04', undefined, undefined],
    ['2026-08-05', undefined, undefined],
  ]);
  assert.deepEqual(events.map(e => [e.startTime, e.endTime]), events.map(() => ['09:00', '10:00']));
  assert.deepEqual(events[0].tags, ['work']);
  assert.equal(aggregateActivity([], events, [], '2026-08-03', '2026-08-05').coverage.recordedMinutes, 30);
  assert.equal(aggregateActivity([], events, [{ id: 'work', name: '업무', color: '#111', trackTime: true }],
    '2026-08-03', '2026-08-05').totalMinutes, 30);
});

test('실제 예외 회차의 실적과 원본 행은 보존한다', () => {
  const exception = { ...master, id: 'exception', parent_event_id: 'master', occurrence_date: '2026-08-04',
    is_exception: true, start_at: '2026-08-04T11:00:00', end_at: '2026-08-04T12:00:00',
    do_start: '11:10', do_end: '11:50' };
  const rows = [master, exception]; const original = structuredClone(rows);
  const events = getRepeatedEvents(rows, '2026-08-03', '2026-08-05');
  assert.equal(events[1].id, 'exception');
  assert.equal(events[1].doStart, '11:10');
  assert.equal(events[1].doEnd, '11:50');
  assert.equal(aggregateActivity([], events, [], '2026-08-03', '2026-08-05').coverage.recordedMinutes, 70);
  assert.deepEqual(rows, original);
});
