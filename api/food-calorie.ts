/**
 * Vercel Edge Function — OpenAI 칼로리 추정 API 프록시
 * GET /api/food-calorie?input=음식명(+양)
 *
 * 환경변수: VITE_OPENAI_API_KEY
 *
 * 반환: { calories: number | null }
 */

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get('input')?.trim();

  if (!input) {
    return json({ error: 'input 파라미터가 필요합니다.', calories: null }, 400);
  }

  const apiKey = process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[food-calorie] VITE_OPENAI_API_KEY 환경변수 누락');
    return json({ error: 'API 키가 설정되지 않았습니다.', calories: null }, 500);
  }

  const prompt = `${input}의 칼로리를 추정해줘. 양이 명시되면 그 양 기준으로, 없으면 1인분 기준으로. 숫자만 답해줘.`;

  let raw: any;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      console.error('[food-calorie] OpenAI API 오류:', res.status);
      return json({ error: 'OpenAI API 호출 실패', calories: null }, 502);
    }
    raw = await res.json();
  } catch (e) {
    console.error('[food-calorie] fetch 오류:', e);
    return json({ error: '외부 API 요청 중 오류 발생', calories: null }, 502);
  }

  const text: string = raw?.choices?.[0]?.message?.content?.trim() ?? '';
  // 숫자만 추출 (소수점 포함)
  const match = text.match(/[\d]+/);
  const calories = match ? parseInt(match[0], 10) : null;

  return json({ calories: Number.isFinite(calories) ? calories : null });
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
