import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, getDaysInMonth,
  getDay, addDays, startOfWeek, endOfWeek, isSameDay, parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo } from '../store';
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

function timeToTop(time: string, startHour: number): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - startHour) * 60 + m) * (HOUR_HEIGHT / 60);
}
function durationToPx(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(((eh - sh) * 60 + (em - sm)) * (HOUR_HEIGHT / 60), 16);
}

// ─── Month View ───
function MonthView({ viewDate, filter, onSelectDate }: {
  viewDate: Date;
  filter: FilterType;
  onSelectDate: (d: string) => void;
}) {
  const { todos, events, habits, selfCareRecords, selectedDate } = usePlanner();

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
              <span className="self-center" style={{ fontSize: 13, color: isSelected ? '#fff' : isToday ? '#C8A97E' : '#2D2D2D', fontWeight: isSelected || isToday ? 700 : 400 }}>
                {day}
              </span>
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
  const { todos, dayStartHour: START_HOUR, dayEndHour: END_HOUR } = usePlanner();

  const weekStart = startOfWeek(viewDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Day headers — 고정 */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #F0EBE3' }}>
        <div className="grid" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
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
              <span style={{ fontSize: 9, color: '#aaa', width: 36, textAlign: 'right', paddingRight: 4 }}>{h % 24}:00</span>
              <div className="flex-1 border-t" style={{ borderColor: '#E8E0D4' }} />
            </div>
          ))}

          {/* Day columns with blocks */}
          <div className="absolute grid" style={{ left: 40, right: 0, top: 0, bottom: 0, gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map(d => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const dayTodos = todos.filter(t => t.date === dateStr);

              return (
                <div key={dateStr} className="relative border-l" style={{ borderColor: '#F0EBE3' }}>
                  {dayTodos.filter(t => t.planStart && t.planEnd).map(todo => (
                    <div key={`p-${todo.id}`} className="absolute rounded"
                      style={{
                        top: timeToTop(todo.planStart!, START_HOUR),
                        height: durationToPx(todo.planStart!, todo.planEnd!),
                        left: 1, right: '50%',
                        backgroundColor: '#F5E6CC',
                        border: '1px solid #E8D4A8',
                        padding: '1px 3px',
                        overflow: 'hidden',
                        fontSize: 9,
                        color: '#2D2D2D',
                        zIndex: 1,
                      }}>
                      {todo.text}
                    </div>
                  ))}
                  {dayTodos.filter(t => t.doStart && t.doEnd).map(todo => (
                    <div key={`d-${todo.id}`} className="absolute rounded"
                      style={{
                        top: timeToTop(todo.doStart!, START_HOUR),
                        height: durationToPx(todo.doStart!, todo.doEnd!),
                        left: '50%', right: 1,
                        backgroundColor: '#2D2D2D',
                        padding: '1px 3px',
                        overflow: 'hidden',
                        fontSize: 9,
                        color: '#fff',
                        zIndex: 1,
                      }}>
                      {todo.text}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Day View (mini daily) ───
// flex-1로 남은 높이를 채우고, 내부에서만 스크롤
function DayViewPanel({ dateStr }: { dateStr: string }) {
  const { todos, dayStartHour: START_HOUR, dayEndHour: END_HOUR } = usePlanner();
  const dayTodos = todos.filter(t => t.date === dateStr && t.status !== 'backlog');
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT + 8 }}>
        {hours.map(h => (
          <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}>
            <span style={{ fontSize: 10, color: '#aaa', width: 40, textAlign: 'right', paddingRight: 6 }}>{h % 24}:00</span>
            <div className="flex-1 border-t" style={{ borderColor: '#E8E0D4' }} />
          </div>
        ))}
        <div className="absolute" style={{ left: 44, right: 0, top: 0, bottom: 0 }}>
          {dayTodos.filter(t => t.planStart && t.planEnd).map(todo => (
            <div key={`p-${todo.id}`} className="absolute rounded"
              style={{
                top: timeToTop(todo.planStart!, START_HOUR),
                height: durationToPx(todo.planStart!, todo.planEnd!),
                left: 0, right: '52%',
                backgroundColor: '#F5E6CC',
                border: '1px solid #E8D4A8',
                padding: '2px 6px',
                overflow: 'hidden',
                fontSize: 11,
                color: '#2D2D2D',
              }}>
              {todo.text}
            </div>
          ))}
          {dayTodos.filter(t => t.doStart && t.doEnd).map(todo => (
            <div key={`d-${todo.id}`} className="absolute rounded"
              style={{
                top: timeToTop(todo.doStart!, START_HOUR),
                height: durationToPx(todo.doStart!, todo.doEnd!),
                left: '50%', right: 0,
                backgroundColor: '#2D2D2D',
                padding: '2px 6px',
                overflow: 'hidden',
                fontSize: 11,
                color: '#fff',
              }}>
              {todo.text}
            </div>
          ))}
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
      <div className="px-4 py-4" style={{ flexShrink: 0, backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={handlePrev} className="p-2 rounded-xl hover:bg-[#F0EBE3]">
            <ChevronLeft size={18} color="#888" />
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#2D2D2D' }}>{navLabel}</span>
          <button onClick={handleNext} className="p-2 rounded-xl hover:bg-[#F0EBE3]">
            <ChevronRight size={18} color="#888" />
          </button>
        </div>

        {/* 월별/주별/일별 탭 */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#F0EBE3' }}>
          {(['month', 'week', 'day'] as TabType[]).map(v => (
            <button key={v} onClick={() => setTab(v)}
              className="flex-1 py-1.5 rounded-lg transition-all"
              style={{
                fontSize: 13,
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
                    fontSize: 12, fontWeight: active ? 700 : 500,
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
          <div className="p-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: '1px solid #F0EBE3' }}>
              <MonthView viewDate={viewDate} filter={filter} onSelectDate={handleSelectDate} />
            </div>
          </div>
        </div>
      )}

      {/* ── 주별: 헤더 고정 + 타임라인 단일 스크롤 ── */}
      {tab === 'week' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '12px 16px 16px' }}>
          <div className="bg-white rounded-2xl shadow-sm" style={{ border: '1px solid #F0EBE3', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <WeekView viewDate={viewDate} onSelectDate={handleSelectDate} />
          </div>
        </div>
      )}

      {/* ── 일별: 헤더 고정 + 타임라인 단일 스크롤 ── */}
      {tab === 'day' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '12px 16px 16px' }}>
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
