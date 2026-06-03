import { useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { searchTMDB, getPosterUrl, hasTMDBToken, type TMDBResult } from '../../../lib/tmdb';
import type { Notify } from './CultureToast';

interface TMDBSearchPanelProps {
  onSelect: (result: TMDBResult) => void;
  notify?: Notify;
}

export function TMDBSearchPanel({ onSelect, notify }: TMDBSearchPanelProps) {
  const { t } = useTheme();
  const tokenAvailable = hasTMDBToken();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const reqId = useRef(0);

  // 300ms debounce 검색
  useEffect(() => {
    if (!tokenAvailable) return;
    const q = query.trim();
    if (!q) { setResults([]); setSearched(false); return; }

    const myReq = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchTMDB(q);
        if (myReq !== reqId.current) return; // 최신 요청만 반영
        setResults(data);
        setSearched(true);
      } catch (err: any) {
        if (myReq !== reqId.current) return;
        setResults([]);
        setSearched(true);
        if (err?.status === 401) notify?.('TMDB 토큰이 유효하지 않습니다', 'error');
        else notify?.('TMDB 검색 실패 — 수동 입력으로 추가하세요', 'error');
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, tokenAvailable, notify]);

  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 10, padding: '8px 10px 8px 32px', fontSize: 13,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  if (!tokenAvailable) {
    return (
      <div className="rounded-xl p-3" style={{ backgroundColor: t.bgSub, border: `1px dashed ${t.border}` }}>
        <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
          <code>VITE_TMDB_API_TOKEN</code> 환경변수가 설정되지 않았습니다. TMDB 검색을 사용하려면 토큰을 추가하세요. (수동 입력은 계속 가능합니다)
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
      <div className="relative">
        <Search size={15} color={t.textMuted}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder="영화·드라마 제목 검색" style={fieldStyle} />
        {loading && (
          <Loader2 size={15} color={t.accent} className="animate-spin"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} />
        )}
      </div>

      {searched && !loading && results.length === 0 && (
        <p style={{ fontSize: 12, color: t.textMuted, padding: '4px 2px' }}>
          검색 결과 없음 — 수동 입력으로 추가하세요
        </p>
      )}

      {/* PC: 포스터 3열 그리드 (Stage 2 그대로 유지) */}
      {results.length > 0 && (
        <div className="hidden lg:grid grid-cols-3 gap-2 max-h-[260px] overflow-y-auto">
          {results.map(r => {
            const poster = getPosterUrl(r.poster_path);
            return (
              <button key={`${r.type}-${r.id}`} type="button"
                onClick={() => onSelect(r)}
                className="text-left rounded-lg overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <div className="relative" style={{ aspectRatio: '2 / 3', backgroundColor: t.bgSub }}>
                  {poster
                    ? <img src={poster} alt={r.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"
                        style={{ fontSize: 10, color: t.textMuted }}>이미지 없음</div>}
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded"
                    style={{ fontSize: 9, fontWeight: 600, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    {r.type === 'movie' ? '영화' : 'TV'}
                  </span>
                </div>
                <div className="p-1.5">
                  <p style={{ fontSize: 11, fontWeight: 600, color: t.text, lineHeight: 1.25,
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {r.title || r.original_title}
                  </p>
                  {r.original_title && r.original_title !== r.title && (
                    <p style={{ fontSize: 9, color: t.textMuted, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.original_title}</p>
                  )}
                  {r.year && <p style={{ fontSize: 9, color: t.textMuted }}>{r.year}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 모바일: 3열 포스터 그리드 */}
      {results.length > 0 && (
        <div className="lg:hidden grid grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}>
          {results.map(r => {
            const poster = getPosterUrl(r.poster_path);
            return (
              <button key={`${r.type}-${r.id}`} type="button"
                onClick={() => onSelect(r)}
                className="text-left flex flex-col active:opacity-70 transition-opacity">
                {/* 포스터 (2:3 비율) */}
                <div className="relative rounded-lg overflow-hidden w-full"
                  style={{ aspectRatio: '2 / 3', backgroundColor: t.bgSub }}>
                  {poster
                    ? <img src={poster} alt={r.title || r.original_title}
                        className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"
                        style={{ fontSize: 9, color: t.textMuted }}>없음</div>}
                  {/* 유형 뱃지 */}
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded"
                    style={{ fontSize: 9, fontWeight: 700, color: '#fff',
                      backgroundColor: r.type === 'movie' ? 'rgba(196,168,130,0.9)' : 'rgba(107,170,122,0.9)' }}>
                    {r.type === 'movie' ? '영화' : 'TV'}
                  </span>
                </div>
                {/* 제목 + 연도 */}
                <div className="mt-1 px-0.5">
                  <p style={{ fontSize: 11, fontWeight: 600, color: t.text, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {r.title || r.original_title}
                  </p>
                  {r.year && (
                    <p style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>{r.year}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
