// Supabase Edge Function: transcribe
//
// 목적: 클라이언트(일기 음성 입력)가 보낸 오디오 Blob 을 받아 OpenAI Whisper 로
//   텍스트로 변환해 돌려준다. STT API 키는 Edge Function secret 으로만 두어
//   브라우저에 노출하지 않는다.
//
// 호출(클라이언트):
//   const form = new FormData();
//   form.append('file', blob, 'recording.mp4');   // iOS=mp4, 그 외 webm 등
//   form.append('language', 'ko');
//   supabase.functions.invoke('transcribe', { body: form })
//
// 응답: { text: string }  (실패 시 { text: '', error })
//
// 메모리 원칙: 오디오 원본은 저장하지 않는다. 이 함수는 요청 메모리에서만
//   처리해 OpenAI 로 전달하고, 변환 텍스트만 반환한 뒤 폐기한다.
//
// 필요한 secret:
//   OPENAI_API_KEY  (Supabase 프로젝트 Edge Function secrets 에 등록)

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

// OpenAI 업로드 한도(25MB) 방어. 일기 녹음은 보통 수 MB 이내.
const MAX_BYTES = 25 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return json({ text: '', error: 'OPENAI_API_KEY 가 설정되지 않았어요.' }, 500);
    }

    const inForm = await req.formData().catch(() => null);
    if (!inForm) {
      return json({ text: '', error: '오디오 데이터를 읽지 못했어요.' }, 400);
    }

    const file = inForm.get('file');
    const language = (inForm.get('language') ?? 'ko').toString();
    if (!(file instanceof Blob)) {
      return json({ text: '', error: '오디오 파일이 없어요.' }, 400);
    }
    if (file.size === 0) {
      return json({ text: '' });
    }
    if (file.size > MAX_BYTES) {
      return json({ text: '', error: '녹음이 너무 길어요. 조금 짧게 나눠 주세요.' }, 413);
    }

    // OpenAI 는 파일 확장자로 포맷을 판별하므로 원본 파일명을 유지한다.
    const filename = file instanceof File && file.name ? file.name : 'recording.webm';

    const out = new FormData();
    out.append('file', file, filename);
    out.append('model', 'whisper-1');
    out.append('language', language);
    out.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: out,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[transcribe] OpenAI 실패:', res.status, detail.slice(0, 300));
      return json({ text: '', error: `음성 변환에 실패했어요 (${res.status}).` }, 502);
    }

    const data = await res.json();
    return json({ text: (data?.text ?? '').toString() });
  } catch (e) {
    console.error('[transcribe] 예외:', (e as Error).message);
    return json({ text: '', error: (e as Error).message }, 500);
  }
});
