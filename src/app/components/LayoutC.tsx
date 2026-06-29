import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import {
  Sun, CalendarDays, BarChart2, FolderKanban, ListTodo,
  ChevronLeft, ChevronRight, Calendar, Plus, Target, CheckCircle2,
  ChevronDown, X, Home, Menu, Settings, Clapperboard, ChefHat, Sparkles, Bookmark, MapPin, Footprints,
  Flower2, SprayCan, Wallet,
} from 'lucide-react';
import { usePlanner, getWeekKey, getLogicalToday } from '../store';
import { countInboxActive } from '../../lib/inbox';
import { useTheme } from '../ThemeContext';
import {
  format, startOfMonth, getDaysInMonth, getDay,
  addMonths, subMonths,
} from 'date-fns';
import { PROJECT_COLORS } from './ProjectView';
import { HaonLogo } from './HaonLogo';
import { FloatingAddFab } from './FloatingAddFab';

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home,         label: '대시보드' },
  { to: '/daily',     icon: Sun,          label: '일간' },
  { to: '/calendar',  icon: CalendarDays, label: '캘린더' },
  { to: '/todos',     icon: ListTodo,     label: '할일' },
  { to: '/goals',     icon: BarChart2,    label: '목표관리' },
  { to: '/money',     icon: Wallet,       label: '머니' },
  { to: '/culture',   icon: Clapperboard, label: '문화 기록' },
  { to: '/recipes',   icon: ChefHat,      label: '레시피' },
  { to: '/places',    icon: MapPin,       label: '가고싶은 곳' },
  { to: '/walk',      icon: Footprints,   label: '산책' },
  { to: '/beauty-care', icon: Flower2,    label: '뷰티' },
  { to: '/housekeeping', icon: SprayCan,  label: '살림' },
  { to: '/vision',    icon: Sparkles,     label: '비전보드' },
  { to: '/scraps',    icon: Bookmark,     label: '스크랩' },
  { to: '/projects',  icon: FolderKanban, label: '프로젝트' },
];

// ── Mini Calendar Dropdown ──
function CalendarDropdown() {
  const { selectedDate, setSelectedDate, todos } = usePlanner();
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = startOfMonth(viewMonth);
  const startDow = getDay(firstDay);
  const daysInMonth = getDaysInMonth(viewMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const hasTodo = (d: number) =>
    todos.some(td => td.date === dateStr(d) && td.status !== 'backlog' && td.status !== 'cancelled');
  const isSelected = (d: number) => dateStr(d) === selectedDate;
  const isToday = (d: number) => dateStr(d) === getLogicalToday();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
        style={{
          backgroundColor: open ? t.accentLight : t.bgSub,
          color: open ? t.accent : t.textSub,
          border: `1px solid ${open ? t.accent : t.border}`,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Calendar size={13} />
        <span>{format(new Date(selectedDate), 'M/d')}</span>
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl p-3 z-50"
          style={{
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            width: 240,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1 rounded-lg" style={{ color: t.textSub }}>
              <ChevronLeft size={13} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
              {year}년 {month + 1}월
            </span>
            <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1 rounded-lg" style={{ color: t.textSub }}>
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
              <div key={i} className="flex justify-center">
                {day !== null ? (
                  <button
                    onClick={() => { setSelectedDate(dateStr(day)); setOpen(false); }}
                    className="relative w-7 h-7 rounded-full flex items-center justify-center transition-all"
                    style={{
                      fontSize: 11,
                      backgroundColor: isSelected(day) ? t.accent : isToday(day) ? t.accentLight : 'transparent',
                      color: isSelected(day) ? '#fff' : t.text,
                      fontWeight: isToday(day) || isSelected(day) ? 700 : 400,
                    }}
                  >
                    {day}
                    {hasTodo(day) && !isSelected(day) && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ backgroundColor: t.accent }} />
                    )}
                  </button>
                ) : <div className="w-7 h-7" />}
              </div>
            ))}
          </div>
          <button
            onClick={() => { setSelectedDate(getLogicalToday()); setOpen(false); }}
            className="mt-2 w-full py-1.5 rounded-lg text-center"
            style={{ fontSize: 11, backgroundColor: t.bgSub, color: t.accent, fontWeight: 700 }}
          >
            오늘로 이동
          </button>
        </div>
      )}
    </div>
  );
}

// ── Right Dashboard Panel ──
function DashboardPanel() {
  const { weeklyGoals, monthlyGoals, habits, selectedDate, todos, projects } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();

  const currentWeekKey = getWeekKey(new Date());
  const currentMonth = format(new Date(), 'yyyy-MM');

  const thisWeekGoals = weeklyGoals.filter(g => g.weekKey === currentWeekKey);
  const thisMonthGoals = monthlyGoals.filter(g => g.month === currentMonth);
  const weekDone = thisWeekGoals.filter(g => g.done).length;
  const weekPct = thisWeekGoals.length ? Math.round((weekDone / thisWeekGoals.length) * 100) : 0;

  const section = (title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span style={{ fontSize: 10, color: t.accent, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-5 py-5 space-y-3"
      style={{ backgroundColor: t.bgSub, borderLeft: `1px solid ${t.border}` }}>

      {/* This week goals */}
      {section('이번 주 목표', <Target size={12} color={t.accent} />,
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 h-1.5 rounded-full mr-3" style={{ backgroundColor: t.borderLight }}>
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${weekPct}%`, backgroundColor: t.accent }} />
            </div>
            <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, flexShrink: 0 }}>{weekPct}%</span>
          </div>
          <div className="space-y-1.5">
            {thisWeekGoals.slice(0, 5).map(goal => (
              <div key={goal.id} className="flex items-start gap-2">
                <CheckCircle2 size={13} color={goal.done ? t.accent : t.border}
                  fill={goal.done ? t.accent : 'none'} className="mt-0.5 flex-shrink-0" />
                <span style={{
                  fontSize: 12, color: goal.done ? t.textSub : t.text,
                  textDecoration: goal.done ? 'line-through' : 'none', lineHeight: 1.4,
                }}>{goal.text}</span>
              </div>
            ))}
            {thisWeekGoals.length === 0 && <p style={{ fontSize: 12, color: t.textMuted }}>목표를 추가해보세요</p>}
            {thisWeekGoals.length > 5 && (
              <p style={{ fontSize: 11, color: t.textMuted }}>+{thisWeekGoals.length - 5}개 더</p>
            )}
          </div>
        </>
      )}

      {/* Monthly goals */}
      {section('이달 목표', <BarChart2 size={12} color={t.accent} />,
        <div className="space-y-3">
          {thisMonthGoals.map(goal => {
            const sub = weeklyGoals.filter(g => g.monthlyGoalId === goal.id);
            const done = sub.filter(g => g.done).length;
            const pct = sub.length ? Math.round((done / sub.length) * 100) : 0;
            return (
              <div key={goal.id}>
                <div className="flex justify-between mb-1">
                  <span style={{ fontSize: 12, color: t.text, flex: 1, marginRight: 8 }}>{goal.text}</span>
                  <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, flexShrink: 0 }}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.borderLight }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: t.accent }} />
                </div>
              </div>
            );
          })}
          {thisMonthGoals.length === 0 && <p style={{ fontSize: 12, color: t.textMuted }}>이달 목표 없음</p>}
        </div>
      )}

      {/* Habits today */}
      {section('오늘 습관', <span style={{ fontSize: 12 }}>🌱</span>,
        <div className="space-y-1.5">
          {habits.map(h => {
            const done = h.checkedDates.includes(selectedDate);
            return (
              <div key={h.id} className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: done ? t.accent : t.border }}>{done ? '✓' : '○'}</span>
                <span style={{ fontSize: 12, color: done ? t.text : t.textSub }}>{h.name}</span>
                {done && <span className="ml-auto text-xs" style={{ color: t.accent }}>✔</span>}
              </div>
            );
          })}
          {habits.length === 0 && <p style={{ fontSize: 12, color: t.textMuted }}>습관 없음</p>}
        </div>
      )}

      {/* Projects */}
      {section('프로젝트', <FolderKanban size={12} color={t.accent} />,
        <div className="space-y-2">
          {projects.map(proj => {
            const projTodos = todos.filter(td => td.projectId === proj.id);
            const done = projTodos.filter(td => td.status === 'done').length;
            const pct = projTodos.length ? Math.round((done / projTodos.length) * 100) : 0;
            return (
              <button
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="w-full text-left rounded-xl p-3 transition-all group"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.text, flex: 1 }}>{proj.name}</span>
                  <span style={{ fontSize: 10, color: t.textMuted }}>{projTodos.length}개</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.card }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: proj.color }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span style={{ fontSize: 10, color: t.textMuted }}>{done}/{projTodos.length} 완료</span>
                  <span style={{ fontSize: 10, color: proj.color, fontWeight: 600 }}>{pct}%</span>
                </div>
              </button>
            );
          })}
          {projects.length === 0 && <p style={{ fontSize: 12, color: t.textMuted }}>프로젝트 없음</p>}
          <button
            onClick={() => navigate('/projects')}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
            style={{ color: t.accent, fontSize: 12, fontWeight: 600 }}
          >
            <Plus size={12} /> 프로젝트 관리
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Project Modal ──
function NewProjectModal({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>새 프로젝트</h3>
          <button onClick={onClose}><X size={16} color={t.textMuted} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="프로젝트 이름"
            className="w-full rounded-xl px-3 py-2.5 border outline-none"
            style={{ borderColor: t.border, fontSize: 14, backgroundColor: t.bgSub, color: t.text }}
          />
          <div>
            <label style={{ fontSize: 11, color: t.textSub, display: 'block', marginBottom: 8 }}>색상</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl"
              style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14 }}>취소</button>
            <button type="submit" className="flex-1 py-2 rounded-xl"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 700 }}>만들기</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Layout C: Top Nav + 2-Column ──
export function LayoutC() {
  const { t } = useTheme();
  const { todos } = usePlanner();
  const inboxCount = countInboxActive(todos);
  const [showNewProject, setShowNewProject] = useState(false);

  // 전역 컨텍스트 FAB — 모든 페이지에서 항상 1개(각 페이지가 등록한 주 추가 액션 수행)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: t.bg, fontFamily: t.font }}>

      {/* ─── Top Navigation Bar ─── */}
      <header
        className="flex-shrink-0 flex items-center gap-0"
        style={{
          backgroundColor: t.sidebar,
          borderBottom: `1px solid ${t.border}`,
          height: 52,
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 flex-shrink-0" style={{ borderRight: `1px solid ${t.border}`, height: '100%' }}>
          <HaonLogo height={26} />
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center flex-1 px-2 h-full overflow-x-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/projects'}
              className="flex items-center gap-1.5 px-3.5 h-full relative transition-colors flex-shrink-0"
              style={({ isActive }) => ({
                color: isActive ? t.text : t.textSub,
                fontWeight: isActive ? 700 : 400,
                fontSize: 13,
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={14} color={isActive ? t.accent : 'currentColor'} />
                  {label}
                  {to === '/todos' && inboxCount > 0 && (
                    <span
                      className="flex items-center justify-center rounded-full"
                      style={{
                        minWidth: 16, height: 16, padding: '0 4px',
                        fontSize: 9, fontWeight: 700, color: '#fff', backgroundColor: t.accent,
                      }}
                    >
                      {inboxCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                      style={{ backgroundColor: t.accent }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2 px-4 flex-shrink-0" style={{ borderLeft: `1px solid ${t.border}`, height: '100%' }}>
          <CalendarDropdown />
          <NavLink
            to="/settings"
            className="p-2 rounded-lg transition-colors"
            style={({ isActive }) => ({
              backgroundColor: isActive ? t.accentLight : 'transparent',
              color: isActive ? t.accent : t.textMuted,
            })}
            title="설정"
          >
            <Settings size={15} />
          </NavLink>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: t.accent, color: '#fff', fontSize: 11, fontWeight: 700 }}
          >
            <Plus size={12} /> 프로젝트
          </button>
        </div>
      </header>

      {/* ─── Main 2-column layout ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: main view (60%) */}
        <main className="overflow-hidden flex flex-col" style={{ flex: '0 0 60%', minWidth: 0 }}>
          <Outlet />
          <FloatingAddFab />
        </main>

        {/* Right: dashboard (40%) */}
        <aside className="flex-1 overflow-hidden flex flex-col" style={{ minWidth: 320 }}>
          <div className="flex-shrink-0 flex items-center px-5 py-3"
            style={{ borderBottom: `1px solid ${t.border}`, backgroundColor: t.card }}>
            <span style={{ fontSize: 10, color: t.textSub, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              DASHBOARD
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <DashboardPanel />
          </div>
        </aside>
      </div>

      {/* Mobile fallback */}
      <div className="lg:hidden fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ backgroundColor: 'rgba(247,244,239,0.98)' }}>
        <div className="text-center space-y-3">
          <div className="text-4xl">🖥️</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>C 레이아웃은 데스크탑 전용입니다</p>
          <p style={{ fontSize: 13, color: t.textSub }}>A 또는 B 레이아웃을 사용해주세요</p>
        </div>
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}