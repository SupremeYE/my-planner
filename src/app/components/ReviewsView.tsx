import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Search, ChevronLeft, ChevronRight, ChevronDown, Trash2, Clock, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePlanner, MonthlyReview, WeightRecord, HappyMoment, getWeekKey, getLogicalToday } from '../store';
import { db } from '../../lib/db';
import { TrackTimeStrip } from './review/TrackTimeStrip';
import { MemoryPieces } from './review/MemoryPieces';
import { computeWeightDelta } from './review/reviewMetrics';
import { useTheme } from '../ThemeContext';
import { LabelRow } from './VoiceInputButton';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { supabase } from '../../lib/supabase';
import { getCategoryEmoji, getMoodCategoryLabel, ENERGY_LABELS } from './MoodView';
import { inputBg, mixHex, retroStatusColor, withAlpha, periodStepperStyle } from '../styles/haonStyles';
import { RetroSheet } from './RetroSheet';
import {
  format, addDays, subDays, parseISO,
  startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth,
  addMonths, subMonths,
  startOfISOWeek, endOfISOWeek, setISOWeek, setISOWeekYear,
} from 'date-fns';
import { ko } from 'date-fns/locale';

const RECORD_TYPES = [
  { key: 'gratitude', emoji: '🙏', label: '감사 일기' },
  { key: 'kpt', emoji: '🔄', label: 'KPT 회고' },
  { key: 'happiness', emoji: '✨', label: '행복 기록' },
  { key: 'daily', emoji: '📔', label: '데일리 리뷰' },
];


// ─── mood_records 타입(읽기 전용) ───
interface MoodRow {
  id: string;
  date: string;
  emotion_tags: string[];
  energy_level: number;
  created_at: string;
}

// ─── 컨디션 배지 (mood_records 읽기 전용, 단일 진실 공급원) ───
function ConditionBadge({ date }: { date: string }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [moods, setMoods] = useState<MoodRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mood_records')
      .select('id,date,emotion_tags,energy_level,created_at')
      .eq('date', date)
      .order('created_at', { ascending: false });
    setMoods((data as MoodRow[]) ?? []);
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync('mood_records', load);

  const latest = moods[0] ?? null;

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between mb-2">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>오늘의 컨디션</h3>
        <button onClick={() => navigate('/mood')}
          className="flex items-center gap-0.5"
          style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>
          기분 기록하러 <ChevronRight size={13} />
        </button>
      </div>
      {latest ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: 26 }}>{getCategoryEmoji(latest.emotion_tags)}</span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {getMoodCategoryLabel(latest.emotion_tags) && (
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  {getMoodCategoryLabel(latest.emotion_tags)}
                </span>
              )}
              {latest.emotion_tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full"
                  style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent, fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
            <span style={{ fontSize: 11, color: t.textMuted }}>에너지 · {ENERGY_LABELS[latest.energy_level]}</span>
          </div>
          {moods.length > 1 && (
            <span className="ml-auto" style={{ fontSize: 10, color: t.textMuted }}>외 {moods.length - 1}건</span>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: t.textMuted }}>아직 기분 기록 없음</p>
      )}
    </div>
  );
}

// ─── 일간 탭 ───
type JumpReq = { date: string; nonce: number } | null;

function DayTab({ jump }: { jump?: JumpReq }) {
  const { reviewRecords, happyMoments } = usePlanner();
  const { t } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const todayStr = getLogicalToday();
  const [dayDate, setDayDate] = useState(todayStr);

  // 돌아보기 카드 점프 → 해당 날짜로
  useEffect(() => { if (jump) setDayDate(jump.date); }, [jump?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayRecord = reviewRecords.find(r => r.date === dayDate);

  const [retroOpen, setRetroOpen] = useState(false);

  const goPrev = () => setDayDate(format(subDays(parseISO(dayDate), 1), 'yyyy-MM-dd'));
  const goNext = () => setDayDate(format(addDays(parseISO(dayDate), 1), 'yyyy-MM-dd'));

  // 회고 요약(그날 review_records + happy_moments). 상태 표현은 일간 '오늘 기록' 카드와 동일 방식.
  const gList = (dayRecord?.gratitude ?? []).filter(Boolean);
  const hList = happyMoments.filter(m => m.date === dayDate);
  const hasKpt = !!(dayRecord?.kptKeep || dayRecord?.kptProblem || dayRecord?.kptTry);
  const summaryParts: string[] = [];
  if (gList.length) summaryParts.push(`감사 ${gList.length}개`);
  if (hList.length) summaryParts.push(`좋았던 순간 ${hList.length}개`);
  if (hasKpt) summaryParts.push('KPT 작성됨');
  const retroEmpty = summaryParts.length === 0;
  const kptText = (label: string, val?: string) => val ? (
    <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
      <span style={{ fontWeight: 600 }}>{label}</span> · {val}
    </div>
  ) : null;

  // 회고 카드 — 읽기는 카드에서, 편집은 시트에서(탭 → RetroSheet). 입력 두 벌 중복 제거.
  const writeCol = (
    <div className="space-y-4">
      {/* 컨디션 배지 — 회고와 별개(건강 링크). 유지. */}
      <ConditionBadge date={dayDate} />

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <button type="button" onClick={() => setRetroOpen(true)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
          <span style={{ fontSize: 18, lineHeight: 1 }}>🙏</span>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>회고</div>
            <div style={{ fontSize: 11, color: retroEmpty ? t.textMuted : t.textSub, fontWeight: retroEmpty ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {retroEmpty ? '아직 기록 없음 · 탭해서 오늘 회고를 남겨보세요' : summaryParts.join(' · ')}
            </div>
          </div>
          <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, flexShrink: 0 }}>{retroEmpty ? '작성 ›' : '편집 ›'}</span>
        </button>

        {!retroEmpty && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${t.borderLight}`, paddingTop: 12 }}>
            {gList.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 5 }}>🙏 감사</div>
                <ol className="space-y-1">
                  {gList.map((g, i) => (
                    <li key={i} style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>
                      <span style={{ color: t.accent, fontWeight: 600, marginRight: 6 }}>{i + 1}.</span>{g}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {hList.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 5 }}>✨ 좋았던 순간</div>
                <ul className="space-y-1">
                  {hList.map(m => (
                    <li key={m.id} style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>✨ {m.content}</li>
                  ))}
                </ul>
              </div>
            )}
            {hasKpt && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 5 }}>🔄 KPT</div>
                <div className="space-y-1">
                  {kptText('Keep', dayRecord?.kptKeep)}
                  {kptText('Problem', dayRecord?.kptProblem)}
                  {kptText('Try', dayRecord?.kptTry)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const dateNav = (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={goPrev} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}` }}>
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setDayDate(todayStr)}
        style={{ fontSize: 15, fontWeight: 700, color: t.text, minWidth: 160, textAlign: 'center' }}>
        {format(parseISO(dayDate), 'M월 d일 EEEE', { locale: ko })}
        {dayDate !== todayStr && <span style={{ fontSize: 11, color: t.accent, marginLeft: 6 }}>오늘로</span>}
      </button>
      <button onClick={goNext} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}` }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  return (
    <div>
      {dateNav}
      {retroOpen && <RetroSheet date={dayDate} onClose={() => setRetroOpen(false)} />}
      {/* '지난 기록'(PastTimeline) 제거 — 돌아보기 화면과 완전 중복이라 상단 '돌아보기' 버튼으로 충분.
          인라인 회고 제거 후 카드 2개(컨디션·회고)만 남아, 전폭으로 늘이면 비어 보이므로
          데스크톱에선 읽기 좋은 폭으로 중앙 정렬한다(무게중심 안정). */}
      <div className="mx-auto" style={{ maxWidth: isDesktop ? 560 : undefined }}>
        {writeCol}
      </div>
    </div>
  );
}

// ─── 주간 탭 ───────────────────────────────────────────────────────────────

// weekKey(YYYY-Www, ISO주) → 그 주의 월~일 범위
function weekKeyToRange(weekKey: string) {
  const [y, w] = weekKey.split('-W').map(Number);
  let d = new Date(y, 0, 4); // 1월 4일은 항상 ISO 1주차
  d = setISOWeekYear(d, y);
  d = setISOWeek(d, w);
  const start = startOfISOWeek(d);
  const end = endOfISOWeek(d);
  return { start, end, startStr: format(start, 'yyyy-MM-dd'), endStr: format(end, 'yyyy-MM-dd') };
}

// 그 주가 속한 달에서 몇 번째 주인지(달력 주차)
function weekOfMonth(weekStart: Date, weekStartsOn: 0 | 1): number {
  const firstWeekStart = startOfWeek(startOfMonth(weekStart), { weekStartsOn });
  return Math.round((startOfWeek(weekStart, { weekStartsOn }).getTime() - firstWeekStart.getTime()) / (7 * 86400000)) + 1;
}

// 작은 통계 카드(값 + 단위 + 라벨(서브 인라인) + 얇은 막대) — 목업 .stat
function StatCard({ value, unit, label, sub, pct, barColor }: {
  value: string; unit?: string; label: string; sub?: string; pct: number; barColor: string;
}) {
  const { t } = useTheme();
  return (
    <div className="rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: '13px 14px' }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: t.fontStat, lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400, marginLeft: 1 }}>{unit}</span>}
      </span>
      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>{label}{sub ? ` · ${sub}` : ''}</div>
      <div className="rounded-full overflow-hidden" style={{ height: 5, backgroundColor: t.surfaceMuted, marginTop: 8 }}>
        <div className="rounded-full" style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: barColor, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

// 자동집계 한 셀(큰 숫자 + 단위 + 라벨) — 월간 "숫자로 보는 한 달" 6셀 그리드용
function MiniCell({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const { t } = useTheme();
  return (
    <div className="rounded-xl flex flex-col" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: '12px 10px' }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: t.text, fontFamily: t.fontStat, lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, marginLeft: 1 }}>{unit}</span>}
      </span>
      <span style={{ fontSize: 10.5, color: t.textMuted, marginTop: 6 }}>{label}</span>
    </div>
  );
}

function WeekTab({ jump }: { jump?: JumpReq }) {
  const {
    todos, habits, projects,
    weeklyGoals, monthlyGoals, toggleWeeklyGoal,
    weeklyReviews, addWeeklyReview, updateWeeklyReview,
    appSettings,
  } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const weekStartsOn = (appSettings.weekStartsOn ?? 1) as 0 | 1;

  // ── 주 범위 단일 계산 — 아래 모든 통계/회고/과거 조회가 공유 ──
  const [anchor, setAnchor] = useState(() => parseISO(getLogicalToday()));
  // 돌아보기 카드 점프 → 해당 주로
  useEffect(() => { if (jump) setAnchor(parseISO(jump.date)); }, [jump?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const range = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn });
    const end = endOfWeek(anchor, { weekStartsOn });
    const thu = addDays(start, weekStartsOn === 0 ? 4 : 3); // ISO 주차 판정 기준(목요일)
    return {
      start, end, thu,
      startStr: format(start, 'yyyy-MM-dd'),
      endStr: format(end, 'yyyy-MM-dd'),
      weekKey: getWeekKey(thu),
    };
  }, [anchor, weekStartsOn]);

  const currentWeekKey = useMemo(() => {
    const start = startOfWeek(parseISO(getLogicalToday()), { weekStartsOn });
    return getWeekKey(addDays(start, weekStartsOn === 0 ? 4 : 3));
  }, [weekStartsOn]);
  const isCurrentWeek = range.weekKey === currentWeekKey;

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(range.start, i), 'yyyy-MM-dd')),
    [range.startStr],
  );

  // ── ① 이번 주 목표 (weekly_goals, 여기서 체크·부모 월간칩·연결 할일 진행) ──
  const weekGoals = useMemo(
    () => weeklyGoals.filter(g => g.weekKey === range.weekKey),
    [weeklyGoals, range.weekKey],
  );
  const goalsDone = weekGoals.filter(g => g.done).length;
  const goalTodoProgress = useCallback((goalId: string) => {
    const linked = todos.filter(td => td.weeklyGoalId === goalId && !td.id.includes('__'));
    if (!linked.length) return null;
    return { done: linked.filter(td => td.status === 'done').length, total: linked.length };
  }, [todos]);

  // ── 작은 통계 2종 (선택 주 범위 기준) ──
  const weekTodos = todos.filter(td => td.date && td.date >= range.startStr && td.date <= range.endStr);
  const doneTodos = weekTodos.filter(td => td.status === 'done');
  const completionPct = weekTodos.length ? Math.round((doneTodos.length / weekTodos.length) * 100) : 0;

  // 습관 달성일 — 그 주 7일 중 습관을 하나라도 체크한 날 수 (목업: n/7)
  const habitDays = habits.length ? weekDays.filter(d => habits.some(h => h.checkedDates.includes(d))).length : 0;
  const habitPct = Math.round((habitDays / 7) * 100);

  // ── ③ 몸무게 소스(전역 store 밖)는 여기서 1회 fetch 후 주 범위로 필터 ──
  // (조각의 culture/music/walk 는 MemoryPieces 가 자체 fetch 하므로 여기선 몸무게만.)
  const [wkWeights, setWkWeights] = useState<WeightRecord[]>([]);
  useEffect(() => {
    let alive = true;
    db.weightRecords.fetchAll()
      .then(weights => { if (alive) setWkWeights(weights); })
      .catch(() => { /* 빈 상태 유지 */ });
    return () => { alive = false; };
  }, []);

  // ③ 몸무게 변화 — 공용 헬퍼(동일 slot 비교, DESIGN §7.4). 주간·월간 동일 로직.
  const weekWeight = useMemo(
    () => computeWeightDelta(wkWeights, range.startStr, range.endStr),
    [wkWeights, range.startStr, range.endStr],
  );

  // ── 회고 입력 (Stage 1 필드로 실제 저장) ──
  const weeklyReview = weeklyReviews.find(r => r.weekKey === range.weekKey);
  const [wrGood, setWrGood] = useState('');
  const [wrHard, setWrHard] = useState('');
  const [wrNext, setWrNext] = useState('');
  const [wrKptKeep, setWrKptKeep] = useState('');
  const [wrKptProblem, setWrKptProblem] = useState('');
  const [wrKptTry, setWrKptTry] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setWrGood(weeklyReview?.good || '');
    setWrHard(weeklyReview?.hard || '');
    setWrNext(weeklyReview?.nextWeek || '');
    setWrKptKeep(weeklyReview?.kptKeep || '');
    setWrKptProblem(weeklyReview?.kptProblem || '');
    setWrKptTry(weeklyReview?.kptTry || '');
  }, [weeklyReview?.id, range.weekKey]);

  const save = () => {
    const payload = {
      weekKey: range.weekKey,
      good: wrGood, hard: wrHard, nextWeek: wrNext,
      kptKeep: wrKptKeep, kptProblem: wrKptProblem, kptTry: wrKptTry,
    };
    if (weeklyReview) updateWeeklyReview(weeklyReview.id, payload);
    else addWeeklyReview(payload);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  // ── 과거 주간 리뷰(월별 그룹 + 작년 비교) ──
  const weekCompletion = useCallback((startStr: string, endStr: string): number | null => {
    const ws = todos.filter(td => td.date && td.date >= startStr && td.date <= endStr);
    if (!ws.length) return null;
    return Math.round((ws.filter(td => td.status === 'done').length / ws.length) * 100);
  }, [todos]);

  const lastYearKey = useMemo(() => {
    const [y, w] = range.weekKey.split('-W');
    return `${Number(y) - 1}-W${w}`;
  }, [range.weekKey]);
  const lastYearReview = weeklyReviews.find(r => r.weekKey === lastYearKey);

  const hasText = (r: { good?: string; hard?: string; nextWeek?: string; kptKeep?: string; kptProblem?: string; kptTry?: string }) =>
    !!(r.good || r.hard || r.nextWeek || r.kptKeep || r.kptProblem || r.kptTry);

  const pastGroups = useMemo(() => {
    const items = weeklyReviews
      .filter(r => r.weekKey !== range.weekKey && hasText(r))
      .map(r => {
        const rg = weekKeyToRange(r.weekKey);
        return { review: r, ...rg, monthKey: format(addDays(rg.start, 3), 'yyyy-MM') };
      })
      .sort((a, b) => b.review.weekKey.localeCompare(a.review.weekKey));
    const groups: { monthKey: string; rows: typeof items }[] = [];
    for (const it of items) {
      let g = groups.find(x => x.monthKey === it.monthKey);
      if (!g) { g = { monthKey: it.monthKey, rows: [] }; groups.push(g); }
      g.rows.push(it);
    }
    return groups;
  }, [weeklyReviews, range.weekKey]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (mk: string, idx: number) => expanded[mk] ?? idx === 0; // 최신 그룹 기본 펼침
  const toggleGroup = (mk: string, idx: number) =>
    setExpanded(prev => ({ ...prev, [mk]: !(prev[mk] ?? idx === 0) }));

  const inputStyle = {
    borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13,
    fontFamily: t.fontBody,
  };

  // 과거 주간 카드 1개 렌더 (작년 비교 카드/일반 카드 공용)
  const renderPastItem = (
    row: { review: typeof weeklyReviews[number]; start: Date; end: Date; startStr: string; endStr: string },
    anniversary = false,
  ) => {
    const womN = weekOfMonth(row.start, weekStartsOn);
    const comp = weekCompletion(row.startStr, row.endStr);
    const preview = [row.review.good, row.review.hard, row.review.nextWeek].filter(Boolean).join(' · ');
    return (
      <button key={row.review.id} onClick={() => setAnchor(row.start)}
        className="w-full text-left p-3 rounded-xl transition-colors"
        style={{
          backgroundColor: anniversary ? t.accentLight : t.card,
          border: `1px solid ${anniversary ? t.accent : t.borderLight}`,
        }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {anniversary && <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>🕰 작년 같은 주차</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{format(row.start, 'M')}월 {womN}주차</span>
          <span style={{ fontSize: 11, color: t.textMuted }}>{format(row.start, 'M.d')}–{format(row.end, 'M.d')}</span>
          {comp != null && (
            <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.surfaceMuted, color: t.textSub }}>완료 {comp}%</span>
          )}
        </div>
        {preview && (
          <p style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
        )}
      </button>
    );
  };

  const womNum = weekOfMonth(range.start, weekStartsOn);
  const navLabel = `${format(range.thu, 'M')}월 ${womNum}주차 · ${format(range.start, 'M.d')}–${format(range.end, 'M.d')}`;

  const weekNav = (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={() => setAnchor(a => subWeeks(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}` }}>
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setAnchor(parseISO(getLogicalToday()))}
        style={{ fontSize: 14, fontWeight: 700, color: t.text, minWidth: 210, textAlign: 'center' }}>
        {navLabel}
        {!isCurrentWeek && <span style={{ fontSize: 11, color: t.accent, marginLeft: 6 }}>이번 주로</span>}
      </button>
      <button onClick={() => setAnchor(a => addWeeks(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}` }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  // ── ① 이번 주 목표 블록 ──
  const goalsBlock = (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>🎯 이번 주 목표</h3>
        {weekGoals.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>{goalsDone} / {weekGoals.length} 달성</span>
        )}
      </div>
      {weekGoals.length === 0 ? (
        <button onClick={() => navigate('/goals')} className="w-full text-left rounded-lg px-3 py-3"
          style={{ fontSize: 13, color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px dashed ${t.border}` }}>
          목표 페이지에서 이번 주 목표를 세워보세요 →
        </button>
      ) : (
        <div className="space-y-2">
          {weekGoals.map(g => {
            const parent = g.monthlyGoalId ? monthlyGoals.find(m => m.id === g.monthlyGoalId) : null;
            const parentColor = parent?.projectId ? (projects.find(p => p.id === parent.projectId)?.color ?? t.accent) : t.accent;
            const prog = goalTodoProgress(g.id);
            return (
              <div key={g.id} className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ backgroundColor: t.surfaceMuted }}>
                <button onClick={() => toggleWeeklyGoal(g.id)} aria-label={g.done ? '달성 해제' : '달성'}
                  className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                  style={{ border: g.done ? 'none' : `2px solid ${t.border}`, backgroundColor: g.done ? t.accent : 'transparent' }}>
                  {g.done && <Check size={11} color="#fff" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: g.done ? t.textMuted : t.text, textDecoration: g.done ? 'line-through' : 'none' }}>{g.text}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {parent && (
                      <span className="inline-flex items-center gap-1" style={{ fontSize: 10, color: t.textSub, maxWidth: 200 }} title={parent.text}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: parentColor, display: 'inline-block', flexShrink: 0 }} />
                        <span className="truncate">{parent.text}</span>
                      </span>
                    )}
                    {prog && (
                      <span className="px-1.5 py-px rounded-full" style={{ fontSize: 9, fontWeight: 600, backgroundColor: t.accentLight, color: t.accent }}>
                        할일 {prog.done}/{prog.total}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── ③ 숫자 스트립 (완료율 % · 습관 달성일 n/7 · 몸무게 변화[데이터 있을 때만]) ──
  const statsBlock = (
    <div className={`grid ${weekWeight ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
      <StatCard value={weekTodos.length ? String(completionPct) : '–'} unit={weekTodos.length ? '%' : undefined}
        label="할일 완료율" sub={weekTodos.length ? `${doneTodos.length}/${weekTodos.length}` : '할일 없음'}
        pct={completionPct} barColor={t.success} />
      <StatCard value={habits.length ? String(habitDays) : '–'} unit={habits.length ? '/7' : undefined}
        label="습관 달성일" sub={habits.length ? undefined : '습관 없음'}
        pct={habitPct} barColor={t.accent} />
      {weekWeight && (
        <StatCard
          value={`${weekWeight.delta > 0 ? '+' : ''}${weekWeight.delta.toFixed(1)}`} unit="kg"
          label="몸무게" sub={`${weekWeight.slot} 기준`}
          pct={Math.min(100, Math.abs(weekWeight.delta) * 25)}
          barColor={weekWeight.delta <= 0 ? t.success : t.danger} />
      )}
    </div>
  );

  // ── ④ 이번 주의 조각 — 공용 컴포넌트(주간·월간 재사용), 기간만 주입 ──
  const piecesBlock = <MemoryPieces startStr={range.startStr} endStr={range.endStr} title="이번 주의 조각" />;

  // ── ② 시간 스트립 — 공용 컴포넌트(주간·월간 재사용), 기간만 주입 ──
  const timeStrip = <TrackTimeStrip startStr={range.startStr} endStr={range.endStr} />;

  const reviewForm = (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>주간 리뷰 · {navLabel}</h3>
      <div className="space-y-3">
        <div>
          <LabelRow label="잘한 것" labelColor="#006b62" onVoiceResult={text => setWrGood(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={wrGood} onChange={e => setWrGood(e.target.value)} rows={3} placeholder="이번 주 잘한 것"
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="아쉬운 것" labelColor="#D4735A" onVoiceResult={text => setWrHard(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={wrHard} onChange={e => setWrHard(e.target.value)} rows={3} placeholder="이번 주 아쉬운 것"
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="다음 주 한 가지" labelColor="#7B9ED9" onVoiceResult={text => setWrNext(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={wrNext} onChange={e => setWrNext(e.target.value)} rows={2} placeholder="다음 주에 할 단 한 가지 — 그대로 다음 주 목표가 돼요"
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
      </div>

      {/* KPT 섹션 — 설정에서 ON 시 표시, 실제 저장(Stage 1 컬럼) */}
      {appSettings.showWeeklyKpt && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.borderLight}` }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>🔄 KPT 주간 회고</h4>
          <div className={isDesktop ? 'grid grid-cols-3 gap-3' : 'space-y-3'}>
            <div>
              <LabelRow label="Keep (유지할 것)" labelColor="#006b62" onVoiceResult={text => setWrKptKeep(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={wrKptKeep} onChange={e => setWrKptKeep(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Problem (문제점)" labelColor="#D4735A" onVoiceResult={text => setWrKptProblem(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={wrKptProblem} onChange={e => setWrKptProblem(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Try (시도할 것)" labelColor="#7B9ED9" onVoiceResult={text => setWrKptTry(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={wrKptTry} onChange={e => setWrKptTry(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      <button onClick={save}
        className="w-full mt-4 py-2.5 rounded-xl transition-colors"
        style={{ fontSize: 13, fontWeight: 600, backgroundColor: savedFlash ? t.success : t.accent, color: '#fff' }}>
        {savedFlash ? '저장됨 ✓' : '저장'}
      </button>
    </div>
  );

  const pastBlock = (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
        <Clock size={13} /> 지난 주간 리뷰
      </h3>
      {lastYearReview && hasText(lastYearReview) && renderPastItem({ review: lastYearReview, ...weekKeyToRange(lastYearReview.weekKey) }, true)}
      {pastGroups.length === 0 && !(lastYearReview && hasText(lastYearReview)) ? (
        <p style={{ fontSize: 12, color: t.textMuted, padding: '12px 0' }}>아직 지난 주간 리뷰가 없어요</p>
      ) : (
        pastGroups.map((g, gi) => (
          <div key={g.monthKey} className="space-y-2">
            <button onClick={() => toggleGroup(g.monthKey, gi)}
              className="flex items-center gap-1 w-full mt-1"
              style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
              <ChevronDown size={14} style={{ transform: isExpanded(g.monthKey, gi) ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
              {format(parseISO(`${g.monthKey}-01`), 'yyyy년 M월', { locale: ko })}
              <span style={{ color: t.textMuted, fontWeight: 400 }}>· {g.rows.length}건</span>
            </button>
            {isExpanded(g.monthKey, gi) && g.rows.map(row => renderPastItem(row))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div>
      {weekNav}
      {isDesktop ? (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-4">
            {goalsBlock}
            {timeStrip}
            {statsBlock}
            {piecesBlock}
          </div>
          <div className="flex-shrink-0 space-y-4" style={{ width: 340 }}>
            {reviewForm}
            <div style={{ position: 'sticky', top: 12 }}>{pastBlock}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {goalsBlock}
          {timeStrip}
          {statsBlock}
          {piecesBlock}
          {reviewForm}
          {pastBlock}
        </div>
      )}
    </div>
  );
}

// ─── 월간 탭 ───────────────────────────────────────────────────────────────

type BestItem = { id: string; label: string };

// 이 달의 베스트 — 후보 칩(라디오) + 직접 입력. 선택값은 제목 문자열로 저장.
function BestCategory({ emoji, label, candidates, value, onChange }: {
  emoji: string; label: string; candidates: BestItem[]; value: string; onChange: (v: string) => void;
}) {
  const { t } = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const isCustom = !!value && !candidates.some(c => c.label === value);

  const chipStyle = (sel: boolean) => ({
    fontSize: 11, padding: '5px 10px', maxWidth: 200,
    overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const,
    backgroundColor: sel ? t.accent : t.surfaceMuted, color: sel ? '#fff' : t.textSub,
    border: `1px solid ${sel ? t.accent : t.borderLight}`, fontWeight: sel ? 600 : 400,
  });

  return (
    <div className="rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: '12px 14px' }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span style={{ fontSize: 15 }}>{emoji}</span>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{label}</h4>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {candidates.length === 0 && !isCustom && (
          <span style={{ fontSize: 11, color: t.textMuted, padding: '4px 0' }}>이 달 기록이 없어요 · 직접 입력해 주세요</span>
        )}
        {candidates.map(c => {
          const sel = c.label === value;
          return (
            <button key={c.id} onClick={() => onChange(sel ? '' : c.label)} className="rounded-full" style={chipStyle(sel)}>
              {sel ? '⭐ ' : ''}{c.label}
            </button>
          );
        })}
        {isCustom && (
          <button onClick={() => onChange('')} className="rounded-full" style={chipStyle(true)}>⭐ {value}</button>
        )}
        <button onClick={() => setCustomOpen(o => !o)} className="rounded-full"
          style={{ fontSize: 11, padding: '5px 10px', backgroundColor: t.surfaceMuted, color: t.textMuted, border: `1px dashed ${t.border}` }}>
          ＋ 직접 입력
        </button>
      </div>
      {customOpen && (
        <div className="flex items-center gap-2 mt-2.5">
          <input value={customText} onChange={e => setCustomText(e.target.value)}
            placeholder={`${label} 직접 입력`} className="flex-1 rounded-lg px-3 py-1.5 border outline-none min-w-0"
            style={{ borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 12 }} />
          <button onClick={() => { const v = customText.trim(); if (v) { onChange(v); setCustomText(''); setCustomOpen(false); } }}
            className="rounded-lg flex-shrink-0" style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', backgroundColor: t.accent, color: '#fff' }}>
            선택
          </button>
        </div>
      )}
    </div>
  );
}

// 좋았던 순간 패턴(읽기 전용) — 시간대 분포 막대 + 총 횟수 + 가장 많은 요일.
// 아카이브(열람 전용)에서 월간 리뷰로 이전한 통계 카드. 입력 버튼 없음(회고 시트가 단일 입력 지점).
// 주간에는 넣지 않는다 — 한 주 표본으로는 "가장 많은 요일" 등이 무의미(요일별 1건).
function HappyPatternCard({ moments, monthLabel }: { moments: HappyMoment[]; monthLabel: string }) {
  const { t } = useTheme();
  const pattern = useMemo(() => {
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    const buckets = [
      { key: 'morning', label: '아침', range: '05–11' },
      { key: 'afternoon', label: '오후', range: '11–17' },
      { key: 'evening', label: '저녁', range: '17–22' },
      { key: 'night', label: '밤', range: '22–05' },
    ] as const;
    const bucketOf = (h: number) =>
      h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night';
    const counts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const wd = new Array(7).fill(0);
    let withHour = 0;
    for (const m of moments) {
      if (m.happenedAt) { counts[bucketOf(parseISO(m.happenedAt).getHours())]++; withHour++; }
      wd[parseISO(m.date).getDay()]++;
    }
    const topBucket = withHour > 0 ? buckets.reduce((a, b) => (counts[b.key] > counts[a.key] ? b : a)) : null;
    const topWdIdx = wd.some((c: number) => c > 0) ? wd.reduce((bi: number, c: number, i: number) => (c > wd[bi] ? i : bi), 0) : -1;
    return {
      buckets: buckets.map(b => ({ ...b, count: counts[b.key] })),
      max: Math.max(1, ...buckets.map(b => counts[b.key])),
      withHour,
      count: moments.length,
      topBucketLabel: topBucket?.label ?? null,
      topWd: topWdIdx >= 0 ? `${WD[topWdIdx]}요일` : null,
    };
  }, [moments]);

  // 그 달 좋았던 순간이 없으면 섹션 자체를 숨긴다(빈 통계 카드로 어색해지지 않게).
  if (moments.length === 0) return null;

  return (
    <div className="rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>✨ 주로 이럴 때 행복을 느껴요</h3>
      <div className="flex items-end gap-3" style={{ height: 92 }}>
        {pattern.buckets.map(b => {
          const h = b.count > 0 ? `${Math.max(8, (b.count / pattern.max) * 100)}%` : '0%';
          const isTop = pattern.topBucketLabel === b.label && b.count > 0;
          return (
            <div key={b.key} className="flex flex-col items-center gap-1.5 flex-1 min-w-0" style={{ height: '100%', justifyContent: 'flex-end' }}>
              <div className="relative w-full flex justify-center" style={{ flex: 1, alignItems: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 44, height: h, borderRadius: '8px 8px 0 0', backgroundColor: isTop ? t.danger : t.accent, position: 'relative', transition: 'height .3s' }}>
                  {b.count > 0 && (
                    <span style={{ position: 'absolute', top: -16, left: 0, right: 0, textAlign: 'center', fontSize: 10, fontWeight: 700, color: isTop ? t.danger : t.textMuted }}>{b.count}</span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 11, color: isTop ? t.danger : t.textSub, fontWeight: isTop ? 700 : 400 }}>{b.label}</span>
              <span style={{ fontSize: 9, color: t.textMuted }}>{b.range}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3" style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
        {monthLabel} · 행복한 순간 <b style={{ color: t.text }}>{pattern.count}번</b>
        {pattern.topBucketLabel && <> · 가장 많은 시간대 <b style={{ color: t.danger }}>{pattern.topBucketLabel}</b></>}
        {pattern.topWd && <> · 가장 많은 요일 <b style={{ color: t.danger }}>{pattern.topWd}</b></>}
      </p>
      {pattern.withHour < pattern.count && (
        <p style={{ fontSize: 10.5, color: t.textMuted, marginTop: 4 }}>※ 시간대 막대는 시각이 기록된 {pattern.withHour}건만 반영</p>
      )}
    </div>
  );
}

function MonthTab({ jump }: { jump?: JumpReq }) {
  const {
    todos, habits, monthlyGoals, projects,
    monthlyReviews, addMonthlyReview, updateMonthlyReview,
    happyMoments, appSettings,
  } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const weekStartsOn = (appSettings.weekStartsOn ?? 1) as 0 | 1;

  // ── 월 범위 단일 계산 — 아래 모든 섹션이 공유 ──
  const [anchor, setAnchor] = useState(() => startOfMonth(parseISO(getLogicalToday())));
  // 돌아보기 카드 점프 → 해당 달로
  useEffect(() => { if (jump) setAnchor(startOfMonth(parseISO(jump.date))); }, [jump?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthKey = format(anchor, 'yyyy-MM');
  const monthStartStr = `${monthKey}-01`;
  const monthEndStr = format(endOfMonth(anchor), 'yyyy-MM-dd');
  const currentMonthKey = format(parseISO(getLogicalToday()), 'yyyy-MM');
  const isCurrentMonth = monthKey === currentMonthKey;

  // ── 자동집계: 할일/습관 (store) ──
  const monthTodos = todos.filter(td => td.date && td.date >= monthStartStr && td.date <= monthEndStr);
  const doneTodos = monthTodos.filter(td => td.status === 'done');
  const completionPct = monthTodos.length ? Math.round((doneTodos.length / monthTodos.length) * 100) : 0;
  const habitDays = useMemo(() => {
    const s = new Set<string>();
    habits.forEach(h => h.checkedDates.forEach(d => { if (d.startsWith(monthKey)) s.add(d); }));
    return s.size;
  }, [habits, monthKey]);

  // ── 자동집계 + 베스트 후보: 외부 소스 테이블 읽기 전용 ──
  const [src, setSrc] = useState<{ video: BestItem[]; music: BestItem[]; book: BestItem[]; place: BestItem[]; walkCount: number; weights: { date: string; slot: string; weight: number }[] }>(
    { video: [], music: [], book: [], place: [], walkCount: 0, weights: [] },
  );
  const loadSrc = useCallback(async () => {
    const [cu, mu, bk, pv, wk, wt] = await Promise.all([
      supabase.from('culture_records').select('id,title,watched_date')
        .gte('watched_date', monthStartStr).lte('watched_date', monthEndStr).order('watched_date', { ascending: false }),
      supabase.from('music_records').select('id,track_title,artist,created_at').order('created_at', { ascending: false }),
      supabase.from('books').select('id,title,status,finish_date')
        .eq('status', 'done').gte('finish_date', monthStartStr).lte('finish_date', monthEndStr),
      supabase.from('place_visits').select('id,name,visited_on')
        .gte('visited_on', monthStartStr).lte('visited_on', monthEndStr).order('visited_on', { ascending: false }),
      supabase.from('walk_sessions').select('id,started_at,created_at'),
      supabase.from('weight_records').select('date,slot,weight')
        .gte('date', monthStartStr).lte('date', monthEndStr),
    ]);
    setSrc({
      video: (cu.data ?? []).map((r: any) => ({ id: r.id, label: r.title })),
      music: (mu.data ?? []).filter((r: any) => String(r.created_at ?? '').slice(0, 7) === monthKey)
        .map((r: any) => ({ id: r.id, label: `${r.track_title} — ${r.artist}` })),
      book: (bk.data ?? []).map((r: any) => ({ id: r.id, label: r.title })),
      place: (pv.data ?? []).map((r: any) => ({ id: r.id, label: r.name })),
      walkCount: (wk.data ?? []).filter((r: any) => String((r.started_at ?? r.created_at) ?? '').slice(0, 7) === monthKey).length,
      weights: (wt.data ?? []).map((r: any) => ({ date: r.date, slot: r.slot, weight: Number(r.weight) })),
    });
  }, [monthKey, monthStartStr, monthEndStr]);
  useEffect(() => { loadSrc(); }, [loadSrc]);
  useRealtimeSync('culture_records', loadSrc);
  useRealtimeSync('music_records', loadSrc);
  useRealtimeSync('books', loadSrc);
  useRealtimeSync('place_visits', loadSrc);
  useRealtimeSync('walk_sessions', loadSrc);
  useRealtimeSync('weight_records', loadSrc);

  // ③ 몸무게 변화 — 주간과 동일 공용 헬퍼(동일 slot 비교, DESIGN §7.4). 2건 미만이면 null → 생략.
  const monthWeight = computeWeightDelta(src.weights, monthStartStr, monthEndStr);

  // ── 회고 + 베스트 (Stage 1 monthly_reviews 컬럼) ──
  const monthlyReview = monthlyReviews.find(r => r.month === monthKey);
  const ensureSaved = (partial: Partial<MonthlyReview>) => {
    if (monthlyReview) updateMonthlyReview(monthlyReview.id, partial);
    else addMonthlyReview({ month: monthKey, achievement: '', nextFocus: '', ...partial });
  };

  const [mHighlight, setMHighlight] = useState('');
  const [mDidWell, setMDidWell] = useState('');
  const [mRegret, setMRegret] = useState('');
  const [mNextFocus, setMNextFocus] = useState('');
  const [mKptKeep, setMKptKeep] = useState('');
  const [mKptProblem, setMKptProblem] = useState('');
  const [mKptTry, setMKptTry] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setMHighlight(monthlyReview?.highlight || '');
    setMDidWell(monthlyReview?.didWell || '');
    setMRegret(monthlyReview?.regret || '');
    setMNextFocus(monthlyReview?.nextFocus || '');
    setMKptKeep(monthlyReview?.kptKeep || '');
    setMKptProblem(monthlyReview?.kptProblem || '');
    setMKptTry(monthlyReview?.kptTry || '');
  }, [monthlyReview?.id, monthKey]);

  const saveReview = () => {
    ensureSaved({
      highlight: mHighlight, didWell: mDidWell, regret: mRegret, nextFocus: mNextFocus,
      kptKeep: mKptKeep, kptProblem: mKptProblem, kptTry: mKptTry,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  // 베스트 — 선택 즉시 저장(merge). 회고 텍스트/achievement 은 보존됨.
  const best = {
    video: monthlyReview?.bestVideo ?? '',
    music: monthlyReview?.bestMusic ?? '',
    book: monthlyReview?.bestBook ?? '',
    place: monthlyReview?.bestPlace ?? '',
  };

  // ── 과거 월간 리뷰(연도별 그룹 + 작년 같은 달 비교) ──
  const hasMonthText = (r: MonthlyReview) =>
    !!(r.highlight || r.didWell || r.regret || r.nextFocus || r.achievement ||
       r.bestVideo || r.bestMusic || r.bestBook || r.bestPlace ||
       r.kptKeep || r.kptProblem || r.kptTry);

  const lastYearKey = `${Number(monthKey.slice(0, 4)) - 1}-${monthKey.slice(5, 7)}`;
  const lastYearReview = monthlyReviews.find(r => r.month === lastYearKey);

  const pastGroups = useMemo(() => {
    const items = monthlyReviews
      .filter(r => r.month !== monthKey && hasMonthText(r))
      .sort((a, b) => b.month.localeCompare(a.month));
    const groups: { year: string; rows: MonthlyReview[] }[] = [];
    for (const r of items) {
      const year = r.month.slice(0, 4);
      let g = groups.find(x => x.year === year);
      if (!g) { g = { year, rows: [] }; groups.push(g); }
      g.rows.push(r);
    }
    return groups;
  }, [monthlyReviews, monthKey]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (yr: string, idx: number) => expanded[yr] ?? idx === 0;
  const toggleGroup = (yr: string, idx: number) =>
    setExpanded(prev => ({ ...prev, [yr]: !(prev[yr] ?? idx === 0) }));

  const inputStyle = {
    borderColor: t.border, backgroundColor: inputBg(t), color: t.text, fontSize: 13, fontFamily: t.fontBody,
  };

  const renderMonthCard = (r: MonthlyReview, anniversary = false) => {
    const preview = [r.highlight, r.didWell, r.achievement, r.nextFocus].filter(Boolean).join(' · ');
    const badges = [
      r.bestVideo && `🎬 ${r.bestVideo}`,
      r.bestMusic && `🎵 ${r.bestMusic}`,
      r.bestBook && `📖 ${r.bestBook}`,
      r.bestPlace && `📍 ${r.bestPlace}`,
    ].filter(Boolean) as string[];
    return (
      <button key={r.id} onClick={() => setAnchor(startOfMonth(parseISO(`${r.month}-01`)))}
        className="w-full text-left p-3 rounded-xl transition-colors"
        style={{ backgroundColor: anniversary ? t.accentLight : t.card, border: `1px solid ${anniversary ? t.accent : t.borderLight}` }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {anniversary && <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>🕰 작년 같은 달</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            {format(parseISO(`${r.month}-01`), 'yyyy년 M월', { locale: ko })}
          </span>
        </div>
        {preview && (
          <p style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
        )}
        {badges.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {badges.map((b, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.surfaceMuted, color: t.textSub, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b}</span>
            ))}
          </div>
        )}
      </button>
    );
  };

  const monthNav = (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={() => setAnchor(a => subMonths(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}` }}>
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setAnchor(startOfMonth(parseISO(getLogicalToday())))}
        style={{ fontSize: 15, fontWeight: 700, color: t.text, minWidth: 150, textAlign: 'center' }}>
        {format(anchor, 'yyyy년 M월', { locale: ko })}
        {!isCurrentMonth && <span style={{ fontSize: 11, color: t.accent, marginLeft: 6 }}>이번 달로</span>}
      </button>
      <button onClick={() => setAnchor(a => addMonths(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}` }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  // 4-1. 숫자로 보는 한 달 (자동집계, 입력 0)
  const statsBlock = (
    <div>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 9 }}>숫자로 보는 한 달</h3>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: isDesktop ? `repeat(${monthWeight ? 7 : 6},1fr)` : 'repeat(3,1fr)' }}>
        <MiniCell value={monthTodos.length ? String(completionPct) : '–'} unit={monthTodos.length ? '%' : undefined} label="할일 완료율" />
        <MiniCell value={String(habitDays)} unit="일" label="습관 달성일" />
        <MiniCell value={String(src.book.length)} unit="권" label="읽은 책" />
        <MiniCell value={String(src.video.length)} unit="개" label="본 미디어" />
        <MiniCell value={String(src.walkCount)} unit="회" label="산책" />
        <MiniCell value={String(src.place.length)} unit="곳" label="다녀온 곳" />
        {monthWeight && (
          <MiniCell value={`${monthWeight.delta > 0 ? '+' : ''}${monthWeight.delta.toFixed(1)}`} unit="kg" label={`몸무게·${monthWeight.slot}`} />
        )}
      </div>
    </div>
  );

  // 4-2. 시간 스트립 — 주간 탭과 동일 공용 컴포넌트를 월 범위로 재사용
  const timeStrip = <TrackTimeStrip startStr={monthStartStr} endStr={monthEndStr} />;

  // ── 이 달의 목표 (신규·읽기 전용) — monthly_goals + 목표별 회고 상태(retro_status/note) ──
  // 편집은 목표 페이지 카드 안에서만(입력 지점 이원화 방지). 여기선 읽고 링크로 유도.
  const monthGoals = monthlyGoals.filter(g => g.month === monthKey);
  const RETRO_LABEL: Record<string, string> = { done: '달성', partial: '부분', missed: '미달' };
  const monthGoalsBlock = (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🎯 이 달의 목표</h3>
      {monthGoals.length === 0 ? (
        <button onClick={() => navigate('/goals')} className="w-full text-left rounded-lg px-3 py-3"
          style={{ fontSize: 13, color: t.textSub, backgroundColor: t.surfaceMuted, border: `1px dashed ${t.border}` }}>
          목표 페이지에서 이번 달 목표를 세워보세요 →
        </button>
      ) : (
        <>
          <div className="space-y-2">
            {monthGoals.map(g => {
              const dotColor = g.projectId ? (projects.find(p => p.id === g.projectId)?.color ?? t.accent) : t.accent;
              const rc = g.retroStatus ? retroStatusColor(t, g.retroStatus) : null;
              return (
                <div key={g.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: t.surfaceMuted }}>
                  <div className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: dotColor, display: 'inline-block', flexShrink: 0 }} />
                    <span className="flex-1 min-w-0 truncate" style={{ fontSize: 13, fontWeight: 600, color: t.text }} title={g.text}>{g.text}</span>
                    {rc ? (
                      <span className="px-2 py-0.5 rounded-full flex-shrink-0" style={{ fontSize: 10, fontWeight: 700, backgroundColor: mixHex(rc, 255, 0.82), color: rc }}>
                        {RETRO_LABEL[g.retroStatus!]}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full flex-shrink-0" style={{ fontSize: 10, fontWeight: 600, backgroundColor: t.card, color: t.textMuted, border: `1px solid ${t.border}` }}>
                        회고 미작성
                      </span>
                    )}
                  </div>
                  {g.retroNote && (
                    <p style={{ fontSize: 12, color: t.textSub, marginTop: 5, marginLeft: 16, lineHeight: 1.45 }}>{g.retroNote}</p>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => navigate('/goals')} className="mt-3" style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>
            목표 페이지에서 회고 쓰기 →
          </button>
        </>
      )}
    </div>
  );

  // 4-3. 이 달의 베스트 (하이브리드 픽)
  const bestBlock = (
    <div>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 9 }}>이 달의 베스트</h3>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr' }}>
        <BestCategory emoji="🎬" label="영상" candidates={src.video} value={best.video} onChange={v => ensureSaved({ bestVideo: v })} />
        <BestCategory emoji="🎵" label="음악" candidates={src.music} value={best.music} onChange={v => ensureSaved({ bestMusic: v })} />
        <BestCategory emoji="📖" label="독서" candidates={src.book} value={best.book} onChange={v => ensureSaved({ bestBook: v })} />
        <BestCategory emoji="📍" label="장소" candidates={src.place} value={best.place} onChange={v => ensureSaved({ bestPlace: v })} />
      </div>
    </div>
  );

  // 4-3b. 이 달의 조각 — 주간과 동일 공용 컴포넌트를 월 범위로 재사용(모먼트·맛·영상·음악·산책).
  const monthPiecesBlock = <MemoryPieces startStr={monthStartStr} endStr={monthEndStr} title="이 달의 조각" />;

  // 4-3c. 좋았던 순간 패턴 — 아카이브에서 이전(읽기 전용). 그 달 기록 없으면 카드가 null 반환.
  const monthMoments = happyMoments.filter(m => m.date >= monthStartStr && m.date <= monthEndStr);
  const happyPatternBlock = <HappyPatternCard moments={monthMoments} monthLabel={format(anchor, 'M월', { locale: ko })} />;

  // 4-4. 이 달의 회고
  const reviewForm = (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>이 달의 회고 · {format(anchor, 'M월', { locale: ko })}</h3>
      <div className="space-y-3">
        <div>
          <LabelRow label="하이라이트" labelColor="#515f74" onVoiceResult={text => setMHighlight(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mHighlight} onChange={e => setMHighlight(e.target.value)} placeholder="이번 달 가장 기억에 남는 순간은?" rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="잘한 것" labelColor="#006b62" onVoiceResult={text => setMDidWell(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mDidWell} onChange={e => setMDidWell(e.target.value)} rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="후회·아쉬운 것" labelColor="#D4735A" onVoiceResult={text => setMRegret(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mRegret} onChange={e => setMRegret(e.target.value)} rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="다음 달 포커스" labelColor="#7B9ED9" onVoiceResult={text => setMNextFocus(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mNextFocus} onChange={e => setMNextFocus(e.target.value)} placeholder="다음 달에 집중할 단 한 가지 — 그대로 다음 달 목표가 돼요" rows={2}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
      </div>

      {/* 월간 KPT — 설정 ON 시 표시, 실제 저장(Stage 1 컬럼) */}
      {appSettings.showMonthlyKpt && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.borderLight}` }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>🔄 KPT 월간 회고</h4>
          <div className={isDesktop ? 'grid grid-cols-3 gap-3' : 'space-y-3'}>
            <div>
              <LabelRow label="Keep" labelColor="#006b62" onVoiceResult={text => setMKptKeep(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={mKptKeep} onChange={e => setMKptKeep(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Problem" labelColor="#D4735A" onVoiceResult={text => setMKptProblem(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={mKptProblem} onChange={e => setMKptProblem(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Try" labelColor="#7B9ED9" onVoiceResult={text => setMKptTry(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={mKptTry} onChange={e => setMKptTry(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      <button onClick={saveReview}
        className="w-full mt-4 py-2.5 rounded-xl transition-colors"
        style={{ fontSize: 13, fontWeight: 600, backgroundColor: savedFlash ? t.success : t.accent, color: '#fff' }}>
        {savedFlash ? '저장됨 ✓' : '저장'}
      </button>
    </div>
  );

  const pastBlock = (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
        <Clock size={13} /> 지난 월간 리뷰
      </h3>
      {lastYearReview && hasMonthText(lastYearReview) && renderMonthCard(lastYearReview, true)}
      {pastGroups.length === 0 && !(lastYearReview && hasMonthText(lastYearReview)) ? (
        <p style={{ fontSize: 12, color: t.textMuted, padding: '12px 0' }}>아직 지난 월간 리뷰가 없어요</p>
      ) : (
        pastGroups.map((g, gi) => (
          <div key={g.year} className="space-y-2">
            <button onClick={() => toggleGroup(g.year, gi)} className="flex items-center gap-1 w-full mt-1"
              style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
              <ChevronDown size={14} style={{ transform: isExpanded(g.year, gi) ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
              {g.year}년
              <span style={{ color: t.textMuted, fontWeight: 400 }}>· {g.rows.length}건</span>
            </button>
            {isExpanded(g.year, gi) && g.rows.map(r => renderMonthCard(r))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div>
      {monthNav}
      {isDesktop ? (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-5">
            {statsBlock}
            {timeStrip}
            {monthGoalsBlock}
            {bestBlock}
            {monthPiecesBlock}
            {happyPatternBlock}
          </div>
          <div className="flex-shrink-0 space-y-5" style={{ width: 340 }}>
            {reviewForm}
            <div style={{ position: 'sticky', top: 12 }}>{pastBlock}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {statsBlock}
          {timeStrip}
          {monthGoalsBlock}
          {bestBlock}
          {monthPiecesBlock}
          {happyPatternBlock}
          {reviewForm}
          {pastBlock}
        </div>
      )}
    </div>
  );
}

// ─── 돌아보기 / 검색 아카이브 ────────────────────────────────────────────────

type ArchiveKind = 'gratitude' | 'happy' | 'kpt' | 'daily' | 'weekly' | 'monthly';
interface ArchiveItem {
  id: string;
  kind: ArchiveKind;
  date: string;          // yyyy-MM-dd — 정렬·그룹·연도·점프 기준
  dateLabel: string;     // 기간형(주간/월간) 카드 헤더용 라벨
  time?: string;         // 행복: 시각 표시(a h:mm)
  text: string;          // 검색 대상(전 본문 join)
  jump: { tab: 'day' | 'week' | 'month'; date: string };
  // ── 블록 렌더용 구조화 페이로드(감사 줄 단위·KPT 3분할 등, 검색은 text로) ──
  gratitude?: string[];
  happy?: string;
  kpt?: { keep?: string; problem?: string; try?: string };
  daily?: { summary?: string; good?: string; improve?: string };
  weekly?: { good?: string; hard?: string; nextWeek?: string; keep?: string; problem?: string; try?: string };
  monthly?: {
    highlight?: string; didWell?: string; regret?: string; nextFocus?: string; achievement?: string;
    bestVideo?: string; bestMusic?: string; bestBook?: string; bestPlace?: string;
    keep?: string; problem?: string; try?: string;
  };
}

// 키워드 매칭 하이라이트(mark). 대소문자 무시, 전체 occurrence.
function highlightText(text: string, q: string, markBg: string): React.ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0, key = 0;
  let pos = lower.indexOf(ql);
  if (pos === -1) return text;
  while (pos !== -1) {
    if (pos > i) parts.push(text.slice(i, pos));
    parts.push(<mark key={key++} style={{ backgroundColor: markBg, color: 'inherit', borderRadius: 3, padding: '0 1px' }}>{text.slice(pos, pos + q.length)}</mark>);
    i = pos + q.length;
    pos = lower.indexOf(ql, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

// 히트맵 노출 최소 기록 수(연도별). 히트맵은 1년(365칸) 격자라 기록이 적으면 빈 격자로 보인다.
// 원래 30(대략 12일당 1건꼴로 밀도 패턴이 보이기 시작)로 두었으나, 사용자가 "지금부터 계속 보고
// 싶다"고 하여 1로 낮춤 — 해당 연도에 기록이 1건이라도 있으면 히트맵을 노출한다(기록 0인 해는 여전히
// 미노출). 상수라 나중에 다시 올릴 수 있다.
const HEATMAP_MIN_RECORDS = 1;

// 필터칩 — '행복' → '좋았던 순간'(회고 시트 명칭과 통일). 색 점은 kindMeta 색을 재사용한다.
const ARCHIVE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'gratitude', label: '감사' },
  { key: 'happy', label: '좋았던 순간' },
  { key: 'kpt', label: 'KPT' },
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
] as const;

function ArchiveOverlay({ onClose, onJump }: {
  onClose: () => void;
  onJump: (tab: 'day' | 'week' | 'month', date: string) => void;
}) {
  const { reviewRecords, happyMoments, weeklyReviews, monthlyReviews } = usePlanner();
  const { t } = useTheme();
  // 세로 타임라인 — PC는 중앙 정렬 단일 컬럼, 모바일은 앵커 폭만 축소(lg 분기).
  const isLg = useMediaQuery('(min-width: 1024px)');

  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ArchiveKind>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [heatmapYear, setHeatmapYear] = useState<string | null>(null); // 히트맵 ‹ › 이동 연도('전체' 필터일 때)

  // 검색 디바운스(220ms)
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(rawQuery.trim()), 220);
    return () => window.clearTimeout(id);
  }, [rawQuery]);

  // 타입별 색(토큰만, 6종 모두 구분): 감사=green / 좋았던순간=coral / KPT=blue / 데일리=muted / 주간=amber / 월간=indigo.
  // (구: 좋았던순간·KPT 가 모두 코랄이라 점이 구분되지 않던 문제 → KPT를 info(블루)로, 주간을 warning(앰버)으로 분리.)
  const kindMeta: Record<ArchiveKind, { label: string; emoji: string; color: string }> = {
    gratitude: { label: '감사', emoji: '🙏', color: t.success },
    happy: { label: '좋았던 순간', emoji: '✨', color: t.danger },
    kpt: { label: 'KPT', emoji: '🔄', color: t.info },
    daily: { label: '데일리', emoji: '📔', color: t.textMuted },
    weekly: { label: '주간', emoji: '📅', color: t.warning },
    monthly: { label: '월간', emoji: '🗓', color: t.text },
  };

  // ── 통합 스트림 (review_records 감사/KPT/daily_* + happy_moments + weekly + monthly) ──
  const items = useMemo<ArchiveItem[]>(() => {
    const out: ArchiveItem[] = [];
    const join = (arr: (string | undefined | null)[]) => arr.map(s => (s ?? '').trim()).filter(Boolean).join(' · ');

    for (const r of reviewRecords) {
      const g = (r.gratitude ?? []).map(s => s.trim()).filter(Boolean);
      if (g.length) {
        out.push({ id: `g-${r.id}`, kind: 'gratitude', date: r.date,
          dateLabel: format(parseISO(r.date), 'M월 d일 (E)', { locale: ko }),
          gratitude: g, text: g.join(' '), jump: { tab: 'day', date: r.date } });
      }
      const kpt = join([r.kptKeep, r.kptProblem, r.kptTry]);
      if (kpt) {
        out.push({ id: `k-${r.id}`, kind: 'kpt', date: r.date,
          dateLabel: format(parseISO(r.date), 'M월 d일 (E)', { locale: ko }),
          kpt: { keep: r.kptKeep, problem: r.kptProblem, try: r.kptTry },
          text: kpt, jump: { tab: 'day', date: r.date } });
      }
      // 과거 데일리 리뷰(daily_*) 읽기전용 승계
      const daily = join([r.dailySummary, r.dailyGood, r.dailyImprove]);
      if (daily) {
        out.push({ id: `d-${r.id}`, kind: 'daily', date: r.date,
          dateLabel: format(parseISO(r.date), 'M월 d일 (E)', { locale: ko }),
          daily: { summary: r.dailySummary, good: r.dailyGood, improve: r.dailyImprove },
          text: daily, jump: { tab: 'day', date: r.date } });
      }
    }

    // 행복: happy_moments (백필분 포함). review_records.happiness 는 이 테이블로 분리됐으므로 중복 방지로 미포함.
    for (const h of happyMoments) {
      if (!h.content?.trim()) continue;
      const content = h.content.trim();
      out.push({ id: `h-${h.id}`, kind: 'happy', date: h.date,
        dateLabel: format(parseISO(h.date), 'M월 d일 (E)', { locale: ko }),
        time: h.happenedAt ? format(parseISO(h.happenedAt), 'a h:mm', { locale: ko }) : undefined,
        happy: content, text: content, jump: { tab: 'day', date: h.date } });
    }

    for (const w of weeklyReviews) {
      const text = join([w.good, w.hard, w.nextWeek, w.kptKeep, w.kptProblem, w.kptTry]);
      if (!text) continue;
      const rg = weekKeyToRange(w.weekKey);
      out.push({ id: `w-${w.id}`, kind: 'weekly', date: rg.startStr,
        dateLabel: `${format(rg.start, 'M.d')}–${format(rg.end, 'M.d')} 주간`,
        weekly: { good: w.good, hard: w.hard, nextWeek: w.nextWeek, keep: w.kptKeep, problem: w.kptProblem, try: w.kptTry },
        text, jump: { tab: 'week', date: rg.startStr } });
    }

    for (const m of monthlyReviews) {
      const text = join([m.highlight, m.didWell, m.regret, m.nextFocus, m.achievement,
        m.bestVideo && `🎬 ${m.bestVideo}`, m.bestMusic && `🎵 ${m.bestMusic}`,
        m.bestBook && `📖 ${m.bestBook}`, m.bestPlace && `📍 ${m.bestPlace}`,
        m.kptKeep, m.kptProblem, m.kptTry]);
      if (!text) continue;
      const mDate = `${m.month}-01`;
      out.push({ id: `m-${m.id}`, kind: 'monthly', date: mDate,
        dateLabel: format(parseISO(mDate), 'yyyy년 M월', { locale: ko }),
        monthly: {
          highlight: m.highlight, didWell: m.didWell, regret: m.regret, nextFocus: m.nextFocus, achievement: m.achievement,
          bestVideo: m.bestVideo, bestMusic: m.bestMusic, bestBook: m.bestBook, bestPlace: m.bestPlace,
          keep: m.kptKeep, problem: m.kptProblem, try: m.kptTry,
        },
        text, jump: { tab: 'month', date: mDate } });
    }

    // 날짜 역순(같은 날은 시각 역순)
    out.sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''));
    return out;
  }, [reviewRecords, happyMoments, weeklyReviews, monthlyReviews]);

  const years = useMemo(() => {
    const s = new Set(items.map(it => it.date.slice(0, 4)));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [items]);

  // 타입 필터 × 키워드 × 연도 AND 결합
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(it => {
      if (typeFilter !== 'all' && it.kind !== typeFilter) return false;
      if (yearFilter !== 'all' && it.date.slice(0, 4) !== yearFilter) return false;
      if (q && !it.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, typeFilter, yearFilter, query]);

  // 월 → 일 2단 그룹(역순 유지). 같은 날 기록은 하나의 day 로 묶고, 그 안에서
  // 일간형(감사·좋았던순간·KPT·데일리)은 한 카드로, 기간형(주간·월간)은 별도 카드로 렌더.
  interface DayGroup {
    date: string; dayNum: string; weekday: string;
    daily: ArchiveItem[]; weekly: ArchiveItem[]; monthly: ArchiveItem[];
  }
  interface MonthGroup { monthKey: string; label: string; count: number; days: DayGroup[]; }
  const groups = useMemo<MonthGroup[]>(() => {
    const months: MonthGroup[] = [];
    for (const it of filtered) {
      const mk = it.date.slice(0, 7);
      let m = months.find(x => x.monthKey === mk);
      if (!m) {
        m = { monthKey: mk, label: format(parseISO(`${mk}-01`), 'yyyy년 M월', { locale: ko }), count: 0, days: [] };
        months.push(m);
      }
      m.count++;
      let d = m.days.find(x => x.date === it.date);
      if (!d) {
        const dt = parseISO(it.date);
        d = { date: it.date, dayNum: format(dt, 'd'), weekday: format(dt, 'E', { locale: ko }), daily: [], weekly: [], monthly: [] };
        m.days.push(d);
      }
      if (it.kind === 'weekly') d.weekly.push(it);
      else if (it.kind === 'monthly') d.monthly.push(it);
      else d.daily.push(it);
    }
    return months;
  }, [filtered]);

  // 하루 앵커 DOM 참조(히트맵 셀 클릭 → 해당 날짜로 스크롤)
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── 히트맵(조건부) — 대상 연도의 기록 밀도 격자. 기록이 적을 땐 렌더하지 않는다. ──
  // 히트맵이 표시하는 연도(effective): 연도 필터가 특정 연도면 그것, '전체'면 heatmapYear(‹ ›로 이동)
  // 또는 가장 최근 연도. 데이터가 있는 연도(years) 안으로 클램프.
  const heatmapYearEff = useMemo(() => {
    const base = yearFilter !== 'all' ? yearFilter : (heatmapYear ?? years[0] ?? null);
    return base && years.includes(base) ? base : (years[0] ?? null);
  }, [yearFilter, heatmapYear, years]);
  // ‹ › 이동 대상 — 데이터가 있는 연도 중 바로 이전/다음(빈 연도로 가서 히트맵이 사라지는 걸 방지). 없으면 비활성.
  const olderYear = heatmapYearEff ? (years.filter(y => y < heatmapYearEff).sort().at(-1) ?? null) : null;
  const newerYear = heatmapYearEff ? (years.filter(y => y > heatmapYearEff).sort()[0] ?? null) : null;
  // 연도 이동 — 특정 연도 필터가 걸려 있으면 필터를 함께 이동(타임라인도 그 해로), '전체'면 히트맵만 이동.
  const goHeatmapYear = (y: string) => { if (yearFilter !== 'all') setYearFilter(y); else setHeatmapYear(y); };

  // 표시된 결과(filtered) 기준으로 집계해 화면과 일치시킨다(타입/검색 필터 반영). 임계 미만이면 null → 미렌더.
  const heatmap = useMemo(() => {
    const targetYear = heatmapYearEff;
    if (!targetYear) return null;
    const dayCount: Record<string, number> = {};
    let yearCount = 0;
    for (const it of filtered) {
      if (it.date.slice(0, 4) !== targetYear) continue;
      dayCount[it.date] = (dayCount[it.date] ?? 0) + 1;
      yearCount++;
    }
    if (yearCount < HEATMAP_MIN_RECORDS) return null;
    const Y = Number(targetYear);
    const dec31 = new Date(Y, 11, 31);
    let cur = startOfWeek(new Date(Y, 0, 1), { weekStartsOn: 0 });
    const weeks: { dstr: string; count: number; inYear: boolean }[][] = [];
    while (cur <= dec31) {
      const col: { dstr: string; count: number; inYear: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const dstr = format(cur, 'yyyy-MM-dd');
        col.push({ dstr, count: dayCount[dstr] ?? 0, inYear: cur.getFullYear() === Y });
        cur = addDays(cur, 1);
      }
      weeks.push(col);
    }
    return { targetYear, yearCount, weeks };
  }, [filtered, heatmapYearEff]);

  const markBg = `${t.accent}33`;

  // ── 타임라인 지오메트리(앵커·축·노드) — 모바일은 앵커 폭 축소 ──
  // 레이아웃(day 기준 좌표): 왼→오 [날짜 앵커 0~anchorW] · 여백 · [세로 축 axisLeft].
  // 앵커는 컨테이너 좌측(x=0, left:-P)에 고정되고, 두 자리 숫자(예: 27)가 들어갈 폭만 쓴다.
  // 앵커 오른쪽 끝은 노드 왼쪽 끝보다 왼쪽에 있어 겹치지 않는다(구버전은 anchorW>axisLeft 라
  // 우측 정렬된 두 자리 숫자가 축·노드 위로 올라와 겹쳤다). 노드는 축선 중앙에 정렬.
  // 축 절대 위치(axisLeft - P)는 기존과 동일(-44 / -36)이라 카드·축선은 그대로다.
  const NODE_D = 11;                    // 노드 지름
  const P = isLg ? 84 : 72;             // 타임라인 좌측 패딩(앵커 + 여백 + 축)
  const anchorW = isLg ? 30 : 26;       // 날짜 앵커 폭 — 두 자리 숫자 기준(축 왼쪽 공간에 수용)
  const axisLeft = isLg ? 40 : 36;      // 축 x(패딩 컨테이너 기준). 축 절대 위치 = axisLeft - P
  const nodeLeft = (axisLeft - P) + 0.75 - NODE_D / 2;  // 노드를 축선(중심) 위로 정렬
  const CONTENT_MAX = 760;           // PC 중앙 정렬 단일 컬럼 최대 폭(검색·필터·본문 공통 정렬)
  const HM_CELL = 10;                // 히트맵 칸 크기 · 간격(1년 53주가 CONTENT_MAX 안에 들어오도록: 53*(10+2)=636)
  const HM_GAP = 2;

  const hl = (s: string) => highlightText(s, query, markBg);

  const cardBase: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16,
    boxShadow: '0 1px 2px rgba(46,42,91,.04), 0 5px 14px rgba(46,42,91,.05)',
    padding: '14px 15px',
  };

  const blockHead = (color: string, emoji: string, label: string) => (
    <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub }}>{emoji} {label}</span>
    </div>
  );

  // 라벨 + 값 한 줄(주간·월간 필드)
  const field = (label: string, value?: string) => value?.trim() ? (
    <div style={{ fontSize: 13, lineHeight: 1.55, color: t.text, whiteSpace: 'pre-wrap' }}>
      <span style={{ fontWeight: 600, color: t.textSub, marginRight: 6 }}>{label}</span>{hl(value)}
    </div>
  ) : null;

  // KPT 3분할(Keep/Problem/Try) — PC 3열 / 모바일 세로
  const kptGrid = (kpt: NonNullable<ArchiveItem['kpt']>) => {
    const cells: [string, string | undefined][] = [['Keep', kpt.keep], ['Problem', kpt.problem], ['Try', kpt.try]];
    const shown = cells.filter(([, v]) => v?.trim());
    if (!shown.length) return null;
    return (
      <div className="grid gap-2 lg:grid-cols-3">
        {shown.map(([k, v]) => (
          <div key={k} className="rounded-lg" style={{ backgroundColor: t.surfaceMuted, padding: '9px 11px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>{k}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: t.text, whiteSpace: 'pre-wrap' }}>{hl(v!)}</div>
          </div>
        ))}
      </div>
    );
  };

  // 일간형 카드 — 같은 날 감사·좋았던순간·KPT·데일리를 점선 구분 블록으로 한 카드에 묶는다.
  const renderDailyCard = (d: DayGroup) => {
    const grat = d.daily.find(x => x.kind === 'gratitude');
    const happies = d.daily.filter(x => x.kind === 'happy');
    const kptItem = d.daily.find(x => x.kind === 'kpt');
    const dly = d.daily.find(x => x.kind === 'daily');

    const blocks: React.ReactNode[] = [];
    if (grat?.gratitude?.length) {
      blocks.push(
        <div key="g">
          {blockHead(kindMeta.gratitude.color, '🙏', '감사한 것')}
          <ol className="space-y-1.5">
            {grat.gratitude.map((g, i) => (
              <li key={i} className="flex gap-2" style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>
                <span style={{ fontFamily: t.fontNumeric, fontSize: 11, fontWeight: 700, color: kindMeta.gratitude.color, flexShrink: 0, paddingTop: 2 }}>{i + 1}</span>
                <span>{hl(g)}</span>
              </li>
            ))}
          </ol>
        </div>,
      );
    }
    if (happies.length) {
      blocks.push(
        <div key="h">
          {blockHead(kindMeta.happy.color, '✨', '좋았던 순간')}
          <ul className="space-y-1.5">
            {happies.map(h => (
              <li key={h.id} style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>
                {h.time && <span style={{ fontSize: 11, fontWeight: 600, color: kindMeta.happy.color, marginRight: 6 }}>{h.time}</span>}
                {hl(h.happy ?? h.text)}
              </li>
            ))}
          </ul>
        </div>,
      );
    }
    if (kptItem?.kpt) {
      const grid = kptGrid(kptItem.kpt);
      if (grid) blocks.push(<div key="k">{blockHead(kindMeta.kpt.color, '🔄', 'KPT 회고')}{grid}</div>);
    }
    if (dly?.daily) {
      const { summary, good, improve } = dly.daily;
      blocks.push(
        <div key="d">
          {blockHead(kindMeta.daily.color, '📔', '데일리 리뷰')}
          <div className="space-y-1">
            {summary?.trim() && <div style={{ fontSize: 13, lineHeight: 1.55, color: t.text, whiteSpace: 'pre-wrap' }}>{hl(summary)}</div>}
            {field('잘한 점', good)}
            {field('개선할 점', improve)}
          </div>
        </div>,
      );
    }
    if (!blocks.length) return null;

    return (
      <button onClick={() => onJump('day', d.date)} style={cardBase}>
        {blocks.map((b, i) => (
          <div key={i} style={{
            paddingTop: i === 0 ? 0 : 11,
            paddingBottom: i === blocks.length - 1 ? 0 : 11,
            borderTop: i === 0 ? 'none' : `1px dashed ${t.borderLight}`,
          }}>{b}</div>
        ))}
      </button>
    );
  };

  // 기간형 카드(주간·월간) — 좌측 3px 색 액센트 + 헤더 라벨
  const renderWeeklyCard = (it: ArchiveItem) => {
    const w = it.weekly; if (!w) return null;
    return (
      <button key={it.id} onClick={() => onJump('week', it.jump.date)}
        style={{ ...cardBase, borderLeft: `3px solid ${kindMeta.weekly.color}` }}>
        {blockHead(kindMeta.weekly.color, '📅', `주간 리뷰 · ${it.dateLabel}`)}
        <div className="space-y-1.5">
          {field('잘한 것', w.good)}
          {field('아쉬운 것', w.hard)}
          {field('다음 주', w.nextWeek)}
          {field('Keep', w.keep)}
          {field('Problem', w.problem)}
          {field('Try', w.try)}
        </div>
      </button>
    );
  };

  const renderMonthlyCard = (it: ArchiveItem) => {
    const m = it.monthly; if (!m) return null;
    const best = [m.bestVideo && `🎬 ${m.bestVideo}`, m.bestMusic && `🎵 ${m.bestMusic}`,
      m.bestBook && `📖 ${m.bestBook}`, m.bestPlace && `📍 ${m.bestPlace}`].filter(Boolean).join('  ');
    return (
      <button key={it.id} onClick={() => onJump('month', it.jump.date)}
        style={{ ...cardBase, borderLeft: `3px solid ${kindMeta.monthly.color}` }}>
        {blockHead(kindMeta.monthly.color, '🗓', `월간 리뷰 · ${it.dateLabel}`)}
        <div className="space-y-1.5">
          {field('하이라이트', m.highlight)}
          {field('잘한 것', m.didWell)}
          {field('아쉬운 것', m.regret)}
          {field('다음 달 집중', m.nextFocus)}
          {field('성취', m.achievement)}
          {best ? field('이 달의 베스트', best) : null}
          {field('Keep', m.keep)}
          {field('Problem', m.problem)}
          {field('Try', m.try)}
        </div>
      </button>
    );
  };

  // 하루 렌더 — 날짜 앵커(큰 숫자 Sora + 요일) + 노드 + 그 날의 카드들
  const renderDay = (d: DayGroup) => (
    <div key={d.date} ref={el => { dayRefs.current[d.date] = el; }} style={{ position: 'relative', marginBottom: 14, scrollMarginTop: 12 }}>
      <div style={{ position: 'absolute', left: -P, top: 0, width: anchorW, textAlign: 'right' }}>
        <div style={{ fontFamily: t.fontNumeric, fontSize: 19, fontWeight: 700, lineHeight: 1, color: t.text }}>{d.dayNum}</div>
        <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 3 }}>{d.weekday}</div>
      </div>
      <div style={{ position: 'absolute', left: nodeLeft, top: 5, width: NODE_D, height: NODE_D, borderRadius: 999, backgroundColor: t.card, border: `2.5px solid ${t.accent}`, zIndex: 2 }} />
      <div className="space-y-2.5">
        {renderDailyCard(d)}
        {d.weekly.map(renderWeeklyCard)}
        {d.monthly.map(renderMonthlyCard)}
      </div>
    </div>
  );

  const noRecords = items.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: t.bg }}>
      {/* 상단: 돌아가기 + 타이틀 */}
      <div className="flex items-center gap-2 px-4 lg:px-6 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.borderLight}` }}>
        <button onClick={onClose} className="flex items-center gap-1 p-1 -ml-1" style={{ fontSize: 14, color: t.textSub, fontWeight: 600 }}>
          <ChevronLeft size={20} /> 돌아가기
        </button>
        <h1 className="mx-auto" style={{ fontSize: 17, fontWeight: 700, color: t.text, fontFamily: t.fontPageTitle }}>돌아보기</h1>
        <span style={{ width: 72 }} />
      </div>

      {/* 검색 + 필터 (본문과 같은 폭으로 중앙 정렬) */}
      <div className="px-4 lg:px-6 pt-3 pb-2 flex-shrink-0">
        <div className="mx-auto w-full space-y-2.5" style={{ maxWidth: CONTENT_MAX }}>
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          <Search size={16} style={{ color: t.textMuted, flexShrink: 0 }} />
          <input value={rawQuery} onChange={e => setRawQuery(e.target.value)} autoFocus
            placeholder="기록 전체에서 검색" className="flex-1 py-2.5 outline-none bg-transparent min-w-0"
            style={{ fontSize: 14, color: t.text }} />
          {rawQuery && (
            <button onClick={() => setRawQuery('')} className="flex-shrink-0" style={{ color: t.textMuted }}><X size={15} /></button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {ARCHIVE_FILTERS.map(f => {
            const on = typeFilter === f.key;
            const dot = f.key === 'all' ? null : kindMeta[f.key as ArchiveKind].color;
            return (
              <button key={f.key} onClick={() => setTypeFilter(f.key)} className="rounded-full flex-shrink-0 flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: on ? 600 : 400, padding: '5px 11px', whiteSpace: 'nowrap',
                  backgroundColor: on ? t.accent : t.surfaceMuted, color: on ? '#fff' : t.textSub, border: `1px solid ${on ? t.accent : t.borderLight}` }}>
                {dot && <span style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: on ? '#fff' : dot, flexShrink: 0 }} />}
                {f.label}
              </button>
            );
          })}
          {years.length > 0 && (
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="rounded-full flex-shrink-0 outline-none"
              style={{ fontSize: 12, padding: '5px 11px', backgroundColor: t.surfaceMuted, color: t.textSub, border: `1px solid ${t.borderLight}` }}>
              <option value="all">전체 연도</option>
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          )}
        </div>
        </div>
      </div>

      {/* 결과 — 세로 타임라인 */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-3">
        <div className="mx-auto" style={{ maxWidth: CONTENT_MAX }}>
          {/* 히트맵 — 조건부(연도 기록이 HEATMAP_MIN_RECORDS 이상일 때만) */}
          {heatmap && (
            <div className="rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: 14, marginBottom: 6 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 11 }}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  {/* 연도 ‹ › — 넘어갈 다른 연도가 있을 때만 노출(연도 하나뿐이면 죽은 버튼 대신 라벨만) */}
                  {(olderYear || newerYear) && (
                    <button onClick={() => olderYear && goHeatmapYear(olderYear)} disabled={!olderYear}
                      aria-label="이전 연도" style={{ ...periodStepperStyle(t, !olderYear), width: 24, height: 24 }}>
                      <ChevronLeft size={15} />
                    </button>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: t.fontNumeric }}>
                    {heatmap.targetYear}년 기록
                  </span>
                  {(olderYear || newerYear) && (
                    <button onClick={() => newerYear && goHeatmapYear(newerYear)} disabled={!newerYear}
                      aria-label="다음 연도" style={{ ...periodStepperStyle(t, !newerYear), width: 24, height: 24 }}>
                      <ChevronRight size={15} />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: 11, color: t.textMuted }}>
                  <b style={{ fontFamily: t.fontNumeric, color: t.text, fontSize: 13 }}>{heatmap.yearCount}</b>건
                </span>
              </div>
              {/* 1년치 격자 — CONTENT_MAX 안에 다 들어오게 칸을 작게(PC 가로 스크롤 없음). 좁은 모바일에서만 가로 스크롤. */}
              <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
                <div style={{ display: 'flex', gap: HM_GAP, width: 'max-content' }}>
                  {heatmap.weeks.map((col, ci) => (
                    <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: HM_GAP }}>
                      {col.map((cell, ri) => {
                        const clickable = cell.inYear && cell.count > 0;
                        const bg = !cell.inYear ? 'transparent'
                          : cell.count === 0 ? t.surfaceMuted
                          : withAlpha(t.accent, cell.count === 1 ? 0.3 : cell.count === 2 ? 0.5 : cell.count <= 4 ? 0.72 : 1);
                        return (
                          <button key={ri} disabled={!clickable}
                            onClick={() => dayRefs.current[cell.dstr]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            title={cell.inYear ? `${cell.dstr} · ${cell.count}건` : undefined}
                            style={{ width: HM_CELL, height: HM_CELL, borderRadius: 2.5, backgroundColor: bg, border: 'none', padding: 0, cursor: clickable ? 'pointer' : 'default' }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end" style={{ gap: 4, marginTop: 8, fontSize: 10, color: t.textMuted }}>
                적음
                {[t.surfaceMuted, withAlpha(t.accent, 0.3), withAlpha(t.accent, 0.5), withAlpha(t.accent, 0.72), t.accent].map((c, i) => (
                  <span key={i} style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: c }} />
                ))}
                많음
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="text-center" style={{ padding: '48px 20px' }}>
              <div style={{ fontSize: 30, marginBottom: 12 }}>{noRecords ? '🌱' : '🔍'}</div>
              <p style={{ fontSize: 14, color: t.textSub, lineHeight: 1.7 }}>
                {noRecords ? (
                  <>아직 돌아볼 기록이 없어요.<br />일간 탭에서 감사·좋았던 순간·KPT를 남기면<br />여기 시간순으로 쌓여요.</>
                ) : (
                  <>{query ? `‘${query}’에 ` : ''}해당하는 기록이 없어요.<br />검색어나 필터를 바꿔보세요.</>
                )}
              </p>
              {noRecords && (
                <button onClick={() => onJump('day', getLogicalToday())} className="mt-4 rounded-xl"
                  style={{ padding: '9px 16px', backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
                  일간 탭에서 회고 남기기 →
                </button>
              )}
            </div>
          ) : (
            groups.map(m => (
              <div key={m.monthKey}>
                {/* 월 헤더 — 월이 바뀔 때 구분 */}
                <div className="flex items-baseline gap-2" style={{ margin: '22px 0 10px', paddingLeft: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: t.text, fontFamily: t.fontPageTitle }}>{m.label}</span>
                  <span style={{ fontSize: 11.5, color: t.textMuted }}>{m.count}건</span>
                </div>
                {/* 타임라인 축 + 하루들 */}
                <div style={{ position: 'relative', paddingLeft: P }}>
                  <div style={{ position: 'absolute', left: axisLeft, top: 6, bottom: 6, width: 1.5, backgroundColor: t.borderLight }} />
                  {m.days.map(renderDay)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function ReviewsView() {
  const { reviewRecords } = usePlanner();
  const { t } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // 'list' 는 탭 UI 에서 제거되었지만 과거 기록 승계 대비로 union·블록은 보존(진입 불가)
  const [tab, setTab] = useState<'day' | 'week' | 'month' | 'list'>('day');
  const [archiveOpen, setArchiveOpen] = useState(false);
  // 카드 → 원본 점프: 대상 탭으로 전환하며 날짜/주/달을 주입(nonce 로 동일값 재점프도 트리거)
  const [jump, setJump] = useState<{ date: string; nonce: number } | null>(null);

  const handleJump = useCallback((target: 'day' | 'week' | 'month', date: string) => {
    setArchiveOpen(false);
    setTab(target);
    setJump(prev => ({ date, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const tabs = [
    { key: 'day', label: '일간' },
    { key: 'week', label: '주간' },
    { key: 'month', label: '월간' },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto">
      {archiveOpen && <ArchiveOverlay onClose={() => setArchiveOpen(false)} onJump={handleJump} />}
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: t.fontPageTitle }}>리뷰 & 기록</h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>매일의 기록이 성장의 발판이 됩니다</p>
        </div>
        {/* 🔍 돌아보기 아카이브 — PC는 텍스트 알약 / 모바일은 아이콘만 */}
        <button type="button" onClick={() => setArchiveOpen(true)} title="돌아보기 · 검색"
          className="flex items-center justify-center gap-1.5 transition-colors"
          style={isDesktop
            ? { height: 40, padding: '0 16px', borderRadius: 999, backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600 }
            : { width: 38, height: 38, borderRadius: 12, backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}`, color: t.textSub }}>
          <Search size={isDesktop ? 16 : 17} />
          {isDesktop && <span>돌아보기</span>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 mb-4">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className="px-4 py-2 rounded-xl transition-all"
            style={{
              fontSize: 13, fontWeight: tab === tb.key ? 600 : 400,
              backgroundColor: tab === tb.key ? t.accent : t.surfaceMuted,
              color: tab === tb.key ? '#fff' : t.textSub,
            }}>{tb.label}</button>
        ))}
      </div>

      <div className="px-6 pb-8">
        {/* 일간 탭 */}
        {tab === 'day' && <DayTab jump={jump} />}

        {/* List Tab — 진입 제거(보존). 후속 "돌아보기"에서 과거 daily/happiness 기록 승계 예정 */}
        {tab === 'list' && (
          <div className="space-y-3">
            {reviewRecords.length === 0 && (
              <p className="text-center py-8" style={{ fontSize: 13, color: t.textMuted }}>아직 기록이 없습니다</p>
            )}
            {[...reviewRecords].sort((a, b) => b.date.localeCompare(a.date)).map(record => (
              <div key={record.id} className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{record.date}</span>
                  <div className="flex gap-1">
                    {record.types.map(ty => {
                      const rt = RECORD_TYPES.find(r => r.key === ty);
                      return rt ? (
                        <span key={ty} className="px-2 py-0.5 rounded-full"
                          style={{ fontSize: 9, backgroundColor: t.accentLight, color: t.accent }}>
                          {rt.emoji} {rt.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
                {record.dailySummary && (
                  <p style={{ fontSize: 12, color: t.textSub }}>📔 {record.dailySummary}</p>
                )}
                {record.gratitude && record.gratitude.length > 0 && (
                  <p style={{ fontSize: 12, color: t.textSub }}>🙏 {record.gratitude.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 주간 탭 — 통계 정확화 + 회고(KPT) + 과거(월별 그룹·작년 비교) */}
        {tab === 'week' && <WeekTab jump={jump} />}

        {/* 월간 탭 — 자동집계 + 집중블록(주차) + 베스트(하이브리드 픽) + 회고 + 과거(연도별·작년 비교) */}
        {tab === 'month' && <MonthTab jump={jump} />}
      </div>
    </div>
  );
}
