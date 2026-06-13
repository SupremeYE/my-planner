import { useCallback, useState } from 'react';
import { useVoiceRecorder } from './useVoiceRecorder';

// 앱 내 모든 음성 입력의 단일 진입점.
//
// 설계:
//  - 내부에서 `useVoiceRecorder`(MediaRecorder 연속 녹음 + 파형용 AudioContext) +
//    `transcribeAudio`(Supabase Edge Function 'transcribe' → OpenAI Whisper) 를 조합.
//  - 호출부는 status / text 만 소비하면 되도록 통일. (이전 `useSpeechRecognition` 의
//    onResult 콜백, supported 분기 같은 브라우저 인식 우회 코드는 모두 제거.)
//  - 녹음 mime 우선순위·iOS 동작·파형 비주얼라이저(AudioContext/AnalyserNode) 는
//    `useVoiceRecorder` 의 기존 동작을 그대로 유지한다(이 훅에서 새로 만지지 않는다).

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing' | 'error';

export function useVoiceInput() {
  const rec = useVoiceRecorder();
  const [text, setText] = useState('');

  const startRecording = useCallback(async (): Promise<boolean> => {
    // 새 녹음 시작 시 이전 텍스트/에러는 비운다(재시도 자연스러움).
    setText('');
    rec.setError(null);
    return await rec.start();
  }, [rec]);

  const stopRecording = useCallback(async (): Promise<string> => {
    const result = await rec.stopAndTranscribe();
    if (result) setText(result);
    return result;
  }, [rec]);

  // error 가 있으면 status 를 'error' 로 노출. startRecording 호출 시 error 가
  // null 로 클리어되면서 자동으로 idle 로 복귀한다.
  const status: VoiceInputStatus = rec.error ? 'error' : rec.status;

  return {
    status,
    startRecording,
    stopRecording,
    cancel: rec.cancel,
    text,
    setText,
    error: rec.error,
    setError: rec.setError,
    // 파형/카운트업 UI 용 — DiaryView 의 녹음 시트가 사용.
    elapsedMs: rec.elapsedMs,
    analyserRef: rec.analyserRef,
  };
}
