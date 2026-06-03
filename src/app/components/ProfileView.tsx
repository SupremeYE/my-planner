import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { usePlanner } from '../store';
import {
  Flame, Trophy, Star, Calendar, Clock, CheckSquare, Heart, Zap,
  Edit2, Check, X,
} from 'lucide-react';

// ── XP 레벨 곡선 ──
const LEVEL_XP = [0, 300, 800, 1600, 2800, 4500, 6800, 9800, 13500, 18000, 24000];

// 레벨별 캐릭터(이모지) — Lv0~10
const LEVEL_EMOJIS = ['🌑', '😴', '🌱', '🌸', '🌟', '🌈', '🦋', '🌙', '⭐', '🌺', '👑'];

const levelTitles = [
  '잠에서 깨는 중', '첫 걸음', '새싹', '꽃망울', '빛나는',
  '무지개', '나비', '달빛', '별빛', '꽃피움', '전설의 하온',
];

function getLevelFromXP(xp: number): number {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return i;
  }
  return 0;
}

function getLevelProgress(xp: number): { current: number; needed: number; pct: number } {
  const lv = getLevelFromXP(xp);
  if (lv >= 10) return { current: xp - LEVEL_XP[10], needed: 0, pct: 100 };
  const current = xp - LEVEL_XP[lv];
  const needed = LEVEL_XP[lv + 1] - LEVEL_XP[lv];
  return { current, needed, pct: Math.round((current / needed) * 100) };
}

// ── Activity Heatmap (GitHub 잔디) ──
const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function ActivityHeatmap({ activityData }: { activityData: Record<string, number> }) {
  const { t } = useTheme();

  const today = new Date();
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 1);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // 일요일 시작

  const days: { date: string; count: number }[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const key = cur.toISOString().split('T')[0];
    days.push({ date: key, count: activityData[key] ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  // 주 단위로 그루핑
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // 월 레이블 위치
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const d = new Date(week[0].date);
    if (d.getMonth() !== lastMonth) {
      monthLabels.push({ label: MONTHS_KR[d.getMonth()], col: wi });
      lastMonth = d.getMonth();
    }
  });

  const getColor = (count: number) => {
    if (count === 0) return t.bgSub;
    if (count <= 2) return '#FFD89A';
    if (count <= 5) return '#F4A582';
    if (count <= 10) return '#E07C5A';
    return '#C85E3A';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* 월 레이블 */}
      <div style={{ display: 'flex', marginLeft: 24, marginBottom: 4, position: 'relative', height: 14 }}>
        {monthLabels.map(({ label, col }) => (
          <div
            key={label + col}
            style={{
              position: 'absolute',
              left: col * 14,
              fontSize: 10,
              color: t.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* 요일 레이블 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, flexShrink: 0 }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} style={{ height: 12, fontSize: 9, color: i % 2 === 0 ? t.textMuted : 'transparent', lineHeight: '12px' }}>
              {d}
            </div>
          ))}
        </div>

        {/* 잔디 셀 */}
        <div style={{ display: 'flex', gap: 2 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {week.map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count}개 활동`}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: getColor(day.count),
                    cursor: day.count > 0 ? 'pointer' : 'default',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => { if (day.count > 0) (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 10, color: t.textMuted }}>적음</span>
        {[0, 2, 5, 10, 15].map(v => (
          <div key={v} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: getColor(v) }} />
        ))}
        <span style={{ fontSize: 10, color: t.textMuted }}>많음</span>
      </div>
    </div>
  );
}

// ── Level Gallery ──
function LevelGallery({ currentLevel }: { currentLevel: number }) {
  const { t } = useTheme();
  const [hovered, setHovered] = useState<number | null>(null);

  const levels = Array.from({ length: 11 }, (_, i) => i);

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0' }}>
      {levels.map(lv => {
        const unlocked = lv <= currentLevel;
        const isCurrent = lv === currentLevel;
        return (
          <div
            key={lv}
            onMouseEnter={() => setHovered(lv)}
            onMouseLeave={() => setHovered(null)}
            style={{
              flexShrink: 0,
              width: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              transition: 'transform 0.2s',
              transform: hovered === lv ? 'scale(1.08)' : 'scale(1)',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
                border: isCurrent ? `2px solid ${t.accent}` : `1.5px solid ${t.border}`,
                backgroundColor: t.bgSub,
                boxShadow: isCurrent ? `0 0 0 3px ${t.accentLight}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  filter: unlocked ? 'none' : (hovered === lv ? 'grayscale(1) brightness(0.6)' : 'grayscale(1) brightness(0.35)'),
                  opacity: unlocked ? 1 : 0.7,
                  transition: 'filter 0.2s, opacity 0.2s',
                }}
              >
                {LEVEL_EMOJIS[lv]}
              </div>
              {!unlocked && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    fontSize: 12,
                    opacity: hovered === lv ? 0 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  🔒
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                color: isCurrent ? t.accent : unlocked ? t.textSub : t.textMuted,
                fontWeight: isCurrent ? 700 : 400,
              }}
            >
              Lv.{lv}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Hall of Fame Badges ──
const MILESTONE_BADGES = [
  { id: 'todo_100', icon: '📋', label: '할일 100개 완료', threshold: 100, category: 'todo' },
  { id: 'todo_500', icon: '📋', label: '할일 500개 완료', threshold: 500, category: 'todo' },
  { id: 'todo_1000', icon: '📋', label: '할일 1000개 완료', threshold: 1000, category: 'todo' },
  { id: 'habit_100', icon: '🔄', label: '습관 100회 체크', threshold: 100, category: 'habit' },
  { id: 'habit_500', icon: '🔄', label: '습관 500회 체크', threshold: 500, category: 'habit' },
  { id: 'streak_7', icon: '🔥', label: '7일 연속 스트릭', threshold: 7, category: 'streak' },
  { id: 'streak_30', icon: '🔥', label: '30일 연속 스트릭', threshold: 30, category: 'streak' },
  { id: 'streak_100', icon: '🔥', label: '100일 연속 스트릭', threshold: 100, category: 'streak' },
  { id: 'focus_600', icon: '⏰', label: '집중 시간 10시간', threshold: 600, category: 'focus' },
  { id: 'focus_6000', icon: '⏰', label: '집중 시간 100시간', threshold: 6000, category: 'focus' },
  { id: 'year_1', icon: '🎂', label: '하온 1주년', threshold: 365, category: 'anniversary' },
];

// ── 날짜 유틸 ──
function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ── Main ProfileView ──
export function ProfileView() {
  const { t } = useTheme();
  const { session } = useAuth();
  const { todos, habits } = usePlanner();

  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [editNameVal, setEditNameVal] = useState('');
  const [charHovered, setCharHovered] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const email = session?.user?.email ?? '';
  const metaName = (session?.user?.user_metadata as any)?.name || email.split('@')[0] || '하온 유저';
  const joinedAt = session?.user?.created_at ? new Date(session.user.created_at) : new Date('2025-01-01');

  useEffect(() => {
    setDisplayName(metaName);
    setEditNameVal(metaName);
  }, [metaName]);

  const today = new Date();
  const daysSinceJoin = daysBetween(joinedAt, today) + 1;

  // 통계 계산
  const completedTodos = todos.filter(td => td.status === 'done').length;
  const totalHabitChecks = habits.reduce((sum, h) => sum + h.checkedDates.length, 0);

  // 집중 시간(분) — 완료된 할일의 타이머 경과 시간 합산
  const focusMinutes = Math.round(
    todos.reduce((sum, td) => sum + (td.doElapsedSec ?? 0), 0) / 60
  );
  const focusHours = Math.floor(focusMinutes / 60);
  const focusRemainMin = focusMinutes % 60;
  const focusDisplay = focusHours > 0 ? `${focusHours}시간 ${focusRemainMin}분` : `${focusMinutes}분`;

  // 스트릭 계산
  const allDates = new Set<string>();
  todos.filter(td => td.status === 'done' && td.date)
    .forEach(td => allDates.add(td.date!));
  habits.forEach(h => h.checkedDates.forEach(d => allDates.add(d)));

  const sortedDates = Array.from(allDates).sort().reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  const todayStr = today.toISOString().split('T')[0];

  for (const ds of sortedDates) {
    const d = new Date(ds);
    if (!prevDate) {
      if (ds === todayStr || daysBetween(d, today) === 1) {
        tempStreak = 1;
      } else break;
    } else {
      if (daysBetween(prevDate, d) === 1) {
        tempStreak++;
      } else break;
    }
    prevDate = d;
  }
  currentStreak = tempStreak;

  // 최장 스트릭 계산
  let streak = 0;
  let prevD2: Date | null = null;
  for (const ds of [...sortedDates].reverse()) {
    const d = new Date(ds);
    if (!prevD2) { streak = 1; }
    else if (daysBetween(prevD2, d) === 1) { streak++; }
    else { streak = 1; }
    if (streak > longestStreak) longestStreak = streak;
    prevD2 = d;
  }

  // 사용 일수
  const usageDays = allDates.size;

  // XP 계산
  const totalXP = completedTodos * 10 + totalHabitChecks * 5 + Math.min(currentStreak * 3, 60) + Math.floor(focusMinutes / 10);
  const level = getLevelFromXP(totalXP);
  const { current: xpCurrent, needed: xpNeeded, pct: xpPct } = getLevelProgress(totalXP);

  // 활동 히트맵 데이터
  const activityData: Record<string, number> = {};
  todos.filter(td => td.status === 'done' && td.date).forEach(td => {
    const k = td.date!;
    activityData[k] = (activityData[k] ?? 0) + 1;
  });
  habits.forEach(h => {
    h.checkedDates.forEach(d => {
      activityData[d] = (activityData[d] ?? 0) + 1;
    });
  });

  // 명예의 전당 배지
  const earnedBadges = MILESTONE_BADGES.filter(b => {
    if (b.category === 'todo') return completedTodos >= b.threshold;
    if (b.category === 'habit') return totalHabitChecks >= b.threshold;
    if (b.category === 'streak') return longestStreak >= b.threshold;
    if (b.category === 'focus') return focusMinutes >= b.threshold;
    if (b.category === 'anniversary') return daysSinceJoin >= b.threshold;
    return false;
  });

  const handleSaveName = () => {
    if (editNameVal.trim()) setDisplayName(editNameVal.trim());
    setIsEditingName(false);
  };

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  const card = {
    backgroundColor: t.card,
    borderRadius: 20,
    padding: '20px 24px',
    border: `1px solid ${t.border}`,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: t.bg,
        overflowY: 'auto',
        fontFamily: t.font,
      }}
    >
      {/* ── 헤더 배너 ── */}
      <div
        style={{
          height: 140,
          background: 'linear-gradient(135deg, #FFD89A 0%, #F4A582 50%, #A8C8E8 100%)',
          position: 'relative',
          flexShrink: 0,
        }}
      />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── 아이덴티티 영역 ── */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          {/* 아바타 */}
          <div
            style={{
              position: 'absolute',
              top: -40,
              left: 0,
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFD89A 0%, #F4A582 55%, #A8C8E8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
              color: '#fff',
              border: `3px solid ${t.card}`,
              boxShadow: '0 4px 12px rgba(244,165,130,0.35)',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div style={{ paddingTop: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    ref={nameInputRef}
                    value={editNameVal}
                    onChange={e => setEditNameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                    style={{
                      fontSize: 22,
                      fontFamily: t.font,
                      fontWeight: 700,
                      color: t.text,
                      background: t.bgSub,
                      border: `1.5px solid ${t.accent}`,
                      borderRadius: 8,
                      padding: '2px 10px',
                      outline: 'none',
                      width: 180,
                    }}
                  />
                  <button onClick={handleSaveName} style={{ padding: 6, borderRadius: 8, background: t.accentLight, color: t.accent, border: 'none', cursor: 'pointer' }}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => setIsEditingName(false)} style={{ padding: 6, borderRadius: 8, background: t.bgSub, color: t.textMuted, border: 'none', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 22, fontWeight: 700, color: t.text }}>
                    {displayName}
                  </span>
                  <button
                    onClick={() => { setEditNameVal(displayName); setIsEditingName(true); }}
                    style={{ padding: 4, borderRadius: 6, background: 'transparent', color: t.textMuted, border: 'none', cursor: 'pointer' }}
                    title="이름 수정"
                  >
                    <Edit2 size={14} />
                  </button>
                </>
              )}

              {/* 레벨 뱃지 */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: 'linear-gradient(90deg, #FFD89A, #F4A582)',
                  color: '#fff',
                  letterSpacing: '0.03em',
                }}
              >
                Lv.{level}
              </span>
            </div>

            <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>
              {levelTitles[level]} · {email}
            </p>

            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
              가입일 {formatDate(joinedAt)} · {daysSinceJoin}일째 하온과 함께 🌱
            </p>
          </div>
        </div>

        {/* ── 캐릭터 디스플레이 ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 현재 레벨 캐릭터 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                onMouseEnter={() => setCharHovered(true)}
                onMouseLeave={() => setCharHovered(false)}
                style={{
                  width: 160,
                  height: 160,
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 90,
                  background: 'radial-gradient(circle at 50% 40%, #FFF4D6 0%, #FFD89A 45%, #F4A582 100%)',
                  animation: 'haon-float 3s ease-in-out infinite',
                  transform: charHovered ? 'scale(1.04) rotate(-2deg)' : 'scale(1)',
                  transition: 'transform 0.3s ease',
                  filter: charHovered ? 'drop-shadow(0 8px 16px rgba(244,165,130,0.5))' : 'drop-shadow(0 4px 8px rgba(244,165,130,0.25))',
                }}
              >
                {LEVEL_EMOJIS[level]}
                {charHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(255,216,154,0.3) 0%, transparent 70%)',
                      animation: 'haon-glow 1s ease-in-out infinite alternate',
                    }}
                  />
                )}
              </div>

              {/* XP 바 */}
              <div style={{ width: 160 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: t.accent, fontWeight: 700 }}>Lv.{level}</span>
                  {level < 10 && (
                    <span style={{ fontSize: 10, color: t.textMuted }}>
                      {xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                    </span>
                  )}
                  {level >= 10 && (
                    <span style={{ fontSize: 10, color: '#E07C5A', fontWeight: 700 }}>MAX ✨</span>
                  )}
                </div>
                <div style={{ height: 6, borderRadius: 3, backgroundColor: t.bgSub, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      background: 'linear-gradient(90deg, #FFD89A, #F4A582)',
                      width: `${xpPct}%`,
                      transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  />
                </div>
                <p style={{ fontSize: 10, color: t.textMuted, marginTop: 4, textAlign: 'center' }}>
                  총 {totalXP.toLocaleString()} XP
                </p>
              </div>
            </div>

            {/* 레벨 갤러리 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, color: t.textSub, fontWeight: 700, marginBottom: 10 }}>
                캐릭터 갤러리
              </p>
              <LevelGallery currentLevel={level} />
              <p style={{ fontSize: 10, color: t.textMuted, marginTop: 8 }}>
                레벨업하면 새 캐릭터가 해금돼요 ✨
              </p>
            </div>
          </div>
        </div>

        {/* ── 활동 통계 ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: t.accent, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} /> 활동 통계
          </p>

          {/* 카운터 카드들 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { icon: <CheckSquare size={18} color="#F4A582" />, value: completedTodos.toLocaleString(), label: '할일 완료', unit: '개' },
              { icon: <Heart size={18} color="#F4A582" />, value: totalHabitChecks.toLocaleString(), label: '습관 체크', unit: '회' },
              { icon: <Clock size={18} color="#A8C8E8" />, value: focusDisplay, label: '집중 시간', unit: '' },
            ].map(({ icon, value, label, unit }) => (
              <div
                key={label}
                style={{
                  backgroundColor: t.bgSub,
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {icon}
                <div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: t.text }}>
                    {value}
                  </span>
                  {unit && <span style={{ fontSize: 11, color: t.textSub, marginLeft: 2 }}>{unit}</span>}
                </div>
                <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* 스트릭 + 사용 기간 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { icon: <Flame size={18} color="#F4A582" />, value: currentStreak, label: '현재 스트릭', unit: '일' },
              { icon: <Flame size={18} color="#E07C5A" />, value: longestStreak, label: '최장 스트릭', unit: '일' },
              { icon: <Calendar size={18} color="#A8C8E8" />, value: usageDays, label: '사용 일수', unit: '일' },
            ].map(({ icon, value, label, unit }) => (
              <div
                key={label}
                style={{
                  backgroundColor: t.bgSub,
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {icon}
                <div>
                  <span style={{ fontSize: 22, fontWeight: 700, color: t.text }}>
                    {value.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: t.textSub, marginLeft: 2 }}>{unit}</span>
                </div>
                <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* 히트맵 */}
          <div>
            <p style={{ fontSize: 12, color: t.textSub, fontWeight: 700, marginBottom: 10 }}>
              1년 활동 기록
            </p>
            <ActivityHeatmap activityData={activityData} />
          </div>
        </div>

        {/* ── 명예의 전당 ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: t.accent, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={14} /> 명예의 전당
          </p>
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>
            마일스톤을 달성하면 특별 배지가 해금돼요
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {MILESTONE_BADGES.map(badge => {
              const earned = earnedBadges.some(b => b.id === badge.id);
              return (
                <div
                  key={badge.id}
                  title={badge.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '14px 10px',
                    borderRadius: 14,
                    backgroundColor: earned ? t.accentLight : t.bgSub,
                    border: earned ? `1.5px solid ${t.accent}` : `1.5px solid ${t.border}`,
                    opacity: earned ? 1 : 0.5,
                    transition: 'all 0.2s',
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontSize: 28, filter: earned ? 'none' : 'grayscale(1)' }}>{badge.icon}</span>
                  <span style={{ fontSize: 10, color: earned ? t.text : t.textMuted, textAlign: 'center', lineHeight: 1.4 }}>
                    {badge.label}
                  </span>
                  {earned && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Star size={10} color={t.accent} fill={t.accent} />
                      <span style={{ fontSize: 9, color: t.accent, fontWeight: 700 }}>획득</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 플로팅 + 글로우 애니메이션 */}
      <style>{`
        @keyframes haon-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes haon-glow {
          from { opacity: 0.4; transform: scale(0.95); }
          to { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
