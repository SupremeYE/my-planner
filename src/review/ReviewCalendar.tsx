import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router';
import { addDays, addMonths, addWeeks, format, parseISO, startOfISOWeek, startOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Feather, LayoutGrid } from 'lucide-react';
import { usePlanner, type Todo } from '../app/store';
import { moaTodayData, moaMinutes } from '../lib/moaToday';
import { aggregateActivity, type ActivityRecord } from '../lib/timeAggregation';
import { completionMarkerPatch } from '../lib/todoDoDuration';
import { findWeekRecord, getWeekKey } from '../lib/weekKeys';
import { MoaDialog } from '../app/components/moamoa/MoaDialog';
import { useMoaToday } from '../app/components/moamoa/moaShared';
import { MoaFrame } from './ReviewFrame';
import { useReviewQuick, ReviewQuickSheet } from './ReviewQuick';
import './calendarGarden.css';

const stamp = (date: Date) => format(date, 'yyyy-MM-dd');
const dayLabel = (date: string) => format(parseISO(date), 'M.d E', { locale: ko });
function useCompactSchedule() {
  const [compact, setCompact] = useState(() => innerWidth < 1100);
  useEffect(() => { const query = matchMedia('(max-width:1099px)'); const update = () => setCompact(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return compact;
}
export function ReviewTodoRow({ todo }: { todo: Todo }) {
  const p = usePlanner();
  const [pending, setPending] = useState(false);
  const locked = pending || p.saveStates.some(s => s.status === 'saving' || s.status === 'error' && s.key.startsWith('todos:'));
  async function toggle() {
    if (locked) return;
    setPending(true);
    try {
      if (p.activeTimer?.todoId === todo.id) { p.finishActiveTimer(); return; }
      const status = todo.status === 'done' ? 'active' : 'done';
      await p.updateTodo(todo.id, { status, ...completionMarkerPatch(todo, status, format(new Date(), 'HH:mm')) });
    } finally { setPending(false); }
  }
  return <div className={`rc-todo ${todo.status === 'done' ? 'rc-done' : ''}`} data-todo-id={todo.id}>
    <button type="button" role="checkbox" aria-checked={todo.status === 'done'} aria-label={`${todo.text} 완료`} disabled={locked} onClick={() => void toggle()}><span>{todo.status === 'done' && <Check size={15} />}</span></button>
    <div><strong>{todo.text}</strong>{todo.planStart && <small>{todo.planStart}{todo.planEnd && `–${todo.planEnd}`} · 계획</small>}</div>
  </div>;
}
const clockMinute = (value?: string) => {
  if (!value) return null;
  if (/^\d{2}:\d{2}$/.test(value)) return Number(value.slice(0,2)) * 60 + Number(value.slice(3));
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getHours() * 60 + date.getMinutes() : null;
};
function position(start: number, minutes: number): CSSProperties {
  return { top: start / 60 * 48, height: Math.max(25, Math.min(minutes, 1440 - start) / 60 * 48) };
}
export function Component() {
  const p = usePlanner(); const today = useMoaToday(p.dayEndHour);
  const [query, setQuery] = useSearchParams();
  const period = ['day','week','month'].includes(query.get('period') ?? '') ? query.get('period')! : 'week';
  const planner = query.get('view') === 'planner';
  const [picked, setPicked] = useState<string | null>(null); const date = picked ?? today;
  const [review, setReview] = useState(false);
  const compact = useCompactSchedule(), quick = useReviewQuick();
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (gridRef.current) gridRef.current.scrollTop = 7 * 48; }, [date,period,planner,compact,p.isLoading]);
  const monday = startOfISOWeek(parseISO(date));
  const days = Array.from({ length:7 }, (_,i) => stamp(addDays(monday,i)));
  const weekKey = getWeekKey(monday);
  const day = (value: string) => moaTodayData(value,p.todos,p.weeklyGoals,p.events,p.tags,p.timeBlocks,p.activityEntries,p.reportEvents);
  const week = day(days[0]);
  const actual = aggregateActivity(p.todos,p.reportEvents,p.tags,period === 'day' ? date : days[0],period === 'day' ? date : days[6],p.timeBlocks,p.activityEntries);
  const undated = p.todos.filter(t => !t.date && t.status !== 'cancelled' && t.status !== 'backlog');
  const weekUndated = undated.filter(t => week.weeks.some(w => w.goal.id === t.weeklyGoalId));
  const otherUndated = undated.filter(t => !weekUndated.includes(t));
  const visibleDays = period === 'day' || compact ? [date] : days;
  const monthlyStart = startOfISOWeek(startOfMonth(parseISO(date)));
  const monthDays = Array.from({ length:42 }, (_,i) => stamp(addDays(monthlyStart,i)));
  const weeklyReview = findWeekRecord(p.weeklyReviews, weekKey);
  function shift(direction: number) {
    const parsed = parseISO(date);
    setPicked(stamp(period === 'month' ? addMonths(parsed,direction) : period === 'week' ? addWeeks(parsed,direction) : addDays(parsed,direction)));
  }
  const periodLabel = period === 'month' ? format(parseISO(date),'yyyy년 M월') : period === 'day' ? format(parseISO(date),'yyyy년 M월 d일 EEEE',{locale:ko}) : `${dayLabel(days[0])} — ${dayLabel(days[6])}`;
  function actualList(records: ActivityRecord[]) {
    return records.filter(r => clockMinute(r.start) === null).map(r => <div className="rc-duration" key={`${r.kind}:${r.id}`}><span>{r.name}</span><small>실제 {moaMinutes(r.minutes)} · 시각 없음</small></div>);
  }
  return <MoaFrame pageTitle="캘린더" onQuick={quick.open} quickDisabled={p.isLoading}>
    <div className="mx-page-heading rc-heading"><div><p className="mt-eyebrow">MY DAYS, ON PAPER</p><h1>캘린더</h1><p>시간을 계획하고, 일상의 여백도 남겨두어요.</p></div><div className="mx-tabs" role="group" aria-label="캘린더 기간">{[['month','월간'],['week','주간'],['day','일간']].map(([id,label]) => <button key={id} aria-pressed={period === id} onClick={() => setQuery({period:id,...(planner?{view:'planner'}:{})})}>{label}</button>)}</div></div>
    <div className="rc-toolbar"><div className="rc-period"><button aria-label="이전 기간" onClick={() => shift(-1)}><ChevronLeft size={19}/></button><h2>{periodLabel}</h2><button aria-label="다음 기간" onClick={() => shift(1)}><ChevronRight size={19}/></button><button onClick={() => setPicked(null)}>오늘</button><input type="date" aria-label="캘린더 날짜" value={date} onChange={e => e.target.value && setPicked(e.target.value)}/></div>{period === 'week' && <div className="rc-view" role="group" aria-label="주간 보기"><button aria-pressed={!planner} onClick={() => setQuery({period:'week',view:'schedule'})}><CalendarDays size={16}/>주간 일정</button><button aria-pressed={planner} onClick={() => setQuery({period:'week',view:'planner'})}><LayoutGrid size={16}/>주간 플래너</button></div>}</div>
    <p className="rc-read-note">일정 이동·편집은 이번 Preview에서 지원하지 않아요. 할 일 완료 체크와 빠른 기록은 같은 샘플 데이터에 반영돼요.</p>
    {p.isLoading ? <p role="status">한 주를 불러오고 있어요.</p> : period === 'month' ? <section className="mt-card rc-month" aria-label="월간 캘린더"><div className="rc-month-labels">{['월','화','수','목','금','토','일'].map(v => <b key={v}>{v}</b>)}</div><div className="rc-month-grid">{monthDays.map(value => {const model = day(value); return <button key={value} className={`${value.slice(0,7) !== date.slice(0,7) ? 'rc-outside' : ''} ${value === today ? 'rc-today' : ''}`} aria-label={`${value} 일간 보기`} onClick={() => {setPicked(value);setQuery({period:'day'});}}><time>{Number(value.slice(8))}</time>{model.dayEvents.slice(0,1).map(e => <span key={e.id} className="rc-month-event" title={e.title}>{e.title}</span>)}{model.dayTodos.length > 0 && <small>할 일 {model.dayTodos.length}개</small>}</button>;})}</div><p className="mx-help">날짜를 누르면 일간 보기로 이어져요.</p></section>
    : period === 'week' && planner ? <div className="rc-planner" aria-label="주간 플래너">
      <div className="rc-week-top"><section className="mt-card"><p className="mt-eyebrow">THIS WEEK'S INTENTION</p><h2>이번 주 목표</h2>{week.weeks.length ? week.weeks.map(({goal,progress}) => <div className="rc-goal" key={goal.id} data-goal-id={goal.id} data-goal-progress={progress.pct}><div><strong>{goal.text}</strong><b>{progress.pct}%</b></div><progress max="100" value={progress.pct} aria-label={`${goal.text} 진행률`}/><small>{progress.mode === 'manual' ? '수동 완료 기준' : `연결 할 일 ${progress.done}/${progress.total}개`}</small></div>) : <p className="mt-empty">이번 주에 연결된 목표가 없어요.</p>}<Link className="mr-inline-link" to="/profile">멀리 바라보는 목표</Link></section>
      <section className="mt-card"><h2>날짜 미정 할 일</h2><p className="mx-help">이번 주 목표와 연결된 할 일</p>{weekUndated.map(t => <ReviewTodoRow key={t.id} todo={t}/>)}{!weekUndated.length && <p className="mt-empty">연결된 날짜 미정 할 일이 없어요.</p>}<details><summary>그 외 날짜 미정 {otherUndated.length}개</summary><p className="mx-help">특정 주에 배정된 데이터는 아니에요.</p>{otherUndated.map(t => <ReviewTodoRow key={t.id} todo={t}/>)}</details></section>
      <section className="mt-card rc-week-time"><Clock3 size={22}/><h2>이번 주 모은 시간</h2><strong className="mt-duration" data-calendar-minutes={actual.coverage.recordedMinutes}>{moaMinutes(actual.coverage.recordedMinutes)}</strong><p className="mx-help">계획과 별도로 쌓인 실제 기록</p><Link className="mr-inline-link" to="/__moamoa-records">시간 분석</Link><button onClick={() => setReview(true)}><Feather size={17}/>주간 회고 열기</button></section></div>
      <section className="rc-week-days" aria-label="요일별 할 일과 일정">{days.map(value => {const model = day(value);return <article className={`mt-card ${value === today ? 'rc-today' : ''}`} key={value}><h2>{dayLabel(value)}</h2>{model.dayEvents.map(e => <p className="rc-event-summary" key={e.id}><small>{e.isAllDay ? '종일' : e.startTime ?? '시간 미정'} · 계획</small>{e.title}</p>)}{model.dayTodos.map(t => <ReviewTodoRow key={t.id} todo={t}/>)}{!model.dayEvents.length && !model.dayTodos.length && <p className="mt-empty">여유로운 하루</p>}</article>;})}</section>
      <section className="mt-card"><h2>한 주의 작은 습관</h2><p className="mx-help">조회 전용 · 습관 편집과 체크는 다음 단계에서 연결해요.</p><div className="rc-habits"><table><thead><tr><th scope="col">습관</th>{days.map(value => <th scope="col" key={value}>{dayLabel(value)}</th>)}</tr></thead><tbody>{p.habits.map(h => <tr key={h.id}><th scope="row">{h.name}</th>{days.map(value => <td key={value} aria-label={`${value} ${h.checkedDates.includes(value) ? '완료' : '미기록'}`}>{h.checkedDates.includes(value) ? <Check size={17}/> : '·'}</td>)}</tr>)}</tbody></table>{!p.habits.length && <p className="mt-empty">아직 습관 기록이 없어요.</p>}</div></section>
    </div> : <section className="mt-card rc-schedule" aria-label={period === 'day' ? '일간 일정' : '주간 일정'}>
      {period === 'week' && compact && <div className="rc-day-pick" aria-label="요일 선택">{days.map(value => <button key={value} aria-pressed={value === date} onClick={() => setPicked(value)}>{dayLabel(value)}</button>)}</div>}
      <div className="rc-legend"><span><i/>계획</span><span><i/>실제 활동</span><small>시각이 없는 실제 기록은 시간표 아래에 표시해요.</small></div>
      <div className="rc-grid-scroll" ref={gridRef}><div className="rc-timegrid" style={{'--rc-days':visibleDays.length} as CSSProperties}><div className="rc-rail"><div>시간</div>{Array.from({length:24},(_,h) => <time key={h}>{String(h).padStart(2,'0')}:00</time>)}</div>{visibleDays.map(value => {const model=day(value), records=actual.records.filter(r => r.date === value);return <div className="rc-time-day" key={value}><header><strong>{dayLabel(value)}</strong><div><small>계획</small><small>실제</small></div></header><div className="rc-time-body">
        {model.dayTodos.filter(t => t.planStart).map(t => <div className="rc-time-block rc-plan" key={`todo:${t.id}`} title={`${t.text} · 계획 ${t.planStart}`} style={position(clockMinute(t.planStart)!,Math.max(30,(clockMinute(t.planEnd) ?? clockMinute(t.planStart)!+30)-clockMinute(t.planStart)!))}><small>{t.planStart}</small>{t.text}</div>)}
        {model.dayEvents.filter(e => !e.isAllDay && e.startTime).map(e => <div className="rc-time-block rc-plan" key={`event:${e.id}`} title={`${e.title} · 계획 ${e.startTime}`} style={position(clockMinute(e.startTime)!,Math.max(30,(clockMinute(e.endTime) ?? clockMinute(e.startTime)!+30)-clockMinute(e.startTime)!))}><small>{e.startTime}</small>{e.title}</div>)}
        {records.filter(r => clockMinute(r.start) !== null).map(r => <div className="rc-time-block rc-actual" key={`${r.kind}:${r.id}`} style={position(clockMinute(r.start)!,r.minutes)} title={`${r.name} · 실제 ${moaMinutes(r.minutes)}`}><small>{moaMinutes(r.minutes)}</small>{r.name}</div>)}
      </div><div className="rc-untimed">{model.dayEvents.filter(e => e.isAllDay || !e.startTime).map(e => <p key={e.id}>{e.isAllDay?'종일':'시간 미정'} · {e.title}</p>)}{model.dayTodos.filter(t => !t.planStart).map(t => <ReviewTodoRow key={t.id} todo={t}/>)}{actualList(records)}</div></div>;})}</div></div>
      <p className="mx-help">이 기간 실제 기록 {moaMinutes(actual.coverage.recordedMinutes)} · 계획은 합산하지 않아요. 자정 전후 기록은 기존 집계의 기록 날짜를 유지해요.</p>
    </section>}
    {review && <MoaDialog title="주간 회고" description={`${days[0]} — ${days[6]} · 조회 전용`} onClose={() => setReview(false)} saveKeys={[]} footer={<button className="mx-primary" onClick={() => setReview(false)}>닫기</button>}><p>주간 회고 입력·편집은 이번 Preview에서 지원하지 않아요.</p><p>이번 주 실제 기록 {moaMinutes(actual.coverage.recordedMinutes)}</p><p>{weeklyReview?.highlights || '아직 남긴 주간 회고가 없어요. 비워둔 주도 괜찮아요.'}</p></MoaDialog>}
    <ReviewQuickSheet {...quick}/>
  </MoaFrame>;
}
