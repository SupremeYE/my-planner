import { useMemo, useState } from 'react';
import { Link2, Plus, X } from 'lucide-react';
import { usePlanner, type Todo } from '../../store';
import { useTheme } from '../../ThemeContext';
import { TodoModal } from '../TodoModal';

interface Props {
  weeklyGoalId: string;
  /** 주간 카드의 weekKey — 새 할일 추가 시 그 주 첫날(월요일) 을 기본 날짜로 제안. */
  weekKey?: string;
}

// 주간 목표 카드 안에 인라인 todos 체크리스트.
// - 좌측 체크: status active↔done 토글 (기존 todos 와 동일 레코드)
// - 우측 ×: 연결 해제(weeklyGoalId=null) — 할일 자체는 보존
// - "할일 추가" → TodoModal(initialWeeklyGoalId 지정, 날짜 = 주 첫날 제안)
// - "기존 할일 연결" → 다른 곳에서 만든 할일을 가져와 연결
export function WeeklyTodosInline({ weeklyGoalId, weekKey }: Props) {
  const { t } = useTheme();
  const { todos, updateTodo } = usePlanner();

  const linked = useMemo(
    () => todos.filter(td => td.weeklyGoalId === weeklyGoalId),
    [todos, weeklyGoalId],
  );

  const [showAdd, setShowAdd] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const weekStartDate = useMemo(() => weekKeyToMonday(weekKey), [weekKey]);

  const toggleDone = (td: Todo) => {
    const next = td.status === 'done' ? 'active' : 'done';
    updateTodo(td.id, { status: next });
  };

  const unlink = (td: Todo) => {
    updateTodo(td.id, { weeklyGoalId: undefined });
  };

  return (
    <div className="mt-2">
      {linked.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {linked.map(td => {
            const done = td.status === 'done';
            return (
              <div
                key={td.id}
                onClick={(e) => { e.stopPropagation(); setEditingTodo(td); }}
                role="button"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDone(td); }}
                  className="flex-shrink-0"
                >
                  <span style={{ fontSize: 14, color: done ? t.success : t.borderLight }}>
                    {done ? '✓' : '○'}
                  </span>
                </button>
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{
                    fontSize: 12,
                    color: done ? t.textMuted : t.text,
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {td.text}
                </span>
                {td.date && (
                  <span style={{ fontSize: 10, color: t.textMuted }}>{td.date.slice(5)}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); unlink(td); }}
                  className="flex-shrink-0 p-0.5"
                  title="연결 해제"
                  style={{ color: t.textMuted }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); setShowAdd(true); }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg"
          style={{ fontSize: 11, color: t.accent, backgroundColor: t.accentLight, border: `1px solid ${t.borderLight}` }}
        >
          <Plus size={11} /> 할일 추가
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowLink(true); }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg"
          style={{ fontSize: 11, color: t.textSub, backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}
        >
          <Link2 size={11} /> 기존 할일 연결
        </button>
      </div>

      {showAdd && (
        <TodoModal
          date={weekStartDate}
          initialWeeklyGoalId={weeklyGoalId}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editingTodo && (
        <TodoModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}
      {showLink && (
        <LinkExistingTodoModal
          onClose={() => setShowLink(false)}
          onPick={(td) => { updateTodo(td.id, { weeklyGoalId }); setShowLink(false); }}
          alreadyLinkedIds={new Set(linked.map(l => l.id))}
        />
      )}
    </div>
  );
}

// ─── 기존 할일 연결 모달 ─────────────────────────────────────
function LinkExistingTodoModal({ onClose, onPick, alreadyLinkedIds }: {
  onClose: () => void;
  onPick: (td: Todo) => void;
  alreadyLinkedIds: Set<string>;
}) {
  const { t } = useTheme();
  const { todos } = usePlanner();
  const [q, setQ] = useState('');

  // 후보: 이 주간에 아직 연결되지 않았고, 백로그/취소 제외, 반복 가상 인스턴스 제외(id에 '__' 포함)
  const candidates = useMemo(() => {
    const all = todos
      .filter(td => !alreadyLinkedIds.has(td.id))
      .filter(td => td.status !== 'cancelled')
      .filter(td => !td.id.includes('__')); // 가상 반복 인스턴스 제외
    const qq = q.trim().toLowerCase();
    const filtered = qq ? all.filter(td => td.text.toLowerCase().includes(qq)) : all;
    // 미연결 → 다른 주간 연결됨 순으로 정렬
    return [...filtered].sort((a, b) => {
      const al = a.weeklyGoalId ? 1 : 0;
      const bl = b.weeklyGoalId ? 1 : 0;
      if (al !== bl) return al - bl;
      return (b.date ?? '').localeCompare(a.date ?? '');
    }).slice(0, 100);
  }, [todos, alreadyLinkedIds, q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl"
        style={{ backgroundColor: t.card, maxWidth: 420, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>기존 할일 연결</span>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={16} /></button>
        </div>
        <div className="px-4 pb-2">
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="할일 검색..."
            className="w-full px-3 py-2 rounded-lg border outline-none"
            style={{ fontSize: 13, borderColor: t.borderLight, backgroundColor: t.bgSub, color: t.text }}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {candidates.length === 0 && (
            <p className="p-3 text-center" style={{ fontSize: 12, color: t.textMuted }}>
              연결할 수 있는 할일이 없습니다
            </p>
          )}
          {candidates.map(td => (
            <button
              key={td.id}
              onClick={() => onPick(td)}
              className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2"
              style={{
                fontSize: 12,
                color: t.text,
                backgroundColor: 'transparent',
              }}
            >
              <span className="flex-1 min-w-0 truncate">{td.text}</span>
              {td.date && <span style={{ fontSize: 10, color: t.textMuted }}>{td.date.slice(5)}</span>}
              {td.weeklyGoalId && (
                <span style={{ fontSize: 9, color: t.accent, padding: '1px 4px', borderRadius: 4, backgroundColor: t.accentLight }}>
                  연결됨
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ISO weekKey "2026-W23" → 그 주 월요일 yyyy-MM-dd (Todo 기본 날짜용) ──
function weekKeyToMonday(weekKey?: string): string | undefined {
  if (!weekKey) return undefined;
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekKey);
  if (!m) return undefined;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO 8601: 1월 4일이 속한 주가 1주차. 그 주의 월요일을 구하고 (week-1)*7 일 더함.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // 0=월
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`;
}
