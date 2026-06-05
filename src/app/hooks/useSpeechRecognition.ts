import { useEffect, useRef, useState } from 'react';

// 브라우저 Web Speech API(webkitSpeechRecognition) 래퍼.
// - 미지원 브라우저(일부 iOS Safari 등)에서는 supported=false → 호출 측에서 마이크 버튼 숨김 처리.
// - 한국어 단발성 받아쓰기를 가정(continuous=false, interimResults=false).
export function useSpeechRecognition(
  onResult: (text: string) => void,
  onError?: (msg: string) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    setSupported(!!SR);
  }, []);

  // 컴포넌트 unmount 시 진행 중인 인식 정리
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  const start = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    try { recRef.current?.stop(); } catch { /* noop */ }
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<any>)
        .map((r: any) => r[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (text) onResultRef.current(text);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = (e: any) => {
      setIsListening(false);
      const code = e?.error ?? 'unknown';
      // 사용자가 거부한 경우 등 안내. 'no-speech'는 흔한 무음 종료라 조용히 처리.
      if (code !== 'no-speech' && code !== 'aborted') onErrorRef.current?.(code);
    };
    recRef.current = rec;
    setIsListening(true);
    try { rec.start(); } catch { setIsListening(false); }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setIsListening(false);
  };

  return { isListening, supported, start, stop };
}
