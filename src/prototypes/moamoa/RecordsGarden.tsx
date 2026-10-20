import { useState } from 'react';
import { ArrowUpRight, BookOpen, ChevronRight, Clock3, Feather, Flower2, Heart, Moon, Sprout, Sun, Target } from 'lucide-react';
import { monthlyRollup } from '../../app/components/period/periodProgress';
import { useMoa } from './PrototypeState';
import { Card, GoalRow, MoaBuddy, Progress, SectionTitle } from './ui';
import { TODAY, MONDAY, categories, monthlyGoals, weeklyGoals, shortDuration, addDate } from './sample';
export function Records() {
  const { timeReport, openQuick, setSheet, blocks, todos } = useMoa();
  const [period, setPeriod] = useState('day');
  const start = period === 'day' ? TODAY : period === 'week' ? MONDAY : '2026-10-01';
  const end = period === 'day' ? TODAY : period === 'week' ? '2026-10-25' : '2026-10-31';
  const report = timeReport(start, end);
  const favorites = [
    { title: '시간 모으기', hint: '한 일과 소요 시간', icon: Clock3, action: () => openQuick(TODAY, 'time'), tone: 'sage' },
    { title: '오늘의 마음', hint: '지금 내 기분은?', icon: Heart, action: () => setSheet('mood'), tone: 'peach' },
    { title: '수면 기록', hint: '잘 쉬었나요?', icon: Moon, action: () => setSheet('sleep'), tone: 'lavender' },
    { title: '하루 한 줄', hint: '남기고 싶은 순간', icon: Feather, action: () => setSheet('review-day'), tone: 'sand' },
  ];
  const chart = period === 'day' ? categories.map(category => ({ label: category.name, minutes: report.byTag.get(category.id)?.minutes ?? 0, color: category.color }))
    : period === 'week' ? Array.from({ length: 7 }, (_, i) => ({ label: ['월', '화', '수', '목', '금', '토', '일'][i], minutes: timeReport(addDate(MONDAY, i), addDate(MONDAY, i)).coverage.recordedMinutes, color: categories[1].color }))
    : Array.from({ length: 5 }, (_, i) => ({ label: `${i * 7 + 1}–${Math.min(i * 7 + 7, 31)}일`, minutes: timeReport(addDate('2026-10-01', i * 7), addDate('2026-10-01', Math.min(i * 7 + 6, 30))).coverage.recordedMinutes, color: categories[1].color }));
  return <>
    <div className="mo-page-heading"><div><p className="mo-eyebrow">COLLECT YOUR LITTLE MOMENTS</p><h1>나를 알아가는 기록</h1><p>모든 걸 적기보다, 지금 남기고 싶은 것부터.</p></div></div>
    <div className="mo-record-favorites">{favorites.map(item => <button className={`mo-record-shortcut mo-tone-${item.tone}`} key={item.title} onClick={item.action}><span><item.icon size={23} /></span><strong>{item.title}</strong><small>{item.hint}</small><ArrowUpRight size={15} /></button>)}</div>
    <div className="mo-record-layout"><Card className="mo-analysis-card"><SectionTitle title="시간은 어디에 머물렀나요?" /><div className="mo-analysis-controls"><div className="mo-segment" aria-label="시간 분석 기간">{[['day', '일간'], ['week', '주간'], ['month', '월간']].map(([id, name]) => <button key={id} aria-pressed={period === id} onClick={() => setPeriod(id)}>{name}</button>)}</div><small>{start.replaceAll('-', '.')} — {end.replaceAll('-', '.')}</small></div>
      <div className="mo-analysis-total"><strong data-testid="records-actual-time">{shortDuration(report.coverage.recordedMinutes)}</strong><span>실제로 모은 시간</span></div>
      <div className="mo-chart" aria-label="카테고리 또는 날짜별 실제 시간">{chart.map(item => <div key={item.label} className="mo-chart-column"><small>{item.minutes ? `${Math.round(item.minutes)}분` : '—'}</small><div><span style={{ height: `${item.minutes / Math.max(1, ...chart.map(row => row.minutes)) * 100}%`, background: item.color }} /></div><span>{item.label}</span></div>)}</div>
      <div className="mo-category-summary">{categories.map(category => <div key={category.id}><i style={{ background: category.color }} /><span>{category.name}</span><strong>{shortDuration(report.byTag.get(category.id)?.minutes ?? 0)}</strong></div>)}</div><p className="mo-section-hint">계획 시간과 수면·운동 로그는 자동으로 더하지 않아요.</p>
      {report.coverage.unclassifiedMinutes > 0 && <p className="mo-section-hint">미분류 실제 시간 {report.coverage.unclassifiedMinutes}분도 따로 확인할 수 있어요.</p>}
    </Card>
    <div className="mo-record-side"><Card><SectionTitle title="최근 모은 순간" />{blocks.slice().reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(block => <div className="mo-recent-record" key={block.id}><Clock3 size={17} /><div><strong>{todos.find(todo => todo.id === block.todoId)?.text}</strong><small>{block.date.slice(5).replace('-', '.')} · {shortDuration(block.elapsedSec / 60)}</small></div></div>)}</Card>
      <Card><SectionTitle title="조금 더 길게 돌아보기" />{[['review-week', '한 주의 이야기'], ['review-month', '한 달의 이야기']].map(([id, name]) => <button className="mo-link-row" key={id} onClick={() => setSheet(id as 'review-week' | 'review-month')}><BookOpen size={17} />{name}<ChevronRight size={16} /></button>)}</Card>
      <details className="mo-more-records"><summary>다른 생활 기록 펼치기<ChevronRight size={16} /></summary><p>운동 · 컨디션 · 생리 주기 · 셀프케어 · 일기</p><small>기존 기록 기능으로 이어질 탐색 구조예요. 상세 화면은 다음 단계에서 연결해요.</small></details>
    </div></div>
  </>;
}
export function Garden() {
  const { todos, navigate, seeds, toggleSeed, busy } = useMoa();
  const growth = monthlyRollup(monthlyGoals[0], weeklyGoals, todos);
  return <>
    <div className="mo-page-heading"><div><p className="mo-eyebrow">A GARDEN OF YOUR OWN</p><h1>차곡차곡 자라는 나의 정원</h1><p>조금 느려도 괜찮아요. 모든 순간이 나를 키우니까.</p></div><span className="mo-pill"><Flower2 size={15} />성장 모습 시안</span></div>
    <div className="mo-garden-layout"><Card className="mo-garden-character"><span className="mo-eyebrow">MY LITTLE COMPANION</span><MoaBuddy /><h2>작은 새싹, 모아</h2><span className="mo-pill">Lv.2 · 새싹</span><p>오늘도 내 곁에서, 내 속도로.</p><div className="mo-growth"><Progress value={17.5} label="캐릭터 성장 예시" /><small>140 / 800 XP · 기존 레벨 곡선의 샘플</small></div><p className="mo-section-hint">기록하지 못한 날에도, 정원은 그대로 기다려요.</p></Card>
      <div className="mo-garden-right"><Card><SectionTitle eyebrow="MY DIRECTION" title="멀리 바라보는 목표" /><div className="mo-long-goal"><Target size={20} /><div><small>올해의 방향 · 샘플</small><strong>좋아하는 것들로 나만의 일상 만들기</strong></div></div><div className="mo-monthly-goal"><small>10월의 작은 목표</small><div><strong>{monthlyGoals[0].text}</strong><b>{growth.pct}%</b></div><Progress value={growth.pct} label="월간 목표 진행률" /></div>{weeklyGoals.map(goal => <GoalRow key={goal.id} goal={goal} compact />)}<button className="mo-text-button" onClick={() => navigate('quests')}>오늘의 한 걸음으로 이어가기<ArrowUpRight size={15} /></button></Card>
      <Card><SectionTitle title="언젠가 피워낼 씨앗" /><p className="mo-section-hint">서두르지 않아도 되는 나의 버킷리스트</p>{['작은 책방에서 하루 보내기', '나만의 작은 서비스를 완성하기', '혼자 떠나는 하루 여행'].map((text, index) => <button key={text} className="mo-seed-row" aria-pressed={seeds[index]} disabled={busy} onClick={() => toggleSeed(index)}><Sprout size={19} /><span>{text}</span><small>{seeds[index] ? '피어난 씨앗' : '꿈꾸는 중'}</small></button>)}</Card></div>
      <Card className="mo-garden-highlights"><SectionTitle title="기억에 남는 작은 성취" /><div className="mo-highlights"><div><Sun size={24} /><small>10.20</small><strong>나에게 산책을 선물한 날</strong></div><div><Feather size={24} /><small>10.19</small><strong>작은 계획을 시작한 날</strong></div><div><Heart size={24} /><small>10.17</small><strong>아무것도 안 해도 괜찮았던 날</strong></div></div></Card>
    </div>
  </>;
}
