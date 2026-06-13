// 산책 실시간 추적 훅 — GPS watchPosition + 노이즈/점프 필터 + 거리/시간 누적.
// 외부 API 없음(브라우저 geolocation 기본 기능). 화면 유지는 useWakeLock 가 별도 담당.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalkPoint } from '../../../lib/db';
import { haversineMeters } from './walkUtils';

export type TrackerStatus = 'idle' | 'acquiring' | 'tracking' | 'paused' | 'denied' | 'error';

// 필터 임계값
const MIN_MOVE_M = 4;      // 직전 점에서 4m 미만 이동은 무시(노이즈)
const ACCURACY_MAX_M = 45; // 정확도(반경) 45m 초과 좌표는 버림
const WEAK_SIGNAL_M = 25;  // 25m 초과면 "신호 약함" 표시

export interface WalkTracker {
  status: TrackerStatus;
  path: WalkPoint[];
  distanceM: number;
  durationS: number;
  current: { lat: number; lng: number } | null;
  accuracy: number | null;   // 마지막 좌표 정확도(m)
  weakSignal: boolean;
  errorMsg: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useWalkTracker(): WalkTracker {
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [path, setPath] = useState<WalkPoint[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [durationS, setDurationS] = useState(0);
  const [current, setCurrent] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPtRef = useRef<WalkPoint | null>(null);
  const pausedRef = useRef(false);
  const startEpochRef = useRef(0);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const onPosition = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude, accuracy: acc } = pos.coords;
    setAccuracy(acc ?? null);
    setCurrent({ lat: latitude, lng: longitude });
    setStatus(s => (s === 'acquiring' ? 'tracking' : s));
    if (pausedRef.current) return;                 // 일시정지 중엔 누적 안 함
    if (acc != null && acc > ACCURACY_MAX_M) return; // 너무 부정확한 좌표 버림

    const pt: WalkPoint = { lat: latitude, lng: longitude, t: Date.now() };
    const last = lastPtRef.current;
    if (last) {
      const d = haversineMeters(last, pt);
      if (d < MIN_MOVE_M) return;                  // 너무 짧은 이동(노이즈) 무시
      setDistanceM(prev => prev + d);
    }
    lastPtRef.current = pt;
    setPath(prev => [...prev, pt]);
  }, []);

  const onError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus('denied');
      setErrorMsg('위치 권한이 거부되었어요. 브라우저/기기 설정에서 위치 접근을 허용해 주세요.');
      clearWatch();
    } else {
      // 일시적 신호 문제는 추적을 끊지 않고 안내만(watchPosition 이 계속 재시도)
      setErrorMsg(err.code === err.TIMEOUT ? 'GPS 신호를 기다리는 중이에요…' : 'GPS 신호가 약해요.');
    }
  }, [clearWatch]);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('error'); setErrorMsg('이 기기에서는 위치 기능을 쓸 수 없어요.'); return;
    }
    setStatus('acquiring');
    setErrorMsg(null);
    setPath([]); setDistanceM(0); setDurationS(0);
    lastPtRef.current = null; pausedRef.current = false;
    startEpochRef.current = Date.now();
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true, maximumAge: 0, timeout: 15000,
    });
    tickRef.current = setInterval(() => {
      if (!pausedRef.current) setDurationS(d => d + 1);
    }, 1000);
  }, [onPosition, onError]);

  const pause = useCallback(() => { pausedRef.current = true; setStatus('paused'); }, []);
  const resume = useCallback(() => { pausedRef.current = false; setStatus('tracking'); }, []);
  const stop = useCallback(() => { clearWatch(); setStatus('idle'); }, [clearWatch]);

  useEffect(() => () => clearWatch(), [clearWatch]); // 언마운트 시 정리

  const weakSignal = accuracy != null && accuracy > WEAK_SIGNAL_M;

  return { status, path, distanceM, durationS, current, accuracy, weakSignal, errorMsg, start, pause, resume, stop };
}
