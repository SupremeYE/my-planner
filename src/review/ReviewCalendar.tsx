import {CalendarTimeline,type CalendarDay} from '../app/components/moamoa/CalendarTimeline';
import {PlanEditor} from '../app/components/moamoa/CalendarPlanEditor';
import {useCalendarPlans} from '../app/hooks/useCalendarPlans';
import type {PlanRow,PlanTable} from '../lib/calendarPlanRepository';
import {controls} from '../../scripts/test/fixtures/moa-today-supabase';
import '../app/components/moamoa/calendarPlan.css';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { addDays, addMonths, addWeeks, format, parseISO, startOfISOWeek, startOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, LayoutGrid } from 'lucide-react';
import { usePlanner, type Todo } from '../app/store';
import { moaTodayData, moaMinutes } from '../lib/moaToday';
import { aggregateActivity } from '../lib/timeAggregation';
import { completionMarkerPatch } from '../lib/todoDoDuration';
import { getWeekKey } from '../lib/weekKeys';
import { ReviewWeeklyReview } from './ReviewWeeklyReview';
import { useMoaToday } from '../app/components/moamoa/moaShared';
import { MoaFrame } from './ReviewFrame';
import './calendarGarden.css';

const stamp = (date: Date) => format(date, 'yyyy-MM-dd');
const dayLabel = (date: string) => format(parseISO(date), 'M.d E', { locale: ko });
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
export function Component() {
  const p = usePlanner(); const today = useMoaToday(p.dayEndHour);
  const [query, setQuery] = useSearchParams();
  const period = ['day','week','month'].includes(query.get('period') ?? '') ? query.get('period')! : 'week';
  const planner = query.get('view') === 'planner';
  const [picked, setPicked] = useState<string | null>(()=>p.selectedDate===today?null:p.selectedDate); const date = picked ?? today;
  const [editing,setEditing]=useState<{table:PlanTable;row?:PlanRow;date:string;time?:string}|null>(null);
  const [failure,setFailure]=useState('');
  const monday = startOfISOWeek(parseISO(date));
  const days = Array.from({ length:7 }, (_,i) => stamp(addDays(monday,i)));
  const monthlyStart = startOfISOWeek(startOfMonth(parseISO(date)));
  const monthDays = Array.from({ length:42 }, (_,i) => stamp(addDays(monthlyStart,i)));
  const weekKey = getWeekKey(monday);
  const planTodos=useCalendarPlans('todos'),planEvents=useCalendarPlans('events',period==='day'?date:period==='month'?monthDays[0]:days[0],period==='day'?date:period==='month'?monthDays[41]:days[6]);
  const day = (value: string) => moaTodayData(value,p.todos,p.weeklyGoals,p.events,p.tags,p.timeBlocks,p.activityEntries,p.reportEvents);
  const week = day(days[0]);
  const actual = aggregateActivity(p.todos,p.reportEvents,p.tags,period === 'day' ? date : days[0],period === 'day' ? date : days[6],p.timeBlocks,p.activityEntries);
  const undated = p.todos.filter(t => !t.date && t.status !== 'cancelled' && t.status !== 'backlog');
  const weekUndated = undated.filter(t => week.weeks.some(w => w.goal.id === t.weeklyGoalId));
  const otherUndated = undated.filter(t => !weekUndated.includes(t));
  const visibleDays = period === 'day' ? [date] : days;
  function pick(value:string){setPicked(value);p.setSelectedDate(value);}
  function shift(direction: number) {
    const parsed = parseISO(date);
    pick(stamp(period === 'month' ? addMonths(parsed,direction) : period === 'week' ? addWeeks(parsed,direction) : addDays(parsed,direction)));
  }
  const periodLabel = period === 'month' ? format(parseISO(date),'yyyy년 M월') : period === 'day' ? format(parseISO(date),'yyyy년 M월 d일 EEEE',{locale:ko}) : `${dayLabel(days[0])} — ${dayLabel(days[6])}`;
  const openPlan=(table:PlanTable,id?:string,day=date,time?:string,title='')=>{
    const source=id?(table==='todos'?planTodos:planEvents).records.find(r=>r.id===id):undefined;
    setEditing({table,row:id?source??{id,recurrence_parent_id:'virtual',text:title}:undefined,date:day,time});
  };
  const timelineDays:CalendarDay[]=visibleDays.map(value=>{const model=day(value);return {date:value,entries:[
    ...model.dayTodos.map(t=>({key:`todo:${t.id}`,title:t.text,date:value,kind:'plan' as const,start:t.planStart,end:t.planEnd,edit:()=>openPlan('todos',t.id,value,undefined,t.text)})),
    ...model.dayEvents.map(e=>({key:`event:${e.id}`,title:e.title,date:value,kind:'plan' as const,start:e.startTime,end:e.endTime,all:!!e.isAllDay,edit:()=>openPlan('events',e.sourceEventId??e.id,value,undefined,e.title)})),
    ...actual.records.filter(r=>r.date===value).map(r=>({key:`actual:${r.kind}:${r.id}`,title:r.name,date:value,kind:'actual' as const,start:r.start,end:r.end,minutes:r.minutes})),
    ...actual.coverage.unresolvedItems.filter(r=>r.date===value).map(r=>({key:`unresolved:${r.kind}:${r.id}`,title:`${r.name} · 시각 확인 필요`,date:value,kind:'actual' as const})),
  ]};});
  return <MoaFrame pageTitle="캘린더" onQuick={()=>openPlan('todos')} quickDisabled={p.isLoading||!!planTodos.error||!!planEvents.error}>
    <div className="mx-page-heading rc-heading"><div><h1>캘린더</h1><p>날짜별 일정과 할 일, 실제 활동 시간을 확인해요.</p></div><div className="mx-tabs" role="group" aria-label="캘린더 기간">{[['month','월간'],['week','주간'],['day','일간']].map(([id,label]) => <button key={id} aria-pressed={period === id} onClick={() => setQuery({period:id,...(planner?{view:'planner'}:{})})}>{label}</button>)}</div></div>
    <div className="rc-toolbar"><div className="rc-period"><button aria-label="이전 기간" onClick={() => shift(-1)}><ChevronLeft size={19}/></button><h2>{periodLabel}</h2><button aria-label="다음 기간" onClick={() => shift(1)}><ChevronRight size={19}/></button><button onClick={() => {setPicked(null);p.setSelectedDate(today);}}>오늘</button><input type="date" aria-label="캘린더 날짜" value={date} onChange={e => e.target.value && pick(e.target.value)}/></div>{period === 'week' && <div className="rc-view" role="group" aria-label="주간 보기"><button aria-pressed={!planner} onClick={() => setQuery({period:'week',view:'schedule'})}><CalendarDays size={16}/>주간 일정</button><button aria-pressed={planner} onClick={() => setQuery({period:'week',view:'planner'})}><LayoutGrid size={16}/>주간 플래너</button></div>}</div>
    <div className="rp-actions"><button disabled={p.isLoading||!!planEvents.error} onClick={()=>openPlan('events')}>일정 추가</button><button disabled={p.isLoading||!!planTodos.error} onClick={()=>openPlan('todos')}>할 일 추가·빠른 입력</button><details><summary>샘플 저장 실패 체험</summary><button onClick={()=>{controls.failNext('todos',{status:503});setFailure('다음 할 일 저장에서 오류를 체험할 수 있어요.');}}>다음 할 일 저장 실패</button><button onClick={()=>{controls.failNext('events',{status:503,afterCommit:true});setFailure('다음 일정의 응답이 유실돼도 저장 결과를 재확인해요.');}}>다음 일정 응답 유실</button><p role="status">{failure}</p></details></div>
    {(planTodos.error||planEvents.error)&&<p role="alert">{planTodos.error||planEvents.error}<button onClick={()=>{void planTodos.refresh();void planEvents.refresh();}}>다시 조회</button></p>}
    <p className="rc-read-note">PLAN은 샘플 메모리에만 저장돼요. DO는 읽기 전용이며 새로고침하면 초기화돼요.</p>
    {p.isLoading ? <p role="status">한 주를 불러오고 있어요.</p> : period === 'month' ? <section className="mt-card rc-month" aria-label="월간 캘린더"><div className="rc-month-labels">{['월','화','수','목','금','토','일'].map(v => <b key={v}>{v}</b>)}</div><div className="rc-month-grid">{monthDays.map(value => {const model = day(value); return <button key={value} className={`${value.slice(0,7) !== date.slice(0,7) ? 'rc-outside' : ''} ${value === today ? 'rc-today' : ''}`} aria-label={`${value} 일간 보기`} onClick={() => {pick(value);setQuery({period:'day'});}}><time>{Number(value.slice(8))}</time>{model.dayEvents.slice(0,1).map(e => <span key={e.id} className="rc-month-event" title={e.title}>{e.title}</span>)}{model.dayTodos.length > 0 && <small>할 일 {model.dayTodos.length}개</small>}</button>;})}</div><p className="mx-help">날짜를 누르면 일간 보기로 이어져요.</p></section>
    : period === 'week' && planner ? <div className="rc-planner" aria-label="주간 플래너">
      <div className="rc-week-top"><section className="mt-card"><h2>이번 주 목표</h2>{week.weeks.length ? week.weeks.map(({goal,progress}) => <div className="rc-goal" key={goal.id} data-goal-id={goal.id} data-goal-progress={progress.pct}><div><strong>{goal.text}</strong><b>{progress.pct}%</b></div><progress max="100" value={progress.pct} aria-label={`${goal.text} 진행률`}/><small>{progress.mode === 'manual' ? '수동 완료 기준' : `연결 할 일 ${progress.done}/${progress.total}개`}</small></div>) : <p className="mt-empty">이번 주에 연결된 목표가 없어요.</p>}<Link className="mr-inline-link" to="/profile">월간·연간 목표 보기</Link></section>
      <section className="mt-card"><h2>날짜 미정 할 일</h2><p className="mx-help">이번 주 목표와 연결된 할 일</p>{weekUndated.map(t => <ReviewTodoRow key={t.id} todo={t}/>)}{!weekUndated.length && <p className="mt-empty">연결된 날짜 미정 할 일이 없어요.</p>}<details><summary>그 외 날짜 미정 {otherUndated.length}개</summary><p className="mx-help">날짜를 정하지 않아 특정 요일에 표시하지 않아요.</p>{otherUndated.map(t => <ReviewTodoRow key={t.id} todo={t}/>)}</details></section>
      <section className="mt-card rc-week-time"><Clock3 size={22}/><h2>이번 주 실제 활동 시간</h2><strong className="mt-duration" data-calendar-minutes={actual.coverage.recordedMinutes}>{moaMinutes(actual.coverage.recordedMinutes)}</strong><p className="mx-help">직접 기록한 활동 시간</p><Link className="mr-inline-link" to="/__moamoa-records">시간 분석</Link><ReviewWeeklyReview days={days} weekKey={weekKey} week={week} actual={actual} /></section></div>
      <section className="rc-week-days" aria-label="요일별 할 일과 일정">{days.map(value => {const model = day(value);return <article className={`mt-card ${value === today ? 'rc-today' : ''}`} key={value}><h2>{dayLabel(value)}</h2>{model.dayEvents.map(e => <p className="rc-event-summary" key={e.id}><small>{e.isAllDay ? '종일' : e.startTime ?? '시간 미정'} · 계획</small>{e.title}</p>)}{model.dayTodos.map(t => <ReviewTodoRow key={t.id} todo={t}/>)}{!model.dayEvents.length && !model.dayTodos.length && <p className="mt-empty">등록한 일정과 할 일이 없어요.</p>}</article>;})}</section>
      <section className="mt-card"><h2>이번 주 습관 기록</h2><p className="mx-help">습관 기록을 확인할 수 있어요. 습관 수정·체크는 아직 지원하지 않아요.</p><div className="rc-habits"><table><thead><tr><th scope="col">습관</th>{days.map(value => <th scope="col" key={value}>{dayLabel(value)}</th>)}</tr></thead><tbody>{p.habits.map(h => <tr key={h.id}><th scope="row">{h.name}</th>{days.map(value => <td key={value} aria-label={`${value} ${h.checkedDates.includes(value) ? '완료' : '미기록'}`}>{h.checkedDates.includes(value) ? <Check size={17}/> : '·'}</td>)}</tr>)}</tbody></table>{!p.habits.length && <p className="mt-empty">아직 습관 기록이 없어요.</p>}</div></section>
    </div> : <section className="mt-card rc-schedule cp-page" aria-label={period === 'day' ? '일간 일정' : '주간 일정'}>
      {undated.length>0&&<details className="rp-undated"><summary>날짜 미정 할 일 {undated.length}개</summary>{undated.map(t=><button className="cp-item" key={t.id} onClick={()=>openPlan('todos',t.id,date,undefined,t.text)}>{t.text}</button>)}</details>}
      <CalendarTimeline days={timelineDays} selected={date} today={today} period={period} onSelect={pick} onAdd={(value,time)=>openPlan('todos',undefined,value,time)}/>
      <p className="mx-help rc-period-total">이 기간 실제 기록 {moaMinutes(actual.coverage.recordedMinutes)} · 계획은 합산하지 않아요. 자정을 지난 활동도 입력한 기록 날짜에 합산해요.</p>
    </section>}
    {editing&&<PlanEditor key={editing.row?.id??'new'} initial={editing} todos={planTodos} events={planEvents} onClose={()=>setEditing(null)}/>}
  </MoaFrame>;
}
