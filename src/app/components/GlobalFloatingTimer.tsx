import { useEffect, useState } from 'react';
import { Check, Pause, Play, Timer } from 'lucide-react';
import { usePlanner } from '../store';

function formatElapsed(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function GlobalFloatingTimer() {
  const { activeTimer, todos, pauseTimer, resumeTimer, stopTimer } = usePlanner();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  if (!activeTimer) return null;

  const todo = todos.find(td => td.id === activeTimer.todoId);
  if (!todo) return null;

  const elapsedSec = activeTimer.elapsedSec + (activeTimer.isPaused ? 0 : Math.max(0, Math.floor((nowMs - activeTimer.startTime) / 1000)));

  return (
    <div className="fixed bottom-5 right-4 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 lg:bottom-6 lg:right-6 lg:px-5"
      style={{ backgroundColor: '#2D2D2D', color: '#fff', boxShadow: '0 12px 28px rgba(0,0,0,0.22)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: activeTimer.isPaused ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.18)' }}>
          <Timer size={16} className={activeTimer.isPaused ? '' : 'animate-pulse'} />
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 11, opacity: 0.72 }}>
            {activeTimer.isPaused ? '일시정지' : '진행 중'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
            {todo.text}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>
            {formatElapsed(elapsedSec)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={activeTimer.isPaused ? resumeTimer : pauseTimer}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 600 }}
        >
          {activeTimer.isPaused ? <Play size={12} /> : <Pause size={12} />}
          {activeTimer.isPaused ? '재개' : '일시정지'}
        </button>
        <button
          onClick={stopTimer}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2"
          style={{ backgroundColor: '#ffffff', color: '#2D2D2D', fontSize: 12, fontWeight: 700 }}
        >
          <Check size={12} />
          완료
        </button>
      </div>
    </div>
  );
}
