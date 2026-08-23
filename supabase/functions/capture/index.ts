// Supabase Edge Function: capture  (verify_jwt: false)
//
// 단일 입구 — iOS Shortcuts/외부에서 음성·텍스트 한 줄을 POST 하면 서버가 자동 분류(_shared/classify)해
// capture_inbox 에 "제안(pending)"으로 넣는다. 목적지 테이블 저장은 하지 않는다(Stage 2 승인 시 클라).
//
// 인증: 웹 세션 JWT 가 없는 진입점이라 verify_jwt:false + 시크릿 토큰 헤더(X-Haon-Token)로만 게이트한다.
//
// 🔒 피해 최소화 원칙: 이 함수의 유일한 DB 작업은 capture_inbox insert 뿐이다.
//   select/update/delete 없음, 다른 테이블 접근 없음. 토큰이 유출돼도 피해를 "인박스에 행 추가"로 가둔다.
//   (insert 후 .select('id') 는 그 insert 문의 RETURNING — 방금 넣은 행의 id 만 돌려받는다. 별도 조회 아님.)
//
// 시크릿(사용자가 직접 설정 — 이 코드는 값을 만들지 않는다):
//   CAPTURE_TOKEN        헤더 X-Haon-Token 과 대조할 비밀 토큰
//   HAON_OWNER_USER_ID   단일 사용자 소유자 uid(capture_inbox.user_id 로 주입)
//   OPENAI_API_KEY       분류용(transcribe/money-parse 와 공유, 이미 설정됨)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   자동 주입

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { classify } from '../_shared/classify.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Asia/Seoul(UTC+9, DST 없음) 기준 오늘 날짜 yyyy-MM-dd — 상대 날짜 해석 기준.
function seoulToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  // 1) 토큰 게이트 — 불일치/누락 → 401. 응답 본문에 어떤 정보도 담지 않는다.
  const expected = Deno.env.get('CAPTURE_TOKEN');
  const provided = req.headers.get('X-Haon-Token');
  if (!expected || provided !== expected) return new Response(null, { status: 401 });

  // 2) body 파싱
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'JSON 본문이 올바르지 않아요' }, 400);
  }

  // 3) text 검증 (trim 후 1~2000자)
  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  if (rawText.length < 1 || rawText.length > 2000) {
    return json({ ok: false, error: 'text 는 1~2000자여야 해요' }, 400);
  }

  const source = body.source === 'web' || body.source === 'manual' ? body.source : 'shortcut';
  const capturedAt = typeof body.captured_at === 'string' && !Number.isNaN(Date.parse(body.captured_at))
    ? new Date(body.captured_at).toISOString()
    : new Date().toISOString();

  // 4) 자동 분류. 분류가 실패해도 raw_text 는 반드시 저장한다(기록 유실이 최악의 실패).
  let proposedType: string | null = null;
  let confidence: number | null = null;
  let proposedPayload: Record<string, unknown> | null = null;
  let classifierError: string | null = null;

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    classifierError = 'OPENAI_API_KEY_missing';
  } else {
    const r = await classify(rawText, seoulToday(), openaiKey);
    proposedType = r.type;
    confidence = r.confidence;
    proposedPayload = r.type ? r.payload : null; // type=null 이면 payload 저장 안 함
    classifierError = r.error ?? null;
  }

  // 5) service role 클라이언트로 capture_inbox insert (RLS 우회, user_id 명시 주입)
  const ownerId = Deno.env.get('HAON_OWNER_USER_ID');
  if (!ownerId) return json({ ok: false, error: 'server not configured' }, 500);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase
    .from('capture_inbox')
    .insert({
      user_id: ownerId,
      raw_text: rawText,
      source,
      status: 'pending',
      proposed_type: proposedType,
      proposed_payload: proposedPayload,
      confidence,
      classifier_error: classifierError,
      captured_at: capturedAt,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[capture] insert 실패:', error.message);
    return json({ ok: false, error: '저장에 실패했어요' }, 500);
  }

  // 6) 성공
  return json({ ok: true, id: data.id, type: proposedType });
});
