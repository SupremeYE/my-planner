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
import { usePlanner, Event, PeriodRecord, SelfCareRecord, Todo } from '../store';
import { isDoOvertimeVsPlan, doElapsedTitleSuffix } from '../../lib/todoDoDuration';
import { expandRecurringTodos, isVirtualTodoId, parseVirtualTodoId } from '../../lib/recurrenceExpansion';
import { isEventPast } from '../../api/events';
import { useTheme } from '../ThemeContext';
import { TimePicker } from './TimePicker';
import { TodoModal } from './TodoModal';
import { EventModal } from './EventModal';
import ConfirmModal from './ConfirmModal';
import { RecurrenceBranchModal } from './RecurrenceBranchModal';
import { useFabAction } from '../FabContext';
import { WeekViewPC } from './WeekViewPC';
import { WeekViewMobile } from './WeekViewMobile';

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

  const todayStr = format(new Date(), 'yyyy-MM-dd');

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
          <div key={label} className="text-center py-2" style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>
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
                backgroundColor: isToday ? '#d5e3fd' : isSelected ? '#f8fbff' : 'transparent',
                border: isSelected ? '1px solid #d5e3fd' : '1px solid transparent',
                boxShadow: isSelected && !isToday ? '0 0 0 1px rgba(81,95,116,0.04)' : 'none',
                minHeight: 72,
              }}
            >
              <div className="self-center flex flex-col items-center gap-0.5">
                <span style={{ fontSize: 13, color: isToday ? '#515f74' : '#26343d', fontWeight: isSelected || isToday ? 700 : 400 }}>
                  {day}
                </span>
                {hasPeriod && (
                  <span
                    style={{
                      display: 'block',
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: isToday ? '#515f74' : '#E07899',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
              <div className="flex flex-col gap-0.5 w-full mt-0.5">
                {shown.map(item => {
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
                  <span style={{ fontSize: 9, color: '#999', paddingLeft: 2 }}>
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

function WeekView({ viewDate, selectedDate, onSelectDate, viewDays, weekStartsOn }: {
  viewDate: Date;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  viewDays: 1 | 2 | 3 | 7;
  weekStartsOn: 0 | 1;
}) {
  const { todos, events, tags, selfCareRecords, updateSelfCareRecord, dayStartHour: startHour, dayEndHour: endHour } = usePlanner();
  const { t } = useTheme();
  const [nowTime, setNowTime] = useState(new Date());
  const [windowStart, setWindowStart] = useState(0);
  const [editingSleepRecord, setEditingSleepRecord] = useState<SelfCareRecord | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const weekStart = startOfWeek(viewDate, { weekStartsOn });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowHHMM = format(nowTime, 'HH:mm');
  const maxWindowStart = Math.max(0, 7 - viewDays);
  const visibleDays = useMemo(
    () => (viewDays === 7 ? days : days.slice(windowStart, windowStart + viewDays)),
    [days, viewDays, windowStart]
  );

  useEffect(() => {
    const selectedIndex = days.findIndex(day => format(day, 'yyyy-MM-dd') === selectedDate);
    if (selectedIndex < 0) {
      setWindowStart(0);
      return;
    }
    if (viewDays === 7) {
      setWindowStart(0);
      return;
    }
    setWindowStart(prev => {
      if (selectedIndex >= prev && selectedIndex < prev + viewDays) return prev;
      return Math.min(selectedIndex, maxWindowStart);
    });
  }, [days, maxWindowStart, selectedDate, viewDays]);

  const getTodoTagColor = (todo: Todo) => {
    if (!todo.tags?.length) return null;
    return tags.find(tag => tag.id === todo.tags?.[0])?.color || null;
  };

  const renderWeekTable = (daysToRender: Date[], isMobile: boolean) => {
    const columnTemplate = `${WEEK_TIME_LABEL_WIDTH}px repeat(${daysToRender.length}, minmax(0, 1fr))`;

    return (
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, borderBottom: '1px solid #eef4fa' }}>
          <div className="px-3 py-2 flex items-center gap-4" style={{ borderBottom: '1px solid #F3F0EA' }}>
            <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 700, color: '#8D7152' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#E9E1D6', border: '1px solid #D8C5AE' }} />
              PLAN
            </div>
            <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 700, color: '#6BAA7A' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#D8EFE0', border: '1px solid #6BAA7A40' }} />
              DO
            </div>
            <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 700, color: '#D4735A' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#FAE8D6', border: '1px solid #D4735A66' }} />
              초과
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: columnTemplate }}>
            <div />
            {daysToRender.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <button key={dateStr} onClick={() => onSelectDate(dateStr)} className="flex flex-col items-center py-2.5">
                  <span style={{ fontSize: isMobile ? 10 : 11, color: '#888', fontWeight: 600 }}>
                    {format(day, 'E', { locale: ko })}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: isMobile ? 28 : 30,
                      height: isMobile ? 28 : 30,
                      borderRadius: '50%',
                      marginTop: 4,
                      flexShrink: 0,
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 700,
                      backgroundColor: isSelected ? '#26343d' : isToday ? '#515f74' : 'transparent',
                      color: isSelected || isToday ? '#fff' : '#26343d',
                      border: isSelected ? '2px solid #d5e3fd' : '2px solid transparent',
                    }}
                  >
                    {format(day, 'd')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div className="relative" style={{ height: (endHour - startHour) * HOUR_HEIGHT + 8 }}>
            {hours.map(hour => (
              <div key={hour} className="absolute left-0 right-0 flex items-start" style={{ top: (hour - startHour) * HOUR_HEIGHT }}>
                <span
                  style={{
                    fontSize: 10,
                    color: '#9aa7b4',
                    width: WEEK_TIME_LABEL_WIDTH,
                    textAlign: 'right',
                    paddingRight: 8,
                  }}
                >
                  {String(hour % 24).padStart(2, '0')}:00
                </span>
                <div className="flex-1 border-t" style={{ borderColor: '#dbe6ee' }} />
              </div>
            ))}

            {hours.slice(0, -1).map(hour => (
              <div key={`half-${hour}`} className="absolute left-0 right-0 flex items-start" style={{ top: (hour - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}>
                <span style={{ width: WEEK_TIME_LABEL_WIDTH, flexShrink: 0 }} />
                <div className="flex-1" style={{ borderTop: '1px dashed #e9eff5' }} />
              </div>
            ))}

            <div
              className="absolute grid gap-2"
              style={{
                left: WEEK_TIME_LABEL_WIDTH,
                right: 0,
                top: 0,
                bottom: 0,
                gridTemplateColumns: `repeat(${daysToRender.length}, minmax(0, 1fr))`,
              }}
            >
              {daysToRender.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayTodos = todos.filter(todo => todo.date === dateStr && todo.status !== 'backlog');
                const dayEvents = events.filter(event => event.date === dateStr && event.startTime && event.endTime);

                return (
                  <div key={dateStr} className="relative">
                    {dayEvents.map(event => {
                      const eventColor = event.color || '#7B9ED9';
                      const top = timeToTop(event.startTime!, startHour);
                      const height = durationToPx(event.startTime!, event.endTime!);
                      const isDone = !!event.completed;
                      const isPast = !isDone && isEventPast(event);
                      return (
                        <button
                          key={`event-${event.id}`}
                          type="button"
                          title={`${event.title}\n${event.startTime}-${event.endTime}${event.location ? ` · ${event.location}` : ''}`}
                          className="absolute rounded-2xl text-left overflow-hidden"
                          style={{
                            top,
                            height,
                            left: '7%',
                            right: '22%',
                            backgroundColor: `${eventColor}16`,
                            border: `1px solid ${eventColor}66`,
                            padding: '6px 8px',
                            zIndex: 3,
                            cursor: 'pointer',
                            opacity: isDone ? 0.5 : (isPast ? 0.7 : 1),
                          }}
                        >
                          <div style={{
                            fontSize: isMobile ? 10 : 11, fontWeight: 700, color: eventColor,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}>
                            {event.title}
                          </div>
                          {height >= 40 && (
                            <div style={{ fontSize: 9, color: eventColor, opacity: 0.8, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {event.startTime}-{event.endTime}
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {dayTodos.filter(todo => todo.planStart && todo.planEnd).map(todo => {
                      const top = timeToTop(todo.planStart!, startHour);
                      const height = durationToPx(todo.planStart!, todo.planEnd!);
                      return (
                        <button
                          key={`plan-${todo.id}`}
                          type="button"
                          title={`${todo.text}\n${todo.planStart}-${todo.planEnd}`}
                          className="absolute rounded-[18px] text-left overflow-hidden"
                          style={{
                            top,
                            height,
                            left: '8%',
                            right: '18%',
                            backgroundColor: 'rgba(239,232,223,0.94)',
                            border: '1px solid rgba(196,168,130,0.38)',
                            boxShadow: '0 2px 8px rgba(125,99,71,0.06)',
                            padding: '7px 8px',
                            zIndex: 2,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#6B553D', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {todo.text}
                          </div>
                          {height >= 42 && (
                            <div style={{ fontSize: 9, color: '#9A8165', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {todo.planStart}-{todo.planEnd}
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {dayTodos.filter(todo => todo.doStart && todo.doEnd).map(todo => {
                      const tagColor = getTodoTagColor(todo) || '#6BAA7A';
                      const isOvertime = isDoOvertimeVsPlan(todo);
                      const tone = isOvertime ? '#D4735A' : tagColor;
                      const top = timeToTop(todo.doStart!, startHour);
                      const height = durationToPx(todo.doStart!, todo.doEnd!);
                      return (
                        <button
                          key={`do-${todo.id}`}
                          type="button"
                          title={`${todo.text}\n${todo.doStart}-${todo.doEnd}${doElapsedTitleSuffix(todo)}${isOvertime ? ' (초과)' : ''}`}
                          className="absolute rounded-[18px] text-left overflow-hidden"
                          style={{
                            top,
                            height,
                            left: '18%',
                            right: '8%',
                            backgroundColor: isOvertime ? 'rgba(250,232,214,0.95)' : `${tagColor}20`,
                            border: `1px solid ${isOvertime ? '#D4735A55' : `${tagColor}38`}`,
                            borderLeft: `3px solid ${tone}`,
                            boxShadow: `0 3px 10px ${tone}14`,
                            padding: '7px 8px',
                            zIndex: 4,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tone, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {todo.text}
                          </div>
                          {height >= 42 && (
                            <div style={{ fontSize: 9, color: tone, opacity: 0.78, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {todo.doStart}-{todo.doEnd}
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {selfCareRecords
                      .filter(r => r.date === dateStr && r.category === 'sleep' && r.sleepStart && r.sleepEnd)
                      .map(record => {
                        const [sh, sm] = record.sleepStart!.split(':').map(Number);
                        const [eh, em] = record.sleepEnd!.split(':').map(Number);
                        const startMin = sh * 60 + sm;
                        let endMin = eh * 60 + em;
                        if (endMin <= startMin) endMin += 24 * 60;
                        const top = ((startMin / 60) - startHour) * HOUR_HEIGHT;
                        const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);
                        const displayEnd = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
                        return (
                          <button
                            key={`sleep-${record.id}`}
                            type="button"
                            title={`수면\n${record.sleepStart}-${displayEnd}`}
                            className="absolute text-left overflow-hidden"
                            style={{
                              top, height,
                              left: '18%', right: '8%',
                              backgroundColor: 'rgba(200,210,220,0.45)',
                              border: '1px solid rgba(148,163,184,0.4)',
                              borderLeft: '3px solid #94A3B8',
                              borderRadius: 14,
                              padding: '5px 8px',
                              zIndex: 2,
                              cursor: 'pointer',
                            }}
                            onClick={() => setEditingSleepRecord(record)}
                          >
                            <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              🌙 수면
                            </div>
                            {height >= 40 && (
                              <div style={{ fontSize: 9, color: '#64748B', opacity: 0.8, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {record.sleepStart}-{displayEnd}
                              </div>
                            )}
                          </button>
                        );
                      })}

                    {dateStr === todayStr && (
                      <div className="absolute left-[6%] right-[6%] z-10 pointer-events-none flex items-center" style={{ top: timeToTop(nowHHMM, startHour) }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: CURRENT_TIME_COLOR, flexShrink: 0 }} />
                        <div style={{ flex: 1, height: 2, backgroundColor: CURRENT_TIME_COLOR }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div className="flex" style={{ flex: 1, minHeight: 0 }}>
          {renderWeekTable(visibleDays, viewDays !== 7)}
        </div>
      </div>

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
    </>
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
  const [panelDate, setPanelDate] = useState<string | null>(null);
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
    const todayStr = format(new Date(), 'yyyy-MM-dd');
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
  const panelTodos = panelDate
    ? expandRecurringTodos(todos, panelDate, panelDate)
      .filter(todo => todo.status !== 'backlog' && todo.status !== 'cancelled')
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

  // ── 할일 동작 (일간 페이지 로직 재사용) ──
  const handleToggleTodo = (todo: Todo) => {
    if (todo.status === 'done') {
      updateTodo(todo.id, { status: 'active', doStart: undefined, doEnd: undefined, doElapsedSec: undefined });
      return;
    }
    const doneAt = format(new Date(), 'HH:mm');
    updateTodo(todo.id, { status: 'done', doStart: doneAt, doEnd: doneAt, doElapsedSec: 0 });
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
    <div className="relative" style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: t.bg }}>
      <div className="px-3 py-3 lg:px-4 lg:py-4" style={{ flexShrink: 0, backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={handlePrev} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#eef4fa]">
            <ChevronLeft size={18} color="#888" />
          </button>
          <span className="flex-1 text-center" style={{ fontSize: 16, fontWeight: 700, color: '#26343d' }}>{navLabel}</span>
          <button onClick={handleNext} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#eef4fa]">
            <ChevronRight size={18} color="#888" />
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#EFE7D8', border: '1px solid #E2D5BF' }}>
          {(['month', 'week'] as TabType[]).map(value => (
            <button
              key={value}
              onClick={() => {
                setTab(value);
                if (value === 'week') setViewDate(parseISO(selectedDate));
              }}
              className="flex-1 py-1.5 rounded-lg transition-all"
              style={{
                fontSize: 12,
                fontWeight: tab === value ? 700 : 500,
                backgroundColor: tab === value ? '#FDFAF4' : 'transparent',
                color: tab === value ? '#8D7152' : '#B0A188',
                border: tab === value ? '1px solid #C4A882' : '1px solid transparent',
                boxShadow: tab === value ? '0 1px 3px rgba(196,168,130,0.25)' : 'none',
              }}
            >
              {value === 'month' ? '월별' : '주별'}
            </button>
          ))}
        </div>

        {tab === 'month' && (
          <>
            <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {FILTER_TABS.map(item => {
                const active = filter === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    className="flex-shrink-0 px-3 py-1 rounded-full transition-all"
                    style={{
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
                      style={{
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
          <div className="bg-white rounded-2xl shadow-sm h-full" style={{ border: '1px solid #eef4fa', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* 모바일: 3일·일별·주간요약 탭 뷰 */}
            <div className="flex flex-col md:hidden" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <WeekViewMobile
                viewDate={viewDate}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                weekStartsOn={weekStartsOn}
                onToday={handleToday}
              />
            </div>
            {/* PC: Plan·Do 분할 뷰 */}
            <div className="hidden md:flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <WeekViewPC
                viewDate={viewDate}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                weekStartsOn={weekStartsOn}
                onToday={handleToday}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-3 pb-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-3 flex flex-col" style={{ minHeight: 0, overflow: 'hidden' }}>
          <div
            style={{
              overflow: 'hidden',
              maxHeight: isCalendarExpanded ? 520 : 145,
              transition: 'max-height 0.32s ease',
              flexShrink: 0,
            }}
          >
            <div
              className="bg-white rounded-2xl p-4 shadow-sm"
              style={{ border: '1px solid #eef4fa' }}
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

          <div className="flex-1 min-h-0 overflow-hidden">
            <div
              className="rounded-[18px] h-full overflow-hidden"
              style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
            >
              <div className="h-full overflow-y-auto px-4 py-4 lg:px-5">
                {!panelDate && (
                  <div className="h-full flex items-center justify-center">
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
