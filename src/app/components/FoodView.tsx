import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  format, startOfMonth, getDaysInMonth, getDay,
  addMonths, subMonths, isToday, isSameDay,
  subDays,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, ChevronDown, X, Camera, Image as ImageIcon,
  Mic, MicOff, Trash2, Pencil, Plus,
} from 'lucide-react';
import { MEAL_ICONS, MEAL_LABELS, DINING_ICONS, DINING_LABELS, FASTING_ICON, FASTING_LABEL } from '../../constants/foodIcons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { usePlanner, FoodRecord, MealType, DiningType, TasteRating, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { useFabAction } from '../FabContext';
import { db } from '../../lib/db';
import { useVoiceInput } from '../hooks/useVoiceInput';
import ConfirmModal from './ConfirmModal';

// ─── 상수 ───────────────────────────────────────────────────────────
const MEALS: { key: MealType; label: string; emoji: string; time: string }[] = [
  { key: 'breakfast', label: MEAL_LABELS.breakfast, emoji: MEAL_ICONS.breakfast, time: '08:00' },
  { key: 'lunch',     label: MEAL_LABELS.lunch,     emoji: MEAL_ICONS.lunch,     time: '12:00' },
  { key: 'dinner',    label: MEAL_LABELS.dinner,    emoji: MEAL_ICONS.dinner,    time: '18:00' },
  { key: 'snack',     label: MEAL_LABELS.snack,     emoji: MEAL_ICONS.snack,     time: '' },
];

const DINING_TYPES: { key: DiningType; label: string; emoji: string }[] = [
  { key: 'home',       label: DINING_LABELS.home,       emoji: DINING_ICONS.home },
  { key: 'delivery',   label: DINING_LABELS.delivery,   emoji: DINING_ICONS.delivery },
  { key: 'restaurant', label: DINING_LABELS.restaurant, emoji: DINING_ICONS.restaurant },
  { key: 'coffee',     label: DINING_LABELS.coffee,     emoji: DINING_ICONS.coffee },
];

const TASTE_OPTIONS: { key: TasteRating; label: string; emoji: string }[] = [
  { key: 'good',   label: '맛있었어', emoji: '😋' },
  { key: 'normal', label: '보통',     emoji: '😐' },
  { key: 'bad',    label: '별로',     emoji: '😑' },
];

const DONUT_COLORS = ['#6BAA7A', '#D4735A', '#C4A882'];

// 통계 탭 목표 대비 dot 색상
const DINING_DOT_COLOR: Record<DiningType, string> = {
  home: '#4A82CC',
  delivery: '#D4735A',
  restaurant: '#6BAA7A',
  coffee: '#C4A882',
};

// ─── 타입 ───────────────────────────────────────────────────────────
type AddStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type FormState = {
  mealType: MealType;
  photoUrl: string | null;
  photoFile: File | null;
  foodName: string;
  diningType: DiningType | null;
  amount: string;
  calories: string;
  tasteRating: TasteRating | null;
  tasteMemo: string;
  isFasting: boolean;
};

const initForm = (meal: MealType = 'breakfast'): FormState => ({
  mealType: meal,
  isFasting: false,
  photoUrl: null,
  photoFile: null,
  foodName: '',
  diningType: null,
  amount: '',
  calories: '',
  tasteRating: null,
  tasteMemo: '',
});

// ─── 음성 입력 버튼 ─────────────────────────────────────────────────
function VoiceInputButton({ onResult }: { onResult: (text: string) => void }) {
  const { status, startRecording, stopRecording, text, setText } = useVoiceInput();
  const isRec = status === 'recording';
  const isBusy = status === 'transcribing';

  useEffect(() => {
    if (text) {
      onResult(text);
      setText('');
    }
  }, [text, onResult, setText]);

  const toggle = async () => {
    if (isBusy) return;
    if (isRec) await stopRecording();
    else await startRecording();
  };

  return (
    <button type="button" onClick={toggle} disabled={isBusy}
      className="p-2 rounded-full transition-colors"
      style={{ backgroundColor: isRec ? '#D4735A20' : 'transparent' }}
    >
      {isRec ? <MicOff size={16} color="#D4735A" /> : <Mic size={16} color="#C4A882" />}
    </button>
  );
}

// ─── AI 칼로리 추정 훅 ────────────────────────────────────────────────
function useCalorieEstimate() {
  const [loading, setLoading] = useState(false);
  const [estimated, setEstimated] = useState<number | null>(null);

  const estimate = useCallback(async (input: string) => {
    if (!input.trim()) return;
    setLoading(true);
    setEstimated(null);
    try {
      const res = await fetch(`/api/food-calorie?input=${encodeURIComponent(input)}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.calories === 'number') setEstimated(data.calories);
      }
    } catch {
      // 실패 시 조용히 처리
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setEstimated(null);
    setLoading(false);
  }, []);

  return { estimate, loading, estimated, setEstimated, reset };
}

// ─── 기록 카드 ──────────────────────────────────────────────────────
function FoodCard({
  record,
  onEdit,
  onDelete,
}: {
  record: FoodRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTheme();
  const taste = TASTE_OPTIONS.find(o => o.key === record.tasteRating);
  const dining = DINING_TYPES.find(d => d.key === record.diningType);

  const meal = MEALS.find(m => m.key === record.mealType);

  // 단식 레코드: 칼로리·금액·맛·식사유형 없이 간결하게 표기
  if (record.isFasting) {
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
        style={{ backgroundColor: t.bgSub, border: `1px dashed ${t.border}` }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
          style={{ backgroundColor: t.card }}>
          {FASTING_ICON}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 14, fontWeight: 600, color: t.textSub }}>{FASTING_LABEL}</span>
            {meal && (
              <span style={{ fontSize: 11, color: t.textMuted }}>{meal.emoji} {meal.label}</span>
            )}
          </div>
          <span style={{ fontSize: 11, color: t.textMuted }}>이 끼니를 걸렀어요</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onDelete} className="p-1.5 rounded-lg"
            style={{ backgroundColor: t.card }}>
            <Trash2 size={13} color="#D4735A" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      {/* 사진: 원형 썸네일 */}
      {record.photoUrl ? (
        <img src={record.photoUrl} alt={record.foodName}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
          style={{ backgroundColor: t.bgSub }}>
          {meal?.emoji ?? '🍽️'}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{record.foodName}</span>
          {taste && (
            <span className="flex items-center gap-1">
              <span style={{ fontSize: 12 }}>{taste.emoji}</span>
              {record.tasteMemo && (
                <span style={{ fontSize: 11, color: t.textSub }}>{record.tasteMemo}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {/* 식사 유형 아이콘 항상 표시 */}
          <span style={{ fontSize: 11, color: t.textMuted }}>
            {dining ? `${dining.emoji} ${dining.label}` : '🍽️ 미선택'}
          </span>
          {record.calories != null && (
            <span style={{ fontSize: 11, color: t.accent }}>{record.calories} kcal</span>
          )}
          {record.amount > 0 && (
            <span style={{ fontSize: 11, color: t.textSub }}>{record.amount.toLocaleString()}원</span>
          )}
        </div>
      </div>

      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg"
          style={{ backgroundColor: t.bgSub }}>
          <Pencil size={13} color={t.textSub} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg"
          style={{ backgroundColor: t.bgSub }}>
          <Trash2 size={13} color="#D4735A" />
        </button>
      </div>
    </div>
  );
}

// ─── 식사 섹션 ──────────────────────────────────────────────────────
function MealSection({
  meal,
  records,
  onAdd,
  onEdit,
  onDelete,
}: {
  meal: typeof MEALS[number];
  records: FoodRecord[];
  onAdd: (meal: MealType) => void;
  onEdit: (r: FoodRecord) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const totalCal = records.reduce((s, r) => s + (r.calories ?? 0), 0);
  const totalAmt = records.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{meal.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{meal.label}</span>
          {totalCal > 0 && (
            <span style={{ fontSize: 11, color: t.accent }}>{totalCal} kcal</span>
          )}
          {totalAmt > 0 && (
            <span style={{ fontSize: 11, color: t.textMuted }}>{totalAmt.toLocaleString()}원</span>
          )}
        </div>
        <button onClick={() => onAdd(meal.key)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 12, fontWeight: 600 }}>
          + 추가
        </button>
      </div>

      {records.length === 0 ? (
        <div className="py-3 text-center rounded-xl"
          style={{ backgroundColor: t.bgSub, fontSize: 12, color: t.textMuted }}>
          기록 없음
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(r => (
            <FoodCard key={r.id} record={r} onEdit={() => onEdit(r)} onDelete={() => onDelete(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 오늘 탭 ────────────────────────────────────────────────────────
function TodayTab({
  records,
  onAdd,
  onEdit,
  onDelete,
}: {
  records: FoodRecord[];
  onAdd: (meal: MealType) => void;
  onEdit: (r: FoodRecord) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const totalCal = records.reduce((s, r) => s + (r.calories ?? 0), 0);
  const totalAmt = records.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div className="p-4">
      {/* 날짜 헤더 */}
      <p style={{ fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 12 }}>
        {format(new Date(), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
      </p>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>오늘 총 식비</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: t.text }}>
            {totalAmt > 0 ? `${totalAmt.toLocaleString()}원` : '—'}
          </p>
        </div>
        <div className="p-3 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>총 칼로리</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: t.accent }}>
            {totalCal > 0 ? `${totalCal} kcal` : '—'}
          </p>
        </div>
      </div>

      {/* 식사 섹션 */}
      {MEALS.map(meal => (
        <MealSection
          key={meal.key}
          meal={meal}
          records={records.filter(r => r.mealType === meal.key)}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// ─── 달력 날짜 셀 ────────────────────────────────────────────────────
function CalendarCell({
  date,
  recs,
  isSelected,
  today,
  onSelect,
}: {
  date: Date;
  recs: FoodRecord[];
  isSelected: boolean;
  today: boolean;
  onSelect: () => void;
}) {
  const { t } = useTheme();

  const byMeal: Record<MealType, FoodRecord | undefined> = {
    breakfast: recs.find(r => r.mealType === 'breakfast'),
    lunch:     recs.find(r => r.mealType === 'lunch'),
    dinner:    recs.find(r => r.mealType === 'dinner'),
    snack:     recs.find(r => r.mealType === 'snack'),
  };

  const totalPhotos = recs.filter(r => r.photoUrl).length;
  const shownPhotos = MEALS.filter(m => byMeal[m.key]?.photoUrl).length;
  const extraCount = totalPhotos - shownPhotos;

  return (
    <button onClick={onSelect}
      className="relative overflow-hidden rounded-xl flex flex-col"
      style={{
        aspectRatio: '3/4',
        border: `1.5px solid ${isSelected ? t.accent : today ? `${t.accent}70` : t.border}`,
        backgroundColor: t.card,
      }}>

      {/* 4분할 그리드 */}
      <div className="flex-1 grid grid-cols-2 min-h-0"
        style={{ gridTemplateRows: '1fr 1fr' }}>
        {MEALS.map((meal, idx) => {
          const rec = byMeal[meal.key];
          const photo = rec?.photoUrl;
          const hasRecord = !!rec;
          const isFasting = !!rec?.isFasting;
          const isLeft = idx % 2 === 0;
          const isTop  = idx < 2;
          return (
            <div key={meal.key}
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                borderRight:  isLeft ? `1px solid ${t.border}` : 'none',
                borderBottom: isTop  ? `1px solid ${t.border}` : 'none',
                backgroundColor: hasRecord && !isFasting
                  ? isSelected ? 'rgba(255,255,255,0.15)' : `${t.accent}18`
                  : 'transparent',
              }}>
              {isFasting
                ? <span style={{ fontSize: 9, opacity: 0.85, lineHeight: 1 }}>{FASTING_ICON}</span>
                : photo
                  ? <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  : <span style={{ fontSize: 9, opacity: hasRecord ? 0.85 : 0.2, lineHeight: 1 }}>
                      {meal.emoji}
                    </span>
              }
            </div>
          );
        })}
      </div>

      {/* 하단 스트립: 날짜 + +N */}
      <div className="flex-shrink-0 flex items-center justify-between px-1"
        style={{ height: 14, backgroundColor: isSelected ? t.accent : 'transparent' }}>
        <span style={{
          fontSize: 9,
          fontWeight: today || isSelected ? 700 : 400,
          color: isSelected ? '#fff' : today ? t.accent : t.text,
          lineHeight: 1,
        }}>
          {date.getDate()}
        </span>
        {extraCount > 0 && (
          <span style={{ fontSize: 8, color: isSelected ? 'rgba(255,255,255,0.8)' : t.textMuted, lineHeight: 1 }}>
            +{extraCount}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── 달력 탭 ────────────────────────────────────────────────────────
function CalendarTab({
  allRecords,
  onAdd,
  onEdit,
  onDelete,
}: {
  allRecords: FoodRecord[];
  onAdd: (meal: MealType, date?: string) => void;
  onEdit: (r: FoodRecord) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [expanded, setExpanded] = useState(false);
  // 그리드 컨테이너 너비 → 셀 높이 수학적 계산 (overflow-hidden 영향 없음)
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    const el = gridWrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      setGridWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // gap-1 = 4px, 6개 gap, 7열 → 셀 너비 → aspectRatio 3/4 → 셀 높이
  const cellW = gridWidth > 0 ? (gridWidth - 6 * 4) / 7 : 0;
  const cellH = cellW * (4 / 3);
  // 1행 높이 = 셀 높이 (date strip은 aspectRatio 포함)
  const oneRowH = Math.ceil(cellH) + 4; // +4 for gap below row

  const monthStart = startOfMonth(viewMonth);
  const daysInMonth = getDaysInMonth(viewMonth);
  const startDow = getDay(monthStart);

  // 전체 달력 셀 (null = 빈 칸)
  const allCells = Array.from({ length: startDow + daysInMonth }, (_, i) => {
    if (i < startDow) return null;
    return new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i - startDow + 1);
  });

  const numRows = Math.ceil(allCells.length / 7);
  // 전체 높이 = 행수 × 셀높이 + (행수-1) × gap
  const allRowsH = numRows * Math.ceil(cellH) + (numRows - 1) * 4;

  // 접힌 상태: 선택된 날짜가 속한 주 1행
  const selectedCellIdx = (() => {
    const idx = selectedDate
      ? allCells.findIndex(d => d !== null && isSameDay(d, selectedDate))
      : -1;
    if (idx >= 0) return idx;
    const todayIdx = allCells.findIndex(d => d !== null && isToday(d));
    return todayIdx >= 0 ? todayIdx : startDow;
  })();
  const rowIdx = Math.floor(selectedCellIdx / 7);
  const weekStartIdx = rowIdx * 7;
  const weekCells = allCells.slice(weekStartIdx, weekStartIdx + 7);
  while (weekCells.length < 7) weekCells.push(null);

  const recordsByDate = (date: Date) =>
    allRecords.filter(r => r.date === format(date, 'yyyy-MM-dd'));

  const dayRecords = selectedDate ? recordsByDate(selectedDate) : [];

  // gridWidth가 0(초기)이면 max-height를 크게 잡아 잘리지 않도록 fallback
  const collapsedH = gridWidth > 0 ? oneRowH : 120;
  const expandedH  = gridWidth > 0 ? allRowsH + 4 : 800;

  return (
    <div className="p-4">
      {/* 월 네비 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewMonth(m => subMonths(m, 1))} className="p-2">
          <ChevronLeft size={18} color={t.textSub} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
          {format(viewMonth, 'yyyy년 M월')}
        </span>
        <button onClick={() => setViewMonth(m => addMonths(m, 1))} className="p-2">
          <ChevronRight size={18} color={t.textSub} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map(d => (
          <div key={d} className="text-center" style={{ fontSize: 10, color: t.textMuted, paddingBottom: 4 }}>{d}</div>
        ))}
      </div>

      {/* 그리드 너비 측정용 wrapper (overflow-hidden 밖에서 측정) */}
      <div ref={gridWrapRef}>
        {/* 날짜 그리드 — 접기/펼치기 애니메이션 */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: expanded ? expandedH : collapsedH,
            transition: 'max-height 0.35s ease-in-out',
          }}>
          {/* 펼침: 전체 달 / 접힘: 해당 주 1행 */}
          {expanded ? (
            <div className="grid grid-cols-7 gap-1">
              {allCells.map((date, i) =>
                date ? (
                  <CalendarCell
                    key={i}
                    date={date}
                    recs={recordsByDate(date)}
                    isSelected={!!(selectedDate && isSameDay(date, selectedDate))}
                    today={isToday(date)}
                    onSelect={() => setSelectedDate(date)}
                  />
                ) : (
                  <div key={i} />
                )
              )}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {weekCells.map((date, i) =>
                date ? (
                  <CalendarCell
                    key={i}
                    date={date}
                    recs={recordsByDate(date)}
                    isSelected={!!(selectedDate && isSameDay(date, selectedDate))}
                    today={isToday(date)}
                    onSelect={() => setSelectedDate(date)}
                  />
                ) : (
                  <div key={i} />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* 접기/펼치기 토글 버튼 */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center justify-center w-full pt-2 pb-3"
        style={{ color: t.textMuted }}>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full"
          style={{ backgroundColor: t.bgSub }}>
          <span style={{ fontSize: 11, color: t.textMuted }}>
            {expanded ? '접기' : '펼치기'}
          </span>
          <ChevronDown
            size={14}
            color={t.textMuted}
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.32s ease-in-out',
            }}
          />
        </div>
      </button>

      {/* 선택 날짜 기록 */}
      {selectedDate && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              {format(selectedDate, 'M월 d일 (EEE)', { locale: ko })} 기록
            </span>
            <button onClick={() => onAdd('breakfast', format(selectedDate, 'yyyy-MM-dd'))}
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 12, fontWeight: 600 }}>
              + 추가
            </button>
          </div>
          {dayRecords.length === 0 ? (
            <div className="py-6 text-center rounded-xl"
              style={{ backgroundColor: t.bgSub, fontSize: 13, color: t.textMuted }}>
              이날 기록이 없어요
            </div>
          ) : (
            <div className="space-y-2">
              {dayRecords.map(r => (
                <FoodCard
                  key={r.id}
                  record={r}
                  onEdit={() => onEdit(r)}
                  onDelete={() => onDelete(r.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 통계 탭 ────────────────────────────────────────────────────────
type FilterMode = 'thisMonth' | 'lastMonth' | 'last14' | 'custom';

function StatsTab({ allRecords }: { allRecords: FoodRecord[] }) {
  const { t } = useTheme();
  const { appSettings } = usePlanner();
  const now = new Date();

  const [filterMode, setFilterMode] = useState<FilterMode>('thisMonth');
  // custom 모드에서 탐색 중인 달 (yyyy-MM)
  const [customMonth, setCustomMonth] = useState(format(now, 'yyyy-MM'));

  // 기간에 해당하는 기록 필터링
  const filteredRecords = (() => {
    if (filterMode === 'thisMonth') {
      const m = format(now, 'yyyy-MM');
      return allRecords.filter(r => r.date.startsWith(m));
    }
    if (filterMode === 'lastMonth') {
      const m = format(subMonths(now, 1), 'yyyy-MM');
      return allRecords.filter(r => r.date.startsWith(m));
    }
    if (filterMode === 'last14') {
      const cutoff = format(subDays(now, 13), 'yyyy-MM-dd');
      return allRecords.filter(r => r.date >= cutoff);
    }
    // custom
    return allRecords.filter(r => r.date.startsWith(customMonth));
  })();

  // 단식 레코드는 식비/칼로리/맛 등 일반 통계에서 제외 (foodName '단식'이 TOP5 등을 오염시키지 않도록)
  const mealRecords = filteredRecords.filter(r => !r.isFasting);
  const fastingRecords = filteredRecords.filter(r => r.isFasting);

  // 끼니별 단식 분포
  const fastingByMeal = MEALS.map(m => ({
    meal: m,
    count: fastingRecords.filter(r => r.mealType === m.key).length,
  })).filter(x => x.count > 0);
  const fastingMax = fastingByMeal.reduce((mx, x) => Math.max(mx, x.count), 0);

  // 기간 레이블
  const periodLabel = (() => {
    if (filterMode === 'thisMonth') return `${now.getMonth() + 1}월 식비 총액`;
    if (filterMode === 'lastMonth') {
      const lm = subMonths(now, 1);
      return `${lm.getMonth() + 1}월 식비 총액`;
    }
    if (filterMode === 'last14') return '최근 14일 식비';
    const [, mm] = customMonth.split('-');
    return `${parseInt(mm, 10)}월 식비 총액`;
  })();

  // 식비 합계
  const periodTotal = mealRecords.reduce((s, r) => s + (r.amount ?? 0), 0);

  // 배달/외식/집밥 횟수 (항상 filterMode 기준)
  const deliveryCnt = mealRecords.filter(r => r.diningType === 'delivery').length;
  const restaurantCnt = mealRecords.filter(r => r.diningType === 'restaurant').length;
  const homeCnt = mealRecords.filter(r => r.diningType === 'home').length;

  // 도넛 차트
  const diningCounts = DINING_TYPES.map(d => ({
    name: `${d.emoji} ${d.label}`,
    value: mealRecords.filter(r => r.diningType === d.key).length,
  })).filter(d => d.value > 0);

  // 자주 먹은 음식 TOP5
  const foodFreq: Record<string, number> = {};
  mealRecords.forEach(r => { foodFreq[r.foodName] = (foodFreq[r.foodName] ?? 0) + 1; });
  const top5 = Object.entries(foodFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 맛있었던 것들
  const delicious = mealRecords.filter(r => r.tasteRating === 'good').slice(0, 20);

  // 칼로리 차트 데이터
  const calByDay = (() => {
    if (filterMode === 'last14') {
      return Array.from({ length: 14 }, (_, i) => {
        const d = subDays(now, 13 - i);
        const dateStr = format(d, 'yyyy-MM-dd');
        const cal = allRecords.filter(r => r.date === dateStr).reduce((s, r) => s + (r.calories ?? 0), 0);
        return { date: format(d, 'M/d'), calories: cal };
      });
    }
    // 이번달 / 지난달 / 직접선택 → 선택 달의 일별
    const targetMonth = filterMode === 'lastMonth'
      ? format(subMonths(now, 1), 'yyyy-MM')
      : filterMode === 'custom'
        ? customMonth
        : format(now, 'yyyy-MM');
    const [y, m] = targetMonth.split('-').map(Number);
    const days = getDaysInMonth(new Date(y, m - 1));
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(y, m - 1, i + 1);
      const dateStr = format(d, 'yyyy-MM-dd');
      const cal = allRecords.filter(r => r.date === dateStr).reduce((s, r) => s + (r.calories ?? 0), 0);
      return { date: String(i + 1), calories: cal };
    });
  })();

  const calChartTitle = filterMode === 'last14' ? '최근 14일 칼로리' : (() => {
    const targetMonth = filterMode === 'lastMonth'
      ? format(subMonths(now, 1), 'yyyy-MM')
      : filterMode === 'custom'
        ? customMonth
        : format(now, 'yyyy-MM');
    const [, mm] = targetMonth.split('-');
    return `${parseInt(mm, 10)}월 일별 칼로리`;
  })();

  const FILTER_CHIPS: { key: FilterMode; label: string }[] = [
    { key: 'thisMonth', label: '이번달' },
    { key: 'lastMonth', label: '지난달' },
    { key: 'last14',    label: '최근 14일' },
    { key: 'custom',    label: '직접선택' },
  ];

  return (
    <div className="p-4 space-y-5">
      {/* 기간 필터 칩 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_CHIPS.map(chip => (
          <button key={chip.key}
            onClick={() => setFilterMode(chip.key)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: filterMode === chip.key ? t.accent : t.bgSub,
              color: filterMode === chip.key ? '#fff' : t.textSub,
              fontSize: 12, fontWeight: 600,
            }}>
            {chip.label}
          </button>
        ))}
      </div>

      {/* 직접선택: 월 네비게이션 */}
      {filterMode === 'custom' && (
        <div className="flex items-center justify-between px-2">
          <button onClick={() => setCustomMonth(m => format(subMonths(new Date(m + '-01'), 1), 'yyyy-MM'))}
            className="p-1.5 rounded-full" style={{ backgroundColor: t.bgSub }}>
            <ChevronLeft size={16} color={t.textSub} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
            {(() => {
              const [y, mm] = customMonth.split('-');
              return `${y}년 ${parseInt(mm, 10)}월`;
            })()}
          </span>
          <button onClick={() => setCustomMonth(m => format(addMonths(new Date(m + '-01'), 1), 'yyyy-MM'))}
            className="p-1.5 rounded-full" style={{ backgroundColor: t.bgSub }}>
            <ChevronRight size={16} color={t.textSub} />
          </button>
        </div>
      )}

      {/* 식비 총액 */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{periodLabel}</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: t.text }}>
          {periodTotal > 0 ? `${periodTotal.toLocaleString()}원` : '기록 없음'}
        </p>
        <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
          총 {mealRecords.length}건{fastingRecords.length > 0 ? ` · 단식 ${fastingRecords.length}회` : ''}
        </p>
      </div>

      {/* 끼니별 단식 분포 */}
      {fastingRecords.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{FASTING_ICON} 끼니별 단식</p>
            <span style={{ fontSize: 12, color: t.textMuted }}>총 {fastingRecords.length}회</span>
          </div>
          <div className="space-y-2">
            {fastingByMeal.map(({ meal, count }) => (
              <div key={meal.key} className="flex items-center gap-2">
                <span style={{ fontSize: 12, width: 52, color: t.textSub }}>{meal.emoji} {meal.label}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                  <div className="h-full rounded-full" style={{
                    width: `${fastingMax > 0 ? (count / fastingMax) * 100 : 0}%`,
                    backgroundColor: t.accent,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text, width: 28, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 식사 유형 횟수 */}
      {(deliveryCnt + restaurantCnt + homeCnt) > 0 && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>기간 내 식사 유형</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: '배달', emoji: '🛵', cnt: deliveryCnt, goal: appSettings.foodGoalDelivery, color: DINING_DOT_COLOR.delivery },
              { label: '외식', emoji: '🍽️', cnt: restaurantCnt, goal: appSettings.foodGoalRestaurant, color: DINING_DOT_COLOR.restaurant },
              { label: '집밥', emoji: '🏠', cnt: homeCnt, goal: undefined, color: DINING_DOT_COLOR.home },
            ].map(({ label, emoji, cnt, goal, color }) => (
              <div key={label} className="flex flex-col items-center p-2.5 rounded-xl"
                style={{ backgroundColor: t.bgSub }}>
                <span style={{ fontSize: 16, marginBottom: 2 }}>{emoji}</span>
                <span style={{ fontSize: 11, color: t.textMuted, marginBottom: 2 }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color }}>
                  {cnt}<span style={{ fontSize: 11, fontWeight: 400 }}>회</span>
                </span>
                {goal != null && (
                  <span style={{ fontSize: 10, color: cnt <= goal ? t.textMuted : '#D4735A', marginTop: 2 }}>
                    목표 {goal}회
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* 목표 대비 현황 — 목표가 설정된 항목만 */}
          {(appSettings.foodGoalDelivery != null || appSettings.foodGoalRestaurant != null) && (
            <div className="space-y-2">
              {appSettings.foodGoalDelivery != null && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span style={{ fontSize: 11, color: t.textMuted }}>🛵 배달 목표 달성률</span>
                    <span style={{ fontSize: 11, color: t.textSub }}>{deliveryCnt} / {appSettings.foodGoalDelivery}회</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: t.bgSub }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((deliveryCnt / appSettings.foodGoalDelivery) * 100, 100)}%`,
                        backgroundColor: deliveryCnt <= appSettings.foodGoalDelivery ? DINING_DOT_COLOR.delivery : '#D4735A',
                      }} />
                  </div>
                </div>
              )}
              {appSettings.foodGoalRestaurant != null && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span style={{ fontSize: 11, color: t.textMuted }}>🍽️ 외식 목표 달성률</span>
                    <span style={{ fontSize: 11, color: t.textSub }}>{restaurantCnt} / {appSettings.foodGoalRestaurant}회</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: t.bgSub }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((restaurantCnt / appSettings.foodGoalRestaurant) * 100, 100)}%`,
                        backgroundColor: restaurantCnt <= appSettings.foodGoalRestaurant ? DINING_DOT_COLOR.restaurant : '#D4735A',
                      }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 배달/외식/집밥 도넛 차트 */}
      {diningCounts.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>식사 유형 비율</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={diningCounts} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                {diningCounts.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [`${v}건`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 자주 먹은 음식 TOP5 */}
      {top5.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>자주 먹은 음식 TOP5</p>
          <div className="space-y-2">
            {top5.map(([name, cnt], i) => (
              <div key={name} className="flex items-center gap-2">
                <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, width: 16 }}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span style={{ fontSize: 13, color: t.text }}>{name}</span>
                    <span style={{ fontSize: 11, color: t.textSub }}>{cnt}회</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: t.bgSub }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${(cnt / (top5[0][1] || 1)) * 100}%`, backgroundColor: t.accent }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 맛있었던 것들 */}
      {delicious.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>⭐ 맛있었던 것들</p>
          <div className="flex flex-wrap gap-2">
            {delicious.map(r => (
              <div key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ backgroundColor: t.bgSub }}>
                {r.photoUrl
                  ? <img src={r.photoUrl} alt="" className="w-6 h-6 rounded object-cover" />
                  : <span style={{ fontSize: 14 }}>😋</span>}
                <span style={{ fontSize: 12, color: t.text }}>{r.foodName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일별 칼로리 막대 그래프 */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{calChartTitle}</p>
          {appSettings.foodGoalCalories != null && (
            <span style={{ fontSize: 11, color: t.textMuted }}>
              목표 {appSettings.foodGoalCalories.toLocaleString()} kcal/일
            </span>
          )}
        </div>
        {calByDay.some(d => d.calories > 0) ? (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={calByDay} barSize={14}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: t.card, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v} kcal`, '칼로리']}
              />
              <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                {calByDay.map((entry, i) => (
                  <Cell key={i} fill={
                    appSettings.foodGoalCalories != null && entry.calories > appSettings.foodGoalCalories
                      ? '#D4735A'
                      : t.accent
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-6" style={{ fontSize: 13, color: t.textMuted }}>칼로리 데이터가 없어요</div>
        )}
      </div>
    </div>
  );
}

// ─── 기록 추가/수정 바텀시트 ─────────────────────────────────────────
function AddFoodSheet({
  initMeal,
  initDate,
  editRecord,
  onSave,
  onClose,
}: {
  initMeal: MealType;
  initDate?: string;
  editRecord?: FoodRecord;
  onSave: (data: Omit<FoodRecord, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTheme();
  const [step, setStep] = useState<AddStep>(editRecord ? 3 : 1);
  const [form, setForm] = useState<FormState>(() => editRecord
    ? {
        mealType: editRecord.mealType,
        photoUrl: editRecord.photoUrl ?? null,
        photoFile: null,
        foodName: editRecord.foodName,
        diningType: editRecord.diningType ?? null,
        amount: editRecord.amount > 0 ? String(editRecord.amount) : '',
        calories: editRecord.calories != null ? String(editRecord.calories) : '',
        tasteRating: editRecord.tasteRating ?? null,
        tasteMemo: editRecord.tasteMemo ?? '',
      }
    : initForm(initMeal)
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // AI 칼로리 추정
  const { estimate, loading: calLoading, estimated, setEstimated, reset: resetEstimate } = useCalorieEstimate();

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handlePhotoFile = async (file: File) => {
    set({ photoFile: file, photoUrl: URL.createObjectURL(file) });
    if (!editRecord) nextStep();
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 7) as AddStep);
  const prevStep = () => setStep(s => Math.max(s - 1, 1) as AddStep);

  const handleSave = async () => {
    if (!form.foodName.trim()) return;
    setSaving(true);
    let photoUrl = form.photoUrl;

    // 새 사진 업로드
    if (form.photoFile) {
      setUploading(true);
      const tmpId = editRecord?.id ?? `tmp-${Date.now()}`;
      photoUrl = await db.foodRecords.uploadPhoto(form.photoFile, tmpId);
      setUploading(false);
    }

    onSave({
      id: editRecord?.id,
      date: editRecord?.date ?? initDate ?? getLogicalToday(),
      mealType: form.mealType,
      foodName: form.foodName.trim(),
      amount: Number(form.amount) || 0,
      photoUrl: photoUrl ?? null,
      memo: null,
      calories: form.calories ? Number(form.calories) : null,
      carbs: editRecord?.carbs ?? null,
      protein: editRecord?.protein ?? null,
      fat: editRecord?.fat ?? null,
      diningType: form.diningType,
      tasteRating: form.tasteRating,
      tasteMemo: form.tasteMemo.trim() || null,
      isFasting: false,
    });
    setSaving(false);
    onClose();
  };

  // 단식: 선택한 끼니를 거른 것으로 즉시 기록하고 닫는다
  const saveFasting = (meal: MealType) => {
    onSave({
      date: editRecord?.date ?? initDate ?? getLogicalToday(),
      mealType: meal,
      foodName: FASTING_LABEL,
      amount: 0,
      photoUrl: null,
      memo: null,
      calories: 0,
      carbs: null,
      protein: null,
      fat: null,
      diningType: null,
      tasteRating: null,
      tasteMemo: null,
      isFasting: true,
    });
    onClose();
  };

  // 기록 대상 날짜 (수정: 기존 날짜 / 신규: 전달받은 날짜 또는 오늘)
  const targetDate = editRecord?.date ?? initDate ?? getLogicalToday();
  const isTargetToday = targetDate === getLogicalToday();

  const TOTAL_STEPS = 7;
  const stepTitles: Record<AddStep, string> = {
    1: '시간대 선택',
    2: '사진 추가 (선택)',
    3: '음식 이름',
    4: '식사 유형',
    5: '금액 (선택)',
    6: '칼로리 (선택)',
    7: '맛 평가 (선택)',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div className="rounded-t-3xl overflow-hidden flex flex-col"
        style={{ backgroundColor: t.bg, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        {/* 핸들 + 헤더 */}
        <div className="flex-shrink-0 pt-3 pb-2 px-5">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step > 1 && !editRecord && (
                <button onClick={prevStep} className="p-1">
                  <ChevronLeft size={18} color={t.textSub} />
                </button>
              )}
              <div className="flex flex-col">
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                  {editRecord ? '기록 수정' : stepTitles[step]}
                </span>
                <span style={{ fontSize: 11, color: isTargetToday ? t.textMuted : t.accent, fontWeight: isTargetToday ? 400 : 600 }}>
                  {format(new Date(targetDate + 'T00:00:00'), 'M월 d일 (EEE)', { locale: ko })}
                  {isTargetToday ? '' : ' 기록'}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1">
              <X size={20} color={t.textSub} />
            </button>
          </div>
          {/* 진행 바 */}
          {!editRecord && (
            <div className="mt-3 h-1 rounded-full" style={{ backgroundColor: t.bgSub }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: t.accent }} />
            </div>
          )}
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">

          {/* Step 1: 시간대 */}
          {(step === 1 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>시간대</p>}
              <div className="grid grid-cols-4 gap-2">
                {MEALS.map(m => (
                  <button key={m.key}
                    onClick={() => {
                      set({ mealType: m.key });
                      if (!editRecord) nextStep();
                    }}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl transition-all"
                    style={{
                      backgroundColor: form.mealType === m.key ? t.accent : t.card,
                      border: `1px solid ${form.mealType === m.key ? t.accent : t.border}`,
                    }}>
                    <span style={{ fontSize: 24 }}>{m.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: form.mealType === m.key ? '#fff' : t.text }}>
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* 단식: 거른 끼니를 한 번에 기록 */}
              {!editRecord && (
                <div className="mt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 16 }}>{FASTING_ICON}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
                      끼니를 거르셨나요? 단식으로 기록해요
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {MEALS.map(m => (
                      <button key={m.key}
                        onClick={() => saveFasting(m.key)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                        style={{ backgroundColor: t.bgSub, border: `1px dashed ${t.border}` }}>
                        <span style={{ fontSize: 14 }}>{m.emoji}</span>
                        <span style={{ fontSize: 11, color: t.textSub }}>{m.label} 단식</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: 사진 */}
          {(step === 2) && !editRecord && (
            <div className="space-y-3">
              {form.photoUrl && (
                <div className="relative mb-4">
                  <img src={form.photoUrl} alt="" className="w-full h-48 object-cover rounded-2xl" />
                  <button onClick={() => set({ photoUrl: null, photoFile: null })}
                    className="absolute top-2 right-2 p-1 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <X size={14} color="#fff" />
                  </button>
                </div>
              )}
              <button onClick={() => cameraRef.current?.click()}
                className="w-full flex items-center gap-3 p-4 rounded-2xl"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <Camera size={20} color={t.accent} />
                <span style={{ fontSize: 14, color: t.text }}>📸 지금 찍기</span>
              </button>
              <button onClick={() => galleryRef.current?.click()}
                className="w-full flex items-center gap-3 p-4 rounded-2xl"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <ImageIcon size={20} color={t.accent} />
                <span style={{ fontSize: 14, color: t.text }}>🖼️ 갤러리에서</span>
              </button>
              <button onClick={nextStep}
                className="w-full p-4 rounded-2xl"
                style={{ backgroundColor: t.bgSub }}>
                <span style={{ fontSize: 14, color: t.textSub }}>건너뛰기</span>
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={e => e.target.files?.[0] && handlePhotoFile(e.target.files[0])} />
              <input ref={galleryRef} type="file" accept="image/*"
                className="hidden" onChange={e => e.target.files?.[0] && handlePhotoFile(e.target.files[0])} />
            </div>
          )}

          {/* 사진 (수정 모드 전용) */}
          {editRecord && (
            <div className="mb-5">
              <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>사진</p>
              {form.photoUrl ? (
                <div className="relative mb-2">
                  <img src={form.photoUrl} alt="" className="w-full h-44 object-cover rounded-2xl" />
                  <button
                    onClick={() => set({ photoUrl: null, photoFile: null })}
                    className="absolute top-2 right-2 p-1.5 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                    <X size={14} color="#fff" />
                  </button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                  <Camera size={16} color={t.accent} />
                  <span style={{ fontSize: 13, color: t.text }}>지금 찍기</span>
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                  <ImageIcon size={16} color={t.accent} />
                  <span style={{ fontSize: 13, color: t.text }}>갤러리</span>
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={e => e.target.files?.[0] && handlePhotoFile(e.target.files[0])} />
              <input ref={galleryRef} type="file" accept="image/*"
                className="hidden" onChange={e => e.target.files?.[0] && handlePhotoFile(e.target.files[0])} />
            </div>
          )}

          {/* Step 3: 음식 이름 + 양 */}
          {(step === 3 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>음식 이름 + 양</p>}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <input
                  autoFocus={step === 3}
                  value={form.foodName}
                  onChange={e => set({ foodName: e.target.value })}
                  placeholder='예: "포케", "방울토마토 8개", "아메리카노 톨"'
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 14, color: t.text }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !editRecord && form.foodName.trim()) {
                      estimate(form.foodName);
                      nextStep();
                    }
                  }}
                />
                <VoiceInputButton onResult={text => set({ foodName: text })} />
              </div>
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6, marginBottom: 12, paddingLeft: 4 }}>
                양을 함께 적으면 AI가 칼로리를 더 정확하게 추정해요
              </p>

              {!editRecord && (
                <button
                  onClick={() => { estimate(form.foodName); nextStep(); }}
                  disabled={!form.foodName.trim()}
                  className="w-full py-3.5 rounded-2xl"
                  style={{
                    backgroundColor: form.foodName.trim() ? t.accent : t.bgSub,
                    color: form.foodName.trim() ? '#fff' : t.textMuted,
                    fontSize: 15, fontWeight: 600,
                  }}>
                  다음
                </button>
              )}
            </div>
          )}

          {/* Step 4: 식사 유형 */}
          {(step === 4 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>식사 유형</p>}
              <div className="grid grid-cols-3 gap-2">
                {DINING_TYPES.map(d => (
                  <button key={d.key}
                    onClick={() => {
                      set({ diningType: form.diningType === d.key ? null : d.key });
                      if (!editRecord) nextStep();
                    }}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl"
                    style={{
                      backgroundColor: form.diningType === d.key ? t.accent : t.card,
                      border: `1px solid ${form.diningType === d.key ? t.accent : t.border}`,
                    }}>
                    <span style={{ fontSize: 24 }}>{d.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: form.diningType === d.key ? '#fff' : t.text }}>
                      {d.label}
                    </span>
                  </button>
                ))}
              </div>
              {!editRecord && (
                <button onClick={nextStep} className="w-full py-3 rounded-2xl mt-3"
                  style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14 }}>
                  건너뛰기
                </button>
              )}
            </div>
          )}

          {/* Step 5: 금액 */}
          {(step === 5 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>금액</p>}
              <div className="w-full flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={e => set({ amount: e.target.value })}
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent outline-none text-right"
                  style={{ fontSize: 22, fontWeight: 600, color: t.text }}
                  onKeyDown={e => { if (e.key === 'Enter' && !editRecord) nextStep(); }}
                />
                <span className="flex-shrink-0" style={{ fontSize: 16, color: t.textSub }}>원</span>
              </div>
              {!editRecord && (
                <div className="flex gap-2 mt-3">
                  <button onClick={nextStep}
                    disabled={!form.amount}
                    className="flex-1 py-3.5 rounded-2xl"
                    style={{
                      backgroundColor: form.amount ? t.accent : t.bgSub,
                      color: form.amount ? '#fff' : t.textMuted,
                      fontSize: 15, fontWeight: 600,
                    }}>
                    다음
                  </button>
                  <button onClick={nextStep} className="py-3.5 px-5 rounded-2xl"
                    style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14 }}>
                    건너뛰기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 6: 칼로리 (AI 추정) */}
          {(step === 6 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>칼로리</p>}

              {/* AI 추정 로딩 */}
              {calLoading && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: t.bgSub }}>
                  <div className="w-3 h-3 rounded-full border-2 animate-spin"
                    style={{ borderColor: t.accent, borderTopColor: 'transparent' }} />
                  <span style={{ fontSize: 12, color: t.textMuted }}>AI가 칼로리를 추정하고 있어요...</span>
                </div>
              )}

              {/* AI 추정 결과 적용 버튼 */}
              {estimated !== null && !calLoading && (
                <button
                  onClick={() => set({ calories: String(estimated) })}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3"
                  style={{ backgroundColor: `${t.accent}15`, border: `1.5px solid ${t.accent}50` }}>
                  <span style={{ fontSize: 12, color: t.textSub }}>✨ AI 추정 칼로리</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: t.accent }}>
                    {estimated} kcal 적용하기
                  </span>
                </button>
              )}

              {/* 직접 입력 */}
              <div className="w-full flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.calories}
                  onChange={e => set({ calories: e.target.value })}
                  placeholder={estimated !== null ? String(estimated) : '직접 입력'}
                  className="min-w-0 flex-1 bg-transparent outline-none text-right"
                  style={{ fontSize: 22, fontWeight: 600, color: t.accent }}
                  onKeyDown={e => { if (e.key === 'Enter' && !editRecord) nextStep(); }}
                />
                <span className="flex-shrink-0" style={{ fontSize: 16, color: t.textSub }}>kcal</span>
              </div>

              {!editRecord && (
                <div className="flex gap-2 mt-3">
                  <button onClick={nextStep}
                    disabled={!form.calories && estimated === null}
                    className="flex-1 py-3.5 rounded-2xl"
                    style={{
                      backgroundColor: (form.calories || estimated !== null) ? t.accent : t.bgSub,
                      color: (form.calories || estimated !== null) ? '#fff' : t.textMuted,
                      fontSize: 15, fontWeight: 600,
                    }}>
                    다음
                  </button>
                  <button onClick={() => { resetEstimate(); nextStep(); }} className="py-3.5 px-5 rounded-2xl"
                    style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14 }}>
                    건너뛰기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 7: 맛 평가 */}
          {(step === 7 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>맛 평가</p>}
              <div className="grid grid-cols-3 gap-2">
                {TASTE_OPTIONS.map(o => (
                  <button key={o.key}
                    onClick={() => set({ tasteRating: form.tasteRating === o.key ? null : o.key })}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-2xl"
                    style={{
                      backgroundColor: form.tasteRating === o.key ? t.accent : t.card,
                      border: `1px solid ${form.tasteRating === o.key ? t.accent : t.border}`,
                    }}>
                    <span style={{ fontSize: 28 }}>{o.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: form.tasteRating === o.key ? '#fff' : t.text }}>
                      {o.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* 맛 메모 입력 — 평가 선택 시 표출 */}
              {form.tasteRating && (
                <div className="mt-3">
                  <input
                    value={form.tasteMemo}
                    onChange={e => set({ tasteMemo: e.target.value })}
                    placeholder="맛에 대해 한 줄 메모 (선택)"
                    maxLength={50}
                    className="w-full px-3 py-2.5 rounded-xl outline-none"
                    style={{
                      backgroundColor: t.card,
                      border: `1px solid ${t.border}`,
                      fontSize: 13,
                      color: t.text,
                    }}
                  />
                </div>
              )}

              {/* 저장 버튼 */}
              {!editRecord && (
                <button onClick={handleSave}
                  disabled={saving || uploading || !form.foodName.trim()}
                  className="w-full py-4 rounded-2xl mt-4"
                  style={{
                    backgroundColor: t.accent, color: '#fff',
                    fontSize: 16, fontWeight: 700,
                    opacity: saving || uploading ? 0.6 : 1,
                  }}>
                  {uploading ? '사진 업로드 중...' : saving ? '저장 중...' : '저장하기 🍽️'}
                </button>
              )}
            </div>
          )}

          {/* 수정 모드 저장 버튼 */}
          {editRecord && (
            <button onClick={handleSave}
              disabled={saving || uploading || !form.foodName.trim()}
              className="w-full py-4 rounded-2xl"
              style={{
                backgroundColor: t.accent, color: '#fff',
                fontSize: 16, fontWeight: 700,
                opacity: saving || uploading ? 0.6 : 1,
              }}>
              {uploading ? '사진 업로드 중...' : saving ? '저장 중...' : '수정 완료'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 FoodView ──────────────────────────────────────────────────
export function FoodView() {
  const { foodRecords, addFoodRecord, updateFoodRecord, deleteFoodRecord } = usePlanner();
  const { t } = useTheme();

  const [activeTab, setActiveTab] = useState<'today' | 'calendar' | 'stats'>('today');
  const [showSheet, setShowSheet] = useState(false);
  const [sheetMeal, setSheetMeal] = useState<MealType>('breakfast');
  const [sheetDate, setSheetDate] = useState<string | undefined>(undefined);
  const [editRecord, setEditRecord] = useState<FoodRecord | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const today = getLogicalToday();
  const todayRecords = foodRecords.filter(r => r.date === today);

  const openAdd = useCallback((meal: MealType, date?: string) => {
    setEditRecord(undefined);
    setSheetMeal(meal);
    setSheetDate(date);
    setShowSheet(true);
  }, []);

  const openEdit = useCallback((r: FoodRecord) => {
    setEditRecord(r);
    setShowSheet(true);
  }, []);

  // 전역 FAB — 식단 추가(현재 시간대 기본 끼니). 시트 1단계에서 끼니 변경 가능
  useFabAction({ kind: 'action', label: '식단 추가', icon: Plus, onPress: () => {
    const h = new Date().getHours();
    const meal: MealType = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
    openAdd(meal);
  } });

  const handleSave = useCallback((data: Omit<FoodRecord, 'id'> & { id?: string }) => {
    if (data.id) {
      const { id, ...changes } = data;
      updateFoodRecord(id, changes);
    } else {
      const { id: _id, ...record } = data;
      addFoodRecord(record as Omit<FoodRecord, 'id'>);
    }
  }, [addFoodRecord, updateFoodRecord]);

  const handleDelete = useCallback((id: string) => {
    deleteFoodRecord(id);
    setDeleteTarget(null);
  }, [deleteFoodRecord]);

  const TABS = [
    { key: 'today' as const,    label: '오늘' },
    { key: 'calendar' as const, label: '달력' },
    { key: 'stats' as const,    label: '통계' },
  ];

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: t.bg }}>
      {/* 헤더 */}
      <div className="flex-shrink-0 px-4 pt-5 pb-3 lg:px-6 lg:pt-6"
        style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <h1 style={{ fontSize: 20, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>🍽️ 식단 기록</h1>
          <button
            onClick={() => openAdd('breakfast')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
            style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            + 추가
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: t.bgSub }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: activeTab === tab.key ? t.card : 'transparent',
                color: activeTab === tab.key ? t.accent : t.textSub,
                fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400,
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'today' && (
          <TodayTab
            records={todayRecords}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={id => setDeleteTarget(id)}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarTab
            allRecords={foodRecords}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={id => setDeleteTarget(id)}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab allRecords={foodRecords} />
        )}
      </div>

      {/* 바텀시트 */}
      {showSheet && (
        <AddFoodSheet
          initMeal={sheetMeal}
          initDate={sheetDate}
          editRecord={editRecord}
          onSave={handleSave}
          onClose={() => { setShowSheet(false); setEditRecord(undefined); }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <ConfirmModal
          message="이 기록을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
