// Supabase Edge Function: vision-extract
//
// 입력: { image_url: string, domain: 'beauty' | 'household' | 'recipe' }
// 출력(항상 200 JSON, 실패도 graceful):
//   beauty    → { ok:true, items:[{ name, brand?, category?, confidence }] }
//   household → { ok:true, items:[{ name, brand?, category?, quantity?, price?, purchase_place?, confidence }] }
//   recipe    → { ok:true, recipe:{ title?, ingredients:string[], steps:string[] } }   (items 와 키가 다름 — 클라가 domain 으로 분기)
//   실패/파싱불가 → { ok:false, error }   (클라가 수동 입력으로 폴백)
//
// 동작: 사진(제품/영수증) 1장을 OpenAI gpt-4o-mini vision 으로 읽어 항목을 추출한다.
//   ⚠️ "등록 시점 1회"만 호출하는 보조 추출기다. 조회/렌더 경로에서 호출 금지(클라이언트 규칙).
//   추출 결과(confidence·원문)는 영속 저장하지 않는다 — 사용자가 확정·편집한 값만 db 에 들어간다.
//
// 시크릿(이미 세팅됨, transcribe 와 공유):
//   OPENAI_API_KEY
//
// 비전보드(vision/)와 무관 — 폴더/함수명은 vision-extract.

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

// domain 별 추출 지시 + JSON 스키마 강제.
function promptFor(domain: 'beauty' | 'household' | 'recipe'): string {
  if (domain === 'recipe') {
    return [
      '이 이미지는 레시피가 담긴 화면 캡처(유튜브 숏츠/블로그 등)야. 보이는 글자를 읽고 재료와 조리 순서를 분리해줘.',
      '- ingredients: 재료 배열. 각 원소는 한 줄 문자열로 "이름 수량 단위" 순(예: "양파 1개", "간장 2큰술"). 수량/단위 안 보이면 이름만.',
      '- steps: 조리 순서 배열. 각 원소는 한 단계 문장(요리 view 타이머 인식 위해 "5분","30초" 같은 시간 표현은 그대로 보존).',
      '- title: 음식명이 보이면 추출(없으면 생략)',
      '출력은 JSON 객체 하나만: {"title":"...","ingredients":[...],"steps":[...]}',
      '마크다운/코드펜스/설명 없이 JSON만. 못 읽으면 {"ingredients":[],"steps":[]}.',
    ].join('\n');
  }
  if (domain === 'household') {
    return [
      '이 이미지는 생필품 사진 또는 영수증이야. 보이는 "생활용품/소모품" 품목을 추출해줘.',
      '영수증이면 여러 품목이 있을 수 있으니 각 줄을 개별 항목으로 분리해. 사진이면 보통 1개야.',
      '할인/합계/카드/부가세/포인트 같은 비(非)상품 줄은 제외해.',
      '각 항목 필드:',
      '  - name: 한국어 품목명(필수, 브랜드 제외한 일반명. 예: "화장지", "주방세제")',
      '  - brand: 브랜드명(보이면, 없으면 생략)',
      '  - category: 욕실/주방/세탁/청소/위생 중 추정 1개(불확실하면 생략)',
      '  - quantity: 수량 숫자(보이면, 없으면 생략)',
      '  - price: 가격 숫자만(원 단위, 콤마 제거. 보이면, 없으면 생략)',
      '  - purchase_place: 구매처/매장명(영수증 상단에 보이면, 없으면 생략)',
      '  - confidence: 0~1 사이 확신도(글자가 흐리거나 추정이면 낮게)',
      '출력은 JSON 객체 하나만: {"items":[{...}, ...]}',
      '마크다운, 코드펜스, 설명 문장 없이 JSON 만 출력해. 품목이 없으면 {"items":[]}.',
    ].join('\n');
  }
  return [
    '이 이미지는 화장품/뷰티 제품 사진이야. 보이는 제품을 추출해줘. 보통 1개, 여러 개면 모두.',
    '각 항목 필드:',
    '  - name: 한국어 제품명(필수. 라인/품목명. 예: "수분크림", "퍼펙트 클렌징폼")',
    '  - brand: 브랜드명(보이면, 없으면 생략)',
    '  - category: 스킨케어/클렌징/선케어/메이크업/향수/바디/헤어/팩 중 추정 1개(불확실하면 생략)',
    '  - confidence: 0~1 사이 확신도(글자가 흐리거나 추정이면 낮게)',
    '출력은 JSON 객체 하나만: {"items":[{...}, ...]}',
    '마크다운, 코드펜스, 설명 문장 없이 JSON 만 출력해. 제품을 못 읽으면 {"items":[]}.',
  ].join('\n');
}

// 코드펜스/잡텍스트를 걷어내고 첫 JSON 객체만 안전하게 파싱.
function parseItems(text: string): Array<Record<string, unknown>> | null {
  if (!text) return null;
  let s = text.trim();
  // ```json ... ``` / ``` ... ``` 펜스 제거
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // 본문에 설명이 섞여도 첫 { … 마지막 } 구간만 취함
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  const slice = s.slice(first, last + 1);
  try {
    const obj = JSON.parse(slice);
    const items = obj?.items;
    if (!Array.isArray(items)) return null;
    return items as Array<Record<string, unknown>>;
  } catch {
    return null;
  }
}

// recipe domain 전용: {title?, ingredients[], steps[]} 안전 파싱.
//  - parseItems 와 동일한 가드(코드펜스 제거 → 첫 { ~ 마지막 } → JSON.parse) 재사용.
//  - ingredients/steps 는 "문자열 원소만" 통과(빈 문자열·non-string 제거), title 은 문자열일 때만.
function parseRecipe(text: string): { title?: string; ingredients: string[]; steps: string[] } | null {
  if (!text) return null;
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const obj = JSON.parse(s.slice(first, last + 1));
    const toLines = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? arr.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
        : [];
    const out: { title?: string; ingredients: string[]; steps: string[] } = {
      ingredients: toLines(obj?.ingredients),
      steps: toLines(obj?.steps),
    };
    if (typeof obj?.title === 'string' && obj.title.trim()) out.title = obj.title.trim();
    return out;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { image_url, domain } = await req.json().catch(() => ({}));
    if (!image_url || (domain !== 'beauty' && domain !== 'household' && domain !== 'recipe')) {
      return json({ ok: false, error: 'image_url 과 domain(beauty|household|recipe) 이 필요해요' });
    }

    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return json({ ok: false, error: 'OPENAI_API_KEY 가 설정되지 않았어요' });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        // recipe 는 재료+순서가 길 수 있어 토큰을 더 준다(잘리면 JSON 파싱 실패). beauty/household 는 1024 유지.
        max_tokens: domain === 'recipe' ? 2048 : 1024,
        response_format: { type: 'json_object' }, // JSON 강제(파싱 안정화)
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: promptFor(domain) },
            { type: 'image_url', image_url: { url: image_url } },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[vision-extract] openai 실패:', res.status, detail.slice(0, 300));
      return json({ ok: false, error: `이미지를 읽지 못했어요 (${res.status})` });
    }

    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content;

    // recipe domain 은 items 가 아니라 {title,ingredients,steps} 구조 — 별도 출력 키(recipe)로 반환.
    if (domain === 'recipe') {
      const recipe = typeof text === 'string' ? parseRecipe(text) : null;
      if (recipe == null) return json({ ok: false, error: '추출 결과를 해석하지 못했어요' });
      return json({ ok: true, recipe });
    }

    const parsed = typeof text === 'string' ? parseItems(text) : null;
    if (parsed == null) return json({ ok: false, error: '추출 결과를 해석하지 못했어요' });

    // 필드 정규화 — 신뢰할 수 있는 것만 통과(나머지는 사용자가 시트에서 확정).
    const items = parsed
      .map((it) => {
        const name = typeof it.name === 'string' ? it.name.trim() : '';
        if (!name) return null;
        const out: Record<string, unknown> = { name };
        if (typeof it.brand === 'string' && it.brand.trim()) out.brand = it.brand.trim();
        if (typeof it.category === 'string' && it.category.trim()) out.category = it.category.trim();
        if (domain === 'household') {
          const q = Number(it.quantity);
          if (Number.isFinite(q) && q > 0) out.quantity = q;
          const p = Number(it.price);
          if (Number.isFinite(p) && p > 0) out.price = p;
          if (typeof it.purchase_place === 'string' && it.purchase_place.trim()) out.purchase_place = it.purchase_place.trim();
        }
        const c = Number(it.confidence);
        out.confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.5;
        return out;
      })
      .filter(Boolean);

    return json({ ok: true, items });
  } catch (e) {
    console.error('[vision-extract] 예외:', String(e));
    return json({ ok: false, error: String(e) });
  }
});
