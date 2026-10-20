import type { Todo, Event, WeeklyGoal, MonthlyGoal, TodoTimeBlock, Tag } from '../../app/store';
export const TODAY = '2026-10-20';
export const MONDAY = '2026-10-19';
export const WEEK = '2026-W43';
export const categories = [
  { id: 'work', name: '업무', color: '#a283b3', trackTime: true },
  { id: 'life', name: '라이프', color: '#759777', trackTime: true },
  { id: 'personal', name: '개인 프로젝트', color: '#b48755', trackTime: true },
] satisfies Tag[];
export const monthlyGoals: MonthlyGoal[] = [
  { id: 'month-mine', text: '내 속도로, 단단한 일상 만들기', month: '2026-10' },
];
export const weeklyGoals: WeeklyGoal[] = [
  { id: 'week-work', text: '작은 아이디어를 한 걸음 앞으로', weekKey: WEEK, monthlyGoalId: 'month-mine', done: false },
  { id: 'week-life', text: '나를 돌보는 시간을 챙기기', weekKey: WEEK, monthlyGoalId: 'month-mine', done: false },
];
export const initialTodos: Todo[] = [
  { id: 'todo-design', text: '모아모아 홈 아이디어 정리', date: TODAY, status: 'active', isTop3: true, tags: ['work'], weeklyGoalId: 'week-work', planStart: '09:00', planEnd: '10:00' },
  { id: 'todo-walk', text: '점심 먹고 동네 한 바퀴', date: TODAY, status: 'done', isTop3: true, tags: ['life'], weeklyGoalId: 'week-life', planStart: '12:30', planEnd: '13:00' },
  { id: 'todo-read', text: '책 20쪽, 천천히 읽기', date: TODAY, status: 'active', isTop3: true, tags: ['personal'], planStart: '20:00', planEnd: '20:40' },
  { id: 'todo-share', text: '아이디어 한 장으로 공유하기', date: '2026-10-21', status: 'active', isTop3: false, tags: ['work'], weeklyGoalId: 'week-work', planStart: '14:00', planEnd: '15:00' },
  { id: 'todo-undated', text: '다음 아이디어 자료 모으기', date: null, status: 'active', isTop3: false, tags: ['work'], weeklyGoalId: 'week-work' },
  { id: 'todo-stretch', text: '가볍게 몸 풀기', date: '2026-10-23', status: 'active', isTop3: false, tags: ['life'], weeklyGoalId: 'week-life', planStart: '18:00', planEnd: '18:20' },
  { id: 'todo-outline', text: '이번 주 작은 계획 세우기', date: MONDAY, status: 'done', isTop3: false, tags: ['work'], weeklyGoalId: 'week-work', planStart: '10:00', planEnd: '10:30' },
  { id: 'todo-inbox', text: '새로 생긴 동네 책방 가보기', date: null, status: 'active', isTop3: false, tags: ['life'] },
];
export const initialEvents: Event[] = [
  { id: 'event-checkin', title: '팀 체크인', date: TODAY, startTime: '10:30', endTime: '11:15', doStart: '10:35', doEnd: '11:05', tags: ['work'] },
  { id: 'event-coffee', title: '친구와 커피 한 잔', date: '2026-10-22', startTime: '15:00', endTime: '16:00', tags: ['life'] },
  { id: 'event-quiet', title: '나에게 남겨 둔 시간', date: '2026-10-24', startTime: '11:00', endTime: '12:00', tags: ['personal'] },
];
export const initialBlocks: TodoTimeBlock[] = [
  { id: 'block-design', todoId: 'todo-design', date: TODAY, start: '09:05', end: '09:50', elapsedSec: 45 * 60 },
  { id: 'block-walk', todoId: 'todo-walk', date: TODAY, start: '12:35', end: '12:55', elapsedSec: 20 * 60 },
  { id: 'block-read', todoId: 'todo-read', date: TODAY, start: '20:00', end: '20:30', elapsedSec: 30 * 60 },
  { id: 'block-outline', todoId: 'todo-outline', date: MONDAY, start: '10:05', end: '10:30', elapsedSec: 25 * 60 },
];
export const initialHabits = [
  { id: 'habit-water', name: '물 한 잔', icon: '◌', dates: [MONDAY, TODAY] },
  { id: 'habit-book', name: '책 펼치기', icon: '▤', dates: [MONDAY] },
  { id: 'habit-rest', name: '잠깐 쉬기', icon: '☁', dates: [TODAY] },
];
// Calendar-only formatting is kept local. Goal and actual-time calculations are shared with STEP 1/2.
export const addDate = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dayNumber = (date: string) => Number(date.slice(-2));
export const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
export const shortDuration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${Math.round(minutes % 60)}분` : ''}` : `${Math.round(minutes)}분`;
