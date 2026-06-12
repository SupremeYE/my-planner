// 음성 변환(STT) 클라이언트 유틸
//
// 녹음한 오디오 Blob 을 Supabase Edge Function('transcribe')으로 보내
// 텍스트로 변환해 받는다. OpenAI Whisper 키는 Edge Function secret 으로만
// 두므로 브라우저에는 노출되지 않는다. (오디오 원본은 보관하지 않음)

import { supabase } from './supabase';

/**
 * 오디오 Blob 을 텍스트로 변환한다.
 * @param blob 녹음 오디오
 * @param ext  파일 확장자 힌트(mp4/webm/ogg 등) — OpenAI 포맷 판별용 파일명에 사용
 * @param language 인식 언어(기본 한국어)
 * @returns 변환된 텍스트(공백 정리). 실패 시 Error throw.
 */
export async function transcribeAudio(
  blob: Blob,
  ext = 'webm',
  language = 'ko',
): Promise<string> {
  const form = new FormData();
  form.append('file', blob, `recording.${ext}`);
  form.append('language', language);

  const { data, error } = await supabase.functions.invoke('transcribe', { body: form });

  if (error) {
    console.error('[transcribe] invoke error:', error.message);
    throw new Error('음성 변환에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }
  if (data?.error) {
    console.error('[transcribe] server error:', data.error);
    throw new Error('음성 변환에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }

  return (data?.text ?? '').toString().trim();
}
