import { ArrowUpRight, CalendarDays, Clock3, Feather, Plus, Sparkles, Sun, Target } from 'lucide-react';
import { useMoa } from './PrototypeState';
import { Card, GoalRow, MoaBuddy, Progress, SectionTitle, TodoRow } from './ui';
import { TODAY, weeklyGoals, categories, shortDuration } from './sample';

export function Today() {
  const { todos, events, todayProgress, timeReport, navigate, setSheet, openQuick } = useMoa();
  const report = timeReport(TODAY, TODAY);
  const coreTodos = todos.filter(todo => todo.date === TODAY && todo.isTop3).slice(0, 3);
  const appointments = events.filter(event => event.date === TODAY);
  return <div className="mo-today-layout">
    <section className="mo-greeting">
      <p className="mo-eyebrow"><Sun size={15} /> 10월 20일 화요일</p>
      <h1>오늘도, 내 속도로<br /><span>차곡차곡 모아볼까요?</span></h1>
      <p>작은 한 걸음이면 충분한 하루예요.</p>
      <div className="mo-mobile-essentials"><span><Clock3 size={13} />오늘 {shortDuration(report.coverage.recordedMinutes)}</span><button onClick={() => setSheet('review-day')}><Feather size={13} />한 줄 회고</button></div>
      <div className="mo-mobile-buddy"><MoaBuddy small /><span>Lv.2 작은 새싹</span></div>
    </section>
    <Card className="mo-week-card">
      <SectionTitle eyebrow="MY LITTLE GOALS" title="이번 주에 모을 것" action="퀘스트 보기" onAction={() => navigate('quests')} />
      <div className="mo-week-caption"><span><Target size={14} />10.19 – 10.25</span><span>전체 <b data-testid="home-progress">{todayProgress.pct}%</b></span></div>
      {weeklyGoals.map(goal => <GoalRow key={goal.id} goal={goal} compact />)}
    </Card>
    <Card className="mo-companion">
      <div className="mo-companion-heading"><span className="mo-pill">나의 작은 정원</span><Sparkles size={17} /></div>
      <div className="mo-character-scene"><span className="mo-scene-orbit" /><MoaBuddy /><span className="mo-scene-label">함께 천천히 자라는 중</span></div>
      <div className="mo-growth"><div><strong>Lv.2 작은 새싹, 모아</strong><small>140 / 800 XP · 성장 예시</small></div><Progress value={17.5} label="캐릭터 성장 예시" /></div>
      <button className="mo-text-button" onClick={() => navigate('garden')}>정원에 잠깐 들르기 <ArrowUpRight size={15} /></button>
    </Card>
    <Card className="mo-today-quests">
      <SectionTitle eyebrow="ONE THING AT A TIME" title="오늘의 작은 퀘스트" action="모두 보기" onAction={() => navigate('quests')} />
      <p className="mo-section-hint">가장 중요한 건 세 가지만. 다 하지 않아도 괜찮아요.</p>
      <div className="mo-todo-list">{coreTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}</div>
      <button className="mo-quick-invitation" onClick={() => openQuick()}><span><Plus size={18} />지금 떠오른 것을 모아두기</span><span className="mo-key-hint">빠른 기록</span></button>
    </Card>
    <Card className="mo-today-schedule">
      <SectionTitle eyebrow="A LITTLE PLAN" title="오늘의 약속" action="캘린더" onAction={() => navigate('calendar', { period: 'day' })} />
      {appointments.map(event => <button className="mo-appointment" key={event.id} onClick={() => setSheet({ kind: 'edit', recordKind: 'event', id: event.id })}>
        <span className="mo-appointment-time">{event.startTime}<small>{event.endTime}</small></span><span><strong>{event.title}</strong><small>계획 · 일정</small></span><ArrowUpRight size={16} />
      </button>)}
      <p className="mo-free-space"><CalendarDays size={17} /> 나머지 시간에는 여백을 남겨두었어요.</p>
    </Card>
    <Card className="mo-today-time">
      <SectionTitle title="오늘 모은 시간" action="시간 돌아보기" onAction={() => navigate('records')} />
      <div className="mo-time-total"><Clock3 size={21} /><strong data-testid="today-actual-time">{shortDuration(report.coverage.recordedMinutes)}</strong><span>실제 활동</span></div>
      <div className="mo-time-stack">{categories.map(category => <span key={category.id} style={{ width: `${(report.byTag.get(category.id)?.minutes ?? 0) / (report.totalMinutes || 1) * 100}%`, background: category.color }} />)}</div>
      <div className="mo-time-legend">{categories.map(category => <span key={category.id}><i style={{ background: category.color }} />{category.name}<b>{Math.round(report.byTag.get(category.id)?.minutes ?? 0)}분</b></span>)}</div>
      <small className="mo-muted">계획한 시간은 더하지 않아요.</small>
    </Card>
    <button className="mo-reflection" onClick={() => setSheet('review-day')}><span className="mo-reflection-icon"><Feather size={23} /></span><span><strong>오늘의 나에게 한 줄</strong><small>어떤 순간을 기억하고 싶나요?</small></span><ArrowUpRight size={20} /></button>
  </div>;
}
