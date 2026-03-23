import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Star, Play, Square,
  Check, Clock, Trash2, X, MoreHorizontal,
  Settings, Edit3, Pause, Ban, Timer, CalendarDays,
} from 'lucide-react';
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay as getDayOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, Event, Tag as TagType, TimelineLog } from '../store';
import { useTheme } from '../ThemeContext';

// ─── Color Palette for tag creation ───
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

// Log color presets
const LOG_COLORS = [
  '#C4A882', '#D4735A', '#6BAA7A', '#7B9ED9',
  '#A07BE0', '#F4A261', '#059669', '#EF4444',
  '#EC4899', '#6B7280',
];

// ─── Status config ───
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: '예정', color: '#6B7280', bgColor: '#F3F4F6' },
  inProgress: { label: '진행중', color: '#059669', bgColor: '#D1FAE5' },
  done: { label: '완료', color: '#C8A97E', bgColor: '#F5E6CC' },
  snoozed: { label: '미루기', color: '#D97706', bgColor: '#FEF3C7' },
  cancelled: { label: '취소', color: '#DC2626', bgColor: '#FEE2E2' },
};

// ─── Time helpers ───
const DEFAULT_START_HOUR = 4;
const DEFAULT_END_HOUR = 26;
const HOUR_HEIGHT = 60;
const PX_PER_MIN = HOUR_HEIGHT / 60;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Floating Timer ───
function FloatingTimer({ todoId }: { todoId: string }) {
  const { todos, stopTimer, updateTodo, activeTimer } = usePlanner();
  const { t } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const todo = todos.find(td => td.id === todoId);

  useEffect(() => {
    if (!activeTimer) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeTimer.startTime) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  const handleStop = () => {
    if (todo) {
      updateTodo(todo.id, { status: 'done' });
    }
    stopTimer();
  };

  if (!todo || !activeTimer) return null;

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl"
      style={{ backgroundColor: '#2D2D2D', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' }}>
      <Timer size={16} className="animate-pulse" />
      <div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{todo.text}</div>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
      </div>
      <button onClick={handleStop}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
        style={{ backgroundColor: 'rgba(255,255,255,0.2)', fontSize: 12, fontWeight: 600 }}>
        <Square size={12} fill="#fff" />
        완료
      </button>
    </div>
  );
}

// ─── Snooze Date Picker Modal ───
function SnoozeModal({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const { updateTodo } = usePlanner();
  const { t } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedSnoozeDate, setSelectedSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState(todo.planStart || '09:00');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = startOfMonth(viewMonth);
  const startDow = getDayOfWeek(firstDay);
  const daysInMonth = getDaysInMonth(viewMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const quickOptions = [
    { label: '내일', date: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: '모레', date: format(addDays(new Date(), 2), 'yyyy-MM-dd') },
    { label: '이번 주 금요일', date: (() => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysUntilFri = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + (7 - dayOfWeek);
      return format(addDays(now, daysUntilFri || 7), 'yyyy-MM-dd');
    })() },
    { label: '다음 주 월요일', date: (() => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      return format(addDays(now, daysUntilMon), 'yyyy-MM-dd');
    })() },
  ];

  const handleConfirm = () => {
    if (!selectedSnoozeDate) return;
    updateTodo(todo.id, {
      date: selectedSnoozeDate,
      status: 'snoozed',
      planStart: snoozeTime || undefined,
      planEnd: undefined,
      doStart: undefined,
      doEnd: undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl overflow-hidden" style={{
        backgroundColor: t.card, width: 380, border: `1px solid ${t.border}`,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>할일 미루기</h3>
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
              "{todo.text}"을(를) 언제로 미룰까요?
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        {/* Quick options */}
        <div className="px-5 pt-4 pb-2">
          <p style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            빠른 선택
          </p>
          <div className="flex flex-wrap gap-2">
            {quickOptions.map(opt => (
              <button key={opt.label}
                onClick={() => setSelectedSnoozeDate(opt.date)}
                className="px-3 py-1.5 rounded-lg transition-all"
                style={{
                  fontSize: 12,
                  backgroundColor: selectedSnoozeDate === opt.date ? t.accent : t.bgSub,
                  color: selectedSnoozeDate === opt.date ? '#fff' : t.text,
                  border: `1px solid ${selectedSnoozeDate === opt.date ? t.accent : t.border}`,
                  fontWeight: selectedSnoozeDate === opt.date ? 600 : 400,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="px-5 py-3">
          <p style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            날짜 선택
          </p>
          <div className="rounded-xl p-3" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                className="p-1 rounded-lg" style={{ color: t.textSub }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                {year}년 {month + 1}월
              </span>
              <button onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="p-1 rounded-lg" style={{ color: t.textSub }}>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <div key={d} className="text-center" style={{ fontSize: 10, color: t.textMuted }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => (
                <div key={i} className="flex justify-center">
                  {day !== null ? (
                    <button
                      onClick={() => {
                        const ds = dateStr(day);
                        if (ds >= todayStr) setSelectedSnoozeDate(ds);
                      }}
                      disabled={dateStr(day) < todayStr}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                      style={{
                        fontSize: 11,
                        backgroundColor: selectedSnoozeDate === dateStr(day) ? t.accent
                          : dateStr(day) === todayStr ? t.accentLight : 'transparent',
                        color: selectedSnoozeDate === dateStr(day) ? '#fff'
                          : dateStr(day) < todayStr ? t.textMuted : t.text,
                        fontWeight: selectedSnoozeDate === dateStr(day) ? 700 : 400,
                        cursor: dateStr(day) < todayStr ? 'not-allowed' : 'pointer',
                        opacity: dateStr(day) < todayStr ? 0.4 : 1,
                      }}>
                      {day}
                    </button>
                  ) : <div className="w-7 h-7" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Time setting */}
        <div className="px-5 pb-3">
          <label style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            미룰 시간
          </label>
          <input
            type="time"
            value={snoozeTime}
            onChange={e => setSnoozeTime(e.target.value)}
            className="mt-1 w-full rounded-lg px-3 py-2 outline-none"
            style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
          />
        </div>

        {/* Selected date summary */}
        {selectedSnoozeDate && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <p style={{ fontSize: 12, color: '#92400E' }}>
              <CalendarDays size={12} className="inline mr-1.5" style={{ verticalAlign: -2 }} />
              {format(new Date(selectedSnoozeDate + 'T12:00:00'), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
              {snoozeTime && ` ${snoozeTime}`}(으)로 미룹니다
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl transition-colors"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button onClick={handleConfirm}
            disabled={!selectedSnoozeDate}
            className="flex-1 py-2.5 rounded-xl transition-colors"
            style={{
              fontSize: 13, fontWeight: 600,
              backgroundColor: selectedSnoozeDate ? '#D97706' : t.bgSub,
              color: selectedSnoozeDate ? '#fff' : t.textMuted,
              cursor: selectedSnoozeDate ? 'pointer' : 'not-allowed',
            }}>
            미루기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Context Menu ───
function ContextMenu({ todo, position, onClose }: {
  todo: Todo;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const { updateTodo, deleteTodo } = usePlanner();
  const { t } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const menuItems = [
    { label: '편집', icon: Edit3, action: 'edit' },
    { divider: true },
    { label: '예정', icon: Clock, action: 'active', status: 'active' },
    { label: '진행중', icon: Play, action: 'inProgress', status: 'inProgress' },
    { label: '미루기', icon: Pause, action: 'snoozed', status: 'snoozed' },
    { label: '취소', icon: Ban, action: 'cancelled', status: 'cancelled' },
    { divider: true },
    { label: '삭제', icon: Trash2, action: 'delete', danger: true },
  ];

  return (
    <div ref={ref} className="fixed z-50 rounded-xl py-1.5 min-w-[140px]"
      style={{
        top: position.y,
        left: position.x,
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
      }}>
      {menuItems.map((item, i) => {
        if ('divider' in item && item.divider) {
          return <div key={i} className="my-1" style={{ borderBottom: `1px solid ${t.border}` }} />;
        }
        const Icon = (item as any).icon;
        const isActive = 'status' in item && todo.status === (item as any).status;
        return (
          <button key={i}
            className="w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left"
            style={{
              fontSize: 12,
              color: (item as any).danger ? '#DC2626' : isActive ? t.accent : t.text,
              backgroundColor: isActive ? t.accentLight : 'transparent',
              fontWeight: isActive ? 600 : 400,
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = (item as any).danger ? '#FEE2E2' : t.bgHover)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = isActive ? t.accentLight : 'transparent')}
            onClick={() => {
              if ((item as any).action === 'edit') {
                onClose();
                window.dispatchEvent(new CustomEvent('editTodo', { detail: todo }));
              } else if ((item as any).action === 'snoozed') {
                onClose();
                window.dispatchEvent(new CustomEvent('snoozeTodo', { detail: todo }));
              } else if ((item as any).action === 'delete') {
                if (confirm('이 할일을 삭제하시겠습니까?')) {
                  deleteTodo(todo.id);
                }
                onClose();
              } else if ('status' in item) {
                updateTodo(todo.id, { status: (item as any).status });
                onClose();
              }
            }}>
            {Icon && <Icon size={13} />}
            <span>{(item as any).label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Add/Edit Todo Modal ───
function TodoModal({ date, todo, onClose }: { date: string; todo?: Todo; onClose: () => void }) {
  const { addTodo, updateTodo, deleteTodo, tags: allTags, projects, addTag } = usePlanner();
  const { t } = useTheme();
  const [text, setText] = useState(todo?.text || '');
  const [planStart, setPlanStart] = useState(todo?.planStart || '');
  const [planEnd, setPlanEnd] = useState(todo?.planEnd || '');
  const [isTop3, setIsTop3] = useState(todo?.isTop3 || false);
  const [selectedTags, setSelectedTags] = useState<string[]>(todo?.tags || []);
  const [projectId, setProjectId] = useState(todo?.projectId || '');
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
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
        planStart: planStart || undefined,
        planEnd: planEnd || undefined,
        isTop3,
        tags: selectedTags,
        projectId: projectId || undefined,
      });
    } else {
      addTodo({
        text: text.trim(),
        date,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl w-[420px] max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            {todo ? '할일 수정' : '할일 추가'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Text */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>할일</label>
            <input autoFocus value={text} onChange={e => setText(e.target.value)}
              placeholder="할 일을 입력하세요"
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>시작</label>
              <input type="time" value={planStart} onChange={e => setPlanStart(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>종료</label>
              <input type="time" value={planEnd} onChange={e => setPlanEnd(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
            </div>
          </div>

          {/* Top3 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <button onClick={() => setIsTop3(!isTop3)} className="p-0.5">
              <Star size={16} fill={isTop3 ? t.accent : 'none'} color={isTop3 ? t.accent : t.textMuted} />
            </button>
            <span style={{ fontSize: 12, color: t.text }}>Top 3 중요 할일</span>
          </label>

          {/* Project */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>프로젝트</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}>
              <option value="">없음</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>태그</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {allTags.map(tag => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)}
                    className="px-2.5 py-1 rounded-full transition-all"
                    style={{
                      fontSize: 11,
                      backgroundColor: selected ? tag.color : t.bgSub,
                      color: selected ? '#fff' : t.textSub,
                      border: `1px solid ${selected ? tag.color : t.border}`,
                    }}>
                    {tag.name}
                  </button>
                );
              })}
              <button onClick={() => setShowNewTag(!showNewTag)}
                className="px-2.5 py-1 rounded-full"
                style={{ fontSize: 11, color: t.accent, border: `1px dashed ${t.accent}` }}>
                + 새 태그
              </button>
            </div>
            {showNewTag && (
              <div className="mt-2 p-3 rounded-xl space-y-2" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                <input value={newTagName} onChange={e => setNewTagName(e.target.value)}
                  placeholder="태그 이름" autoFocus
                  className="w-full rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ border: `1px solid ${t.border}`, fontSize: 12, backgroundColor: t.card, color: t.text }} />
                <div className="flex flex-wrap gap-1">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setNewTagColor(c)}
                      className="w-5 h-5 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        outline: newTagColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 1,
                        transform: newTagColor === c ? 'scale(1.2)' : 'scale(1)',
                      }} />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleCreateTag}
                    className="flex-1 py-1 rounded-lg"
                    style={{ backgroundColor: t.accent, color: '#fff', fontSize: 11, fontWeight: 600 }}>
                    추가
                  </button>
                  <button onClick={() => setShowNewTag(false)}
                    className="flex-1 py-1 rounded-lg"
                    style={{ backgroundColor: t.card, color: t.textSub, fontSize: 11, border: `1px solid ${t.border}` }}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          {todo && (
            <button onClick={() => { deleteTodo(todo.id); onClose(); }}
              className="px-4 py-2 rounded-xl transition-colors"
              style={{ fontSize: 12, color: '#DC2626', backgroundColor: '#FEE2E2' }}>
              삭제
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-xl"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}>
            취소
          </button>
          <button onClick={handleSubmit} className="px-5 py-2 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            {todo ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Log Modal (생각/감정 로그) ───
function TimelineLogModal({ date, logs, onAdd, onDelete, onClose }: {
  date: string; logs: TimelineLog[]; onAdd: (log: Omit<TimelineLog, 'id'>) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const { t } = useTheme();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [text, setText] = useState('');
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [selectedColor, setSelectedColor] = useState(LOG_COLORS[0]);
  const [icon, setIcon] = useState('');

  const handleSave = () => {
    if (!text.trim()) return;
    onAdd({
      date, time,
      text: text.trim(),
      color: selectedColor,
      icon: icon.trim() || undefined,
    });
    setText('');
    setIcon('');
    setMode('list');
  };

  const dateLogs = logs.filter(l => l.date === date).sort((a, b) => a.time.localeCompare(b.time));

  // Format time display
  const formatTimeDisplay = (t24: string) => {
    const [h, m] = t24.split(':').map(Number);
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${ampm} ${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Add mode - matches the screenshot design
  if (mode === 'add') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <div className="rounded-2xl w-[440px]"
          style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
            <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              <span style={{ fontSize: 18 }}>🔮</span>
              생각 / 감정 로그
            </h3>
            <button onClick={() => setMode('list')} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
              타임라인 특정 시간에 그때의 생각이나 감정을 기록해요. 타임라인에 컬러 마커로 표시됩니다.
            </p>

            {/* Time */}
            <div>
              <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>시간</label>
              <div className="relative">
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 outline-none"
                  style={{ border: `1px solid ${t.border}`, fontSize: 15, backgroundColor: t.bgSub, color: t.text }} />
                <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: t.textMuted }} />
              </div>
            </div>

            {/* Color + Icon */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>색상</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {LOG_COLORS.map(c => (
                    <button key={c} onClick={() => setSelectedColor(c)}
                      className="w-6 h-6 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        outline: selectedColor === c ? `2.5px solid ${c}` : 'none',
                        outlineOffset: 2,
                        transform: selectedColor === c ? 'scale(1.15)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>아이콘</label>
                <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🎯"
                  className="rounded-xl px-3 py-2.5 outline-none text-center"
                  style={{ border: `1px solid ${t.border}`, fontSize: 16, width: 52, backgroundColor: t.bgSub, color: t.text }} />
              </div>
            </div>

            {/* Content */}
            <div>
              <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>내용</label>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="지금 이 순간 드는 생각, 감정, 인사이트를 자유롭게..."
                className="w-full rounded-xl px-4 py-3 outline-none resize-none"
                style={{
                  border: `1px solid ${t.border}`, fontSize: 14, backgroundColor: t.bgSub, color: t.text,
                  minHeight: 120, lineHeight: 1.6,
                }} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-5" style={{ borderTop: `1px solid ${t.border}` }}>
            <button onClick={handleSave} className="flex-1 py-3 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, backgroundColor: selectedColor, color: '#fff' }}>
              저장
            </button>
            <button onClick={() => setMode('list')} className="flex-1 py-3 rounded-xl"
              style={{ fontSize: 14, fontWeight: 500, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[440px] max-h-[70vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              <span style={{ fontSize: 18 }}>🔮</span>
              생각 / 감정 로그
            </h3>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>타임라인에 기록된 생각과 감정</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {dateLogs.length === 0 && (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: t.bgSub }}>
                <Edit3 size={18} style={{ color: t.textMuted }} />
              </div>
              <p style={{ fontSize: 13, color: t.textMuted }}>아직 기록이 없습니다</p>
              <p style={{ fontSize: 12, color: t.textMuted, opacity: 0.7, marginTop: 4 }}>새 기록을 추가해보세요</p>
            </div>
          )}
          {dateLogs.length > 0 && (
            <div className="relative" style={{ paddingLeft: 24 }}>
              <div className="absolute top-2 bottom-2" style={{ left: 7, width: 2, backgroundColor: t.border, borderRadius: 1 }} />
              <div className="space-y-3">
                {dateLogs.map(log => {
                  const logColor = log.color || t.info;
                  return (
                    <div key={log.id} className="relative flex items-start gap-3 group">
                      <div className="absolute flex-shrink-0 w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: logColor, left: -24, top: 5, border: `2.5px solid ${t.card}` }} />
                      <div className="flex-1 rounded-xl px-4 py-3" style={{ backgroundColor: logColor + '10', border: `1px solid ${logColor}20` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full"
                            style={{ fontSize: 10, color: logColor, backgroundColor: logColor + '18', fontWeight: 600 }}>
                            {formatTimeDisplay(log.time)}
                          </span>
                          {log.icon && <span style={{ fontSize: 13 }}>{log.icon}</span>}
                          <div className="flex-1" />
                          <button onClick={() => onDelete(log.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                            style={{ color: t.textMuted }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <p style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{log.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add button */}
        <div className="px-6 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={() => setMode('add')} className="w-full py-3 rounded-xl flex items-center justify-center gap-2"
            style={{ fontSize: 14, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            <Plus size={15} />
            새 기록 추가
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Settings Modal ───
function TimelineSettingsModal({ startHour, endHour, onSave, onClose }: {
  startHour: number; endHour: number;
  onSave: (s: number, e: number) => void; onClose: () => void;
}) {
  const { t } = useTheme();
  const toTimeStr = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const [startVal, setStartVal] = useState(toTimeStr(startHour));
  const [endVal, setEndVal] = useState(toTimeStr(endHour));

  const startH = parseInt(startVal.split(':')[0]);
  const endH = parseInt(endVal.split(':')[0]);
  const isNextDay = endH <= startH;

  const handleSave = () => {
    const sh = parseInt(startVal.split(':')[0]);
    const eh = parseInt(endVal.split(':')[0]);
    const finalEnd = eh <= sh ? eh + 24 : eh;
    onSave(sh, finalEnd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[340px]"
        style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>타임라인 시간 설정</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div style={{ fontSize: 12, color: t.textMuted, backgroundColor: t.bgSub, borderRadius: 10, padding: '8px 12px' }}>
            현재 설정: {toTimeStr(startHour)} – {toTimeStr(endHour)}{endHour >= 24 ? ' (다음날)' : ''}
          </div>
          <div>
            <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 6, display: 'block' }}>시작 시간</label>
            <input type="time" value={startVal} onChange={ev => setStartVal(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{ border: `1px solid ${t.border}`, fontSize: 15, fontWeight: 500, backgroundColor: t.bgSub, color: t.text }} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 6, display: 'block' }}>종료 시간</label>
            <input type="time" value={endVal} onChange={ev => setEndVal(ev.target.value)}
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{ border: `1px solid ${t.border}`, fontSize: 15, fontWeight: 500, backgroundColor: t.bgSub, color: t.text }} />
            {isNextDay && (
              <span style={{ fontSize: 11, color: t.accent, marginTop: 4, display: 'block' }}>다음날 새벽으로 설정됩니다</span>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-5" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl"
            style={{ fontSize: 14, fontWeight: 500, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button onClick={handleSave} className="flex-1 py-3 rounded-xl"
            style={{ fontSize: 14, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Daily View ───
export function DailyView() {
  const {
    selectedDate, setSelectedDate, todos, events, updateTodo, habits, toggleHabit,
    activeTimer, startTimer, stopTimer, tags, projects,
    dayStartHour: tlStartHour, dayEndHour: tlEndHour, setDayHours,
    timelineLogs: allTimelineLogs, addTimelineLog: storeAddTimelineLog, deleteTimelineLog: storeDeleteTimelineLog,
  } = usePlanner();
  const { t } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [snoozingTodo, setSnoozingTodo] = useState<Todo | null>(null);
  const [contextMenu, setContextMenu] = useState<{ todo: Todo; pos: { x: number; y: number } } | null>(null);
  const [dailyMemo, setDailyMemo] = useState<Record<string, string>>({});
  const timelineLogs = allTimelineLogs.filter(l => l.date === selectedDate);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showTimelineSettings, setShowTimelineSettings] = useState(false);
  const [mobileTab, setMobileTab] = useState<'todo' | 'timeline'>('todo');

  // Drag state for timeline blocks
  const [dragState, setDragState] = useState<{
    todoId: string;
    type: 'plan' | 'do';
    mode: 'move' | 'resize';
    startY: number;
    origStartMin: number;
    origEndMin: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startMin: number; endMin: number } | null>(null);
  const dragMovedRef = useRef(false);

  // Listen for editTodo events from context menu / timeline
  useEffect(() => {
    const handler = (e: any) => setEditingTodo(e.detail);
    window.addEventListener('editTodo', handler);
    return () => window.removeEventListener('editTodo', handler);
  }, []);

  // Listen for snoozeTodo events from context menu
  useEffect(() => {
    const handler = (e: any) => setSnoozingTodo(e.detail);
    window.addEventListener('snoozeTodo', handler);
    return () => window.removeEventListener('snoozeTodo', handler);
  }, []);

  // Drag move/resize handlers for timeline blocks
  useEffect(() => {
    if (!dragState) return;

    const handleMove = (clientY: number) => {
      dragMovedRef.current = true;
      const dy = clientY - dragState.startY;
      const dMin = Math.round(dy / PX_PER_MIN / 5) * 5; // snap to 5 min
      if (dragState.mode === 'move') {
        const newStart = Math.max(tlStartHour * 60, dragState.origStartMin + dMin);
        const duration = dragState.origEndMin - dragState.origStartMin;
        const newEnd = Math.min(tlEndHour * 60, newStart + duration);
        setDragPreview({ startMin: newEnd - duration, endMin: newEnd });
      } else {
        const newEnd = Math.max(dragState.origStartMin + 5, dragState.origEndMin + dMin);
        setDragPreview({ startMin: dragState.origStartMin, endMin: Math.min(tlEndHour * 60, newEnd) });
      }
    };

    const handleEnd = () => {
      if (dragPreview && dragMovedRef.current) {
        const startField = dragState.type === 'plan' ? 'planStart' : 'doStart';
        const endField = dragState.type === 'plan' ? 'planEnd' : 'doEnd';
        updateTodo(dragState.todoId, {
          [startField]: minutesToTime(dragPreview.startMin),
          [endField]: minutesToTime(dragPreview.endMin),
        });
      }
      setDragState(null);
      setDragPreview(null);
      setTimeout(() => { dragMovedRef.current = false; }, 50);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const handleMouseUp = () => handleEnd();
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // 드래그 중 페이지 스크롤 방지
      handleMove(e.touches[0].clientY);
    };
    const handleTouchEnd = () => handleEnd();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragState, dragPreview, tlStartHour, tlEndHour, updateTodo]);

  const dateTodos = todos.filter(td => td.date === selectedDate && td.status !== 'backlog');
  const importantTodos = dateTodos.filter(td => td.isTop3);
  const dateEvents = events.filter(e => e.date === selectedDate);

  const dateObj = new Date(selectedDate + 'T12:00:00');
  const dayName = format(dateObj, 'EEEE', { locale: ko });

  const goToday = () => setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  const goPrev = () => setSelectedDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'));
  const goNext = () => setSelectedDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'));

  // D-day calculation
  const calcDday = (dueDate: string) => {
    const due = new Date(dueDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  const addTimelineLog = useCallback((log: Omit<TimelineLog, 'id'>) => {
    storeAddTimelineLog(log);
  }, [storeAddTimelineLog]);

  const deleteTimelineLog = useCallback((id: string) => {
    storeDeleteTimelineLog(id);
  }, [storeDeleteTimelineLog]);

  // Status cycle on click
  const cycleStatus = (todo: Todo) => {
    const order: Todo['status'][] = ['active', 'inProgress', 'done'];
    const idx = order.indexOf(todo.status);
    const next = order[(idx + 1) % order.length];
    updateTodo(todo.id, { status: next });
  };

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    return (
      <span className="px-2 py-0.5 rounded-full" style={{
        fontSize: 10, fontWeight: 600,
        backgroundColor: cfg.bgColor, color: cfg.color,
      }}>
        {cfg.label}
      </span>
    );
  };

  // Tag chip
  const TagChip = ({ tagId }: { tagId: string }) => {
    const tag = tags.find(tg => tg.id === tagId);
    if (!tag) return null;
    return (
      <span className="inline-flex items-center px-1.5 py-px rounded-full" style={{
        fontSize: 9, backgroundColor: tag.color + '18', color: tag.color,
        lineHeight: '14px',
      }}>
        {tag.name}
      </span>
    );
  };

  // ── Timeline ──
  const hours: number[] = [];
  for (let h = tlStartHour; h < tlEndHour; h++) hours.push(h % 24);
  const totalHeight = hours.length * HOUR_HEIGHT;

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollToHour = Math.max(0, currentHour - tlStartHour - 2);
      scrollRef.current.scrollTop = scrollToHour * HOUR_HEIGHT;
    }
  }, [selectedDate, tlStartHour]);

  // Current time indicator
  const nowDate = new Date();
  const nowStr = format(nowDate, 'yyyy-MM-dd');
  const showCurrentTime = selectedDate === nowStr;
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const currentTimeTop = ((currentMinutes / 60) - tlStartHour) * HOUR_HEIGHT;

  // Render timeline block
  const planTodos = dateTodos.filter(td => td.planStart && td.planEnd);
  const doTodos = dateTodos.filter(td => td.doStart && td.doEnd);

  // Calculate overlapping columns for blocks
  const calculateColumns = (items: { id: string; start: number; end: number }[]) => {
    const sorted = [...items].sort((a, b) => a.start - b.start);
    const columns: { id: string; col: number; totalCols: number }[] = [];
    const active: { id: string; end: number; col: number }[] = [];

    for (const item of sorted) {
      // Remove finished items
      const stillActive = active.filter(a => a.end > item.start);
      const usedCols = new Set(stillActive.map(a => a.col));
      let col = 0;
      while (usedCols.has(col)) col++;
      stillActive.push({ id: item.id, end: item.end, col });
      columns.push({ id: item.id, col, totalCols: 1 });
      active.length = 0;
      active.push(...stillActive);
    }

    // Update totalCols
    for (const item of sorted) {
      const overlapping = columns.filter(c => {
        const ci = sorted.find(s => s.id === c.id)!;
        return ci.start < item.end && ci.end > item.start;
      });
      const maxCol = Math.max(...overlapping.map(o => o.col)) + 1;
      overlapping.forEach(o => { o.totalCols = Math.max(o.totalCols, maxCol); });
    }

    return columns;
  };

  // Get tag color for a todo (first tag's color, or null)
  const getTodoTagColor = (todo: Todo): string | null => {
    if (!todo.tags || todo.tags.length === 0) return null;
    const tag = tags.find(tg => tg.id === todo.tags![0]);
    return tag?.color || null;
  };

  const renderBlock = (todo: Todo, type: 'plan' | 'do') => {
    const start = type === 'plan' ? todo.planStart : todo.doStart;
    const end = type === 'plan' ? todo.planEnd : todo.doEnd;
    if (!start || !end) return null;

    let startMin = timeToMinutes(start);
    let endMin = timeToMinutes(end);

    // Apply drag preview if this is the block being dragged
    const isDragging = dragState?.todoId === todo.id && dragState?.type === type;
    if (isDragging && dragPreview) {
      startMin = dragPreview.startMin;
      endMin = dragPreview.endMin;
    }

    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max((endMin - startMin) * PX_PER_MIN, 20);

    const isPlan = type === 'plan';
    const tagColor = getTodoTagColor(todo);

    let bg: string;
    let textColor: string;
    let borderClr: string;

    if (tagColor) {
      if (isPlan) {
        bg = tagColor + '20';
        textColor = tagColor;
        borderClr = tagColor + '40';
      } else {
        bg = tagColor;
        textColor = '#ffffff';
        borderClr = 'transparent';
      }
    } else {
      bg = isPlan ? t.planBlock : t.doBlock;
      textColor = isPlan ? t.planText : t.doText;
      borderClr = isPlan ? t.planBorder : 'transparent';
    }

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent, mode: 'move' | 'resize') => {
      e.preventDefault();
      e.stopPropagation();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      dragMovedRef.current = false;
      setDragState({
        todoId: todo.id,
        type,
        mode,
        startY: clientY,
        origStartMin: timeToMinutes(start),
        origEndMin: timeToMinutes(end),
      });
    };

    return (
      <div key={`${todo.id}-${type}`}
        className="absolute rounded-lg px-2.5 py-1.5 overflow-hidden group"
        style={{
          top,
          height,
          left: isPlan ? '0%' : '55%',
          right: isPlan ? '48%' : '0%',
          backgroundColor: bg,
          border: `1px solid ${borderClr}`,
          opacity: isDragging ? 0.85 : (todo.status === 'cancelled' ? 0.4 : 1),
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          zIndex: isDragging ? 30 : 1,
          transition: isDragging ? 'none' : 'opacity 0.15s',
        }}
        onMouseDown={(e) => handleDragStart(e, 'move')}
        onTouchStart={(e) => handleDragStart(e, 'move')}
        onClick={(e) => {
          if (!dragState && !dragMovedRef.current) window.dispatchEvent(new CustomEvent('editTodo', { detail: todo }));
        }}
        onContextMenu={e => {
          e.preventDefault();
          setContextMenu({ todo, pos: { x: e.clientX, y: e.clientY } });
        }}
      >
        <div className="flex items-center justify-between">
          <span style={{
            fontSize: 11, fontWeight: 600, color: textColor,
            textDecoration: todo.status === 'done' ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {todo.text}
          </span>
          {!isPlan && todo.status === 'done' && (
            <Check size={12} color={textColor} />
          )}
        </div>
        {height > 30 && (
          <div style={{ fontSize: 9, color: textColor, opacity: 0.7, marginTop: 2 }}>
            {isDragging && dragPreview
              ? `${minutesToTime(dragPreview.startMin)} - ${minutesToTime(dragPreview.endMin)}`
              : `${start} - ${end}`}
          </div>
        )}
        {tagColor && height > 24 && (
          <div className="flex items-center gap-1 mt-0.5">
            {(todo.tags || []).map(tagId => {
              const tg = tags.find(tItem => tItem.id === tagId);
              if (!tg) return null;
              return (
                <div key={tagId} className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isPlan ? tg.color : '#ffffff80' }} />
                  {height > 45 && (
                    <span style={{ fontSize: 8, color: isPlan ? tg.color : '#ffffffaa' }}>{tg.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Resize handle at bottom */}
        <div
          className="absolute left-0 right-0 bottom-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ height: 8, cursor: 'ns-resize', backgroundColor: isDragging ? 'transparent' : (isPlan ? (tagColor || t.planBorder) + '40' : '#ffffff30') }}
          onMouseDown={(e) => handleDragStart(e, 'resize')}
          onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e, 'resize'); }}
        >
          <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: isPlan ? (tagColor || textColor) : '#ffffff80' }} />
        </div>
      </div>
    );
  };

  // Event block (일정) — 타임라인 왼쪽 컬럼에 파란색으로 렌더링
  const renderEventBlock = (evt: Event) => {
    if (!evt.startTime || !evt.endTime) return null;
    const startMin = timeToMinutes(evt.startTime);
    const endMin = timeToMinutes(evt.endTime);
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max((endMin - startMin) * PX_PER_MIN, 20);

    return (
      <div key={`ev-${evt.id}`}
        className="absolute rounded-lg px-2.5 py-1.5 overflow-hidden"
        style={{
          top, height,
          left: '0%', right: '48%',
          backgroundColor: '#D0E0F5',
          border: '1.5px solid #A8C4E8',
          zIndex: 3,
        }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#7B9ED9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📅 {evt.title}
        </div>
        {height > 30 && (
          <div style={{ fontSize: 9, color: '#7B9ED9', opacity: 0.8, marginTop: 1 }}>
            {evt.startTime} - {evt.endTime}
            {evt.location && ` · ${evt.location}`}
          </div>
        )}
      </div>
    );
  };

  // Timer block
  const renderTimerBlock = () => {
    if (!activeTimer) return null;
    const now = new Date();
    const startMin = timeToMinutes(activeTimer.startHHMM);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max((nowMin - startMin) * PX_PER_MIN, 30);
    const todo = todos.find(td => td.id === activeTimer.todoId);

    return (
      <div className="absolute rounded-lg px-2.5 py-1.5 animate-pulse"
        style={{
          top, height, left: '55%', right: '0%',
          backgroundColor: '#059669', border: '1px solid #047857',
        }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{todo?.text || '타이머'}</div>
        <div style={{ fontSize: 9, color: '#D1FAE5' }}>진행 중...</div>
      </div>
    );
  };

  // Log markers on timeline - gold dot on left + colored content block on DO area
  const renderLogMarkers = () => {
    return timelineLogs
      .filter(l => l.date === selectedDate)
      .map(log => {
        const min = timeToMinutes(log.time);
        const top = (min / 60 - tlStartHour) * HOUR_HEIGHT;
        const logColor = log.color || t.accent;
        const displayText = log.text.length > 10 ? log.text.slice(0, 10) + '…' : log.text;

        return (
          <div key={log.id} style={{ display: 'contents' }}>
            {/* Gold dot marker on the left timeline area */}
            <div className="absolute z-20 pointer-events-none"
              style={{ top: top - 4, left: -4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: t.accent, border: `2px solid ${t.card}` }} />
            </div>
            {/* Dashed line across */}
            <div className="absolute z-15 pointer-events-none"
              style={{ top: top - 0.5, left: 0, right: 0, height: 1, borderBottom: `1px dashed ${logColor}40` }} />
            {/* Content block in DO area */}
            <div className="absolute z-20 flex items-center gap-1 px-2 py-0.5 rounded-md cursor-pointer"
              style={{
                top: top - 9,
                left: '55%',
                right: '0%',
                height: 18,
                backgroundColor: logColor,
                color: '#fff',
                overflow: 'hidden',
              }}
              onClick={() => setShowLogModal(true)}
              title={log.text}
            >
              {log.icon && <span style={{ fontSize: 9, lineHeight: 1 }}>{log.icon}</span>}
              <span style={{ fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayText}
              </span>
            </div>
          </div>
        );
      });
  };

  // Todo row for list
  const TodoRow = ({ todo }: { todo: Todo }) => {
    const project = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;
    const firstTag = (todo.tags && todo.tags.length > 0) ? tags.find(tg => tg.id === todo.tags![0]) : null;
    const accentColor = firstTag?.color || t.border;
    const isDone = todo.status === 'done';

    return (
      <div
        className="group flex items-start gap-3 py-2.5 px-3 rounded-xl transition-all"
        style={{
          cursor: 'pointer',
          backgroundColor: isDone ? t.bgSub + '80' : t.card,
          border: `1px solid ${accentColor}20`,
          borderLeft: `3px solid ${accentColor}${isDone ? '40' : ''}`,
        }}
      >
        {/* Status checkbox */}
        <button onClick={() => cycleStatus(todo)}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all mt-0.5"
          style={{
            border: isDone ? 'none' : `2px solid ${accentColor}60`,
            backgroundColor: isDone ? t.checkDone : 'transparent',
          }}>
          {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
          {todo.status === 'inProgress' && <Play size={9} color={t.success} fill={t.success} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => window.dispatchEvent(new CustomEvent('editTodo', { detail: todo }))}>
          <div className="flex items-center gap-1.5">
            {todo.isTop3 && <Star size={11} fill={t.accent} color={t.accent} className="flex-shrink-0" />}
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: isDone ? t.textMuted : t.text,
              textDecoration: isDone ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {todo.text}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {todo.planStart && (
              <span style={{ fontSize: 10, color: t.textMuted }}>
                {todo.planStart}{todo.planEnd ? ` - ${todo.planEnd}` : ''}
              </span>
            )}
            {project && (
              <span className="inline-flex items-center px-1.5 py-px rounded-full" style={{
                fontSize: 9, backgroundColor: project.color + '18', color: project.color, lineHeight: '14px',
              }}>
                {project.name}
              </span>
            )}
            {(todo.tags || []).map(tagId => <TagChip key={tagId} tagId={tagId} />)}
            {todo.dueDate && (
              <span className="inline-flex items-center px-1.5 py-px rounded-full" style={{
                fontSize: 9, fontWeight: 600, lineHeight: '14px',
                color: calcDday(todo.dueDate).startsWith('D+') ? '#DC2626' : t.accent,
                backgroundColor: calcDday(todo.dueDate).startsWith('D+') ? '#DC262612' : t.accentLight,
              }}>
                {calcDday(todo.dueDate)}
              </span>
            )}
          </div>
        </div>

        {/* Right side: status + actions always visible */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <StatusBadge status={todo.status} />
          {todo.status !== 'done' && !activeTimer && (
            <button onClick={() => startTimer(todo.id)}
              className="p-1.5 rounded-lg transition-colors"
              title="타이머 시작"
              style={{ color: t.success, backgroundColor: t.success + '10' }}>
              <Play size={12} />
            </button>
          )}
          <button onClick={(e) => {
            e.stopPropagation();
            setContextMenu({ todo, pos: { x: e.clientX, y: e.clientY } });
          }}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: t.textMuted, backgroundColor: t.bgSub }}>
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>
    );
  };

  // Today's habits
  const todayHabits = habits;

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 md:px-6 md:py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={goPrev} className="p-1.5 rounded-lg" style={{ color: t.textSub }}><ChevronLeft size={18} /></button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>
              {format(dateObj, 'M월 d일')}
            </h2>
            <p style={{ fontSize: 11, color: t.textSub }}>{dayName}</p>
          </div>
          <button onClick={goNext} className="p-1.5 rounded-lg" style={{ color: t.textSub }}><ChevronRight size={18} /></button>
          {selectedDate !== nowStr && (
            <button onClick={goToday} className="px-2.5 py-1 rounded-lg"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accentLight, color: t.accent }}>
              오늘
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* 시간대 설정: PC에서는 헤더, 모바일에서는 타임라인 탭 내부에 표시 */}
          <button onClick={() => setShowTimelineSettings(true)} className="hidden md:flex px-3 py-1.5 rounded-lg items-center gap-1.5"
            style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            <Settings size={12} /> 시간대 설정
          </button>
          <button onClick={() => setShowAddModal(true)} className="px-2.5 py-1.5 md:px-3 rounded-lg flex items-center gap-1.5"
            style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            <Plus size={13} />
            <span className="hidden md:inline">할일 추가</span>
          </button>
        </div>
      </div>

      {/* 모바일 탭 스위처 */}
      <div className="flex md:hidden flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
        <button
          onClick={() => setMobileTab('todo')}
          className="flex-1 py-2.5 text-center transition-colors"
          style={{
            fontSize: 13, fontWeight: 600,
            color: mobileTab === 'todo' ? t.accent : t.textSub,
            borderBottom: mobileTab === 'todo' ? `2px solid ${t.accent}` : '2px solid transparent',
            backgroundColor: 'transparent',
          }}>
          할일
        </button>
        <button
          onClick={() => setMobileTab('timeline')}
          className="flex-1 py-2.5 text-center transition-colors"
          style={{
            fontSize: 13, fontWeight: 600,
            color: mobileTab === 'timeline' ? t.accent : t.textSub,
            borderBottom: mobileTab === 'timeline' ? `2px solid ${t.accent}` : '2px solid transparent',
            backgroundColor: 'transparent',
          }}>
          ⏰ 타임라인
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left Column: Todo List — 모바일: todo 탭일 때만 표시 / PC: 항상 표시 */}
        <div className={`min-w-0 overflow-y-auto px-3 py-3 md:px-6 md:py-4 ${
          mobileTab === 'todo' ? 'flex-1' : 'hidden md:block md:flex-1'
        }`} style={{ borderRight: `1px solid ${t.border}` }}>
          {/* Top3 */}
          {importantTodos.length > 0 && (
            <div className="mb-4 rounded-2xl p-4" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Star size={13} color={t.accent} />
                <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Top 3 중요 할일
                </span>
              </div>
              <div className="space-y-2">
                {importantTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
              </div>
            </div>
          )}

          {/* All todos */}
          <div className="mb-4 rounded-2xl p-4" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                전체 할일 ({dateTodos.length})
              </span>
            </div>
            <div className="space-y-2">
              {dateTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
              {dateTodos.length === 0 && (
                <div className="py-8 text-center">
                  <p style={{ fontSize: 13, color: t.textMuted }}>아직 할일이 없습니다</p>
                  <button onClick={() => setShowAddModal(true)} className="mt-2 px-4 py-1.5 rounded-lg"
                    style={{ fontSize: 12, color: t.accent, backgroundColor: t.accentLight }}>
                    + 할일 추가
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Events */}
          {dateEvents.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={13} color={t.info} />
                <span style={{ fontSize: 10, color: t.info, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  일정
                </span>
              </div>
              {dateEvents.map(evt => (
                <div key={evt.id} className="flex items-center gap-2.5 py-2 px-2 rounded-xl"
                  style={{ backgroundColor: t.bgSub }}>
                  <div className="w-1 h-8 rounded-full" style={{ backgroundColor: t.info }} />
                  <div>
                    <span style={{ fontSize: 13, color: t.text }}>{evt.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {evt.startTime && (
                        <span style={{ fontSize: 10, color: t.textMuted }}>
                          {evt.startTime}{evt.endTime ? ` - ${evt.endTime}` : ''}
                        </span>
                      )}
                      {evt.location && (
                        <span style={{ fontSize: 10, color: t.textMuted }}>
                          📍 {evt.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Habits */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                오늘 습관
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {todayHabits.map(h => {
                const checked = h.checkedDates.includes(selectedDate);
                return (
                  <button key={h.id} onClick={() => toggleHabit(h.id, selectedDate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
                    style={{
                      fontSize: 12,
                      backgroundColor: checked ? t.accentLight : t.bgSub,
                      color: checked ? t.accent : t.textSub,
                      border: `1px solid ${checked ? t.accent : t.border}`,
                    }}>
                    {checked ? <Check size={12} /> : <span style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${t.border}`, display: 'inline-block', flexShrink: 0 }} />}
                    {h.icon || ''} {h.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Memo */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                메모
              </span>
            </div>
            <textarea
              value={dailyMemo[selectedDate] || ''}
              onChange={e => setDailyMemo(prev => ({ ...prev, [selectedDate]: e.target.value }))}
              placeholder="오늘의 메모..."
              className="w-full rounded-xl px-4 py-3 outline-none resize-none"
              style={{
                border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text,
                fontSize: 13, minHeight: 80,
              }}
            />
          </div>
        </div>

        {/* Right Column: Timeline — 모바일: timeline 탭일 때만 표시 / PC: 항상 표시 */}
        <div className={`min-w-0 flex flex-col overflow-hidden ${
          mobileTab === 'timeline' ? 'flex-1' : 'hidden md:flex md:flex-1'
        }`}>
          {/* Timeline header */}
          <div className="px-3 py-2.5 md:px-4 md:py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 14 }}>⏰</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>타임라인</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                {/* 모바일에서만 시간대 설정 버튼 표시 */}
                <button onClick={() => setShowTimelineSettings(true)} className="flex md:hidden items-center gap-1 px-2 py-1.5 rounded-lg"
                  style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <Settings size={11} />
                </button>
                <button onClick={() => setShowLogModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-lg"
                  style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 12 }}>🔮</span>
                  <span className="hidden md:inline">로그</span>
                </button>
                <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  <button
                    className="px-2.5 py-1.5 md:px-3"
                    style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.planBlock, color: t.planText, borderRight: `1px solid ${t.border}` }}>
                    PLAN
                  </button>
                  <button
                    className="px-2.5 py-1.5 md:px-3"
                    style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.doBlock, color: t.doText }}>
                    DO
                  </button>
                </div>
              </div>
            </div>
            <p className="hidden md:block" style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
              드래그로 이동 · 하단 끝 드래그로 크기 조절 · 클릭으로 편집
            </p>
          </div>

          {/* Timeline body */}
          <div ref={scrollRef} className="flex-1 relative overflow-y-auto overflow-x-hidden px-4 pb-4"
            style={{ minHeight: 0 }}>
            <div className="relative" style={{ height: totalHeight + 16 }}>
              {/* Hour grid */}
              {hours.map((h, idx) => (
                <div key={idx} style={{ display: 'contents' }}>
                  {/* Hour line */}
                  <div className="absolute left-0 right-0 flex items-start" style={{ top: idx * HOUR_HEIGHT }}>
                    <span style={{
                      fontSize: 9, color: t.textMuted, width: 36, flexShrink: 0,
                      paddingTop: 0, textAlign: 'right', paddingRight: 6,
                    }}>
                      {String(h).padStart(2, '0')}:00
                    </span>
                    <div className="flex-1" style={{ borderTop: `1px solid ${t.border}` }} />
                  </div>
                  {/* 30 min dotted line */}
                  <div className="absolute left-0 right-0 flex items-start" style={{ top: idx * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}>
                    <span style={{ width: 36, flexShrink: 0 }} />
                    <div className="flex-1" style={{ borderTop: `1px dashed ${t.borderLight}` }} />
                  </div>
                </div>
              ))}

              {/* Current time indicator */}
              {showCurrentTime && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentTimeTop }}>
                  <div className="flex items-center" style={{ marginLeft: 28 }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#D4735A' }} />
                    <div className="flex-1 h-[2px]" style={{ backgroundColor: '#D4735A' }} />
                  </div>
                </div>
              )}

              {/* Blocks container */}
              <div className="absolute" style={{ left: 40, right: 0, top: 0, bottom: 0 }}>
                {dateEvents.map(evt => renderEventBlock(evt))}
                {planTodos.map(todo => renderBlock(todo, 'plan'))}
                {doTodos.map(todo => renderBlock(todo, 'do'))}
                {renderTimerBlock()}
                {renderLogMarkers()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Timer */}
      {activeTimer && <FloatingTimer todoId={activeTimer.todoId} />}

      {/* Modals */}
      {showAddModal && <TodoModal date={selectedDate} onClose={() => setShowAddModal(false)} />}
      {editingTodo && <TodoModal date={selectedDate} todo={editingTodo} onClose={() => setEditingTodo(null)} />}
      {snoozingTodo && <SnoozeModal todo={snoozingTodo} onClose={() => setSnoozingTodo(null)} />}
      {contextMenu && (
        <ContextMenu
          todo={contextMenu.todo}
          position={contextMenu.pos}
          onClose={() => setContextMenu(null)}
        />
      )}
      {showLogModal && (
        <TimelineLogModal
          date={selectedDate}
          logs={timelineLogs}
          onAdd={addTimelineLog}
          onDelete={deleteTimelineLog}
          onClose={() => setShowLogModal(false)}
        />
      )}
      {showTimelineSettings && (
        <TimelineSettingsModal
          startHour={tlStartHour}
          endHour={tlEndHour}
          onSave={(s, e) => setDayHours(s, e)}
          onClose={() => setShowTimelineSettings(false)}
        />
      )}
    </div>
  );
}