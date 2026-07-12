// 뽑기 탭 (Stage 4) — 내 저장 풀에서만 한 곳/코스를 골라주고 "왜 이 곳?"을 손글씨로.
// 외부 API 호출 0 — 저장된 좌표/메모/방문기록만 읽어 로컬 계산. 길찾기는 카카오맵 URL 링크만.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Navigation, MapPinned, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { Place, PlaceFolder } from '../../../lib/db';
import { REGION_LABELS } from '../../../constants/places';
import { directionsUrl, courseDirectionsUrl } from '../../../lib/kakaoMap';
import { placeEmoji, colorFromKey, withAlpha } from './placeHelpers';
import { usePlacesData } from './usePlacesData';
import { pickWeighted, buildCourse, buildReason, haversineKm, DRAW_COPY } from './drawUtils';

// 이동수단 (카카오 by-link 모드 매핑)
const TRANSPORT = [
  { key: 'walk', icon: '🚶', label: '도보', kakao: 'walk' },
  { key: 'traffic', icon: '🚌', label: '버스·지하철', kakao: 'traffic' },
  { key: 'car', icon: '🚗', label: '차', kakao: 'car' },
  { key: 'bicycle', icon: '🚲', label: '자전거', kakao: 'bicycle' },
];

type DrawResult =
  | { kind: 'one'; place: Place; reason: string }
  | { kind: 'course'; stops: { place: Place; reason: string }[] };

export function DrawTab() {
  const { t } = useTheme();
  const [, setSearchParams] = useSearchParams();
  const { folders, places, linkMap, visitedIds, loading } = usePlacesData();

  const [themeId, setThemeId] = useState<string>('all');
  const [mode, setMode] = useState<'one' | 'course'>('one');
  const [transport, setTransport] = useState<string | null>(null);
  const [phase, setPhase] = useState<'setup' | 'drawing' | 'result'>('setup');
  const [result, setResult] = useState<DrawResult | null>(null);
  const [copyIdx, setCopyIdx] = useState(0);
  const [resultIn, setResultIn] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pool = useMemo(
    () => (themeId === 'all' ? places : places.filter(p => (linkMap.get(p.id) ?? []).includes(themeId))),
    [themeId, places, linkMap],
  );

  const transportMeta = TRANSPORT.find(tp => tp.key === transport) ?? null;

  const doDraw = () => {
    if (pool.length === 0) return;
    setResult(null);
    setResultIn(false);
    setPhase('drawing');
    // 카피 회전
    let i = 0;
    setCopyIdx(0);
    const rot = window.setInterval(() => { i = (i + 1) % DRAW_COPY.length; setCopyIdx(i); }, 380);
    timers.current.push(rot as unknown as number);
    const done = window.setTimeout(() => {
      clearInterval(rot);
      let res: DrawResult | null = null;
      if (mode === 'course') {
        const stops = buildCourse(pool, visitedIds);
        if (stops.length > 0) res = { kind: 'course', stops: stops.map(p => ({ place: p, reason: buildReason(p, visitedIds, true) })) };
      } else {
        const p = pickWeighted(pool, visitedIds);
        if (p) res = { kind: 'one', place: p, reason: buildReason(p, visitedIds) };
      }
      setResult(res);
      setPhase('result');
      requestAnimationFrame(() => setResultIn(true));
    }, 1200);
    timers.current.push(done as unknown as number);
  };

  const reset = () => { setPhase('setup'); setResult(null); setResultIn(false); };

  // ── 칩/토글 스타일 ───────────────────────────────────────────────────────────
  const chip = (on: boolean, color = t.accent): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
    border: `1.5px solid ${on ? color : t.border}`,
    backgroundColor: on ? color : t.card,
    color: on ? '#fff' : t.textSub, fontWeight: on ? 700 : 500,
  });

  const themeFolders: (PlaceFolder | null)[] = [null, ...folders]; // null = 아무거나

  // ── 결과: 한 곳 카드 ─────────────────────────────────────────────────────────
  const OneCard = ({ place, reason }: { place: Place; reason: string }) => {
    const emo = placeEmoji({ concept: place.concept, category: place.category });
    const pf = (linkMap.get(place.id) ?? []).map(id => folders.find(f => f.id === id)).filter(Boolean) as PlaceFolder[];
    const region = place.regionCode ? REGION_LABELS[place.regionCode] : null;
    const blog = place.blogReviews?.[0];
    const canRoute = place.lat != null && place.lng != null;
    return (
      <div style={cardStyle}>
        <div className="flex items-center justify-center" style={{ height: 92, fontSize: 38, backgroundColor: withAlpha(t.accent, 0.12) }}>{emo}</div>
        <div style={{ padding: '16px 18px 18px' }}>
          <div style={{ fontFamily: t.fontSection, fontSize: 23, color: t.text }}>{place.name}</div>{/* 카드 항목 헤더 */}
          <div style={{ fontSize: 12.5, color: t.textSub, marginTop: 2 }}>{[place.category, region].filter(Boolean).join(' · ')}</div>
          {place.address && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>📍 {place.address}</div>}

          {pf.length > 0 && (
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
              {pf.map(f => { const c = colorFromKey(f.color, t); return <span key={f.id} style={{ fontSize: 10.5, color: c, backgroundColor: withAlpha(c, 0.13), borderRadius: 7, padding: '2px 8px' }}>{f.icon ? `${f.icon} ` : ''}{f.name}</span>; })}
            </div>
          )}

          {/* 왜 이 곳? — 손글씨 */}
          <div style={{ marginTop: 14, background: withAlpha(t.accent, 0.07), borderRadius: 12, padding: '11px 14px', borderLeft: `3px solid ${t.accent}` }}>
            <div style={{ fontSize: 11, color: t.accent, marginBottom: 2 }}>왜 이 곳?</div>
            <div style={{ fontFamily: t.fontDecoratePen, fontSize: 19, color: t.text, lineHeight: 1.25 }}>{reason}</div>
          </div>

          {blog && (
            <a href={blog.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 10, fontSize: 12, color: t.textSub, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📝 {blog.title || blog.description}
            </a>
          )}

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            {canRoute && (
              <a href={directionsUrl(place.name, place.lat as number, place.lng as number)} target="_blank" rel="noopener noreferrer" style={primaryBtn}>
                <Navigation size={15} /> 길찾기
              </a>
            )}
            <button onClick={() => setSearchParams({ tab: 'map' })} style={ghostBtn}><MapPinned size={15} /> 지도</button>
            <button onClick={doDraw} style={ghostBtn}><RefreshCw size={15} /> 다시</button>
          </div>
        </div>
      </div>
    );
  };

  // ── 결과: 코스 ───────────────────────────────────────────────────────────────
  const CourseCard = ({ stops }: { stops: { place: Place; reason: string }[] }) => {
    const coords = stops.map(s => s.place).filter(p => p.lat != null && p.lng != null) as (Place & { lat: number; lng: number })[];
    const totalKm = coords.reduce((sum, p, i) => (i === 0 ? 0 : sum + haversineKm(coords[i - 1], p)), 0);
    const routeHref =
      coords.length >= 2
        ? courseDirectionsUrl(coords.map(p => ({ name: p.name, lat: p.lat, lng: p.lng })), transportMeta?.kakao ?? 'car')
        : coords.length === 1
          ? directionsUrl(coords[0].name, coords[0].lat, coords[0].lng)
          : null;
    return (
      <div style={cardStyle}>
        <div style={{ padding: '16px 18px 4px' }}>
          <div style={{ fontFamily: t.fontSection, fontSize: 21, color: t.text }}>오늘의 코스</div>{/* 카드 헤더 */}
          <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
            {stops.length}곳 {totalKm > 0 ? `· 약 ${totalKm.toFixed(1)}km` : ''}{transportMeta ? ` · ${transportMeta.icon} ${transportMeta.label}` : ''}
          </div>
        </div>
        <div style={{ padding: '12px 18px 4px' }}>
          {stops.map((s, i) => {
            const emo = placeEmoji({ concept: s.place.concept, category: s.place.category });
            return (
              <div key={s.place.id} className="flex gap-3" style={{ paddingBottom: i === stops.length - 1 ? 4 : 14 }}>
                <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
                  <div className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: t.accent, color: '#fff', fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                  {i < stops.length - 1 && <div style={{ width: 2, flex: 1, marginTop: 2, background: `repeating-linear-gradient(${t.accent} 0 4px, transparent 4px 8px)` }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>{emo} {s.place.name}</div>
                  <div style={{ fontSize: 11.5, color: t.textSub }}>{s.place.category}</div>
                  <div style={{ fontFamily: t.fontDecoratePen, fontSize: 16, color: t.accent, marginTop: 2 }}>{s.reason}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2" style={{ padding: '8px 18px 18px' }}>
          {routeHref && <a href={routeHref} target="_blank" rel="noopener noreferrer" style={primaryBtn}><Navigation size={15} /> 이 코스로!</a>}
          <button onClick={doDraw} style={ghostBtn}><RefreshCw size={15} /> 다시 뽑기</button>
        </div>
      </div>
    );
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 18, overflow: 'hidden',
    boxShadow: `0 16px 36px -18px ${withAlpha(t.text, 0.4)}`,
    opacity: resultIn ? 1 : 0, transform: resultIn ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity .35s, transform .35s cubic-bezier(.2,.9,.3,1.05)',
  };
  const primaryBtn: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 0', borderRadius: 12, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' };
  const ghostBtn: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 0', borderRadius: 12, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      <div className="mx-auto px-4 py-6 lg:py-9" style={{ maxWidth: 460 }}>
        {phase === 'setup' && (
          <div>
            <div style={{ fontFamily: t.fontDecoratePen, fontSize: 22, color: t.accent, lineHeight: 1 }}>오늘은 어디로 갈까</div>
            <div style={{ fontFamily: t.fontPageTitle, fontSize: 24, color: t.text, marginTop: 2 }}>뽑기</div>{/* 페이지 최상위 제목 */}

            {/* ① 테마 */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 9 }}>오늘 어떤 곳?</div>
              <div className="flex flex-wrap gap-2">
                {themeFolders.map(f => {
                  const id = f?.id ?? 'all';
                  const on = themeId === id;
                  return (
                    <button key={id} onClick={() => setThemeId(id)} style={chip(on)}>
                      {f ? `${f.icon ? f.icon + ' ' : ''}${f.name}` : '🎲 아무거나'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ② 한 곳 / 코스 */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 9 }}>한 곳만 vs 코스</div>
              <div className="flex gap-2">
                {([['one', '한 곳만'], ['course', '짧은 코스']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setMode(k)} className="flex-1" style={{ ...chip(mode === k), textAlign: 'center', borderRadius: 12, padding: '11px 0' }}>{label}</button>
                ))}
              </div>
            </div>

            {/* ③ 이동수단 (선택) */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 9 }}>오늘 뭐 타고? <span style={{ fontWeight: 400, color: t.textMuted, fontSize: 11.5 }}>(선택 · 길찾기에만 반영)</span></div>
              <div className="flex flex-wrap gap-2">
                {TRANSPORT.map(tp => {
                  const on = transport === tp.key;
                  return <button key={tp.key} onClick={() => setTransport(on ? null : tp.key)} style={chip(on, t.success)}>{tp.icon} {tp.label}</button>;
                })}
              </div>
            </div>

            {/* 뽑기 버튼 / 빈 풀 안내 */}
            <div style={{ marginTop: 28 }}>
              {!loading && pool.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontFamily: t.fontDecoratePen, fontSize: 19, color: t.textSub }}>이 테마엔 아직 저장된 곳이 없어요</div>
                  <button onClick={() => setSearchParams({ tab: 'library' })} className="inline-flex items-center gap-1.5" style={{ marginTop: 10, padding: '10px 18px', borderRadius: 12, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                    보관함에서 더 담아볼까요? <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <button onClick={doDraw} disabled={loading || pool.length === 0} className="flex items-center justify-center gap-2 w-full" style={{ padding: '16px 0', borderRadius: 15, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 10px 24px -8px ${withAlpha(t.accent, 0.6)}`, opacity: loading || pool.length === 0 ? 0.5 : 1 }}>
                  <Sparkles size={18} /> 뽑기 {pool.length > 0 && <span style={{ fontWeight: 400, opacity: 0.85, fontSize: 13 }}>({pool.length}곳 중)</span>}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'drawing' && (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 360, gap: 26 }}>
            <div className="draw-orb flex items-center justify-center" style={{ width: 86, height: 86, borderRadius: '50%', backgroundColor: t.accent, color: '#fff', fontSize: 34 }}>🎲</div>
            <div style={{ fontFamily: t.fontDecoratePen, fontSize: 23, color: t.text, minHeight: 30 }}>{DRAW_COPY[copyIdx]}</div>
          </div>
        )}

        {phase === 'result' && result && (result.kind === 'one' ? <OneCard place={result.place} reason={result.reason} /> : <CourseCard stops={result.stops} />)}
        {phase === 'result' && !result && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontFamily: t.fontDecoratePen, fontSize: 20, color: t.textSub }}>코스를 만들 좌표가 있는 곳이 부족해요</div>
            <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 6 }}>장소를 카카오로 검색·저장하면 코스를 짤 수 있어요</div>
            <button onClick={reset} className="inline-flex items-center gap-1.5" style={{ marginTop: 14, padding: '9px 16px', borderRadius: 11, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <RefreshCw size={14} /> 다시
            </button>
          </div>
        )}
      </div>

      <style>{`.draw-orb{animation:drawpulse 1.05s ease-in-out infinite;}
        @keyframes drawpulse{50%{transform:scale(1.09);}}`}</style>
    </div>
  );
}
