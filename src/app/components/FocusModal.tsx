import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Play, Timer, X } from 'lucide-react';
import { Todo, TimerMode } from '../store';
import { useTheme } from '../ThemeContext';

const DRUM_ITEM_HEIGHT = 40;
const POMODORO_OPTIONS = Array.from({ length: 24 }, (_, index) => (index + 1) * 5);

function formatClock(totalSec: number) {
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function FocusModal({
  todo,
  onClose,
  onStart,
}: {
  todo: Todo;
  onClose: () => void;
  onStart: (mode: TimerMode, pomoDurationSec?: number) => void;
}) {
  const { t } = useTheme();
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const drumRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  const selectedIndex = POMODORO_OPTIONS.findIndex(value => value === selectedMinutes);
  const previewSeconds = useMemo(
    () => (mode === 'pomodoro' ? selectedMinutes * 60 : 0),
    [mode, selectedMinutes]
  );

  useEffect(() => {
    if (mode !== 'pomodoro' || !drumRef.current || selectedIndex < 0) return;
    drumRef.current.scrollTo({
      top: selectedIndex * DRUM_ITEM_HEIGHT,
      behavior: 'smooth',
    });
  }, [mode, selectedIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleDrumScroll = () => {
    if (!drumRef.current) return;
    const rawIndex = Math.round(drumRef.current.scrollTop / DRUM_ITEM_HEIGHT);
    const nextIndex = Math.max(0, Math.min(POMODORO_OPTIONS.length - 1, rawIndex));
    setSelectedMinutes(POMODORO_OPTIONS[nextIndex]);

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      drumRef.current?.scrollTo({
        top: nextIndex * DRUM_ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }, 90);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(38,52,61,0.28)' }}>
      <div
        className="w-full max-w-[380px] overflow-hidden rounded-[28px]"
        style={{ backgroundColor: '#F5F0E8', border: `1px solid ${t.border}`, boxShadow: '0 24px 48px rgba(38,52,61,0.14)' }}
      >
        <div className="flex items-start justify-between px-5 py-4 lg:px-6 lg:py-5" style={{ borderBottom: `1px solid ${t.borderLight}` }}>
          <div className="min-w-0">
            <p style={{ fontSize: 11, fontWeight: 700, color: '#C4A882', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Focus</p>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 6, lineHeight: 1.35 }}>
              {todo.text}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-xl p-2" style={{ color: t.textMuted, backgroundColor: '#FDFAF4' }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 lg:px-6">
          <div
            className="grid grid-cols-2 gap-1 rounded-full p-1"
            style={{ backgroundColor: '#EDE4D8', border: `1px solid ${t.borderLight}` }}
          >
            {[
              { key: 'pomodoro' as const, label: '포모도로', icon: Clock3 },
              { key: 'stopwatch' as const, label: '스톱워치', icon: Timer },
            ].map(option => {
              const Icon = option.icon;
              const active = mode === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setMode(option.key)}
                  className="flex items-center justify-center gap-2 rounded-full px-3 py-2.5 transition-all"
                  style={{
                    backgroundColor: active ? '#FDFAF4' : 'transparent',
                    color: active ? '#6B553D' : t.textSub,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    boxShadow: active ? '0 4px 12px rgba(196,168,130,0.16)' : 'none',
                  }}
                >
                  <Icon size={14} />
                  {option.label}
                </button>
              );
            })}
          </div>

          {mode === 'pomodoro' ? (
            <div className="mt-5">
              <div className="relative rounded-[24px] px-4 py-5" style={{ backgroundColor: '#FDFAF4', border: `1px solid ${t.borderLight}` }}>
                <div className="mb-4 text-center">
                  <p style={{ fontSize: 12, color: t.textSub }}>남은 시간</p>
                  <div style={{ fontSize: 42, fontWeight: 700, color: '#6B553D', letterSpacing: '-0.04em', lineHeight: 1.05 }}>
                    {formatClock(previewSeconds)}
                  </div>
                </div>

                <div className="relative mx-auto w-[140px]">
                  <div
                    className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-2xl"
                    style={{ height: DRUM_ITEM_HEIGHT, backgroundColor: '#F5F0E8', border: `1px solid ${t.borderLight}` }}
                  />
                  <div
                    ref={drumRef}
                    onScroll={handleDrumScroll}
                    className="h-[200px] overflow-y-auto text-center"
                    style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', paddingTop: 80, paddingBottom: 80 }}
                  >
                    {POMODORO_OPTIONS.map(minutes => {
                      const active = minutes === selectedMinutes;
                      return (
                        <div
                          key={minutes}
                          className="flex items-center justify-center"
                          style={{ height: DRUM_ITEM_HEIGHT, scrollSnapAlign: 'center' }}
                        >
                          <button
                            onClick={() => setSelectedMinutes(minutes)}
                            className="w-full rounded-2xl"
                            style={{
                              fontSize: active ? 28 : 18,
                              fontWeight: active ? 700 : 500,
                              color: active ? '#6B553D' : t.textMuted,
                              lineHeight: 1,
                            }}
                          >
                            {minutes}분
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] px-4 py-8 text-center" style={{ backgroundColor: '#FDFAF4', border: `1px solid ${t.borderLight}` }}>
              <p style={{ fontSize: 12, color: t.textSub }}>경과 시간</p>
              <div style={{ fontSize: 46, fontWeight: 700, color: '#6B553D', letterSpacing: '-0.04em', lineHeight: 1.05, marginTop: 8 }}>
                00:00
              </div>
            </div>
          )}

          <button
            onClick={() => onStart(mode, mode === 'pomodoro' ? selectedMinutes * 60 : undefined)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] py-3.5"
            style={{ backgroundColor: '#C4A882', color: '#fff', fontSize: 15, fontWeight: 700 }}
          >
            <Play size={16} fill="currentColor" />
            시작
          </button>
        </div>
      </div>
    </div>
  );
}
