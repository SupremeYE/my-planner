import { useState } from 'react';
import {
  format, addMonths, subMonths, getDaysInMonth,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  getISOWeek, getYear,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react';
import { usePlanner, getWeekKey } from '../store';
import { useTheme } from '../ThemeContext';
import { WeeklyGoalsSection } from './WeeklyView';

export function MonthlyView() {
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  // 탭별 독립적인 날짜 state
  const [weeklyViewDate, setWeeklyViewDate] = useState(new Date());
  const [monthlyViewDate, setMonthlyViewDate] = useState(new Date());

  const weekStart = startOfWeek(weeklyViewDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weeklyViewDate, { weekStartsOn: 1 });
  const weekKey = getWeekKey(weeklyViewDate);

  return (
    <div style={{ minHeight: '100%', backgroundColor: t.bg }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4"
        style={{ backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}
      >
        {/* 날짜 네비게이션 */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() =>
              activeTab === 'weekly'
                ? setWeeklyViewDate(subWeeks(weeklyViewDate, 1))
                : setMonthlyViewDate(subMonths(monthlyViewDate, 1))
            }
            className="p-2 rounded-xl hover:bg-[#F0EBE3]"
          >
            <ChevronLeft size={18} color="#888" />
          </button>

          <div className="text-center">
            {activeTab === 'weekly' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#2D2D2D' }}>
                  {getYear(weeklyViewDate)}년 {getISOWeek(weeklyViewDate)}주차
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {format(weekStart, 'M월 d일')} – {format(weekEnd, 'M월 d일', { locale: ko })}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 700, color: '#2D2D2D' }}>
                {format(monthlyViewDate, 'yyyy년 M월')}
              </div>
            )}
          </div>

          <button
            onClick={() =>
              activeTab === 'weekly'
                ? setWeeklyViewDate(addWeeks(weeklyViewDate, 1))
                : setMonthlyViewDate(addMonths(monthlyViewDate, 1))
            }
            className="p-2 rounded-xl hover:bg-[#F0EBE3]"
          >
            <ChevronRight size={18} color="#888" />
          </button>
        </div>

        {/* 탭 바 */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ backgroundColor: '#F0EBE3' }}
        >
          {(['weekly', 'monthly'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 text-center transition-all"
              style={{
                fontSize: 13,
                fontWeight: activeTab === tab ? 700 : 400,
                backgroundColor: activeTab === tab ? '#C8A97E' : 'transparent',
                color: activeTab === tab ? '#fff' : '#888',
                borderRadius: 10,
              }}
            >
              {tab === 'weekly' ? '주간 목표' : '월간 목표'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'weekly' ? (
        <div className="p-4">
          <WeeklyGoalsSection weekKey={weekKey} viewDate={weeklyViewDate} />
        </div>
      ) : (
        <MonthlyGoalsContent viewDate={monthlyViewDate} />
      )}
    </div>
  );
}

// ── Monthly Goals Tab Content ──
function MonthlyGoalsContent({ viewDate }: { viewDate: Date }) {
  const {
    monthlyGoals, weeklyGoals, habits, todos,
    addMonthlyGoal, deleteMonthlyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
  } = usePlanner();
  const { t } = useTheme();
  const [newGoalText, setNewGoalText] = useState('');
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const currentMonth = format(viewDate, 'yyyy-MM');
  const thisMonthGoals = monthlyGoals.filter(g => g.month === currentMonth);
  const daysInMonth = getDaysInMonth(viewDate);

  const monthTodos = todos.filter(td => td.date && td.date.startsWith(currentMonth));
  const doneTodos = monthTodos.filter(td => td.status === 'done');
  const totalTodos = monthTodos.filter(td => td.status !== 'backlog' && td.status !== 'cancelled');

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    addMonthlyGoal(newGoalText.trim());
    setNewGoalText('');
  };

  const getHabitMonthStats = (habit: { checkedDates: string[] }) => {
    const count = habit.checkedDates.filter(d => d.startsWith(currentMonth)).length;
    return { count, pct: Math.round((count / daysInMonth) * 100) };
  };

  return (
    <div className="p-4 space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center" style={{ border: '1px solid #F0EBE3' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#C8A97E' }}>{doneTodos.length}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>완료한 할일</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center" style={{ border: '1px solid #F0EBE3' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D' }}>
            {totalTodos.length ? Math.round((doneTodos.length / totalTodos.length) * 100) : 0}%
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>달성률</div>
        </div>
      </div>

      {/* 이달의 목표 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: '1px solid #F0EBE3' }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={14} color="#C8A97E" />
          <span style={{ fontSize: 11, color: '#C8A97E', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            이달의 목표
          </span>
        </div>

        <div className="space-y-4">
          {thisMonthGoals.map(goal => {
            const subGoals = weeklyGoals.filter(g => g.monthlyGoalId === goal.id);
            const done = subGoals.filter(g => g.done).length;
            const total = subGoals.length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const isExpanded = expandedGoal === goal.id;

            return (
              <div key={goal.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid #F0EBE3' }}>
                <div className="p-3" style={{ backgroundColor: '#FAF8F5' }}>
                  <div className="flex items-start justify-between mb-2">
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#2D2D2D', flex: 1 }}>{goal.text}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <span style={{ fontSize: 12, color: '#C8A97E', fontWeight: 600 }}>{pct}%</span>
                      <button onClick={() => deleteMonthlyGoal(goal.id)} className="p-1 rounded-lg hover:bg-[#F0EBE3]">
                        <Trash2 size={12} color="#ccc" />
                      </button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mb-1" style={{ backgroundColor: '#F0EBE3' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#C8A97E' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 10, color: '#888' }}>
                      {total === 0 ? '주간 목표를 연결하세요' : `주간 목표 ${done}/${total} 달성`}
                    </span>
                    {subGoals.length > 0 && (
                      <button
                        onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                        className="flex items-center gap-1"
                        style={{ fontSize: 11, color: '#888' }}
                      >
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {isExpanded ? '접기' : '보기'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && subGoals.length > 0 && (
                  <div className="p-3 space-y-2" style={{ backgroundColor: '#F9F6F1', borderTop: '1px solid #F0EBE3' }}>
                    {subGoals.map(sg => (
                      <div key={sg.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white">
                        <button onClick={() => toggleWeeklyGoal(sg.id)}>
                          <span style={{ fontSize: 14, color: sg.done ? '#C8A97E' : '#ddd' }}>
                            {sg.done ? '✓' : '○'}
                          </span>
                        </button>
                        <span style={{
                          flex: 1, fontSize: 13,
                          color: sg.done ? '#888' : '#2D2D2D',
                          textDecoration: sg.done ? 'line-through' : 'none',
                        }}>
                          {sg.text}
                        </span>
                        <span style={{ fontSize: 10, color: '#aaa' }}>{sg.weekKey}</span>
                        <button onClick={() => deleteWeeklyGoal(sg.id)} className="p-1 rounded-lg hover:bg-[#F0EBE3]">
                          <Trash2 size={11} color="#ddd" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {thisMonthGoals.length === 0 && (
            <p style={{ fontSize: 13, color: '#888' }}>이달의 목표를 추가해보세요</p>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <input
            value={newGoalText}
            onChange={e => setNewGoalText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
            placeholder="새 월간 목표 추가..."
            className="flex-1 px-3 py-2 rounded-xl outline-none"
            style={{ fontSize: 13, backgroundColor: '#F0EBE3', color: '#2D2D2D', border: 'none' }}
          />
          <button
            onClick={handleAddGoal}
            className="px-3 py-2 rounded-xl flex items-center gap-1"
            style={{ backgroundColor: '#C8A97E', color: '#fff' }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* 이달 습관 달성률 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: '1px solid #F0EBE3' }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: 11, color: '#C8A97E', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            이달 습관 달성률
          </span>
        </div>

        {habits.length === 0 ? (
          <p style={{ fontSize: 13, color: '#888' }}>등록된 습관이 없어요</p>
        ) : (
          <div className="space-y-5">
            {habits.map(habit => {
              const { count, pct } = getHabitMonthStats(habit);
              return (
                <div key={habit.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 14, color: '#2D2D2D' }}>{habit.name}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 11, color: '#888' }}>{count}/{daysInMonth}일</span>
                      <span
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: pct >= 80 ? '#F5E6CC' : '#F0EBE3',
                          color: pct >= 80 ? '#C8A97E' : '#aaa',
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#F0EBE3' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct >= 80 ? '#C8A97E' : pct >= 50 ? '#D4B896' : '#E8D4A8',
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                      const checked = habit.checkedDates.includes(dateStr);
                      return (
                        <div key={day} className="flex flex-col items-center">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: checked ? '#C8A97E' : '#F0EBE3' }}
                            title={dateStr}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
