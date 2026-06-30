import { useCallback, useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { useRealtimeSync } from './useRealtimeSync';

// 일간 "오늘 기록" 칩 집약 훅 (Stage 2.5 — Stage 3 오늘 허브에서 소비).
// 9개 도메인의 summaryForDate 를 선택된 "논리 날짜" 기준으로 Promise.all 병렬 조회한다.
// 각 도메인 결과는 데이터가 없으면 null. 표시 텍스트 포맷은 소비 측(Stage 3)에서 담당.
// Realtime: 관련 테이블 변경 시 자동 재조회(새로고침 없이 PC↔모바일 즉시 반영).

type Cond = Awaited<ReturnType<typeof db.conditionRecords.summaryForDate>>;
type Food = Awaited<ReturnType<typeof db.foodRecords.summaryForDate>>;
type Sleep = Awaited<ReturnType<typeof db.selfCareRecords.summaryForDate>>;
type Workout = Awaited<ReturnType<typeof db.workouts.summaryForDate>>;
type Reading = Awaited<ReturnType<typeof db.readingLogs.summaryForDate>>;
type Culture = Awaited<ReturnType<typeof db.cultureRecords.summaryForDate>>;
type Music = Awaited<ReturnType<typeof db.musicRecords.summaryForDate>>;
type Places = Awaited<ReturnType<typeof db.placeVisits.summaryForDate>>;
type MemoSum = Awaited<ReturnType<typeof db.memos.summaryForDate>>;

export interface DailySummaryState {
  loading: boolean;
  condition: Cond;
  food: Food;
  sleep: Sleep;
  workout: Workout;
  reading: Reading;
  culture: Culture;
  music: Music;
  places: Places;
  memo: MemoSum;
}

const EMPTY: DailySummaryState = {
  loading: true,
  condition: null, food: null, sleep: null, workout: null,
  reading: null, culture: null, music: null, places: null, memo: null,
};

export function useDailySummary(date: string) {
  const [state, setState] = useState<DailySummaryState>(EMPTY);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    Promise.all([
      db.conditionRecords.summaryForDate(date),
      db.foodRecords.summaryForDate(date),
      db.selfCareRecords.summaryForDate(date),
      db.workouts.summaryForDate(date),
      db.readingLogs.summaryForDate(date),
      db.cultureRecords.summaryForDate(date),
      db.musicRecords.summaryForDate(date),
      db.placeVisits.summaryForDate(date),
      db.memos.summaryForDate(date),
    ]).then(([condition, food, sleep, workout, reading, culture, music, places, memo]) => {
      if (cancelled) return; // 날짜가 바뀌면 이전 응답 무시(스테일 방지)
      setState({ loading: false, condition, food, sleep, workout, reading, culture, music, places, memo });
    });
    return () => { cancelled = true; };
  }, [date, tick]);

  // 관련 테이블 Realtime 구독 → 변경 시 재조회
  useRealtimeSync('condition_records', refresh);
  useRealtimeSync('food_records', refresh);
  useRealtimeSync('self_care_records', refresh);
  useRealtimeSync('workout_logs', refresh);
  useRealtimeSync('reading_logs', refresh);
  useRealtimeSync('culture_records', refresh);
  useRealtimeSync('music_records', refresh);
  useRealtimeSync('place_visits', refresh);
  useRealtimeSync('memos', refresh);

  return { ...state, refresh };
}
