import { useState } from 'react';
import { Feather } from 'lucide-react';
import { usePlanner, type WeeklyReview } from '../app/store';
import { moaTodayData, moaMinutes } from '../lib/moaToday';
import { aggregateActivity, type RangeAggregation } from '../lib/timeAggregation';
import { findWeekRecord, weekKeysMatch } from '../lib/weekKeys';
import { WeeklyReviewEditor } from '../app/components/moamoa/weekly/WeeklyReviewEditor';
import { useReviewWeeklyReviews } from './useReviewWeeklyReviews';
import '../app/components/moamoa/weekly/weekly.css';
import './weekly.css';

export function ReviewWeeklyReview({ days, weekKey, week, actual }: {
  days: string[]; weekKey: string; week: ReturnType<typeof moaTodayData>; actual: RangeAggregation;
}) {
  const p = usePlanner(), controller = useReviewWeeklyReviews();
  const [editing, setEditing] = useState<{ record?: WeeklyReview; weekKey: string; period: string; days: string[] } | null>(null);
  const [savedWeek, setSavedWeek] = useState('');
  const current = findWeekRecord(controller.records, weekKey);
  const matches = controller.records.filter(row => weekKeysMatch(row.weekKey, weekKey));
  const unavailable = controller.loading || !!controller.readError;
  // A logical-date rollover must not replace the open review's reference week.
  const referenceDays = editing?.days ?? days;
  const referenceWeek = editing ? moaTodayData(referenceDays[0], p.todos, p.weeklyGoals, p.events, p.tags, p.timeBlocks, p.activityEntries, p.reportEvents) : week;
  const referenceActual = editing ? aggregateActivity(p.todos, p.reportEvents, p.tags, referenceDays[0], referenceDays[6], p.timeBlocks, p.activityEntries) : actual;
  const completed = new Set(referenceDays.flatMap(date => moaTodayData(date, p.todos, p.weeklyGoals, p.events, p.tags, p.timeBlocks, p.activityEntries, p.reportEvents)
    .dayTodos.filter(todo => todo.status === 'done').map(todo => todo.id))).size;
  const reference = <div className="mw-stats">
    <h3>이번 주 목표와 진행률</h3>
    {referenceWeek.weeks.length ? referenceWeek.weeks.map(({ goal, progress }) => <p key={goal.id} data-review-goal={goal.id} data-review-progress={progress.pct}>{goal.text}<strong>{progress.pct}%</strong></p>) : <p>이번 주 목표가 없어요.</p>}
    <p>완료한 할 일 <strong data-review-completed={completed}>{completed}개</strong></p><small>선택한 주에 날짜가 지정된 할 일 기준이에요. 기간 할 일은 한 번만 세어요.</small>
    <p>실제 활동 시간 <strong data-review-minutes={referenceActual.coverage.recordedMinutes}>{moaMinutes(referenceActual.coverage.recordedMinutes)}</strong></p>
    {(p.coreTimeReadError || p.activityEventsError || p.activityStorageError) && <p role="status">일부 활동 정보를 불러오지 못해 합계가 전체 기록과 다를 수 있어요.</p>}
    <h3>습관 체크 현황</h3>{p.habits.length ? p.habits.map(habit => <p key={habit.id}>{habit.name}<strong data-review-habit={habit.id}>{new Set(habit.checkedDates.filter(date => date >= referenceDays[0] && date <= referenceDays[6])).size}일 체크</strong></p>) : <p>등록한 습관이 없어요.</p>}
  </div>;
  const open = (record?: WeeklyReview) => {
    if (!unavailable) { setSavedWeek(''); setEditing({ record, weekKey, days: [...days], period: `${days[0]} (월) ~ ${days[6]} (일)` }); }
  };
  return <div className="rw-entry" data-review-week={weekKey}>
    <button disabled={unavailable} onClick={() => open(current)}><Feather size={17}/>{current ? '주간 회고 보기·수정' : '주간 회고 작성'}</button>
    {controller.loading ? <p role="status">회고를 불러오고 있어요.</p> : controller.readError ? <div role="alert"><p>{controller.readError}</p><button onClick={() => void controller.refresh()}>회고 다시 불러오기</button></div>
      : <p className="rw-summary" data-weekly-review-summary data-review-id={current?.id ?? ''}>{current ? current.highlights || current.kptKeep || current.notice || current.kptTry || current.nextWeek || '내용이 비어 있는 회고예요.' : '아직 작성한 회고가 없어요.'}</p>}
    {savedWeek === weekKey && <p role="status">주간 회고 저장을 확인했어요.</p>}
    {matches.length > 1 && <div className="rw-collisions"><p>이 주차에 회고가 여러 개 있어요. 자동으로 합치지 않으며 각각 열 수 있어요.</p>{matches.map((record, index) => <button key={record.id} disabled={unavailable} onClick={() => open(record)}>회고 {index + 1} · {record.weekKey}</button>)}</div>}
    {editing && <WeeklyReviewEditor record={editing.record} weekKey={editing.weekKey} period={editing.period} controller={controller}
      reference={reference} onClose={() => setEditing(null)} onSaved={() => { setSavedWeek(editing.weekKey); setEditing(null); void controller.refresh(); }} />}
  </div>;
}
