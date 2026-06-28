import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Check, ChevronDown, Compass, Loader2, Mic, NotebookPen, PenLine, Pencil, Plus, Shuffle, Square, Trash2, X } from 'lucide-react';
import { useTheme, type ThemeTokens } from '../ThemeContext';
import { db, type DiaryEntry, type JournalQuestion } from '../../lib/db';
import { getLogicalToday } from '../store';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useVoiceInput } from '../hooks/useVoiceInput';
import ConfirmModal from './ConfirmModal';

// 경과시간 m:ss 포맷
function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 탭 정의 — Stage 1 오늘 일기, Stage 2 질문일기, Stage 3 이날의 기억(5년 일기).
const TABS = [
  { key: 'today',    label: '오늘 일기' },
  { key: 'question', label: '질문일기' },
  { key: 'memory',   label: '이날의 기억' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const todayStr = () => getLogicalToday();

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
      {/* 모바일: px-4 단일 컬럼(기존 유지). PC: 다른 페이지처럼 가로폭 채움(좁은 600px 중앙 정렬 제거) */}
      <div className="w-full px-4 lg:px-10 pt-5 lg:pt-7 pb-24">
        {/* 헤더 */}
        <header className="mb-5">
          <div style={{ fontFamily: 'var(--font-script)', fontSize: 22, color: t.accent, lineHeight: 1 }}>my diary</div>
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
        {tab === 'memory'   && <MemoryTab />}
      </div>
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
// 줄 간격(32px)과 line-height(32px)를 정확히 일치시키고, 기본 패딩을 0으로 둬
// 글자 줄과 가로선의 위상을 맞춘다. background-attachment: local 로 스크롤 시에도
// 선이 글자를 따라가도록 한다(고정선과 글자가 어긋나 보이는 문제 방지).
// display:block 으로 inline-block 사이 공백(여분 줄)이 생기지 않게 한다.
const NOTE_LINE_H = 32;
function noteAreaStyle(t: ThemeTokens): React.CSSProperties {
  const lineColor = t.borderLight || t.border;
  return {
    display: 'block',
    width: '100%',
    resize: 'none',
    outline: 'none',
    border: 'none',
    padding: 0,
    backgroundColor: t.card,
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${NOTE_LINE_H - 1}px, ${lineColor} ${NOTE_LINE_H - 1}px, ${lineColor} ${NOTE_LINE_H}px)`,
    backgroundAttachment: 'local',
    fontFamily: 'var(--font-hand)',
    fontSize: 18,
    lineHeight: `${NOTE_LINE_H}px`,
    color: t.text,
  };
}

// 노트 줄 textarea — 빈 줄을 클릭하면 그 줄까지 줄바꿈을 채워 커서를 놓아
// 노트처럼 원하는 줄부터 작성할 수 있게 한다. (일반 textarea 는 첫 줄에서만 시작됨)
function LinedTextarea({
  value, onChange, onFocus, onBlur, placeholder, rows,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  rows: number;
}) {
  const { t } = useTheme();
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // 줄바꿈 패딩 후 커서를 원하는 위치로 이동(상태 반영 뒤)
  useEffect(() => {
    if (pendingCaret.current != null && ref.current) {
      const pos = pendingCaret.current;
      pendingCaret.current = null;
      ref.current.focus();
      ref.current.setSelectionRange(pos, pos);
    }
  }, [value]);

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const ta = ref.current;
    if (!ta) return;
    const y = e.clientY - ta.getBoundingClientRect().top + ta.scrollTop;
    const clickedLine = Math.floor(y / NOTE_LINE_H);
    const lineCount = ta.value === '' ? 0 : ta.value.split('\n').length;
    const lastLine = Math.max(lineCount - 1, 0);
    if (clickedLine > lastLine) {
      const next = ta.value + '\n'.repeat(clickedLine - lastLine);
      pendingCaret.current = next.length;
      onChange(next);
    }
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={handleClick}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={rows}
      style={noteAreaStyle(t)}
    />
  );
}

// ── 오늘 일기 탭 (자유일기) ───────────────────────────────────────────────────
// PC: 좌측 최근 일기 타임라인 + 우측 작성/읽기. 모바일: 주간 스트립 + 작성/읽기 + 최근(접기).
// 작성 = A 모드(줄 없음·점 질감·자동확장), 읽기 = D 모드(줄 친 종이).
// 동작: 빈 날짜 = 작성(A) / 기록 있는 날짜 = 읽기(D) → 수정 시 작성(A).
function TodayDiaryTab() {
  const { t } = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [recent, setRecent]     = useState<DiaryEntry[]>([]);
  const [writtenDates, setWrittenDates] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState<'read' | 'write'>('write');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [existingId, setExistingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; isCurrent: boolean } | null>(null);

  const loadedRef      = useRef('');   // 마지막 저장된 본문
  const loadedTitleRef = useRef('');   // 마지막 저장된 제목
  const editingRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  // 날짜 로드 — 기록이 있으면 읽기(D), 없으면 작성(A)
  const loadForDate = useCallback(async (date: string) => {
    setLoading(true);
    const entry = await db.diaryEntries.fetchFreeByDate(date);
    const text = entry?.content ?? '';
    const ttl = entry?.title ?? '';
    loadedRef.current = text;
    loadedTitleRef.current = ttl;
    setContent(text);
    setTitle(ttl);
    setExistingId(entry?.id ?? null);
    setMode(entry ? 'read' : 'write');
    setLoading(false);
  }, []);

  const loadRecent = useCallback(async () => {
    setRecent(await db.diaryEntries.listRecentFree(7));
  }, []);

  // 모바일 주간 스트립 '작성한 날' 점 — 선택 날짜가 속한 주(월~일)의 기록 날짜
  const loadWeekDots = useCallback(async (date: string) => {
    const start = startOfWeek(parseISO(date), { weekStartsOn: 1 });
    const dates = await db.diaryEntries.listFreeDatesBetween(
      format(start, 'yyyy-MM-dd'),
      format(addDays(start, 6), 'yyyy-MM-dd'),
    );
    setWrittenDates(new Set(dates));
  }, []);

  useEffect(() => { loadForDate(selectedDate); }, [selectedDate, loadForDate]);
  useEffect(() => { loadWeekDots(selectedDate); }, [selectedDate, loadWeekDots]);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  useRealtimeSync('diary_entries', () => {
    loadRecent();
    loadWeekDots(selectedDate);
    if (!editingRef.current) loadForDate(selectedDate);
  });

  // 저장(core) — 본문은 끝 공백/줄바꿈만 정리, 제목은 양끝 정리. 빈 입력이면 저장 안 함.
  const persist = useCallback(async (date: string, text: string, ttl: string): Promise<DiaryEntry | null> => {
    const body = text.replace(/\s+$/, '');
    const titleVal = ttl.trim();
    if (!body.trim() && !titleVal) return null;
    setSaveState('saving');
    const saved = await db.diaryEntries.upsertFree(date, body, titleVal || null);
    if (saved) setExistingId(saved.id);
    loadedRef.current = body;
    loadedTitleRef.current = titleVal;
    setSaveState('saved');
    loadRecent();
    loadWeekDots(date);
    setTimeout(() => setSaveState('idle'), 1500);
    return saved;
  }, [loadRecent, loadWeekDots]);

  // 자동 저장(안전망) — 작성 모드에서만 조용히 저장(모드 전환 X)
  useEffect(() => {
    if (loading || mode !== 'write') return;
    if (content.replace(/\s+$/, '') === loadedRef.current.replace(/\s+$/, '')
        && title.trim() === loadedTitleRef.current.trim()) return;
    const id = setTimeout(() => { persist(selectedDate, content, title); }, 1500);
    return () => clearTimeout(id);
  }, [content, title, selectedDate, loading, mode, persist]);

  // 저장 버튼 — 저장 후 읽기(D)로 전환
  const onSaveClick = async () => {
    const saved = await persist(selectedDate, content, title);
    if (saved) setMode('read');
  };

  const onPickDate = (date: string) => {
    setSelectedDate(date);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 삭제 실행 — 현재 편집 중인 날짜의 일기면 작성칸도 비우고 작성(A)으로.
  const doDelete = async () => {
    if (!confirmDelete) return;
    const { id, isCurrent } = confirmDelete;
    setConfirmDelete(null);
    await db.diaryEntries.delete(id);
    if (isCurrent) {
      setContent('');
      setTitle('');
      loadedRef.current = '';
      loadedTitleRef.current = '';
      setExistingId(null);
      setMode('write');
    }
    loadRecent();
    loadWeekDots(selectedDate);
  };

  const hasInput = !!content.trim() || !!title.trim();
  const showRead = mode === 'read' && !!existingId;

  return (
    <div ref={topRef}>
      <div
        className="lg:grid lg:grid-cols-[290px_1fr] lg:rounded-2xl lg:overflow-hidden lg:border"
        style={{ borderColor: t.border }}
      >
        {/* ── PC 좌측: 최근 일기 타임라인 ── */}
        <aside
          className="hidden lg:block"
          style={{ borderRight: `1px solid ${t.border}`, background: t.bgSub, padding: '24px 22px 30px' }}
        >
          <RecentTimeline recent={recent} selectedDate={selectedDate} onPick={onPickDate} />
        </aside>

        {/* ── 메인: 작성/읽기 ── */}
        <section className="min-w-0 lg:px-8 lg:py-7">
          {/* 모바일 주간 스트립 */}
          <WeekStrip selectedDate={selectedDate} writtenDates={writtenDates} onPick={onPickDate} />

          {/* 날짜 헤더 + 달력 아이콘 */}
          <DateNav date={selectedDate} onChange={setSelectedDate} />

          {loading ? (
            <div className="py-16 text-center" style={{ color: t.textMuted, fontSize: 13 }}>불러오는 중...</div>
          ) : showRead ? (
            <ReadCard
              title={title}
              content={content}
              date={selectedDate}
              onEdit={() => setMode('write')}
              onDelete={existingId ? () => setConfirmDelete({ id: existingId, isCurrent: true }) : undefined}
            />
          ) : (
            <WriteCard
              title={title}
              content={content}
              onTitle={setTitle}
              onContent={setContent}
              onFocus={() => { editingRef.current = true; }}
              onBlur={() => { editingRef.current = false; }}
              saveState={saveState}
              disabled={!hasInput}
              onSave={onSaveClick}
              onDelete={existingId ? () => setConfirmDelete({ id: existingId, isCurrent: true }) : undefined}
            />
          )}

          {/* 모바일 최근 일기(접기/펼치기) */}
          <MobileRecent recent={recent} selectedDate={selectedDate} onPick={onPickDate} />
        </section>
      </div>

      {confirmDelete && (
        <ConfirmModal
          message="이 일기를 삭제할까요?"
          description="삭제한 일기는 되돌릴 수 없어요."
          confirmText="삭제"
          confirmDanger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ── 작성 영역 자동 확장 textarea (A 모드 본문) ────────────────────────────────
// 입력/마운트/값 로드 시 height='auto' → scrollHeight 로 자동 확장. overflow:hidden.
// forwardRef — 음성 변환 텍스트를 현재 커서 위치에 삽입하기 위해 외부에서 ref 접근.
const AutoGrowTextarea = React.forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}>(function AutoGrowTextarea({ value, onChange, onFocus, onBlur, placeholder }, ref) {
  const { t } = useTheme();
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={innerRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={4}
      style={{
        display: 'block',
        width: '100%',
        resize: 'none',
        outline: 'none',
        border: 'none',
        background: 'transparent',
        padding: 0,
        margin: 0,
        overflow: 'hidden',
        fontFamily: 'var(--font-hand)',
        fontSize: 18,
        lineHeight: `${NOTE_LINE_H}px`,
        color: t.text,
        minHeight: NOTE_LINE_H * 5,
      }}
    />
  );
});

// ── 작성 카드 (A 모드: 줄 없음 · 옅은 점 질감 · 둥근 카드) ─────────────────────
function WriteCard({
  title, content, onTitle, onContent, onFocus, onBlur, saveState, disabled, onSave, onDelete,
}: {
  title: string;
  content: string;
  onTitle: (v: string) => void;
  onContent: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  saveState: 'idle' | 'saving' | 'saved';
  disabled: boolean;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTheme();
  // 점 질감 — 골드(accent) 아주 옅게(약 10%). 토큰 hex 에 알파 8자리로 부여.
  const dot = `${t.accent}1A`;

  const taRef = useRef<HTMLTextAreaElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { status, elapsedMs, error, setError, startRecording, stopRecording, cancel, analyserRef } = useVoiceInput();

  // 변환된 텍스트를 현재 커서 위치(없으면 끝)에 삽입 → onContent 로 상태 갱신(자동 확장 따라감)
  const insertText = useCallback((text: string) => {
    if (!text) return;
    const ta = taRef.current;
    if (ta && ta.selectionStart != null) {
      const s = ta.selectionStart;
      const e = ta.selectionEnd ?? s;
      const before = content.slice(0, s);
      const after = content.slice(e);
      const sep = before && !/\s$/.test(before) ? ' ' : '';
      const next = before + sep + text + after;
      onContent(next);
      // 삽입 후 커서를 삽입 끝으로
      const caret = (before + sep + text).length;
      requestAnimationFrame(() => { try { ta.focus(); ta.setSelectionRange(caret, caret); } catch { /* noop */ } });
    } else {
      const sep = content && !/\s$/.test(content) ? ' ' : '';
      onContent(content + sep + text);
    }
  }, [content, onContent]);

  // PC: 버튼 한 번으로 시작/중지 토글
  const onPcMic = useCallback(async () => {
    if (status === 'idle' || status === 'error') { await startRecording(); }
    else if (status === 'recording') { const text = await stopRecording(); insertText(text); }
  }, [status, startRecording, stopRecording, insertText]);

  // 모바일: 플로팅 마이크 → 권한·시작 성공 시 녹음 시트 오픈
  const onMobileMic = useCallback(async () => {
    if (status !== 'idle' && status !== 'error') return;
    const ok = await startRecording();
    if (ok) setSheetOpen(true);
  }, [status, startRecording]);

  // 모바일 시트: 중지하고 변환 → 본문 삽입 후 시트 닫기
  const onSheetStop = useCallback(async () => {
    const text = await stopRecording();
    setSheetOpen(false);
    insertText(text);
  }, [stopRecording, insertText]);

  const onSheetCancel = useCallback(() => {
    cancel();
    setSheetOpen(false);
  }, [cancel]);

  const recording = status === 'recording';
  const transcribing = status === 'transcribing';

  // PC 마이크 버튼 (툴바 좌측에 배치, 모바일은 숨김)
  const pcMic = (
    <button
      type="button"
      onClick={onPcMic}
      disabled={transcribing}
      className="hidden lg:inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors disabled:opacity-50"
      style={{
        border: `1px solid ${recording ? t.danger : t.border}`,
        backgroundColor: recording ? t.dangerLight : t.card,
        color: recording ? t.danger : t.textSub,
      }}
    >
      {transcribing ? (
        <><Loader2 size={15} className="animate-spin" /> 변환 중...</>
      ) : recording ? (
        <><span className="rounded-full animate-pulse" style={{ width: 8, height: 8, background: t.danger }} /> 듣고 있어요 · {fmtElapsed(elapsedMs)}</>
      ) : (
        <><Mic size={15} style={{ color: t.danger }} /> 음성으로 쓰기</>
      )}
    </button>
  );

  return (
    <>
      <div className="relative">
        <div
          className="rounded-2xl p-5 pb-14 lg:pb-5"
          style={{
            border: `1px solid ${t.border}`,
            backgroundColor: t.card,
            backgroundImage: `radial-gradient(${dot} 1px, transparent 1px)`,
            backgroundSize: '7px 7px',
          }}
        >
          {/* 제목(선택) — DM Serif, 하단 보더 */}
          <input
            value={title}
            onChange={e => onTitle(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="제목 (선택)"
            style={{
              display: 'block',
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              padding: '0 0 10px',
              marginBottom: 12,
              borderBottom: `1px solid ${t.border}`,
              fontFamily: "'DM Serif Display', serif",
              fontSize: 20,
              color: t.text,
            }}
          />
          {/* 본문 — 개구(Gaegu), 줄 없음, 자동 확장 */}
          <AutoGrowTextarea
            ref={taRef}
            value={content}
            onChange={onContent}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="오늘 하루는 어땠나요? 자유롭게 적어보세요..."
          />
        </div>

        {/* 모바일 플로팅 마이크 (작성칸 우하단) */}
        <button
          type="button"
          onClick={onMobileMic}
          disabled={status !== 'idle'}
          aria-label="음성으로 쓰기"
          className="lg:hidden absolute grid place-items-center rounded-full disabled:opacity-60"
          style={{
            right: 14, bottom: 14, width: 46, height: 46,
            background: t.danger, color: '#fff',
            boxShadow: `0 6px 16px ${t.danger}66`,
          }}
        >
          {transcribing ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
        </button>
      </div>

      <SaveToolbar t={t} saveState={saveState} disabled={disabled} onSave={onSave} onDelete={onDelete} extra={pcMic} />

      {/* 변환 중 안내(모바일 시트가 닫혀 있어도 PC/모바일 공통 표시) */}
      {error && (
        <p className="mt-2 text-sm" style={{ color: t.danger }}>
          {error}{' '}
          <button type="button" onClick={() => setError(null)} className="underline" style={{ color: t.textMuted }}>닫기</button>
        </p>
      )}

      {/* 모바일 녹음 시트 */}
      {sheetOpen && (
        <VoiceSheet
          analyserRef={analyserRef}
          recording={recording}
          transcribing={transcribing}
          elapsedMs={elapsedMs}
          onStop={onSheetStop}
          onCancel={onSheetCancel}
        />
      )}
    </>
  );
}

// ── 저장 툴바 (coral 저장 버튼 + 저장 상태 + 삭제, 좌측 extra 슬롯) ─────────────
function SaveToolbar({
  t, saveState, disabled, onSave, onDelete, extra,
}: {
  t: ThemeTokens;
  saveState: 'idle' | 'saving' | 'saved';
  disabled: boolean;
  onSave: () => void;
  onDelete?: () => void;
  extra?: React.ReactNode;   // 음성으로 쓰기(PC) 등 좌측 추가 액션
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <div className="flex items-center gap-2">
        {extra}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm"
            style={{ color: t.textMuted }}
          >
            <Trash2 size={14} /> 삭제
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 12, color: t.textMuted }}>
          {saveState === 'saving' ? '저장 중...' : saveState === 'saved' ? '저장됨' : ''}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saveState === 'saving'}
          className="flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ backgroundColor: t.danger, color: '#fff', boxShadow: `0 6px 16px ${t.danger}4D` }}
        >
          <Check size={15} /> 저장
        </button>
      </div>
    </div>
  );
}

// ── 파형 비주얼라이저 (AnalyserNode 데이터로 막대 높이 구동) ───────────────────
function WaveBars({
  analyserRef, active,
}: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  active: boolean;
}) {
  const { t } = useTheme();
  const BARS = 24;
  const barsRef = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    let raf = 0;
    let buf: Uint8Array | null = null;
    const tick = () => {
      const an = analyserRef.current;
      if (an && active) {
        if (!buf || buf.length !== an.frequencyBinCount) buf = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(buf);
        const bins = buf.length;
        for (let i = 0; i < BARS; i++) {
          const idx = Math.min(bins - 1, Math.floor((i / BARS) * bins));
          const v = buf[idx] / 255;           // 0..1
          const h = 6 + v * 44;               // 6~50px
          const el = barsRef.current[i];
          if (el) el.style.height = `${h}px`;
        }
      } else {
        for (let i = 0; i < BARS; i++) {
          const el = barsRef.current[i];
          if (el) el.style.height = '8px';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, active]);
  return (
    <div className="flex items-center justify-center gap-1" style={{ height: 56 }}>
      {Array.from({ length: BARS }).map((_, i) => (
        <div
          key={i}
          ref={el => { barsRef.current[i] = el; }}
          style={{ width: 5, height: 8, borderRadius: 3, background: t.danger, transition: 'height .08s linear' }}
        />
      ))}
    </div>
  );
}

// ── 모바일 녹음 시트 (큰 마이크 + 파형 + 경과시간 + 중지하고 변환) ──────────────
function VoiceSheet({
  analyserRef, recording, transcribing, elapsedMs, onStop, onCancel,
}: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  recording: boolean;
  transcribing: boolean;
  elapsedMs: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
      {/* dim — 변환 중이 아닐 때만 탭하면 취소 */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(60,53,46,0.32)' }}
        onClick={transcribing ? undefined : onCancel}
      />
      <div
        className="relative w-full rounded-t-3xl text-center"
        style={{ background: t.card, padding: '22px 22px 30px', boxShadow: '0 -8px 30px rgba(60,53,46,0.22)' }}
      >
        <div className="mx-auto mb-4 rounded-full" style={{ width: 38, height: 4, background: t.border }} />
        <WaveBars analyserRef={analyserRef} active={recording} />
        <div className="mx-auto my-3 grid place-items-center rounded-full" style={{ width: 70, height: 70, background: t.danger, boxShadow: `0 8px 22px ${t.danger}66` }}>
          {transcribing ? <Loader2 size={30} color="#fff" className="animate-spin" /> : <Mic size={30} color="#fff" fill="#fff" />}
        </div>
        <div className="mb-5" style={{ fontSize: 13, color: t.textSub }}>
          {transcribing
            ? '텍스트로 변환하고 있어요...'
            : <>듣고 있어요 · <b style={{ color: t.danger, fontVariantNumeric: 'tabular-nums' }}>{fmtElapsed(elapsedMs)}</b></>}
        </div>
        <button
          type="button"
          onClick={onStop}
          disabled={transcribing}
          className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-60"
          style={{ background: t.danger, color: '#fff' }}
        >
          {transcribing ? <><Loader2 size={15} className="animate-spin" /> 변환 중...</> : <><Square size={13} fill="#fff" /> 중지하고 변환</>}
        </button>
      </div>
    </div>
  );
}

// ── 읽기 카드 (D 모드: 줄 친 종이 · 읽기 전용) ────────────────────────────────
function ReadCard({
  title, content, date, onEdit, onDelete,
}: {
  title: string;
  content: string;
  date: string;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTheme();
  const dateText = format(parseISO(date), 'yyyy년 M월 d일 EEEE', { locale: ko });
  const lineColor = t.borderLight || t.border;
  return (
    <div className="rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, padding: '22px 24px' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          {title && (
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: t.text, marginBottom: 2 }}>
              {title}
            </h3>
          )}
          <div style={{ fontSize: 12, color: t.textMuted }}>{dateText}</div>
        </div>
        <div className="flex items-center gap-1 flex-none">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold"
            style={{ color: t.accent, backgroundColor: t.accentLight }}
          >
            <Pencil size={14} /> 수정
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg"
              style={{ color: t.textMuted }}
              aria-label="일기 삭제"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      {/* 줄 친 종이 — line-height 와 배경 줄 간격을 동일 px(32)로 맞춰 정렬이 깨지지 않음 */}
      <div
        style={{
          fontFamily: 'var(--font-hand)',
          fontSize: 18,
          lineHeight: `${NOTE_LINE_H}px`,
          color: t.text,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          backgroundImage: `linear-gradient(to bottom, transparent ${NOTE_LINE_H - 1}px, ${lineColor} ${NOTE_LINE_H - 1}px, ${lineColor} ${NOTE_LINE_H}px)`,
          backgroundSize: `100% ${NOTE_LINE_H}px`,
          backgroundPosition: '0 0',
          minHeight: NOTE_LINE_H * 4,
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ── 모바일 주간 날짜 스트립 (월~일 칩, 오늘 강조, 작성한 날 골드 점) ──────────────
function WeekStrip({
  selectedDate, writtenDates, onPick,
}: {
  selectedDate: string;
  writtenDates: Set<string>;
  onPick: (date: string) => void;
}) {
  const { t } = useTheme();
  const today = todayStr();
  const start = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-1 lg:hidden" style={{ scrollbarWidth: 'none' }}>
      {days.map(d => {
        const ds = format(d, 'yyyy-MM-dd');
        const sel = ds === selectedDate;
        const isToday = ds === today;
        const future = ds > today;
        const written = writtenDates.has(ds);
        return (
          <button
            key={ds}
            type="button"
            disabled={future}
            onClick={() => onPick(ds)}
            className="flex-none rounded-2xl text-center transition-colors"
            style={{
              width: 44,
              padding: '8px 0',
              border: `1px solid ${sel ? t.danger : isToday ? t.accent : t.border}`,
              backgroundColor: sel ? t.danger : t.card,
              opacity: future ? 0.4 : 1,
            }}
          >
            <div style={{ fontSize: 10, color: sel ? '#fff' : t.textMuted }}>
              {format(d, 'EEEEE', { locale: ko })}
            </div>
            <div
              className="relative"
              style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, marginTop: 2, color: sel ? '#fff' : t.text }}
            >
              {format(d, 'd')}
              {written && (
                <span
                  className="absolute rounded-full"
                  style={{ left: '50%', bottom: -7, width: 4, height: 4, transform: 'translateX(-50%)', background: sel ? '#fff' : t.accent }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── PC 좌측 최근 일기 타임라인 (세로 라인 + 날짜·제목·발췌) ──────────────────────
function RecentTimeline({
  recent, selectedDate, onPick,
}: {
  recent: DiaryEntry[];
  selectedDate: string;
  onPick: (date: string) => void;
}) {
  const { t } = useTheme();
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        최근 일기
      </div>
      {recent.length === 0 ? (
        <EmptyHint t={t} text="아직 작성한 일기가 없어요" />
      ) : (
        <div className="relative" style={{ paddingLeft: 16, marginTop: 16 }}>
          <span className="absolute" style={{ left: 4, top: 4, bottom: 4, width: 1.5, background: t.border }} />
          {recent.map(entry => {
            const { day, weekday } = dateLabel(entry.entryDate);
            const sel = entry.entryDate === selectedDate;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onPick(entry.entryDate)}
                className="relative block w-full text-left"
                style={{ paddingBottom: 16 }}
              >
                <span
                  className="absolute rounded-full"
                  style={{ left: -15, top: 4, width: 8, height: 8, background: sel ? t.danger : t.accent, border: `2px solid ${t.bgSub}` }}
                />
                <div style={{ fontSize: 11, color: t.textMuted }}>{day} · {weekday}</div>
                {entry.title && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: '1px 0 2px' }}>{entry.title}</div>
                )}
                <div style={excerptStyle(t)}>{entry.content}</div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── 모바일 최근 일기 (카드 + 접기/펼치기) ──────────────────────────────────────
function MobileRecent({
  recent, selectedDate, onPick,
}: {
  recent: DiaryEntry[];
  selectedDate: string;
  onPick: (date: string) => void;
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-8 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full"
        style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}
      >
        최근 일기
        <ChevronDown size={16} style={{ transition: 'transform .25s', transform: open ? 'none' : 'rotate(-90deg)' }} />
      </button>
      {open && (
        <div className="mt-3">
          {recent.length === 0 ? (
            <EmptyHint t={t} text="아직 작성한 일기가 없어요" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recent.map(entry => {
                const { day, weekday } = dateLabel(entry.entryDate);
                const sel = entry.entryDate === selectedDate;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onPick(entry.entryDate)}
                      className="w-full text-left rounded-2xl p-4"
                      style={{ backgroundColor: t.card, border: `1px solid ${sel ? t.danger : t.border}` }}
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <span style={{ fontSize: 11, color: t.textMuted }}>{day} · {weekday}</span>
                      </div>
                      {entry.title && (
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>{entry.title}</div>
                      )}
                      <div style={excerptStyle(t)}>{entry.content}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
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
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; isCurrent: boolean } | null>(null);

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
    const body = answer.replace(/\s+$/, '');   // 끝 공백/줄바꿈만 정리(앞쪽 줄 위치 보존)
    if (!currentQuestion || !body.trim()) return;
    setSaveState('saving');
    const qid = currentQuestion.id || null;
    const saved = await db.diaryEntries.upsertQuestion(selectedDate, qid, currentQuestion.text, body);
    if (saved) setExistingId(saved.id);
    loadedRef.current = body;
    setSaveState('saved');
    loadRecent();
    setTimeout(() => setSaveState('idle'), 1500);
  }, [answer, currentQuestion, selectedDate, loadRecent]);

  // 자동저장(debounce 1.5s)
  useEffect(() => {
    if (loading) return;
    if (answer.replace(/\s+$/, '') === loadedRef.current.replace(/\s+$/, '')) return;
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

  // 삭제 — 현재 편집 중인 날짜의 답변이면 작성칸을 비우고 질문을 다시 배정한다.
  const doDelete = async () => {
    if (!confirmDelete) return;
    const { id, isCurrent } = confirmDelete;
    setConfirmDelete(null);
    await db.diaryEntries.delete(id);
    if (isCurrent) {
      setAnswer('');
      loadedRef.current = '';
      setExistingId(null);
      setCurrentQuestion(resolveQuestionForDate(selectedDate));
    }
    loadRecent();
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

      {/* 답변 작성 영역 — 원하는 줄을 클릭해 작성 */}
      <div className="rounded-2xl p-4 mt-3" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <LinedTextarea
          value={answer}
          onChange={setAnswer}
          onFocus={() => { editingRef.current = true; }}
          onBlur={() => { editingRef.current = false; }}
          placeholder="오늘의 질문에 솔직하게 답해보세요..."
          rows={7}
        />
        <SaveRow
          t={t}
          saveState={saveState}
          disabled={!answer.trim() || !currentQuestion}
          onSave={save}
          onDelete={existingId ? () => setConfirmDelete({ id: existingId, isCurrent: true }) : undefined}
        />
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
                <li key={entry.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onPickRecent(entry.entryDate)}
                    className="w-full text-left rounded-2xl p-4 pr-12 transition-colors"
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
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ id: entry.id, isCurrent: entry.entryDate === selectedDate })}
                    className="absolute top-3 right-3 p-1.5 rounded-lg"
                    style={{ color: t.textMuted }}
                    aria-label="질문일기 삭제"
                  >
                    <Trash2 size={15} />
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

      {confirmDelete && (
        <ConfirmModal
          message="이 질문일기를 삭제할까요?"
          description="삭제한 답변은 되돌릴 수 없어요."
          confirmText="삭제"
          confirmDanger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
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

// ── 이날의 기억 탭 (5년 일기) ─────────────────────────────────────────────────
function MemoryTab() {
  const { t } = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DiaryEntry | null>(null);

  // 기준 날짜의 연/월/일
  const ref = useMemo(() => {
    const d = parseISO(selectedDate);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, [selectedDate]);

  // 1년 전 → 5년 전 순
  const years = useMemo(() => [1, 2, 3, 4, 5].map(n => ref.year - n), [ref.year]);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await db.diaryEntries.listOnThisDay(ref.month, ref.day, ref.year - 5, ref.year - 1);
    setEntries(list);
    setLoading(false);
  }, [ref.month, ref.day, ref.year]);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync('diary_entries', () => { load(); });

  // 연도별 그룹 (한 해에 자유·질문일기 둘 다 가능)
  const byYear = useMemo(() => {
    const m = new Map<number, DiaryEntry[]>();
    for (const e of entries) {
      const y = parseISO(e.entryDate).getFullYear();
      (m.get(y) ?? m.set(y, []).get(y)!).push(e);
    }
    return m;
  }, [entries]);

  const { day: dLabel } = dateLabel(selectedDate);
  const total = entries.length;

  return (
    <div className="flex flex-col">
      <DateNav date={selectedDate} onChange={setSelectedDate} />
      <p style={{ fontSize: 13, color: t.textSub, marginTop: -4, marginBottom: 16 }}>
        {dLabel}, 지난 해 오늘의 나
      </p>

      {loading ? (
        <div className="py-20 text-center" style={{ color: t.textMuted, fontSize: 13 }}>불러오는 중...</div>
      ) : total === 0 ? (
        // 1~5년 전 전부 비어 있을 때 안내
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center rounded-2xl"
          style={{ backgroundColor: t.card, border: `1px dashed ${t.border}`, color: t.textMuted }}
        >
          <CalendarDays size={36} strokeWidth={1.5} style={{ color: t.accent }} />
          <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub }}>
            매년 같은 날, 오늘의 기록이 이곳에 쌓여요.<br />5년 일기가 차곡차곡 완성됩니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {years.map(y => (
            <YearBlock
              key={y}
              year={y}
              yearsAgo={ref.year - y}
              items={byYear.get(y) ?? []}
              onOpen={setDetail}
            />
          ))}
        </div>
      )}

      {detail && (
        <MemoryDetailSheet
          entry={detail}
          onClose={() => setDetail(null)}
          onDeleted={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
}

// 연도 블록 — 연도 뱃지 + 그 해 기록 카드(없으면 흐린 빈 카드)
function YearBlock({
  year, yearsAgo, items, onOpen,
}: {
  year: number;
  yearsAgo: number;
  items: DiaryEntry[];
  onOpen: (e: DiaryEntry) => void;
}) {
  const { t } = useTheme();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5"
          style={{ fontSize: 12, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight }}
        >
          {yearsAgo}년 전
        </span>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, color: t.textSub }}>{year}</span>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-5 text-center"
          style={{ backgroundColor: t.card, border: `1px dashed ${t.border}`, color: t.textMuted, opacity: 0.7 }}
        >
          <p style={{ fontSize: 13 }}>이날의 기록이 아직 없어요</p>
        </div>
      ) : (
        items.map(e => <MemoryCard key={e.id} entry={e} onOpen={onOpen} />)
      )}
    </section>
  );
}

// 기록 카드 — type 뱃지 + (질문일기면 질문 문장) + 본문(개구, 발췌)
function MemoryCard({ entry, onOpen }: { entry: DiaryEntry; onOpen: (e: DiaryEntry) => void }) {
  const { t } = useTheme();
  const isQuestion = entry.type === 'question';
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="w-full text-left rounded-2xl p-4 transition-colors"
      style={{
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        borderLeft: `4px solid ${isQuestion ? t.danger : t.success}`,
      }}
    >
      <span
        className="inline-block rounded-full px-2.5 py-0.5 mb-2"
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: isQuestion ? t.danger : t.success,
          backgroundColor: isQuestion ? t.dangerLight : t.bgSub,
        }}
      >
        {isQuestion ? '질문일기' : '자유일기'}
      </span>
      {isQuestion && entry.questionText && (
        <p style={{ fontSize: 13, fontStyle: 'italic', color: t.textMuted, marginBottom: 4 }}>
          {entry.questionText}
        </p>
      )}
      {!isQuestion && entry.title && (
        <p style={{ fontFamily: 'var(--font-hand)', fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 2 }}>
          {entry.title}
        </p>
      )}
      <p style={excerptStyle(t)}>{entry.content}</p>
    </button>
  );
}

// 기록 상세 (읽기 전용 바텀시트/모달 + 삭제)
function MemoryDetailSheet({ entry, onClose, onDeleted }: { entry: DiaryEntry; onClose: () => void; onDeleted: () => void }) {
  const { t } = useTheme();
  const isQuestion = entry.type === 'question';
  const d = parseISO(entry.entryDate);
  const dateText = format(d, 'yyyy년 M월 d일 EEEE', { locale: ko });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async () => {
    setConfirming(false);
    await db.diaryEntries.delete(entry.id);
    onDeleted();
  };

  return (
    <>
    <div
      className="fixed inset-0 z-40 flex items-end lg:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={onClose}
    >
      <div
        className="relative w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
        style={{ background: t.bg, maxHeight: '88dvh' }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex-none px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex justify-center mb-3 lg:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <span
                className="inline-block rounded-full px-2.5 py-0.5 mb-1.5"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isQuestion ? t.danger : t.success,
                  backgroundColor: isQuestion ? t.dangerLight : t.bgSub,
                }}
              >
                {isQuestion ? '질문일기' : '자유일기'}
              </span>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: t.text }}>{dateText}</div>
            </div>
            <button onClick={onClose} className="flex-none p-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="닫기">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isQuestion && entry.questionText && (
            <p style={{ fontSize: 14, fontStyle: 'italic', color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
              {entry.questionText}
            </p>
          )}
          {!isQuestion && entry.title && (
            <p style={{ fontFamily: 'var(--font-hand)', fontSize: 22, fontWeight: 700, color: t.text, marginBottom: 8 }}>
              {entry.title}
            </p>
          )}
          <p style={{ fontFamily: 'var(--font-hand)', fontSize: 18, lineHeight: '32px', color: t.text, whiteSpace: 'pre-wrap' }}>
            {entry.content}
          </p>
          <div className="h-4" />
        </div>

        {/* 푸터 — 삭제 */}
        <div className="flex-none px-5 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ color: t.danger, backgroundColor: t.dangerLight }}
          >
            <Trash2 size={15} /> 삭제
          </button>
        </div>
      </div>
    </div>

    {confirming && (
      <ConfirmModal
        message="이 기록을 삭제할까요?"
        description="삭제한 일기는 되돌릴 수 없어요."
        confirmText="삭제"
        confirmDanger
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    )}
    </>
  );
}

// ── 작은 공용 조각 ────────────────────────────────────────────────────────────
function SaveRow({
  t, saveState, disabled, onSave, onDelete,
}: {
  t: ThemeTokens;
  saveState: 'idle' | 'saving' | 'saved';
  disabled: boolean;
  onSave: () => void;
  onDelete?: () => void;   // 이미 저장된 기록일 때만 전달 → 삭제 버튼 노출
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-3">
      {/* 좌측: 삭제(저장된 기록일 때만) */}
      <div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: t.textMuted }}
          >
            <Trash2 size={14} /> 삭제
          </button>
        )}
      </div>
      {/* 우측: 저장 상태 + 저장 */}
      <div className="flex items-center gap-3">
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
