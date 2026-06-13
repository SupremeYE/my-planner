// 코스 산책 설정 — 출발지(현재 위치 기본/지정) + 도착지(카카오 검색·저장 장소) 지정.
// 외부 API(카카오 키워드 검색)는 도착지를 고르는 이 화면에서만 호출(자유 산책 트래킹은 그대로 재사용).
import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Navigation, X, Loader2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { keywordSearch, hasKakaoKey, type KakaoPlace } from '../../../lib/kakaoMap';
import { usePlacesData } from '../places/usePlacesData';
import { withAlpha } from '../places/placeHelpers';

export interface CoursePoint { lat: number; lng: number; name: string }

export function CourseSetup({ onStart }: { onStart: (start: CoursePoint, dest: CoursePoint) => void }) {
  const { t } = useTheme();
  const { places } = usePlacesData();

  const [start, setStart] = useState<CoursePoint | null>(null);
  const [dest, setDest] = useState<CoursePoint | null>(null);
  const [locState, setLocState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [picking, setPicking] = useState<'start' | 'dest' | null>('dest');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 현재 위치 = 기본 출발지
  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocState('fail'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: '현재 위치' }); setLocState('ok'); },
      () => setLocState('fail'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const r = await keywordSearch(query);
    setResults(r);
    setSearching(false);
  };

  const assign = (p: CoursePoint) => {
    if (picking === 'start') setStart(p);
    else setDest(p);
    setPicking(null);
    setQuery(''); setResults([]);
  };

  const savedPicks = places.filter(p => p.lat != null && p.lng != null).slice(0, 8);
  const canStart = !!start && !!dest;

  const PointRow = ({ label, point, kind, icon }: { label: string; point: CoursePoint | null; kind: 'start' | 'dest'; icon: React.ReactNode }) => (
    <button onClick={() => { setPicking(kind); setQuery(''); setResults([]); setTimeout(() => inputRef.current?.focus(), 50); }}
      className="flex items-center gap-3 w-full text-left"
      style={{ padding: '13px 14px', borderRadius: 14, backgroundColor: t.card, border: `1.5px solid ${picking === kind ? t.accent : t.border}`, cursor: 'pointer' }}>
      <span className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(t.accent, 0.12), color: t.accent, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11, color: t.textSub }}>{label}</span>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: point ? t.text : t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {point ? point.name : kind === 'start' ? (locState === 'loading' ? '현재 위치 확인 중…' : '출발지를 선택하세요') : '도착지를 검색하세요'}
        </span>
      </span>
    </button>
  );

  return (
    <div className="px-4 py-5 lg:px-6 mx-auto" style={{ maxWidth: 560 }}>
      {locState === 'fail' && !start && (
        <div style={{ marginBottom: 12, padding: '10px 13px', borderRadius: 12, backgroundColor: withAlpha(t.danger, 0.1), color: t.danger, fontSize: 12.5, lineHeight: 1.5 }}>
          현재 위치를 가져오지 못했어요. 출발지를 직접 검색해 지정해 주세요.
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <PointRow label="출발" point={start} kind="start" icon={<Navigation size={17} />} />
        <PointRow label="도착" point={dest} kind="dest" icon={<MapPin size={17} />} />
      </div>

      {/* 검색 패널 */}
      {picking && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{picking === 'start' ? '출발지' : '도착지'} 선택</span>
            <button onClick={() => setPicking(null)} style={{ color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          </div>

          {picking === 'start' && start?.name !== '현재 위치' && locState === 'ok' && (
            <button onClick={() => { navigator.geolocation.getCurrentPosition(pos => assign({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: '현재 위치' })); }}
              className="flex items-center gap-2 w-full" style={{ padding: '10px 12px', borderRadius: 10, backgroundColor: t.card, border: `1px solid ${t.border}`, marginBottom: 10, cursor: 'pointer', color: t.accent, fontSize: 13, fontWeight: 600 }}>
              <Navigation size={14} /> 현재 위치로 설정
            </button>
          )}

          {hasKakaoKey() ? (
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <div className="flex items-center gap-2" style={{ flex: 1, padding: '9px 12px', borderRadius: 10, backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <Search size={15} style={{ color: t.textMuted, flexShrink: 0 }} />
                <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
                  placeholder="장소·주소 검색" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: t.text }} />
              </div>
              <button onClick={runSearch} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>검색</button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>지도 키가 없어 검색은 못 해요. 저장한 장소에서 골라 주세요.</p>
          )}

          {/* 검색 결과 */}
          {searching ? (
            <div className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: t.textMuted, padding: '6px 2px' }}><Loader2 size={13} className="animate-spin" /> 검색 중…</div>
          ) : results.length > 0 ? (
            <div className="flex flex-col" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {results.map(r => (
                <button key={r.id} onClick={() => assign({ lat: parseFloat(r.y), lng: parseFloat(r.x), name: r.place_name })}
                  className="text-left" style={{ padding: '9px 10px', borderRadius: 10, cursor: 'pointer', background: 'none', border: 'none' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>{r.place_name}</div>
                  <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 1 }}>{r.road_address_name || r.address_name}</div>
                </button>
              ))}
            </div>
          ) : savedPicks.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, color: t.textSub, margin: '2px 2px 6px' }}>저장한 장소</div>
              <div className="flex flex-wrap gap-2">
                {savedPicks.map(p => (
                  <button key={p.id} onClick={() => assign({ lat: p.lat as number, lng: p.lng as number, name: p.name })}
                    style={{ padding: '7px 12px', borderRadius: 999, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 12.5, cursor: 'pointer' }}>
                    📍 {p.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 시작 버튼 */}
      <button onClick={() => canStart && onStart(start!, dest!)} disabled={!canStart}
        className="flex items-center justify-center gap-2 w-full"
        style={{ marginTop: 18, padding: '16px', borderRadius: 16, border: 'none', backgroundColor: canStart ? t.accent : t.border, color: canStart ? '#fff' : t.textMuted, fontSize: 16, fontWeight: 800, cursor: canStart ? 'pointer' : 'not-allowed' }}>
        <Navigation size={18} /> 코스 산책 시작
      </button>
    </div>
  );
}
