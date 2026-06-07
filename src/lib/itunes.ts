// iTunes 곡 검색 유틸 (무료·API 키 불필요)
//
// iTunes Search API 를 브라우저에서 직접 fetch 하면 CORS 로 막힐 수 있어,
// Supabase Edge Function('itunes-search')으로 프록시해서 호출한다.
// 함수가 응답 매핑까지 끝낸 결과(MusicSearchResult[])를 그대로 받는다.

import { supabase } from './supabase';

export interface MusicSearchResult {
  trackTitle: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;   // artworkUrl100 → 600x600 고화질
  releaseYear: number | null;
  itunesTrackId: number | null;
  previewUrl: string | null;   // 30초 미리듣기
}

/**
 * 검색어로 곡을 검색한다 (최대 20곡).
 * Edge Function 프록시를 통해 호출하므로 CORS 문제 없음.
 * 실패 시 status 가 붙은 Error 를 throw → 호출부에서 안내.
 */
export async function searchMusic(term: string): Promise<MusicSearchResult[]> {
  const q = term.trim();
  if (!q) return [];

  const { data, error } = await supabase.functions.invoke('itunes-search', {
    body: { term: q },
  });

  if (error) {
    console.error('[itunes] search error:', error.message);
    throw new Error('곡 검색에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }

  const results = (data?.results ?? []) as MusicSearchResult[];
  // 제목/아티스트가 비어있는 항목은 제외
  return results.filter((r) => r.trackTitle && r.artist);
}
