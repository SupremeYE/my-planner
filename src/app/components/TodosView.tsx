import { useState, useMemo } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import {
  Plus, Trash2, CalendarClock, ChevronDown, ChevronUp,
  Check, Star, Pencil, ListTodo, Play,
} from 'lucide-react';
import { usePlanner, Todo, TodoStatus } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';
import { TodoModal } from './TodoModal';

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
  active:     'inProgress',
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
  showDateAssign?: boolean;
  onStatusToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTop3Toggle: () => void;
  onAssignDate?: (date: string) => void;
}

function TodoRow({
  todo, showDateAssign, onStatusToggle, onEdit, onDelete, onTop3Toggle, onAssignDate,
}: TodoRowProps) {
  const { t } = useTheme();
  const { projects } = usePlanner();
  const [assignMode, setAssignMode] = useState(false);
  const [assignDate, setAssignDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDone = todo.status === 'done';
  const isCancelled = todo.status === 'cancelled';
  const cfg = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.active;
  const duePast = todo.dueDate && todo.dueDate < format(new Date(), 'yyyy-MM-dd');
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
            {(project || todo.planStart || todo.dueDate || (todo.status !== 'active' && todo.status !== 'backlog')) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {project && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: project.color + '18', color: project.color, lineHeight: '14px' }}
                  >
                    {project.name}
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
            {showDateAssign && !assignMode && (
              <button
                onClick={() => setAssignMode(true)}
                className="p-1.5 rounded-lg hover:opacity-70"
                title="날짜 배정"
              >
                <CalendarClock size={14} color={t.textMuted} />
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

        {/* Date assign panel (미지정 탭) */}
        {showDateAssign && assignMode && (
          <div
            className="flex gap-2 px-3 pb-3 pt-1"
            style={{ borderTop: `1px solid ${t.borderLight}` }}
          >
            <div className="flex-1" />
            <input
              type="date"
              value={assignDate}
              onChange={e => setAssignDate(e.target.value)}
              className="px-2 py-1.5 rounded-xl outline-none"
              style={{ fontSize: 12, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
            />
            <button
              onClick={() => {
                if (assignDate && onAssignDate) {
                  onAssignDate(assignDate);
                  setAssignMode(false);
                  setAssignDate('');
                }
              }}
              className="px-3 py-1.5 rounded-xl"
              style={{ fontSize: 12, backgroundColor: t.accent, color: '#fff', fontWeight: 600 }}
            >
              배정
            </button>
            <button
              onClick={() => { setAssignMode(false); setAssignDate(''); }}
              className="px-3 py-1.5 rounded-xl"
              style={{ fontSize: 12, backgroundColor: t.bgSub, color: t.textSub }}
            >
              취소
            </button>
          </div>
        )}
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

// ─── Tab 1: All Todos ──────────────────────────────────────────
function AllTodosTab() {
  const { todos, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState<string | undefined>(undefined);
  const [collapsedDone, setCollapsedDone] = useState<Set<string>>(new Set());

  const allTodos = todos.filter(td => td.date !== null && td.status !== 'backlog');

  const grouped = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    allTodos.forEach(td => {
      const d = td.date!;
      if (!groups[d]) groups[d] = [];
      groups[d].push(td);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [allTodos]);

  const toggleDoneGroup = (date: string) => {
    setCollapsedDone(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const openAdd = (date?: string) => {
    setAddDefaultDate(date);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-5">
      {grouped.length === 0 && (
        <div className="text-center py-16">
          <ListTodo size={36} color={t.borderLight} className="mx-auto mb-3" />
          <p style={{ fontSize: 13, color: t.textMuted }}>등록된 할일이 없어요</p>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>상단 버튼으로 추가해보세요</p>
        </div>
      )}

      {grouped.map(([date, dateTodos]) => {
        const activeTodos = dateTodos.filter(td => td.status !== 'done' && td.status !== 'cancelled');
        const doneTodos   = dateTodos.filter(td => td.status === 'done' || td.status === 'cancelled');
        const doneHidden  = collapsedDone.has(date);
        const isPastDate  = date < format(new Date(), 'yyyy-MM-dd');

        return (
          <div key={date} className="px-4">
            {/* Date header */}
            <div className="flex items-center gap-2 mb-2.5">
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isPastDate ? t.textMuted : t.accent,
                  letterSpacing: '0.02em',
                }}
              >
                {getDateLabel(date)}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
              {/* 해당 날짜로 할일 추가 */}
              <button
                onClick={() => openAdd(date)}
                className="p-1 rounded-lg hover:opacity-70"
                style={{ color: t.textMuted }}
              >
                <Plus size={13} />
              </button>
              <span style={{ fontSize: 10, color: t.textMuted }}>
                {activeTodos.length + doneTodos.length}개
              </span>
            </div>

            {/* Active / In-progress todos */}
            <div className="space-y-2">
              {activeTodos.map(todo => (
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

            {/* Completed / Cancelled (collapsible) */}
            {doneTodos.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => toggleDoneGroup(date)}
                  className="flex items-center gap-1.5 py-1 mb-2"
                  style={{ fontSize: 11, color: t.textMuted }}
                >
                  {doneHidden ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  완료 {doneTodos.length}개
                </button>
                {!doneHidden && (
                  <div className="space-y-2">
                    {doneTodos.map(todo => (
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
            )}
          </div>
        );
      })}

      {/* 할일 추가 모달 (공통 TodoModal, date 없으면 오늘 기본값 + 날짜 네비) */}
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

// ─── Tab 2: Unassigned Todos ───────────────────────────────────
function UnassignedTab() {
  const { todos, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const unassigned = todos.filter(td => td.date === null || td.status === 'backlog');

  return (
    <div className="px-4 space-y-4">
      {unassigned.length === 0 && (
        <div className="text-center py-16">
          <ListTodo size={36} color={t.borderLight} className="mx-auto mb-3" />
          <p style={{ fontSize: 13, color: t.textMuted }}>미지정 할일이 없어요</p>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>날짜 없이 아이디어를 적어두세요</p>
        </div>
      )}

      <div className="space-y-2">
        {unassigned.map(todo => (
          <TodoRow
            key={todo.id}
            todo={todo}
            showDateAssign
            onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
            onEdit={() => setEditingTodo(todo)}
            onDelete={() => deleteTodo(todo.id)}
            onTop3Toggle={() => toggleTop3(todo.id)}
            onAssignDate={date => updateTodo(todo.id, { date, status: 'active' })}
          />
        ))}
      </div>

      {/* 미지정 할일 추가: 날짜 네비 있는 TodoModal, 추가 후 날짜가 지정되면 전체 탭으로 이동 */}
      {showAddModal && (
        <TodoModal
          onClose={() => setShowAddModal(false)}
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

// ─── Main Export ───────────────────────────────────────────────
export function TodosView() {
  const { todos } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<'all' | 'unassigned'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const allCount        = todos.filter(td => td.date !== null && td.status !== 'backlog').length;
  const unassignedCount = todos.filter(td => td.date === null  || td.status === 'backlog').length;

  const tabs = [
    { key: 'all' as const,        label: '전체 할일', count: allCount },
    { key: 'unassigned' as const, label: '미지정',    count: unassignedCount },
  ];

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
            {/* 할일 추가 버튼 — DailyView 헤더와 동일한 스타일 */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-2.5 py-1.5 lg:px-3 rounded-lg flex items-center gap-1 lg:gap-1.5"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accent, color: '#fff', whiteSpace: 'nowrap' }}
            >
              <Plus size={13} /> 할일 추가
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 mt-2">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="relative px-4 py-2 flex items-center gap-1.5 transition-colors"
                style={{
                  fontSize: 13,
                  fontWeight: tab === key ? 700 : 400,
                  color: tab === key ? t.accent : t.textSub,
                }}
              >
                {label}
                {count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      backgroundColor: tab === key ? t.accentLight : t.bgSub,
                      color: tab === key ? t.accent : t.textMuted,
                    }}
                  >
                    {count}
                  </span>
                )}
                {tab === key && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                    style={{ backgroundColor: t.accent }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {tab === 'all' ? <AllTodosTab /> : <UnassignedTab />}
      </div>

      {/* 상단 헤더 할일 추가 버튼용 모달 (날짜 네비 포함) */}
      {showAddModal && (
        <TodoModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
