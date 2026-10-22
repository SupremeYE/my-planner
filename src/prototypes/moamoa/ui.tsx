import type { ReactNode } from 'react';
import { ArrowUpRight, Check, ChevronRight, Circle, Plus, Sprout } from 'lucide-react';
import type { Todo, WeeklyGoal } from '../../app/store';
import { weeklyRollup } from '../../app/components/period/periodProgress';
import { useMoa } from './PrototypeState';
import { categories, TODAY } from './sample';

export { MoaBuddy } from '../../app/components/moamoa/MoaBuddy';
export function Card({ children, className = '', ...props }: { children: ReactNode; className?: string; [key: string]: unknown }) {
  return <section className={`mo-card ${className}`} {...props}>{children}</section>;
}
export function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="mo-section-title"><div>{eyebrow && <p className="mo-eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
    {action && <button className="mo-text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>;
}
export function Progress({ value, label }: { value: number; label: string }) {
  return <div className="mo-progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%` }} /></div>;
}
export function GoalRow({ goal, compact = false }: { goal: WeeklyGoal; compact?: boolean }) {
  const { todos } = useMoa(); const progress = weeklyRollup(goal, todos);
  return <div className={`mo-goal-row ${compact ? 'mo-compact' : ''}`} data-goal-id={goal.id} data-goal-progress={progress.pct}>
    <div><span className="mo-goal-sprout"><Sprout size={16} /></span><strong>{goal.text}</strong><span className="mo-number">{progress.pct}%</span></div>
    <Progress value={progress.pct} label={`${goal.text} 진행률`} />
    {!compact && <small>작은 걸음 {progress.done}/{progress.total}개를 모았어요</small>}
  </div>;
}
export function TodoRow({ todo, detail = false }: { todo: Todo; detail?: boolean }) {
  const { toggleTodo, busy, setSheet } = useMoa();
  const category = categories.find(item => item.id === todo.tags?.[0]);
  return <div className={`mo-todo-row ${todo.status === 'done' ? 'mo-done' : ''}`} data-todo-id={todo.id}>
    <button type="button" className="mo-check" role="checkbox" aria-checked={todo.status === 'done'} aria-label={`${todo.text} 완료`} disabled={busy} onClick={() => toggleTodo(todo)}>
      {todo.status === 'done' ? <Check size={15} strokeWidth={2.8} /> : <Circle size={21} strokeWidth={1.4} />}
    </button>
    <div className="mo-todo-copy"><span>{todo.text}</span>{detail && <small><i style={{ background: category?.color }} />{category?.name ?? '미분류'}{todo.date ? ` · ${Number(todo.date.slice(5, 7))}.${Number(todo.date.slice(8))}` : ' · 날짜 미정'}</small>}</div>
    {todo.planStart && !detail && <span className="mo-time">{todo.planStart}</span>}
    {detail && <button className="mo-icon-button mo-row-edit" aria-label={`${todo.text} 계획 편집`} onClick={() => setSheet({ kind: 'edit', recordKind: 'todo', id: todo.id })}><ArrowUpRight size={15} /></button>}
  </div>;
}
export function AddButton({ label = '할 일 추가', date = TODAY }: { label?: string; date?: string | null }) {
  const { openQuick } = useMoa();
  return <button className="mo-add-inline" onClick={() => openQuick(date)}><Plus size={16} />{label}</button>;
}
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="mo-empty"><Sprout size={20} />{children}</p>;
}
