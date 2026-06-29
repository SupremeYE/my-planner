import { useState, useEffect, useRef } from 'react';
import { useSearchParams, NavLink } from 'react-router';
import {
  ChevronLeft, ChevronRight, Star, Play,
  Check, Clock, Trash2, X, MoreHorizontal,
  Settings, Edit3, Pause, Ban, CalendarDays, MessageSquare, ArrowRight,
} from 'lucide-react';
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay as getDayOfWeek, parseISO, addMinutes } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { useNotification } from '../hooks/useNotification';
import { TimePicker } from './TimePicker';
import { HabitChip } from './HabitsView';
import ConfirmModal from './ConfirmModal';
import { TodoModal } from './TodoModal';
import { MandalartSourceBadge } from './mandalart/MandalartSourceBadge';
import { EventModal } from './EventModal';
import { FocusModal } from './FocusModal';
import { useFabAction } from '../FabContext';
import { AddEntryMenu } from './AddEntryMenu';
import { isEventPast } from '../../api/events';
import { expandRecurringTodos, isVirtualTodoId, parseVirtualTodoId } from '../../lib/recurrenceExpansion';
import { RecurrenceBranchModal } from './RecurrenceBranchModal';
import { Timeline } from './timeline/Timeline';
import { TimelineSettingsModal } from './timeline/TimelineSettingsModal';

// ─── Status config ───
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: '예정', color: '#6B7280', bgColor: '#F3F4F6' },
  inProgress: { label: '진행중', color: '#059669', bgColor: '#D1FAE5' },
  done: { label: '완료', color: '#515f74', bgColor: '#d5e3fd' },
  snoozed: { label: '미루기', color: '#D97706', bgColor: '#FEF3C7' },
  cancelled: { label: '취소', color: '#DC2626', bgColor: '#FEE2E2' },
};

// ─── Snooze Date Picker Modal ───
function SnoozeModal({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const { updateTodo, addTodo, deleteRecurringTodo } = usePlanner();
  const { t } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedSnoozeDate, setSelectedSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState(todo.planStart || '09:00');

  const todayStr = getLogicalToday();
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
    // 반복 가상 인스턴스 미루기: 이 occurrence를 원래 날짜에서 취소하고 선택 날짜에 단일 할일로 옮긴다.
    if (isVirtualTodoId(todo.id)) {
      const info = parseVirtualTodoId(todo.id);
      if (info) {
        deleteRecurringTodo(info.parentId, info.instanceDate, 'this');
        addTodo({
          text: todo.text,
          date: selectedSnoozeDate,
          status: 'active',
          isTop3: todo.isTop3,
          planStart: snoozeTime || undefined,
          tags: todo.tags,
          projectId: todo.projectId,
        });
        onClose();
        return;
      }
    }
    updateTodo(todo.id, {
      date: selectedSnoozeDate,
      status: 'active',
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
function ContextMenu({ todo, position, onClose, onFocus, onDelete, deleteMessage, variant = 'list' }: {
  todo: Todo;
  position: { x: number; y: number };
  onClose: () => void;
  onFocus: (todo: Todo) => void;
  onDelete?: () => void;
  deleteMessage?: string;
  variant?: 'list' | 'block'; // 'block' = 타임라인 블록/우클릭 공통 (편집·미루기·삭제만)
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

  const menuItems = variant === 'block'
    ? [
        { label: '편집', icon: Edit3, action: 'edit' },
        { divider: true },
        { label: '미루기', icon: ArrowRight, action: 'snooze-modal' },
        { divider: true },
        { label: '삭제', icon: Trash2, action: 'delete', danger: true },
      ]
    : [
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
                } else if ((item as any).action === 'snoozed' || (item as any).action === 'snooze-modal') {
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
          message={deleteMessage ?? "이 할일을 삭제할까요?"}
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            if (onDelete) onDelete();
            else deleteTodo(todo.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Daily Memo (일간 메모) ───
// 일간 메모 — 입력 중 Realtime 동기화로 글자가 지워지던 문제 방지용 컴포넌트.
// (기존엔 textarea value 를 store 값에 직접 바인딩 → 키 입력마다 upsert→Realtime 재조회가
//  store 전체를 덮어써, 모바일에서 왕복 지연 동안 방금 친 글자가 사라졌다.)
// 해결: 입력은 로컬 상태로 받고, 저장은 디바운스 + blur 에만 store/DB 로 반영한다.
//       포커스 중에는 외부(다른 기기) 값으로 덮어쓰지 않는다. 최상위 컴포넌트로 정의해 리마운트 방지.
function DailyMemo({ date, value, onChange }: {
  date: string;
  value: string;
  onChange: (date: string, text: string) => void;
}) {
  const { t } = useTheme();
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  const dateRef = useRef(date);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 날짜 변경 시엔 무조건 해당 날짜 메모로 교체, 같은 날짜의 외부 변경은 입력 중이 아닐 때만 반영
  useEffect(() => {
    if (dateRef.current !== date) {
      dateRef.current = date;
      setLocal(value);
    } else if (!focusedRef.current) {
      setLocal(value);
    }
  }, [value, date]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleChange = (text: string) => {
    setLocal(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(date, text), 500);
  };

  return (
    <textarea
      value={local}
      onChange={e => handleChange(e.target.value)}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => {
        focusedRef.current = false;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        onChange(date, local); // blur 시 확실히 저장
      }}
      placeholder="오늘의 메모..."
      className="w-full rounded-xl px-4 py-3 outline-none resize-none"
      style={{
        border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text,
        fontSize: 13, minHeight: 180,
      }}
    />
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
            onClick={() => setDateValue(getLogicalToday())}
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

// ─── Main Daily View ───
export function DailyView() {
  const {
    selectedDate, setSelectedDate, todos, events, updateTodo, addTodo, toggleEventCompleted, deleteRecurringTodo, habits, updateHabitMemo,
    activeTimer, startTimer, stopTimer, tags, projects, weeklyGoals, milestones,
    dayStartHour: tlStartHour, dayEndHour: tlEndHour, setDayHours,
    brainstormMemos, setBrainstormMemo,
  } = usePlanner();
  const { t } = useTheme();
  const { scheduleAlerts } = useNotification();
  const [searchParams] = useSearchParams();
  const highlightTodoId = searchParams.get('todoId');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // 전역 FAB — 일간은 날짜 맥락 빠른 입력 + 할일/일정 상세 단축
  useFabAction({
    kind: 'quick',
    defaultDate: selectedDate,
    onAddTodo: () => setShowAddModal(true),
    onAddEvent: () => setShowAddEventModal(true),
  });
  // 메모 유형 습관의 일별 메모 임시 입력값 (id → text)
  const [habitMemoEditing, setHabitMemoEditing] = useState<Record<string, string>>({});
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [focusingTodo, setFocusingTodo] = useState<Todo | null>(null);
  const [snoozingTodo, setSnoozingTodo] = useState<Todo | null>(null);
  const [contextMenu, setContextMenu] = useState<{ todo: Todo; pos: { x: number; y: number }; source?: 'do' | 'plan' } | null>(null);
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState<Todo | null>(null);
  // 미루기 → 빠른 버튼이 반복 할일을 만나면 this/future/all 분기
  const [recurringSnoozeTarget, setRecurringSnoozeTarget] = useState<Todo | null>(null);
  // ★ KEY 권장 안내 (4개 이상일 때 가벼운 토스트)
  const [keyHint, setKeyHint] = useState<string | null>(null);
  // → 버튼 길게 누르기(롱프레스) 판별용 (행마다 hook 추가 금지 → 부모 ref 공유)
  const snoozeLongPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  const [showTimelineSettings, setShowTimelineSettings] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mobileTab, setMobileTab] = useState<'todos' | 'timeline'>('todos');

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

  const dateTodos = expandRecurringTodos(todos, selectedDate, selectedDate)
    .filter(td => td.date === selectedDate && td.status !== 'backlog');
  const importantTodos = dateTodos.filter(td => td.isTop3);
  const regularTodos = dateTodos.filter(td => !td.isTop3);

  // 오늘 날짜인 경우에만 알림 스케줄 등록
  const todayStr2 = getLogicalToday();
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

  const goToday = () => setSelectedDate(getLogicalToday());
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

  const handleTodoCheckboxAction = (todo: Todo) => {
    if (activeTimer?.todoId === todo.id) {
      stopTimer();
      return;
    }
    if (todo.status === 'done') {
      updateTodo(todo.id, { status: 'active' });
      return;
    }
    if (todo.doStart && todo.doEnd) {
      updateTodo(todo.id, { status: 'done' });
    } else if (todo.planStart && todo.planEnd) {
      updateTodo(todo.id, { status: 'done', doStart: todo.planStart, doEnd: todo.planEnd });
    } else {
      const s = format(new Date(), 'HH:mm');
      const e = format(addMinutes(new Date(), 30), 'HH:mm');
      updateTodo(todo.id, { status: 'done', doStart: s, doEnd: e });
    }
  };

  // 반복 여부: 가상 인스턴스(parentId::date) 또는 반복 원본(예외 레코드 제외)
  const isRecurringTodo = (todo: Todo) =>
    isVirtualTodoId(todo.id) || (!!todo.recurrenceRule && !todo.recurrenceParentId);

  // 미루기 저장은 SnoozeModal.handleConfirm 과 동일한 store 함수 재사용(신규 저장 로직 없음)
  // 일반: updateTodo(date) / 반복: deleteRecurringTodo(scope) + addTodo(다음날 단일)
  const quickSnoozeTomorrow = (todo: Todo, scope?: 'this' | 'future' | 'all') => {
    if (!todo.date) return;
    const nextDay = format(addDays(parseISO(todo.date), 1), 'yyyy-MM-dd');
    if (isRecurringTodo(todo) && scope) {
      let parentId: string;
      let instanceDate: string;
      if (isVirtualTodoId(todo.id)) {
        const info = parseVirtualTodoId(todo.id);
        if (!info) return;
        parentId = info.parentId; instanceDate = info.instanceDate;
      } else {
        parentId = todo.id; instanceDate = todo.date;
      }
      deleteRecurringTodo(parentId, instanceDate, scope);
      addTodo({
        text: todo.text, date: nextDay, status: 'active', isTop3: todo.isTop3,
        planStart: todo.planStart || undefined, tags: todo.tags, projectId: todo.projectId,
      });
    } else {
      updateTodo(todo.id, {
        date: nextDay, status: 'active',
        planEnd: undefined, doStart: undefined, doEnd: undefined, doElapsedSec: undefined,
      });
    }
  };

  // → 단일 탭: 일반=즉시 내일로 / 반복=RecurrenceBranchModal('edit') 분기
  const handleQuickSnooze = (todo: Todo) => {
    if (isRecurringTodo(todo)) setRecurringSnoozeTarget(todo);
    else quickSnoozeTomorrow(todo);
  };

  // ★ KEY 빠른 토글 (4개 이상이면 막지 않고 안내만)
  const toggleKeyTodo = (todo: Todo) => {
    if (!todo.isTop3 && dateTodos.filter(td => td.isTop3).length >= 3) {
      setKeyHint('핵심은 3개를 권장해요');
      setTimeout(() => setKeyHint(null), 2000);
    }
    updateTodo(todo.id, { isTop3: !todo.isTop3 });
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

  // Current time indicator (1분마다 자동 갱신)
  const [nowDate, setNowDate] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNowDate(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);
  const nowStr = format(nowDate, 'yyyy-MM-dd');

  // Todo row for list
  // 주의: DailyView 안에서 정의하되 JSX 엘리먼트(<TodoRow/>)가 아니라 함수로 호출해 렌더한다.
  // 엘리먼트로 쓰면 매 렌더마다 새 컴포넌트 타입이 되어 행 전체가 unmount/remount → 모바일에서
  // 탭(touch) 도중 노드가 교체되며 체크박스 클릭이 유실되는 문제가 있었다. 함수 호출은 부모 트리에
  // 인라인되어 리마운트가 없다(키는 루트 div의 key로 유지).
  const TodoRow = ({ todo }: { todo: Todo }) => {
    const project = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;
    const weeklyGoal = todo.weeklyGoalId ? weeklyGoals.find(w => w.id === todo.weeklyGoalId) : null;
    const milestone = todo.milestoneId ? milestones.find(m => m.id === todo.milestoneId) : null;
    const firstTag = (todo.tags && todo.tags.length > 0) ? tags.find(tg => tg.id === todo.tags![0]) : null;
    const accentColor = firstTag?.color || t.border;
    const isDone = todo.status === 'done';

    const isHighlighted = highlightTodoId === todo.id;
    return (
      <div
        key={todo.id}
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
            <button
              type="button"
              aria-label="KEY 토글"
              title={todo.isTop3 ? 'KEY 해제' : 'KEY로 올리기'}
              className="p-0.5 -ml-0.5 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleKeyTodo(todo); }}
            >
              <Star size={13} fill={todo.isTop3 ? t.accent : 'none'} color={todo.isTop3 ? t.accent : t.textMuted} />
            </button>
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
            {todo.mandalartCellId && <MandalartSourceBadge />}
            {milestone && project && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full"
                style={{
                  fontSize: 9, backgroundColor: project.color + '18', color: project.color, fontWeight: 600, lineHeight: '14px', maxWidth: 140,
                }}
                title={milestone.title}
              >
                🚩 <span className="truncate" style={{ maxWidth: 110 }}>{milestone.title}</span>
              </span>
            )}
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
            {weeklyGoal && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full"
                style={{
                  fontSize: 9, backgroundColor: t.accentLight, color: t.accent, lineHeight: '14px', maxWidth: 140,
                }}
                title={weeklyGoal.text}
              >
                🎯 <span className="truncate" style={{ maxWidth: 110 }}>{weeklyGoal.text}</span>
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
          {/* 미루기 → : 탭=내일로, 길게=날짜 지정(SnoozeModal) */}
          <button
            aria-label="미루기"
            title="내일로 미루기 (길게: 날짜 지정)"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: t.textSub, backgroundColor: t.bgSub }}
            onPointerDown={(e) => {
              e.stopPropagation();
              snoozeLongPressRef.current.fired = false;
              if (snoozeLongPressRef.current.timer) clearTimeout(snoozeLongPressRef.current.timer);
              snoozeLongPressRef.current.timer = setTimeout(() => {
                snoozeLongPressRef.current.timer = null;
                snoozeLongPressRef.current.fired = true;
                if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* noop */ } }
                window.dispatchEvent(new CustomEvent('snoozeTodo', { detail: todo }));
              }, 500);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (snoozeLongPressRef.current.timer) { clearTimeout(snoozeLongPressRef.current.timer); snoozeLongPressRef.current.timer = null; }
            }}
            onPointerLeave={() => {
              if (snoozeLongPressRef.current.timer) { clearTimeout(snoozeLongPressRef.current.timer); snoozeLongPressRef.current.timer = null; }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (snoozeLongPressRef.current.fired) { snoozeLongPressRef.current.fired = false; return; }
              handleQuickSnooze(todo);
            }}>
            <ArrowRight size={13} />
          </button>
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
                {importantTodos.map(todo => TodoRow({ todo }))}
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
              {regularTodos.map(todo => TodoRow({ todo }))}
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
              {dateEvents.map(evt => {
                const isDone = !!evt.completed;
                const isPast = !isDone && isEventPast(evt);
                const accentColor = evt.color || t.info;
                return (
                  <div key={evt.id} className="flex items-center gap-2.5 py-2 px-2 rounded-xl"
                    style={{ backgroundColor: t.bgSub, opacity: isDone ? 0.55 : (isPast ? 0.75 : 1) }}>
                    <button
                      onClick={() => toggleEventCompleted(evt.id, !isDone)}
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        border: isDone ? 'none' : `2px solid ${accentColor}80`,
                        backgroundColor: isDone ? t.checkDone : 'transparent',
                      }}
                      aria-label={isDone ? '완료 취소' : '완료'}
                      title={isDone ? '완료 취소' : '완료'}
                    >
                      {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
                    </button>
                    <div>
                      <span style={{
                        fontSize: 13,
                        color: isDone ? t.textMuted : t.text,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>{evt.title}</span>
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
                );
              })}
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
                const habitType = h.habitType ?? 'check';
                const checked = h.checkedDates.includes(selectedDate);
                const showMemoRow = habitType === 'memo' && checked;
                const memoVal = habitMemoEditing[h.id] ?? h.dailyMemos?.[selectedDate] ?? '';
                return (
                  <div key={h.id} className={`flex flex-col gap-1.5${showMemoRow ? ' w-full' : ''}`}>
                    {/* 유형별 컨트롤(HabitChip) + 아이콘 + 이름 — 습관&루틴 페이지와 동일 동작 */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
                      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                      <HabitChip habit={h} date={selectedDate} />
                      {h.icon && <span style={{ fontSize: 14, lineHeight: 1 }}>{h.icon}</span>}
                      <span style={{ fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: 'nowrap' }}>{h.name}</span>
                    </div>
                    {showMemoRow && (
                      <div className="flex items-center gap-2 pl-1">
                        <MessageSquare size={13} color={t.textMuted} style={{ flexShrink: 0 }} />
                        <input
                          value={memoVal}
                          onChange={e => setHabitMemoEditing(prev => ({ ...prev, [h.id]: e.target.value }))}
                          onBlur={() => {
                            updateHabitMemo(h.id, selectedDate, memoVal);
                            setHabitMemoEditing(prev => { const n = { ...prev }; delete n[h.id]; return n; });
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              updateHabitMemo(h.id, selectedDate, memoVal);
                              setHabitMemoEditing(prev => { const n = { ...prev }; delete n[h.id]; return n; });
                            }
                          }}
                          placeholder="오늘 메모를 남겨보세요…"
                          className="flex-1 rounded-lg px-3 py-1.5 border outline-none"
                          style={{ fontSize: 12, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
                        />
                      </div>
                    )}
                  </div>
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
            <DailyMemo
              date={selectedDate}
              value={brainstormMemos[selectedDate] || ''}
              onChange={setBrainstormMemo}
            />
          </div>
        </div>

        {/* Right Column: Timeline (추출된 재사용 컴포넌트 — Stage 1) */}
        <Timeline
          days={1}
          selectedDate={selectedDate}
          dateTodos={dateTodos}
          dateEvents={dateEvents}
          onShowContextMenu={(todo, pos, source) => setContextMenu({ todo, pos, source })}
          className={mobileTab === 'todos' ? 'hidden lg:flex' : ''}
        />
        </div>{/* /Columns Wrapper */}
      </div>

      {/* Modals */}
      {showAddModal && <TodoModal date={selectedDate} onClose={() => setShowAddModal(false)} />}
      {showAddEventModal && <EventModal date={selectedDate} onClose={() => setShowAddEventModal(false)} />}
      {editingTodo && <TodoModal date={selectedDate} todo={editingTodo} onClose={() => setEditingTodo(null)} />}
      {snoozingTodo && <SnoozeModal todo={snoozingTodo} onClose={() => setSnoozingTodo(null)} />}
      {contextMenu && (() => {
        const MENU_W = 160;
        const rawX = contextMenu.pos.x;
        const adjustedX = rawX + MENU_W > window.innerWidth ? rawX - MENU_W : rawX;
        const adjustedPos = { x: adjustedX, y: contextMenu.pos.y };
        const isVirtual = isVirtualTodoId(contextMenu.todo.id);
        return (
          <ContextMenu
            todo={contextMenu.todo}
            position={adjustedPos}
            onClose={() => setContextMenu(null)}
            onFocus={setFocusingTodo}
            variant={contextMenu.source ? 'block' : 'list'}
            onDelete={contextMenu.source === 'do'
              ? () => { updateTodo(contextMenu.todo.id, { doStart: undefined, doEnd: undefined, doElapsedSec: undefined }); }
              : contextMenu.source === 'plan'
                ? () => { updateTodo(contextMenu.todo.id, { planStart: undefined, planEnd: undefined }); }
                : isVirtual
                  ? () => { setRecurringDeleteTarget(contextMenu.todo); setContextMenu(null); }
                  : undefined
            }
            deleteMessage={contextMenu.source === 'do'
              ? 'DO 블록을 삭제할까요? (PLAN은 유지됩니다)'
              : contextMenu.source === 'plan'
                ? 'PLAN 블록을 삭제할까요? (DO는 유지됩니다)'
                : undefined}
          />
        );
      })()}
      {recurringDeleteTarget && (() => {
        const info = parseVirtualTodoId(recurringDeleteTarget.id);
        return info ? (
          <RecurrenceBranchModal
            mode="delete"
            onConfirm={scope => {
              deleteRecurringTodo(info.parentId, info.instanceDate, scope);
              setRecurringDeleteTarget(null);
            }}
            onCancel={() => setRecurringDeleteTarget(null)}
          />
        ) : null;
      })()}
      {/* → 빠른 미루기 — 반복 할일 this/future/all 분기 (기존 deleteRecurringTodo+addTodo 재사용) */}
      {recurringSnoozeTarget && (
        <RecurrenceBranchModal
          mode="edit"
          onConfirm={scope => {
            quickSnoozeTomorrow(recurringSnoozeTarget, scope);
            setRecurringSnoozeTarget(null);
          }}
          onCancel={() => setRecurringSnoozeTarget(null)}
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
      {keyHint && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full pointer-events-none"
          style={{
            bottom: 'calc(80px + env(safe-area-inset-bottom))',
            backgroundColor: t.text, color: t.card, fontSize: 12, fontWeight: 600,
            boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
          }}>
          {keyHint}
        </div>
      )}
    </div>
  );
}