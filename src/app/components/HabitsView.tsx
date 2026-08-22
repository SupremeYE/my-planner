import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Edit3, X, Flame, Check, ChevronLeft, ChevronRight,
  Timer, Hash, TrendingUp, MessageSquare, Minus,
} from 'lucide-react';
import { TimePicker } from './TimePicker';
import { usePlanner, Habit, Routine, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { format, startOfMonth, getDaysInMonth, getDay, addDays, startOfWeek, addMonths, subMonths } from 'date-fns';
import { RoutineModal, ExecutionPanel, RoutineCard, today as routineToday } from './RoutinesView';
import { useNotification } from '../hooks/useNotification';
import { useFabAction } from '../FabContext';
import { SegmentedControl } from './ui/SegmentedControl';
import { solidCardStyle, solidRowStyle, glassBarStyle, mixHex, hexToRgb, inputBg } from '../styles/haonStyles';
import { getHabitStreak, getWeeklyProgress, getRangeCount, isHabitApplicableOnDate, toDateKey, normalizeDate } from '../lib/habitUtils';

// ─── 습관 색상 팔레트 (Theme H 파스텔) ───────────────────────────────────────
// 기존 팔레트(진남색·주황·초록·하늘·보라·회색)는 채도 높은 원색이라 Theme H 통일감을 깨뜨렸다.
// DESIGN.md Haon 파스텔 + --cat 세이지로 교체. (lavender-mist #F4E7FB 는 lint:colors R2 밴이라 제외.)
const HABIT_COLORS = ['#C3C7F4', '#F6BCBA', '#CFE3CE', '#C8A8E9', '#E3AADD', '#F2DDDC'];
// 기존 습관에 저장된 구 팔레트 hex → 신 파스텔 매핑(색상별 1:1, 유사 색조). 스토어 값은 건드리지 않고
// 표시/피커 소비 시점에 정규화한다(= 렌더 리맵 + 편집 시 지연 마이그레이션). 목록 외 커스텀 hex 는 그대로 존중.
const LEGACY_HABIT_COLOR_MAP: Record<string, string> = {
  '#515f74': '#C3C7F4', // 진남색 → 페리윙클
  '#D4735A': '#F6BCBA', // 주황(테라코타) → 소프트 코랄
  '#006b62': '#CFE3CE', // 초록(틸) → 세이지
  '#7B9ED9': '#C8A8E9', // 하늘 → 라일락
  '#A07BE0': '#E3AADD', // 보라 → 오키드 핑크
  '#6B7280': '#F2DDDC', // 회색 → 웜 크림
};
function normalizeHabitColor(c?: string): string | undefined {
  if (!c) return c;
  return LEGACY_HABIT_COLOR_MAP[c] ?? LEGACY_HABIT_COLOR_MAP[c.toUpperCase()] ?? LEGACY_HABIT_COLOR_MAP[c.toLowerCase()] ?? c;
}
// 채움 위 가독 텍스트: 밝은 파스텔이면 딥 인디고, 채도 높은/어두운 채움이면 흰색(§5 "붉은 위 붉은" 회피).
function onFill(bg: string | undefined, deepText: string): string {
  const rgb = bg ? hexToRgb(bg) : null;
  if (!rgb) return '#fff';
  const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return lum > 160 ? deepText : '#fff';
}

const REPEAT_OPTIONS = [
  { value: 'daily', label: '매일' },
  { value: 'weekday', label: '평일' },
  { value: 'weekend', label: '주말' },
  { value: 'weekly', label: '매주 N회' },
  { value: 'custom', label: '직접 선택' },
];
// 카테고리 도트 색 프리셋도 Haon 파스텔/‑‑cat 계열로 통일(피커 선택 텍스트는 onFill 로 대비 확보).
const CATEGORY_COLOR_PRESETS = ['#C3C7F4', '#F6BCBA', '#CFE3CE', '#C8A8E9', '#E3AADD', '#F2DDDC', '#9E6FD6', '#7B82E3', '#C56FB8', '#6BAA7A'];
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

// 습관 계산 유틸(getHabitStreak·getWeeklyProgress·getRangeCount·isHabitApplicableOnDate·
// toDateKey·normalizeDate)은 src/app/lib/habitUtils.ts 로 분리됨(4개 뷰 공용). 아래 import 참조.

// ─── Habit Add/Edit Modal ──────────────────────────────────────────────────────
function HabitModal({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { addHabitFull, updateHabit, deleteHabit, habitMonthlyMemos, setHabitMonthlyMemo, habits } = usePlanner();
  const { t } = useTheme();
  const [name, setName] = useState(habit?.name || '');
  const [icon, setIcon] = useState(habit?.icon || '🎯');
  const [repeat, setRepeat] = useState<Habit['repeat']>(habit?.repeat || 'daily');
  const [repeatDays, setRepeatDays] = useState<number[]>(habit?.repeatDays || [1, 2, 3, 4, 5]);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(habit?.weeklyTarget || 3);
  const [goalText, setGoalText] = useState(habit?.goalText || '');
  const [alarmTime, setAlarmTime] = useState(habit?.alarmTime || '');
  const [category, setCategory] = useState<string>(habit?.category || '');
  const [color, setColor] = useState(normalizeHabitColor(habit?.color) || HABIT_COLORS[0]);
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
      weeklyTarget: repeat === 'weekly' ? Math.max(1, Math.min(7, weeklyTarget)) : undefined,
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
      <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>반복 설정</label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {REPEAT_OPTIONS.map(opt => {
          const on = repeat === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setRepeat(opt.value as Habit['repeat'])}
              className="px-3 py-1.5 rounded-full transition-all"
              style={{
                fontSize: 12,
                fontFamily: t.fontLabel,
                backgroundColor: on ? t.lavenderTint : t.card,
                color: on ? t.text : t.textMuted,
                border: `1px solid ${t.border}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {repeat === 'custom' && (
        <div className="flex gap-1.5 mt-2">
          {DAY_LABELS.map((d, i) => {
            const on = repeatDays.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  fontSize: 11,
                  fontFamily: t.fontLabel,
                  backgroundColor: on ? t.lavenderTint : t.card,
                  color: on ? t.text : t.textMuted,
                  border: `1px solid ${t.border}`,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}
      {repeat === 'weekly' && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: t.textSub }}>매주</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeeklyTarget(prev => Math.max(1, prev - 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: t.surfaceMuted, color: t.textMuted, border: `1px solid ${t.border}` }}
              >
                <Minus size={12} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text, width: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontFamily: t.fontNumeric }}>
                {weeklyTarget}
              </span>
              <button
                onClick={() => setWeeklyTarget(prev => Math.min(7, prev + 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: t.accent, color: '#fff' }}
              >
                <Plus size={12} />
              </button>
            </div>
            <span style={{ fontSize: 12, color: t.textSub }}>회</span>
          </div>
          <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
            요일 상관없이 이번 주에 {weeklyTarget}번만 채우면 달성이에요.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(46,42,91,0.32)' }}>
      <div
        className="rounded-2xl w-[560px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: t.glassBlur,
          WebkitBackdropFilter: t.glassBlur,
          border: t.glassBorder ?? `1px solid ${t.border}`,
          boxShadow: '0 20px 48px rgba(120,90,160,0.24)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: t.borderLight }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: t.fontSection }}>{habit ? '습관 편집' : '습관 추가'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 lg:px-5 py-4 space-y-5">
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>습관 이름</label>
            <div className="mt-1 flex gap-2">
              <input
                value={icon}
                onChange={e => setIcon(Array.from(e.target.value).slice(0, 1).join(''))}
                placeholder="🎯"
                className="w-[62px] rounded-lg px-2 py-2 border outline-none text-center"
                style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 22 }}
              />
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 물 마시기"
                className="flex-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody }}
              />
            </div>
            <p style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>아이콘 칸에서 `Win + .` 로 이모지를 입력할 수 있어요.</p>
          </div>

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>목표 유형</label>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              {HABIT_TYPES.map(ht => {
                const on = habitType === ht.value;
                return (
                <button key={ht.value} onClick={() => setHabitType(ht.value)}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all"
                  style={{
                    fontSize: 10, fontWeight: on ? 600 : 500, fontFamily: t.fontLabel,
                    backgroundColor: on ? t.lavenderTint : t.card,
                    color: on ? t.text : t.textMuted,
                    border: `1px solid ${t.border}`,
                  }}>
                  <span style={{ fontSize: 13 }}>{ht.label.split(' ')[0]}</span>
                  <span>{ht.label.split(' ')[1]}</span>
                </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
              {HABIT_TYPES.find(h => h.value === habitType)?.desc}
            </p>
          </div>

          {habitType === 'count' || habitType === 'time' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[110px_1fr] gap-4">
              <div>
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>
                  {habitType === 'count' ? '목표 횟수' : '목표 시간'}
                </label>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    min={1}
                    value={targetValue}
                    onChange={e => setTargetValue(e.target.value)}
                    className="w-20 rounded-lg px-2.5 py-2 border outline-none"
                    style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody }}
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
                  <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>목표 수치</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="number" min={0} value={targetValue} onChange={e => setTargetValue(e.target.value)}
                      placeholder="예: 10000"
                      className="w-28 rounded-lg px-3 py-2 border outline-none"
                      style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody }} />
                    <input value={valueUnit} onChange={e => setValueUnit(e.target.value)}
                      placeholder="단위 (km, L…)"
                      className="flex-1 rounded-lg px-3 py-2 border outline-none"
                      style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody }} />
                  </div>
                </div>
              )}
              {habitType === 'check' && (
                <div>
                  <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>목표 메모 (선택)</label>
                  <input value={goalText} onChange={e => setGoalText(e.target.value)} placeholder="예: 30분, 2L"
                    className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                    style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody }} />
                </div>
              )}
              {repeatUI}
            </>
          )}

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>알림 시간</label>
            <div className="mt-1">
              <TimePicker value={alarmTime} onChange={setAlarmTime} placeholder="알림 없음" minuteStep={1} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>카테고리</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {categoryOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setCategory(option.name)}
                    className="px-2.5 py-1 rounded-full flex items-center gap-1.5"
                    style={{
                      fontSize: 11,
                      fontFamily: t.fontLabel,
                      backgroundColor: category === option.name ? option.color : t.card,
                      color: category === option.name ? onFill(option.color, t.text) : t.textMuted,
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
                <div className="mt-2 p-3 rounded-xl space-y-2" style={{ backgroundColor: t.surfaceMuted, border: `1px solid ${t.border}` }}>
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
                    placeholder="#C3C7F4"
                    className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
                    style={{
                      borderColor: isValidHex(normalizeHex(newCategoryColor)) ? t.border : t.danger,
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
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>습관 색상</label>
              <div className="flex gap-2 mt-1.5">
                {HABIT_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full transition-transform"
                    style={{ backgroundColor: c, outline: color === c ? `2px solid ${t.accent}` : 'none', outlineOffset: 2, transform: color === c ? 'scale(1.15)' : 'scale(1)' }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>
              이 습관을 하려는 이유 <span style={{ color: t.textMuted, fontWeight: 400 }}>(선택)</span>
            </label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 물을 꾸준히 마셔서 컨디션 유지"
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody }} />
          </div>

          {habit && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, fontFamily: t.fontLabel }}>
                이번달 메모
                <span className="ml-1 font-normal" style={{ color: t.textMuted }}>({new Date().getMonth() + 1}월)</span>
              </label>
              <input value={monthlyMemo} onChange={e => setMonthlyMemo(e.target.value)} placeholder="이번달 달성 목표나 특이사항"
                className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody }} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t" style={{ borderColor: t.borderLight }}>
          {habit && (
            <button onClick={() => { deleteHabit(habit.id); onClose(); }} className="px-4 py-2 rounded-xl"
              style={{ fontSize: 12, fontFamily: t.fontLabel, color: t.danger, backgroundColor: t.dangerLight }}>삭제</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-xl" style={{ fontSize: 13, fontFamily: t.fontLabel, color: t.textSub, backgroundColor: t.surfaceMuted }}>취소</button>
          <button onClick={handleSubmit} className="px-5 py-2 rounded-xl" style={{ fontSize: 13, fontWeight: 600, fontFamily: t.fontLabel, backgroundColor: t.accent, color: '#fff' }}>저장</button>
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

  const accentColor = normalizeHabitColor(habit.color) || t.accent;
  const onAcc = onFill(accentColor, t.text);
  const warnFg = mixHex(t.warning, 0, 0.42);

  // ── check type ──
  if (habitType === 'check') {
    return (
      <button onClick={() => toggleHabit(habit.id, date)}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
        style={{ backgroundColor: isChecked ? accentColor : t.surfaceMuted, border: isChecked ? 'none' : `2px solid ${t.border}` }}>
        {isChecked && <Check size={14} color={onAcc} strokeWidth={3} />}
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
          style={{ backgroundColor: t.surfaceMuted, color: t.textMuted }}>
          <Minus size={10} />
        </button>
        <button onClick={() => handleCountTap(1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl min-w-[56px] justify-center"
          style={{ backgroundColor: done ? accentColor : t.card, border: `1px solid ${done ? accentColor : t.border}` }}>
          <Hash size={11} color={done ? onAcc : t.textMuted} />
          <span style={{ fontSize: 12, fontWeight: 700, color: done ? onAcc : t.text, fontVariantNumeric: 'tabular-nums', fontFamily: t.fontNumeric }}>
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
          backgroundColor: timerRunning ? t.warningLight : done ? accentColor : t.card,
          border: `1px solid ${timerRunning ? t.warning : done ? accentColor : t.border}`,
        }}>
        <Timer size={12} color={timerRunning ? warnFg : done ? onAcc : t.textMuted}
          style={{ animation: timerRunning ? 'spin 2s linear infinite' : 'none' }} />
        <span style={{
          fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: t.fontNumeric,
          color: timerRunning ? warnFg : done ? onAcc : t.text,
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
            style={{ fontSize: 12, borderColor: t.accent, backgroundColor: inputBg(t), color: t.text, fontFamily: t.fontNumeric }}
          />
          <span style={{ fontSize: 11, color: t.textMuted }}>{unit}</span>
        </div>
      );
    }
    return (
      <button onClick={() => setEditingValue(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl flex-shrink-0"
        style={{ backgroundColor: done ? accentColor : t.card, border: `1px solid ${done ? accentColor : t.border}` }}>
        <TrendingUp size={11} color={done ? onAcc : t.textMuted} />
        <span style={{ fontSize: 12, fontWeight: 700, color: done ? onAcc : t.text, fontFamily: t.fontNumeric }}>
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
          style={{ backgroundColor: isChecked ? accentColor : t.surfaceMuted, border: isChecked ? 'none' : `2px solid ${t.border}` }}>
          {isChecked ? <Check size={14} color={onAcc} strokeWidth={3} /> : <MessageSquare size={13} color={t.textMuted} />}
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

  // 반복 라벨(주기) — 실행 목록과 동일 문구.
  const repeatLabel = (habit: Habit) =>
    habit.repeat === 'daily' ? '매일'
      : habit.repeat === 'weekday' ? '평일'
      : habit.repeat === 'weekend' ? '주말'
      : habit.repeat === 'weekly' ? `매주 ${habit.weeklyTarget ?? 1}회`
      : '커스텀';

  // 달성 셀 상태 판정 — 계산 규칙은 기존과 동일(checked/applicable/isFuture/weeklyNeutral), 표현만 교체.
  // (매주 N회 습관은 요일 고정이 아니므로 비체크일을 '미달성'이 아니라 '해당없음(중립)'으로 본다.)
  const cellState = (habit: Habit, date: Date): 'done' | 'miss' | 'na' => {
    const checked = habit.checkedDates.includes(toDateKey(date));
    const applicable = isHabitApplicableOnDate(habit, date);
    const isFuture = date.getTime() > todayDate.getTime();
    const weeklyNeutral = habit.repeat === 'weekly' && !checked && !isFuture;
    if (isFuture || !applicable || weeklyNeutral) return 'na';
    return checked ? 'done' : 'miss';
  };

  // 달성 셀 (DESIGN.md §5 "습관 트래커 — 달성 표시"): 코랄 단일 톤·농담 단계 없음·범례 없음.
  //   달성 = t.accent 채움(테두리 없음) / 미달성 = t.card + t.border 헤어라인 / 해당없음 = 뮤트 축소 점(면 안 채움).
  const AchvCell = ({ habit, date, radius = 3 }: { habit: Habit; date: Date; radius?: number }) => {
    const st = cellState(habit, date);
    const base: React.CSSProperties = { width: '100%', aspectRatio: '1 / 1', borderRadius: radius };
    if (st === 'done') return <div style={{ ...base, backgroundColor: t.accent }} />;
    if (st === 'miss') return <div style={{ ...base, backgroundColor: t.card, border: `1px solid ${t.border}` }} />;
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: '30%', height: '30%', borderRadius: '50%', backgroundColor: t.textMuted, opacity: 0.5 }} />
      </div>
    );
  };

  // 스트릭 배지 — 코랄 텍스트, 배경 채움 없음. count 0 이면 렌더하지 않는다. unit 에 따라 N일/N주.
  const StreakBadge = ({ habit }: { habit: Habit }) => {
    const s = getHabitStreak(habit);
    if (s.count === 0) return null;
    return (
      <span className="inline-flex items-center gap-0.5" style={{ fontSize: 11, fontWeight: 700, color: t.accent, fontFamily: t.fontLabel }}>
        <Flame size={11} color={t.accent} />
        <span style={{ fontFamily: t.fontNumeric }}>{s.count}</span>{s.unit === 'week' ? '주' : '일'}
      </span>
    );
  };

  // 달성 합계 (done/total) — fontNumeric, tabular-nums.
  const TotalCount = ({ done, total }: { done: number; total: number }) => (
    <span style={{ fontSize: 12, color: t.textSub, fontFamily: t.fontNumeric, fontVariantNumeric: 'tabular-nums' }}>
      {done}/{total}
    </span>
  );

  return (
    <div className="p-3 lg:p-5" style={solidCardStyle(t)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={movePrev} className="p-1.5 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: t.fontSection }}>{rangeLabel}</span>
        <button onClick={moveNext} className="p-1.5 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted }}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="mb-4">
        <SegmentedControl
          options={TRACKER_TABS.map(tab => ({ value: tab.key, label: tab.label }))}
          value={mode}
          onChange={v => setMode(v as TrackerMode)}
          maxWidth={320}
        />
      </div>

      {habits.length === 0 ? (
        <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '22px 0' }}>
          습관을 추가하면 트래커가 표시됩니다
        </p>
      ) : mode === 'week' ? (
        /* ── A안: 주간 리스트 (DESIGN.md §5) — 한 행 = 습관 하나, 이름이 가장 큰 활자 ── */
        <div>
          {/* 요일 헤더 (상단 1회) — 오늘 요일만 코랄 강조 */}
          <div
            className="hidden lg:grid"
            style={{ gridTemplateColumns: 'minmax(150px, 1.4fr) minmax(84px, auto) repeat(7, minmax(36px, 1fr))', gap: 10, marginBottom: 8, alignItems: 'center' }}
          >
            <div />
            <div />
            {weekDates.map((date, i) => {
              const isToday = date.getTime() === todayDate.getTime();
              return (
                <div key={`wh-${i}`} style={{ textAlign: 'center', fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? t.accent : t.textMuted }}>
                  {WEEK_LABELS[i]}
                </div>
              );
            })}
          </div>
          <div className="grid lg:hidden" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
            {weekDates.map((date, i) => {
              const isToday = date.getTime() === todayDate.getTime();
              return (
                <div key={`whm-${i}`} style={{ textAlign: 'center', fontSize: 10, fontWeight: isToday ? 700 : 500, color: isToday ? t.accent : t.textMuted }}>
                  {WEEK_LABELS[i]}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {habits.map(habit => {
              const stats = getRangeCount(habit, weekDates, todayDate);
              return (
                <div key={habit.id} style={solidRowStyle(t)} className="px-3 py-2.5 lg:px-4 lg:py-3">
                  {/* PC: 1행 유지 (이름 줄 + 셀 줄 동일 행) */}
                  <div
                    className="hidden lg:grid"
                    style={{ gridTemplateColumns: 'minmax(150px, 1.4fr) minmax(84px, auto) repeat(7, minmax(36px, 1fr))', gap: 10, alignItems: 'center' }}
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span style={{ fontSize: 18, flexShrink: 0, alignSelf: 'center' }}>{habit.icon || '🎯'}</span>
                      <span className="truncate" style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: t.fontBody }}>{habit.name}</span>
                      <span style={{ fontSize: 11, color: t.textMuted, fontFamily: t.fontLabel, flexShrink: 0 }}>{repeatLabel(habit)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2" style={{ flexShrink: 0 }}>
                      <StreakBadge habit={habit} />
                      <TotalCount done={stats.done} total={stats.total} />
                    </div>
                    {weekDates.map((date, i) => <div key={`wc-${i}`}><AchvCell habit={habit} date={date} radius={5} /></div>)}
                  </div>

                  {/* 모바일: 2행으로 접음 (이름 줄 / 셀 줄) */}
                  <div className="lg:hidden">
                    <div className="flex items-center gap-2 min-w-0 mb-2">
                      <span style={{ fontSize: 17, flexShrink: 0 }}>{habit.icon || '🎯'}</span>
                      <span className="truncate" style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: t.fontBody }}>{habit.name}</span>
                      <span style={{ fontSize: 11, color: t.textMuted, fontFamily: t.fontLabel, flexShrink: 0 }}>{repeatLabel(habit)}</span>
                      <span className="flex items-center gap-2 ml-auto" style={{ flexShrink: 0 }}>
                        <StreakBadge habit={habit} />
                        <TotalCount done={stats.done} total={stats.total} />
                      </span>
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                      {weekDates.map((date, i) => <div key={`wcm-${i}`}><AchvCell habit={habit} date={date} radius={5} /></div>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── B안: 습관 카드 + 미니 히트맵 (이번 달 / 올해, DESIGN.md §5) ── */
        (() => {
          const isYear = mode === 'year';
          const periodLabel = isYear ? `${viewYear}년` : format(viewDate, 'yyyy년 M월');
          const monthStartOffset = (getDay(monthStart) + 6) % 7;
          const monthCells: (Date | null)[] = [...Array.from({ length: monthStartOffset }, () => null), ...monthDates];
          const yearDates = isYear
            ? Array.from({ length: 12 }).flatMap((_, m) =>
                Array.from({ length: getDaysInMonth(new Date(viewYear, m, 1)) }, (_, d) => normalizeDate(new Date(viewYear, m, d + 1))))
            : [];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {habits.map(habit => {
                const stats = getRangeCount(habit, isYear ? yearDates : monthDates, todayDate);
                return (
                  <div key={habit.id} style={solidCardStyle(t)} className="p-3 lg:p-4">
                    <div className="flex items-center gap-2 mb-0.5 min-w-0">
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{habit.icon || '🎯'}</span>
                      <span className="truncate" style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: t.fontBody }}>{habit.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, fontFamily: t.fontLabel, marginBottom: 10 }}>
                      {repeatLabel(habit)} · {periodLabel}
                    </div>

                    {isYear ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {Array.from({ length: 12 }, (_, m) => {
                          const dim = getDaysInMonth(new Date(viewYear, m, 1));
                          return (
                            <div key={m} style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 9, color: t.textMuted, textAlign: 'right', fontFamily: t.fontLabel }}>{YEAR_MONTH_LABELS[m]}</span>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(31, 1fr)', gap: 1 }}>
                                {Array.from({ length: 31 }, (_, dayIdx) =>
                                  dayIdx < dim
                                    ? <AchvCell key={dayIdx} habit={habit} date={normalizeDate(new Date(viewYear, m, dayIdx + 1))} radius={1.5} />
                                    : <div key={dayIdx} />)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
                        {monthCells.map((date, idx) =>
                          date
                            ? <AchvCell key={idx} habit={habit} date={date} radius={3} />
                            : <div key={idx} style={{ aspectRatio: '1 / 1' }} />)}
                      </div>
                    )}

                    <div className="flex items-center justify-between" style={{ marginTop: 12, minHeight: 18 }}>
                      <StreakBadge habit={habit} />
                      <TotalCount done={stats.done} total={stats.total} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
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

      {/* Tabs — 공통 세그먼트 컨트롤 (§5, 할일·캘린더 뷰토글과 동일 패턴 재사용) */}
      <div className="px-4 lg:px-6 mb-4">
        <SegmentedControl
          options={tabs.map(tb => ({ value: tb.key, label: tb.label }))}
          value={tab}
          onChange={v => setTab(v as typeof tab)}
          maxWidth={420}
        />
      </div>

      <div className="px-4 lg:px-6 pb-8">
        {/* Habits Tab */}
        {tab === 'habits' && (
          <div className="space-y-2">
            {habits.filter(h => isHabitApplicableOnDate(h, new Date())).map(h => {
              const streak = getHabitStreak(h);
              const weekly = h.repeat === 'weekly' ? getWeeklyProgress(h, executionDate) : null;
              const isChecked = h.checkedDates.includes(executionDate);
              const habitType = h.habitType ?? 'check';
              const memoVal = memoEditing[h.id] ?? h.dailyMemos?.[executionDate] ?? '';
              const showMemoRow = habitType === 'memo' && isChecked;

              return (
                <div key={h.id} className="transition-all" style={solidRowStyle(t)}>
                  <div className="flex items-center gap-3 p-4">
                    {/* 좌측 컨트롤 고정 폭 — 체크형(원)·횟수형([−][# N/M]) 폭 차이로 제목 x가 어긋나던 것 통일 */}
                    <div style={{ width: 88, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                      <HabitChip habit={h} date={executionDate} />
                    </div>

                    <span style={{ fontSize: 18 }}>{h.icon || '🎯'}</span>

                    <div className="flex-1 min-w-0">
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: t.fontBody }}>{h.name}</span>
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
                          {h.repeat === 'daily' ? '매일'
                            : h.repeat === 'weekday' ? '평일'
                            : h.repeat === 'weekend' ? '주말'
                            : h.repeat === 'weekly' ? `매주 ${h.weeklyTarget ?? 1}회`
                            : '커스텀'}
                        </span>
                        {habitType !== 'check' && (() => {
                          const hue = normalizeHabitColor(h.color) || t.accent;
                          return (
                            <span className="px-1.5 py-0.5 rounded-full"
                              style={{ fontSize: 10, fontFamily: t.fontLabel, backgroundColor: mixHex(hue, 255, 0.80), color: mixHex(hue, 0, 0.40) }}>
                              {HABIT_TYPES.find(ht => ht.value === habitType)?.label}
                            </span>
                          );
                        })()}
                        {h.goalText && habitType === 'check' && (
                          <span style={{ fontSize: 11, color: t.textSub }}>{h.goalText}</span>
                        )}
                      </div>
                    </div>

                    {weekly ? (
                      (() => {
                        const achieved = weekly.done >= weekly.target;
                        const okBg = mixHex(t.success, 255, 0.80);
                        const okFg = mixHex(t.success, 0, 0.42);
                        return (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0"
                            style={{ backgroundColor: achieved ? okBg : t.accentLight }}>
                            {achieved
                              ? <Check size={12} color={okFg} strokeWidth={3} />
                              : <Flame size={12} color={t.accent} />}
                            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: t.fontLabel, color: achieved ? okFg : t.accent }}>
                              이번 주 <span style={{ fontFamily: t.fontNumeric }}>{weekly.done}/{weekly.target}</span>
                            </span>
                          </div>
                        );
                      })()
                    ) : streak.count > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: t.accentLight }}>
                        <Flame size={12} color={t.accent} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.accent, fontFamily: t.fontLabel }}><span style={{ fontFamily: t.fontNumeric }}>{streak.count}</span>{streak.unit === 'week' ? '주' : '일'}</span>
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
                        style={{ fontSize: 12, borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontFamily: t.fontBody }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => setShowAddHabit(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
              style={{ border: `2px dashed ${t.border}`, color: t.accent, fontSize: 13, fontWeight: 600, fontFamily: t.fontLabel }}>
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
              <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: t.fontSection }}>루틴 목록</h3>
              <button
                onClick={() => setShowAddRoutine(true)}
                className="px-2.5 py-1.5 lg:px-3 rounded-lg flex items-center gap-1 lg:gap-1.5"
                style={{ fontSize: 11, fontWeight: 600, fontFamily: t.fontLabel, backgroundColor: t.accent, color: '#fff', whiteSpace: 'nowrap' }}
              >
                <Plus size={13} /> 루틴 추가
              </button>
            </div>

            {/* 오늘 진행률 */}
            {todayRoutines.length > 0 && (
              <div className="p-4" style={solidCardStyle(t)}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub, fontFamily: t.fontLabel }}>오늘 진행률</span>
                  <span style={{ fontSize: 12, color: t.textMuted, fontFamily: t.fontNumeric }}>
                    {completedToday}/{todayRoutines.length} · {Math.round((completedToday / todayRoutines.length) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.surfaceMuted }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(completedToday / todayRoutines.length) * 100}%`,
                      backgroundColor: completedToday === todayRoutines.length ? t.success : t.accent,
                    }} />
                </div>
                {completedToday === todayRoutines.length && todayRoutines.length > 0 && (
                  <p className="mt-2 text-center" style={{ fontSize: 13, color: mixHex(t.success, 0, 0.30), fontWeight: 600 }}>
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
                <div className="py-10 text-center" style={solidCardStyle(t)}>
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
