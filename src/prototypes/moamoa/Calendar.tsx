import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Feather, LayoutGrid, ListTodo, Sprout } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useMoa } from './PrototypeState';
import { AddButton, Card, EmptyNote, GoalRow, SectionTitle, TodoRow } from './ui';
import { TODAY, MONDAY, addDate, dayNames, dayNumber, categories, shortDuration } from './sample';

export function Calendar() {
  const { period, view, navigate, weekStart, weekEnd, weekOffset, moveWeek, selectedDay, setSelectedDay } = useMoa();
  const month = selectedDay.slice(0, 7);
  const changePeriod = (next: 'month' | 'week' | 'day') => navigate('calendar', { period: next });
  const shift = (delta: number) => {
    if (period === 'week') { moveWeek(weekOffset + delta); return; }
    if (period === 'day') { setSelectedDay(addDate(selectedDay, delta)); return; }
    const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + delta);
    setSelectedDay(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };
  const periodTitle = period === 'month' ? `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`
    : period === 'day' ? `${Number(selectedDay.slice(5, 7))}월 ${dayNumber(selectedDay)}일`
    : `${Number(weekStart.slice(5, 7))}월 ${dayNumber(weekStart)}일 — ${Number(weekEnd.slice(5, 7))}월 ${dayNumber(weekEnd)}일`;
  return <>
    <div className="mo-page-heading"><div><p className="mo-eyebrow">MY DAYS, ON PAPER</p><h1>나의 한 주를 펼쳐요</h1><p>시간을 계획하고, 일상의 여백도 남겨두어요.</p></div>
      <div className="mo-segment" aria-label="캘린더 기간">{(['month', 'week', 'day'] as const).map((item, i) => <button key={item} aria-pressed={period === item} onClick={() => changePeriod(item)}>{['월간', '주간', '일간'][i]}</button>)}</div>
    </div>
    <div className="mo-calendar-toolbar"><div className="mo-period-picker"><button className="mo-icon-button" aria-label="이전 기간" onClick={() => shift(-1)}><ChevronLeft size={19} /></button><h2>{periodTitle}</h2><button className="mo-icon-button" aria-label="다음 기간" onClick={() => shift(1)}><ChevronRight size={19} /></button><button className="mo-today-button" onClick={() => { moveWeek(0); setSelectedDay(TODAY); }}>오늘</button></div>
      {period === 'week' && <div className="mo-view-switch" aria-label="주간 보기"><button aria-pressed={view === 'schedule'} onClick={() => navigate('calendar', { view: 'schedule' })}><CalendarDays size={16} />주간 일정</button><button aria-pressed={view === 'planner'} onClick={() => navigate('calendar', { view: 'planner' })}><LayoutGrid size={16} />주간 플래너</button></div>}
    </div>
    {period === 'month' ? <MonthCalendar /> : period === 'week' && view === 'planner' ? <WeeklyPlanner /> : <Schedule daily={period === 'day'} />}
  </>;
}
function DaySelector() {
  const { days, selectedDay, setSelectedDay, todos } = useMoa();
  return <div className="mo-day-selector" aria-label="요일 선택">{days.map((date, index) => <button key={date} aria-pressed={selectedDay === date} onClick={() => setSelectedDay(date)}>
    <span>{dayNames[index]}</span><strong>{dayNumber(date)}</strong><i className={todos.some(todo => todo.date === date) ? 'mo-has-plans' : ''} />
  </button>)}</div>;
}
function Schedule({ daily = false }: { daily?: boolean }) {
  const { days, selectedDay, todos, events, blocks, setSheet, timeReport } = useMoa();
  const visibleDays = daily ? [selectedDay] : days;
  const report = timeReport(daily ? selectedDay : days[0], daily ? selectedDay : days[6]);
  const position = (start: string, end?: string) => {
    const mins = (value: string) => Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]);
    return { top: (mins(start) - 8 * 60) / 60 * 48, height: Math.max(26, ((end ? mins(end) : mins(start) + 30) - mins(start)) / 60 * 48) };
  };
  return <Card className={`mo-schedule-card ${daily ? 'mo-daily-schedule' : ''}`}>
    {!daily && <div className="mo-only-mobile"><DaySelector /></div>}
    <div className="mo-schedule-note"><span><i className="mo-legend-plan" />계획</span><span><i className="mo-legend-actual" />실제 활동</span><small>일정을 누르면 날짜와 시간을 옮길 수 있어요.</small></div>
    <div className="mo-timegrid" style={{ '--mo-day-count': visibleDays.length } as React.CSSProperties}>
      <div className="mo-time-rail"><div className="mo-time-rail-head">시간</div>{Array.from({ length: 14 }, (_, index) => <span key={index}>{String(index + 8).padStart(2, '0')}:00</span>)}</div>
      {visibleDays.map(date => <div key={date} className={`mo-time-day ${date === selectedDay ? 'mo-selected-day' : ''} ${date === TODAY ? 'mo-is-today' : ''}`}>
        <div className="mo-time-day-head"><span>{dayNames[(new Date(`${date}T12:00:00`).getDay() + 6) % 7]} <b>{dayNumber(date)}</b></span><div><small>PLAN</small><small>DO</small></div></div>
        <div className="mo-time-day-body">
          {Array.from({ length: 14 }, (_, index) => <span key={index} className="mo-hour-line" style={{ top: index * 48 }} />)}
          {todos.filter(todo => todo.date === date && todo.planStart).map(todo => <button className="mo-schedule-block mo-plan-block" data-lane="plan" key={todo.id} title={`${todo.planStart} ${todo.text}`} onClick={() => setSheet({ kind: 'edit', recordKind: 'todo', id: todo.id })} style={{ ...position(todo.planStart!, todo.planEnd), '--mo-category': categories.find(c => todo.tags?.includes(c.id))?.color } as React.CSSProperties}>
            <small>{todo.planStart}</small><span>{todo.text}</span></button>)}
          {events.filter(event => event.date === date && event.startTime).map(event => <button className="mo-schedule-block mo-plan-block" data-lane="plan" key={event.id} title={`${event.startTime} ${event.title}`} onClick={() => setSheet({ kind: 'edit', recordKind: 'event', id: event.id })} style={{ ...position(event.startTime!, event.endTime), '--mo-category': categories.find(c => event.tags?.includes(c.id))?.color } as React.CSSProperties}>
            <small>{event.startTime}</small><span>{event.title}</span></button>)}
          {blocks.filter(block => block.date === date && block.start).map(block => <div className="mo-schedule-block mo-actual-block" data-lane="actual" key={block.id} title={`${todos.find(todo => todo.id === block.todoId)?.text} · ${Math.round(block.elapsedSec / 60)}분`} style={position(block.start!, block.end)}><small>{block.start}</small><span>{todos.find(todo => todo.id === block.todoId)?.text}</span><b>{Math.round(block.elapsedSec / 60)}분</b></div>)}
          {events.filter(event => event.date === date && event.doStart && event.doEnd).map(event => <div className="mo-schedule-block mo-actual-block" data-lane="actual" key={`${event.id}-actual`} title={`${event.title} · 실제 ${event.doStart}–${event.doEnd}`} style={position(event.doStart!, event.doEnd)}><small>{event.doStart}</small><span>{event.title}</span></div>)}
        </div>
      </div>)}
    </div>
    <div className="mo-schedule-footer"><span><Clock3 size={16} />이 기간에 모은 시간 <b>{shortDuration(report.coverage.recordedMinutes)}</b></span><small>계획은 실제 시간에 포함하지 않아요.</small></div>
  </Card>;
}
export function WeeklyPlanner() {
  const { days, selectedDay, goals, weekTodos, events, weekStart, weekEnd, timeReport, setSheet } = useMoa();
  const undated = weekTodos.filter(todo => !todo.date);
  const report = timeReport(weekStart, weekEnd);
  return <div className="mo-planner-layout">
    <div className="mo-planner-goals">
      <Card className="mo-planner-goal-card"><SectionTitle eyebrow="THIS WEEK'S INTENTION" title="이번 주에 모을 것" />{goals.length ? goals.map(goal => <GoalRow key={goal.id} goal={goal} compact />) : <EmptyNote>아직 정하지 않은 주도 괜찮아요.</EmptyNote>}</Card>
      <Card className="mo-undated-card"><SectionTitle title="날짜는 천천히" /><p className="mo-section-hint">주간 목표에 연결된 날짜 미정 할 일</p>{undated.map(todo => <TodoRow key={todo.id} todo={todo} detail />)}{!undated.length && <EmptyNote>떠오르는 일은 여기에 모아두어요.</EmptyNote>}<AddButton date={null} /></Card>
      <Card className="mo-week-time-card"><span className="mo-eyebrow">이번 주 모은 시간</span><strong>{shortDuration(report.coverage.recordedMinutes)}</strong><small>계획과 별도로 쌓인 실제 시간</small><button className="mo-text-button" onClick={() => setSheet('review-week')}>한 주 돌아보기<Feather size={15} /></button></Card>
    </div>
    <div className="mo-week-paper"><div className="mo-only-mobile"><DaySelector /></div><div className="mo-paper-title"><span><ListTodo size={16} />요일별 작은 계획</span><span>비어 있는 날도 내 하루예요.</span></div>
      <div className="mo-week-days">{days.map((date, index) => <Card key={date} className={`mo-day-card ${date === selectedDay ? 'mo-selected-day' : ''} ${date === TODAY ? 'mo-is-today' : ''}`}>
        <header><span>{dayNames[index]}<b>{dayNumber(date)}</b></span>{date === TODAY && <small>오늘</small>}</header>
        {events.filter(event => event.date === date).map(event => <button className="mo-planner-event" key={event.id} title={`${event.startTime} ${event.title}`} onClick={() => setSheet({ kind: 'edit', recordKind: 'event', id: event.id })}><span>{event.startTime}</span>{event.title}</button>)}
        {weekTodos.filter(todo => todo.date === date).map(todo => <TodoRow key={todo.id} todo={todo} />)}
        {!weekTodos.some(todo => todo.date === date) && !events.some(event => event.date === date) && <p className="mo-day-empty">여백을 남겨둔 하루</p>}
        <AddButton label="작은 계획 더하기" date={date} />
      </Card>)}<div className="mo-week-paper-note"><Sprout size={29} /><strong>모든 칸을 채우지 않아도</strong><span>충분히 좋은 한 주예요.</span><span className="mo-hand-line" /></div></div>
      <details className="mo-all-week-todos"><summary>이번 주 전체 할 일 <b>{weekTodos.length}</b><ChevronRight size={15} /></summary><div>{weekTodos.map(todo => <TodoRow key={todo.id} todo={todo} detail />)}</div></details>
    </div>
    <HabitGrid />
    <button className="mo-reflection mo-planner-reflection" onClick={() => setSheet('review-week')}><Feather size={23} /><span><strong>이번 주, 어떤 순간을 모았나요?</strong><small>주간 회고를 한 줄부터 시작해요.</small></span><ChevronRight size={18} /></button>
  </div>;
}
function HabitGrid() {
  const { habits, days, toggleHabit, busy } = useMoa();
  return <Card className="mo-habits-card"><SectionTitle eyebrow="SMALL DAILY RITUALS" title="나를 돌보는 작은 습관" /><div className="mo-habit-grid" role="group" aria-label="주간 습관 트래커"><span />{dayNames.map(name => <small key={name}>{name}</small>)}
    {habits.map(habit => <div className="mo-habit-row" key={habit.id}><span>{habit.icon} {habit.name}</span>{days.map(date => <button key={date} aria-label={`${habit.name} ${date}`} aria-pressed={habit.dates.includes(date)} disabled={busy || date > TODAY} onClick={() => toggleHabit(habit.id, date)}>{habit.dates.includes(date) ? '✓' : '·'}</button>)}</div>)}
  </div><small className="mo-muted">빈칸은 실패가 아니라, 다음에 챙길 여백이에요.</small></Card>;
}
function MonthCalendar() {
  const { selectedDay, setSelectedDay, moveWeek, navigate, todos, events } = useMoa();
  const first = `${selectedDay.slice(0, 7)}-01`;
  const leading = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const monthDate = new Date(`${first}T12:00:00`);
  const count = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const dates = Array.from({ length: Math.ceil((count + leading) / 7) * 7 }, (_, i) => addDate(first, i - leading));
  const choose = (date: string) => { moveWeek(Math.floor(differenceInCalendarDays(parseISO(date), parseISO(MONDAY)) / 7)); setSelectedDay(date); navigate('calendar', { period: 'day' }); };
  return <Card className="mo-month-card"><div className="mo-month-weekdays">{dayNames.map(name => <span key={name}>{name}</span>)}</div><div className="mo-month-grid">{dates.map(date => <button className={`${date === TODAY ? 'mo-is-today' : ''} ${date.slice(0, 7) !== first.slice(0, 7) ? 'mo-other-month' : ''}`} key={date} aria-label={`${date} 일간 보기`} onClick={() => choose(date)}><b>{dayNumber(date)}</b>{events.filter(event => event.date === date).map(event => <small key={event.id} className="mo-month-event">{event.title}</small>)}{todos.filter(todo => todo.date === date).slice(0, 2).map(todo => <small key={todo.id}>{todo.status === 'done' ? '✓' : '·'} {todo.text}</small>)}{todos.filter(todo => todo.date === date).length + events.filter(event => event.date === date).length > 0 && <span className="mo-month-count">· {todos.filter(todo => todo.date === date).length + events.filter(event => event.date === date).length}개</span>}</button>)}</div><p className="mo-section-hint">날짜를 누르면 일간 계획으로 이어져요.</p></Card>;
}
