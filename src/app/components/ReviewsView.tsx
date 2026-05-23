import React, { useRef, useState, useEffect } from 'react';
import { Plus, X, ChevronRight, Mic } from 'lucide-react';
import { usePlanner, ReviewRecord, WeeklyReview, MonthlyReview, EmotionLevel, getWeekKey } from '../store';
import { useTheme } from '../ThemeContext';
import { format } from 'date-fns';

// ─── 음성 입력 버튼 ───
function VoiceInputButton({
  onResult,
  disabled,
}: {
  onResult: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) return null;

  const toggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const text: string = e.results[0][0].transcript;
      onResult(text);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={isListening ? '녹음 중지' : '음성으로 입력'}
      className="flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
      style={{
        width: 30,
        height: 30,
        backgroundColor: isListening ? '#fee2e2' : t.bgSub,
        border: `1px solid ${isListening ? '#fca5a5' : t.borderLight}`,
        color: isListening ? '#ef4444' : t.textMuted,
      }}
    >
      {isListening ? (
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

const EMOTIONS: { level: EmotionLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '😞', label: '나쁨' },
  { level: 2, emoji: '😐', label: '별로' },
  { level: 3, emoji: '🙂', label: '보통' },
  { level: 4, emoji: '😊', label: '좋음' },
  { level: 5, emoji: '🤩', label: '최고' },
];

const RECORD_TYPES = [
  { key: 'emotion', emoji: '😊', label: '감정 기록' },
  { key: 'gratitude', emoji: '🙏', label: '감사 일기' },
  { key: 'kpt', emoji: '🔄', label: 'KPT 회고' },
  { key: 'happiness', emoji: '✨', label: '행복 기록' },
  { key: 'daily', emoji: '📔', label: '데일리 리뷰' },
];

export function ReviewsView() {
  const {
    reviewRecords, addReviewRecord, updateReviewRecord,
    weeklyReviews, addWeeklyReview, updateWeeklyReview,
    monthlyReviews, addMonthlyReview, updateMonthlyReview,
    habits, todos, selectedDate,
    appSettings,
  } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<'today' | 'list' | 'weekly' | 'monthly'>('today');

  const today = format(new Date(), 'yyyy-MM-dd');
  const currentWeekKey = getWeekKey(new Date());
  const currentMonth = format(new Date(), 'yyyy-MM');

  // Today's record
  const todayRecord = reviewRecords.find(r => r.date === today);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(todayRecord?.types || []);
  const [emotion, setEmotion] = useState<EmotionLevel>(todayRecord?.emotion || 3);
  const [emotionMemo, setEmotionMemo] = useState(todayRecord?.emotionMemo || '');
  const [gratitude, setGratitude] = useState<string[]>(todayRecord?.gratitude || ['', '', '']);
  const [kptKeep, setKptKeep] = useState(todayRecord?.kptKeep || '');
  const [kptProblem, setKptProblem] = useState(todayRecord?.kptProblem || '');
  const [kptTry, setKptTry] = useState(todayRecord?.kptTry || '');
  const [happiness, setHappiness] = useState(todayRecord?.happiness || '');
  const [dailySummary, setDailySummary] = useState(todayRecord?.dailySummary || '');
  const [dailyGood, setDailyGood] = useState(todayRecord?.dailyGood || '');
  const [dailyImprove, setDailyImprove] = useState(todayRecord?.dailyImprove || '');

  // Supabase 로드 완료 후 오늘 기록 state 동기화
  useEffect(() => {
    if (!todayRecord) return;
    setSelectedTypes(todayRecord.types || []);
    setEmotion(todayRecord.emotion || 3);
    setEmotionMemo(todayRecord.emotionMemo || '');
    setGratitude(todayRecord.gratitude || ['', '', '']);
    setKptKeep(todayRecord.kptKeep || '');
    setKptProblem(todayRecord.kptProblem || '');
    setKptTry(todayRecord.kptTry || '');
    setHappiness(todayRecord.happiness || '');
    setDailySummary(todayRecord.dailySummary || '');
    setDailyGood(todayRecord.dailyGood || '');
    setDailyImprove(todayRecord.dailyImprove || '');
  }, [todayRecord?.id]);

  const toggleType = (key: string) => {
    setSelectedTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const saveTodayRecord = () => {
    const data: Omit<ReviewRecord, 'id'> = {
      date: today,
      types: selectedTypes,
      emotion: selectedTypes.includes('emotion') ? emotion : undefined,
      emotionMemo: selectedTypes.includes('emotion') ? emotionMemo : undefined,
      gratitude: selectedTypes.includes('gratitude') ? gratitude.filter(g => g.trim()) : undefined,
      kptKeep: selectedTypes.includes('kpt') ? kptKeep : undefined,
      kptProblem: selectedTypes.includes('kpt') ? kptProblem : undefined,
      kptTry: selectedTypes.includes('kpt') ? kptTry : undefined,
      happiness: selectedTypes.includes('happiness') ? happiness : undefined,
      dailySummary: selectedTypes.includes('daily') ? dailySummary : undefined,
      dailyGood: selectedTypes.includes('daily') ? dailyGood : undefined,
      dailyImprove: selectedTypes.includes('daily') ? dailyImprove : undefined,
    };
    if (todayRecord) updateReviewRecord(todayRecord.id, data);
    else addReviewRecord(data);
  };

  // Weekly review
  const weeklyReview = weeklyReviews.find(r => r.weekKey === currentWeekKey);
  const [wrGood, setWrGood] = useState(weeklyReview?.good || '');
  const [wrHard, setWrHard] = useState(weeklyReview?.hard || '');
  const [wrNext, setWrNext] = useState(weeklyReview?.nextWeek || '');
  const [wrKptKeep, setWrKptKeep] = useState('');
  const [wrKptProblem, setWrKptProblem] = useState('');
  const [wrKptTry, setWrKptTry] = useState('');
  const [wrHappiness, setWrHappiness] = useState('');

  // Supabase 로드 완료 후 주간 리뷰 state 동기화
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

  // Supabase 로드 완료 후 월간 리뷰 state 동기화
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
    { key: 'today', label: '오늘 기록' },
    { key: 'list', label: '기록 목록' },
    { key: 'weekly', label: '주간 리뷰' },
    { key: 'monthly', label: '월간 리뷰' },
  ] as const;

  const inputStyle = {
    borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>리뷰 & 기록</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>매일의 기록이 성장의 발판이 됩니다</p>
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
        {/* Today Tab */}
        {tab === 'today' && (
          <div className="space-y-4">
            {/* Type selection */}
            <div className="grid grid-cols-5 gap-2">
              {RECORD_TYPES.map(rt => (
                <button key={rt.key} onClick={() => toggleType(rt.key)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                  style={{
                    backgroundColor: selectedTypes.includes(rt.key) ? t.accentLight : t.card,
                    border: `1px solid ${selectedTypes.includes(rt.key) ? t.accent : t.borderLight}`,
                  }}>
                  <span style={{ fontSize: 22 }}>{rt.emoji}</span>
                  <span style={{ fontSize: 10, color: selectedTypes.includes(rt.key) ? t.accent : t.textSub, fontWeight: 600 }}>{rt.label}</span>
                </button>
              ))}
            </div>

            {/* Emotion */}
            {selectedTypes.includes('emotion') && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>😊 감정 기록</h3>
                <div className="flex justify-center gap-4 mb-3">
                  {EMOTIONS.map(em => (
                    <button key={em.level} onClick={() => setEmotion(em.level)}
                      className="flex flex-col items-center gap-1 transition-transform"
                      style={{ transform: emotion === em.level ? 'scale(1.2)' : 'scale(1)' }}>
                      <span style={{ fontSize: emotion === em.level ? 32 : 24, opacity: emotion === em.level ? 1 : 0.5 }}>{em.emoji}</span>
                      <span style={{ fontSize: 10, color: emotion === em.level ? t.accent : t.textMuted }}>{em.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <textarea value={emotionMemo} onChange={e => setEmotionMemo(e.target.value)}
                    placeholder="오늘 기분은 어떤가요?" rows={2}
                    className="flex-1 rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  <VoiceInputButton onResult={text => setEmotionMemo(prev => prev ? `${prev} ${text}` : text)} />
                </div>
              </div>
            )}

            {/* Gratitude */}
            {selectedTypes.includes('gratitude') && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🙏 감사 일기</h3>
                {gratitude.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 12, color: t.accent, fontWeight: 600, width: 16 }}>{i + 1}.</span>
                    <input value={g} onChange={e => { const ng = [...gratitude]; ng[i] = e.target.value; setGratitude(ng); }}
                      placeholder="오늘 감사한 것" className="flex-1 rounded-lg px-3 py-2 border outline-none" style={inputStyle} />
                    <VoiceInputButton onResult={text => {
                      const ng = [...gratitude]; ng[i] = ng[i] ? `${ng[i]} ${text}` : text; setGratitude(ng);
                    }} />
                  </div>
                ))}
              </div>
            )}

            {/* KPT */}
            {selectedTypes.includes('kpt') && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🔄 KPT 회고</h3>
                <div className="space-y-3">
                  <div>
                    <LabelRow label="Keep (유지할 것)" labelColor="#006b62" onVoiceResult={text => setKptKeep(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={kptKeep} onChange={e => setKptKeep(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                  <div>
                    <LabelRow label="Problem (문제점)" labelColor="#D4735A" onVoiceResult={text => setKptProblem(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={kptProblem} onChange={e => setKptProblem(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                  <div>
                    <LabelRow label="Try (시도할 것)" labelColor="#7B9ED9" onVoiceResult={text => setKptTry(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={kptTry} onChange={e => setKptTry(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {/* Happiness */}
            {selectedTypes.includes('happiness') && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>✨ 행복 기록</h3>
                <div className="flex items-end gap-2">
                  <textarea value={happiness} onChange={e => setHappiness(e.target.value)}
                    placeholder="오늘 행복했던 순간을 적어보세요" rows={3}
                    className="flex-1 rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  <VoiceInputButton onResult={text => setHappiness(prev => prev ? `${prev} ${text}` : text)} />
                </div>
              </div>
            )}

            {/* Daily Review */}
            {selectedTypes.includes('daily') && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>📔 데일리 리뷰</h3>
                <div className="space-y-3">
                  <div>
                    <LabelRow label="한줄 요약" onVoiceResult={text => setDailySummary(prev => prev ? `${prev} ${text}` : text)} />
                    <input value={dailySummary} onChange={e => setDailySummary(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 border outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <LabelRow label="잘한 점" labelColor="#006b62" onVoiceResult={text => setDailyGood(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={dailyGood} onChange={e => setDailyGood(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                  <div>
                    <LabelRow label="개선할 점" labelColor="#D4735A" onVoiceResult={text => setDailyImprove(prev => prev ? `${prev} ${text}` : text)} />
                    <textarea value={dailyImprove} onChange={e => setDailyImprove(e.target.value)} rows={2}
                      className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {selectedTypes.length > 0 && (
              <button onClick={saveTodayRecord}
                className="w-full py-3 rounded-xl transition-colors"
                style={{ fontSize: 14, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
                저장하기
              </button>
            )}
          </div>
        )}

        {/* List Tab */}
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
                {record.emotion && (
                  <p style={{ fontSize: 12, color: t.textSub }}>{EMOTIONS[record.emotion - 1]?.emoji} {record.emotionMemo}</p>
                )}
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

        {/* Weekly Review Tab */}
        {tab === 'weekly' && (
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
                  <span style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif", display: 'block' }}>{s.value}</span>
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

        {/* Monthly Review Tab */}
        {tab === 'monthly' && (
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
