import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { useSearchParams } from 'react-router';
import {
  ChevronLeft, ChevronRight, Plus, Star, Play,
  Check, Clock, Trash2, X, MoreHorizontal,
  Settings, Edit3, Pause, Ban, CalendarDays,
} from 'lucide-react';
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay as getDayOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, Event, Tag as TagType, TimelineLog } from '../store';
import { useTheme } from '../ThemeContext';
import { useNotification } from '../hooks/useNotification';
import { TimePicker } from './TimePicker';
import ConfirmModal from './ConfirmModal';
import { TodoModal } from './TodoModal';
import { formatDoElapsedKo, formatTotalDoKo, todoDoDurationSeconds } from '../../lib/todoDoDuration';

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
const TIMELINE_LABEL_WIDTH = 36;
const TIMELINE_CONTENT_LEFT = 40;
const TIMELINE_LANE_GAP = 10;
const PLAN_BAR_BG = '#EDE3D6';
const PLAN_BAR_BORDER = '#C4A882';
const DO_BAR_FALLBACK_BG = '#D4EDE0';
const DO_BAR_FALLBACK_TEXT = '#4A8A5A';
const OVERTIME_BAR_BG = '#FAE8D6';
const OVERTIME_BAR_BORDER = '#D4735A';
const CURRENT_TIME_COLOR = '#D4735A';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getContrastTextColor(hex: string): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#ffffff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.66 ? '#2D2D2D' : '#ffffff';
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
          <div className="mt-1">
            <TimePicker value={snoozeTime} onChange={setSnoozeTime} placeholder="시간 선택 (선택)" />
          </div>
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // ConfirmModal이 떠 있는 동안에는 컨텍스트 메뉴를 바깥 클릭으로 닫지 않음.
      // (모달 버튼 클릭 시 mousedown이 먼저 발생하면서 메뉴/모달이 언마운트되어 onClick이 실행되지 않는 이슈 방지)
      if (showDeleteConfirm) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, showDeleteConfirm]);

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
    <>
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
                  setShowDeleteConfirm(true);
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
      {showDeleteConfirm && (
        <ConfirmModal
          message="이 할일을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            deleteTodo(todo.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Timeline Log Modal (생각/감정 로그) ───
function TimelineLogModal({ date, logs, onAdd, onDelete, onClose }: {
  date: string; logs: TimelineLog[]; onAdd: (log: TimelineLog) => void; onDelete: (id: string) => void; onClose: () => void;
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
      id: Math.random().toString(36).slice(2, 9),
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
              <TimePicker value={time} onChange={setTime} placeholder="시간 선택" size="md" />
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
            <TimePicker value={startVal} onChange={setStartVal} placeholder="시작 시간" size="md" minuteStep={1} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 6, display: 'block' }}>종료 시간</label>
            <TimePicker value={endVal} onChange={setEndVal} placeholder="종료 시간" size="md" minuteStep={1} />
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
    timelineLogs,
    addTimelineLog: storeAddTimelineLog,
    deleteTimelineLog: storeDeleteTimelineLog,
  } = usePlanner();
  const { t } = useTheme();
  const { scheduleAlerts } = useNotification();
  const [searchParams] = useSearchParams();
  const highlightTodoId = searchParams.get('todoId');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [snoozingTodo, setSnoozingTodo] = useState<Todo | null>(null);
  const [contextMenu, setContextMenu] = useState<{ todo: Todo; pos: { x: number; y: number } } | null>(null);
  const [dailyMemo, setDailyMemo] = useState<Record<string, string>>({});
  const [showLogModal, setShowLogModal] = useState(false);
  const [showTimelineSettings, setShowTimelineSettings] = useState(false);
  const [mobileTab, setMobileTab] = useState<'todos' | 'timeline'>('todos');
  const [timelineTab, setTimelineTab] = useState<'plan' | 'do' | 'compare'>('compare');
  const [timerNowMs, setTimerNowMs] = useState(Date.now());

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

  // 알림 클릭으로 진입 시 URL params 처리 (date 이동 + todoId 하이라이트 스크롤)
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) setSelectedDate(dateParam);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!highlightTodoId) return;
    const el = document.getElementById(`todo-row-${highlightTodoId}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [highlightTodoId]);

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
    const handleMouseMove = (e: MouseEvent) => {
      dragMovedRef.current = true;
      const dy = e.clientY - dragState.startY;
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
    const handleMouseUp = () => {
      if (dragPreview && dragMovedRef.current) {
        const startField = dragState.type === 'plan' ? 'planStart' : 'doStart';
        const endField = dragState.type === 'plan' ? 'planEnd' : 'doEnd';
        updateTodo(dragState.todoId, {
          [startField]: minutesToTime(dragPreview.startMin),
          [endField]: minutesToTime(dragPreview.endMin),
          ...(dragState.type === 'do' ? { doElapsedSec: undefined } : {}),
        });
      }
      setDragState(null);
      setDragPreview(null);
      // Reset dragMoved after a tick so onClick can check it
      setTimeout(() => { dragMovedRef.current = false; }, 50);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dragPreview, tlStartHour, tlEndHour, updateTodo]);

  const dateTodos = todos.filter(td => td.date === selectedDate && td.status !== 'backlog');
  const importantTodos = dateTodos.filter(td => td.isTop3);

  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) return;
    const iv = setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  const getActiveTimerElapsedSec = () => {
    if (!activeTimer) return 0;
    return activeTimer.elapsedSec + (activeTimer.isPaused ? 0 : Math.max(0, Math.floor((timerNowMs - activeTimer.startTime) / 1000)));
  };

  const activeTimerTodo = activeTimer ? todos.find(td => td.id === activeTimer.todoId) : null;
  const activeTimerSec = activeTimer && activeTimerTodo?.date === selectedDate
    ? getActiveTimerElapsedSec()
    : 0;

  // 타임라인 요약 계산 (실제 DO 초: 타이머 기록 우선, 진행 중 타이머는 초 단위 합산)
  const totalPlanMin = dateTodos.filter(td => td.planStart && td.planEnd)
    .reduce((sum, td) => sum + (timeToMinutes(td.planEnd!) - timeToMinutes(td.planStart!)), 0);
  const totalDoSec = dateTodos
    .filter(td => td.doStart && td.doEnd)
    .reduce((sum, td) => sum + todoDoDurationSeconds(td), 0) + activeTimerSec;
  const totalDoMinEquiv = totalDoSec / 60;
  const achieveRate = totalPlanMin > 0 ? Math.min(100, Math.round((totalDoMinEquiv / totalPlanMin) * 100)) : 0;

  // 오늘 날짜인 경우에만 알림 스케줄 등록
  const todayStr2 = format(new Date(), 'yyyy-MM-dd');
  useEffect(() => {
    if (selectedDate === todayStr2) {
      scheduleAlerts(dateTodos, selectedDate);
    }
  // dateTodos 직접 비교는 매번 새 배열이라 selectedDate + todos.length로 의존
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, todos.length, scheduleAlerts]);
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

  const addTimelineLog = useCallback((log: TimelineLog) => {
    const { id: _id, ...logWithoutId } = log;
    storeAddTimelineLog(logWithoutId);
  }, [storeAddTimelineLog]);

  const deleteTimelineLog = useCallback((id: string) => {
    storeDeleteTimelineLog(id);
  }, [storeDeleteTimelineLog]);

  const handleTodoPrimaryAction = (todo: Todo) => {
    if (activeTimer?.todoId === todo.id) {
      stopTimer();
      return;
    }
    if (activeTimer && activeTimer.todoId !== todo.id) return;
    if (todo.status === 'done') {
      updateTodo(todo.id, { status: 'active', doStart: undefined, doEnd: undefined, doElapsedSec: undefined });
      return;
    }
    startTimer(todo.id);
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

  // Current time indicator (1분마다 자동 갱신)
  const [nowDate, setNowDate] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNowDate(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);
  const nowStr = format(nowDate, 'yyyy-MM-dd');
  const showCurrentTime = selectedDate === nowStr;
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const currentTimeTop = ((currentMinutes / 60) - tlStartHour) * HOUR_HEIGHT;

  const getTimelineLaneBounds = (lane: 'plan' | 'do') => {
    if (timelineTab === 'plan') return lane === 'plan' ? { left: '0%', right: '0%' } : null;
    if (timelineTab === 'do') return lane === 'do' ? { left: '0%', right: '0%' } : null;
    const halfGap = TIMELINE_LANE_GAP / 2;
    return lane === 'plan'
      ? { left: '0%', right: `calc(50% + ${halfGap}px)` }
      : { left: `calc(50% + ${halfGap}px)`, right: '0%' };
  };

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
    const laneBounds = getTimelineLaneBounds(isPlan ? 'plan' : 'do');
    if (!laneBounds) return null;

    // DO 초과 감지 (DO 시간 > PLAN 시간) — 타이머 실제 초가 있으면 분 단위 막대 대신 사용
    let isOvertime = false;
    if (!isPlan && todo.planStart && todo.planEnd) {
      const planDur = timeToMinutes(todo.planEnd) - timeToMinutes(todo.planStart);
      const doDurMin =
        todo.doElapsedSec != null && todo.doElapsedSec >= 0
          ? todo.doElapsedSec / 60
          : endMin - startMin;
      isOvertime = doDurMin > planDur;
    }

    let bg: string;
    let textColor: string;
    let borderClr: string;

    if (isPlan) {
      bg = PLAN_BAR_BG;
      textColor = '#7D6347';
      borderClr = PLAN_BAR_BORDER;
    } else if (isOvertime) {
      bg = OVERTIME_BAR_BG;
      textColor = OVERTIME_BAR_BORDER;
      borderClr = OVERTIME_BAR_BORDER;
    } else if (tagColor) {
      bg = tagColor;
      textColor = getContrastTextColor(tagColor);
      borderClr = 'transparent';
    } else {
      bg = DO_BAR_FALLBACK_BG;
      textColor = DO_BAR_FALLBACK_TEXT;
      borderClr = 'transparent';
    }

    const handleDragStart = (e: React.MouseEvent, mode: 'move' | 'resize') => {
      e.preventDefault();
      e.stopPropagation();
      dragMovedRef.current = false;
      setDragState({
        todoId: todo.id,
        type,
        mode,
        startY: e.clientY,
        origStartMin: timeToMinutes(start),
        origEndMin: timeToMinutes(end),
      });
    };

    const baseTimeLabel = isDragging && dragPreview
      ? `${minutesToTime(dragPreview.startMin)}-${minutesToTime(dragPreview.endMin)}`
      : `${start}-${end}`;
    const actualSuffix =
      !isPlan && todo.doElapsedSec != null && todo.doElapsedSec >= 0
        ? ` · 실제 ${formatDoElapsedKo(todo.doElapsedSec)}`
        : '';
    const timeLabel = `${baseTimeLabel}${actualSuffix}`;
    const compactLabel = `${todo.text} ${timeLabel}`;
    const isCompact = height < 52;

    return (
      <div key={`${todo.id}-${type}`}
        className="absolute rounded-xl px-2 py-1.5 overflow-hidden group"
        style={{
          top,
          height,
          left: laneBounds.left,
          right: laneBounds.right,
          backgroundColor: bg,
          border: `1px solid ${borderClr}`,
          opacity: isDragging ? 0.85 : (todo.status === 'cancelled' ? 0.4 : 1),
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          zIndex: isDragging ? 30 : 1,
          transition: isDragging ? 'none' : 'opacity 0.15s',
          boxShadow: isPlan ? '0 1px 2px rgba(125,99,71,0.08)' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
        onMouseDown={(e) => handleDragStart(e, 'move')}
        onClick={(e) => {
          if (!dragState && !dragMovedRef.current) window.dispatchEvent(new CustomEvent('editTodo', { detail: todo }));
        }}
        onContextMenu={e => {
          e.preventDefault();
          setContextMenu({ todo, pos: { x: e.clientX, y: e.clientY } });
        }}
      >
        {isCompact ? (
          <div className="flex items-center justify-between gap-2 h-full">
            <span style={{
              fontSize: 11, fontWeight: 600, color: textColor,
              textDecoration: todo.status === 'done' ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {compactLabel}
            </span>
            {!isPlan && todo.status === 'done' && <Check size={12} color={textColor} />}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span style={{
                fontSize: 11, fontWeight: 700, color: textColor,
                textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {todo.text}
              </span>
              {!isPlan && todo.status === 'done' && <Check size={12} color={textColor} />}
            </div>
            <div style={{ fontSize: 10, color: textColor, opacity: 0.85, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {timeLabel}
            </div>
          </>
        )}
        {/* Resize handle at bottom */}
        <div
          className="absolute left-0 right-0 bottom-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ height: 8, cursor: 'ns-resize', backgroundColor: isDragging ? 'transparent' : (isPlan ? '#C4A88240' : '#00000015') }}
          onMouseDown={(e) => handleDragStart(e, 'resize')}
        >
          <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: isPlan ? PLAN_BAR_BORDER : `${textColor}80` }} />
        </div>
      </div>
    );
  };

  // Event block (일정) — 타임라인 왼쪽 컬럼에 파란색으로 렌더링
  const renderEventBlock = (evt: Event) => {
    if (!evt.startTime || !evt.endTime) return null;
    const laneBounds = getTimelineLaneBounds('plan');
    if (!laneBounds) return null;
    const startMin = timeToMinutes(evt.startTime);
    const endMin = timeToMinutes(evt.endTime);
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max((endMin - startMin) * PX_PER_MIN, 20);

    return (
      <div key={`ev-${evt.id}`}
        className="absolute rounded-lg px-2.5 py-1.5 overflow-hidden"
        style={{
          top, height,
          left: laneBounds.left, right: laneBounds.right,
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
    const todo = todos.find(td => td.id === activeTimer.todoId);
    if (!todo || todo.date !== selectedDate) return null;
    const laneBounds = getTimelineLaneBounds('do');
    if (!laneBounds) return null;
    const startMin = timeToMinutes(activeTimer.startHHMM);
    const elapsedSec = getActiveTimerElapsedSec();
    const elapsedMin = Math.max(1, Math.ceil(elapsedSec / 60));
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max(elapsedMin * PX_PER_MIN, 30);
    const tagColor = getTodoTagColor(todo);
    const planDur = todo.planStart && todo.planEnd
      ? timeToMinutes(todo.planEnd) - timeToMinutes(todo.planStart)
      : null;
    const isOvertime = planDur !== null ? elapsedMin > planDur : false;
    const bgColor = isOvertime ? OVERTIME_BAR_BG : (tagColor || '#059669');
    const textColor = isOvertime ? OVERTIME_BAR_BORDER : (tagColor ? getContrastTextColor(tagColor) : '#ffffff');

    return (
      <div className="absolute rounded-lg px-2.5 py-1.5 animate-pulse"
        style={{
          top, height, left: laneBounds.left, right: laneBounds.right,
          backgroundColor: bgColor,
          border: `1px solid ${isOvertime ? OVERTIME_BAR_BORDER : (tagColor || '#047857')}`,
        }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{todo.text}</div>
        <div style={{ fontSize: 9, color: textColor, opacity: 0.85 }}>
          {activeTimer.isPaused ? '일시정지' : '진행 중...'} · {minutesToTime(startMin)}-{minutesToTime(startMin + elapsedMin)}
        </div>
      </div>
    );
  };

  // Log markers on timeline - gold dot on left + colored content block on DO area
  const renderLogMarkers = () => {
    const laneBounds = getTimelineLaneBounds('do');
    if (!laneBounds) return null;
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
                left: laneBounds.left,
                right: laneBounds.right,
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

    const isHighlighted = highlightTodoId === todo.id;
    return (
      <div
        id={`todo-row-${todo.id}`}
        className="group flex items-start gap-3 py-2.5 px-3 rounded-xl transition-all"
        style={{
          cursor: 'pointer',
          backgroundColor: isHighlighted ? t.accentLight : (isDone ? t.bgSub + '80' : t.card),
          border: isHighlighted ? `1.5px solid ${t.accent}` : `1px solid ${accentColor}20`,
          borderLeft: isHighlighted ? `3px solid ${t.accent}` : `3px solid ${accentColor}${isDone ? '40' : ''}`,
          boxShadow: isHighlighted ? `0 0 0 2px ${t.accent}30` : undefined,
        }}
      >
        {/* Status checkbox */}
        <button onClick={() => handleTodoPrimaryAction(todo)}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all mt-0.5"
          style={{
            border: isDone ? 'none' : `2px solid ${accentColor}60`,
            backgroundColor: todo.id === activeTimer?.todoId || isDone ? t.checkDone : 'transparent',
          }}>
          {(isDone || todo.id === activeTimer?.todoId) && <Check size={11} color="#fff" strokeWidth={3} />}
          {todo.status === 'inProgress' && todo.id !== activeTimer?.todoId && <Play size={9} color={t.success} fill={t.success} />}
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
          {todo.status !== 'done' && (!activeTimer || activeTimer.todoId === todo.id) && (
            <button onClick={() => handleTodoPrimaryAction(todo)}
              className="p-1.5 rounded-lg transition-colors"
              title={todo.id === activeTimer?.todoId ? '완료' : '타이머 시작'}
              style={{
                color: todo.id === activeTimer?.todoId ? '#fff' : t.success,
                backgroundColor: todo.id === activeTimer?.todoId ? t.success : t.success + '10',
              }}>
              {todo.id === activeTimer?.todoId ? <Check size={12} /> : <Play size={12} />}
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
      <div className="flex items-center justify-between px-3 py-3 lg:px-6 lg:py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-1.5 lg:gap-3">
          <button onClick={goPrev} className="p-1.5 rounded-lg" style={{ color: t.textSub }}><ChevronLeft size={18} /></button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}
              className="lg:text-[20px]">
              {format(dateObj, 'M월 d일')}
            </h2>
            <p style={{ fontSize: 12, color: t.textSub }}>{dayName}</p>
          </div>
          <button onClick={goNext} className="p-1.5 rounded-lg" style={{ color: t.textSub }}><ChevronRight size={18} /></button>
          {selectedDate !== nowStr && (
            <button onClick={goToday} className="px-2 py-1 rounded-lg"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accentLight, color: t.accent, whiteSpace: 'nowrap' }}>
              오늘
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 lg:gap-2">
          <button onClick={() => setShowTimelineSettings(true)} className="p-1.5 lg:px-3 lg:py-1.5 rounded-lg flex items-center gap-1.5"
            style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            <Settings size={12} />
            <span className="hidden lg:inline">시간대 설정</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="px-2.5 py-1.5 lg:px-3 rounded-lg flex items-center gap-1 lg:gap-1.5"
            style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accent, color: '#fff', whiteSpace: 'nowrap' }}>
            <Plus size={13} /> 할일 추가
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        {/* Mobile Tab Bar */}
        <div className="flex lg:hidden flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <button
            onClick={() => setMobileTab('todos')}
            className="flex-1 py-2.5 text-center transition-colors"
            style={{
              fontSize: 13, fontWeight: 600, background: 'transparent',
              color: mobileTab === 'todos' ? t.accent : t.textSub,
              borderBottom: mobileTab === 'todos' ? `2px solid ${t.accent}` : '2px solid transparent',
            }}>
            📋 할일
          </button>
          <button
            onClick={() => setMobileTab('timeline')}
            className="flex-1 py-2.5 text-center transition-colors"
            style={{
              fontSize: 13, fontWeight: 600, background: 'transparent',
              color: mobileTab === 'timeline' ? t.accent : t.textSub,
              borderBottom: mobileTab === 'timeline' ? `2px solid ${t.accent}` : '2px solid transparent',
            }}>
            ⏰ 타임라인
          </button>
        </div>

        {/* Columns Wrapper */}
        <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left Column: Todo List */}
        <div
          className={`flex-1 min-w-0 overflow-y-auto px-4 lg:px-6 py-4${mobileTab === 'timeline' ? ' hidden lg:block' : ''}`}
          style={{ borderRight: `1px solid ${t.border}` }}>
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

        {/* Right Column: Timeline */}
        <div className={`flex-1 min-w-0 flex flex-col overflow-hidden${mobileTab === 'todos' ? ' hidden lg:flex' : ''}`}>
          {/* Timeline header */}
          <div className="px-3 py-2.5 lg:px-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 14 }}>⏰</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>타임라인</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowLogModal(true)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg lg:gap-1.5 lg:px-2.5"
                  style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 11 }}>🔮</span> 로그
                </button>
                {/* PLAN / 비교 / DO 탭 */}
                <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {(['plan', 'compare', 'do'] as const).map((tab, i) => (
                    <button key={tab}
                      onClick={() => setTimelineTab(tab)}
                      className="px-2 py-1.5 lg:px-2.5"
                      style={{
                        fontSize: 10, fontWeight: timelineTab === tab ? 700 : 500,
                        backgroundColor: timelineTab === tab
                          ? (tab === 'plan' ? '#EDE3D6' : tab === 'do' ? '#D4EDE0' : t.bgSub)
                          : 'transparent',
                        color: timelineTab === tab
                          ? (tab === 'plan' ? '#7D6347' : tab === 'do' ? '#4A8A5A' : t.text)
                          : t.textMuted,
                        borderRight: i < 2 ? `1px solid ${t.border}` : 'none',
                        transition: 'all 0.15s',
                      }}>
                      {tab === 'plan' ? 'PLAN' : tab === 'do' ? 'DO' : '비교'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div style={{ width: TIMELINE_LABEL_WIDTH, flexShrink: 0 }} />
              {timelineTab === 'compare' ? (
                <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="rounded-full px-3 py-1 text-center"
                    style={{ fontSize: 10, fontWeight: 700, color: '#7D6347', backgroundColor: `${PLAN_BAR_BG}CC`, border: `1px solid ${PLAN_BAR_BORDER}55`, letterSpacing: '0.08em' }}>
                    PLAN
                  </div>
                  <div className="rounded-full px-3 py-1 text-center"
                    style={{ fontSize: 10, fontWeight: 700, color: '#4A8A5A', backgroundColor: `${DO_BAR_FALLBACK_BG}D9`, border: '1px solid #B6DCCB', letterSpacing: '0.08em' }}>
                    DO
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <div className="rounded-full px-3 py-1 text-center"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: timelineTab === 'plan' ? '#7D6347' : '#4A8A5A',
                      backgroundColor: timelineTab === 'plan' ? `${PLAN_BAR_BG}CC` : `${DO_BAR_FALLBACK_BG}D9`,
                      border: timelineTab === 'plan' ? `1px solid ${PLAN_BAR_BORDER}55` : '1px solid #B6DCCB',
                      letterSpacing: '0.08em',
                    }}>
                    {timelineTab === 'plan' ? 'PLAN' : 'DO'}
                  </div>
                </div>
              )}
            </div>
            {/* 요약: 계획 시간/실제 시간/달성률 */}
            {(totalPlanMin > 0 || totalDoSec > 0) && (
              <div className="flex items-center gap-3 mt-1.5">
                <span style={{ fontSize: 10, color: '#7D6347' }}>
                  계획 시간 {Math.floor(totalPlanMin / 60) > 0 ? `${Math.floor(totalPlanMin / 60)}h ` : ''}{totalPlanMin % 60 > 0 ? `${totalPlanMin % 60}m` : ''}
                </span>
                <span style={{ fontSize: 10, color: '#4A8A5A' }}>
                  실제 시간 {formatTotalDoKo(totalDoSec)}
                </span>
                {totalPlanMin > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: achieveRate >= 100 ? '#059669' : t.accent }}>
                    달성률 {achieveRate}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Timeline body */}
          <div ref={scrollRef} className="flex-1 relative overflow-y-auto overflow-x-hidden px-3 pb-4 lg:px-4"
            style={{ minHeight: 0 }}>
            <div className="relative" style={{ height: totalHeight + 16 }}>
              {/* Lane backgrounds */}
              <div className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: TIMELINE_CONTENT_LEFT, right: 0 }}>
                {timelineTab === 'compare' ? (
                  <>
                    <div className="absolute inset-y-0 rounded-2xl"
                      style={{
                        left: 0,
                        right: `calc(50% + ${TIMELINE_LANE_GAP / 2}px)`,
                        background: 'linear-gradient(180deg, rgba(237,227,214,0.55) 0%, rgba(237,227,214,0.18) 100%)',
                        border: `1px solid ${PLAN_BAR_BORDER}22`,
                      }} />
                    <div className="absolute inset-y-0 rounded-2xl"
                      style={{
                        left: `calc(50% + ${TIMELINE_LANE_GAP / 2}px)`,
                        right: 0,
                        background: 'linear-gradient(180deg, rgba(212,237,224,0.52) 0%, rgba(212,237,224,0.16) 100%)',
                        border: '1px solid rgba(107,170,122,0.14)',
                      }} />
                    <div className="absolute inset-y-0"
                      style={{
                        left: `calc(50% - ${TIMELINE_LANE_GAP / 2}px)`,
                        width: TIMELINE_LANE_GAP,
                        borderLeft: `1px dashed ${t.border}`,
                        borderRight: `1px dashed ${t.border}`,
                      }} />
                  </>
                ) : (
                  <div className="absolute inset-0 rounded-2xl"
                    style={{
                      background: timelineTab === 'plan'
                        ? 'linear-gradient(180deg, rgba(237,227,214,0.58) 0%, rgba(237,227,214,0.16) 100%)'
                        : 'linear-gradient(180deg, rgba(212,237,224,0.54) 0%, rgba(212,237,224,0.16) 100%)',
                      border: `1px solid ${t.borderLight}`,
                    }} />
                )}
              </div>
              {/* Hour grid */}
              {hours.map((h, idx) => (
                <div key={idx} style={{ display: 'contents' }}>
                  {/* Hour line */}
                  <div className="absolute left-0 right-0 flex items-start" style={{ top: idx * HOUR_HEIGHT }}>
                    <span style={{
                      fontSize: 9, color: t.textMuted, width: TIMELINE_LABEL_WIDTH, flexShrink: 0,
                      paddingTop: 0, textAlign: 'right', paddingRight: 6,
                    }}>
                      {String(h).padStart(2, '0')}:00
                    </span>
                    <div className="flex-1" style={{ borderTop: `1px solid ${t.border}` }} />
                  </div>
                  {/* 30 min dotted line */}
                  <div className="absolute left-0 right-0 flex items-start" style={{ top: idx * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}>
                    <span style={{ width: TIMELINE_LABEL_WIDTH, flexShrink: 0 }} />
                    <div className="flex-1" style={{ borderTop: `1px dashed ${t.borderLight}` }} />
                  </div>
                </div>
              ))}

              {/* Current time indicator */}
              {showCurrentTime && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentTimeTop }}>
                  <div className="flex items-center" style={{ marginLeft: TIMELINE_LABEL_WIDTH - 8 }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CURRENT_TIME_COLOR }} />
                    <div className="flex-1 h-[2px]" style={{ backgroundColor: CURRENT_TIME_COLOR }} />
                  </div>
                </div>
              )}

              {/* Blocks container */}
              <div className="absolute" style={{ left: TIMELINE_CONTENT_LEFT, right: 0, top: 0, bottom: 0 }}>
                {dateEvents.map(evt => renderEventBlock(evt))}
                {planTodos.map(todo => renderBlock(todo, 'plan'))}
                {doTodos.map(todo => renderBlock(todo, 'do'))}
                {renderTimerBlock()}
                {renderLogMarkers()}
              </div>
            </div>
          </div>
        </div>
        </div>{/* /Columns Wrapper */}
      </div>

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