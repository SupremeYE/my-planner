// TMDB(The Movie Database) 검색 유틸
// 인증: Bearer 토큰 (import.meta.env.VITE_TMDB_API_TOKEN)
//  - Vercel Production/Preview 에 등록되어 배포본은 동작.
//  - 로컬은 .env 에 VITE_TMDB_API_TOKEN 추가 필요.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

export type TMDBMediaType = 'movie' | 'tv';

export interface TMDBResult {
  id: number;
  type: TMDBMediaType;
  title: string;
  original_title: string;
  year: string;          // 'YYYY' 또는 ''
  poster_path: string | null;
}

/** 토큰이 설정되어 있는지 (검색 패널 활성화 판단용) */
export function hasTMDBToken(): boolean {
  return !!import.meta.env.VITE_TMDB_API_TOKEN;
}

/** 포스터 경로 → 전체 이미지 URL (없으면 null) */
export function getPosterUrl(posterPath: string | null | undefined): string | null {
  return posterPath ? `${IMG_BASE}${posterPath}` : null;
}

interface TMDBSearchError extends Error {
  status?: number;
}

/**
 * /search/multi 로 영화·TV를 검색한다 (인물 등은 제외).
 * 오류 시 status가 붙은 Error를 throw → 호출부에서 분기.
 */
export async function searchTMDB(query: string): Promise<TMDBResult[]> {
  const token = import.meta.env.VITE_TMDB_API_TOKEN as string | undefined;
  if (!token) {
    const err: TMDBSearchError = new Error('TMDB 토큰 없음');
    err.status = 0;
    throw err;
  }
  const q = query.trim();
  if (!q) return [];

  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(q)}&language=ko-KR&include_adult=false&page=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (!res.ok) {
    const err: TMDBSearchError = new Error(`TMDB 요청 실패 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const results: any[] = Array.isArray(json?.results) ? json.results : [];

  return results
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r): TMDBResult => {
      const isMovie = r.media_type === 'movie';
      const date: string = (isMovie ? r.release_date : r.first_air_date) ?? '';
      return {
        id: r.id,
        type: isMovie ? 'movie' : 'tv',
        title: (isMovie ? r.title : r.name) ?? '',
        original_title: (isMovie ? r.original_title : r.original_name) ?? '',
        year: date ? date.slice(0, 4) : '',
        poster_path: r.poster_path ?? null,
      };
    });
}
