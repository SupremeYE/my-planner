import type { Tag } from '../app/store';
import { SaveFailure } from './saveCoordinator';

export interface ClassificationSnapshot {
  version: 1;
  shares: Array<{ tagId: string; name: string; color: string; weight: number }>;
}
export interface ActivityEntry {
  id: string;
  userId?: string;
  operationId: string;
  date: string;
  name: string;
  elapsedSec: number;
  categoryId?: string;
  classificationSnapshot: ClassificationSnapshot;
  memo?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
export function snapshotTags(ids: string[], tags: Tag[]): ClassificationSnapshot {
  const selected = tags.filter(tag => tag.trackTime && ids.includes(tag.id));
  return { version: 1, shares: selected.map(tag => ({ tagId: tag.id, name: tag.name, color: tag.color, weight: 1 / selected.length })) };
}
export function validSnapshot(value: unknown): value is ClassificationSnapshot {
  const v = value as ClassificationSnapshot;
  return !!v && v.version === 1 && Array.isArray(v.shares) && v.shares.every(s => !!s && typeof s === 'object')
    && new Set(v.shares.map(s => s.tagId)).size === v.shares.length
    && v.shares.every(s => typeof s.tagId === 'string' && !!s.tagId && typeof s.name === 'string' && typeof s.color === 'string' && Number.isFinite(s.weight) && s.weight > 0)
    && (v.shares.length === 0 || Math.abs(v.shares.reduce((n, s) => n + s.weight, 0) - 1) < 1e-8);
}
export function validActivityDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
export function validateActivity(entry: ActivityEntry) {
  if (!entry.name.trim() || entry.name.length > 500 || !validActivityDate(entry.date) || !Number.isInteger(entry.elapsedSec) || entry.elapsedSec < 1 || entry.elapsedSec > 86400)
    throw new SaveFailure('활동명, 날짜와 1초~24시간의 실제 소요를 확인해주세요.', false);
  if (!validSnapshot(entry.classificationSnapshot) || entry.classificationSnapshot.shares.length > 1 || (entry.categoryId ?? null) !== (entry.classificationSnapshot.shares[0]?.tagId ?? null))
    throw new SaveFailure('대표 카테고리 정보를 확인해주세요.', false);
  if (!!entry.startedAt !== !!entry.endedAt) throw new SaveFailure('실제 시작과 종료 시각을 함께 입력해주세요.', false);
  if (entry.startedAt && entry.endedAt) {
    const start = Date.parse(entry.startedAt), end = Date.parse(entry.endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || Math.abs((end - start) / 1000 - entry.elapsedSec) > 1)
      throw new SaveFailure('실제 시작·종료 간격과 소요 시간이 일치해야 해요.', false);
  }
}
