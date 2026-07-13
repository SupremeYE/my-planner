import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Edit3, X, Flame, Check, ChevronLeft, ChevronRight,
  Timer, Hash, TrendingUp, MessageSquare, Minus,
} from 'lucide-react';
import { TimePicker } from './TimePicker';
import { usePlanner, Habit, Routine, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { format, subDays, startOfMonth, getDaysInMonth, getDay, addDays, startOfWeek, addMonths, subMonths } from 'date-fns';
import { RoutineModal, ExecutionPanel, RoutineCard, today as routineToday } from './RoutinesView';
import { useNotification } from '../hooks/useNotification';
import { useFabAction } from '../FabContext';

const HABIT_COLORS = ['#515f74', '#D4735A', '#006b62', '#7B9ED9', '#A07BE0', '#6B7280'];
const REPEAT_OPTIONS = [
  { value: 'daily', label: '매일' },
  { value: 'weekday', label: '평일' },
  { value: 'weekend', label: '주말' },
  { value: 'custom', label: '직접 선택' },
];
const CATEGORY_COLOR_PRESETS = ['#515f74', '#D4735A', '#E8A87C', '#F4A261', '#4A82CC', '#45B899', '#006b62', '#8B7CF8', '#22C55E', '#6B7280'];
const HABIT_CATEGORY_STORAGE_KEY = 'habitCategoryOptions';
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const HABIT_TYPES: { value: Habit['habitType']; label: string; desc: string }[] = [
  { value: 'check',  label: '✓ 체크',  desc: '완료 여부만 체크' },
  { value: 'count',  label: '🔢 횟수',  desc: '횟수 카운트' },
  { value: 'time',   label: '⏱ 시간',  desc: '시간 측정' },
  { value: 'value',  label: '📊 수치',  desc: '수치 입력' },
  { value: 'memo',   label: '✍️ 메모',  desc: '체크 + 메모' },
];

interface HabitCategoryOption {
  id: string;
  name: string;
  color: string;
}

function getStreak(checkedDates: string[]): number {
  if (!checkedDates?.length) return 0;
  const sorted = [...checkedDates].sort().reverse();
  const today = getLogicalToday();
  const yesterday = format(subDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd');
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const expected = format(subDays(new Date(sorted[0] + 'T12:00:00'), i), 'yyyy-MM-dd');
    if (sorted[i] === expected) streak++;
    else break;
  }
  return streak;
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function normalizeDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isHabitApplicableOnDate(habit: Habit, date: Date): boolean {
  const dow = date.getDay();
  switch (habit.repeat) {
    case 'weekday':
      return dow >= 1 && dow <= 5;
    case 'weekend':
      return dow === 0 || dow === 6;
    case 'custom':
      return habit.repeatDays?.includes(dow) ?? false;
    case 'daily':
    default:
      return true;
  }
}

// ─── Habit Add/Edit Modal ──────────────────────────────────────────────────────
function HabitModal({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { addHabitFull, updateHabit, deleteHabit, habitMonthlyMemos, setHabitMonthlyMemo, habits } = usePlanner();
  const { t } = useTheme();
  const [name, setName] = useState(habit?.name || '');
  const [icon, setIcon] = useState(habit?.icon || '🎯');
  const [repeat, setRepeat] = useState<Habit['repeat']>(habit?.repeat || 'daily');
  const [repeatDays, setRepeatDays] = useState<number[]>(habit?.repeatDays || [1, 2, 3, 4, 5]);
  const [goalText, setGoalText] = useState(habit?.goalText || '');
  const [alarmTime, setAlarmTime] = useState(habit?.alarmTime || '');
  const [category, setCategory] = useState<string>(habit?.category || '');
  const [color, setColor] = useState(habit?.color || HABIT_COLORS[0]);
  const [habitType, setHabitType] = useState<Habit['habitType']>(habit?.habitType || 'check');
  const [targetValue, setTargetValue] = useState<string>(habit?.targetValue?.toString() || '');
  const [valueUnit, setValueUnit] = useState(habit?.valueUnit || '');
  const [reason, setReason] = useState(habit?.reason || '');
  const normalizedIcon = icon.trim() || '🎯';
  const [categoryOptions, setCategoryOptions] = useState<HabitCategoryOption[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLOR_PRESETS[0]);

  // 이번달 메모 (편집 모드일 때만)
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;
  const existingMemo = habit
    ? habitMonthlyMemos.find(m => m.habitId === habit.id && m.year === nowYear && m.month === nowMonth)
    : undefined;
  const [monthlyMemo, setMonthlyMemo] = useState(existingMemo?.memo || '');

  const isValidHex = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);
  const normalizeHex = (value: string) => {
    const trimmed = value.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return withHash.toUpperCase();
  };
  const normalizeHexInput = (value: string) => `#${value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()}`;

  useEffect(() => {
    const fromStorage: HabitCategoryOption[] = (() => {
      try {
        const raw = localStorage.getItem(HABIT_CATEGORY_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((item: any) => item && typeof item.name === 'string' && typeof item.color === 'string')
          .map((item: any) => ({
            id: item.id || item.name,
            name: item.name,
            color: isValidHex(normalizeHex(item.color)) ? normalizeHex(item.color) : CATEGORY_COLOR_PRESETS[0],
          }));
      } catch {
        return [];
      }
    })();

    const inferred = habits
      .map(h => h.category?.trim())
      .filter((v): v is string => Boolean(v))
      .reduce<HabitCategoryOption[]>((acc, name) => {
        if (acc.some(option => option.name === name)) return acc;
        acc.push({ id: name, name, color: CATEGORY_COLOR_PRESETS[acc.length % CATEGORY_COLOR_PRESETS.length] });
        return acc;
      }, []);

    const merged = [...fromStorage];
    inferred.forEach(option => {
      if (!merged.some(item => item.name === option.name)) merged.push(option);
    });
    if (category && !merged.some(item => item.name === category)) {
      merged.push({ id: category, name: category, color: CATEGORY_COLOR_PRESETS[merged.length % CATEGORY_COLOR_PRESETS.length] });
    }
    setCategoryOptions(merged);
  }, [habits, category]);

  useEffect(() => {
    try {
      localStorage.setItem(HABIT_CATEGORY_STORAGE_KEY, JSON.stringify(categoryOptions));
    } catch {
      // noop
    }
  }, [categoryOptions]);

  const toggleDay = (d: number) => setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const normalizedCategory = category.trim();
    const data: Omit<Habit, 'id'> = {
      name: name.trim(), icon: normalizedIcon, repeat, repeatDays: repeat === 'custom' ? repeatDays : undefined,
      goalText, alarmTime, category, color,
      checkedDates: habit?.checkedDates || [],
      habitType,
      targetValue: targetValue ? Number(targetValue) : undefined,
      valueUnit: valueUnit.trim() || undefined,
      dailyProgress: habit?.dailyProgress || {},
      dailyMemos: habit?.dailyMemos || {},
      reason: reason.trim() || undefined,
    };
    data.category = normalizedCategory || undefined;
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

  const addCategoryOption = () => {
    const nameTrimmed = newCategoryName.trim();
    const colorNormalized = normalizeHex(newCategoryColor);
    if (!nameTrimmed || !isValidHex(colorNormalized)) return;
    if (categoryOptions.some(option => option.name === nameTrimmed)) {
      setCategory(nameTrimmed);
      setShowAddCategory(false);
      setNewCategoryName('');
      return;
    }
    const next: HabitCategoryOption = { id: `${Date.now()}-${nameTrimmed}`, name: nameTrimmed, color: colorNormalized };
    setCategoryOptions(prev => [next, ...prev]);
    setCategory(nameTrimmed);
    setShowAddCategory(false);
    setNewCategoryName('');
    setNewCategoryColor(CATEGORY_COLOR_PRESETS[0]);
  };

  const removeCategoryOption = (name: string) => {
    setCategoryOptions(prev => prev.filter(option => option.name !== name));
    if (category === name) setCategory('');
  };

  const repeatUI = (
    <div>
      <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>반복 설정</label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {REPEAT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setRepeat(opt.value as Habit['repeat'])}
            className="px-3 py-1.5 rounded-full"
            style={{
              fontSize: 12,
              backgroundColor: repeat === opt.value ? t.accent : t.bgSub,
              color: repeat === opt.value ? '#fff' : t.text,
              border: `1px solid ${repeat === opt.value ? t.accent : t.border}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {repeat === 'custom' && (
        <div className="flex gap-1.5 mt-2">
          {DAY_LABELS.map((d, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                fontSize: 11,
                backgroundColor: repeatDays.includes(i) ? t.accent : t.bgSub,
                color: repeatDays.includes(i) ? '#fff' : t.text,
                border: `1px solid ${repeatDays.includes(i) ? t.accent : t.border}`,
              }}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl shadow-xl w-[560px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: t.border }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{habit ? '습관 편집' : '습관 추가'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 lg:px-5 py-4 space-y-5">
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>습관 이름</label>
            <div className="mt-1 flex gap-2">
              <input
                value={icon}
                onChange={e => setIcon(Array.from(e.target.value).slice(0, 1).join(''))}
                placeholder="🎯"
                className="w-[62px] rounded-lg px-2 py-2 border outline-none text-center"
                style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 22 }}
              />
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 물 마시기"
                className="flex-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              />
            </div>
            <p style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>아이콘 칸에서 `Win + .` 로 이모지를 입력할 수 있어요.</p>
          </div>

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

          {habitType === 'count' || habitType === 'time' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[110px_1fr] gap-4">
              <div>
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>
                  {habitType === 'count' ? '목표 횟수' : '목표 시간'}
                </label>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    min={1}
                    value={targetValue}
                    onChange={e => setTargetValue(e.target.value)}
                    className="w-20 rounded-lg px-2.5 py-2 border outline-none"
                    style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
                  />
                  <span style={{ fontSize: 12, color: t.textSub }}>{habitType === 'count' ? '회' : '분'}</span>
                </div>
              </div>
              {repeatUI}
            </div>
          ) : (
            <>
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
              {repeatUI}
            </>
          )}

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>알림 시간</label>
            <div className="mt-1">
              <TimePicker value={alarmTime} onChange={setAlarmTime} placeholder="알림 없음" minuteStep={1} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>카테고리</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {categoryOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setCategory(option.name)}
                    className="px-2.5 py-1 rounded-full flex items-center gap-1.5"
                    style={{
                      fontSize: 11,
                      backgroundColor: category === option.name ? option.color : t.bgSub,
                      color: category === option.name ? '#fff' : t.textSub,
                      border: `1px solid ${category === option.name ? option.color : t.border}`,
                    }}
                  >
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                    {option.name}
                    <span
                      onClick={e => {
                        e.stopPropagation();
                        removeCategoryOption(option.name);
                      }}
                      style={{ fontSize: 10, lineHeight: 1, opacity: 0.8 }}
                    >
                      ×
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => setShowAddCategory(prev => !prev)}
                  className="px-2.5 py-1 rounded-full"
                  style={{ fontSize: 11, color: t.accent, border: `1px dashed ${t.accent}` }}
                >
                  + 카테고리
                </button>
              </div>
              {showAddCategory && (
                <div className="mt-2 p-3 rounded-xl space-y-2" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <input
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="카테고리 이름"
                    className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
                    style={{ borderColor: t.border, fontSize: 12, backgroundColor: t.card, color: t.text }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_COLOR_PRESETS.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setNewCategoryColor(preset)}
                        className="w-5 h-5 rounded-full transition-transform"
                        style={{
                          backgroundColor: preset,
                          outline: newCategoryColor === preset ? `2px solid ${preset}` : 'none',
                          outlineOffset: 1,
                          transform: newCategoryColor === preset ? 'scale(1.08)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                  <input
                    value={newCategoryColor}
                    onChange={e => setNewCategoryColor(normalizeHexInput(e.target.value))}
                    placeholder="#515F74"
                    className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
                    style={{
                      borderColor: isValidHex(normalizeHex(newCategoryColor)) ? t.border : '#DC2626',
                      fontSize: 12,
                      backgroundColor: t.card,
                      color: t.text,
                    }}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={addCategoryOption}
                      disabled={!newCategoryName.trim() || !isValidHex(normalizeHex(newCategoryColor))}
                      className="flex-1 py-1.5 rounded-lg"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: t.accent,
                        color: '#fff',
                        opacity: newCategoryName.trim() && isValidHex(normalizeHex(newCategoryColor)) ? 1 : 0.5,
                        cursor: newCategoryName.trim() && isValidHex(normalizeHex(newCategoryColor)) ? 'pointer' : 'not-allowed',
                      }}
                    >
                      추가
                    </button>
                    <button
                      onClick={() => setShowAddCategory(false)}
                      className="flex-1 py-1.5 rounded-lg"
                      style={{ fontSize: 12, color: t.textSub, backgroundColor: t.card, border: `1px solid ${t.border}` }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>습관 색상</label>
              <div className="flex gap-2 mt-1.5">
                {HABIT_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full transition-transform"
                    style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transform: color === c ? 'scale(1.15)' : 'scale(1)' }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>
              이 습관을 하려는 이유 <span style={{ color: t.textMuted, fontWeight: 400 }}>(선택)</span>
            </label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 물을 꾸준히 마셔서 컨디션 유지"
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>

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
export function HabitChip({ habit, date }: { habit: Habit; date: string }) {
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
    const target = habit.targetValue ?? 0;
    const nextRaw = Math.max(0, progress + delta);
    const next = target > 0 ? Math.min(target, nextRaw) : nextRaw;
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

type TrackerMode = 'week' | 'month' | 'year';
const TRACKER_TABS: { key: TrackerMode; label: string }[] = [
  { key: 'week', label: '이번 주' },
  { key: 'month', label: '이번 달' },
  { key: 'year', label: '올해' },
];
const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const YEAR_MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function HabitTrackerView() {
  const { habits } = usePlanner();
  const { t } = useTheme();
  const [mode, setMode] = useState<TrackerMode>('week');
  const [viewDate, setViewDate] = useState(new Date());
  const todayDate = normalizeDate(new Date());
  const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => normalizeDate(addDays(weekStart, i)));
  const monthStart = startOfMonth(viewDate);
  const daysInMonth = getDaysInMonth(monthStart);
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => normalizeDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1)));
  const viewYear = viewDate.getFullYear();
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();

  const movePrev = () => {
    if (mode === 'week') setViewDate(prev => addDays(prev, -7));
    if (mode === 'month') setViewDate(prev => subMonths(prev, 1));
    if (mode === 'year') setViewDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  };
  const moveNext = () => {
    if (mode === 'week') setViewDate(prev => addDays(prev, 7));
    if (mode === 'month') setViewDate(prev => addMonths(prev, 1));
    if (mode === 'year') setViewDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  };

  const rangeLabel = (() => {
    if (mode === 'week') return `${format(weekDates[0], 'M.d')} - ${format(weekDates[6], 'M.d')}`;
    if (mode === 'month') return `${format(viewDate, 'yyyy년 M월')}`;
    return `${viewYear}년`;
  })();

  const getRangeCount = (habit: Habit, dates: Date[]) => {
    let done = 0;
    let total = 0;
    dates.forEach(date => {
      if (date.getTime() > todayDate.getTime()) return;
      if (!isHabitApplicableOnDate(habit, date)) return;
      total += 1;
      if (habit.checkedDates.includes(toDateKey(date))) done += 1;
    });
    return { done, total };
  };

  const renderEmojiCell = (
    habit: Habit,
    date: Date,
    opts: {
      height: number;
      emojiSize: number;
      fill?: boolean;
      baseBg?: string;
      emptyBorder?: string;
      futureOpacity?: number;
      futureBg?: string;
      futureBorder?: string;
    },
  ) => {
    const checked = habit.checkedDates.includes(toDateKey(date));
    const applicable = isHabitApplicableOnDate(habit, date);
    const isFuture = date.getTime() > todayDate.getTime();
    const isNA = isFuture || !applicable;
    const futureStyle = isFuture
      ? {
          opacity: opts.futureOpacity ?? 0.24,
          borderColor: opts.futureBorder || t.borderLight,
          backgroundColor: opts.futureBg || t.bgSub,
          borderStyle: 'dashed' as const,
        }
      : null;
    const unavailableStyle = !applicable
      ? {
          opacity: 0.68,
          borderColor: t.border,
          backgroundColor: opts.baseBg || t.bgSub,
          borderStyle: 'solid' as const,
        }
      : null;
    const activeStyle = {
      opacity: 1,
      borderColor: checked ? t.accent : (opts.emptyBorder || t.border),
      backgroundColor: checked ? t.accentLight : (opts.baseBg || 'transparent'),
      borderStyle: 'solid' as const,
    };
    const cellStyle = futureStyle || unavailableStyle || activeStyle;
    return (
      <div
        key={toDateKey(date)}
        style={{
          width: opts.fill ? '100%' : opts.height,
          height: opts.height,
          borderRadius: 6,
          border: `1px ${cellStyle.borderStyle} ${cellStyle.borderColor}`,
          backgroundColor: cellStyle.backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: cellStyle.opacity,
          fontSize: opts.emojiSize,
          lineHeight: 1,
        }}
      >
        {checked && !isNA ? habit.icon || '🎯' : ''}
      </div>
    );
  };

  return (
    <div className="rounded-xl p-3 lg:p-5" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={movePrev} className="p-1.5 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>{rangeLabel}</span>
        <button onClick={moveNext} className="p-1.5 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub }}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
        {TRACKER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className="px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{
              fontSize: 12,
              fontWeight: mode === tab.key ? 700 : 500,
              backgroundColor: mode === tab.key ? t.accent : t.bgSub,
              color: mode === tab.key ? '#fff' : t.textSub,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {habits.length === 0 ? (
        <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '22px 0' }}>
          습관을 추가하면 트래커가 표시됩니다
        </p>
      ) : mode === 'year' ? (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <div style={{ width: '100%' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(140px, 1.2fr) repeat(12, minmax(44px, 1fr))',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div />
                {YEAR_MONTH_LABELS.map(label => (
                  <div key={label} style={{ fontSize: 10, color: t.textMuted, textAlign: 'center' }}>{label}</div>
                ))}
              </div>
              <div className="space-y-2">
                {habits.map(habit => (
                  <div
                    key={habit.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1.2fr) repeat(12, minmax(44px, 1fr))',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <div className="truncate" style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{habit.icon || '🎯'}</span>
                      <span className="truncate">{habit.name}</span>
                    </div>
                    {Array.from({ length: 12 }, (_, monthIdx) => {
                      const monthDatesForRate = Array.from(
                        { length: getDaysInMonth(new Date(viewYear, monthIdx, 1)) },
                        (_, dayIdx) => normalizeDate(new Date(viewYear, monthIdx, dayIdx + 1)),
                      );
                      const { done, total } = getRangeCount(habit, monthDatesForRate);
                      const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                      const isFutureMonth = viewYear > currentYear || (viewYear === currentYear && monthIdx > currentMonth);
                      const bg = isFutureMonth
                        ? t.bgSub
                        : rate >= 70
                          ? t.accent
                          : rate >= 40
                            ? t.accentLight
                            : t.bgHover;
                      const fg = isFutureMonth ? t.textMuted : rate >= 70 ? '#fff' : t.textSub;
                      return (
                        <div
                          key={`${habit.id}-${monthIdx}`}
                          style={{
                            height: 30,
                            borderRadius: 8,
                            border: `1px solid ${isFutureMonth ? t.borderLight : t.border}`,
                            backgroundColor: bg,
                            color: fg,
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isFutureMonth ? 0.65 : 1,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {isFutureMonth ? '—' : `${rate}%`}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:hidden space-y-2.5">
            {habits.map(habit => (
              <div
                key={`${habit.id}-year-mobile`}
                className="rounded-lg p-2.5"
                style={{ border: `1px solid ${t.borderLight}`, backgroundColor: t.bgSub }}
              >
                <div className="truncate mb-2" style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{habit.icon || '🎯'}</span>
                  <span className="truncate">{habit.name}</span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 6,
                  }}
                >
                  {Array.from({ length: 12 }, (_, monthIdx) => {
                    const monthDatesForRate = Array.from(
                      { length: getDaysInMonth(new Date(viewYear, monthIdx, 1)) },
                      (_, dayIdx) => normalizeDate(new Date(viewYear, monthIdx, dayIdx + 1)),
                    );
                    const { done, total } = getRangeCount(habit, monthDatesForRate);
                    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                    const isFutureMonth = viewYear > currentYear || (viewYear === currentYear && monthIdx > currentMonth);
                    const bg = isFutureMonth
                      ? t.card
                      : rate >= 70
                        ? t.accent
                        : rate >= 40
                          ? t.accentLight
                          : t.bgHover;
                    const fg = isFutureMonth ? t.textMuted : rate >= 70 ? '#fff' : t.textSub;
                    return (
                      <div
                        key={`${habit.id}-m-${monthIdx}`}
                        style={{
                          height: 38,
                          borderRadius: 8,
                          border: `1px solid ${isFutureMonth ? t.borderLight : t.border}`,
                          backgroundColor: bg,
                          color: fg,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: isFutureMonth ? 0.7 : 1,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1.1,
                          gap: 3,
                        }}
                      >
                        <span style={{ fontSize: 9 }}>{YEAR_MONTH_LABELS[monthIdx]}</span>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                          {isFutureMonth ? '—' : `${rate}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : mode === 'week' ? (
        <>
          <div className="hidden lg:block">
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(140px, 1.2fr) repeat(7, minmax(44px, 1fr)) 64px',
                  gap: 10,
                  marginBottom: 6,
                  alignItems: 'center',
                }}
              >
                <div />
                {WEEK_LABELS.map(label => (
                  <div key={label} style={{ textAlign: 'center', fontSize: 11, color: t.textMuted }}>{label}</div>
                ))}
                <div />
              </div>
              <div className="space-y-2">
                {habits.map(habit => {
                  const stats = getRangeCount(habit, weekDates);
                  return (
                    <div
                      key={habit.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(140px, 1.2fr) repeat(7, minmax(44px, 1fr)) 64px',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      <div className="truncate" style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{habit.icon || '🎯'}</span>
                        <span className="truncate">{habit.name}</span>
                      </div>
                      {weekDates.map(date => renderEmojiCell(habit, date, { height: 40, emojiSize: 16, fill: true }))}
                      <div style={{ fontSize: 11, color: t.textSub, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {stats.done}/{stats.total}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '94px repeat(7, minmax(0, 1fr))',
                gap: 4,
                marginBottom: 6,
                alignItems: 'center',
              }}
            >
              <div />
              {WEEK_LABELS.map(label => (
                <div key={label} style={{ textAlign: 'center', fontSize: 10, color: t.textMuted }}>{label}</div>
              ))}
            </div>
            <div className="space-y-2">
              {habits.map(habit => {
                const stats = getRangeCount(habit, weekDates);
                return (
                  <div
                    key={`${habit.id}-m`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '94px repeat(7, minmax(0, 1fr))',
                      gap: 4,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>{habit.icon || '🎯'}</span>
                        <span className="truncate">{habit.name}</span>
                      </div>
                      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {stats.done}/{stats.total}
                      </div>
                    </div>
                    {weekDates.map(date => renderEmojiCell(habit, date, { height: 34, emojiSize: 14, fill: true }))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto pb-1">
            <div style={{ width: '100%' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `minmax(140px, 1.2fr) repeat(${daysInMonth}, minmax(18px, 1fr)) 64px`,
                  gap: 3,
                  marginBottom: 6,
                  alignItems: 'center',
                }}
              >
                <div />
                {monthDates.map(date => (
                  <div
                    key={toDateKey(date)}
                    style={{
                      textAlign: 'center',
                      fontSize: 10,
                      color: date.getTime() > todayDate.getTime() ? t.textMuted : t.textSub,
                      opacity: date.getTime() > todayDate.getTime() ? 0.45 : 1,
                      fontWeight: date.getTime() > todayDate.getTime() ? 500 : 700,
                    }}
                  >
                    {date.getDate()}
                  </div>
                ))}
                <div />
              </div>
              <div className="space-y-2">
                {habits.map(habit => {
                  const stats = getRangeCount(habit, monthDates);
                  return (
                    <div
                      key={habit.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `minmax(140px, 1.2fr) repeat(${daysInMonth}, minmax(18px, 1fr)) 64px`,
                        gap: 3,
                        alignItems: 'center',
                      }}
                    >
                      <div className="truncate" style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{habit.icon || '🎯'}</span>
                        <span className="truncate">{habit.name}</span>
                      </div>
                      {monthDates.map(date => renderEmojiCell(habit, date, { height: 20, emojiSize: 10, fill: true }))}
                      <div style={{ fontSize: 11, color: t.textSub, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {stats.done}/{stats.total}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 4,
                marginBottom: 8,
              }}
            >
              {WEEK_LABELS.map(label => (
                <div key={`month-mobile-h-${label}`} style={{ textAlign: 'center', fontSize: 10, color: t.textMuted }}>
                  {label}
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              {habits.map(habit => {
                const stats = getRangeCount(habit, monthDates);
                const monthStartOffset = (getDay(monthStart) + 6) % 7;
                const cells: (Date | null)[] = [
                  ...Array.from({ length: monthStartOffset }, () => null),
                  ...monthDates,
                ];
                return (
                  <div
                    key={`${habit.id}-month-mobile`}
                    className="rounded-lg p-2.5"
                    style={{ border: `1px solid ${t.borderLight}`, backgroundColor: t.bgSub }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="truncate" style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{habit.icon || '🎯'}</span>
                        <span className="truncate">{habit.name}</span>
                      </div>
                      <div style={{ fontSize: 10, color: t.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        {stats.done}/{stats.total}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        gap: 4,
                      }}
                    >
                      {cells.map((date, idx) =>
                        date ? (
                          <div key={`${habit.id}-${toDateKey(date)}`}>
                            {renderEmojiCell(habit, date, {
                              height: 20,
                              emojiSize: 10,
                              fill: true,
                              baseBg: t.card,
                              emptyBorder: t.border,
                              futureOpacity: 0.42,
                              futureBg: t.card,
                              futureBorder: t.border,
                            })}
                          </div>
                        ) : (
                          <div key={`${habit.id}-empty-${idx}`} style={{ height: 20 }} />
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3 mt-4" style={{ fontSize: 11, color: t.textMuted }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded" style={{ backgroundColor: t.accentLight, border: `1px solid ${t.accent}` }} />
          달성
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded" style={{ border: `1px solid ${t.borderLight}` }} />
          미달성
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, opacity: 0.55 }} />
          해당없음
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function HabitsView() {
  const { habits, routines, updateHabitMemo } = usePlanner();
  const { t } = useTheme();
  const { scheduleHabitAlerts, permission } = useNotification();
  const executionDate = getLogicalToday();
  const [tab, setTab] = useState<'habits' | 'stats' | 'routines'>('habits');

  // 알림 권한이 허용된 경우 오늘 습관 알림 스케줄링
  useEffect(() => {
    if (permission === 'granted') {
      scheduleHabitAlerts(habits, executionDate);
    }
  }, [habits, executionDate, permission, scheduleHabitAlerts]);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [runningRoutine, setRunningRoutine] = useState<Routine | null>(null);
  // memo inline editing per habit id
  const [memoEditing, setMemoEditing] = useState<Record<string, string>>({});

  // 전역 FAB — 루틴 탭이면 루틴 추가, 그 외(습관/통계)는 습관 추가
  useFabAction(tab === 'routines'
    ? { kind: 'action', label: '루틴 추가', icon: Plus, onPress: () => setShowAddRoutine(true) }
    : { kind: 'action', label: '습관 추가', icon: Plus, onPress: () => setShowAddHabit(true) });

  const todayDow = new Date().getDay();
  const isRoutineApplicableToday = (r: Routine) => {
    switch (r.repeat) {
      case 'weekday': return todayDow >= 1 && todayDow <= 5;
      case 'weekend': return todayDow === 0 || todayDow === 6;
      case 'custom': return r.repeatDays?.includes(todayDow) ?? false;
      default: return true; // 'daily' 또는 미설정
    }
  };
  const todayRoutines = routines.filter(isRoutineApplicableToday);
  const completedToday = todayRoutines.filter(r => r.checkedDates?.includes(routineToday)).length;

  const tabs = [
    { key: 'habits', label: '습관 실행' },
    { key: 'stats', label: '습관 트래커' },
    { key: 'routines', label: '루틴 설정' },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 lg:px-6 pt-6 pb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: t.fontPageTitle }}>습관 & 루틴</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>좋은 습관을 만들고, 루틴으로 하루를 설계하세요</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 lg:px-6 mb-4 overflow-x-auto pb-1">
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

      <div className="px-4 lg:px-6 pb-8">
        {/* Habits Tab */}
        {tab === 'habits' && (
          <div className="space-y-2">
            {habits.filter(h => isHabitApplicableOnDate(h, new Date())).map(h => {
              const streak = getStreak(h.checkedDates);
              const isChecked = h.checkedDates.includes(executionDate);
              const habitType = h.habitType ?? 'check';
              const memoVal = memoEditing[h.id] ?? h.dailyMemos?.[executionDate] ?? '';
              const showMemoRow = habitType === 'memo' && isChecked;

              return (
                <div key={h.id} className="rounded-xl transition-all"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <div className="flex items-center gap-3 p-4">
                    <HabitChip habit={h} date={executionDate} />

                    <span style={{ fontSize: 18 }}>{h.icon || '🎯'}</span>

                    <div className="flex-1 min-w-0">
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{h.name}</span>
                      {h.reason && (
                        <p
                          className="truncate"
                          style={{ fontSize: 11, color: t.textMuted, marginTop: 2, marginBottom: 1 }}
                        >
                          {h.reason}
                        </p>
                      )}
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
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ backgroundColor: t.accentLight }}>
                        <Flame size={12} color={t.accent} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.accent }}>{streak}일</span>
                      </div>
                    )}
                    <button onClick={() => setEditHabit(h)} className="p-2 rounded-lg" style={{ color: t.textMuted }}>
                      <Edit3 size={14} />
                    </button>
                  </div>

                  {showMemoRow && (
                    <div className="px-4 pb-3 flex items-center gap-2" style={{ borderTop: `1px solid ${t.borderLight}` }}>
                      <MessageSquare size={13} color={t.textMuted} style={{ flexShrink: 0, marginTop: 8 }} />
                      <input
                        value={memoVal}
                        onChange={e => setMemoEditing(prev => ({ ...prev, [h.id]: e.target.value }))}
                        onBlur={() => {
                            updateHabitMemo(h.id, executionDate, memoVal);
                          setMemoEditing(prev => { const n = { ...prev }; delete n[h.id]; return n; });
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                              updateHabitMemo(h.id, executionDate, memoVal);
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

        {/* Habit Tracker Tab */}
        {tab === 'stats' && <HabitTrackerView />}

        {/* Routines Tab */}
        {tab === 'routines' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text }}>루틴 목록</h3>
              <button
                onClick={() => setShowAddRoutine(true)}
                className="px-2.5 py-1.5 lg:px-3 rounded-lg flex items-center gap-1 lg:gap-1.5"
                style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accent, color: '#fff', whiteSpace: 'nowrap' }}
              >
                <Plus size={13} /> 루틴 추가
              </button>
            </div>

            {/* 오늘 진행률 */}
            {todayRoutines.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>오늘 진행률</span>
                  <span style={{ fontSize: 12, color: t.textMuted }}>
                    {completedToday}/{todayRoutines.length} · {Math.round((completedToday / todayRoutines.length) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(completedToday / todayRoutines.length) * 100}%`,
                      backgroundColor: completedToday === todayRoutines.length ? '#006b62' : t.accent,
                    }} />
                </div>
                {completedToday === todayRoutines.length && todayRoutines.length > 0 && (
                  <p className="mt-2 text-center" style={{ fontSize: 13, color: '#006b62', fontWeight: 600 }}>
                    🎉 오늘 모든 루틴 완료!
                  </p>
                )}
              </div>
            )}

            {/* 루틴 목록 */}
            <div className="space-y-3">
              {[...todayRoutines]
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
              {routines.length === 0 && (
                <div className="rounded-xl py-10 text-center" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <p style={{ fontSize: 13, color: t.textMuted }}>아직 루틴이 없습니다</p>
                  <button
                    onClick={() => setShowAddRoutine(true)}
                    className="mt-2 px-4 py-1.5 rounded-lg"
                    style={{ fontSize: 12, color: t.accent, backgroundColor: t.accentLight }}
                  >
                    + 루틴 추가
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      {(showAddHabit || editHabit) && <HabitModal habit={editHabit || undefined} onClose={() => { setEditHabit(null); setShowAddHabit(false); }} />}
      {(showAddRoutine || editRoutine) && <RoutineModal routine={editRoutine || undefined} onClose={() => { setEditRoutine(null); setShowAddRoutine(false); }} />}
      {runningRoutine && <ExecutionPanel routine={runningRoutine} onClose={() => setRunningRoutine(null)} />}
    </div>
  );
}
