import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { memorySupabase } from '../../scripts/test/fixtures/memory-supabase';
import { weeklyReviewRepository } from './weeklyReviewRepository';
import { transformReviewWeekly } from '../review/weeklyBuildTransforms';

const config = { unique: { weekly_reviews: [['week_key']] }, orderedTables: ['weekly_reviews'] };
test('Preview ordered pagination covers all rows and preserves legacy original keys', async () => {
  const initial = Array.from({ length: 1001 }, (_, i) => ({ id: `id-${String(1000-i).padStart(4,'0')}`, week_key: i % 2 ? '2026-W1' : '2025-W52', next_week: '', highlights: null, kpt_keep: null, notice: null, kpt_try: null }));
  const { supabase, controls } = memorySupabase({ weekly_reviews: initial }, config);
  const rows = await weeklyReviewRepository(supabase).fetchConfirmed();
  assert.equal(rows.length, 1001); assert.equal(rows[0].weekKey, '2025-W52');
  assert.equal(rows[0].id, 'id-0000'); assert.deepEqual(controls.tables.weekly_reviews, initial);
});
test('Preview unique constraint responds with 23505 while canonical/legacy rows remain separate', async () => {
  const { supabase, controls } = memorySupabase({ weekly_reviews: [{ id: 'a', week_key: '2026-W01' }] }, config);
  assert.equal((await supabase.from('weekly_reviews').insert({ id: 'b', week_key: '2026-W01' })).error.code, '23505');
  assert.equal((await supabase.from('weekly_reviews').insert({ id: 'legacy', week_key: '2026-W1' })).error, null);
  assert.equal((await supabase.from('weekly_reviews').update({ week_key: '2026-W01' }).eq('id','legacy')).error.code, '23505');
  assert.deepEqual(controls.tables.weekly_reviews.map(r=>r.week_key), ['2026-W01','2026-W1']);
});
test('Preview is(null) and eq predicates enforce partial-update conflicts', async () => {
  const { supabase, controls } = memorySupabase({ weekly_reviews: [{ id: 'a', week_key: '2026-W01', notice: null, highlights: 'keep' }] }, config);
  assert.equal((await supabase.from('weekly_reviews').update({ notice: 'first' }).eq('id','a').is('notice',null).select('*')).data.length, 1);
  assert.equal((await supabase.from('weekly_reviews').update({ notice: 'overwrite' }).eq('id','a').is('notice',null).select('*')).data.length, 0);
  assert.equal(controls.tables.weekly_reviews[0].notice, 'first'); assert.equal(controls.tables.weekly_reviews[0].highlights, 'keep');
});
test('Preview lost acknowledgement emits Realtime and can be reconciled without another write', async () => {
  const { supabase, controls } = memorySupabase({ weekly_reviews: [] }, config); let notifications = 0;
  supabase.channel().on(null, { table: 'weekly_reviews' }, () => notifications++).subscribe();
  controls.failNext('weekly_reviews', { status: 0, afterCommit: true });
  const repo = weeklyReviewRepository(supabase);
  assert.equal((await repo.save({ id: 'fixed', weekKey: '2026-W01', nextWeek: 'next' })).nextWeek, 'next');
  assert.equal(notifications, 1); assert.equal(controls.requests.length, 1);
});
test('Preview build uses one confirmed controller and fails closed if store boundary changes', () => {
  const code = readFileSync('src/app/store.tsx','utf8');
  const transformed = transformReviewWeekly(code,'/src/app/store.tsx')!;
  assert.ok(transformed.includes('weeklyReviews: reviewWeekly.records, reviewWeekly,'));
  assert.equal((transformed.match(/const reviewWeekly = useWeeklyReviews\(\)/g) ?? []).length,1);
  assert.ok(!transformed.includes('db.weeklyReviews.fetchAll()'));
  assert.equal(transformReviewWeekly(code,'/other.tsx'), undefined);
  assert.throws(() => transformReviewWeekly(code.replace('reviewRecords, weeklyReviews, monthlyReviews,','changed'),'/src/app/store.tsx'), /boundary changed/);
  assert.ok(!code.includes('useWeeklyReviews'), 'Product store source remains untouched');
});
