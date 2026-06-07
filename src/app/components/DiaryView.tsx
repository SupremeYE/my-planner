import React, { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, Check, NotebookPen, PenLine } from 'lucide-react';
import { useTheme, type ThemeTokens } from '../ThemeContext';
import { db, type DiaryEntry } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// 탭 정의 — Stage 1은 '오늘 일기'(자유일기)만 구현, 나머지는 placeholder.
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
        {tab === 'question' && <Placeholder t={t} icon="question" />}
        {tab === 'memory'   && <Placeholder t={t} icon="memory" />}
      </div>
    </div>
  );
}

// ── placeholder (질문일기 / 이날의 기억) ──────────────────────────────────────
function Placeholder({ t, icon }: { t: ThemeTokens; icon: 'question' | 'memory' }) {
  const Icon = icon === 'question' ? NotebookPen : CalendarDays;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center" style={{ color: t.textMuted }}>
      <Icon size={40} strokeWidth={1.5} />
      <p className="text-sm">준비 중 — 곧 추가됩니다</p>
    </div>
  );
}

// ── 오늘 일기 탭 (자유일기) ───────────────────────────────────────────────────
function TodayDiaryTab() {
  const { t } = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [content, setContent]   = useState('');
  const [recent, setRecent]     = useState<DiaryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // 마지막으로 로드/저장된 본문 — 불필요한 자동저장 방지용
  const loadedRef  = useRef('');
  // textarea 편집 중 여부 — Realtime 갱신이 입력 중 본문을 덮어쓰지 않게 함
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

  // Realtime — 다른 기기에서 저장 시 즉시 반영. 편집 중이면 현재 본문은 보존.
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

  // 자동저장(debounce 1.5s) — 로드 직후/변경 없음이면 skip
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

  const { day, weekday } = dateLabel(selectedDate);
  const lineColor = t.borderLight || t.border;

  return (
    <div className="flex flex-col">
      <div ref={topRef} />

      {/* 날짜 영역 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: t.text }}>{day}</span>
          <span style={{ fontSize: 14, color: t.textSub }}>· {weekday}</span>
        </div>
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
            value={selectedDate}
            max={todayStr()}
            onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="날짜 선택"
          />
        </div>
      </div>

      {/* 작성 영역 — 노트 줄 배경 + 손글씨 폰트 */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onFocus={() => { editingRef.current = true; }}
          onBlur={() => { editingRef.current = false; }}
          placeholder="오늘 하루는 어땠나요? 자유롭게 적어보세요..."
          rows={9}
          style={{
            width: '100%',
            resize: 'none',
            outline: 'none',
            background: `repeating-linear-gradient(${t.card}, ${t.card} 31px, ${lineColor} 31px, ${lineColor} 32px)`,
            fontFamily: 'var(--font-hand)',
            fontSize: 18,
            lineHeight: '32px',
            color: t.text,
          }}
        />
        <div className="flex items-center justify-end gap-3 mt-3">
          <span style={{ fontSize: 12, color: t.textMuted }}>
            {saveState === 'saving' ? '저장 중...' : saveState === 'saved' ? '저장됨' : ''}
          </span>
          <button
            type="button"
            onClick={() => save(selectedDate, content)}
            disabled={!content.trim() || saveState === 'saving'}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ backgroundColor: t.danger, color: '#fff' }}
          >
            <Check size={15} /> 저장
          </button>
        </div>
      </div>

      {/* 최근 일기 */}
      <section className="mt-8">
        <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>최근 일기</h2>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center" style={{ color: t.textMuted }}>
            <PenLine size={28} strokeWidth={1.5} />
            <p className="text-sm">아직 작성한 일기가 없어요</p>
          </div>
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
                    style={{
                      backgroundColor: t.card,
                      border: `1px solid ${isSel ? t.danger : t.border}`,
                    }}
                  >
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{d}</span>
                      <span style={{ fontSize: 12, color: t.textMuted }}>{w}</span>
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--font-hand)',
                        fontSize: 16,
                        lineHeight: 1.5,
                        color: t.textSub,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {entry.content}
                    </p>
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
