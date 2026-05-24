import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  format, startOfMonth, getDaysInMonth, getDay,
  addMonths, subMonths, parseISO, isToday, isSameDay,
  subDays,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, X, Camera, Image as ImageIcon,
  Mic, MicOff, Trash2, Pencil, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { usePlanner, FoodRecord, MealType, DiningType, TasteRating } from '../store';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import ConfirmModal from './ConfirmModal';

// ─── 상수 ───────────────────────────────────────────────────────────
const MEALS: { key: MealType; label: string; emoji: string; time: string }[] = [
  { key: 'breakfast', label: '아침',  emoji: '🌅', time: '08:00' },
  { key: 'lunch',     label: '점심',  emoji: '☀️', time: '12:00' },
  { key: 'dinner',    label: '저녁',  emoji: '🌙', time: '18:00' },
  { key: 'snack',     label: '간식',  emoji: '🍪', time: '' },
];

const DINING_TYPES: { key: DiningType; label: string; emoji: string }[] = [
  { key: 'home',       label: '집밥', emoji: '🏠' },
  { key: 'delivery',   label: '배달', emoji: '🛵' },
  { key: 'restaurant', label: '외식', emoji: '🍴' },
];

const TASTE_OPTIONS: { key: TasteRating; label: string; emoji: string }[] = [
  { key: 'good',   label: '맛있었어', emoji: '😋' },
  { key: 'normal', label: '보통',     emoji: '😐' },
  { key: 'bad',    label: '별로',     emoji: '😑' },
];

const DONUT_COLORS = ['#6BAA7A', '#D4735A', '#C4A882'];

// 달력 dot 색상: home=파랑, delivery=빨강, restaurant=초록
const DINING_DOT_COLOR: Record<DiningType, string> = {
  home: '#4A82CC',
  delivery: '#D4735A',
  restaurant: '#6BAA7A',
};

// ─── 타입 ───────────────────────────────────────────────────────────
type NutritionResult = {
  foodName: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  servingSize: number;
};

type AddStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type FormState = {
  mealType: MealType;
  photoUrl: string | null;
  photoFile: File | null;
  foodName: string;
  diningType: DiningType | null;
  amount: string;
  calories: string;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
  tasteRating: TasteRating | null;
};

const initForm = (meal: MealType = 'breakfast'): FormState => ({
  mealType: meal,
  photoUrl: null,
  photoFile: null,
  foodName: '',
  diningType: null,
  amount: '',
  calories: '',
  carbs: null,
  protein: null,
  fat: null,
  tasteRating: null,
});

// ─── 음성 입력 버튼 ─────────────────────────────────────────────────
function VoiceInputButton({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.lang = 'ko-KR';
    r.onresult = (e: any) => {
      onResult(e.results[0][0].transcript);
      setListening(false);
    };
    r.onend = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  };

  return (
    <button type="button" onClick={toggle}
      className="p-2 rounded-full transition-colors"
      style={{ backgroundColor: listening ? '#D4735A20' : 'transparent' }}
    >
      {listening ? <MicOff size={16} color="#D4735A" /> : <Mic size={16} color="#C4A882" />}
    </button>
  );
}

// ─── 영양성분 파싱 (Edge Function과 동일한 로직, fallback용) ──────────
function parseNutritionRaw(raw: any): NutritionResult[] {
  const body = raw?.response?.body ?? raw?.body ?? raw;
  const rawItems = body?.items;
  let items: any[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems;
  } else if (rawItems?.item) {
    items = Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item];
  } else if (rawItems && typeof rawItems === 'object' && rawItems.FOOD_NM_KR) {
    items = [rawItems];
  }
  return items
    .filter((item: any) => item?.FOOD_NM_KR)
    .map((item: any) => ({
      foodName: item.FOOD_NM_KR as string,
      calories: parseFloat(item.NUTR_CONT1) || 0,
      protein: parseFloat(item.NUTR_CONT3) || 0,
      fat: parseFloat(item.NUTR_CONT4) || 0,
      carbs: parseFloat(item.NUTR_CONT6) || 0,
      servingSize: parseFloat(item.SERVING_WT) || 100,
    }));
}

const FOOD_API_DIRECT =
  'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo01/getFoodNtrCpntDbInqD2';

// ─── 영양 검색 훅 ────────────────────────────────────────────────────
function useNutritionSearch(query: string) {
  const [results, setResults] = useState<NutritionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // 검색 시도 여부
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      setSearched(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setSearched(false);
      let found: NutritionResult[] = [];

      // 1차: Vercel Edge Function 프록시
      try {
        const res = await fetch(`/api/food-nutrition?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          found = data.results ?? [];
        }
      } catch {
        // 프록시 실패 시 직접 호출 시도 (로컬 dev용)
      }

      // 2차: 직접 호출 fallback (VITE_FOOD_API_KEY 환경변수 필요)
      if (found.length === 0) {
        const apiKey = (import.meta as any).env?.VITE_FOOD_API_KEY as string | undefined;
        if (apiKey) {
          try {
            const url =
              `${FOOD_API_DIRECT}?serviceKey=${apiKey}` +
              `&pageNo=1&numOfRows=15` +
              `&FOOD_NM_KR=${encodeURIComponent(query)}&type=json`;
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            if (res.ok) {
              const raw = await res.json();
              found = parseNutritionRaw(raw);
            }
          } catch {
            // CORS 등으로 실패해도 조용히 처리
          }
        }
      }

      setResults(found);
      setSearched(true);
      setLoading(false);
    }, 500);
  }, [query]);

  return { results, loading, searched };
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

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      {/* 사진 or 플레이스홀더 */}
      {record.photoUrl ? (
        <img src={record.photoUrl} alt={record.foodName}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl"
          style={{ backgroundColor: t.bgSub }}>🍽️</div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{record.foodName}</span>
          {taste && <span style={{ fontSize: 12 }}>{taste.emoji}</span>}
          {dining && <span style={{ fontSize: 11, color: t.textMuted }}>{dining.emoji} {dining.label}</span>}
        </div>
        <div className="flex gap-2 flex-wrap mt-0.5">
          {record.calories != null && (
            <span style={{ fontSize: 11, color: t.accent }}>{record.calories} kcal</span>
          )}
          {record.amount > 0 && (
            <span style={{ fontSize: 11, color: t.textSub }}>{record.amount.toLocaleString()}원</span>
          )}
          {record.carbs != null && (
            <span style={{ fontSize: 10, color: t.textMuted }}>
              탄 {record.carbs}g · 단 {record.protein}g · 지 {record.fat}g
            </span>
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

// ─── 달력 탭 ────────────────────────────────────────────────────────
function CalendarTab({
  allRecords,
  onAdd,
  onEdit,
  onDelete,
}: {
  allRecords: FoodRecord[];
  onAdd: (meal: MealType) => void;
  onEdit: (r: FoodRecord) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(viewMonth);
  const daysInMonth = getDaysInMonth(viewMonth);
  const startDow = getDay(monthStart); // 0=일
  const cells = Array.from({ length: startDow + daysInMonth }, (_, i) => {
    if (i < startDow) return null;
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i - startDow + 1);
    return d;
  });

  const recordsByDate = (date: Date) =>
    allRecords.filter(r => r.date === format(date, 'yyyy-MM-dd'));

  const dayRecords = selectedDate ? recordsByDate(selectedDate) : [];

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
          <div key={d} className="text-center" style={{ fontSize: 11, color: t.textMuted, paddingBottom: 6 }}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const recs = recordsByDate(date);
          const firstPhoto = recs.find(r => r.photoUrl)?.photoUrl;
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const today = isToday(date);
          // 이 날짜에 있는 식사 유형 중복 제거
          const diningTypesPresent = Array.from(new Set(
            recs.map(r => r.diningType).filter((d): d is DiningType => !!d)
          ));
          return (
            <button key={i} onClick={() => setSelectedDate(date)}
              className="aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center relative"
              style={{
                backgroundColor: isSelected ? t.accent : today ? t.accentLight : t.card,
                border: `1px solid ${isSelected ? t.accent : t.border}`,
              }}>
              {firstPhoto ? (
                <img src={firstPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              ) : null}
              <span className="relative z-10" style={{
                fontSize: 12, fontWeight: today || isSelected ? 700 : 400,
                color: isSelected ? '#fff' : today ? t.accent : t.text,
              }}>
                {date.getDate()}
              </span>
              {/* 식사 유형 dot */}
              {diningTypesPresent.length > 0 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
                  {diningTypesPresent.map(dt => (
                    <div key={dt} className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : DINING_DOT_COLOR[dt] }} />
                  ))}
                </div>
              )}
              {/* dot: 식사 유형 미기록 but 기록 있음 */}
              {recs.length > 0 && diningTypesPresent.length === 0 && !firstPhoto && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full z-10"
                  style={{ backgroundColor: isSelected ? '#fff' : t.accent }} />
              )}
            </button>
          );
        })}
      </div>

      {/* 선택 날짜 기록 */}
      {selectedDate && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              {format(selectedDate, 'M월 d일 (EEE)', { locale: ko })} 기록
            </span>
            <button onClick={() => onAdd('breakfast')}
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
                <button key={r.id} onClick={() => onEdit(r)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                  {r.photoUrl
                    ? <img src={r.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: t.bgSub, fontSize: 18 }}>
                        {MEALS.find(m => m.key === r.mealType)?.emoji ?? '🍽️'}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: t.text }} className="truncate">{r.foodName}</p>
                    <p style={{ fontSize: 11, color: t.textMuted }}>
                      {MEALS.find(m => m.key === r.mealType)?.label}
                      {r.calories ? ` · ${r.calories} kcal` : ''}
                      {r.diningType ? ` · ${DINING_TYPES.find(d => d.key === r.diningType)?.emoji}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 통계 탭 ────────────────────────────────────────────────────────
function StatsTab({ allRecords }: { allRecords: FoodRecord[] }) {
  const { t } = useTheme();
  const { appSettings } = usePlanner();
  const now = new Date();
  const thisMonth = format(now, 'yyyy-MM');

  const monthRecords = allRecords.filter(r => r.date.startsWith(thisMonth));

  // 이번 달 식비
  const monthTotal = monthRecords.reduce((s, r) => s + (r.amount ?? 0), 0);

  // 배달/외식/집밥 횟수
  const deliveryCnt = monthRecords.filter(r => r.diningType === 'delivery').length;
  const restaurantCnt = monthRecords.filter(r => r.diningType === 'restaurant').length;
  const homeCnt = monthRecords.filter(r => r.diningType === 'home').length;

  // 배달/외식/집밥 비율 (도넛 차트)
  const diningCounts = DINING_TYPES.map(d => ({
    name: `${d.emoji} ${d.label}`,
    value: monthRecords.filter(r => r.diningType === d.key).length,
  })).filter(d => d.value > 0);

  // 자주 먹은 음식 TOP5
  const foodFreq: Record<string, number> = {};
  monthRecords.forEach(r => { foodFreq[r.foodName] = (foodFreq[r.foodName] ?? 0) + 1; });
  const top5 = Object.entries(foodFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 맛있었던 것들
  const delicious = allRecords.filter(r => r.tasteRating === 'good').slice(0, 20);

  // 최근 14일 칼로리
  const calByDay = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(now, 13 - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const cal = allRecords.filter(r => r.date === dateStr).reduce((s, r) => s + (r.calories ?? 0), 0);
    return { date: format(d, 'M/d'), calories: cal };
  });

  return (
    <div className="p-4 space-y-5">
      {/* 이번 달 식비 */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>이번 달 식비 총액</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: t.text }}>
          {monthTotal > 0 ? `${monthTotal.toLocaleString()}원` : '기록 없음'}
        </p>
        <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
          총 {monthRecords.length}건
        </p>
      </div>

      {/* 식사 유형 횟수 */}
      {(deliveryCnt + restaurantCnt + homeCnt) > 0 && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>이번 달 식사 유형</p>
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
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>최근 14일 칼로리</p>
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
  editRecord,
  onSave,
  onClose,
}: {
  initMeal: MealType;
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
        carbs: editRecord.carbs ?? null,
        protein: editRecord.protein ?? null,
        fat: editRecord.fat ?? null,
        tasteRating: editRecord.tasteRating ?? null,
      }
    : initForm(initMeal)
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // 영양 검색
  const { results: nutritionResults, loading: nutritionLoading, searched: nutritionSearched } = useNutritionSearch(
    step === 3 || editRecord ? form.foodName : ''
  );
  const [showResults, setShowResults] = useState(false);
  useEffect(() => {
    setShowResults(form.foodName.trim().length > 0 && (nutritionResults.length > 0 || nutritionSearched));
  }, [nutritionResults, nutritionSearched, form.foodName]);

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handlePhotoFile = async (file: File) => {
    set({ photoFile: file, photoUrl: URL.createObjectURL(file) });
    nextStep();
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
      date: editRecord?.date ?? format(new Date(), 'yyyy-MM-dd'),
      mealType: form.mealType,
      foodName: form.foodName.trim(),
      amount: Number(form.amount) || 0,
      photoUrl: photoUrl ?? null,
      memo: null,
      calories: form.calories ? Number(form.calories) : null,
      carbs: form.carbs,
      protein: form.protein,
      fat: form.fat,
      diningType: form.diningType,
      tasteRating: form.tasteRating,
    });
    setSaving(false);
    onClose();
  };

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
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                {editRecord ? '기록 수정' : stepTitles[step]}
              </span>
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

          {/* Step 3: 음식 이름 */}
          {(step === 3 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>음식 이름</p>}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <Search size={16} color={t.textMuted} />
                <input
                  autoFocus={step === 3}
                  value={form.foodName}
                  onChange={e => set({ foodName: e.target.value })}
                  placeholder="음식명 입력 (예: 김치찌개)"
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 14, color: t.text }}
                  onKeyDown={e => { if (e.key === 'Enter' && !editRecord) nextStep(); }}
                />
                <VoiceInputButton onResult={text => set({ foodName: text })} />
              </div>

              {/* 영양 검색 결과 */}
              {nutritionLoading && (
                <div className="flex items-center gap-2 px-1 py-2" style={{ fontSize: 12, color: t.textMuted }}>
                  <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: t.accent, borderTopColor: 'transparent' }} />
                  식약처 DB 검색 중...
                </div>
              )}
              {showResults && !nutritionLoading && (
                nutritionResults.length > 0 ? (
                  <div className="rounded-xl overflow-hidden mb-3"
                    style={{ border: `1px solid ${t.border}`, backgroundColor: t.card }}>
                    {nutritionResults.map((r, i) => (
                      <button key={i}
                        className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2"
                        style={{ borderBottom: i < nutritionResults.length - 1 ? `1px solid ${t.border}` : 'none' }}
                        onClick={() => {
                          set({
                            foodName: r.foodName,
                            calories: String(r.calories),
                            carbs: r.carbs,
                            protein: r.protein,
                            fat: r.fat,
                          });
                          setShowResults(false);
                        }}>
                        <div className="min-w-0 flex-1">
                          <p style={{ fontSize: 13, color: t.text }} className="truncate">{r.foodName}</p>
                          <p style={{ fontSize: 11, color: t.textMuted }}>
                            탄 {r.carbs}g · 단 {r.protein}g · 지 {r.fat}g
                            {r.servingSize !== 100 && ` (${r.servingSize}g 기준)`}
                          </p>
                        </div>
                        <span className="flex-shrink-0" style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>
                          {r.calories} kcal
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-1 py-2 mb-2" style={{ fontSize: 12, color: t.textMuted }}>
                    검색 결과 없음 — 직접 칼로리를 입력해주세요
                  </div>
                )
              )}

              {!editRecord && (
                <button onClick={nextStep} disabled={!form.foodName.trim()}
                  className="w-full py-3.5 rounded-2xl mt-2"
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

          {/* Step 6: 칼로리 */}
          {(step === 6 || editRecord) && (
            <div className={editRecord ? 'mb-5' : ''}>
              {editRecord && <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>칼로리</p>}
              <div className="w-full flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.calories}
                  onChange={e => set({ calories: e.target.value })}
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent outline-none text-right"
                  style={{ fontSize: 22, fontWeight: 600, color: t.accent }}
                  onKeyDown={e => { if (e.key === 'Enter' && !editRecord) nextStep(); }}
                />
                <span className="flex-shrink-0" style={{ fontSize: 16, color: t.textSub }}>kcal</span>
              </div>
              {form.carbs != null && (
                <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6, textAlign: 'center' }}>
                  탄수화물 {form.carbs}g · 단백질 {form.protein}g · 지방 {form.fat}g
                </p>
              )}
              {!editRecord && (
                <div className="flex gap-2 mt-3">
                  <button onClick={nextStep}
                    disabled={!form.calories}
                    className="flex-1 py-3.5 rounded-2xl"
                    style={{
                      backgroundColor: form.calories ? t.accent : t.bgSub,
                      color: form.calories ? '#fff' : t.textMuted,
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
  const [editRecord, setEditRecord] = useState<FoodRecord | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayRecords = foodRecords.filter(r => r.date === today);

  const openAdd = useCallback((meal: MealType) => {
    setEditRecord(undefined);
    setSheetMeal(meal);
    setShowSheet(true);
  }, []);

  const openEdit = useCallback((r: FoodRecord) => {
    setEditRecord(r);
    setShowSheet(true);
  }, []);

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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: t.text }}>🍽️ 식단 기록</h1>
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
