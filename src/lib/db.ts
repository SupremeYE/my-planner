import { supabase } from './supabase';
import type {
  Todo, Habit, Project, Milestone,
  SelfCareRecord, ReviewRecord, TimelineLog,
  Event, WeeklyGoal, MonthlyGoal, BrainstormItem, Tag,
} from '../app/store';

// ── Row types (Supabase snake_case) ──────────────────────────────────────────

type TodoRow = {
  id: string; text: string; date: string | null; due_date: string | null;
  status: string; is_top3: boolean; plan_start: string | null; plan_end: string | null;
  do_start: string | null; do_end: string | null; category: string | null;
  project_id: string | null; tags: string[];
};

type HabitRow = {
  id: string; name: string; checked_dates: string[]; icon: string | null;
  repeat: string | null; repeat_days: number[] | null; goal_text: string | null;
  alarm_time: string | null; category: string | null; color: string | null;
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

// ── 변환 함수 ────────────────────────────────────────────────────────────────

const toTodo = (r: TodoRow): Todo => ({
  id: r.id, text: r.text, date: r.date, dueDate: r.due_date ?? undefined,
  status: r.status as Todo['status'], isTop3: r.is_top3,
  planStart: r.plan_start ?? undefined, planEnd: r.plan_end ?? undefined,
  doStart: r.do_start ?? undefined, doEnd: r.do_end ?? undefined,
  category: r.category ?? undefined, projectId: r.project_id ?? undefined,
  tags: r.tags ?? [],
});

const fromTodo = (t: Todo): TodoRow => ({
  id: t.id, text: t.text, date: t.date ?? null, due_date: t.dueDate ?? null,
  status: t.status, is_top3: t.isTop3,
  plan_start: t.planStart ?? null, plan_end: t.planEnd ?? null,
  do_start: t.doStart ?? null, do_end: t.doEnd ?? null,
  category: t.category ?? null, project_id: t.projectId ?? null,
  tags: t.tags ?? [],
});

const toHabit = (r: HabitRow): Habit => ({
  id: r.id, name: r.name, checkedDates: r.checked_dates ?? [],
  icon: r.icon ?? undefined, repeat: r.repeat as Habit['repeat'],
  repeatDays: r.repeat_days ?? undefined, goalText: r.goal_text ?? undefined,
  alarmTime: r.alarm_time ?? undefined, category: r.category as Habit['category'],
  color: r.color ?? undefined,
});

const fromHabit = (h: Habit): HabitRow => ({
  id: h.id, name: h.name, checked_dates: h.checkedDates ?? [],
  icon: h.icon ?? null, repeat: h.repeat ?? null,
  repeat_days: h.repeatDays ?? null, goal_text: h.goalText ?? null,
  alarm_time: h.alarmTime ?? null, category: h.category ?? null,
  color: h.color ?? null,
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
});

const fromSelfCare = (s: SelfCareRecord): SelfCareRow => ({
  id: s.id, date: s.date, category: s.category, content: s.content, duration: s.duration,
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
});

const fromMonthlyGoal = (g: MonthlyGoal): MonthlyGoalRow => ({
  id: g.id, text: g.text, month: g.month,
  project_id: g.projectId ?? null,
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
      const { data, error } = await supabase.from('events').select('*').order('date');
      if (error) console.error('[db] events fetch:', error.message);
      return (data ?? []).map(toEvent);
    },
    upsert: async (event: Event) => {
      const { error } = await supabase.from('events').upsert(fromEvent(event));
      if (error) console.error('[db] events upsert:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) console.error('[db] events delete:', error.message);
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

  settings: {
    fetch: async (): Promise<{ dayStartHour: number; dayEndHour: number }> => {
      const { data, error } = await supabase
        .from('user_settings').select('*').eq('id', 'default').single();
      if (error) { console.error('[db] settings fetch:', error.message); return { dayStartHour: 4, dayEndHour: 26 }; }
      return { dayStartHour: data.day_start_hour, dayEndHour: data.day_end_hour };
    },
    upsert: async (dayStartHour: number, dayEndHour: number) => {
      const { error } = await supabase
        .from('user_settings').upsert({ id: 'default', day_start_hour: dayStartHour, day_end_hour: dayEndHour });
      if (error) console.error('[db] settings upsert:', error.message);
    },
  },
};
