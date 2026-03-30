import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Edit3, Trash2, X, Flame, Check, ChevronLeft, ChevronRight,
  Timer, Hash, TrendingUp, MessageSquare, Minus, Pencil, BookOpen,
} from 'lucide-react';
import { TimePicker } from './TimePicker';
import { usePlanner, Habit, Routine } from '../store';
import { useTheme } from '../ThemeContext';
import { format, subDays, startOfMonth, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';
import { RoutineModal, ExecutionPanel, RoutineCard, today as routineToday, getStreak as getRoutineStreak } from './RoutinesView';

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
  const { addHabitFull, updateHabit, deleteHabit, habitMonthlyMemos, setHabitMonthlyMemo } = usePlanner();
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
  const [reason, setReason] = useState(habit?.reason || '');

  // 이번달 메모 (편집 모드일 때만)
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;
  const existingMemo = habit
    ? habitMonthlyMemos.find(m => m.habitId === habit.id && m.year === nowYear && m.month === nowMonth)
    : undefined;
  const [monthlyMemo, setMonthlyMemo] = useState(existingMemo?.memo || '');

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
      reason: reason.trim() || undefined,
    };
    if (habit) {
      updateHabit(habit.id, data);
      // 이번달 메모 저장
      if (monthlyMemo.trim() !== (existingMemo?.memo || '')) {
        setHabitMonthlyMemo(habit.id, nowYear, nowMonth, { memo: monthlyMemo.trim() });
      }
    } else {
      addHabitFull(data);
    }
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
            <div className="mt-1">
              <TimePicker value={alarmTime} onChange={setAlarmTime} placeholder="알림 없음" minuteStep={1} />
            </div>
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
            {/* Reason */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>이 습관을 하려는 이유</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 건강을 위해, 집중력 향상"
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>

          {/* Monthly memo (edit only) */}
          {habit && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>
                이번달 메모
                <span className="ml-1 font-normal" style={{ color: t.textMuted }}>({new Date().getMonth() + 1}월)</span>
              </label>
              <input value={monthlyMemo} onChange={e => setMonthlyMemo(e.target.value)} placeholder="이번달 달성 목표나 특이사항"
                className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
            </div>
          )}
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

// ─── Habit Tracker (FM002 스타일) ──────────────────────────────────────────────
const MONTH_LABELS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function HabitTrackerView() {
  const { habits, habitMonthlyMemos, setHabitMonthlyMemo } = usePlanner();
  const { t } = useTheme();

  const nowDate = new Date();
  const [viewYear, setViewYear] = useState(nowDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(nowDate.getMonth() + 1); // 1-12

  // 메모 인라인 편집 상태
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({});
  // 월간 회고 상태
  const [reviewEditing, setReviewEditing] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({ memo: '', whatWorked: '', whatDidntWork: '', nextMonth: '' });

  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth - 1));
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dateStr = (day: number) =>
    `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getHabitMemo = (habitId: string) =>
    habitMonthlyMemos.find(m => m.habitId === habitId && m.year === viewYear && m.month === viewMonth);

  const monthlyReview = habitMonthlyMemos.find(
    m => m.habitId === '__review__' && m.year === viewYear && m.month === viewMonth
  );

  useEffect(() => {
    setReviewEditing(false);
    setReviewDraft({
      memo: monthlyReview?.memo || '',
      whatWorked: monthlyReview?.whatWorked || '',
      whatDidntWork: monthlyReview?.whatDidntWork || '',
      nextMonth: monthlyReview?.nextMonth || '',
    });
  }, [viewYear, viewMonth]);

  const saveReview = () => {
    setHabitMonthlyMemo('__review__', viewYear, viewMonth, reviewDraft);
    setReviewEditing(false);
  };

  const saveMemo = (habitId: string, memo: string) => {
    setHabitMonthlyMemo(habitId, viewYear, viewMonth, { memo });
    setEditingMemo(prev => { const n = { ...prev }; delete n[habitId]; return n; });
  };

  const REVIEW_FIELDS: { key: keyof typeof reviewDraft; label: string }[] = [
    { key: 'memo', label: 'This month' },
    { key: 'whatWorked', label: 'What worked' },
    { key: 'whatDidntWork', label: "What didn't work" },
    { key: 'nextMonth', label: 'Next month' },
  ];

  return (
    <div>
      {/* 연도 네비 */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => setViewYear(y => y - 1)} className="p-1 rounded" style={{ color: t.textSub }}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{viewYear}</span>
        <button onClick={() => setViewYear(y => y + 1)} className="p-1 rounded" style={{ color: t.textSub }}>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* 월 탭 */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {MONTH_LABELS_SHORT.map((label, i) => {
          const isNowMonth = viewYear === nowDate.getFullYear() && i + 1 === nowDate.getMonth() + 1;
          const isSelected = viewMonth === i + 1;
          return (
            <button key={i} onClick={() => setViewMonth(i + 1)}
              className="px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-all"
              style={{
                fontSize: 11, fontWeight: isSelected ? 700 : 400,
                backgroundColor: isSelected ? t.accent : isNowMonth ? t.accentLight : t.bgSub,
                color: isSelected ? '#fff' : isNowMonth ? t.accent : t.textSub,
              }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* 습관 없을 때 */}
      {habits.length === 0 && (
        <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '32px 0' }}>
          습관 관리 탭에서 먼저 습관을 추가해주세요
        </p>
      )}

      {/* 습관별 행 */}
      {habits.map(habit => {
        const color = habit.color || '#C4A882';
        const score = days.filter(d => habit.checkedDates.includes(dateStr(d))).length;
        const pct = daysInMonth > 0 ? Math.round((score / daysInMonth) * 100) : 0;
        const habitMemo = getHabitMemo(habit.id);
        const isEditingMemo = habit.id in editingMemo;
        const memoText = isEditingMemo ? editingMemo[habit.id] : (habitMemo?.memo || '');

        // 날짜 점 공통 컴포넌트
        const Dot = ({ day }: { day: number }) => {
          const checked = habit.checkedDates.includes(dateStr(day));
          return (
            <div style={{
              borderRadius: '50%',
              backgroundColor: checked ? color : 'transparent',
              border: `1.5px solid ${checked ? color : t.borderLight}`,
              flexShrink: 0,
            }} />
          );
        };

        return (
          <div key={habit.id} className="rounded-xl mb-3 p-3 lg:p-4"
            style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>

            {/* 헤더: 이모지 + 이름 + 이유 + score */}
            <div className="flex items-start gap-2 mb-3">
              <span style={{ fontSize: 20, lineHeight: '1.4', flexShrink: 0 }}>{habit.icon || '🎯'}</span>
              <div className="flex-1 min-w-0">
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text, display: 'block' }}>
                  {habit.name}
                </span>
                {habit.reason && (
                  <span style={{ fontSize: 10, color: t.textMuted, marginTop: 1, display: 'block' }}>
                    {habit.reason}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-0.5 flex-shrink-0">
                <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'DM Serif Display', serif" }}>
                  {score}
                </span>
                <span style={{ fontSize: 11, color: t.textMuted }}>/{daysInMonth}</span>
              </div>
            </div>

            {/* PC: 그리드 점 — 전체 너비 균등 분배 */}
            <div className="hidden lg:block mb-2">
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${daysInMonth}, 1fr)`,
                gap: 3,
              }}>
                {days.map(d => <Dot key={d} day={d} />)}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${daysInMonth}, 1fr)`,
                gap: 3, marginTop: 3,
              }}>
                {days.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 8, color: t.textMuted }}>{d}</div>
                ))}
              </div>
            </div>

            {/* 모바일: 가로 스크롤 점 */}
            <div className="lg:hidden overflow-x-auto mb-2" style={{ marginLeft: -12, marginRight: -12, paddingLeft: 12, paddingRight: 12 }}>
              <div className="flex gap-0.5" style={{ minWidth: 'max-content' }}>
                {days.map(d => (
                  <div key={d} className="flex flex-col items-center gap-0.5">
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      backgroundColor: habit.checkedDates.includes(dateStr(d)) ? color : 'transparent',
                      border: `1.5px solid ${habit.checkedDates.includes(dateStr(d)) ? color : t.borderLight}`,
                    }} />
                    <span style={{ fontSize: 7, color: t.textMuted, width: 14, textAlign: 'center' }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 진행률 바 */}
            <div className="h-1 rounded-full overflow-hidden mb-2" style={{ backgroundColor: t.bgSub }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>

            {/* 이번달 메모 */}
            {isEditingMemo ? (
              <input
                autoFocus
                value={memoText}
                onChange={e => setEditingMemo(prev => ({ ...prev, [habit.id]: e.target.value }))}
                onBlur={() => saveMemo(habit.id, memoText)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveMemo(habit.id, memoText);
                  if (e.key === 'Escape') setEditingMemo(prev => { const n = { ...prev }; delete n[habit.id]; return n; });
                }}
                className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
                style={{ fontSize: 11, borderColor: t.accent, backgroundColor: t.bgSub, color: t.text }}
                placeholder="이 달 메모를 남겨보세요"
              />
            ) : (
              <button
                onClick={() => setEditingMemo(prev => ({ ...prev, [habit.id]: habitMemo?.memo || '' }))}
                className="w-full text-left rounded-lg px-2.5 py-1.5 transition-colors"
                style={{ fontSize: 11, color: habitMemo?.memo ? t.text : t.textMuted, backgroundColor: t.bgSub }}>
                {habitMemo?.memo || '+ 이 달 메모 추가...'}
              </button>
            )}
          </div>
        );
      })}

      {/* 월간 회고 */}
      {habits.length > 0 && (
        <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={14} color={t.accent} />
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>월간 회고</span>
            </div>
            {!reviewEditing && (
              <button
                onClick={() => {
                  setReviewDraft({
                    memo: monthlyReview?.memo || '',
                    whatWorked: monthlyReview?.whatWorked || '',
                    whatDidntWork: monthlyReview?.whatDidntWork || '',
                    nextMonth: monthlyReview?.nextMonth || '',
                  });
                  setReviewEditing(true);
                }}
                className="px-3 py-1 rounded-lg"
                style={{ fontSize: 11, color: t.accent, backgroundColor: t.accentLight }}>
                {monthlyReview ? '편집' : '작성하기'}
              </button>
            )}
          </div>

          {reviewEditing ? (
            <div className="space-y-3">
              {REVIEW_FIELDS.map(field => (
                <div key={field.key}>
                  <label style={{
                    fontSize: 9, fontWeight: 700, color: t.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4,
                  }}>
                    {field.label}
                  </label>
                  <textarea
                    value={reviewDraft[field.key]}
                    onChange={e => setReviewDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 border outline-none resize-none"
                    style={{ fontSize: 12, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setReviewEditing(false)}
                  className="flex-1 py-2 rounded-xl"
                  style={{ fontSize: 12, color: t.textSub, backgroundColor: t.bgSub }}>취소</button>
                <button onClick={saveReview}
                  className="flex-1 py-2 rounded-xl"
                  style={{ fontSize: 12, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>저장</button>
              </div>
            </div>
          ) : monthlyReview && (monthlyReview.memo || monthlyReview.whatWorked || monthlyReview.whatDidntWork || monthlyReview.nextMonth) ? (
            <div className="space-y-3">
              {REVIEW_FIELDS.filter(f => monthlyReview[f.key]).map(field => (
                <div key={field.key}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: t.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
                  }}>
                    {field.label}
                  </div>
                  <p style={{ fontSize: 12, color: t.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {monthlyReview[field.key]}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: t.textMuted }}>이번 달 회고를 작성해보세요 ✍️</p>
          )}
        </div>
      )}
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
  const [runningRoutine, setRunningRoutine] = useState<Routine | null>(null);
  // memo inline editing per habit id
  const [memoEditing, setMemoEditing] = useState<Record<string, string>>({});

  const completedToday = routines.filter(r => r.checkedDates?.includes(routineToday)).length;

  const tabs = [
    { key: 'habits', label: '습관 관리' },
    { key: 'routines', label: '루틴 설정' },
    { key: 'stats', label: '습관 트래커' },
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
          <div className="space-y-4">
            {/* 오늘 진행률 */}
            {routines.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>오늘 진행률</span>
                  <span style={{ fontSize: 12, color: t.textMuted }}>
                    {completedToday}/{routines.length} · {Math.round((completedToday / routines.length) * 100)}%
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

            {/* 루틴 목록 */}
            <div className="space-y-3">
              {[...routines]
                .sort((a, b) => {
                  const aDone = a.checkedDates?.includes(routineToday) ? 1 : 0;
                  const bDone = b.checkedDates?.includes(routineToday) ? 1 : 0;
                  if (aDone !== bDone) return aDone - bDone;
                  return a.startTime.localeCompare(b.startTime);
                })
                .map(r => (
                  <RoutineCard
                    key={r.id}
                    routine={r}
                    onEdit={() => setEditRoutine(r)}
                    onRun={() => setRunningRoutine(r)}
                  />
                ))}
              <button onClick={() => setShowAddRoutine(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
                style={{ border: `2px dashed ${t.border}`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
                <Plus size={16} /> 루틴 추가
              </button>
            </div>
          </div>
        )}

        {/* 습관 트래커 Tab */}
        {tab === 'stats' && <HabitTrackerView />}
      </div>

      {/* Modals */}
      {(showAddHabit || editHabit) && <HabitModal habit={editHabit || undefined} onClose={() => { setEditHabit(null); setShowAddHabit(false); }} />}
      {(showAddRoutine || editRoutine) && <RoutineModal routine={editRoutine || undefined} onClose={() => { setEditRoutine(null); setShowAddRoutine(false); }} />}
      {runningRoutine && <ExecutionPanel routine={runningRoutine} onClose={() => setRunningRoutine(null)} />}
    </div>
  );
}
