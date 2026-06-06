import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

// ── 공용 타이머 엔진 ──────────────────────────────────────────────────────────
// 여러 타이머를 동시에 관리한다. 진행 상태는 endsAt(종료 시각, epoch ms) 기준으로
// 계산하므로 앱 재진입/새로고침/탭 전환에도 남은 시간이 정확히 복원된다.
// 레시피 모듈의 '별도 타이머'와 릴스 요리 뷰의 '단계 타이머'가 동일 엔진을 공유한다.

export type CookTimerStatus = 'running' | 'done';

export interface CookTimer {
  id: string;
  label: string;       // 사용자 라벨 (비어있을 수 있음)
  totalSec: number;    // 처음 설정한 총 시간(초)
  endsAt: number;      // 종료 예정 시각 (epoch ms)
  status: CookTimerStatus;
}

interface TimerContextValue {
  timers: CookTimer[];
  nowMs: number;                       // 1초마다 갱신되는 현재 시각 (남은 시간 계산용)
  startTimer: (totalSec: number, label?: string) => string | null;
  cancelTimer: (id: string) => void;   // 진행 중 취소(제거)
  dismissTimer: (id: string) => void;  // 완료된 타이머 닫기(제거)
  addMinute: (id: string) => void;     // 진행 중 +1분
  // 패널 열림 상태 (헤더 아이콘/미니 칩에서 공용으로 제어)
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const STORAGE_KEY = 'cookingTimers.v1';

function loadTimers(): CookTimer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x: any) => x && typeof x.id === 'string' && typeof x.endsAt === 'number')
      .map((x: any): CookTimer => ({
        id: x.id,
        label: typeof x.label === 'string' ? x.label : '',
        totalSec: Number(x.totalSec) || 0,
        endsAt: Number(x.endsAt),
        // 복원 시 이미 끝난 타이머는 done으로 표시
        status: x.endsAt <= Date.now() ? 'done' : 'running',
      }));
  } catch {
    return [];
  }
}

// 완료 알림음 — Web Audio (오디오 미지원 환경은 무시)
function playDoneSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const times = [0, 0.3, 0.6, 0.9];
    const freqs = [784, 659, 784, 988]; // 알림 멜로디
    times.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freqs[i];
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.55);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.6);
    });
  } catch {
    /* 무시 */
  }
}

function notifyDone(label: string) {
  // Notification API는 best-effort — 권한 있을 때만, iOS PWA 미지원 가능성 감안해 graceful
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification('⏰ 타이머 완료', {
      body: label ? `${label} 타이머가 끝났어요` : '타이머가 끝났어요',
      icon: '/icon-192.png',
    });
  } catch {
    /* 무시 */
  }
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<CookTimer[]>(() => loadTimers());
  const [nowMs, setNowMs] = useState(Date.now());
  const [panelOpen, setPanelOpen] = useState(false);
  // 이미 완료 처리(알림 발생)한 타이머 id — 중복 알림 방지
  const firedRef = useRef<Set<string>>(new Set());

  // 영속화
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timers)); } catch { /* 무시 */ }
  }, [timers]);

  // 진행 중 타이머가 하나라도 있으면 1초 틱
  const hasRunning = timers.some(t => t.status === 'running');
  useEffect(() => {
    if (!hasRunning) return;
    const iv = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [hasRunning]);

  // 다른 탭에서 추가/취소한 타이머 동기화 (PC↔다른 탭)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTimers(loadTimers());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 남은 시간이 0이 된 타이머를 done 처리 + 알림(소리/화면/Notification)
  useEffect(() => {
    let changed = false;
    const next = timers.map(t => {
      if (t.status === 'running' && t.endsAt <= nowMs) {
        changed = true;
        return { ...t, status: 'done' as const };
      }
      return t;
    });
    // 새로 done 된 타이머에 대해 알림 1회
    next.forEach(t => {
      if (t.status === 'done' && !firedRef.current.has(t.id)) {
        firedRef.current.add(t.id);
        playDoneSound();
        try { navigator.vibrate?.([300, 120, 300]); } catch { /* 무시 */ }
        notifyDone(t.label);
      }
    });
    if (changed) setTimers(next);
  }, [nowMs, timers]);

  const startTimer = useCallback((totalSec: number, label = '') => {
    if (!Number.isFinite(totalSec) || totalSec <= 0) return null;
    const id = (crypto?.randomUUID?.() ?? `tm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    // 권한 요청 best-effort — 사용자 제스처(시작 버튼) 컨텍스트에서 1회 시도
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* 무시 */ }
    setTimers(prev => [
      ...prev,
      { id, label: label.trim(), totalSec: Math.round(totalSec), endsAt: Date.now() + Math.round(totalSec) * 1000, status: 'running' },
    ]);
    setNowMs(Date.now());
    return id;
  }, []);

  const cancelTimer = useCallback((id: string) => {
    firedRef.current.delete(id);
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissTimer = useCallback((id: string) => {
    firedRef.current.delete(id);
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const addMinute = useCallback((id: string) => {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t;
      // 완료된 타이머에 +1분 → 다시 진행 상태로
      const base = t.status === 'running' ? t.endsAt : Date.now();
      firedRef.current.delete(id);
      return { ...t, status: 'running', totalSec: t.totalSec + 60, endsAt: base + 60_000 };
    }));
  }, []);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const value = useMemo<TimerContextValue>(() => ({
    timers, nowMs, startTimer, cancelTimer, dismissTimer, addMinute,
    panelOpen, openPanel, closePanel,
  }), [timers, nowMs, startTimer, cancelTimer, dismissTimer, addMinute, panelOpen, openPanel, closePanel]);

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimers(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimers must be used within a TimerProvider');
  return ctx;
}

// 남은 시간(초) — 0 미만은 0
export function remainingSec(t: CookTimer, nowMs: number): number {
  return Math.max(0, Math.ceil((t.endsAt - nowMs) / 1000));
}

// mm:ss 포맷
export function formatClock(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
