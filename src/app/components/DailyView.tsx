import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, NavLink, useNavigate } from 'react-router';
import {
  ChevronLeft, ChevronRight, Star, Play,
  Check, Clock, Trash2, X, MoreHorizontal,
  Settings, Edit3, Pause, Ban, CalendarDays, ArrowRight, Bell, ChevronRight as ChevronRightIcon,
  Square,
} from 'lucide-react';
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay as getDayOfWeek, parseISO, differenceInCalendarDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, Event, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { solidCardStyle, solidRowStyle, glassBarStyle, mixHex, withAlpha } from '../styles/haonStyles';
import { useNotification } from '../hooks/useNotification';
import { TimePicker } from './TimePicker';
import ConfirmModal from './ConfirmModal';
import { TodoModal } from './TodoModal';
import { MandalartSourceBadge } from './mandalart/MandalartSourceBadge';
import { EventModal } from './EventModal';
import { FocusModal } from './FocusModal';
import { useFabAction } from '../FabContext';
import { QuickAddInput } from './QuickAddInput';
import { useDailySummary } from '../hooks/useDailySummary';
import { conditionLabel } from '../../constants/symptoms';
import { isEventPast, isVirtualEventId } from '../../api/events';
import { expandRecurringTodos, isVirtualTodoId, parseVirtualTodoId } from '../../lib/recurrenceExpansion';
import { shiftedEndDate } from '../../lib/todoSnooze';
import { useMenuPosition } from '../hooks/useMenuPosition';
import { TodoActionMenu } from './todo/TodoActionMenu';
import { periodCoversDate, todoEndDate, isTodoIncomplete, deriveTodoPhase, todoRunningDays, type DerivedTodoPhase } from '../../lib/todoPeriod';
import { RecurrenceBranchModal } from './RecurrenceBranchModal';
import { RetroSheet } from './RetroSheet';
import { completionMarkerPatch } from '../../lib/todoDoDuration';
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
          endDate: selectedSnoozeDate,
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
      // 기간 할일이면 end_date 도 함께 이동(역전 방지 — DB CHECK 위반으로 저장이 통째로 실패하던 버그)
      endDate: shiftedEndDate(todo, selectedSnoozeDate),
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
                  backgroundColor: selectedSnoozeDate === opt.date ? t.accent : t.lavenderTint,
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
          <div className="rounded-xl p-3" style={{ backgroundColor: t.lavenderTint, border: `1px solid ${t.borderLight}` }}>
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
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.lavenderTint, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button onClick={handleConfirm}
            disabled={!selectedSnoozeDate}
            className="flex-1 py-2.5 rounded-xl transition-colors"
            style={{
              fontSize: 13, fontWeight: 600,
              backgroundColor: selectedSnoozeDate ? '#D97706' : t.lavenderTint,
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

// ─── Event Snooze Date Picker Modal ───
// 할일 SnoozeModal 과 동일 UX(빠른선택 + 달력 + 시간). 저장은 store.snoozeEvent('this' 스코프).
// 반복 일정의 회차 분기(this/future/all)는 탭-미루기(handleQuickSnoozeEvent)에서 다루고,
// 여기(롱프레스 날짜 지정)는 할일과 동일하게 그 회차만('this') 옮긴다.
function EventSnoozeModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const { snoozeEvent } = usePlanner();
  const { t } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedSnoozeDate, setSelectedSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState(event.startTime || '09:00');

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

  // 원래 소요시간(분)을 유지하며 종료 시간을 재계산 (시작·종료가 모두 있을 때만)
  const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const fromMin = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  const handleConfirm = () => {
    if (!selectedSnoozeDate) return;
    let endTime: string | undefined;
    if (snoozeTime && event.startTime && event.endTime) {
      const dur = toMin(event.endTime) - toMin(event.startTime);
      if (dur > 0) endTime = fromMin(toMin(snoozeTime) + dur);
    }
    snoozeEvent(event, selectedSnoozeDate, {
      startTime: snoozeTime || undefined,
      ...(endTime ? { endTime } : {}),
      scope: 'this',
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
            <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>일정 미루기</h3>
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
              "{event.title}"을(를) 언제로 옮길까요?
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
                  backgroundColor: selectedSnoozeDate === opt.date ? t.accent : t.lavenderTint,
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
          <div className="rounded-xl p-3" style={{ backgroundColor: t.lavenderTint, border: `1px solid ${t.borderLight}` }}>
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
            시간
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
              {snoozeTime && ` ${snoozeTime}`}(으)로 옮깁니다
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl transition-colors"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.lavenderTint, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button onClick={handleConfirm}
            disabled={!selectedSnoozeDate}
            className="flex-1 py-2.5 rounded-xl transition-colors"
            style={{
              fontSize: 13, fontWeight: 600,
              backgroundColor: selectedSnoozeDate ? '#D97706' : t.lavenderTint,
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

// 일정 전용 컨텍스트 메뉴 — 우클릭/모바일 ⋯ 진입. 편집 + "이대로 실행"(계획→실적 복사) + 완료 토글.
// ContextMenu(Todo 전용) 시각 패턴을 재사용하되 토큰만 사용(하드코딩 색 없음).
function EventContextMenu({ event, position, onClose }: {
  event: Event;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const { runEventAsPlanned, toggleEventCompleted } = usePlanner();
  const { t } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const menuPos = useMenuPosition(position, ref, onClose);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // "이대로 실행"은 계획 시각이 있어야 의미가 있다 — 종일/다중일(시각 없음) 일정은 항목 숨김(no-op 조건과 일치).
  const canRun = !event.isAllDay && !!event.startTime && !!event.endTime;
  const isDone = !!event.completed;

  const itemStyle = { fontSize: 12, color: t.text } as const;

  return createPortal(
    <div ref={ref} role="menu" className="fixed z-50 rounded-xl py-1.5 min-w-[140px]"
      style={{
        top: menuPos.y,
        left: menuPos.x,
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
      }}>
      <button className="w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left"
        style={itemStyle}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.lavenderHover)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('editEvent', { detail: event })); }}>
        <Edit3 size={13} />
        <span>편집</span>
      </button>
      {canRun && (
        <>
          <div className="my-1" style={{ borderBottom: `1px solid ${t.border}` }} />
          <button className="w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left"
            style={itemStyle}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.lavenderHover)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => { runEventAsPlanned(event.id); onClose(); }}>
            <Play size={13} />
            <span>이대로 실행</span>
          </button>
        </>
      )}
      <div className="my-1" style={{ borderBottom: `1px solid ${t.border}` }} />
      {/* 완료 토글 — 위치(actual)와 분리. 완료해도 DO 블록은 실제 자리에 그대로. */}
      <button className="w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left"
        style={itemStyle}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.lavenderHover)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={() => { toggleEventCompleted(event.id, !isDone); onClose(); }}>
        <Check size={13} />
        <span>{isDone ? '완료 취소' : '완료'}</span>
      </button>
    </div>,
    document.body,
  );
}

// ─── 오늘 기록 칩 (조회 전용 — Stage 3) ───
// 코어 4(컨디션·식사·운동·수면)는 항상 노출(없으면 흐리게 "아직 없음"), 조건부(독서·미디어·음악·
// 간곳)는 그날 데이터 있을 때만. 칩 탭 = 해당 페이지 이동(입력 없음 — 입력은 홈 QuickCaptureHome).
// 집약은 useDailySummary(선택된 논리 날짜) 단일 소스.
type RecordChip = { key: string; icon: string; name: string; to: string; value: string | null };

function RecordChips({ date }: { date: string }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const s = useDailySummary(date);
  const { reviewRecords, happyMoments } = usePlanner();
  const [retroOpen, setRetroOpen] = useState(false);

  // 회고 상태 요약(그날 review_records + happy_moments) — 카드 값 표시용
  const retroRec = reviewRecords.find(r => r.date === date);
  const retroGCount = (retroRec?.gratitude ?? []).filter(Boolean).length;
  const retroHCount = happyMoments.filter(m => m.date === date).length;
  const retroHasKpt = !!(retroRec?.kptKeep || retroRec?.kptProblem || retroRec?.kptTry);
  const retroParts: string[] = [];
  if (retroGCount) retroParts.push(`감사 ${retroGCount}`);
  if (retroHCount) retroParts.push(`순간 ${retroHCount}`);
  if (retroHasKpt) retroParts.push('KPT');
  const retroValue = retroParts.length ? retroParts.join(' · ') : null;

  const fmtSleep = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
  };
  const MEAL_LABEL: Record<string, string> = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };

  const core: RecordChip[] = [
    {
      key: 'condition', icon: '🙂', name: '컨디션', to: '/health?tab=condition',
      // 그날 '마지막 상태'(시점 순위 저녁>낮>아침) 컨디션을 표시. 컨디션은 있는데 아직 없던 구 기록은 스트레스로 폴백.
      value: s.condition
        ? (s.condition.condition != null
            ? `${conditionLabel(s.condition.condition)}${s.condition.slot ? ` · ${s.condition.slot}` : ''}${s.condition.count > 1 ? ` 외 ${s.condition.count - 1}` : ''}`
            : (s.condition.stress != null ? `스트레스 ${s.condition.stress}` : '기록 있음'))
        : null,
    },
    {
      key: 'food', icon: '🍽️', name: '식사', to: '/food',
      value: s.food ? `${s.food.firstName ?? (s.food.mealTypes[0] ? MEAL_LABEL[s.food.mealTypes[0]] ?? s.food.mealTypes[0] : '기록')}${s.food.count > 1 ? ` 외 ${s.food.count - 1}건` : ''}` : null,
    },
    {
      key: 'workout', icon: '🏃', name: '운동', to: '/health?tab=workout',
      value: s.workout ? `${s.workout.names[0] ?? '운동'}${s.workout.count > 1 ? ` 외 ${s.workout.count - 1}` : ''}` : null,
    },
    {
      key: 'sleep', icon: '😴', name: '수면', to: '/health?tab=sleep',
      value: s.sleep ? (s.sleep.durationMin > 0 ? fmtSleep(s.sleep.durationMin) : '기록됨') : null,
    },
  ];

  const conditional: RecordChip[] = [];
  if (s.reading) conditional.push({
    key: 'reading', icon: '📖', name: '독서', to: '/books',
    value: `${s.reading.lastBookTitle ?? '독서'}${s.reading.lastPage ? ` ${s.reading.lastPage}p` : ''}`,
  });
  if (s.culture) conditional.push({
    key: 'culture', icon: '🎬', name: '미디어', to: '/culture',
    value: `${s.culture.firstTitle ?? '미디어'}${s.culture.firstRating ? ` ★${s.culture.firstRating}` : ''}${s.culture.count > 1 ? ` 외 ${s.culture.count - 1}` : ''}`,
  });
  if (s.music) conditional.push({
    key: 'music', icon: '🎵', name: '음악', to: '/culture',
    value: `${s.music.firstTitle ?? '음악'}${s.music.count > 1 ? ` 외 ${s.music.count - 1}` : ''}`,
  });
  if (s.places) conditional.push({
    key: 'places', icon: '📍', name: '간 곳', to: '/places',
    value: `${s.places.firstName ?? '방문'}${s.places.count > 1 ? ` 외 ${s.places.count - 1}` : ''}`,
  });

  const renderChip = (c: RecordChip) => {
    const empty = c.value === null;
    // Haon(H): 기록 유무와 무관하게 카드 컨테이너(불투명 흰색·테두리·그림자)는 동일 유지 —
    // 흐려지는 건 안쪽 텍스트뿐. 그 외 테마: recordCard* 토큰이 없으므로 기존 동작(빈 상태=투명+점선) 유지.
    const haonCard = !!t.recordCardBg;
    return (
      <button
        key={c.key}
        onClick={() => navigate(c.to)}
        className="relative flex flex-col gap-1 rounded-2xl px-3 py-2.5 text-left transition-all"
        style={{
          minHeight: 72,
          backgroundColor: haonCard ? t.recordCardBg : (empty ? 'transparent' : t.card),
          border: haonCard ? t.recordCardBorder : (empty ? `1px dashed ${t.border}` : `1px solid ${t.border}`),
          boxShadow: haonCard ? t.recordCardShadow : undefined,
          opacity: haonCard ? 1 : (empty ? 0.6 : 1),
        }}
      >
        <span className="absolute" style={{ top: 8, right: 9, fontSize: 12, color: t.textMuted, fontWeight: 700 }}>↗</span>
        <span style={{ fontSize: 19, lineHeight: 1, filter: empty ? 'grayscale(0.4)' : 'none' }}>{c.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: empty ? t.textMuted : t.text }}>{c.name}</span>
        <span style={{ fontSize: 11, color: empty ? t.textMuted : t.textSub, lineHeight: 1.35, fontWeight: empty ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {empty ? '아직 없음' : c.value}
        </span>
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>오늘 기록</span>
        <span style={{ fontSize: 11, color: t.textMuted }}>탭하면 그 페이지로</span>
      </div>
      <div className="grid grid-cols-2 gap-2">{core.map(renderChip)}</div>
      {/* 회고 카드 — 페이지 이동이 아니라 시트를 연다(RetroSheet). 상태 표시는 core 카드와 동일 형식. */}
      {(() => {
        const empty = retroValue === null;
        const haonCard = !!t.recordCardBg;
        return (
          <button
            onClick={() => setRetroOpen(true)}
            className="relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all mt-2 w-full"
            style={{
              minHeight: 56,
              backgroundColor: haonCard ? t.recordCardBg : (empty ? 'transparent' : t.card),
              border: haonCard ? t.recordCardBorder : (empty ? `1px dashed ${t.border}` : `1px solid ${t.border}`),
              boxShadow: haonCard ? t.recordCardShadow : undefined,
              opacity: haonCard ? 1 : (empty ? 0.6 : 1),
            }}
          >
            <span style={{ fontSize: 19, lineHeight: 1, filter: empty ? 'grayscale(0.4)' : 'none' }}>🙏</span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 12, fontWeight: 700, color: empty ? t.textMuted : t.text }}>회고</div>
              <div style={{ fontSize: 11, color: empty ? t.textMuted : t.textSub, lineHeight: 1.35, fontWeight: empty ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {empty ? '아직 없음' : retroValue}
              </div>
            </div>
            <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, flexShrink: 0 }}>기록 ›</span>
          </button>
        );
      })()}
      {retroOpen && <RetroSheet date={date} onClose={() => setRetroOpen(false)} />}
      {conditional.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-3 mb-2">
            <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
            <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: '0.04em' }}>오늘 남긴 것</span>
            <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
          </div>
          <div className="grid grid-cols-2 gap-2">{conditional.map(renderChip)}</div>
        </>
      )}
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
          <div className="rounded-xl px-3 py-3 lg:px-4 lg:py-4" style={{ backgroundColor: t.lavenderTint, border: `1px solid ${t.borderLight}` }}>
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
            style={{ fontSize: 14, fontWeight: 500, color: t.textSub, backgroundColor: t.lavenderTint, border: `1px solid ${t.border}` }}
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
    selectedDate, setSelectedDate, todos, events, updateTodo, addTodo, toggleEventCompleted, deleteEvent, snoozeEvent, deleteRecurringTodo, habits,
    activeTimer, startTimer, stopTimer, finishActiveTimer, deleteTimeBlock, tags, projects, weeklyGoals, milestones,
    dayStartHour: tlStartHour, dayEndHour: tlEndHour, setDayHours,
  } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();
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
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [snoozingEvent, setSnoozingEvent] = useState<Event | null>(null);
  // 미루기 탭 → 반복 일정이면 this/future/all 분기 모달
  const [recurringSnoozeEventTarget, setRecurringSnoozeEventTarget] = useState<Event | null>(null);
  const [focusingTodo, setFocusingTodo] = useState<Todo | null>(null);
  const [snoozingTodo, setSnoozingTodo] = useState<Todo | null>(null);
  const [contextMenu, setContextMenu] = useState<{ todo: Todo; pos: { x: number; y: number }; source?: 'do' | 'plan' } | null>(null);
  const [eventMenu, setEventMenu] = useState<{ event: Event; pos: { x: number; y: number } } | null>(null);
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState<Todo | null>(null);
  // 미루기 → 빠른 버튼이 반복 할일을 만나면 this/future/all 분기
  const [recurringSnoozeTarget, setRecurringSnoozeTarget] = useState<Todo | null>(null);
  // ★ KEY 권장 안내 (4개 이상일 때 가벼운 토스트)
  const [keyHint, setKeyHint] = useState<string | null>(null);
  // → 버튼 길게 누르기(롱프레스) 판별용 (행마다 hook 추가 금지 → 부모 ref 공유)
  const snoozeLongPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  // 일정 미루기 → 버튼 롱프레스 판별 (할일과 동일 패턴, 행마다 hook 금지 → 부모 ref 공유)
  const eventSnoozeLongPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
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

  // Listen for editEvent events from timeline (일정 블록 탭 → 편집)
  useEffect(() => {
    const handler = (e: any) => setEditingEvent(e.detail);
    window.addEventListener('editEvent', handler);
    return () => window.removeEventListener('editEvent', handler);
  }, []);

  // Listen for eventContextMenu (일정 블록 우클릭/모바일 ⋯ → 편집·이대로 실행 메뉴)
  useEffect(() => {
    const handler = (e: any) => setEventMenu({ event: e.detail.event, pos: { x: e.detail.x, y: e.detail.y } });
    window.addEventListener('eventContextMenu', handler);
    return () => window.removeEventListener('eventContextMenu', handler);
  }, []);

  // 완료 직후 세션 내 유지(규칙 3 완화) — 이번에 체크한 할일 id.
  // 조회 조건과 분리: 완료돼도 즉시 사라지지 않고 취소선으로 남는다.
  // 날짜 이동/리마운트 시 비워져 원래 날짜 기준으로만 표시된다.
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  useEffect(() => { setJustCompletedIds(new Set()); }, [selectedDate]);

  // 기간 기반: 선택 날짜가 기간(date~endDate)에 포함되는 할일(단일 날짜면 그날). backlog 제외.
  const dateTodos = expandRecurringTodos(todos, selectedDate, selectedDate)
    .filter(td => periodCoversDate(td, selectedDate) && td.status !== 'backlog');
  // Stage 2: 완료(done)한 할일은 목록 맨 아래로 밀어낸다(사라지지 않게 — 성취감·되돌리기·justCompletedIds 유지).
  // 안정 정렬이라 그룹 내(미완료끼리·완료끼리) 기존 순서는 보존된다.
  const byDoneLast = <T extends Todo>(list: T[]): T[] =>
    [...list].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));
  const importantTodos = byDoneLast(dateTodos.filter(td => td.isTop3));
  const regularTodos = byDoneLast(dateTodos.filter(td => !td.isTop3));

  // 늦음 이월: 오늘 볼 때, 종료일이 지난 미완료 할일을 "늦음"으로 계속 노출한다.
  // (status 가 아니라 기간에서 파생 — 완료/해제로 사라지던 근원 제거)
  // 완화 장치: 방금 완료한 항목(justCompletedIds)은 미완료가 아니어도 이번 세션엔 남긴다.
  const isViewingToday = selectedDate === getLogicalToday();
  const carryoverTodos = isViewingToday
    ? byDoneLast(
        todos
          .filter(td => !!td.date && todoEndDate(td)! < selectedDate
            && (isTodoIncomplete(td.status) || justCompletedIds.has(td.id)))
          .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
      )
    : [];
  const [carryoverCollapsed, setCarryoverCollapsed] = useState(false);

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

  // 하루 경계 표기 (설정값 dayStartHour/dayEndHour 기준). 예: "하루 기준 · 04:00 – 익일 02:00"
  const fmtBoundHour = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const dayBoundLabel = `하루 기준 · ${fmtBoundHour(tlStartHour)} – ${tlEndHour >= 24 ? '익일 ' : ''}${fmtBoundHour(tlEndHour)}`;

  // 일간은 체크 UI 없이 "안 한 습관" 리마인더만 (체크/기록은 습관 페이지)
  const undoneHabits = habits.filter(h => !h.checkedDates.includes(selectedDate));

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
      // 체크박스 = 완료: 타이머 시간 기록 + 'done' 전환 (정지와 구분)
      finishActiveTimer();
      return;
    }
    const nowHHMM = format(new Date(), 'HH:mm');
    if (todo.status === 'done') {
      // 완료 해제 — 길이 0 완료 시각 마커였다면 함께 정리(실제 소요 기록은 보존).
      updateTodo(todo.id, { status: 'active', ...completionMarkerPatch(todo, 'active', nowHHMM) });
      setJustCompletedIds(prev => { const n = new Set(prev); n.delete(todo.id); return n; });
      return;
    }
    // 완료 체크는 실적(DO) '소요'를 채우지 않는다 — 소요 기록은 명시적 행위(DO 드래그·타이머
    // 완주·수동 입력)로만. 대신 '언제 했는지'는 남긴다: 실적 DO 가 없으면 do_start=do_end=완료
    // 시각(길이 0)을 찍어 타임라인 DO 에 시각 마커로 표시한다. 길이 0이라 시간 집계엔 안 잡히고
    // 건수 축에만 잡힌다(예전 자동 30분 버그와 달리 소요를 지어내지 않음). 이미 기록된 DO 는 보존.
    updateTodo(todo.id, { status: 'done', ...completionMarkerPatch(todo, 'done', nowHHMM) });
    // 완료 직후 세션 내 유지(규칙 3 완화) — 지난 날짜 항목이 즉시 사라지지 않게.
    setJustCompletedIds(prev => new Set(prev).add(todo.id));
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
        text: todo.text, date: nextDay, endDate: nextDay, status: 'active', isTop3: todo.isTop3,
        planStart: todo.planStart || undefined, tags: todo.tags, projectId: todo.projectId,
      });
    } else {
      updateTodo(todo.id, {
        date: nextDay, endDate: shiftedEndDate(todo, nextDay), status: 'active',
        planEnd: undefined, doStart: undefined, doEnd: undefined, doElapsedSec: undefined,
      });
    }
  };

  // → 단일 탭: 일반=즉시 내일로 / 반복=RecurrenceBranchModal('edit') 분기
  const handleQuickSnooze = (todo: Todo) => {
    if (isRecurringTodo(todo)) setRecurringSnoozeTarget(todo);
    else quickSnoozeTomorrow(todo);
  };

  // 일정 반복 여부: 가상 occurrence(masterId::date) 또는 반복 마스터
  const isRecurringEvent = (event: Event) =>
    isVirtualEventId(event.id) ||
    ((!!event.recurrenceFreq || (!!event.repeatType && event.repeatType !== 'none')) && !event.parentEventId);

  // 일정 미루기 다음 날 계산 — 할일과 동일(그 일정의 날짜 + 1)
  const nextDayOf = (event: Event) =>
    format(addDays(parseISO(event.date ?? selectedDate), 1), 'yyyy-MM-dd');

  // 일정 → 단일 탭: 일반=즉시 내일로 / 반복=분기 모달(this/future/all)
  const handleQuickSnoozeEvent = (event: Event) => {
    if (isRecurringEvent(event)) setRecurringSnoozeEventTarget(event);
    else snoozeEvent(event, nextDayOf(event));
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
  // 배지 규칙(도배 방지): 단일 날짜 진행중=배지 없음(기본). 여러 날 진행중=우측 "N일째"가 담당.
  // 늦음=배지. 완료/미루기/취소=저장 상태 라벨. (진행중 텍스트 배지는 더 이상 붙이지 않는다.)
  const StatusBadge = ({ phase, status }: { phase: DerivedTodoPhase; status: string }) => {
    let label: string, color: string, bg: string;
    if (status === 'done' || status === 'snoozed' || status === 'cancelled') {
      const cfg = STATUS_CONFIG[status];
      label = cfg.label; color = cfg.color; bg = cfg.bgColor;
    } else if (phase === 'late') {
      label = '늦음'; color = t.warning; bg = t.warningLight;
    } else {
      // 진행중(단일·여러날 공통)·예정 = 배지 없음. 진행중은 톤/‘N일째’로, 예정은 목록 위치로 드러난다.
      return null;
    }
    return (
      <span className="px-2 py-0.5 rounded-full" style={{
        fontSize: 10, fontWeight: 600,
        backgroundColor: bg, color,
      }}>
        {label}
      </span>
    );
  };

  // Tag chip — Haon(H): 채도 있는 파스텔 채움 + 어두운 텍스트 시블링. 그 외 테마: 기존 저채도 워시.
  const TagChip = ({ tagId }: { tagId: string }) => {
    const tag = tags.find(tg => tg.id === tagId);
    if (!tag) return null;
    return (
      <span className="inline-flex items-center px-1.5 py-px rounded-full" style={{
        fontSize: 9,
        backgroundColor: mixHex(tag.color, 255, 0.78),
        color: mixHex(tag.color, 0, 0.32),
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
    // 진행중/늦음은 기간에서 파생(status 아님). 기준 = 오늘(todayStr2).
    const phase = deriveTodoPhase(todo, todayStr2);
    const isInProgress = phase === 'inProgress';
    const isLate = phase === 'late';
    // "N일째" — 기간 시작일부터 오늘까지. 진행중일 때만, 2일↑ 표시. (date=시작일 파생)
    const inProgressDays = isInProgress ? todoRunningDays(todo, todayStr2) : 0;

    const isHighlighted = highlightTodoId === todo.id;

    // Haon(H): 솔리드 행 recipe(불투명 흰색 + 하이라인 + 소프트 그림자). 태그 있는 행만 좌측 3px 액센트 바.
    // 핵심(KEY, isTop3) 행은 코랄 톤으로 뚜렷하게 강조(배경 틴트·코랄 테두리·핑크 글로우 + 좌측 그라데이션 바).
    // 그 외 테마: 기존 동작(카드색 + 태그색 좌측 바) 유지.
    const isKeyRow = todo.isTop3;
    let rowStyle: CSSProperties;
    if (isHighlighted) {
      rowStyle = {
        cursor: 'pointer',
        backgroundColor: t.accentLight,
        border: `1.5px solid ${t.accent}`,
        borderLeft: `3px solid ${t.accent}`,
        boxShadow: `0 0 0 2px ${t.accent}30`,
        borderRadius: t.solidRowRadius ?? 14,
      };
    } else if (isKeyRow) {
      // 핵심 행: 좌측은 코랄 그라데이션 바가 차지하므로 태그 좌측 바는 생략(태그는 칩으로 계속 노출).
      rowStyle = {
        cursor: 'pointer',
        // 완료는 배경으로 표현하지 않는다(DESIGN.md §5) — 취소선 + 텍스트 뮤트만. 배경은 미완료와 동일.
        backgroundColor: t.keyRowBg ?? '#FFF5F2',
        border: t.keyRowBorder ?? '1px solid rgba(255,111,145,0.35)',
        boxShadow: t.keyRowShadow ?? '0 2px 4px rgba(120,90,160,0.10), 0 10px 24px rgba(255,111,145,0.22)',
        borderRadius: t.solidRowRadius ?? 14,
        position: 'relative',
        overflow: 'hidden',
      };
    } else {
      rowStyle = {
        cursor: 'pointer',
        // 완료는 배경으로 표현하지 않는다(DESIGN.md §5) — 취소선 + 텍스트 뮤트만. 배경은 미완료와 동일.
        backgroundColor: t.solidRowBg ?? '#FFFFFF',
        border: t.solidRowBorder ?? '1px solid rgba(122,92,162,0.10)',
        boxShadow: t.solidRowShadow ?? '0 6px 16px rgba(120,90,160,0.10)',
        borderRadius: t.solidRowRadius ?? 14,
      };
      if (firstTag) rowStyle.borderLeft = `3px solid ${firstTag.color}`;
    }

    return (
      <div
        key={todo.id}
        id={`todo-row-${todo.id}`}
        className="group flex items-start gap-3 py-2.5 px-3 rounded-xl transition-all"
        style={rowStyle}
      >
        {/* 핵심(KEY) 좌측 코랄 그라데이션 바 (행이 overflow:hidden + rounded 라 코너에 클립) */}
        {isKeyRow && (
          <span aria-hidden className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: t.primaryGradient ?? t.accent }} />
        )}
        {/* Status checkbox */}
        <button onClick={() => handleTodoCheckboxAction(todo)}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all mt-0.5"
          style={{
            // withAlpha: accentColor 가 태그색(hex)일 수도, 무태그 폴백 t.border(테마 H=rgba)일 수도 있다.
            // `${color}60` 접미사는 rgba 토큰에서 깨져 원형 체크 UI 가 사라졌다(테마 H). 헬퍼로 안전 적용.
            border: isDone ? 'none' : `2px solid ${withAlpha(isInProgress ? t.success : accentColor, 0.38)}`,
            backgroundColor: isDone ? t.checkDone : (isInProgress ? withAlpha(t.success, 0.07) : 'transparent'),
          }}>
          {/* 왼쪽 원형 = 항상 완료 체크박스(상태 무관). 진행중은 테두리 톤으로만 표현, Play 글리프 금지.
              타이머 시작은 우측 별도 버튼(포커스). */}
          {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
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
              fontSize: 13, fontWeight: isKeyRow ? 700 : 600,
              color: isDone ? t.textMuted : t.text,
              textDecoration: isDone ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {todo.text}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {/* 핵심 배지 — 코랄 그라데이션 pill (파스텔 H + isTop3) */}
            {isKeyRow && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full" style={{
                fontSize: 9, fontWeight: 700, color: '#fff', background: t.primaryGradient ?? t.accent, lineHeight: '14px',
              }}>
                <Star size={8} fill="#fff" color="#fff" /> 핵심
              </span>
            )}
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
          {inProgressDays >= 2 && (
            <span className="px-1.5 py-0.5 rounded-full" style={{
              fontSize: 9, fontWeight: 700, lineHeight: '14px',
              color: inProgressDays >= 3 ? '#fff' : t.success,
              backgroundColor: inProgressDays >= 3 ? t.success : `${t.success}18`,
            }}>
              {inProgressDays}일째
            </span>
          )}
          <StatusBadge phase={phase} status={todo.status} />
          {/* 미루기 → : 탭=내일로, 길게=날짜 지정(SnoozeModal) */}
          <button
            aria-label="미루기"
            title="내일로 미루기 (길게: 날짜 지정)"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: t.textSub, backgroundColor: t.lavenderTint }}
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
              title={todo.id === activeTimer?.todoId ? '타이머 정지 (진행중 유지)' : '포커스 시작'}
              style={{
                color: todo.id === activeTimer?.todoId ? '#fff' : t.success,
                backgroundColor: todo.id === activeTimer?.todoId ? t.success : t.success + '10',
              }}>
              {todo.id === activeTimer?.todoId ? <Square size={12} fill="#fff" /> : <Play size={12} />}
            </button>
          )}
          <button onClick={(e) => {
            e.stopPropagation();
            setContextMenu({ todo, pos: { x: e.clientX, y: e.clientY } });
          }}
            aria-label="할일 메뉴"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: t.textMuted, backgroundColor: t.lavenderTint }}>
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>
    );
  };

  // Today's habits

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden h-full" style={{ backgroundColor: t.bg }}>
      {/* Header */}
      <div className="relative flex items-center justify-between px-3 py-3 lg:px-6 lg:py-4 flex-shrink-0" style={glassBarStyle(t)}>
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
                {/* 날짜 제목 — Haon(H)은 DESIGN.md §4 page-title = Pretendard 700. 그 외 테마는 기존 DM Serif 유지. */}
                <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: t.fontSection }} /* 날짜 제목 - 섹션 헤더 */
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
              // 파스텔(H): 붉은 코랄 배경+코랄 글자(레드온레드) → 차분한 라벤더 솔리드 pill +
              // 딥인디고 글자 + 작은 코랄 '오늘' 도트로 페이지 톤에 맞춤.
              <button
                onClick={goToday}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full transition-all"
                style={{
                  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                  backgroundColor: t.lavenderTint,
                  color: t.text,
                  border: '1px solid rgba(122,92,162,0.16)',
                  boxShadow: '0 2px 6px rgba(120,90,160,0.10)',
                }}
              >
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: 9999, background: t.accent, flexShrink: 0 }} />
                Today
              </button>
          )}
          {/* 데스크탑: 기존 모달 */}
          <button onClick={() => setShowTimelineSettings(true)} className="hidden lg:flex px-3 py-1.5 rounded-lg items-center gap-1.5"
            style={{ fontSize: 11, color: t.textSub, backgroundColor: t.lavenderTint, border: `1px solid ${t.border}` }}>
            <Settings size={12} />
            <span>시간대 설정</span>
          </button>
          {/* 모바일: 설정 페이지 링크 */}
          <NavLink to="/settings" className="lg:hidden p-1.5 rounded-lg flex items-center gap-1"
            style={{ fontSize: 10, color: t.textSub, backgroundColor: t.lavenderTint, border: `1px solid ${t.border}` }}>
            <Settings size={12} />
          </NavLink>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        {/* Mobile Tab Bar */}
        <div className="flex lg:hidden flex-shrink-0" style={glassBarStyle(t)}>
          <button
            onClick={() => setMobileTab('todos')}
            className="flex-1 py-2.5 text-center transition-colors"
            style={{
              fontSize: 13, fontWeight: 600, background: 'transparent',
              color: mobileTab === 'todos' ? t.accent : t.textSub,
              borderBottom: mobileTab === 'todos' ? `2px solid ${t.accent}` : '2px solid transparent',
            }}>
            📋 오늘
          </button>
          <button
            onClick={() => setMobileTab('timeline')}
            className="flex-1 py-2.5 text-center transition-colors"
            style={{
              fontSize: 13, fontWeight: 600, background: 'transparent',
              color: mobileTab === 'timeline' ? t.accent : t.textSub,
              borderBottom: mobileTab === 'timeline' ? `2px solid ${t.accent}` : '2px solid transparent',
            }}>
            🕒 타임블록
          </button>
        </div>

        {/* Columns Wrapper */}
        <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left Column: 오늘 허브 (던지기 → 일정 → 할일 → 습관 알림 → 기록 칩) */}
        <div
          className={`flex-1 min-w-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 lg:px-6 py-4${mobileTab === 'timeline' ? ' hidden lg:block' : ''}`}
          style={{ borderRight: `1px solid ${t.border}` }}>
          <div className="space-y-4">
            {/* 던지기 입력창 — 통합 진입점(이 날짜로 캡처, 날짜/시간/#태그 파싱) */}
            <QuickAddInput solid defaultDate={selectedDate} placeholder="여기에 던지기: 운동, 오후 3시 회의 #업무 …" />

            {/* 오늘 일정 */}
            <div className="rounded-2xl p-4" style={solidCardStyle(t)}>
              <div className="flex items-center gap-2 mb-2.5">
                <CalendarDays size={13} color={t.info} />
                <span style={{ fontSize: 10, color: t.info, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>오늘 일정</span>
                {dateEvents.length > 0 && <span style={{ fontSize: 10, color: t.textMuted }}>{dateEvents.length}</span>}
                <div className="flex-1" />
                <button onClick={() => navigate('/calendar')} style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>캘린더 →</button>
              </div>
              {dateEvents.length === 0 ? (
                <p style={{ fontSize: 12, color: t.textMuted }} className="py-1">오늘 일정이 없어요</p>
              ) : (
                <div className="space-y-1.5">
                  {dateEvents.map(evt => {
                    const isDone = !!evt.completed;
                    const isPast = !isDone && isEventPast(evt);
                    const accentColor = evt.color || t.info;
                    return (
                      <div key={evt.id}
                        className="group flex items-center gap-2.5 px-3 py-2.5"
                        style={{ opacity: isDone ? 0.55 : (isPast ? 0.75 : 1), ...solidRowStyle(t) }}>
                        <button
                          onClick={() => toggleEventCompleted(evt.id, !isDone)}
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ border: isDone ? 'none' : `2px solid ${accentColor}80`, backgroundColor: isDone ? t.checkDone : 'transparent' }}
                          aria-label={isDone ? '완료 취소' : '완료'}
                        >
                          {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditingEvent(evt)}>
                          <span style={{ fontSize: 13, color: isDone ? t.textMuted : t.text, textDecoration: isDone ? 'line-through' : 'none' }}>{evt.title}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {evt.startTime && <span style={{ fontSize: 10, color: t.textMuted }}>{evt.startTime}{evt.endTime ? ` - ${evt.endTime}` : ''}</span>}
                            {evt.location && <span style={{ fontSize: 10, color: t.textMuted }}>📍 {evt.location}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* 미루기 → : 탭=내일로, 길게=날짜/시간 지정 (할일과 동일 UX) */}
                          <button
                            aria-label="일정 미루기"
                            title="내일로 미루기 (길게: 날짜 지정)"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: t.textSub, backgroundColor: t.lavenderTint }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              eventSnoozeLongPressRef.current.fired = false;
                              if (eventSnoozeLongPressRef.current.timer) clearTimeout(eventSnoozeLongPressRef.current.timer);
                              eventSnoozeLongPressRef.current.timer = setTimeout(() => {
                                eventSnoozeLongPressRef.current.timer = null;
                                eventSnoozeLongPressRef.current.fired = true;
                                if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* noop */ } }
                                setSnoozingEvent(evt);
                              }, 500);
                            }}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              if (eventSnoozeLongPressRef.current.timer) { clearTimeout(eventSnoozeLongPressRef.current.timer); eventSnoozeLongPressRef.current.timer = null; }
                            }}
                            onPointerLeave={() => {
                              if (eventSnoozeLongPressRef.current.timer) { clearTimeout(eventSnoozeLongPressRef.current.timer); eventSnoozeLongPressRef.current.timer = null; }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (eventSnoozeLongPressRef.current.fired) { eventSnoozeLongPressRef.current.fired = false; return; }
                              handleQuickSnoozeEvent(evt);
                            }}
                          >
                            <ArrowRight size={13} />
                          </button>
                          <button
                            onClick={() => setEditingEvent(evt)}
                            aria-label="일정 편집"
                            title="편집"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: t.textMuted, backgroundColor: t.lavenderTint }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingEvent(evt)}
                            aria-label="일정 삭제"
                            title="삭제"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: t.danger, backgroundColor: t.lavenderTint }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 오늘 할 일 (중요 먼저) */}
            <div className="rounded-2xl p-4" style={solidCardStyle(t)}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>오늘 할 일</span>
                <span style={{ fontSize: 10, color: t.textMuted }}>{dateTodos.length}</span>
                <div className="flex-1" />
                <button onClick={() => navigate('/todos')} style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>전체 →</button>
              </div>
              {/* 늦음 이월 — 종료일이 지난 미완료를 오늘 계속 노출(기간 파생). 완료해도 세션 내 유지. */}
              {carryoverTodos.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => setCarryoverCollapsed(v => !v)}
                    className="flex items-center gap-1.5 mb-2 w-full"
                  >
                    <ChevronRightIcon size={12} color={t.warning}
                      style={{ transform: carryoverCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform .15s' }} />
                    <span style={{ fontSize: 10, color: t.warning, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>늦음</span>
                    <span style={{ fontSize: 10, color: t.textMuted }}>{carryoverTodos.length}</span>
                  </button>
                  {!carryoverCollapsed && (
                    <div className="space-y-2">
                      {carryoverTodos.map(todo => TodoRow({ todo }))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 mb-1">
                    <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
                    <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>오늘</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
                  </div>
                </div>
              )}

              {/* 핵심 있으면: 핵심 그룹(서브헤더) → 구분선 → 그 외 그룹. 핵심 0개면 flat concat + 빈 상태. */}
              {importantTodos.length > 0 ? (
                <>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Star size={12} fill={t.accent} color={t.accent} />
                    <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>핵심</span>
                    <span style={{ fontSize: 10, color: t.textMuted }}>{importantTodos.length}/3</span>
                  </div>
                  <div className="space-y-2">
                    {importantTodos.map(todo => TodoRow({ todo }))}
                  </div>
                  {regularTodos.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-3 mb-2">
                        <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
                        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: '0.04em' }}>그 외</span>
                        <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
                      </div>
                      <div className="space-y-2">
                        {regularTodos.map(todo => TodoRow({ todo }))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  {importantTodos.map(todo => TodoRow({ todo }))}
                  {regularTodos.map(todo => TodoRow({ todo }))}
                  {dateTodos.length === 0 && (
                    <div className="py-6 text-center">
                      <p style={{ fontSize: 13, color: t.textMuted }}>오늘 할일이 없어요</p>
                      <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>위 입력창에 던져보세요</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🔔 습관 알림 — 체크/기록은 습관 페이지에서 */}
            {undoneHabits.length > 0 && (
              <button
                onClick={() => navigate('/habits')}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
                style={solidCardStyle(t)}
              >
                <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 38, height: 38, backgroundColor: `${t.danger}14` }}>
                  <Bell size={17} color={t.danger} />
                </span>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>아직 안 한 습관 {undoneHabits.length}개</p>
                  <p style={{ fontSize: 11, color: t.textSub, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {undoneHabits.slice(0, 3).map(h => h.name).join(' · ')}
                  </p>
                </div>
                <ChevronRightIcon size={18} color={t.danger} />
              </button>
            )}

            {/* 오늘 기록 칩 (조회 전용) */}
            <RecordChips date={selectedDate} />
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
          // 하루 경계 라벨을 TIMELINE 헤더 우측에 노출(일간 전용 — 캘린더의 Timeline엔 미전달).
          dayBoundLabel={dayBoundLabel}
          // Haon(H) 테마에서만 타임블록 기본색(라일락)·now 라인(소프트 코랄) 오버라이드.
          // 미전달(웜 테마 등) 시 Timeline 기본값 유지 → 캘린더 공유 컴포넌트에 영향 없음.
          nowLineColor={t.nowLine}
          defaultBlockBg={t.blockDefaultBg}
          defaultBlockBorder={t.blockDefaultBorder}
          defaultBlockText={t.blockDefaultText}
        />
        </div>{/* /Columns Wrapper */}
      </div>

      {/* Modals */}
      {showAddModal && <TodoModal date={selectedDate} onClose={() => setShowAddModal(false)} />}
      {showAddEventModal && <EventModal date={selectedDate} onClose={() => setShowAddEventModal(false)} />}
      {editingTodo && <TodoModal date={selectedDate} todo={editingTodo} onClose={() => setEditingTodo(null)} />}
      {editingEvent && <EventModal date={editingEvent.date ?? selectedDate} event={editingEvent} onClose={() => setEditingEvent(null)} />}
      {deletingEvent && (
        <ConfirmModal
          message={`"${deletingEvent.title}" 일정을 삭제할까요?`}
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { deleteEvent(deletingEvent.id); setDeletingEvent(null); }}
          onCancel={() => setDeletingEvent(null)}
        />
      )}
      {snoozingTodo && <SnoozeModal todo={snoozingTodo} onClose={() => setSnoozingTodo(null)} />}
      {/* 일정 롱프레스 → 날짜/시간 지정 미루기 */}
      {snoozingEvent && <EventSnoozeModal event={snoozingEvent} onClose={() => setSnoozingEvent(null)} />}
      {/* 일정 탭 미루기 → 반복이면 this/future/all 분기 후 그 스코프로 내일 이동 */}
      {recurringSnoozeEventTarget && (
        <RecurrenceBranchModal
          mode="edit"
          onConfirm={scope => {
            snoozeEvent(recurringSnoozeEventTarget, nextDayOf(recurringSnoozeEventTarget), { scope });
            setRecurringSnoozeEventTarget(null);
          }}
          onCancel={() => setRecurringSnoozeEventTarget(null)}
        />
      )}
      {contextMenu && (() => {
        // 위치 보정(좌/상 flip)은 ContextMenu 내부 useMenuPosition 이 실제 렌더 크기로 처리한다.
        const adjustedPos = contextMenu.pos;
        // Stage 3b: DO 블록 막대는 합성 todo(_blk)라 원본 todo 로 편집/삭제를 매핑한다.
        const doBlk = (contextMenu.todo as Todo & { _blk?: { id: string; todoId: string } })._blk;
        const menuTodo = doBlk ? (todos.find(t => t.id === doBlk.todoId) ?? contextMenu.todo) : contextMenu.todo;
        const isVirtual = isVirtualTodoId(menuTodo.id);
        return (
          <TodoActionMenu
            todo={menuTodo}
            position={adjustedPos}
            onClose={() => setContextMenu(null)}
            variant={contextMenu.source ? 'block' : 'list'}
            onEdit={() => setEditingTodo(menuTodo)}
            onSnooze={() => setSnoozingTodo(menuTodo)}
            onFocus={() => setFocusingTodo(menuTodo)}
            onSetStatus={(st) => {
              const next = menuTodo.status === st && st !== 'active' ? 'active' : st;
              updateTodo(menuTodo.id, { status: next, ...completionMarkerPatch(menuTodo, next, format(new Date(), 'HH:mm')) });
            }}
            onDelete={contextMenu.source === 'do'
              ? () => {
                  if (doBlk) deleteTimeBlock(doBlk.id);
                  else updateTodo(menuTodo.id, { doStart: undefined, doEnd: undefined, doElapsedSec: undefined });
                }
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
      {eventMenu && (
        <EventContextMenu
          event={eventMenu.event}
          position={eventMenu.pos}
          onClose={() => setEventMenu(null)}
        />
      )}
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