import assert from 'node:assert/strict';
import test from 'node:test';
import { memorySupabase } from '../../scripts/test/fixtures/memory-supabase';
import { weeklyReviewRepository, reviewText } from './weeklyReviewRepository';
import { SaveCoordinator, SaveFailure, saveIntent } from './saveCoordinator';
import { findWeekRecord, getWeekKey } from './weekKeys';
import type { WeeklyReview } from '../app/store';

const row = (extra = {}) => ({ id: 'old', week_key: '2027-W53', highlights: '기존 기억', kpt_keep: null,
  notice: '그대로 둘 발견', kpt_try: '다음 시도', next_week: '원래 계획', created_at: '2027-01-03', unknown_field: '보존', ...extra });
const setup = (rows: any[] = []) => { const memory = memorySupabase({ weekly_reviews: rows }); return { ...memory, repo: weeklyReviewRepository(memory.supabase) }; };
const draft = (extra: Partial<WeeklyReview> = {}): WeeklyReview => ({ id: 'fixed-session-id', weekKey: '2026-W53', nextWeek: '', highlights: '한 항목만', ...extra });

test('read preserves IDs, original keys, text, collisions and one-digit compatibility without writes', async () => {
  const records = [row(), row({ id: 'canonical', week_key: '2026-W53' }), row({ id: 'one-digit', week_key: '2026-W1' })];
  const { repo, controls } = setup(records);
  const read = await repo.fetchConfirmed();
  assert.equal(findWeekRecord(read, '2026-W53')?.id, 'canonical');
  assert.equal(findWeekRecord(read, '2026-W01')?.id, 'one-digit');
  assert.deepEqual(controls.tables.weekly_reviews, records); assert.equal(controls.requests.length, 0);
});
test('one optional field and even an explicit empty review can be saved without generated text', async () => {
  const { repo, controls } = setup();
  await repo.save(draft());
  assert.deepEqual(reviewText((await repo.fetchConfirmed())[0]), { highlights: '한 항목만', kptKeep: '', notice: '', kptTry: '', nextWeek: '' });
  await repo.save(draft({ id: 'empty', weekKey: '2027-W01', highlights: '' }));
  assert.equal(controls.tables.weekly_reviews.length, 2);
});
test('changed fields only; explicit clearing preserves null, original week_key, ID, unknown columns and other-device edits', async () => {
  const { repo, controls } = setup([row()]); const before = (await repo.fetchConfirmed())[0];
  controls.tables.weekly_reviews[0].notice = '다른 기기에서 바꾼 발견';
  const result = await repo.save({ ...before, highlights: '', kptTry: '새 시도' }, before);
  assert.deepEqual(controls.requests[0].payload, { highlights: '', kpt_try: '새 시도' });
  assert.equal(result.notice, '다른 기기에서 바꾼 발견');
  assert.equal(result.id, 'old'); assert.equal(result.weekKey, '2027-W53');
  assert.equal(controls.tables.weekly_reviews[0].kpt_keep, null);
  assert.equal(controls.tables.weekly_reviews[0].unknown_field, '보존');
});
test('same-field remote changes are conflicts, not overwritten', async () => {
  const { repo, controls } = setup([row()]); const before = (await repo.fetchConfirmed())[0];
  controls.tables.weekly_reviews[0].highlights = '다른 기기';
  await assert.rejects(repo.save({ ...before, highlights: '내 초안' }, before), (e: SaveFailure) => !e.retryable);
  assert.equal(controls.requests.length, 0);
});
test('atomic changed-column predicates catch changes occurring after preflight', async () => {
  const { repo, controls } = setup([row()]); const before = (await repo.fetchConfirmed())[0];
  controls.hold('weekly_reviews');
  const pending = repo.save({ ...before, kptKeep: '내 KEEP' }, before);
  while (!controls.requests.length) await new Promise(resolve => setTimeout(resolve, 1));
  controls.tables.weekly_reviews[0].kpt_keep = '새 KEEP'; controls.release('weekly_reviews');
  await assert.rejects(pending, (e: SaveFailure) => !e.retryable);
  assert.equal(controls.tables.weekly_reviews[0].kpt_keep, '새 KEEP');
});
test('lost creation acknowledgement reconciles by ID without a second write', async () => {
  const { repo, controls } = setup(); controls.failNext('weekly_reviews', { status: 0, afterCommit: true });
  const result = await repo.save(draft());
  assert.equal(result.id, draft().id); assert.equal(controls.requests.length, 1); assert.equal(controls.tables.weekly_reviews.length, 1);
});
test('lost update acknowledgement confirms changed fields and preserves unrelated text', async () => {
  const { repo, controls } = setup([row()]); const before = (await repo.fetchConfirmed())[0];
  controls.failNext('weekly_reviews', { status: 503, afterCommit: true });
  const saved = await repo.save({ ...before, notice: '' }, before);
  assert.equal(saved.notice, ''); assert.equal(saved.highlights, before.highlights); assert.equal(controls.requests.length, 1);
});
test('lost acknowledgement plus failed reconciliation retains the same ID for explicit retry', async () => {
  const { repo, controls, supabase } = setup();
  const channel = supabase.channel().on(null, { table: 'weekly_reviews' }, () => {
    controls.failNext('weekly_reviews', { read: true, status: 503 });
  }).subscribe();
  controls.failNext('weekly_reviews', { status: 0, afterCommit: true });
  await assert.rejects(repo.save(draft()), (e: SaveFailure) => e.retryable);
  supabase.removeChannel(channel);
  assert.equal(controls.tables.weekly_reviews.length, 1);
  assert.equal((await repo.save(draft())).id, draft().id);
  assert.equal(controls.requests.length, 1);
});
test('reported DB uniqueness rejection never becomes success or overwrites another row', async () => {
  const { repo, controls } = setup();
  controls.failNext('weekly_reviews', { status: 409, code: '23505' });
  await assert.rejects(repo.save(draft()), (e: SaveFailure) => !e.retryable);
  assert.equal(controls.tables.weekly_reviews.length, 0);
});
test('permission failures and deleted records cannot produce false success', async () => {
  const { repo, controls } = setup([row()]); const before = (await repo.fetchConfirmed())[0];
  controls.failNext('weekly_reviews', { status: 403, code: '42501' });
  await assert.rejects(repo.save({ ...before, highlights: '새 내용' }, before), (e: SaveFailure) => !e.retryable);
  controls.tables.weekly_reviews = [];
  await assert.rejects(repo.save({ ...before, highlights: '새 내용' }, before), (e: SaveFailure) => !e.retryable);
});
test('failed save keeps the same request and stable ID across coordinator retries and double clicks', async () => {
  const { repo, controls } = setup(); const coordinator = new SaveCoordinator(), commits: WeeklyReview[] = [];
  const value = draft(); const request = { key: `weeklyReviews:${value.id}`, label: '회고', intent: saveIntent(value), execute: () => repo.save(value), commit: (r: WeeklyReview) => commits.push(r) };
  controls.failNext('weekly_reviews', { status: 503 });
  const first = coordinator.run(request), second = coordinator.run(request); assert.equal(first, second);
  assert.equal(await first, null); assert.equal(commits.length, 0);
  assert.equal(await coordinator.run(request), null); assert.equal(controls.requests.length, 1);
  await coordinator.retry(request.key); assert.equal(commits[0].id, value.id); assert.equal(controls.tables.weekly_reviews.length, 1);
});
test('unavailable read blocks creation; it never becomes an empty week', async () => {
  const { repo, controls } = setup([row()]); controls.failNext('weekly_reviews', { read: true, status: 503 });
  await assert.rejects(repo.fetchConfirmed());
  controls.failNext('weekly_reviews', { read: true, status: 503 });
  await assert.rejects(repo.save(draft())); assert.equal(controls.requests.length, 0);
});
test('same-client concurrent creations serialize canonical and legacy aliases; no automatic merge', async () => {
  const { repo, controls, supabase } = setup(); const other = weeklyReviewRepository(supabase);
  const results = await Promise.allSettled([repo.save(draft()), other.save(draft({ id: 'other', weekKey: '2027-W53' }))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(controls.tables.weekly_reviews.length, 1);
  await assert.rejects(repo.save(draft({ id: 'third' }))); assert.equal(controls.tables.weekly_reviews.length, 1);
});
test('independent clients without a DB unique/transaction can race: browser locks are not a server guarantee', async () => {
  const { supabase, controls } = setup();
  const first = weeklyReviewRepository({ from: supabase.from });
  const second = weeklyReviewRepository({ from: supabase.from });
  controls.hold('weekly_reviews');
  const pending = [first.save(draft()), second.save(draft({ id: 'independent-client' }))];
  while (controls.requests.length < 2) await new Promise(resolve => setTimeout(resolve, 1));
  controls.release('weekly_reviews'); await Promise.all(pending);
  // This mock intentionally has no unique constraint: production must verify the actual DB contract.
  assert.equal(controls.tables.weekly_reviews.length, 2);
});
test('collision rows can each be edited without key conversion or deletion', async () => {
  const { repo, controls } = setup([row(), row({ id: 'second', week_key: '2026-W53' })]);
  for (const before of await repo.fetchConfirmed()) await repo.save({ ...before, highlights: before.id }, before);
  assert.deepEqual(controls.tables.weekly_reviews.map(r => [r.id, r.week_key, r.highlights]), [['old', '2027-W53', 'old'], ['second', '2026-W53', 'second']]);
});
test('year boundaries use ISO keys; editing a one-digit record never pads its stored key', async () => {
  assert.equal(getWeekKey(new Date('2018-12-31T12:00:00')), '2019-W01');
  assert.equal(getWeekKey(new Date('2027-01-01T12:00:00')), '2026-W53');
  const { repo, controls } = setup([row({ week_key: '2026-W1' })]); const before = (await repo.fetchConfirmed())[0];
  await repo.save({ ...before, nextWeek: '' }, before);
  assert.equal(controls.tables.weekly_reviews[0].week_key, '2026-W1');
  await assert.rejects(repo.save({ ...before, weekKey: '2026-W01' }, before));
});
test('paged reads retain history beyond the REST row limit', async () => {
  const { repo } = setup(Array.from({ length: 1001 }, (_, i) => row({ id: `history-${i}` })));
  assert.equal((await repo.fetchConfirmed()).length, 1001);
});
