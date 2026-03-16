import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router';
import {
  Sun, CalendarDays, LayoutList, BarChart2, Archive,
  ChevronLeft, ChevronRight, Target, FolderKanban, Plus, Home, Lightbulb,
  Menu, Heart, Repeat, BookOpen,
} from 'lucide-react';
import { usePlanner, getWeekKey } from '../store';
import { useTheme } from '../ThemeContext';
import { format, startOfMonth, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';
import { PROJECT_COLORS } from './ProjectView';

const mainNavItems = [
  { to: '/dashboard', icon: Home, label: '대시보드' },
  { to: '/daily', icon: Sun, label: '일간' },
  { to: '/calendar', icon: CalendarDays, label: '캘린더' },
  { to: '/weekly', icon: LayoutList, label: '주간' },
  { to: '/monthly', icon: BarChart2, label: '월간' },
  { to: '/backlog', icon: Archive, label: '보관함' },
  { to: '/brainstorm', icon: Lightbulb, label: '브레인스토밍' },
];

const lifestyleNavItems = [
  { to: '/habits', icon: Repeat, label: '습관 & 루틴' },
  { to: '/selfcare', icon: Heart, label: '자기관리' },
  { to: '/reviews', icon: BookOpen, label: '리뷰 & 기록' },
];

// ── Inline new project form ──
function SidebarNewProjectForm({ onClose }: { onClose: () => void }) {
  const { addProject } = usePlanner();
  const { t } = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addProject({ name: name.trim(), color, status: 'active' });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="mx-3 mt-1 mb-2 p-3 rounded-xl space-y-2"
      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
      <div className="flex gap-1.5 flex-wrap">
        {PROJECT_COLORS.slice(0, 6).map(c => (
          <button key={c} type="button" onClick={() => setColor(c)}
            className="w-4 h-4 rounded-full flex-shrink-0 transition-transform"
            style={{
              backgroundColor: c,
              outline: color === c ? `2px solid ${c}` : 'none',
              outlineOffset: 1,
              transform: color === c ? 'scale(1.2)' : 'scale(1)',
            }} />
        ))}
      </div>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="프로젝트 이름"
        className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
        style={{ borderColor: t.border, fontSize: 12, backgroundColor: t.card, color: t.text }}
      />
      <div className="flex gap-1.5">
        <button type="submit" className="flex-1 py-1 rounded-lg"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 11, fontWeight: 600 }}>만들기</button>
        <button type="button" onClick={onClose} className="flex-1 py-1 rounded-lg"
          style={{ backgroundColor: t.card, color: t.textSub, fontSize: 11, border: `1px solid ${t.border}` }}>취소</button>
      </div>
    </form>
  );
}

// ── Mini Calendar ──
function MiniCalendar() {
  const { selectedDate, setSelectedDate, todos } = usePlanner();
  const { t } = useTheme();
  const [viewMonth, setViewMonth] = useState(new Date());

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = startOfMonth(viewMonth);
  const startDow = getDay(firstDay);
  const daysInMonth = getDaysInMonth(viewMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const hasTodos = (day: number) =>
    todos.some(t => t.date === dateStr(day) && t.status !== 'backlog' && t.status !== 'cancelled');
  const isSelected = (day: number) => dateStr(day) === selectedDate;
  const isToday = (day: number) => dateStr(day) === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="p-1 rounded-lg transition-colors"
          style={{ color: t.textSub }}>
          <ChevronLeft size={13} />
        </button>
        <span style={{ fontSize: 11, color: t.text, fontWeight: 600 }}>
          {year}년 {month + 1}월
        </span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-1 rounded-lg transition-colors"
          style={{ color: t.textSub }}>
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} style={{ fontSize: 9, color: t.textMuted, textAlign: 'center' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => (
          <div key={i} className="flex flex-col items-center">
            {day !== null ? (
              <button
                onClick={() => setSelectedDate(dateStr(day))}
                className="relative w-6 h-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  fontSize: 10,
                  backgroundColor: isSelected(day) ? t.accent : isToday(day) ? t.accentLight : 'transparent',
                  color: isSelected(day) ? '#fff' : t.text,
                  fontWeight: isToday(day) || isSelected(day) ? 700 : 400,
                }}
              >
                {day}
                {hasTodos(day) && !isSelected(day) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: t.accent }} />
                )}
              </button>
            ) : <div className="w-6 h-6" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Right Dashboard Panel ──
function RightPanel() {
  const { weeklyGoals, monthlyGoals, habits, selectedDate } = usePlanner();
  const { t } = useTheme();
  const currentWeekKey = getWeekKey(new Date());
  const currentMonth = format(new Date(), 'yyyy-MM');

  const thisWeekGoals = weeklyGoals.filter(g => g.weekKey === currentWeekKey);
  const thisMonthGoals = monthlyGoals.filter(g => g.month === currentMonth);
  const weekDone = thisWeekGoals.filter(g => g.done).length;
  const weekTotal = thisWeekGoals.length;
  const weekPct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;

  const panel = { backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, padding: 16, marginBottom: 0 };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* Weekly Goals */}
      <div style={panel}>
        <div className="flex items-center gap-2 mb-3">
          <Target size={13} color={t.accent} />
          <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            이번 주 목표
          </span>
        </div>
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: 10, color: t.textSub }}>{weekDone}/{weekTotal} 완료</span>
            <span style={{ fontSize: 11, color: t.accent, fontWeight: 700 }}>{weekPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${weekPct}%`, backgroundColor: t.accent }} />
          </div>
        </div>
        <div className="space-y-1.5">
          {thisWeekGoals.map(goal => (
            <div key={goal.id} className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: goal.done ? t.accent : t.textMuted }}>{goal.done ? '✓' : '○'}</span>
              <span style={{ fontSize: 12, color: goal.done ? t.textSub : t.text, textDecoration: goal.done ? 'line-through' : 'none' }}>
                {goal.text}
              </span>
            </div>
          ))}
          {thisWeekGoals.length === 0 && <p style={{ fontSize: 12, color: t.textMuted }}>아직 목표가 없어요</p>}
        </div>
      </div>

      {/* Monthly Goals */}
      <div style={panel}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} color={t.accent} />
          <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            이달 목표
          </span>
        </div>
        <div className="space-y-3">
          {thisMonthGoals.map(goal => {
            const subGoals = weeklyGoals.filter(g => g.monthlyGoalId === goal.id);
            const doneSub = subGoals.filter(g => g.done).length;
            const pct = subGoals.length ? Math.round((doneSub / subGoals.length) * 100) : 0;
            return (
              <div key={goal.id}>
                <div className="flex justify-between items-center mb-1">
                  <span style={{ fontSize: 12, color: t.text }}>{goal.text}</span>
                  <span style={{ fontSize: 10, color: t.accent }}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: t.accent }} />
                </div>
              </div>
            );
          })}
          {thisMonthGoals.length === 0 && <p style={{ fontSize: 12, color: t.textMuted }}>이달 목표가 없어요</p>}
        </div>
      </div>

      {/* Habit Summary */}
      <div style={panel}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            오늘 습관
          </span>
        </div>
        <div className="space-y-2">
          {habits.map(h => {
            const checked = h.checkedDates.includes(selectedDate);
            return (
              <div key={h.id} className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: checked ? t.accent : t.textMuted }}>{checked ? '✓' : '○'}</span>
                <span style={{ fontSize: 12, color: checked ? t.text : t.textSub }}>{h.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Layout ──
export function Layout() {
  const { projects } = usePlanner();
  const { t } = useTheme();
  const [showNewProject, setShowNewProject] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const location = useLocation();

  // 대시보드 메뉴 선택시 우측 패널 숨김
  const isDashboardRoute = location.pathname === '/dashboard';
  const showRightPanel = !isDashboardRoute;

  const navActiveStyle = { backgroundColor: t.accentLight, color: t.text, fontWeight: 600 };
  const navInactiveStyle = { backgroundColor: 'transparent', color: t.textSub, fontWeight: 400 };

  return (
    <div className="min-h-screen" style={{ backgroundColor: t.bg, fontFamily: t.font, transition: 'background-color 0.3s, color 0.3s' }}>

      {/* ── Desktop ── */}
      <div className="hidden lg:flex h-screen overflow-hidden">

        {/* Left Sidebar */}
        <aside
          className="flex-shrink-0 flex flex-col border-r overflow-y-auto transition-all duration-300"
          style={{ 
            width: leftSidebarOpen ? '240px' : '64px',
            borderColor: t.border, 
            backgroundColor: t.sidebar,
          }}
        >
          {/* Logo + Toggle Button */}
          <div className="px-3 pt-4 pb-3 border-b flex items-center justify-between" style={{ borderColor: t.border }}>
            {leftSidebarOpen && (
              <div className="flex-1 min-w-0">
                <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>
                  My Planner
                </h1>
                <p style={{ fontSize: 10, color: t.accent, marginTop: 2 }}>
                  ✨ 오늘도 좋은 하루 ✨
                </p>
              </div>
            )}
            <button
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="p-2 rounded-lg transition-colors hover:bg-opacity-80 flex-shrink-0"
              style={{ backgroundColor: t.accentLight, color: t.accent }}
              title={leftSidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
            >
              <Menu size={16} />
            </button>
          </div>

          {/* Main Nav */}
          <nav className="p-2 space-y-0.5 flex-shrink-0">
            {mainNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={({ isActive }) => ({
                  ...(isActive ? navActiveStyle : navInactiveStyle),
                  fontSize: 13,
                  justifyContent: leftSidebarOpen ? 'flex-start' : 'center',
                })}
                title={!leftSidebarOpen ? label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} color={isActive ? t.accent : t.textMuted} />
                    {leftSidebarOpen && <span>{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {leftSidebarOpen && (
            <>
              {/* Lifestyle Section */}
              <div className="px-2 pt-1 pb-0.5">
                <p className="px-3 py-1" style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  라이프스타일
                </p>
                <div className="space-y-0.5">
                  {lifestyleNavItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
                      style={({ isActive }) => ({
                        ...(isActive ? navActiveStyle : navInactiveStyle),
                        fontSize: 13,
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={18} color={isActive ? t.accent : t.textMuted} />
                          <span>{label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="mx-4 my-1 border-t" style={{ borderColor: t.border }} />

              {/* Projects Section */}
              <div className="flex-shrink-0 px-3 pb-2">
                <div className="flex items-center justify-between px-0 py-1.5">
                  <NavLink
                    to="/projects"
                    end
                    style={({ isActive }) => ({
                      fontSize: 10,
                      color: isActive ? t.accent : t.textSub,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase' as const,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    })}
                  >
                    <FolderKanban size={11} color={t.textMuted} />
                    프로젝트
                  </NavLink>
                  <button
                    onClick={() => setShowNewProject(v => !v)}
                    className="p-1 rounded-lg transition-colors"
                    style={{ color: t.accent }}
                    title="새 프로젝트"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {showNewProject && (
                  <SidebarNewProjectForm onClose={() => setShowNewProject(false)} />
                )}

                <div className="space-y-0.5">
                  {projects.map(project => (
                    <NavLink
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? t.accentLight : 'transparent',
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                          <span style={{
                            fontSize: 12,
                            color: isActive ? t.text : t.textSub,
                            fontWeight: isActive ? 600 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}>
                            {project.name}
                          </span>
                        </>
                      )}
                    </NavLink>
                  ))}
                  {projects.length === 0 && !showNewProject && (
                    <button
                      onClick={() => setShowNewProject(true)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg"
                      style={{ fontSize: 11, color: t.textMuted }}
                    >
                      + 프로젝트 추가
                    </button>
                  )}
                </div>
              </div>

              {/* Mini Calendar — pushed to bottom */}
              <div className="mt-auto border-t" style={{ borderColor: t.border }}>
                <MiniCalendar />
              </div>
            </>
          )}

          {!leftSidebarOpen && (
            <>
              {/* Collapsed state - lifestyle icons */}
              <div className="px-2 py-1 space-y-0.5">
                {lifestyleNavItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className="flex items-center justify-center p-3 rounded-xl transition-all"
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? t.accentLight : 'transparent',
                    })}
                    title={label}
                  >
                    {({ isActive }) => (
                      <Icon size={18} color={isActive ? t.accent : t.textMuted} />
                    )}
                  </NavLink>
                ))}
              </div>
              {/* Collapsed state - show projects icon */}
              <div className="px-2 py-2">
                <NavLink
                  to="/projects"
                  end
                  className="flex items-center justify-center p-3 rounded-xl transition-all"
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? t.accentLight : 'transparent',
                  })}
                  title="프로젝트"
                >
                  {({ isActive }) => (
                    <FolderKanban size={18} color={isActive ? t.accent : t.textMuted} />
                  )}
                </NavLink>
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: t.bg }}>
          <Outlet />
        </main>

        {/* Right Panel */}
        {showRightPanel && (
          <aside 
            className="flex-shrink-0 border-l flex flex-col transition-all duration-300" 
            style={{ 
              width: rightPanelOpen ? '288px' : '64px',
              borderColor: t.border, 
              backgroundColor: t.sidebar 
            }}
          >
            <div className="px-3 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: t.border }}>
              {rightPanelOpen && (
                <span style={{ fontSize: 10, color: t.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  대시보드
                </span>
              )}
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className="p-2 rounded-lg transition-colors hover:bg-opacity-80 flex-shrink-0"
                style={{ backgroundColor: t.accentLight, color: t.accent }}
                title={rightPanelOpen ? '대시보드 접기' : '대시보드 펼치기'}
              >
                <Menu size={16} />
              </button>
            </div>
            {rightPanelOpen && (
              <div className="flex-1 overflow-y-auto">
                <RightPanel />
              </div>
            )}
            {!rightPanelOpen && (
              <div className="flex-1 flex flex-col items-center gap-4 pt-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: t.accentLight }}>
                  <Target size={18} color={t.accent} />
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: t.accentLight }}>
                  <BarChart2 size={18} color={t.accent} />
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ backgroundColor: t.sidebar, borderColor: t.border }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>My Planner</span>
        </div>

        <main className="flex-1 overflow-y-auto pb-16" style={{ backgroundColor: t.bg }}>
          <Outlet />
        </main>

        {/* Bottom Nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 flex border-t z-50"
          style={{ backgroundColor: t.sidebar, borderColor: t.border, height: 56 }}
        >
          {[...mainNavItems, { to: '/projects', icon: FolderKanban, label: '프로젝트' }].map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/projects'}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[48px]"
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} color={isActive ? t.accent : t.textMuted} />
                  <span style={{ fontSize: 9, color: isActive ? t.accent : t.textMuted, fontWeight: isActive ? 700 : 400 }}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}