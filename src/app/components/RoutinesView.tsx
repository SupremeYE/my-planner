import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Play, Pause, RotateCcw, Check, Trash2, Edit3, X,
  ChevronDown, ChevronUp, Clock, Flame, Timer, Youtube,
} from 'lucide-react';
import { usePlanner, Routine } from '../store';
import { useTheme } from '../ThemeContext';
import { TimePicker } from './TimePicker';
import { format } from 'date-fns';

const EMOJI_PALETTE = ['🌅','🧘','🏋️','📖','🚿','☕','🌙','💊','🧹','🍎','🎯','✍️','🎵','💪','🧠','🧴','🌿','🏃','🎨','📝'];
const today = format(new Date(), 'yyyy-MM-dd');

function getStreak(checkedDates: string[]): number {
  if (!checkedDates?.length) return 0;
  const sorted = [...checkedDates].sort().reverse();
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const expected = format(new Date(new Date(sorted[0] + 'T12:00:00').getTime() - 86400000 * i), 'yyyy-MM-dd');
    if (sorted[i] === expected) streak++;
    else break;
  }
  return streak;
}

function isValidYoutubeUrl(url: string): boolean {
  if (!url.trim()) return true; // 비어있으면 유효(선택사항)
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]+/.test(url);
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
function RoutineModal({ routine, onClose }: { routine?: Routine; onClose: () => void }) {
  const { addRoutine, updateRoutine, deleteRoutine } = usePlanner();
  const { t } = useTheme();
  const [name, setName] = useState(routine?.name ?? '');
  const [icon, setIcon] = useState(routine?.icon ?? '🌅');
  const [startTime, setStartTime] = useState(routine?.startTime ?? '07:00');
  const [duration, setDuration] = useState(routine?.duration ?? 15);
  const [steps, setSteps] = useState<string[]>(routine?.steps ?? ['']);
  const [stepUrls, setStepUrls] = useState<string[]>(routine?.stepYoutubeUrls ?? ['']);

  const handleSave = () => {
    if (!name.trim()) return;
    const filteredSteps = steps.map((s, i) => ({ s, u: stepUrls[i] ?? '' })).filter(x => x.s.trim());
    const data = {
      name: name.trim(), icon, startTime,
      duration,
      steps: filteredSteps.map(x => x.s),
      stepYoutubeUrls: filteredSteps.map(x => x.u),
      checkedDates: routine?.checkedDates ?? [],
    };
    if (routine) updateRoutine(routine.id, data);
    else addRoutine(data);
    onClose();
  };

  const handleStepChange = (i: number, val: string) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? val : s));
  };
  const handleUrlChange = (i: number, val: string) => {
    setStepUrls(prev => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };
  const addStep = () => {
    setSteps(prev => [...prev, '']);
    setStepUrls(prev => [...prev, '']);
  };
  const removeStep = (i: number) => {
    setSteps(prev => prev.filter((_, idx) => idx !== i));
    setStepUrls(prev => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[460px] max-h-[85vh] flex flex-col"
        style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            {routine ? '루틴 수정' : '새 루틴 만들기'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Icon + Name */}
          <div className="flex gap-3">
            <div>
              <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 6 }}>아이콘</label>
              <div className="flex flex-wrap gap-1.5 w-40">
                {EMOJI_PALETTE.map(e => (
                  <button key={e} onClick={() => setIcon(e)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all"
                    style={{
                      backgroundColor: icon === e ? t.accent + '22' : t.bgSub,
                      outline: icon === e ? `2px solid ${t.accent}` : 'none',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 6 }}>루틴 이름</label>
              <input
                autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="예: 아침 루틴"
                className="w-full rounded-xl px-3 py-2.5 border outline-none"
                style={{ borderColor: t.border, fontSize: 14, backgroundColor: t.bgSub, color: t.text }}
              />
              <div className="flex gap-2 mt-3">
                <div className="flex-1">
                  <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 4 }}>시작 시간</label>
                  <TimePicker value={startTime} onChange={setStartTime} placeholder="시작 시간" />
                </div>
                <div className="flex-1">
                  <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 4 }}>소요 시간 (분)</label>
                  <input type="number" min={1} max={180} value={duration} onChange={e => setDuration(Number(e.target.value))}
                    className="w-full rounded-xl px-3 py-2 border outline-none"
                    style={{ borderColor: t.border, fontSize: 13, backgroundColor: t.bgSub, color: t.text }} />
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 8 }}>단계 (선택)</label>
            <div className="space-y-3">
              {steps.map((step, i) => {
                const url = stepUrls[i] ?? '';
                const urlInvalid = url.trim() !== '' && !isValidYoutubeUrl(url);
                return (
                  <div key={i} className="rounded-xl p-3 space-y-2" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                    <div className="flex gap-2 items-center">
                      <span style={{ fontSize: 12, color: t.textMuted, minWidth: 18, textAlign: 'right' }}>{i + 1}.</span>
                      <input value={step} onChange={e => handleStepChange(i, e.target.value)}
                        placeholder={`단계 ${i + 1}`}
                        className="flex-1 rounded-lg px-3 py-2 border outline-none"
                        style={{ borderColor: t.border, fontSize: 13, backgroundColor: t.card, color: t.text }} />
                      {steps.length > 1 && (
                        <button onClick={() => removeStep(i)} style={{ color: t.textMuted }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 items-center pl-6">
                      <Youtube size={13} style={{ color: urlInvalid ? '#ef4444' : t.textMuted, flexShrink: 0 }} />
                      <input value={url} onChange={e => handleUrlChange(i, e.target.value)}
                        placeholder="YouTube URL (선택)"
                        className="flex-1 rounded-lg px-3 py-1.5 border outline-none"
                        style={{
                          borderColor: urlInvalid ? '#ef4444' : t.border,
                          fontSize: 12, backgroundColor: t.card, color: t.text,
                        }} />
                    </div>
                    {urlInvalid && (
                      <p className="pl-6" style={{ fontSize: 11, color: '#ef4444' }}>유효한 YouTube URL을 입력해주세요</p>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addStep}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ fontSize: 12, color: t.accent, backgroundColor: t.accent + '15' }}>
              <Plus size={12} /> 단계 추가
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-2 justify-between" style={{ borderTop: `1px solid ${t.border}` }}>
          {routine && (
            <button onClick={() => { deleteRoutine(routine.id); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl"
              style={{ fontSize: 13, color: '#ef4444', backgroundColor: '#fee2e2' }}>
              <Trash2 size={14} /> 삭제
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl"
              style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              취소
            </button>
            <button onClick={handleSave} className="px-5 py-2 rounded-xl"
              style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
              {routine ? '저장' : '만들기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Execution Panel ──────────────────────────────────────────────────────────
function ExecutionPanel({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const { toggleRoutineDate } = usePlanner();
  const { t } = useTheme();

  const totalSec = routine.duration * 60;
  const [remaining, setRemaining] = useState(totalSec);
  const [running, setRunning] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCompletedToday = routine.checkedDates?.includes(today);
  const allStepsDone = routine.steps.length > 0 && checkedSteps.size === routine.steps.length;
  const timerDone = remaining === 0;

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => setRemaining(r => r - 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, remaining]);

  const handleToggleStep = (i: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleComplete = () => {
    toggleRoutineDate(routine.id, today);
    onClose();
  };

  const reset = () => {
    setRunning(false);
    setRemaining(totalSec);
  };

  const progress = ((totalSec - remaining) / totalSec) * 100;
  const timerColor = remaining < 60 ? '#ef4444' : t.accent;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl"
        style={{ backgroundColor: t.card, boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 28 }}>{routine.icon}</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{routine.name}</p>
              <p style={{ fontSize: 12, color: t.textMuted }}>{routine.startTime} · {routine.duration}분</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Timer */}
          <div className="flex flex-col items-center gap-3">
            {/* Progress ring */}
            <div className="relative" style={{ width: 120, height: 120 }}>
              <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke={t.border} strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={timerColor} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ fontSize: 24, fontWeight: 700, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(remaining)}
                </span>
                {timerDone && <span style={{ fontSize: 11, color: t.textMuted }}>완료!</span>}
              </div>
            </div>

            {/* Timer controls */}
            <div className="flex items-center gap-3">
              <button onClick={reset} className="p-2.5 rounded-xl"
                style={{ backgroundColor: t.bgSub, color: t.textSub }}>
                <RotateCcw size={16} />
              </button>
              <button onClick={() => setRunning(r => !r)}
                disabled={timerDone}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl"
                style={{ backgroundColor: running ? t.bgSub : t.accent, color: running ? t.textSub : '#fff', fontWeight: 600, fontSize: 14 }}>
                {running ? <><Pause size={16} /> 일시정지</> : <><Play size={16} /> {remaining === totalSec ? '시작' : '재개'}</>}
              </button>
            </div>
          </div>

          {/* Steps */}
          {routine.steps.length > 0 && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 10 }}>
                단계 체크 ({checkedSteps.size}/{routine.steps.length})
              </p>
              <div className="space-y-2">
                {routine.steps.map((step, i) => {
                  const done = checkedSteps.has(i);
                  const youtubeUrl = routine.stepYoutubeUrls?.[i];
                  return (
                    <div key={i} className="rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${done ? t.accent + '40' : t.border}` }}>
                      <button onClick={() => handleToggleStep(i)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                        style={{ backgroundColor: done ? t.accent + '15' : t.bgSub }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: done ? t.accent : 'transparent', border: `2px solid ${done ? t.accent : t.border}` }}>
                          {done && <Check size={11} color="#fff" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 13, color: done ? t.accent : t.text, textDecoration: done ? 'line-through' : 'none', flex: 1 }}>
                          {step}
                        </span>
                        {youtubeUrl && (
                          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg flex-shrink-0"
                            style={{ fontSize: 11, fontWeight: 600, backgroundColor: '#FF000018', color: '#CC0000' }}>
                            <Youtube size={12} />
                            영상 보기
                          </a>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Complete button */}
          <button onClick={handleComplete}
            disabled={isCompletedToday}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2"
            style={{
              backgroundColor: isCompletedToday ? t.bgSub : (allStepsDone || timerDone) ? '#6BAA7A' : t.accent,
              color: isCompletedToday ? t.textMuted : '#fff',
              fontWeight: 600, fontSize: 14,
              opacity: isCompletedToday ? 0.6 : 1,
            }}>
            <Check size={16} />
            {isCompletedToday ? '오늘 이미 완료했어요' : '루틴 완료로 기록하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Routine Card ─────────────────────────────────────────────────────────────
function RoutineCard({ routine, onEdit, onRun }: {
  routine: Routine;
  onEdit: () => void;
  onRun: () => void;
}) {
  const { t } = useTheme();
  const isCompletedToday = routine.checkedDates?.includes(today);
  const streak = getStreak(routine.checkedDates ?? []);

  return (
    <div className="rounded-2xl p-4 flex items-center gap-4 transition-all"
      style={{
        backgroundColor: t.card,
        border: `1px solid ${isCompletedToday ? t.accent + '50' : t.border}`,
        boxShadow: isCompletedToday ? `0 0 0 1px ${t.accent}30` : undefined,
      }}>
      {/* Icon + Done indicator */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: isCompletedToday ? t.accent + '20' : t.bgSub }}>
          {routine.icon}
        </div>
        {isCompletedToday && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#6BAA7A' }}>
            <Check size={11} color="#fff" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{routine.name}</p>
          {streak >= 2 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
              style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <Flame size={10} /> {streak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1" style={{ fontSize: 12, color: t.textMuted }}>
            <Clock size={11} /> {routine.startTime}
          </span>
          <span className="flex items-center gap-1" style={{ fontSize: 12, color: t.textMuted }}>
            <Timer size={11} /> {routine.duration}분
          </span>
          {routine.steps.length > 0 && (
            <span style={{ fontSize: 12, color: t.textMuted }}>{routine.steps.length}단계</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onEdit} className="p-2 rounded-lg" style={{ color: t.textMuted, backgroundColor: t.bgSub }}>
          <Edit3 size={14} />
        </button>
        <button onClick={onRun}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{
            fontSize: 12, fontWeight: 600,
            backgroundColor: isCompletedToday ? t.bgSub : t.accent,
            color: isCompletedToday ? t.textMuted : '#fff',
          }}>
          {isCompletedToday ? <Check size={13} /> : <Play size={13} />}
          {isCompletedToday ? '완료' : '실행'}
        </button>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RoutinesView() {
  const { routines } = usePlanner();
  const { t } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [runningRoutine, setRunningRoutine] = useState<Routine | null>(null);

  const completedToday = routines.filter(r => r.checkedDates?.includes(today)).length;
  const todayLabel = format(new Date(), 'M월 d일 (eee)', { locale: undefined });

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text }}>루틴 실행</h1>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
              {todayLabel} · 오늘 {completedToday}/{routines.length}개 완료
            </p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> 새 루틴
          </button>
        </div>

        {/* Progress bar */}
        {routines.length > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>오늘 진행률</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>
                {Math.round((completedToday / routines.length) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(completedToday / routines.length) * 100}%`,
                  backgroundColor: completedToday === routines.length ? '#6BAA7A' : t.accent,
                }} />
            </div>
            {completedToday === routines.length && routines.length > 0 && (
              <p className="mt-2 text-center" style={{ fontSize: 13, color: '#6BAA7A', fontWeight: 600 }}>
                🎉 오늘 모든 루틴 완료!
              </p>
            )}
          </div>
        )}

        {/* Routine list */}
        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span style={{ fontSize: 48 }}>🌅</span>
            <p style={{ fontSize: 15, fontWeight: 600, color: t.textSub }}>아직 루틴이 없어요</p>
            <p style={{ fontSize: 13, color: t.textMuted }}>반복할 루틴을 만들어 매일 실행해 보세요</p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl mt-2"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} /> 첫 루틴 만들기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 미완료 먼저, 완료 아래 */}
            {[...routines]
              .sort((a, b) => {
                const aDone = a.checkedDates?.includes(today) ? 1 : 0;
                const bDone = b.checkedDates?.includes(today) ? 1 : 0;
                if (aDone !== bDone) return aDone - bDone;
                return a.startTime.localeCompare(b.startTime);
              })
              .map(routine => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  onEdit={() => setEditingRoutine(routine)}
                  onRun={() => setRunningRoutine(routine)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {(showModal || editingRoutine) && (
        <RoutineModal
          routine={editingRoutine ?? undefined}
          onClose={() => { setShowModal(false); setEditingRoutine(null); }}
        />
      )}
      {runningRoutine && (
        <ExecutionPanel
          routine={runningRoutine}
          onClose={() => setRunningRoutine(null)}
        />
      )}
    </div>
  );
}
