import type { CultureRecord, CultureStatus, CultureContentType, CulturePlatform } from '../app/store';
import { confirmedWrites } from './confirmedWrites';
import { SaveFailure, saveIntent } from './saveCoordinator';

// Keep the legacy culture_records contract. No media migration or Storage writes.
export type CultureRow = ReturnType<typeof fromCultureRecord> & { created_at?: string; updated_at?: string };
export function fromCultureRecord(r: CultureRecord) {
  return {
    id: r.id, title: r.title, platform: r.platform, content_type: r.contentType,
    url: r.url ?? null, thumbnail_url: r.thumbnailUrl ?? null,
    external_source: r.externalSource ?? null, external_id: r.externalId ?? null,
    status: r.status, rating: r.rating ?? null, review: r.review ?? null,
    insight: r.insight ?? null, tags: r.tags ?? [], watched_date: r.watchedDate ?? null,
    ...(r.updatedAt ? {updated_at: r.updatedAt} : {}),
  };
}
export function toCultureRecord(r: CultureRow): CultureRecord {
  return {
    id: r.id, title: r.title, platform: r.platform, contentType: r.content_type,
    url: r.url ?? null, thumbnailUrl: r.thumbnail_url ?? null,
    externalSource: r.external_source ?? null, externalId: r.external_id ?? null,
    status: r.status, rating: r.rating == null ? null : Number(r.rating),
    review: r.review ?? null, insight: r.insight ?? null, tags: r.tags ?? [],
    watchedDate: r.watched_date ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
export const cultureStatusLabels: Record<CultureStatus, string> = {
  watchlist: '보고 싶은', watching: '보는 중', completed: '감상 완료', dropped: '중단',
};
export function safeCultureUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? value : undefined; }
  catch { return undefined; }
}
export function validateCultureRecord(r: CultureRecord, before?: CultureRecord) {
  if (!r.title.trim()) throw new SaveFailure('작품명을 입력해주세요.', false);
  if (r.rating != null && (!Number.isFinite(r.rating) || r.rating < 0 || r.rating > 5 || r.rating * 2 % 1)) {
    throw new SaveFailure('별점은 0~5점 사이, 0.5점 단위로 선택해주세요.', false);
  }
  if (r.watchedDate && (!/^\d{4}-\d{2}-\d{2}$/.test(r.watchedDate) || Number.isNaN(Date.parse(r.watchedDate)) || new Date(r.watchedDate).toISOString().slice(0, 10) !== r.watchedDate)) {
    throw new SaveFailure('감상 날짜를 확인해주세요.', false);
  }
  for (const key of ['url', 'thumbnailUrl'] as const) {
    // Preserve old values verbatim; only newly entered links must pass validation.
    if (r[key] && r[key] !== before?.[key] && !safeCultureUrl(r[key])) throw new SaveFailure('링크는 http 또는 https 주소로 입력해주세요.', false);
  }
}
export function cultureRepository(client: { from: (table: string) => any }) {
  const writes = confirmedWrites<CultureRecord, CultureRow>(client, 'culture_records', fromCultureRecord, toCultureRecord);
  return {
    ...writes,
    async save(record: CultureRecord, before?: CultureRecord) {
      validateCultureRecord(record, before);
      if (!before) return writes.createConfirmed(record);
      if (before.id !== record.id) throw new SaveFailure('기록 ID가 일치하지 않아요.', false);
      const old = fromCultureRecord(before), next = fromCultureRecord(record);
      const changed = Object.keys(next).filter(k => k !== 'id' && saveIntent(next[k as keyof typeof next]) !== saveIntent(old[k as keyof typeof old]));
      const saved = changed.length ? await writes.updateConfirmed(before, {...record, updatedAt: new Date().toISOString()}) : await writes.getConfirmed(record.id);
      if (!saved) throw new SaveFailure('기록이 삭제되었거나 조회 권한이 없어요. 다시 불러와주세요.', false);
      const actual = fromCultureRecord(saved);
      if (changed.some(k => saveIntent(next[k as keyof typeof next]) !== saveIntent(actual[k as keyof typeof actual]))) throw new SaveFailure('변경 결과를 확인하지 못했어요. 다시 불러와주세요.', false);
      return saved;
    },
  };
}
export interface CultureFilter {
  search: string; status: CultureStatus | 'all'; type: CultureContentType | 'all';
  platform: CulturePlatform | 'all'; sort: 'created' | 'watched' | 'rating';
}
export function filterCultureRecords(records: CultureRecord[], filter: CultureFilter) {
  const q = filter.search.trim().toLocaleLowerCase();
  return records.filter(r => (filter.status === 'all' || r.status === filter.status)
    && (filter.type === 'all' || r.contentType === filter.type)
    && (filter.platform === 'all' || r.platform === filter.platform)
    && (!q || r.title.toLocaleLowerCase().includes(q) || r.tags.some(t => t.toLocaleLowerCase().includes(q))))
    .sort((a, b) => (filter.sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1)
      : filter.sort === 'watched' ? (b.watchedDate ?? '').localeCompare(a.watchedDate ?? '')
        : (b.createdAt ?? '').localeCompare(a.createdAt ?? '')) || a.id.localeCompare(b.id));
}
