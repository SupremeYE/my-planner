import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react';
import { usePlanner, type TodoTimeBlock } from '../../store';
import { useTimeReport, type TimeReportPeriod } from '../../hooks/useTimeReport';
import { aggregateActivity, toTagRows, type ActivityRecord } from '../../../lib/timeAggregation';
import { activityOverlaps, moveReportDate, reportRange } from '../../../lib/activityReport';
import type { ActivityEntry } from '../../../lib/activityEntries';
import { moaMinutes } from '../../../lib/moaToday';
import { MoaRecordsNav } from './MoaRecordsNav';
import { MoaRecordDateBar } from './MoaRecordDateBar';
import { MoaFrame } from './MoaFrame';
import { MoaDialog } from './MoaDialog';
import { MoaActivitySheet } from './MoaActivitySheet';
import { useMoaToday } from './moaShared';
import './todos.css';
import './time.css';

export function Component() {
  const p = usePlanner(); const today = useMoaToday(p.dayEndHour);
  const [pickedDate, setDate] = useState<string | null>(null); const date = pickedDate ?? today; const [period, setPeriod] = useState<TimeReportPeriod>('day');
  const [category, setCategory] = useState('all'); const [sheet, setSheet] = useState<{ entry?: ActivityEntry; block?: TodoTimeBlock } | null>(null);
  const [deleting, setDeleting] = useState<ActivityRecord | null>(null), [notice, setNotice] = useState(''), [limit, setLimit] = useState(50);
  const report = useTimeReport(period, date);
  const range = report.dateRange;
  const activity = useMemo(() => aggregateActivity(p.todos, p.reportEvents, p.tags, range.start, range.end, p.timeBlocks, p.activityEntries), [p.todos,p.reportEvents,p.tags,p.timeBlocks,p.activityEntries,range.start,range.end]);
  const previousRange = reportRange(moveReportDate(date, period, -1), period, (p.appSettings.weekStartsOn ?? 1) as 0 | 1);
  const previous = useMemo(() => aggregateActivity(p.todos,p.reportEvents,p.tags,previousRange.start,previousRange.end,p.timeBlocks,p.activityEntries), [p.todos,p.reportEvents,p.tags,p.timeBlocks,p.activityEntries,previousRange.start,previousRange.end]);
  const categories = toTagRows(activity, p.tags).filter(t => t.minutes > 0).sort((a,b) => b.minutes - a.minutes);
  const oldCategories = toTagRows(previous,p.tags).filter(t => t.minutes > 0);
  const allCategories = [...categories, ...oldCategories.filter(t => !categories.some(c => c.tagId === t.tagId))];
  const records = activity.records.filter(r => category === 'all' || category === 'none' ? category === 'all' || !r.shares.length : r.shares.some(s => s.tagId === category)).sort((a,b) => b.date.localeCompare(a.date));
  const minutes = category === 'all' ? activity.coverage.recordedMinutes : category === 'none' ? activity.coverage.unclassifiedMinutes : activity.byTag.get(category)?.minutes ?? 0;
  const allTimedRecords = useMemo(() => aggregateActivity(p.todos,p.reportEvents,p.tags,'0001-01-01','9999-12-31',p.timeBlocks,p.activityEntries).records, [p.todos,p.reportEvents,p.tags,p.timeBlocks,p.activityEntries]);
  const overlaps = useMemo(() => activityOverlaps(allTimedRecords).filter(pair => [pair.a,pair.b].some(record => record.date >= range.start && record.date <= range.end)), [allTimedRecords,range.start,range.end]);
  const prevMinutes = (id: string) => previous.byTag.get(id)?.minutes ?? 0;
  const saved = () => { setSheet(null); setDeleting(null); setNotice('저장 결과를 확인했어요. 시간 분석에 반영했어요.'); };
  useEffect(() => { p.setSelectedDate(date); setLimit(50); }, [date]);
  const removeAttempted = useRef(false);
  const deleteOriginal=useRef<{entry?:ActivityEntry;block?:TodoTimeBlock}>({});
  const removeKey = deleting ? `${deleting.kind === 'activity' ? 'activityEntries' : 'timeBlocks'}:${deleting.id}` : '';
  const removeState = p.saveStates.find(s => s.key === removeKey);
  useEffect(() => { if (deleting && removeAttempted.current && removeState?.status === 'saved') saved(); }, [removeState?.status]);
  async function remove() {
    if (!deleting || removeState?.status === 'saving' || removeState?.status === 'error') return;
    removeAttempted.current = true;
    if (deleting.kind === 'activity') await p.removeActivity(deleting.id,deleteOriginal.current.entry); else await p.amendTimeBlockConfirmed(deleting.id, null,deleteOriginal.current.block);
  }
  function edit(record: ActivityRecord) {
    if (record.kind === 'activity') setSheet({ entry: p.activityEntries.find(e => e.id === record.id) });
    else setSheet({ block: p.timeBlocks.find(b => b.id === record.id) });
  }
  return <MoaFrame pageTitle="기록" onQuick={() => setSheet({})} quickDisabled={p.isLoading}>
    <div className="mx-page-heading"><div><p className="mt-eyebrow">PIECES OF MY DAY</p><h1>기록</h1><p>일상의 조각을, 내 시간으로 모아요.</p></div><button className="mx-primary" onClick={() => setSheet({})}><Plus size={18} />시간 기록</button></div>
    <MoaRecordsNav active="time" />
    <section className="ma-toolbar" aria-label="시간 분석 기간"><div className="mx-tabs">{[['day','일간'],['week','주간'],['month','월간']].map(([id,label]) => <button key={id} aria-pressed={period === id} onClick={() => { setPeriod(id as TimeReportPeriod); setLimit(50); }}>{label}</button>)}</div><MoaRecordDateBar value={date} inputLabel="분석 날짜" label={range.start === range.end ? range.start : `${range.start} ~ ${range.end}`} onChange={setDate} onPrevious={() => setDate(moveReportDate(date,period,-1))} onNext={() => setDate(moveReportDate(date,period,1))} onToday={() => setDate(today)}/>
    </section>
    {p.activityStorageStatus !== 'ready' && <div className="ma-notice" role="status">{p.activityStorageStatus === 'loading' ? '독립 활동을 불러오고 있어요.' : p.activityStorageError} 현재 합계는 불러온 기록 기준이며, 독립 활동의 전체 합계는 확인되지 않았어요.<button onClick={() => void p.refreshActivityEntries()}>기록 다시 불러오기</button></div>}
    {p.activityEventsError && <p role="status" className="ma-notice">{p.activityEventsError}<button onClick={() => void p.refreshReportEvents()}>일정 실적 다시 불러오기</button></p>}
    {p.coreTimeReadError && <p role="status" className="ma-notice">{p.coreTimeReadError}<button onClick={() => void p.refreshCoreTimeSources()}>할 일·시간 기록 다시 불러오기</button></p>}
    {p.isLoading ? <p role="status">나의 기록을 불러오고 있어요.</p> : <>
    <div className="ma-overview"><section className="mt-card ma-total"><p className="mt-eyebrow">TIME WELL COLLECTED</p><h2><Clock3 size={19} />{category === 'all' ? '기록한 실제 활동' : category === 'none' ? '미분류 실제 활동' : '선택 카테고리의 실제 활동'}</h2><strong className="mt-duration" data-activity-minutes={minutes}>{moaMinutes(minutes)}</strong><p className="mx-help">직접 기록한 시간만 모아요.</p><details className="ma-help"><summary>집계 기준</summary><p>하루 24시간 전체가 아니에요. 계획·완료 체크·수면/운동 라이프 로그는 자동 합산하지 않아요.</p></details><label>카테고리 필터<select aria-label="시간 카테고리 필터" value={category} onChange={e => setCategory(e.target.value)}><option value="all">전체 카테고리</option><option value="none">미분류</option>{allCategories.map(t => <option key={t.tagId} value={t.tagId}>{t.tagName}</option>)}</select></label></section>
    <section className="mt-card ma-distribution"><h2>전체 카테고리별 시간</h2><div className="ma-stack" aria-label="기록한 시간 분포">{categories.map(c => <span key={c.tagId} title={`${c.tagName} ${moaMinutes(c.minutes)}`} style={{ width: `${c.minutes / activity.coverage.recordedMinutes * 100}%`, background: c.tagColor }} />)}{activity.coverage.unclassifiedMinutes > 0 && <span title="미분류" style={{ width: `${activity.coverage.unclassifiedMinutes / activity.coverage.recordedMinutes * 100}%`, background: '#b6b7ac' }} />}</div>{categories.map(c => <div key={c.tagId} className="ma-category-row"><span><i style={{ background: c.tagColor }} />{c.tagName}</span><strong>{moaMinutes(c.minutes)}</strong><small>{Math.round(c.minutes / activity.coverage.recordedMinutes * 100)}%</small></div>)}<div className="ma-category-row ma-unclassified"><span><i />미분류</span><strong data-unclassified-minutes={activity.coverage.unclassifiedMinutes}>{moaMinutes(activity.coverage.unclassifiedMinutes)}</strong><small>{activity.coverage.recordedMinutes ? Math.round(activity.coverage.unclassifiedMinutes/activity.coverage.recordedMinutes*100) : 0}%</small></div>{!activity.records.length && <p className="mt-empty">아직 기록한 시간이 없어요. 작은 활동부터 남겨볼까요?</p>}</section></div>
    <section className="mt-card ma-daily"><div className="mx-section-head"><h2>일별 기록</h2><small>선택 카테고리 기준</small></div><div className="ma-bars">{report.daily.map(d => { const total = category === 'all' ? d.coverage.recordedMinutes : category === 'none' ? d.coverage.unclassifiedMinutes : d.byCategory[category] ?? 0; const max = Math.max(60, ...report.daily.map(v => v.coverage.recordedMinutes));return <button key={d.date} title={`${d.date} ${moaMinutes(total)}`} aria-label={`${d.date} 일간 분석`} onClick={() => { setDate(d.date);setPeriod('day'); }}><strong>{report.daily.length < 8 ? moaMinutes(total) : total ? Math.round(total) : '·'}</strong><span className="ma-bar-track"><i style={{ height:`${total/max*100}%` }} /></span><small>{d.date.slice(8)}</small></button>; })}</div></section>
    {period !== 'day' && <section className="mt-card ma-comparison"><h2>{period === 'week' ? '지난 주' : '지난 달'}와 카테고리 비교</h2><p className="mx-help">기록한 소요의 합계 비교예요. 기록이 적은 날에도 불이익은 없어요.</p><div className="ma-compare-head"><span>카테고리</span><span>선택 기간</span><span>이전 기간</span></div>{allCategories.map(c => <div key={c.tagId} className="ma-compare-head"><span>{c.tagName}</span><strong>{moaMinutes(activity.byTag.get(c.tagId)?.minutes ?? 0)}</strong><span>{moaMinutes(prevMinutes(c.tagId))}</span></div>)}<div className="ma-compare-head"><span>미분류</span><strong>{moaMinutes(activity.coverage.unclassifiedMinutes)}</strong><span>{moaMinutes(previous.coverage.unclassifiedMinutes)}</span></div></section>}
    {overlaps.length > 0 && <details className="ma-notice"><summary>실제 시각이 겹치는 기록 {overlaps.length}쌍 · 중복 가능성</summary><p>합계에서 자동으로 빼거나 합치지 않았어요. 시각이 없는 기록은 겹침 여부를 알 수 없어요.</p>{overlaps.map((o,i) => <p key={i}>{o.a.name} / {o.b.name} · {moaMinutes(o.minutes)} 겹침</p>)}</details>}
    {activity.coverage.unresolvedItems.length > 0 && <details className="ma-notice"><summary>날짜·시각 확인 필요 {activity.coverage.unresolvedItems.length}건 · 합계 제외</summary>{activity.coverage.unresolvedItems.map((r,i) => <p key={i}>{r.name} · {r.date} · {{'invalid-time':'실제 시각 또는 소요를 확인해주세요','ambiguous-overnight':'자정 전후 실제 날짜·시각을 확인해주세요','legacy-date-ambiguous':'기존 실적과 작업 블록의 날짜 관계를 확인해주세요'}[r.reason]}</p>)}</details>}
    <section className="mt-card ma-history"><div className="mx-section-head"><h2>활동 기록 <small>{records.length}개</small></h2><button onClick={() => setSheet({})}>+ 시간 기록</button></div>{!records.length && <p className="mt-empty">선택한 기간과 카테고리의 기록이 없어요.</p>}{records.slice(0,limit).map(r => { const block = r.kind === 'block' ? p.timeBlocks.find(b => b.id === r.id) : undefined; const editable = r.kind === 'activity' || !!block; return <article key={`${r.kind}:${r.id}`} className="ma-record" data-activity-id={r.id}><div><strong>{r.name}</strong><p>{r.date} · {r.kind === 'activity' ? '독립 활동' : r.kind === 'block' ? '할 일 연결' : '기존 실적'} · {r.classification === 'snapshot' ? '당시 분류 보존' : r.classification === 'invalid' ? '분류 확인 필요' : '현재 태그 기준(기존 기록)'}</p><div className="ma-record-tags">{r.shares.length ? r.shares.map(s => <span key={s.tagId} style={{ borderColor: s.color }}>{s.name}{r.shares.length > 1 && ` · ${Math.round(s.weight*100)}%`}</span>) : <span>미분류</span>}</div></div><div className="ma-record-actions"><b>{moaMinutes(r.minutes)}</b><div><button disabled={!editable} title={!editable ? '실제 시각·레거시 원본은 기존 타임라인에서 확인해주세요.' : undefined} onClick={() => edit(r)} aria-label={`${r.name} 기록 수정`}>수정</button><button disabled={r.kind !== 'activity' && r.kind !== 'block'} title={r.kind === 'todo' || r.kind === 'event' ? '기존 원본 화면에서 관리해주세요.' : undefined} onClick={() => { removeAttempted.current = false; deleteOriginal.current={entry:p.activityEntries.find(e=>e.id===r.id),block:p.timeBlocks.find(e=>e.id===r.id)};setDeleting(r); }} aria-label={`${r.name} 기록 삭제`}>삭제</button></div></div></article>; })}{records.length > limit && <button className="mx-add-row" onClick={() => setLimit(v => v+50)}>기록 더 보기</button>}</section><p className="mx-help">기록 날짜에 소요 전체를 귀속해요. 자정을 지난 실제 시각도 자동 분할하지 않아요. 분류 보존 정보가 없는 과거 기록은 현재 태그를 기준으로 보여줘요.</p>
    </>}<p role="status" className="mx-notice">{notice}</p>
    {sheet && <MoaActivitySheet key={sheet.entry?.id ?? sheet.block?.id ?? 'new'} date={date} {...sheet} onClose={() => setSheet(null)} onSaved={saved} />}
    {deleting && <MoaDialog title="활동 기록 삭제" description="이 기록을 삭제하면 실제 시간 합계에서 빠져요. 완료 상태와 목표 연결은 유지해요." onClose={() => { if(removeState?.status !== 'saving') setDeleting(null); }} saveKeys={[removeKey]} footer={<div className="mx-actions"><button disabled={removeState?.status === 'saving'} onClick={() => setDeleting(null)}>취소</button><button className="mx-primary" disabled={removeState?.status === 'saving' || removeState?.status === 'error'} onClick={() => void remove()}>삭제 확인</button></div>}><p>{deleting.name} · {moaMinutes(deleting.minutes)}</p></MoaDialog>}
  </MoaFrame>;
}
