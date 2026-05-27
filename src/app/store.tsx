import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format, getISOWeek, getYear, subDays, addDays, parseISO } from 'date-fns';
import { db } from '../lib/db';

// ───── Types ─────
export type TodoStatus = 'active' | 'done' | 'cancelled' | 'snoozed' | 'backlog' | 'inProgress';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Todo {
  id: string;
  text: string;
  date: string | null;
  dueDate?: string | null;
  status: TodoStatus;
  isTop3: boolean;
  planStart?: string;
  planEnd?: string;
  doStart?: string;
  doEnd?: string;
  /** 타이머 완료 시 실제 경과 시간(초). 타임라인 막대는 분 단위 doEnd와 별개로 집계·표시에 사용 */
  doElapsedSec?: number;
  category?: string;
  projectId?: string;
  tags?: string[];
  // 반복 일정 필드
  recurrenceRule?: 'daily' | 'weekly' | 'weekdays' | 'custom';
  recurrenceDays?: number[];       // 0=일 ~ 6=토 (custom 전용)
  recurrenceEndDate?: string;      // yyyy-MM-dd, null이면 무기한
  recurrenceParentId?: string;     // 원본 이벤트 ID (예외 인스턴스가 참조)
  isException?: boolean;           // 이 인스턴스만 수정·삭제된 예외
}

export interface Event {
  id: string;
  sourceEventId?: string;
  title: string;
  date: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  location?: string;
  linkUrl?: string;
  memo?: string;
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly';
  repeatEndDate?: string;
  alertMinutes?: 0 | 10 | 30 | 60;
  projectId?: string;
  color?: string;
  startAt?: string;
  endAt?: string;
  isOccurrence?: boolean;
  tags?: string[];
}

export interface Habit {
  id: string;
  name: string;
  checkedDates: string[];
  icon?: string;
  repeat?: 'daily' | 'weekday' | 'weekend' | 'custom';
  repeatDays?: number[];
  goalText?: string;
  alarmTime?: string;
  category?: string;
  color?: string;
  habitType: 'check' | 'count' | 'time' | 'value' | 'memo';
  targetValue?: number;
  valueUnit?: string;
  dailyProgress: Record<string, number>;
  dailyMemos: Record<string, string>;
  reason?: string;
}

export interface HabitMonthlyMemo {
  id: string;
  habitId: string;   // 실제 습관 id, 또는 '__review__' (전체 월간 회고)
  year: number;
  month: number;     // 1-12
  memo: string;
  whatWorked: string;
  whatDidntWork: string;
  nextMonth: string;
}

export interface RoutineStep {
  title: string;
  durationMinutes: number;
  youtubeUrl?: string;
}

export interface Routine {
  id: string;
  name: string;
  icon: string;
  startTime: string;
  duration: number; // backward compat: auto-computed from routineSteps
  steps: string[]; // backward compat
  stepYoutubeUrls?: string[]; // backward compat
  routineSteps?: RoutineStep[]; // structured steps (new)
  checkedDates: string[];
  repeat?: 'daily' | 'weekday' | 'weekend' | 'custom';
  repeatDays?: number[]; // 0=일 ~ 6=토
}

/** routineSteps 합산 or 기존 duration 반환 */
export function getRoutineTotalMinutes(routine: Routine): number {
  if (routine.routineSteps && routine.routineSteps.length > 0) {
    return routine.routineSteps.reduce((s, step) => s + (step.durationMinutes || 0), 0);
  }
  return routine.duration;
}

/** routineSteps가 있으면 반환, 없으면 구버전 steps에서 마이그레이션 */
export function getRoutineSteps(routine: Routine): RoutineStep[] {
  if (routine.routineSteps && routine.routineSteps.length > 0) {
    return routine.routineSteps;
  }
  // 구버전 폴백: 단계당 1분으로 마이그레이션
  return (routine.steps ?? []).map((title, i) => ({
    title,
    durationMinutes: 1,
    youtubeUrl: routine.stepYoutubeUrls?.[i] || undefined,
  }));
}

export interface SelfCareRecord {
  id: string;
  date: string;
  category: 'exercise' | 'study' | 'beauty' | 'sleep';
  content: string;
  duration: number; // minutes
  sleepStart?: string; // "HH:mm" — sleep category only
  sleepEnd?: string;   // "HH:mm" — sleep category only
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DiningType = 'home' | 'delivery' | 'restaurant' | 'coffee';
export type TasteRating = 'good' | 'normal' | 'bad';

export interface FoodRecord {
  id: string;
  date: string;           // yyyy-MM-dd
  mealType: MealType;
  foodName: string;
  amount: number;         // 원
  photoUrl?: string | null;
  memo?: string | null;
  calories?: number | null;
  carbs?: number | null;
  protein?: number | null;
  fat?: number | null;
  diningType?: DiningType | null;
  tasteRating?: TasteRating | null;
  tasteMemo?: string | null;
}

export interface PeriodRecord {
  id: string;
  startDate: string;        // yyyy-MM-dd
  endDate: string | null;   // yyyy-MM-dd
  symptoms: string[];       // ["두통","복통",...]
  flowLevel: 'light' | 'medium' | 'heavy' | null;
  memo: string | null;
}

export type EmotionLevel = 1 | 2 | 3 | 4 | 5;

export interface ReviewRecord {
  id: string;
  date: string;
  types: string[];
  emotion?: EmotionLevel;
  emotionMemo?: string;
  gratitude?: string[];
  kptKeep?: string;
  kptProblem?: string;
  kptTry?: string;
  happiness?: string;
  dailySummary?: string;
  dailyGood?: string;
  dailyImprove?: string;
}

export interface WeeklyReview {
  id: string;
  weekKey: string;
  good: string;
  hard: string;
  nextWeek: string;
}

export interface MonthlyReview {
  id: string;
  month: string;
  achievement: string;
  nextFocus: string;
}

export interface WeeklyGoal {
  id: string;
  text: string;
  done: boolean;
  monthlyGoalId?: string;
  weekKey: string;
}

export interface MonthlyGoal {
  id: string;
  text: string;
  month: string;
  projectId?: string;
  /** 연간 목표 1개에 연결 (레거시 행은 비어 있을 수 있음) */
  annualGoalId?: string;
}

/** 연도별 연간 정체성·핵심 가치 (키: "2026" 등) */
export type AnnualYearProfile = { identity: string; values: string[] };

export function emptyAnnualYearProfile(): AnnualYearProfile {
  return { identity: '', values: [] };
}

export function parseAnnualProfiles(raw: unknown): Record<string, AnnualYearProfile> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, AnnualYearProfile> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(k)) continue;
    const o = v as { identity?: unknown; values?: unknown };
    out[k] = {
      identity: typeof o.identity === 'string' ? o.identity : '',
      values: Array.isArray(o.values) ? o.values.filter((x): x is string => typeof x === 'string') : [],
    };
  }
  return out;
}

export function getAnnualProfileForYear(
  profiles: Record<string, AnnualYearProfile> | undefined,
  year: number
): AnnualYearProfile {
  return profiles?.[String(year)] ?? emptyAnnualYearProfile();
}

export interface AnnualGoal {
  id: string;
  year: number;
  text: string;
  done: boolean;
}

export interface QuarterlyGoal {
  id: string;
  year: number;
  quarter: number; // 1-4
  text: string;
  done: boolean;
}

export interface BrainstormItem {
  id: string;
  text: string;
  date: string;
  weekKey?: string;
}

export type TimerMode = 'pomodoro' | 'stopwatch';

export interface ActiveTimer {
  todoId: string;
  mode: TimerMode;
  startedAt: number;
  startHHMM: string;
  pausedDurationMs: number;
  isPaused: boolean;
  pauseStartedAt: number | null;
  pomoDurationSec: number;
}

export interface TimelineLog {
  id: string;
  date: string;
  time: string;
  text: string;
  color?: string;
  icon?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'paused';
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  date: string;
  done: boolean;
}

// ───── Helpers ─────
export const today = format(new Date(), 'yyyy-MM-dd');

export function getWeekKey(date: Date): string {
  const week = getISOWeek(date);
  const year = getYear(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ACTIVE_TIMER_STORAGE_KEY = 'planner-active-focus-timer';

function getTimerEffectiveNowMs(timer: ActiveTimer, nowMs = Date.now()): number {
  if (timer.isPaused && timer.pauseStartedAt != null) return timer.pauseStartedAt;
  return nowMs;
}

export function getTimerElapsedSec(timer: ActiveTimer, nowMs = Date.now()): number {
  const elapsedMs = Math.max(0, getTimerEffectiveNowMs(timer, nowMs) - timer.startedAt - timer.pausedDurationMs);
  return Math.floor(elapsedMs / 1000);
}

export function getTimerRemainingSec(timer: ActiveTimer, nowMs = Date.now()): number {
  if (timer.mode !== 'pomodoro') return getTimerElapsedSec(timer, nowMs);
  return Math.max(0, timer.pomoDurationSec - getTimerElapsedSec(timer, nowMs));
}

function getTimerEndHHMM(startHHMM: string, elapsedSec: number): string {
  const roundedMinutes = Math.max(1, Math.ceil(elapsedSec / 60));
  return minutesToTime(timeToMinutes(startHHMM) + roundedMinutes);
}

const currentWeekKey = getWeekKey(new Date());

// ── App Settings ──
export interface AppSettings {
  showQuarterlyGoals: boolean;
  showWeeklyKpt: boolean;
  showWeeklyHappiness: boolean;
  showMonthlyKpt: boolean;
  showHabitHeatmap: boolean;
  habitAlarmDefault: string;
  globalAffirmation: string;
  weekStartsOn: 0 | 1;
  mobileWeekDays: 2 | 3;
  /** 연도 문자열 키 → 정체성·가치 */
  annualProfiles: Record<string, AnnualYearProfile>;
  /** DB/구버전 호환용 (현재 연도 프로필과 동기화 가능) */
  annualIdentity: string;
  annualValues: string[];
  /** 식단 목표 (미설정 시 undefined) */
  foodGoalDelivery?: number;
  foodGoalRestaurant?: number;
  foodGoalCalories?: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showQuarterlyGoals: false,
  showWeeklyKpt: false,
  showWeeklyHappiness: false,
  showMonthlyKpt: false,
  showHabitHeatmap: false,
  habitAlarmDefault: '',
  globalAffirmation: '',
  weekStartsOn: 1,
  mobileWeekDays: 3,
  annualProfiles: {},
  annualIdentity: '',
  annualValues: [],
};

// ── Daily Affirmation ──
export const DEFAULT_AFFIRMATIONS = [
  "오늘 나는 내가 원하는 삶을 만들어가고 있다.",
  "나는 충분히 능력 있고, 충분히 가치 있는 사람이다.",
  "작은 진전도 앞으로 나아가는 것이다. 나는 성장하고 있다.",
  "나는 오늘 내가 통제할 수 있는 것에 집중한다.",
  "어려움은 나를 더 강하게 만드는 경험이다.",
  "나는 오늘도 최선을 다할 준비가 되어 있다.",
  "내 시간과 에너지는 소중하다. 나는 현명하게 사용한다.",
  "나는 배우고 성장하는 것을 즐긴다.",
  "긍정적인 변화는 지금 이 순간부터 시작된다.",
  "나는 내 목표를 향해 꾸준히 나아가고 있다.",
  "오늘 하루도 나만의 특별한 순간들로 가득할 것이다.",
  "나는 감사함으로 하루를 시작한다.",
  "나는 스스로를 믿고 나의 가능성을 신뢰한다.",
  "완벽하지 않아도 괜찮다. 시작하는 것이 중요하다.",
  "나는 집중하고, 실행하고, 완성한다.",
];

// ───── Context ─────
interface PlannerContextType {
  isLoading: boolean;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  todos: Todo[];
  events: Event[];
  habits: Habit[];
  weeklyGoals: WeeklyGoal[];
  monthlyGoals: MonthlyGoal[];
  annualGoals: AnnualGoal[];
  quarterlyGoals: QuarterlyGoal[];
  brainstormItems: BrainstormItem[];
  brainstormMemos: Record<string, string>;
  activeTimer: ActiveTimer | null;
  projects: Project[];
  milestones: Milestone[];
  tags: Tag[];
  routines: Routine[];
  selfCareRecords: SelfCareRecord[];
  reviewRecords: ReviewRecord[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  timelineLogs: TimelineLog[];
  dailyAffirmations: Record<string, string>;
  setDailyAffirmation: (date: string, text: string) => void;

  // App settings
  appSettings: AppSettings;
  updateAppSettings: (s: Partial<AppSettings>) => void;

  // Todo actions
  addTodo: (todo: Omit<Todo, 'id'>) => void;
  updateTodo: (id: string, changes: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  toggleTop3: (id: string) => void;
  deleteRecurringTodo: (parentId: string, instanceDate: string, scope: 'this' | 'future' | 'all') => void;
  updateRecurringTodo: (parentId: string, instanceDate: string, changes: Partial<Todo>, scope: 'this' | 'future' | 'all') => void;

  // Event actions
  addEvent: (event: Omit<Event, 'id'>) => void;
  updateEvent: (id: string, changes: Partial<Event>) => void;
  deleteEvent: (id: string) => void;

  // Habit actions
  addHabit: (name: string) => void;
  addHabitFull: (habit: Omit<Habit, 'id'>) => void;
  updateHabit: (id: string, changes: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (id: string, date: string) => void;
  updateHabitProgress: (id: string, date: string, value: number) => void;
  updateHabitMemo: (id: string, date: string, memo: string) => void;

  // HabitMonthlyMemo actions
  habitMonthlyMemos: HabitMonthlyMemo[];
  setHabitMonthlyMemo: (
    habitId: string,
    year: number,
    month: number,
    data: Partial<Omit<HabitMonthlyMemo, 'id' | 'habitId' | 'year' | 'month'>>
  ) => void;

  // Routine actions
  addRoutine: (routine: Omit<Routine, 'id'>) => void;
  updateRoutine: (id: string, changes: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  toggleRoutineDate: (id: string, date: string) => void;

  // Self-care actions
  addSelfCareRecord: (record: Omit<SelfCareRecord, 'id'>) => void;
  updateSelfCareRecord: (id: string, changes: Partial<Omit<SelfCareRecord, 'id'>>) => void;
  deleteSelfCareRecord: (id: string) => void;

  // Food actions
  foodRecords: FoodRecord[];
  addFoodRecord: (record: Omit<FoodRecord, 'id'>) => void;
  updateFoodRecord: (id: string, changes: Partial<Omit<FoodRecord, 'id'>>) => void;
  deleteFoodRecord: (id: string) => void;

  // Period actions
  periodRecords: PeriodRecord[];
  addPeriodRecord: (record: Omit<PeriodRecord, 'id'>) => void;
  updatePeriodRecord: (id: string, changes: Partial<PeriodRecord>) => void;
  deletePeriodRecord: (id: string) => void;

  // Review actions
  addReviewRecord: (record: Omit<ReviewRecord, 'id'>) => void;
  updateReviewRecord: (id: string, changes: Partial<ReviewRecord>) => void;
  deleteReviewRecord: (id: string) => void;
  addWeeklyReview: (review: Omit<WeeklyReview, 'id'>) => void;
  updateWeeklyReview: (id: string, changes: Partial<WeeklyReview>) => void;
  addMonthlyReview: (review: Omit<MonthlyReview, 'id'>) => void;
  updateMonthlyReview: (id: string, changes: Partial<MonthlyReview>) => void;

  // Weekly goal actions
  addWeeklyGoal: (text: string, monthlyGoalId: string | undefined, weekKey: string) => void;
  toggleWeeklyGoal: (id: string) => void;
  deleteWeeklyGoal: (id: string) => void;

  // Monthly goal actions
  addMonthlyGoal: (text: string, annualGoalId: string, month: string, projectId?: string) => void;
  updateMonthlyGoal: (id: string, changes: Partial<Pick<MonthlyGoal, 'text' | 'annualGoalId' | 'projectId'>>) => void;
  deleteMonthlyGoal: (id: string) => void;

  // Annual goal actions
  addAnnualGoal: (text: string, year: number) => void;
  toggleAnnualGoal: (id: string) => void;
  deleteAnnualGoal: (id: string) => void;

  // Quarterly goal actions
  addQuarterlyGoal: (text: string, year: number, quarter: number) => void;
  toggleQuarterlyGoal: (id: string) => void;
  deleteQuarterlyGoal: (id: string) => void;

  // Brainstorm actions
  addBrainstormItem: (text: string, date: string) => void;
  deleteBrainstormItem: (id: string) => void;
  brainstormToTodo: (id: string, date?: string) => void;
  brainstormToEvent: (id: string, eventData: { date: string; startTime?: string; endTime?: string; location?: string; tags?: string[] }) => void;
  setBrainstormMemo: (date: string, text: string) => void;
  addWeeklyBrainstorm: (text: string, weekKey: string) => void;
  weeklyBrainstormAssign: (id: string, date: string) => void;

  // Timer actions
  startTimer: (todoId: string, options?: { mode?: TimerMode; pomoDurationSec?: number }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;

  // Project actions
  addProject: (project: Omit<Project, 'id'>) => void;
  updateProject: (id: string, changes: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Milestone actions
  addMilestone: (milestone: Omit<Milestone, 'id'>) => void;
  toggleMilestone: (id: string) => void;
  deleteMilestone: (id: string) => void;

  // Tag actions
  addTag: (name: string, color: string) => void;
  updateTag: (id: string, changes: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  // Timeline log actions
  addTimelineLog: (log: Omit<TimelineLog, 'id'>) => void;
  deleteTimelineLog: (id: string) => void;

  // Timeline hours (global settings)
  dayStartHour: number;
  dayEndHour: number;
  setDayHours: (s: number, e: number) => void;
}

const CONTEXT_KEY = '__PLANNER_CONTEXT__';
const PlannerContext: React.Context<PlannerContextType | null> =
  (globalThis as any)[CONTEXT_KEY] ??
  ((globalThis as any)[CONTEXT_KEY] = createContext<PlannerContextType | null>(null));

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayStartHour, setDayStartHour] = useState(4);
  const [dayEndHour, setDayEndHour] = useState(26);

  // ── Supabase 연동 상태 ──
  const [todos, setTodos] = useState<Todo[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitMonthlyMemos, setHabitMonthlyMemos] = useState<HabitMonthlyMemo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selfCareRecords, setSelfCareRecords] = useState<SelfCareRecord[]>([]);
  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>([]);
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>([]);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLog[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [annualGoals, setAnnualGoals] = useState<AnnualGoal[]>([]);
  const [quarterlyGoals, setQuarterlyGoals] = useState<QuarterlyGoal[]>([]);
  const [brainstormItems, setBrainstormItems] = useState<BrainstormItem[]>([]);
  const [brainstormMemos, setBrainstormMemos] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Tag[]>([]);

  // ── in-memory 상태 ──
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]); // Supabase 연동은 db.routines 통해 진행
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);
  const [dailyAffirmations, setDailyAffirmations] = useState<Record<string, string>>({});
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const wakeLockRef = useRef<any>(null);

  // ── 앱 시작 시 Supabase에서 데이터 로드 ──
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [
        todosData, habitsData, projectsData, milestonesData,
        selfCareData, reviewData, timelineData, settingsData,
        eventsData, weeklyGoalsData, monthlyGoalsData,
        brainstormItemsData, brainstormMemosData, tagsData, routinesData,
        periodData, habitMonthlyMemosData, annualGoalsData, quarterlyGoalsData,
        weeklyReviewsData, monthlyReviewsData, foodRecordsData,
      ] = await Promise.all([
        db.todos.fetchAll(),
        db.habits.fetchAll(),
        db.projects.fetchAll(),
        db.milestones.fetchAll(),
        db.selfCareRecords.fetchAll(),
        db.reviewRecords.fetchAll(),
        db.timelineLogs.fetchAll(),
        db.settings.fetch(),
        db.events.fetchAll(),
        db.weeklyGoals.fetchAll(),
        db.monthlyGoals.fetchAll(),
        db.brainstormItems.fetchAll(),
        db.brainstormMemos.fetchAll(),
        db.tags.fetchAll(),
        db.routines.fetchAll(),
        db.periodRecords.fetchAll(),
        db.habitMonthlyMemos.fetchAll(),
        db.annualGoals.fetchAll(),
        db.quarterlyGoals.fetchAll(),
        db.weeklyReviews.fetchAll(),
        db.monthlyReviews.fetchAll(),
        db.foodRecords.fetchAll(),
      ]);
      setTodos(todosData);
      setHabits(habitsData);
      setProjects(projectsData);
      setMilestones(milestonesData);
      setSelfCareRecords(selfCareData);
      setPeriodRecords(periodData);
      setHabitMonthlyMemos(habitMonthlyMemosData);
      setReviewRecords(reviewData);
      setTimelineLogs(timelineData);
      setDayStartHour(settingsData.dayStartHour);
      setDayEndHour(settingsData.dayEndHour);
      setAppSettings(prev => ({ ...prev, ...settingsData.appSettings }));
      setEvents(eventsData);
      setWeeklyGoals(weeklyGoalsData);
      const normalizedMonthly = monthlyGoalsData.map(mg => {
        if (mg.annualGoalId) return mg;
        const y = parseInt(mg.month.slice(0, 4), 10);
        const first = annualGoalsData.find(a => a.year === y);
        return first ? { ...mg, annualGoalId: first.id } : mg;
      });
      normalizedMonthly.forEach(g => {
        const orig = monthlyGoalsData.find(o => o.id === g.id);
        if (orig && g.annualGoalId && orig.annualGoalId !== g.annualGoalId) {
          db.monthlyGoals.upsert(g);
        }
      });
      setMonthlyGoals(normalizedMonthly);
      setBrainstormItems(brainstormItemsData);
      setBrainstormMemos(brainstormMemosData);
      setRoutines(routinesData);
      setTags(tagsData);
      setAnnualGoals(annualGoalsData);
      setQuarterlyGoals(quarterlyGoalsData);
      setWeeklyReviews(weeklyReviewsData);
      setMonthlyReviews(monthlyReviewsData);
      setFoodRecords(foodRecordsData);
      setIsLoading(false);
    };
    load();
  }, []);

  // ── Supabase Realtime 구독 (변경 감지 → 전체 재fetch) ──────────────────────
  useEffect(() => {
    // 각 테이블별 재fetch 함수
    const refetchers: Record<string, () => Promise<void>> = {
      todos:             async () => setTodos(await db.todos.fetchAll()),
      habits:            async () => setHabits(await db.habits.fetchAll()),
      projects:          async () => setProjects(await db.projects.fetchAll()),
      milestones:        async () => setMilestones(await db.milestones.fetchAll()),
      self_care_records: async () => setSelfCareRecords(await db.selfCareRecords.fetchAll()),
      review_records:    async () => setReviewRecords(await db.reviewRecords.fetchAll()),
      timeline_logs:     async () => setTimelineLogs(await db.timelineLogs.fetchAll()),
      events:            async () => setEvents(await db.events.fetchAll()),
      weekly_goals:      async () => setWeeklyGoals(await db.weeklyGoals.fetchAll()),
      monthly_goals:     async () => setMonthlyGoals(await db.monthlyGoals.fetchAll()),
      brainstorm_items:  async () => setBrainstormItems(await db.brainstormItems.fetchAll()),
      brainstorm_memos:  async () => setBrainstormMemos(await db.brainstormMemos.fetchAll()),
      tags:              async () => setTags(await db.tags.fetchAll()),
      routines:          async () => setRoutines(await db.routines.fetchAll()),
      period_records:    async () => setPeriodRecords(await db.periodRecords.fetchAll()),
      habit_monthly_memos: async () => setHabitMonthlyMemos(await db.habitMonthlyMemos.fetchAll()),
      annual_goals:      async () => setAnnualGoals(await db.annualGoals.fetchAll()),
      quarterly_goals:   async () => setQuarterlyGoals(await db.quarterlyGoals.fetchAll()),
      weekly_reviews:    async () => setWeeklyReviews(await db.weeklyReviews.fetchAll()),
      monthly_reviews:   async () => setMonthlyReviews(await db.monthlyReviews.fetchAll()),
      food_records:      async () => setFoodRecords(await db.foodRecords.fetchAll()),
    };

    const channels = Object.entries(refetchers).map(([table, refetch]) =>
      supabase
        .channel(`realtime-store:${table}`)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table }, () => {
          void refetch();
        })
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const newId = () => Math.random().toString(36).slice(2, 9);
  const newEventId = () => globalThis.crypto?.randomUUID?.() ?? `${newId()}-${Date.now()}`;

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLockRef.current) return;
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current?.addEventListener?.('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const completeTimer = useCallback((timer: ActiveTimer) => {
    const rawElapsedSec = getTimerElapsedSec(timer);
    const totalElapsedSec = timer.mode === 'pomodoro'
      ? Math.min(rawElapsedSec, timer.pomoDurationSec)
      : rawElapsedSec;
    const endHHMM = getTimerEndHHMM(timer.startHHMM, totalElapsedSec);

    setTodos(currentTodos => {
      const updated = currentTodos.map(t =>
        t.id === timer.todoId
          ? { ...t, status: 'done' as TodoStatus, doStart: timer.startHHMM, doEnd: endHHMM, doElapsedSec: totalElapsedSec }
          : t
      );
      const todo = updated.find(t => t.id === timer.todoId);
      if (todo) db.todos.upsert(todo);
      return updated;
    });
    setActiveTimer(null);
    window.localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const restoreTimerFromStorage = () => {
      try {
        const raw = window.localStorage.getItem(ACTIVE_TIMER_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          taskId: string;
          mode: TimerMode;
          startedAt: number;
          pausedDuration: number;
          isPaused: boolean;
          pomoDuration: number;
          pauseStartedAt?: number | null;
          startHHMM?: string;
        };

        if (!parsed?.taskId || !parsed?.startedAt) return;

        const restoredTimer: ActiveTimer = {
          todoId: parsed.taskId,
          mode: parsed.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch',
          startedAt: parsed.startedAt,
          startHHMM: parsed.startHHMM || format(new Date(parsed.startedAt), 'HH:mm'),
          pausedDurationMs: parsed.pausedDuration ?? 0,
          isPaused: !!parsed.isPaused,
          pauseStartedAt: parsed.isPaused ? (parsed.pauseStartedAt ?? Date.now()) : null,
          pomoDurationSec: parsed.mode === 'pomodoro' ? Math.max(60, parsed.pomoDuration ?? 25 * 60) : 0,
        };

        setActiveTimer(current => current ?? restoredTimer);
      } catch {
        window.localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
      }
    };

    restoreTimerFromStorage();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        restoreTimerFromStorage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!activeTimer) {
      window.localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
      void releaseWakeLock();
      return;
    }

    window.localStorage.setItem(ACTIVE_TIMER_STORAGE_KEY, JSON.stringify({
      taskId: activeTimer.todoId,
      mode: activeTimer.mode,
      startedAt: activeTimer.startedAt,
      pausedDuration: activeTimer.pausedDurationMs,
      isPaused: activeTimer.isPaused,
      pomoDuration: activeTimer.pomoDurationSec,
      pauseStartedAt: activeTimer.pauseStartedAt,
      startHHMM: activeTimer.startHHMM,
    }));

    if (activeTimer.isPaused || document.visibilityState !== 'visible') {
      void releaseWakeLock();
      return;
    }

    void requestWakeLock();
  }, [activeTimer, releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        void releaseWakeLock();
        return;
      }
      if (activeTimer && !activeTimer.isPaused) {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeTimer, releaseWakeLock, requestWakeLock]);

  // ── Todo actions ──
  const addTodo = useCallback((todo: Omit<Todo, 'id'>) => {
    const newTodo: Todo = { ...todo, id: newId(), tags: todo.tags ?? [] };
    setTodos(prev => [...prev, newTodo]);
    db.todos.upsert(newTodo);
  }, []);

  const updateTodo = useCallback((id: string, changes: Partial<Todo>) => {
    setTodos(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...changes } : t);
      const todo = updated.find(t => t.id === id);
      if (todo) db.todos.upsert(todo);
      return updated;
    });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => {
      return prev.filter(t => t.id !== id);
    });
    db.todos.delete(id);
  }, []);

  // 반복 일정 삭제 (scope: 'this' | 'future' | 'all')
  const deleteRecurringTodo = useCallback((parentId: string, instanceDate: string, scope: 'this' | 'future' | 'all') => {
    if (scope === 'all') {
      // 원본 + 모든 예외 삭제
      setTodos(prev => {
        const toDelete = prev.filter(t => t.id === parentId || t.recurrenceParentId === parentId);
        toDelete.forEach(t => db.todos.delete(t.id));
        return prev.filter(t => t.id !== parentId && t.recurrenceParentId !== parentId);
      });
    } else if (scope === 'future') {
      // 원본의 recurrenceEndDate를 instanceDate 하루 전으로 설정
      setTodos(prev => {
        const endDate = format(addDays(parseISO(instanceDate), -1), 'yyyy-MM-dd');
        const updated = prev.map(t => t.id === parentId ? { ...t, recurrenceEndDate: endDate } : t);
        const parent = updated.find(t => t.id === parentId);
        if (parent) db.todos.upsert(parent);
        return updated;
      });
    } else {
      // 이 인스턴스만 삭제: cancelled 예외 레코드 생성
      setTodos(prev => {
        const parent = prev.find(t => t.id === parentId);
        if (!parent) return prev;
        const exId = newId();
        const exception: Todo = {
          ...parent,
          id: exId,
          date: instanceDate,
          status: 'cancelled',
          recurrenceParentId: parentId,
          recurrenceRule: undefined,
          recurrenceDays: undefined,
          recurrenceEndDate: undefined,
          isException: true,
        };
        db.todos.upsert(exception);
        return [...prev, exception];
      });
    }
  }, []);

  // 반복 일정 수정 (scope: 'this' | 'future' | 'all')
  const updateRecurringTodo = useCallback((parentId: string, instanceDate: string, changes: Partial<Todo>, scope: 'this' | 'future' | 'all') => {
    if (scope === 'all') {
      // 원본 직접 수정
      setTodos(prev => {
        const updated = prev.map(t => t.id === parentId ? { ...t, ...changes } : t);
        const parent = updated.find(t => t.id === parentId);
        if (parent) db.todos.upsert(parent);
        return updated;
      });
    } else if (scope === 'future') {
      // 현재 날짜에서 원본 종료 + 새 반복 이벤트 생성
      setTodos(prev => {
        const endDate = format(addDays(parseISO(instanceDate), -1), 'yyyy-MM-dd');
        const parent = prev.find(t => t.id === parentId);
        if (!parent) return prev;
        const updatedParent = { ...parent, recurrenceEndDate: endDate };
        const newParentId = newId();
        const newParent: Todo = {
          ...parent, ...changes,
          id: newParentId,
          date: instanceDate,
          recurrenceParentId: undefined,
          isException: false,
          doStart: undefined, doEnd: undefined, doElapsedSec: undefined,
        };
        db.todos.upsert(updatedParent);
        db.todos.upsert(newParent);
        return [...prev.map(t => t.id === parentId ? updatedParent : t), newParent];
      });
    } else {
      // 이 인스턴스만 수정: 예외 레코드 생성
      setTodos(prev => {
        const parent = prev.find(t => t.id === parentId);
        if (!parent) return prev;
        const exId = newId();
        const exception: Todo = {
          ...parent, ...changes,
          id: exId,
          date: instanceDate,
          recurrenceParentId: parentId,
          recurrenceRule: undefined,
          recurrenceDays: undefined,
          recurrenceEndDate: undefined,
          isException: true,
        };
        db.todos.upsert(exception);
        return [...prev, exception];
      });
    }
  }, []);

  const toggleTop3 = useCallback((id: string) => {
    setTodos(prev => {
      const todo = prev.find(t => t.id === id);
      if (!todo) return prev;
      const top3Count = prev.filter(t => t.isTop3 && t.date === todo.date && t.id !== id).length;
      if (!todo.isTop3 && top3Count >= 3) return prev;
      const updated = prev.map(t => t.id === id ? { ...t, isTop3: !t.isTop3 } : t);
      const updatedTodo = updated.find(t => t.id === id);
      if (updatedTodo) db.todos.upsert(updatedTodo);
      return updated;
    });
  }, []);

  // ── Event actions ──
  const addEvent = useCallback((event: Omit<Event, 'id'>) => {
    const newEvent: Event = {
      ...event,
      id: newEventId(),
      sourceEventId: undefined,
      tags: event.tags ?? [],
      repeatType: event.repeatType ?? 'none',
    };
    void db.events.upsert(newEvent).then(() => {
      void db.events.fetchAll().then(setEvents);
    });
  }, []);

  const updateEvent = useCallback((id: string, changes: Partial<Event>) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...changes } : e);
      const event = updated.find(e => e.id === id);
      if (event) {
        void db.events.upsert(event).then(() => {
          void db.events.fetchAll().then(setEvents);
        });
      }
      return updated;
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    void db.events.delete(id).then(() => {
      void db.events.fetchAll().then(setEvents);
    });
  }, []);

  // ── Habit actions ──
  const addHabit = useCallback((name: string) => {
    const newHabit: Habit = { id: newId(), name, checkedDates: [], habitType: 'check', dailyProgress: {}, dailyMemos: {} };
    setHabits(prev => [...prev, newHabit]);
    db.habits.upsert(newHabit);
  }, []);

  const addHabitFull = useCallback((habit: Omit<Habit, 'id'>) => {
    const newHabit: Habit = {
      ...habit, id: newId(),
      habitType: habit.habitType ?? 'check',
      dailyProgress: habit.dailyProgress ?? {},
      dailyMemos: habit.dailyMemos ?? {},
    };
    setHabits(prev => [...prev, newHabit]);
    db.habits.upsert(newHabit);
  }, []);

  const updateHabit = useCallback((id: string, changes: Partial<Habit>) => {
    setHabits(prev => {
      const updated = prev.map(h => h.id === id ? { ...h, ...changes } : h);
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    db.habits.delete(id);
  }, []);

  const toggleHabit = useCallback((id: string, date: string) => {
    setHabits(prev => {
      const updated = prev.map(h => {
        if (h.id !== id) return h;
        const checked = h.checkedDates.includes(date);
        return { ...h, checkedDates: checked ? h.checkedDates.filter(d => d !== date) : [...h.checkedDates, date] };
      });
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  const updateHabitProgress = useCallback((id: string, date: string, value: number) => {
    setHabits(prev => {
      const updated = prev.map(h => {
        if (h.id !== id) return h;
        const newProgress = { ...h.dailyProgress, [date]: value };
        const target = h.targetValue ?? 0;
        const targetSec = h.habitType === 'time' ? target * 60 : target;
        const targetMet = target > 0 && value >= targetSec;
        const wasChecked = h.checkedDates.includes(date);
        const newCheckedDates = targetMet && !wasChecked
          ? [...h.checkedDates, date]
          : !targetMet && wasChecked && h.habitType !== 'check' && h.habitType !== 'memo'
            ? h.checkedDates.filter(d => d !== date)
            : h.checkedDates;
        return { ...h, dailyProgress: newProgress, checkedDates: newCheckedDates };
      });
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  const updateHabitMemo = useCallback((id: string, date: string, memo: string) => {
    setHabits(prev => {
      const updated = prev.map(h => {
        if (h.id !== id) return h;
        return { ...h, dailyMemos: { ...h.dailyMemos, [date]: memo } };
      });
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  // ── Routine actions ──
  const addRoutine = useCallback((routine: Omit<Routine, 'id'>) => {
    const newRoutine: Routine = { ...routine, id: newId(), checkedDates: routine.checkedDates ?? [] };
    setRoutines(prev => [...prev, newRoutine]);
    db.routines.upsert(newRoutine);
  }, []);

  const updateRoutine = useCallback((id: string, changes: Partial<Routine>) => {
    setRoutines(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...changes } : r);
      const routine = updated.find(r => r.id === id);
      if (routine) db.routines.upsert(routine);
      return updated;
    });
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setRoutines(prev => prev.filter(r => r.id !== id));
    db.routines.delete(id);
  }, []);

  const toggleRoutineDate = useCallback((id: string, date: string) => {
    setRoutines(prev => {
      const updated = prev.map(r => {
        if (r.id !== id) return r;
        const checked = r.checkedDates.includes(date);
        return { ...r, checkedDates: checked ? r.checkedDates.filter(d => d !== date) : [...r.checkedDates, date] };
      });
      const routine = updated.find(r => r.id === id);
      if (routine) db.routines.upsert(routine);
      return updated;
    });
  }, []);

  // ── Self-care actions ──
  const addSelfCareRecord = useCallback((record: Omit<SelfCareRecord, 'id'>) => {
    const newRecord: SelfCareRecord = { ...record, id: newId() };
    setSelfCareRecords(prev => [...prev, newRecord]);
    db.selfCareRecords.upsert(newRecord);
  }, []);

  const updateSelfCareRecord = useCallback((id: string, changes: Partial<Omit<SelfCareRecord, 'id'>>) => {
    setSelfCareRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.selfCareRecords.upsert(updated);
      return updated;
    }));
  }, []);

  const deleteSelfCareRecord = useCallback((id: string) => {
    setSelfCareRecords(prev => prev.filter(r => r.id !== id));
    db.selfCareRecords.delete(id);
  }, []);

  // ── HabitMonthlyMemo actions ──
  const setHabitMonthlyMemo = useCallback((
    habitId: string,
    year: number,
    month: number,
    data: Partial<Omit<HabitMonthlyMemo, 'id' | 'habitId' | 'year' | 'month'>>
  ) => {
    setHabitMonthlyMemos(prev => {
      const existing = prev.find(m => m.habitId === habitId && m.year === year && m.month === month);
      if (existing) {
        const updated = { ...existing, ...data };
        db.habitMonthlyMemos.upsert(updated);
        return prev.map(m => m.habitId === habitId && m.year === year && m.month === month ? updated : m);
      } else {
        const created: HabitMonthlyMemo = {
          id: newId(), habitId, year, month,
          memo: '', whatWorked: '', whatDidntWork: '', nextMonth: '',
          ...data,
        };
        db.habitMonthlyMemos.upsert(created);
        return [...prev, created];
      }
    });
  }, []);

  // ── Food actions ──
  const addFoodRecord = useCallback((record: Omit<FoodRecord, 'id'>) => {
    const newRecord: FoodRecord = { ...record, id: newId() };
    setFoodRecords(prev => [...prev, newRecord]);
    db.foodRecords.upsert(newRecord);
  }, []);

  const updateFoodRecord = useCallback((id: string, changes: Partial<Omit<FoodRecord, 'id'>>) => {
    setFoodRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.foodRecords.upsert(updated);
      return updated;
    }));
  }, []);

  const deleteFoodRecord = useCallback((id: string) => {
    setFoodRecords(prev => prev.filter(r => r.id !== id));
    db.foodRecords.delete(id);
  }, []);

  // ── Period actions ──
  const addPeriodRecord = useCallback((record: Omit<PeriodRecord, 'id'>) => {
    const newRecord: PeriodRecord = { ...record, id: newId() };
    setPeriodRecords(prev => [...prev, newRecord].sort((a, b) => b.startDate.localeCompare(a.startDate)));
    db.periodRecords.upsert(newRecord);
  }, []);

  const updatePeriodRecord = useCallback((id: string, changes: Partial<PeriodRecord>) => {
    setPeriodRecords(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...changes } : r);
      const record = updated.find(r => r.id === id);
      if (record) db.periodRecords.upsert(record);
      return updated;
    });
  }, []);

  const deletePeriodRecord = useCallback((id: string) => {
    setPeriodRecords(prev => prev.filter(r => r.id !== id));
    db.periodRecords.delete(id);
  }, []);

  // ── Review actions ──
  const addReviewRecord = useCallback((record: Omit<ReviewRecord, 'id'>) => {
    const newRecord: ReviewRecord = { ...record, id: newId() };
    setReviewRecords(prev => [...prev, newRecord]);
    db.reviewRecords.upsert(newRecord);
  }, []);

  const updateReviewRecord = useCallback((id: string, changes: Partial<ReviewRecord>) => {
    setReviewRecords(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...changes } : r);
      const record = updated.find(r => r.id === id);
      if (record) db.reviewRecords.upsert(record);
      return updated;
    });
  }, []);

  const deleteReviewRecord = useCallback((id: string) => {
    setReviewRecords(prev => prev.filter(r => r.id !== id));
    db.reviewRecords.delete(id);
  }, []);

  const addWeeklyReview = useCallback((review: Omit<WeeklyReview, 'id'>) => {
    const newReview = { ...review, id: newId() };
    setWeeklyReviews(prev => [...prev, newReview]);
    db.weeklyReviews.upsert(newReview);
  }, []);

  const updateWeeklyReview = useCallback((id: string, changes: Partial<WeeklyReview>) => {
    setWeeklyReviews(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.weeklyReviews.upsert(updated);
      return updated;
    }));
  }, []);

  const addMonthlyReview = useCallback((review: Omit<MonthlyReview, 'id'>) => {
    const newReview = { ...review, id: newId() };
    setMonthlyReviews(prev => [...prev, newReview]);
    db.monthlyReviews.upsert(newReview);
  }, []);

  const updateMonthlyReview = useCallback((id: string, changes: Partial<MonthlyReview>) => {
    setMonthlyReviews(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.monthlyReviews.upsert(updated);
      return updated;
    }));
  }, []);

  // ── Weekly goal actions ──
  const addWeeklyGoal = useCallback((text: string, monthlyGoalId: string | undefined, weekKey: string) => {
    const newGoal: WeeklyGoal = { id: newId(), text, done: false, monthlyGoalId, weekKey };
    setWeeklyGoals(prev => [...prev, newGoal]);
    db.weeklyGoals.upsert(newGoal);
  }, []);

  const toggleWeeklyGoal = useCallback((id: string) => {
    setWeeklyGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, done: !g.done } : g);
      const goal = updated.find(g => g.id === id);
      if (goal) db.weeklyGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteWeeklyGoal = useCallback((id: string) => {
    setWeeklyGoals(prev => prev.filter(g => g.id !== id));
    db.weeklyGoals.delete(id);
  }, []);

  // ── Monthly goal actions ──
  const addMonthlyGoal = useCallback((text: string, annualGoalId: string, month: string, projectId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || !annualGoalId) return;
    const newGoal: MonthlyGoal = { id: newId(), text: trimmed, month, projectId, annualGoalId };
    setMonthlyGoals(prev => [...prev, newGoal]);
    db.monthlyGoals.upsert(newGoal);
  }, []);

  const updateMonthlyGoal = useCallback((id: string, changes: Partial<Pick<MonthlyGoal, 'text' | 'annualGoalId' | 'projectId'>>) => {
    setMonthlyGoals(prev => {
      const updated = prev.map(g => (g.id === id ? { ...g, ...changes } : g));
      const goal = updated.find(g => g.id === id);
      if (goal) db.monthlyGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteMonthlyGoal = useCallback((id: string) => {
    setMonthlyGoals(prev => prev.filter(g => g.id !== id));
    db.monthlyGoals.delete(id);
  }, []);

  // ── Annual goal actions ──
  const addAnnualGoal = useCallback((text: string, year: number) => {
    const newGoal: AnnualGoal = { id: newId(), text, year, done: false };
    setAnnualGoals(prev => [...prev, newGoal]);
    db.annualGoals.upsert(newGoal);
  }, []);

  const toggleAnnualGoal = useCallback((id: string) => {
    setAnnualGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, done: !g.done } : g);
      const goal = updated.find(g => g.id === id);
      if (goal) db.annualGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteAnnualGoal = useCallback((id: string) => {
    setAnnualGoals(prev => {
      const victim = prev.find(g => g.id === id);
      if (!victim) return prev;
      const replacement = prev.find(g => g.id !== id && g.year === victim.year)?.id;
      setMonthlyGoals(mgPrev => {
        const next = mgPrev.map(mg =>
          mg.annualGoalId === id ? { ...mg, annualGoalId: replacement } : mg
        );
        next.forEach(g => {
          const o = mgPrev.find(x => x.id === g.id);
          if (o && o.annualGoalId !== g.annualGoalId) db.monthlyGoals.upsert(g);
        });
        return next;
      });
      db.annualGoals.delete(id);
      return prev.filter(g => g.id !== id);
    });
  }, []);

  // ── Quarterly goal actions ──
  const addQuarterlyGoal = useCallback((text: string, year: number, quarter: number) => {
    const newGoal: QuarterlyGoal = { id: newId(), text, year, quarter, done: false };
    setQuarterlyGoals(prev => [...prev, newGoal]);
    db.quarterlyGoals.upsert(newGoal);
  }, []);

  const toggleQuarterlyGoal = useCallback((id: string) => {
    setQuarterlyGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, done: !g.done } : g);
      const goal = updated.find(g => g.id === id);
      if (goal) db.quarterlyGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteQuarterlyGoal = useCallback((id: string) => {
    setQuarterlyGoals(prev => prev.filter(g => g.id !== id));
    db.quarterlyGoals.delete(id);
  }, []);

  // ── Brainstorm actions ──
  const addBrainstormItem = useCallback((text: string, date: string) => {
    const newItem: BrainstormItem = { id: newId(), text, date };
    setBrainstormItems(prev => [...prev, newItem]);
    db.brainstormItems.upsert(newItem);
  }, []);

  const deleteBrainstormItem = useCallback((id: string) => {
    setBrainstormItems(prev => prev.filter(b => b.id !== id));
    db.brainstormItems.delete(id);
  }, []);

  const brainstormToTodo = useCallback((id: string, date?: string) => {
    setBrainstormItems(prev => {
      const item = prev.find(b => b.id === id);
      if (!item) return prev;
      const newTodo: Todo = { id: newId(), text: item.text, date: date ?? item.date, status: 'active', isTop3: false, tags: [] };
      setTodos(t => {
        db.todos.upsert(newTodo);
        return [...t, newTodo];
      });
      db.brainstormItems.delete(id);
      return prev.filter(b => b.id !== id);
    });
  }, []);

  const brainstormToEvent = useCallback((id: string, eventData: { date: string; startTime?: string; endTime?: string; location?: string; tags?: string[] }) => {
    setBrainstormItems(prev => {
      const item = prev.find(b => b.id === id);
      if (!item) return prev;
      const newEvent: Event = {
        id: newEventId(),
        title: item.text,
        date: eventData.date,
        startDate: eventData.date,
        endDate: eventData.date,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        location: eventData.location,
        tags: eventData.tags ?? [],
        repeatType: 'none',
      };
      void db.events.upsert(newEvent).then(() => {
        void db.events.fetchAll().then(setEvents);
      });
      db.brainstormItems.delete(id);
      return prev.filter(b => b.id !== id);
    });
  }, []);

  const setBrainstormMemo = useCallback((date: string, text: string) => {
    setBrainstormMemos(prev => ({ ...prev, [date]: text }));
    db.brainstormMemos.upsert(date, text);
  }, []);

  const addWeeklyBrainstorm = useCallback((text: string, weekKey: string) => {
    const newItem: BrainstormItem = { id: newId(), text, date: today, weekKey };
    setBrainstormItems(prev => [...prev, newItem]);
    db.brainstormItems.upsert(newItem);
  }, []);

  const weeklyBrainstormAssign = useCallback((id: string, date: string) => {
    setBrainstormItems(prev => {
      const item = prev.find(b => b.id === id);
      if (!item) return prev;
      const newTodo: Todo = { id: newId(), text: item.text, date, status: 'active', isTop3: false, tags: [] };
      setTodos(t => {
        db.todos.upsert(newTodo);
        return [...t, newTodo];
      });
      db.brainstormItems.delete(id);
      return prev.filter(b => b.id !== id);
    });
  }, []);

  // ── Timer actions ──
  const startTimer = useCallback((todoId: string, options?: { mode?: TimerMode; pomoDurationSec?: number }) => {
    if (activeTimer && activeTimer.todoId !== todoId) return;
    const mode = options?.mode ?? 'stopwatch';
    const pomoDurationSec = mode === 'pomodoro' ? Math.max(60, options?.pomoDurationSec ?? 25 * 60) : 0;

    setTodos(prev => {
      const updated = prev.map(t =>
        t.id === todoId
          ? { ...t, status: 'inProgress' as TodoStatus, doStart: undefined, doEnd: undefined, doElapsedSec: undefined }
          : t
      );
      const todo = updated.find(t => t.id === todoId);
      if (todo) db.todos.upsert(todo);
      return updated;
    });
    setActiveTimer(prev => {
      if (prev) return prev;
      const now = new Date();
      return {
        todoId,
        mode,
        startedAt: now.getTime(),
        startHHMM: format(now, 'HH:mm'),
        pausedDurationMs: 0,
        isPaused: false,
        pauseStartedAt: null,
        pomoDurationSec,
      };
    });
  }, [activeTimer]);

  const pauseTimer = useCallback(() => {
    setActiveTimer(prev => {
      if (!prev || prev.isPaused) return prev;
      return {
        ...prev,
        isPaused: true,
        pauseStartedAt: Date.now(),
      };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setActiveTimer(prev => {
      if (!prev || !prev.isPaused) return prev;
      const pausedFor = prev.pauseStartedAt ? Date.now() - prev.pauseStartedAt : 0;
      return {
        ...prev,
        isPaused: false,
        pauseStartedAt: null,
        pausedDurationMs: prev.pausedDurationMs + Math.max(0, pausedFor),
      };
    });
  }, []);

  const stopTimer = useCallback(() => {
    if (!activeTimer) return;
    completeTimer(activeTimer);
  }, [activeTimer, completeTimer]);

  // ── Project actions ──
  const addProject = useCallback((project: Omit<Project, 'id'>) => {
    const newProject: Project = { ...project, id: newId() };
    setProjects(prev => [...prev, newProject]);
    db.projects.upsert(newProject);
  }, []);

  const updateProject = useCallback((id: string, changes: Partial<Project>) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...changes } : p);
      const project = updated.find(p => p.id === id);
      if (project) db.projects.upsert(project);
      return updated;
    });
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setMilestones(prev => prev.filter(m => m.projectId !== id));
    db.projects.delete(id);
    db.milestones.deleteByProject(id);
  }, []);

  // ── Milestone actions ──
  const addMilestone = useCallback((milestone: Omit<Milestone, 'id'>) => {
    const newMilestone: Milestone = { ...milestone, id: newId() };
    setMilestones(prev => [...prev, newMilestone]);
    db.milestones.upsert(newMilestone);
  }, []);

  const toggleMilestone = useCallback((id: string) => {
    setMilestones(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, done: !m.done } : m);
      const milestone = updated.find(m => m.id === id);
      if (milestone) db.milestones.upsert(milestone);
      return updated;
    });
  }, []);

  const deleteMilestone = useCallback((id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
    db.milestones.delete(id);
  }, []);

  // ── Tag actions ──
  const addTag = useCallback((name: string, color: string) => {
    const newTag: Tag = { id: newId(), name, color };
    setTags(prev => [...prev, newTag]);
    db.tags.upsert(newTag);
  }, []);

  const updateTag = useCallback((id: string, changes: Partial<Tag>) => {
    setTags(prev => {
      const updated = prev.map(tg => tg.id === id ? { ...tg, ...changes } : tg);
      const tag = updated.find(tg => tg.id === id);
      if (tag) db.tags.upsert(tag);
      return updated;
    });
  }, []);

  const deleteTag = useCallback((id: string) => {
    setTags(prev => prev.filter(tg => tg.id !== id));
    setTodos(prev => {
      const updatedTodos = prev.map(t => ({ ...t, tags: (t.tags || []).filter(tid => tid !== id) }));
      updatedTodos.forEach(todo => db.todos.upsert(todo));
      return updatedTodos;
    });
    db.tags.delete(id);
  }, []);

  // ── Settings actions ──
  const setDayHours = useCallback((s: number, e: number) => {
    setDayStartHour(s);
    setDayEndHour(e);
    db.settings.upsert(s, e, appSettings);
  }, [appSettings]);

  const updateAppSettings = useCallback((changes: Partial<AppSettings>) => {
    setAppSettings(prev => {
      const next = { ...prev, ...changes };
      db.settings.upsert(dayStartHour, dayEndHour, next);
      return next;
    });
  }, [dayStartHour, dayEndHour]);

  // ── Timeline log actions ──
  const addTimelineLog = useCallback((log: Omit<TimelineLog, 'id'>) => {
    const newLog: TimelineLog = { ...log, id: newId() };
    setTimelineLogs(prev => [...prev, newLog]);
    db.timelineLogs.upsert(newLog);
  }, []);

  const deleteTimelineLog = useCallback((id: string) => {
    setTimelineLogs(prev => prev.filter(l => l.id !== id));
    db.timelineLogs.delete(id);
  }, []);

  const setDailyAffirmation = useCallback((date: string, text: string) => {
    setDailyAffirmations(prev => ({ ...prev, [date]: text }));
  }, []);

  return (
    <PlannerContext.Provider value={{
      isLoading,
      selectedDate, setSelectedDate,
      todos, events, habits, weeklyGoals, monthlyGoals, annualGoals, quarterlyGoals, brainstormItems, brainstormMemos, activeTimer,
      projects, milestones, tags,
      routines, selfCareRecords, periodRecords, reviewRecords, weeklyReviews, monthlyReviews,
      timelineLogs,
      dailyAffirmations, setDailyAffirmation,
      appSettings, updateAppSettings,
      addTodo, updateTodo, deleteTodo, toggleTop3, deleteRecurringTodo, updateRecurringTodo,
      addEvent, updateEvent, deleteEvent,
      addHabit, addHabitFull, updateHabit, deleteHabit, toggleHabit,
      updateHabitProgress, updateHabitMemo,
      habitMonthlyMemos, setHabitMonthlyMemo,
      addRoutine, updateRoutine, deleteRoutine, toggleRoutineDate,
      addSelfCareRecord, updateSelfCareRecord, deleteSelfCareRecord,
      foodRecords, addFoodRecord, updateFoodRecord, deleteFoodRecord,
      addPeriodRecord, updatePeriodRecord, deletePeriodRecord,
      addReviewRecord, updateReviewRecord, deleteReviewRecord,
      addWeeklyReview, updateWeeklyReview,
      addMonthlyReview, updateMonthlyReview,
      addWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
      addMonthlyGoal, updateMonthlyGoal, deleteMonthlyGoal,
      addAnnualGoal, toggleAnnualGoal, deleteAnnualGoal,
      addQuarterlyGoal, toggleQuarterlyGoal, deleteQuarterlyGoal,
      addBrainstormItem, deleteBrainstormItem, brainstormToTodo, brainstormToEvent,
      setBrainstormMemo,
      addWeeklyBrainstorm, weeklyBrainstormAssign,
      startTimer, pauseTimer, resumeTimer, stopTimer,
      addProject, updateProject, deleteProject,
      addMilestone, toggleMilestone, deleteMilestone,
      addTag, updateTag, deleteTag,
      addTimelineLog, deleteTimelineLog,
      dayStartHour, dayEndHour, setDayHours,
    }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider');
  return ctx;
}
