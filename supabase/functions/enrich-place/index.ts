// Supabase Edge Function: enrich-place
//
// 입력: { place_id: string, summarize?: boolean }
//   (place_id 의 name/address/memo 는 DB 에서 RLS 로 읽는다 — 본인 장소만)
// 출력: { ok, blog_reviews, ai_summary, enriched_at }  (항상 200 JSON, 실패도 graceful)
//
// 동작 (장소 저장 직후 1회 호출 — 이후 지도/상세는 이 캐시만 읽음):
//  1) 네이버 블로그 검색 (장소명 + 동네) → 최대 5개, HTML/엔티티 정리
//  2) (선택) Haiku 요약 — ANTHROPIC_API_KEY 있고 summarize!==false 일 때만
//  3) places 업데이트: blog_reviews, (선택)ai_summary, enriched_at=now()
//
// 시크릿(Supabase Edge Function secret):
//   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET   (필수 — 없으면 ok:false)
//   ANTHROPIC_API_KEY                        (선택 — AI 요약)
//   SUPABASE_URL / SUPABASE_ANON_KEY         (자동 주입)
//
// ⚠️ 네이버 API 는 CORS 로 브라우저 직접 호출 불가 → 반드시 이 함수에서만 호출.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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

interface BlogReview {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  postdate: string;
}

// HTML 태그 + 엔티티 정리
function clean(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 주소에서 검색 보조용 동네 토큰 추출 (예: "인천 미추홀구 ..." → "미추홀구")
function localityFromAddress(address?: string | null): string {
  if (!address) return '';
  const toks = address.split(/\s+/).filter(Boolean);
  const dong = toks.find(t => /[동가]$/.test(t) && t.length > 1);
  if (dong) return dong;
  const gu = toks.find(t => /[구읍면군]$/.test(t) && t.length > 1);
  return gu ?? toks[1] ?? '';
}

async function naverBlog(query: string): Promise<BlogReview[]> {
  const id = Deno.env.get('NAVER_CLIENT_ID');
  const secret = Deno.env.get('NAVER_CLIENT_SECRET');
  if (!id || !secret) return [];
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=5&sort=sim`;
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.slice(0, 5).map((it: Record<string, string>) => ({
    title: clean(it.title),
    link: it.link ?? '',
    description: clean(it.description),
    bloggername: clean(it.bloggername),
    postdate: it.postdate ?? '',
  }));
}

async function summarize(name: string, memo: string | null, reviews: BlogReview[]): Promise<string | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key || reviews.length === 0) return null;
  const body = reviews.map(r => `- ${r.description}`).join('\n');
  const prompt =
    `다음은 '${name}' 장소에 대한 블로그 후기 발췌야.\n\n${body}\n\n` +
    (memo ? `내 메모: ${memo}\n\n` : '') +
    `이 장소가 어떤 곳인지 분위기와 특징 위주로 한국어 2~3문장으로 담백하게 요약해줘. ` +
    `광고·홍보 문구나 과장은 빼고, 실제 방문에 도움되는 정보 위주로.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = j?.content?.[0]?.text;
    return typeof text === 'string' ? text.trim() : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { place_id, summarize: doSummary = true } = await req.json().catch(() => ({}));
    if (!place_id) return json({ ok: false, error: 'place_id 가 필요해요' });

    // 호출자의 JWT 로 클라이언트 생성 → RLS 로 본인 장소만 접근
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: place, error: selErr } = await supabase
      .from('places')
      .select('name, address, memo')
      .eq('id', place_id)
      .maybeSingle();
    if (selErr || !place) return json({ ok: false, error: '장소를 찾을 수 없어요' });

    const query = `${place.name} ${localityFromAddress(place.address)}`.trim();
    const reviews = await naverBlog(query);
    const aiSummary = doSummary ? await summarize(place.name, place.memo, reviews) : null;

    const patch: Record<string, unknown> = {
      blog_reviews: reviews,
      enriched_at: new Date().toISOString(),
    };
    if (aiSummary) patch.ai_summary = aiSummary;

    const { error: updErr } = await supabase.from('places').update(patch).eq('id', place_id);
    if (updErr) return json({ ok: false, error: updErr.message });

    return json({ ok: true, blog_reviews: reviews, ai_summary: aiSummary, enriched_at: patch.enriched_at });
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
});
