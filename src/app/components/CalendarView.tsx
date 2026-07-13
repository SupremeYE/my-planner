import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfWeek,
  format,
  getDay,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Event, PeriodRecord, SelfCareRecord, Todo, getLogicalToday } from '../store';
import { isDoOvertimeVsPlan, doElapsedTitleSuffix } from '../../lib/todoDoDuration';
import { expandRecurringTodos, isVirtualTodoId, parseVirtualTodoId } from '../../lib/recurrenceExpansion';
import { buildTodoToggleUpdate } from '../../lib/todoToggle';
import { isEventPast } from '../../api/events';
import { useTheme } from '../ThemeContext';
import { TimePicker } from './TimePicker';
import { TodoModal } from './TodoModal';
import { EventModal } from './EventModal';
import ConfirmModal from './ConfirmModal';
import { RecurrenceBranchModal } from './RecurrenceBranchModal';
import { useFabAction } from '../FabContext';
import { Timeline } from './timeline/Timeline';
import { isHaon, canvasStyle, glassBarStyle, solidCardStyle, mixHex } from '../styles/haonStyles';

type TabType = 'month' | 'week';
type FilterType = 'all' | 'todo' | 'event' | 'habit' | 'selfcare';

const CHIP_COLORS: Record<Exclude<FilterType, 'all'>, { bg: string; color: string }> = {
  todo: { bg: '#F0C4B8', color: '#D4735A' },
  event: { bg: '#D0E0F5', color: '#7B9ED9' },
  habit: { bg: '#C8E6D0', color: '#006b62' },
  selfcare: { bg: '#E8D9C0', color: '#A08050' },
};

const FILTER_TABS: { key: FilterType; label: string; activeColor: string }[] = [
  { key: 'all', label: '전체', activeColor: '#26343d' },
  { key: 'todo', label: '할일', activeColor: '#D4735A' },
  { key: 'event', label: '일정', activeColor: '#7B9ED9' },
  { key: 'habit', label: '습관', activeColor: '#006b62' },
  { key: 'selfcare', label: '자기관리', activeColor: '#A08050' },
];

// item.type / 필터 key → §3 카테고리 CSS 변수(haon.css --cat-*) 접미사.
// getItems 의 type 리터럴 'event' 는 schedule 토큰(--cat-schedule-*)에 매핑(키 정합).
const CAT_VAR: Record<Exclude<FilterType, 'all'>, 'todo' | 'schedule' | 'habit' | 'selfcare'> = {
  todo: 'todo',
  event: 'schedule',
  habit: 'habit',
  selfcare: 'selfcare',
};

const HOUR_HEIGHT = 48;
const CURRENT_TIME_COLOR = '#D4735A';
const WEEK_TIME_LABEL_WIDTH = 54;
const WEEKDAY_LABELS_SUN = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_LABELS_MON = ['월', '화', '수', '목', '금', '토', '일'];
const CALENDAR_PANEL_HEIGHT_KEY = 'calendar-panel-height';
const MIN_CALENDAR_HEIGHT = 180;
const MAX_CALENDAR_HEIGHT = 480;

function timeToTop(time: string, startHour: number): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - startHour) * 60 + m) * (HOUR_HEIGHT / 60);
}

function durationToPx(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(((eh - sh) * 60 + (em - sm)) * (HOUR_HEIGHT / 60), 24);
}

function getWeekdayLabels(weekStartsOn: 0 | 1) {
  return weekStartsOn === 1 ? WEEKDAY_LABELS_MON : WEEKDAY_LABELS_SUN;
}

function isPeriodDate(dateStr: string, records: PeriodRecord[]) {
  return records.some(record => {
    if (!record.endDate) return record.startDate === dateStr;
    return record.startDate <= dateStr && dateStr <= record.endDate;
  });
}

const SELFCARE_CATEGORY_LABELS: Record<string, string> = {
  exercise: '운동',
  study: '공부',
  beauty: '케어',
  sleep: '수면',
};

function MonthView({ viewDate, filter, selectedTagIds, weekStartsOn, onSelectDate, collapsed }: {
  viewDate: Date;
  filter: FilterType;
  selectedTagIds: string[];
  weekStartsOn: 0 | 1;
  onSelectDate: (d: string) => void;
  collapsed?: boolean;
}) {
  const { todos: rawTodos, events, habits, selfCareRecords, periodRecords, selectedDate } = usePlanner();
  const { t } = useTheme();

  const firstDay = startOfMonth(viewDate);
  const startOffset = (getDay(firstDay) - weekStartsOn + 7) % 7;
  const daysInMonth = getDaysInMonth(viewDate);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weekdayLabels = getWeekdayLabels(weekStartsOn);

  // 반복 일정 포함 확장 (해당 월 전체)
  const todos = useMemo(() => {
    const monthStartStr = format(firstDay, 'yyyy-MM-dd');
    const monthEndStr = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
    return expandRecurringTodos(rawTodos, monthStartStr, monthEndStr);
  }, [rawTodos, firstDay, year, month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const getItems = (dateStr: string) => {
    const items: { id: string; text: string; type: Exclude<FilterType, 'all'> }[] = [];
    const matchesTags = (itemTags?: string[]) =>
      selectedTagIds.length === 0 || (itemTags ?? []).some(tagId => selectedTagIds.includes(tagId));

    if (filter === 'all' || filter === 'todo') {
      todos
        .filter(todo =>
          todo.date === dateStr &&
          todo.status !== 'backlog' &&
          todo.status !== 'cancelled' &&
          (filter !== 'todo' || matchesTags(todo.tags))
        )
        .forEach(todo => items.push({ id: todo.id, text: todo.text, type: 'todo' }));
    }
    if (filter === 'all' || filter === 'event') {
      events
        .filter(event => event.date === dateStr && (filter !== 'event' || matchesTags(event.tags)))
        .forEach(event => items.push({ id: event.id, text: event.title, type: 'event' }));
    }
    if (filter === 'all' || filter === 'habit') {
      habits
        .filter(habit => habit.checkedDates.includes(dateStr))
        .forEach(habit => items.push({ id: habit.id, text: habit.name, type: 'habit' }));
    }
    if (filter === 'all' || filter === 'selfcare') {
      selfCareRecords
        .filter(record => record.date === dateStr && record.category !== 'sleep')
        .forEach(record => items.push({
          id: record.id,
          text: SELFCARE_CATEGORY_LABELS[record.category] ?? record.category,
          type: 'selfcare',
        }));
    }
    return items;
  };

  const todayStr = getLogicalToday();

  // Collapsed: show only the week row containing selectedDate (or today)
  const activeStr = selectedDate || todayStr;
  const activeYear = parseInt(activeStr.slice(0, 4), 10);
  const activeMonth = parseInt(activeStr.slice(5, 7), 10) - 1;
  const activeDay = parseInt(activeStr.slice(8, 10), 10);
  const activeWeekRow = (activeYear === year && activeMonth === month)
    ? Math.floor((startOffset + activeDay - 1) / 7)
    : 0;
  const displayCells = collapsed
    ? cells.slice(activeWeekRow * 7, activeWeekRow * 7 + 7)
    : cells;

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {weekdayLabels.map(label => (
          <div key={label} className="text-center py-2" style={{ fontSize: 12, color: isHaon(t) ? t.textMuted : '#888', fontWeight: 600 }}>
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {displayCells.map((day, index) => {
          if (day === null) return <div key={index} />;

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const items = getItems(dateStr);
          const shown = items.slice(0, 4);
          const overflow = items.length - 4;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const hasPeriod = isPeriodDate(dateStr, periodRecords);

          return (
            <button
              key={index}
              onClick={() => onSelectDate(dateStr)}
              className="relative flex flex-col items-start p-1 rounded-xl transition-all"
              style={{
                // Haon(H): §6.5 — 셀 전체 배경 틴트 대신 날짜 숫자 원 마커로 선택/오늘 표시(아래 span).
                backgroundColor: isHaon(t)
                  ? 'transparent'
                  : (isToday ? '#d5e3fd' : isSelected ? '#f8fbff' : 'transparent'),
                border: isHaon(t)
                  ? '1px solid transparent'
                  : (isSelected ? '1px solid #d5e3fd' : '1px solid transparent'),
                boxShadow: isHaon(t)
                  ? 'none'
                  : (isSelected && !isToday ? '0 0 0 1px rgba(81,95,116,0.04)' : 'none'),
                minHeight: 72,
              }}
            >
              <div className="self-center flex flex-col items-center gap-0.5">
                {isHaon(t) ? (
                  // §6.5 — 선택일=소프트 코랄 채움 원(강조, 카테고리색 아님) / 오늘=코랄 하이라인 링(조용한 마커).
                  // 오늘==선택: 채움 원(선택 우선) + 링(오늘 보조) 공존 → 두 상태 시각 구분 유지.
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      boxSizing: 'border-box',
                      fontSize: 12,
                      fontWeight: isSelected || isToday ? 700 : 400,
                      color: t.text,
                      backgroundColor: isSelected ? mixHex(t.accent, 255, 0.72) : 'transparent',
                      border: isToday ? `1.5px solid ${t.accent}` : '1.5px solid transparent',
                    }}
                  >
                    {day}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: isToday ? '#515f74' : '#26343d', fontWeight: isSelected || isToday ? 700 : 400 }}>
                    {day}
                  </span>
                )}
                {hasPeriod && (
                  <span
                    style={{
                      display: 'block',
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      // H: 오늘 슬레이트(#515f74) 오버라이드 미적용(오늘은 링으로 표시) → 기간 마커 본연색만.
                      backgroundColor: isToday && !isHaon(t) ? '#515f74' : '#E07899',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
              <div className="flex flex-col gap-0.5 w-full mt-0.5">
                {shown.map(item => {
                  // Haon(H): §6.4 — 색 채운 미니바 대신 '작은 카테고리 dot + 본문색 truncated 라벨'
                  if (isHaon(t)) {
                    return (
                      <div key={item.id} className="flex items-center gap-1 w-full overflow-hidden">
                        <span
                          aria-hidden
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            backgroundColor: `var(--cat-${CAT_VAR[item.type]}-dot)`,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 500,
                            color: t.text,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            lineHeight: '14px',
                          }}
                        >
                          {item.text}
                        </span>
                      </div>
                    );
                  }
                  const color = CHIP_COLORS[item.type];
                  return (
                    <div
                      key={item.id}
                      className="rounded px-1 w-full overflow-hidden"
                      style={{ backgroundColor: color.bg }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: color.color,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          lineHeight: '14px',
                        }}
                      >
                        {item.text}
                      </span>
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <span style={{ fontSize: 9, color: isHaon(t) ? t.textMuted : '#999', paddingLeft: 2 }}>
                    +{overflow}개
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SleepTimeEditModal({ record, onClose, onConfirm }: {
  record: SelfCareRecord;
  onClose: () => void;
  onConfirm: (sleepStart: string, sleepEnd: string) => void;
}) {
  const { t } = useTheme();
  const [start, setStart] = useState(record.sleepStart ?? '');
  const [end, setEnd] = useState(record.sleepEnd ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[320px]" style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>🌙 수면 시간 수정</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600, display: 'block', marginBottom: 6 }}>취침</label>
            <TimePicker value={start} onChange={setStart} placeholder="취침 시간" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600, display: 'block', marginBottom: 6 }}>기상</label>
            <TimePicker value={end} onChange={setEnd} placeholder="기상 시간" />
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
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

export function CalendarView() {
  const {
    selectedDate, setSelectedDate, appSettings, tags, events, todos, habits, brainstormMemos,
    projects, selfCareRecords,
    updateTodo, deleteTodo, deleteRecurringTodo, addTodo,
    updateEvent, deleteEvent, toggleEventCompleted,
  } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<TabType>('month');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewDate, setViewDate] = useState(parseISO(selectedDate));
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // 전역 FAB — 캘린더는 선택 날짜 맥락 빠른 입력 + 할일/일정 상세 단축
  useFabAction({
    kind: 'quick',
    defaultDate: selectedDate,
    onAddTodo: () => setShowAddTodoModal(true),
    onAddEvent: () => setShowAddEventModal(true),
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // 진입 시 현재 선택 날짜의 상세를 바로 표시 (탭하지 않아도 그 날짜의 할일/일정이 보이도록)
  const [panelDate, setPanelDate] = useState<string | null>(selectedDate);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  // 하단 상세 패널 — 일간 페이지와 동일한 직접 관리(수정/삭제/미루기)용 상태
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState<Todo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'todo' | 'event'; id: string; message: string } | null>(null);
  const weekStartsOn = appSettings.weekStartsOn ?? 1;
  const showTagLayer = tab === 'month' && (filter === 'todo' || filter === 'event') && tags.length > 0;

  useEffect(() => {
    setViewDate(parseISO(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    setSelectedTagIds([]);
  }, [filter]);

  // 주간 타임라인 블록 탭/컨텍스트 → 편집 모달 (Timeline 이 dispatch 하는 editTodo 수신)
  useEffect(() => {
    // 'Event' 식별자는 store 의 앱 Event 타입으로 가려져 있어 DOM 핸들러는 any 로 받는다(DailyView 동일).
    const handler = (e: any) => setEditingTodo(e.detail);
    window.addEventListener('editTodo', handler);
    return () => window.removeEventListener('editTodo', handler);
  }, []);

  // 타임라인 일정 블록 탭/우클릭 → 일정 편집 모달 (Timeline 이 dispatch 하는 editEvent 수신)
  useEffect(() => {
    const handler = (e: any) => setEditingEvent(e.detail);
    window.addEventListener('editEvent', handler);
    return () => window.removeEventListener('editEvent', handler);
  }, []);

  // 주간(days=7) Timeline 용 per-day 데이터 (반복 전개 후 backlog/cancelled 제외)
  const weekDaysData = useMemo(() => {
    const weekStart = startOfWeek(viewDate, { weekStartsOn });
    const daysArr = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const startStr = format(daysArr[0], 'yyyy-MM-dd');
    const endStr = format(daysArr[6], 'yyyy-MM-dd');
    const expanded = expandRecurringTodos(todos, startStr, endStr);
    return daysArr.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return {
        date: dateStr,
        todos: expanded.filter(td => td.date === dateStr && td.status !== 'backlog' && td.status !== 'cancelled'),
        // 일간 PLAN 과 동일 소스(events)를 날짜별로 전달 → 주별 타임라인에도 시간 지정 일정 렌더
        events: events.filter(ev => ev.date === dateStr),
      };
    });
  }, [viewDate, weekStartsOn, todos, events]);

  // 모바일 주간 = 일자 탭 전환 → 선택일의 todos/events 를 일간 Timeline(days=1) 에 전달
  const selectedDayTodos = weekDaysData.find(d => d.date === selectedDate)?.todos ?? [];
  const selectedDayEvents = events.filter(ev => ev.date === selectedDate);

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setViewDate(parseISO(dateStr));
    setPanelDate(dateStr);
  };

  const navLabel = tab === 'month'
    ? format(viewDate, 'yyyy년 M월')
    : `${format(startOfWeek(viewDate, { weekStartsOn }), 'M월 d일')} - ${format(endOfWeek(viewDate, { weekStartsOn }), 'M월 d일', { locale: ko })}`;

  const handlePrev = () => {
    if (tab === 'month') {
      setViewDate(subMonths(viewDate, 1));
      return;
    }
    const prevWeek = addDays(viewDate, -7);
    setViewDate(prevWeek);
    setSelectedDate(format(addDays(parseISO(selectedDate), -7), 'yyyy-MM-dd'));
  };

  const handleNext = () => {
    if (tab === 'month') {
      setViewDate(addMonths(viewDate, 1));
      return;
    }
    const nextWeek = addDays(viewDate, 7);
    setViewDate(nextWeek);
    setSelectedDate(format(addDays(parseISO(selectedDate), 7), 'yyyy-MM-dd'));
  };

  const handleToday = () => {
    const todayStr = getLogicalToday();
    setSelectedDate(todayStr);
    setViewDate(parseISO(todayStr));
    setPanelDate(todayStr);
  };

  // 모바일 월별 좌우 스와이프 → 이전/다음 달 (PC는 마우스라 터치 이벤트 미발생 → 영향 없음)
  const monthTouchRef = useRef<{ x: number; y: number } | null>(null);
  const handleMonthTouchStart = (e: React.TouchEvent) => {
    monthTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleMonthTouchEnd = (e: React.TouchEvent) => {
    if (!monthTouchRef.current) return;
    const dx = e.changedTouches[0].clientX - monthTouchRef.current.x;
    const dy = e.changedTouches[0].clientY - monthTouchRef.current.y;
    monthTouchRef.current = null;
    // 가로 이동이 세로보다 크고 충분히 길 때만 달 전환 (탭/세로 스크롤 오인 방지)
    if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) <= 50) return;
    if (dx < 0) handleNext();
    else handlePrev();
  };


  const panelEvents = panelDate
    ? events
      .filter(event => event.date === panelDate)
      .slice()
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    : [];
  // 반복 할일 가상 인스턴스 포함 — 그 날짜에 존재하는 할일을 모두 표시
  // expandRecurringTodos 는 비반복 할일을 날짜와 무관하게 전부 반환하므로(월별 셀 getItems 와 동일),
  // 반드시 date === panelDate 로 걸러 선택 날짜의 할일만 남긴다.
  const panelTodos = panelDate
    ? expandRecurringTodos(todos, panelDate, panelDate)
      .filter(todo => todo.date === panelDate && todo.status !== 'backlog' && todo.status !== 'cancelled')
      .slice()
      .sort((a, b) => (a.planStart ?? a.doStart ?? '').localeCompare(b.planStart ?? b.doStart ?? ''))
    : [];
  // 그 날짜에 완료(체크)한 습관만 표시 — 월별 달력 셀과 동일 기준, 빈 날짜 판정에도 반영
  const panelHabits = panelDate ? habits.filter(habit => habit.checkedDates.includes(panelDate)) : [];
  const panelSelfCare = panelDate
    ? selfCareRecords.filter(record => record.date === panelDate && record.category !== 'sleep')
    : [];
  const panelMemo = panelDate ? brainstormMemos[panelDate]?.trim() ?? '' : '';

  // 상단 필터 탭과 일관: '전체'면 모든 섹션, 특정 탭이면 해당 섹션만
  const showTodoSection = filter === 'all' || filter === 'todo';
  const showEventSection = filter === 'all' || filter === 'event';
  const showHabitSection = filter === 'all' || filter === 'habit';
  const showSelfcareSection = filter === 'all' || filter === 'selfcare';
  const showMemoSection = filter === 'all';

  const getTagName = (tagId: string) => tags.find(tag => tag.id === tagId);
  const hasPanelContent =
    (showEventSection && panelEvents.length > 0) ||
    (showTodoSection && panelTodos.length > 0) ||
    (showHabitSection && panelHabits.length > 0) ||
    (showSelfcareSection && panelSelfCare.length > 0) ||
    (showMemoSection && !!panelMemo);

  // ── 할일 동작 (일간 페이지 로직 재사용 → buildTodoToggleUpdate 공유 헬퍼) ──
  const handleToggleTodo = (todo: Todo) => {
    updateTodo(todo.id, buildTodoToggleUpdate(todo));
  };

  // 미루기: 다음 날짜로 이동 (반복 인스턴스는 이 날짜만 취소 후 단일 할일로 이동 — SnoozeModal과 동일)
  const handleSnoozeTodo = (todo: Todo) => {
    if (!todo.date) return;
    const next = format(addDays(parseISO(todo.date), 1), 'yyyy-MM-dd');
    if (isVirtualTodoId(todo.id)) {
      const info = parseVirtualTodoId(todo.id);
      if (info) {
        deleteRecurringTodo(info.parentId, info.instanceDate, 'this');
        addTodo({
          text: todo.text,
          date: next,
          status: 'active',
          isTop3: todo.isTop3,
          planStart: todo.planStart || undefined,
          tags: todo.tags,
          projectId: todo.projectId,
        });
        return;
      }
    }
    updateTodo(todo.id, {
      date: next,
      status: 'active',
      planEnd: undefined,
      doStart: undefined,
      doEnd: undefined,
    });
  };

  // 삭제: 반복 인스턴스는 "이 항목만/이후/전체" 분기 모달, 일반 할일은 확인 팝업
  const handleDeleteTodo = (todo: Todo) => {
    if (isVirtualTodoId(todo.id)) {
      setRecurringDeleteTarget(todo);
      return;
    }
    setConfirmDelete({ kind: 'todo', id: todo.id, message: `"${todo.text}"을(를) 삭제할까요?` });
  };

  // ── 일정 동작 (완료 개념 없음 → 수정/미루기/삭제) ──
  const handleSnoozeEvent = (event: Event) => {
    const base = event.date || panelDate;
    if (!base) return;
    updateEvent(event.id, { date: format(addDays(parseISO(base), 1), 'yyyy-MM-dd') });
  };
  const handleDeleteEvent = (event: Event) => {
    setConfirmDelete({ kind: 'event', id: event.id, message: `"${event.title}" 일정을 삭제할까요?` });
  };

  const renderTagChips = (tagIds?: string[]) =>
    (tagIds ?? []).map(tagId => {
      const tag = getTagName(tagId);
      if (!tag) return null;
      return (
        <span
          key={tagId}
          className="inline-flex items-center px-1.5 py-px rounded-full"
          style={{ fontSize: 9, fontWeight: 600, color: tag.color, backgroundColor: `${tag.color}18`, border: `1px solid ${tag.color}33`, lineHeight: '14px' }}
        >
          {tag.name}
        </span>
      );
    });

  // 할일 카드 — 일간 TodoRow 스타일(원형 체크박스 + 태그 + 미루기/삭제). 리마운트 방지 위해 함수 호출로 렌더.
  const renderTodoCard = (todo: Todo) => {
    const firstTag = todo.tags?.length ? tags.find(tg => tg.id === todo.tags![0]) : null;
    const accentColor = firstTag?.color || t.border;
    const isDone = todo.status === 'done';
    const project = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;
    return (
      <div
        key={todo.id}
        className="flex items-start gap-2.5 py-2 px-3 rounded-xl"
        style={{
          backgroundColor: isDone ? t.bgSub + '80' : t.card,
          border: `1px solid ${accentColor}20`,
          borderLeft: `3px solid ${accentColor}${isDone ? '40' : ''}`,
        }}
      >
        <button
          onClick={() => handleToggleTodo(todo)}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
          style={{
            border: isDone ? 'none' : `2px solid ${(todo.status === 'inProgress' ? t.success : accentColor)}60`,
            backgroundColor: isDone ? t.checkDone : (todo.status === 'inProgress' ? `${t.success}12` : 'transparent'),
          }}
          aria-label="완료 토글"
        >
          {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingTodo(todo)}>
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
              <span className="inline-flex items-center px-1.5 py-px rounded-full" style={{ fontSize: 9, backgroundColor: project.color + '18', color: project.color, lineHeight: '14px' }}>
                {project.name}
              </span>
            )}
            {renderTagChips(todo.tags)}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <button onClick={() => handleSnoozeTodo(todo)} title="다음 날로 미루기"
            className="p-1.5 rounded-lg transition-colors" style={{ color: t.textMuted, backgroundColor: t.bgSub }}>
            <ArrowRight size={13} />
          </button>
          <button onClick={() => handleDeleteTodo(todo)} title="삭제"
            className="p-1.5 rounded-lg transition-colors" style={{ color: t.danger, backgroundColor: t.bgSub }}>
            <X size={13} />
          </button>
        </div>
      </div>
    );
  };

  // 일정 카드 — 완료 체크/수정/미루기/삭제.
  const renderEventCard = (event: Event) => {
    const eventColor = event.color || t.info;
    const isDone = !!event.completed;
    const isPast = !isDone && isEventPast(event);
    return (
      <div
        key={event.id}
        className="flex items-start gap-2.5 py-2 px-3 rounded-xl"
        style={{
          backgroundColor: isDone ? t.bgSub + '80' : t.card,
          border: `1px solid ${eventColor}20`,
          borderLeft: `3px solid ${eventColor}${isDone ? '40' : ''}`,
          opacity: isDone ? 0.65 : (isPast ? 0.8 : 1),
        }}
      >
        <button
          onClick={() => toggleEventCompleted(event.id, !isDone)}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
          style={{
            border: isDone ? 'none' : `2px solid ${eventColor}80`,
            backgroundColor: isDone ? t.checkDone : 'transparent',
          }}
          aria-label={isDone ? '완료 취소' : '완료'}
          title={isDone ? '완료 취소' : '완료'}
        >
          {isDone && <Check size={11} color="#fff" strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingEvent(event)}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: isDone ? t.textMuted : t.text,
            textDecoration: isDone ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {event.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {event.startTime && event.endTime && (
              <span style={{ fontSize: 10, color: t.textMuted }}>{event.startTime} ~ {event.endTime}</span>
            )}
            {event.location && (
              <span style={{ fontSize: 10, color: t.textMuted }}>📍 {event.location}</span>
            )}
            {renderTagChips(event.tags)}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <button onClick={() => handleSnoozeEvent(event)} title="다음 날로 미루기"
            className="p-1.5 rounded-lg transition-colors" style={{ color: t.textMuted, backgroundColor: t.bgSub }}>
            <ArrowRight size={13} />
          </button>
          <button onClick={() => handleDeleteEvent(event)} title="삭제"
            className="p-1.5 rounded-lg transition-colors" style={{ color: t.danger, backgroundColor: t.bgSub }}>
            <X size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative lg:h-full lg:flex lg:flex-col${tab === 'week' ? ' h-full flex flex-col' : ''}`} style={{ ...(isHaon(t) ? canvasStyle(t) : { backgroundColor: t.bg }) }}>
      <div className="px-3 py-3 lg:px-4 lg:py-4" style={{ flexShrink: 0, ...(isHaon(t) ? glassBarStyle(t) : { backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }) }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={handlePrev} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#eef4fa]">
            <ChevronLeft size={18} color={isHaon(t) ? t.textMuted : '#888'} />
          </button>
          <span className="flex-1 text-center" style={{ fontSize: 16, fontWeight: 700, color: isHaon(t) ? t.text : '#26343d' }}>{navLabel}</span>
          <button onClick={handleNext} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#eef4fa]">
            <ChevronRight size={18} color={isHaon(t) ? t.textMuted : '#888'} />
          </button>
        </div>

        <div
          className="flex gap-1 p-1 rounded-xl"
          style={isHaon(t)
            ? { backgroundColor: t.borderLight, border: `1px solid ${t.border}` }
            : { backgroundColor: '#EFE7D8', border: '1px solid #E2D5BF' }}
        >
          {(['month', 'week'] as TabType[]).map(value => {
            const active = tab === value;
            return (
              <button
                key={value}
                onClick={() => {
                  setTab(value);
                  if (value === 'week') setViewDate(parseISO(selectedDate));
                }}
                className="flex-1 py-1.5 rounded-lg transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: active ? (isHaon(t) ? 600 : 700) : 500,
                  ...(isHaon(t)
                    ? {
                        position: 'relative',
                        color: active ? t.text : t.textMuted,
                        ...(active
                          ? { ...solidCardStyle(t), borderRadius: undefined }
                          : { backgroundColor: 'transparent' }),
                      }
                    : {
                        backgroundColor: active ? '#FDFAF4' : 'transparent',
                        color: active ? '#8D7152' : '#B0A188',
                        border: active ? '1px solid #C4A882' : '1px solid transparent',
                        boxShadow: active ? '0 1px 3px rgba(196,168,130,0.25)' : 'none',
                      }),
                }}
              >
                {/* 파스텔(H) 활성 탭: 코랄 강조는 하단 중앙 3px 언더라인으로만 (그라데이션 풀 채움 제거) — 할일 페이지 세그먼트 결정 재사용 (DESIGN §6.1) */}
                {isHaon(t) && active && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ bottom: 3, width: 26, height: 3, borderRadius: 9999, background: t.primaryGradient ?? t.accent }}
                  />
                )}
                {value === 'month' ? '월별' : '주별'}
              </button>
            );
          })}
        </div>

        {tab === 'month' && (
          <>
            <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {FILTER_TABS.map(item => {
                const active = filter === item.key;
                // '전체'는 카테고리 아님 → null(중립 처리). 나머지는 §3 카테고리 토큰.
                const catKey = item.key === 'all' ? null : CAT_VAR[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    className="flex-shrink-0 px-3 py-1 rounded-full transition-all"
                    style={isHaon(t)
                      // Haon(H): 활성 = 카테고리 소프트 틴트 fill + dot 색 보더(그라데이션 풀채움 금지, §6.3).
                      // '전체'는 중립 솔리드(흰 카드+뉴트럴 보더, 코랄 금지). 비활성 = 투명+뮤트.
                      ? {
                          fontSize: 11,
                          fontWeight: active ? 700 : 500,
                          backgroundColor: active ? (catKey ? `var(--cat-${catKey}-fill)` : t.card) : 'transparent',
                          color: active ? t.text : t.textMuted,
                          border: `1.5px solid ${active ? (catKey ? `var(--cat-${catKey}-dot)` : t.border) : t.borderLight}`,
                        }
                      : {
                          fontSize: 11,
                          fontWeight: active ? 700 : 500,
                          backgroundColor: active ? item.activeColor : '#eef4fa',
                          color: active ? '#fff' : item.activeColor,
                          border: `1.5px solid ${active ? item.activeColor : item.activeColor + '60'}`,
                        }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {showTagLayer && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {tags.map(tag => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagIds(prev =>
                        prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                      )}
                      className="flex-shrink-0 px-3 py-1 rounded-full transition-all"
                      style={isHaon(t)
                        // Haon(H): §5 태그칩 패턴 — 채도 파스텔 채움(활성) + 어두운 텍스트. 비활성은 아웃라인.
                        ? {
                            fontSize: 11,
                            fontWeight: active ? 700 : 500,
                            backgroundColor: active ? mixHex(tag.color, 255, 0.78) : 'transparent',
                            color: mixHex(tag.color, 0, 0.32),
                            border: `1.5px solid ${active ? mixHex(tag.color, 0, 0.32) : mixHex(tag.color, 255, 0.5)}`,
                          }
                        : {
                            fontSize: 11,
                            fontWeight: active ? 700 : 500,
                            backgroundColor: active ? `${tag.color}22` : '#eef4fa',
                            color: tag.color,
                            border: `1.5px solid ${active ? tag.color : `${tag.color}66`}`,
                          }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {tab === 'week' ? (
        <div className="flex-1 px-3 pb-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-3 flex flex-col" style={{ minHeight: 0, overflow: 'hidden' }}>
          <div className="bg-white rounded-2xl shadow-sm h-full" style={{ ...(isHaon(t) ? solidCardStyle(t) : { border: '1px solid #eef4fa' }), display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* 모바일: 일자 탭 전환 → 일간 편집 타임라인(days=1) */}
            <div className="flex flex-col md:hidden" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${t.borderLight}` }}>
                {weekDaysData.map(wd => {
                  const day = parseISO(wd.date);
                  const isSel = wd.date === selectedDate;
                  const isToday = wd.date === getLogicalToday();
                  return (
                    <button key={wd.date} onClick={() => handleSelectDate(wd.date)}
                      className="flex-1 flex flex-col items-center py-1.5"
                      style={{ borderBottom: isSel ? `2px solid ${t.accent}` : '2px solid transparent', background: 'none' }}>
                      <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 600 }}>{format(day, 'E', { locale: ko })}</span>
                      <span style={{ fontSize: 13, fontWeight: isSel ? 800 : 600, color: isSel ? t.accent : isToday ? t.text : t.textSub }}>{format(day, 'd')}</span>
                    </button>
                  );
                })}
              </div>
              <Timeline
                days={1}
                selectedDate={selectedDate}
                dateTodos={selectedDayTodos}
                dateEvents={selectedDayEvents}
                onShowContextMenu={(todo) => setEditingTodo(todo)}
              />
            </div>
            {/* PC: 7일 × P/D 편집 타임라인(days=7) */}
            <div className="hidden md:flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <Timeline
                days={7}
                weekDays={weekDaysData}
                selectedDate={selectedDate}
                dateTodos={selectedDayTodos}
                dateEvents={selectedDayEvents}
                onSelectDate={handleSelectDate}
                onToday={handleToday}
                onShowContextMenu={(todo) => setEditingTodo(todo)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-3 pb-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-3 lg:flex lg:flex-col lg:min-h-0 lg:overflow-hidden">
          <div
            className={`lg:overflow-hidden lg:flex-shrink-0 ${isCalendarExpanded ? 'lg:max-h-[520px]' : 'lg:max-h-[145px]'}`}
            style={{ transition: 'max-height 0.32s ease' }}
          >
            <div
              className="bg-white rounded-2xl p-4 shadow-sm"
              style={isHaon(t) ? { ...solidCardStyle(t) } : { border: '1px solid #eef4fa' }}
              onTouchStart={handleMonthTouchStart}
              onTouchEnd={handleMonthTouchEnd}
            >
              <MonthView
                viewDate={viewDate}
                filter={filter}
                selectedTagIds={selectedTagIds}
                weekStartsOn={weekStartsOn}
                onSelectDate={handleSelectDate}
                collapsed={!isCalendarExpanded}
              />
            </div>
          </div>

          <button
            onClick={() => setIsCalendarExpanded(prev => !prev)}
            className="flex items-center justify-center py-2 w-full"
            style={{ flexShrink: 0 }}
          >
            <ChevronDown
              size={18}
              color={t.textMuted}
              style={{
                transform: isCalendarExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.32s ease',
              }}
            />
          </button>

          <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            <div
              className="rounded-[18px] lg:h-full overflow-hidden"
              style={isHaon(t) ? { ...solidCardStyle(t) } : { backgroundColor: t.card, border: `1px solid ${t.border}` }}
            >
              <div className="lg:h-full lg:overflow-y-auto px-4 py-4 lg:px-5">
                {!panelDate && (
                  <div className="lg:h-full flex items-center justify-center py-10 lg:py-0">
                    <p style={{ fontSize: 13, color: t.textMuted }}>날짜를 선택하면 기록이 표시돼요</p>
                  </div>
                )}

                {panelDate && (
                  <div className="space-y-4">
                    <div>
                      <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {format(parseISO(panelDate), 'M월 d일 (E)', { locale: ko })}
                      </p>
                    </div>

                    {showTodoSection && panelTodos.length > 0 && (
                      <section>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>할일</h3>
                        <div className="space-y-2">
                          {panelTodos.map(todo => renderTodoCard(todo))}
                        </div>
                      </section>
                    )}

                    {showEventSection && panelEvents.length > 0 && (
                      <section>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>일정</h3>
                        <div className="space-y-2">
                          {panelEvents.map(event => renderEventCard(event))}
                        </div>
                      </section>
                    )}

                    {showHabitSection && panelHabits.length > 0 && (
                      <section>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>습관</h3>
                        <div className="flex flex-wrap gap-2">
                          {panelHabits.map(habit => {
                            const checked = habit.checkedDates.includes(panelDate);
                            return (
                              <span
                                key={habit.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: checked ? t.accent : t.textSub,
                                  backgroundColor: checked ? t.accentLight : t.bgSub,
                                  border: `1px solid ${checked ? t.accent : t.border}`,
                                }}
                              >
                                <span>{checked ? '✓' : '✗'}</span>
                                <span>{habit.name}</span>
                              </span>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {showSelfcareSection && panelSelfCare.length > 0 && (
                      <section>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>자기관리</h3>
                        <div className="space-y-2">
                          {panelSelfCare.map(record => (
                            <div key={record.id} className="rounded-xl px-3 py-2" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, color: t.textSub, backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                                  {SELFCARE_CATEGORY_LABELS[record.category] ?? record.category}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {record.content}
                                </span>
                              </div>
                              {record.duration > 0 && (
                                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{record.duration}분</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {showMemoSection && panelMemo && (
                      <section>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>메모</h3>
                        <div className="rounded-xl px-3 py-3" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
                          <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{panelMemo}</p>
                        </div>
                      </section>
                    )}

                    {!hasPanelContent && (
                      <div className="rounded-xl px-3 py-4" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
                        <p style={{ fontSize: 13, color: t.textMuted }}>선택한 날짜에 표시할 기록이 아직 없어요</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddTodoModal && <TodoModal date={selectedDate} onClose={() => setShowAddTodoModal(false)} />}
      {showAddEventModal && <EventModal date={selectedDate} onClose={() => setShowAddEventModal(false)} />}

      {/* 하단 패널 항목 직접 관리 모달 — 일간 페이지와 동일 컴포넌트 재사용 */}
      {editingTodo && (
        <TodoModal date={editingTodo.date ?? selectedDate} todo={editingTodo} onClose={() => setEditingTodo(null)} />
      )}
      {editingEvent && (
        <EventModal date={editingEvent.date ?? selectedDate} event={editingEvent} onClose={() => setEditingEvent(null)} />
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
      {confirmDelete && (
        <ConfirmModal
          message={confirmDelete.message}
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            if (confirmDelete.kind === 'todo') deleteTodo(confirmDelete.id);
            else deleteEvent(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
