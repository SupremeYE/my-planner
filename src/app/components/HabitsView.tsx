import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Edit3, Trash2, X, Flame, Check, ChevronLeft, ChevronRight,
  Timer, Hash, TrendingUp, MessageSquare, Minus,
} from 'lucide-react';
import { usePlanner, Habit, Routine } from '../store';
import { useTheme } from '../ThemeContext';
import { format, subDays, startOfMonth, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';

const HABIT_COLORS = ['#C4A882', '#D4735A', '#6BAA7A', '#7B9ED9', '#A07BE0', '#6B7280'];
const REPEAT_OPTIONS = [
  { value: 'daily', label: '매일' },
  { value: 'weekday', label: '평일' },
  { value: 'weekend', label: '주말' },
  { value: 'custom', label: '직접 선택' },
];
const CATEGORY_OPTIONS = [
  { value: 'health', label: '건강' },
  { value: 'selfdev', label: '자기계발' },
  { value: 'routine', label: '루틴' },
  { value: 'other', label: '기타' },
];
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const EMOJI_PALETTE = ['💧', '🧘', '🏋️', '📖', '🤸', '🍎', '🌅', '🌙', '💪', '🧠', '🎯', '✍️', '🎵', '🧹', '💊', '🏃', '🎨', '📝', '🧴', '🌿'];

const HABIT_TYPES: { value: Habit['habitType']; label: string; desc: string }[] = [
  { value: 'check',  label: '✓ 체크',  desc: '완료 여부만 체크' },
  { value: 'count',  label: '🔢 횟수',  desc: '횟수 카운트' },
  { value: 'time',   label: '⏱ 시간',  desc: '시간 측정' },
  { value: 'value',  label: '📊 수치',  desc: '수치 입력' },
  { value: 'memo',   label: '✍️ 메모',  desc: '체크 + 메모' },
];

function getStreak(checkedDates: string[]): number {
  if (!checkedDates?.length) return 0;
  const sorted = [...checkedDates].sort().reverse();
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const expected = format(subDays(new Date(sorted[0] + 'T12:00:00'), i), 'yyyy-MM-dd');
    if (sorted[i] === expected) streak++;
    else break;
  }
  return streak;
}

// ─── Habit Add/Edit Modal ──────────────────────────────────────────────────────
function HabitModal({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { addHabitFull, updateHabit, deleteHabit } = usePlanner();
  const { t } = useTheme();
  const [name, setName] = useState(habit?.name || '');
  const [icon, setIcon] = useState(habit?.icon || '🎯');
  const [repeat, setRepeat] = useState<Habit['repeat']>(habit?.repeat || 'daily');
  const [repeatDays, setRepeatDays] = useState<number[]>(habit?.repeatDays || [1, 2, 3, 4, 5]);
  const [goalText, setGoalText] = useState(habit?.goalText || '');
  const [alarmTime, setAlarmTime] = useState(habit?.alarmTime || '');
  const [category, setCategory] = useState<Habit['category']>(habit?.category || 'health');
  const [color, setColor] = useState(habit?.color || HABIT_COLORS[0]);
  const [habitType, setHabitType] = useState<Habit['habitType']>(habit?.habitType || 'check');
  const [targetValue, setTargetValue] = useState<string>(habit?.targetValue?.toString() || '');
  const [valueUnit, setValueUnit] = useState(habit?.valueUnit || '');

  const toggleDay = (d: number) => setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data: Omit<Habit, 'id'> = {
      name: name.trim(), icon, repeat, repeatDays: repeat === 'custom' ? repeatDays : undefined,
      goalText, alarmTime, category, color,
      checkedDates: habit?.checkedDates || [],
      habitType,
      targetValue: targetValue ? Number(targetValue) : undefined,
      valueUnit: valueUnit.trim() || undefined,
      dailyProgress: habit?.dailyProgress || {},
      dailyMemos: habit?.dailyMemos || {},
    };
    if (habit) updateHabit(habit.id, data);
    else addHabitFull(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl shadow-xl w-[440px] max-h-[90vh] overflow-y-auto" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: t.border }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{habit ? '습관 편집' : '습관 추가'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>습관 이름</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예: 물 2L 마시기"
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>

          {/* Icon */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>아이콘</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {EMOJI_PALETTE.map(em => (
                <button key={em} onClick={() => setIcon(em)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ fontSize: 16, backgroundColor: icon === em ? t.accentLight : t.bgSub, border: icon === em ? `2px solid ${t.accent}` : `1px solid ${t.borderLight}` }}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Habit Type */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>목표 유형</label>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              {HABIT_TYPES.map(ht => (
                <button key={ht.value} onClick={() => setHabitType(ht.value)}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all"
                  style={{
                    fontSize: 10, fontWeight: habitType === ht.value ? 700 : 400,
                    backgroundColor: habitType === ht.value ? t.accent : t.bgSub,
                    color: habitType === ht.value ? '#fff' : t.textSub,
                    border: `1px solid ${habitType === ht.value ? t.accent : t.border}`,
                  }}>
                  <span style={{ fontSize: 13 }}>{ht.label.split(' ')[0]}</span>
                  <span>{ht.label.split(' ')[1]}</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
              {HABIT_TYPES.find(h => h.value === habitType)?.desc}
            </p>
          </div>

          {/* Type-specific goal fields */}
          {habitType === 'count' && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>목표 횟수</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={1} value={targetValue} onChange={e => setTargetValue(e.target.value)}
                  placeholder="예: 8"
                  className="w-24 rounded-lg px-3 py-2 border outline-none"
                  style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
                <span style={{ fontSize: 13, color: t.textSub }}>회</span>
              </div>
            </div>
          )}
          {habitType === 'time' && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>목표 시간</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={1} value={targetValue} onChange={e => setTargetValue(e.target.value)}
                  placeholder="예: 30"
                  className="w-24 rounded-lg px-3 py-2 border outline-none"
                  style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
                <span style={{ fontSize: 13, color: t.textSub }}>분</span>
              </div>
            </div>
          )}
          {habitType === 'value' && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>목표 수치</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={0} value={targetValue} onChange={e => setTargetValue(e.target.value)}
                  placeholder="예: 10000"
                  className="w-28 rounded-lg px-3 py-2 border outline-none"
                  style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
                <input value={valueUnit} onChange={e => setValueUnit(e.target.value)}
                  placeholder="단위 (km, L…)"
                  className="flex-1 rounded-lg px-3 py-2 border outline-none"
                  style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
              </div>
            </div>
          )}
          {habitType === 'check' && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>목표 메모 (선택)</label>
              <input value={goalText} onChange={e => setGoalText(e.target.value)} placeholder="예: 30분, 2L"
                className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
            </div>
          )}

          {/* Repeat */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>반복 설정</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {REPEAT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setRepeat(opt.value as Habit['repeat'])}
                  className="px-3 py-1.5 rounded-lg" style={{
                    fontSize: 12, backgroundColor: repeat === opt.value ? t.accent : t.bgSub,
                    color: repeat === opt.value ? '#fff' : t.text, border: `1px solid ${repeat === opt.value ? t.accent : t.border}`,
                  }}>{opt.label}</button>
              ))}
            </div>
            {repeat === 'custom' && (
              <div className="flex gap-1.5 mt-2">
                {DAY_LABELS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                      fontSize: 11, backgroundColor: repeatDays.includes(i) ? t.accent : t.bgSub,
                      color: repeatDays.includes(i) ? '#fff' : t.text, border: `1px solid ${repeatDays.includes(i) ? t.accent : t.border}`,
                    }}>{d}</button>
                ))}
              </div>
            )}
          </div>

          {/* Alarm */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>알림 시간</label>
            <input type="time" value={alarmTime} onChange={e => setAlarmTime(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>

          {/* Category + Color */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>카테고리</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {CATEGORY_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setCategory(opt.value as Habit['category'])}
                    className="px-2.5 py-1 rounded-lg" style={{
                      fontSize: 11, backgroundColor: category === opt.value ? t.accent : t.bgSub,
                      color: category === opt.value ? '#fff' : t.text, border: `1px solid ${category === opt.value ? t.accent : t.border}`,
                    }}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>색상</label>
              <div className="flex gap-2 mt-1.5">
                {HABIT_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full transition-transform"
                    style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t" style={{ borderColor: t.border }}>
          {habit && (
            <button onClick={() => { deleteHabit(habit.id); onClose(); }} className="px-4 py-2 rounded-xl"
              style={{ fontSize: 12, color: '#DC2626', backgroundColor: '#FEE2E2' }}>삭제</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-xl" style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}>취소</button>
          <button onClick={handleSubmit} className="px-5 py-2 rounded-xl" style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ─── HabitChip ────────────────────────────────────────────────────────────────
function HabitChip({ habit, date }: { habit: Habit; date: string }) {
  const { toggleHabit, updateHabitProgress, updateHabitMemo } = usePlanner();
  const { t } = useTheme();

  const habitType = habit.habitType ?? 'check';
  const isChecked = habit.checkedDates.includes(date);
  const progress = habit.dailyProgress?.[date] ?? 0;
  const memo = habit.dailyMemos?.[date] ?? '';

  // ── time type ──
  const accSecRef = useRef(progress);
  const [displaySec, setDisplaySec] = useState(progress);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── value type ──
  const [valueInput, setValueInput] = useState(progress > 0 ? progress.toString() : '');
  const [editingValue, setEditingValue] = useState(false);

  // ── memo type ──
  const [memoText, setMemoText] = useState(memo);
  const [editingMemo, setEditingMemo] = useState(false);

  // Sync accSecRef when date changes
  useEffect(() => {
    accSecRef.current = habit.dailyProgress?.[date] ?? 0;
    setDisplaySec(accSecRef.current);
    setTimerRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [date, habit.id]);

  // Timer interval
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        accSecRef.current += 1;
        setDisplaySec(accSecRef.current);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  // Save timer on unmount
  useEffect(() => {
    return () => {
      if (habitType === 'time' && intervalRef.current) {
        clearInterval(intervalRef.current);
        updateHabitProgress(habit.id, date, accSecRef.current);
      }
    };
  }, []);

  const handleTimerToggle = () => {
    if (timerRunning) {
      setTimerRunning(false);
      updateHabitProgress(habit.id, date, accSecRef.current);
    } else {
      setTimerRunning(true);
    }
  };

  const handleCountTap = (delta: number) => {
    const next = Math.max(0, progress + delta);
    updateHabitProgress(habit.id, date, next);
  };

  const handleValueSave = () => {
    const val = parseFloat(valueInput);
    if (!isNaN(val)) updateHabitProgress(habit.id, date, val);
    setEditingValue(false);
  };

  const handleMemoSave = () => {
    updateHabitMemo(habit.id, date, memoText);
    setEditingMemo(false);
  };

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const accentColor = habit.color || t.accent;

  // ── check type ──
  if (habitType === 'check') {
    return (
      <button onClick={() => toggleHabit(habit.id, date)}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
        style={{ backgroundColor: isChecked ? accentColor : t.bgSub, border: isChecked ? 'none' : `2px solid ${t.border}` }}>
        {isChecked && <Check size={14} color="#fff" strokeWidth={3} />}
      </button>
    );
  }

  // ── count type ──
  if (habitType === 'count') {
    const target = habit.targetValue ?? 0;
    const done = target > 0 && progress >= target;
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => handleCountTap(-1)}
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: t.bgSub, color: t.textMuted }}>
          <Minus size={10} />
        </button>
        <button onClick={() => handleCountTap(1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl min-w-[56px] justify-center"
          style={{ backgroundColor: done ? accentColor : t.bgSub, border: `1px solid ${done ? accentColor : t.border}` }}>
          <Hash size={11} color={done ? '#fff' : t.textMuted} />
          <span style={{ fontSize: 12, fontWeight: 700, color: done ? '#fff' : t.text, fontVariantNumeric: 'tabular-nums' }}>
            {progress}/{target || '?'}
          </span>
        </button>
      </div>
    );
  }

  // ── time type ──
  if (habitType === 'time') {
    const targetSec = (habit.targetValue ?? 0) * 60;
    const done = targetSec > 0 && displaySec >= targetSec;
    return (
      <button onClick={handleTimerToggle}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
        style={{
          backgroundColor: timerRunning ? '#FEF3C7' : done ? accentColor : t.bgSub,
          border: `1px solid ${timerRunning ? '#F59E0B' : done ? accentColor : t.border}`,
        }}>
        <Timer size={12} color={timerRunning ? '#D97706' : done ? '#fff' : t.textMuted}
          style={{ animation: timerRunning ? 'spin 2s linear infinite' : 'none' }} />
        <span style={{
          fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: timerRunning ? '#D97706' : done ? '#fff' : t.text,
        }}>
          {fmtTime(displaySec)}
          {habit.targetValue ? `/${habit.targetValue}분` : ''}
        </span>
      </button>
    );
  }

  // ── value type ──
  if (habitType === 'value') {
    const target = habit.targetValue ?? 0;
    const unit = habit.valueUnit || '';
    const done = target > 0 && progress >= target;
    if (editingValue) {
      return (
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            autoFocus
            type="number"
            value={valueInput}
            onChange={e => setValueInput(e.target.value)}
            onBlur={handleValueSave}
            onKeyDown={e => { if (e.key === 'Enter') handleValueSave(); if (e.key === 'Escape') setEditingValue(false); }}
            className="w-20 rounded-lg px-2 py-1 border outline-none text-center"
            style={{ fontSize: 12, borderColor: t.accent, backgroundColor: t.bgSub, color: t.text }}
          />
          <span style={{ fontSize: 11, color: t.textMuted }}>{unit}</span>
        </div>
      );
    }
    return (
      <button onClick={() => setEditingValue(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl flex-shrink-0"
        style={{ backgroundColor: done ? accentColor : t.bgSub, border: `1px solid ${done ? accentColor : t.border}` }}>
        <TrendingUp size={11} color={done ? '#fff' : t.textMuted} />
        <span style={{ fontSize: 12, fontWeight: 700, color: done ? '#fff' : t.text }}>
          {progress > 0 ? `${progress}` : '—'}{unit ? `/${target}${unit}` : ''}
        </span>
      </button>
    );
  }

  // ── memo type ──
  if (habitType === 'memo') {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => {
          toggleHabit(habit.id, date);
          if (!isChecked) setEditingMemo(true);
        }}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ backgroundColor: isChecked ? accentColor : t.bgSub, border: isChecked ? 'none' : `2px solid ${t.border}` }}>
          {isChecked ? <Check size={14} color="#fff" strokeWidth={3} /> : <MessageSquare size={13} color={t.textMuted} />}
        </button>
      </div>
    );
  }

  return null;
}

// ─── Routine Modal ────────────────────────────────────────────────────────────
function RoutineModal({ routine, onClose }: { routine?: Routine; onClose: () => void }) {
  const { addRoutine, updateRoutine, deleteRoutine } = usePlanner();
  const { t } = useTheme();
  const [name, setName] = useState(routine?.name || '');
  const [icon, setIcon] = useState(routine?.icon || '🌅');
  const [startTime, setStartTime] = useState(routine?.startTime || '07:00');
  const [duration, setDuration] = useState(routine?.duration || 30);
  const [steps, setSteps] = useState<string[]>(routine?.steps || ['']);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const filteredSteps = steps.filter(s => s.trim());
    if (routine) updateRoutine(routine.id, { name: name.trim(), icon, startTime, duration, steps: filteredSteps });
    else addRoutine({ name: name.trim(), icon, startTime, duration, steps: filteredSteps, checkedDates: [] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl shadow-xl w-[420px] max-h-[80vh] overflow-y-auto" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: t.border }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{routine ? '루틴 편집' : '루틴 추가'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-3">
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>아이콘</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {['🌅', '🌙', '💪', '🧘', '📖', '🧹', '🎯'].map(em => (
                  <button key={em} onClick={() => setIcon(em)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ fontSize: 16, backgroundColor: icon === em ? t.accentLight : t.bgSub, border: icon === em ? `2px solid ${t.accent}` : `1px solid ${t.borderLight}` }}>{em}</button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>루틴 이름</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="아침 루틴"
                className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>시작 시간</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>소요 시간 (분)</label>
              <input type="number" min={5} max={240} value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>단계</label>
            <div className="space-y-1.5 mt-1.5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span style={{ fontSize: 10, color: t.textMuted, width: 16 }}>{i + 1}.</span>
                  <input value={step} onChange={e => { const ns = [...steps]; ns[i] = e.target.value; setSteps(ns); }}
                    placeholder="단계 입력" className="flex-1 rounded-lg px-2.5 py-1.5 border outline-none"
                    style={{ borderColor: t.border, fontSize: 12, backgroundColor: t.bgSub, color: t.text }} />
                  <button onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="p-1" style={{ color: t.textMuted }}>
                    <X size={12} /></button>
                </div>
              ))}
              <button onClick={() => setSteps([...steps, ''])} className="px-3 py-1 rounded-lg"
                style={{ fontSize: 11, color: t.accent, border: `1px dashed ${t.accent}` }}>+ 단계 추가</button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t" style={{ borderColor: t.border }}>
          {routine && (
            <button onClick={() => { deleteRoutine(routine.id); onClose(); }} className="px-4 py-2 rounded-xl"
              style={{ fontSize: 12, color: '#DC2626', backgroundColor: '#FEE2E2' }}>삭제</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-xl" style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}>취소</button>
          <button onClick={handleSubmit} className="px-5 py-2 rounded-xl" style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
function HabitHeatmap({ habit }: { habit: Habit }) {
  const { t } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date());
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = startOfMonth(viewMonth);
  const startDow = getDay(firstDay);
  const daysInMonth = getDaysInMonth(viewMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthChecked = Array.from({ length: daysInMonth }, (_, i) => dateStr(i + 1)).filter(d => habit.checkedDates.includes(d)).length;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{habit.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{habit.name}</span>
          <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: t.bgSub, color: t.textMuted }}>
            {HABIT_TYPES.find(h => h.value === (habit.habitType ?? 'check'))?.label}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 11, color: t.textSub }}>이번달 {monthChecked}회</span>
          <span style={{ fontSize: 11, color: '#D4735A' }}><Flame size={11} className="inline" style={{ verticalAlign: -1 }} /> {getStreak(habit.checkedDates)}일 연속</span>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1 rounded" style={{ color: t.textSub }}><ChevronLeft size={14} /></button>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{year}년 {month + 1}월</span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1 rounded" style={{ color: t.textSub }}><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map(d => <div key={d} className="text-center" style={{ fontSize: 9, color: t.textMuted }}>{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="w-6 h-6" />;
          const checked = habit.checkedDates.includes(dateStr(day));
          return (
            <div key={i} className="w-6 h-6 rounded flex items-center justify-center mx-auto" style={{
              backgroundColor: checked ? (habit.color || t.accent) : t.bgSub,
              opacity: checked ? 1 : 0.3,
            }}>
              <span style={{ fontSize: 8, color: checked ? '#fff' : t.textMuted }}>{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function HabitsView() {
  const { habits, routines, selectedDate, updateHabitMemo } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<'habits' | 'routines' | 'stats'>('habits');
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  // memo inline editing per habit id
  const [memoEditing, setMemoEditing] = useState<Record<string, string>>({});

  const tabs = [
    { key: 'habits', label: '습관 관리' },
    { key: 'routines', label: '루틴 설정' },
    { key: 'stats', label: '통계 & 히트맵' },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>습관 & 루틴</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>좋은 습관을 만들고, 루틴으로 하루를 설계하세요</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 mb-4">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className="px-4 py-2 rounded-xl transition-all"
            style={{
              fontSize: 13, fontWeight: tab === tb.key ? 600 : 400,
              backgroundColor: tab === tb.key ? t.accent : t.bgSub,
              color: tab === tb.key ? '#fff' : t.textSub,
            }}>{tb.label}</button>
        ))}
      </div>

      <div className="px-6 pb-8">
        {/* Habits Tab */}
        {tab === 'habits' && (
          <div className="space-y-2">
            {habits.map(h => {
              const streak = getStreak(h.checkedDates);
              const isChecked = h.checkedDates.includes(selectedDate);
              const habitType = h.habitType ?? 'check';
              const memoVal = memoEditing[h.id] ?? h.dailyMemos?.[selectedDate] ?? '';
              const showMemoRow = habitType === 'memo' && isChecked;

              return (
                <div key={h.id} className="rounded-xl transition-all"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <div className="flex items-center gap-3 p-4">
                    {/* Type-specific chip */}
                    <HabitChip habit={h} date={selectedDate} />

                    <span style={{ fontSize: 18 }}>{h.icon || '🎯'}</span>

                    <div className="flex-1 min-w-0">
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{h.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span style={{ fontSize: 11, color: t.textMuted }}>
                          {h.repeat === 'daily' ? '매일' : h.repeat === 'weekday' ? '평일' : h.repeat === 'weekend' ? '주말' : '커스텀'}
                        </span>
                        {habitType !== 'check' && (
                          <span className="px-1.5 py-0.5 rounded-full"
                            style={{ fontSize: 10, backgroundColor: t.bgSub, color: t.textMuted }}>
                            {HABIT_TYPES.find(ht => ht.value === habitType)?.label}
                          </span>
                        )}
                        {h.goalText && habitType === 'check' && (
                          <span style={{ fontSize: 11, color: t.textSub }}>{h.goalText}</span>
                        )}
                      </div>
                    </div>

                    {streak > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FEF3C7' }}>
                        <Flame size={12} color="#D97706" />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>{streak}</span>
                      </div>
                    )}
                    <button onClick={() => setEditHabit(h)} className="p-2 rounded-lg" style={{ color: t.textMuted }}>
                      <Edit3 size={14} />
                    </button>
                  </div>

                  {/* Memo inline row (memo type, after checking) */}
                  {showMemoRow && (
                    <div className="px-4 pb-3 flex items-center gap-2" style={{ borderTop: `1px solid ${t.borderLight}` }}>
                      <MessageSquare size={13} color={t.textMuted} style={{ flexShrink: 0, marginTop: 8 }} />
                      <input
                        value={memoVal}
                        onChange={e => setMemoEditing(prev => ({ ...prev, [h.id]: e.target.value }))}
                        onBlur={() => {
                          updateHabitMemo(h.id, selectedDate, memoVal);
                          setMemoEditing(prev => { const n = { ...prev }; delete n[h.id]; return n; });
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateHabitMemo(h.id, selectedDate, memoVal);
                            setMemoEditing(prev => { const n = { ...prev }; delete n[h.id]; return n; });
                          }
                        }}
                        placeholder="오늘 메모를 남겨보세요…"
                        className="flex-1 rounded-lg px-3 py-1.5 border outline-none mt-2"
                        style={{ fontSize: 12, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => setShowAddHabit(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
              style={{ border: `2px dashed ${t.border}`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
              <Plus size={16} /> 습관 추가
            </button>
          </div>
        )}

        {/* Routines Tab */}
        {tab === 'routines' && (
          <div className="space-y-3">
            {routines.map(r => (
              <div key={r.id} className="p-4 rounded-xl cursor-pointer transition-all hover:shadow-md"
                onClick={() => setEditRoutine(r)}
                style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <div className="flex items-center gap-3 mb-2">
                  <span style={{ fontSize: 20 }}>{r.icon}</span>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{r.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span style={{ fontSize: 11, color: t.textMuted }}>{r.startTime}</span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{r.duration}분</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.steps.map((step, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full"
                      style={{ fontSize: 10, backgroundColor: t.bgSub, color: t.textSub, border: `1px solid ${t.borderLight}` }}>
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setShowAddRoutine(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
              style={{ border: `2px dashed ${t.border}`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
              <Plus size={16} /> 루틴 추가
            </button>
          </div>
        )}

        {/* Stats Tab */}
        {tab === 'stats' && (
          <div className="space-y-4">
            {habits.map(h => <HabitHeatmap key={h.id} habit={h} />)}
          </div>
        )}
      </div>

      {/* Modals */}
      {(showAddHabit || editHabit) && <HabitModal habit={editHabit || undefined} onClose={() => { setEditHabit(null); setShowAddHabit(false); }} />}
      {(showAddRoutine || editRoutine) && <RoutineModal routine={editRoutine || undefined} onClose={() => { setEditRoutine(null); setShowAddRoutine(false); }} />}
    </div>
  );
}
