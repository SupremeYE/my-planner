import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, ChevronLeft, ChevronRight, Clock3, Leaf, NotebookPen, Plus, Sprout, X } from 'lucide-react';
import { usePlanner, type Todo } from '../../store';
import { moaTodayData, moaMinutes } from '../../../lib/moaToday';
import { SaveStatus } from '../SaveStatus';
import { RetroSheet } from '../RetroSheet';
import { MoaActivitySheet } from './MoaActivitySheet';
import { MoaBuddy } from './MoaBuddy';
import './today.css';

import { moaNav as nav, moaFonts as fonts, useMoaToday } from './moaShared';

export function Component() {
  const planner = usePlanner();
  const { todos, events, tags, timeBlocks, activityEntries, reportEvents, weeklyGoals, isLoading, dayEndHour, saveStates, addTodo, updateTodo, activeTimer, finishActiveTimer, setSelectedDate } = planner;
  const today = useMoaToday(dayEndHour);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const date = pickedDate ?? today;
  useEffect(() => setShowAllGoals(false), [date]);
  const navigate = useNavigate();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  const [showQuick, setShowQuick] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [reviewDate, setReviewDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; text: string; date: string } | null>(null);
  const submitting = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState('');
  const toggling = useRef(new Set<string>());
  const draftState = draft ? saveStates.find(s => s.key === `todos:${draft.id}`) : undefined;
  const locked = submitted || draftState?.status === 'saving' || draftState?.status === 'error';
  // Includes a successful explicit retry made through the shared SaveStatus component.
  useEffect(() => {
    if (draft && todos.some(todo => todo.id === draft.id)) {
      setNotice('할 일을 저장했어요. 할 일 목록에서 확인할 수 있어요.');
      setDraft(null); setSubmitted(false); setShowQuick(false);
    }
  }, [draft, todos]);
  function openQuick() {
    if (!draft) setDraft({ id: crypto.randomUUID(), text: '', date: today });
    setNotice(''); setShowQuick(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft?.text.trim() || submitting.current || locked) return;
    submitting.current = true; setSubmitted(true);
    try { await addTodo({ text: draft.text.trim(), date: draft.date, status: 'active', isTop3: false }, draft.id); }
    finally { submitting.current = false; setSubmitted(false); }
  }
  async function toggle(todo: Todo) {
    // Virtual occurrence writes use a materialized ID inside the existing action;
    // lock all checks during a core write so the old virtual ID cannot bypass the guard.
    if (toggling.current.has(todo.id) || saveStates.some(state => state.status === 'saving' || state.status === 'error' && state.key.startsWith('todos:'))) return;
    toggling.current.add(todo.id);
    try {
      if (activeTimer?.todoId === todo.id) { finishActiveTimer(); return; }
      const status = todo.status === 'done' ? 'active' : 'done';
      await updateTodo(todo.id, { status });
    } finally { toggling.current.delete(todo.id); }
  }
  const model = useMemo(() => moaTodayData(date, todos, weeklyGoals, events, tags, timeBlocks, activityEntries, reportEvents),
    [date, todos, weeklyGoals, events, tags, timeBlocks, activityEntries, reportEvents]);
  const checksLocked = saveStates.some(state => state.status === 'saving' || state.status === 'error' && state.key.startsWith('todos:'));
  function go(to: string) { setSelectedDate(date); navigate(to === '/todos' ? '/__moamoa-todos' : to); }
  return <div className="mt-root" style={fonts}>
    <a href="#moa-today-main" className="mt-skip">오늘 내용으로 이동</a>
    <aside className="mt-sidebar">
      <Link to="/__moamoa-today" className="mt-brand"><Sprout size={28} />모아모아</Link>
      <p>나의 작은 라이프 아지트</p><small className="mt-dev-label">개발용 · 실제 내 데이터</small>
      <nav aria-label="바로가기">{nav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={to === '/__moamoa-today' ? 'page' : undefined}><Icon size={20} />{label}</Link>)}</nav>
      <div className="mt-sidebar-foot"><MoaBuddy small /><p>오늘도, 나의 속도로.</p><Link to="/dashboard">기존 홈으로 돌아가기</Link></div>
    </aside>
    <div className="mt-scroll">
      <header className="mt-topbar"><span className="mt-brand"><Sprout size={22} />모아모아</span><span className="mt-dev-label">오늘 홈 · 개발용</span><Link to="/dashboard">기존 홈 <ChevronRight size={16} /></Link></header>
      <main id="moa-today-main" className="mt-main" tabIndex={-1}>
        <div className="mt-datebar"><div><button aria-label="이전 날짜" onClick={() => setPickedDate(format(addDays(parseISO(date), -1), 'yyyy-MM-dd'))}><ChevronLeft size={20} /></button><time dateTime={date}>{format(parseISO(date), 'yyyy년 M월 d일 EEEE', { locale: ko })}</time><button aria-label="다음 날짜" onClick={() => setPickedDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))}><ChevronRight size={20} /></button></div><button onClick={() => setPickedDate(null)} disabled={pickedDate === null}>오늘</button></div>
        <section className="mt-greeting"><div><p className="mt-eyebrow">MY COZY LITTLE DAY</p><h1 className={date === today ? 'mt-today-title' : undefined}>{date === today ? '오늘도, 힘내자!' : '하루의 조각을 돌아봐요'}</h1><p>작은 일부터 하나씩.</p></div><MoaBuddy small /></section>
        {!online && <div className="mt-offline" role="status">오프라인이에요. 새 기록은 저장되지 않아요. 표시된 데이터가 최신이 아닐 수 있어요. 연결 후 새로고침해주세요.</div>}
        {planner.coreTimeReadError && <p role="status" className="mt-offline">{planner.coreTimeReadError}</p>}
        {isLoading ? <div className="mt-loading" role="status" aria-busy="true"><Sprout size={25} /><h2>나의 하루를 불러오고 있어요</h2><p>기존 목표와 기록을 확인하는 중이에요.</p></div> : <>
          <section className="mt-card mt-week" aria-labelledby="mt-week-title">
            <div className="mt-section-head"><div><p className="mt-eyebrow">THIS WEEK</p><h2 id="mt-week-title"><Sprout size={19} />이번 주 목표</h2></div><button onClick={() => go('/goals')}>목표 보기 <ChevronRight size={17} /></button></div>
            {model.weeks.length === 0 ? <div className="mt-empty"><p>이번 주 목표를 하나 정해볼까요?</p><button onClick={() => go('/goals')}>기존 목표에서 시작하기 <ChevronRight size={16} /></button></div> : <>
              <div className="mt-week-total"><span>작은 걸음을 모으는 중</span><strong>{model.weekProgress.pct}%</strong></div>
              <div className="mt-progress" role="progressbar" aria-label="이번 주 전체 진행률" aria-valuenow={model.weekProgress.pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${model.weekProgress.pct}%` }} /></div>
              <div className={`mt-goals ${showAllGoals ? '' : 'mt-goals-compact'}`}>{(showAllGoals ? model.weeks : model.weeks.slice(0, 2)).map(({ goal, progress }) => <div className="mt-goal" key={goal.id} data-goal-id={goal.id} data-goal-progress={progress.pct}>
                <div><span className="mt-dot" /><strong>{goal.text}</strong><span>{progress.pct}%</span></div>
                <small>{progress.mode === 'todos' ? `연결 할 일 ${progress.done}/${progress.total}개 완료` : `수동 완료 · ${progress.completed ? '완료했어요' : '아직 진행 중이에요'}`}</small>
              </div>)}</div>
              {(model.weeks.length > 2 || model.weeks.some(row => row.goal.text.length > 45)) && <button className="mt-more" aria-expanded={showAllGoals} onClick={() => setShowAllGoals(value => !value)}>{showAllGoals ? '목표 간단히 보기' : `목표 자세히 보기${model.weeks.length > 2 ? ` · ${model.weeks.length}개` : ''}`}</button>}
            </>}
          </section>
          <div className="mt-columns"><div className="mt-primary">
            <section className="mt-card" aria-labelledby="mt-todos-title"><div className="mt-section-head"><div><p className="mt-eyebrow">ONE THING AT A TIME</p><h2 id="mt-todos-title">{date === today ? '오늘의' : '이날의'} 핵심 할 일 <small>{model.top3.length}/3</small></h2></div><button onClick={() => go('/todos')}>전체 보기 <ChevronRight size={17} /></button></div>
              {model.top3.length === 0 ? <div className="mt-empty"><Leaf size={25} /><p>별표로 고른 핵심 할 일이 없어요.</p><button onClick={() => go('/daily')}>일간 화면에서 핵심 선택하기</button></div> : <div className="mt-todos">{model.top3.map(todo => <div className={`mt-todo ${todo.status === 'done' ? 'mt-done' : ''}`} key={todo.id} data-todo-id={todo.id}>
                <button role="checkbox" aria-checked={todo.status === 'done'} aria-label={`${todo.text} 완료`} disabled={checksLocked} onClick={() => void toggle(todo)} className="mt-check">{todo.status === 'done' && <Check size={18} />}</button><span>{todo.text}</span>{todo.planStart && <small>{todo.planStart}</small>}
              </div>)}</div>}
              <button className="mt-add" onClick={openQuick}><Plus size={18} />할 일 빠르게 추가</button>
            </section>
            <section className="mt-card" aria-labelledby="mt-events-title"><div className="mt-section-head"><div><p className="mt-eyebrow">A LITTLE PLAN</p><h2 id="mt-events-title">일정 한눈에</h2></div><button onClick={() => go('/calendar')}>캘린더 <ChevronRight size={17} /></button></div>
              {model.dayEvents.length === 0 ? <p className="mt-empty">등록한 일정이 없어요. 여유롭게 하루를 채워보세요.</p> : <div>{model.dayEvents.slice(0, 4).map(event => <div className="mt-event" key={event.id}><time>{event.isAllDay ? '하루 종일' : event.startTime ?? '시간 미정'}</time><div><strong>{event.title}</strong><small>{event.isAllDay ? '종일 일정' : `${event.endTime ? `${event.endTime}까지 · ` : ''}계획 일정`}{event.doStart && event.doEnd ? ' · 실제 시간 기록 있음' : ''}</small></div></div>)}{model.dayEvents.length > 4 && <button className="mt-more" onClick={() => go('/calendar')}>일정 {model.dayEvents.length - 4}개 더 보기</button>}</div>}
            </section>
          </div><div className="mt-secondary">
            <section className="mt-card mt-time" aria-labelledby="mt-time-title"><p className="mt-eyebrow">TIME WELL COLLECTED</p><h2 id="mt-time-title"><Clock3 size={18} />기록한 실제 활동</h2><strong className="mt-duration" data-recorded-minutes={model.activity.coverage.recordedMinutes}>{moaMinutes(model.activity.coverage.recordedMinutes)}</strong><p>계획 시간은 포함하지 않아요.</p>
              {model.activity.coverage.unclassifiedMinutes > 0 && <p className="mt-diagnostic">이 중 미분류 {moaMinutes(model.activity.coverage.unclassifiedMinutes)}</p>}
              {model.activity.coverage.unresolvedItems.length > 0 && <p className="mt-diagnostic">날짜·시각 확인이 필요한 기록 {model.activity.coverage.unresolvedItems.length}건은 합계에서 제외했어요.</p>}
              <button className="mt-more" onClick={() => go('/time-report')}>시간 리포트 <ChevronRight size={17} /></button>
            </section>
            <section className="mt-card mt-retro"><NotebookPen size={24} /><h2>하루를 살며시 접어요</h2><p>좋았던 순간 한 줄이면 충분해요.<br />비워둔 날도 괜찮아요.</p><button onClick={() => setReviewDate(date)}>하루 회고 열기 <ChevronRight size={17} /></button></section>
          </div></div>
          <p className="mt-footer-note">기존 내 기록과 함께하는 오늘 · 기록 메뉴에서 실제 활동 시간을 함께 모아보세요.</p>
        </>}
        <p className="mt-notice" role="status">{notice}</p>
      </main>
    </div>
    <nav className="mt-bottom-nav" aria-label="모바일 주요 메뉴">{nav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={to === '/__moamoa-today' ? 'page' : undefined}><Icon size={20} /><span>{label}</span></Link>)}</nav>
    <button className="mt-quick" onClick={openQuick} disabled={isLoading}><Plus size={22} />빠른 기록</button>
    <Dialog.Root open={showQuick} onOpenChange={setShowQuick}><Dialog.Portal><Dialog.Overlay className="mt-overlay" /><Dialog.Content className="mt-sheet mt-root" style={fonts}>
      <div className="mt-section-head"><div><p className="mt-eyebrow">A SMALL STEP</p><Dialog.Title>할 일 빠르게 기록</Dialog.Title></div><Dialog.Close className="mt-close" aria-label="빠른 기록 닫기"><X size={22} /></Dialog.Close></div>
      <Dialog.Description>제목만 적으면 돼요. 닫아도 저장 전 초안은 이 화면에 남아요.</Dialog.Description>
      <form onSubmit={submit}><label htmlFor="mt-draft">무엇을 모아볼까요?</label><input id="mt-draft" placeholder="할 일을 입력하세요" value={draft?.text ?? ''} readOnly={locked} onChange={event => setDraft(current => current ? { ...current, text: event.target.value } : current)} required />
        <p className="mt-draft-date">저장 날짜 · {draft?.date} / 핵심 별표는 기존 일간 화면에서 선택해요.</p>
        <SaveStatus inline onlyKeys={draft ? [`todos:${draft.id}`] : []} />
        {draftState?.status === 'error' && <p className="mt-draft-date">초안을 보관하고 있어요. {draftState.retryable ? '위 재시도로 같은 요청을 다시 확인해주세요.' : '로그인·권한·입력 내용을 확인한 후 알림을 닫아 수정해주세요.'}</p>}
        <button type="submit" className="mt-submit" disabled={!draft?.text.trim() || !!locked}>{submitted || draftState?.status === 'saving' ? '저장 중…' : draftState?.status === 'error' ? '저장하지 못했어요' : '할 일 저장'}</button>
      </form><button type="button" className="mx-add-row" onClick={() => { setShowQuick(false); setShowTime(true); }}>활동 시간 기록</button><p className="mt-draft-date">오프라인 저장은 지원하지 않아요. 활동 시간은 아래 시간 기록에서 따로 남길 수 있어요.</p>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    {showTime && <MoaActivitySheet date={today} onClose={() => setShowTime(false)} onSaved={() => { setShowTime(false); setNotice('실제 활동 시간을 저장했어요.'); }} />}
    {reviewDate && <RetroSheet key={reviewDate} date={reviewDate} onClose={() => setReviewDate(null)} />}
  </div>;
}
