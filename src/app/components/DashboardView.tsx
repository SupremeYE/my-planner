import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../ThemeContext';
import { usePlanner, DEFAULT_AFFIRMATIONS, today, getWeekKey, Todo, Event } from '../store';
import { isEventPast } from '../../api/events';
import {
  CheckCircle2, Target, TrendingUp, ChevronDown, ChevronRight,
  Calendar, AlertTriangle, Zap, ArrowRight,
  Star,
} from 'lucide-react';
import {
  format, addDays, differenceInDays, subDays,
  startOfWeek, endOfWeek, getDaysInMonth,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { AffirmationCard } from './AffirmationCard';
import { todoDoDurationSeconds, formatTotalDoKo, formatDoElapsedKo } from '../../lib/todoDoDuration';

const SERIF = 'var(--font-gmarket)';

function isHabitApplicableOnDate(habit: any, date: Date) {
  const dow = date.getDay();
  if (habit.repeat === 'weekday') return dow >= 1 && dow <= 5;
  if (habit.repeat === 'weekend') return dow === 0 || dow === 6;
  if (habit.repeat === 'custom') return habit.repeatDays?.includes(dow) ?? false;
  return true;
}

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
        background: t.card,
        borderRadius: 14,
        padding: 16,
        border: `1px solid ${t.borderLight}`,
        boxShadow: t.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontFamily: SERIF,
          color: t.text,
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: t.textSub, marginTop: 3, fontFamily: "'Noto Sans KR', sans-serif" }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 10, color: subColor || t.accent, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function TodayHabitChip({
  icon,
  name,
  checked,
  onClick,
  t,
}: {
  icon?: string;
  name: string;
  checked: boolean;
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
        padding: '7px 12px',
        borderRadius: 20,
        border: `1.5px solid ${checked ? t.accent : t.borderLight}`,
        background: checked ? t.accentLight : t.bgSub,
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon || '🎯'}</span>
      <span
        style={{
          fontSize: 12,
          color: checked ? t.accent : t.text,
          fontWeight: checked ? 600 : 400,
        }}
      >
        {name}
      </span>
    </button>
  );
}

function WeeklyHabitMiniTracker({ habits, t }: { habits: any[]; t: any }) {
  const baseToday = new Date();
  baseToday.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(baseToday, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabels = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 1.1fr) repeat(7, minmax(0, 1fr))', gap: 4, alignItems: 'center', marginBottom: 6 }}>
        <div />
        {weekLabels.map(label => (
          <div key={label} style={{ fontSize: 9, color: t.textMuted, textAlign: 'center' }}>
            {label}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {habits.map(habit => (
          <div key={habit.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 1.1fr) repeat(7, minmax(0, 1fr))', gap: 4, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                fontSize: 11,
                color: t.textSub,
              }}
            >
              <span style={{ fontSize: 12 }}>{habit.icon || '🎯'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
            </div>
            {weekDates.map(date => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const checked = habit.checkedDates.includes(dateKey);
              const applicable = isHabitApplicableOnDate(habit, date);
              const isFuture = date.getTime() > baseToday.getTime();
              const isToday = dateKey === today;
              const isInactive = isFuture || !applicable;

              return (
                <div
                  key={`${habit.id}-${dateKey}`}
                  style={{
                    width: '100%',
                    height: 28,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: checked ? t.card : isInactive ? 'transparent' : t.bgSub,
                    border: isInactive
                      ? 'none'
                      : `${isToday ? 2 : 1}px solid ${isToday ? t.accent : t.border}`,
                    opacity: isInactive ? 0.45 : 1,
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  {checked ? habit.icon || '🎯' : ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 오늘 챙길 것들 — 통합 항목 행 (할일·일정 공용) ───
type TodayItem =
  | { kind: 'todo'; id: string; time: string | null; todo: Todo; tone?: 'normal' | 'overdue' | 'dueSoon' }
  | { kind: 'event'; id: string; time: string | null; event: Event; tone?: 'normal' | 'past' };

function TodayItemRow({
  item, t, onComplete, onJump,
}: {
  item: TodayItem;
  t: any;
  onComplete: () => void;
  onJump: () => void;
}) {
  const isTodo = item.kind === 'todo';
  const todo = isTodo ? (item as { todo: Todo }).todo : null;
  const event = !isTodo ? (item as { event: Event }).event : null;
  const title = isTodo ? todo!.text : event!.title;
  const eventColor = !isTodo ? (event!.color || t.info) : null;
  const tone = item.tone ?? 'normal';
  const badgeBg = isTodo ? `${t.success}1A` : `${t.info}1A`;
  const badgeColor = isTodo ? t.success : t.info;
  const badgeLabel = isTodo ? '할일' : '일정';

  const overdueAccent = tone === 'overdue' ? t.danger : tone === 'dueSoon' ? '#E0A030' : null;

  return (
    <div
      className="flex items-start gap-2 rounded-lg transition-colors"
      style={{
        padding: '7px 8px',
        border: `1px solid ${overdueAccent ? `${overdueAccent}40` : t.borderLight}`,
        backgroundColor: overdueAccent ? `${overdueAccent}10` : 'transparent',
      }}
    >
      {/* 완료 체크 동그라미 */}
      <button
        onClick={onComplete}
        className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all mt-0.5"
        style={{
          border: `2px solid ${overdueAccent || (isTodo ? t.success : (eventColor || t.info))}80`,
          backgroundColor: 'transparent',
        }}
        aria-label="완료"
        title="완료"
      >
        {/* 빈 상태: 호버시 강조 효과는 생략(단순화) */}
      </button>

      {/* 본문 — 클릭 시 점프 */}
      <button
        onClick={onJump}
        className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        {/* 일정 컬러닷 */}
        {!isTodo && (
          <span
            className="flex-shrink-0 rounded-full"
            style={{ width: 6, height: 6, backgroundColor: eventColor || t.info }}
          />
        )}
        {/* 시간 */}
        {item.time && (
          <span style={{ fontSize: 11, color: t.textSub, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {item.time}
          </span>
        )}
        {!item.time && !isTodo && (
          <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>종일</span>
        )}
        {/* 제목 */}
        <span
          style={{
            fontSize: 12.5,
            color: t.text,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {/* Top3 별 */}
        {isTodo && todo?.isTop3 && (
          <Star size={10} fill={t.accent} color={t.accent} style={{ flexShrink: 0 }} />
        )}
        {/* 장소 (일정) */}
        {!isTodo && event?.location && (
          <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>
            · 📍 {event.location}
          </span>
        )}
      </button>

      {/* 뱃지 */}
      <span
        className="inline-flex items-center px-1.5 rounded-full flex-shrink-0"
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: badgeColor,
          backgroundColor: badgeBg,
          border: `1px solid ${badgeColor}33`,
          height: 16,
          lineHeight: '14px',
          alignSelf: 'center',
        }}
      >
        {badgeLabel}
      </span>
    </div>
  );
}

// 섹션 헤더 (간단 라벨)
function TodaySectionLabel({ children, t }: { children: React.ReactNode; t: any }) {
  return (
    <div style={{ fontSize: 11, color: t.textSub, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6 }}>
      {children}
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
    setSelectedDate,
    toggleHabit,
    toggleWeeklyGoal,
    updateTodo,
    toggleEventCompleted,
  } = usePlanner();

  const currentWeekKey = getWeekKey(new Date());
  const currentMonth = format(new Date(), 'yyyy-MM');
  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);
  const toDateOnly = (dateString: string) => new Date(`${dateString}T00:00:00`);
  const getDateDiff = (dateString: string) => differenceInDays(toDateOnly(dateString), todayBase);

  // ── Stats ──
  const todayTodos = todos.filter((t) => t.date === today);
  const todayDone = todayTodos.filter((t) => t.status === 'done').length;
  const todayActive = todayTodos.filter((t) => t.status === 'active' || t.status === 'done').length;

  // Focus time: 타이머 실제 초(doElapsedSec) 우선, 없으면 doStart~doEnd 분 차를 초로 환산
  const focusSeconds = useMemo(() => {
    let total = 0;
    todayTodos.forEach((t) => {
      if (t.doStart && t.doEnd) total += todoDoDurationSeconds(t);
    });
    return total;
  }, [todayTodos]);

  const focusDisplay = useMemo(() => formatTotalDoKo(focusSeconds), [focusSeconds]);

  // Yesterday focus time for comparison
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayTodos = todos.filter((t) => t.date === yesterdayStr);
  const yesterdayFocusSeconds = useMemo(() => {
    let total = 0;
    yesterdayTodos.forEach((t) => {
      if (t.doStart && t.doEnd) total += todoDoDurationSeconds(t);
    });
    return total;
  }, [yesterdayTodos]);
  const focusDiffSec = focusSeconds - yesterdayFocusSeconds;
  const focusSub =
    focusDiffSec === 0
      ? '어제와 동일'
      : focusDiffSec > 0
        ? `↑ 어제보다 ${formatDoElapsedKo(focusDiffSec)} 더`
        : `↓ 어제보다 ${formatDoElapsedKo(-focusDiffSec)} 적음`;

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

  // ─────────────────────────────────────────────────────────────
  // 📋 오늘 챙길 것들 — 통합 리스트 데이터
  // ─────────────────────────────────────────────────────────────
  // 1) 시간순 통합: 오늘 미완료 할일(planStart 있음) + 오늘 미완료 일정
  const timeSortedItems = useMemo<TodayItem[]>(() => {
    const timedTodos: TodayItem[] = todos
      .filter(td =>
        td.date === today &&
        (td.status === 'active' || td.status === 'inProgress') &&
        td.planStart
      )
      .map(td => ({ kind: 'todo' as const, id: td.id, time: td.planStart!, todo: td, tone: 'normal' as const }));

    const todayEvts: TodayItem[] = events
      .filter(e => e.date === today && !e.completed)
      .map(e => ({
        kind: 'event' as const,
        id: e.id,
        time: e.isAllDay ? null : (e.startTime || null),
        event: e,
        tone: isEventPast(e) ? 'past' as const : 'normal' as const,
      }));

    return [...timedTodos, ...todayEvts].sort((a, b) => {
      // null(종일) 먼저
      if (a.time === null && b.time === null) return 0;
      if (a.time === null) return -1;
      if (b.time === null) return 1;
      return a.time.localeCompare(b.time);
    });
  }, [todos, events]);

  // 2) 오늘 할 일 (시간 미정): planStart 없음, 미완료
  const untimedTodayTodos = useMemo<TodayItem[]>(() =>
    todos
      .filter(td =>
        td.date === today &&
        (td.status === 'active' || td.status === 'inProgress') &&
        !td.planStart
      )
      .map(td => ({ kind: 'todo' as const, id: td.id, time: null, todo: td, tone: 'normal' as const })),
    [todos]
  );

  // 3) 기한 임박·초과: dueDate 있는 미완료, 초과(<오늘) 또는 0~3일 이내
  const dueOverdueItems = useMemo<TodayItem[]>(() =>
    todos
      .filter(td =>
        td.dueDate &&
        (td.status === 'active' || td.status === 'inProgress')
      )
      .filter(td => {
        const diff = getDateDiff(td.dueDate!);
        return diff < 0 || (diff >= 0 && diff <= 3);
      })
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .map(td => {
        const diff = getDateDiff(td.dueDate!);
        return {
          kind: 'todo' as const,
          id: td.id,
          time: null,
          todo: td,
          tone: (diff < 0 ? 'overdue' : 'dueSoon') as 'overdue' | 'dueSoon',
        };
      }),
    [todos, todayBase]
  );

  // 4) 내일 일정 — 기존 tomorrowEvents 그대로 사용(완료 제외)
  const tomorrowItems = useMemo<TodayItem[]>(() =>
    tomorrowEvents
      .filter(e => !e.completed)
      .map(e => ({
        kind: 'event' as const,
        id: e.id,
        time: e.isAllDay ? null : (e.startTime || null),
        event: e,
        tone: 'normal' as const,
      })),
    [tomorrowEvents]
  );

  // 진행률: 상단 StatCard '할일 완료' 와 동일 분모/분자
  const todayProgressDone = todayDone;
  const todayProgressTotal = todayActive;
  const todayProgressPct = todayProgressTotal > 0
    ? Math.round((todayProgressDone / todayProgressTotal) * 100)
    : 0;

  // 내일 일정 접이식 상태 (기본 접힘)
  const [tomorrowOpen, setTomorrowOpen] = useState(false);

  // 핸들러
  const handleTodoComplete = (todoId: string) => updateTodo(todoId, { status: 'done' });
  const handleEventComplete = (evtId: string) => toggleEventCompleted(evtId, true);
  const handleTodoJump = () => {
    setSelectedDate(today);
    navigate('/daily');
  };
  const handleEventJump = (e: Event) => {
    setSelectedDate(e.date);
    navigate('/calendar');
  };

  const todayCardEmpty =
    timeSortedItems.length === 0 &&
    untimedTodayTodos.length === 0 &&
    dueOverdueItems.length === 0;

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
      className="px-4 pt-7 pb-10 lg:px-8 lg:py-7"
      style={{
        flex: 1,
        overflowY: 'auto',
        background: t.bg,
      }}
    >
      {/* ── Affirmation Card ── */}
      <div style={{ marginBottom: 24 }}>
        <AffirmationCard date={today} />
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3.5 mb-6 lg:flex lg:flex-nowrap">
        <StatCard
          label="오늘 집중 시간"
          value={focusDisplay}
          sub={focusSub}
          subColor="#515f74"
          t={t}
        />
        <StatCard
          label="할일 완료"
          value={`${todayDone}/${todayActive}`}
          sub={todoSub}
          subColor="#515f74"
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
          subColor="#515f74"
          t={t}
        />
      </div>

      {/* ── Goals Row (2 columns) ── */}
      <div className="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-2">
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
                background: `linear-gradient(90deg, ${t.accent}, #006b62)`,
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
      <div className="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-2">
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
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {habits.map((h) => {
                  const checked = h.checkedDates.includes(today);
                  return (
                    <TodayHabitChip
                      key={h.id}
                      icon={h.icon}
                      name={h.name}
                      checked={checked}
                      onClick={() => toggleHabit(h.id, today)}
                      t={t}
                    />
                  );
                })}
              </div>
              <div style={{ height: 1, backgroundColor: t.borderLight, margin: '12px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: t.textMuted }}>이번 주 현황</span>
              </div>
              <WeeklyHabitMiniTracker habits={habits} t={t} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => navigate('/habits')}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.accent,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  습관 관리 →
                </button>
              </div>
            </>
          )}
        </div>

        {/* 📋 오늘 챙길 것들 — 실제 오늘 할일+일정 연결 */}
        <div
          style={{
            background: t.card,
            borderRadius: 14,
            padding: '22px 20px',
            border: `1px solid ${t.border}`,
            boxShadow: t.shadow,
          }}
        >
          {/* 헤더 + 진행률 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>오늘 챙길 것들</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                color: t.accent,
                fontFamily: SERIF,
                fontWeight: 600,
              }}
            >
              할일 {todayProgressDone}/{todayProgressTotal} 완료
            </span>
          </div>
          {/* 진행률 바 */}
          <div style={{ height: 4, background: t.borderLight, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
            <div
              style={{
                width: `${todayProgressPct}%`,
                height: '100%',
                background: t.success,
                transition: 'width 0.4s',
              }}
            />
          </div>

          {/* 빈 상태 (오늘 섹션 1~3 모두 비었을 때) */}
          {todayCardEmpty && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28 }}>✨</div>
              <p style={{ fontSize: 13, color: t.textMuted, marginTop: 6, fontWeight: 600 }}>
                오늘은 다 챙겼어요
              </p>
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
                일정·할일이 모두 정리됐어요
              </p>
            </div>
          )}

          {/* 1) 시간순 통합 */}
          {timeSortedItems.length > 0 && (
            <section style={{ marginBottom: 14 }}>
              <TodaySectionLabel t={t}>시간순</TodaySectionLabel>
              <div className="space-y-1">
                {timeSortedItems.map(item => (
                  <TodayItemRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    t={t}
                    onComplete={() =>
                      item.kind === 'todo'
                        ? handleTodoComplete(item.id)
                        : handleEventComplete(item.id)
                    }
                    onJump={() =>
                      item.kind === 'todo'
                        ? handleTodoJump()
                        : handleEventJump(item.event)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* 2) 오늘 할 일 (시간 미정) */}
          {untimedTodayTodos.length > 0 && (
            <section style={{ marginBottom: 14 }}>
              <TodaySectionLabel t={t}>오늘 할 일 (시간 미정)</TodaySectionLabel>
              <div className="space-y-1">
                {untimedTodayTodos.map(item => (
                  <TodayItemRow
                    key={`u-${item.id}`}
                    item={item}
                    t={t}
                    onComplete={() => handleTodoComplete(item.id)}
                    onJump={handleTodoJump}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 3) 기한 임박·초과 */}
          {dueOverdueItems.length > 0 && (
            <section style={{ marginBottom: 14 }}>
              <TodaySectionLabel t={t}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} color={t.danger} />
                  기한 임박·초과
                </span>
              </TodaySectionLabel>
              <div className="space-y-1">
                {dueOverdueItems.map(item => (
                  <TodayItemRow
                    key={`d-${item.id}`}
                    item={item}
                    t={t}
                    onComplete={() => handleTodoComplete(item.id)}
                    onJump={handleTodoJump}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 4) 내일 일정 — 접이식 (기본 접힘) */}
          <div style={{ borderTop: `1px solid ${t.borderLight}`, paddingTop: 10, marginTop: 4 }}>
            <button
              onClick={() => setTomorrowOpen(o => !o)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Calendar size={13} color={t.info} />
              <span style={{ fontSize: 12, color: t.text, fontWeight: 600, flex: 1, textAlign: 'left' }}>
                내일 일정
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: tomorrowItems.length > 0 ? t.info : t.textMuted,
                  fontWeight: 700,
                  background: `${t.info}15`,
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                {tomorrowItems.length}
              </span>
              {tomorrowOpen ? <ChevronDown size={13} color={t.textMuted} /> : <ChevronRight size={13} color={t.textMuted} />}
            </button>
            {tomorrowOpen && (
              <div style={{ paddingTop: 6 }}>
                {tomorrowItems.length === 0 ? (
                  <p style={{ fontSize: 11, color: t.textMuted, padding: '6px 2px' }}>내일 일정이 없어요</p>
                ) : (
                  <div className="space-y-1">
                    {tomorrowItems.map(item => (
                      <TodayItemRow
                        key={`tm-${item.id}`}
                        item={item}
                        t={t}
                        onComplete={() => handleEventComplete(item.id)}
                        onJump={() => handleEventJump((item as { event: Event }).event)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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