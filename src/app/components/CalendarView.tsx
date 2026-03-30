import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, getDaysInMonth,
  getDay, addDays, startOfWeek, endOfWeek, isSameDay, parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, PeriodRecord } from '../store';
import { isDoOvertimeVsPlan, doElapsedTitleSuffix, doElapsedInlineSuffix } from '../../lib/todoDoDuration';
import { useNavigate } from 'react-router';
import { useTheme } from '../ThemeContext';

type TabType = 'month' | 'week' | 'day';
type FilterType = 'all' | 'todo' | 'event' | 'habit' | 'selfcare';

const CHIP_COLORS: Record<Exclude<FilterType, 'all'>, { bg: string; color: string }> = {
  todo:     { bg: '#F0C4B8', color: '#D4735A' },
  event:    { bg: '#D0E0F5', color: '#7B9ED9' },
  habit:    { bg: '#C8E6D0', color: '#6BAA7A' },
  selfcare: { bg: '#E8D9C0', color: '#A08050' },
};

const FILTER_TABS: { key: FilterType; label: string; activeColor: string }[] = [
  { key: 'all',      label: '전체',    activeColor: '#2D2D2D' },
  { key: 'todo',     label: '할일',    activeColor: '#D4735A' },
  { key: 'event',    label: '일정',    activeColor: '#7B9ED9' },
  { key: 'habit',    label: '습관',    activeColor: '#6BAA7A' },
  { key: 'selfcare', label: '자기관리', activeColor: '#A08050' },
];

// ─── Time helpers ───
const HOUR_HEIGHT = 48;
const PLAN_BAR_BG = '#EDE3D6';
const PLAN_BAR_BORDER = '#C4A882';
const DO_BAR_FALLBACK_BG = '#D4EDE0';
const DO_BAR_FALLBACK_TEXT = '#4A8A5A';
const OVERTIME_BAR_BG = '#FAE8D6';
const OVERTIME_BAR_BORDER = '#D4735A';
const CURRENT_TIME_COLOR = '#D4735A';
const WEEK_TIME_LABEL_WIDTH = 40;
const WEEK_DAY_GAP = 6;

function timeToTop(time: string, startHour: number): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - startHour) * 60 + m) * (HOUR_HEIGHT / 60);
}
function durationToPx(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(((eh - sh) * 60 + (em - sm)) * (HOUR_HEIGHT / 60), 16);
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

// ─── Month View ───
function isPeriodDate(dateStr: string, records: PeriodRecord[]): boolean {
  return records.some(r => {
    if (!r.endDate) return r.startDate === dateStr;
    return r.startDate <= dateStr && dateStr <= r.endDate;
  });
}

function MonthView({ viewDate, filter, onSelectDate }: {
  viewDate: Date;
  filter: FilterType;
  onSelectDate: (d: string) => void;
}) {
  const { todos, events, habits, selfCareRecords, periodRecords, selectedDate } = usePlanner();

  const firstDay = startOfMonth(viewDate);
  const startDow = getDay(firstDay);
  const daysInMonth = getDaysInMonth(viewDate);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getItems = (dateStr: string) => {
    const items: { id: string; text: string; type: Exclude<FilterType, 'all'> }[] = [];
    if (filter === 'all' || filter === 'todo')
      todos.filter(t => t.date === dateStr && t.status !== 'backlog' && t.status !== 'cancelled')
        .forEach(t => items.push({ id: t.id, text: t.text, type: 'todo' }));
    if (filter === 'all' || filter === 'event')
      events.filter(e => e.date === dateStr)
        .forEach(e => items.push({ id: e.id, text: e.title, type: 'event' }));
    if (filter === 'all' || filter === 'habit')
      habits.filter(h => h.checkedDates.includes(dateStr))
        .forEach(h => items.push({ id: h.id, text: h.name, type: 'habit' }));
    if (filter === 'all' || filter === 'selfcare')
      selfCareRecords.filter(s => s.date === dateStr)
        .forEach(s => items.push({ id: s.id, text: s.content, type: 'selfcare' }));
    return items;
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} className="text-center py-2" style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const items = getItems(dateStr);
          const shown = items.slice(0, 4);
          const overflow = items.length - 4;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const hasPeriod = isPeriodDate(dateStr, periodRecords);

          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              className="relative flex flex-col items-start p-1 rounded-xl transition-all"
              style={{
                backgroundColor: isSelected ? '#C8A97E' : isToday ? '#F5E6CC' : 'transparent',
                minHeight: 72,
              }}
            >
              <div className="self-center flex flex-col items-center gap-0.5">
                <span style={{ fontSize: 13, color: isSelected ? '#fff' : isToday ? '#C8A97E' : '#2D2D2D', fontWeight: isSelected || isToday ? 700 : 400 }}>
                  {day}
                </span>
                {hasPeriod && (
                  <span style={{
                    display: 'block', width: 5, height: 5, borderRadius: '50%',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.9)' : '#E07899',
                    flexShrink: 0,
                  }} />
                )}
              </div>
              <div className="flex flex-col gap-0.5 w-full mt-0.5">
                {shown.map(item => {
                  const c = CHIP_COLORS[item.type];
                  return (
                    <div key={item.id} className="rounded px-1 w-full overflow-hidden"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : c.bg }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        color: isSelected ? '#fff' : c.color,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: 'block', lineHeight: '14px',
                      }}>
                        {item.text}
                      </span>
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <span style={{ fontSize: 9, color: isSelected ? '#fff' : '#999', paddingLeft: 2 }}>
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

// ─── Week View ───
// 헤더(요일)는 고정, 타임라인만 단일 스크롤
function WeekView({ viewDate, onSelectDate }: { viewDate: Date; onSelectDate: (d: string) => void }) {
  const { todos, tags, dayStartHour: START_HOUR, dayEndHour: END_HOUR } = usePlanner();
  const { t } = useTheme();
  const [nowTime, setNowTime] = useState(new Date());
  const [selectedBlock, setSelectedBlock] = useState<{ text: string; time: string; date: string; tone: string } | null>(null);
  useEffect(() => {
    const iv = setInterval(() => setNowTime(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);
  const nowHHMM = `${String(nowTime.getHours()).padStart(2, '0')}:${String(nowTime.getMinutes()).padStart(2, '0')}`;
  const getTodoTagColor = (todo: Todo) => {
    if (!todo.tags?.length) return null;
    return tags.find(tg => tg.id === todo.tags?.[0])?.color || null;
  };

  const weekStart = startOfWeek(viewDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Day headers — 고정 */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #F0EBE3' }}>
        <div className="px-2 py-2 flex items-center gap-4" style={{ borderBottom: '1px solid #F5EFE7' }}>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 600, color: '#7D6347' }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: PLAN_BAR_BG, border: `1px solid ${PLAN_BAR_BORDER}` }} />
            PLAN
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 600, color: '#4A8A5A' }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: DO_BAR_FALLBACK_BG, border: '1px solid #B6DCCB' }} />
            DO
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 600, color: OVERTIME_BAR_BORDER }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: OVERTIME_BAR_BG, border: `1px solid ${OVERTIME_BAR_BORDER}` }} />
            초과
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: `${WEEK_TIME_LABEL_WIDTH}px repeat(7, 1fr)` }}>
          <div />
          {days.map(d => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const isToday = dateStr === todayStr;
            return (
              <button key={dateStr} onClick={() => onSelectDate(dateStr)} className="flex flex-col items-center py-2">
                <span style={{ fontSize: 11, color: '#888' }}>{format(d, 'E', { locale: ko })}</span>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                  fontSize: 12, fontWeight: 700,
                  backgroundColor: isToday ? '#C8A97E' : 'transparent',
                  color: isToday ? '#fff' : '#2D2D2D',
                }}>
                  {format(d, 'd')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time grid — 단일 스크롤 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
          {/* Hour lines */}
          {hours.map(h => (
            <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}>
              <span style={{ fontSize: 9, color: '#aaa', width: WEEK_TIME_LABEL_WIDTH - 4, textAlign: 'right', paddingRight: 4 }}>{String(h % 24).padStart(2, '0')}:00</span>
              <div className="flex-1 border-t" style={{ borderColor: '#E8E0D4' }} />
            </div>
          ))}

          {/* Day columns with blocks */}
          <div className="absolute grid" style={{ left: WEEK_TIME_LABEL_WIDTH, right: 0, top: 0, bottom: 0, gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map(d => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const dayTodos = todos.filter(t => t.date === dateStr);

              return (
                <div key={dateStr} className="relative border-l" style={{ borderColor: '#F0EBE3' }}>
                  <div className="absolute inset-y-0 left-1 right-1 pointer-events-none">
                    <div className="absolute inset-y-1 rounded-xl"
                      style={{
                        left: 0,
                        right: `calc(50% + ${WEEK_DAY_GAP / 2}px)`,
                        background: 'linear-gradient(180deg, rgba(237,227,214,0.55) 0%, rgba(237,227,214,0.16) 100%)',
                        border: `1px solid ${PLAN_BAR_BORDER}22`,
                      }} />
                    <div className="absolute inset-y-1 rounded-xl"
                      style={{
                        left: `calc(50% + ${WEEK_DAY_GAP / 2}px)`,
                        right: 0,
                        background: 'linear-gradient(180deg, rgba(212,237,224,0.52) 0%, rgba(212,237,224,0.16) 100%)',
                        border: '1px solid rgba(107,170,122,0.14)',
                      }} />
                    <div className="absolute inset-y-0"
                      style={{
                        left: `calc(50% - ${WEEK_DAY_GAP / 2}px)`,
                        width: WEEK_DAY_GAP,
                        borderLeft: `1px dashed ${t.border}`,
                        borderRight: `1px dashed ${t.border}`,
                      }} />
                  </div>
                  {/* PLAN 블록 */}
                  {dayTodos.filter(t => t.planStart && t.planEnd).map(todo => (
                    <div key={`p-${todo.id}`} className="absolute rounded"
                      title={`${todo.text}\n${todo.planStart}–${todo.planEnd}`}
                      onClick={() => setSelectedBlock({
                        text: todo.text,
                        time: `${todo.planStart}–${todo.planEnd}`,
                        date: format(d, 'M월 d일 (E)', { locale: ko }),
                        tone: '#7D6347',
                      })}
                      style={{
                        top: timeToTop(todo.planStart!, START_HOUR),
                        height: durationToPx(todo.planStart!, todo.planEnd!),
                        left: 2, right: `calc(50% + ${WEEK_DAY_GAP / 2}px)`,
                        backgroundColor: PLAN_BAR_BG,
                        border: `1px solid ${PLAN_BAR_BORDER}`,
                        overflow: 'hidden',
                        zIndex: 1,
                        cursor: 'pointer',
                      }} />
                  ))}
                  {/* DO 블록 */}
                  {dayTodos.filter(t => t.doStart && t.doEnd).map(todo => {
                    const tagColor = getTodoTagColor(todo);
                    const isOvertime = isDoOvertimeVsPlan(todo);
                    const bgColor = isOvertime ? OVERTIME_BAR_BG : (tagColor || DO_BAR_FALLBACK_BG);
                    const border = isOvertime ? `1px solid ${OVERTIME_BAR_BORDER}` : 'none';
                    return (
                      <div key={`d-${todo.id}`} className="absolute rounded"
                        title={`${todo.text}\n${todo.doStart}–${todo.doEnd}${doElapsedTitleSuffix(todo)}${isOvertime ? ' (초과)' : ''}`}
                        onClick={() => setSelectedBlock({
                          text: todo.text,
                          time: `${todo.doStart}–${todo.doEnd}${doElapsedInlineSuffix(todo)}${isOvertime ? ' · 초과' : ''}`,
                          date: format(d, 'M월 d일 (E)', { locale: ko }),
                          tone: isOvertime ? OVERTIME_BAR_BORDER : (tagColor ? getContrastTextColor(tagColor) : DO_BAR_FALLBACK_TEXT),
                        })}
                        style={{
                          top: timeToTop(todo.doStart!, START_HOUR),
                          height: durationToPx(todo.doStart!, todo.doEnd!),
                          left: `calc(50% + ${WEEK_DAY_GAP / 2}px)`, right: 2,
                          backgroundColor: bgColor,
                          border,
                          overflow: 'hidden',
                          zIndex: 1,
                          cursor: 'pointer',
                        }} />
                    );
                  })}
                  {/* 현재 시각선 (오늘 열에만) */}
                  {dateStr === todayStr && (
                    <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                      style={{ top: timeToTop(nowHHMM, START_HOUR) }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: CURRENT_TIME_COLOR, flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 2, backgroundColor: CURRENT_TIME_COLOR }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selectedBlock && (
        <div className="mx-2 mt-2 mb-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 2 }}>{selectedBlock.date}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: selectedBlock.tone }}>{selectedBlock.text}</div>
          <div style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>{selectedBlock.time}</div>
        </div>
      )}
    </div>
  );
}

// ─── Day View (mini daily) ───
// flex-1로 남은 높이를 채우고, 내부에서만 스크롤
function DayViewPanel({ dateStr }: { dateStr: string }) {
  const { todos, tags, dayStartHour: START_HOUR, dayEndHour: END_HOUR } = usePlanner();
  const { t } = useTheme();
  const dayTodos = todos.filter(t => t.date === dateStr && t.status !== 'backlog');
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const getTodoTagColor = (todo: Todo) => {
    if (!todo.tags?.length) return null;
    return tags.find(tg => tg.id === todo.tags?.[0])?.color || null;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT + 8 }}>
        {hours.map(h => (
          <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}>
            <span style={{ fontSize: 10, color: '#aaa', width: WEEK_TIME_LABEL_WIDTH, textAlign: 'right', paddingRight: 6 }}>{String(h % 24).padStart(2, '0')}:00</span>
            <div className="flex-1 border-t" style={{ borderColor: '#E8E0D4' }} />
          </div>
        ))}
        <div className="absolute" style={{ left: WEEK_TIME_LABEL_WIDTH + 4, right: 0, top: 0, bottom: 0 }}>
          <div className="absolute inset-y-0 left-0 right-0 pointer-events-none">
            <div className="absolute inset-y-0 rounded-2xl"
              style={{
                left: 0,
                right: `calc(50% + ${WEEK_DAY_GAP / 2}px)`,
                background: 'linear-gradient(180deg, rgba(237,227,214,0.55) 0%, rgba(237,227,214,0.16) 100%)',
                border: `1px solid ${PLAN_BAR_BORDER}22`,
              }} />
            <div className="absolute inset-y-0 rounded-2xl"
              style={{
                left: `calc(50% + ${WEEK_DAY_GAP / 2}px)`,
                right: 0,
                background: 'linear-gradient(180deg, rgba(212,237,224,0.52) 0%, rgba(212,237,224,0.16) 100%)',
                border: '1px solid rgba(107,170,122,0.14)',
              }} />
          </div>
          {dayTodos.filter(t => t.planStart && t.planEnd).map(todo => (
            <div key={`p-${todo.id}`} className="absolute rounded"
              title={`${todo.text}\n${todo.planStart}–${todo.planEnd}`}
              style={{
                top: timeToTop(todo.planStart!, START_HOUR),
                height: durationToPx(todo.planStart!, todo.planEnd!),
                left: 0, right: `calc(50% + ${WEEK_DAY_GAP / 2}px)`,
                backgroundColor: PLAN_BAR_BG,
                border: `1px solid ${PLAN_BAR_BORDER}`,
                padding: '2px 6px',
                overflow: 'hidden',
                fontSize: 11,
                color: '#7D6347',
              }}>
              {todo.text}
            </div>
          ))}
          {dayTodos.filter(t => t.doStart && t.doEnd).map(todo => {
            const tagColor = getTodoTagColor(todo);
            const isOvertime = isDoOvertimeVsPlan(todo);
            return (
              <div key={`d-${todo.id}`} className="absolute rounded"
                title={`${todo.text}\n${todo.doStart}–${todo.doEnd}${doElapsedTitleSuffix(todo)}${isOvertime ? ' (초과)' : ''}`}
                style={{
                  top: timeToTop(todo.doStart!, START_HOUR),
                  height: durationToPx(todo.doStart!, todo.doEnd!),
                  left: `calc(50% + ${WEEK_DAY_GAP / 2}px)`, right: 0,
                  backgroundColor: isOvertime ? OVERTIME_BAR_BG : (tagColor || DO_BAR_FALLBACK_BG),
                  border: isOvertime ? `1px solid ${OVERTIME_BAR_BORDER}` : 'none',
                  padding: '2px 6px',
                  overflow: 'hidden',
                  fontSize: 11,
                  color: isOvertime ? OVERTIME_BAR_BORDER : (tagColor ? getContrastTextColor(tagColor) : DO_BAR_FALLBACK_TEXT),
                }}>
                {todo.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Calendar View ───
export function CalendarView() {
  const { selectedDate, setSelectedDate } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<TabType>('month');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewDate, setViewDate] = useState(new Date());
  const navigate = useNavigate();

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    if (tab === 'month') {
      navigate('/daily');
    }
  };

  const navLabel = tab === 'month'
    ? format(viewDate, 'yyyy년 M월')
    : tab === 'week'
      ? `${format(startOfWeek(viewDate, { weekStartsOn: 0 }), 'M월 d일')} – ${format(endOfWeek(viewDate, { weekStartsOn: 0 }), 'M월 d일', { locale: ko })}`
      : format(parseISO(selectedDate), 'M월 d일 (E)', { locale: ko });

  const handlePrev = () => {
    if (tab === 'month') setViewDate(subMonths(viewDate, 1));
    else if (tab === 'week') setViewDate(addDays(viewDate, -7));
    else setSelectedDate(format(addDays(parseISO(selectedDate), -1), 'yyyy-MM-dd'));
  };

  const handleNext = () => {
    if (tab === 'month') setViewDate(addMonths(viewDate, 1));
    else if (tab === 'week') setViewDate(addDays(viewDate, 7));
    else setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: t.bg }}>
      {/* Header — 상단 고정 */}
      <div className="px-3 py-3 lg:px-4 lg:py-4" style={{ flexShrink: 0, backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={handlePrev} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#F0EBE3]">
            <ChevronLeft size={18} color="#888" />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#2D2D2D' }} className="lg:text-[17px]">{navLabel}</span>
          <button onClick={handleNext} className="p-1.5 lg:p-2 rounded-xl hover:bg-[#F0EBE3]">
            <ChevronRight size={18} color="#888" />
          </button>
        </div>

        {/* 월별/주별/일별 탭 */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#F0EBE3' }}>
          {(['month', 'week', 'day'] as TabType[]).map(v => (
            <button key={v} onClick={() => setTab(v)}
              className="flex-1 py-1.5 rounded-lg transition-all"
              style={{
                fontSize: 12,
                fontWeight: tab === v ? 600 : 400,
                backgroundColor: tab === v ? '#fff' : 'transparent',
                color: tab === v ? '#2D2D2D' : '#888',
                boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {v === 'month' ? '월별' : v === 'week' ? '주별' : '일별'}
            </button>
          ))}
        </div>

        {/* 필터 탭 (월별 뷰일 때만) */}
        {tab === 'month' && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {FILTER_TABS.map(f => {
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className="flex-shrink-0 px-3 py-1 rounded-full transition-all"
                  style={{
                    fontSize: 11, fontWeight: active ? 700 : 500,
                    backgroundColor: active ? f.activeColor : '#F0EBE3',
                    color: active ? '#fff' : f.activeColor,
                    border: `1.5px solid ${active ? f.activeColor : f.activeColor + '60'}`,
                  }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 월별: 페이지 스크롤 ── */}
      {tab === 'month' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="p-3 lg:p-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: '1px solid #F0EBE3' }}>
              <MonthView viewDate={viewDate} filter={filter} onSelectDate={handleSelectDate} />
            </div>
          </div>
        </div>
      )}

      {/* ── 주별: 헤더 고정 + 타임라인 단일 스크롤 ── */}
      {tab === 'week' && (
        <div className="px-3 pb-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-3"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="bg-white rounded-2xl shadow-sm" style={{ border: '1px solid #F0EBE3', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <WeekView viewDate={viewDate} onSelectDate={handleSelectDate} />
          </div>
        </div>
      )}

      {/* ── 일별: 헤더 고정 + 타임라인 단일 스크롤 ── */}
      {tab === 'day' && (
        <div className="px-3 pb-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-3"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="bg-white rounded-2xl shadow-sm" style={{ border: '1px solid #F0EBE3', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Day view 상단 */}
            <div className="flex items-center justify-between flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid #F0EBE3' }}>
              <span style={{ fontSize: 13, color: '#888' }}>선택된 날짜의 타임테이블</span>
              <button onClick={() => navigate('/daily')} className="px-3 py-1.5 rounded-xl"
                style={{ fontSize: 12, backgroundColor: '#C8A97E', color: '#fff' }}>
                일간 뷰로 이동
              </button>
            </div>
            <DayViewPanel dateStr={selectedDate} />
          </div>
        </div>
      )}
    </div>
  );
}
