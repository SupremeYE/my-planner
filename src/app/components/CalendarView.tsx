import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MoreVertical, X } from 'lucide-react';
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
import { usePlanner, PeriodRecord, SelfCareRecord, Todo } from '../store';
import { isDoOvertimeVsPlan, doElapsedTitleSuffix } from '../../lib/todoDoDuration';
import { useTheme } from '../ThemeContext';
import { TimePicker } from './TimePicker';
import { TodoModal } from './TodoModal';
import { EventModal } from './EventModal';
import { FloatingAddFab } from './FloatingAddFab';
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
  const { todos, events, habits, selfCareRecords, periodRecords, selectedDate } = usePlanner();

  const firstDay = startOfMonth(viewDate);
  const startOffset = (getDay(firstDay) - weekStartsOn + 7) % 7;
  const daysInMonth = getDaysInMonth(viewDate);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weekdayLabels = getWeekdayLabels(weekStartsOn);

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
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: eventColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
  const { selectedDate, setSelectedDate, appSettings, tags, events, todos, habits, brainstormMemos } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<TabType>('month');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewDate, setViewDate] = useState(parseISO(selectedDate));
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [weekViewDays, setWeekViewDays] = useState<1 | 2 | 3 | 7>(7);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [panelDate, setPanelDate] = useState<string | null>(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const calendarMenuRef = useRef<HTMLDivElement>(null);
  const weekStartsOn = appSettings.weekStartsOn ?? 1;
  const showTagLayer = tab === 'month' && (filter === 'todo' || filter === 'event') && tags.length > 0;

  useEffect(() => {
    setViewDate(parseISO(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    setSelectedTagIds([]);
  }, [filter]);

  useEffect(() => {
    if (!showCalendarMenu) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(event.target as Node)) {
        setShowCalendarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showCalendarMenu]);

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


  const panelEvents = panelDate
    ? events
      .filter(event => event.date === panelDate)
      .slice()
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    : [];
  const panelTodos = panelDate
    ? todos
      .filter(todo => todo.date === panelDate && todo.status !== 'backlog' && todo.status !== 'cancelled')
      .slice()
      .sort((a, b) => (a.planStart ?? a.doStart ?? '').localeCompare(b.planStart ?? b.doStart ?? ''))
    : [];
  const panelHabits = panelDate ? habits : [];
  const panelMemo = panelDate ? brainstormMemos[panelDate]?.trim() ?? '' : '';

  const getTagName = (tagId: string) => tags.find(tag => tag.id === tagId);
  const hasPanelContent = panelEvents.length > 0 || panelTodos.length > 0 || panelHabits.length > 0 || !!panelMemo;

  return (
    <div className="relative" style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: t.bg }}>
      <div className="px-3 py-3 lg:px-4 lg:py-4" style={{ flexShrink: 0, backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={handlePrev} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#eef4fa]">
            <ChevronLeft size={18} color="#888" />
          </button>
          <span className="flex-1 text-center" style={{ fontSize: 16, fontWeight: 700, color: '#26343d' }}>{navLabel}</span>
          <div className="flex items-center gap-2">
            <div className="relative" ref={calendarMenuRef}>
              <button
                onClick={() => setShowCalendarMenu(prev => !prev)}
                className="p-1.5 lg:p-2 rounded-xl hover:bg-[#eef4fa]"
              >
                <MoreVertical size={18} color="#888" />
              </button>
              {showCalendarMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-2xl z-20 p-1"
                  style={{
                    backgroundColor: '#fff',
                    border: `1px solid ${t.border}`,
                    boxShadow: '0 8px 18px rgba(38,52,61,0.08)',
                    minWidth: 124,
                  }}
                >
                  <button
                    onClick={() => {
                      handleToday();
                      setShowCalendarMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left transition-colors rounded-xl"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: t.accent,
                      backgroundColor: '#fff',
                      borderBottom: tab === 'week' ? `1px solid ${t.borderLight}` : 'none',
                    }}
                  >
                    오늘
                  </button>
                  {tab === 'week' && [
                    { value: 7 as const, label: '전체' },
                    { value: 1 as const, label: '일별보기' },
                    { value: 2 as const, label: '주 2일' },
                    { value: 3 as const, label: '주 3일' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setWeekViewDays(option.value);
                        setShowCalendarMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left transition-colors rounded-xl"
                      style={{
                        fontSize: 12,
                        fontWeight: weekViewDays === option.value ? 700 : 500,
                        color: weekViewDays === option.value ? t.accent : t.text,
                        backgroundColor: weekViewDays === option.value ? t.accentLight : '#fff',
                        borderBottom: option.value !== 3 ? `1px solid ${t.borderLight}` : 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleNext} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#eef4fa]">
              <ChevronRight size={18} color="#888" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#eef4fa', border: `1px solid ${t.border}` }}>
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
                fontWeight: tab === value ? 600 : 400,
                backgroundColor: tab === value ? '#fff' : 'transparent',
                color: tab === value ? '#26343d' : '#888',
                border: tab === value ? `1px solid ${t.border}` : '1px solid transparent',
                boxShadow: tab === value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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
              />
            </div>
            {/* PC: Plan·Do 분할 뷰 */}
            <div className="hidden md:flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <WeekViewPC
                viewDate={viewDate}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                weekStartsOn={weekStartsOn}
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
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: '1px solid #eef4fa' }}>
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

                    {panelEvents.length > 0 && (
                      <section>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>일정</h3>
                        <div className="space-y-2">
                          {panelEvents.map(event => (
                            <div key={event.id} className="rounded-xl px-3 py-2" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{event.title}</div>
                              {event.startTime && event.endTime && (
                                <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
                                  {event.startTime} ~ {event.endTime}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {panelTodos.length > 0 && (
                      <section>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>할일</h3>
                        <div className="space-y-2">
                          {panelTodos.map(todo => (
                            <div key={todo.id} className="rounded-xl px-3 py-2" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: todo.status === 'done' ? t.textMuted : t.text,
                                  textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                                }}
                              >
                                {todo.text}
                              </div>
                              <div className="flex gap-1.5 flex-wrap mt-2">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full"
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    backgroundColor: todo.status === 'done' ? t.checkDone : t.card,
                                    color: todo.status === 'done' ? '#fff' : t.textSub,
                                    border: `1px solid ${todo.status === 'done' ? t.checkDone : t.border}`,
                                  }}
                                >
                                  {todo.status === 'done' ? '완료' : '미완료'}
                                </span>
                                {(todo.tags ?? []).map(tagId => {
                                  const tag = getTagName(tagId);
                                  if (!tag) return null;
                                  return (
                                    <span
                                      key={tagId}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full"
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: tag.color,
                                        backgroundColor: `${tag.color}18`,
                                        border: `1px solid ${tag.color}33`,
                                      }}
                                    >
                                      {tag.name}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {panelHabits.length > 0 && (
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

                    {panelMemo && (
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

      <FloatingAddFab
        onAddTodo={() => setShowAddTodoModal(true)}
        onAddEvent={() => setShowAddEventModal(true)}
      />

      {showAddTodoModal && <TodoModal date={selectedDate} onClose={() => setShowAddTodoModal(false)} />}
      {showAddEventModal && <EventModal date={selectedDate} onClose={() => setShowAddEventModal(false)} />}
    </div>
  );
}
