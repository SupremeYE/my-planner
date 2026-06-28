// Supabase Edge Function: fx-rate
//
// 입력: { from: string, to?: string ('KRW'), date?: 'yyyy-MM-dd' }
//   · date 있으면 그 날짜(과거/당일) 환율(결제일 환산용), 없으면 최신(latest).
// 출력(항상 200 JSON): 성공 → { ok:true, rate:number, source:string } / 실패 → { ok:false, error }
//
// 왜 서버사이드인가:
//   브라우저 직접 호출은 (1) 무료 환율 호스트 다운/불안정, (2) CORS, (3) 확장/차단에 취약.
//   서버↔서버는 CORS 무관 + 다중 공급자 폴백으로 한 곳이 죽어도 동작.
//   공급자 우선순위: frankfurter.dev(ECB) → frankfurter.app(ECB) → open.er-api.com(무키, latest만).
//
// 키 불필요(전부 무료 공개 API). 정적 데이터 — 입력/조회 시점 1회만 호출(렌더 루프 호출 금지).

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

const ALLOWED = ['KRW', 'USD', 'EUR', 'JPY'];
const isRate = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

// 단일 URL 에서 rates[to] 추출(Frankfurter / open.er-api 공통 스키마: { rates: { KRW: n } }).
async function tryFetch(url: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) { console.error('[fx-rate] fetch', res.status, url); return null; }
    const j = await res.json();
    const rate = j?.rates?.[to];
    return isRate(rate) ? rate : null;
  } catch (e) {
    console.error('[fx-rate] fetch 예외', url, String(e));
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({}));
    const from = typeof body.from === 'string' && ALLOWED.includes(body.from) ? body.from : null;
    const to = typeof body.to === 'string' && ALLOWED.includes(body.to) ? body.to : 'KRW';
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;

    if (!from) return json({ ok: false, error: 'from 통화가 올바르지 않아요' });
    if (from === to) return json({ ok: true, rate: 1, source: 'identity' });

    // 공급자 폴백 체인 — 과거일은 historical 지원처만(open.er-api 제외).
    const providers: { url: string; source: string }[] = date
      ? [
          { url: `https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=${to}`, source: `frankfurter.dev@${date}` },
          { url: `https://api.frankfurter.app/${date}?from=${from}&to=${to}`, source: `frankfurter.app@${date}` },
        ]
      : [
          { url: `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, source: 'frankfurter.dev' },
          { url: `https://api.frankfurter.app/latest?from=${from}&to=${to}`, source: 'frankfurter.app' },
          { url: `https://open.er-api.com/v6/latest/${from}`, source: 'open.er-api' },
        ];

    for (const p of providers) {
      const rate = await tryFetch(p.url, to);
      if (rate != null) return json({ ok: true, rate, source: p.source });
    }
    return json({ ok: false, error: '환율 공급자에서 값을 받지 못했어요' });
  } catch (e) {
    console.error('[fx-rate] 예외:', String(e));
    return json({ ok: false, error: String(e) });
  }
});
