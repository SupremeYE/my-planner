// Supabase Edge Function: extract-places
//
// 입력: { caption?: string, title?: string, image_url?: string, source?: string }
//   - caption/title: 인스타 캡션·유튜브/게시물 제목 등 텍스트 신호
//   - image_url: 카드뉴스/릴스 커버 또는 사용자 업로드 스크린샷(public URL) — 이미지 속 텍스트 OCR
//   - 텍스트·이미지 중 있는 것만 넘기면 됨(둘 다 있으면 한 번의 호출에서 함께 읽음)
//
// 출력(항상 200 JSON, 실패도 graceful):
//   { ok:true, places:[{ name, category?, addressHint?, note?, confidence }] }
//   { ok:false, error }   (클라가 "스크린샷으로 추가"/수동 입력 폴백)
//
// 동작: SNS/유튜브 게시물의 제목·캡션·커버 이미지에서 "가볼 만한 장소"를 gpt-4o-mini 로 추출한다.
//   ⚠️ "등록 시점 1회"만 호출하는 보조 추출기(vision-extract/money-parse 와 동일 규칙).
//   추출 결과(confidence·원문)는 영속 저장하지 않는다 — 사용자가 카카오로 확정한 값만 db 에 들어간다.
//   추출된 장소명은 부정확할 수 있으므로 클라이언트가 카카오 keywordSearch 로 반드시 정규화·확인한다.
//
// 시크릿(이미 세팅됨, vision-extract/transcribe 와 공유): OPENAI_API_KEY

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

// 장소 추출 지시 + JSON 스키마 강제.
function buildPrompt(caption?: string, title?: string): string {
  const parts: string[] = [
    '너는 SNS(인스타 릴스/카드뉴스)·유튜브 게시물에서 "가볼 만한 실제 장소"를 뽑는 추출기다.',
    '아래 제목·캡션과 (있다면) 커버 이미지 속 글자를 읽고, 언급된 맛집·카페·명소·여행지·가게 등',
    '실제로 방문할 수 있는 장소를 모두 뽑아라.',
    '',
    '규칙:',
    '- name: 실제 상호/장소명(필수). "성수동 감성카페" 같은 일반 묘사가 아니라 고유한 가게·장소 이름이어야 한다. 확실치 않으면 그 항목은 빼라.',
    '- category: 맛집/카페/베이커리/바/명소/전시/공원/숙소 등 한 단어 추정(불확실하면 생략).',
    '- addressHint: 지역·동네 단서(예: "성수동", "제주 애월", "부산 해운대"). 보이면 넣어라(카카오 검색 정확도용).',
    '- note: 왜 추천되는지/무엇이 유명한지 한 줄(있으면).',
    '- confidence: 0~1. 상호가 뚜렷하면 높게, 추정이면 낮게.',
    '- 광고/협찬/할인코드/해시태그 나열/계정명·브랜드 홍보 문구는 장소가 아니면 제외한다.',
    '- 같은 장소는 한 번만. 최대 20개.',
    '',
    '반드시 아래 JSON 형식으로만 응답(마크다운/코드펜스/설명 없이):',
    '{"places":[{"name":"...","category":"...","addressHint":"...","note":"...","confidence":0.9}]}',
    '장소를 못 찾으면 {"places":[]}.',
  ];
  const ctx: string[] = [];
  if (title && title.trim()) ctx.push(`제목: ${title.trim()}`);
  if (caption && caption.trim()) ctx.push(`캡션/본문:\n${caption.trim()}`);
  if (ctx.length) {
    parts.push('', '── 게시물 텍스트 ──', ctx.join('\n\n'));
  } else {
    parts.push('', '(텍스트 신호 없음 — 커버 이미지 속 글자에서 장소를 읽어라.)');
  }
  return parts.join('\n');
}

// 코드펜스/잡텍스트를 걷어내고 첫 JSON 객체의 places 배열만 안전하게 파싱.
// (vision-extract 의 parseItems 가드 패턴 재사용 — 코드펜스 제거 → 첫 { ~ 마지막 } → JSON.parse)
function parsePlaces(text: string): Array<Record<string, unknown>> | null {
  if (!text) return null;
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const obj = JSON.parse(s.slice(first, last + 1));
    const places = obj?.places;
    if (!Array.isArray(places)) return null;
    return places as Array<Record<string, unknown>>;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { caption, title, image_url, source } = await req.json().catch(() => ({}));
    const hasText = (typeof caption === 'string' && caption.trim()) || (typeof title === 'string' && title.trim());
    const hasImage = typeof image_url === 'string' && image_url.trim();
    if (!hasText && !hasImage) {
      return json({ ok: false, error: 'caption/title 또는 image_url 중 하나는 필요해요' });
    }

    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return json({ ok: false, error: 'OPENAI_API_KEY 가 설정되지 않았어요' });

    // 텍스트 프롬프트 + (있으면) 이미지 파트를 한 번의 vision 호출로 함께 넣는다.
    const content: unknown[] = [{ type: 'text', text: buildPrompt(caption, title) }];
    if (hasImage) content.push({ type: 'image_url', image_url: { url: image_url } });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[extract-places] openai 실패:', res.status, detail.slice(0, 300));
      return json({ ok: false, error: `장소를 읽지 못했어요 (${res.status})` });
    }

    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? parsePlaces(text) : null;
    if (parsed == null) return json({ ok: false, error: '추출 결과를 해석하지 못했어요' });

    // 필드 정규화 — name 필수, 나머지는 있을 때만. confidence 0~1 클램프. 중복 name 제거.
    const seen = new Set<string>();
    const places = parsed
      .map((it) => {
        const name = typeof it.name === 'string' ? it.name.trim() : '';
        if (!name) return null;
        const dedupKey = name.toLowerCase();
        if (seen.has(dedupKey)) return null;
        seen.add(dedupKey);
        const out: Record<string, unknown> = { name };
        if (typeof it.category === 'string' && it.category.trim()) out.category = it.category.trim();
        if (typeof it.addressHint === 'string' && it.addressHint.trim()) out.addressHint = it.addressHint.trim();
        if (typeof it.note === 'string' && it.note.trim()) out.note = it.note.trim();
        const c = Number(it.confidence);
        out.confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0.5;
        return out;
      })
      .filter(Boolean)
      .slice(0, 20);

    return json({ ok: true, places, source: typeof source === 'string' ? source : null });
  } catch (e) {
    console.error('[extract-places] 예외:', String(e));
    return json({ ok: false, error: String(e) });
  }
});
