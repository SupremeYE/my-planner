// 습관 계산 유틸 — 순수 함수 모음. HabitsView·DashboardView·ProfileView·RoutinesView 공용.
// (기존 HabitsView.tsx 내부에 흩어져 있던 계산 유틸을 로직 변경 없이 이 모듈로 이동 —
//  다른 뷰가 HabitsView 에서 직접 import 하던 구조를 없애기 위함. getRangeCount 만 컴포넌트
//  클로저 변수였던 todayDate 를 인자로 노출했을 뿐 본문 로직은 동일하다.)
import { format, startOfWeek, addDays } from 'date-fns';
import { Habit, getLogicalToday } from '../store';

// 스트릭 반환 — 유형에 따라 단위가 다르므로(일 vs 주) 호출부가 라벨을 구분할 수 있게 한다.
export type HabitStreak = { count: number; unit: 'day' | 'week' };

// 스트릭 계산 공용 입력 — Habit 과 Routine(weekly/weeklyTarget 없음)이 모두 만족하는 최소 구조.
type HabitStreakInput = {
  checkedDates: string[];
  repeat?: 'daily' | 'weekday' | 'weekend' | 'custom' | 'weekly';
  repeatDays?: number[];
  weeklyTarget?: number;
};

// 습관/루틴 스트릭(연속 달성) 공용 계산. 4개 뷰(습관·루틴·대시보드·프로필)가 공유한다.
// 기준 '오늘'은 getLogicalToday()(dayEndHour 롤오버 반영), 날짜 비교는 문자열 + 'T12:00:00' 정오 앵커.
// (기존 getStreak 의 안전한 부분 — 문자열 비교·정오 앵커·"오늘 유예" — 을 그대로 계승)
//   - daily: 하루라도 빠지면 끊김
//   - weekday/weekend/custom: 해당 안 되는 요일은 건너뜀(끊지 않음) — isHabitApplicableOnDate 재사용
//   - weekly: 연속 단위가 '주'. 한 주 checkedDates 수 >= weeklyTarget 이면 그 주 달성, 연속 달성 주 수 반환
// 진행 중인 '오늘'(일 단위)·'이번 주'(주 단위)는 아직 미완이어도 스트릭을 끊지 않는다(유예).
export function getHabitStreak(habit: HabitStreakInput): HabitStreak {
  const checked = habit.checkedDates;
  const isWeekly = habit.repeat === 'weekly';
  if (!checked?.length) return { count: 0, unit: isWeekly ? 'week' : 'day' };
  const todayStr = getLogicalToday();

  // ── weekly(주 N회): 연속 단위 = 주 ──────────────────────────────
  // 주 범위 판정은 getRangeCount 과 동일(toDateKey 문자열 비교 + weekStartsOn:1).
  if (isWeekly) {
    const target = habit.weeklyTarget && habit.weeklyTarget > 0 ? habit.weeklyTarget : 1;
    const perWeek = new Map<string, number>();
    checked.forEach(cd => {
      const wk = toDateKey(startOfWeek(new Date(cd + 'T12:00:00'), { weekStartsOn: 1 }));
      perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1);
    });
    let weekStart = startOfWeek(new Date(todayStr + 'T12:00:00'), { weekStartsOn: 1 });
    // 이번 주는 진행 중 → 미달이어도 끊지 않고 유예(지난 주부터 카운트 시작).
    if ((perWeek.get(toDateKey(weekStart)) ?? 0) < target) weekStart = addDays(weekStart, -7);
    let count = 0;
    while ((perWeek.get(toDateKey(weekStart)) ?? 0) >= target) {
      count++;
      weekStart = addDays(weekStart, -7);
    }
    return { count, unit: 'week' };
  }

  // ── daily / weekday / weekend / custom: 연속 단위 = 일 ───────────
  const checkedSet = new Set(checked);
  const oldest = [...checked].sort()[0];
  let count = 0;
  let cursor = new Date(todayStr + 'T12:00:00');
  while (true) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (isHabitApplicableOnDate(habit as Habit, cursor)) {
      if (checkedSet.has(key)) {
        count++;
      } else if (key === todayStr) {
        // 오늘은 아직 진행 중 → 유예(끊지 않음, 카운트 없음). 지난 예정일 미완은 아래 break.
      } else {
        break; // 해당 요일(예정일)인데 미완 → 스트릭 종료
      }
    }
    // 해당 안 되는 요일은 건너뜀(끊지 않음)
    if (key <= oldest) break; // 가장 오래된 체크일 이전엔 기록이 없으므로 종료
    cursor = addDays(cursor, -1);
  }
  return { count, unit: 'day' };
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function normalizeDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isHabitApplicableOnDate(habit: Habit, date: Date): boolean {
  const dow = date.getDay();
  switch (habit.repeat) {
    case 'weekday':
      return dow >= 1 && dow <= 5;
    case 'weekend':
      return dow === 0 || dow === 6;
    case 'custom':
      return habit.repeatDays?.includes(dow) ?? false;
    case 'weekly':
      // 요일 무관 — 아무 날이나 체크 가능
      return true;
    case 'daily':
    default:
      return true;
  }
}

// 매주 N회 습관: 해당 날짜가 속한 주(월~일)의 달성 횟수/목표
// 주 범위 판정은 getRangeCount 과 동일하게 toDateKey(startOfWeek) 문자열 키 비교로 통일한다.
// (기존 Date 객체 비교는 weekEnd=일요일 00:00 인데 체크일은 정오라 일요일 체크가 범위 밖으로
//  떨어지는 경계 버그 — 그리드는 정상인데 배지만 누락돼 1/3 vs 0/3 로 어긋났다.)
export function getWeeklyProgress(habit: Habit, dateStr: string): { done: number; target: number } {
  const target = habit.weeklyTarget && habit.weeklyTarget > 0 ? habit.weeklyTarget : 1;
  const weekKey = toDateKey(startOfWeek(new Date(dateStr + 'T12:00:00'), { weekStartsOn: 1 }));
  let done = 0;
  (habit.checkedDates || []).forEach(cd => {
    const cdWeekKey = toDateKey(startOfWeek(new Date(cd + 'T12:00:00'), { weekStartsOn: 1 }));
    if (cdWeekKey === weekKey) done += 1;
  });
  return { done, target };
}

// 기간(dates) 내 달성 합계/총 대상 수. todayDate 는 미래 셀 제외 기준(구 컴포넌트 클로저 변수 → 인자화).
export function getRangeCount(habit: Habit, dates: Date[], todayDate: Date): { done: number; total: number } {
  // 매주 N회 습관: 목표는 주간 횟수 × (지난 주 수), 달성은 체크한 날 수
  if (habit.repeat === 'weekly') {
    const target = habit.weeklyTarget && habit.weeklyTarget > 0 ? habit.weeklyTarget : 1;
    const weekKeys = new Set<string>();
    let done = 0;
    dates.forEach(date => {
      if (date.getTime() > todayDate.getTime()) return;
      weekKeys.add(toDateKey(startOfWeek(date, { weekStartsOn: 1 })));
      if (habit.checkedDates.includes(toDateKey(date))) done += 1;
    });
    return { done, total: target * weekKeys.size };
  }
  let done = 0;
  let total = 0;
  dates.forEach(date => {
    if (date.getTime() > todayDate.getTime()) return;
    if (!isHabitApplicableOnDate(habit, date)) return;
    total += 1;
    if (habit.checkedDates.includes(toDateKey(date))) done += 1;
  });
  return { done, total };
}
