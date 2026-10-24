import type { CultureRecord } from '../app/store';
import { extractYouTubeVideoId, fetchYouTubeMetadata } from './youtube';
import { getPosterUrl, searchTMDB } from './tmdb';

export interface CultureSuggestion {
  title: string; thumbnailUrl: string | null; contentType: CultureRecord['contentType'];
  externalSource: CultureRecord['externalSource']; externalId: string; url?: string; year?: string;
}
/** Guard the legacy ID extractor with actual URL/host validation. */
export function cultureYouTubeId(value: string) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return null;
    const id = extractYouTubeVideoId(value);
    const full = url.hostname === 'youtu.be' ? url.pathname.slice(1)
      : url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)\/?$/)?.[1];
    return id && full === id ? id : null;
  } catch { return null; }
}
export async function cultureTMDBSuggestions(query: string, signal: AbortSignal): Promise<CultureSuggestion[]> {
  return (await searchTMDB(query, signal)).map(r => ({title: r.title || r.original_title,
    thumbnailUrl: getPosterUrl(r.poster_path), contentType: r.type === 'movie' ? 'movie' : 'drama',
    externalSource: r.type === 'movie' ? 'tmdb_movie' : 'tmdb_tv', externalId: String(r.id), year: r.year,
  }));
}
export async function cultureYouTubeSuggestion(value: string, signal: AbortSignal): Promise<CultureSuggestion[]> {
  const id = cultureYouTubeId(value);
  if (!id) throw new Error('YouTube URL을 확인해주세요.');
  const meta = await fetchYouTubeMetadata(value, signal);
  if (!meta) throw new Error('영상 정보를 불러오지 못했어요.');
  return [{title: meta.title, thumbnailUrl: meta.thumbnail_url || null, externalSource: 'youtube', externalId: id,
    contentType: 'youtube_video', url: value}];
}
/** Suggestions never replace nonempty user text, media links or existing reviews/ratings. */
export function applyCultureSuggestion(record: CultureRecord, suggestion: CultureSuggestion, touched: ReadonlySet<keyof CultureRecord>): CultureRecord {
  return {...record,
    title: !record.title.trim() && !touched.has('title') ? suggestion.title : record.title,
    thumbnailUrl: !record.thumbnailUrl && !touched.has('thumbnailUrl') ? suggestion.thumbnailUrl : record.thumbnailUrl,
    url: !record.url && !touched.has('url') ? suggestion.url ?? record.url : record.url,
    contentType: touched.has('contentType') ? record.contentType : suggestion.contentType,
    platform: suggestion.externalSource === 'youtube' && !touched.has('platform') && record.platform === 'other' ? 'youtube' : record.platform,
    externalSource: suggestion.externalSource, externalId: suggestion.externalId,
  };
}
