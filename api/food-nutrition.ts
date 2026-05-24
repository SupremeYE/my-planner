/**
 * Vercel Edge Function — 식약처 영양성분 DB API 프록시
 * GET /api/food-nutrition?query=음식명
 *
 * 환경변수: VITE_FOOD_API_KEY (식약처 공공데이터포털 API 키)
 *
 * 반환:
 *   { results: Array<{ foodName, calories, carbs, protein, fat, servingSize }> }
 */

export const config = { runtime: 'edge' };

const FOOD_API_URL =
  'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo01/getFoodNtrCpntDbInqD2';

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return json({ error: 'query 파라미터가 필요합니다.' }, 400);
  }

  const apiKey = process.env.VITE_FOOD_API_KEY;
  if (!apiKey) {
    console.error('[food-nutrition] VITE_FOOD_API_KEY 환경변수 누락');
    return json({ error: 'API 키가 설정되지 않았습니다.' }, 500);
  }

  // 식약처 API는 serviceKey를 이중 인코딩 없이 그대로 사용
  const url =
    `${FOOD_API_URL}` +
    `?serviceKey=${apiKey}` +
    `&pageNo=1` +
    `&numOfRows=15` +
    `&FOOD_NM_KR=${encodeURIComponent(query)}` +
    `&type=json`;

  let raw: any;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error('[food-nutrition] 식약처 API 응답 오류:', res.status);
      return json({ error: '식약처 API 호출 실패', results: [] }, 502);
    }
    raw = await res.json();
  } catch (e) {
    console.error('[food-nutrition] fetch 오류:', e);
    return json({ error: '외부 API 요청 중 오류 발생', results: [] }, 502);
  }

  // 응답 구조: { header, body: { items: [...] } }
  const items: any[] = raw?.body?.items ?? [];

  const results = items
    .filter((item) => item?.FOOD_NM_KR)
    .map((item) => ({
      foodName: item.FOOD_NM_KR as string,
      // NUTR_CONT1 = 에너지(kcal), NUTR_CONT3 = 단백질, NUTR_CONT4 = 지방, NUTR_CONT6 = 탄수화물
      calories: parseNum(item.NUTR_CONT1),
      protein: parseNum(item.NUTR_CONT3),
      fat: parseNum(item.NUTR_CONT4),
      carbs: parseNum(item.NUTR_CONT6),
      // 1회 제공량(g) — 없으면 100g 기준값
      servingSize: parseNum(item.SERVING_WT) || 100,
    }));

  return json({ results });
}

function parseNum(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? Math.round(n * 10) / 10 : 0;
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
