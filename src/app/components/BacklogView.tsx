import { useState, type CSSProperties } from 'react';
import { format } from 'date-fns';
import { Plus, CalendarClock, Trash2, Tag, Archive, Filter } from 'lucide-react';
import { usePlanner, Todo } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';

const CATEGORIES = ['전체', '업무', '건강', '자기계발', '생활', '기타'];

export function BacklogView() {
  const { todos, addTodo, updateTodo, deleteTodo } = usePlanner();
  const { t } = useTheme();
  const [newTodoText, setNewTodoText] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [snoozeDate, setSnoozeDate] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Todo | null>(null);

  const backlogTodos = todos.filter(t => t.status === 'backlog' || t.date === null);

  const filtered = selectedCategory === '전체'
    ? backlogTodos
    : backlogTodos.filter(t => t.category === selectedCategory);

  const handleAdd = () => {
    if (!newTodoText.trim()) return;
    addTodo({
      text: newTodoText.trim(),
      date: null,
      status: 'backlog',
      isTop3: false,
      category: newCategory || undefined,
    });
    setNewTodoText('');
    setNewCategory('');
  };

  const handleAssignDate = (id: string) => {
    if (!snoozeDate) return;
    updateTodo(id, { date: snoozeDate, status: 'active' });
    setSnoozeId(null);
    setSnoozeDate('');
  };

  const categoryCounts = CATEGORIES.slice(1).reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = backlogTodos.filter(t => t.category === cat).length;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100%', backgroundColor: t.bg }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4" style={{ backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Archive size={18} color={t.accent} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>미지정 할일 보관함</h1>
          <span className="ml-auto px-2 py-0.5 rounded-full" style={{ fontSize: 12, backgroundColor: t.accentLight, color: t.accent, fontWeight: 600 }}>
            {backlogTodos.length}
          </span>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-3 py-1.5 rounded-full flex-shrink-0 transition-all"
              style={{
                fontSize: 12,
                backgroundColor: selectedCategory === cat ? t.accent : t.bgSub,
                color: selectedCategory === cat ? '#fff' : t.textMuted,
                fontWeight: selectedCategory === cat ? 600 : 400,
              }}
            >
              {cat}
              {cat !== '전체' && categoryCounts[cat] > 0 && (
                <span className="ml-1" style={{ fontSize: 10, opacity: 0.8 }}>({categoryCounts[cat]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Desktop: table view */}
        <div className="hidden lg:block bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: t.bg, borderBottom: `1px solid ${t.border}` }}>
                <th className="text-left px-4 py-3" style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  할일
                </th>
                <th className="text-left px-4 py-3" style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  카테고리
                </th>
                <th className="text-left px-4 py-3" style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((todo, i) => (
                <tr key={todo.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                  <td className="px-4 py-3">
                    <span style={{ fontSize: 14, color: t.text }}>{todo.text}</span>
                  </td>
                  <td className="px-4 py-3">
                    {todo.category ? (
                      <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 11, backgroundColor: t.accentLight, color: t.accent }}>
                        {todo.category}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: t.textMuted }}>미분류</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {snoozeId === todo.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={snoozeDate}
                            onChange={e => setSnoozeDate(e.target.value)}
                            className="px-2 py-1 rounded-lg outline-none"
                            style={{ fontSize: 12, backgroundColor: t.bgSub, border: 'none', color: t.text }}
                          />
                          <button onClick={() => handleAssignDate(todo.id)}
                            className="px-2 py-1 rounded-lg"
                            style={{ fontSize: 12, backgroundColor: t.accent, color: '#fff' }}>
                            배정
                          </button>
                          <button onClick={() => setSnoozeId(null)} className="px-2 py-1 rounded-lg"
                            style={{ fontSize: 12, backgroundColor: t.bgSub, color: t.textMuted }}>
                            취소
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setSnoozeId(todo.id); setSnoozeDate(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-80"
                            style={{ fontSize: 12, backgroundColor: t.accentLight, color: t.accent }}>
                            <CalendarClock size={12} /> 날짜 배정
                          </button>
                          <button onClick={() => setDeleteTarget(todo)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bl-hover)]"
                            style={{ ['--bl-hover']: t.bgSub } as CSSProperties}>
                            <Trash2 size={13} color={t.textMuted} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center" style={{ fontSize: 13, color: t.textMuted }}>
                    보관된 할일이 없어요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: card list */}
        <div className="lg:hidden space-y-2">
          {filtered.map(todo => (
            <div key={todo.id} className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${t.border}` }}>
              <div className="flex items-start gap-3">
                <Archive size={16} color={t.accent} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 14, color: t.text, lineHeight: 1.4 }}>{todo.text}</p>
                  {todo.category && (
                    <span className="mt-1 inline-block px-2 py-0.5 rounded-full" style={{ fontSize: 11, backgroundColor: t.accentLight, color: t.accent }}>
                      {todo.category}
                    </span>
                  )}
                </div>
                <button onClick={() => setDeleteTarget(todo)} className="p-1.5 rounded-lg hover:bg-[var(--bl-hover)] flex-shrink-0" style={{ ['--bl-hover']: t.bgSub } as CSSProperties}>
                  <Trash2 size={13} color={t.textMuted} />
                </button>
              </div>

              {snoozeId === todo.id ? (
                <div className="mt-3 flex gap-2">
                  <input
                    type="date"
                    value={snoozeDate}
                    onChange={e => setSnoozeDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl outline-none"
                    style={{ fontSize: 13, backgroundColor: t.bgSub, border: 'none', color: t.text }}
                  />
                  <button onClick={() => handleAssignDate(todo.id)}
                    className="px-3 py-2 rounded-xl"
                    style={{ fontSize: 13, backgroundColor: t.accent, color: '#fff', fontWeight: 600 }}>
                    배정
                  </button>
                  <button onClick={() => setSnoozeId(null)}
                    className="px-3 py-2 rounded-xl"
                    style={{ fontSize: 13, backgroundColor: t.bgSub, color: t.textMuted }}>
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setSnoozeId(todo.id); setSnoozeDate(''); }}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl w-full justify-center"
                  style={{ fontSize: 13, backgroundColor: t.accentLight, color: t.accent }}
                >
                  <CalendarClock size={13} /> 날짜 배정하기
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Archive size={32} color={t.border} className="mx-auto mb-3" />
              <p style={{ fontSize: 13, color: t.textMuted }}>보관된 할일이 없어요</p>
            </div>
          )}
        </div>

        {/* Add new backlog item */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            할일 추가
          </div>
          <div className="space-y-2">
            <input
              value={newTodoText}
              onChange={e => setNewTodoText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="날짜 없는 할일 추가..."
              className="w-full px-3 py-2 rounded-xl outline-none"
              style={{ fontSize: 13, backgroundColor: t.bgSub, color: t.text, border: 'none' }}
            />
            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl outline-none"
                style={{ fontSize: 13, backgroundColor: t.bgSub, color: newCategory ? t.text : t.textMuted, border: 'none' }}
              >
                <option value="">카테고리 선택 (선택사항)</option>
                {CATEGORIES.slice(1).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button onClick={handleAdd} className="px-4 py-2 rounded-xl flex items-center gap-1.5"
                style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                <Plus size={14} /> 추가
              </button>
            </div>
          </div>
        </div>
      </div>
      {deleteTarget && (
        <ConfirmModal
          message="이 할일을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            deleteTodo(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}