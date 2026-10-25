import type { WeeklyReview } from '../app/store';
import { confirmedWrites } from './confirmedWrites';
import { readAllRows } from './readAllRows';
import { saveFailure, SaveFailure } from './saveCoordinator';
import { weekKeyForRead, weekKeysMatch } from './weekKeys';

export const reviewFields = ['highlights', 'kptKeep', 'notice', 'kptTry', 'nextWeek'] as const;
export type ReviewField = typeof reviewFields[number];
export type ReviewText = Record<ReviewField, string>;
export function reviewText(record?: WeeklyReview): ReviewText {
  return Object.fromEntries(reviewFields.map(key => [key, record?.[key] ?? ''])) as ReviewText;
}
type Row = { id: string; week_key: string; highlights: string | null; kpt_keep: string | null;
  notice: string | null; kpt_try: string | null; next_week: string | null };
// The existing db.weeklyReviews codec contract, without changing legacy optimistic callers.
const decode = (r: Row): WeeklyReview => ({ id: r.id, weekKey: r.week_key, highlights: r.highlights ?? undefined,
  kptKeep: r.kpt_keep ?? undefined, notice: r.notice ?? undefined, kptTry: r.kpt_try ?? undefined, nextWeek: r.next_week ?? '' });
const encode = (r: WeeklyReview): Row => ({ id: r.id, week_key: r.weekKey, highlights: r.highlights ?? null,
  kpt_keep: r.kptKeep ?? null, notice: r.notice ?? null, kpt_try: r.kptTry ?? null, next_week: r.nextWeek ?? '' });

// Shared by repositories using the same client. This is a browser-process lock, NOT a DB transaction.
const clientLocks = new WeakMap<object, Map<string, Promise<void>>>();
export function weeklyReviewRepository(client: { from: (table: string) => any }) {
  const writer = confirmedWrites<WeeklyReview, Row>(client, 'weekly_reviews', encode, decode);
  const locks = clientLocks.get(client) ?? new Map<string, Promise<void>>();
  clientLocks.set(client, locks);
  const fetchConfirmed = async () => (await readAllRows<Row>(client, 'weekly_reviews', 'week_key')).map(decode);

  async function save(value: WeeklyReview, before?: WeeklyReview): Promise<WeeklyReview> {
    const target = structuredClone(value), original = before && structuredClone(before);
    if (original && (target.id !== original.id || target.weekKey !== original.weekKey)) {
      throw new SaveFailure('기존 회고의 식별 정보가 달라 저장할 수 없어요.', false);
    }
    const changed = reviewFields.filter(key => !original || (target[key] ?? '') !== (original[key] ?? ''));
    const matches = (row: WeeklyReview | null): row is WeeklyReview => !!row && row.id === target.id
      && row.weekKey === target.weekKey && changed.every(key => (row[key] ?? '') === (target[key] ?? ''));
    const key = weekKeyForRead(target.weekKey);
    const previous = locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => gate);
    locks.set(key, queued);
    await previous;
    try {
      // Retry always checks the stable ID first. A lost acknowledgement must not create a new row.
      const latest = await writer.getConfirmed(target.id);
      if (matches(latest)) return latest;
      if (original) {
        if (!latest || latest.weekKey !== original.weekKey) throw new SaveFailure('기존 회고를 확인할 수 없어요. 내용을 보관하고 다시 조회해주세요.', false);
        if (changed.some(key => (latest[key] ?? '') !== (original[key] ?? '') && (latest[key] ?? '') !== (target[key] ?? ''))) {
          throw new SaveFailure('다른 화면에서 같은 항목을 수정했어요. 입력 내용을 보관하고 최신 회고를 확인해주세요.', false);
        }
      } else {
        if (latest) throw new SaveFailure('같은 ID의 회고 내용이 달라요. 최신 회고를 확인해주세요.', false);
        const records = await fetchConfirmed(); // Errors cannot be interpreted as an empty week.
        if (records.some(row => weekKeysMatch(row.weekKey, target.weekKey))) {
          throw new SaveFailure('이 주차에 회고가 이미 있어요. 입력 내용을 보관하고 기존 회고를 열어주세요.', false);
        }
      }
      try {
        const patch = Object.fromEntries(changed.map(key => [key, target[key] ?? '']));
        let saved: WeeklyReview;
        if (original) {
          const oldRow = encode(latest!), newRow = encode({ ...latest!, ...patch });
          const columns = Object.keys(newRow).filter(key => key !== 'id' && key !== 'week_key'
            && newRow[key as keyof Row] !== oldRow[key as keyof Row]);
          if (!columns.length) return latest!;
          const payload = Object.fromEntries(columns.map(key => [key, newRow[key as keyof Row]]));
          let query = client.from('weekly_reviews').update(payload).eq('id', target.id).eq('week_key', target.weekKey);
          // Compare only changed columns atomically; preserve concurrent edits to unrelated fields.
          for (const column of columns) query = oldRow[column as keyof Row] === null
            ? query.is(column, null) : query.eq(column, oldRow[column as keyof Row]);
          const result = await query.select('*');
          if (result.error) throw saveFailure(result.error, result.status);
          if (!Array.isArray(result.data) || result.data.length !== 1) {
            throw new SaveFailure('저장 중 회고가 변경됐어요. 입력 내용을 보관하고 최신 회고를 확인해주세요.', false);
          }
          saved = decode(result.data[0]);
        } else saved = await writer.createConfirmed(target);
        if (!matches(saved)) throw new SaveFailure('저장된 내용이 입력과 달라요. 다시 확인해주세요.', true);
        return saved;
      } catch (error) {
        // A failed response can follow a successful commit. Only matching persisted fields confirm success.
        try { const saved = await writer.getConfirmed(target.id); if (matches(saved)) return saved; } catch { /* explicit retry retains the request */ }
        throw error;
      }
    } finally {
      release();
      if (locks.get(key) === queued) locks.delete(key);
    }
  }
  return { fetchConfirmed, save };
}
