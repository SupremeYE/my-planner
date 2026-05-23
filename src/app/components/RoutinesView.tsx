import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Play, Pause, Check, Trash2, Edit3, X,
  Clock, Flame, Timer, Youtube, ChevronRight, RotateCcw, AlertCircle,
} from 'lucide-react';
import { usePlanner, Routine, RoutineStep, getRoutineTotalMinutes, getRoutineSteps } from '../store';
import { useTheme } from '../ThemeContext';
import { TimePicker } from './TimePicker';
import { format } from 'date-fns';

const EMOJI_PALETTE = ['🌅','🧘','🏋️','📖','🚿','☕','🌙','💊','🧹','🍎','🎯','✍️','🎵','💪','🧠','🧴','🌿','🏃','🎨','📝'];
export const today = format(new Date(), 'yyyy-MM-dd');

export function getStreak(checkedDates: string[]): number {
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
  if (!url.trim()) return true;
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]+/.test(url);
}

function formatDuration(sec: number): string {
  const absS = Math.abs(sec);
  const m = Math.floor(absS / 60).toString().padStart(2, '0');
  const s = (absS % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatMinSec(totalSec: number): string {
  const absS = Math.abs(totalSec);
  const m = Math.floor(absS / 60);
  const s = absS % 60;
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
export function RoutineModal({ routine, onClose }: { routine?: Routine; onClose: () => void }) {
  const { addRoutine, updateRoutine, deleteRoutine } = usePlanner();
  const { t } = useTheme();
  const normalizeDurationMinutes = (value: unknown) => Math.max(1, Number.parseInt(String(value), 10) || 1);

  const [name, setName] = useState(routine?.name ?? '');
  const [icon, setIcon] = useState(routine?.icon ?? '🌅');
  const [startTime, setStartTime] = useState(routine?.startTime ?? '07:00');
  const [repeat, setRepeat] = useState<Routine['repeat']>(routine?.repeat ?? 'daily');
  const [repeatDays, setRepeatDays] = useState<number[]>(routine?.repeatDays ?? [1, 2, 3, 4, 5]);

  // 기존 데이터 마이그레이션: routineSteps 없으면 steps에서 변환
  const initialSteps: RoutineStep[] = (() => {
    if (routine?.routineSteps && routine.routineSteps.length > 0) {
      return routine.routineSteps.map(step => ({
        ...step,
        durationMinutes: normalizeDurationMinutes(step.durationMinutes),
      }));
    }
    if (routine?.steps && routine.steps.length > 0) {
      return routine.steps.map((title, i) => ({
        title,
        durationMinutes: 1,
        youtubeUrl: routine.stepYoutubeUrls?.[i] || '',
      }));
    }
    return [{ title: '', durationMinutes: 5, youtubeUrl: '' }];
  })();

  const [steps, setSteps] = useState<RoutineStep[]>(initialSteps);

  const totalMinutes = steps.reduce((s, st) => s + (Number(st.durationMinutes) || 0), 0);

  const handleSave = () => {
    if (!name.trim()) return;
    const filtered = steps.filter(s => s.title.trim());
    if (filtered.length === 0) return;
    const routineSteps: RoutineStep[] = filtered.map(s => ({
      title: s.title.trim(),
      durationMinutes: Math.max(1, Number(s.durationMinutes) || 1),
      youtubeUrl: s.youtubeUrl?.trim() || undefined,
    }));
    const totalDuration = routineSteps.reduce((sum, s) => sum + s.durationMinutes, 0);
    const data = {
      name: name.trim(), icon, startTime,
      duration: totalDuration,
      steps: routineSteps.map(s => s.title),
      stepYoutubeUrls: routineSteps.map(s => s.youtubeUrl ?? ''),
      routineSteps,
      checkedDates: routine?.checkedDates ?? [],
      repeat,
      repeatDays: repeat === 'custom' ? repeatDays : [],
    };
    if (routine) updateRoutine(routine.id, data);
    else addRoutine(data);
    onClose();
  };

  const updateStep = (i: number, patch: Partial<RoutineStep>) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };
  const addStep = () => setSteps(prev => [...prev, { title: '', durationMinutes: 5, youtubeUrl: '' }]);
  const removeStep = (i: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div
        className="rounded-t-2xl lg:rounded-2xl w-full lg:max-w-[480px] flex flex-col"
        style={{
          backgroundColor: t.card,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 lg:px-6 lg:py-5 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            {routine ? '루틴 수정' : '새 루틴 만들기'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 lg:px-6 lg:py-5 space-y-5">
          {/* Icon + Name + Time */}
          <div className="flex gap-3">
            <div>
              <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 6 }}>아이콘</label>
              <div className="flex flex-wrap gap-1.5 w-36 lg:w-40">
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
              <div className="mt-3">
                <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 4 }}>시작 시간</label>
                <TimePicker value={startTime} onChange={setStartTime} placeholder="시작 시간" />
              </div>
              {/* 반복 설정 */}
              <div className="mt-3">
                <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 6 }}>반복</label>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { value: 'daily', label: '매일' },
                    { value: 'weekday', label: '평일' },
                    { value: 'weekend', label: '주말' },
                    { value: 'custom', label: '직접 선택' },
                  ] as const).map(opt => (
                    <button key={opt.value} onClick={() => setRepeat(opt.value)}
                      className="px-3 py-1 rounded-full"
                      style={{
                        fontSize: 12,
                        backgroundColor: repeat === opt.value ? t.accent : t.bgSub,
                        color: repeat === opt.value ? '#fff' : t.text,
                        border: `1px solid ${repeat === opt.value ? t.accent : t.border}`,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {repeat === 'custom' && (
                  <div className="flex gap-1.5 mt-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                      <button key={i}
                        onClick={() => setRepeatDays(prev =>
                          prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                        )}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          fontSize: 12,
                          backgroundColor: repeatDays.includes(i) ? t.accent : t.bgSub,
                          color: repeatDays.includes(i) ? '#fff' : t.text,
                          border: `1px solid ${repeatDays.includes(i) ? t.accent : t.border}`,
                        }}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* 총 소요시간: 자동 계산 */}
              <div className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ backgroundColor: t.accent + '15' }}>
                <Timer size={13} style={{ color: t.accent }} />
                <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>
                  총 소요시간: {totalMinutes}분
                </span>
                <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 2 }}>(단계 합산)</span>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 8 }}>
              단계별 구성 <span style={{ color: t.textMuted, fontWeight: 400 }}>(최소 1단계)</span>
            </label>
            <div className="space-y-3">
              {steps.map((step, i) => {
                const urlInvalid = (step.youtubeUrl ?? '').trim() !== '' && !isValidYoutubeUrl(step.youtubeUrl ?? '');
                return (
                  <div key={i} className="rounded-xl p-3 space-y-2"
                    style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                    {/* Step header */}
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 11, color: t.textMuted, minWidth: 20, textAlign: 'right', fontWeight: 600 }}>
                        {i + 1}
                      </span>
                      <input
                        value={step.title}
                        onChange={e => updateStep(i, { title: e.target.value })}
                        placeholder={`단계 ${i + 1} 이름`}
                        className="flex-1 rounded-lg px-3 py-2 border outline-none"
                        style={{ borderColor: t.border, fontSize: 13, backgroundColor: t.card, color: t.text }}
                      />
                      {steps.length > 1 && (
                        <button onClick={() => removeStep(i)} style={{ color: t.textMuted, flexShrink: 0 }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {/* Duration input */}
                    <div className="flex items-center gap-2 pl-6">
                      <Timer size={13} style={{ color: t.textMuted, flexShrink: 0 }} />
                      <input
                        type="number" min={1} max={120}
                        value={step.durationMinutes}
                        onChange={e => {
                          const normalized = e.target.value
                            .replace(/[^\d]/g, '')
                            .replace(/^0+(?=\d)/, '');
                          updateStep(i, { durationMinutes: normalizeDurationMinutes(normalized) });
                        }}
                        className="w-16 rounded-lg px-2 py-1.5 border outline-none text-center"
                        style={{ borderColor: t.border, fontSize: 13, backgroundColor: t.card, color: t.text }}
                      />
                      <span style={{ fontSize: 12, color: t.textMuted }}>분</span>
                    </div>
                    {/* YouTube URL */}
                    <div className="flex items-center gap-2 pl-6">
                      <Youtube size={13} style={{ color: urlInvalid ? '#ef4444' : t.textMuted, flexShrink: 0 }} />
                      <input
                        value={step.youtubeUrl ?? ''}
                        onChange={e => updateStep(i, { youtubeUrl: e.target.value })}
                        placeholder="YouTube URL (선택)"
                        className="flex-1 rounded-lg px-3 py-1.5 border outline-none"
                        style={{
                          borderColor: urlInvalid ? '#ef4444' : t.border,
                          fontSize: 12, backgroundColor: t.card, color: t.text,
                        }}
                      />
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
        <div className="px-5 py-4 lg:px-6 flex gap-2 justify-between flex-shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
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
interface StepRecord {
  plannedSecs: number;
  actualSecs: number;
}

export function ExecutionPanel({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const { toggleRoutineDate } = usePlanner();
  const { t } = useTheme();

  const routineSteps = getRoutineSteps(routine);
  const totalPlannedSecs = routineSteps.reduce((s, st) => s + st.durationMinutes * 60, 0);

  // ── state ──
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);   // current step 경과 초
  const [totalElapsed, setTotalElapsed] = useState(0); // 전체 경과 초
  const [running, setRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<StepRecord[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [started, setStarted] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCompletedToday = routine.checkedDates?.includes(today);

  // ── timer ──
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setStepElapsed(s => s + 1);
        setTotalElapsed(s => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const currentStep = routineSteps[currentIdx];
  const plannedSecs = (currentStep?.durationMinutes ?? 0) * 60;
  const stepRemaining = plannedSecs - stepElapsed; // 양수: 남은 시간, 음수: 초과
  const totalOverSecs = totalElapsed - totalPlannedSecs;

  const handleStart = () => {
    setRunning(true);
    setStarted(true);
  };

  const handleNextStep = () => {
    setRunning(false);
    const record: StepRecord = { plannedSecs, actualSecs: stepElapsed };
    const newCompleted = [...completedSteps, record];

    if (currentIdx + 1 >= routineSteps.length) {
      // 마지막 단계 완료 → 요약
      setCompletedSteps(newCompleted);
      setShowSummary(true);
    } else {
      setCompletedSteps(newCompleted);
      setCurrentIdx(idx => idx + 1);
      setStepElapsed(0);
      setRunning(true);
    }
  };

  const handleComplete = () => {
    if (!isCompletedToday) toggleRoutineDate(routine.id, today);
    onClose();
  };

  const handleReset = () => {
    setRunning(false);
    setStarted(false);
    setCurrentIdx(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    setCompletedSteps([]);
    setShowSummary(false);
  };

  // ── summary 계산 ──
  const summaryTotalActual = completedSteps.reduce((s, r) => s + r.actualSecs, 0);
  const summaryOverall = summaryTotalActual - totalPlannedSecs;
  const worstStepIdx = completedSteps.reduce((worstIdx, r, i, arr) => {
    const over = r.actualSecs - r.plannedSecs;
    const worstOver = arr[worstIdx] ? arr[worstIdx].actualSecs - arr[worstIdx].plannedSecs : -Infinity;
    return over > worstOver ? i : worstIdx;
  }, 0);
  const worstOver = completedSteps.length > 0
    ? completedSteps[worstStepIdx].actualSecs - completedSteps[worstStepIdx].plannedSecs
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div
        className="w-full lg:w-[500px] rounded-t-2xl lg:rounded-2xl flex flex-col"
        style={{
          backgroundColor: t.card,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.22)',
          maxHeight: '92vh',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 lg:px-6 flex-shrink-0"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 26 }}>{routine.icon}</span>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{routine.name}</p>
              <p style={{ fontSize: 12, color: t.textMuted }}>
                {routine.startTime} · 총 {getRoutineTotalMinutes(routine)}분 · {routineSteps.length}단계
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Summary Screen ── */}
          {showSummary ? (
            <div className="px-5 py-6 lg:px-6 space-y-5">
              <div className="text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p style={{ fontSize: 17, fontWeight: 700, color: t.text }}>루틴 완료!</p>
                <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                  예상 {Math.floor(totalPlannedSecs / 60)}분 / 실제 {Math.floor(summaryTotalActual / 60)}분
                  {summaryTotalActual % 60 > 0 ? ` ${summaryTotalActual % 60}초` : ''}
                </p>
              </div>

              {/* 전체 요약 칩 */}
              <div className="flex items-center justify-center gap-2">
                {summaryOverall > 0 ? (
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-full"
                    style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                    <AlertCircle size={14} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatMinSec(summaryOverall)} 초과
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-full"
                    style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                    <Check size={14} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {summaryOverall === 0 ? '딱 맞게 완료!' : `${formatMinSec(-summaryOverall)} 빠르게 완료!`}
                    </span>
                  </div>
                )}
              </div>

              {/* 단계별 결과 */}
              <div className="space-y-2">
                {completedSteps.map((record, i) => {
                  const over = record.actualSecs - record.plannedSecs;
                  const stepName = routineSteps[i]?.title ?? `단계 ${i + 1}`;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: over > 0 ? '#fee2e2' : t.accent + '20' }}>
                        {over > 0
                          ? <AlertCircle size={13} color="#dc2626" />
                          : <Check size={13} color={t.accent} strokeWidth={2.5} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, color: t.text, fontWeight: 500 }}
                          className="truncate">{stepName}</p>
                        <p style={{ fontSize: 11, color: t.textMuted }}>
                          예정 {Math.floor(record.plannedSecs / 60)}분 → 실제 {formatMinSec(record.actualSecs)}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: over > 0 ? '#dc2626' : '#16a34a',
                      }}>
                        {over > 0 ? `+${formatMinSec(over)}` : over === 0 ? '딱맞음' : `-${formatMinSec(-over)}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 가장 많이 초과된 단계 */}
              {worstOver > 0 && (
                <div className="px-4 py-3 rounded-xl"
                  style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <p style={{ fontSize: 12, color: '#c2410c', fontWeight: 600 }}>
                    ⚠️ 가장 많이 초과된 단계
                  </p>
                  <p style={{ fontSize: 13, color: '#9a3412', marginTop: 4 }}>
                    {routineSteps[worstStepIdx]?.title ?? `단계 ${worstStepIdx + 1}`}
                    {' '}
                    <span style={{ fontWeight: 700 }}>(+{formatMinSec(worstOver)})</span>
                  </p>
                </div>
              )}

              {/* 완료 버튼 */}
              <button onClick={handleComplete}
                disabled={isCompletedToday}
                className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
                style={{
                  backgroundColor: isCompletedToday ? t.bgSub : '#006b62',
                  color: isCompletedToday ? t.textMuted : '#fff',
                  fontWeight: 600, fontSize: 14,
                  opacity: isCompletedToday ? 0.6 : 1,
                }}>
                <Check size={16} />
                {isCompletedToday ? '오늘 이미 완료했어요' : '루틴 완료로 기록하기'}
              </button>

              <button onClick={handleReset}
                className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2"
                style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 13 }}>
                <RotateCcw size={14} /> 처음부터 다시하기
              </button>
            </div>
          ) : (
            /* ── Execution Screen ── */
            <div className="px-5 py-5 lg:px-6 space-y-4">

              {/* 전체 진행 상태 바 */}
              <div className="rounded-xl px-4 py-3"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
                    전체 진행 {currentIdx + 1}/{routineSteps.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 11, color: t.textMuted }}>
                      예정 {Math.floor(totalPlannedSecs / 60)}분
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: totalOverSecs > 0 ? '#dc2626' : t.textMuted,
                    }}>
                      실제 {formatDuration(totalElapsed)}
                    </span>
                    {totalOverSecs > 0 && (
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                        (+{formatMinSec(totalOverSecs)})
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.border }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (currentIdx / routineSteps.length) * 100)}%`,
                      backgroundColor: t.accent,
                    }} />
                </div>
              </div>

              {/* 현재 단계 카드 */}
              {currentStep && (
                <div className="rounded-xl overflow-hidden"
                  style={{ border: `2px solid ${t.accent}40` }}>
                  {/* Step label */}
                  <div className="px-4 py-2 flex items-center gap-2"
                    style={{ backgroundColor: t.accent + '15' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>
                      STEP {currentIdx + 1}
                    </span>
                    <ChevronRight size={12} style={{ color: t.accent }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>
                      {currentStep.title}
                    </span>
                  </div>

                  <div className="px-4 py-4 space-y-4" style={{ backgroundColor: t.card }}>
                    {/* 타이머 */}
                    <div className="flex flex-col items-center gap-2">
                      {/* 큰 타이머 표시 */}
                      <div className="flex items-baseline gap-1">
                        {stepRemaining >= 0 ? (
                          <>
                            <span style={{
                              fontSize: 48,
                              fontWeight: 800,
                              color: stepRemaining < 30 ? '#f59e0b' : t.accent,
                              fontVariantNumeric: 'tabular-nums',
                              lineHeight: 1,
                            }}>
                              {formatDuration(stepRemaining)}
                            </span>
                            <span style={{ fontSize: 14, color: t.textMuted, marginBottom: 4 }}>남음</span>
                          </>
                        ) : (
                          <>
                            <span style={{
                              fontSize: 40,
                              fontWeight: 800,
                              color: '#dc2626',
                              fontVariantNumeric: 'tabular-nums',
                              lineHeight: 1,
                            }}>
                              +{formatDuration(-stepRemaining)}
                            </span>
                            <span style={{ fontSize: 14, color: '#dc2626', marginBottom: 4, fontWeight: 600 }}>초과</span>
                          </>
                        )}
                      </div>

                      {/* 단계 예정 시간 */}
                      <p style={{ fontSize: 12, color: t.textMuted }}>
                        예정 {currentStep.durationMinutes}분 · 경과 {formatDuration(stepElapsed)}
                      </p>

                      {/* 진행 바 */}
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                        {stepRemaining >= 0 ? (
                          <div className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${Math.max(0, (1 - stepElapsed / plannedSecs) * 100)}%`,
                              backgroundColor: stepRemaining < 30 ? '#f59e0b' : t.accent,
                            }} />
                        ) : (
                          <div className="h-full rounded-full bg-red-500 w-full" />
                        )}
                      </div>
                    </div>

                    {/* YouTube 링크 */}
                    {currentStep.youtubeUrl && (
                      <a href={currentStep.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2 rounded-lg"
                        style={{ backgroundColor: '#FF000012', color: '#CC0000', fontSize: 13, fontWeight: 600 }}>
                        <Youtube size={15} /> 영상 보기
                      </a>
                    )}

                    {/* 컨트롤 버튼 */}
                    {!started ? (
                      <button onClick={handleStart}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl"
                        style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 700 }}>
                        <Play size={16} /> 루틴 시작
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setRunning(r => !r)}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl"
                          style={{
                            flex: 1,
                            backgroundColor: running ? t.bgSub : t.bgSub,
                            color: running ? t.textSub : t.accent,
                            border: `1px solid ${t.border}`,
                            fontSize: 13, fontWeight: 600,
                          }}>
                          {running ? <><Pause size={15} /> 일시정지</> : <><Play size={15} /> 재개</>}
                        </button>
                        <button onClick={handleNextStep}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl"
                          style={{
                            flex: 2,
                            backgroundColor: currentIdx + 1 < routineSteps.length ? t.accent : '#006b62',
                            color: '#fff',
                            fontSize: 13, fontWeight: 700,
                          }}>
                          <Check size={15} />
                          {currentIdx + 1 < routineSteps.length ? '완료하고 다음 단계' : '마지막 단계 완료'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 전체 단계 목록 */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 8 }}>전체 단계</p>
                <div className="space-y-1.5">
                  {routineSteps.map((step, i) => {
                    const isDone = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const record = completedSteps[i];
                    const over = record ? record.actualSecs - record.plannedSecs : null;
                    return (
                      <div key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{
                          backgroundColor: isCurrent ? t.accent + '12' : isDone ? t.bgSub : t.bgSub,
                          border: `1px solid ${isCurrent ? t.accent + '40' : t.border}`,
                          opacity: !isDone && !isCurrent && started ? 0.5 : 1,
                        }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isDone ? t.accent : isCurrent ? t.accent + '20' : t.border + '80',
                            border: `2px solid ${isDone ? t.accent : isCurrent ? t.accent : t.border}`,
                          }}>
                          {isDone && <Check size={10} color="#fff" strokeWidth={3} />}
                          {isCurrent && <span style={{ fontSize: 8, fontWeight: 700, color: t.accent }}>▶</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{
                            fontSize: 13, color: isDone ? t.textMuted : t.text,
                            textDecoration: isDone ? 'line-through' : 'none',
                            fontWeight: isCurrent ? 600 : 400,
                          }} className="truncate">
                            {step.title}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>
                          {step.durationMinutes}분
                        </span>
                        {over !== null && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, flexShrink: 0,
                            color: over > 0 ? '#dc2626' : '#16a34a',
                          }}>
                            {over > 0 ? `+${formatMinSec(over)}` : over === 0 ? '딱맞음' : `-${formatMinSec(-over)}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Routine Card ─────────────────────────────────────────────────────────────
export function RoutineCard({ routine, onEdit, onRun }: {
  routine: Routine;
  onEdit: () => void;
  onRun: () => void;
}) {
  const { t } = useTheme();
  const isCompletedToday = routine.checkedDates?.includes(today);
  const streak = getStreak(routine.checkedDates ?? []);
  const totalMins = getRoutineTotalMinutes(routine);
  const steps = getRoutineSteps(routine);

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
            style={{ backgroundColor: '#006b62' }}>
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
            <Timer size={11} /> {totalMins}분
          </span>
          {steps.length > 0 && (
            <span style={{ fontSize: 12, color: t.textMuted }}>{steps.length}단계</span>
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
                  backgroundColor: completedToday === routines.length ? '#006b62' : t.accent,
                }} />
            </div>
            {completedToday === routines.length && routines.length > 0 && (
              <p className="mt-2 text-center" style={{ fontSize: 13, color: '#006b62', fontWeight: 600 }}>
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
