// Supabase Edge Function: money-parse
//
// 입력: {
//   text: string,                    // 자연어("어제 갈비 먹고 5만원") 또는 카드/은행 문자
//   mode: 'chat' | 'sms',
//   today?: string,                  // 'yyyy-MM-dd' (상대 날짜 해석 기준; 없으면 함수 시각)
//   expense_categories?: string[],   // 선택 가능한 지출 대분류 이름 목록
//   income_categories?: string[],    // 선택 가능한 수입 대분류 이름 목록
//   subcategories?: { [대분류명]: string[] },  // 대분류별 소분류 후보(소분류 추론용)
// }
// 출력(항상 200 JSON, 실패도 graceful):
//   성공 → { ok:true, tx:{ type, amount, category, subcategory, memo, paymentMethod, spentAt, emoji } }
//   실패 → { ok:false, error }       (클라가 수동 입력으로 폴백)
//
// 동작: 한 줄 자연어/문자 1건을 gpt-4o-mini 로 읽어 거래 1건으로 구조화한다.
//   ⚠️ "입력 시점 1회"만 호출하는 보조 파서. 조회/렌더 경로에서 호출 금지.
//   환율/외부 시세 호출 없음(정적). 시크릿 OPENAI_API_KEY (transcribe/vision-extract 와 공유).
//
// vision-extract 의 JSON 강제 / 코드펜스 제거 / graceful fallback 패턴을 재사용.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function promptFor(
  mode: 'chat' | 'sms',
  today: string,
  expenseCats: string[],
  incomeCats: string[],
  subcats: Record<string, string[]>,
): string {
  // 대분류별 소분류 후보를 프롬프트에 펼침("식비: 배달, 외식, 마트 ...").
  const subLines = Object.entries(subcats)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([k, v]) => `    · ${k}: ${v.join(', ')}`);
  const subBlock = subLines.length
    ? ['- 소분류 후보(대분류별):', ...subLines].join('\n')
    : '- 소분류 후보: (없음)';

  const catLine = [
    `- 지출 대분류 후보: ${expenseCats.length ? expenseCats.join(', ') : '(없음)'}`,
    `- 수입 대분류 후보: ${incomeCats.length ? incomeCats.join(', ') : '(없음)'}`,
    '- category 는 반드시 위 대분류 후보 중 가장 알맞은 "이름 하나"를 그대로 골라. 애매하면 null.',
    subBlock,
    '- subcategory 는 고른 대분류(category)에 해당하는 소분류 후보 중 명확히 맞는 "이름 하나". 애매하거나 후보에 없으면 null(대분류만 기록).',
  ].join('\n');

  const common = [
    `오늘 날짜는 ${today} 야. "어제/그저께/오늘/지난주" 같은 표현은 이 기준으로 yyyy-MM-dd 로 변환해. 날짜 언급이 없으면 spentAt 은 오늘.`,
    catLine,
    '필드:',
    '  - type: "expense"(지출) | "income"(수입). 월급/입금/용돈/환급 등은 income, 나머지 소비는 expense.',
    '  - amount: 원화 정수(원 단위). "5만원"→50000, "8천"→8000, "1,200원"→1200. 콤마/단위 제거.',
    '  - category: 위 규칙대로 대분류 후보 중 하나 또는 null.',
    '  - subcategory: category 의 소분류 후보 중 하나 또는 null. 예) "오리고기 배달"→식비/배달, "이마트 장보기"→식비/마트, "택시"→교통/택시, "넷플릭스"→구독/OTT, "스타벅스"→카페/커피.',
    '  - memo: 거래를 한눈에 알아볼 짧은 한국어 설명(예: "갈비 외식", "스타벅스 커피"). 없으면 핵심 명사.',
    '  - paymentMethod: 카드/계좌/현금 등 결제수단이 보이면 그 이름(예: "삼성카드", "하나카드", "현금"). 없으면 null.',
    '  - spentAt: "yyyy-MM-dd" 문자열.',
    '  - emoji: 거래에 어울리는 이모지 1개(예: 🍖 ☕ 🚌 💰). 모호하면 null.',
    '출력은 JSON 객체 하나만: {"type":"expense","amount":35000,"category":"식비","subcategory":"배달","memo":"오리고기 배달","paymentMethod":null,"spentAt":"' + today + '","emoji":"🍖"}',
    '마크다운/코드펜스/설명 없이 JSON 만. 금액을 못 찾으면 {"ok":false}.',
  ];

  if (mode === 'sms') {
    return [
      '아래는 은행/카드사에서 온 결제·입금 문자 1건이야. 핵심만 뽑아 거래 1건으로 구조화해줘.',
      '승인/출금/결제 = expense, 입금/급여 = income. 가맹점명을 memo 로, 카드/은행명을 paymentMethod 로.',
      ...common,
    ].join('\n');
  }
  return [
    '아래는 사용자가 채팅처럼 자유롭게 쓴 가계부 입력 1건이야. 자연스러운 말투("어제 갈비 먹고 5만원 정도 썼어")까지 이해해서 거래 1건으로 구조화해줘.',
    ...common,
  ].join('\n');
}

// 코드펜스/잡텍스트를 걷어내고 첫 JSON 객체만 안전 파싱.
function parseObj(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try { return JSON.parse(s.slice(first, last + 1)); } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({}));
    const text: string = typeof body.text === 'string' ? body.text.trim() : '';
    const mode: 'chat' | 'sms' = body.mode === 'sms' ? 'sms' : 'chat';
    const today: string = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today : new Date().toISOString().slice(0, 10);
    const expenseCats: string[] = Array.isArray(body.expense_categories)
      ? body.expense_categories.filter((x: unknown): x is string => typeof x === 'string') : [];
    const incomeCats: string[] = Array.isArray(body.income_categories)
      ? body.income_categories.filter((x: unknown): x is string => typeof x === 'string') : [];
    // subcategories: { 대분류명: [소분류명, ...] } — 문자열 배열만 통과.
    const subcats: Record<string, string[]> = {};
    if (body.subcategories && typeof body.subcategories === 'object') {
      for (const [k, v] of Object.entries(body.subcategories as Record<string, unknown>)) {
        if (typeof k === 'string' && Array.isArray(v)) {
          const arr = v.filter((x: unknown): x is string => typeof x === 'string');
          if (arr.length) subcats[k] = arr;
        }
      }
    }

    if (!text) return json({ ok: false, error: 'text 가 필요해요' });

    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return json({ ok: false, error: 'OPENAI_API_KEY 가 설정되지 않았어요' });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 512,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: promptFor(mode, today, expenseCats, incomeCats, subcats) },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[money-parse] openai 실패:', res.status, detail.slice(0, 300));
      return json({ ok: false, error: `입력을 분석하지 못했어요 (${res.status})` });
    }

    const j = await res.json();
    const content = j?.choices?.[0]?.message?.content;
    const obj = typeof content === 'string' ? parseObj(content) : null;
    if (!obj) return json({ ok: false, error: '결과를 해석하지 못했어요' });
    if (obj.ok === false) return json({ ok: false, error: '거래 정보를 찾지 못했어요' });

    // 정규화 — 신뢰 가능한 값만 통과.
    const amount = Number(obj.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ ok: false, error: '금액을 인식하지 못했어요' });

    const type = obj.type === 'income' ? 'income' : 'expense';
    const cats = type === 'income' ? incomeCats : expenseCats;
    const category = typeof obj.category === 'string' && cats.includes(obj.category) ? obj.category : null;
    // 소분류는 (1) 대분류가 잡혔고 (2) 그 대분류의 후보 목록에 있을 때만 통과. 아니면 null(대분류만).
    const subcategory = category && typeof obj.subcategory === 'string' && (subcats[category]?.includes(obj.subcategory) ?? false)
      ? obj.subcategory : null;
    const spentAt = typeof obj.spentAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.spentAt) ? obj.spentAt : today;
    const memo = typeof obj.memo === 'string' && obj.memo.trim() ? obj.memo.trim() : null;
    const paymentMethod = typeof obj.paymentMethod === 'string' && obj.paymentMethod.trim() ? obj.paymentMethod.trim() : null;
    const emoji = typeof obj.emoji === 'string' && obj.emoji.trim() ? obj.emoji.trim() : null;

    return json({ ok: true, tx: { type, amount: Math.round(amount), category, subcategory, memo, paymentMethod, spentAt, emoji } });
  } catch (e) {
    console.error('[money-parse] 예외:', String(e));
    return json({ ok: false, error: String(e) });
  }
});
