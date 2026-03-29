import { useState, useMemo } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import {
  Plus, Trash2, CalendarClock, ChevronDown, ChevronUp,
  Check, Star, X, Pencil, ListTodo, Play,
} from 'lucide-react';
import { usePlanner, Todo, TodoStatus } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';

// ─── Constants ───────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active:     { label: '예정',   color: '#6B7280', bgColor: '#F3F4F6' },
  inProgress: { label: '진행중', color: '#059669', bgColor: '#D1FAE5' },
  done:       { label: '완료',   color: '#C4A882', bgColor: '#F5E6CC' },
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

const CATEGORIES = ['업무', '건강', '자기계발', '생활', '기타'];

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getDateLabel(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const dayName = DAYS[d.getDay()];
    const formatted = `${format(d, 'M월 d일')} (${dayName})`;
    if (isToday(d)) return `오늘 · ${format(d, 'M/d')} (${dayName})`;
    if (isTomorrow(d)) return `내일 · ${format(d, 'M/d')} (${dayName})`;
    if (isPast(d)) return `${formatted} ·  지남`;
    return formatted;
  } catch {
    return dateStr;
  }
}

// ─── Edit Modal ───────────────────────────────────────────────
interface EditModalProps {
  todo: Todo;
  onClose: () => void;
  onSave: (changes: Partial<Todo>) => void;
}

function TodoEditModal({ todo, onClose, onSave }: EditModalProps) {
  const { t } = useTheme();
  const [text, setText] = useState(todo.text);
  const [date, setDate] = useState(todo.date ?? '');
  const [category, setCategory] = useState(todo.category ?? '');
  const [dueDate, setDueDate] = useState(todo.dueDate ?? '');

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      text: text.trim(),
      date: date || null,
      category: category || undefined,
      dueDate: dueDate || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl lg:rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="flex justify-center -mt-1 mb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>할일 편집</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70">
            <X size={16} color={t.textMuted} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="할일 내용"
            className="w-full px-3 py-2.5 rounded-xl outline-none"
            style={{ fontSize: 14, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label style={{ fontSize: 11, color: t.textSub, display: 'block', marginBottom: 4 }}>날짜</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl outline-none"
                style={{ fontSize: 13, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: t.textSub, display: 'block', marginBottom: 4 }}>마감일</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl outline-none"
                style={{ fontSize: 13, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: t.textSub, display: 'block', marginBottom: 4 }}>카테고리</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl outline-none"
              style={{ fontSize: 13, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
            >
              <option value="">없음</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl"
            style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14 }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl"
            style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 700 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Add Bar ─────────────────────────────────────────────
interface QuickAddProps {
  onAdd: (text: string, date?: string) => void;
  showDatePicker?: boolean;
  defaultDate?: string;
  placeholder?: string;
}

function QuickAddBar({ onAdd, showDatePicker = false, defaultDate = '', placeholder }: QuickAddProps) {
  const { t } = useTheme();
  const [text, setText] = useState('');
  const [date, setDate] = useState(defaultDate);

  const handleAdd = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), showDatePicker ? (date || undefined) : undefined);
    setText('');
  };

  return (
    <div className="flex gap-2 items-center">
      {showDatePicker && (
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-2 py-2 rounded-xl outline-none flex-shrink-0"
          style={{
            fontSize: 12,
            backgroundColor: t.bgSub,
            border: `1px solid ${t.border}`,
            color: t.text,
            width: 136,
          }}
        />
      )}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder={placeholder ?? (showDatePicker ? '할일 추가...' : '날짜 없는 할일 추가...')}
        className="flex-1 px-3 py-2 rounded-xl outline-none"
        style={{ fontSize: 13, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
      />
      <button
        onClick={handleAdd}
        className="p-2.5 rounded-xl flex-shrink-0 transition-opacity hover:opacity-80"
        style={{ backgroundColor: t.accent, color: '#fff' }}
      >
        <Plus size={16} />
      </button>
    </div>
  );
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
  const [assignMode, setAssignMode] = useState(false);
  const [assignDate, setAssignDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDone = todo.status === 'done';
  const isCancelled = todo.status === 'cancelled';
  const cfg = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.active;
  const duePast = todo.dueDate && todo.dueDate < format(new Date(), 'yyyy-MM-dd');

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
            {(todo.category || todo.dueDate || todo.status !== 'active') && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {todo.category && (
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: t.bgSub, color: t.textSub }}
                  >
                    {todo.category}
                  </span>
                )}
                {todo.dueDate && (
                  <span style={{ fontSize: 10, color: duePast ? '#E05C5C' : t.textSub }}>
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

        {/* Date assign panel */}
        {showDateAssign && assignMode && (
          <div
            className="flex gap-2 px-3 pb-3"
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
  const { todos, addTodo, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
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

  const handleAdd = (text: string, date?: string) => {
    addTodo({
      text,
      date: date || format(new Date(), 'yyyy-MM-dd'),
      status: 'active',
      isTop3: false,
    });
  };

  const toggleDoneGroup = (date: string) => {
    setCollapsedDone(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Quick add */}
      <div className="px-4">
        <QuickAddBar
          onAdd={handleAdd}
          showDatePicker
          defaultDate={format(new Date(), 'yyyy-MM-dd')}
        />
      </div>

      {grouped.length === 0 && (
        <div className="text-center py-16">
          <ListTodo size={36} color={t.borderLight} className="mx-auto mb-3" />
          <p style={{ fontSize: 13, color: t.textMuted }}>등록된 할일이 없어요</p>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>위에서 날짜와 함께 추가해보세요</p>
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
                  {doneHidden
                    ? <ChevronDown size={12} />
                    : <ChevronUp size={12} />
                  }
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

      {editingTodo && (
        <TodoEditModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={changes => updateTodo(editingTodo.id, changes)}
        />
      )}
    </div>
  );
}

// ─── Tab 2: Unassigned Todos ───────────────────────────────────
function UnassignedTab() {
  const { todos, addTodo, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const unassigned = todos.filter(td => td.date === null || td.status === 'backlog');

  const handleAdd = (text: string) => {
    addTodo({ text, date: null, status: 'backlog', isTop3: false });
  };

  return (
    <div className="px-4 space-y-4">
      <QuickAddBar onAdd={handleAdd} />

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

      {editingTodo && (
        <TodoEditModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={changes => updateTodo(editingTodo.id, changes)}
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
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center gap-2 mb-3">
            <ListTodo size={18} color={t.accent} />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>할일</h1>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="relative px-4 py-2.5 flex items-center gap-1.5 transition-colors"
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
    </div>
  );
}
