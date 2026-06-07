import { supabase } from './supabase';
import { format, addDays, subDays } from 'date-fns';
import { createEvent as createEventApi, deleteEvent as deleteEventApi, getEvents, upsertEvent as upsertEventApi } from '../api/events';
import type {
  Todo, Habit, Project, Milestone,
  SelfCareRecord, ReviewRecord, WeeklyReview, MonthlyReview, TimelineLog,
  FoodRecord, DiningType, TasteRating, Event, WeeklyGoal, MonthlyGoal, BrainstormItem, Tag, Routine,
  PeriodRecord, HabitMonthlyMemo, AnnualGoal, QuarterlyGoal,
  WeightRecord, WeightGoal, ConditionRecord, CultureRecord, MusicRecord,
  Recipe, RecipeIngredient, RecipeStep, RecipeCookLog,
  FridgeItem, ShoppingItem,
} from '../app/store';

function parseAnnualProfilesFromDb(raw: unknown): Record<string, { identity: string; values: string[] }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, { identity: string; values: string[] }> = {};
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

// ── Row types (Supabase snake_case) ──────────────────────────────────────────

type TodoRow = {
  id: string; text: string; date: string | null; due_date: string | null;
  status: string; is_top3: boolean; plan_start: string | null; plan_end: string | null;
  do_start: string | null; do_end: string | null; do_elapsed_sec: number | null;
  category: string | null;
  project_id: string | null;
  weekly_goal_id: string | null;
  tags: string[];
  recurrence_rule: string | null;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  recurrence_parent_id: string | null;
  is_exception: boolean | null;
};

type HabitRow = {
  id: string; name: string; checked_dates: string[]; icon: string | null;
  repeat: string | null; repeat_days: number[] | null; goal_text: string | null;
  alarm_time: string | null; category: string | null; color: string | null;
  habit_type: string;
  target_value: number | null;
  value_unit: string | null;
  daily_progress: Record<string, number> | null;
  daily_memos: Record<string, string> | null;
  reason: string | null;
};

type HabitMonthlyMemoRow = {
  id: string;
  habit_id: string;
  year: number;
  month: number;
  memo: string;
  what_worked: string;
  what_didnt_work: string;
  next_month: string;
};

type ProjectRow = {
  id: string; name: string; color: string; description: string | null;
  start_date: string | null; end_date: string | null; status: string;
};

type MilestoneRow = {
  id: string; project_id: string; title: string; date: string; done: boolean;
};

type SelfCareRow = {
  id: string; date: string; category: string; content: string; duration: number;
  sleep_start: string | null; sleep_end: string | null;
};

type ReviewRow = {
  id: string; date: string; types: string[]; emotion: number | null;
  emotion_memo: string | null; gratitude: string[] | null;
  kpt_keep: string | null; kpt_problem: string | null; kpt_try: string | null;
  happiness: string | null; daily_summary: string | null;
  daily_good: string | null; daily_improve: string | null;
};

type TimelineLogRow = {
  id: string; date: string; time: string; text: string;
  color: string | null; icon: string | null;
};

type EventRow = {
  id: string; title: string; date: string;
  start_time: string | null; end_time: string | null;
  location: string | null; memo: string | null; tags: string[];
};

type WeeklyGoalRow = {
  id: string; text: string; done: boolean;
  monthly_goal_id: string | null; week_key: string;
};

type MonthlyGoalRow = {
  id: string; text: string; month: string; project_id: string | null;
  annual_goal_id?: string | null;
};

type BrainstormItemRow = {
  id: string; text: string; date: string; week_key: string | null;
};

type BrainstormMemoRow = {
  date: string; text: string;
};

type TagRow = {
  id: string; name: string; color: string;
};

type RoutineRow = {
  id: string; name: string; icon: string;
  start_time: string; duration: number;
  steps: string[]; step_youtube_urls: string[]; checked_dates: string[];
  routine_steps?: { title: string; durationMinutes: number; youtubeUrl?: string }[] | null;
  repeat?: string | null;
  repeat_days?: number[] | null;
};

type PeriodRecordRow = {
  id: string;
  start_date: string;
  end_date: string | null;
  symptoms: string[];
  flow_level: string | null;
  memo: string | null;
};

type AnnualGoalRow = {
  id: string; year: number; text: string; done: boolean;
};

type QuarterlyGoalRow = {
  id: string; year: number; quarter: number; text: string; done: boolean;
};

// ── 변환 함수 ────────────────────────────────────────────────────────────────

const toTodo = (r: TodoRow): Todo => ({
  id: r.id, text: r.text, date: r.date, dueDate: r.due_date ?? undefined,
  status: r.status as Todo['status'], isTop3: r.is_top3,
  planStart: r.plan_start ?? undefined, planEnd: r.plan_end ?? undefined,
  doStart: r.do_start ?? undefined, doEnd: r.do_end ?? undefined,
  doElapsedSec: r.do_elapsed_sec ?? undefined,
  category: r.category ?? undefined, projectId: r.project_id ?? undefined,
  weeklyGoalId: r.weekly_goal_id ?? undefined,
  tags: r.tags ?? [],
  recurrenceRule: r.recurrence_rule as Todo['recurrenceRule'] ?? undefined,
  recurrenceDays: r.recurrence_days ?? undefined,
  recurrenceEndDate: r.recurrence_end_date ?? undefined,
  recurrenceParentId: r.recurrence_parent_id ?? undefined,
  isException: r.is_exception ?? undefined,
});

const fromTodo = (t: Todo): TodoRow => ({
  id: t.id, text: t.text, date: t.date ?? null, due_date: t.dueDate ?? null,
  status: t.status, is_top3: t.isTop3,
  plan_start: t.planStart ?? null, plan_end: t.planEnd ?? null,
  do_start: t.doStart ?? null, do_end: t.doEnd ?? null,
  do_elapsed_sec: t.doElapsedSec ?? null,
  category: t.category ?? null, project_id: t.projectId ?? null,
  weekly_goal_id: t.weeklyGoalId ?? null,
  tags: t.tags ?? [],
  recurrence_rule: t.recurrenceRule ?? null,
  recurrence_days: t.recurrenceDays ?? null,
  recurrence_end_date: t.recurrenceEndDate ?? null,
  recurrence_parent_id: t.recurrenceParentId ?? null,
  is_exception: t.isException ?? null,
});

const toHabit = (r: HabitRow): Habit => ({
  id: r.id, name: r.name, checkedDates: r.checked_dates ?? [],
  icon: r.icon ?? undefined, repeat: r.repeat as Habit['repeat'],
  repeatDays: r.repeat_days ?? undefined, goalText: r.goal_text ?? undefined,
  alarmTime: r.alarm_time ?? undefined, category: r.category ?? undefined,
  color: r.color ?? undefined,
  habitType: (r.habit_type ?? 'check') as Habit['habitType'],
  targetValue: r.target_value ?? undefined,
  valueUnit: r.value_unit ?? undefined,
  dailyProgress: r.daily_progress ?? {},
  dailyMemos: r.daily_memos ?? {},
  reason: r.reason ?? undefined,
});

const fromHabit = (h: Habit): HabitRow => ({
  id: h.id, name: h.name, checked_dates: h.checkedDates ?? [],
  icon: h.icon ?? null, repeat: h.repeat ?? null,
  repeat_days: h.repeatDays ?? null, goal_text: h.goalText ?? null,
  alarm_time: h.alarmTime ?? null, category: h.category ?? null,
  color: h.color ?? null,
  habit_type: h.habitType ?? 'check',
  target_value: h.targetValue ?? null,
  value_unit: h.valueUnit ?? null,
  daily_progress: h.dailyProgress ?? {},
  daily_memos: h.dailyMemos ?? {},
  reason: h.reason ?? null,
});

const toHabitMonthlyMemo = (r: HabitMonthlyMemoRow): HabitMonthlyMemo => ({
  id: r.id, habitId: r.habit_id, year: r.year, month: r.month,
  memo: r.memo ?? '', whatWorked: r.what_worked ?? '',
  whatDidntWork: r.what_didnt_work ?? '', nextMonth: r.next_month ?? '',
});

const fromHabitMonthlyMemo = (m: HabitMonthlyMemo): HabitMonthlyMemoRow => ({
  id: m.id, habit_id: m.habitId, year: m.year, month: m.month,
  memo: m.memo, what_worked: m.whatWorked,
  what_didnt_work: m.whatDidntWork, next_month: m.nextMonth,
});

const toProject = (r: ProjectRow): Project => ({
  id: r.id, name: r.name, color: r.color,
  description: r.description ?? undefined,
  startDate: r.start_date ?? undefined,
  endDate: r.end_date ?? undefined,
  status: r.status as Project['status'],
});

const fromProject = (p: Project): ProjectRow => ({
  id: p.id, name: p.name, color: p.color,
  description: p.description ?? null,
  start_date: p.startDate ?? null,
  end_date: p.endDate ?? null,
  status: p.status,
});

const toMilestone = (r: MilestoneRow): Milestone => ({
  id: r.id, projectId: r.project_id, title: r.title, date: r.date, done: r.done,
});

const fromMilestone = (m: Milestone): MilestoneRow => ({
  id: m.id, project_id: m.projectId, title: m.title, date: m.date, done: m.done,
});

const toSelfCare = (r: SelfCareRow): SelfCareRecord => ({
  id: r.id, date: r.date, category: r.category as SelfCareRecord['category'],
  content: r.content, duration: r.duration,
  ...(r.sleep_start ? { sleepStart: r.sleep_start } : {}),
  ...(r.sleep_end   ? { sleepEnd:   r.sleep_end   } : {}),
});

const fromSelfCare = (s: SelfCareRecord): SelfCareRow => ({
  id: s.id, date: s.date, category: s.category, content: s.content, duration: s.duration,
  sleep_start: s.sleepStart ?? null,
  sleep_end:   s.sleepEnd   ?? null,
});

type WeeklyReviewRow = {
  id: string; week_key: string; good: string; hard: string; next_week: string;
};

type MonthlyReviewRow = {
  id: string; month: string; achievement: string; next_focus: string;
};

const toWeeklyReview = (r: WeeklyReviewRow): WeeklyReview => ({
  id: r.id, weekKey: r.week_key, good: r.good ?? '', hard: r.hard ?? '', nextWeek: r.next_week ?? '',
});
const fromWeeklyReview = (r: WeeklyReview): WeeklyReviewRow => ({
  id: r.id, week_key: r.weekKey, good: r.good ?? '', hard: r.hard ?? '', next_week: r.nextWeek ?? '',
});

const toMonthlyReview = (r: MonthlyReviewRow): MonthlyReview => ({
  id: r.id, month: r.month, achievement: r.achievement ?? '', nextFocus: r.next_focus ?? '',
});
const fromMonthlyReview = (r: MonthlyReview): MonthlyReviewRow => ({
  id: r.id, month: r.month, achievement: r.achievement ?? '', next_focus: r.nextFocus ?? '',
});

const toReview = (r: ReviewRow): ReviewRecord => ({
  id: r.id, date: r.date, types: r.types ?? [],
  emotion: r.emotion as ReviewRecord['emotion'],
  emotionMemo: r.emotion_memo ?? undefined,
  gratitude: r.gratitude ?? undefined,
  kptKeep: r.kpt_keep ?? undefined, kptProblem: r.kpt_problem ?? undefined,
  kptTry: r.kpt_try ?? undefined, happiness: r.happiness ?? undefined,
  dailySummary: r.daily_summary ?? undefined, dailyGood: r.daily_good ?? undefined,
  dailyImprove: r.daily_improve ?? undefined,
});

const fromReview = (r: ReviewRecord): ReviewRow => ({
  id: r.id, date: r.date, types: r.types ?? [],
  emotion: r.emotion ?? null, emotion_memo: r.emotionMemo ?? null,
  gratitude: r.gratitude ?? null, kpt_keep: r.kptKeep ?? null,
  kpt_problem: r.kptProblem ?? null, kpt_try: r.kptTry ?? null,
  happiness: r.happiness ?? null, daily_summary: r.dailySummary ?? null,
  daily_good: r.dailyGood ?? null, daily_improve: r.dailyImprove ?? null,
});

const toTimelineLog = (r: TimelineLogRow): TimelineLog => ({
  id: r.id, date: r.date, time: r.time, text: r.text,
  color: r.color ?? undefined, icon: r.icon ?? undefined,
});

const fromTimelineLog = (t: TimelineLog): TimelineLogRow => ({
  id: t.id, date: t.date, time: t.time, text: t.text,
  color: t.color ?? null, icon: t.icon ?? null,
});

const toEvent = (r: EventRow): Event => ({
  id: r.id, title: r.title, date: r.date,
  startTime: r.start_time ?? undefined,
  endTime: r.end_time ?? undefined,
  location: r.location ?? undefined,
  memo: r.memo ?? undefined,
  tags: r.tags ?? [],
});

const fromEvent = (e: Event): EventRow => ({
  id: e.id, title: e.title, date: e.date,
  start_time: e.startTime ?? null,
  end_time: e.endTime ?? null,
  location: e.location ?? null,
  memo: e.memo ?? null,
  tags: e.tags ?? [],
});

const toWeeklyGoal = (r: WeeklyGoalRow): WeeklyGoal => ({
  id: r.id, text: r.text, done: r.done,
  monthlyGoalId: r.monthly_goal_id ?? undefined,
  weekKey: r.week_key,
});

const fromWeeklyGoal = (g: WeeklyGoal): WeeklyGoalRow => ({
  id: g.id, text: g.text, done: g.done,
  monthly_goal_id: g.monthlyGoalId ?? null,
  week_key: g.weekKey,
});

const toMonthlyGoal = (r: MonthlyGoalRow): MonthlyGoal => ({
  id: r.id, text: r.text, month: r.month,
  projectId: r.project_id ?? undefined,
  annualGoalId: r.annual_goal_id ?? undefined,
});

const fromMonthlyGoal = (g: MonthlyGoal): MonthlyGoalRow => ({
  id: g.id, text: g.text, month: g.month,
  project_id: g.projectId ?? null,
  annual_goal_id: g.annualGoalId ?? null,
});

const toAnnualGoal = (r: AnnualGoalRow): AnnualGoal => ({
  id: r.id, year: r.year, text: r.text, done: r.done,
});
const fromAnnualGoal = (g: AnnualGoal): AnnualGoalRow => ({
  id: g.id, year: g.year, text: g.text, done: g.done,
});

const toQuarterlyGoal = (r: QuarterlyGoalRow): QuarterlyGoal => ({
  id: r.id, year: r.year, quarter: r.quarter, text: r.text, done: r.done,
});
const fromQuarterlyGoal = (g: QuarterlyGoal): QuarterlyGoalRow => ({
  id: g.id, year: g.year, quarter: g.quarter, text: g.text, done: g.done,
});

const toBrainstormItem = (r: BrainstormItemRow): BrainstormItem => ({
  id: r.id, text: r.text, date: r.date,
  weekKey: r.week_key ?? undefined,
});

const fromBrainstormItem = (b: BrainstormItem): BrainstormItemRow => ({
  id: b.id, text: b.text, date: b.date,
  week_key: b.weekKey ?? null,
});

const toTag = (r: TagRow): Tag => ({ id: r.id, name: r.name, color: r.color });
const fromTag = (t: Tag): TagRow => ({ id: t.id, name: t.name, color: t.color });

const toRoutine = (r: RoutineRow): Routine => {
  const routineSteps = r.routine_steps && r.routine_steps.length > 0
    ? r.routine_steps
    : undefined;
  // duration: routineSteps 합산 or 저장된 값
  const duration = routineSteps
    ? routineSteps.reduce((s, step) => s + (step.durationMinutes || 0), 0)
    : r.duration;
  return {
    id: r.id, name: r.name, icon: r.icon,
    startTime: r.start_time, duration,
    steps: r.steps ?? [], stepYoutubeUrls: r.step_youtube_urls ?? [],
    routineSteps,
    checkedDates: r.checked_dates ?? [],
    repeat: (r.repeat as Routine['repeat']) ?? 'daily',
    repeatDays: r.repeat_days ?? [],
  };
};

const toPeriodRecord = (r: PeriodRecordRow): PeriodRecord => ({
  id: r.id,
  startDate: r.start_date,
  endDate: r.end_date ?? null,
  symptoms: r.symptoms ?? [],
  flowLevel: (r.flow_level as PeriodRecord['flowLevel']) ?? null,
  memo: r.memo ?? null,
});

const fromPeriodRecord = (p: PeriodRecord): PeriodRecordRow => ({
  id: p.id,
  start_date: p.startDate,
  end_date: p.endDate ?? null,
  symptoms: p.symptoms ?? [],
  flow_level: p.flowLevel ?? null,
  memo: p.memo ?? null,
});

const fromRoutine = (r: Routine): RoutineRow => {
  const totalDuration = r.routineSteps && r.routineSteps.length > 0
    ? r.routineSteps.reduce((s, step) => s + (step.durationMinutes || 0), 0)
    : r.duration;
  return {
    id: r.id, name: r.name, icon: r.icon,
    start_time: r.startTime, duration: totalDuration,
    steps: r.routineSteps ? r.routineSteps.map(s => s.title) : (r.steps ?? []),
    step_youtube_urls: r.routineSteps
      ? r.routineSteps.map(s => s.youtubeUrl ?? '')
      : (r.stepYoutubeUrls ?? []),
    routine_steps: r.routineSteps ?? null,
    checked_dates: r.checkedDates ?? [],
    repeat: r.repeat ?? 'daily',
    repeat_days: r.repeatDays ?? [],
  };
};

// ── DB 객체 ──────────────────────────────────────────────────────────────────

export const db = {
  todos: {
    fetchAll: async (): Promise<Todo[]> => {
      const { data, error } = await supabase.from('todos').select('*').order('created_at');
      if (error) console.error('[db] todos fetch:', error.message);
      return (data ?? []).map(toTodo);
    },
    upsert: async (todo: Todo) => {
      const { error } = await supabase.from('todos').upsert(fromTodo(todo));
      if (error) console.error('[db] todos upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) console.error('[db] todos delete:', error.message);
    },
  },

  habits: {
    fetchAll: async (): Promise<Habit[]> => {
      const { data, error } = await supabase.from('habits').select('*').order('created_at');
      if (error) console.error('[db] habits fetch:', error.message);
      return (data ?? []).map(toHabit);
    },
    upsert: async (habit: Habit) => {
      const { error } = await supabase.from('habits').upsert(fromHabit(habit));
      if (error) console.error('[db] habits upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) console.error('[db] habits delete:', error.message);
    },
  },

  projects: {
    fetchAll: async (): Promise<Project[]> => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at');
      if (error) console.error('[db] projects fetch:', error.message);
      return (data ?? []).map(toProject);
    },
    upsert: async (project: Project) => {
      const { error } = await supabase.from('projects').upsert(fromProject(project));
      if (error) console.error('[db] projects upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) console.error('[db] projects delete:', error.message);
    },
  },

  milestones: {
    fetchAll: async (): Promise<Milestone[]> => {
      const { data, error } = await supabase.from('milestones').select('*').order('date');
      if (error) console.error('[db] milestones fetch:', error.message);
      return (data ?? []).map(toMilestone);
    },
    upsert: async (milestone: Milestone) => {
      const { error } = await supabase.from('milestones').upsert(fromMilestone(milestone));
      if (error) console.error('[db] milestones upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('milestones').delete().eq('id', id);
      if (error) console.error('[db] milestones delete:', error.message);
    },
    deleteByProject: async (projectId: string) => {
      const { error } = await supabase.from('milestones').delete().eq('project_id', projectId);
      if (error) console.error('[db] milestones deleteByProject:', error.message);
    },
  },

  selfCareRecords: {
    fetchAll: async (): Promise<SelfCareRecord[]> => {
      const { data, error } = await supabase
        .from('self_care_records').select('*').order('date', { ascending: false });
      if (error) console.error('[db] self_care_records fetch:', error.message);
      return (data ?? []).map(toSelfCare);
    },
    upsert: async (record: SelfCareRecord) => {
      const { error } = await supabase.from('self_care_records').upsert(fromSelfCare(record));
      if (error) console.error('[db] self_care_records upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('self_care_records').delete().eq('id', id);
      if (error) console.error('[db] self_care_records delete:', error.message);
    },
  },

  reviewRecords: {
    fetchAll: async (): Promise<ReviewRecord[]> => {
      const { data, error } = await supabase
        .from('review_records').select('*').order('date', { ascending: false });
      if (error) console.error('[db] review_records fetch:', error.message);
      return (data ?? []).map(toReview);
    },
    upsert: async (record: ReviewRecord) => {
      const { error } = await supabase.from('review_records').upsert(fromReview(record));
      if (error) console.error('[db] review_records upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('review_records').delete().eq('id', id);
      if (error) console.error('[db] review_records delete:', error.message);
    },
  },

  weeklyReviews: {
    fetchAll: async (): Promise<WeeklyReview[]> => {
      const { data, error } = await supabase
        .from('weekly_reviews').select('*').order('week_key', { ascending: false });
      if (error) console.error('[db] weekly_reviews fetch:', error.message);
      return (data ?? []).map(toWeeklyReview);
    },
    upsert: async (record: WeeklyReview) => {
      const { error } = await supabase.from('weekly_reviews').upsert(fromWeeklyReview(record));
      if (error) console.error('[db] weekly_reviews upsert:', error.message);
    },
  },

  monthlyReviews: {
    fetchAll: async (): Promise<MonthlyReview[]> => {
      const { data, error } = await supabase
        .from('monthly_reviews').select('*').order('month', { ascending: false });
      if (error) console.error('[db] monthly_reviews fetch:', error.message);
      return (data ?? []).map(toMonthlyReview);
    },
    upsert: async (record: MonthlyReview) => {
      const { error } = await supabase.from('monthly_reviews').upsert(fromMonthlyReview(record));
      if (error) console.error('[db] monthly_reviews upsert:', error.message);
    },
  },

  foodRecords: {
    fetchAll: async (): Promise<FoodRecord[]> => {
      const { data, error } = await supabase
        .from('food_records').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
      if (error) console.error('[db] food_records fetch:', error.message);
      return (data ?? []).map((r: any): FoodRecord => ({
        id: r.id,
        date: r.date,
        mealType: r.meal_type,
        foodName: r.food_name,
        amount: r.amount ?? 0,
        photoUrl: r.photo_url ?? null,
        memo: r.memo ?? null,
        calories: r.calories ?? null,
        carbs: r.carbs ?? null,
        protein: r.protein ?? null,
        fat: r.fat ?? null,
        diningType: (r.dining_type as DiningType) ?? null,
        tasteRating: (r.taste_rating as TasteRating) ?? null,
        tasteMemo: r.taste_memo ?? null,
        isFasting: r.is_fasting ?? false,
      }));
    },
    upsert: async (record: FoodRecord) => {
      const { error } = await supabase.from('food_records').upsert({
        id: record.id,
        date: record.date,
        meal_type: record.mealType,
        food_name: record.foodName,
        amount: record.amount,
        photo_url: record.photoUrl ?? null,
        memo: record.memo ?? null,
        calories: record.calories ?? null,
        carbs: record.carbs ?? null,
        protein: record.protein ?? null,
        fat: record.fat ?? null,
        dining_type: record.diningType ?? null,
        taste_rating: record.tasteRating ?? null,
        taste_memo: record.tasteMemo ?? null,
        is_fasting: record.isFasting ?? false,
      });
      if (error) console.error('[db] food_records upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('food_records').delete().eq('id', id);
      if (error) console.error('[db] food_records delete:', error.message);
    },
    uploadPhoto: async (file: File, recordId: string): Promise<string | null> => {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${recordId}.${ext}`;
      const { error } = await supabase.storage.from('food-photos').upload(path, file, { upsert: true });
      if (error) { console.error('[db] food photo upload:', error.message); return null; }
      const { data } = supabase.storage.from('food-photos').getPublicUrl(path);
      return data.publicUrl;
    },
    deletePhoto: async (path: string) => {
      await supabase.storage.from('food-photos').remove([path]);
    },
  },

  timelineLogs: {
    fetchAll: async (): Promise<TimelineLog[]> => {
      const { data, error } = await supabase
        .from('timeline_logs').select('*').order('date').order('time');
      if (error) console.error('[db] timeline_logs fetch:', error.message);
      return (data ?? []).map(toTimelineLog);
    },
    upsert: async (log: TimelineLog) => {
      const { error } = await supabase.from('timeline_logs').upsert(fromTimelineLog(log));
      if (error) console.error('[db] timeline_logs upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('timeline_logs').delete().eq('id', id);
      if (error) console.error('[db] timeline_logs delete:', error.message);
    },
  },

  events: {
    fetchAll: async (): Promise<Event[]> => {
      const startDate = format(subDays(new Date(), 365), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), 730), 'yyyy-MM-dd');
      return getEvents(undefined, startDate, endDate);
    },
    upsert: async (event: Event) => {
      const targetId = event.sourceEventId || (event.isOccurrence ? undefined : event.id);
      const saved = targetId
        ? await upsertEventApi(targetId, event)
        : await createEventApi(event);
      if (!saved) console.error('[db] events upsert: failed');
    },
    delete: async (id: string) => {
      const ok = await deleteEventApi(id);
      if (!ok) console.error('[db] events delete: failed');
    },
  },

  weeklyGoals: {
    fetchAll: async (): Promise<WeeklyGoal[]> => {
      const { data, error } = await supabase.from('weekly_goals').select('*').order('created_at');
      if (error) console.error('[db] weekly_goals fetch:', error.message);
      return (data ?? []).map(toWeeklyGoal);
    },
    upsert: async (goal: WeeklyGoal) => {
      const { error } = await supabase.from('weekly_goals').upsert(fromWeeklyGoal(goal));
      if (error) console.error('[db] weekly_goals upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('weekly_goals').delete().eq('id', id);
      if (error) console.error('[db] weekly_goals delete:', error.message);
    },
  },

  monthlyGoals: {
    fetchAll: async (): Promise<MonthlyGoal[]> => {
      const { data, error } = await supabase.from('monthly_goals').select('*').order('created_at');
      if (error) console.error('[db] monthly_goals fetch:', error.message);
      return (data ?? []).map(toMonthlyGoal);
    },
    upsert: async (goal: MonthlyGoal) => {
      const { error } = await supabase.from('monthly_goals').upsert(fromMonthlyGoal(goal));
      if (error) console.error('[db] monthly_goals upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('monthly_goals').delete().eq('id', id);
      if (error) console.error('[db] monthly_goals delete:', error.message);
    },
  },

  brainstormItems: {
    fetchAll: async (): Promise<BrainstormItem[]> => {
      const { data, error } = await supabase.from('brainstorm_items').select('*').order('created_at');
      if (error) console.error('[db] brainstorm_items fetch:', error.message);
      return (data ?? []).map(toBrainstormItem);
    },
    upsert: async (item: BrainstormItem) => {
      const { error } = await supabase.from('brainstorm_items').upsert(fromBrainstormItem(item));
      if (error) console.error('[db] brainstorm_items upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('brainstorm_items').delete().eq('id', id);
      if (error) console.error('[db] brainstorm_items delete:', error.message);
    },
  },

  brainstormMemos: {
    fetchAll: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from('brainstorm_memos').select('*');
      if (error) console.error('[db] brainstorm_memos fetch:', error.message);
      return Object.fromEntries((data ?? []).map((r: BrainstormMemoRow) => [r.date, r.text]));
    },
    upsert: async (date: string, text: string) => {
      const { error } = await supabase.from('brainstorm_memos').upsert({ date, text });
      if (error) console.error('[db] brainstorm_memos upsert:', error.message);
    },
  },

  tags: {
    fetchAll: async (): Promise<Tag[]> => {
      const { data, error } = await supabase.from('tags').select('*').order('created_at');
      if (error) console.error('[db] tags fetch:', error.message);
      return (data ?? []).map(toTag);
    },
    upsert: async (tag: Tag) => {
      const { error } = await supabase.from('tags').upsert(fromTag(tag));
      if (error) console.error('[db] tags upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) console.error('[db] tags delete:', error.message);
    },
  },

  routines: {
    fetchAll: async (): Promise<Routine[]> => {
      let { data, error } = await supabase.from('routines').select('*').order('created_at');
      // 구 스키마( created_at 없는 테이블 ) 호환
      if (error && /created_at/i.test(error.message)) {
        const retry = await supabase.from('routines').select('*');
        data = retry.data;
        error = retry.error;
      }
      if (error) console.error('[db] routines fetch:', error.message);
      return (data ?? []).map(toRoutine);
    },
    upsert: async (routine: Routine) => {
      const payload = fromRoutine(routine) as RoutineRow & { routine_steps?: RoutineRow['routine_steps'] };
      let { error } = await supabase.from('routines').upsert(payload);
      // 구 스키마( routine_steps 컬럼 미적용 ) 호환
      if (error && /routine_steps/i.test(error.message)) {
        const legacyPayload = { ...payload };
        delete legacyPayload.routine_steps;
        const retry = await supabase.from('routines').upsert(legacyPayload);
        error = retry.error;
        if (!error) console.warn('[db] routines upsert fallback: routine_steps 없이 저장됨');
      }
      if (error) console.error('[db] routines upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('routines').delete().eq('id', id);
      if (error) console.error('[db] routines delete:', error.message);
    },
  },

  habitMonthlyMemos: {
    fetchAll: async (): Promise<HabitMonthlyMemo[]> => {
      const { data, error } = await supabase
        .from('habit_monthly_memos').select('*').order('year').order('month');
      if (error) console.error('[db] habit_monthly_memos fetch:', error.message);
      return (data ?? []).map(toHabitMonthlyMemo);
    },
    upsert: async (memo: HabitMonthlyMemo) => {
      const { error } = await supabase.from('habit_monthly_memos').upsert(fromHabitMonthlyMemo(memo));
      if (error) console.error('[db] habit_monthly_memos upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('habit_monthly_memos').delete().eq('id', id);
      if (error) console.error('[db] habit_monthly_memos delete:', error.message);
    },
  },

  periodRecords: {
    fetchAll: async (): Promise<PeriodRecord[]> => {
      const { data, error } = await supabase
        .from('period_records').select('*').order('start_date', { ascending: false });
      if (error) console.error('[db] period_records fetch:', error.message);
      return (data ?? []).map(toPeriodRecord);
    },
    upsert: async (record: PeriodRecord) => {
      const { error } = await supabase.from('period_records').upsert(fromPeriodRecord(record));
      if (error) console.error('[db] period_records upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('period_records').delete().eq('id', id);
      if (error) console.error('[db] period_records delete:', error.message);
    },
  },

  settings: {
    fetch: async (): Promise<{ dayStartHour: number; dayEndHour: number; appSettings: Partial<import('../app/store').AppSettings> }> => {
      const { data, error } = await supabase
        .from('user_settings').select('*').eq('id', 'default').single();
      if (error) { console.error('[db] settings fetch:', error.message); return { dayStartHour: 4, dayEndHour: 26, appSettings: {} }; }
      let annualProfiles = parseAnnualProfilesFromDb(data.annual_profiles);
      const cy = String(new Date().getFullYear());
      const legacyId = (data.annual_identity ?? '').trim();
      const legacyVals = (data.annual_values ?? []) as string[];
      if (Object.keys(annualProfiles).length === 0 && (legacyId || legacyVals.length > 0)) {
        annualProfiles = {
          [cy]: { identity: data.annual_identity ?? '', values: legacyVals },
        };
      }
      const cyProfile = annualProfiles[cy] ?? { identity: '', values: [] as string[] };
      return {
        dayStartHour: data.day_start_hour,
        dayEndHour: data.day_end_hour,
        appSettings: {
          showQuarterlyGoals: data.show_quarterly_goals ?? false,
          showWeeklyKpt: data.show_weekly_kpt ?? false,
          showWeeklyHappiness: data.show_weekly_happiness ?? false,
          showMonthlyKpt: data.show_monthly_kpt ?? false,
          showHabitHeatmap: data.show_habit_heatmap ?? false,
          habitAlarmDefault: data.habit_alarm_default ?? '',
          globalAffirmation: data.global_affirmation ?? '',
          weekStartsOn: data.week_starts_on === 0 ? 0 : 1,
          mobileWeekDays: data.mobile_week_days === 2 ? 2 : 3,
          annualProfiles,
          annualIdentity: cyProfile.identity,
          annualValues: cyProfile.values,
          foodGoalDelivery: data.food_goal_delivery ?? undefined,
          foodGoalRestaurant: data.food_goal_restaurant ?? undefined,
          foodGoalCalories: data.food_goal_calories ?? undefined,
        },
      };
    },
    upsert: async (dayStartHour: number, dayEndHour: number, appSettings?: import('../app/store').AppSettings) => {
      const payload: Record<string, unknown> = { id: 'default', day_start_hour: dayStartHour, day_end_hour: dayEndHour };
      if (appSettings) {
        payload.show_quarterly_goals = appSettings.showQuarterlyGoals;
        payload.show_weekly_kpt = appSettings.showWeeklyKpt;
        payload.show_weekly_happiness = appSettings.showWeeklyHappiness;
        payload.show_monthly_kpt = appSettings.showMonthlyKpt;
        payload.show_habit_heatmap = appSettings.showHabitHeatmap;
        payload.habit_alarm_default = appSettings.habitAlarmDefault || null;
        payload.global_affirmation = appSettings.globalAffirmation || null;
        payload.week_starts_on = appSettings.weekStartsOn;
        payload.mobile_week_days = appSettings.mobileWeekDays;
        payload.annual_profiles = appSettings.annualProfiles ?? {};
        const cy = String(new Date().getFullYear());
        const slice = appSettings.annualProfiles?.[cy];
        payload.annual_identity = slice?.identity?.trim() ? slice.identity : null;
        payload.annual_values = slice?.values?.length ? slice.values : null;
        payload.food_goal_delivery = appSettings.foodGoalDelivery ?? null;
        payload.food_goal_restaurant = appSettings.foodGoalRestaurant ?? null;
        payload.food_goal_calories = appSettings.foodGoalCalories ?? null;
      }
      const { error } = await supabase.from('user_settings').upsert(payload);
      if (error) console.error('[db] settings upsert:', error.message);
    },
  },

  annualGoals: {
    fetchAll: async (): Promise<AnnualGoal[]> => {
      const { data, error } = await supabase.from('annual_goals').select('*').order('created_at');
      if (error) console.error('[db] annual_goals fetch:', error.message);
      return (data ?? []).map(toAnnualGoal);
    },
    upsert: async (goal: AnnualGoal) => {
      const { error } = await supabase.from('annual_goals').upsert(fromAnnualGoal(goal));
      if (error) console.error('[db] annual_goals upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('annual_goals').delete().eq('id', id);
      if (error) console.error('[db] annual_goals delete:', error.message);
    },
  },

  quarterlyGoals: {
    fetchAll: async (): Promise<QuarterlyGoal[]> => {
      const { data, error } = await supabase.from('quarterly_goals').select('*').order('created_at');
      if (error) console.error('[db] quarterly_goals fetch:', error.message);
      return (data ?? []).map(toQuarterlyGoal);
    },
    upsert: async (goal: QuarterlyGoal) => {
      const { error } = await supabase.from('quarterly_goals').upsert(fromQuarterlyGoal(goal));
      if (error) console.error('[db] quarterly_goals upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('quarterly_goals').delete().eq('id', id);
      if (error) console.error('[db] quarterly_goals delete:', error.message);
    },
  },

  // ── 질문일기 ─────────────────────────────────────────────────────────────────
  questionPool: {
    fetchAll: async (): Promise<{ id: string; content: string; is_custom: boolean; created_at: string }[]> => {
      const { data, error } = await supabase.from('question_pool').select('*').order('created_at');
      if (error) console.error('[db] question_pool fetch:', error.message);
      return data ?? [];
    },
    create: async (content: string): Promise<string | null> => {
      const { data, error } = await supabase
        .from('question_pool')
        .insert({ content, is_custom: true })
        .select('id')
        .single();
      if (error) { console.error('[db] question_pool create:', error.message); return null; }
      return data?.id ?? null;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('question_pool').delete().eq('id', id);
      if (error) console.error('[db] question_pool delete:', error.message);
    },
  },

  questionAnswers: {
    fetchAll: async (): Promise<{ id: string; question_id: string; answer: string; answered_at: string; created_at: string }[]> => {
      const { data, error } = await supabase.from('question_answers').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] question_answers fetch:', error.message);
      return data ?? [];
    },
    upsertByDate: async (questionId: string, answer: string, answeredAt: string): Promise<string | null> => {
      // 같은 날짜+질문 조합이면 UPDATE, 없으면 INSERT
      const { data: existing } = await supabase
        .from('question_answers')
        .select('id')
        .eq('question_id', questionId)
        .eq('answered_at', answeredAt)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from('question_answers')
          .update({ answer })
          .eq('id', existing.id);
        if (error) console.error('[db] question_answers update:', error.message);
        return existing.id;
      }
      const { data, error } = await supabase
        .from('question_answers')
        .insert({ question_id: questionId, answer, answered_at: answeredAt })
        .select('id')
        .single();
      if (error) { console.error('[db] question_answers insert:', error.message); return null; }
      return data?.id ?? null;
    },
    fetchByDate: async (answeredAt: string): Promise<{ id: string; question_id: string; answer: string; answered_at: string } | null> => {
      const { data, error } = await supabase
        .from('question_answers')
        .select('*')
        .eq('answered_at', answeredAt)
        .maybeSingle();
      if (error) console.error('[db] question_answers fetchByDate:', error.message);
      return data ?? null;
    },
    fetchByQuestionId: async (questionId: string): Promise<{ id: string; question_id: string; answer: string; answered_at: string }[]> => {
      const { data, error } = await supabase
        .from('question_answers')
        .select('*')
        .eq('question_id', questionId)
        .order('answered_at', { ascending: false });
      if (error) console.error('[db] question_answers fetchByQuestionId:', error.message);
      return data ?? [];
    },
  },

  dailyQuestion: {
    fetchByDate: async (date: string): Promise<{ id: string; question_id: string; date: string } | null> => {
      const { data, error } = await supabase
        .from('daily_question')
        .select('*')
        .eq('date', date)
        .maybeSingle();
      if (error) console.error('[db] daily_question fetchByDate:', error.message);
      return data ?? null;
    },
    assignRandom: async (date: string): Promise<string | null> => {
      // question_pool에서 랜덤 1개 선택
      const { data: pool, error: poolErr } = await supabase.from('question_pool').select('id');
      if (poolErr || !pool || pool.length === 0) return null;
      const randomId = pool[Math.floor(Math.random() * pool.length)].id;
      const { data, error } = await supabase
        .from('daily_question')
        .insert({ question_id: randomId, date })
        .select('question_id')
        .single();
      if (error) { console.error('[db] daily_question assign:', error.message); return null; }
      return data?.question_id ?? null;
    },
  },

  moments: {
    fetchAll: async (): Promise<{ id: string; created_at: string; content: string; photos: string[]; weather_temp: number | null; weather_code: number | null; is_highlight: boolean; sort_order: number | null }[]> => {
      const { data, error } = await supabase
        .from('moments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) console.error('[db] moments fetch:', error.message);
      return (data ?? []).map((r: any) => ({
        ...r,
        is_highlight: !!r.is_highlight,
        sort_order: r.sort_order ?? null,
      }));
    },
    create: async (content: string, photos: string[], weatherTemp?: number, weatherCode?: number): Promise<string | null> => {
      const { data, error } = await supabase
        .from('moments')
        .insert({ content, photos, weather_temp: weatherTemp ?? null, weather_code: weatherCode ?? null })
        .select('id')
        .single();
      if (error) { console.error('[db] moments create:', error.message); return null; }
      return data?.id ?? null;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('moments').delete().eq('id', id);
      if (error) console.error('[db] moments delete:', error.message);
    },
    setHighlight: async (id: string, value: boolean) => {
      const { error } = await supabase.from('moments').update({ is_highlight: value }).eq('id', id);
      if (error) console.error('[db] moments setHighlight:', error.message);
      return !error;
    },
    setSortOrders: async (entries: { id: string; sort_order: number }[]) => {
      // 같은 월 안에서 재정렬된 항목들을 개별 UPDATE로 저장. 항목 수가 적어 단순 병렬.
      const results = await Promise.all(
        entries.map(({ id, sort_order }) =>
          supabase.from('moments').update({ sort_order }).eq('id', id)
        )
      );
      const errors = results.filter(r => r.error);
      if (errors.length) console.error('[db] moments setSortOrders:', errors[0].error?.message);
      return errors.length === 0;
    },
    uploadPhoto: async (file: File, momentId: string, index: number): Promise<string | null> => {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${momentId}_${index}.${ext}`;
      const { error } = await supabase.storage.from('moment-photos').upload(path, file, { upsert: true });
      if (error) { console.error('[db] moment photo upload:', error.message); return null; }
      const { data } = supabase.storage.from('moment-photos').getPublicUrl(path);
      return data.publicUrl;
    },
  },

  weightRecords: {
    fetchAll: async (): Promise<WeightRecord[]> => {
      const { data, error } = await supabase
        .from('weight_records').select('*').order('date', { ascending: false });
      if (error) console.error('[db] weight_records fetch:', error.message);
      return (data ?? []).map((r: any): WeightRecord => ({
        id: r.id,
        date: r.date,
        weight: Number(r.weight),
        bodyFat: r.body_fat != null ? Number(r.body_fat) : null,
        muscleMass: r.muscle_mass != null ? Number(r.muscle_mass) : null,
        memo: r.memo ?? null,
      }));
    },
    upsert: async (record: WeightRecord) => {
      const { error } = await supabase.from('weight_records').upsert({
        id: record.id,
        date: record.date,
        weight: record.weight,
        body_fat: record.bodyFat ?? null,
        muscle_mass: record.muscleMass ?? null,
        memo: record.memo ?? null,
      }, { onConflict: 'date' });
      if (error) console.error('[db] weight_records upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('weight_records').delete().eq('id', id);
      if (error) console.error('[db] weight_records delete:', error.message);
    },
  },

  weightGoal: {
    fetch: async (): Promise<WeightGoal | null> => {
      const { data, error } = await supabase
        .from('weight_goals').select('*').eq('id', 'default').maybeSingle();
      if (error) console.error('[db] weight_goals fetch:', error.message);
      if (!data) return null;
      return {
        startWeight: Number(data.start_weight),
        targetWeight: Number(data.target_weight),
        targetBodyFat: data.target_body_fat != null ? Number(data.target_body_fat) : null,
        targetMuscleMass: data.target_muscle_mass != null ? Number(data.target_muscle_mass) : null,
      };
    },
    upsert: async (goal: WeightGoal) => {
      const { error } = await supabase.from('weight_goals').upsert({
        id: 'default',
        start_weight: goal.startWeight,
        target_weight: goal.targetWeight,
        target_body_fat: goal.targetBodyFat ?? null,
        target_muscle_mass: goal.targetMuscleMass ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) console.error('[db] weight_goals upsert:', error.message);
    },
  },

  conditionRecords: {
    fetchAll: async (): Promise<ConditionRecord[]> => {
      const { data, error } = await supabase
        .from('condition_records').select('*').order('date', { ascending: false });
      if (error) console.error('[db] condition_records fetch:', error.message);
      return (data ?? []).map((r: any): ConditionRecord => ({
        id: r.id,
        date: r.date,
        stress: r.stress,
        symptoms: r.symptoms ?? [],
        memo: r.memo ?? null,
      }));
    },
    upsert: async (record: ConditionRecord) => {
      const { error } = await supabase.from('condition_records').upsert({
        id: record.id,
        date: record.date,
        stress: record.stress,
        symptoms: record.symptoms ?? [],
        memo: record.memo ?? null,
      }, { onConflict: 'date' });
      if (error) console.error('[db] condition_records upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('condition_records').delete().eq('id', id);
      if (error) console.error('[db] condition_records delete:', error.message);
    },
  },

  cultureRecords: {
    fetchAll: async (): Promise<CultureRecord[]> => {
      const { data, error } = await supabase
        .from('culture_records').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] culture_records fetch:', error.message);
      return (data ?? []).map((r: any): CultureRecord => ({
        id: r.id,
        title: r.title,
        platform: r.platform,
        contentType: r.content_type,
        url: r.url ?? null,
        thumbnailUrl: r.thumbnail_url ?? null,
        externalSource: r.external_source ?? null,
        externalId: r.external_id ?? null,
        status: r.status,
        rating: r.rating != null ? Number(r.rating) : null,
        review: r.review ?? null,
        insight: r.insight ?? null,
        tags: r.tags ?? [],
        watchedDate: r.watched_date ?? null,
        createdAt: r.created_at ?? undefined,
        updatedAt: r.updated_at ?? undefined,
      }));
    },
    // user_id 는 DB 기본값 auth.uid() 로 자동 채워지므로 클라이언트에서 보내지 않는다.
    upsert: async (record: CultureRecord) => {
      const { error } = await supabase.from('culture_records').upsert({
        id: record.id,
        title: record.title,
        platform: record.platform,
        content_type: record.contentType,
        url: record.url ?? null,
        thumbnail_url: record.thumbnailUrl ?? null,
        external_source: record.externalSource ?? 'manual',
        external_id: record.externalId ?? null,
        status: record.status,
        rating: record.rating ?? null,
        review: record.review ?? null,
        insight: record.insight ?? null,
        tags: record.tags ?? [],
        watched_date: record.watchedDate ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) console.error('[db] culture_records upsert:', error.message);
    },
    // 카드 레벨 빠른 상태 변경용 — 상태만 갱신, 성공 여부 반환(optimistic rollback 판단)
    updateStatus: async (id: string, status: CultureRecord['status']): Promise<boolean> => {
      const { error } = await supabase.from('culture_records')
        .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) { console.error('[db] culture_records updateStatus:', error.message); return false; }
      return true;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('culture_records').delete().eq('id', id);
      if (error) console.error('[db] culture_records delete:', error.message);
    },
  },

  // ── 음악 기록 (문화 기록 > 음악, Stage 1) ──
  musicRecords: {
    fetchAll: async (): Promise<MusicRecord[]> => {
      const { data, error } = await supabase
        .from('music_records').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] music_records fetch:', error.message);
      return (data ?? []).map((r: any): MusicRecord => ({
        id: r.id,
        trackTitle: r.track_title,
        artist: r.artist,
        album: r.album ?? null,
        artworkUrl: r.artwork_url ?? null,
        releaseYear: r.release_year ?? null,
        itunesTrackId: r.itunes_track_id ?? null,
        previewUrl: r.preview_url ?? null,
        mood: r.mood ?? [],
        genre: r.genre ?? null,
        memo: r.memo ?? null,
        listenUrl: r.listen_url ?? null,
        stickers: r.stickers ?? [],
        createdAt: r.created_at ?? undefined,
      }));
    },
    // 같은 곡(itunes_track_id)이 이미 저장돼 있는지 확인 (중복 추가 방지용)
    existsByItunesId: async (itunesTrackId: number): Promise<boolean> => {
      const { data, error } = await supabase
        .from('music_records').select('id').eq('itunes_track_id', itunesTrackId).limit(1);
      if (error) { console.error('[db] music_records exists:', error.message); return false; }
      return (data ?? []).length > 0;
    },
    // user_id 는 DB 기본값 auth.uid() 로 자동 채워지므로 클라이언트에서 보내지 않는다.
    insert: async (record: Omit<MusicRecord, 'id' | 'createdAt'>): Promise<MusicRecord | null> => {
      const { data, error } = await supabase.from('music_records').insert({
        track_title: record.trackTitle,
        artist: record.artist,
        album: record.album ?? null,
        artwork_url: record.artworkUrl ?? null,
        release_year: record.releaseYear ?? null,
        itunes_track_id: record.itunesTrackId ?? null,
        preview_url: record.previewUrl ?? null,
        mood: record.mood ?? [],
        genre: record.genre ?? null,
        memo: record.memo ?? null,
        listen_url: record.listenUrl ?? null,
        stickers: record.stickers ?? [],
      }).select().single();
      if (error) { console.error('[db] music_records insert:', error.message); return null; }
      return {
        id: data.id,
        trackTitle: data.track_title,
        artist: data.artist,
        album: data.album ?? null,
        artworkUrl: data.artwork_url ?? null,
        releaseYear: data.release_year ?? null,
        itunesTrackId: data.itunes_track_id ?? null,
        previewUrl: data.preview_url ?? null,
        mood: data.mood ?? [],
        genre: data.genre ?? null,
        memo: data.memo ?? null,
        listenUrl: data.listen_url ?? null,
        stickers: data.stickers ?? [],
        createdAt: data.created_at ?? undefined,
      };
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('music_records').delete().eq('id', id);
      if (error) console.error('[db] music_records delete:', error.message);
    },
  },

  // ── 레시피 모듈 (Phase 1) — recipes + 자식 테이블(ingredients/steps) ──
  recipes: {
    fetchAll: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, recipe_ingredients(*), recipe_steps(*)')
        .order('created_at', { ascending: false });
      if (error) console.error('[db] recipes fetch:', error.message);
      return (data ?? []).map((r: any): Recipe => ({
        id: r.id,
        title: r.title,
        sourceType: r.source_type,
        sourceUrl: r.source_url ?? null,
        thumbnailUrl: r.thumbnail_url ?? null,
        myPhotoUrl: r.my_photo_url ?? null,
        coverSource: (r.cover_source ?? 'thumbnail') as Recipe['coverSource'],
        totalMinutes: r.total_minutes ?? null,
        baseServings: r.base_servings ?? 2,
        rating: r.rating != null ? Number(r.rating) : null,
        memo: r.memo ?? null,
        tags: r.tags ?? [],
        mainIngredients: r.main_ingredients ?? [],
        cookCount: r.cook_count ?? 0,
        lastCookedAt: r.last_cooked_at ?? null,
        ingredients: ((r.recipe_ingredients ?? []) as any[])
          .map((g): RecipeIngredient => ({
            id: g.id,
            name: g.name,
            amount: g.amount != null ? Number(g.amount) : null,
            unit: g.unit ?? null,
            sortOrder: g.sort_order ?? 0,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
        steps: ((r.recipe_steps ?? []) as any[])
          .map((s): RecipeStep => ({
            id: s.id,
            stepNo: s.step_no,
            instruction: s.instruction,
            timerSeconds: s.timer_seconds ?? null,
            sortOrder: s.sort_order ?? 0,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
        createdAt: r.created_at ?? undefined,
        updatedAt: r.updated_at ?? undefined,
      }));
    },

    // 레시피 본체 + 재료/단계를 3개 테이블에 분해 저장.
    // user_id 는 DB 기본값 auth.uid() 로 자동 채워지므로 클라이언트에서 보내지 않는다.
    // 자식(ingredients/steps)은 전량 교체 방식: 해당 recipe_id 의 기존 행을 모두 지우고 다시 삽입.
    upsert: async (recipe: Recipe) => {
      const { error: rErr } = await supabase.from('recipes').upsert({
        id: recipe.id,
        title: recipe.title,
        source_type: recipe.sourceType ?? 'manual',
        source_url: recipe.sourceUrl ?? null,
        thumbnail_url: recipe.thumbnailUrl ?? null,
        my_photo_url: recipe.myPhotoUrl ?? null,
        cover_source: recipe.coverSource ?? 'thumbnail',
        total_minutes: recipe.totalMinutes ?? null,
        base_servings: recipe.baseServings ?? 2,
        rating: recipe.rating ?? null,
        memo: recipe.memo ?? null,
        tags: recipe.tags ?? [],
        main_ingredients: recipe.mainIngredients ?? [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (rErr) { console.error('[db] recipes upsert:', rErr.message); return; }

      // 자식 전량 교체
      const { error: delIngErr } = await supabase
        .from('recipe_ingredients').delete().eq('recipe_id', recipe.id);
      if (delIngErr) console.error('[db] recipe_ingredients clear:', delIngErr.message);
      const { error: delStepErr } = await supabase
        .from('recipe_steps').delete().eq('recipe_id', recipe.id);
      if (delStepErr) console.error('[db] recipe_steps clear:', delStepErr.message);

      if (recipe.ingredients.length > 0) {
        const { error } = await supabase.from('recipe_ingredients').insert(
          recipe.ingredients.map((g, i) => ({
            recipe_id: recipe.id,
            name: g.name,
            amount: g.amount ?? null,
            unit: g.unit ?? null,
            sort_order: g.sortOrder ?? i,
          })),
        );
        if (error) console.error('[db] recipe_ingredients insert:', error.message);
      }
      if (recipe.steps.length > 0) {
        const { error } = await supabase.from('recipe_steps').insert(
          recipe.steps.map((s, i) => ({
            recipe_id: recipe.id,
            step_no: s.stepNo ?? i + 1,
            instruction: s.instruction,
            timer_seconds: s.timerSeconds ?? null,
            sort_order: s.sortOrder ?? i,
          })),
        );
        if (error) console.error('[db] recipe_steps insert:', error.message);
      }
    },

    // 별점만 갱신 (상세 화면 별점 탭) — 성공 여부 반환
    updateRating: async (id: string, rating: number | null): Promise<boolean> => {
      const { error } = await supabase.from('recipes')
        .update({ rating, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) { console.error('[db] recipes updateRating:', error.message); return false; }
      return true;
    },

    // 메모만 갱신 (상세 화면 메모)
    updateMemo: async (id: string, memo: string | null): Promise<boolean> => {
      const { error } = await supabase.from('recipes')
        .update({ memo, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) { console.error('[db] recipes updateMemo:', error.message); return false; }
      return true;
    },

    // 조리 1회 기록 (릴스 뷰 '완성' 화면 등에서 호출 예정)
    markCooked: async (id: string, currentCount: number): Promise<boolean> => {
      const { error } = await supabase.from('recipes')
        .update({
          cook_count: currentCount + 1,
          last_cooked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', id);
      if (error) { console.error('[db] recipes markCooked:', error.message); return false; }
      return true;
    },

    // 내가 만든 사진 업로드 → publicUrl 반환 (앱의 food-photos/moment-photos 패턴 동일)
    uploadPhoto: async (recipeId: string, file: File): Promise<string | null> => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${recipeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: true });
      if (error) { console.error('[db] recipe-photos upload:', error.message); return null; }
      const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path);
      return data.publicUrl ?? null;
    },

    delete: async (id: string) => {
      // recipe_ingredients / recipe_steps 는 ON DELETE CASCADE 로 함께 삭제됨
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) console.error('[db] recipes delete:', error.message);
    },
  },

  // ── 레시피 조리 기록 — recipe_cook_logs (Phase 1 B-2) ──
  recipeCookLogs: {
    // 특정 레시피의 기록을 최신순으로
    fetchByRecipe: async (recipeId: string): Promise<RecipeCookLog[]> => {
      const { data, error } = await supabase
        .from('recipe_cook_logs')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('cooked_at', { ascending: false });
      if (error) console.error('[db] recipe_cook_logs fetch:', error.message);
      return (data ?? []).map((r: any): RecipeCookLog => ({
        id: r.id,
        recipeId: r.recipe_id,
        cookedAt: r.cooked_at,
        photoUrl: r.photo_url ?? null,
        note: r.note ?? null,
        createdAt: r.created_at ?? undefined,
      }));
    },

    // 한 건 기록 추가 — 생성된 row 반환(사진 업로드 후 update에 id 필요)
    insert: async (params: { recipeId: string; note?: string | null }): Promise<RecipeCookLog | null> => {
      const { data, error } = await supabase
        .from('recipe_cook_logs')
        .insert({ recipe_id: params.recipeId, note: params.note ?? null })
        .select()
        .single();
      if (error) { console.error('[db] recipe_cook_logs insert:', error.message); return null; }
      return {
        id: data.id,
        recipeId: data.recipe_id,
        cookedAt: data.cooked_at,
        photoUrl: data.photo_url ?? null,
        note: data.note ?? null,
        createdAt: data.created_at ?? undefined,
      };
    },

    // 사진 URL 사후 업데이트
    setPhotoUrl: async (id: string, url: string | null): Promise<boolean> => {
      const { error } = await supabase.from('recipe_cook_logs').update({ photo_url: url }).eq('id', id);
      if (error) { console.error('[db] recipe_cook_logs setPhotoUrl:', error.message); return false; }
      return true;
    },

    // 기존 recipe-photos 버킷 재사용 — 경로: <recipeId>/cooklog/<uuid>.<ext>
    uploadPhoto: async (recipeId: string, file: File): Promise<string | null> => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${recipeId}/cooklog/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: true });
      if (error) { console.error('[db] recipe-photos cooklog upload:', error.message); return null; }
      const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path);
      return data.publicUrl ?? null;
    },

    delete: async (id: string) => {
      const { error } = await supabase.from('recipe_cook_logs').delete().eq('id', id);
      if (error) console.error('[db] recipe_cook_logs delete:', error.message);
    },
  },

  // ── 냉장고 (Phase 2) — fridge_items ──
  fridgeItems: {
    fetchAll: async (): Promise<FridgeItem[]> => {
      const { data, error } = await supabase
        .from('fridge_items').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] fridge_items fetch:', error.message);
      return (data ?? []).map((r: any): FridgeItem => ({
        id: r.id,
        name: r.name,
        category: r.category,
        quantity: r.quantity != null ? Number(r.quantity) : 1,
        unit: r.unit ?? null,
        expiryDate: r.expiry_date ?? null,
        createdAt: r.created_at ?? undefined,
      }));
    },
    // user_id 는 DB 기본값 auth.uid() 로 자동 채워지므로 클라이언트에서 보내지 않는다.
    upsert: async (item: FridgeItem) => {
      const { error } = await supabase.from('fridge_items').upsert({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit ?? null,
        expiry_date: item.expiryDate ?? null,
      }, { onConflict: 'id' });
      if (error) console.error('[db] fridge_items upsert:', error.message);
    },
    // 빠른 입력(2b) — 여러 항목 일괄 저장
    insertMany: async (items: FridgeItem[]) => {
      if (items.length === 0) return;
      const { error } = await supabase.from('fridge_items').insert(
        items.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit ?? null,
          expiry_date: item.expiryDate ?? null,
        })),
      );
      if (error) console.error('[db] fridge_items insertMany:', error.message);
    },
    updateQuantity: async (id: string, quantity: number) => {
      const { error } = await supabase.from('fridge_items').update({ quantity }).eq('id', id);
      if (error) console.error('[db] fridge_items updateQuantity:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('fridge_items').delete().eq('id', id);
      if (error) console.error('[db] fridge_items delete:', error.message);
    },
    deleteMany: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('fridge_items').delete().in('id', ids);
      if (error) console.error('[db] fridge_items deleteMany:', error.message);
    },
  },

  // ── 장보기 (Phase 2) — shopping_items ──
  shoppingItems: {
    fetchAll: async (): Promise<ShoppingItem[]> => {
      const { data, error } = await supabase
        .from('shopping_items').select('*')
        .order('is_checked', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) console.error('[db] shopping_items fetch:', error.message);
      return (data ?? []).map((r: any): ShoppingItem => ({
        id: r.id,
        name: r.name,
        quantity: r.quantity != null ? Number(r.quantity) : 1,
        unit: r.unit ?? null,
        sourceRecipeId: r.source_recipe_id ?? null,
        sourceLabel: r.source_label ?? null,
        isChecked: !!r.is_checked,
        createdAt: r.created_at ?? undefined,
      }));
    },
    upsert: async (item: ShoppingItem) => {
      const { error } = await supabase.from('shopping_items').upsert({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit ?? null,
        source_recipe_id: item.sourceRecipeId ?? null,
        source_label: item.sourceLabel ?? null,
        is_checked: item.isChecked,
      }, { onConflict: 'id' });
      if (error) console.error('[db] shopping_items upsert:', error.message);
    },
    setChecked: async (id: string, isChecked: boolean) => {
      const { error } = await supabase.from('shopping_items').update({ is_checked: isChecked }).eq('id', id);
      if (error) console.error('[db] shopping_items setChecked:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('shopping_items').delete().eq('id', id);
      if (error) console.error('[db] shopping_items delete:', error.message);
    },
    deleteMany: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('shopping_items').delete().in('id', ids);
      if (error) console.error('[db] shopping_items deleteMany:', error.message);
    },
  },

  // ── 비전보드 — vision_categories / vision_items / Storage(vision-board) ──
  // 단일 사용자 컨벤션: user_id 는 DB DEFAULT auth.uid() 로 자동 충전 → 클라이언트 미전송.
  // 기본 카테고리("올해의 나"/"여행"/"공간"/"습관"/"마음")는 마이그레이션 시점에 user_id를
  // 알 수 없으므로 첫 fetchAll 결과가 빈 배열일 때 이 레이어에서 자동 시드한다.
  visionCategories: {
    fetchAll: async (): Promise<{ id: string; name: string; sort_order: number; created_at: string }[]> => {
      const { data, error } = await supabase
        .from('vision_categories')
        .select('id, name, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) { console.error('[db] vision_categories fetch:', error.message); return []; }
      // 빈 배열이면 기본 카테고리 시드 후 다시 조회 (멱등 — 이후 호출에선 시드 안 함)
      if (!data || data.length === 0) {
        const seeded = await db.visionCategories.ensureSeed();
        return seeded;
      }
      return data;
    },
    ensureSeed: async (): Promise<{ id: string; name: string; sort_order: number; created_at: string }[]> => {
      const DEFAULTS = ['올해의 나', '여행', '공간', '습관', '마음'];
      // race condition 방어: 시드 직전 한 번 더 확인
      const { data: existing } = await supabase
        .from('vision_categories')
        .select('id')
        .limit(1);
      if (existing && existing.length > 0) {
        // 이미 다른 호출/탭이 시드했음 → 그냥 정렬해서 반환
        const { data } = await supabase
          .from('vision_categories')
          .select('id, name, sort_order, created_at')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        return data ?? [];
      }
      const rows = DEFAULTS.map((name, i) => ({ name, sort_order: i }));
      const { data, error } = await supabase
        .from('vision_categories')
        .insert(rows)
        .select('id, name, sort_order, created_at');
      if (error) { console.error('[db] vision_categories seed:', error.message); return []; }
      return data ?? [];
    },
    create: async (name: string, sortOrder: number): Promise<{ id: string; name: string; sort_order: number; created_at: string } | null> => {
      const { data, error } = await supabase
        .from('vision_categories')
        .insert({ name, sort_order: sortOrder })
        .select('id, name, sort_order, created_at')
        .single();
      if (error) { console.error('[db] vision_categories create:', error.message); return null; }
      return data;
    },
    rename: async (id: string, name: string) => {
      const { error } = await supabase.from('vision_categories').update({ name }).eq('id', id);
      if (error) console.error('[db] vision_categories rename:', error.message);
    },
    delete: async (id: string) => {
      // vision_items.category_id ON DELETE SET NULL → 항목은 "미분류"로 보존
      const { error } = await supabase.from('vision_categories').delete().eq('id', id);
      if (error) console.error('[db] vision_categories delete:', error.message);
    },
    setSortOrders: async (entries: { id: string; sort_order: number }[]) => {
      if (entries.length === 0) return true;
      const results = await Promise.all(
        entries.map(({ id, sort_order }) =>
          supabase.from('vision_categories').update({ sort_order }).eq('id', id)
        )
      );
      const errors = results.filter(r => r.error);
      if (errors.length) console.error('[db] vision_categories setSortOrders:', errors[0].error?.message);
      return errors.length === 0;
    },
  },

  visionItems: {
    fetchAll: async (): Promise<{ id: string; image_url: string | null; caption: string | null; category_id: string | null; sort_order: number; created_at: string }[]> => {
      const { data, error } = await supabase
        .from('vision_items')
        .select('id, image_url, caption, category_id, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) console.error('[db] vision_items fetch:', error.message);
      return data ?? [];
    },
    nextSortOrder: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('vision_items')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      if (error) { console.error('[db] vision_items nextSortOrder:', error.message); return 0; }
      const max = data?.[0]?.sort_order ?? -1;
      return max + 1;
    },
    create: async (params: { imageUrl: string | null; caption: string | null; categoryId: string | null; sortOrder: number }): Promise<string | null> => {
      const { data, error } = await supabase
        .from('vision_items')
        .insert({
          image_url: params.imageUrl,
          caption: params.caption,
          category_id: params.categoryId,
          sort_order: params.sortOrder,
        })
        .select('id')
        .single();
      if (error) { console.error('[db] vision_items create:', error.message); return null; }
      return data?.id ?? null;
    },
    update: async (id: string, patch: { imageUrl?: string | null; caption?: string | null; categoryId?: string | null }) => {
      const row: Record<string, unknown> = {};
      if ('imageUrl' in patch) row.image_url = patch.imageUrl ?? null;
      if ('caption' in patch) row.caption = patch.caption ?? null;
      if ('categoryId' in patch) row.category_id = patch.categoryId ?? null;
      const { error } = await supabase.from('vision_items').update(row).eq('id', id);
      if (error) console.error('[db] vision_items update:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('vision_items').delete().eq('id', id);
      if (error) console.error('[db] vision_items delete:', error.message);
    },
    setSortOrders: async (entries: { id: string; sort_order: number }[]) => {
      if (entries.length === 0) return true;
      const results = await Promise.all(
        entries.map(({ id, sort_order }) =>
          supabase.from('vision_items').update({ sort_order }).eq('id', id)
        )
      );
      const errors = results.filter(r => r.error);
      if (errors.length) console.error('[db] vision_items setSortOrders:', errors[0].error?.message);
      return errors.length === 0;
    },
    uploadImage: async (file: File, itemKey: string): Promise<string | null> => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${itemKey}.${ext}`;
      const { error } = await supabase.storage.from('vision-board').upload(path, file, { upsert: true, contentType: file.type });
      if (error) { console.error('[db] vision-board upload:', error.message); return null; }
      const { data } = supabase.storage.from('vision-board').getPublicUrl(path);
      return data.publicUrl;
    },
  },

  // ── 만다라트 — mandalart_boards / mandalart_cells ───────────────────────
  // 단일 사용자 컨벤션: boards.user_id 는 DB DEFAULT auth.uid() 로 자동 충전.
  // 첫 fetchAll 이 빈 배열이면 기본 보드 1개를 자동 시드한다(멱등).
  mandalartBoards: {
    fetchAll: async (): Promise<{ id: string; title: string; sort_order: number; created_at: string }[]> => {
      const { data, error } = await supabase
        .from('mandalart_boards')
        .select('id, title, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) { console.error('[db] mandalart_boards fetch:', error.message); return []; }
      if (!data || data.length === 0) {
        return await db.mandalartBoards.ensureSeed();
      }
      return data;
    },
    ensureSeed: async (): Promise<{ id: string; title: string; sort_order: number; created_at: string }[]> => {
      const { data: existing } = await supabase
        .from('mandalart_boards')
        .select('id')
        .limit(1);
      if (existing && existing.length > 0) {
        const { data } = await supabase
          .from('mandalart_boards')
          .select('id, title, sort_order, created_at')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        return data ?? [];
      }
      const { data, error } = await supabase
        .from('mandalart_boards')
        .insert({ title: '나의 만다라트', sort_order: 0 })
        .select('id, title, sort_order, created_at');
      if (error) { console.error('[db] mandalart_boards seed:', error.message); return []; }
      return data ?? [];
    },
    create: async (title: string, sortOrder: number): Promise<{ id: string; title: string; sort_order: number; created_at: string } | null> => {
      const { data, error } = await supabase
        .from('mandalart_boards')
        .insert({ title, sort_order: sortOrder })
        .select('id, title, sort_order, created_at')
        .single();
      if (error) { console.error('[db] mandalart_boards create:', error.message); return null; }
      return data;
    },
    rename: async (id: string, title: string) => {
      const { error } = await supabase.from('mandalart_boards').update({ title }).eq('id', id);
      if (error) console.error('[db] mandalart_boards rename:', error.message);
    },
    delete: async (id: string) => {
      // cells 는 ON DELETE CASCADE 로 함께 삭제
      const { error } = await supabase.from('mandalart_boards').delete().eq('id', id);
      if (error) console.error('[db] mandalart_boards delete:', error.message);
    },
  },

  mandalartCells: {
    fetchByBoard: async (boardId: string): Promise<{
      id: string; board_id: string; parent_id: string | null;
      position: number; content: string; is_done: boolean; created_at: string;
    }[]> => {
      const { data, error } = await supabase
        .from('mandalart_cells')
        .select('id, board_id, parent_id, position, content, is_done, created_at')
        .eq('board_id', boardId)
        .order('position', { ascending: true });
      if (error) { console.error('[db] mandalart_cells fetch:', error.message); return []; }
      return data ?? [];
    },
    upsert: async (params: {
      boardId: string;
      parentId: string | null;
      position: number;
      content?: string;
      isDone?: boolean;
    }): Promise<{
      id: string; board_id: string; parent_id: string | null;
      position: number; content: string; is_done: boolean; created_at: string;
    } | null> => {
      // 같은 (board, parent, position) 의 셀이 있으면 update, 없으면 insert.
      const baseQuery = supabase
        .from('mandalart_cells')
        .select('id')
        .eq('board_id', params.boardId)
        .eq('position', params.position);
      const { data: existing, error: selErr } = params.parentId === null
        ? await baseQuery.is('parent_id', null).maybeSingle()
        : await baseQuery.eq('parent_id', params.parentId).maybeSingle();
      if (selErr) { console.error('[db] mandalart_cells upsert select:', selErr.message); return null; }
      const patch: Record<string, unknown> = {};
      if (params.content !== undefined) patch.content = params.content;
      if (params.isDone !== undefined) patch.is_done = params.isDone;
      if (existing) {
        const { data, error } = await supabase
          .from('mandalart_cells')
          .update(patch)
          .eq('id', existing.id)
          .select('id, board_id, parent_id, position, content, is_done, created_at')
          .single();
        if (error) { console.error('[db] mandalart_cells update:', error.message); return null; }
        return data;
      }
      const { data, error } = await supabase
        .from('mandalart_cells')
        .insert({
          board_id: params.boardId,
          parent_id: params.parentId,
          position: params.position,
          content: params.content ?? '',
          is_done: params.isDone ?? false,
        })
        .select('id, board_id, parent_id, position, content, is_done, created_at')
        .single();
      if (error) { console.error('[db] mandalart_cells insert:', error.message); return null; }
      return data;
    },
    update: async (id: string, patch: { content?: string; isDone?: boolean }) => {
      const row: Record<string, unknown> = {};
      if (patch.content !== undefined) row.content = patch.content;
      if (patch.isDone !== undefined) row.is_done = patch.isDone;
      const { error } = await supabase.from('mandalart_cells').update(row).eq('id', id);
      if (error) console.error('[db] mandalart_cells update:', error.message);
    },
    delete: async (id: string) => {
      // 자식 셀은 ON DELETE CASCADE 로 함께 삭제됨
      const { error } = await supabase.from('mandalart_cells').delete().eq('id', id);
      if (error) console.error('[db] mandalart_cells delete:', error.message);
    },
  },
};
