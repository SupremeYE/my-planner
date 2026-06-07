import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import {
  Sun, CalendarDays, BarChart2, ListTodo,
  ChevronLeft, ChevronRight, Target, FolderKanban, Plus, Home,
  Menu, Heart, Repeat, BookOpen, Library, Settings, BarChart3,
  Smile, Utensils, Camera, NotebookPen, Clapperboard, ChefHat, Music,
  Sparkles,
  User, LogOut, Mail,
} from 'lucide-react';
import { usePlanner, getWeekKey } from '../store';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { format, startOfMonth, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';
import { PROJECT_COLORS } from './ProjectView';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { HaonLogo } from './HaonLogo';
import { AccountWidget } from './AccountWidget';

// 디자인 토큰(hex)에 투명도를 입혀 rgba 로 변환 — 글래스 배경을 토큰 기반으로 생성
// (색상값을 새로 하드코딩하지 않고 t.card 등 기존 토큰의 알파 변형만 만든다)
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── User Avatar with Dropdown (계정 정보 + 프로필/설정/로그아웃) ──
function UserAvatarMenu() {
  const { t } = useTheme();
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 220 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // 드롭다운 위치 계산 — 아바타 우측에 정렬하되 화면(좌/우/하단) 밖으로 잘리지 않게 클램프
  // PC: 사이드바 아바타 아래, 모바일: 상단바 아바타 아래 (둘 다 뷰포트 안에 안전하게)
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const width = Math.min(220, window.innerWidth - margin * 2);
      // 아바타 우측 끝에 메뉴 우측을 맞춤 → 좌측으로 펼침
      let left = rect.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      const top = rect.bottom + 6;
      setMenuPos({ top, left, width });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  const email = session?.user?.email || '';
  const name = (session?.user?.user_metadata as any)?.name || email.split('@')[0] || '게스트';
  const initial = name.charAt(0).toUpperCase();

  const size = 30;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="rounded-full transition-transform hover:scale-105 flex items-center justify-center"
        style={{
          width: size, height: size,
          background: 'linear-gradient(135deg, #FFD89A 0%, #F4A582 55%, #A8C8E8 100%)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          boxShadow: '0 1px 3px rgba(244,165,130,0.35)',
        }}
        title={name}
      >
        {initial}
      </button>
      {open && (
        <div
          className="fixed rounded-xl py-1.5 z-50"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: t.border }}>
            <p style={{ fontSize: 12, color: t.text, fontWeight: 700, wordBreak: 'break-all' }}>{name}</p>
            {email && <p style={{ fontSize: 10, color: t.textMuted, marginTop: 2, wordBreak: 'break-all' }}>{email}</p>}
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/profile'); }}
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-opacity-80 transition-colors"
            style={{ fontSize: 12, color: t.text }}
          >
            <User size={14} color={t.textMuted} /> 프로필
          </button>
          <button
            onClick={() => { setOpen(false); setAccountOpen(true); }}
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-opacity-80 transition-colors"
            style={{ fontSize: 12, color: t.text }}
          >
            <Mail size={14} color={t.textMuted} /> 계정 설정
          </button>
          <button
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-opacity-80 transition-colors"
            style={{ fontSize: 12, color: t.text }}
          >
            <Settings size={14} color={t.textMuted} /> 설정
          </button>
          <div className="border-t my-1" style={{ borderColor: t.border }} />
          <button
            onClick={async () => { setOpen(false); await signOut(); }}
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-opacity-80 transition-colors"
            style={{ fontSize: 12, color: t.text }}
          >
            <LogOut size={14} color={t.textMuted} /> 로그아웃
          </button>
        </div>
      )}
      <AccountWidget open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}

const mainNavItems = [
  { to: '/dashboard', icon: Home, label: '대시보드' },
  { to: '/daily', icon: Sun, label: '일간' },
  { to: '/calendar', icon: CalendarDays, label: '캘린더' },
  { to: '/todos', icon: ListTodo, label: '할일' },
  { to: '/goals', icon: BarChart2, label: '목표관리' },
];

const lifestyleNavItems = [
  { to: '/habits', icon: Repeat, label: '습관 & 루틴' },
  { to: '/health', icon: Heart, label: '건강' },
  { to: '/time-report', icon: BarChart3, label: '시간 리포트' },
  { to: '/mood', icon: Smile, label: '감정 기록' },
  { to: '/reviews', icon: BookOpen, label: '리뷰 & 기록' },
  { to: '/food', icon: Utensils, label: '식단' },
  { to: '/books', icon: Library, label: '독서' },
  { to: '/moments', icon: Camera, label: '모먼트' },
  { to: '/culture', icon: Clapperboard, label: '문화 기록' },
  { to: '/music', icon: Music, label: '음악 기록' },
  { to: '/recipes', icon: ChefHat, label: '레시피' },
  { to: '/vision', icon: Sparkles, label: '비전보드' },
  { to: '/question-journal', icon: NotebookPen, label: '질문일기' },
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

// ── Mobile Menu Overlay ──
function MobileMenuOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTheme();
  const location = useLocation();
  const [isIn, setIsIn] = useState(false);
  const [pressedItem, setPressedItem] = useState<string | null>(null);

  // 마운트 직후 슬라이드-업 트리거
  useEffect(() => {
    const id = requestAnimationFrame(() => setIsIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setIsIn(false);
    setTimeout(onClose, 300);
  };

  const allItems = [
    ...mainNavItems,
    { to: '/projects', icon: FolderKanban, label: '프로젝트' },
    { to: '/habits', icon: Repeat, label: '습관&루틴' },
    { to: '/health', icon: Heart, label: '건강' },
    { to: '/time-report', icon: BarChart3, label: '시간 리포트' },
    { to: '/mood', icon: Smile, label: '감정 기록' },
    { to: '/reviews', icon: BookOpen, label: '기록' },
    { to: '/food', icon: Utensils, label: '식단' },
    { to: '/books', icon: Library, label: '독서' },
    { to: '/moments', icon: Camera, label: '모먼트' },
    { to: '/culture', icon: Clapperboard, label: '문화 기록' },
    { to: '/music', icon: Music, label: '음악 기록' },
    { to: '/recipes', icon: ChefHat, label: '레시피' },
    { to: '/vision', icon: Sparkles, label: '비전보드' },
    { to: '/question-journal', icon: NotebookPen, label: '질문일기' },
  ];

  return (
    <>
      {/* 배경 딤 */}
      <div
        className="fixed inset-0 z-50"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: isIn ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
        onClick={handleClose}
      />

      {/* 글래스 패널 — 하단 네비 바로 위에 떠 있는 알약형 */}
      <div
        className="fixed z-50"
        style={{
          left: 12, right: 12,
          bottom: `calc(80px + env(safe-area-inset-bottom))`,
          borderRadius: 28,
          backgroundColor: withAlpha(t.card, 0.82),
          backdropFilter: 'blur(32px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.55)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 24px 56px rgba(0,0,0,0.22)',
          transform: isIn ? 'translateY(0)' : 'translateY(calc(100% + 100px))',
          transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-8 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>

        {/* 섹션 레이블 */}
        <p className="px-5 pb-3" style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          메뉴
        </p>

        {/* 원형 메뉴 그리드 */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-4 px-4 pb-5">
          {allItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to || (to !== '/projects' && location.pathname.startsWith(to + '/'));
            const isPressed = pressedItem === to;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={handleClose}
                onTouchStart={() => setPressedItem(to)}
                onTouchEnd={() => setTimeout(() => setPressedItem(null), 180)}
                onMouseDown={() => setPressedItem(to)}
                onMouseUp={() => setTimeout(() => setPressedItem(null), 180)}
                className="flex flex-col items-center gap-1.5"
              >
                {/* 원형 아이콘 버튼 */}
                <div
                  style={{
                    width: 52, height: 52,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    backgroundColor: isActive
                      ? t.accentLight
                      : isPressed
                        ? t.bgSub
                        : withAlpha(t.bg, 0.75),
                    border: isActive
                      ? `1.5px solid ${t.accent}`
                      : `1px solid ${t.border}`,
                    transform: isPressed ? 'scale(0.84)' : 'scale(1)',
                    transition: 'transform 0.12s ease, background-color 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: isActive
                      ? `0 4px 14px ${withAlpha(t.accent, 0.3)}`
                      : '0 2px 8px rgba(0,0,0,0.07)',
                  }}
                >
                  <Icon size={20} color={isActive ? t.accent : t.textMuted} />
                </div>
                {/* 레이블 */}
                <span style={{
                  fontSize: 10,
                  color: isActive ? t.accent : t.textSub,
                  fontWeight: isActive ? 700 : 400,
                  textAlign: 'center' as const,
                  lineHeight: 1.3,
                }}>
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Main Layout ──
export function Layout() {
  const { projects } = usePlanner();
  const { t } = useTheme();
  const [showNewProject, setShowNewProject] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const desktopMainRef = useRef<HTMLElement>(null);
  const mobileMainRef = useRef<HTMLElement>(null);

  // 라우트 변경 시 메인 스크롤을 최상단으로 리셋
  // (이전 페이지 스크롤이 유지되어 새 페이지 제목/sticky 헤더가 가려지는 버그 방지)
  useEffect(() => {
    desktopMainRef.current?.scrollTo({ top: 0, left: 0 });
    mobileMainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

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
          {/* Logo + Avatar + Toggle Button */}
          <div className="px-3 pt-4 pb-3 border-b" style={{ borderColor: t.border }}>
            {leftSidebarOpen ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <HaonLogo height={36} showSubtitle />
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <UserAvatarMenu />
                  <button
                    onClick={() => setLeftSidebarOpen(false)}
                    className="p-2 rounded-lg transition-colors hover:bg-opacity-80"
                    style={{ backgroundColor: t.accentLight, color: t.accent }}
                    title="사이드바 접기"
                  >
                    <Menu size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <UserAvatarMenu />
                <button
                  onClick={() => setLeftSidebarOpen(true)}
                  className="p-2 rounded-lg transition-colors hover:bg-opacity-80"
                  style={{ backgroundColor: t.accentLight, color: t.accent }}
                  title="사이드바 펼치기"
                >
                  <Menu size={16} />
                </button>
              </div>
            )}
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
                    <Icon size={18} color={isActive ? t.text : t.textMuted} />
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
                          <Icon size={18} color={isActive ? t.text : t.textMuted} />
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
                      color: isActive ? t.text : t.textSub,
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

              {/* Mini Calendar — pushed to bottom (설정은 상단 아바타 메뉴로 이동) */}
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
                      <Icon size={18} color={isActive ? t.text : t.textMuted} />
                    )}
                  </NavLink>
                ))}
              </div>
              {/* Collapsed state - show projects icon (설정은 상단 아바타 메뉴로 이동) */}
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
                    <FolderKanban size={18} color={isActive ? t.text : t.textMuted} />
                  )}
                </NavLink>
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main ref={desktopMainRef} className="flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: t.bg }}>
          <NotificationPermissionBanner />
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
      <div className="lg:hidden flex flex-col h-[100dvh]">
        {/* Mobile top bar — PWA standalone 시 노치/상태바 영역 회피 (safe-area-inset-top) */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 sticky top-0 z-30"
          style={{ backgroundColor: t.sidebar, borderColor: t.border, paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <HaonLogo height={28} />
          <div className="flex items-center gap-2">
            <UserAvatarMenu />
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl transition-colors"
              style={{ backgroundColor: t.accentLight, color: t.accent }}
            >
              <Menu size={16} />
            </button>
          </div>
        </div>

        <main ref={mobileMainRef} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain" style={{ backgroundColor: t.bg, paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
          <NotificationPermissionBanner />
          <Outlet />
        </main>

        {/* Bottom Nav — 바닥에서 떠 있는 반투명 유리 알약 (5 fixed tabs) */}
        <nav
          className="fixed left-4 right-4 flex z-40 overflow-hidden"
          style={{
            // 홈 인디케이터 위로 띄우기 (좌우 left-4/right-4 여백 + 하단 safe-area)
            bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
            minHeight: 56,
            borderRadius: 30,                                  // 알약 형태
            backgroundColor: withAlpha(t.card, 0.55),          // 카드 토큰 + 투명도 → 유리 배경
            backdropFilter: 'blur(24px) saturate(1.7)',        // 강한 블러 + 채도 보정
            WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
            border: '1px solid rgba(255,255,255,0.5)',         // 위쪽 밝은 하이라이트 테두리
            // 위쪽 inset 하이라이트 + 아래쪽 부드러운 그림자(떠 있는 느낌)
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 30px rgba(0,0,0,0.16)',
          }}
        >
          {[
            { to: '/dashboard', icon: Home, label: '대시보드' },
            { to: '/daily', icon: Sun, label: '일간' },
            { to: '/calendar', icon: CalendarDays, label: '캘린더' },
            { to: '/todos', icon: ListTodo, label: '할일' },
            { to: '/habits', icon: Repeat, label: '습관&루틴' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            >
              {({ isActive }) => (
                <>
                  <div
                    className="flex items-center justify-center rounded-full transition-all"
                    style={{
                      // 활성 탭: 아이콘 뒤 옅은 알약형 하이라이트 (코랄 계열 토큰)
                      backgroundColor: isActive ? t.accentLight : 'transparent',
                      padding: '4px 14px',
                    }}
                  >
                    <Icon size={18} color={isActive ? t.accent : t.textMuted} />
                  </div>
                  <span style={{ fontSize: 9, color: isActive ? t.accent : t.textMuted, fontWeight: isActive ? 700 : 400 }}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && <MobileMenuOverlay onClose={() => setMobileMenuOpen(false)} />}
      </div>
    </div>
  );
}