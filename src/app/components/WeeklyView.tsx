import { useState, useRef, useEffect } from 'react';
import React from 'react';
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  getISOWeek, getYear, parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, Target,
  ArrowRight, Zap, X,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { usePlanner, getWeekKey, Todo, Tag as TagType } from '../store';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';

// ── Helpers ──
function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function getTodoColor(
  todo: Todo,
  tags: TagType[],
  projects: { id: string; color: string }[],
): string | null {
  if (todo.tags && todo.tags.length > 0) {
    const tag = tags.find(tg => tg.id === todo.tags![0]);
    if (tag) return tag.color;
  }
  if (todo.projectId) {
    const proj = projects.find(p => p.id === todo.projectId);
    if (proj) return proj.color;
  }
  return null;
}

// ── Assign Day Popover ──
function AssignDayPopover({
  weekDays, onAssign, onClose,
}: {
  weekDays: Date[];
  onAssign: (date: string) => void;
  onClose: () => void;
}) {
  const { t } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-30 rounded-xl p-2 shadow-lg"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, minWidth: 180 }}
    >
      <p style={{ fontSize: 10, color: t.textMuted, padding: '2px 6px 6px', fontWeight: 600, letterSpacing: '0.06em' }}>
        날짜 배정
      </p>
      {weekDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
        return (
          <button
            key={dateStr}
            onClick={() => onAssign(dateStr)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-left"
            style={{ fontSize: 12, color: isToday ? t.accent : t.text, fontWeight: isToday ? 700 : 400 }}
          >
            <span style={{ color: t.textMuted, width: 16, fontSize: 10 }}>
              {format(day, 'E', { locale: ko })}
            </span>
            <span>{format(day, 'M/d')}</span>
            {isToday && <span style={{ fontSize: 9, color: t.accent }}>(오늘)</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Brain-dump Item ──
function BrainDumpItem({
  id, text, weekDays, onAssign, onDelete,
}: {
  id: string;
  text: string;
  weekDays: Date[];
  onAssign: (id: string, date: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const [showPopover, setShowPopover] = useState(false);

  return (
    <div
      className="group flex items-start gap-2 p-2.5 rounded-xl"
      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}
    >
      <Zap size={12} color={t.accent} className="flex-shrink-0 mt-0.5" />
      <span style={{ fontSize: 13, color: t.text, flex: 1, lineHeight: 1.4 }}>{text}</span>
      <div className="relative flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setShowPopover(v => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
          style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent, fontWeight: 700 }}
          title="일별 배정"
        >
          <ArrowRight size={10} /> 배정
        </button>
        <button onClick={() => onDelete(id)} className="p-1 rounded-lg opacity-0 group-hover:opacity-100">
          <X size={11} color={t.textMuted} />
        </button>
        {showPopover && (
          <AssignDayPopover
            weekDays={weekDays}
            onAssign={(date) => { onAssign(id, date); setShowPopover(false); }}
            onClose={() => setShowPopover(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Draggable Todo Card ──
function DraggableTodoCard({
  todo, tags, projects, dateStr, isDragging, onClick,
}: {
  todo: Todo;
  tags: TagType[];
  projects: { id: string; name: string; color: string }[];
  dateStr: string;
  isDragging: boolean;
  onClick: () => void;
}) {
  const { t } = useTheme();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: todo.id });
  const color = getTodoColor(todo, tags, projects);
  const proj = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;
  const todoTags = (todo.tags || [])
    .map(id => tags.find(tg => tg.id === id))
    .filter(Boolean) as TagType[];

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    backgroundColor: todo.status === 'done' ? t.bgSub : t.card,
    border: `1px solid ${t.borderLight}`,
    borderLeft: `3px solid ${color || t.borderLight}`,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="w-full text-left rounded-lg p-2 transition-opacity"
    >
      <div className="flex items-start gap-1.5">
        <div className="flex-shrink-0 mt-0.5">
          <div
            className="w-3 h-3 rounded-full border"
            style={{
              borderColor: todo.status === 'done' ? t.checkDone : t.border,
              backgroundColor: todo.status === 'done' ? t.checkDone : 'transparent',
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p style={{
            fontSize: 11,
            color: todo.status === 'done' ? t.textSub : t.text,
            textDecoration: todo.status === 'done' ? 'line-through' : 'none',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {todo.text}
          </p>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {todoTags.slice(0, 2).map(tag => (
              <span key={tag.id} style={{
                fontSize: 8, fontWeight: 700, color: tag.color,
                backgroundColor: tag.color + '18', padding: '0px 4px',
                borderRadius: 3, border: `1px solid ${tag.color}30`,
                pointerEvents: 'none',
              }}>#{tag.name}</span>
            ))}
            {proj && (
              <span style={{
                fontSize: 8, fontWeight: 700, color: proj.color,
                backgroundColor: proj.color + '18', padding: '0px 4px',
                borderRadius: 3, border: `1px solid ${proj.color}30`,
                pointerEvents: 'none',
              }}>● {proj.name}</span>
            )}
            {todo.planStart && (
              <span style={{ fontSize: 8, color: t.textMuted, pointerEvents: 'none' }}>
                {todo.planStart}~{todo.planEnd}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drag Overlay Card (floating ghost) ──
function OverlayCard({ todo, tags, projects }: {
  todo: Todo;
  tags: TagType[];
  projects: { id: string; name: string; color: string }[];
}) {
  const { t } = useTheme();
  const color = getTodoColor(todo, tags, projects);

  return (
    <div
      className="rounded-lg p-2 shadow-xl"
      style={{
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        borderLeft: `3px solid ${color || t.accent}`,
        opacity: 0.95,
        minWidth: 140,
        maxWidth: 180,
        transform: 'rotate(2deg)',
      }}
    >
      <p style={{ fontSize: 11, color: t.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {todo.text}
      </p>
    </div>
  );
}

// ── Day Column (droppable) ──
function DayColumn({ day, todos, tags, projects, activeDragId }: {
  day: Date;
  todos: Todo[];
  tags: TagType[];
  projects: { id: string; name: string; color: string }[];
  activeDragId: string | null;
}) {
  const { t } = useTheme();
  const { setSelectedDate, updateTodo } = usePlanner();
  const navigate = useNavigate();
  const dateStr = format(day, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isToday = dateStr === todayStr;

  const { setNodeRef, isOver } = useDroppable({ id: dateStr });

  const dayTodos = todos.filter(
    td => td.date === dateStr && td.status !== 'backlog' && td.status !== 'cancelled',
  );
  const doneCount = dayTodos.filter(td => td.status === 'done').length;

  const goToDay = () => {
    setSelectedDate(dateStr);
    navigate('/daily');
  };

  const isDraggingOverMe = isOver && activeDragId !== null;

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden transition-all"
      style={{
        minWidth: 150,
        border: `1px solid ${isDraggingOverMe ? t.accent : isToday ? t.accent : t.borderLight}`,
        backgroundColor: isDraggingOverMe ? t.accentLight : t.card,
        boxShadow: isDraggingOverMe
          ? `0 0 0 2px ${t.accent}60, 0 4px 16px ${t.accent}30`
          : isToday
          ? `0 0 0 2px ${t.accentLight}`
          : undefined,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Day header */}
      <button
        onClick={goToDay}
        className="flex items-center justify-between px-3 py-2.5 transition-colors w-full"
        style={{
          backgroundColor: isToday ? t.accent : t.bgSub,
          borderBottom: `1px solid ${isToday ? t.accent + '80' : t.borderLight}`,
        }}
      >
        <div className="text-left">
          <div style={{ fontSize: 10, color: isToday ? 'rgba(255,255,255,0.8)' : t.textSub }}>
            {format(day, 'E', { locale: ko })}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: isToday ? '#fff' : t.text }}>
            {format(day, 'd')}
          </div>
        </div>
        <div style={{ fontSize: 10, color: isToday ? 'rgba(255,255,255,0.9)' : t.textMuted, textAlign: 'right' }}>
          <div>{doneCount}/{dayTodos.length}</div>
          <div style={{ fontSize: 8 }}>완료</div>
        </div>
      </button>

      {/* Progress bar */}
      {dayTodos.length > 0 && (
        <div className="h-1 w-full" style={{ backgroundColor: t.borderLight }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${(doneCount / dayTodos.length) * 100}%`,
              backgroundColor: isToday ? t.accent : t.success,
            }}
          />
        </div>
      )}

      {/* Drop zone indicator */}
      {isDraggingOverMe && (
        <div
          className="mx-2 mt-2 rounded-lg flex items-center justify-center"
          style={{
            height: 32,
            border: `2px dashed ${t.accent}`,
            backgroundColor: t.accentLight,
            fontSize: 11,
            color: t.accent,
            fontWeight: 700,
          }}
        >
          여기에 놓기
        </div>
      )}

      {/* Todos */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-1.5"
        style={{ maxHeight: 260, minHeight: 40 }}
      >
        {dayTodos.map(todo => (
          <DraggableTodoCard
            key={todo.id}
            todo={todo}
            tags={tags}
            projects={projects}
            dateStr={dateStr}
            isDragging={todo.id === activeDragId}
            onClick={() => { setSelectedDate(dateStr); navigate('/daily'); }}
          />
        ))}
        {dayTodos.length === 0 && !isDraggingOverMe && (
          <div className="flex items-center justify-center h-10">
            <p style={{ fontSize: 11, color: t.textMuted }}>비어 있음</p>
          </div>
        )}
      </div>

      {/* Go to day */}
      <button
        onClick={goToDay}
        className="flex items-center gap-1 px-3 py-2 transition-colors w-full"
        style={{ color: t.textMuted, fontSize: 11, borderTop: `1px solid ${t.borderLight}` }}
      >
        <Plus size={10} /> 일간 뷰에서 추가
      </button>
    </div>
  );
}

// ── Weekly Goals Section ──
function WeeklyGoalsSection({ weekKey, viewDate }: { weekKey: string; viewDate: Date }) {
  const { weeklyGoals, monthlyGoals, addWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal } = usePlanner();
  const { t } = useTheme();
  const [newGoalText, setNewGoalText] = useState('');
  const [selectedMonthlyGoalId, setSelectedMonthlyGoalId] = useState('');

  const currentMonth = format(viewDate, 'yyyy-MM');
  const thisWeekGoals = weeklyGoals.filter(g => g.weekKey === weekKey);
  const thisMonthGoals = monthlyGoals.filter(g => g.month === currentMonth);
  const donePct = thisWeekGoals.length
    ? Math.round((thisWeekGoals.filter(g => g.done).length / thisWeekGoals.length) * 100)
    : 0;

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    addWeeklyGoal(newGoalText.trim(), selectedMonthlyGoalId || undefined, weekKey);
    setNewGoalText('');
    setSelectedMonthlyGoalId('');
  };

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={13} color={t.accent} />
          <span style={{ fontSize: 11, color: t.accent, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            이번 주 목표
          </span>
        </div>
        <span style={{ fontSize: 12, color: t.accent, fontWeight: 700 }}>{donePct}%</span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: t.bgSub }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${donePct}%`, backgroundColor: t.accent }} />
      </div>

      <div className="space-y-2 mb-3">
        {thisMonthGoals.map(mg => {
          const subGoals = thisWeekGoals.filter(g => g.monthlyGoalId === mg.id);
          if (subGoals.length === 0) return null;
          return (
            <div key={mg.id}>
              <div style={{ fontSize: 10, color: t.textSub, marginBottom: 4, fontWeight: 700 }}>📌 {mg.text}</div>
              <div className="space-y-1.5 ml-2">
                {subGoals.map(goal => (
                  <div key={goal.id} className="flex items-center gap-2">
                    <button onClick={() => toggleWeeklyGoal(goal.id)}>
                      <CheckCircle2 size={14} color={goal.done ? t.checkDone : t.border}
                        fill={goal.done ? t.checkDone : 'none'} />
                    </button>
                    <span style={{
                      flex: 1, fontSize: 12,
                      color: goal.done ? t.textSub : t.text,
                      textDecoration: goal.done ? 'line-through' : 'none',
                    }}>
                      {goal.text}
                    </span>
                    <button onClick={() => deleteWeeklyGoal(goal.id)}>
                      <Trash2 size={10} color={t.textMuted} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {thisWeekGoals.filter(g => !g.monthlyGoalId).map(goal => (
          <div key={goal.id} className="flex items-center gap-2">
            <button onClick={() => toggleWeeklyGoal(goal.id)}>
              <CheckCircle2 size={14} color={goal.done ? t.checkDone : t.border}
                fill={goal.done ? t.checkDone : 'none'} />
            </button>
            <span style={{
              flex: 1, fontSize: 12,
              color: goal.done ? t.textSub : t.text,
              textDecoration: goal.done ? 'line-through' : 'none',
            }}>
              {goal.text}
            </span>
            <button onClick={() => deleteWeeklyGoal(goal.id)}>
              <Trash2 size={10} color={t.textMuted} />
            </button>
          </div>
        ))}
        {thisWeekGoals.length === 0 && (
          <p style={{ fontSize: 12, color: t.textMuted }}>이번 주 목표를 추가해보세요</p>
        )}
      </div>

      <div className="space-y-2">
        <input
          value={newGoalText}
          onChange={e => setNewGoalText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
          placeholder="새 주간 목표..."
          className="w-full px-3 py-2 rounded-xl outline-none"
          style={{ fontSize: 12, backgroundColor: t.bgSub, color: t.text, border: `1px solid ${t.border}` }}
        />
        {thisMonthGoals.length > 0 && (
          <select
            value={selectedMonthlyGoalId}
            onChange={e => setSelectedMonthlyGoalId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl outline-none"
            style={{ fontSize: 11, backgroundColor: t.bgSub, color: t.textSub, border: `1px solid ${t.border}` }}
          >
            <option value="">월간 목표 연결 (선택)</option>
            {thisMonthGoals.map(mg => <option key={mg.id} value={mg.id}>{mg.text}</option>)}
          </select>
        )}
        <button
          onClick={handleAddGoal}
          className="flex items-center gap-1 px-3 py-2 rounded-xl w-full justify-center"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 12 }}
        >
          <Plus size={12} /> 목표 추가
        </button>
      </div>
    </div>
  );
}

// ── Main WeeklyView ──
export function WeeklyView() {
  const {
    todos, brainstormItems, addWeeklyBrainstorm, weeklyBrainstormAssign,
    deleteBrainstormItem, setSelectedDate, tags, projects, updateTodo,
  } = usePlanner();
  const { t } = useTheme();

  const [viewDate, setViewDate] = useState(new Date());
  const [brainInput, setBrainInput] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(viewDate, { weekStartsOn: 1 });
  const weekKey = getWeekKey(viewDate);
  const days = getWeekDays(weekStart);

  const weekBrainItems = brainstormItems.filter(b => b.weekKey === weekKey);

  const handleBrainAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brainInput.trim()) return;
    addWeeklyBrainstorm(brainInput.trim(), weekKey);
    setBrainInput('');
  };

  const allWeekTodos = todos.filter(td => {
    if (!td.date) return false;
    const d = parseISO(td.date);
    return d >= weekStart && d <= weekEnd && td.status !== 'backlog';
  });
  const allDone = allWeekTodos.filter(td => td.status === 'done').length;
  const allTotal = allWeekTodos.filter(td => td.status !== 'cancelled').length;

  const activeTodo = activeDragId ? todos.find(t => t.id === activeDragId) ?? null : null;

  // dnd-kit: 5px threshold to distinguish click vs drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;
    const todoId = String(active.id);
    const newDate = String(over.id); // over.id = 'yyyy-MM-dd'

    // validate: must be a date string from this week
    const isWeekDate = days.some(d => format(d, 'yyyy-MM-dd') === newDate);
    if (!isWeekDate) return;

    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.date === newDate) return;

    // updateTodo already calls db.todos.upsert → Supabase save
    updateTodo(todoId, { date: newDate });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: t.bg }}>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
        style={{ backgroundColor: t.card, borderBottom: `1px solid ${t.border}` }}
      >
        <button onClick={() => setViewDate(subWeeks(viewDate, 1))} className="p-2 rounded-xl" style={{ color: t.textSub }}>
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            {format(weekStart, 'M월 d일')} – {format(weekEnd, 'M월 d일', { locale: ko })}
          </div>
          <div style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>
            {getYear(viewDate)}년 {getISOWeek(viewDate)}주차 · {allDone}/{allTotal} 완료
          </div>
        </div>
        <button onClick={() => setViewDate(addWeeks(viewDate, 1))} className="p-2 rounded-xl" style={{ color: t.textSub }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Body: left panel + right 7-day board */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: brain dump + weekly goals */}
        <div
          className="flex flex-col overflow-y-auto p-4 space-y-4 flex-shrink-0"
          style={{ width: 280, borderRight: `1px solid ${t.border}`, backgroundColor: t.bg }}
        >
          {/* Brain dump card */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: `1px solid ${t.borderLight}`, backgroundColor: t.accentSoft || t.accentLight }}
            >
              <Zap size={13} color={t.accent} />
              <span style={{ fontSize: 11, fontWeight: 800, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                이번 주 할 일 모으기
              </span>
            </div>
            <div className="p-3 space-y-2">
              <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
                생각나는 할 일을 자유롭게 적어두고, 날짜를 배정하세요.
              </p>
              {weekBrainItems.map(item => (
                <BrainDumpItem
                  key={item.id}
                  id={item.id}
                  text={item.text}
                  weekDays={days}
                  onAssign={weeklyBrainstormAssign}
                  onDelete={deleteBrainstormItem}
                />
              ))}
              {weekBrainItems.length === 0 && (
                <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', padding: '8px 0' }}>
                  아이디어를 입력해보세요
                </p>
              )}
              <form onSubmit={handleBrainAdd} className="flex gap-2 mt-1">
                <input
                  value={brainInput}
                  onChange={e => setBrainInput(e.target.value)}
                  placeholder="할 일 입력..."
                  className="flex-1 rounded-xl px-3 py-2 border outline-none"
                  style={{ borderColor: t.border, fontSize: 12, backgroundColor: t.bgSub, color: t.text }}
                />
                <button
                  type="submit"
                  className="px-2.5 py-2 rounded-xl"
                  style={{ backgroundColor: t.accent, color: '#fff' }}
                >
                  <Plus size={13} />
                </button>
              </form>
            </div>
          </div>

          {/* Weekly goals */}
          <WeeklyGoalsSection weekKey={weekKey} viewDate={viewDate} />
        </div>

        {/* Right: 7-day kanban with DnD */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
            <div className="flex gap-3" style={{ minWidth: 7 * 158, alignItems: 'flex-start' }}>
              {days.map(day => (
                <div key={format(day, 'yyyy-MM-dd')} className="flex-1" style={{ minWidth: 150 }}>
                  <DayColumn
                    day={day}
                    todos={todos}
                    tags={tags}
                    projects={projects}
                    activeDragId={activeDragId}
                  />
                </div>
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeTodo ? (
              <OverlayCard todo={activeTodo} tags={tags} projects={projects} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
