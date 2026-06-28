import { useState, useMemo } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import {
  Plus, Trash2, ChevronDown, ChevronUp,
  Check, Star, Pencil, ListTodo, Play,
  AlertTriangle, ArrowDownToLine,
} from 'lucide-react';
import { usePlanner, Todo, TodoStatus, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';
import { MandalartSourceBadge } from './mandalart/MandalartSourceBadge';
import { TodoModal } from './TodoModal';
import { EventModal } from './EventModal';
import { AddEntryMenu } from './AddEntryMenu';

// ─── Constants ───────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active:     { label: '예정',   color: '#6B7280', bgColor: '#F3F4F6' },
  inProgress: { label: '진행중', color: '#059669', bgColor: '#D1FAE5' },
  done:       { label: '완료',   color: '#515f74', bgColor: '#d5e3fd' },
  snoozed:    { label: '미루기', color: '#D97706', bgColor: '#FEF3C7' },
  backlog:    { label: '보관',   color: '#9CA3AF', bgColor: '#F3F4F6' },
  cancelled:  { label: '취소',   color: '#DC2626', bgColor: '#FEE2E2' },
};

const STATUS_NEXT: Record<string, TodoStatus> = {
  active:     'done',
  inProgress: 'done',
  done:       'active',
  snoozed:    'active',
  backlog:    'active',
  cancelled:  'active',
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getDateLabel(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const dayName = DAYS[d.getDay()];
    const formatted = `${format(d, 'M월 d일')} (${dayName})`;
    if (isToday(d)) return `오늘 · ${format(d, 'M/d')} (${dayName})`;
    if (isTomorrow(d)) return `내일 · ${format(d, 'M/d')} (${dayName})`;
    if (isPast(d)) return `${formatted} · 지남`;
    return formatted;
  } catch {
    return dateStr;
  }
}

// ─── Todo Row ──────────────────────────────────────────────────
interface TodoRowProps {
  todo: Todo;
  onStatusToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTop3Toggle: () => void;
  /** 밀림 섹션에서 노출되는 '오늘로' 버튼 */
  onMoveToToday?: () => void;
}

function TodoRow({
  todo, onStatusToggle, onEdit, onDelete, onTop3Toggle, onMoveToToday,
}: TodoRowProps) {
  const { t } = useTheme();
  const { projects, weeklyGoals, milestones } = usePlanner();
  const weeklyGoal = todo.weeklyGoalId ? weeklyGoals.find(w => w.id === todo.weeklyGoalId) : null;
  const milestone = todo.milestoneId ? milestones.find(m => m.id === todo.milestoneId) : null;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDone = todo.status === 'done';
  const isCancelled = todo.status === 'cancelled';
  const cfg = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.active;
  const duePast = todo.dueDate && todo.dueDate < getLogicalToday();
  const project = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;

  return (
    <>
      <div
        className="rounded-2xl transition-all"
        style={{
          backgroundColor: t.card,
          border: `1px solid ${isDone ? t.borderLight : t.border}`,
          opacity: isCancelled ? 0.6 : 1,
        }}
      >
        <div className="flex items-start gap-3 px-3 py-3">
          {/* Status toggle */}
          <button
            onClick={onStatusToggle}
            className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
            style={{
              borderColor: isDone ? t.accent : cfg.color,
              backgroundColor: isDone ? t.accent : 'transparent',
            }}
          >
            {isDone && <Check size={10} color="#fff" strokeWidth={3} />}
            {todo.status === 'inProgress' && <Play size={8} color={cfg.color} fill={cfg.color} />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5">
              {todo.isTop3 && (
                <Star size={11} fill={t.accent} color={t.accent} className="flex-shrink-0 mt-0.5" />
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: isDone || isCancelled ? t.textMuted : t.text,
                  textDecoration: isDone ? 'line-through' : 'none',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}
              >
                {todo.text}
              </span>
            </div>

            {/* Meta badges */}
            {(project || weeklyGoal || milestone || todo.mandalartCellId || todo.planStart || todo.dueDate || (todo.status !== 'active' && todo.status !== 'backlog')) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {todo.mandalartCellId && <MandalartSourceBadge />}
                {milestone && project && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: project.color + '18', color: project.color, fontWeight: 600, lineHeight: '14px', maxWidth: 160 }}
                    title={milestone.title}
                  >
                    🚩 <span className="truncate" style={{ maxWidth: 130 }}>{milestone.title}</span>
                  </span>
                )}
                {project && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: project.color + '18', color: project.color, lineHeight: '14px' }}
                  >
                    {project.name}
                  </span>
                )}
                {weeklyGoal && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent, lineHeight: '14px', maxWidth: 160 }}
                    title={weeklyGoal.text}
                  >
                    🎯 <span className="truncate" style={{ maxWidth: 130 }}>{weeklyGoal.text}</span>
                  </span>
                )}
                {todo.planStart && (
                  <span style={{ fontSize: 10, color: t.textMuted }}>
                    {todo.planStart}{todo.planEnd ? ` - ${todo.planEnd}` : ''}
                  </span>
                )}
                {todo.dueDate && (
                  <span style={{ fontSize: 10, color: duePast ? '#9f403d' : t.textSub }}>
                    마감 {format(parseISO(todo.dueDate), 'M/d')}
                  </span>
                )}
                {todo.status !== 'active' && todo.status !== 'backlog' && (
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: cfg.bgColor, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onMoveToToday && (
              <button
                onClick={onMoveToToday}
                title="오늘로 이동"
                className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                style={{ fontSize: 11, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight }}
              >
                <ArrowDownToLine size={12} />
                오늘로
              </button>
            )}
            <button onClick={onTop3Toggle} className="p-1.5 rounded-lg hover:opacity-70">
              <Star
                size={13}
                fill={todo.isTop3 ? t.accent : 'none'}
                color={todo.isTop3 ? t.accent : t.textMuted}
              />
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:opacity-70">
              <Pencil size={13} color={t.textMuted} />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-lg hover:opacity-70">
              <Trash2 size={13} color={t.textMuted} />
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          message="할일을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { onDelete(); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Tab 1: 할 일 (미완료 중심: 밀림 / 오늘 / 예정) ─────────────────
function TodoListTab() {
  const { todos, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState<string | undefined>(undefined);

  const todayStr = getLogicalToday();

  // 날짜 배정된 미완료 할일만 (done/cancelled/backlog 제외, 미지정은 /inbox 전담)
  const incompleteAssigned = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      td.status !== 'done' &&
      td.status !== 'cancelled' &&
      td.status !== 'backlog'
    ),
    [todos]
  );

  // 밀림: date < 오늘 AND status in (active, inProgress)
  const overdue = useMemo(
    () => incompleteAssigned
      .filter(td => td.date! < todayStr && (td.status === 'active' || td.status === 'inProgress'))
      .sort((a, b) => a.date!.localeCompare(b.date!)),
    [incompleteAssigned, todayStr]
  );

  // 오늘
  const todayTodos = useMemo(
    () => incompleteAssigned.filter(td => td.date === todayStr),
    [incompleteAssigned, todayStr]
  );

  // 예정: 날짜별 그룹 오름차순
  const upcomingGrouped = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    incompleteAssigned
      .filter(td => td.date! > todayStr)
      .forEach(td => { (groups[td.date!] ??= []).push(td); });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [incompleteAssigned, todayStr]);

  const openAdd = (date?: string) => {
    setAddDefaultDate(date);
    setShowAddModal(true);
  };

  const total = overdue.length + todayTodos.length + upcomingGrouped.reduce((s, [, list]) => s + list.length, 0);

  return (
    <div className="space-y-5">
      {total === 0 && (
        <div className="text-center py-16">
          <ListTodo size={36} color={t.borderLight} className="mx-auto mb-3" />
          <p style={{ fontSize: 13, color: t.textMuted }}>미완료 할일이 없어요</p>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>상단 + 버튼으로 추가해보세요</p>
        </div>
      )}

      {/* ── 밀림 (최상단, 강조) ── */}
      {overdue.length > 0 && (
        <div className="px-4">
          <div
            className="rounded-2xl p-3"
            style={{
              backgroundColor: t.dangerLight,
              border: `1px solid ${t.danger}33`,
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <AlertTriangle size={14} color={t.danger} />
              <span style={{ fontSize: 11, fontWeight: 700, color: t.danger, letterSpacing: '0.04em' }}>
                밀림 {overdue.length}개
              </span>
              <span style={{ fontSize: 10, color: t.danger, opacity: 0.8 }}>
                지난 날짜의 미완료 할일이에요. '오늘로' 로 끌어오세요.
              </span>
            </div>
            <div className="space-y-2">
              {overdue.map(todo => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
                  onEdit={() => setEditingTodo(todo)}
                  onDelete={() => deleteTodo(todo.id)}
                  onTop3Toggle={() => toggleTop3(todo.id)}
                  onMoveToToday={() => updateTodo(todo.id, { date: todayStr })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 오늘 ── */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: '0.02em' }}>
            오늘 · {format(new Date(), 'M/d')} ({DAYS[new Date().getDay()]})
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
          <button
            onClick={() => openAdd(todayStr)}
            className="p-1 rounded-lg hover:opacity-70"
            style={{ color: t.textMuted }}
            title="오늘 할일 추가"
          >
            <Plus size={13} />
          </button>
          <span style={{ fontSize: 10, color: t.textMuted }}>{todayTodos.length}개</span>
        </div>
        {todayTodos.length === 0 ? (
          <p style={{ fontSize: 12, color: t.textMuted }} className="py-3 text-center">
            오늘 할일이 없어요
          </p>
        ) : (
          <div className="space-y-2">
            {todayTodos.map(todo => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
                onEdit={() => setEditingTodo(todo)}
                onDelete={() => deleteTodo(todo.id)}
                onTop3Toggle={() => toggleTop3(todo.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 예정 (날짜별 오름차순) ── */}
      {upcomingGrouped.length > 0 && (
        <div className="space-y-5">
          {upcomingGrouped.map(([date, dateTodos]) => (
            <div key={date} className="px-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: '0.02em' }}>
                  {getDateLabel(date)}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
                <button
                  onClick={() => openAdd(date)}
                  className="p-1 rounded-lg hover:opacity-70"
                  style={{ color: t.textMuted }}
                >
                  <Plus size={13} />
                </button>
                <span style={{ fontSize: 10, color: t.textMuted }}>{dateTodos.length}개</span>
              </div>
              <div className="space-y-2">
                {dateTodos.map(todo => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
                    onEdit={() => setEditingTodo(todo)}
                    onDelete={() => deleteTodo(todo.id)}
                    onTop3Toggle={() => toggleTop3(todo.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <TodoModal
          date={addDefaultDate}
          onClose={() => { setShowAddModal(false); setAddDefaultDate(undefined); }}
        />
      )}
      {editingTodo && (
        <TodoModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}
    </div>
  );
}

// ─── Tab 2: 완료함 (done + cancelled, 날짜별 최신 위) ─────────────
function DoneTodosTab() {
  const { todos, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // done + cancelled (기존 AllTodosTab 의 doneTodos 정책과 동일)
  const doneOrCancelled = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      (td.status === 'done' || td.status === 'cancelled')
    ),
    [todos]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    doneOrCancelled.forEach(td => { (groups[td.date!] ??= []).push(td); });
    // 최신 날짜 위
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [doneOrCancelled]);

  const toggleGroup = (date: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {grouped.length === 0 && (
        <div className="text-center py-16">
          <Check size={36} color={t.borderLight} className="mx-auto mb-3" />
          <p style={{ fontSize: 13, color: t.textMuted }}>아직 완료한 할일이 없어요</p>
        </div>
      )}

      {grouped.map(([date, dateTodos]) => {
        const isHidden = collapsed.has(date);
        return (
          <div key={date} className="px-4">
            <button
              onClick={() => toggleGroup(date)}
              className="flex items-center gap-2 mb-2.5 w-full"
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: '0.02em' }}>
                {getDateLabel(date)}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
              <span style={{ fontSize: 10, color: t.textMuted }}>{dateTodos.length}개</span>
              {isHidden ? <ChevronDown size={12} color={t.textMuted} /> : <ChevronUp size={12} color={t.textMuted} />}
            </button>
            {!isHidden && (
              <div className="space-y-2">
                {dateTodos.map(todo => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onStatusToggle={() => updateTodo(todo.id, { status: 'active' })}
                    onEdit={() => setEditingTodo(todo)}
                    onDelete={() => deleteTodo(todo.id)}
                    onTop3Toggle={() => toggleTop3(todo.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editingTodo && (
        <TodoModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────
type Tab = 'list' | 'done';

export function TodosView() {
  const { todos, selectedDate } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<Tab>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // 탭 카운트 뱃지 — 할 일(미완료) / 완료함(done+cancelled)
  const todayStr = getLogicalToday();
  const listCount = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      td.status !== 'done' &&
      td.status !== 'cancelled' &&
      td.status !== 'backlog'
    ).length,
    [todos]
  );
  const doneCount = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      (td.status === 'done' || td.status === 'cancelled')
    ).length,
    [todos]
  );
  // 밀림 카운트 — '할 일' 탭 카운트 뱃지 옆에 작게 표시할 강조 숫자
  const overdueCount = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      td.date < todayStr &&
      (td.status === 'active' || td.status === 'inProgress')
    ).length,
    [todos, todayStr]
  );

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: t.bg }}>
      {/* Header */}
      <div
        className="flex-shrink-0 sticky top-0 z-10"
        style={{ backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}
      >
        <div className="px-3 py-3 lg:px-6 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo size={18} color={t.accent} />
              <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>할일</h1>
            </div>
            <AddEntryMenu
              onAddTodo={() => setShowAddModal(true)}
              onAddEvent={() => setShowAddEventModal(true)}
            />
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            {([
              { value: 'list' as Tab, label: '할 일', count: listCount, badge: overdueCount },
              { value: 'done' as Tab, label: '완료함', count: doneCount, badge: 0 },
            ]).map(({ value, label, count, badge }) => {
              const isActive = tab === value;
              return (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className="flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#fff' : t.textSub,
                    backgroundColor: isActive ? t.accent : 'transparent',
                  }}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className="inline-flex items-center justify-center px-1.5 rounded-full"
                      style={{
                        fontSize: 10,
                        minWidth: 18,
                        height: 16,
                        fontWeight: 700,
                        backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : t.borderLight,
                        color: isActive ? '#fff' : t.textSub,
                      }}
                    >
                      {count}
                    </span>
                  )}
                  {badge > 0 && (
                    <span
                      className="inline-flex items-center justify-center px-1.5 rounded-full"
                      style={{
                        fontSize: 10,
                        minWidth: 18,
                        height: 16,
                        fontWeight: 700,
                        backgroundColor: t.danger,
                        color: '#fff',
                      }}
                      title="밀린 할일"
                    >
                      !{badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {tab === 'list' ? <TodoListTab /> : <DoneTodosTab />}
      </div>

      {/* 상단 헤더 할일 추가 버튼용 모달 */}
      {showAddModal && (
        <TodoModal onClose={() => setShowAddModal(false)} />
      )}
      {showAddEventModal && (
        <EventModal
          date={selectedDate}
          onClose={() => setShowAddEventModal(false)}
        />
      )}
    </div>
  );
}
