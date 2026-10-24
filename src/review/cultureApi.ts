import type { TMDBResult } from '../lib/tmdb';
import type { YouTubeMetadata } from '../lib/youtube';

/** Static review adapters: no fetch, SDK, token or network fallback. */
async function sampleDelay(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await new Promise<void>((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve(); }, 120);
    signal?.addEventListener('abort', aborted, {once:true});
  });
}
export function hasTMDBToken() { return true; } // Sample availability, never a real credential.
export function getPosterUrl(path?: string | null) { return path ? `https://moamoa-culture.example.invalid/${path}` : null; }
export async function searchTMDB(query: string, signal?: AbortSignal): Promise<TMDBResult[]> {
  await sampleDelay(signal);
  if (query.trim() === '오류') throw new Error('로컬 샘플 검색 오류');
  if (query.trim() === '없음' || !query.trim()) return [];
  return [
    {id:900001,type:'movie',title:'로컬 샘플 영화 · 여름의 장면',original_title:'LOCAL SAMPLE FILM',year:'2026',poster_path:'summer'},
    {id:900002,type:'tv',title:'로컬 샘플 드라마 · 조용한 저녁',original_title:'LOCAL SAMPLE SERIES',year:'2026',poster_path:'evening'},
  ];
}
export function extractYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:','https:'].includes(url.protocol) || !['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname)) return null;
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1)
      : url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)\/?$/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export async function fetchYouTubeMetadata(value: string, signal?: AbortSignal): Promise<YouTubeMetadata | null> {
  await sampleDelay(signal);
  const id = extractYouTubeVideoId(value);
  if (!id || id === 'failure0000') return null;
  return {title:'로컬 샘플 영상 · 작은 작업실',author_name:'샘플 채널 (실제 조회 아님)',thumbnail_url:'https://moamoa-culture.example.invalid/studio'};
}
