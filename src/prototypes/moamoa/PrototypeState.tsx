import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Todo, Event, TodoTimeBlock } from '../../app/store';
import { weeklyRollup, combineRollups } from '../../app/components/period/periodProgress';
import { aggregateActivity } from '../../lib/timeAggregation';
import { getWeekKey, weekKeysMatch } from '../../lib/weekKeys';
import { TODAY, MONDAY, initialTodos, initialEvents, initialBlocks, initialHabits, weeklyGoals, categories, addDate } from './sample';

export type Screen = 'today' | 'calendar' | 'quests' | 'records' | 'garden';
export type Sheet = 'quick' | 'review-day' | 'review-week' | 'review-month' | 'mood' | 'sleep' | 'options'
  | { kind: 'edit'; recordKind: 'todo' | 'event'; id: string } | null;
type Task = { key: string; label: string; apply: () => void };
type Feedback = { status: 'saving' | 'success' | 'error'; label: string } | null;
const route = () => {
  const q = new URLSearchParams(location.search);
  const screen = q.get('screen') as Screen;
  return { screen: ['today', 'calendar', 'quests', 'records', 'garden'].includes(screen) ? screen : 'today' as Screen,
    period: q.get('period') === 'month' ? 'month' : q.get('period') === 'day' ? 'day' : 'week',
    view: q.get('view') === 'planner' ? 'planner' : 'schedule' } as const;
};
function usePrototypeState() {
  const [routing, setRouting] = useState(route);
  const [todos, setTodos] = useState<Todo[]>(() => structuredClone(initialTodos));
  const [events, setEvents] = useState<Event[]>(() => structuredClone(initialEvents));
  const [blocks, setBlocks] = useState<TodoTimeBlock[]>(() => structuredClone(initialBlocks));
  const [habits, setHabits] = useState(() => structuredClone(initialHabits));
  const [seeds, setSeeds] = useState([false, false, true]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sheet, setSheetState] = useState<Sheet>(null);
  const sheetOpener = useRef<HTMLElement | null>(null);
  const setSheet = (next: Sheet) => {
    if (next && !sheet && document.activeElement instanceof HTMLElement) sheetOpener.current = document.activeElement;
    setSheetState(next);
  };
  const restoreFocus = () => {
    const target = sheetOpener.current?.isConnected ? sheetOpener.current : document.querySelector<HTMLElement>('.mo-main');
    target?.focus({ preventScroll: true });
  };
  const [quickDate, setQuickDate] = useState<string | null>(TODAY);
  const [quickMode, setQuickMode] = useState<'todo' | 'time'>('todo');
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [weekOffset, setWeekOffset] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const inFlight = useRef(false);
  const failNext = useRef(false);
  const failedTask = useRef<Task | null>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    const onBack = () => { setRouting(route()); setSheet(null); };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);
  useEffect(() => {
    if (feedback?.status !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const navigate = (screen: Screen, options: Partial<Pick<typeof routing, 'period' | 'view'>> = {}) => {
    const next = { ...routing, screen, ...options };
    const q = new URLSearchParams({ screen: next.screen });
    if (screen === 'calendar') { q.set('period', next.period); q.set('view', next.view); }
    history.pushState({}, '', `/__moamoa/?${q}`);
    setRouting(next); setSheet(null);
    document.querySelector('.mo-main')?.scrollTo({ top: 0 });
  };
  // Simulated confirmation only. No production coordinator, DB, Auth, storage or network dependency.
  const simulate = async (task: Task) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setFeedback({ status: 'saving', label: task.label });
    await new Promise(resolve => setTimeout(resolve, 450));
    if (!live.current) return false;
    inFlight.current = false;
    if (failNext.current) {
      failNext.current = false; failedTask.current = task;
      setFeedback({ status: 'error', label: task.label });
      return false;
    }
    task.apply(); failedTask.current = null;
    setFeedback({ status: 'success', label: task.label });
    return true;
  };
  const toggleTodo = (todo: Todo) => {
    const status = todo.status === 'done' ? 'active' : 'done';
    return simulate({ key: `todo:${todo.id}`, label: status === 'done' ? '작은 한 걸음을 모았어요 🌱' : '할 일을 다시 펼쳤어요',
      apply: () => setTodos(rows => rows.map(row => row.id === todo.id ? { ...row, status } : row)) });
  };
  const addTodo = (todo: Todo) => simulate({ key: `todo:${todo.id}`, label: '새로운 할 일을 모았어요',
    apply: () => setTodos(rows => rows.some(row => row.id === todo.id) ? rows : [...rows, todo]) });
  const addBlock = (block: TodoTimeBlock, memo: string) => simulate({ key: `block:${block.id}`, label: '나를 위한 시간을 모았어요',
    apply: () => {
      setBlocks(rows => rows.some(row => row.id === block.id) ? rows : [...rows, block]);
      // Memo is a proposal for a future field, and exists ONLY in this ephemeral mock state.
      if (memo) setNotes(values => ({ ...values, [block.id]: memo }));
    } });
  const editPlan = (kind: 'todo' | 'event', id: string, date: string, start: string, end: string) => simulate({ key: `${kind}:${id}`, label: '계획을 옮겼어요',
    apply: () => kind === 'todo'
      ? setTodos(rows => rows.map(row => row.id === id ? { ...row, date, planStart: start || undefined, planEnd: end || undefined } : row))
      : setEvents(rows => rows.map(row => row.id === id ? { ...row, date: row.doStart || row.doEnd ? row.date : date, startTime: start || undefined, endTime: end || undefined } : row)) });
  const toggleHabit = (id: string, date: string) => simulate({ key: `habit:${id}:${date}`, label: '나를 챙긴 순간을 모았어요',
    apply: () => setHabits(rows => rows.map(row => row.id !== id ? row : { ...row,
      dates: row.dates.includes(date) ? row.dates.filter(d => d !== date) : [...row.dates, date] })) });
  const toggleSeed = (index: number) => simulate({ key: `seed:${index}`, label: '언젠가의 작은 씨앗을 돌아봤어요',
    apply: () => setSeeds(values => values.map((value, i) => i === index ? !value : value)) });
  const saveNote = (key: string, text: string) => simulate({ key, label: '오늘의 마음을 한 장 남겼어요',
    apply: () => setNotes(values => ({ ...values, [key]: text })) });
  const reset = () => {
    setTodos(structuredClone(initialTodos)); setEvents(structuredClone(initialEvents));
    setBlocks(structuredClone(initialBlocks)); setHabits(structuredClone(initialHabits)); setSeeds([false, false, true]); setNotes({});
    failNext.current = false; failedTask.current = null; setFeedback(null); setSheet(null);
  };
  const weekStart = addDate(MONDAY, weekOffset * 7);
  const weekEnd = addDate(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDate(weekStart, i));
  const goals = weeklyGoals.filter(goal => weekKeysMatch(goal.weekKey, getWeekKey(new Date(`${weekStart}T12:00:00`))));
  const weekTodos = todos.filter(todo => (todo.date && todo.date >= weekStart && todo.date <= weekEnd)
    || (!todo.date && goals.some(goal => goal.id === todo.weeklyGoalId)));
  const todayProgress = combineRollups(weeklyGoals.map(goal => weeklyRollup(goal, todos)));
  const timeReport = (start: string, end: string) => aggregateActivity(todos, events, categories, start, end, blocks);
  const openQuick = (date: string | null = TODAY, mode: 'todo' | 'time' = 'todo') => { if (feedback?.status === 'success') setFeedback(null); setQuickDate(date); setQuickMode(mode); setSheet('quick'); };
  return { quickDate, quickMode, openQuick, ...routing, navigate, todos, events, blocks, habits, notes, sheet, setSheet, restoreFocus, selectedDay, setSelectedDay,
    weekOffset, weekStart, weekEnd, days, goals, weekTodos, todayProgress,
    moveWeek: (offset: number) => { setWeekOffset(offset); setSelectedDay(addDate(MONDAY, offset * 7 + 1)); },
    seeds, toggleSeed, toggleTodo, addTodo, addBlock, editPlan, toggleHabit, saveNote, timeReport, feedback,
    busy: feedback?.status === 'saving',
    retry: () => { if (failedTask.current) void simulate(failedTask.current); },
    dismiss: () => { if (!inFlight.current) { failedTask.current = null; setFeedback(null); } },
    failOnce: () => { failNext.current = true; setSheet(null); }, reset,
  };
}
const Context = createContext<ReturnType<typeof usePrototypeState> | null>(null);
export function PrototypeProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={usePrototypeState()}>{children}</Context.Provider>;
}
export function useMoa() {
  const value = useContext(Context);
  if (!value) throw new Error('PrototypeProvider is required');
  return value;
}
