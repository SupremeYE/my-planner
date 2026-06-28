import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '../../lib/transcribe';

// 일기 음성 입력용 녹음 훅.
//
// 설계 의도:
//  - 브라우저 내장 음성인식(Web Speech API)은 침묵 시 자동 종료되고 iOS Safari/PWA
//    에서 불안정 → MediaRecorder 로 "연속" 녹음하고, 사용자가 중지하면 그때
//    한 번에 STT(Edge Function 'transcribe' → OpenAI Whisper)로 변환한다.
//  - 침묵으로 끊는 자동 종료 로직을 넣지 않는다. 중지 전까지 계속 녹음.
//  - 파형 비주얼라이저용으로 AudioContext+AnalyserNode 를 함께 연결한다.
//  - 오디오 원본은 보관하지 않는다(변환 후 폐기).

export type VoiceStatus = 'idle' | 'recording' | 'transcribing';

// iOS 호환을 위해 지원되는 mime 을 우선순위대로 고른다.
function pickMime(): { mime: string; ext: string } {
  const cands: Array<{ mime: string; ext: string }> = [
    { mime: 'audio/mp4', ext: 'mp4' },              // iOS Safari/PWA
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ];
  const hasCheck =
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function';
  if (hasCheck) {
    for (const c of cands) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
  }
  return { mime: '', ext: 'webm' }; // 브라우저 기본
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<{ mime: string; ext: string }>({ mime: '', ext: 'webm' });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTsRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  // 스트림·오디오 컨텍스트·타이머 정리(마이크 점유 해제 포함)
  const teardownMedia = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => { /* noop */ });
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // 언마운트 시 진행 중 녹음 정리
  useEffect(() => () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      try { rec.stop(); } catch { /* noop */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    teardownMedia();
  }, [teardownMedia]);

  // 녹음 시작 — 반드시 사용자 제스처 핸들러 안에서 호출.
  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('이 브라우저에서는 음성 입력을 지원하지 않아요.');
      return false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? '마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요.'
          : '마이크를 사용할 수 없어요.',
      );
      return false;
    }
    streamRef.current = stream;

    const picked = pickMime();
    mimeRef.current = picked;
    let recorder: MediaRecorder;
    try {
      recorder = picked.mime
        ? new MediaRecorder(stream, { mimeType: picked.mime })
        : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    chunksRef.current = [];
    recorder.ondataavailable = ev => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorderRef.current = recorder;
    // timeslice(250ms)로 시작 → 중지 전까지 연속 녹음하되 데이터를 주기적으로 flush.
    //   iOS Safari/PWA 는 timeslice 없이 start() 하면 중지 시 ondataavailable 이
    //   비어 0바이트 blob 이 나오는 사례가 있어("녹음된 소리가 없어요"로 변환 호출 자체가
    //   안 됨) 주기적 flush 로 안정성을 확보한다. timeslice 는 발화 중단과 무관하다.
    recorder.start(250);

    // 파형 비주얼라이저용 Web Audio (실패해도 녹음은 계속)
    try {
      const Ctx: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      src.connect(analyser);
      analyserRef.current = analyser;
      if (ctx.state === 'suspended') ctx.resume().catch(() => { /* noop */ });
    } catch {
      /* 파형 없이 진행 */
    }

    startTsRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startTsRef.current);
    }, 200);
    setStatus('recording');
    return true;
  }, []);

  // 녹음 중지 → Blob 합치기 → STT 변환 → 텍스트 반환
  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder) return '';

    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const blob: Blob = await new Promise(resolve => {
      recorder.onstop = () => {
        const type = mimeRef.current.mime || recorder.mimeType || 'audio/webm';
        resolve(new Blob(chunksRef.current, { type }));
      };
      try {
        // 중지 직전 마지막 청크를 강제 flush(iOS 빈 녹음 추가 방어).
        if (recorder.state === 'recording') {
          try { recorder.requestData(); } catch { /* noop */ }
        }
        recorder.stop();
      } catch {
        resolve(new Blob(chunksRef.current));
      }
    });

    teardownMedia();
    recorderRef.current = null;
    const ext = mimeRef.current.ext;
    chunksRef.current = [];

    if (!blob || blob.size === 0) {
      setStatus('idle');
      setError('녹음된 소리가 없어요.');
      return '';
    }

    setStatus('transcribing');
    try {
      const text = await transcribeAudio(blob, ext, 'ko');
      setStatus('idle');
      if (!text) setError('말소리를 알아듣지 못했어요. 다시 시도해 주세요.');
      return text;
    } catch (e) {
      setStatus('idle');
      setError(e instanceof Error ? e.message : '음성 변환에 실패했어요.');
      return '';
    }
  }, [teardownMedia]);

  // 변환 없이 취소(녹음 폐기)
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* noop */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    teardownMedia();
    setStatus('idle');
    setElapsedMs(0);
  }, [teardownMedia]);

  return { status, elapsedMs, error, setError, start, stopAndTranscribe, cancel, analyserRef };
}
