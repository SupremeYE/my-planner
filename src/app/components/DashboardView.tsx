import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../ThemeContext';
import { usePlanner, DEFAULT_AFFIRMATIONS, today, getWeekKey } from '../store';
import {
  Clock, CheckCircle2, Flame, Target, TrendingUp, ChevronDown, ChevronRight,
  Calendar, AlertTriangle, AlertCircle, Zap, ArrowRight,
} from 'lucide-react';
import {
  format, addDays, differenceInDays, subDays, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, getDaysInMonth, getDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { AffirmationCard } from './AffirmationCard';

const SERIF = "'DM Serif Display', serif";

// ── Stat Card ──
function StatCard({
  label,
  value,
  sub,
  subColor,
  t,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  t: any;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: '#FDFAF4',
        borderRadius: 14,
        padding: 16,
        border: '1px solid #E2DAD0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontFamily: SERIF,
          color: '#3A3530',
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#7A6E64', marginTop: 3, fontFamily: "'Noto Sans KR', sans-serif" }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 10, color: subColor || '#C4A882', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Habit Chip ──
function HabitChip({
  name,
  checked,
  streak,
  onClick,
  t,
}: {
  name: string;
  checked: boolean;
  streak: number;
  onClick: () => void;
  t: any;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 20,
        border: `1.5px solid ${checked ? t.accent : t.border}`,
        background: checked
          ? `linear-gradient(135deg, ${t.accent}22, ${t.accent}10)`
          : t.bg,
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {checked && <CheckCircle2 size={14} color={t.accent} />}
      <span
        style={{
          fontSize: 13,
          color: checked ? t.accent : t.text,
          fontWeight: checked ? 600 : 400,
        }}
      >
        {name}
      </span>
      {streak > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 11,
            color: '#E05C5C',
            fontWeight: 600,
          }}
        >
          <Flame size={11} />
          {streak}
        </span>
      )}
    </button>
  );
}

// ── Mini Heatmap ──
function MiniHeatmap({ habits, t }: { habits: any[]; t: any }) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const daysInM = getDaysInMonth(now);
  const startDow = getDay(monthStart);

  // count how many habits done each day
  const cells: { day: number; count: number }[] = [];
  for (let d = 1; d <= daysInM; d++) {
    const dateStr = format(new Date(now.getFullYear(), now.getMonth(), d), 'yyyy-MM-dd');
    const count = habits.filter((h) => h.checkedDates.includes(dateStr)).length;
    cells.push({ day: d, count });
  }

  const maxCount = habits.length || 1;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 6 }}>
        {format(now, 'M월', { locale: ko })} 달성 현황
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} style={{ fontSize: 8, color: t.textMuted, textAlign: 'center' }}>
            {d}
          </div>
        ))}
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {cells.map(({ day, count }) => {
          const ratio = count / maxCount;
          const isToday = day === now.getDate();
          let bg = t.bgSub;
          if (ratio > 0 && ratio < 0.5) bg = `${t.accent}40`;
          else if (ratio >= 0.5 && ratio < 1) bg = `${t.accent}80`;
          else if (ratio >= 1) bg = t.accent;

          return (
            <div
              key={day}
              title={`${day}일: ${count}/${habits.length}`}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 3,
                background: bg,
                border: isToday ? `1.5px solid ${t.accent}` : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Reminder Section (Accordion) ──
function ReminderSection({
  icon,
  title,
  items,
  emptyText,
  color,
  defaultOpen,
  t,
  onItemClick,
}: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; sub?: string }[];
  emptyText: string;
  color: string;
  defaultOpen?: boolean;
  t: any;
  onItemClick?: (idx: number) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  return (
    <div style={{ borderBottom: `1px solid ${t.borderLight}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ color }}>{icon}</div>
        <span style={{ fontSize: 13, color: t.text, fontWeight: 600, flex: 1, textAlign: 'left' }}>
          {title}
        </span>
        <span
          style={{
            fontSize: 11,
            color: items.length > 0 ? color : t.textMuted,
            fontWeight: 600,
            background: `${color}15`,
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {items.length}
        </span>
        {open ? <ChevronDown size={14} color={t.textMuted} /> : <ChevronRight size={14} color={t.textMuted} />}
      </button>
      {open && (
        <div style={{ paddingBottom: 10, paddingLeft: 28 }}>
          {items.length === 0 ? (
            <p style={{ fontSize: 12, color: t.textMuted }}>{emptyText}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onItemClick?.(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    padding: '4px 8px',
                    borderRadius: 6,
                    cursor: onItemClick ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (onItemClick) e.currentTarget.style.background = t.bgSub;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {item.sub && (
                    <span
                      style={{
                        fontSize: 11,
                        color: t.accent,
                        fontFamily: SERIF,
                        minWidth: 42,
                        flexShrink: 0,
                      }}
                    >
                      {item.sub}
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: t.text }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Project Card ──
function ProjectCard({
  project,
  todayTodoCount,
  progress,
  lastWorkDate,
  t,
  onClick,
}: {
  project: any;
  todayTodoCount: number;
  progress: number;
  lastWorkDate: string | null;
  t: any;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: t.card,
        borderRadius: 14,
        padding: '20px',
        border: `1.5px solid ${hovered ? project.color : t.border}`,
        boxShadow: hovered ? `0 4px 16px ${project.color}20` : t.shadow,
        cursor: 'pointer',
        transition: 'all 0.25s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: project.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 600, color: t.text, flex: 1 }}>
          {project.name}
        </span>
        <ArrowRight size={14} color={hovered ? project.color : t.textMuted} />
      </div>

      {project.description && (
        <p
          style={{
            fontSize: 12,
            color: t.textSub,
            marginBottom: 12,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {project.description}
        </p>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: t.textSub }}>진행률</span>
          <span
            style={{
              fontSize: 13,
              color: project.color,
              fontFamily: SERIF,
              fontWeight: 600,
            }}
          >
            {progress}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: t.borderLight,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${project.color}, ${project.color}CC)`,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: t.textMuted }}>
        <span>오늘 할일 <strong style={{ color: t.text }}>{todayTodoCount}</strong></span>
        {lastWorkDate && (
          <span>마지막 작업 <strong style={{ color: t.textSub }}>{lastWorkDate}</strong></span>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ═══ Main Dashboard ═══
// ══════════════════════════════════════════
export function DashboardView() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const {
    todos,
    events,
    habits,
    weeklyGoals,
    monthlyGoals,
    projects,
    milestones,
    toggleHabit,
    toggleWeeklyGoal,
  } = usePlanner();

  const currentWeekKey = getWeekKey(new Date());
  const currentMonth = format(new Date(), 'yyyy-MM');

  // ── Stats ──
  const todayTodos = todos.filter((t) => t.date === today);
  const todayDone = todayTodos.filter((t) => t.status === 'done').length;
  const todayActive = todayTodos.filter((t) => t.status === 'active' || t.status === 'done').length;

  // Focus time: sum doStart→doEnd for today's done items
  const focusMinutes = useMemo(() => {
    let total = 0;
    todayTodos.forEach((t) => {
      if (t.doStart && t.doEnd) {
        const [sh, sm] = t.doStart.split(':').map(Number);
        const [eh, em] = t.doEnd.split(':').map(Number);
        total += eh * 60 + em - (sh * 60 + sm);
      }
    });
    return Math.max(0, total);
  }, [todayTodos]);

  const focusHours = Math.floor(focusMinutes / 60);
  const focusMins = focusMinutes % 60;
  const focusDisplay = focusHours > 0 ? `${focusHours}h ${focusMins}m` : `${focusMins}m`;

  // Yesterday focus time for comparison
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayTodos = todos.filter((t) => t.date === yesterdayStr);
  const yesterdayFocusMinutes = useMemo(() => {
    let total = 0;
    yesterdayTodos.forEach((t) => {
      if (t.doStart && t.doEnd) {
        const [sh, sm] = t.doStart.split(':').map(Number);
        const [eh, em] = t.doEnd.split(':').map(Number);
        total += eh * 60 + em - (sh * 60 + sm);
      }
    });
    return Math.max(0, total);
  }, [yesterdayTodos]);
  const focusDiff = focusMinutes - yesterdayFocusMinutes;
  const focusSub = focusDiff > 0 ? `↑ 어제보다 ${focusDiff}분 더` : focusDiff < 0 ? `↓ 어제보다 ${Math.abs(focusDiff)}분 적음` : '어제와 동일';

  const habitsCheckedToday = habits.filter((h) => h.checkedDates.includes(today)).length;

  // Important (starred) todos
  const todayStarred = todayTodos.filter((t) => t.starred);
  const todayStarredDone = todayStarred.filter((t) => t.status === 'done').length;
  const todoSub = todayStarred.length > 0 ? `중요 할일 ${todayStarredDone}/${todayStarred.length}` : '';

  // Best habit streak
  const bestHabitStreak = useMemo(() => {
    if (habits.length === 0) return { name: '', streak: 0 };
    let best = { name: '', streak: 0 };
    habits.forEach((h) => {
      const s = (() => {
        let streak = 0;
        let d = new Date();
        if (!h.checkedDates.includes(format(d, 'yyyy-MM-dd'))) {
          d = subDays(d, 1);
        }
        while (h.checkedDates.includes(format(d, 'yyyy-MM-dd'))) {
          streak++;
          d = subDays(d, 1);
        }
        return streak;
      })();
      if (s > best.streak) best = { name: h.name, streak: s };
    });
    return best;
  }, [habits]);
  const habitSub = bestHabitStreak.streak > 0 ? `🔥 ${bestHabitStreak.name} ${bestHabitStreak.streak}일 연속` : '';

  // Monthly goal progress
  const thisMonthGoals = monthlyGoals.filter((mg) => mg.month === currentMonth);
  const thisWeekGoals = weeklyGoals.filter((wg) => wg.weekKey === currentWeekKey);
  const weeklyDone = thisWeekGoals.filter((g) => g.done).length;
  const weeklyTotal = thisWeekGoals.length;
  const weeklyPct = weeklyTotal > 0 ? Math.round((weeklyDone / weeklyTotal) * 100) : 0;

  // Overall monthly progress from linked weekly goals
  const monthlyOverallPct = useMemo(() => {
    if (thisMonthGoals.length === 0) return 0;
    let totalPcts = 0;
    thisMonthGoals.forEach((mg) => {
      const related = weeklyGoals.filter((wg) => wg.monthlyGoalId === mg.id);
      const done = related.filter((wg) => wg.done).length;
      totalPcts += related.length > 0 ? (done / related.length) * 100 : 0;
    });
    return Math.round(totalPcts / thisMonthGoals.length);
  }, [thisMonthGoals, weeklyGoals]);

  // ── Reminders ──
  const todayEvents = events.filter((e) => e.date === today).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrowEvents = events.filter((e) => e.date === tomorrow).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const dueSoonTodos = todos.filter((t) => {
    if (!t.dueDate || t.status !== 'active') return false;
    const d = differenceInDays(new Date(t.dueDate), new Date());
    return d >= 0 && d <= 3;
  });
  const overdueTodos = todos.filter((t) => {
    if (!t.dueDate || t.status !== 'active') return false;
    return differenceInDays(new Date(t.dueDate), new Date()) < 0;
  });

  // ── Habit streaks ──
  const getStreak = (checkedDates: string[]) => {
    let streak = 0;
    let d = new Date();
    // Check today first
    if (!checkedDates.includes(format(d, 'yyyy-MM-dd'))) {
      d = subDays(d, 1);
    }
    while (checkedDates.includes(format(d, 'yyyy-MM-dd'))) {
      streak++;
      d = subDays(d, 1);
    }
    return streak;
  };

  // ── Projects ──
  const activeProjects = projects.filter((p) => p.status === 'active');

  // Week dates
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDateRange = `${format(weekStart, 'M.d', { locale: ko })} – ${format(weekEnd, 'M.d', { locale: ko })}`;

  // remaining days in month
  const daysLeftInMonth = getDaysInMonth(new Date()) - new Date().getDate();

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 32px',
        background: t.bg,
      }}
    >
      {/* ── Affirmation Card ── */}
      <div style={{ marginBottom: 24 }}>
        <AffirmationCard date={today} />
      </div>

      {/* ── 4 Stat Cards ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          label="오늘 집중 시간"
          value={focusDisplay}
          sub={focusSub}
          subColor="#C4A882"
          t={t}
        />
        <StatCard
          label="할일 완료"
          value={`${todayDone}/${todayActive}`}
          sub={todoSub}
          subColor="#C4A882"
          t={t}
        />
        <StatCard
          label="오늘 습관"
          value={`${habitsCheckedToday}/${habits.length}`}
          sub={habitSub}
          subColor="#D4735A"
          t={t}
        />
        <StatCard
          label="이달 목표"
          value={`${monthlyOverallPct}%`}
          sub={weeklyTotal > 0 ? `이번주 ${weeklyDone}/${weeklyTotal} 완료` : ''}
          subColor="#C4A882"
          t={t}
        />
      </div>

      {/* ── Goals Row (2 columns) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* 이달의 목표 */}
        <div
          style={{
            background: t.card,
            borderRadius: 14,
            padding: '16px 16px',
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <TrendingUp size={15} color={t.accent} />
            <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>이달의 목표</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: t.textMuted,
              }}
            >
              D-{daysLeftInMonth}
            </span>
          </div>

          {thisMonthGoals.length === 0 ? (
            <p style={{ fontSize: 12, color: t.textMuted }}>목표가 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {thisMonthGoals.map((mg) => {
                const related = weeklyGoals.filter((wg) => wg.monthlyGoalId === mg.id);
                const relatedDone = related.filter((wg) => wg.done).length;
                const pct = related.length > 0 ? Math.round((relatedDone / related.length) * 100) : 0;

                return (
                  <div key={mg.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, color: t.text, fontWeight: 500 }}>{mg.text}</span>
                      <span style={{ fontSize: 12.5, fontFamily: SERIF, color: t.accent, fontWeight: 600 }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ height: 5, background: t.borderLight, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${t.accent}, ${t.accent}CC)`,
                          borderRadius: 3,
                          transition: 'width 0.4s',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>
                      세부 항목 {relatedDone}/{related.length}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 이번주 목표 */}
        <div
          style={{
            background: t.card,
            borderRadius: 14,
            padding: '22px 20px',
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Target size={18} color={t.accent} />
            <span style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>이번주 목표</span>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 14 }}>{weekDateRange}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: t.textSub }}>
              {weeklyDone}/{weeklyTotal} 완료
            </span>
            <span style={{ fontSize: 15, fontFamily: SERIF, color: t.accent, fontWeight: 600 }}>
              {weeklyPct}%
            </span>
          </div>

          <div style={{ height: 8, background: t.borderLight, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <div
              style={{
                width: `${weeklyPct}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${t.accent}, #6BAA7A)`,
                borderRadius: 4,
                transition: 'width 0.4s',
              }}
            />
          </div>

          {thisWeekGoals.length === 0 ? (
            <p style={{ fontSize: 13, color: t.textMuted }}>목표가 없습니다</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {thisWeekGoals.map((wg) => (
                <div
                  key={wg.id}
                  onClick={() => toggleWeeklyGoal(wg.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 8px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.bgSub)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {wg.done ? (
                    <CheckCircle2 size={16} color={t.accent} />
                  ) : (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: `2px solid ${t.border}`,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 13,
                      color: wg.done ? t.textMuted : t.text,
                      textDecoration: wg.done ? 'line-through' : 'none',
                    }}
                  >
                    {wg.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Habits & Reminders Row (2 columns) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* 오늘 습관 */}
        <div
          style={{
            background: t.card,
            borderRadius: 14,
            padding: '22px 20px',
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Zap size={18} color={t.accent} />
            <span style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>오늘 습관</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                color: t.accent,
                fontFamily: SERIF,
                fontWeight: 600,
              }}
            >
              {habitsCheckedToday}/{habits.length}
            </span>
          </div>

          {habits.length === 0 ? (
            <p style={{ fontSize: 13, color: t.textMuted }}>습관이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {habits.map((h) => {
                const checked = h.checkedDates.includes(today);
                const streak = getStreak(h.checkedDates);
                return (
                  <HabitChip
                    key={h.id}
                    name={h.name}
                    checked={checked}
                    streak={streak}
                    onClick={() => toggleHabit(h.id, today)}
                    t={t}
                  />
                );
              })}
            </div>
          )}

          {/* Mini Heatmap */}
          <MiniHeatmap habits={habits} t={t} />
        </div>

        {/* 📋 오늘 챙길 것들 */}
        <div
          style={{
            background: t.card,
            borderRadius: 14,
            padding: '22px 20px',
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>오늘 챙길 것들</span>
          </div>

          <ReminderSection
            icon={<Calendar size={14} />}
            title="오늘 일정"
            items={todayEvents.map((e) => ({
              label: e.title,
              sub: e.startTime || '',
            }))}
            emptyText="일정 없음"
            color={t.accent}
            defaultOpen={true}
            t={t}
            onItemClick={() => navigate('/daily')}
          />

          <ReminderSection
            icon={<Calendar size={14} />}
            title="내일 일정"
            items={tomorrowEvents.map((e) => ({
              label: e.title,
              sub: e.startTime || '',
            }))}
            emptyText="일정 없음"
            color={t.info}
            defaultOpen={false}
            t={t}
          />

          <ReminderSection
            icon={<AlertTriangle size={14} />}
            title="⚠️ 기한 3일 이내"
            items={dueSoonTodos.map((t) => ({
              label: t.text,
              sub: `D-${differenceInDays(new Date(t.dueDate!), new Date())}`,
            }))}
            emptyText="해당 없음"
            color="#E0A030"
            defaultOpen={true}
            t={t}
            onItemClick={() => navigate('/daily')}
          />

          <ReminderSection
            icon={<AlertCircle size={14} />}
            title="🔴 기한 초과"
            items={overdueTodos.map((t) => ({
              label: t.text,
              sub: `D+${Math.abs(differenceInDays(new Date(t.dueDate!), new Date()))}`,
            }))}
            emptyText="해당 없음"
            color={t.danger}
            defaultOpen={true}
            t={t}
            onItemClick={() => navigate('/daily')}
          />
        </div>
      </div>

      {/* ── Active Projects ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 17, color: t.text, fontWeight: 600 }}>현재 진행중인 프로젝트</span>
          <span
            style={{
              fontSize: 12,
              color: t.textMuted,
              background: t.bgSub,
              padding: '2px 10px',
              borderRadius: 10,
            }}
          >
            {activeProjects.length}
          </span>
        </div>

        {activeProjects.length === 0 ? (
          <div
            style={{
              background: t.card,
              borderRadius: 14,
              padding: 32,
              border: `1px solid ${t.border}`,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, color: t.textMuted }}>진행중인 프로젝트가 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {activeProjects.map((p) => {
              const projectTodos = todos.filter((t) => t.projectId === p.id);
              const completedCount = projectTodos.filter((t) => t.status === 'done').length;
              const totalCount = projectTodos.length;
              const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const todayProjectTodos = projectTodos.filter((t) => t.date === today && t.status === 'active').length;

              // last work date (latest done todo date)
              const doneTodos = projectTodos
                .filter((t) => t.status === 'done' && t.date)
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              const lastWork = doneTodos.length > 0 ? doneTodos[0].date : null;
              const lastWorkFormatted = lastWork
                ? format(new Date(lastWork), 'M.d', { locale: ko })
                : null;

              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  todayTodoCount={todayProjectTodos}
                  progress={progress}
                  lastWorkDate={lastWorkFormatted}
                  t={t}
                  onClick={() => navigate(`/projects/${p.id}`)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}