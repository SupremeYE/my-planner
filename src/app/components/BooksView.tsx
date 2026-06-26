import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Plus, BookOpen, ChevronRight, ChevronLeft, Tag, Trash2, BookMarked, Mic, Star, Lightbulb, NotebookPen, Camera } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useFabAction } from '../FabContext';
import { format } from 'date-fns';
import ConfirmModal from './ConfirmModal';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { QuoteCaptureSheet } from './QuoteCaptureSheet';

// ─── 타입 ──────────────────────────────────────────────────────────────
type BookStatus = 'reading' | 'want' | 'done';

type Quote = {
  id: string;
  text: string;
  page?: number;
  tags: string[];
  starred: boolean;
  createdAt: string;
  note?: string;
  imageUrl?: string;  // 사진으로 담은 구절의 크롭 사진 (book-photos)
};

type Book = {
  id: string;
  title: string;
  author: string;
  publisher: string;
  thumbnail: string;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  quotes: Quote[];
  startDate?: string;
  finishDate?: string;
  addedAt: string;
};

type KakaoBook = {
  title: string;
  authors: string[];
  publisher: string;
  thumbnail: string;
  isbn: string;
  datetime: string;
};

// ─── 상수 ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<BookStatus, string> = {
  reading: '읽는 중',
  want: '읽고 싶어요',
  done: '완독',
};

const STATUS_COLORS: Record<BookStatus, string> = {
  reading: '#6BAA7A',
  want: '#C4A882',
  done: '#D4735A',
};

const TAB_LIST: { key: BookStatus | 'quotes' | 'stats'; label: string }[] = [
  { key: 'reading', label: '읽는 중' },
  { key: 'want', label: '읽고 싶어요' },
  { key: 'done', label: '완독' },
  { key: 'quotes', label: '구절' },
  { key: 'stats', label: '통계' },
];

// ─── 유틸 ──────────────────────────────────────────────────────────────
function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

function progressPct(book: Book) {
  if (!book.totalPages || book.totalPages === 0) return 0;
  return Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
}

// ─── 마라톤 트랙 ────────────────────────────────────────────────────────
function MarathonTrack({ currentPage, totalPages, t }: { currentPage: number; totalPages: number; t: any }) {
  const pct = totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0;
  const runnerLeft = Math.max(2, Math.min(97, pct));

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ position: 'relative', height: 30 }}>
        {/* 배경 트랙 */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 5, borderRadius: 3,
          backgroundColor: t.bgSub,
          transform: 'translateY(-50%)',
        }} />
        {/* 진행 그라데이션 */}
        <div style={{
          position: 'absolute', top: '50%', left: 0,
          height: 5, borderRadius: 3,
          width: `${Math.max(pct, 2)}%`,
          background: 'linear-gradient(to right, #FFD89A, #F4A582)',
          transform: 'translateY(-50%)',
          transition: 'width 0.5s ease',
        }} />
        {/* 마일스톤 점 */}
        {[25, 50, 75].map(m => (
          <div key={m} style={{
            position: 'absolute', top: '50%',
            left: `${m}%`,
            transform: 'translate(-50%, -50%)',
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: pct >= m ? '#F4A582' : t.bgSub,
            border: `1.5px solid ${pct >= m ? 'rgba(255,255,255,0.9)' : t.border}`,
            zIndex: 1,
          }} />
        ))}
        {/* 러너 🏃‍♀️ */}
        <div style={{
          position: 'absolute', top: '50%',
          left: `${runnerLeft}%`,
          transform: 'translate(-50%, -165%)',
          fontSize: 14, lineHeight: 1,
          transition: 'left 0.5s ease',
          zIndex: 2,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
        }}>
          🏃‍♀️
        </div>
        {/* 완독 플래그 */}
        <div style={{
          position: 'absolute', top: '50%', right: -2,
          transform: 'translateY(-150%)',
          fontSize: 12, lineHeight: 1,
        }}>
          📖
        </div>
      </div>
      {/* 수치 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
        <span style={{ fontSize: 9, color: t.textMuted }}>{currentPage}p 읽음</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#F4A582' }}>{pct}%</span>
        <span style={{ fontSize: 9, color: t.textMuted }}>
          {totalPages > 0 ? `${totalPages - currentPage}p 남음` : ''}
        </span>
      </div>
    </div>
  );
}

// ─── 공용 팔레트 & 헬퍼 ────────────────────────────────────────────────
const SPINE_PALETTE = [
  '#F2A98A', '#A9CBE8', '#F7D49A', '#C8DDB8', '#E8C4B8',
  '#B8CCE0', '#DDD0B8', '#C8B8D8', '#B8D8C8', '#E8D4B0',
  '#D4B8C0', '#B8C8B8',
];

function getSpineProps(title: string, idx: number) {
  let hash = idx * 137 + 42;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
  }
  const colorIdx = Math.abs(hash) % SPINE_PALETTE.length;
  const height = 60 + (Math.abs((hash * 7) >>> 0) % 28);
  return { color: SPINE_PALETTE[colorIdx], height };
}

// ─── 월별 책탑 (연도별) ───────────────────────────────────────────────────
function MonthlyTower({
  books,
  year,
  onSelect,
  t,
}: {
  books: Book[];
  year: number;
  onSelect: (b: Book) => void;
  t: any;
}) {
  // 선택 연도의 완독 책을 월별로 그룹화 (읽은 달만)
  const monthMap = new Map<number, Book[]>();
  books
    .filter(b => b.status === 'done')
    .filter(b => (b.finishDate ?? b.addedAt).startsWith(String(year)))
    .sort((a, b) => (a.finishDate ?? a.addedAt).localeCompare(b.finishDate ?? b.addedAt))
    .forEach(book => {
      const m = parseInt((book.finishDate ?? book.addedAt).slice(5, 7), 10);
      if (!monthMap.has(m)) monthMap.set(m, []);
      monthMap.get(m)!.push(book);
    });

  const entries = Array.from(monthMap.entries()).sort((a, b) => a[0] - b[0]);

  if (entries.length === 0) {
    return (
      <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', padding: '24px 0' }}>
        {year}년 완독 기록이 없어요
      </p>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
      rowGap: 16,
      columnGap: 6,
      alignItems: 'end',
    }}>
      {entries.map(([m, monthBooks]) => {
        // 6칸 줄바꿈 — 7월이 1월 아래(같은 열)에 오도록 고정 배치
        const col = ((m - 1) % 6) + 1;
        const row = Math.floor((m - 1) / 6) + 1;
        return (
          <div key={m} style={{ gridColumn: col, gridRow: row, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* 쌓인 책들 (삐뚤빼뚤) */}
            <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 2, width: '100%' }}>
              {monthBooks.map(book => {
                const idx = books.indexOf(book);
                const { color, height } = getSpineProps(book.title, idx);
                const widthPct = 64 + (height % 30);   // 64~93%
                const dx = (height % 7) - 3;            // -3 ~ +3 px
                const rot = ((height % 5) - 2) * 0.6;   // -1.2 ~ +1.2deg
                return (
                  <button
                    key={book.id}
                    onClick={() => onSelect(book)}
                    title={`${book.title}${book.totalPages ? ` (${book.totalPages}p)` : ''}`}
                    style={{
                      width: `${widthPct}%`,
                      height: 14,
                      backgroundColor: color,
                      borderRadius: 3,
                      border: 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transform: `translateX(${dx}px) rotate(${rot}deg)`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      transition: 'filter 0.13s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)'; }}
                  />
                );
              })}
            </div>
            {/* 선반 */}
            <div style={{ width: '100%', height: 3, backgroundColor: '#C4A882', marginTop: 4, borderRadius: 1 }} />
            {/* 월 · 권수 */}
            <span style={{ fontSize: 9, color: t.textSub, marginTop: 3, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {m}월 · {monthBooks.length}권
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 독서밭 채우기 히트맵 ──────────────────────────────────────────────
function getReadingActivityData(books: Book[]): { counts: Map<string, number>; completions: Set<string> } {
  const counts = new Map<string, number>();
  const completions = new Set<string>();
  const add = (date: string) => {
    const d = date.slice(0, 10);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  };
  for (const b of books) {
    if (b.startDate) add(b.startDate);
    if (b.finishDate) {
      add(b.finishDate);
      completions.add(b.finishDate.slice(0, 10));
    }
    for (const q of b.quotes) add(q.createdAt);
  }
  return { counts, completions };
}

function pulseColor(count: number, bgSub: string, isCompletion?: boolean): string {
  if (count === 0) return bgSub;
  if (isCompletion) return '#D4603A';
  if (count === 1) return 'rgba(244,165,130,0.28)';
  if (count === 2) return 'rgba(244,165,130,0.55)';
  if (count === 3) return '#F4A582';
  return '#D4603A';
}

function ReadingPulse({ books, t }: { books: Book[]; t: any }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { counts, completions } = getReadingActivityData(books);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const thisYear = todayStr.slice(0, 4);

  // 52주 그리드 — 오늘 포함, 일요일 기준 정렬
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 51 * 7 - today.getDay());

  const weeks: { date: string; count: number; monthLabel?: string }[][] = [];
  const cur = new Date(startDate);
  let prevMonth = -1;

  for (let w = 0; w < 52; w++) {
    const week: { date: string; count: number; monthLabel?: string }[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = format(cur, 'yyyy-MM-dd');
      const m = cur.getMonth();
      week.push({
        date: dateStr,
        count: counts.get(dateStr) ?? 0,
        monthLabel: dow === 0 && m !== prevMonth ? `${m + 1}월` : undefined,
      });
      if (dow === 0) prevMonth = m;
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // 연속 읽기 스트릭
  let streak = 0;
  const sc = new Date(today);
  while (counts.has(format(sc, 'yyyy-MM-dd'))) {
    streak++;
    sc.setDate(sc.getDate() - 1);
  }
  const yearActive = Array.from(counts.keys()).filter(d => d.startsWith(thisYear)).length;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, []);

  const CELL = 10, GAP = 2;

  return (
    <div style={{
      backgroundColor: t.card,
      border: `1px solid ${t.borderLight ?? t.border}`,
      borderRadius: 16,
      padding: 14,
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>🌱 독서밭 채우기</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: t.textMuted }}>
            올해 <span style={{ color: t.accent, fontWeight: 700 }}>{yearActive}</span>일
          </span>
          {streak > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#F4A582',
              backgroundColor: 'rgba(244,165,130,0.12)',
              padding: '1px 6px', borderRadius: 99,
            }}>
              🔥 {streak}일 연속
            </span>
          )}
        </div>
      </div>

      {/* 1년 그리드 — 가로 스크롤 */}
      <div ref={scrollRef} style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: GAP, minWidth: 'min-content' }}>
          {/* 요일 레이블 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, paddingTop: 14, flexShrink: 0 }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((label, i) => (
              <div key={i} style={{ height: CELL, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 7, color: t.textMuted, width: 10, textAlign: 'right' }}>
                  {i % 2 === 1 ? label : ''}
                </span>
              </div>
            ))}
          </div>

          {/* 주 컬럼 */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP, flexShrink: 0 }}>
              {/* 월 레이블 */}
              <div style={{ height: 12, display: 'flex', alignItems: 'center' }}>
                {week[0].monthLabel && (
                  <span style={{ fontSize: 7, color: t.textMuted, whiteSpace: 'nowrap', lineHeight: 1 }}>
                    {week[0].monthLabel}
                  </span>
                )}
              </div>
              {/* 날짜 셀 */}
              {week.map(day => {
                const isCompletion = completions.has(day.date);
                const tooltipExtra = isCompletion ? ` 🎉 완독!` : day.count > 0 ? ` · ${day.count}회 활동` : '';
                return (
                  <div
                    key={day.date}
                    title={day.date + tooltipExtra}
                    style={{
                      width: CELL, height: CELL, borderRadius: 2, flexShrink: 0,
                      backgroundColor: day.date > todayStr ? t.bgSub : pulseColor(day.count, t.bgSub, isCompletion),
                      opacity: day.date > todayStr ? 0.15 : day.count === 0 ? 0.38 : 1,
                      cursor: day.count > 0 ? 'pointer' : 'default',
                      outline: isCompletion && day.date <= todayStr ? `1.5px solid #D4603A` : 'none',
                      outlineOffset: 1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 7, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 8, color: t.textMuted, marginRight: 2 }}>적음</span>
        {[0, 1, 2, 3, 4].map(v => (
          <div key={v} style={{
            width: 9, height: 9, borderRadius: 2,
            backgroundColor: pulseColor(v, t.bgSub),
            opacity: v === 0 ? 0.38 : 1,
          }} />
        ))}
        <span style={{ fontSize: 8, color: t.textMuted, marginLeft: 2 }}>많음</span>
      </div>
    </div>
  );
}

// ─── 카카오 도서 검색 ──────────────────────────────────────────────────
async function searchKakaoBooks(query: string): Promise<KakaoBook[]> {
  try {
    const res = await fetch(`/api/kakao-books?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.documents ?? [];
  } catch {
    return [];
  }
}

// ─── 검색 모달 ──────────────────────────────────────────────────────────
function BookSearchModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (book: Omit<Book, 'id' | 'quotes' | 'addedAt'>) => void;
}) {
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<KakaoBook | null>(null);
  const [totalPages, setTotalPages] = useState('');
  const [status, setStatus] = useState<BookStatus>('want');
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [isManual, setIsManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const docs = await searchKakaoBooks(query.trim());
    setResults(docs);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSelect = (book: KakaoBook) => {
    setSelectedBook(book);
    setIsManual(false);
  };

  const handleConfirm = () => {
    const title = isManual ? manualTitle.trim() : selectedBook?.title ?? '';
    const author = isManual
      ? manualAuthor.trim()
      : selectedBook?.authors.join(', ') ?? '';
    if (!title) return;

    onAdd({
      title,
      author,
      publisher: isManual ? '' : selectedBook?.publisher ?? '',
      thumbnail: isManual ? '' : selectedBook?.thumbnail ?? '',
      totalPages: parseInt(totalPages) || 0,
      currentPage: 0,
      status,
    });
    onClose();
  };

  const card = {
    backgroundColor: t.card,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: t.sidebar, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>책 추가</h2>
          <button onClick={onClose} style={{ color: t.textMuted }}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {/* 검색 */}
          {!selectedBook && !isManual && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="책 제목 또는 저자 검색..."
                className="flex-1 rounded-xl px-3 py-2.5 outline-none text-sm"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: t.accent, color: '#fff' }}
              >
                <Search size={16} />
              </button>
            </div>
          )}

          {/* 검색 결과 */}
          {!selectedBook && !isManual && (
            <div className="space-y-2">
              {loading && (
                <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center' }}>
                  검색 중...
                </p>
              )}
              {!loading && results.map((book, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(book)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                  style={card}
                >
                  {book.thumbnail ? (
                    <img src={book.thumbnail} alt={book.title}
                      className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: t.bgSub }}>
                      <BookOpen size={16} color={t.textMuted} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ fontSize: 13, color: t.text }}>
                      {book.title}
                    </p>
                    <p style={{ fontSize: 11, color: t.textSub }}>
                      {book.authors.join(', ')}
                    </p>
                    <p style={{ fontSize: 11, color: t.textMuted }}>
                      {book.publisher}
                    </p>
                  </div>
                  <ChevronRight size={14} color={t.textMuted} />
                </button>
              ))}
              {!loading && results.length === 0 && query && (
                <div className="text-center py-2">
                  <p style={{ fontSize: 13, color: t.textMuted }}>검색 결과가 없어요</p>
                  <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                    카카오 API 키가 설정되지 않았거나 결과가 없습니다
                  </p>
                </div>
              )}
              {/* 직접 입력 */}
              <button
                onClick={() => setIsManual(true)}
                className="w-full py-2.5 rounded-xl text-center"
                style={{ border: `1px dashed ${t.border}`, fontSize: 13, color: t.accent }}
              >
                + 직접 입력하기 (검색 없이 추가)
              </button>
            </div>
          )}

          {/* 직접 입력 폼 */}
          {isManual && !selectedBook && (
            <div className="space-y-3">
              <button onClick={() => { setIsManual(false); setResults([]); }}
                style={{ fontSize: 12, color: t.accent }}>
                ← 검색으로 돌아가기
              </button>
              <input
                autoFocus
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="책 제목 *"
                className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
              />
              <input
                value={manualAuthor}
                onChange={e => setManualAuthor(e.target.value)}
                placeholder="저자"
                className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
              />
            </div>
          )}

          {/* 선택된 책 */}
          {selectedBook && (
            <div className="flex items-start gap-3 p-3 rounded-xl" style={card}>
              {selectedBook.thumbnail ? (
                <img src={selectedBook.thumbnail} alt={selectedBook.title}
                  className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: t.bgSub }}>
                  <BookOpen size={18} color={t.textMuted} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ fontSize: 13, color: t.text }}>
                  {selectedBook.title}
                </p>
                <p style={{ fontSize: 12, color: t.textSub }}>{selectedBook.authors.join(', ')}</p>
                <p style={{ fontSize: 11, color: t.textMuted }}>{selectedBook.publisher}</p>
              </div>
              <button onClick={() => setSelectedBook(null)} style={{ color: t.textMuted }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* 상태 & 전체 페이지 */}
          {(selectedBook || isManual) && (
            <div className="space-y-3">
              <div>
                <p style={{ fontSize: 12, color: t.textSub, marginBottom: 8, fontWeight: 600 }}>
                  독서 상태
                </p>
                <div className="flex gap-2">
                  {(['want', 'reading', 'done'] as BookStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className="flex-1 py-2 rounded-xl text-center transition-all"
                      style={{
                        fontSize: 12,
                        fontWeight: status === s ? 700 : 400,
                        backgroundColor: status === s ? STATUS_COLORS[s] : t.card,
                        color: status === s ? '#fff' : t.textSub,
                        border: `1px solid ${status === s ? STATUS_COLORS[s] : t.border}`,
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, color: t.textSub, marginBottom: 6, fontWeight: 600 }}>
                  전체 페이지 (선택)
                </p>
                <input
                  type="number"
                  value={totalPages}
                  onChange={e => setTotalPages(e.target.value)}
                  placeholder="예: 320"
                  className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
                />
              </div>

              <button
                onClick={handleConfirm}
                disabled={isManual && !manualTitle.trim()}
                className="w-full py-3 rounded-xl font-semibold"
                style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14 }}
              >
                책 추가하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 책 상세 모달 ──────────────────────────────────────────────────────
function BookDetailModal({
  book,
  onClose,
  onUpdate,
  onDelete,
  onComplete,
}: {
  book: Book;
  onClose: () => void;
  onUpdate: (b: Book) => void;
  onDelete: (id: string) => void;
  onComplete?: () => void;
}) {
  const { t } = useTheme();
  const [currentPage, setCurrentPage] = useState(String(book.currentPage));
  const [totalPages, setTotalPages] = useState(String(book.totalPages || ''));
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [quoteText, setQuoteText] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [quotePage, setQuotePage] = useState('');
  const [quoteTags, setQuoteTags] = useState('');
  // 사진으로 담은 구절의 크롭 사진 URL (Stage 2 캡처 플로우가 채움). 없으면 글자만 기록.
  const [quoteImageUrl, setQuoteImageUrl] = useState<string | null>(null);
  // 사진 캡처(촬영→크롭→OCR) 시트 열림 여부
  const [captureOpen, setCaptureOpen] = useState(false);
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  // PC split 모달: 우측 패널 모드
  //  'write'  → 새 구절 작성 폼
  //  string   → 선택된 구절 id (상세 표시)
  const [pcRightMode, setPcRightMode] = useState<'write' | string>('write');
  // 모바일 풀스크린 작성/수정 시트
  //  null     → 시트 닫힘 (목록 표시)
  //  'write'  → 새 구절 작성
  //  string   → 그 id 의 구절 수정
  const [mobileSheetMode, setMobileSheetMode] = useState<null | 'write' | string>(null);
  const [activeTab, setActiveTab] = useState<'progress' | 'quotes' | 'note'>('progress');
  // 노트 탭: 책 전체에 대한 자유 메모 (목적/아웃풋)
  const [notePurpose, setNotePurpose] = useState('');
  const [noteOutput, setNoteOutput] = useState('');
  const [noteSaved, setNoteSaved] = useState<{ purpose: string; output: string }>({ purpose: '', output: '' });
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState<string | null>(null);
  const voice = useVoiceInput();
  const isRecording = voice.status === 'recording';
  const isTranscribing = voice.status === 'transcribing';

  useEffect(() => {
    if (voice.text) {
      setQuoteText(prev => prev ? prev + ' ' + voice.text : voice.text);
      voice.setText('');
    }
  }, [voice.text, voice.setText]);

  // 노트 탭: book_notes 조회 (이 책 행만)
  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('book_notes')
      .select('type, content')
      .eq('book_id', book.id);
    if (error) {
      console.error('[book_notes] fetch:', error.message);
      return;
    }
    const purpose = data?.find((r: any) => r.type === 'purpose')?.content ?? '';
    const output = data?.find((r: any) => r.type === 'output')?.content ?? '';
    setNotePurpose(purpose);
    setNoteOutput(output);
    setNoteSaved({ purpose, output });
  }, [book.id]);
  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useRealtimeSync('book_notes', fetchNotes);

  const noteDirty = notePurpose !== noteSaved.purpose || noteOutput !== noteSaved.output;

  const handleSaveNotes = async () => {
    if (!noteDirty || noteSaving) return;
    setNoteSaving(true);
    const rows: { id: string; book_id: string; type: string; content: string }[] = [];
    const purposeTrim = notePurpose.trim();
    const outputTrim = noteOutput.trim();
    // 빈 입력은 행을 만들지 않는다. 이전에 저장된 값이 있고 비웠다면 DELETE.
    if (purposeTrim) rows.push({ id: `${book.id}__purpose`, book_id: book.id, type: 'purpose', content: notePurpose });
    if (outputTrim) rows.push({ id: `${book.id}__output`, book_id: book.id, type: 'output', content: noteOutput });
    const toDelete: string[] = [];
    if (!purposeTrim && noteSaved.purpose) toDelete.push('purpose');
    if (!outputTrim && noteSaved.output) toDelete.push('output');

    if (rows.length > 0) {
      const { error } = await supabase
        .from('book_notes')
        .upsert(rows, { onConflict: 'book_id,type' });
      if (error) console.error('[book_notes] upsert:', error.message);
    }
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('book_notes')
        .delete()
        .eq('book_id', book.id)
        .in('type', toDelete);
      if (error) console.error('[book_notes] delete:', error.message);
    }
    setNoteSaved({ purpose: notePurpose, output: noteOutput });
    setNoteSaving(false);
    setNoteSavedAt(Date.now());
  };

  const parsedCurrentPage = parseInt(currentPage) || 0;
  const parsedTotalPages = parseInt(totalPages) || 0;
  const pct = parsedTotalPages > 0
    ? Math.min(100, Math.round((parsedCurrentPage / parsedTotalPages) * 100))
    : 0;
  const isAutoComplete = parsedCurrentPage > 0 && parsedTotalPages > 0 && parsedCurrentPage >= parsedTotalPages;

  const handleSaveProgress = () => {
    const finalStatus: BookStatus = isAutoComplete ? 'done' : status;
    const updated: Book = {
      ...book,
      currentPage: parsedCurrentPage,
      totalPages: parsedTotalPages,
      status: finalStatus,
      finishDate: finalStatus === 'done' && !book.finishDate
        ? format(new Date(), 'yyyy-MM-dd')
        : book.finishDate,
    };
    // Supabase 저장
    supabase.from('books').upsert({
      id: updated.id,
      title: updated.title,
      author: updated.author,
      publisher: updated.publisher,
      thumbnail: updated.thumbnail,
      total_pages: updated.totalPages,
      current_page: updated.currentPage,
      status: updated.status,
      start_date: updated.startDate ?? null,
      finish_date: updated.finishDate ?? null,
      added_at: updated.addedAt,
    }).then(({ error }) => {
      if (error) console.error('[books] upsert:', error.message);
    });
    // 독서 이력: current_page 가 실제로 바뀐 경우에만 reading_logs 에 스냅샷 기록
    // (변경 없이 저장 버튼을 눌렀을 때 중복 로그가 쌓이지 않도록)
    // user_id 는 reading_logs.user_id 컬럼의 DEFAULT auth.uid() 로 자동 채워진다 (클라이언트가 따로 보낼 필요 없음)
    // INSERT 실패가 현재 페이지 저장 자체를 막지 않도록 fire-and-forget + 에러 로깅만 한다
    if (updated.currentPage !== book.currentPage) {
      supabase.from('reading_logs').insert({
        book_id: updated.id,
        page: updated.currentPage,
        date: format(new Date(), 'yyyy-MM-dd'),
        duration_minutes: null,
        note: null,
      }).then(({ error }) => {
        if (error) console.error('[reading_logs] insert:', error.message);
      });
    }
    onUpdate(updated);
    if (finalStatus === 'done') onComplete?.();
    onClose();
  };

  const toggleRecording = async () => {
    if (isTranscribing) return;
    if (isRecording) await voice.stopRecording();
    else await voice.startRecording();
  };

  const handleAddQuote = () => {
    if (!quoteText.trim()) return;
    const tags = quoteTags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
    const noteTrimmed = quoteNote.trim();
    const quote: Quote = {
      id: nanoid(),
      text: quoteText.trim(),
      page: quotePage ? parseInt(quotePage) : undefined,
      tags,
      starred: false,
      createdAt: format(new Date(), 'yyyy-MM-dd'),
      note: noteTrimmed || undefined,
      imageUrl: quoteImageUrl || undefined,
    };
    // Supabase 저장
    supabase.from('book_quotes').insert({
      id: quote.id,
      book_id: book.id,
      text: quote.text,
      page: quote.page ?? null,
      tags: quote.tags,
      starred: false,
      created_at: quote.createdAt,
      note: noteTrimmed || null,
      image_url: quoteImageUrl || null,
    }).then(({ error }) => {
      if (error) console.error('[book_quotes] insert:', error.message);
    });
    onUpdate({ ...book, quotes: [quote, ...book.quotes] });
    setQuoteText('');
    setQuoteNote('');
    setQuotePage('');
    setQuoteTags('');
    setQuoteImageUrl(null);
  };

  const handleToggleFavorite = (qid: string) => {
    const target = book.quotes.find(q => q.id === qid);
    if (!target) return;
    const newFav = !target.starred;
    onUpdate({ ...book, quotes: book.quotes.map(q => q.id === qid ? { ...q, starred: newFav } : q) });
    supabase.from('book_quotes').update({ starred: newFav }).eq('id', qid)
      .then(({ error }) => {
        if (error) console.error('[book_quotes] starred:', error.message);
      });
  };

  // 모바일 풀스크린 시트 진입 헬퍼
  // 사진 캡처 결과를 작성 폼에 채움 — 텍스트는 기존 입력에 이어 붙이고, 페이지/사진은 채운다.
  const handleCaptureConfirm = (r: { text: string; page?: number; imageUrl: string }) => {
    setQuoteText(prev => (prev.trim() ? prev.trimEnd() + '\n' + r.text : r.text));
    if (r.page != null) setQuotePage(String(r.page));
    setQuoteImageUrl(r.imageUrl);
  };

  const enterMobileWrite = () => {
    setQuoteText('');
    setQuoteNote('');
    setQuotePage('');
    setQuoteTags('');
    setQuoteImageUrl(null);
    setMobileSheetMode('write');
  };
  const enterMobileEdit = (q: Quote) => {
    setQuoteText(q.text);
    setQuoteNote(q.note ?? '');
    setQuotePage(q.page != null ? String(q.page) : '');
    setQuoteTags(q.tags.join(', '));
    setQuoteImageUrl(q.imageUrl ?? null);
    setMobileSheetMode(q.id);
  };

  // 기존 구절 업데이트 (모바일 수정용)
  const handleUpdateQuote = (qid: string) => {
    if (!quoteText.trim()) return;
    const tags = quoteTags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
    const noteTrimmed = quoteNote.trim();
    const updates = {
      text: quoteText.trim(),
      page: quotePage ? parseInt(quotePage) : null,
      tags,
      note: noteTrimmed || null,
      image_url: quoteImageUrl || null,
    };
    supabase.from('book_quotes').update(updates).eq('id', qid).then(({ error }) => {
      if (error) console.error('[book_quotes] update:', error.message);
    });
    onUpdate({
      ...book,
      quotes: book.quotes.map(q => q.id === qid
        ? {
            ...q,
            text: updates.text,
            page: updates.page ?? undefined,
            tags: updates.tags,
            note: noteTrimmed || undefined,
            imageUrl: quoteImageUrl || undefined,
          }
        : q),
    });
  };

  const handleSaveMobileSheet = () => {
    if (!quoteText.trim()) return;
    if (mobileSheetMode === 'write') {
      handleAddQuote(); // 내부에서 fields 초기화
    } else if (typeof mobileSheetMode === 'string') {
      handleUpdateQuote(mobileSheetMode);
    }
    setMobileSheetMode(null);
  };

  const handleDeleteQuote = (qid: string) => {
    // Supabase 삭제
    supabase.from('book_quotes').delete().eq('id', qid).then(({ error }) => {
      if (error) console.error('[book_quotes] delete:', error.message);
    });
    onUpdate({ ...book, quotes: book.quotes.filter(q => q.id !== qid) });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      >
        <div
          className="w-full lg:w-[92vw] lg:max-w-[1280px] rounded-t-2xl lg:rounded-2xl overflow-hidden flex flex-col lg:h-[88vh]"
          style={{ backgroundColor: t.sidebar, maxHeight: '92vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${t.border}` }}>
            {book.thumbnail ? (
              <img src={book.thumbnail} alt={book.title}
                className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className="w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: t.bgSub }}>
                <BookOpen size={20} color={t.textMuted} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold leading-tight" style={{ fontSize: 14, color: t.text }}>
                {book.title}
              </p>
              <p style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>{book.author}</p>
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-white"
                style={{ fontSize: 10, backgroundColor: STATUS_COLORS[book.status], fontWeight: 600 }}
              >
                {STATUS_LABELS[book.status]}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(true)} style={{ color: t.textMuted }}>
                <Trash2 size={16} />
              </button>
              <button onClick={onClose} style={{ color: t.textMuted }}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex px-5 pt-3 pb-0 gap-4 flex-shrink-0">
            {(['progress', 'quotes', 'note'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 700 : 400,
                  color: activeTab === tab ? t.accent : t.textMuted,
                  paddingBottom: 8,
                  borderBottom: activeTab === tab ? `2px solid ${t.accent}` : '2px solid transparent',
                }}
              >
                {tab === 'progress'
                  ? '독서 진도'
                  : tab === 'quotes'
                    ? `구절 (${book.quotes.length})`
                    : '노트'}
              </button>
            ))}
          </div>

          <div
            className={`flex-1 overflow-y-auto px-5 py-4 space-y-4 ${
              activeTab === 'quotes'
                ? 'lg:overflow-hidden lg:px-0 lg:py-0 lg:space-y-0 lg:min-h-0'
                : ''
            }`}
          >
            {/* 진도 탭 */}
            {activeTab === 'progress' && (
              <>
                <div>
                  <p style={{ fontSize: 12, color: t.textSub, marginBottom: 6, fontWeight: 600 }}>
                    독서 상태
                  </p>
                  <div className="flex gap-2">
                    {(['want', 'reading', 'done'] as BookStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className="flex-1 py-2 rounded-xl text-center transition-all"
                        style={{
                          fontSize: 11,
                          fontWeight: status === s ? 700 : 400,
                          backgroundColor: status === s ? STATUS_COLORS[s] : t.card,
                          color: status === s ? '#fff' : t.textSub,
                          border: `1px solid ${status === s ? STATUS_COLORS[s] : t.border}`,
                        }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <p style={{ fontSize: 12, color: t.textSub, marginBottom: 6, fontWeight: 600 }}>
                      현재 페이지
                    </p>
                    <input
                      type="number"
                      value={currentPage}
                      onChange={e => setCurrentPage(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                      style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
                    />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: 12, color: t.textSub, marginBottom: 6, fontWeight: 600 }}>
                      전체 페이지
                    </p>
                    <input
                      type="number"
                      value={totalPages}
                      onChange={e => setTotalPages(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                      style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
                    />
                  </div>
                </div>

                {/* 진도율 바 */}
                {parsedTotalPages > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span style={{ fontSize: 12, color: t.textSub }}>진도율</span>
                      <span style={{ fontSize: 13, color: t.accent, fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: isAutoComplete ? '#6BAA7A' : t.accent }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                      {parsedCurrentPage}p / {parsedTotalPages}p
                    </p>
                  </div>
                )}

                {isAutoComplete && (
                  <div
                    className="w-full py-2.5 rounded-xl text-center"
                    style={{ backgroundColor: 'rgba(107,170,122,0.12)', border: '1px solid rgba(107,170,122,0.35)' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#6BAA7A' }}>
                      🎉 완독! 저장하면 완독 탭으로 이동돼요
                    </span>
                  </div>
                )}

                <button
                  onClick={handleSaveProgress}
                  className="w-full py-3 rounded-xl font-semibold"
                  style={{ backgroundColor: isAutoComplete ? '#6BAA7A' : t.accent, color: '#fff', fontSize: 14 }}
                >
                  {isAutoComplete ? '완독 저장하기 🎉' : '저장하기'}
                </button>
              </>
            )}

            {/* 구절 탭 */}
            {activeTab === 'quotes' && (
              <>
                {/* ── 모바일 (lg 미만): 목록 + 풀스크린 작성 시트 push ── */}
                <div className="lg:hidden space-y-3">
                  {/* + 구절 추가 (목록 상단) */}
                  <button
                    onClick={enterMobileWrite}
                    className="w-full py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: t.accent,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <Plus size={14} />
                    구절 추가
                  </button>

                  {/* 구절 목록 — 탭 시 풀스크린 작성/상세 화면으로 push */}
                  <div className="space-y-2">
                    {book.quotes.length === 0 && (
                      <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', paddingTop: 16 }}>
                        저장된 구절이 없어요
                      </p>
                    )}
                    {book.quotes.map(q => (
                      <QuoteCard
                        key={q.id}
                        quote={q}
                        expanded={expandedQuoteId === q.id}
                        onClick={() => enterMobileEdit(q)}
                        rightSlot={
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteQuote(q.id); }}
                            style={{ color: t.textMuted }}
                          >
                            <X size={13} />
                          </button>
                        }
                        meta={
                          <>
                            <span style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }} className="truncate max-w-[6rem]">
                              {book.title}
                            </span>
                            {q.page && (
                              <span style={{ fontSize: 10, color: t.textMuted }}>{q.page}p</span>
                            )}
                            {q.tags.map(tag => (
                              <span key={tag}
                                className="px-1.5 py-0.5 rounded-md"
                                style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent }}>
                                #{tag}
                              </span>
                            ))}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleFavorite(q.id); }}
                              className="ml-auto"
                              style={{ color: q.starred ? '#C4A882' : t.textMuted }}
                            >
                              <Star size={14} fill={q.starred ? '#C4A882' : 'none'} />
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
                {/* ── PC (lg 이상): 좌우 split ── */}
                <div className="hidden lg:flex h-full min-h-0" style={{ minHeight: 0 }}>
                  {/* 좌측: 구절 리스트 */}
                  <div
                    className="flex flex-col"
                    style={{
                      width: '40%',
                      borderRight: `1px solid ${t.border}`,
                      backgroundColor: t.bgSub,
                    }}
                  >
                    {/* 좌측 헤더: + 구절 추가 */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${t.border}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
                        구절 {book.quotes.length}
                      </span>
                      <button
                        onClick={() => {
                          setPcRightMode('write');
                          setQuoteText('');
                          setQuoteNote('');
                          setQuotePage('');
                          setQuoteTags('');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                        style={{
                          fontSize: 12,
                          backgroundColor: pcRightMode === 'write' ? t.accent : t.card,
                          color: pcRightMode === 'write' ? '#fff' : t.accent,
                          border: `1px solid ${t.accent}`,
                          fontWeight: 600,
                        }}
                      >
                        <Plus size={13} />
                        구절 추가
                      </button>
                    </div>

                    {/* 리스트 */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                      {book.quotes.length === 0 && (
                        <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', paddingTop: 24 }}>
                          저장된 구절이 없어요
                        </p>
                      )}
                      {book.quotes.map(q => {
                        const selected = pcRightMode === q.id;
                        const hasNote = !!(q.note && q.note.trim());
                        return (
                          <button
                            key={q.id}
                            onClick={() => setPcRightMode(q.id)}
                            className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-lg transition-all"
                            style={{
                              backgroundColor: selected ? t.accentLight : t.card,
                              border: `1px solid ${selected ? t.accent : t.border}`,
                            }}
                          >
                            {/* 인용선 */}
                            <div
                              style={{
                                width: 2,
                                alignSelf: 'stretch',
                                borderRadius: 1,
                                backgroundColor: hasNote ? t.accent : (t.borderLight ?? t.border),
                                flexShrink: 0,
                              }}
                            />
                            <p
                              style={{
                                fontSize: 12.5,
                                color: t.text,
                                lineHeight: 1.5,
                                flex: 1,
                                fontFamily: 'Georgia, "Noto Serif KR", serif',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical' as const,
                                overflow: 'hidden',
                                wordBreak: 'break-word',
                              }}
                            >
                              {q.text}
                            </p>
                            {hasNote && (
                              <Lightbulb
                                size={12}
                                style={{ color: t.accent, flexShrink: 0, marginTop: 2 }}
                                aria-label="내 생각 메모 있음"
                              />
                            )}
                            {q.starred && (
                              <Star size={12} fill="#C4A882" style={{ color: '#C4A882', flexShrink: 0, marginTop: 2 }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 우측: 작성/상세 */}
                  <div className="flex-1 flex flex-col overflow-y-auto" style={{ backgroundColor: t.sidebar }}>
                    {pcRightMode === 'write' ? (
                      // ── 작성 모드 ──
                      <div className="px-8 py-6 space-y-4 max-w-[720px] w-full mx-auto">
                        <p style={{ fontSize: 14, fontWeight: 700, color: t.textSub }}>
                          새 구절 기록
                        </p>
                        <div className="rounded-xl p-4 space-y-3"
                          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                          {/* 구절 입력 */}
                          <textarea
                            value={quoteText}
                            onChange={e => setQuoteText(e.target.value)}
                            placeholder="마음에 남는 문장을 기록해보세요..."
                            className="w-full resize-none outline-none"
                            style={{
                              backgroundColor: 'transparent',
                              color: t.text,
                              fontFamily: 'Georgia, "Noto Serif KR", serif',
                              fontSize: 16,
                              minHeight: 140,
                              lineHeight: 1.8,
                            }}
                          />
                          {/* 내 생각 */}
                          <div
                            className="flex items-start gap-2 pt-3"
                            style={{ borderTop: `1px dashed ${t.borderLight ?? t.border}` }}
                          >
                            <Lightbulb size={14} style={{ color: t.textMuted, marginTop: 4, flexShrink: 0 }} />
                            <textarea
                              value={quoteNote}
                              onChange={e => setQuoteNote(e.target.value)}
                              placeholder="이 구절에 대한 내 생각…"
                              className="w-full resize-none outline-none"
                              style={{
                                backgroundColor: 'transparent',
                                color: t.textSub,
                                fontSize: 13.5,
                                minHeight: 70,
                                lineHeight: 1.65,
                              }}
                            />
                          </div>
                          {/* 페이지 + 태그 */}
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={quotePage}
                              onChange={e => setQuotePage(e.target.value)}
                              placeholder="페이지"
                              className="rounded-lg px-3 py-2 outline-none text-sm flex-shrink-0"
                              style={{ width: 96, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
                            />
                            <input
                              value={quoteTags}
                              onChange={e => setQuoteTags(e.target.value)}
                              placeholder="태그 (쉼표 구분)"
                              className="flex-1 min-w-0 rounded-lg px-3 py-2 outline-none text-sm"
                              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
                            />
                          </div>
                          {/* 사진으로 구절 담기 */}
                          <button
                            onClick={() => setCaptureOpen(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all"
                            style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600 }}
                          >
                            <Camera size={14} /> 사진으로 구절 담기
                          </button>
                          {quoteImageUrl && (
                            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                              <img src={quoteImageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                              <span className="flex-1" style={{ fontSize: 12, color: t.textSub }}>사진이 이 구절에 첨부돼요</span>
                              <button onClick={() => setQuoteImageUrl(null)} aria-label="사진 제거" style={{ color: t.textMuted }}><X size={14} /></button>
                            </div>
                          )}
                          {/* 음성 + 저장 */}
                          <div className="flex gap-2">
                            <button
                              onClick={toggleRecording}
                              disabled={isTranscribing}
                              className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg transition-all"
                              style={{
                                backgroundColor: isRecording ? '#D4735A' : t.bgSub,
                                border: `1px solid ${isRecording ? '#D4735A' : t.border}`,
                                color: isRecording ? '#fff' : t.textMuted,
                                fontSize: 13,
                              }}
                            >
                              <Mic size={14} />
                              {isTranscribing ? '변환 중...' : isRecording ? '녹음 중...' : '음성 입력'}
                            </button>
                            <button
                              onClick={() => {
                                if (!quoteText.trim()) return;
                                handleAddQuote();
                              }}
                              disabled={!quoteText.trim()}
                              className="flex-1 py-2 rounded-lg"
                              style={{
                                backgroundColor: quoteText.trim() ? t.accent : t.bgSub,
                                color: quoteText.trim() ? '#fff' : t.textMuted,
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (() => {
                      const selected = book.quotes.find(q => q.id === pcRightMode);
                      if (!selected) {
                        return (
                          <div className="flex-1 flex items-center justify-center">
                            <p style={{ fontSize: 13, color: t.textMuted }}>
                              왼쪽에서 구절을 선택하거나 + 구절 추가
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="px-8 py-6 space-y-4 max-w-[720px] w-full mx-auto">
                          <div className="flex items-center justify-between">
                            <p style={{ fontSize: 14, fontWeight: 700, color: t.textSub }}>
                              구절 상세
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleFavorite(selected.id)}
                                className="p-1.5 rounded-lg"
                                style={{
                                  color: selected.starred ? '#C4A882' : t.textMuted,
                                  border: `1px solid ${t.border}`,
                                }}
                                title={selected.starred ? '즐겨찾기 해제' : '즐겨찾기'}
                              >
                                <Star size={15} fill={selected.starred ? '#C4A882' : 'none'} />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteQuote(selected.id)}
                                className="p-1.5 rounded-lg"
                                style={{ color: t.textMuted, border: `1px solid ${t.border}` }}
                                title="삭제"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          {/* 1단계 표시 컴포넌트 재사용 — 상세에선 expanded=true 로 내 생각 전체 노출 */}
                          <QuoteCard
                            quote={selected}
                            expanded
                            meta={
                              <>
                                <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>
                                  {book.title}
                                </span>
                                {selected.page && (
                                  <span style={{ fontSize: 11, color: t.textMuted }}>{selected.page}p</span>
                                )}
                                {selected.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="px-1.5 py-0.5 rounded-md"
                                    style={{ fontSize: 11, backgroundColor: t.accentLight, color: t.accent }}
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 'auto' }}>
                                  {selected.createdAt}
                                </span>
                              </>
                            }
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* 노트 탭 — 책 전체에 대한 자유 메모 (목적/아웃풋) */}
            {activeTab === 'note' && (
              <div className="space-y-4 lg:max-w-[820px] lg:mx-auto lg:px-2 lg:py-2">
                {/* 왜 읽는가 (purpose) */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <NotebookPen size={13} style={{ color: t.accent }} />
                    <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>왜 읽는가</p>
                    <span style={{ fontSize: 11, color: t.textMuted }}>목적</span>
                  </div>
                  <textarea
                    value={notePurpose}
                    onChange={e => setNotePurpose(e.target.value)}
                    placeholder="이 책에서 무엇을 얻고 싶은가요?"
                    className="w-full resize-none outline-none rounded-xl p-3"
                    style={{
                      backgroundColor: t.card,
                      border: `1px solid ${t.border}`,
                      color: t.text,
                      fontSize: 14,
                      minHeight: 140,
                      lineHeight: 1.7,
                    }}
                  />
                </div>

                {/* 읽고 나서 (output) */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <NotebookPen size={13} style={{ color: t.accent }} />
                    <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>읽고 나서</p>
                    <span style={{ fontSize: 11, color: t.textMuted }}>아웃풋</span>
                  </div>
                  <textarea
                    value={noteOutput}
                    onChange={e => setNoteOutput(e.target.value)}
                    placeholder="다 읽고 남은 생각·실천할 것·핵심 요약 등을 자유롭게 남겨보세요."
                    className="w-full resize-none outline-none rounded-xl p-3"
                    style={{
                      backgroundColor: t.card,
                      border: `1px solid ${t.border}`,
                      color: t.text,
                      fontSize: 14,
                      minHeight: 180,
                      lineHeight: 1.7,
                    }}
                  />
                </div>

                {/* 저장 + 상태 */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveNotes}
                    disabled={!noteDirty || noteSaving}
                    className="flex-1 py-2.5 rounded-xl"
                    style={{
                      backgroundColor: noteDirty && !noteSaving ? t.accent : t.bgSub,
                      color: noteDirty && !noteSaving ? '#fff' : t.textMuted,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {noteSaving ? '저장 중…' : '저장'}
                  </button>
                  {!noteDirty && noteSavedAt && (
                    <span style={{ fontSize: 11, color: t.textMuted }}>저장됨</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 모바일 풀스크린 작성/수정 시트 (lg 미만 전용) ── */}
      {mobileSheetMode !== null && (
        <div
          className="lg:hidden fixed inset-0 z-[60] flex flex-col"
          style={{ backgroundColor: t.sidebar }}
        >
          {/* 헤더: 뒤로가기 + 제목 + 저장 */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${t.border}`, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <button
              onClick={() => setMobileSheetMode(null)}
              className="p-1 -ml-1"
              style={{ color: t.text }}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={22} />
            </button>
            <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
              {mobileSheetMode === 'write' ? '새 구절' : '구절 수정'}
            </p>
            <button
              onClick={handleSaveMobileSheet}
              disabled={!quoteText.trim()}
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: quoteText.trim() ? t.accent : t.textMuted,
                padding: '4px 6px',
              }}
            >
              저장
            </button>
          </div>

          {/* 본문 */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          >
            {/* 구절 입력 */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 6, display: 'block' }}>
                구절
              </label>
              <textarea
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                placeholder="마음에 남는 문장을 기록해보세요..."
                className="w-full resize-none outline-none rounded-xl p-3"
                style={{
                  backgroundColor: t.card,
                  border: `1px solid ${t.border}`,
                  color: t.text,
                  fontFamily: 'Georgia, "Noto Serif KR", serif',
                  fontSize: 15,
                  minHeight: 160,
                  lineHeight: 1.8,
                }}
                autoFocus={mobileSheetMode === 'write'}
              />
            </div>

            {/* 내 생각 */}
            <div>
              <label
                style={{ fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Lightbulb size={11} />
                내 생각
              </label>
              <textarea
                value={quoteNote}
                onChange={e => setQuoteNote(e.target.value)}
                placeholder="이 구절에 대한 내 생각…"
                className="w-full resize-none outline-none rounded-xl p-3"
                style={{
                  backgroundColor: t.card,
                  border: `1px solid ${t.border}`,
                  color: t.textSub,
                  fontSize: 13.5,
                  minHeight: 110,
                  lineHeight: 1.65,
                }}
              />
            </div>

            {/* 페이지 + 태그 */}
            <div className="flex gap-2">
              <input
                type="number"
                value={quotePage}
                onChange={e => setQuotePage(e.target.value)}
                placeholder="페이지"
                className="rounded-xl px-3 py-2.5 outline-none text-sm flex-shrink-0"
                style={{ width: 100, backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
              />
              <input
                value={quoteTags}
                onChange={e => setQuoteTags(e.target.value)}
                placeholder="태그 (쉼표 구분)"
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 outline-none text-sm"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text }}
              />
            </div>

            {/* 사진으로 구절 담기 — 새 구절 작성 시에만(수정 모드는 텍스트만, 재촬영 v1 미지원) */}
            {mobileSheetMode === 'write' && (
              <button
                onClick={() => setCaptureOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600 }}
              >
                <Camera size={14} /> 사진으로 구절 담기
              </button>
            )}
            {quoteImageUrl && (
              <div className="flex items-center gap-2 rounded-xl px-2.5 py-2" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <img src={quoteImageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
                <span className="flex-1" style={{ fontSize: 12.5, color: t.textSub }}>
                  {mobileSheetMode === 'write' ? '사진이 이 구절에 첨부돼요' : '이 구절에 담긴 사진'}
                </span>
                {mobileSheetMode === 'write' && (
                  <button onClick={() => setQuoteImageUrl(null)} aria-label="사진 제거" style={{ color: t.textMuted }}><X size={16} /></button>
                )}
              </div>
            )}

            {/* 음성 입력 */}
            <button
              onClick={toggleRecording}
              disabled={isTranscribing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all"
              style={{
                backgroundColor: isRecording ? '#D4735A' : t.card,
                border: `1px solid ${isRecording ? '#D4735A' : t.border}`,
                color: isRecording ? '#fff' : t.textSub,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Mic size={14} />
              {isTranscribing ? '변환 중...' : isRecording ? '녹음 중...' : '음성으로 입력'}
            </button>
          </div>
        </div>
      )}

      {/* 사진으로 구절 담기 — 촬영/크롭/OCR 시트 */}
      <QuoteCaptureSheet
        isOpen={captureOpen}
        bookId={book.id}
        onClose={() => setCaptureOpen(false)}
        onConfirm={handleCaptureConfirm}
      />

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <ConfirmModal
          message={`"${book.title}"을(를) 삭제할까요?`}
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            onDelete(book.id);
            setConfirmDelete(false);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {confirmDeleteQuote && (
        <ConfirmModal
          message="이 구절을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            handleDeleteQuote(confirmDeleteQuote);
            setConfirmDeleteQuote(null);
          }}
          onCancel={() => setConfirmDeleteQuote(null)}
        />
      )}
    </>
  );
}

// ─── 구절 + 내 생각 표시 카드 (책 상세·구절 탭 공용) ───────────────────────
// expanded=true → 내 생각 전체 노출, false → 2줄 말줄임
// note 가 있으면 인용선(왼쪽 라인)을 강조 토큰(accent)으로, 없으면 옅은 토큰(borderLight)으로 칠해
// 목록에서 메모 달린 구절을 한눈에 구분한다.
function QuoteCard({
  quote,
  meta,
  rightSlot,
  expanded = false,
  onClick,
}: {
  quote: Quote;
  meta?: React.ReactNode;
  rightSlot?: React.ReactNode;
  expanded?: boolean;
  onClick?: () => void;
}) {
  const { t } = useTheme();
  const hasNote = !!(quote.note && quote.note.trim());
  const accentColor = hasNote ? t.accent : (t.borderLight ?? t.border);
  const [lightbox, setLightbox] = useState(false);

  return (
    <div
      className="flex rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${t.border}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {/* 왼쪽 인용선 — 메모 있으면 강조 */}
      <div style={{ width: 3, backgroundColor: accentColor, flexShrink: 0 }} />
      {/* 내용 */}
      <div className="flex-1 p-3" style={{ backgroundColor: t.card }}>
        {/* 구절 사진(사진으로 담은 구절) — 본문 위에 썸네일, 탭하면 확대 */}
        {quote.imageUrl && (
          <img
            src={quote.imageUrl}
            alt="구절 사진"
            onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
            style={{
              width: '100%',
              maxHeight: 160,
              objectFit: 'cover',
              borderRadius: 8,
              marginBottom: 8,
              border: `1px solid ${t.border}`,
              cursor: 'zoom-in',
              display: 'block',
            }}
          />
        )}
        <div className="flex items-start justify-between gap-2">
          {/* 구절 본문 — 살짝 들여쓰기로 인용 느낌 */}
          <p
            style={{
              fontSize: 13,
              color: t.text,
              lineHeight: 1.75,
              flex: 1,
              fontFamily: 'Georgia, "Noto Serif KR", serif',
              paddingLeft: 4,
              fontWeight: 500,
            }}
          >
            {quote.text}
          </p>
          {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
        </div>

        {/* 내 생각 — 있을 때만, 옅은 색 + 들여쓰기 + 전구 아이콘 */}
        {hasNote && (
          <div
            className="flex items-start gap-1.5 mt-2"
            style={{
              paddingLeft: 12,
              borderLeft: `1.5px dashed ${t.borderLight ?? t.border}`,
              marginLeft: 4,
            }}
          >
            <Lightbulb
              size={11}
              style={{ color: t.textMuted, flexShrink: 0, marginTop: 3 }}
            />
            <p
              style={{
                fontSize: 12,
                color: t.textSub,
                lineHeight: 1.65,
                flex: 1,
                ...(expanded
                  ? {}
                  : {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }),
              }}
            >
              {quote.note}
            </p>
          </div>
        )}

        {meta && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">{meta}</div>
        )}
      </div>

      {/* 사진 확대 라이트박스 */}
      {lightbox && quote.imageUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
            aria-label="닫기"
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            <X size={20} />
          </button>
          <img
            src={quote.imageUrl}
            alt="구절 사진"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}

// ─── 구절 패널 ──────────────────────────────────────────────────────────
type QuoteWithBook = Quote & { bookTitle: string; bookId: string };

function QuotesPanel({
  books,
  onToggleFavorite,
}: {
  books: Book[];
  onToggleFavorite: (bookId: string, quoteId: string) => void;
}) {
  const { t } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'book'>('recent');

  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  const allQuotes: QuoteWithBook[] = books.flatMap(b =>
    b.quotes.map(q => ({ ...q, bookTitle: b.title, bookId: b.id }))
  );

  const allTags = Array.from(new Set(allQuotes.flatMap(q => q.tags))).filter(Boolean);

  let filtered = allQuotes;
  if (searchText.trim()) {
    const q = searchText.trim().toLowerCase();
    filtered = filtered.filter(item => item.text.toLowerCase().includes(q));
  }
  if (activeFilter === 'fav') {
    filtered = filtered.filter(q => q.starred);
  } else if (activeFilter !== 'all') {
    filtered = filtered.filter(q => q.tags.includes(activeFilter));
  }
  if (sortBy === 'recent') {
    filtered = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    filtered = [...filtered].sort((a, b) => a.bookTitle.localeCompare(b.bookTitle));
  }

  const chips = [
    { key: 'all', label: '전체' },
    { key: 'fav', label: '즐겨찾기' },
    ...allTags.map(tag => ({ key: tag, label: `#${tag}` })),
  ];

  return (
    <div className="space-y-3">
      {/* 검색 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <Search size={14} color={t.textMuted} />
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="저장된 문장 검색..."
          className="flex-1 outline-none bg-transparent text-sm"
          style={{ color: t.text }}
        />
        {searchText && (
          <button onClick={() => setSearchText('')}>
            <X size={14} color={t.textMuted} />
          </button>
        )}
      </div>

      {/* 태그 필터 + 정렬 */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
          {chips.map(chip => (
            <button
              key={chip.key}
              onClick={() => setActiveFilter(chip.key)}
              className="px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                fontSize: 11,
                fontWeight: activeFilter === chip.key ? 700 : 400,
                backgroundColor: activeFilter === chip.key ? t.accent : t.card,
                color: activeFilter === chip.key ? '#fff' : t.textSub,
                border: `1px solid ${activeFilter === chip.key ? t.accent : t.border}`,
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortBy(s => s === 'recent' ? 'book' : 'recent')}
          className="flex-shrink-0 px-2.5 py-1 rounded-lg"
          style={{
            fontSize: 11,
            backgroundColor: t.card,
            color: t.textSub,
            border: `1px solid ${t.border}`,
          }}
        >
          {sortBy === 'recent' ? '최신순' : '책별'}
        </button>
      </div>

      {/* 구절 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p style={{ fontSize: 14, color: t.textMuted }}>
            {searchText || activeFilter !== 'all' ? '검색 결과가 없어요' : '저장된 구절이 없어요'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => (
            <QuoteCard
              key={q.id}
              quote={q}
              expanded={expandedQuoteId === q.id}
              onClick={() => setExpandedQuoteId(prev => prev === q.id ? null : q.id)}
              meta={
                <>
                  <span style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>
                    {q.bookTitle}{q.page ? ` · p.${q.page}` : ''}
                  </span>
                  {q.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded-md"
                      style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent }}>
                      #{tag}
                    </span>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(q.bookId, q.id); }}
                    className="ml-auto"
                    style={{ color: q.starred ? '#C4A882' : t.textMuted }}
                  >
                    <Star size={14} fill={q.starred ? '#C4A882' : 'none'} />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 통계 패널 ──────────────────────────────────────────────────────────
function StatsPanel({ books, onSelect }: { books: Book[]; onSelect: (b: Book) => void }) {
  // 이달의 문장
  const currentMonth = format(new Date(), 'yyyy-MM');
  const allFavQuotes = books.flatMap(b =>
    b.quotes
      .filter(q => q.starred)
      .map(q => ({ ...q, bookTitle: b.title }))
  );
  const thisMonthFav = allFavQuotes.filter(q => q.createdAt.startsWith(currentMonth));
  const featuredQuote = thisMonthFav.length > 0
    ? thisMonthFav[Math.floor(Math.random() * thisMonthFav.length)]
    : allFavQuotes.length > 0
      ? allFavQuotes[Math.floor(Math.random() * allFavQuotes.length)]
      : null;
  const { t } = useTheme();
  const currentYear = new Date().getFullYear();
  const [viewYear, setViewYear] = useState(currentYear);

  const doneBooks = books.filter(b => b.status === 'done');
  const yearDone = doneBooks.filter(b =>
    (b.finishDate ?? b.addedAt).startsWith(String(currentYear))
  );
  const monthDone = doneBooks.filter(b =>
    (b.finishDate ?? b.addedAt).startsWith(currentMonth)
  );

  // 선택 연도 완독 권수 (책탑 헤더 표시용)
  const viewYearDoneCount = doneBooks.filter(b =>
    (b.finishDate ?? b.addedAt).startsWith(String(viewYear))
  ).length;

  const panel = {
    backgroundColor: t.card,
    border: `1px solid ${t.borderLight ?? t.border}`,
    borderRadius: 16,
    padding: 16,
  };

  return (
    <div className="space-y-4">
      {/* 꾸준함 히트맵 */}
      <ReadingPulse books={books} t={t} />

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '전체 독서', value: doneBooks.length, unit: '권' },
          { label: `${currentYear}년`, value: yearDone.length, unit: '권' },
          { label: '이번 달', value: monthDone.length, unit: '권' },
        ].map(item => (
          <div key={item.label} style={panel} className="text-center">
            <p style={{ fontSize: 22, fontWeight: 800, color: t.accent }}>{item.value}</p>
            <p style={{ fontSize: 10, color: t.textMuted }}>{item.unit}</p>
            <p style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* 월별 책탑 (연도별) */}
      <div style={panel}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
            월별 완독 현황
          </p>
          {/* 연도 네비게이션 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewYear(y => y - 1)}
              className="p-1 rounded-lg transition-colors"
              style={{ color: t.textSub }}
              title="이전 해"
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.text, minWidth: 64, textAlign: 'center' }}>
              {viewYear}년
              <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, marginLeft: 4 }}>{viewYearDoneCount}권</span>
            </span>
            <button
              onClick={() => setViewYear(y => Math.min(currentYear, y + 1))}
              disabled={viewYear >= currentYear}
              className="p-1 rounded-lg transition-colors"
              style={{ color: viewYear >= currentYear ? t.textMuted : t.textSub, opacity: viewYear >= currentYear ? 0.35 : 1 }}
              title="다음 해"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <MonthlyTower books={books} year={viewYear} onSelect={onSelect} t={t} />
      </div>

      {/* 이달의 문장 */}
      {featuredQuote && (
        <div style={panel}>
          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>
            이달의 문장
          </p>
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            <div style={{ width: 3, backgroundColor: t.accent, flexShrink: 0 }} />
            <div className="flex-1 p-3" style={{ backgroundColor: t.bgSub }}>
              <p style={{
                fontSize: 14,
                color: t.text,
                lineHeight: 1.8,
                fontFamily: 'Georgia, "Noto Serif KR", serif',
              }}>
                {featuredQuote.text}
              </p>
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 8, fontWeight: 600 }}>
                — {featuredQuote.bookTitle}
                {featuredQuote.page ? ` · p.${featuredQuote.page}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 뷰 ──────────────────────────────────────────────────────────
export function BooksView() {
  const { t } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BookStatus | 'quotes' | 'stats'>('reading');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // 전역 FAB — 책 추가
  useFabAction({ kind: 'action', label: '책 추가', icon: Plus, onPress: () => setShowSearch(true) });

  // ── Supabase에서 불러오기 ──
  const fetchBooksData = useCallback(async () => {
      const { data: booksData, error: bErr } = await supabase
        .from('books').select('*').order('added_at', { ascending: false });
      if (bErr) { console.error('[books] fetch:', bErr.message); setLoading(false); return; }

      const { data: quotesData, error: qErr } = await supabase
        .from('book_quotes').select('*').order('created_at', { ascending: false });
      if (qErr) console.error('[book_quotes] fetch:', qErr.message);

      // 책별 구절 맵핑
      const quoteMap: Record<string, Quote[]> = {};
      for (const q of (quotesData ?? [])) {
        if (!quoteMap[q.book_id]) quoteMap[q.book_id] = [];
        quoteMap[q.book_id].push({
          id: q.id,
          text: q.text,
          page: q.page ?? undefined,
          tags: q.tags ?? [],
          starred: q.starred ?? false,
          createdAt: q.created_at,
          note: q.note ?? undefined,
          imageUrl: q.image_url ?? undefined,
        });
      }

      setBooks((booksData ?? []).map((b: any): Book => ({
        id: b.id,
        title: b.title,
        author: b.author ?? '',
        publisher: b.publisher ?? '',
        thumbnail: b.thumbnail ?? '',
        totalPages: b.total_pages ?? 0,
        currentPage: b.current_page ?? 0,
        status: b.status as BookStatus,
        quotes: quoteMap[b.id] ?? [],
        startDate: b.start_date ?? undefined,
        finishDate: b.finish_date ?? undefined,
        addedAt: b.added_at,
      })));
      setLoading(false);
  }, []);
  useEffect(() => { fetchBooksData(); }, [fetchBooksData]);
  useRealtimeSync('books', fetchBooksData);
  useRealtimeSync('book_quotes', fetchBooksData);
  useEffect(() => { setPage(1); }, [activeTab]);

  const handleAdd = (data: Omit<Book, 'id' | 'quotes' | 'addedAt'>) => {
    const book: Book = {
      ...data,
      id: nanoid(),
      quotes: [],
      addedAt: format(new Date(), 'yyyy-MM-dd'),
      startDate: data.status === 'reading' ? format(new Date(), 'yyyy-MM-dd') : undefined,
      finishDate: data.status === 'done' ? format(new Date(), 'yyyy-MM-dd') : undefined,
    };
    // 낙관적 업데이트 — UI 즉시 반영
    setBooks(prev => [book, ...prev]);
    setActiveTab(data.status);
    // 백그라운드 Supabase 저장
    supabase.from('books').insert({
      id: book.id,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      thumbnail: book.thumbnail,
      total_pages: book.totalPages,
      current_page: book.currentPage,
      status: book.status,
      start_date: book.startDate ?? null,
      finish_date: book.finishDate ?? null,
      added_at: book.addedAt,
    }).then(({ error }) => {
      if (error) {
        console.error('[books] insert 실패 — 롤백:', error.message);
        setBooks(prev => prev.filter(b => b.id !== book.id));
      }
    });
  };

  const handleUpdate = (updated: Book) => {
    setBooks(prev => prev.map(b => b.id === updated.id ? updated : b));
    setSelectedBook(updated);
  };

  const handleDelete = (id: string) => {
    // 낙관적 업데이트
    setBooks(prev => prev.filter(b => b.id !== id));
    setSelectedBook(null);
    supabase.from('books').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('[books] delete 실패:', error.message);
    });
  };

  const handleToggleFavoriteGlobal = (bookId: string, quoteId: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    const target = book.quotes.find(q => q.id === quoteId);
    if (!target) return;
    const newFav = !target.starred;
    setBooks(prev => prev.map(b =>
      b.id === bookId
        ? { ...b, quotes: b.quotes.map(q => q.id === quoteId ? { ...q, starred: newFav } : q) }
        : b
    ));
    supabase.from('book_quotes').update({ starred: newFav }).eq('id', quoteId)
      .then(({ error }) => {
        if (error) console.error('[book_quotes] starred:', error.message);
      });
  };

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const filteredBooks = activeTab === 'stats' || activeTab === 'quotes'
    ? []
    : books.filter(b => b.status === activeTab);

  const totalPages = Math.ceil(filteredBooks.length / PAGE_SIZE);
  const pagedBooks = filteredBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabCounts: Record<BookStatus, number> = {
    reading: books.filter(b => b.status === 'reading').length,
    want: books.filter(b => b.status === 'want').length,
    done: books.filter(b => b.status === 'done').length,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: 'var(--font-gmarket)' }}>독서 기록</h1>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            총 {books.length}권 · 완독 {books.filter(b => b.status === 'done').length}권
          </p>
        </div>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={16} />
          책 추가
        </button>
      </div>

      {/* 탭 */}
      <div className="flex-shrink-0 px-4 pb-3">
        {(() => {
          const activeIndex = TAB_LIST.findIndex(tab => tab.key === activeTab);
          const totalQuoteCount = books.reduce((acc, b) => acc + b.quotes.length, 0);
          return (
            <div
              className="relative flex p-1 rounded-2xl overflow-hidden"
              style={{ backgroundColor: t.card }}
            >
              {/* 슬라이딩 pill */}
              <div
                style={{
                  position: 'absolute',
                  top: 4, bottom: 4,
                  left: `calc(4px + ${activeIndex} * (100% - 8px) / ${TAB_LIST.length})`,
                  width: `calc((100% - 8px) / ${TAB_LIST.length})`,
                  backgroundColor: t.accent,
                  borderRadius: 10,
                  transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />

              {TAB_LIST.map((tab, idx) => {
                const isActive = activeTab === tab.key;
                const count =
                  tab.key === 'quotes' ? totalQuoteCount
                  : tab.key === 'stats' ? null
                  : tabCounts[tab.key as BookStatus];
                const showDivider = idx > 0 && !isActive && activeIndex !== idx - 1;
                return (
                  <div key={tab.key} className="flex-1 relative flex items-center" style={{ zIndex: 1 }}>
                    {showDivider && (
                      <div style={{
                        position: 'absolute', left: 0,
                        top: '20%', height: '60%',
                        width: 1,
                        backgroundColor: t.border,
                        pointerEvents: 'none',
                      }} />
                    )}
                    <button
                      onClick={() => setActiveTab(tab.key)}
                      className="flex-1 py-2"
                      style={{
                        fontSize: 11,
                        fontWeight: isActive ? 700 : 400,
                        color: isActive ? '#fff' : t.textMuted,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {tab.label}
                      {count !== null && count > 0 && (
                        <span className="ml-1" style={{
                          fontSize: 9,
                          backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : t.accentLight,
                          color: isActive ? '#fff' : t.accent,
                          padding: '1px 5px',
                          borderRadius: 99,
                        }}>
                          {count}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <p style={{ fontSize: 13, color: t.textMuted }}>불러오는 중...</p>
          </div>
        ) : activeTab === 'stats' ? (
          <StatsPanel books={books} onSelect={setSelectedBook} />
        ) : activeTab === 'quotes' ? (
          <QuotesPanel books={books} onToggleFavorite={handleToggleFavoriteGlobal} />
        ) : filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <BookMarked size={36} color={t.textMuted} strokeWidth={1.5} />
            <p style={{ fontSize: 14, color: t.textMuted }}>
              {activeTab === 'reading' && '읽고 있는 책이 없어요'}
              {activeTab === 'want' && '읽고 싶은 책을 추가해보세요'}
              {activeTab === 'done' && '완독한 책이 없어요'}
            </p>
            <button
              onClick={() => setShowSearch(true)}
              className="px-4 py-2 rounded-xl"
              style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600 }}
            >
              + 책 추가하기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pagedBooks.map(book => {
              const pct = progressPct(book);
              return (
                <button
                  key={book.id}
                  onClick={() => setSelectedBook(book)}
                  className="w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all"
                  style={{
                    backgroundColor: t.card,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  {/* 표지 */}
                  {book.thumbnail ? (
                    <img src={book.thumbnail} alt={book.title}
                      className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: t.bgSub }}>
                      <BookOpen size={20} color={t.textMuted} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ fontSize: 14, color: t.text }}>
                      {book.title}
                    </p>
                    <p className="truncate" style={{ fontSize: 12, color: t.textSub }}>
                      {book.author}
                      {book.publisher ? ` · ${book.publisher}` : ''}
                    </p>

                    {/* 마라톤 트랙 (읽는 중만) */}
                    {book.status === 'reading' && book.totalPages > 0 && (
                      <MarathonTrack
                        currentPage={book.currentPage}
                        totalPages={book.totalPages}
                        t={t}
                      />
                    )}

                    {/* 완독 날짜 */}
                    {book.status === 'done' && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span style={{ fontSize: 11 }}>🏆</span>
                        <p style={{ fontSize: 11, color: STATUS_COLORS.done, fontWeight: 600 }}>
                          {book.finishDate ?? book.addedAt} 완독
                        </p>
                      </div>
                    )}

                    {/* 구절 수 */}
                    {book.quotes.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Tag size={10} color={t.textMuted} />
                        <span style={{ fontSize: 10, color: t.textMuted }}>
                          구절 {book.quotes.length}개
                        </span>
                      </div>
                    )}
                  </div>

                  <ChevronRight size={16} color={t.textMuted} />
                </button>
              );
            })}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2 pb-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
                  style={{
                    backgroundColor: page === 1 ? 'transparent' : t.card,
                    border: `1px solid ${page === 1 ? 'transparent' : t.border}`,
                    color: page === 1 ? t.textMuted : t.text,
                    opacity: page === 1 ? 0.3 : 1,
                    cursor: page === 1 ? 'default' : 'pointer',
                  }}
                >
                  <ChevronLeft size={15} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
                    style={{
                      fontSize: 12,
                      fontWeight: p === page ? 700 : 400,
                      backgroundColor: p === page ? t.accent : t.card,
                      border: `1px solid ${p === page ? t.accent : t.border}`,
                      color: p === page ? '#fff' : t.textSub,
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
                  style={{
                    backgroundColor: page === totalPages ? 'transparent' : t.card,
                    border: `1px solid ${page === totalPages ? 'transparent' : t.border}`,
                    color: page === totalPages ? t.textMuted : t.text,
                    opacity: page === totalPages ? 0.3 : 1,
                    cursor: page === totalPages ? 'default' : 'pointer',
                  }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 모달들 */}
      {showSearch && (
        <BookSearchModal onClose={() => setShowSearch(false)} onAdd={handleAdd} />
      )}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onComplete={() => setActiveTab('done')}
        />
      )}
    </div>
  );
}
