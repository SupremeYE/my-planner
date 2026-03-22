import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { format, getISOWeek, getYear, subDays } from 'date-fns';
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
  category?: string;
  projectId?: string;
  tags?: string[];
}

export interface Event {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  memo?: string;
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
  category?: 'health' | 'selfdev' | 'routine' | 'other';
  color?: string;
}

export interface Routine {
  id: string;
  name: string;
  icon: string;
  startTime: string;
  duration: number;
  steps: string[];
  checkedDates: string[];
}

export interface SelfCareRecord {
  id: string;
  date: string;
  category: 'exercise' | 'study' | 'beauty';
  content: string;
  duration: number;
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
}

export interface BrainstormItem {
  id: string;
  text: string;
  date: string;
  weekKey?: string;
}

export interface ActiveTimer {
  todoId: string;
  startTime: number;
  startHHMM: string;
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

const currentWeekKey = getWeekKey(new Date());
const currentMonth = format(new Date(), 'yyyy-MM');

// ───── 기본 태그 (DB가 비어있을 때 시드) ─────
const initialTags: Tag[] = [
  { id: 'tg1', name: '일', color: '#E0795B' },
  { id: 'tg2', name: '자기계발', color: '#5B8FE0' },
  { id: 'tg3', name: '자기관리', color: '#5BC8AF' },
  { id: 'tg4', name: '일상', color: '#A07BE0' },
  { id: 'tg5', name: '건강', color: '#5BC86E' },
];

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

  // Todo actions
  addTodo: (todo: Omit<Todo, 'id'>) => void;
  updateTodo: (id: string, changes: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  toggleTop3: (id: string) => void;

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

  // Routine actions
  addRoutine: (routine: Omit<Routine, 'id'>) => void;
  updateRoutine: (id: string, changes: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  toggleRoutineDate: (id: string, date: string) => void;

  // Self-care actions
  addSelfCareRecord: (record: Omit<SelfCareRecord, 'id'>) => void;
  deleteSelfCareRecord: (id: string) => void;

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
  addMonthlyGoal: (text: string, projectId?: string) => void;
  deleteMonthlyGoal: (id: string) => void;

  // Brainstorm actions
  addBrainstormItem: (text: string, date: string) => void;
  deleteBrainstormItem: (id: string) => void;
  brainstormToTodo: (id: string, date?: string) => void;
  brainstormToEvent: (id: string, eventData: { date: string; startTime?: string; endTime?: string; location?: string; tags?: string[] }) => void;
  setBrainstormMemo: (date: string, text: string) => void;
  addWeeklyBrainstorm: (text: string, weekKey: string) => void;
  weeklyBrainstormAssign: (id: string, date: string) => void;

  // Timer actions
  startTimer: (todoId: string) => void;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selfCareRecords, setSelfCareRecords] = useState<SelfCareRecord[]>([]);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLog[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [brainstormItems, setBrainstormItems] = useState<BrainstormItem[]>([]);
  const [brainstormMemos, setBrainstormMemos] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Tag[]>([]);

  // ── in-memory 상태 ──
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]); // Supabase 연동은 db.routines 통해 진행
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);
  const [dailyAffirmations, setDailyAffirmations] = useState<Record<string, string>>({});

  // ── 앱 시작 시 Supabase에서 데이터 로드 ──
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [
        todosData, habitsData, projectsData, milestonesData,
        selfCareData, reviewData, timelineData, settingsData,
        eventsData, weeklyGoalsData, monthlyGoalsData,
        brainstormItemsData, brainstormMemosData, tagsData, routinesData,
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
      ]);
      setTodos(todosData);
      setHabits(habitsData);
      setProjects(projectsData);
      setMilestones(milestonesData);
      setSelfCareRecords(selfCareData);
      setReviewRecords(reviewData);
      setTimelineLogs(timelineData);
      setDayStartHour(settingsData.dayStartHour);
      setDayEndHour(settingsData.dayEndHour);
      setEvents(eventsData);
      setWeeklyGoals(weeklyGoalsData);
      setMonthlyGoals(monthlyGoalsData);
      setBrainstormItems(brainstormItemsData);
      setBrainstormMemos(brainstormMemosData);
      setRoutines(routinesData);
      // 태그가 없으면 기본 태그 시드
      if (tagsData.length === 0) {
        setTags(initialTags);
        initialTags.forEach(tag => db.tags.upsert(tag));
      } else {
        setTags(tagsData);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const newId = () => Math.random().toString(36).slice(2, 9);

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
    setTodos(prev => prev.filter(t => t.id !== id));
    db.todos.delete(id);
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
    const newEvent: Event = { ...event, id: newId(), tags: event.tags ?? [] };
    setEvents(prev => [...prev, newEvent]);
    db.events.upsert(newEvent);
  }, []);

  const updateEvent = useCallback((id: string, changes: Partial<Event>) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...changes } : e);
      const event = updated.find(e => e.id === id);
      if (event) db.events.upsert(event);
      return updated;
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    db.events.delete(id);
  }, []);

  // ── Habit actions ──
  const addHabit = useCallback((name: string) => {
    const newHabit: Habit = { id: newId(), name, checkedDates: [] };
    setHabits(prev => [...prev, newHabit]);
    db.habits.upsert(newHabit);
  }, []);

  const addHabitFull = useCallback((habit: Omit<Habit, 'id'>) => {
    const newHabit: Habit = { ...habit, id: newId() };
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

  const deleteSelfCareRecord = useCallback((id: string) => {
    setSelfCareRecords(prev => prev.filter(r => r.id !== id));
    db.selfCareRecords.delete(id);
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
    setWeeklyReviews(prev => [...prev, { ...review, id: newId() }]);
  }, []);

  const updateWeeklyReview = useCallback((id: string, changes: Partial<WeeklyReview>) => {
    setWeeklyReviews(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  }, []);

  const addMonthlyReview = useCallback((review: Omit<MonthlyReview, 'id'>) => {
    setMonthlyReviews(prev => [...prev, { ...review, id: newId() }]);
  }, []);

  const updateMonthlyReview = useCallback((id: string, changes: Partial<MonthlyReview>) => {
    setMonthlyReviews(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
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
  const addMonthlyGoal = useCallback((text: string, projectId?: string) => {
    const newGoal: MonthlyGoal = { id: newId(), text, month: currentMonth, projectId };
    setMonthlyGoals(prev => [...prev, newGoal]);
    db.monthlyGoals.upsert(newGoal);
  }, []);

  const deleteMonthlyGoal = useCallback((id: string) => {
    setMonthlyGoals(prev => prev.filter(g => g.id !== id));
    db.monthlyGoals.delete(id);
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
      const newEvent: Event = { id: newId(), title: item.text, ...eventData };
      setEvents(e => [...e, newEvent]);
      db.events.upsert(newEvent);
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
  const startTimer = useCallback((todoId: string) => {
    const now = new Date();
    setActiveTimer({ todoId, startTime: now.getTime(), startHHMM: format(now, 'HH:mm') });
  }, []);

  const stopTimer = useCallback(() => {
    if (!activeTimer) return;
    const endHHMM = format(new Date(), 'HH:mm');
    setTodos(prev => {
      const updated = prev.map(t =>
        t.id === activeTimer.todoId ? { ...t, doStart: activeTimer.startHHMM, doEnd: endHHMM } : t
      );
      const todo = updated.find(t => t.id === activeTimer.todoId);
      if (todo) db.todos.upsert(todo);
      return updated;
    });
    setActiveTimer(null);
  }, [activeTimer]);

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
    setTodos(prev => prev.map(t => ({ ...t, tags: (t.tags || []).filter(tid => tid !== id) })));
    db.tags.delete(id);
  }, []);

  // ── Settings actions ──
  const setDayHours = useCallback((s: number, e: number) => {
    setDayStartHour(s);
    setDayEndHour(e);
    db.settings.upsert(s, e);
  }, []);

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
      todos, events, habits, weeklyGoals, monthlyGoals, brainstormItems, brainstormMemos, activeTimer,
      projects, milestones, tags,
      routines, selfCareRecords, reviewRecords, weeklyReviews, monthlyReviews,
      timelineLogs,
      dailyAffirmations, setDailyAffirmation,
      addTodo, updateTodo, deleteTodo, toggleTop3,
      addEvent, updateEvent, deleteEvent,
      addHabit, addHabitFull, updateHabit, deleteHabit, toggleHabit,
      addRoutine, updateRoutine, deleteRoutine, toggleRoutineDate,
      addSelfCareRecord, deleteSelfCareRecord,
      addReviewRecord, updateReviewRecord, deleteReviewRecord,
      addWeeklyReview, updateWeeklyReview,
      addMonthlyReview, updateMonthlyReview,
      addWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
      addMonthlyGoal, deleteMonthlyGoal,
      addBrainstormItem, deleteBrainstormItem, brainstormToTodo, brainstormToEvent,
      setBrainstormMemo,
      addWeeklyBrainstorm, weeklyBrainstormAssign,
      startTimer, stopTimer,
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
