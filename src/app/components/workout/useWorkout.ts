import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../../../lib/db';
import type { Exercise, WorkoutLog, RoutineDay } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  todayISO, todayDow, isoNDaysAgo,
  calcStreak, lastTrainedByBodyPart, MAIN_BODY_PARTS,
} from './workoutUtils';

// 기록 시트 대상(신규/편집 공용)
export type RecordTarget = { exercise: Exercise; performedOn: string; editingLog?: WorkoutLog };

// ── 공유 데이터 훅 ──────────────────────────────────────────────────────────────
// 운동 탭의 모든 쿼리/상태/파생값/CRUD 진입점/시트 상태를 한 벌로 모은다.
// WorkoutTabMobile / WorkoutTabDesktop 이 같은 훅 인스턴스를 공유 → 로직 1벌, 레이아웃만 분리.
export function useWorkout() {
  const today = todayISO();

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>([]);
  const [growthExId, setGrowthExId] = useState<string | null>(null);
  const [growth, setGrowth] = useState<{ date: string; weight: number }[]>([]);

  // 시트 상태(표현은 레이아웃별로 다르지만 열림 상태는 공유)
  const [picker, setPicker] = useState(false);
  const [record, setRecord] = useState<RecordTarget | null>(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [allLogs, days] = await Promise.all([db.workouts.listAll(), db.workouts.listRoutineDays()]);
    setLogs(allLogs);
    setRoutineDays(days);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Realtime — PC↔모바일 즉시 반영 (훅에서 단일 구독)
  useRealtimeSync('workout_logs', refresh);
  useRealtimeSync('workout_sets', refresh);
  useRealtimeSync('routine_days', refresh);
  useRealtimeSync('routine_exercises', refresh);

  // ── 파생값 ──
  const loggedExerciseIds = useMemo(() => new Set(logs.map(l => l.exerciseId)), [logs]);
  const performedDates = useMemo(() => Array.from(new Set(logs.map(l => l.performedOn))), [logs]);
  const streak = useMemo(() => calcStreak(performedDates), [performedDates]);
  const lastWorkout = performedDates.length ? performedDates.reduce((a, b) => (a > b ? a : b)) : null;
  const todayLogs = useMemo(() => logs.filter(l => l.performedOn === today), [logs, today]);
  const lastByPart = useMemo(() => lastTrainedByBodyPart(logs), [logs]);

  const todayRoutine = routineDays.find(d => d.dayOfWeek === todayDow() && d.exercises.length > 0) ?? null;

  // 제안: 오늘 루틴 우선, 없으면 가장 오래 쉰 부위 추천(한 번도 안 한 부위 최우선)
  const restedPart = useMemo(() => {
    let best: { part: string; date: string | null } | null = null;
    for (const part of MAIN_BODY_PARTS) {
      const date = lastByPart[part] ?? null;
      if (!best) { best = { part, date }; continue; }
      if (date === null && best.date !== null) { best = { part, date }; }
      else if (date !== null && best.date !== null && date < best.date) { best = { part, date }; }
    }
    return best;
  }, [lastByPart]);

  const suggestion = todayRoutine
    ? `오늘 루틴은 ${todayRoutine.label || '운동'}`
    : restedPart
      ? `${restedPart.part} 운동할 때가 됐어요`
      : '오늘 첫 운동을 기록해보세요';

  // 성장 그래프 대상: 근력 종목 중 기록 있는 것들
  const strengthExercises = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const l of logs) {
      if (l.exercise && l.exercise.type === '근력' && !map.has(l.exerciseId)) map.set(l.exerciseId, l.exercise);
    }
    return Array.from(map.values());
  }, [logs]);

  useEffect(() => {
    if (!growthExId && strengthExercises.length) setGrowthExId(strengthExercises[0].id);
  }, [strengthExercises, growthExId]);

  useEffect(() => {
    if (!growthExId) { setGrowth([]); return; }
    db.workouts.growthSeries(growthExId, isoNDaysAgo(30)).then(setGrowth);
  }, [growthExId, logs]);

  const openRecordNew = useCallback((exercise: Exercise) => {
    setPicker(false);
    setRecord({ exercise, performedOn: today });
  }, [today]);

  return {
    today, logs, routineDays, growth, growthExId, setGrowthExId,
    loggedExerciseIds, streak, lastWorkout, todayLogs, lastByPart,
    todayRoutine, restedPart, suggestion, strengthExercises,
    picker, setPicker, record, setRecord, routineOpen, setRoutineOpen, historyOpen, setHistoryOpen,
    openRecordNew, refresh,
  };
}

export type UseWorkout = ReturnType<typeof useWorkout>;

// 뷰포트 분기 보조 — 시트 표현(모바일 바텀시트 / PC 중앙 모달)과
// 주간 루틴 에디터(단일 요일 / 7열 그리드)를 고르는 데만 사용. 레이아웃 본체는 Tailwind lg: 로 분기.
export function useIsDesktop(breakpoint = 1024): boolean {
  const query = `(min-width: ${breakpoint}px)`;
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return isDesktop;
}
