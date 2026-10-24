import { useEffect, useRef, useState } from 'react';
import { cultureTMDBSuggestions, cultureYouTubeSuggestion, cultureYouTubeId, type CultureSuggestion } from '../../../../lib/cultureMetadata';
import { CultureImage } from './CultureImage';

export function CultureMetadataSearch({disabled, onSelect}: {disabled: boolean; onSelect: (suggestion: CultureSuggestion) => void}) {
  const [mode, setMode] = useState<'manual' | 'tmdb' | 'youtube'>('manual');
  const [query, setQuery] = useState(''), [results, setResults] = useState<CultureSuggestion[]>([]);
  const [loading, setLoading] = useState(false), [message, setMessage] = useState('');
  const active = useRef<AbortController | null>(null), generation = useRef(0);
  const cache = useRef(new Map<string, CultureSuggestion[]>());
  const youtubeId = mode === 'youtube' ? cultureYouTubeId(query.trim()) : null;
  const cancel = () => { generation.current++; active.current?.abort(); active.current = null; setLoading(false); };
  useEffect(() => () => { generation.current++; active.current?.abort(); }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  const changeMode = (next: typeof mode) => { cancel(); setMode(next); setQuery(''); setResults([]); setMessage(''); };
  async function search() {
    if (disabled || active.current || !query.trim()) return;
    const key = `${mode}:${query.trim()}`;
    const controller = new AbortController(); active.current = controller;
    const request = ++generation.current;
    setLoading(true); setMessage(''); setResults([]);
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const suggestions = cache.current.get(key) ?? await (mode === 'tmdb'
        ? cultureTMDBSuggestions(query.trim(), controller.signal)
        : cultureYouTubeSuggestion(query.trim(), controller.signal));
      if (request !== generation.current) return;
      cache.current.set(key, suggestions); setResults(suggestions);
      setMessage(suggestions.length ? '정보를 확인한 뒤 입력에 사용해주세요. 이미 적은 내용은 유지해요.' : '검색 결과가 없어요. 직접 입력으로 남길 수 있어요.');
    } catch {
      if (request === generation.current) setMessage('정보를 불러오지 못했어요. 주소·연결을 확인하거나 직접 입력해주세요.');
    } finally {
      clearTimeout(timer);
      if (request === generation.current) { active.current = null; setLoading(false); }
    }
  }
  return <section className="mc-metadata" aria-label="작품 정보 가져오기">
    <div className="mc-tabs" role="group" aria-label="입력 방식">
      <button type="button" disabled={disabled} aria-pressed={mode === 'manual'} onClick={() => changeMode('manual')}>직접 입력</button>
      <button type="button" disabled={disabled} aria-pressed={mode === 'tmdb'} onClick={() => changeMode('tmdb')}>작품 검색</button>
      <button type="button" disabled={disabled} aria-pressed={mode === 'youtube'} onClick={() => changeMode('youtube')}>YouTube URL 입력</button>
    </div>
    {mode !== 'manual' && <><div className="mc-search-input"><label>{mode === 'tmdb' ? '검색할 작품명' : 'YouTube URL'}<input aria-label={mode === 'tmdb' ? '검색할 작품명' : 'YouTube URL'} value={query} disabled={disabled} onChange={e => {cancel(); setQuery(e.target.value); setResults([]); setMessage('');}} onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault(); void search();}}}/></label><button type="button" disabled={disabled || loading || !query.trim()} onClick={() => void search()}>{loading ? '불러오는 중…' : mode === 'tmdb' ? '검색' : '영상 정보 가져오기'}</button></div>
      <p role="status" className="mc-help">{loading ? '작품 정보를 불러오고 있어요.' : message}</p>
      {youtubeId && <button type="button" disabled={disabled} onClick={() => {
        onSelect({title: '', thumbnailUrl: null, contentType: 'youtube_video', externalSource: 'youtube', externalId: youtubeId, url: query.trim()});
        setMessage('URL을 입력에 사용했어요. 작품명은 직접 적어주세요.');
      }}>URL만 입력에 사용</button>}
      <div className="mc-search-results">{results.map(result => <div className="mc-suggestion" key={`${result.externalSource}:${result.externalId}`}><div className="mc-suggestion-image"><CultureImage url={result.thumbnailUrl} title={result.title}/></div><div><strong>{result.title}</strong><small>{result.year} · {result.contentType === 'movie' ? '영화' : result.contentType === 'drama' ? '드라마' : 'YouTube'}</small><button type="button" disabled={disabled} onClick={() => {onSelect(result); setMessage('비어 있는 항목에 정보를 채웠어요. 저장 전 수정할 수 있어요.');}}>입력에 사용</button></div></div>)}</div>
      {mode === 'tmdb' && <small className="mc-help">작품 정보 제공: TMDB. 이 서비스는 TMDB의 인증을 받지 않았습니다.</small>}
    </>}
  </section>;
}
