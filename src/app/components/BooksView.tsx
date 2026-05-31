import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Plus, BookOpen, ChevronRight, Tag, Trash2, BookMarked, Check, Mic, Star } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// ─── 타입 ──────────────────────────────────────────────────────────────
type BookStatus = 'reading' | 'want' | 'done';

type Quote = {
  id: string;
  text: string;
  page?: number;
  tags: string[];
  starred: boolean;
  createdAt: string;
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
}: {
  book: Book;
  onClose: () => void;
  onUpdate: (b: Book) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const [currentPage, setCurrentPage] = useState(String(book.currentPage));
  const [totalPages, setTotalPages] = useState(String(book.totalPages || ''));
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [quoteText, setQuoteText] = useState('');
  const [quotePage, setQuotePage] = useState('');
  const [quoteTags, setQuoteTags] = useState('');
  const [activeTab, setActiveTab] = useState<'progress' | 'quotes'>('progress');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const hasSpeechApi = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const pct = totalPages && parseInt(totalPages) > 0
    ? Math.min(100, Math.round((parseInt(currentPage || '0') / parseInt(totalPages)) * 100))
    : 0;

  const handleSaveProgress = () => {
    const updated: Book = {
      ...book,
      currentPage: parseInt(currentPage) || 0,
      totalPages: parseInt(totalPages) || 0,
      status,
      finishDate: status === 'done' && !book.finishDate
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
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQuoteText(prev => prev ? prev + ' ' + transcript : transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const handleAddQuote = () => {
    if (!quoteText.trim()) return;
    const tags = quoteTags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
    const quote: Quote = {
      id: nanoid(),
      text: quoteText.trim(),
      page: quotePage ? parseInt(quotePage) : undefined,
      tags,
      starred: false,
      createdAt: format(new Date(), 'yyyy-MM-dd'),
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
    }).then(({ error }) => {
      if (error) console.error('[book_quotes] insert:', error.message);
    });
    onUpdate({ ...book, quotes: [quote, ...book.quotes] });
    setQuoteText('');
    setQuotePage('');
    setQuoteTags('');
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
          className="w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl overflow-hidden flex flex-col"
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
            {(['progress', 'quotes'] as const).map(tab => (
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
                {tab === 'progress' ? '독서 진도' : `구절 (${book.quotes.length})`}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
                {parseInt(totalPages) > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span style={{ fontSize: 12, color: t.textSub }}>
                        진도율
                      </span>
                      <span style={{ fontSize: 13, color: t.accent, fontWeight: 700 }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: t.accent }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                      {parseInt(currentPage) || 0}p / {parseInt(totalPages)}p
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSaveProgress}
                  className="w-full py-3 rounded-xl font-semibold"
                  style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14 }}
                >
                  저장하기
                </button>
              </>
            )}

            {/* 구절 탭 */}
            {activeTab === 'quotes' && (
              <>
                {/* 구절 입력 영역 */}
                <div className="p-3 rounded-xl space-y-2"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                  <textarea
                    value={quoteText}
                    onChange={e => setQuoteText(e.target.value)}
                    placeholder="마음에 남는 문장을 기록해보세요..."
                    className="w-full resize-none outline-none"
                    style={{
                      backgroundColor: 'transparent',
                      color: t.text,
                      fontFamily: 'Georgia, "Noto Serif KR", serif',
                      fontSize: 14,
                      minHeight: 80,
                      lineHeight: 1.75,
                    }}
                  />
                  {/* 1행: 페이지 + 태그 */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={quotePage}
                      onChange={e => setQuotePage(e.target.value)}
                      placeholder="페이지"
                      className="rounded-lg px-2 py-1.5 outline-none text-xs flex-shrink-0"
                      style={{ width: 72, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
                    />
                    <input
                      value={quoteTags}
                      onChange={e => setQuoteTags(e.target.value)}
                      placeholder="태그 (쉼표 구분)"
                      className="flex-1 min-w-0 rounded-lg px-2 py-1.5 outline-none text-xs"
                      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
                    />
                  </div>
                  {/* 2행: 음성 버튼 + 저장 버튼 */}
                  <div className="flex gap-2">
                    {hasSpeechApi && (
                      <button
                        onClick={toggleRecording}
                        className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg transition-all"
                        style={{
                          backgroundColor: isRecording ? '#D4735A' : t.bgSub,
                          border: `1px solid ${isRecording ? '#D4735A' : t.border}`,
                          color: isRecording ? '#fff' : t.textMuted,
                          fontSize: 12,
                        }}
                      >
                        <Mic size={13} />
                        {isRecording ? '녹음 중...' : '음성 입력'}
                      </button>
                    )}
                    <button
                      onClick={handleAddQuote}
                      disabled={!quoteText.trim()}
                      className="flex-1 py-1.5 rounded-lg"
                      style={{
                        backgroundColor: quoteText.trim() ? t.accent : t.bgSub,
                        color: quoteText.trim() ? '#fff' : t.textMuted,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      저장
                    </button>
                  </div>
                </div>

                {/* 구절 목록 */}
                <div className="space-y-2">
                  {book.quotes.length === 0 && (
                    <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', paddingTop: 16 }}>
                      저장된 구절이 없어요
                    </p>
                  )}
                  {book.quotes.map(q => (
                    <div key={q.id} className="flex rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${t.border}` }}>
                      {/* 왼쪽 accent 라인 */}
                      <div style={{ width: 3, backgroundColor: t.accent, flexShrink: 0 }} />
                      {/* 내용 */}
                      <div className="flex-1 p-3" style={{ backgroundColor: t.card }}>
                        <div className="flex items-start justify-between gap-2">
                          <p style={{
                            fontSize: 13,
                            color: t.text,
                            lineHeight: 1.75,
                            flex: 1,
                            fontFamily: 'Georgia, "Noto Serif KR", serif',
                          }}>
                            {q.text}
                          </p>
                          <button
                            onClick={() => setConfirmDeleteQuote(q.id)}
                            style={{ color: t.textMuted, flexShrink: 0 }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                            onClick={() => handleToggleFavorite(q.id)}
                            className="ml-auto"
                            style={{ color: q.starred ? '#C4A882' : t.textMuted }}
                          >
                            <Star size={14} fill={q.starred ? '#C4A882' : 'none'} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
            <div key={q.id} className="flex rounded-xl overflow-hidden"
              style={{ border: `1px solid ${t.border}` }}>
              <div style={{ width: 3, backgroundColor: t.accent, flexShrink: 0 }} />
              <div className="flex-1 p-3" style={{ backgroundColor: t.card }}>
                <p style={{
                  fontSize: 13,
                  color: t.text,
                  lineHeight: 1.75,
                  fontFamily: 'Georgia, "Noto Serif KR", serif',
                }}>
                  {q.text}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                    onClick={() => onToggleFavorite(q.bookId, q.id)}
                    className="ml-auto"
                    style={{ color: q.starred ? '#C4A882' : t.textMuted }}
                  >
                    <Star size={14} fill={q.starred ? '#C4A882' : 'none'} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 통계 패널 ──────────────────────────────────────────────────────────
function StatsPanel({ books }: { books: Book[] }) {
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

  const doneBooks = books.filter(b => b.status === 'done');
  const yearDone = doneBooks.filter(b =>
    (b.finishDate ?? b.addedAt).startsWith(String(currentYear))
  );
  const monthDone = doneBooks.filter(b =>
    (b.finishDate ?? b.addedAt).startsWith(currentMonth)
  );

  // 월별 독서량 (최근 6개월)
  const monthlyData: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = format(d, 'yyyy-MM');
    const label = format(d, 'M월', { locale: ko });
    const count = doneBooks.filter(b =>
      (b.finishDate ?? b.addedAt).startsWith(key)
    ).length;
    monthlyData.push({ label, count });
  }

  const maxCount = Math.max(...monthlyData.map(d => d.count), 1);

  const panel = {
    backgroundColor: t.card,
    border: `1px solid ${t.borderLight ?? t.border}`,
    borderRadius: 16,
    padding: 16,
  };

  return (
    <div className="space-y-4">
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

      {/* 월별 바 차트 */}
      <div style={panel}>
        <p style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 12 }}>
          월별 완독 현황
        </p>
        <div className="flex items-end gap-2" style={{ height: 80 }}>
          {monthlyData.map(d => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
              <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, minHeight: 14 }}>
                {d.count > 0 ? d.count : ''}
              </span>
              <div className="w-full rounded-t-md transition-all"
                style={{
                  height: d.count === 0 ? 4 : Math.max(8, (d.count / maxCount) * 56),
                  backgroundColor: d.count > 0 ? t.accent : t.bgSub,
                }}
              />
              <span style={{ fontSize: 10, color: t.textMuted }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 읽는 중 */}
      {books.filter(b => b.status === 'reading').length > 0 && (
        <div style={panel}>
          <p style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>
            현재 읽는 중 ({books.filter(b => b.status === 'reading').length}권)
          </p>
          <div className="space-y-3">
            {books.filter(b => b.status === 'reading').map(b => (
              <div key={b.id}>
                <div className="flex justify-between items-center mb-1">
                  <span style={{ fontSize: 12, color: t.text }} className="truncate flex-1 mr-2">
                    {b.title}
                  </span>
                  <span style={{ fontSize: 11, color: t.accent, fontWeight: 700 }}>
                    {progressPct(b)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${progressPct(b)}%`, backgroundColor: STATUS_COLORS.reading }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

  const filteredBooks = activeTab === 'stats' || activeTab === 'quotes'
    ? []
    : books.filter(b => b.status === activeTab);

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
          <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text }}>독서 기록</h1>
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
        <div className="flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: t.card }}>
          {TAB_LIST.map(tab => {
            const isActive = activeTab === tab.key;
            const totalQuoteCount = books.reduce((acc, b) => acc + b.quotes.length, 0);
            const count =
              tab.key === 'quotes' ? totalQuoteCount
              : tab.key === 'stats' ? null
              : tabCounts[tab.key as BookStatus];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 py-2 rounded-xl transition-all"
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                  backgroundColor: isActive ? t.accent : 'transparent',
                  color: isActive ? '#fff' : t.textMuted,
                }}
              >
                {tab.label}
                {count !== null && count > 0 && (
                  <span className="ml-1"
                    style={{
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
            );
          })}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <p style={{ fontSize: 13, color: t.textMuted }}>불러오는 중...</p>
          </div>
        ) : activeTab === 'stats' ? (
          <StatsPanel books={books} />
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
            {filteredBooks.map(book => {
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

                    {/* 진도 바 (읽는 중만) */}
                    {book.status === 'reading' && book.totalPages > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS.reading }} />
                        </div>
                        <p style={{ fontSize: 10, color: t.textMuted, marginTop: 3 }}>
                          {book.currentPage}p / {book.totalPages}p · {pct}%
                        </p>
                      </div>
                    )}

                    {/* 완독 날짜 */}
                    {book.status === 'done' && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Check size={11} color={STATUS_COLORS.done} />
                        <p style={{ fontSize: 11, color: STATUS_COLORS.done }}>
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
        />
      )}
    </div>
  );
}
