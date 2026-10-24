import { Link } from 'react-router';
import { Flower2, Heart, Sprout, Sun, Target } from 'lucide-react';
import { usePlanner } from '../app/store';
import { useSomedaySeeds } from '../app/hooks/useSomedaySeeds';
import { getHabitStreak } from '../app/lib/habitUtils';
import { monthlyRollup, annualRollup } from '../app/components/period/periodProgress';
import { MoaBuddy } from '../app/components/moamoa/MoaBuddy';
import { useMoaToday } from '../app/components/moamoa/moaShared';
import { MoaFrame } from './ReviewFrame';
import { useReviewQuick, ReviewQuickSheet } from './ReviewQuick';
import './calendarGarden.css';

export function Component() {
  const p = usePlanner(), quick = useReviewQuick();
  const today = useMoaToday(p.dayEndHour);
  const { seeds, loading } = useSomedaySeeds();
  const completed = p.todos.filter(t => t.status === 'done');
  const checks = p.habits.reduce((n,h) => n + h.checkedDates.length, 0);
  const dates = [...new Set([...completed.map(t => t.date).filter((d): d is string => !!d), ...p.habits.flatMap(h => h.checkedDates)])];
  const streak = getHabitStreak({ checkedDates: dates, repeat:'daily' }).count;
  // Read-only projection of ProfileView's existing formula/curve. No XP writes or new rewards.
  const focusMinutes = Math.round(p.todos.reduce((n,t) => n + (t.doElapsedSec ?? 0), 0) / 60);
  const xp = completed.length * 10 + checks * 5 + Math.min(streak * 3, 60) + Math.floor(focusMinutes / 10);
  const thresholds = [0,300,800,1600,2800,4500,6800,9800,13500,18000,24000];
  let level = 0;
  for (let i = 1; i < thresholds.length; i++) if (xp >= thresholds[i]) level = i;
  const current = xp - thresholds[level], needed = level === 10 ? 0 : thresholds[level+1] - thresholds[level];
  const months = p.monthlyGoals.filter(g => g.month === today.slice(0,7));
  const years = p.annualGoals.filter(g => g.year === Number(today.slice(0,4)));
  const highlights = completed.filter(t => !!t.date).sort((a,b) => b.date!.localeCompare(a.date!)).slice(0,3);
  return <MoaFrame pageTitle="나의 정원" onQuick={quick.open} quickDisabled={p.isLoading}>
    <div className="mx-page-heading"><div><p className="mt-eyebrow">A GARDEN OF YOUR OWN</p><h1>나의 정원</h1><p>조금 느려도 괜찮아요. 모든 순간이 나를 키우니까.</p></div><span className="rg-pill"><Flower2 size={16}/>샘플 정원</span></div>
    <div className="rg-layout"><section className="mt-card rg-character"><p className="mt-eyebrow">MY LITTLE COMPANION</p><MoaBuddy/><h2>작은 새싹, 모아</h2><span className="rg-pill">Lv.{level} · 함께 자라는 중</span><p>오늘도 내 곁에서, 내 속도로.</p><progress max={needed || 1} value={needed ? current : 1} aria-label="레벨 진행률"/><strong data-garden-xp={xp}>{xp} XP</strong><small>{needed ? `다음 레벨까지 ${needed-current} XP` : '마지막 성장 단계예요.'}</small><p className="mx-help">기존 프로필의 XP 기준을 현재 샘플로 계산해요. 기록하지 못한 날에도 차감하지 않아요.</p></section>
    <div className="rg-directions"><section className="mt-card"><p className="mt-eyebrow">MY DIRECTION</p><h2><Target size={19}/>멀리 바라보는 목표</h2><h3>이번 달 · {Number(today.slice(5,7))}월</h3>{months.map(goal => {const result=monthlyRollup(goal,p.weeklyGoals,p.todos);return <div className="rc-goal" key={goal.id} data-month-goal-id={goal.id} data-goal-progress={result.pct}><div><strong>{goal.text}</strong><b>{result.pct}%</b></div><progress max="100" value={result.pct} aria-label={`${goal.text} 진행률`}/><small>{result.mode === 'manual' ? '월말 수동 완료 기준' : '연결 주간 목표·할 일 기준'}</small></div>;})}{!months.length && <p className="mt-empty">이번 달 목표가 없어요.</p>}
    <h3>올해 · {today.slice(0,4)}년</h3>{years.map(goal => {const result=annualRollup(goal,p.monthlyGoals,p.weeklyGoals,p.todos);return <div className="rc-goal" key={goal.id}><div><strong>{goal.text}</strong><b>{result.pct}%</b></div><progress max="100" value={result.pct} aria-label={`${goal.text} 진행률`}/><small>연결된 월간 목표 기준 · {goal.done ? '연간 수동 완료 표시 있음' : '천천히 진행 중'}</small></div>;})}{!years.length && <p className="mt-empty">올해의 방향은 천천히 정해도 괜찮아요.</p>}<p className="mx-help">목표 편집은 이번 검토 화면에서 지원하지 않아요.</p><Link className="mr-inline-link" to="/__moamoa-todos">오늘의 한 걸음으로 이어가기</Link></section>
    <section className="mt-card"><h2><Sprout size={19}/>언젠가 피워낼 씨앗</h2><p className="mx-help">버킷리스트 / 언젠가 하고 싶은 일 · 기존 씨앗 데이터 조회</p>{loading ? <p role="status">씨앗을 모으고 있어요.</p> : seeds.map(seed => <div className="rg-seed" key={seed.id}><Sprout size={19}/><strong>{seed.text}</strong><small>{seed.status === 'grown' ? '피어난 씨앗' : '꿈꾸는 중'}</small></div>)}{!loading && !seeds.length && <p className="mt-empty">서두르지 않아도 되는 꿈을 모아보세요.</p>}<p className="mx-help">씨앗 추가·수정·완료 편집은 이번 Preview에서 지원하지 않아요.</p></section></div>
    <section className="mt-card rg-growth"><h2><Sun size={19}/>성장 기록</h2><div className="rg-counts"><div><b>{completed.length}</b><span>완료한 할 일</span></div><div><b>{checks}</b><span>습관 체크</span></div><div><b>{dates.length}</b><span>기록을 모은 날</span></div></div><p className="mx-help">현재 샘플 상태의 요약이에요. 과거 XP 변동 이력을 새로 생성하지 않아요.</p></section>
    <section className="mt-card rg-highlights"><h2><Heart size={19}/>기억에 남는 작은 성취</h2><div className="rg-highlight-grid">{highlights.map(todo => <article key={todo.id}><Sun size={22}/><small>{todo.date}</small><strong>{todo.text}</strong></article>)}</div>{!highlights.length && <p className="mt-empty">작은 성취가 쌓일 자리를 비워두었어요.</p>}</section></div>
    <ReviewQuickSheet {...quick}/>
  </MoaFrame>;
}
