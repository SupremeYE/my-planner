import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { useSearchParams, NavLink } from 'react-router';
import {
  ChevronLeft, ChevronRight, Plus, Star, Play,
  Check, Clock, Trash2, X, MoreHorizontal,
  Settings, Edit3, Pause, Ban, CalendarDays, Copy,
} from 'lucide-react';
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay as getDayOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, Event, Tag as TagType, TimelineLog, SelfCareRecord, getTimerElapsedSec } from '../store';
import { useTheme } from '../ThemeContext';
import { useNotification } from '../hooks/useNotification';
import { TimePicker } from './TimePicker';
import ConfirmModal from './ConfirmModal';
import { TodoModal } from './TodoModal';
import { EventModal } from './EventModal';
import { FocusModal } from './FocusModal';
import { FloatingAddFab } from './FloatingAddFab';
import { AddEntryMenu } from './AddEntryMenu';
import { formatDuration, formatTotalDoKo, todoDoDurationSeconds } from '../../lib/todoDoDuration';

// ─── Color Palette for tag creation ───
const TAG_COLORS = [
  '#E0795B', '#D4735A', '#E8A87C', '#F4A261',
  '#5B8FE0', '#4A82CC', '#60A5FA', '#3B82F6',
  '#5BC8AF', '#45B899', '#34D399', '#006b62',
  '#A07BE0', '#8B7CF8', '#9B8FFA', '#C084FC',
  '#5BC86E', '#22C55E', '#84CC16', '#059669',
  '#F59E0B', '#515f74', '#515f74', '#D97706',
  '#EF4444', '#F87171', '#EC4899', '#DB2777',
  '#6B7280', '#94A3B8', '#475569', '#1E293B',
];

// Log color presets
const LOG_COLORS = [
  '#515f74', '#D4735A', '#006b62', '#7B9ED9',
  '#A07BE0', '#F4A261', '#059669', '#EF4444',
  '#EC4899', '#6B7280',
];

// ─── Status config ───
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: '예정', color: '#6B7280', bgColor: '#F3F4F6' },
  inProgress: { label: '진행중', color: '#059669', bgColor: '#D1FAE5' },
  done: { label: '완료', color: '#515f74', bgColor: '#d5e3fd' },
  snoozed: { label: '미루기', color: '#D97706', bgColor: '#FEF3C7' },
  cancelled: { label: '취소', color: '#DC2626', bgColor: '#FEE2E2' },
};

// ─── Time helpers ───
const DEFAULT_START_HOUR = 4;
const DEFAULT_END_HOUR = 26;
const HOUR_HEIGHT = 60;
const PX_PER_MIN = HOUR_HEIGHT / 60;
const TIMELINE_LABEL_WIDTH = 48;
const TIMELINE_CONTENT_LEFT = 56;
const TIMELINE_LANE_GAP = 10;
const PLAN_BAR_BG = '#ddeaf3';
const PLAN_BAR_BORDER = '#515f74';
const DO_BAR_FALLBACK_BG = '#D4EDE0';
const DO_BAR_FALLBACK_TEXT = '#4A8A5A';
const OVERTIME_BAR_BG = '#FAE8D6';
const OVERTIME_BAR_BORDER = '#D4735A';
const CURRENT_TIME_COLOR = '#D4735A';
const LOG_OFFSET_STORAGE_KEY = 'daily-timeline-log-offsets';

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
  return luminance > 0.66 ? '#26343d' : '#ffffff';
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
function ContextMenu({ todo, position, onClose, onFocus }: {
  todo: Todo;
  position: { x: number; y: number };
  onClose: () => void;
  onFocus: (todo: Todo) => void;
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
    { label: '포커스 시작', icon: Play, action: 'focus' },
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
                } else if ((item as any).action === 'focus') {
                  onFocus(todo);
                  onClose();
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

function DailyDatePickerModal({ selectedDate, onClose, onConfirm }: {
  selectedDate: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
}) {
  const { t } = useTheme();
  const [dateValue, setDateValue] = useState(selectedDate);

  useEffect(() => {
    setDateValue(selectedDate);
  }, [selectedDate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div
        className="rounded-2xl w-[calc(100vw-32px)] max-w-[340px] overflow-hidden"
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 lg:px-6 lg:py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>날짜 선택</h3>
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>원하는 날짜의 일간 페이지로 이동해요</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 lg:px-6 lg:py-5">
          <div className="rounded-xl px-3 py-3 lg:px-4 lg:py-4" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
            <label className="flex items-center gap-2 mb-2" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <CalendarDays size={14} />
              날짜
            </label>
            <input
              type="date"
              value={dateValue}
              onChange={e => setDateValue(e.target.value)}
              className="w-full rounded-xl px-3 py-3 outline-none"
              style={{ fontSize: 16, backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text, minHeight: 48 }}
            />
            {dateValue && (
              <p style={{ fontSize: 12, color: t.textSub, marginTop: 10 }}>
                {format(new Date(`${dateValue}T12:00:00`), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
              </p>
            )}
          </div>

          <button
            onClick={() => setDateValue(format(new Date(), 'yyyy-MM-dd'))}
            className="px-3 py-2 rounded-xl"
            style={{ fontSize: 12, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight }}
          >
            오늘로 선택
          </button>
        </div>

        <div className="flex gap-3 px-5 py-4 lg:px-6 lg:py-5" style={{ borderTop: `1px solid ${t.border}` }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl"
            style={{ fontSize: 14, fontWeight: 500, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
          >
            취소
          </button>
          <button
            onClick={() => {
              if (!dateValue) return;
              onConfirm(dateValue);
            }}
            className="flex-1 py-3 rounded-xl"
            style={{ fontSize: 14, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}
          >
            이동
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Block Context Menu ───
function PlanBlockContextMenu({ todo, position, onClose, onClone, onEditTime }: {
  todo: Todo;
  position: { x: number; y: number };
  onClose: () => void;
  onClone: () => void;
  onEditTime: () => void;
}) {
  const { updateTodo } = usePlanner();
  const { t } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showDeleteConfirm) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, showDeleteConfirm]);

  const left = Math.min(position.x, window.innerWidth - 160);
  const top = Math.min(position.y, window.innerHeight - 120);

  const btnStyle = (danger?: boolean) => ({
    fontSize: 12,
    color: danger ? '#DC2626' : t.text,
  });

  return (
    <>
      <div ref={ref} className="fixed z-50 rounded-xl py-1.5" style={{
        top, left,
        minWidth: 148,
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
      }}>
        <button className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
          style={btnStyle()}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.bgHover)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={onClone}>
          <Copy size={13} />
          <span>Do로 복제</span>
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
          style={btnStyle()}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.bgHover)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={onEditTime}>
          <Clock size={13} />
          <span>시간 편집</span>
        </button>
        <div className="my-1" style={{ borderBottom: `1px solid ${t.border}` }} />
        <button className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
          style={btnStyle(true)}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FEE2E2')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={13} />
          <span>삭제</span>
        </button>
      </div>
      {showDeleteConfirm && (
        <ConfirmModal
          message="PLAN 블록을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            updateTodo(todo.id, { planStart: undefined, planEnd: undefined });
            setShowDeleteConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Plan/Do Time Edit Modal ───
function PlanDoTimeEditModal({ todo, type, onClose, onConfirm }: {
  todo: Todo;
  type: 'plan' | 'do';
  onClose: () => void;
  onConfirm: (start: string, end: string) => void;
}) {
  const { t } = useTheme();
  const [startTime, setStartTime] = useState(
    type === 'plan' ? (todo.planStart || '') : (todo.doStart || '')
  );
  const [endTime, setEndTime] = useState(
    type === 'plan' ? (todo.planEnd || '') : (todo.doEnd || '')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[320px] overflow-hidden"
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>시간 편집</h3>
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>{todo.text}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <label style={{ fontSize: 12, color: t.textSub, width: 56, flexShrink: 0 }}>시작 시간</label>
            <TimePicker value={startTime} onChange={setStartTime} minuteStep={30} />
          </div>
          <div className="flex items-center gap-3">
            <label style={{ fontSize: 12, color: t.textSub, width: 56, flexShrink: 0 }}>종료 시간</label>
            <TimePicker value={endTime} onChange={setEndTime} minuteStep={30} />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button
            onClick={() => { if (startTime && endTime) onConfirm(startTime, endTime); }}
            disabled={!startTime || !endTime}
            className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff', opacity: (!startTime || !endTime) ? 0.5 : 1 }}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sleep Time Edit Modal ───
function SleepTimeEditModal({ record, onClose, onConfirm }: {
  record: SelfCareRecord;
  onClose: () => void;
  onConfirm: (sleepStart: string, sleepEnd: string) => void;
}) {
  const { t } = useTheme();
  const [start, setStart] = useState(record.sleepStart ?? '');
  const [end, setEnd] = useState(record.sleepEnd ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[320px] overflow-hidden"
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>🌙 수면 시간 수정</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <label style={{ fontSize: 12, color: t.textSub, width: 48, flexShrink: 0 }}>취침</label>
            <TimePicker value={start} onChange={setStart} placeholder="취침 시간" minuteStep={30} />
          </div>
          <div className="flex items-center gap-3">
            <label style={{ fontSize: 12, color: t.textSub, width: 48, flexShrink: 0 }}>기상</label>
            <TimePicker value={end} onChange={setEnd} placeholder="기상 시간" minuteStep={30} />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button onClick={() => { if (start && end) onConfirm(start, end); }}
            disabled={!start || !end}
            className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: start && end ? '#94A3B8' : t.bgSub, color: start && end ? '#fff' : t.textMuted }}>
            확인
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
    selfCareRecords, updateSelfCareRecord,
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
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [focusingTodo, setFocusingTodo] = useState<Todo | null>(null);
  const [snoozingTodo, setSnoozingTodo] = useState<Todo | null>(null);
  const [contextMenu, setContextMenu] = useState<{ todo: Todo; pos: { x: number; y: number } } | null>(null);
  const [planBlockMenu, setPlanBlockMenu] = useState<{ todo: Todo; pos: { x: number; y: number } } | null>(null);
  const [timeEditBlock, setTimeEditBlock] = useState<{ todo: Todo; type: 'plan' | 'do' } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sleep block drag state
  const [sleepDragState, setSleepDragState] = useState<{
    recordId: string;
    mode: 'move' | 'resize';
    startY: number;
    origStartMin: number;
    origEndMin: number;
  } | null>(null);
  const [sleepDragPreview, setSleepDragPreview] = useState<{ startMin: number; endMin: number } | null>(null);
  const sleepDragMovedRef = useRef(false);
  const [editingSleepRecord, setEditingSleepRecord] = useState<SelfCareRecord | null>(null);

  const createDragRef = useRef<{
    startMin: number;
    endMin: number;
    startClientY: number;
    startClientX: number;
    active: boolean;
  } | null>(null);
  const timelineRelativeRef = useRef<HTMLDivElement>(null);
  const [createPreview, setCreatePreview] = useState<{ startMin: number; endMin: number } | null>(null);
  const [pendingCreateTime, setPendingCreateTime] = useState<{ start: string; end: string } | null>(null);
  const [dailyMemo, setDailyMemo] = useState<Record<string, string>>({});
  const [showLogModal, setShowLogModal] = useState(false);
  const [showTimelineSettings, setShowTimelineSettings] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mobileTab, setMobileTab] = useState<'todos' | 'timeline'>('todos');
  const [timelineTab, setTimelineTab] = useState<'plan' | 'do' | 'compare'>('compare');
  const [timerNowMs, setTimerNowMs] = useState(Date.now());
  const [logOffsets, setLogOffsets] = useState<Record<string, number>>({});

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
  const logDragRef = useRef<{ id: string; startX: number; startOffset: number } | null>(null);
  const logDragMovedRef = useRef(false);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOG_OFFSET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      setLogOffsets(parsed);
    } catch {
      // ignore malformed local storage value
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOG_OFFSET_STORAGE_KEY, JSON.stringify(logOffsets));
  }, [logOffsets]);

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

  // Touch drag for timeline block resize (parallel to mouse drag)
  useEffect(() => {
    if (!dragState) return;
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      dragMovedRef.current = true;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - dragState.startY;
      const dMin = Math.round(dy / PX_PER_MIN / 5) * 5;
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
    const handleTouchEnd = () => {
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
      setTimeout(() => { dragMovedRef.current = false; }, 50);
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragState, dragPreview, tlStartHour, tlEndHour, updateTodo]);

  // Sleep block drag (mouse)
  useEffect(() => {
    if (!sleepDragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      sleepDragMovedRef.current = true;
      const dy = e.clientY - sleepDragState.startY;
      const dMin = Math.round(dy / PX_PER_MIN / 5) * 5;
      if (sleepDragState.mode === 'move') {
        const duration = sleepDragState.origEndMin - sleepDragState.origStartMin;
        const newStart = sleepDragState.origStartMin + dMin;
        setSleepDragPreview({ startMin: newStart, endMin: newStart + duration });
      } else {
        const newEnd = Math.max(sleepDragState.origStartMin + 5, sleepDragState.origEndMin + dMin);
        setSleepDragPreview({ startMin: sleepDragState.origStartMin, endMin: newEnd });
      }
    };
    const handleMouseUp = () => {
      if (sleepDragPreview && sleepDragMovedRef.current) {
        const startTime = minutesToTime(((sleepDragPreview.startMin % (24 * 60)) + 24 * 60) % (24 * 60));
        const endTime = minutesToTime(((sleepDragPreview.endMin % (24 * 60)) + 24 * 60) % (24 * 60));
        const duration = sleepDragPreview.endMin - sleepDragPreview.startMin;
        updateSelfCareRecord(sleepDragState.recordId, {
          sleepStart: startTime, sleepEnd: endTime,
          content: `${startTime} ~ ${endTime}`, duration,
        });
      }
      setSleepDragState(null);
      setSleepDragPreview(null);
      setTimeout(() => { sleepDragMovedRef.current = false; }, 50);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sleepDragState, sleepDragPreview, updateSelfCareRecord]);

  // PC mouse: create block by dragging empty timeline area
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!createDragRef.current?.active) return;
      const rect = timelineRelativeRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relY = e.clientY - rect.top;
      const rawMin = tlStartHour * 60 + relY / PX_PER_MIN;
      const snappedMin = Math.round(rawMin / 15) * 15;
      const endMin = Math.max(createDragRef.current.startMin + 15, Math.min(tlEndHour * 60, snappedMin));
      createDragRef.current.endMin = endMin;
      setCreatePreview({ startMin: createDragRef.current.startMin, endMin });
    };
    const handleMouseUp = () => {
      if (!createDragRef.current?.active) return;
      const { startMin, endMin } = createDragRef.current;
      createDragRef.current = null;
      setCreatePreview(null);
      if (endMin - startMin >= 15) {
        setPendingCreateTime({ start: minutesToTime(startMin), end: minutesToTime(endMin) });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [tlStartHour, tlEndHour]);

  // Mobile touch: create block by long-pressing empty timeline area (꾹 누르기).
  // A plain scroll must never create a block — block creation only starts after
  // the finger is held still for the long-press duration.
  useEffect(() => {
    const el = timelineRelativeRef.current;
    if (!el) return;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    const clearLongPress = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    };
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if ((touch.target as HTMLElement).closest('.timeline-block')) return;
      const rect = el.getBoundingClientRect();
      const relX = touch.clientX - rect.left;
      if (relX < TIMELINE_CONTENT_LEFT) return;
      const relY = touch.clientY - rect.top;
      const rawMin = tlStartHour * 60 + relY / PX_PER_MIN;
      const snappedMin = Math.round(rawMin / 15) * 15;
      const clamped = Math.max(tlStartHour * 60, Math.min(tlEndHour * 60 - 15, snappedMin));
      createDragRef.current = {
        startMin: clamped, endMin: clamped,
        startClientY: touch.clientY, startClientX: touch.clientX,
        active: false,
      };
      clearLongPress();
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (!createDragRef.current) return;
        createDragRef.current.active = true;
        const defaultEnd = Math.min(tlEndHour * 60, createDragRef.current.startMin + 30);
        createDragRef.current.endMin = defaultEnd;
        if (navigator.vibrate) navigator.vibrate(50);
        setCreatePreview({ startMin: createDragRef.current.startMin, endMin: defaultEnd });
      }, 500);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!createDragRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (!createDragRef.current.active) {
        // Long-press hasn't fired yet → any real movement means the user is
        // scrolling. Cancel the pending long-press and let the page scroll.
        const dy = touch.clientY - createDragRef.current.startClientY;
        const dx = touch.clientX - createDragRef.current.startClientX;
        if (Math.abs(dy) > 5 || Math.abs(dx) > 5) {
          clearLongPress();
          createDragRef.current = null;
        }
        return;
      }
      // Create mode is active → drag to size the block (block page scroll).
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const relY = touch.clientY - rect.top;
      const rawMin = tlStartHour * 60 + relY / PX_PER_MIN;
      const snappedMin = Math.round(rawMin / 15) * 15;
      const endMin = Math.max(createDragRef.current.startMin + 15, Math.min(tlEndHour * 60, snappedMin));
      createDragRef.current.endMin = endMin;
      setCreatePreview({ startMin: createDragRef.current.startMin, endMin });
    };
    const handleTouchEnd = () => {
      clearLongPress();
      if (!createDragRef.current) return;
      const { active, startMin, endMin } = createDragRef.current;
      createDragRef.current = null;
      setCreatePreview(null);
      if (active && endMin - startMin >= 15) {
        setPendingCreateTime({ start: minutesToTime(startMin), end: minutesToTime(endMin) });
      }
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      clearLongPress();
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [tlStartHour, tlEndHour]);

  useEffect(() => {
    const clampLogOffset = (offset: number) => {
      const limit = window.innerWidth < 1024 ? 56 : 120;
      return Math.max(-limit, Math.min(limit, offset));
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!logDragRef.current) return;
      logDragMovedRef.current = true;
      const delta = e.clientX - logDragRef.current.startX;
      setLogOffsets(prev => ({
        ...prev,
        [logDragRef.current!.id]: clampLogOffset(logDragRef.current!.startOffset + delta),
      }));
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!logDragRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      logDragMovedRef.current = true;
      const delta = touch.clientX - logDragRef.current.startX;
      setLogOffsets(prev => ({
        ...prev,
        [logDragRef.current!.id]: clampLogOffset(logDragRef.current!.startOffset + delta),
      }));
    };
    const handleEnd = () => {
      if (!logDragRef.current) return;
      logDragRef.current = null;
      setTimeout(() => {
        logDragMovedRef.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const dateTodos = todos.filter(td => td.date === selectedDate && td.status !== 'backlog');
  const importantTodos = dateTodos.filter(td => td.isTop3);
  const regularTodos = dateTodos.filter(td => !td.isTop3);

  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) return;
    const iv = setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  const getActiveTimerElapsedSec = () => {
    if (!activeTimer) return 0;
    return getTimerElapsedSec(activeTimer, timerNowMs);
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

  const handleTodoCheckboxAction = (todo: Todo) => {
    if (activeTimer?.todoId === todo.id) {
      stopTimer();
      return;
    }
    if (todo.status === 'done') {
      updateTodo(todo.id, { status: 'active', doStart: undefined, doEnd: undefined, doElapsedSec: undefined });
      return;
    }
    const doneAt = format(new Date(), 'HH:mm');
    updateTodo(todo.id, { status: 'done', doStart: doneAt, doEnd: doneAt, doElapsedSec: 0 });
  };

  const handleTodoFocusAction = (todo: Todo) => {
    if (activeTimer?.todoId === todo.id) {
      stopTimer();
      return;
    }
    if (activeTimer && activeTimer.todoId !== todo.id) return;
    setFocusingTodo(todo);
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

  // Sleep block renderer for the DO lane
  const renderSleepBlocks = () => {
    const daySleepRecords = selfCareRecords.filter(
      r => r.date === selectedDate && r.category === 'sleep' && r.sleepStart && r.sleepEnd
    );
    return daySleepRecords.map(record => {
      const [sh, sm] = record.sleepStart!.split(':').map(Number);
      const [eh, em] = record.sleepEnd!.split(':').map(Number);
      let startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;
      if (endMin <= startMin) endMin += 24 * 60;

      const isDragging = sleepDragState?.recordId === record.id;
      const previewStartMin = isDragging && sleepDragPreview ? sleepDragPreview.startMin : startMin;
      const previewEndMin = isDragging && sleepDragPreview ? sleepDragPreview.endMin : endMin;

      const laneBounds = getTimelineLaneBounds('do');
      if (!laneBounds) return null;

      const top = (previewStartMin / 60 - tlStartHour) * HOUR_HEIGHT;
      const height = Math.max((previewEndMin - previewStartMin) * PX_PER_MIN, 20);
      const displayStart = minutesToTime(((previewStartMin % (24 * 60)) + 24 * 60) % (24 * 60));
      const displayEnd = minutesToTime(((previewEndMin % (24 * 60)) + 24 * 60) % (24 * 60));

      return (
        <div key={`sleep-${record.id}`}
          className="absolute rounded-xl px-2 py-1.5 overflow-hidden group timeline-block"
          style={{
            top, height,
            left: laneBounds.left, right: laneBounds.right,
            backgroundColor: 'rgba(200,210,220,0.45)',
            border: '1px solid rgba(148,163,184,0.35)',
            borderLeft: '3px solid #94A3B8',
            opacity: isDragging ? 0.85 : 1,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            zIndex: isDragging ? 30 : 1,
            transition: isDragging ? 'none' : 'opacity 0.15s',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            sleepDragMovedRef.current = false;
            setSleepDragState({
              recordId: record.id, mode: 'move', startY: e.clientY,
              origStartMin: startMin, origEndMin: endMin,
            });
          }}
          onClick={() => { if (!sleepDragMovedRef.current) setEditingSleepRecord(record); }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>🌙 수면</div>
          {height > 36 && (
            <div style={{ fontSize: 9, color: '#64748B', opacity: 0.8, marginTop: 2 }}>
              {displayStart} - {displayEnd}
            </div>
          )}
          <div
            className="absolute left-0 right-0 bottom-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ height: 8, cursor: 'ns-resize', backgroundColor: 'rgba(148,163,184,0.3)' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              sleepDragMovedRef.current = false;
              setSleepDragState({
                recordId: record.id, mode: 'resize', startY: e.clientY,
                origStartMin: startMin, origEndMin: endMin,
              });
            }}
          >
            <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: '#94A3B8' }} />
          </div>
          <div
            className="absolute left-0 right-0 bottom-0 lg:hidden"
            style={{ height: 44, touchAction: 'none' }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = e.touches[0];
              if (!touch) return;
              sleepDragMovedRef.current = false;
              setSleepDragState({
                recordId: record.id, mode: 'resize', startY: touch.clientY,
                origStartMin: startMin, origEndMin: endMin,
              });
            }}
          />
        </div>
      );
    });
  };

  // PC create-by-drag handler for the timeline background div
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.timeline-block')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < TIMELINE_CONTENT_LEFT) return;
    const relY = e.clientY - rect.top;
    const rawMin = tlStartHour * 60 + relY / PX_PER_MIN;
    const snappedMin = Math.round(rawMin / 15) * 15;
    const clamped = Math.max(tlStartHour * 60, Math.min(tlEndHour * 60 - 15, snappedMin));
    createDragRef.current = {
      startMin: clamped, endMin: clamped,
      startClientY: e.clientY, startClientX: e.clientX,
      active: true,
    };
  }, [tlStartHour, tlEndHour]);

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

    const isPlan = type === 'plan';
    const isCheckOnlyDo = !isPlan && todo.doElapsedSec === 0;
    const hasFocusedDuration = !isPlan && todo.doElapsedSec != null && todo.doElapsedSec > 0;
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = isCheckOnlyDo ? 30 : Math.max((endMin - startMin) * PX_PER_MIN, 20);
    const tagColor = getTodoTagColor(todo);
    const laneBounds = getTimelineLaneBounds(isPlan ? 'plan' : 'do');
    if (!laneBounds) return null;
    const canDrag = isPlan || !isCheckOnlyDo;

    // DO 초과 감지 (DO 시간 > PLAN 시간) — 타이머 실제 초가 있으면 분 단위 막대 대신 사용
    let isOvertime = false;
    if (!isPlan && !isCheckOnlyDo && todo.planStart && todo.planEnd) {
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
      bg = 'rgba(237,228,216,0.52)';
      textColor = '#7D6347';
      borderClr = '#C4A882';
    } else if (isOvertime) {
      bg = 'rgba(250,232,214,0.65)';
      textColor = OVERTIME_BAR_BORDER;
      borderClr = OVERTIME_BAR_BORDER;
    } else if (isCheckOnlyDo) {
      bg = tagColor ? `${tagColor}12` : 'rgba(212,237,224,0.45)';
      textColor = tagColor || '#3D7A58';
      borderClr = tagColor || '#6BAA7A';
    } else if (tagColor) {
      bg = tagColor + '1A';
      textColor = tagColor;
      borderClr = tagColor;
    } else {
      bg = 'rgba(212,237,224,0.52)';
      textColor = '#3D7A58';
      borderClr = '#6BAA7A';
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
    const durationLabel = hasFocusedDuration ? formatDuration(todo.doElapsedSec!) : '';
    const compactLabel = isPlan
      ? `${todo.text} ${baseTimeLabel}`
      : hasFocusedDuration
        ? `${todo.text} ${baseTimeLabel} ${durationLabel}`
        : todo.text;
    const detailLabel = isPlan ? baseTimeLabel : hasFocusedDuration ? `${baseTimeLabel} ${durationLabel}` : '';
    const isCompact = isCheckOnlyDo || height < 52;
    const titleLabel = isPlan
      ? `${todo.text}\n${baseTimeLabel}`
      : hasFocusedDuration
        ? `${todo.text}\n${baseTimeLabel}\n${durationLabel}`
        : `${todo.text}\n${start}`;

    return (
      <div key={`${todo.id}-${type}`}
        className="absolute rounded-xl px-2 py-1.5 overflow-hidden group timeline-block"
        style={{
          top,
          height,
          left: laneBounds.left,
          right: laneBounds.right,
          backgroundColor: bg,
          border: `1px solid ${borderClr}20`,
          borderLeft: `3px solid ${borderClr}`,
          opacity: isDragging ? 0.85 : (todo.status === 'cancelled' ? 0.4 : 1),
          cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          userSelect: 'none',
          zIndex: isDragging ? 30 : 1,
          transition: isDragging ? 'none' : 'opacity 0.15s',
          boxShadow: `0 2px 8px ${borderClr}14, 0 1px 2px rgba(0,0,0,0.04)`,
        }}
        onMouseDown={canDrag ? ((e) => handleDragStart(e, 'move')) : undefined}
        onClick={(e) => {
          if (!dragState && !dragMovedRef.current) window.dispatchEvent(new CustomEvent('editTodo', { detail: todo }));
        }}
        onContextMenu={e => {
          e.preventDefault();
          if (isPlan) {
            setPlanBlockMenu({ todo, pos: { x: e.clientX, y: e.clientY } });
          } else {
            setContextMenu({ todo, pos: { x: e.clientX, y: e.clientY } });
          }
        }}
        onTouchStart={isPlan ? (e) => {
          longPressTimerRef.current = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            const touch = e.touches[0];
            if (touch) setPlanBlockMenu({ todo, pos: { x: touch.clientX, y: touch.clientY } });
          }, 500);
        } : undefined}
        onTouchEnd={isPlan ? () => {
          if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        } : undefined}
        onTouchMove={isPlan ? () => {
          if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        } : undefined}
        title={titleLabel}
      >
        {isCompact ? (
          <div className="flex items-center gap-2 h-full">
            {isCheckOnlyDo && (
              <span
                className="relative inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `1.5px solid ${borderClr}`,
                  backgroundColor: `${borderClr}12`,
                }}
              >
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    backgroundColor: borderClr,
                    color: '#fff',
                    fontSize: 7,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  ✓
                </span>
              </span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, color: textColor,
              textDecoration: isCheckOnlyDo ? 'none' : (todo.status === 'done' ? 'line-through' : 'none'),
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {compactLabel}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span style={{
                fontSize: 11, fontWeight: 700, color: textColor,
                textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {todo.text}
              </span>
            </div>
            {detailLabel && (
              <div style={{ fontSize: 10, color: textColor, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {detailLabel}
              </div>
            )}
          </>
        )}
        {canDrag && (
          <>
            <div
              className="absolute left-0 right-0 bottom-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ height: 8, cursor: 'ns-resize', backgroundColor: isDragging ? 'transparent' : (isPlan ? '#515f7440' : '#00000015') }}
              onMouseDown={(e) => handleDragStart(e, 'resize')}
            >
              <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: isPlan ? PLAN_BAR_BORDER : `${textColor}80` }} />
            </div>
            <div
              className="absolute left-0 right-0 bottom-0 lg:hidden"
              style={{ height: 44, touchAction: 'none' }}
              onTouchStart={(e) => {
                e.stopPropagation();
                const touch = e.touches[0];
                if (!touch) return;
                dragMovedRef.current = false;
                setDragState({
                  todoId: todo.id,
                  type,
                  mode: 'resize',
                  startY: touch.clientY,
                  origStartMin: timeToMinutes(start),
                  origEndMin: timeToMinutes(end),
                });
              }}
            />
          </>
        )}
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
    const eventColor = evt.color || '#7B9ED9';

    return (
      <div key={`ev-${evt.id}`}
        className="absolute rounded-lg px-2.5 py-1.5 overflow-hidden timeline-block"
        style={{
          top, height,
          left: laneBounds.left, right: laneBounds.right,
          backgroundColor: `${eventColor}24`,
          border: `1.5px solid ${eventColor}`,
          zIndex: 3,
        }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: eventColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📅 {evt.title}
        </div>
        {height > 30 && (
          <div style={{ fontSize: 9, color: eventColor, opacity: 0.8, marginTop: 1 }}>
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
    const currentEndHHMM = minutesToTime(startMin + elapsedMin);
    const tagColor = getTodoTagColor(todo);
    const planDur = todo.planStart && todo.planEnd
      ? timeToMinutes(todo.planEnd) - timeToMinutes(todo.planStart)
      : null;
    const isOvertime = planDur !== null ? elapsedMin > planDur : false;
    const bgColor = isOvertime ? OVERTIME_BAR_BG : (tagColor || '#059669');
    const textColor = isOvertime ? OVERTIME_BAR_BORDER : (tagColor ? getContrastTextColor(tagColor) : '#ffffff');

    return (
      <div className="absolute rounded-lg px-2.5 py-1.5 animate-pulse timeline-block"
        style={{
          top, height, left: laneBounds.left, right: laneBounds.right,
          backgroundColor: bgColor,
          border: `1px solid ${isOvertime ? OVERTIME_BAR_BORDER : (tagColor || '#047857')}`,
        }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{todo.text}</div>
        <div style={{ fontSize: 9, color: textColor, opacity: 0.85 }}>
          {activeTimer.startHHMM}-{currentEndHHMM} {formatDuration(elapsedSec)}
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
        const offset = logOffsets[log.id] ?? 0;
        const beginLogDrag = (clientX: number) => {
          logDragRef.current = {
            id: log.id,
            startX: clientX,
            startOffset: offset,
          };
          logDragMovedRef.current = false;
        };

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
            {/* Thought bubble in DO area */}
            <div className="absolute z-20"
              style={{
                top: top - 14,
                left: laneBounds.left,
                minWidth: 108,
                maxWidth: 'min(210px, calc(100vw - 132px))',
                backgroundColor: 'rgba(253,250,244,0.74)',
                border: `1px solid ${logColor}28`,
                borderRadius: '0 10px 10px 10px',
                boxShadow: `0 3px 12px rgba(0,0,0,0.05), 0 1px 3px ${logColor}18`,
                padding: '5px 9px',
                transform: `translateX(${offset}px)`,
                cursor: 'grab',
              }}
              onMouseDown={(e) => beginLogDrag(e.clientX)}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                beginLogDrag(touch.clientX);
              }}
              onClick={() => {
                if (!logDragMovedRef.current) setShowLogModal(true);
              }}
              title={log.text}
            >
              <div className="flex items-start gap-1.5">
                <span style={{ fontSize: 12, color: logColor, flexShrink: 0, lineHeight: 1.3 }}>
                  {log.icon || '💭'}
                </span>
                <div>
                  <p style={{ fontSize: 10, fontStyle: 'italic', color: '#3D3020', lineHeight: 1.4, margin: 0 }}>
                    {log.text.length > 28 ? log.text.slice(0, 28) + '…' : log.text}
                  </p>
                  <span style={{ fontSize: 8, fontWeight: 700, color: logColor, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {log.time}
                  </span>
                </div>
              </div>
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
        <button onClick={() => handleTodoCheckboxAction(todo)}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all mt-0.5"
          style={{
            border: isDone ? 'none' : `2px solid ${todo.status === 'inProgress' ? t.success : accentColor}60`,
            backgroundColor: isDone ? t.checkDone : (todo.status === 'inProgress' ? `${t.success}12` : 'transparent'),
          }}>
          {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
          {!isDone && todo.status === 'inProgress' && <Play size={9} color={t.success} fill={t.success} />}
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
            <button onClick={() => handleTodoFocusAction(todo)}
              className="p-1.5 rounded-lg transition-colors"
              title={todo.id === activeTimer?.todoId ? '포커스 완료' : '포커스 시작'}
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
    <div className="relative flex-1 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="relative flex items-center justify-between px-3 py-3 lg:px-6 lg:py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="w-10 lg:w-28 flex-shrink-0" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center px-3 lg:px-6 pointer-events-none">
          <div className="flex items-center gap-1 lg:gap-2 max-w-full pointer-events-auto">
            <button onClick={goPrev} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: t.textSub }}>
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setShowDatePicker(true)}
              className="rounded-xl px-2.5 py-1.5 transition-colors min-w-0"
              style={{ backgroundColor: 'transparent' }}
              title="날짜 선택"
            >
              <div className="text-center">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}
                  className="lg:text-[20px] whitespace-nowrap">
                  {format(dateObj, 'M월 d일')}
                </h2>
                <p style={{ fontSize: 12, color: t.textSub }} className="whitespace-nowrap">{dayName}</p>
              </div>
            </button>
            <button onClick={goNext} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: t.textSub }}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-2">
          {selectedDate !== nowStr && (
            <button
              onClick={goToday}
              className="px-2 py-1 rounded-lg"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accentLight, color: t.accent, whiteSpace: 'nowrap' }}
            >
              Today
            </button>
          )}
          {/* 데스크탑: 기존 모달 */}
          <button onClick={() => setShowTimelineSettings(true)} className="hidden lg:flex px-3 py-1.5 rounded-lg items-center gap-1.5"
            style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            <Settings size={12} />
            <span>시간대 설정</span>
          </button>
          {/* 모바일: 설정 페이지 링크 */}
          <NavLink to="/settings" className="lg:hidden p-1.5 rounded-lg flex items-center gap-1"
            style={{ fontSize: 10, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            <Settings size={12} />
          </NavLink>
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
            TIMELINE
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
            <div className="flex items-center justify-between gap-3 mb-3">
              <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  전체 할일 ({regularTodos.length})
              </span>
              <AddEntryMenu
                onAddTodo={() => setShowAddModal(true)}
                onAddEvent={() => setShowAddEventModal(true)}
                align="end"
              />
            </div>
            <div className="space-y-2">
              {regularTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
              {regularTodos.length === 0 && (
                <div className="py-8 text-center">
                  <p style={{ fontSize: 13, color: t.textMuted }}>아직 할일이 없습니다</p>
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
                <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.08em' }}>TIMELINE</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowLogModal(true)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg lg:gap-1.5 lg:px-2.5"
                  style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 11 }}>💭</span> Think
                </button>
                {/* PLAN / 비교 / DO 탭 */}
                <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {(['plan', 'compare', 'do'] as const).map((tab, i) => (
                    <button key={tab}
                      onClick={() => setTimelineTab(tab)}
                      className="px-2 py-1.5 lg:px-2.5"
                      style={{
                        fontSize: 10, fontWeight: timelineTab === tab ? 700 : 500,
                        backgroundColor: timelineTab === tab ? t.bgSub : 'transparent',
                        color: timelineTab === tab
                          ? t.text
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
            <div className="mt-2 flex items-center gap-1">
              <div style={{ width: TIMELINE_LABEL_WIDTH, flexShrink: 0, fontSize: 8, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', paddingRight: 6 }}>
                TIME
              </div>
              {timelineTab === 'compare' ? (
                <div className="flex-1 grid" style={{ gridTemplateColumns: `1fr ${TIMELINE_LANE_GAP}px 1fr` }}>
                  <div className="px-3 py-1"
                    style={{ fontSize: 9, fontWeight: 800, color: '#C4A882', letterSpacing: '0.1em', textTransform: 'uppercase', borderLeft: '3px solid #C4A88230' }}>
                    PLAN
                  </div>
                  <div />
                  <div className="px-3 py-1"
                    style={{ fontSize: 9, fontWeight: 800, color: '#6BAA7A', letterSpacing: '0.1em', textTransform: 'uppercase', borderLeft: '3px solid #6BAA7A30' }}>
                    DO
                  </div>
                </div>
              ) : (
                <div className="flex-1 px-3 py-1"
                  style={{ borderLeft: `3px solid ${timelineTab === 'plan' ? '#C4A88230' : '#6BAA7A30'}` }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: timelineTab === 'plan' ? '#C4A882' : '#6BAA7A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {timelineTab === 'plan' ? 'PLAN' : 'DO'}
                  </span>
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
            <div ref={timelineRelativeRef} className="relative" style={{ height: totalHeight + 16, WebkitTouchCallout: 'none', userSelect: 'none' }} onMouseDown={handleTimelineMouseDown}>
              {/* Lane backgrounds */}
              <div className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: TIMELINE_CONTENT_LEFT, right: 0 }}>
                {timelineTab === 'compare' ? (
                  <>
                    <div className="absolute inset-y-0 rounded-2xl"
                      style={{
                        left: 0,
                        right: `calc(50% + ${TIMELINE_LANE_GAP / 2}px)`,
                        background: 'transparent',
                        border: `1px solid ${t.borderLight}`,
                      }} />
                    <div className="absolute inset-y-0 rounded-2xl"
                      style={{
                        left: `calc(50% + ${TIMELINE_LANE_GAP / 2}px)`,
                        right: 0,
                        background: 'transparent',
                        border: `1px solid ${t.borderLight}`,
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
                      background: 'transparent',
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
                      fontSize: 10, color: t.textMuted, width: TIMELINE_LABEL_WIDTH, flexShrink: 0,
                      paddingTop: 0, textAlign: 'right', paddingRight: 8,
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
                  <div className="flex items-center" style={{ marginLeft: TIMELINE_LABEL_WIDTH - 4 }}>
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
                {renderSleepBlocks()}
                {renderLogMarkers()}
                {createPreview && (() => {
                  const lb = getTimelineLaneBounds('plan');
                  if (!lb) return null;
                  const previewTop = (createPreview.startMin / 60 - tlStartHour) * HOUR_HEIGHT;
                  const previewHeight = Math.max((createPreview.endMin - createPreview.startMin) * PX_PER_MIN, 20);
                  return (
                    <div className="absolute rounded-xl pointer-events-none"
                      style={{
                        top: previewTop, height: previewHeight,
                        left: lb.left, right: lb.right,
                        backgroundColor: 'rgba(196,168,130,0.25)',
                        border: '2px dashed #C4A882',
                        zIndex: 50,
                      }}>
                      <div style={{ fontSize: 10, color: '#7D6347', padding: '2px 6px', fontWeight: 600 }}>
                        {minutesToTime(createPreview.startMin)} - {minutesToTime(createPreview.endMin)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        </div>{/* /Columns Wrapper */}
      </div>

      <FloatingAddFab
        onAddTodo={() => setShowAddModal(true)}
        onAddEvent={() => setShowAddEventModal(true)}
      />

      {/* Modals */}
      {showAddModal && <TodoModal date={selectedDate} onClose={() => setShowAddModal(false)} />}
      {showAddEventModal && <EventModal date={selectedDate} onClose={() => setShowAddEventModal(false)} />}
      {editingTodo && <TodoModal date={selectedDate} todo={editingTodo} onClose={() => setEditingTodo(null)} />}
      {snoozingTodo && <SnoozeModal todo={snoozingTodo} onClose={() => setSnoozingTodo(null)} />}
      {contextMenu && (
        <ContextMenu
          todo={contextMenu.todo}
          position={contextMenu.pos}
          onClose={() => setContextMenu(null)}
          onFocus={setFocusingTodo}
        />
      )}
      {planBlockMenu && (
        <PlanBlockContextMenu
          todo={planBlockMenu.todo}
          position={planBlockMenu.pos}
          onClose={() => setPlanBlockMenu(null)}
          onClone={() => {
            const td = planBlockMenu.todo;
            updateTodo(td.id, { doStart: td.planStart, doEnd: td.planEnd });
            setPlanBlockMenu(null);
            setTimeEditBlock({ todo: td, type: 'do' });
          }}
          onEditTime={() => {
            const td = planBlockMenu.todo;
            setPlanBlockMenu(null);
            setTimeEditBlock({ todo: td, type: 'plan' });
          }}
        />
      )}
      {timeEditBlock && (
        <PlanDoTimeEditModal
          todo={timeEditBlock.todo}
          type={timeEditBlock.type}
          onClose={() => setTimeEditBlock(null)}
          onConfirm={(start, end) => {
            const updates = timeEditBlock.type === 'plan'
              ? { planStart: start, planEnd: end }
              : { doStart: start, doEnd: end, doElapsedSec: undefined };
            updateTodo(timeEditBlock.todo.id, updates);
            setTimeEditBlock(null);
          }}
        />
      )}
      {pendingCreateTime && (
        <TodoModal
          date={selectedDate}
          initialPlanStart={pendingCreateTime.start}
          initialPlanEnd={pendingCreateTime.end}
          onClose={() => setPendingCreateTime(null)}
        />
      )}
      {editingSleepRecord && (
        <SleepTimeEditModal
          record={editingSleepRecord}
          onClose={() => setEditingSleepRecord(null)}
          onConfirm={(sleepStart, sleepEnd) => {
            const [sh, sm] = sleepStart.split(':').map(Number);
            const [eh, em] = sleepEnd.split(':').map(Number);
            let endMin = eh * 60 + em;
            const startMin = sh * 60 + sm;
            if (endMin <= startMin) endMin += 24 * 60;
            updateSelfCareRecord(editingSleepRecord.id, {
              sleepStart, sleepEnd,
              content: `${sleepStart} ~ ${sleepEnd}`,
              duration: endMin - startMin,
            });
            setEditingSleepRecord(null);
          }}
        />
      )}
      {focusingTodo && (
        <FocusModal
          todo={focusingTodo}
          onClose={() => setFocusingTodo(null)}
          onStart={(mode, pomoDurationSec) => {
            startTimer(focusingTodo.id, { mode, pomoDurationSec });
            setFocusingTodo(null);
          }}
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
      {showDatePicker && (
        <DailyDatePickerModal
          selectedDate={selectedDate}
          onClose={() => setShowDatePicker(false)}
          onConfirm={(date) => {
            setSelectedDate(date);
            setShowDatePicker(false);
          }}
        />
      )}
    </div>
  );
}