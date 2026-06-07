import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Check, Compass, NotebookPen, PenLine, Plus, Shuffle, Trash2, X } from 'lucide-react';
import { useTheme, type ThemeTokens } from '../ThemeContext';
import { db, type DiaryEntry, type JournalQuestion } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// 탭 정의 — Stage 1 오늘 일기, Stage 2 질문일기. 이날의 기억은 Stage 3 placeholder.
const TABS = [
  { key: 'today',    label: '오늘 일기' },
  { key: 'question', label: '질문일기' },
  { key: 'memory',   label: '이날의 기억' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

// 날짜 라벨: "6월 7일 · 일요일"
function dateLabel(dateStr: string): { day: string; weekday: string } {
  const d = parseISO(dateStr);
  return {
    day: format(d, 'M월 d일', { locale: ko }),
    weekday: format(d, 'EEEE', { locale: ko }),
  };
}

// 날짜 문자열 → 안정적 정수 시드 (같은 날 같은 질문 유지용)
function hashDate(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── 메인 뷰 ──────────────────────────────────────────────────────────────────
export function DiaryView() {
  const { t } = useTheme();
  const [tab, setTab] = useState<TabKey>('today');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 탭 전환 시 스크롤 상단으로
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      <div className="mx-auto w-full lg:max-w-[600px] px-4 lg:px-6 pt-5 pb-24">
        {/* 헤더 */}
        <header className="mb-5">
          <div style={{ fontFamily: 'var(--font-gaegu)', fontSize: 16, color: t.textSub }}>my diary</div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: t.text, lineHeight: 1.1, marginTop: 2 }}>
            일기
          </h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>하루의 마음을 글로 남겨요</p>
        </header>

        {/* 탭 — 활성 탭 coral 언더라인 */}
        <nav className="flex gap-1 mb-6" style={{ borderBottom: `1px solid ${t.border}` }}>
          {TABS.map(item => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className="relative px-3 lg:px-4 py-2.5 text-sm transition-colors"
                style={{ color: active ? t.text : t.textMuted, fontWeight: active ? 700 : 500 }}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute left-0 right-0 rounded-full"
                    style={{ bottom: -1, height: 2.5, background: t.danger }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* 탭 콘텐츠 */}
        {tab === 'today'    && <TodayDiaryTab />}
        {tab === 'question' && <QuestionDiaryTab />}
        {tab === 'memory'   && <Placeholder t={t} />}
      </div>
    </div>
  );
}

// ── placeholder (이날의 기억) ─────────────────────────────────────────────────
function Placeholder({ t }: { t: ThemeTokens }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center" style={{ color: t.textMuted }}>
      <CalendarDays size={40} strokeWidth={1.5} />
      <p className="text-sm">준비 중 — 곧 추가됩니다</p>
    </div>
  );
}

// ── 공용 날짜 네비 (날짜 라벨 + 달력 + 우측 슬롯) ──────────────────────────────
function DateNav({ date, onChange, right }: { date: string; onChange: (d: string) => void; right?: React.ReactNode }) {
  const { t } = useTheme();
  const { day, weekday } = dateLabel(date);
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-baseline gap-2">
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: t.text }}>{day}</span>
        <span style={{ fontSize: 14, color: t.textSub }}>· {weekday}</span>
      </div>
      <div className="flex items-center gap-2">
        {right}
        <div className="relative">
          <button
            type="button"
            className="flex items-center justify-center rounded-xl"
            style={{ width: 40, height: 40, border: `1px solid ${t.border}`, color: t.textSub, backgroundColor: t.card }}
            aria-label="날짜 선택"
          >
            <CalendarDays size={18} />
          </button>
          {/* 투명 date input 오버레이 — 탭하면 네이티브 달력. 미래 날짜 차단(max) */}
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={e => { if (e.target.value) onChange(e.target.value); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="날짜 선택"
          />
        </div>
      </div>
    </div>
  );
}

// 노트 줄 배경 textarea 공용 스타일
function noteAreaStyle(t: ThemeTokens): React.CSSProperties {
  const lineColor = t.borderLight || t.border;
  return {
    width: '100%',
    resize: 'none',
    outline: 'none',
    background: `repeating-linear-gradient(${t.card}, ${t.card} 31px, ${lineColor} 31px, ${lineColor} 32px)`,
    fontFamily: 'var(--font-hand)',
    fontSize: 18,
    lineHeight: '32px',
    color: t.text,
  };
}

// ── 오늘 일기 탭 (자유일기) ───────────────────────────────────────────────────
function TodayDiaryTab() {
  const { t } = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [content, setContent]   = useState('');
  const [recent, setRecent]     = useState<DiaryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const loadedRef  = useRef('');
  const editingRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const loadForDate = useCallback(async (date: string) => {
    setLoading(true);
    const entry = await db.diaryEntries.fetchFreeByDate(date);
    const text = entry?.content ?? '';
    loadedRef.current = text;
    setContent(text);
    setLoading(false);
  }, []);

  const loadRecent = useCallback(async () => {
    setRecent(await db.diaryEntries.listRecentFree(7));
  }, []);

  useEffect(() => { loadForDate(selectedDate); }, [selectedDate, loadForDate]);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  useRealtimeSync('diary_entries', () => {
    loadRecent();
    if (!editingRef.current) loadForDate(selectedDate);
  });

  const save = useCallback(async (date: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaveState('saving');
    await db.diaryEntries.upsertFree(date, trimmed);
    loadedRef.current = trimmed;
    setSaveState('saved');
    loadRecent();
    setTimeout(() => setSaveState('idle'), 1500);
  }, [loadRecent]);

  useEffect(() => {
    if (loading) return;
    if (content.trim() === loadedRef.current.trim()) return;
    const id = setTimeout(() => { save(selectedDate, content); }, 1500);
    return () => clearTimeout(id);
  }, [content, selectedDate, loading, save]);

  const onPickRecent = (date: string) => {
    setSelectedDate(date);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col">
      <div ref={topRef} />

      <DateNav date={selectedDate} onChange={setSelectedDate} />

      {/* 작성 영역 — 노트 줄 배경 + 손글씨 폰트 */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onFocus={() => { editingRef.current = true; }}
          onBlur={() => { editingRef.current = false; }}
          placeholder="오늘 하루는 어땠나요? 자유롭게 적어보세요..."
          rows={9}
          style={noteAreaStyle(t)}
        />
        <SaveRow t={t} saveState={saveState} disabled={!content.trim()} onSave={() => save(selectedDate, content)} />
      </div>

      {/* 최근 일기 */}
      <section className="mt-8">
        <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>최근 일기</h2>
        {recent.length === 0 ? (
          <EmptyHint t={t} text="아직 작성한 일기가 없어요" />
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map(entry => {
              const { day: d, weekday: w } = dateLabel(entry.entryDate);
              const isSel = entry.entryDate === selectedDate;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onPickRecent(entry.entryDate)}
                    className="w-full text-left rounded-2xl p-4 transition-colors"
                    style={{ backgroundColor: t.card, border: `1px solid ${isSel ? t.danger : t.border}` }}
                  >
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{d}</span>
                      <span style={{ fontSize: 12, color: t.textMuted }}>{w}</span>
                    </div>
                    <p style={excerptStyle(t)}>{entry.content}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── 질문일기 탭 ───────────────────────────────────────────────────────────────
function QuestionDiaryTab() {
  const { t } = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [questions, setQuestions] = useState<JournalQuestion[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<JournalQuestion | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [recent, setRecent] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [exploreOpen, setExploreOpen] = useState(false);

  const loadedRef = useRef('');
  const editingRef = useRef(false);
  const recentRef = useRef<DiaryEntry[]>([]);
  const questionsRef = useRef<JournalQuestion[]>([]);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { recentRef.current = recent; }, [recent]);

  const lsKey = (date: string) => `diaryQuestion:${date}`;

  // 기본 질문 중 날짜 deterministic 선택(최근 답한 질문 가급적 제외) + localStorage 고정
  const resolveQuestionForDate = useCallback((date: string): JournalQuestion | null => {
    const all = questionsRef.current;
    const defaults = all.filter(q => q.isDefault);
    if (defaults.length === 0) return null;
    const saved = localStorage.getItem(lsKey(date));
    if (saved) {
      const found = all.find(q => q.id === saved);
      if (found) return found;
    }
    const recentIds = new Set(recentRef.current.map(r => r.questionId).filter(Boolean) as string[]);
    let pool = defaults.filter(q => !recentIds.has(q.id));
    if (pool.length === 0) pool = defaults;
    const q = pool[hashDate(date) % pool.length];
    localStorage.setItem(lsKey(date), q.id);
    return q;
  }, []);

  // 삭제된 질문 대비 스냅샷 표시용
  const syntheticFrom = (entry: DiaryEntry): JournalQuestion => ({
    id: entry.questionId ?? '',
    userId: null,
    category: '',
    categoryKo: '',
    text: entry.questionText ?? '(삭제된 질문)',
    isDefault: true,
    sortOrder: null,
    createdAt: '',
  });

  const loadForDate = useCallback(async (date: string) => {
    setLoading(true);
    const entry = await db.diaryEntries.fetchQuestionByDate(date);
    if (entry) {
      setExistingId(entry.id);
      setAnswer(entry.content);
      loadedRef.current = entry.content;
      const q = questionsRef.current.find(x => x.id === entry.questionId);
      setCurrentQuestion(q ?? syntheticFrom(entry));
    } else {
      setExistingId(null);
      setAnswer('');
      loadedRef.current = '';
      setCurrentQuestion(resolveQuestionForDate(date));
    }
    setLoading(false);
  }, [resolveQuestionForDate]);

  const loadRecent = useCallback(async () => {
    setRecent(await db.diaryEntries.listRecentQuestion(7));
  }, []);

  const loadQuestions = useCallback(async () => {
    const list = await db.journalQuestions.fetchAll();
    questionsRef.current = list;
    setQuestions(list);
    setQuestionsLoaded(true);
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useEffect(() => { loadRecent(); }, [loadRecent]);
  // 질문 목록이 준비된 뒤에만 날짜 로드(배정 로직이 질문 목록에 의존)
  useEffect(() => { if (questionsLoaded) loadForDate(selectedDate); }, [selectedDate, questionsLoaded, loadForDate]);

  useRealtimeSync('diary_entries', () => {
    loadRecent();
    if (!editingRef.current && questionsRef.current.length) loadForDate(selectedDate);
  });
  useRealtimeSync('journal_questions', () => { loadQuestions(); });

  const save = useCallback(async () => {
    const trimmed = answer.trim();
    if (!currentQuestion || !trimmed) return;
    setSaveState('saving');
    const qid = currentQuestion.id || null;
    const saved = await db.diaryEntries.upsertQuestion(selectedDate, qid, currentQuestion.text, trimmed);
    if (saved) setExistingId(saved.id);
    loadedRef.current = trimmed;
    setSaveState('saved');
    loadRecent();
    setTimeout(() => setSaveState('idle'), 1500);
  }, [answer, currentQuestion, selectedDate, loadRecent]);

  // 자동저장(debounce 1.5s)
  useEffect(() => {
    if (loading) return;
    if (answer.trim() === loadedRef.current.trim()) return;
    const id = setTimeout(() => { save(); }, 1500);
    return () => clearTimeout(id);
  }, [answer, loading, save]);

  // "다른 질문" — 아직 답하지 않은 날에만. 현재/최근 제외 랜덤.
  const shuffle = () => {
    const defaults = questions.filter(q => q.isDefault);
    if (defaults.length === 0) return;
    const recentIds = new Set(recent.map(r => r.questionId).filter(Boolean) as string[]);
    let pool = defaults.filter(q => q.id !== currentQuestion?.id && !recentIds.has(q.id));
    if (pool.length === 0) pool = defaults.filter(q => q.id !== currentQuestion?.id);
    if (pool.length === 0) pool = defaults;
    const q = pool[Math.floor(Math.random() * pool.length)];
    localStorage.setItem(lsKey(selectedDate), q.id);
    setCurrentQuestion(q);
  };

  // 질문 탐색에서 질문 선택 → 오늘의 질문으로 지정
  const selectQuestion = (q: JournalQuestion) => {
    localStorage.setItem(lsKey(selectedDate), q.id);
    setCurrentQuestion(q);
    // 이미 답한 같은 질문이면 답변 유지, 아니면 새로 작성
    setAnswer(existingId && currentQuestion?.id === q.id ? answer : '');
    loadedRef.current = existingId && currentQuestion?.id === q.id ? loadedRef.current : '';
    setExploreOpen(false);
  };

  const onPickRecent = (date: string) => {
    setSelectedDate(date);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col">
      <div ref={topRef} />

      <DateNav
        date={selectedDate}
        onChange={setSelectedDate}
        right={
          <button
            type="button"
            onClick={() => setExploreOpen(true)}
            className="flex items-center gap-1.5 rounded-xl px-3"
            style={{ height: 40, border: `1px solid ${t.border}`, color: t.textSub, backgroundColor: t.card, fontSize: 13, fontWeight: 600 }}
          >
            <Compass size={16} /> 질문 탐색
          </button>
        }
      />

      {/* 오늘의 질문 카드 */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.danger}` }}>
        <div className="flex items-center justify-between mb-2.5">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: t.danger }}>오늘의 질문</span>
          {currentQuestion?.categoryKo && (
            <span
              className="rounded-full px-2.5 py-0.5"
              style={{ fontSize: 11, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight }}
            >
              {currentQuestion.categoryKo}
            </span>
          )}
        </div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 21, lineHeight: 1.45, color: t.text }}>
          {currentQuestion ? currentQuestion.text : '질문을 불러오는 중...'}
        </p>
        {!existingId && currentQuestion && (
          <button
            type="button"
            onClick={shuffle}
            className="flex items-center gap-1.5 mt-3 rounded-lg px-3 py-1.5"
            style={{ fontSize: 13, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub }}
          >
            <Shuffle size={14} /> 다른 질문
          </button>
        )}
      </div>

      {/* 답변 작성 영역 */}
      <div className="rounded-2xl p-4 mt-3" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onFocus={() => { editingRef.current = true; }}
          onBlur={() => { editingRef.current = false; }}
          placeholder="오늘의 질문에 솔직하게 답해보세요..."
          rows={7}
          style={noteAreaStyle(t)}
        />
        <SaveRow t={t} saveState={saveState} disabled={!answer.trim() || !currentQuestion} onSave={save} />
      </div>

      {/* 지난 질문일기 */}
      <section className="mt-8">
        <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>지난 질문일기</h2>
        {recent.length === 0 ? (
          <EmptyHint t={t} text="아직 답한 질문이 없어요" />
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map(entry => {
              const { day: d, weekday: w } = dateLabel(entry.entryDate);
              const isSel = entry.entryDate === selectedDate;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onPickRecent(entry.entryDate)}
                    className="w-full text-left rounded-2xl p-4 transition-colors"
                    style={{ backgroundColor: t.card, border: `1px solid ${isSel ? t.danger : t.border}` }}
                  >
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{d}</span>
                      <span style={{ fontSize: 12, color: t.textMuted }}>{w}</span>
                    </div>
                    {entry.questionText && (
                      <p style={{ fontSize: 13, fontStyle: 'italic', color: t.textMuted, marginBottom: 4 }}>
                        {entry.questionText}
                      </p>
                    )}
                    <p style={excerptStyle(t)}>{entry.content}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {exploreOpen && (
        <ExploreSheet
          questions={questions}
          onClose={() => setExploreOpen(false)}
          onSelect={selectQuestion}
          onReloadQuestions={loadQuestions}
        />
      )}
    </div>
  );
}

// ── 질문 탐색 시트 ────────────────────────────────────────────────────────────
const ALL = '전체';
const CUSTOM = '나만의 질문';

function ExploreSheet({
  questions,
  onClose,
  onSelect,
  onReloadQuestions,
}: {
  questions: JournalQuestion[];
  onClose: () => void;
  onSelect: (q: JournalQuestion) => void;
  onReloadQuestions: () => void;
}) {
  const { t } = useTheme();
  const [filter, setFilter] = useState<string>(ALL);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 카테고리 칩 — 전체 / 나만의 질문 + 기본 질문 12 카테고리(등장 순)
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const q of questions) {
      if (q.isDefault && q.categoryKo && !seen.includes(q.categoryKo)) seen.push(q.categoryKo);
    }
    return [ALL, CUSTOM, ...seen];
  }, [questions]);

  const visible = useMemo(() => {
    if (filter === ALL) return questions;
    if (filter === CUSTOM) return questions.filter(q => !q.isDefault);
    return questions.filter(q => q.isDefault && q.categoryKo === filter);
  }, [questions, filter]);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    await db.journalQuestions.createCustom(newText.trim());
    setNewText('');
    onReloadQuestions();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await db.journalQuestions.delete(id);
    onReloadQuestions();
    setDeletingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end lg:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="relative w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
        style={{ background: t.bg, maxHeight: '88dvh', height: '88dvh' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex-none px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex justify-center mb-3 lg:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
          </div>
          <div className="flex items-center justify-between">
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: t.text }}>질문 탐색</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="닫기">
              <X size={18} />
            </button>
          </div>

          {/* 카테고리 필터칩 — 가로 스크롤 */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map(c => {
              const active = filter === c;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className="flex-none rounded-full px-3 py-1.5 transition-colors"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    color: active ? '#fff' : t.textSub,
                    backgroundColor: active ? t.accent : t.bgSub,
                    border: `1px solid ${active ? t.accent : t.border}`,
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 나만의 질문 추가 — '나만의 질문' 필터에서 */}
          {filter === CUSTOM && (
            <div className="rounded-2xl p-3 mb-4" style={{ background: t.card, border: `1px solid ${t.border}` }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 8 }}>나만의 질문 추가</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl px-3 py-2 outline-none"
                  style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, fontSize: 14 }}
                  placeholder="질문을 입력하세요..."
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                />
                <button
                  onClick={handleAdd}
                  disabled={adding || !newText.trim()}
                  className="flex items-center gap-1 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                  style={{ background: t.danger, color: '#fff' }}
                >
                  <Plus size={14} /> 추가
                </button>
              </div>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center" style={{ color: t.textMuted }}>
              <NotebookPen size={30} strokeWidth={1.5} />
              <p className="text-sm">
                {filter === CUSTOM ? '아직 추가한 나만의 질문이 없어요' : '질문이 없어요'}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map(q => (
                <li
                  key={q.id}
                  className="flex items-start gap-2 rounded-xl px-4 py-3 group"
                  style={{ background: t.card, border: `1px solid ${t.border}` }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(q)}
                    className="flex-1 text-left"
                    style={{ fontSize: 14, lineHeight: 1.5, color: t.text }}
                  >
                    {q.text}
                    {!q.isDefault && (
                      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 6 }}>✏️</span>
                    )}
                  </button>
                  {!q.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id}
                      className="flex-none p-1.5 rounded-lg"
                      style={{ color: t.textMuted }}
                      aria-label="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

// ── 작은 공용 조각 ────────────────────────────────────────────────────────────
function SaveRow({
  t, saveState, disabled, onSave,
}: {
  t: ThemeTokens;
  saveState: 'idle' | 'saving' | 'saved';
  disabled: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3 mt-3">
      <span style={{ fontSize: 12, color: t.textMuted }}>
        {saveState === 'saving' ? '저장 중...' : saveState === 'saved' ? '저장됨' : ''}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || saveState === 'saving'}
        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
        style={{ backgroundColor: t.danger, color: '#fff' }}
      >
        <Check size={15} /> 저장
      </button>
    </div>
  );
}

function EmptyHint({ t, text }: { t: ThemeTokens; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center" style={{ color: t.textMuted }}>
      <PenLine size={28} strokeWidth={1.5} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function excerptStyle(t: ThemeTokens): React.CSSProperties {
  return {
    fontFamily: 'var(--font-hand)',
    fontSize: 16,
    lineHeight: 1.5,
    color: t.textSub,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
}
