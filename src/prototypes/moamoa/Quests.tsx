import { useState } from 'react';
import { Check, Filter, Plus, Sprout } from 'lucide-react';
import { useMoa } from './PrototypeState';
import { Card, GoalRow, SectionTitle, TodoRow } from './ui';
import { TODAY, weeklyGoals, categories } from './sample';
export function Quests() {
  const { todos, weekTodos, openQuick } = useMoa();
  const [scope, setScope] = useState('today');
  const [category, setCategory] = useState('all');
  const source = scope === 'today' ? todos.filter(todo => todo.date === TODAY) : scope === 'week' ? weekTodos : todos.filter(todo => !todo.date);
  const rows = source.filter(todo => todo.status !== 'cancelled' && todo.status !== 'backlog' && (category === 'all' || todo.tags?.includes(category)));
  const done = rows.filter(todo => todo.status === 'done').length;
  return <>
    <div className="mo-page-heading"><div><p className="mo-eyebrow">SMALL STEPS, BIG STORIES</p><h1>나의 작은 퀘스트</h1><p>오늘의 한 걸음이 내일의 이야기가 돼요.</p></div><button className="mo-primary" onClick={() => openQuick(scope === 'undated' ? null : TODAY)}><Plus size={17} />퀘스트 추가</button></div>
    <div className="mo-quests-layout"><Card className="mo-quest-goals"><SectionTitle title="목표로 이어지는 한 걸음" />{weeklyGoals.map(goal => <GoalRow key={goal.id} goal={goal} compact />)}<p className="mo-section-hint">할 일을 완료하면 연결된 목표에도 함께 반영돼요.</p></Card>
    <Card className="mo-quest-list"><div className="mo-quest-tabs" aria-label="퀘스트 기간">{[['today', '오늘'], ['week', '이번 주'], ['undated', '날짜 미정']].map(([id, name]) => <button key={id} aria-pressed={scope === id} onClick={() => setScope(id)}>{name}</button>)}</div>
      <div className="mo-category-filters" aria-label="퀘스트 분류"><Filter size={15} /><button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>전체</button>{categories.map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}><i style={{ background: item.color }} />{item.name}</button>)}</div>
      <div className="mo-quest-list-heading"><strong>{scope === 'undated' ? '언제 할지는 천천히' : scope === 'week' ? '한 주의 작은 계획' : '오늘 모을 작은 조각들'}</strong><span><Check size={13} />{done}/{rows.length}</span></div>
      {rows.length ? rows.map(todo => <TodoRow key={todo.id} todo={todo} detail />) : <p className="mo-empty">여기는 아직 여백이에요. 하고 싶은 일이 생기면 모아두세요.</p>}
      <button className="mo-add-inline" onClick={() => openQuick(scope === 'undated' ? null : TODAY)}><Plus size={16} />제목만으로 가볍게 추가</button>
    </Card></div>
    <div className="mo-kind-note"><Sprout size={21} /><div><strong>오늘 못한 일은, 내일의 나에게.</strong><span>쉬어가는 날에도 경험치가 줄어들지 않아요.</span></div></div>
  </>;
}
