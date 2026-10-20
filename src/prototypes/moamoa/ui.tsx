import type { ReactNode } from 'react';
import { ArrowUpRight, Check, ChevronRight, Circle, Plus, Sprout } from 'lucide-react';
import type { Todo, WeeklyGoal } from '../../app/store';
import { weeklyRollup } from '../../app/components/period/periodProgress';
import { useMoa } from './PrototypeState';
import { categories, TODAY } from './sample';

export function MoaBuddy({ small = false }: { small?: boolean }) {
  return <svg className={`mo-buddy ${small ? 'mo-buddy-small' : ''}`} viewBox="0 0 230 190" fill="none" role="img" aria-label="새싹을 머리에 올린 모아 캐릭터">
    <ellipse cx="117" cy="171" rx="73" ry="9" fill="var(--mo-shadow-ink)" opacity=".10" />
    <path d="M54 129C33 110 45 79 69 71C72 41 99 37 117 54C139 35 165 51 164 73C192 86 193 114 175 132C175 159 150 170 115 169C79 170 52 159 54 129Z" fill="var(--mo-buddy-fill)" stroke="var(--mo-buddy-line)" strokeWidth="2.5" />
    <path d="M114 57C114 37 119 22 133 14" stroke="var(--mo-green)" strokeWidth="4" strokeLinecap="round" />
    <path d="M119 35C104 36 92 28 93 17C109 14 121 22 119 35Z" fill="var(--mo-sage)" stroke="var(--mo-green)" strokeWidth="2" />
    <path d="M123 25C126 10 143 7 152 12C150 27 136 33 123 25Z" fill="var(--mo-sage)" stroke="var(--mo-green)" strokeWidth="2" />
    <ellipse cx="88" cy="116" rx="12" ry="7" fill="var(--mo-peach)" /><ellipse cx="147" cy="116" rx="12" ry="7" fill="var(--mo-peach)" />
    <ellipse cx="99" cy="105" rx="3" ry="4" fill="var(--mo-ink)" /><ellipse cx="136" cy="105" rx="3" ry="4" fill="var(--mo-ink)" />
    <path d="M111 114C113 119 121 119 124 114" stroke="var(--mo-ink)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M62 131L74 137M163 136L176 129" stroke="var(--mo-buddy-line)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M28 61L31 52L34 61L43 64L34 67L31 76L28 67L19 64Z" fill="var(--mo-gold)" />
    <path d="M196 121L198 115L200 121L206 123L200 125L198 131L196 125L190 123Z" fill="var(--mo-gold)" />
  </svg>;
}
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
