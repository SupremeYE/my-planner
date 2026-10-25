import { useMemo, useState } from 'react';
import { addDays, addWeeks, format, parseISO, startOfISOWeek } from 'date-fns';
import { usePlanner, getLogicalToday, type WeeklyReview } from '../../store';
import { useWeeklyReviews } from '../../hooks/useWeeklyReviews';
import { findWeekRecord, getWeekKey, weekKeysMatch, weekKeyToMonday } from '../../../lib/weekKeys';
import { moaTodayData, moaMinutes } from '../../../lib/moaToday';
import { aggregateActivity } from '../../../lib/timeAggregation';
import { MoaFrame } from './MoaFrame';
import { MoaActivitySheet } from './MoaActivitySheet';
import { WeeklyReviewEditor } from './weekly/WeeklyReviewEditor';
import './todos.css';
import './weekly/weekly.css';

/** Development-only integration surface. Preview routes and production navigation stay unchanged. */
export function Component() {
  const planner = usePlanner(), controller = useWeeklyReviews();
  const [anchor, setAnchor] = useState(() => getLogicalToday());
  const [editing, setEditing] = useState<{ record?: WeeklyReview } | null>(null);
  const [notice, setNotice] = useState('');
  const [quick, setQuick] = useState(false);
  const monday = startOfISOWeek(parseISO(anchor)), start = format(monday, 'yyyy-MM-dd'), end = format(addDays(monday, 6), 'yyyy-MM-dd');
  const weekKey = getWeekKey(monday), period = `${format(monday, 'yyyy.MM.dd')} (월) ~ ${format(addDays(monday, 6), 'yyyy.MM.dd')} (일)`;
  const model = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = format(addDays(parseISO(start), index), 'yyyy-MM-dd');
      return { date, ...moaTodayData(date, planner.todos, planner.weeklyGoals, planner.events, planner.tags, planner.timeBlocks, planner.activityEntries, planner.reportEvents) };
    });
    const done = new Set(days.flatMap(day => day.dayTodos.filter(todo => todo.status === 'done').map(todo => todo.id))).size;
    const actual = aggregateActivity(planner.todos, planner.reportEvents, planner.tags, start, end, planner.timeBlocks, planner.activityEntries);
    return { days, done, actual };
  }, [start, end, planner.todos, planner.weeklyGoals, planner.events, planner.tags, planner.timeBlocks, planner.activityEntries, planner.reportEvents]);
  const matching = controller.records.filter(row => weekKeysMatch(row.weekKey, weekKey));
  const current = findWeekRecord(controller.records, weekKey);
  const unavailable = controller.loading || !!controller.readError;
  const reference = <div className="mw-stats">
    <h3>이번 주 목표와 진행률</h3>
    {model.days[0].weeks.length ? model.days[0].weeks.map(({ goal, progress }) => <p key={goal.id} data-goal-progress={progress.pct}>{goal.text} <strong>{progress.pct}%</strong></p>) : <p>이번 주 목표가 없어요.</p>}
    <p>완료한 할 일 <strong data-completed-todos={model.done}>{model.done}개</strong></p><small>선택한 주에 날짜가 지정된 할 일 기준이에요. 기간 할 일은 한 번만 세어요.</small>
    <p>실제 기록한 활동 시간 <strong data-actual-minutes={model.actual.coverage.recordedMinutes}>{moaMinutes(model.actual.coverage.recordedMinutes)}</strong></p>
    {(planner.coreTimeReadError || planner.activityEventsError || planner.activityStorageError) && <p role="status">일부 활동 정보를 불러오지 못해 합계가 전체 기록과 다를 수 있어요.</p>}
    <h3>습관 체크 현황</h3>
    {planner.habits.length ? planner.habits.map(habit => <p key={habit.id}>{habit.name} <strong>{new Set(habit.checkedDates.filter(date => date >= start && date <= end)).size}일 체크</strong></p>) : <p>등록한 습관이 없어요.</p>}
  </div>;
  const open = (record?: WeeklyReview) => { if (!unavailable) { setNotice(''); setEditing({ record }); } };
  return <MoaFrame pageTitle="주간 플래너" onQuick={() => setQuick(true)}><div className="mw-planner">
    <section className="mt-card mw-heading"><h1>주간 플래너</h1><p>한 주의 기록을 살펴보고 회고를 작성해요.</p>
      <div className="mw-week-nav"><button aria-label="이전 주" onClick={() => { setAnchor(format(addWeeks(monday, -1), 'yyyy-MM-dd')); setNotice(''); }}>이전 주</button>
        <time dateTime={start}>{period}</time><button aria-label="다음 주" onClick={() => { setAnchor(format(addWeeks(monday, 1), 'yyyy-MM-dd')); setNotice(''); }}>다음 주</button></div>
      <label className="mw-date">주차 선택<input aria-label="주차 선택" type="date" value={anchor} onChange={event => { if (event.target.value) { setAnchor(event.target.value); setNotice(''); } }} /></label>
      <button className="mx-primary" disabled={unavailable} onClick={() => open(current)}>주간 회고</button>
      {controller.loading ? <p role="status">회고를 불러오고 있어요.</p> : controller.readError ? <div role="alert"><p>{controller.readError}</p><button onClick={() => void controller.refresh()}>회고 다시 불러오기</button></div> : <p>{current ? '작성한 회고를 읽고 수정할 수 있어요.' : '아직 작성한 회고가 없어요. 한 항목만 적어도 저장할 수 있어요.'}</p>}
      {notice && <p role="status">{notice}</p>}
      {matching.length > 1 && <div className="mw-collisions"><p>이 주차에 회고가 여러 개 있어요. 각각 확인하고 수정할 수 있으며 자동으로 합치지 않아요.</p>{matching.map((row, index) => <button disabled={unavailable} key={row.id} onClick={() => open(row)}>회고 {index + 1} · {row.weekKey}</button>)}</div>}
    </section>
    <section className="mt-card"><h2>회고에 참고할 정보</h2>{planner.isLoading ? <p>주간 정보를 불러오고 있어요.</p> : reference}</section>
    <section className="mt-card"><h2>이번 주 할 일</h2><div className="mw-days">{model.days.map(day => <article key={day.date}><h3>{format(parseISO(day.date), 'M.d')} · {['일', '월', '화', '수', '목', '금', '토'][parseISO(day.date).getDay()]}</h3>{day.dayTodos.length ? <ul>{day.dayTodos.map(todo => <li key={todo.id}>{todo.text} <small>{todo.status === 'done' ? '완료' : '미완료'}</small></li>)}</ul> : <p>등록한 할 일이 없어요.</p>}</article>)}</div></section>
    <section className="mt-card mw-history"><h2>이전 주간 회고</h2>{controller.records.length ? [...controller.records].sort((a, b) => (weekKeyToMonday(b.weekKey) ?? b.weekKey).localeCompare(weekKeyToMonday(a.weekKey) ?? a.weekKey)).map(row => <button key={row.id} disabled={unavailable || !weekKeyToMonday(row.weekKey)} onClick={() => { setAnchor(weekKeyToMonday(row.weekKey)!); open(row); }}><strong>{row.weekKey}</strong><span>{row.highlights || row.kptKeep || row.notice || row.kptTry || row.nextWeek || '내용이 비어 있는 회고'}</span></button>) : <p>{unavailable ? '회고 목록을 확인 중이에요.' : '저장한 주간 회고가 없어요.'}</p>}</section>
    </div>
    {editing && <WeeklyReviewEditor record={editing.record} weekKey={weekKey} period={period} controller={controller} reference={planner.isLoading ? <p>주간 정보를 불러오고 있어요.</p> : reference} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('주간 회고 저장을 확인했어요.'); }} />}
    {quick && <MoaActivitySheet date={anchor} onClose={() => setQuick(false)} onSaved={() => setQuick(false)} />}
  </MoaFrame>;
}
