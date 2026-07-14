import { supabase } from './supabase';
import { format, addDays, subDays } from 'date-fns';
import { createEvent as createEventApi, deleteEvent as deleteEventApi, getEvents, upsertEvent as upsertEventApi } from '../api/events';
import type {
  Todo, TodoTimeBlock, Habit, Project, Milestone,
  SelfCareRecord, ReviewRecord, WeeklyReview, MonthlyReview, HappyMoment, TimelineLog,
  FoodRecord, DiningType, TasteRating, Event, WeeklyGoal, MonthlyGoal, BrainstormItem, Tag, Routine,
  PeriodRecord, HabitMonthlyMemo, AnnualGoal, QuarterlyGoal,
  WeightRecord, WeightGoal, ConditionRecord, UserSymptom, CultureRecord, MusicRecord,
  Recipe, RecipeIngredient, RecipeStep, RecipeCookLog,
  FridgeItem, ShoppingItem,
  BeautyProduct, BeautySpecialCare, HouseholdItem, ConsumableCycle, CleaningZone,
  Scrap, ScrapNote, ScrapSource, ScrapStatus,
  MindmapNode, MindmapTreeNode, MindmapDir,
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
  end_date: string | null;
  status: string; is_top3: boolean; plan_start: string | null; plan_end: string | null;
  do_start: string | null; do_end: string | null; do_elapsed_sec: number | null;
  category: string | null;
  project_id: string | null;
  weekly_goal_id: string | null;
  milestone_id: string | null;
  mandalart_cell_id: string | null;
  tags: string[];
  recurrence_rule: string | null;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  recurrence_parent_id: string | null;
  is_exception: boolean | null;
  recurrence_freq: string | null;
  recurrence_interval: number | null;
  recurrence_preset: string | null;
};

type TodoTimeBlockRow = {
  id: string;
  todo_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  elapsed_sec: number | null;
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
  goal_kind?: string | null;
  goal_id?: string | null;
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
  mandalart_cell_id?: string | null;
};

type MonthlyGoalRow = {
  id: string; text: string; month: string; project_id: string | null;
  annual_goal_id?: string | null;
  mandalart_cell_id?: string | null;
};

type BrainstormItemRow = {
  id: string; text: string; date: string; week_key: string | null;
};

type BrainstormMemoRow = {
  date: string; text: string;
};

type TagRow = {
  id: string; name: string; color: string; track_time: boolean;
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
  mandalart_cell_id?: string | null;
};

type QuarterlyGoalRow = {
  id: string; year: number; quarter: number; text: string; done: boolean;
};

type ScrapRow = {
  id: string;
  url: string | null;
  source: string | null;
  title: string | null;
  thumbnail_url: string | null;
  comment: string | null;
  tags: string[] | null;
  status: string;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const toScrap = (r: ScrapRow): Scrap => ({
  id: r.id,
  url: r.url,
  source: (r.source as ScrapSource | null) ?? null,
  title: r.title,
  thumbnailUrl: r.thumbnail_url,
  comment: r.comment,
  tags: r.tags ?? [],
  status: (r.status as ScrapStatus) ?? 'unread',
  lastViewedAt: r.last_viewed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type ScrapNoteRow = {
  id: string;
  scrap_id: string;
  content: string;
  created_at: string;
};

const toScrapNote = (r: ScrapNoteRow): ScrapNote => ({
  id: r.id,
  scrapId: r.scrap_id,
  content: r.content,
  createdAt: r.created_at,
});

type MindmapNodeRow = {
  id: string;
  scrap_id: string;
  parent_id: string | null;
  text: string;
  dir: string | null;
  sort_order: number;
  created_at: string;
};

const toMindmapNode = (r: MindmapNodeRow): MindmapNode => ({
  id: r.id,
  scrapId: r.scrap_id,
  parentId: r.parent_id ?? null,
  text: r.text ?? '',
  dir: (r.dir as MindmapDir | null) ?? null,
  sortOrder: r.sort_order ?? 0,
  createdAt: r.created_at,
});

// ── 변환 함수 ────────────────────────────────────────────────────────────────

const toTodo = (r: TodoRow): Todo => ({
  id: r.id, text: r.text, date: r.date, dueDate: r.due_date ?? undefined,
  endDate: r.end_date ?? undefined,
  status: r.status as Todo['status'], isTop3: r.is_top3,
  planStart: r.plan_start ?? undefined, planEnd: r.plan_end ?? undefined,
  doStart: r.do_start ?? undefined, doEnd: r.do_end ?? undefined,
  doElapsedSec: r.do_elapsed_sec ?? undefined,
  category: r.category ?? undefined, projectId: r.project_id ?? undefined,
  weeklyGoalId: r.weekly_goal_id ?? undefined,
  milestoneId: r.milestone_id ?? undefined,
  mandalartCellId: r.mandalart_cell_id ?? undefined,
  tags: r.tags ?? [],
  recurrenceRule: r.recurrence_rule as Todo['recurrenceRule'] ?? undefined,
  recurrenceDays: r.recurrence_days ?? undefined,
  recurrenceEndDate: r.recurrence_end_date ?? undefined,
  recurrenceParentId: r.recurrence_parent_id ?? undefined,
  isException: r.is_exception ?? undefined,
  recurrenceFreq: r.recurrence_freq as Todo['recurrenceFreq'] ?? undefined,
  recurrenceInterval: r.recurrence_interval ?? undefined,
  recurrencePreset: r.recurrence_preset as Todo['recurrencePreset'] ?? undefined,
});

const fromTodo = (t: Todo): TodoRow => ({
  id: t.id, text: t.text, date: t.date ?? null, due_date: t.dueDate ?? null,
  end_date: t.endDate ?? null,
  status: t.status, is_top3: t.isTop3,
  plan_start: t.planStart ?? null, plan_end: t.planEnd ?? null,
  do_start: t.doStart ?? null, do_end: t.doEnd ?? null,
  do_elapsed_sec: t.doElapsedSec ?? null,
  category: t.category ?? null, project_id: t.projectId ?? null,
  weekly_goal_id: t.weeklyGoalId ?? null,
  milestone_id: t.milestoneId ?? null,
  mandalart_cell_id: t.mandalartCellId ?? null,
  tags: t.tags ?? [],
  recurrence_rule: t.recurrenceRule ?? null,
  recurrence_days: t.recurrenceDays ?? null,
  recurrence_end_date: t.recurrenceEndDate ?? null,
  recurrence_parent_id: t.recurrenceParentId ?? null,
  is_exception: t.isException ?? null,
  recurrence_freq: t.recurrenceFreq ?? null,
  recurrence_interval: t.recurrenceInterval ?? null,
  recurrence_preset: t.recurrencePreset ?? null,
});

const toTimeBlock = (r: TodoTimeBlockRow): TodoTimeBlock => ({
  id: r.id,
  todoId: r.todo_id,
  date: r.date,
  start: r.start_time ?? undefined,
  end: r.end_time ?? undefined,
  elapsedSec: r.elapsed_sec ?? 0,
});

const fromTimeBlock = (b: TodoTimeBlock): Record<string, unknown> => ({
  id: b.id,
  todo_id: b.todoId,
  date: b.date,
  start_time: b.start ?? null,
  end_time: b.end ?? null,
  elapsed_sec: b.elapsedSec ?? 0,
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
  goalKind: (r.goal_kind ?? undefined) as Project['goalKind'],
  goalId: r.goal_id ?? undefined,
});

const fromProject = (p: Project): ProjectRow => ({
  id: p.id, name: p.name, color: p.color,
  description: p.description ?? null,
  start_date: p.startDate ?? null,
  end_date: p.endDate ?? null,
  status: p.status,
  goal_kind: p.goalKind ?? null,
  goal_id: p.goalId ?? null,
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
  kpt_keep: string | null; kpt_problem: string | null; kpt_try: string | null;
};

type MonthlyReviewRow = {
  id: string; month: string; achievement: string; next_focus: string;
  highlight: string | null; did_well: string | null; regret: string | null;
  kpt_keep: string | null; kpt_problem: string | null; kpt_try: string | null;
  best_video: string | null; best_music: string | null; best_book: string | null; best_place: string | null;
};

const toWeeklyReview = (r: WeeklyReviewRow): WeeklyReview => ({
  id: r.id, weekKey: r.week_key, good: r.good ?? '', hard: r.hard ?? '', nextWeek: r.next_week ?? '',
  kptKeep: r.kpt_keep ?? undefined,
  kptProblem: r.kpt_problem ?? undefined,
  kptTry: r.kpt_try ?? undefined,
});
const fromWeeklyReview = (r: WeeklyReview): WeeklyReviewRow => ({
  id: r.id, week_key: r.weekKey, good: r.good ?? '', hard: r.hard ?? '', next_week: r.nextWeek ?? '',
  kpt_keep: r.kptKeep ?? null,
  kpt_problem: r.kptProblem ?? null,
  kpt_try: r.kptTry ?? null,
});

const toMonthlyReview = (r: MonthlyReviewRow): MonthlyReview => ({
  id: r.id, month: r.month, achievement: r.achievement ?? '', nextFocus: r.next_focus ?? '',
  highlight: r.highlight ?? undefined,
  didWell: r.did_well ?? undefined,
  regret: r.regret ?? undefined,
  kptKeep: r.kpt_keep ?? undefined,
  kptProblem: r.kpt_problem ?? undefined,
  kptTry: r.kpt_try ?? undefined,
  bestVideo: r.best_video ?? undefined,
  bestMusic: r.best_music ?? undefined,
  bestBook: r.best_book ?? undefined,
  bestPlace: r.best_place ?? undefined,
});
const fromMonthlyReview = (r: MonthlyReview): MonthlyReviewRow => ({
  id: r.id, month: r.month, achievement: r.achievement ?? '', next_focus: r.nextFocus ?? '',
  highlight: r.highlight ?? null,
  did_well: r.didWell ?? null,
  regret: r.regret ?? null,
  kpt_keep: r.kptKeep ?? null,
  kpt_problem: r.kptProblem ?? null,
  kpt_try: r.kptTry ?? null,
  best_video: r.bestVideo ?? null,
  best_music: r.bestMusic ?? null,
  best_book: r.bestBook ?? null,
  best_place: r.bestPlace ?? null,
});

// ── 행복 기록 (happy_moments) ─────────────────────────────────────────────────
type HappyMomentRow = {
  id: string; content: string; date: string | null;
  happened_at: string | null; created_at: string;
};

const toHappyMoment = (r: HappyMomentRow): HappyMoment => ({
  id: r.id,
  content: r.content,
  date: r.date ?? '',
  happenedAt: r.happened_at ?? null,
  createdAt: r.created_at,
});

// insert/update 시 카멜→스네이크. createdAt 제외, 부분 업데이트 지원(undefined 제외).
type HappyMomentInput = Partial<Omit<HappyMoment, 'createdAt'>>;
const fromHappyMoment = (h: HappyMomentInput): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (h.id !== undefined)         row.id = h.id;
  if (h.content !== undefined)    row.content = h.content;
  if (h.date !== undefined)       row.date = h.date;
  if (h.happenedAt !== undefined) row.happened_at = h.happenedAt;
  return row;
};

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
  mandalartCellId: r.mandalart_cell_id ?? undefined,
});

const fromWeeklyGoal = (g: WeeklyGoal): WeeklyGoalRow => ({
  id: g.id, text: g.text, done: g.done,
  monthly_goal_id: g.monthlyGoalId ?? null,
  week_key: g.weekKey,
  mandalart_cell_id: g.mandalartCellId ?? null,
});

const toMonthlyGoal = (r: MonthlyGoalRow): MonthlyGoal => ({
  id: r.id, text: r.text, month: r.month,
  projectId: r.project_id ?? undefined,
  annualGoalId: r.annual_goal_id ?? undefined,
  mandalartCellId: r.mandalart_cell_id ?? undefined,
});

const fromMonthlyGoal = (g: MonthlyGoal): MonthlyGoalRow => ({
  id: g.id, text: g.text, month: g.month,
  project_id: g.projectId ?? null,
  annual_goal_id: g.annualGoalId ?? null,
  mandalart_cell_id: g.mandalartCellId ?? null,
});

const toAnnualGoal = (r: AnnualGoalRow): AnnualGoal => ({
  id: r.id, year: r.year, text: r.text, done: r.done,
  mandalartCellId: r.mandalart_cell_id ?? undefined,
});
const fromAnnualGoal = (g: AnnualGoal): AnnualGoalRow => ({
  id: g.id, year: g.year, text: g.text, done: g.done,
  mandalart_cell_id: g.mandalartCellId ?? null,
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

const toTag = (r: TagRow): Tag => ({ id: r.id, name: r.name, color: r.color, trackTime: r.track_time ?? false });
const fromTag = (t: Tag): TagRow => ({ id: t.id, name: t.name, color: t.color, track_time: t.trackTime ?? false });

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

// ── 통합 일기 (diary_entries) ────────────────────────────────────────────────
export type DiaryEntry = {
  id: string;
  entryDate: string;            // yyyy-MM-dd (일기 대상 날짜)
  type: 'free' | 'question';
  title: string | null;         // 자유일기 제목(선택). 질문일기는 미사용(null)
  questionId: string | null;
  questionText: string | null;  // 작성 시점 질문 스냅샷
  content: string;
  createdAt: string;
  updatedAt: string;
};

type DiaryEntryRow = {
  id: string; entry_date: string; type: string;
  title: string | null;
  question_id: string | null; question_text: string | null;
  content: string; created_at: string; updated_at: string;
};

const toDiaryEntry = (r: DiaryEntryRow): DiaryEntry => ({
  id: r.id,
  entryDate: r.entry_date,
  type: r.type as DiaryEntry['type'],
  title: r.title ?? null,
  questionId: r.question_id ?? null,
  questionText: r.question_text ?? null,
  content: r.content,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ── 질문 풀 (journal_questions) ───────────────────────────────────────────────
export type JournalQuestion = {
  id: string;
  userId: string | null;
  category: string;       // 영문 키 (custom = 나만의 질문)
  categoryKo: string;     // 한글 표시명
  text: string;
  isDefault: boolean;     // 기본 질문(true) vs 나만의 질문(false)
  sortOrder: number | null;
  createdAt: string;
};

type JournalQuestionRow = {
  id: string; user_id: string | null; category: string; category_ko: string;
  text: string; is_default: boolean; sort_order: number | null; created_at: string;
};

const toJournalQuestion = (r: JournalQuestionRow): JournalQuestion => ({
  id: r.id,
  userId: r.user_id ?? null,
  category: r.category,
  categoryKo: r.category_ko,
  text: r.text,
  isDefault: r.is_default,
  sortOrder: r.sort_order ?? null,
  createdAt: r.created_at,
});

// ── 운동 모듈 (Stage 0 스키마) — exercises / workout_logs / workout_sets / routine_days / routine_exercises ──
// 데이터 원칙: 운동 데이터는 "DB에 한 번 저장 → 이후엔 읽기만". name_ko 한글화는 seed 또는 '채택' 시점 1회만.
// 런타임 번역 금지: 아래 어떤 메서드도 번역 API 를 호출하지 않는다 — DB 값(name_ko/name_en)만 읽는다.
export type ExerciseType = '근력' | '유산소';
export type ExerciseBodyPart = '하체' | '등' | '가슴' | '어깨' | '팔' | '코어' | '전신' | '유산소' | '기타';

export type Exercise = {
  id: string;
  userId: string | null;        // null = 전체 공용 카탈로그
  nameKo: string | null;        // null = 미채택 카탈로그 항목
  nameEn: string;
  type: ExerciseType;
  bodyPart: ExerciseBodyPart;
  equipment: string | null;
  primaryMuscles: string[];
  youtubeUrl: string | null;
  imageUrl: string | null;
  source: string;               // 'free-exercise-db' | 'custom'
  sourceId: string | null;
};

type ExerciseRow = {
  id: string; user_id: string | null; name_ko: string | null; name_en: string;
  type: string; body_part: string; equipment: string | null;
  primary_muscles: string[] | null; youtube_url: string | null; image_url: string | null;
  source: string | null; source_id: string | null;
};

const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  userId: r.user_id ?? null,
  nameKo: r.name_ko ?? null,
  nameEn: r.name_en,
  type: r.type as ExerciseType,
  bodyPart: r.body_part as ExerciseBodyPart,
  equipment: r.equipment ?? null,
  primaryMuscles: r.primary_muscles ?? [],
  youtubeUrl: r.youtube_url ?? null,
  imageUrl: r.image_url ?? null,
  source: r.source ?? 'custom',
  sourceId: r.source_id ?? null,
});

// 종목 표시명: 한글(name_ko) 우선, 없으면 영어(name_en). 번역하지 않고 저장된 값만 사용.
export const exerciseLabel = (e: Exercise): string => e.nameKo || e.nameEn;

export type WorkoutSet = {
  id?: string;
  logId?: string;
  setNo: number;
  weight: number | null;        // 근력
  reps: number | null;          // 근력
  durationMin: number | null;   // 유산소
  distanceKm: number | null;    // 유산소
};

export type WorkoutLog = {
  id: string;
  exerciseId: string;
  performedOn: string;          // yyyy-MM-dd
  memo: string | null;
  createdAt: string;
  sets: WorkoutSet[];
  exercise?: Exercise | null;   // 조인된 종목
};

export type RoutineExerciseItem = {
  id: string;
  routineDayId: string;
  exerciseId: string;
  sortOrder: number;
  exercise?: Exercise | null;
};

export type RoutineDay = {
  id: string;
  dayOfWeek: number;            // 1=월 … 7=일
  label: string | null;
  exercises: RoutineExerciseItem[];
};

const toWorkoutSet = (r: any): WorkoutSet => ({
  id: r.id, logId: r.log_id, setNo: r.set_no,
  weight: r.weight ?? null, reps: r.reps ?? null,
  durationMin: r.duration_min ?? null, distanceKm: r.distance_km ?? null,
});

const toWorkoutLog = (r: any): WorkoutLog => ({
  id: r.id,
  exerciseId: r.exercise_id,
  performedOn: r.performed_on,
  memo: r.memo ?? null,
  createdAt: r.created_at,
  sets: (r.workout_sets ?? []).map(toWorkoutSet).sort((a: WorkoutSet, b: WorkoutSet) => a.setNo - b.setNo),
  exercise: r.exercises ? toExercise(r.exercises) : null,
});

// ── 가고싶은 곳 (place_folders / places / place_folder_items / place_visits) ──────
// 색상은 디자인 토큰 키 문자열(gold/coral/green 등)만 저장한다 — 하드코딩 hex 금지.
// region_code 는 기억 탭 한국 SVG 지도의 path id 와 1:1 일치하는 시도 코드(예: "incheon").
// user_id 는 DB DEFAULT auth.uid() 가 자동 충전 → 클라이언트는 보내지 않는다.
export type PlaceFolder = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;        // 토큰 키 (예: "coral")
  sortOrder: number;
  createdAt: string;
};

type PlaceFolderRow = {
  id: string; name: string; icon: string | null; color: string | null;
  sort_order: number; created_at: string;
};

const toPlaceFolder = (r: PlaceFolderRow): PlaceFolder => ({
  id: r.id,
  name: r.name,
  icon: r.icon ?? null,
  color: r.color ?? null,
  sortOrder: r.sort_order ?? 0,
  createdAt: r.created_at,
});

export type BlogReview = {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  postdate: string;
};

export type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  regionCode: string | null;   // 시도 코드 (예: "incheon")
  lat: number | null;
  lng: number | null;
  kakaoPlaceId: string | null;
  phone: string | null;        // 카카오 검색 결과 전화번호
  source: string | null;       // "instagram" / "youtube" / "직접 등록" 등
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  memo: string | null;
  concept: string | null;      // cafe/charge/date/friend/culture/food
  energy: number | null;       // 1~3
  rating: number | null;       // 카카오 평점 캐시
  reviewCount: number | null;  // 카카오 리뷰 수 캐시
  hours: string | null;
  blogReviews: BlogReview[];   // 네이버 블로그 후기 캐시 (인리치먼트)
  aiSummary: string | null;    // Haiku 요약 (선택)
  enrichedAt: string | null;   // 인리치먼트 성공 시각 (null = 아직/실패)
  createdAt: string;
  updatedAt: string;
};

type PlaceRow = {
  id: string; name: string; category: string | null; address: string | null;
  region_code: string | null; lat: number | null; lng: number | null;
  kakao_place_id: string | null; phone: string | null; source: string | null; source_url: string | null;
  thumbnail_url: string | null; memo: string | null; concept: string | null;
  energy: number | null; rating: number | null; review_count: number | null;
  hours: string | null; blog_reviews: BlogReview[] | null; ai_summary: string | null; enriched_at: string | null;
  created_at: string; updated_at: string;
};

const toPlace = (r: PlaceRow): Place => ({
  id: r.id,
  name: r.name,
  category: r.category ?? null,
  address: r.address ?? null,
  regionCode: r.region_code ?? null,
  lat: r.lat ?? null,
  lng: r.lng ?? null,
  kakaoPlaceId: r.kakao_place_id ?? null,
  phone: r.phone ?? null,
  source: r.source ?? null,
  sourceUrl: r.source_url ?? null,
  thumbnailUrl: r.thumbnail_url ?? null,
  memo: r.memo ?? null,
  concept: r.concept ?? null,
  energy: r.energy ?? null,
  rating: r.rating ?? null,
  reviewCount: r.review_count ?? null,
  hours: r.hours ?? null,
  blogReviews: r.blog_reviews ?? [],
  aiSummary: r.ai_summary ?? null,
  enrichedAt: r.enriched_at ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// places insert/update 시 카멜→스네이크 변환. undefined 키는 제외(부분 업데이트 지원).
type PlaceInput = Partial<Omit<Place, 'id' | 'createdAt' | 'updatedAt'>>;
const fromPlace = (p: PlaceInput): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined)         row.name = p.name;
  if (p.category !== undefined)     row.category = p.category;
  if (p.address !== undefined)      row.address = p.address;
  if (p.regionCode !== undefined)   row.region_code = p.regionCode;
  if (p.lat !== undefined)          row.lat = p.lat;
  if (p.lng !== undefined)          row.lng = p.lng;
  if (p.kakaoPlaceId !== undefined) row.kakao_place_id = p.kakaoPlaceId;
  if (p.phone !== undefined)        row.phone = p.phone;
  if (p.source !== undefined)       row.source = p.source;
  if (p.sourceUrl !== undefined)    row.source_url = p.sourceUrl;
  if (p.thumbnailUrl !== undefined) row.thumbnail_url = p.thumbnailUrl;
  if (p.memo !== undefined)         row.memo = p.memo;
  if (p.concept !== undefined)      row.concept = p.concept;
  if (p.energy !== undefined)       row.energy = p.energy;
  if (p.rating !== undefined)       row.rating = p.rating;
  if (p.reviewCount !== undefined)  row.review_count = p.reviewCount;
  if (p.hours !== undefined)        row.hours = p.hours;
  return row;
};

export type PlaceVisit = {
  id: string;
  placeId: string | null;      // 저장된 place 연결 또는 null(직접 방문)
  name: string;                // place 없이도 기록되게 비정규화 저장
  regionCode: string;          // 히트맵 집계 키
  visitedOn: string;           // yyyy-MM-dd
  mood: number | null;         // 1~10
  note: string | null;
  diaryEntryId: string | null;
  createdAt: string;
};

type PlaceVisitRow = {
  id: string; place_id: string | null; name: string; region_code: string;
  visited_on: string; mood: number | null; note: string | null;
  diary_entry_id: string | null; created_at: string;
};

const toPlaceVisit = (r: PlaceVisitRow): PlaceVisit => ({
  id: r.id,
  placeId: r.place_id ?? null,
  name: r.name,
  regionCode: r.region_code,
  visitedOn: r.visited_on,
  mood: r.mood ?? null,
  note: r.note ?? null,
  diaryEntryId: r.diary_entry_id ?? null,
  createdAt: r.created_at,
});

// 지역별 방문수 집계 (히트맵용). region_code → 방문 횟수.
export type RegionVisitCount = { regionCode: string; count: number };

// ── 산책 (walk_sessions) ───────────────────────────────────────────────────────
// 걸은 길을 기록하고 완료 시 사진·경로·손글씨 메모로 기록 카드를 남긴다.
// mode: free(자유) / course(코스) / repeat(내 코스 다시).
// path = 실제 걸은 좌표, plannedRoute = 코스/내코스 목표 경로(자유 모드는 null).
// 거리/시간/페이스는 클라이언트(하버사인)에서 계산해 저장한다.
// user_id 는 DB DEFAULT auth.uid() 가 자동 충전 → 클라이언트는 보내지 않는다.
export type WalkMode = 'free' | 'course' | 'repeat';
export type WalkPoint = { lat: number; lng: number; t: number }; // t = 경과 시간(ms) 또는 epoch

export type WalkSession = {
  id: string;
  mode: WalkMode;
  startedAt: string | null;
  endedAt: string | null;
  distanceM: number;             // 총 이동 거리(미터)
  durationS: number;             // 총 소요 시간(초)
  avgPaceSPerKm: number | null;  // 평균 페이스(초/km)
  path: WalkPoint[];             // 실제 걸은 좌표
  plannedRoute: WalkPoint[] | null; // 코스/내코스 목표 경로
  startLat: number | null;
  startLng: number | null;
  regionCode: string | null;     // 시작점 시도 코드(기억/지도 연동 여지)
  photoUrl: string | null;       // 완료 카드 사진(walk-photos 버킷)
  memo: string | null;           // 손글씨 메모
  routeName: string | null;      // "내 코스 다시" 저장용 코스 이름
  isSavedRoute: boolean;         // 재사용 가능한 내 코스 여부
  createdAt: string;
};

type WalkSessionRow = {
  id: string; mode: WalkMode; started_at: string | null; ended_at: string | null;
  distance_m: number; duration_s: number; avg_pace_s_per_km: number | null;
  path: WalkPoint[] | null; planned_route: WalkPoint[] | null;
  start_lat: number | null; start_lng: number | null; region_code: string | null;
  photo_url: string | null; memo: string | null; route_name: string | null;
  is_saved_route: boolean; created_at: string;
};

const toWalkSession = (r: WalkSessionRow): WalkSession => ({
  id: r.id,
  mode: r.mode,
  startedAt: r.started_at ?? null,
  endedAt: r.ended_at ?? null,
  distanceM: r.distance_m ?? 0,
  durationS: r.duration_s ?? 0,
  avgPaceSPerKm: r.avg_pace_s_per_km ?? null,
  path: r.path ?? [],
  plannedRoute: r.planned_route ?? null,
  startLat: r.start_lat ?? null,
  startLng: r.start_lng ?? null,
  regionCode: r.region_code ?? null,
  photoUrl: r.photo_url ?? null,
  memo: r.memo ?? null,
  routeName: r.route_name ?? null,
  isSavedRoute: r.is_saved_route ?? false,
  createdAt: r.created_at,
});

// walk_sessions insert/update 시 카멜→스네이크 변환. undefined 키는 제외(부분 업데이트 지원).
type WalkSessionInput = Partial<Omit<WalkSession, 'id' | 'createdAt'>>;
const fromWalkSession = (w: WalkSessionInput): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (w.mode !== undefined)          row.mode = w.mode;
  if (w.startedAt !== undefined)     row.started_at = w.startedAt;
  if (w.endedAt !== undefined)       row.ended_at = w.endedAt;
  if (w.distanceM !== undefined)     row.distance_m = w.distanceM;
  if (w.durationS !== undefined)     row.duration_s = w.durationS;
  if (w.avgPaceSPerKm !== undefined) row.avg_pace_s_per_km = w.avgPaceSPerKm;
  if (w.path !== undefined)          row.path = w.path;
  if (w.plannedRoute !== undefined)  row.planned_route = w.plannedRoute;
  if (w.startLat !== undefined)      row.start_lat = w.startLat;
  if (w.startLng !== undefined)      row.start_lng = w.startLng;
  if (w.regionCode !== undefined)    row.region_code = w.regionCode;
  if (w.photoUrl !== undefined)      row.photo_url = w.photoUrl;
  if (w.memo !== undefined)          row.memo = w.memo;
  if (w.routeName !== undefined)     row.route_name = w.routeName;
  if (w.isSavedRoute !== undefined)  row.is_saved_route = w.isSavedRoute;
  return row;
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
    deleteMany: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('todos').delete().in('id', ids);
      if (error) console.error('[db] todos deleteMany:', error.message);
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
    // 일간 칩 집약 — 그날 수면(category=sleep) 요약. 같은 날 여럿이면 최근 1건. 없으면 null.
    summaryForDate: async (date: string): Promise<{ durationMin: number; sleepStart: string | null; sleepEnd: string | null } | null> => {
      const { data, error } = await supabase
        .from('self_care_records').select('duration, sleep_start, sleep_end')
        .eq('date', date).eq('category', 'sleep').order('created_at', { ascending: false });
      if (error) { console.error('[db] self_care_records summaryForDate:', error.message); return null; }
      if (!data || data.length === 0) return null;
      const r = data[0];
      return { durationMin: r.duration ?? 0, sleepStart: r.sleep_start ?? null, sleepEnd: r.sleep_end ?? null };
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

  happyMoments: {
    fetchAll: async (): Promise<HappyMoment[]> => {
      const { data, error } = await supabase
        .from('happy_moments').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
      if (error) console.error('[db] happy_moments fetch:', error.message);
      return (data ?? []).map(toHappyMoment);
    },
    upsert: async (moment: HappyMoment) => {
      const { error } = await supabase.from('happy_moments').upsert(fromHappyMoment(moment));
      if (error) console.error('[db] happy_moments upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('happy_moments').delete().eq('id', id);
      if (error) console.error('[db] happy_moments delete:', error.message);
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
    // 일간 칩 집약 — 그날 식사 요약(끼니 수·첫 음식·끼니 종류). 없으면 null.
    summaryForDate: async (date: string): Promise<{ count: number; firstName: string | null; mealTypes: string[] } | null> => {
      const { data, error } = await supabase
        .from('food_records').select('food_name, meal_type')
        .eq('date', date).order('created_at', { ascending: true });
      if (error) { console.error('[db] food_records summaryForDate:', error.message); return null; }
      if (!data || data.length === 0) return null;
      return {
        count: data.length,
        firstName: data[0].food_name ?? null,
        mealTypes: [...new Set(data.map((r: any) => r.meal_type).filter(Boolean))] as string[],
      };
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

  todoTimeBlocks: {
    fetchAll: async (): Promise<TodoTimeBlock[]> => {
      const { data, error } = await supabase
        .from('todo_time_blocks').select('*').order('date').order('start_time');
      if (error) console.error('[db] todo_time_blocks fetch:', error.message);
      return (data ?? []).map(toTimeBlock);
    },
    insert: async (block: TodoTimeBlock) => {
      const { error } = await supabase.from('todo_time_blocks').insert(fromTimeBlock(block));
      if (error) console.error('[db] todo_time_blocks insert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('todo_time_blocks').delete().eq('id', id);
      if (error) console.error('[db] todo_time_blocks delete:', error.message);
    },
    deleteByTodo: async (todoId: string) => {
      const { error } = await supabase.from('todo_time_blocks').delete().eq('todo_id', todoId);
      if (error) console.error('[db] todo_time_blocks deleteByTodo:', error.message);
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
          sleepGoalMinutes: data.sleep_goal_minutes ?? undefined,
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
        payload.sleep_goal_minutes = appSettings.sleepGoalMinutes ?? null;
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
    updateContent: async (id: string, content: string) => {
      const { error } = await supabase.from('moments').update({ content }).eq('id', id);
      if (error) console.error('[db] moments updateContent:', error.message);
      return !error;
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
    // 일간 칩 집약 — 그날(논리 날짜) 컨디션 요약. 데이터 없으면 null.
    summaryForDate: async (date: string): Promise<{ stress: number | null; symptomCount: number } | null> => {
      const { data, error } = await supabase
        .from('condition_records').select('stress, symptoms').eq('date', date).maybeSingle();
      if (error) { console.error('[db] condition_records summaryForDate:', error.message); return null; }
      if (!data) return null;
      return { stress: data.stress ?? null, symptomCount: (data.symptoms ?? []).length };
    },
  },

  // 사용자 커스텀 증상 — 한 번 저장하면 이후 칩 풀에서 계속 재사용
  userSymptoms: {
    fetchAll: async (): Promise<UserSymptom[]> => {
      const { data, error } = await supabase
        .from('user_symptoms').select('id,name').order('created_at', { ascending: true });
      if (error) console.error('[db] user_symptoms fetch:', error.message);
      return (data ?? []).map((r: any): UserSymptom => ({ id: r.id, name: r.name }));
    },
    // 정규화 기준 중복이면 새로 만들지 않고 기존 행을 반환
    add: async (name: string): Promise<
      | { ok: true; created: UserSymptom }
      | { ok: false; reason: 'duplicate'; existing: UserSymptom }
      | { ok: false; reason: 'error' }
    > => {
      const trimmed = name.trim().replace(/\s+/g, ' ');
      const norm = trimmed.toLowerCase();
      if (!trimmed) return { ok: false, reason: 'error' };
      const { data: existing } = await supabase
        .from('user_symptoms').select('id,name').eq('name_norm', norm).maybeSingle();
      if (existing) return { ok: false, reason: 'duplicate', existing: { id: existing.id, name: existing.name } };
      const row = { id: crypto.randomUUID(), name: trimmed, name_norm: norm };
      const { error } = await supabase.from('user_symptoms').insert(row);
      if (error) {
        // UNIQUE 제약 동시성 충돌 — 다른 클라이언트가 먼저 insert
        const { data: race } = await supabase
          .from('user_symptoms').select('id,name').eq('name_norm', norm).maybeSingle();
        if (race) return { ok: false, reason: 'duplicate', existing: { id: race.id, name: race.name } };
        console.error('[db] user_symptoms add:', error.message);
        return { ok: false, reason: 'error' };
      }
      return { ok: true, created: { id: row.id, name: row.name } };
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
    // 일간 칩 집약 — 그날(시청일=watched_date) 미디어 요약. 없으면 null.
    summaryForDate: async (date: string): Promise<{ count: number; firstTitle: string | null; firstRating: number | null; firstType: string | null } | null> => {
      const { data, error } = await supabase
        .from('culture_records').select('title, rating, content_type')
        .eq('watched_date', date).order('created_at', { ascending: true });
      if (error) { console.error('[db] culture_records summaryForDate:', error.message); return null; }
      if (!data || data.length === 0) return null;
      return {
        count: data.length,
        firstTitle: data[0].title ?? null,
        firstRating: data[0].rating != null ? Number(data[0].rating) : null,
        firstType: data[0].content_type ?? null,
      };
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
    // LP 위 스티커 꾸미기 결과 저장 (stickers jsonb) — [{emoji,x,y}, ...]
    updateStickers: async (id: string, stickers: { emoji: string; x: number; y: number }[]) => {
      const { error } = await supabase.from('music_records').update({ stickers }).eq('id', id);
      if (error) console.error('[db] music_records stickers update:', error.message);
    },
    // 일간 칩 집약 — 그날(listened_date) 들은 음악 요약. 없으면 null.
    summaryForDate: async (date: string): Promise<{ count: number; firstTitle: string | null; firstArtist: string | null } | null> => {
      const { data, error } = await supabase
        .from('music_records').select('track_title, artist')
        .eq('listened_date', date).order('created_at', { ascending: true });
      if (error) { console.error('[db] music_records summaryForDate:', error.message); return null; }
      if (!data || data.length === 0) return null;
      return { count: data.length, firstTitle: data[0].track_title ?? null, firstArtist: data[0].artist ?? null };
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('music_records').delete().eq('id', id);
      if (error) console.error('[db] music_records delete:', error.message);
    },
  },

  // ── 독서 이력(reading_logs) — 일간 칩 집약용 그날 조회 (Stage 2.5) ──
  // 작성 경로는 BooksView 가 담당. 여기선 조회/요약만 제공.
  readingLogs: {
    fetchByDate: async (date: string): Promise<
      { id: string; bookId: string; page: number; durationMinutes: number | null; note: string | null; bookTitle: string | null }[]
    > => {
      const { data, error } = await supabase
        .from('reading_logs').select('id, book_id, page, duration_minutes, note, books(title)')
        .eq('date', date).order('created_at', { ascending: true });
      if (error) { console.error('[db] reading_logs fetchByDate:', error.message); return []; }
      return (data ?? []).map((r: any) => ({
        id: r.id, bookId: r.book_id, page: r.page,
        durationMinutes: r.duration_minutes ?? null, note: r.note ?? null,
        bookTitle: r.books?.title ?? null,
      }));
    },
    summaryForDate: async (date: string): Promise<{ count: number; lastBookTitle: string | null; lastPage: number | null; totalMinutes: number | null } | null> => {
      const logs = await db.readingLogs.fetchByDate(date);
      if (!logs.length) return null;
      const last = logs[logs.length - 1];
      const mins = logs.reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
      return { count: logs.length, lastBookTitle: last.bookTitle, lastPage: last.page ?? null, totalMinutes: mins > 0 ? mins : null };
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

    // 내가 만든 사진 업로드 → publicUrl 반환 (food/moment/beauty 와 동일한 "평면 경로 + contentType" 패턴)
    //  ⚠️ 경로에 슬래시(하위폴더)를 쓰면 클라이언트 업로드가 400 으로 실패 → 평면 경로(언더스코어) 사용.
    uploadPhoto: async (recipeId: string, file: File): Promise<string | null> => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${recipeId}_${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: true, contentType: file.type });
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

    // 기존 recipe-photos 버킷 재사용 — 평면 경로(언더스코어). 슬래시 경로는 클라이언트 업로드 400 유발.
    uploadPhoto: async (recipeId: string, file: File): Promise<string | null> => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${recipeId}_cooklog_${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) { console.error('[db] recipe-photos cooklog upload:', error.message); return null; }
      const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path);
      return data.publicUrl ?? null;
    },

    delete: async (id: string) => {
      const { error } = await supabase.from('recipe_cook_logs').delete().eq('id', id);
      if (error) console.error('[db] recipe_cook_logs delete:', error.message);
    },
  },

  // ── 독서 구절 사진 — book_quotes 의 image_url 용 (사진 캡처 OCR) ──
  //  · 구절 insert/update 는 BooksView 가 직접 supabase.from('book_quotes') 로 처리한다.
  //    여기서는 크롭 사진을 book-photos 버킷에 올리는 업로드 헬퍼만 제공.
  bookQuotes: {
    // 크롭된 구절 사진 업로드 → publicUrl. recipe/beauty uploadPhoto 와 동일한 "평면 경로 + contentType" 패턴.
    //  ⚠️ 경로에 슬래시(하위폴더)를 쓰면 클라이언트 업로드가 400 으로 실패 → 평면 경로(언더스코어) 사용.
    uploadPhoto: async (quoteId: string, file: File): Promise<string | null> => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${quoteId}_${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('book-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) { console.error('[db] book-photos upload:', error.message); return null; }
      const { data } = supabase.storage.from('book-photos').getPublicUrl(path);
      return data.publicUrl ?? null;
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

  // ── 스크랩 / 영감 보관함 — scraps / scrap_notes / Storage(scrap-thumbs) ────
  // 단일 사용자 컨벤션: user_id 는 DB DEFAULT auth.uid() 로 자동 충전 → 클라이언트 미전송.
  // 모든 컴포넌트는 이 레이어를 거쳐서만 supabase 에 접근(Stage 1 규칙).
  scraps: {
    // 최신순(created_at desc) 전체 조회 — RLS 가 본인 행만 통과시키므로 클라이언트 필터 불필요.
    listByUser: async (): Promise<Scrap[]> => {
      const { data, error } = await supabase
        .from('scraps')
        .select('id, url, source, title, thumbnail_url, comment, tags, status, last_viewed_at, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) { console.error('[db] scraps fetch:', error.message); return []; }
      return (data ?? []).map(toScrap);
    },
    create: async (params: {
      url: string | null;
      source: ScrapSource | null;
      title: string | null;
      thumbnailUrl: string | null;
      comment: string | null;
      tags: string[];
    }): Promise<Scrap | null> => {
      const { data, error } = await supabase
        .from('scraps')
        .insert({
          url: params.url,
          source: params.source,
          title: params.title,
          thumbnail_url: params.thumbnailUrl,
          comment: params.comment,
          tags: params.tags,
          // status 는 DB DEFAULT 'unread' — 굳이 보내지 않아도 됨
        })
        .select('id, url, source, title, thumbnail_url, comment, tags, status, last_viewed_at, created_at, updated_at')
        .single();
      if (error) { console.error('[db] scraps create:', error.message); return null; }
      return data ? toScrap(data) : null;
    },
    update: async (id: string, patch: {
      url?: string | null;
      source?: ScrapSource | null;
      title?: string | null;
      thumbnailUrl?: string | null;
      comment?: string | null;
      tags?: string[];
      status?: ScrapStatus;
      lastViewedAt?: string | null;
    }): Promise<void> => {
      const row: Record<string, unknown> = {};
      if ('url' in patch) row.url = patch.url ?? null;
      if ('source' in patch) row.source = patch.source ?? null;
      if ('title' in patch) row.title = patch.title ?? null;
      if ('thumbnailUrl' in patch) row.thumbnail_url = patch.thumbnailUrl ?? null;
      if ('comment' in patch) row.comment = patch.comment ?? null;
      if ('tags' in patch) row.tags = patch.tags ?? [];
      if ('status' in patch) row.status = patch.status;
      if ('lastViewedAt' in patch) row.last_viewed_at = patch.lastViewedAt ?? null;
      // updated_at 은 트리거가 없으므로 명시적으로 갱신 (간단 정책 — 한 컬럼 추가 비용 무시 가능)
      row.updated_at = new Date().toISOString();
      const { error } = await supabase.from('scraps').update(row).eq('id', id);
      if (error) console.error('[db] scraps update:', error.message);
    },
    delete: async (id: string): Promise<void> => {
      // scrap_notes 는 ON DELETE CASCADE 로 함께 삭제됨
      const { error } = await supabase.from('scraps').delete().eq('id', id);
      if (error) console.error('[db] scraps delete:', error.message);
    },
    // 상태 전환 전용 편의 메서드 — 세그먼트 컨트롤(미확인/다시봄/소화완료) 에서 호출.
    updateStatus: async (id: string, status: ScrapStatus): Promise<void> => {
      const { error } = await supabase
        .from('scraps')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) console.error('[db] scraps updateStatus:', error.message);
    },
    // 상세 시트 오픈 시 호출 — last_viewed_at 만 now() 로 갱신(Stage 3 먼지 로직 기반).
    touchViewed: async (id: string): Promise<void> => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('scraps')
        .update({ last_viewed_at: now, updated_at: now })
        .eq('id', id);
      if (error) console.error('[db] scraps touchViewed:', error.message);
    },
    // ── Stage 3: 먼지 쌓인 스크랩 후보 ──
    // 조건: status != 'done' AND COALESCE(last_viewed_at, created_at) < (now - minDaysSinceView 일).
    // 즉 최근에 본 건/소화 완료 건은 제외 → 오래 안 본 후보만 반환.
    listDusty: async (minDaysSinceView = 14, limit = 20): Promise<Scrap[]> => {
      const thresholdIso = new Date(Date.now() - minDaysSinceView * 86400000).toISOString();
      // PostgREST .or(): "한 번도 안 본(last_viewed_at null) + created_at 오래된 것" OR "last_viewed_at 오래된 것"
      const { data, error } = await supabase
        .from('scraps')
        .select('id, url, source, title, thumbnail_url, comment, tags, status, last_viewed_at, created_at, updated_at')
        .neq('status', 'done')
        .or(`and(last_viewed_at.is.null,created_at.lt.${thresholdIso}),last_viewed_at.lt.${thresholdIso}`)
        .limit(limit);
      if (error) { console.error('[db] scraps listDusty:', error.message); return []; }
      // COALESCE(last_viewed_at, created_at) ASC 정렬 — 가장 오래 안 본 게 앞.
      const sorted = (data ?? []).slice().sort((a, b) => {
        const aKey = a.last_viewed_at ?? a.created_at;
        const bKey = b.last_viewed_at ?? b.created_at;
        return aKey.localeCompare(bKey);
      });
      return sorted.map(toScrap);
    },
    // ── Stage 3: 검색 — 제목·코멘트 ilike + 태그 정확 매칭(text[] contains) ──
    // 빈 문자열은 호출 측에서 가드(검색창 비우면 전체 보이게).
    search: async (q: string): Promise<Scrap[]> => {
      const term = q.trim();
      if (!term) return [];
      // PostgREST .or() 의 콤마/괄호/중괄호와 ilike 패턴 와일드카드 충돌 방지용 sanitize.
      const safe = term.replace(/[%_(),{}]/g, '');
      if (!safe) return [];
      const { data, error } = await supabase
        .from('scraps')
        .select('id, url, source, title, thumbnail_url, comment, tags, status, last_viewed_at, created_at, updated_at')
        .or(`title.ilike.%${safe}%,comment.ilike.%${safe}%,tags.cs.{${safe}}`)
        .order('created_at', { ascending: false });
      if (error) { console.error('[db] scraps search:', error.message); return []; }
      return (data ?? []).map(toScrap);
    },
    // 수동 스크린샷 업로드(인스타·스레드용). 파일명은 itemKey 기반 — 동일 키 재업로드 시 덮어씀.
    uploadThumb: async (file: File, itemKey: string): Promise<string | null> => {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${itemKey}.${ext}`;
      const { error } = await supabase.storage
        .from('scrap-thumbs')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) { console.error('[db] scrap-thumbs upload:', error.message); return null; }
      const { data } = supabase.storage.from('scrap-thumbs').getPublicUrl(path);
      return data.publicUrl;
    },
    // ── fetch-link-metadata Edge Function 호출 (URL → 메타 자동 채움) ──
    fetchLinkMetadata: async (url: string): Promise<{
      source: ScrapSource;
      title: string | null;
      thumbnail_url: string | null;
      description: string | null;
      needsManual: boolean;
    } | null> => {
      const { data, error } = await supabase.functions.invoke('fetch-link-metadata', {
        body: { url },
      });
      if (error) { console.error('[db] fetch-link-metadata invoke:', error.message); return null; }
      return data ?? null;
    },
  },

  // scrap_notes — 스크랩에 쌓이는 짧은 글 기록 (1:N). RLS 로 본인 행만 통과.
  scrapNotes: {
    // 특정 스크랩의 노트들을 created_at asc(시간순) 로 반환 — 상세 시트 타임라인용.
    listByScrap: async (scrapId: string): Promise<ScrapNote[]> => {
      const { data, error } = await supabase
        .from('scrap_notes')
        .select('id, scrap_id, content, created_at')
        .eq('scrap_id', scrapId)
        .order('created_at', { ascending: true });
      if (error) { console.error('[db] scrap_notes fetch:', error.message); return []; }
      return (data ?? []).map(toScrapNote);
    },
    // 노트 추가 — user_id 는 DB DEFAULT auth.uid() 가 자동 충전.
    create: async (params: { scrapId: string; content: string }): Promise<ScrapNote | null> => {
      const { data, error } = await supabase
        .from('scrap_notes')
        .insert({ scrap_id: params.scrapId, content: params.content })
        .select('id, scrap_id, content, created_at')
        .single();
      if (error) { console.error('[db] scrap_notes create:', error.message); return null; }
      return data ? toScrapNote(data) : null;
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('scrap_notes').delete().eq('id', id);
      if (error) console.error('[db] scrap_notes delete:', error.message);
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

  // ── 통합 일기 (자유일기/질문일기) ─────────────────────────────────────────────
  diaryEntries: {
    // 특정 날짜의 자유일기 1건 (type='free'). 하루 1개 부분 유니크라 maybeSingle.
    fetchFreeByDate: async (entryDate: string): Promise<DiaryEntry | null> => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('type', 'free')
        .eq('entry_date', entryDate)
        .maybeSingle();
      if (error) console.error('[db] diary_entries fetchFreeByDate:', error.message);
      return data ? toDiaryEntry(data) : null;
    },
    // 최근 자유일기 N건 (entry_date 내림차순)
    listRecentFree: async (limit = 7): Promise<DiaryEntry[]> => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('type', 'free')
        .order('entry_date', { ascending: false })
        .limit(limit);
      if (error) console.error('[db] diary_entries listRecentFree:', error.message);
      return (data ?? []).map(toDiaryEntry);
    },
    // 특정 기간(포함)에 자유일기가 있는 날짜 목록 — 모바일 주간 스트립 '작성한 날' 점 표시용
    listFreeDatesBetween: async (startDate: string, endDate: string): Promise<string[]> => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('entry_date')
        .eq('type', 'free')
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);
      if (error) console.error('[db] diary_entries listFreeDatesBetween:', error.message);
      return (data ?? []).map((r: { entry_date: string }) => r.entry_date);
    },
    // 자유일기 저장 — (entry_date, type='free') 기준 upsert.
    // 부분 유니크 인덱스라 onConflict upsert 대신 select 후 update/insert.
    // user_id 는 DB DEFAULT auth.uid() 가 자동 충전. title 은 선택(없으면 null).
    upsertFree: async (entryDate: string, content: string, title?: string | null): Promise<DiaryEntry | null> => {
      const titleVal = title?.trim() ? title.trim() : null;
      const { data: existing, error: selErr } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('type', 'free')
        .eq('entry_date', entryDate)
        .maybeSingle();
      if (selErr) { console.error('[db] diary_entries upsertFree select:', selErr.message); return null; }
      if (existing?.id) {
        const { data, error } = await supabase
          .from('diary_entries')
          .update({ content, title: titleVal, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) { console.error('[db] diary_entries update:', error.message); return null; }
        return data ? toDiaryEntry(data) : null;
      }
      const { data, error } = await supabase
        .from('diary_entries')
        .insert({ entry_date: entryDate, type: 'free', content, title: titleVal })
        .select('*')
        .single();
      if (error) { console.error('[db] diary_entries insert:', error.message); return null; }
      return data ? toDiaryEntry(data) : null;
    },
    // 특정 날짜의 질문일기 1건 (type='question'). 하루 1건 정책 → maybeSingle.
    fetchQuestionByDate: async (entryDate: string): Promise<DiaryEntry | null> => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('type', 'question')
        .eq('entry_date', entryDate)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error('[db] diary_entries fetchQuestionByDate:', error.message);
      return data ? toDiaryEntry(data) : null;
    },
    // 최근 질문일기 N건 (entry_date 내림차순)
    listRecentQuestion: async (limit = 7): Promise<DiaryEntry[]> => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('type', 'question')
        .order('entry_date', { ascending: false })
        .limit(limit);
      if (error) console.error('[db] diary_entries listRecentQuestion:', error.message);
      return (data ?? []).map(toDiaryEntry);
    },
    // 질문일기 저장 — (entry_date, type='question') 기준 앱 레벨 upsert(하루 1건).
    // question_id + question_text(작성 시점 스냅샷) 함께 기록 → 질문 수정/삭제돼도 보존.
    upsertQuestion: async (
      entryDate: string,
      questionId: string | null,
      questionText: string,
      content: string,
    ): Promise<DiaryEntry | null> => {
      const { data: existing, error: selErr } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('type', 'question')
        .eq('entry_date', entryDate)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selErr) { console.error('[db] diary_entries upsertQuestion select:', selErr.message); return null; }
      if (existing?.id) {
        const { data, error } = await supabase
          .from('diary_entries')
          .update({ question_id: questionId, question_text: questionText, content, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) { console.error('[db] diary_entries question update:', error.message); return null; }
        return data ? toDiaryEntry(data) : null;
      }
      const { data, error } = await supabase
        .from('diary_entries')
        .insert({ entry_date: entryDate, type: 'question', question_id: questionId, question_text: questionText, content })
        .select('*')
        .single();
      if (error) { console.error('[db] diary_entries question insert:', error.message); return null; }
      return data ? toDiaryEntry(data) : null;
    },
    // "이날의 기억" — 기준 월/일과 같고 연도가 [fromYear, toYear] 범위인 기록 전부(type 무관).
    // RPC diary_on_this_day → diary_entries_user_monthday_idx 사용. entry_date 내림차순.
    listOnThisDay: async (month: number, day: number, fromYear: number, toYear: number): Promise<DiaryEntry[]> => {
      const { data, error } = await supabase.rpc('diary_on_this_day', {
        p_month: month, p_day: day, p_from_year: fromYear, p_to_year: toYear,
      });
      if (error) console.error('[db] diary_entries listOnThisDay:', error.message);
      return ((data ?? []) as DiaryEntryRow[]).map(toDiaryEntry);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('diary_entries').delete().eq('id', id);
      if (error) console.error('[db] diary_entries delete:', error.message);
    },
  },

  // ── 질문 풀 (journal_questions) — 기본 질문 + 나만의 질문 ──────────────────────
  journalQuestions: {
    // 전체 질문(기본 + 나만의). 카테고리/정렬 순.
    fetchAll: async (): Promise<JournalQuestion[]> => {
      const { data, error } = await supabase
        .from('journal_questions')
        .select('*')
        .order('is_default', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) console.error('[db] journal_questions fetch:', error.message);
      return (data ?? []).map(toJournalQuestion);
    },
    // 나만의 질문 추가 — is_default=false, category='custom'. user_id 는 DEFAULT auth.uid().
    createCustom: async (text: string): Promise<JournalQuestion | null> => {
      const { data, error } = await supabase
        .from('journal_questions')
        .insert({ text, category: 'custom', category_ko: '나만의 질문', is_default: false })
        .select('*')
        .single();
      if (error) { console.error('[db] journal_questions createCustom:', error.message); return null; }
      return data ? toJournalQuestion(data) : null;
    },
    // 나만의 질문 삭제 — 기본 질문(user_id=null)은 RLS 로 차단되어 삭제 불가.
    delete: async (id: string) => {
      const { error } = await supabase.from('journal_questions').delete().eq('id', id);
      if (error) console.error('[db] journal_questions delete:', error.message);
    },
  },

  // ── 마인드맵 (Phase 5-0) ─────────────────────────────────────────────────
  // 컴포넌트에서 supabase 직접 호출 금지 — 이 레이어로만 접근.
  mindmap: {
    // 루트(parent_id null) 없으면 생성 후 반환. text 는 스크랩 제목으로 채움.
    ensureRoot: async (scrapId: string): Promise<MindmapNode | null> => {
      const { data: existing, error: selErr } = await supabase
        .from('mindmap_nodes')
        .select('id, scrap_id, parent_id, text, dir, sort_order, created_at')
        .eq('scrap_id', scrapId)
        .is('parent_id', null)
        .maybeSingle();
      if (selErr) { console.error('[db] mindmap ensureRoot select:', selErr.message); return null; }
      if (existing) return toMindmapNode(existing);

      // 스크랩 제목 조회 → 루트 라벨
      const { data: scrapRow } = await supabase
        .from('scraps')
        .select('title')
        .eq('id', scrapId)
        .maybeSingle();
      const rootText = (scrapRow?.title ?? '').trim() || '마인드맵';

      const { data, error } = await supabase
        .from('mindmap_nodes')
        .insert({ scrap_id: scrapId, parent_id: null, text: rootText, dir: null, sort_order: 0 })
        .select('id, scrap_id, parent_id, text, dir, sort_order, created_at')
        .single();
      if (error) { console.error('[db] mindmap ensureRoot insert:', error.message); return null; }
      return data ? toMindmapNode(data) : null;
    },

    // 전체 fetch → parent_id 로 트리 조립. 루트(parent_id null)를 반환, 없으면 null.
    listTree: async (scrapId: string): Promise<MindmapTreeNode | null> => {
      const { data, error } = await supabase
        .from('mindmap_nodes')
        .select('id, scrap_id, parent_id, text, dir, sort_order, created_at')
        .eq('scrap_id', scrapId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) { console.error('[db] mindmap listTree:', error.message); return null; }

      const flat = (data ?? []).map(toMindmapNode);
      if (flat.length === 0) return null;

      const byId = new Map<string, MindmapTreeNode>();
      flat.forEach(n => byId.set(n.id, { ...n, children: [] }));
      let root: MindmapTreeNode | null = null;
      for (const n of flat) {
        const node = byId.get(n.id)!;
        if (n.parentId === null) {
          root = node;
        } else {
          const parent = byId.get(n.parentId);
          if (parent) parent.children.push(node);
          else root = root ?? node; // 부모 유실 시 안전망
        }
      }
      return root;
    },

    // 노드 생성. parent 가 루트면 dir 을 지정(루트 직속 가지), 그 외엔 dir null(부모 상속).
    createNode: async (parentId: string, text: string, dir?: MindmapDir): Promise<MindmapNode | null> => {
      // 부모로부터 scrap_id 와 다음 sort_order 산출
      const { data: parent, error: pErr } = await supabase
        .from('mindmap_nodes')
        .select('scrap_id')
        .eq('id', parentId)
        .maybeSingle();
      if (pErr || !parent) { console.error('[db] mindmap createNode parent:', pErr?.message); return null; }

      const { data: siblings } = await supabase
        .from('mindmap_nodes')
        .select('sort_order')
        .eq('parent_id', parentId)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('mindmap_nodes')
        .insert({
          scrap_id: parent.scrap_id,
          parent_id: parentId,
          text,
          dir: dir ?? null,
          sort_order: nextOrder,
        })
        .select('id, scrap_id, parent_id, text, dir, sort_order, created_at')
        .single();
      if (error) { console.error('[db] mindmap createNode insert:', error.message); return null; }
      return data ? toMindmapNode(data) : null;
    },

    updateNode: async (id: string, patch: { text?: string; dir?: MindmapDir | null }): Promise<void> => {
      const row: Record<string, unknown> = {};
      if ('text' in patch) row.text = patch.text ?? '';
      if ('dir' in patch) row.dir = patch.dir ?? null;
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from('mindmap_nodes').update(row).eq('id', id);
      if (error) console.error('[db] mindmap updateNode:', error.message);
    },

    // 자식은 ON DELETE CASCADE 로 함께 삭제됨.
    deleteNode: async (id: string): Promise<void> => {
      const { error } = await supabase.from('mindmap_nodes').delete().eq('id', id);
      if (error) console.error('[db] mindmap deleteNode:', error.message);
    },

    // 노드↔스크랩 연결 동기화 — 현재 연결과 비교해 추가/삭제분만 반영.
    setNodeScraps: async (nodeId: string, scrapIds: string[]): Promise<void> => {
      const { data: current, error: curErr } = await supabase
        .from('mindmap_node_scraps')
        .select('scrap_id')
        .eq('node_id', nodeId);
      if (curErr) { console.error('[db] mindmap setNodeScraps select:', curErr.message); return; }

      const currentSet = new Set((current ?? []).map(r => r.scrap_id));
      const nextSet = new Set(scrapIds);

      const toAdd = scrapIds.filter(id => !currentSet.has(id));
      const toRemove = [...currentSet].filter(id => !nextSet.has(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('mindmap_node_scraps')
          .insert(toAdd.map(scrapId => ({ node_id: nodeId, scrap_id: scrapId })));
        if (error) console.error('[db] mindmap setNodeScraps insert:', error.message);
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('mindmap_node_scraps')
          .delete()
          .eq('node_id', nodeId)
          .in('scrap_id', toRemove);
        if (error) console.error('[db] mindmap setNodeScraps delete:', error.message);
      }
    },

    listNodeScraps: async (nodeId: string): Promise<string[]> => {
      const { data, error } = await supabase
        .from('mindmap_node_scraps')
        .select('scrap_id')
        .eq('node_id', nodeId);
      if (error) { console.error('[db] mindmap listNodeScraps:', error.message); return []; }
      return (data ?? []).map(r => r.scrap_id);
    },

    // 한 마인드맵(scrap_id)에 속한 모든 노드의 연결을 한 번에 조회 — 칩 렌더용 벌크.
    // 반환: { nodeId, scrapId }[] (노드별로 묶는 건 호출 측에서).
    listLinks: async (scrapId: string): Promise<{ nodeId: string; scrapId: string }[]> => {
      const { data: nodes, error: nErr } = await supabase
        .from('mindmap_nodes')
        .select('id')
        .eq('scrap_id', scrapId);
      if (nErr) { console.error('[db] mindmap listLinks nodes:', nErr.message); return []; }
      const nodeIds = (nodes ?? []).map(n => n.id);
      if (nodeIds.length === 0) return [];

      const { data, error } = await supabase
        .from('mindmap_node_scraps')
        .select('node_id, scrap_id')
        .in('node_id', nodeIds);
      if (error) { console.error('[db] mindmap listLinks:', error.message); return []; }
      return (data ?? []).map(r => ({ nodeId: r.node_id, scrapId: r.scrap_id }));
    },
  },

  // ── 운동 모듈 — exercises / workout_logs / workout_sets / routine_days / routine_exercises ──
  // 런타임 번역 금지: 종목 이름은 DB 의 name_ko/name_en 만 읽어 표시한다. 페이지 진입 시 번역 호출 없음.
  workouts: {
    // "내 운동": name_ko 가 있거나, 내가 소유했거나(user_id), 내 logs/routines 에 등장한 종목.
    // 같은 source_id(없으면 영어명) 기준 dedupe — 채택 복사본이 카탈로그 원본을 덮는다.
    listMine: async (): Promise<Exercise[]> => {
      const [exRes, logRes, rtRes] = await Promise.all([
        supabase.from('exercises').select('*'),
        supabase.from('workout_logs').select('exercise_id'),
        supabase.from('routine_exercises').select('exercise_id'),
      ]);
      if (exRes.error) console.error('[db] exercises listMine:', exRes.error.message);
      const usedIds = new Set<string>([
        ...((logRes.data ?? []).map((r: any) => r.exercise_id)),
        ...((rtRes.data ?? []).map((r: any) => r.exercise_id)),
      ]);
      const mine = (exRes.data ?? []).map(toExercise)
        .filter(e => e.nameKo != null || e.userId != null || usedIds.has(e.id));
      const score = (x: Exercise) => (x.nameKo ? 2 : 0) + (x.userId ? 1 : 0);
      const byKey = new Map<string, Exercise>();
      for (const e of mine) {
        const key = e.sourceId ?? `en:${e.nameEn}`;
        const cur = byKey.get(key);
        if (!cur || score(e) > score(cur)) byKey.set(key, e);
      }
      return Array.from(byKey.values())
        .sort((a, b) => exerciseLabel(a).localeCompare(exerciseLabel(b), 'ko'));
    },

    // 전체 카탈로그 검색 (한글명·영어명·장비 ilike + 근육 contains). DB 값만 검색 — 번역 없음.
    search: async (q: string): Promise<Exercise[]> => {
      const term = q.trim();
      if (!term) return [];
      const safe = term.replace(/[%,()]/g, ' ').trim();
      if (!safe) return [];
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or(`name_ko.ilike.%${safe}%,name_en.ilike.%${safe}%,equipment.ilike.%${safe}%,primary_muscles.cs.{${safe}}`)
        .limit(120);
      if (error) console.error('[db] exercises search:', error.message);
      return (data ?? []).map(toExercise)
        .sort((a, b) => exerciseLabel(a).localeCompare(exerciseLabel(b), 'ko'));
    },

    // 카탈로그 종목 채택: 공용 행(user_id=null)은 RLS 상 수정 불가 → 내 소유 복사본 생성.
    // 이미 내 소유면 name_ko 만 갱신. nameKo 비우면 null(표시는 영어명으로 폴백).
    // ※ 한글화는 이 '채택' 시점 1회뿐 — 페이지 조회마다 번역 API 호출 금지(런타임 번역 금지).
    adopt: async (ex: Exercise, nameKo: string | null): Promise<Exercise | null> => {
      const ko = nameKo && nameKo.trim() ? nameKo.trim() : null;
      if (ex.userId) {
        const { data, error } = await supabase.from('exercises')
          .update({ name_ko: ko }).eq('id', ex.id).select('*').single();
        if (error) { console.error('[db] exercises adopt update:', error.message); return null; }
        return toExercise(data);
      }
      // 이미 채택한 복사본이 있으면 그 행의 name_ko 만 갱신 (중복 방지)
      let dupQ = supabase.from('exercises').select('*').not('user_id', 'is', null);
      dupQ = ex.sourceId ? dupQ.eq('source_id', ex.sourceId) : dupQ.eq('name_en', ex.nameEn);
      const { data: dup } = await dupQ.maybeSingle();
      if (dup?.id) {
        const { data, error } = await supabase.from('exercises')
          .update({ name_ko: ko }).eq('id', dup.id).select('*').single();
        if (error) { console.error('[db] exercises adopt re-update:', error.message); return null; }
        return toExercise(data);
      }
      const { data, error } = await supabase.from('exercises').insert({
        name_ko: ko, name_en: ex.nameEn, type: ex.type, body_part: ex.bodyPart,
        equipment: ex.equipment, primary_muscles: ex.primaryMuscles,
        youtube_url: ex.youtubeUrl, image_url: ex.imageUrl,
        source: ex.source, source_id: ex.sourceId,
      }).select('*').single();
      if (error) { console.error('[db] exercises adopt insert:', error.message); return null; }
      return toExercise(data);
    },

    // ── 세션(workout_logs) + 세트(workout_sets) ──
    fetchLog: async (logId: string): Promise<WorkoutLog | null> => {
      const { data, error } = await supabase.from('workout_logs')
        .select('*, exercises(*), workout_sets(*)').eq('id', logId).single();
      if (error) { console.error('[db] workout_logs fetchLog:', error.message); return null; }
      return toWorkoutLog(data);
    },
    listByDate: async (performedOn: string): Promise<WorkoutLog[]> => {
      const { data, error } = await supabase.from('workout_logs')
        .select('*, exercises(*), workout_sets(*)')
        .eq('performed_on', performedOn)
        .order('created_at', { ascending: true });
      if (error) console.error('[db] workout_logs listByDate:', error.message);
      return (data ?? []).map(toWorkoutLog);
    },
    // 일간 칩 집약 — 그날(performed_on) 운동 요약(세션 수·종목명). 없으면 null.
    summaryForDate: async (date: string): Promise<{ count: number; names: string[] } | null> => {
      const { data, error } = await supabase.from('workout_logs')
        .select('exercises(name_ko, name_en)')
        .eq('performed_on', date)
        .order('created_at', { ascending: true });
      if (error) { console.error('[db] workout_logs summaryForDate:', error.message); return null; }
      if (!data || data.length === 0) return null;
      const names = (data as any[])
        .map(r => r.exercises?.name_ko || r.exercises?.name_en)
        .filter(Boolean) as string[];
      return { count: data.length, names };
    },
    listAll: async (): Promise<WorkoutLog[]> => {
      const { data, error } = await supabase.from('workout_logs')
        .select('*, exercises(*), workout_sets(*)')
        .order('performed_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) console.error('[db] workout_logs listAll:', error.message);
      return (data ?? []).map(toWorkoutLog);
    },
    // 직전 세션(prefill 용) — beforeDate 미만 중 가장 최근. 없으면 전체 중 최근.
    lastSessionFor: async (exerciseId: string, beforeDate?: string): Promise<WorkoutLog | null> => {
      let q = supabase.from('workout_logs')
        .select('*, exercises(*), workout_sets(*)')
        .eq('exercise_id', exerciseId)
        .order('performed_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (beforeDate) q = q.lt('performed_on', beforeDate);
      const { data, error } = await q;
      if (error) console.error('[db] workout_logs lastSession:', error.message);
      return data && data.length ? toWorkoutLog(data[0]) : null;
    },
    // 성장 그래프: fromDate 이후 세션별 대표 weight(최대 무게) 날짜순 — 근력 전용.
    growthSeries: async (exerciseId: string, fromDate: string): Promise<{ date: string; weight: number }[]> => {
      const { data, error } = await supabase.from('workout_logs')
        .select('performed_on, workout_sets(weight)')
        .eq('exercise_id', exerciseId)
        .gte('performed_on', fromDate)
        .order('performed_on', { ascending: true });
      if (error) console.error('[db] workout_logs growth:', error.message);
      const out: { date: string; weight: number }[] = [];
      for (const r of (data ?? []) as any[]) {
        const weights = (r.workout_sets ?? []).map((s: any) => s.weight).filter((w: any) => typeof w === 'number');
        if (weights.length) out.push({ date: r.performed_on, weight: Math.max(...weights) });
      }
      return out;
    },
    createLog: async (input: { exerciseId: string; performedOn: string; memo: string | null; sets: WorkoutSet[] }): Promise<WorkoutLog | null> => {
      const { data: log, error } = await supabase.from('workout_logs')
        .insert({ exercise_id: input.exerciseId, performed_on: input.performedOn, memo: input.memo })
        .select('id').single();
      if (error || !log) { console.error('[db] workout_logs create:', error?.message); return null; }
      if (input.sets.length) {
        const rows = input.sets.map((s, i) => ({
          log_id: log.id, set_no: i + 1,
          weight: s.weight, reps: s.reps, duration_min: s.durationMin, distance_km: s.distanceKm,
        }));
        const { error: sErr } = await supabase.from('workout_sets').insert(rows);
        if (sErr) console.error('[db] workout_sets create:', sErr.message);
      }
      return db.workouts.fetchLog(log.id);
    },
    updateLog: async (logId: string, input: { memo: string | null; sets: WorkoutSet[] }): Promise<WorkoutLog | null> => {
      const { error } = await supabase.from('workout_logs').update({ memo: input.memo }).eq('id', logId);
      if (error) console.error('[db] workout_logs update:', error.message);
      // 세트 전체 교체
      await supabase.from('workout_sets').delete().eq('log_id', logId);
      if (input.sets.length) {
        const rows = input.sets.map((s, i) => ({
          log_id: logId, set_no: i + 1,
          weight: s.weight, reps: s.reps, duration_min: s.durationMin, distance_km: s.distanceKm,
        }));
        const { error: sErr } = await supabase.from('workout_sets').insert(rows);
        if (sErr) console.error('[db] workout_sets replace:', sErr.message);
      }
      return db.workouts.fetchLog(logId);
    },
    deleteLog: async (logId: string) => {
      const { error } = await supabase.from('workout_logs').delete().eq('id', logId); // workout_sets 는 ON DELETE CASCADE
      if (error) console.error('[db] workout_logs delete:', error.message);
    },

    // ── 주간 루틴(routine_days + routine_exercises) ──
    listRoutineDays: async (): Promise<RoutineDay[]> => {
      const { data, error } = await supabase.from('routine_days')
        .select('*, routine_exercises(*, exercises(*))')
        .order('day_of_week', { ascending: true });
      if (error) console.error('[db] routine_days list:', error.message);
      return (data ?? []).map((r: any): RoutineDay => ({
        id: r.id, dayOfWeek: r.day_of_week, label: r.label ?? null,
        exercises: (r.routine_exercises ?? [])
          .map((re: any): RoutineExerciseItem => ({
            id: re.id, routineDayId: re.routine_day_id, exerciseId: re.exercise_id,
            sortOrder: re.sort_order ?? 0, exercise: re.exercises ? toExercise(re.exercises) : null,
          }))
          .sort((a: RoutineExerciseItem, b: RoutineExerciseItem) => a.sortOrder - b.sortOrder),
      }));
    },
    // 요일 헤더 보장 (unique(user_id, day_of_week)) → id 반환
    ensureRoutineDay: async (dayOfWeek: number): Promise<string | null> => {
      const { data: existing } = await supabase.from('routine_days')
        .select('id').eq('day_of_week', dayOfWeek).maybeSingle();
      if (existing?.id) return existing.id;
      const { data, error } = await supabase.from('routine_days')
        .insert({ day_of_week: dayOfWeek }).select('id').single();
      if (error) { console.error('[db] routine_days ensure:', error.message); return null; }
      return data.id;
    },
    setRoutineLabel: async (dayOfWeek: number, label: string | null) => {
      const dayId = await db.workouts.ensureRoutineDay(dayOfWeek);
      if (!dayId) return;
      const { error } = await supabase.from('routine_days').update({ label }).eq('id', dayId);
      if (error) console.error('[db] routine_days label:', error.message);
    },
    addRoutineExercise: async (dayOfWeek: number, exerciseId: string) => {
      const dayId = await db.workouts.ensureRoutineDay(dayOfWeek);
      if (!dayId) return;
      const { data: last } = await supabase.from('routine_exercises')
        .select('sort_order').eq('routine_day_id', dayId)
        .order('sort_order', { ascending: false }).limit(1);
      const next = last && last.length ? (last[0].sort_order ?? 0) + 1 : 0;
      const { error } = await supabase.from('routine_exercises')
        .insert({ routine_day_id: dayId, exercise_id: exerciseId, sort_order: next });
      if (error) console.error('[db] routine_exercises add:', error.message);
    },
    removeRoutineExercise: async (id: string) => {
      const { error } = await supabase.from('routine_exercises').delete().eq('id', id);
      if (error) console.error('[db] routine_exercises remove:', error.message);
    },
  },

  // ── 가고싶은 곳: 폴더 (place_folders) ─────────────────────────────────────────
  placeFolders: {
    fetchAll: async (): Promise<PlaceFolder[]> => {
      const { data, error } = await supabase
        .from('place_folders')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) console.error('[db] place_folders fetchAll:', error.message);
      return (data ?? []).map(toPlaceFolder);
    },
    // 생성 — user_id 는 DB DEFAULT auth.uid(). sort_order 미지정 시 맨 뒤로.
    create: async (input: { name: string; icon?: string | null; color?: string | null; sortOrder?: number }): Promise<PlaceFolder | null> => {
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const { data: last } = await supabase
          .from('place_folders')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);
        sortOrder = (last?.[0]?.sort_order ?? -1) + 1;
      }
      const { data, error } = await supabase
        .from('place_folders')
        .insert({ name: input.name, icon: input.icon ?? null, color: input.color ?? null, sort_order: sortOrder })
        .select('*')
        .single();
      if (error) { console.error('[db] place_folders create:', error.message); return null; }
      return data ? toPlaceFolder(data) : null;
    },
    // 이름/아이콘/색 수정 (전달된 키만 부분 업데이트).
    update: async (id: string, patch: { name?: string; icon?: string | null; color?: string | null }): Promise<void> => {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined)  row.name = patch.name;
      if (patch.icon !== undefined)  row.icon = patch.icon;
      if (patch.color !== undefined) row.color = patch.color;
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from('place_folders').update(row).eq('id', id);
      if (error) console.error('[db] place_folders update:', error.message);
    },
    delete: async (id: string): Promise<void> => {
      // place_folder_items 는 ON DELETE CASCADE 로 함께 삭제됨(장소 자체는 보존).
      const { error } = await supabase.from('place_folders').delete().eq('id', id);
      if (error) console.error('[db] place_folders delete:', error.message);
    },
    // 정렬 — id 배열 순서대로 sort_order 재부여.
    reorder: async (orderedIds: string[]): Promise<void> => {
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from('place_folders').update({ sort_order: i }).eq('id', id),
        ),
      );
    },
  },

  // ── 가고싶은 곳: 장소 (places) ────────────────────────────────────────────────
  places: {
    // 목록 조회 — folderId(다대다) · concept 필터 옵션. 둘 다 없으면 전체.
    fetchAll: async (opts?: { folderId?: string; concept?: string }): Promise<Place[]> => {
      // 폴더 필터: place_folder_items 로 place_id 를 먼저 추린다.
      if (opts?.folderId) {
        const { data: links, error: linkErr } = await supabase
          .from('place_folder_items')
          .select('place_id')
          .eq('folder_id', opts.folderId);
        if (linkErr) { console.error('[db] places fetchAll links:', linkErr.message); return []; }
        const ids = (links ?? []).map((r: any) => r.place_id);
        if (ids.length === 0) return [];
        let q = supabase.from('places').select('*').in('id', ids);
        if (opts.concept) q = q.eq('concept', opts.concept);
        const { data, error } = await q.order('created_at', { ascending: false });
        if (error) console.error('[db] places fetchAll(folder):', error.message);
        return (data ?? []).map(toPlace);
      }
      let q = supabase.from('places').select('*');
      if (opts?.concept) q = q.eq('concept', opts.concept);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) console.error('[db] places fetchAll:', error.message);
      return (data ?? []).map(toPlace);
    },
    fetchOne: async (id: string): Promise<Place | null> => {
      const { data, error } = await supabase.from('places').select('*').eq('id', id).maybeSingle();
      if (error) console.error('[db] places fetchOne:', error.message);
      return data ? toPlace(data) : null;
    },
    // 생성 — user_id 는 DB DEFAULT auth.uid(). 외부 API 호출 없음(좌표/주소는 Stage 3).
    create: async (input: PlaceInput & { name: string }): Promise<Place | null> => {
      const { data, error } = await supabase
        .from('places')
        .insert(fromPlace(input))
        .select('*')
        .single();
      if (error) { console.error('[db] places create:', error.message); return null; }
      return data ? toPlace(data) : null;
    },
    // 수정 — 전달된 키만 부분 업데이트 + updated_at 갱신(트리거 컨벤션 없음 → 앱에서 갱신).
    update: async (id: string, patch: PlaceInput): Promise<void> => {
      const row = fromPlace(patch);
      if (Object.keys(row).length === 0) return;
      row.updated_at = new Date().toISOString();
      const { error } = await supabase.from('places').update(row).eq('id', id);
      if (error) console.error('[db] places update:', error.message);
    },
    delete: async (id: string): Promise<void> => {
      // place_folder_items 는 CASCADE, place_visits 는 ON DELETE SET NULL(방문 기록 보존).
      const { error } = await supabase.from('places').delete().eq('id', id);
      if (error) console.error('[db] places delete:', error.message);
    },
    // 인리치먼트(네이버 블로그 후기 + 선택 AI 요약) — 저장 시점 1회 호출.
    // 보조 처리라 실패해도 throw 하지 않는다(저장 자체는 이미 성공). 성공 시 enrich-place 가
    // blog_reviews/ai_summary/enriched_at 을 채우고 Realtime 으로 화면이 갱신된다.
    enrich: async (placeId: string, summarize = true): Promise<boolean> => {
      try {
        const { data, error } = await supabase.functions.invoke('enrich-place', {
          body: { place_id: placeId, summarize },
        });
        if (error) { console.error('[db] places enrich:', error.message); return false; }
        return !!(data as any)?.ok;
      } catch (e) {
        console.error('[db] places enrich exception:', e);
        return false;
      }
    },
  },

  // ── 가고싶은 곳: 장소 ↔ 폴더 다대다 (place_folder_items) ──────────────────────
  placeFolderItems: {
    // 장소를 폴더에 추가(이미 있으면 무시).
    addToFolder: async (placeId: string, folderId: string): Promise<void> => {
      const { error } = await supabase
        .from('place_folder_items')
        .upsert({ place_id: placeId, folder_id: folderId }, { onConflict: 'place_id,folder_id', ignoreDuplicates: true });
      if (error) console.error('[db] place_folder_items add:', error.message);
    },
    // 장소를 폴더에서 제거.
    removeFromFolder: async (placeId: string, folderId: string): Promise<void> => {
      const { error } = await supabase
        .from('place_folder_items')
        .delete()
        .eq('place_id', placeId)
        .eq('folder_id', folderId);
      if (error) console.error('[db] place_folder_items remove:', error.message);
    },
    // 전체 장소↔폴더 연결을 한 번에 조회 (보관함 벌크 렌더용 — N+1 방지).
    allLinks: async (): Promise<{ placeId: string; folderId: string }[]> => {
      const { data, error } = await supabase
        .from('place_folder_items')
        .select('place_id, folder_id');
      if (error) { console.error('[db] place_folder_items allLinks:', error.message); return []; }
      return (data ?? []).map((r: any) => ({ placeId: r.place_id, folderId: r.folder_id }));
    },
    // 한 장소가 소속된 폴더 id 목록.
    foldersForPlace: async (placeId: string): Promise<string[]> => {
      const { data, error } = await supabase
        .from('place_folder_items')
        .select('folder_id')
        .eq('place_id', placeId);
      if (error) { console.error('[db] place_folder_items foldersForPlace:', error.message); return []; }
      return (data ?? []).map((r: any) => r.folder_id);
    },
    // 한 폴더에 속한 장소 id 목록.
    placesInFolder: async (folderId: string): Promise<string[]> => {
      const { data, error } = await supabase
        .from('place_folder_items')
        .select('place_id')
        .eq('folder_id', folderId);
      if (error) { console.error('[db] place_folder_items placesInFolder:', error.message); return []; }
      return (data ?? []).map((r: any) => r.place_id);
    },
    // 한 장소의 소속 폴더를 한 번에 동기화(현재와 비교해 추가/삭제분만 반영).
    setFoldersForPlace: async (placeId: string, folderIds: string[]): Promise<void> => {
      const { data: current, error: curErr } = await supabase
        .from('place_folder_items')
        .select('folder_id')
        .eq('place_id', placeId);
      if (curErr) { console.error('[db] place_folder_items setFolders select:', curErr.message); return; }
      const currentSet = new Set((current ?? []).map((r: any) => r.folder_id));
      const nextSet = new Set(folderIds);
      const toAdd = folderIds.filter(id => !currentSet.has(id));
      const toRemove = [...currentSet].filter(id => !nextSet.has(id));
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('place_folder_items')
          .insert(toAdd.map(folderId => ({ place_id: placeId, folder_id: folderId })));
        if (error) console.error('[db] place_folder_items setFolders insert:', error.message);
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('place_folder_items')
          .delete()
          .eq('place_id', placeId)
          .in('folder_id', toRemove);
        if (error) console.error('[db] place_folder_items setFolders delete:', error.message);
      }
    },
  },

  // ── 가고싶은 곳: 방문 기록 (place_visits) — 기억 탭의 원천 ─────────────────────
  placeVisits: {
    // 전체 방문 목록(visited_on 내림차순).
    fetchAll: async (): Promise<PlaceVisit[]> => {
      const { data, error } = await supabase
        .from('place_visits')
        .select('*')
        .order('visited_on', { ascending: false });
      if (error) console.error('[db] place_visits fetchAll:', error.message);
      return (data ?? []).map(toPlaceVisit);
    },
    // 최근 N건.
    listRecent: async (limit = 5): Promise<PlaceVisit[]> => {
      const { data, error } = await supabase
        .from('place_visits')
        .select('*')
        .order('visited_on', { ascending: false })
        .limit(limit);
      if (error) console.error('[db] place_visits listRecent:', error.message);
      return (data ?? []).map(toPlaceVisit);
    },
    // 일간 칩 집약 — 그날(visited_on) 다녀온 곳 요약(방문 수·첫 장소명). 없으면 null.
    summaryForDate: async (date: string): Promise<{ count: number; firstName: string | null } | null> => {
      const { data, error } = await supabase
        .from('place_visits').select('name')
        .eq('visited_on', date).order('created_at', { ascending: true });
      if (error) { console.error('[db] place_visits summaryForDate:', error.message); return null; }
      if (!data || data.length === 0) return null;
      return { count: data.length, firstName: data[0].name ?? null };
    },
    // 생성 — 저장된 place 연결(placeId) 또는 place 없이 직접(name/regionCode 비정규화).
    // user_id 는 DB DEFAULT auth.uid().
    create: async (input: {
      name: string;
      regionCode: string;
      visitedOn: string;
      placeId?: string | null;
      mood?: number | null;
      note?: string | null;
      diaryEntryId?: string | null;
    }): Promise<PlaceVisit | null> => {
      const { data, error } = await supabase
        .from('place_visits')
        .insert({
          place_id: input.placeId ?? null,
          name: input.name,
          region_code: input.regionCode,
          visited_on: input.visitedOn,
          mood: input.mood ?? null,
          note: input.note ?? null,
          diary_entry_id: input.diaryEntryId ?? null,
        })
        .select('*')
        .single();
      if (error) { console.error('[db] place_visits create:', error.message); return null; }
      return data ? toPlaceVisit(data) : null;
    },
    update: async (id: string, patch: {
      name?: string; regionCode?: string; visitedOn?: string;
      placeId?: string | null; mood?: number | null; note?: string | null; diaryEntryId?: string | null;
    }): Promise<void> => {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined)         row.name = patch.name;
      if (patch.regionCode !== undefined)   row.region_code = patch.regionCode;
      if (patch.visitedOn !== undefined)    row.visited_on = patch.visitedOn;
      if (patch.placeId !== undefined)      row.place_id = patch.placeId;
      if (patch.mood !== undefined)         row.mood = patch.mood;
      if (patch.note !== undefined)         row.note = patch.note;
      if (patch.diaryEntryId !== undefined) row.diary_entry_id = patch.diaryEntryId;
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from('place_visits').update(row).eq('id', id);
      if (error) console.error('[db] place_visits update:', error.message);
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('place_visits').delete().eq('id', id);
      if (error) console.error('[db] place_visits delete:', error.message);
    },
    // 방문 취소(되돌리기) — 한 장소의 방문 행 전부 삭제. (v1: 장소당 방문 1회 토글)
    deleteByPlace: async (placeId: string): Promise<void> => {
      const { error } = await supabase.from('place_visits').delete().eq('place_id', placeId);
      if (error) console.error('[db] place_visits deleteByPlace:', error.message);
    },
    // 지역별 방문수 집계(히트맵용) — region_code GROUP BY. 클라이언트 집계(RLS 로 본인 행만).
    countByRegion: async (): Promise<RegionVisitCount[]> => {
      const { data, error } = await supabase.from('place_visits').select('region_code');
      if (error) { console.error('[db] place_visits countByRegion:', error.message); return []; }
      const counts = new Map<string, number>();
      for (const r of (data ?? []) as { region_code: string }[]) {
        counts.set(r.region_code, (counts.get(r.region_code) ?? 0) + 1);
      }
      return [...counts.entries()].map(([regionCode, count]) => ({ regionCode, count }));
    },
  },

  // ── 산책 (walk_sessions) ──────────────────────────────────────────────────────
  walkSessions: {
    // 전체 세션 목록(시작 시각 내림차순). started_at 이 null 이면(미완료) created_at 보조 정렬.
    fetchAll: async (): Promise<WalkSession[]> => {
      const { data, error } = await supabase
        .from('walk_sessions')
        .select('*')
        .order('started_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) console.error('[db] walk_sessions fetchAll:', error.message);
      return (data ?? []).map(toWalkSession);
    },
    fetchOne: async (id: string): Promise<WalkSession | null> => {
      const { data, error } = await supabase.from('walk_sessions').select('*').eq('id', id).maybeSingle();
      if (error) console.error('[db] walk_sessions fetchOne:', error.message);
      return data ? toWalkSession(data) : null;
    },
    // 저장해 둔 "내 코스"만(재사용용). is_saved_route = true.
    fetchSavedRoutes: async (): Promise<WalkSession[]> => {
      const { data, error } = await supabase
        .from('walk_sessions')
        .select('*')
        .eq('is_saved_route', true)
        .order('created_at', { ascending: false });
      if (error) console.error('[db] walk_sessions fetchSavedRoutes:', error.message);
      return (data ?? []).map(toWalkSession);
    },
    // 생성 — user_id 는 DB DEFAULT auth.uid(). 거리/페이스는 호출부에서 계산해 넘긴다.
    create: async (input: WalkSessionInput): Promise<WalkSession | null> => {
      const { data, error } = await supabase
        .from('walk_sessions')
        .insert(fromWalkSession(input))
        .select('*')
        .single();
      if (error) { console.error('[db] walk_sessions create:', error.message); return null; }
      return data ? toWalkSession(data) : null;
    },
    // 수정 — 전달된 키만 부분 업데이트(완료 후 메모/사진/코스 저장 등).
    update: async (id: string, patch: WalkSessionInput): Promise<void> => {
      const row = fromWalkSession(patch);
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from('walk_sessions').update(row).eq('id', id);
      if (error) console.error('[db] walk_sessions update:', error.message);
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('walk_sessions').delete().eq('id', id);
      if (error) console.error('[db] walk_sessions delete:', error.message);
    },
    // 완료 카드 사진 업로드 → publicUrl 반환 (food-photos/moment-photos 패턴 동일).
    uploadPhoto: async (file: File, sessionId: string): Promise<string | null> => {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${sessionId}.${ext}`;
      const { error } = await supabase.storage.from('walk-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) { console.error('[db] walk photo upload:', error.message); return null; }
      const { data } = supabase.storage.from('walk-photos').getPublicUrl(path);
      return data.publicUrl;
    },
  },

  // ── 뷰티 케어 · 살림 (Stage 2) ─────────────────────────────────────────────
  // user_id 는 DB DEFAULT auth.uid() 로 자동. 클라이언트 저장 시 보내지 않는다(fridge 패턴).
  // 날짜 배열(done/replaced/cleaned)은 read-modify-write 로 today 1개만 추가(같은 날 중복 무시).

  // 뷰티 보유함
  beautyProducts: {
    fetchAll: async (): Promise<BeautyProduct[]> => {
      const { data, error } = await supabase
        .from('beauty_products').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] beauty_products fetch:', error.message);
      return (data ?? []).map((r: any): BeautyProduct => ({
        id: r.id,
        name: r.name,
        brand: r.brand ?? null,
        category: r.category ?? null,
        photoUrl: r.photo_url ?? null,
        openedAt: r.opened_at ?? null,
        expiryMonths: r.expiry_months != null ? Number(r.expiry_months) : null,
        purchasePlace: r.purchase_place ?? null,
        price: r.price != null ? Number(r.price) : null,
        link: r.link ?? null,
        memo: r.memo ?? null,
        isActive: r.is_active ?? true,
        createdAt: r.created_at ?? undefined,
      }));
    },
    upsert: async (item: BeautyProduct) => {
      const { error } = await supabase.from('beauty_products').upsert({
        id: item.id,
        name: item.name,
        brand: item.brand ?? null,
        category: item.category ?? null,
        photo_url: item.photoUrl ?? null,
        opened_at: item.openedAt ?? null,
        expiry_months: item.expiryMonths ?? null,
        purchase_place: item.purchasePlace ?? null,
        price: item.price ?? null,
        link: item.link ?? null,
        memo: item.memo ?? null,
        is_active: item.isActive ?? true,
      }, { onConflict: 'id' });
      if (error) console.error('[db] beauty_products upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('beauty_products').delete().eq('id', id);
      if (error) console.error('[db] beauty_products delete:', error.message);
    },
    // 사진 업로드 → beauty-photos 버킷 (food/walk uploadPhoto 패턴 동일)
    uploadPhoto: async (recordId: string, file: File): Promise<string | null> => {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${recordId}.${ext}`;
      const { error } = await supabase.storage.from('beauty-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) { console.error('[db] beauty photo upload:', error.message); return null; }
      const { data } = supabase.storage.from('beauty-photos').getPublicUrl(path);
      return data.publicUrl;
    },
    // 재구매 = 같은 제품을 새 id 로 복제 insert. opened_at=오늘, is_active=true.
    // 원본은 그대로 둔다(사용자가 원하면 따로 삭제). 새 행을 반환.
    repurchase: async (product: BeautyProduct): Promise<BeautyProduct | null> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const newId = crypto.randomUUID();
      const { data, error } = await supabase.from('beauty_products').insert({
        id: newId,
        name: product.name,
        brand: product.brand ?? null,
        category: product.category ?? null,
        photo_url: product.photoUrl ?? null,
        opened_at: today,
        expiry_months: product.expiryMonths ?? null,
        purchase_place: product.purchasePlace ?? null,
        price: product.price ?? null,
        link: product.link ?? null,
        memo: product.memo ?? null,
        is_active: true,
      }).select('*').single();
      if (error) { console.error('[db] beauty_products repurchase:', error.message); return null; }
      return data ? {
        id: data.id, name: data.name, brand: data.brand, category: data.category,
        photoUrl: data.photo_url, openedAt: data.opened_at,
        expiryMonths: data.expiry_months != null ? Number(data.expiry_months) : null,
        purchasePlace: data.purchase_place, price: data.price != null ? Number(data.price) : null,
        link: data.link, memo: data.memo, isActive: data.is_active ?? true,
        createdAt: data.created_at ?? undefined,
      } : null;
    },
    // 다 쓴 제품 보관(false) / 복원(true)
    setActive: async (id: string, active: boolean) => {
      const { error } = await supabase.from('beauty_products').update({ is_active: active }).eq('id', id);
      if (error) console.error('[db] beauty_products setActive:', error.message);
    },
  },

  // 스페셜케어 (마지막 N일 + 오늘 했어요)
  beautySpecialCare: {
    fetchAll: async (): Promise<BeautySpecialCare[]> => {
      const { data, error } = await supabase
        .from('beauty_special_care').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] beauty_special_care fetch:', error.message);
      return (data ?? []).map((r: any): BeautySpecialCare => ({
        id: r.id,
        name: r.name,
        icon: r.icon ?? null,
        cycleDays: r.cycle_days != null ? Number(r.cycle_days) : null,
        doneDates: r.done_dates ?? [],
        createdAt: r.created_at ?? undefined,
      }));
    },
    upsert: async (item: BeautySpecialCare) => {
      const { error } = await supabase.from('beauty_special_care').upsert({
        id: item.id,
        name: item.name,
        icon: item.icon ?? null,
        cycle_days: item.cycleDays ?? null,
        done_dates: item.doneDates ?? [],
      }, { onConflict: 'id' });
      if (error) console.error('[db] beauty_special_care upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('beauty_special_care').delete().eq('id', id);
      if (error) console.error('[db] beauty_special_care delete:', error.message);
    },
    // 오늘 했어요 — done_dates 에 today 추가(같은 날 중복 무시). read-modify-write.
    markDone: async (id: string, today: string) => {
      const { data, error: e1 } = await supabase
        .from('beauty_special_care').select('done_dates').eq('id', id).maybeSingle();
      if (e1) { console.error('[db] beauty_special_care markDone fetch:', e1.message); return; }
      const dates: string[] = data?.done_dates ?? [];
      if (dates.includes(today)) return;
      const { error } = await supabase
        .from('beauty_special_care').update({ done_dates: [...dates, today] }).eq('id', id);
      if (error) console.error('[db] beauty_special_care markDone:', error.message);
    },
  },

  // 살림 재고
  householdItems: {
    fetchAll: async (): Promise<HouseholdItem[]> => {
      const { data, error } = await supabase
        .from('household_items').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] household_items fetch:', error.message);
      return (data ?? []).map((r: any): HouseholdItem => ({
        id: r.id,
        name: r.name,
        category: r.category ?? null,
        quantity: r.quantity != null ? Number(r.quantity) : 1,
        unit: r.unit ?? null,
        thresholdQty: r.threshold_qty != null ? Number(r.threshold_qty) : 1,
        brand: r.brand ?? null,
        purchasePlace: r.purchase_place ?? null,
        price: r.price != null ? Number(r.price) : null,
        link: r.link ?? null,
        memo: r.memo ?? null,
        photoUrl: r.photo_url ?? null,
        createdAt: r.created_at ?? undefined,
      }));
    },
    upsert: async (item: HouseholdItem) => {
      const { error } = await supabase.from('household_items').upsert({
        id: item.id,
        name: item.name,
        category: item.category ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        threshold_qty: item.thresholdQty,
        brand: item.brand ?? null,
        purchase_place: item.purchasePlace ?? null,
        price: item.price ?? null,
        link: item.link ?? null,
        memo: item.memo ?? null,
        photo_url: item.photoUrl ?? null,
      }, { onConflict: 'id' });
      if (error) console.error('[db] household_items upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('household_items').delete().eq('id', id);
      if (error) console.error('[db] household_items delete:', error.message);
    },
    uploadPhoto: async (recordId: string, file: File): Promise<string | null> => {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${recordId}.${ext}`;
      const { error } = await supabase.storage.from('household-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) { console.error('[db] household photo upload:', error.message); return null; }
      const { data } = supabase.storage.from('household-photos').getPublicUrl(path);
      return data.publicUrl;
    },
    // 수량 증감 — fridge updateQuantity 동일한 낙관적 업데이트. 0 미만 금지.
    // delta 만큼 증감하기 위해 현재값을 읽어 clamp 한다(read-modify-write).
    updateQuantity: async (id: string, delta: number): Promise<number | null> => {
      const { data, error: e1 } = await supabase
        .from('household_items').select('quantity').eq('id', id).maybeSingle();
      if (e1) { console.error('[db] household_items updateQuantity fetch:', e1.message); return null; }
      const cur = data?.quantity != null ? Number(data.quantity) : 0;
      const next = Math.max(0, cur + delta);
      const { error } = await supabase.from('household_items').update({ quantity: next }).eq('id', id);
      if (error) { console.error('[db] household_items updateQuantity:', error.message); return null; }
      return next;
    },
    // 재구매 완료 = 다시 채움. amount 주면 그 값, 없으면 threshold_qty 로.
    refill: async (id: string, amount?: number): Promise<number | null> => {
      let next = amount;
      if (next == null) {
        const { data, error: e1 } = await supabase
          .from('household_items').select('threshold_qty').eq('id', id).maybeSingle();
        if (e1) { console.error('[db] household_items refill fetch:', e1.message); return null; }
        next = data?.threshold_qty != null ? Number(data.threshold_qty) : 1;
      }
      const { error } = await supabase.from('household_items').update({ quantity: next }).eq('id', id);
      if (error) { console.error('[db] household_items refill:', error.message); return null; }
      return next;
    },
  },

  // 소모품 교체주기
  consumableCycles: {
    fetchAll: async (): Promise<ConsumableCycle[]> => {
      const { data, error } = await supabase
        .from('consumable_cycles').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] consumable_cycles fetch:', error.message);
      return (data ?? []).map((r: any): ConsumableCycle => ({
        id: r.id,
        name: r.name,
        cycleDays: r.cycle_days != null ? Number(r.cycle_days) : 0,
        replacedDates: r.replaced_dates ?? [],
        createdAt: r.created_at ?? undefined,
      }));
    },
    upsert: async (item: ConsumableCycle) => {
      const { error } = await supabase.from('consumable_cycles').upsert({
        id: item.id,
        name: item.name,
        cycle_days: item.cycleDays,
        replaced_dates: item.replacedDates ?? [],
      }, { onConflict: 'id' });
      if (error) console.error('[db] consumable_cycles upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('consumable_cycles').delete().eq('id', id);
      if (error) console.error('[db] consumable_cycles delete:', error.message);
    },
    // 교체(restart) — replaced_dates 에 today 추가(같은 날 중복 무시).
    replace: async (id: string, today: string) => {
      const { data, error: e1 } = await supabase
        .from('consumable_cycles').select('replaced_dates').eq('id', id).maybeSingle();
      if (e1) { console.error('[db] consumable_cycles replace fetch:', e1.message); return; }
      const dates: string[] = data?.replaced_dates ?? [];
      if (dates.includes(today)) return;
      const { error } = await supabase
        .from('consumable_cycles').update({ replaced_dates: [...dates, today] }).eq('id', id);
      if (error) console.error('[db] consumable_cycles replace:', error.message);
    },
    setCycle: async (id: string, days: number) => {
      const { error } = await supabase.from('consumable_cycles').update({ cycle_days: days }).eq('id', id);
      if (error) console.error('[db] consumable_cycles setCycle:', error.message);
    },
  },

  // 청소구역 (먼지 히트맵)
  cleaningZones: {
    fetchAll: async (): Promise<CleaningZone[]> => {
      const { data, error } = await supabase
        .from('cleaning_zones').select('*').order('created_at', { ascending: false });
      if (error) console.error('[db] cleaning_zones fetch:', error.message);
      return (data ?? []).map((r: any): CleaningZone => ({
        id: r.id,
        name: r.name,
        cleanedDates: r.cleaned_dates ?? [],
        createdAt: r.created_at ?? undefined,
      }));
    },
    upsert: async (item: CleaningZone) => {
      const { error } = await supabase.from('cleaning_zones').upsert({
        id: item.id,
        name: item.name,
        cleaned_dates: item.cleanedDates ?? [],
      }, { onConflict: 'id' });
      if (error) console.error('[db] cleaning_zones upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('cleaning_zones').delete().eq('id', id);
      if (error) console.error('[db] cleaning_zones delete:', error.message);
    },
    // 청소 완료 — cleaned_dates 에 today 추가(같은 날 중복 무시).
    markCleaned: async (id: string, today: string) => {
      const { data, error: e1 } = await supabase
        .from('cleaning_zones').select('cleaned_dates').eq('id', id).maybeSingle();
      if (e1) { console.error('[db] cleaning_zones markCleaned fetch:', e1.message); return; }
      const dates: string[] = data?.cleaned_dates ?? [];
      if (dates.includes(today)) return;
      const { error } = await supabase
        .from('cleaning_zones').update({ cleaned_dates: [...dates, today] }).eq('id', id);
      if (error) console.error('[db] cleaning_zones markCleaned:', error.message);
    },
  },
};
