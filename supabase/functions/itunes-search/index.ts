// Supabase Edge Function: itunes-search
//
// 목적: iTunes Search API 를 서버에서 대신 호출하는 프록시.
//   브라우저에서 https://itunes.apple.com/search 를 직접 fetch 하면 CORS 로
//   막힐 수 있어, 이 함수가 대신 호출하고 깔끔하게 매핑한 결과만 돌려준다.
//
// 호출(클라이언트):
//   supabase.functions.invoke('itunes-search', { body: { term: '검색어' } })
//
// 응답: { results: MusicSearchResult[] }
//   MusicSearchResult = {
//     trackTitle, artist, album, artworkUrl, releaseYear, itunesTrackId, previewUrl
//   }

interface ItunesRawResult {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
  previewUrl?: string;
  trackId?: number;
  artworkUrl100?: string;
}

// 브라우저에서 호출하므로 CORS 헤더 필요 (preflight 포함)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { term } = await req.json().catch(() => ({ term: '' }));
    const q = (term ?? '').toString().trim();
    if (!q) return json({ results: [] });

    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}` +
      `&media=music&entity=song&limit=20&country=KR`;

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return json({ results: [], error: `iTunes 요청 실패 (${res.status})` }, 502);
    }

    const data = await res.json();
    const raw: ItunesRawResult[] = Array.isArray(data?.results) ? data.results : [];

    const results = raw.map((r) => {
      const year = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null;
      // artworkUrl100 의 '100x100' 을 '600x600' 으로 치환해 고화질 이미지 확보
      const artworkUrl = r.artworkUrl100
        ? r.artworkUrl100.replace('100x100', '600x600')
        : null;
      return {
        trackTitle: r.trackName ?? '',
        artist: r.artistName ?? '',
        album: r.collectionName ?? null,
        artworkUrl,
        releaseYear: year && !Number.isNaN(year) ? year : null,
        itunesTrackId: r.trackId ?? null,
        previewUrl: r.previewUrl ?? null,
      };
    });

    return json({ results });
  } catch (e) {
    return json({ results: [], error: (e as Error).message }, 500);
  }
});
