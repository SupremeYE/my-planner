import { useState } from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import { usePlanner, Todo } from '../store';
import { useTheme } from '../ThemeContext';
import { TimePicker } from './TimePicker';

const TAG_COLORS = [
  '#E0795B', '#D4735A', '#E8A87C', '#F4A261',
  '#5B8FE0', '#4A82CC', '#60A5FA', '#3B82F6',
  '#5BC8AF', '#45B899', '#34D399', '#6BAA7A',
  '#A07BE0', '#8B7CF8', '#9B8FFA', '#C084FC',
  '#5BC86E', '#22C55E', '#84CC16', '#059669',
  '#F59E0B', '#C9A84C', '#C4A882', '#D97706',
  '#EF4444', '#F87171', '#EC4899', '#DB2777',
  '#6B7280', '#94A3B8', '#475569', '#1E293B',
];

interface TodoModalProps {
  /** date prop이 있으면 날짜 고정 (일간 페이지 모드).
   *  없으면 모달 내부에서 날짜 선택 가능 (할일 페이지 모드). */
  date?: string;
  todo?: Todo;
  onClose: () => void;
}

export function TodoModal({ date, todo, onClose }: TodoModalProps) {
  const { addTodo, updateTodo, deleteTodo, tags: allTags, projects, addTag } = usePlanner();
  const { t } = useTheme();

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 날짜 선택 모드용 state (date prop 없을 때만 사용)
  const [modalDate, setModalDate] = useState<string>(
    date ?? todo?.date ?? todayStr,
  );

  const effectiveDate = date ?? modalDate; // date prop 있으면 고정, 없으면 내부 state 사용
  const showDateNav = date === undefined;   // date prop 없을 때만 날짜 네비 표시

  // 날짜 이동 헬퍼
  const dateObj = parseISO(effectiveDate + (effectiveDate.length === 10 ? 'T12:00:00' : ''));
  const dayName = format(dateObj, 'EEEE', { locale: ko });
  const goPrev = () => setModalDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'));
  const goNext = () => setModalDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'));

  // 폼 fields
  const [text, setText] = useState(todo?.text ?? '');
  const [planStart, setPlanStart] = useState(todo?.planStart ?? '');
  const [planEnd, setPlanEnd] = useState(todo?.planEnd ?? '');
  const [isTop3, setIsTop3] = useState(todo?.isTop3 ?? false);
  const [selectedTags, setSelectedTags] = useState<string[]>(todo?.tags ?? []);
  const [projectId, setProjectId] = useState(todo?.projectId ?? '');
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId],
    );
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    addTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setShowNewTag(false);
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (todo) {
      updateTodo(todo.id, {
        text: text.trim(),
        date: effectiveDate || null,
        planStart: planStart || undefined,
        planEnd: planEnd || undefined,
        isTop3,
        tags: selectedTags,
        projectId: projectId || undefined,
      });
    } else {
      addTodo({
        text: text.trim(),
        date: effectiveDate || todayStr,
        status: 'active',
        isTop3,
        planStart: planStart || undefined,
        planEnd: planEnd || undefined,
        tags: selectedTags,
        projectId: projectId || undefined,
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-[420px] max-w-[95vw] max-h-[85vh] overflow-y-auto"
        style={{
          backgroundColor: t.card,
          border: `1px solid ${t.border}`,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            {todo ? '할일 수정' : '할일 추가'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 날짜 선택 네비게이션 (date prop 없을 때만) */}
          {showDateNav && (
            <div
              className="flex items-center gap-2 pb-4"
              style={{ borderBottom: `1px solid ${t.border}` }}
            >
              <button
                onClick={goPrev}
                className="p-1.5 rounded-lg"
                style={{ color: t.textSub }}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 text-center">
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: t.text,
                    fontFamily: "'DM Serif Display', serif",
                  }}
                >
                  {format(dateObj, 'M월 d일')}
                </div>
                <div style={{ fontSize: 12, color: t.textSub }}>{dayName}</div>
              </div>
              <button
                onClick={goNext}
                className="p-1.5 rounded-lg"
                style={{ color: t.textSub }}
              >
                <ChevronRight size={18} />
              </button>
              {effectiveDate !== todayStr && (
                <button
                  onClick={() => setModalDate(todayStr)}
                  className="px-2 py-1 rounded-lg"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: t.accentLight,
                    color: t.accent,
                    whiteSpace: 'nowrap',
                  }}
                >
                  오늘
                </button>
              )}
            </div>
          )}

          {/* 할일 텍스트 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>할일</label>
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="할 일을 입력하세요"
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 13,
              }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* 시작/종료 시간 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>시작</label>
              <div className="mt-1">
                <TimePicker value={planStart} onChange={setPlanStart} placeholder="시작 시간" />
              </div>
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>종료</label>
              <div className="mt-1">
                <TimePicker value={planEnd} onChange={setPlanEnd} placeholder="종료 시간" />
              </div>
            </div>
          </div>

          {/* Top3 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <button onClick={() => setIsTop3(!isTop3)} className="p-0.5">
              <Star
                size={16}
                fill={isTop3 ? t.accent : 'none'}
                color={isTop3 ? t.accent : t.textMuted}
              />
            </button>
            <span style={{ fontSize: 12, color: t.text }}>Top 3 중요 할일</span>
          </label>

          {/* 프로젝트 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>프로젝트</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 13,
              }}
            >
              <option value="">없음</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 태그 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>태그</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {allTags.map(tag => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="px-2.5 py-1 rounded-full transition-all"
                    style={{
                      fontSize: 11,
                      backgroundColor: selected ? tag.color : t.bgSub,
                      color: selected ? '#fff' : t.textSub,
                      border: `1px solid ${selected ? tag.color : t.border}`,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
              <button
                onClick={() => setShowNewTag(!showNewTag)}
                className="px-2.5 py-1 rounded-full"
                style={{ fontSize: 11, color: t.accent, border: `1px dashed ${t.accent}` }}
              >
                + 새 태그
              </button>
            </div>

            {showNewTag && (
              <div
                className="mt-2 p-3 rounded-xl space-y-2"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
              >
                <input
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder="태그 이름"
                  autoFocus
                  className="w-full rounded-lg px-2.5 py-1.5 outline-none"
                  style={{
                    border: `1px solid ${t.border}`,
                    fontSize: 12,
                    backgroundColor: t.card,
                    color: t.text,
                  }}
                />
                <div className="flex flex-wrap gap-1">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className="w-5 h-5 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        outline: newTagColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 1,
                        transform: newTagColor === c ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateTag}
                    className="flex-1 py-1 rounded-lg"
                    style={{ backgroundColor: t.accent, color: '#fff', fontSize: 11, fontWeight: 600 }}
                  >
                    추가
                  </button>
                  <button
                    onClick={() => setShowNewTag(false)}
                    className="flex-1 py-1 rounded-lg"
                    style={{
                      backgroundColor: t.card,
                      color: t.textSub,
                      fontSize: 11,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderTop: `1px solid ${t.border}` }}
        >
          {todo && (
            <button
              onClick={() => { deleteTodo(todo.id); onClose(); }}
              className="px-4 py-2 rounded-xl transition-colors"
              style={{ fontSize: 12, color: '#DC2626', backgroundColor: '#FEE2E2' }}
            >
              삭제
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}
          >
            {todo ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
