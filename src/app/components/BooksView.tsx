import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Plus, BookOpen, ChevronRight, Tag, Trash2, BarChart2, BookMarked, Check } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';

// ─── 타입 ──────────────────────────────────────────────────────────────
type BookStatus = 'reading' | 'want' | 'done';

type Quote = {
  id: string;
  text: string;
  page?: number;
  tags: string[];
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

const TAB_LIST: { key: BookStatus | 'stats'; label: string }[] = [
  { key: 'reading', label: '읽는 중' },
  { key: 'want', label: '읽고 싶어요' },
  { key: 'done', label: '완독' },
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
    if (docs.length === 0) setIsManual(true);
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
                </div>
              )}
              {/* 직접 입력 */}
              <button
                onClick={() => setIsManual(true)}
                className="w-full py-2.5 rounded-xl text-center"
                style={{ border: `1px dashed ${t.border}`, fontSize: 13, color: t.textSub }}
              >
                + 직접 입력하기
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
    onUpdate(updated);
  };

  const handleAddQuote = () => {
    if (!quoteText.trim()) return;
    const tags = quoteTags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
    const quote: Quote = {
      id: nanoid(),
      text: quoteText.trim(),
      page: quotePage ? parseInt(quotePage) : undefined,
      tags,
      createdAt: format(new Date(), 'yyyy-MM-dd'),
    };
    onUpdate({ ...book, quotes: [quote, ...book.quotes] });
    setQuoteText('');
    setQuotePage('');
    setQuoteTags('');
  };

  const handleDeleteQuote = (qid: string) => {
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
                {/* 구절 입력 */}
                <div className="p-3 rounded-xl space-y-2"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                  <textarea
                    value={quoteText}
                    onChange={e => setQuoteText(e.target.value)}
                    placeholder="좋은 구절을 입력하세요..."
                    rows={3}
                    className="w-full resize-none outline-none text-sm"
                    style={{ backgroundColor: 'transparent', color: t.text }}
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={quotePage}
                      onChange={e => setQuotePage(e.target.value)}
                      placeholder="페이지"
                      className="w-20 rounded-lg px-2 py-1.5 outline-none text-xs"
                      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
                    />
                    <input
                      value={quoteTags}
                      onChange={e => setQuoteTags(e.target.value)}
                      placeholder="태그 (쉼표 구분)"
                      className="flex-1 rounded-lg px-2 py-1.5 outline-none text-xs"
                      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
                    />
                    <button
                      onClick={handleAddQuote}
                      disabled={!quoteText.trim()}
                      className="px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: t.accent, color: '#fff', fontSize: 12, fontWeight: 600 }}
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
                    <div key={q.id} className="p-3 rounded-xl"
                      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, flex: 1 }}>
                          "{q.text}"
                        </p>
                        <button
                          onClick={() => setConfirmDeleteQuote(q.id)}
                          style={{ color: t.textMuted, flexShrink: 0 }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                        <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 'auto' }}>
                          {q.createdAt}
                        </span>
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

// ─── 통계 패널 ──────────────────────────────────────────────────────────
function StatsPanel({ books }: { books: Book[] }) {
  const { t } = useTheme();
  const currentYear = new Date().getFullYear();
  const currentMonth = format(new Date(), 'yyyy-MM');

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
    </div>
  );
}

// ─── 메인 뷰 ──────────────────────────────────────────────────────────
export function BooksView() {
  const { t } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<BookStatus | 'stats'>('reading');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const handleAdd = (data: Omit<Book, 'id' | 'quotes' | 'addedAt'>) => {
    const book: Book = {
      ...data,
      id: nanoid(),
      quotes: [],
      addedAt: format(new Date(), 'yyyy-MM-dd'),
      startDate: data.status === 'reading' ? format(new Date(), 'yyyy-MM-dd') : undefined,
      finishDate: data.status === 'done' ? format(new Date(), 'yyyy-MM-dd') : undefined,
    };
    setBooks(prev => [book, ...prev]);
    setActiveTab(data.status);
  };

  const handleUpdate = (updated: Book) => {
    setBooks(prev => prev.map(b => b.id === updated.id ? updated : b));
    setSelectedBook(updated);
  };

  const handleDelete = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    setSelectedBook(null);
  };

  const filteredBooks = activeTab === 'stats'
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
            const count = tab.key !== 'stats' ? tabCounts[tab.key as BookStatus] : null;
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
        {activeTab === 'stats' ? (
          <StatsPanel books={books} />
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
