import { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play, Square, Timer } from 'lucide-react';
import { getTimerElapsedSec, getTimerRemainingSec, usePlanner } from '../store';
import { useTheme } from '../ThemeContext';

function formatElapsed(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function playDoneSound() {
  try {
    const ctx = new AudioContext();
    const times = [0, 0.35, 0.7];
    const freqs = [523, 659, 784]; // C5 E5 G5
    times.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freqs[i];
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.6);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.65);
    });
  } catch {
    // 오디오 미지원 환경 무시
  }
}

export function GlobalFloatingTimer() {
  const { activeTimer, todos, pauseTimer, resumeTimer, stopTimer } = usePlanner();
  const { t } = useTheme();
  const [nowMs, setNowMs] = useState(Date.now());
  const [pomoDone, setPomoDone] = useState<string | null>(null); // todoText 저장
  const pomoDoneFiredRef = useRef(false);

  const todo = activeTimer ? todos.find(td => td.id === activeTimer.todoId) ?? null : null;
  const elapsedSec = activeTimer ? getTimerElapsedSec(activeTimer, nowMs) : 0;
  const displaySec = activeTimer
    ? (activeTimer.mode === 'pomodoro' ? getTimerRemainingSec(activeTimer, nowMs) : elapsedSec)
    : 0;
  const todoText = todo?.text ?? '';
  const truncatedTitle = todoText.length > 15 ? `${todoText.slice(0, 15)}…` : todoText;

  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer || !todo) {
      document.title = 'My Planner';
      return;
    }

    const nextTitle = activeTimer.mode === 'pomodoro'
      ? `🍅 ${formatElapsed(displaySec)} - ${todoText}`
      : `⏱ ${formatElapsed(displaySec)} - ${todoText}`;
    document.title = nextTitle;

    return () => {
      document.title = 'My Planner';
    };
  }, [activeTimer, displaySec, todo, todoText]);

  // 포모도로 완료 감지
  useEffect(() => {
    if (!activeTimer || activeTimer.mode !== 'pomodoro' || activeTimer.isPaused) return;
    if (displaySec > 0) {
      pomoDoneFiredRef.current = false;
      return;
    }
    if (pomoDoneFiredRef.current) return;
    pomoDoneFiredRef.current = true;

    playDoneSound();
    navigator.vibrate?.([300, 100, 300]);
    setPomoDone(todoText);
    stopTimer();
  }, [activeTimer, displaySec, stopTimer, todoText]);

  // 완료 배너 4초 후 자동 닫기
  useEffect(() => {
    if (!pomoDone) return;
    const id = window.setTimeout(() => setPomoDone(null), 4000);
    return () => window.clearTimeout(id);
  }, [pomoDone]);

  // 포모도로 완료 배너
  if (pomoDone) {
    return (
      <div
        className="fixed bottom-[72px] left-3 right-3 z-50 rounded-[22px] px-4 py-3.5 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px]"
        style={{ backgroundColor: t.success, boxShadow: '0 16px 36px rgba(38,52,61,0.18)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', color: '#fff' }}>
            <Check size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>포모도로 완료!</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pomoDone.length > 22 ? `${pomoDone.slice(0, 22)}…` : pomoDone}
            </div>
          </div>
          <button
            onClick={() => setPomoDone(null)}
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1, padding: '4px 6px' }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (!activeTimer || !todo) return null;

  return (
    <div
      className="fixed bottom-[72px] left-3 right-3 z-50 rounded-[22px] px-3 py-3 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px] lg:px-4"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 16px 36px rgba(38,52,61,0.18)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
          style={{ backgroundColor: activeTimer.isPaused ? t.bgSub : t.accent, color: activeTimer.isPaused ? t.textMuted : '#fff' }}
        >
          <Timer size={17} className={activeTimer.isPaused ? '' : 'animate-pulse'} />
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 11, color: t.textMuted }}>
            {activeTimer.mode === 'pomodoro' ? '포모도로' : '스톱워치'} · {activeTimer.isPaused ? '일시정지' : '진행중'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
            {truncatedTitle}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            {activeTimer.mode === 'pomodoro' ? '남은 시간' : '경과 시간'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: t.text, marginTop: 1 }}>
            {formatElapsed(displaySec)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button
            onClick={activeTimer.isPaused ? resumeTimer : pauseTimer}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2"
            style={{ backgroundColor: t.bgSub, color: t.text, fontSize: 12, fontWeight: 700, border: `1px solid ${t.borderLight}` }}
          >
            {activeTimer.isPaused ? <Play size={12} /> : <Pause size={12} />}
            {activeTimer.isPaused ? '재개' : '일시정지'}
          </button>
          <button
            onClick={stopTimer}
            title="타이머 정지 (할일은 진행중 유지)"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2"
            style={{ backgroundColor: t.danger, color: '#fff', fontSize: 12, fontWeight: 700 }}
          >
            <Square size={12} fill="#fff" />
            정지
          </button>
        </div>
      </div>
    </div>
  );
}
