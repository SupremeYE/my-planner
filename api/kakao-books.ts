/**
 * Vercel Edge Function — 카카오 도서 검색 API 프록시
 * GET /api/kakao-books?query=검색어
 *
 * 환경변수: VITE_KAKAO_API_KEY (카카오 REST API 키)
 *
 * 반환:
 *   { documents: Array<{ title, authors, publisher, thumbnail, isbn, datetime }> }
 */

export const config = { runtime: 'edge' };

const KAKAO_BOOKS_URL = 'https://dapi.kakao.com/v3/search/book';

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return json({ error: 'query 파라미터가 필요합니다.' }, 400);
  }

  const apiKey = process.env.VITE_KAKAO_API_KEY;
  if (!apiKey) {
    console.error('[kakao-books] VITE_KAKAO_API_KEY 환경변수 누락');
    return json({ error: 'API 키가 설정되지 않았습니다.' }, 500);
  }

  try {
    const res = await fetch(
      `${KAKAO_BOOKS_URL}?query=${encodeURIComponent(query)}&size=10`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.error('[kakao-books] 카카오 API 응답 오류:', res.status);
      return json({ error: '카카오 API 호출 실패', documents: [] }, 502);
    }

    const data = await res.json();
    return json({ documents: data.documents ?? [] });
  } catch (e) {
    console.error('[kakao-books] fetch 오류:', e);
    return json({ error: '외부 API 요청 중 오류 발생', documents: [] }, 502);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
