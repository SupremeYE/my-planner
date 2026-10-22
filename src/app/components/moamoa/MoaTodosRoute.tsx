import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ChevronRight, Clock3, Filter, MoreHorizontal, Plus, Search, Settings2, Sprout, Target } from 'lucide-react';
import { format } from 'date-fns';
import { usePlanner, type Todo } from '../../store';
import { completionMarkerPatch } from '../../../lib/todoDoDuration';
import { moaTodoList, categoryLabel, MOA_CATEGORIES, isRecurringMoaTodo, timeTagLabel } from '../../../lib/moaTodos';
import { moaMinutes } from '../../../lib/moaToday';
import { aggregateActivity } from '../../../lib/timeAggregation';
import { monthlyRollup, weeklyRollup } from '../period/periodProgress';
import { useMoaToday } from './moaShared';
import { MoaFrame } from './MoaFrame';
import { MoaDialog } from './MoaDialog';
import { MoaTodoEditor } from './MoaTodoEditor';
import { MoaTimeSheet } from './MoaTimeSheet';
import { MoaTagManager } from './MoaTagManager';
import './todos.css';

type Sheet = { kind: 'edit'; todo?: Todo; id: string } | { kind: 'detail' | 'delete' | 'time'; todo: Todo; id: string } | null;
export function Component() {
  const planner = usePlanner();
  const { todos, events, tags, timeBlocks, weeklyGoals, monthlyGoals, dayEndHour, isLoading, saveStates, updateTodo, activeTimer, finishActiveTimer, setSelectedDate } = planner;
  const today = useMoaToday(dayEndHour); const navigate = useNavigate();
  const [scope, setScope] = useState<'today' | 'week' | 'undated'>('today');
  const [category, setCategory] = useState('all'); const [tag, setTag] = useState('all'); const [goal, setGoal] = useState('all'); const [status, setStatus] = useState('current');
  const [search, setSearch] = useState(''); const [showFilters, setShowFilters] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null); const [manager, setManager] = useState(false); const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  const submitting = useRef(new Set<string>());
  const locked = saveStates.some(s => s.status === 'saving' || s.status === 'error' && s.key.startsWith('todos:'));
  const all = useMemo(() => moaTodoList(todos, weeklyGoals, today, scope), [todos, weeklyGoals, today, scope]);
  const rows = all.filter(todo => (category === 'all' || categoryLabel(todo.category) === MOA_CATEGORIES.find(c => c.id === category)?.name)
    && (tag === 'all' || tag === 'none' ? tag !== 'none' || !(todo.tags?.length) : todo.tags?.includes(tag))
    && (goal === 'all' || goal === 'none' ? goal !== 'none' || !todo.weeklyGoalId : todo.weeklyGoalId === goal)
    && (status === 'all' ? true : status === 'current' ? !['cancelled', 'backlog'].includes(todo.status) : status === 'open' ? !['done', 'cancelled', 'backlog'].includes(todo.status) : status === 'done' ? todo.status === 'done' : ['cancelled', 'backlog'].includes(todo.status))
    && (!search.trim() || [todo.text, weeklyGoals.find(g => g.id === todo.weeklyGoalId)?.text, ...(todo.tags ?? []).map(id => tags.find(t => t.id === id)?.name)].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const sorted = [...rows].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
  const activity = useMemo(() => aggregateActivity(todos, events, tags, today, today, timeBlocks), [todos, events, tags, timeBlocks, today]);
  const actualTodo = sheet && 'todo' in sheet && sheet.todo ? todos.find(t => t.id === sheet.todo.id)
    ?? todos.find(t => t.recurrenceParentId === sheet.todo.id.split('::')[0] && t.date === sheet.todo.date) ?? sheet.todo : undefined;
  function add() { setNotice(''); setSheet({ kind: 'edit', id: crypto.randomUUID() }); }
  function saved(message: string) { setSheet(null); setNotice(message); }
  async function toggle(todo: Todo) {
    if (locked || submitting.current.has(todo.id)) return; submitting.current.add(todo.id);
    try {
      if (activeTimer?.todoId === todo.id) { finishActiveTimer(); return; }
      const next = todo.status === 'done' ? 'active' : 'done';
      if (!await updateTodo(todo.id, { status: next, ...completionMarkerPatch(todo, next, format(new Date(), 'HH:mm')) })) setNotice('완료 상태를 저장하지 못했어요. 기존 상태를 유지하며 저장 알림이나 다른 기기의 변경을 확인해주세요.');
    } finally { submitting.current.delete(todo.id); }
  }
  const activeFilters = [tag !== 'all', goal !== 'all', status !== 'current'].filter(Boolean).length;
  return <MoaFrame onQuick={add} quickDisabled={isLoading}>
    <div className="mx-page-heading"><div><p className="mt-eyebrow">LITTLE STEPS, EVERY DAY</p><h1>할 일</h1><p>오늘 할 일을 하나씩 정리해봐요.</p></div><button className="mx-primary" onClick={add} disabled={isLoading}><Plus size={18} />할 일 추가</button></div>
    {!online && <div className="mt-offline" role="status">오프라인이에요. 저장되지 않으며 초안은 현재 화면에만 남아요. 연결 후 명시적으로 재시도해주세요.</div>}
    <div className="mx-toolbar"><div className="mx-tabs" role="group" aria-label="할 일 기간">{[['today', '오늘'], ['week', '이번 주'], ['undated', '날짜 미정']].map(([id, label]) => <button key={id} onClick={() => setScope(id as typeof scope)} aria-pressed={scope === id}>{label}</button>)}</div><button className="mx-filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}><Filter size={16} />필터{activeFilters > 0 && <span>{activeFilters}</span>}</button></div>
    <div className="mx-find"><div className="mx-category-filter" role="group" aria-label="할 일 구분 필터"><button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>전체</button>{MOA_CATEGORIES.map(c => <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</button>)}</div><label className="mx-search"><Search size={17} /><input aria-label="할 일 검색" placeholder="할 일 검색" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    {showFilters && <div className="mx-filters mt-card"><label>태그<select aria-label="태그 필터" value={tag} onChange={e => setTag(e.target.value)}><option value="all">모든 태그</option><option value="none">태그 없음</option>{tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>연결 목표<select aria-label="목표 필터" value={goal} onChange={e => setGoal(e.target.value)}><option value="all">모든 목표</option><option value="none">연결 안 함</option>{weeklyGoals.map(g => <option key={g.id} value={g.id}>{g.text}</option>)}</select></label><label>완료 상태<select aria-label="상태 필터" value={status} onChange={e => setStatus(e.target.value)}><option value="current">진행·완료</option><option value="all">모든 상태</option><option value="open">미완료</option><option value="done">완료</option><option value="inactive">취소·보관</option></select></label><button onClick={() => { setTag('all'); setGoal('all'); setStatus('current'); setCategory('all'); setSearch(''); }}>필터 초기화</button></div>}
    <div className="mx-list-layout"><section className="mt-card mx-list-card" aria-labelledby="mx-list-title"><div className="mx-section-head"><h2 id="mx-list-title">{scope === 'today' ? '오늘의' : scope === 'week' ? '이번 주의' : '날짜 미정'} 할 일 <small>{sorted.length}개</small></h2><button onClick={() => setManager(true)}><Settings2 size={16} />태그 관리</button></div>
      {isLoading ? <p role="status" className="mt-empty">나의 할 일을 불러오고 있어요.</p> : sorted.length === 0 ? <div className="mt-empty"><Sprout size={28} /><p>{all.length ? '조건에 맞는 할 일이 없어요.' : '가볍게 시작할 일 하나를 적어볼까요?'}</p><button onClick={add}><Plus size={17} />할 일 추가</button></div> : <div>{sorted.map(todo => { const goalRow = weeklyGoals.find(g => g.id === todo.weeklyGoalId); const progress = goalRow ? weeklyRollup(goalRow, todos) : undefined;
        return <article key={todo.id} className={`mx-todo-row ${todo.status === 'done' ? 'mx-completed' : ''}`} data-todo-id={todo.id}>
          <button className="mx-check-hit" role="checkbox" aria-checked={todo.status === 'done'} aria-label={`${todo.text} 완료`} disabled={locked || ['cancelled', 'backlog'].includes(todo.status)} onClick={() => void toggle(todo)}><span>{todo.status === 'done' && <Check size={15} />}</span></button>
          <div className="mx-todo-content"><button className="mx-todo-title" onClick={() => setSheet({ kind: 'detail', todo, id: todo.id })}>{todo.text}</button><div className="mx-row-meta"><span className="mx-time-chip"><Clock3 size={12} />{timeTagLabel(todo, tags)}</span>{(todo.tags ?? []).map(id => tags.find(t => t.id === id)).filter(t => t && !t.trackTime).map(t => <span key={t!.id} className="mx-tag-chip">#{t!.name}</span>)}{categoryLabel(todo.category) !== timeTagLabel(todo, tags) && <span>{categoryLabel(todo.category)}</span>}</div>
            {goalRow && <small className="mx-goal-link" data-goal-id={goalRow.id} data-goal-progress={progress?.pct}><Target size={12} />{goalRow.text} · {progress?.pct}%</small>}
            <div className="mx-row-date"><span>{todo.date ? `${todo.date.slice(5).replace('-', '.')} ${todo.planStart ? `${todo.planStart}${todo.planEnd ? `–${todo.planEnd}` : ''} 예정` : ''}` : '날짜 미정'}</span>{isRecurringMoaTodo(todo) && <span>반복</span>}{['cancelled', 'backlog'].includes(todo.status) && <span>취소·보관</span>}</div>
          </div><button className="mx-detail-button" aria-label={`${todo.text} 상세 보기`} onClick={() => setSheet({ kind: 'detail', todo, id: todo.id })}><MoreHorizontal size={20} /></button>
        </article>; })}</div>}
    </section><aside className="mx-summary"><section className="mt-card"><p className="mt-eyebrow">TIME WELL COLLECTED</p><h2><Clock3 size={18} />오늘 실제 기록</h2><strong className="mt-duration" data-recorded-minutes={activity.coverage.recordedMinutes}>{moaMinutes(activity.coverage.recordedMinutes)}</strong><p className="mx-help">계획 시간과 완료 체크는 더하지 않아요.</p><p className="mx-help">태그 분류 {moaMinutes(activity.totalMinutes)} · 미분류 {moaMinutes(activity.coverage.unclassifiedMinutes)}</p>{activity.coverage.unresolvedItems.length > 0 && <p className="mx-help">확인 필요 {activity.coverage.unresolvedItems.length}건 · 합계 제외</p>}<button className="mx-add-row" onClick={() => { setSelectedDate(today); navigate('/time-report'); }}>기존 시간 분석 열기<ChevronRight size={16} /></button></section><section className="mt-card mx-soft-card"><Sprout size={22} /><h2>목표가 없어도 괜찮아요</h2><p className="mx-help">생활 속 작은 할 일도 소중해요.<br />태그와 목표는 필요할 때만 연결해요.</p></section></aside></div>
    <p className="mx-notice" role="status">{notice}</p>
    {sheet?.kind === 'edit' && <MoaTodoEditor key={sheet.id} id={sheet.id} todo={sheet.todo} defaultDate={sheet.todo || scope === 'undated' ? null : today} onClose={() => setSheet(null)} onSaved={() => saved('할 일을 저장했어요. 선택한 날짜의 목록에서 확인할 수 있어요.')} />}
    {sheet?.kind === 'detail' && actualTodo && <MoaTodoDetails todo={actualTodo} onClose={() => setSheet(null)} onEdit={() => setSheet({ kind: 'edit', todo: actualTodo, id: actualTodo.id })} onTime={() => setSheet({ kind: 'time', todo: actualTodo, id: crypto.randomUUID() })} onDelete={() => setSheet({ kind: 'delete', todo: actualTodo, id: actualTodo.id })} />}
    {sheet?.kind === 'time' && actualTodo && <MoaTimeSheet key={sheet.id} id={sheet.id} todo={actualTodo} today={today} onClose={() => setSheet(null)} onSaved={() => saved('실제 작업 시간을 저장했어요. 완료 상태는 바꾸지 않았어요.')} />}
    {sheet?.kind === 'delete' && actualTodo && <MoaTodoDelete todo={actualTodo} onClose={() => setSheet(null)} onSaved={() => saved('할 일 처리를 확인했어요. 기존 시간 기록은 보존해요.')} />}
    {manager && <MoaTagManager onClose={() => setManager(false)} />}
  </MoaFrame>;
}
function MoaTodoDetails({ todo, onClose, onEdit, onTime, onDelete }: { todo: Todo; onClose: () => void; onEdit: () => void; onTime: () => void; onDelete: () => void }) {
  const { tags, todos, weeklyGoals, monthlyGoals, timeBlocks, activeTimer } = usePlanner();
  const weekly = weeklyGoals.find(g => g.id === todo.weeklyGoalId); const monthly = monthlyGoals.find(g => g.id === weekly?.monthlyGoalId);
  const recurring = isRecurringMoaTodo(todo); const total = aggregateActivity([todo], [], tags, '0000-01-01', '9999-12-31', timeBlocks.filter(b => b.todoId === todo.id)).coverage.recordedMinutes;
  const timerActive = activeTimer?.todoId === todo.id;
  return <MoaDialog title="할 일 상세" description="같은 할 일을 목록·캘린더·목표에서 함께 사용해요." onClose={onClose} saveKeys={[]} footer={<button className="mx-primary" onClick={onClose}>닫기</button>}>
    <h3 className="mx-detail-title">{todo.text}</h3><div className="mx-detail-info"><p>대표 시간 카테고리 · {timeTagLabel(todo, tags)}</p><p>구분 · {categoryLabel(todo.category)}</p><p>날짜 · {todo.date ?? '미정'}{todo.endDate && todo.endDate !== todo.date ? ` ~ ${todo.endDate}` : ''}</p><p>예정 · {todo.planStart ?? '미정'}{todo.planEnd ? `–${todo.planEnd}` : ''}</p><p>확인된 실제 시간 · {moaMinutes(total)}</p></div>
    {weekly && <div className="mx-goal-card"><strong>{weekly.text}</strong><p>주간 진행률 {weeklyRollup(weekly, todos).pct}%</p>{monthly && <p>{monthly.text} · 월간 {monthlyRollup(monthly, weeklyGoals, todos).pct}%</p>}</div>}
    <div className="mx-detail-actions"><button onClick={onEdit} disabled={recurring}>수정</button><button onClick={onTime} disabled={recurring || timerActive}><Clock3 size={17} />시간 기록</button><button onClick={onDelete} disabled={recurring || timerActive}>삭제</button></div>
    {recurring && <p className="mx-help">반복 할 일의 편집·삭제·수동 시간 기록은 기존 회차/분기 정책 검토가 필요해 여기서는 지원하지 않아요. 완료 체크는 기존 확인 저장 액션을 사용해요.</p>}{timerActive && <p className="mx-help">활성 타이머를 먼저 마친 뒤 수동 시간을 기록하거나 삭제해주세요.</p>}
    <p className="mx-help">태그를 변경하면 과거 작업 블록의 카테고리도 재분류돼요. 시작·종료 시각 없는 기록은 소요만 보관해요.</p>
  </MoaDialog>;
}
function MoaTodoDelete({ todo, onClose, onSaved }: { todo: Todo; onClose: () => void; onSaved: () => void }) {
  const { saveStates, timeBlocks, removeTodoConfirmed, updateTodo } = usePlanner();
  const attempted = useRef(false), done = useRef(false), submitting = useRef(false);
  const [error, setError] = useState('');
  const state = saveStates.find(s => s.key === `todos:${todo.id}`); const busy = state?.status === 'saving';
  const recorded = timeBlocks.some(b => b.todoId === todo.id) || (todo.doElapsedSec != null ? todo.doElapsedSec > 0 : !!(todo.doStart || todo.doEnd) && todo.doStart !== todo.doEnd);
  useEffect(() => { if (attempted.current && !done.current && state?.status === 'saved') { done.current = true; onSaved(); } }, [state?.status, onSaved]);
  async function act() { if (busy || submitting.current || state?.status === 'error') return; submitting.current = true; attempted.current = true;
    try { const ok = recorded ? await updateTodo(todo.id, { status: 'cancelled' }) : await removeTodoConfirmed(todo.id); if (!ok) setError('처리를 확인하지 못했어요. 저장 알림이나 다른 기기의 변경을 확인해주세요.'); } finally { submitting.current = false; } }
  return <MoaDialog title="할 일 삭제 확인" description={recorded ? '시간 기록이 있어 삭제를 보호해요. 취소로 보관하면 목표 진행률에서는 제외되지만 실적은 유지돼요.' : '삭제하면 할 일과 목표의 진행률이 바뀌어요. 실제 시간 기록이 있으면 서버에서 삭제를 막아요.'} onClose={() => { if (!busy) onClose(); }} saveKeys={[`todos:${todo.id}`]} footer={<div className="mx-actions"><button onClick={onClose} disabled={busy}>돌아가기</button><button className="mx-primary" disabled={busy || state?.status === 'error'} onClick={() => void act()}>{busy ? '처리 중…' : recorded ? '취소 상태로 보관' : '삭제 확인'}</button></div>}><p className="mx-detail-title">{todo.text}</p>{error && <p role="alert" className="mx-error">{error}</p>}</MoaDialog>;
}
