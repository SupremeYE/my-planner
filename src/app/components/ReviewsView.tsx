import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Mic, Search, ChevronLeft, ChevronRight, Trash2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePlanner, ReviewRecord, getWeekKey, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { supabase } from '../../lib/supabase';
import { getCategoryEmoji, getMoodCategoryLabel, ENERGY_LABELS } from './MoodView';
import { format, addDays, subDays, subYears, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

// ─── 음성 입력 버튼 (기존 useVoiceInput 재사용) ───
function VoiceInputButton({
  onResult,
  disabled,
}: {
  onResult: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  const { status, startRecording, stopRecording, text, setText } = useVoiceInput();
  const isRec = status === 'recording';
  const isBusy = status === 'transcribing';

  useEffect(() => {
    if (text) {
      onResult(text);
      setText('');
    }
  }, [text, onResult, setText]);

  const toggle = async () => {
    if (isBusy) return;
    if (isRec) await stopRecording();
    else await startRecording();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isBusy}
      title={isRec ? '녹음 중지' : '음성으로 입력'}
      className="flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
      style={{
        width: 30,
        height: 30,
        backgroundColor: isRec ? '#fee2e2' : t.bgSub,
        border: `1px solid ${isRec ? '#fca5a5' : t.borderLight}`,
        color: isRec ? '#ef4444' : t.textMuted,
      }}
    >
      {isRec ? (
        <span
          className="animate-pulse rounded-full"
          style={{ width: 9, height: 9, backgroundColor: '#ef4444', display: 'block' }}
        />
      ) : (
        <Mic size={13} />
      )}
    </button>
  );
}

// label + VoiceInputButton을 한 줄에 나란히
function LabelRow({ label, labelColor, onVoiceResult }: {
  label: string;
  labelColor?: string;
  onVoiceResult: (text: string) => void;
}) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between mb-1">
      <label style={{ fontSize: 11, color: labelColor ?? t.textSub, fontWeight: 600 }}>{label}</label>
      <VoiceInputButton onResult={onVoiceResult} />
    </div>
  );
}

const RECORD_TYPES = [
  { key: 'gratitude', emoji: '🙏', label: '감사 일기' },
  { key: 'kpt', emoji: '🔄', label: 'KPT 회고' },
  { key: 'happiness', emoji: '✨', label: '행복 기록' },
  { key: 'daily', emoji: '📔', label: '데일리 리뷰' },
];

// 본문(감사·KPT) 입력 폰트 — 이 페이지 한정 NanumSquareRound
const BODY_FONT = 'var(--font-nanum-round)';

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
          건강 &gt; 컨디션에서 기록 <ChevronRight size={13} />
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

// ─── 과거 타임라인 카드 ───
function recordPreview(r: ReviewRecord): string {
  const g = (r.gratitude ?? []).filter(Boolean);
  if (g.length) return `🙏 ${g.join(', ')}`;
  const kpt = [r.kptKeep, r.kptProblem, r.kptTry].filter(Boolean).join(' · ');
  if (kpt) return `🔄 ${kpt}`;
  if (r.dailySummary) return `📔 ${r.dailySummary}`;
  return '';
}

function PastCard({ record, onSelect, anniversary }: {
  record: ReviewRecord; onSelect: (date: string) => void; anniversary?: boolean;
}) {
  const { t } = useTheme();
  const gCount = (record.gratitude ?? []).filter(Boolean).length;
  const hasKpt = !!(record.kptKeep || record.kptProblem || record.kptTry);
  const preview = recordPreview(record);
  return (
    <button onClick={() => onSelect(record.date)}
      className="w-full text-left p-3 rounded-xl transition-colors"
      style={{
        backgroundColor: anniversary ? t.accentLight : t.card,
        border: `1px solid ${anniversary ? t.accent : t.borderLight}`,
      }}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {anniversary && <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>🕰 1년 전 오늘</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
          {format(parseISO(record.date), 'M월 d일 (E)', { locale: ko })}
        </span>
        <div className="flex gap-1">
          {gCount > 0 && (
            <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.bgSub, color: t.textSub }}>감사 {gCount}</span>
          )}
          {hasKpt && (
            <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.bgSub, color: t.textSub }}>KPT</span>
          )}
        </div>
      </div>
      {preview && (
        <p style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
      )}
    </button>
  );
}

function PastTimeline({ dayDate, onSelect }: { dayDate: string; onSelect: (date: string) => void }) {
  const { t } = useTheme();
  const { reviewRecords } = usePlanner();

  const anniversaryDate = format(subYears(parseISO(dayDate), 1), 'yyyy-MM-dd');
  const anniversaryRec = reviewRecords.find(r => r.date === anniversaryDate);

  const recent = [...reviewRecords]
    .filter(r => r.date !== dayDate && r.date !== anniversaryDate && recordPreview(r))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
        <Clock size={13} /> 지난 기록
      </h3>
      {anniversaryRec && <PastCard record={anniversaryRec} onSelect={onSelect} anniversary />}
      {recent.length === 0 && !anniversaryRec ? (
        <p style={{ fontSize: 12, color: t.textMuted, padding: '12px 0' }}>아직 지난 기록이 없어요</p>
      ) : (
        recent.map(r => <PastCard key={r.id} record={r} onSelect={onSelect} />)
      )}
    </div>
  );
}

// ─── 일간 탭 ───
function DayTab() {
  const { reviewRecords, addReviewRecord, updateReviewRecord } = usePlanner();
  const { t } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const todayStr = getLogicalToday();
  const [dayDate, setDayDate] = useState(todayStr);

  const dayRecord = reviewRecords.find(r => r.date === dayDate);

  const [gratitude, setGratitude] = useState<string[]>(['', '', '']);
  const [kptKeep, setKptKeep] = useState('');
  const [kptProblem, setKptProblem] = useState('');
  const [kptTry, setKptTry] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  // 선택 날짜/레코드 변경 시 입력 상태 동기화
  useEffect(() => {
    setGratitude(dayRecord?.gratitude && dayRecord.gratitude.length ? dayRecord.gratitude : ['', '', '']);
    setKptKeep(dayRecord?.kptKeep || '');
    setKptProblem(dayRecord?.kptProblem || '');
    setKptTry(dayRecord?.kptTry || '');
  }, [dayDate, dayRecord?.id]);

  const goPrev = () => setDayDate(format(subDays(parseISO(dayDate), 1), 'yyyy-MM-dd'));
  const goNext = () => setDayDate(format(addDays(parseISO(dayDate), 1), 'yyyy-MM-dd'));

  const addGratitudeLine = () => setGratitude(prev => [...prev, '']);
  const removeGratitudeLine = (i: number) => setGratitude(prev => prev.filter((_, idx) => idx !== i));
  const setGratitudeLine = (i: number, v: string) =>
    setGratitude(prev => prev.map((g, idx) => idx === i ? v : g));
  const appendGratitudeVoice = (i: number, text: string) =>
    setGratitude(prev => prev.map((g, idx) => idx === i ? (g ? `${g} ${text}` : text) : g));

  const save = () => {
    const cleanGratitude = gratitude.map(g => g.trim()).filter(Boolean);
    const hasG = cleanGratitude.length > 0;
    const hasK = !!(kptKeep.trim() || kptProblem.trim() || kptTry.trim());
    // 기존 types 중 gratitude/kpt 외(happiness/daily)는 보존
    const otherTypes = (dayRecord?.types ?? []).filter(ty => ty !== 'gratitude' && ty !== 'kpt');
    const types = [...otherTypes, ...(hasG ? ['gratitude'] : []), ...(hasK ? ['kpt'] : [])];

    // 부분 업데이트(머지): gratitude/kpt 만 전송 → 과거 daily_*/happiness 보존(Stage 1)
    const data: Omit<ReviewRecord, 'id'> = {
      date: dayDate,
      types,
      gratitude: cleanGratitude,
      kptKeep: kptKeep,
      kptProblem: kptProblem,
      kptTry: kptTry,
    };
    if (dayRecord) updateReviewRecord(dayRecord.id, data);
    else addReviewRecord(data);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  const inputStyle = {
    borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13,
    fontFamily: BODY_FONT,
  };

  const writeCol = (
    <div className="space-y-4">
      {/* 컨디션 배지 */}
      <ConditionBadge date={dayDate} />

      {/* 감사 일기 */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🙏 감사 일기</h3>
        <div className="space-y-2">
          {gratitude.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: t.accent, fontWeight: 600, width: 16 }}>{i + 1}.</span>
              <input value={g} onChange={e => setGratitudeLine(i, e.target.value)}
                placeholder="오늘 감사한 것" className="flex-1 rounded-lg px-3 py-2 border outline-none min-w-0" style={inputStyle} />
              <VoiceInputButton onResult={text => appendGratitudeVoice(i, text)} />
              <button type="button" onClick={() => removeGratitudeLine(i)} title="이 줄 삭제"
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: 30, height: 30, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, color: t.textMuted }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addGratitudeLine}
          className="flex items-center gap-1 mt-3"
          style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>
          <Plus size={14} /> 한 줄 더 추가
        </button>
      </div>

      {/* KPT 회고 */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🔄 KPT 회고</h3>
        <div className={isDesktop ? 'grid grid-cols-3 gap-3' : 'space-y-3'}>
          <div>
            <LabelRow label="Keep (유지할 것)" labelColor="#006b62" onVoiceResult={text => setKptKeep(prev => prev ? `${prev} ${text}` : text)} />
            <textarea value={kptKeep} onChange={e => setKptKeep(e.target.value)} rows={isDesktop ? 4 : 2}
              className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
          </div>
          <div>
            <LabelRow label="Problem (문제점)" labelColor="#D4735A" onVoiceResult={text => setKptProblem(prev => prev ? `${prev} ${text}` : text)} />
            <textarea value={kptProblem} onChange={e => setKptProblem(e.target.value)} rows={isDesktop ? 4 : 2}
              className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
          </div>
          <div>
            <LabelRow label="Try (시도할 것)" labelColor="#7B9ED9" onVoiceResult={text => setKptTry(prev => prev ? `${prev} ${text}` : text)} />
            <textarea value={kptTry} onChange={e => setKptTry(e.target.value)} rows={isDesktop ? 4 : 2}
              className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
          </div>
        </div>
      </div>

      <button onClick={save}
        className="w-full py-3 rounded-xl transition-colors"
        style={{ fontSize: 14, fontWeight: 600, backgroundColor: savedFlash ? t.success : t.accent, color: '#fff' }}>
        {savedFlash ? '저장됨 ✓' : '저장하기'}
      </button>
    </div>
  );

  const dateNav = (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={goPrev} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setDayDate(todayStr)}
        style={{ fontSize: 15, fontWeight: 700, color: t.text, minWidth: 160, textAlign: 'center' }}>
        {format(parseISO(dayDate), 'M월 d일 EEEE', { locale: ko })}
        {dayDate !== todayStr && <span style={{ fontSize: 11, color: t.accent, marginLeft: 6 }}>오늘로</span>}
      </button>
      <button onClick={goNext} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  return (
    <div>
      {dateNav}
      {isDesktop ? (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">{writeCol}</div>
          <div className="flex-shrink-0" style={{ width: 320 }}>
            <div style={{ position: 'sticky', top: 12 }}>
              <PastTimeline dayDate={dayDate} onSelect={setDayDate} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {writeCol}
          <PastTimeline dayDate={dayDate} onSelect={setDayDate} />
        </div>
      )}
    </div>
  );
}

export function ReviewsView() {
  const {
    reviewRecords,
    weeklyReviews, addWeeklyReview, updateWeeklyReview,
    monthlyReviews, addMonthlyReview, updateMonthlyReview,
    habits, todos,
    appSettings,
  } = usePlanner();
  const { t } = useTheme();
  // 'list' 는 탭 UI 에서 제거되었지만 과거 기록 승계 대비로 union·블록은 보존(진입 불가)
  const [tab, setTab] = useState<'day' | 'week' | 'month' | 'list'>('day');

  const today = getLogicalToday();
  const currentWeekKey = getWeekKey(new Date());
  const currentMonth = format(new Date(), 'yyyy-MM');

  // Weekly review
  const weeklyReview = weeklyReviews.find(r => r.weekKey === currentWeekKey);
  const [wrGood, setWrGood] = useState(weeklyReview?.good || '');
  const [wrHard, setWrHard] = useState(weeklyReview?.hard || '');
  const [wrNext, setWrNext] = useState(weeklyReview?.nextWeek || '');
  const [wrKptKeep, setWrKptKeep] = useState('');
  const [wrKptProblem, setWrKptProblem] = useState('');
  const [wrKptTry, setWrKptTry] = useState('');
  const [wrHappiness, setWrHappiness] = useState('');

  useEffect(() => {
    setWrGood(weeklyReview?.good || '');
    setWrHard(weeklyReview?.hard || '');
    setWrNext(weeklyReview?.nextWeek || '');
  }, [weeklyReview?.id]);

  const saveWeeklyReview = () => {
    if (weeklyReview) updateWeeklyReview(weeklyReview.id, { good: wrGood, hard: wrHard, nextWeek: wrNext });
    else addWeeklyReview({ weekKey: currentWeekKey, good: wrGood, hard: wrHard, nextWeek: wrNext });
  };

  // Monthly review
  const monthlyReview = monthlyReviews.find(r => r.month === currentMonth);
  const [mrAchievement, setMrAchievement] = useState(monthlyReview?.achievement || '');
  const [mrFocus, setMrFocus] = useState(monthlyReview?.nextFocus || '');
  const [mrKptKeep, setMrKptKeep] = useState('');
  const [mrKptProblem, setMrKptProblem] = useState('');
  const [mrKptTry, setMrKptTry] = useState('');

  useEffect(() => {
    setMrAchievement(monthlyReview?.achievement || '');
    setMrFocus(monthlyReview?.nextFocus || '');
  }, [monthlyReview?.id]);

  const saveMonthlyReview = () => {
    if (monthlyReview) updateMonthlyReview(monthlyReview.id, { achievement: mrAchievement, nextFocus: mrFocus });
    else addMonthlyReview({ month: currentMonth, achievement: mrAchievement, nextFocus: mrFocus });
  };

  // Stats for weekly review
  const weekTodos = todos.filter(td => td.date && td.date >= today);
  const doneTodos = weekTodos.filter(td => td.status === 'done');
  const habitCheckedToday = habits.filter(h => h.checkedDates.includes(today)).length;
  const emotionAvg = reviewRecords.filter(r => r.emotion).length > 0
    ? (reviewRecords.filter(r => r.emotion).reduce((s, r) => s + (r.emotion || 0), 0) / reviewRecords.filter(r => r.emotion).length).toFixed(1)
    : '-';

  const tabs = [
    { key: 'day', label: '일간' },
    { key: 'week', label: '주간' },
    { key: 'month', label: '월간' },
  ] as const;

  const inputStyle = {
    borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>리뷰 & 기록</h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>매일의 기록이 성장의 발판이 됩니다</p>
        </div>
        {/* 🔍 검색 — Stage 5 에서 연결(현재 placeholder) */}
        <button type="button" disabled title="검색 (준비 중)"
          className="flex items-center justify-center rounded-xl"
          style={{ width: 38, height: 38, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, color: t.textMuted, opacity: 0.5, cursor: 'not-allowed' }}>
          <Search size={17} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 mb-4">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className="px-4 py-2 rounded-xl transition-all"
            style={{
              fontSize: 13, fontWeight: tab === tb.key ? 600 : 400,
              backgroundColor: tab === tb.key ? t.accent : t.bgSub,
              color: tab === tb.key ? '#fff' : t.textSub,
            }}>{tb.label}</button>
        ))}
      </div>

      <div className="px-6 pb-8">
        {/* 일간 탭 */}
        {tab === 'day' && <DayTab />}

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

        {/* Weekly Review Tab (기존 화면 유지) */}
        {tab === 'week' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: '집중 시간', value: '-', sub: '이번 주' },
                { label: '할일 완료율', value: `${weekTodos.length ? Math.round(doneTodos.length / weekTodos.length * 100) : 0}%`, sub: '이번 주' },
                { label: '습관 달성', value: `${habitCheckedToday}/${habits.length}`, sub: '오늘' },
                { label: '평균 감정', value: String(emotionAvg), sub: '전체' },
              ].map((s, i) => (
                <div key={i} className="p-3 rounded-xl text-center" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)', display: 'block' }}>{s.value}</span>
                  <span style={{ fontSize: 10, color: t.textMuted, display: 'block', marginTop: 2 }}>{s.label}</span>
                  <span style={{ fontSize: 9, color: t.accent }}>{s.sub}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>주간 리뷰 ({currentWeekKey})</h3>
              <div className="space-y-3">
                <div>
                  <LabelRow label="잘한 것" labelColor="#006b62" onVoiceResult={text => setWrGood(prev => prev ? `${prev} ${text}` : text)} />
                  <textarea value={wrGood} onChange={e => setWrGood(e.target.value)} rows={3}
                    className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                </div>
                <div>
                  <LabelRow label="어려웠던 점" labelColor="#D4735A" onVoiceResult={text => setWrHard(prev => prev ? `${prev} ${text}` : text)} />
                  <textarea value={wrHard} onChange={e => setWrHard(e.target.value)} rows={3}
                    className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                </div>
                <div>
                  <LabelRow label="다음 주 다짐" labelColor="#7B9ED9" onVoiceResult={text => setWrNext(prev => prev ? `${prev} ${text}` : text)} />
                  <textarea value={wrNext} onChange={e => setWrNext(e.target.value)} rows={3}
                    className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                </div>
              </div>

              {/* KPT 섹션 — 설정에서 ON 시 표시 */}
              {appSettings.showWeeklyKpt && (
                <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🔄 KPT 주간 회고</h3>
                  <div className="space-y-3">
                    <div>
                      <LabelRow label="Keep (유지할 것)" labelColor="#006b62" onVoiceResult={text => setWrKptKeep(prev => prev ? `${prev} ${text}` : text)} />
                      <textarea value={wrKptKeep} onChange={e => setWrKptKeep(e.target.value)} rows={2}
                        className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                    </div>
                    <div>
                      <LabelRow label="Problem (문제점)" labelColor="#D4735A" onVoiceResult={text => setWrKptProblem(prev => prev ? `${prev} ${text}` : text)} />
                      <textarea value={wrKptProblem} onChange={e => setWrKptProblem(e.target.value)} rows={2}
                        className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                    </div>
                    <div>
                      <LabelRow label="Try (시도할 것)" labelColor="#7B9ED9" onVoiceResult={text => setWrKptTry(prev => prev ? `${prev} ${text}` : text)} />
                      <textarea value={wrKptTry} onChange={e => setWrKptTry(e.target.value)} rows={2}
                        className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

              {/* 행복했던 일 섹션 — 설정에서 ON 시 표시 */}
              {appSettings.showWeeklyHappiness && (
                <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>✨ 이번 주 행복했던 일</h3>
                  <div className="flex items-end gap-2">
                    <textarea value={wrHappiness} onChange={e => setWrHappiness(e.target.value)}
                      placeholder="이번 주 행복했던 순간을 적어보세요" rows={3}
                      className="flex-1 rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                    <VoiceInputButton onResult={text => setWrHappiness(prev => prev ? `${prev} ${text}` : text)} />
                  </div>
                </div>
              )}

              <button onClick={saveWeeklyReview}
                className="w-full mt-4 py-2.5 rounded-xl"
                style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
                저장
              </button>
            </div>
          </div>
        )}

        {/* Monthly Review Tab (기존 화면 유지) */}
        {tab === 'month' && (
          <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>월간 리뷰 ({currentMonth})</h3>
            <div className="space-y-4">
              <div>
                <LabelRow label="가장 큰 성취" labelColor="#515f74" onVoiceResult={text => setMrAchievement(prev => prev ? `${prev} ${text}` : text)} />
                <textarea value={mrAchievement} onChange={e => setMrAchievement(e.target.value)}
                  placeholder="이번 달 가장 자랑스러운 성취는?" rows={4}
                  className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
              </div>
              <div>
                <LabelRow label="다음 달 집중할 것" labelColor="#7B9ED9" onVoiceResult={text => setMrFocus(prev => prev ? `${prev} ${text}` : text)} />
                <textarea value={mrFocus} onChange={e => setMrFocus(e.target.value)}
                  placeholder="다음 달에 집중하고 싶은 것은?" rows={4}
                  className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
              </div>
              {/* KPT 섹션 — 설정에서 ON 시 표시 */}
              {appSettings.showMonthlyKpt && (
                <div className="mt-2 space-y-3">
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>🔄 KPT 월간 회고</h4>
                  <div>
                    <LabelRow label="Keep" labelColor="#006b62" onVoiceResult={text => setMrKptKeep(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={mrKptKeep} onChange={e => setMrKptKeep(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                  <div>
                    <LabelRow label="Problem" labelColor="#D4735A" onVoiceResult={text => setMrKptProblem(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={mrKptProblem} onChange={e => setMrKptProblem(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                  <div>
                    <LabelRow label="Try" labelColor="#7B9ED9" onVoiceResult={text => setMrKptTry(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={mrKptTry} onChange={e => setMrKptTry(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                </div>
              )}
            </div>
            <button onClick={saveMonthlyReview}
              className="w-full mt-4 py-2.5 rounded-xl"
              style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
              저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
