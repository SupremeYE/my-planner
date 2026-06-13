// 지도 탭 (Stage 3A) — 카카오맵 + 저장 장소 핀(빈/채움) + 클러스터러 + 테마 바 + 상세 + 방문완료
// 외부 API 재호출 없음: 저장된 lat/lng 만 읽어 핀을 찍는다. (검색/지오코딩은 저장 시점 1회)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { X, Navigation, ExternalLink, Check, MapPin, Plus } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { Place, PlaceFolder } from '../../../lib/db';
import { REGION_LABELS } from '../../../constants/places';
import { loadKakaoMaps, hasKakaoKey, directionsUrl, kakaoMapUrl } from '../../../lib/kakaoMap';
import { placeEmoji, colorFromKey, withAlpha } from './placeHelpers';
import { usePlacesData } from './usePlacesData';
import { FolderFormSheet } from './FolderFormSheet';

// 토큰 색으로 테드롭 핀 SVG data URI 생성 (하드코딩 hex 없음)
function pinDataUri(fill: string, stroke: string, inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36"><path d="M13 0C5.82 0 0 5.82 0 13c0 9.2 13 23 13 23s13-13.8 13-23C26 5.82 20.18 0 13 0z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="13" cy="13" r="4.8" fill="${inner}"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const SEOUL_INCHEON = { lat: 37.4563, lng: 126.7052 }; // 기본 중심(인천)

export function MapTab() {
  const { t } = useTheme();
  const { folders, places, linkMap, visitedIds, refresh } = usePlacesData();

  const [theme, setTheme] = useState<string>('all'); // 'all' | folderId
  const [selected, setSelected] = useState<Place | null>(null);
  const [addFolder, setAddFolder] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);

  const toast = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2600); };

  // 테마(폴더) 필터 적용된 장소 + 좌표 있는 것만
  const themePlaces = useMemo(
    () => (theme === 'all' ? places : places.filter(p => (linkMap.get(p.id) ?? []).includes(theme))),
    [places, linkMap, theme],
  );
  const mapped = useMemo(() => themePlaces.filter(p => p.lat != null && p.lng != null), [themePlaces]);

  // 핀 이미지 (토큰 색 기반). want=빈(테두리), went=채움
  const pinImages = useMemo(() => {
    const c = t.accent;
    return {
      want: pinDataUri(t.card, c, c),
      went: pinDataUri(c, c, t.card),
    };
  }, [t.accent, t.card]);

  // ── 지도 1회 생성 ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!hasKakaoKey()) { setMapError('카카오 지도 키(VITE_KAKAO_JS_KEY)가 설정되지 않았어요.'); return; }
    loadKakaoMaps()
      .then(k => {
        if (cancelled || !mapElRef.current) return;
        const map = new k.maps.Map(mapElRef.current, {
          center: new k.maps.LatLng(SEOUL_INCHEON.lat, SEOUL_INCHEON.lng),
          level: 8,
        });
        mapRef.current = map;
        clustererRef.current = new k.maps.MarkerClusterer({ map, averageCenter: true, minLevel: 7, gridSize: 70 });
        setMapReady(true);
        setTimeout(() => map.relayout(), 60);
        setTimeout(() => map.relayout(), 260);
      })
      .catch(e => setMapError(e?.message ?? '지도를 불러오지 못했어요.'));
    return () => { cancelled = true; };
  }, []);

  // 창 크기 변화(모바일↔PC 분기 등) 시 relayout
  useEffect(() => {
    const onResize = () => mapRef.current?.relayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── 핀 다시 그리기 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !clustererRef.current) return;
    const k = window.kakao;
    const map = mapRef.current;
    clustererRef.current.clear();

    const markers = mapped.map(p => {
      const went = visitedIds.has(p.id);
      const img = new k.maps.MarkerImage(
        went ? pinImages.went : pinImages.want,
        new k.maps.Size(26, 36),
        { offset: new k.maps.Point(13, 36) },
      );
      const marker = new k.maps.Marker({ position: new k.maps.LatLng(p.lat as number, p.lng as number), image: img, title: p.name });
      k.maps.event.addListener(marker, 'click', () => { setSelected(p); map.panTo(new k.maps.LatLng(p.lat as number, p.lng as number)); });
      return marker;
    });
    clustererRef.current.addMarkers(markers);

    if (mapped.length === 1) {
      map.setCenter(new k.maps.LatLng(mapped[0].lat as number, mapped[0].lng as number));
      map.setLevel(4);
    } else if (mapped.length > 1) {
      const bounds = new k.maps.LatLngBounds();
      mapped.forEach(p => bounds.extend(new k.maps.LatLng(p.lat as number, p.lng as number)));
      map.setBounds(bounds);
    }
  }, [mapReady, mapped, visitedIds, pinImages]);

  const focusPlace = (p: Place) => {
    setSelected(p);
    const k = window.kakao;
    if (mapReady && k && p.lat != null && p.lng != null) {
      mapRef.current.panTo(new k.maps.LatLng(p.lat, p.lng));
    }
  };

  // ── 방문 완료 ──────────────────────────────────────────────────────────────
  const markVisited = async (p: Place) => {
    if (!p.regionCode) { toast('지역 정보가 없어 기록할 수 없어요. 위치를 먼저 저장해 주세요.'); return; }
    await db.placeVisits.create({ placeId: p.id, name: p.name, regionCode: p.regionCode, visitedOn: format(new Date(), 'yyyy-MM-dd') });
    await refresh();
    toast(`방문 완료! ${REGION_LABELS[p.regionCode] ?? ''}에 발자국 +1`);
  };

  const selectedWent = selected ? visitedIds.has(selected.id) : false;

  // ── 테마 바 ─────────────────────────────────────────────────────────────────
  const ThemeBar = () => (
    <div className="flex gap-2 overflow-x-auto px-4 lg:px-6 py-2.5" style={{ borderBottom: `1px solid ${t.borderLight}`, flexShrink: 0, scrollbarWidth: 'none' }}>
      {[{ id: 'all', name: '전체 지도', icon: '🗺' } as { id: string; name: string; icon: string }, ...folders.map(f => ({ id: f.id, name: f.name, icon: f.icon || '📁' }))].map(opt => {
        const on = theme === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => { setTheme(opt.id); setSelected(null); }}
            className="flex items-center gap-1.5 whitespace-nowrap"
            style={{ flexShrink: 0, fontSize: 12.5, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', border: `1.5px solid ${on ? t.accent : t.border}`, backgroundColor: on ? t.accent : t.card, color: on ? '#fff' : t.textSub, fontWeight: on ? 700 : 500 }}
          >
            <span>{opt.icon}</span>{opt.name}
          </button>
        );
      })}
      <button
        onClick={() => setAddFolder(true)}
        className="flex items-center gap-1 whitespace-nowrap"
        style={{ flexShrink: 0, fontSize: 12.5, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', border: `1.5px dashed ${t.border}`, backgroundColor: 'transparent', color: t.textSub }}
      >
        ＋ 새 테마
      </button>
    </div>
  );

  // ── 상세 카드 (모바일 시트 / PC 패널 공용) ──────────────────────────────────
  const DetailCard = ({ p, went }: { p: Place; went: boolean }) => {
    const placeFolders = (linkMap.get(p.id) ?? []).map(id => folders.find(f => f.id === id)).filter(Boolean) as PlaceFolder[];
    const canRoute = p.lat != null && p.lng != null;
    return (
      <div style={{ backgroundColor: t.card }}>
        <div style={{ padding: '16px 16px 12px', position: 'relative' }}>
          <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 12, right: 12, color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: t.text, paddingRight: 24 }}>{p.name}</div>
          {p.category && <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>{p.category}</div>}
          {p.address && <div className="flex items-start gap-1.5" style={{ fontSize: 12, color: t.textSub, marginTop: 8 }}><MapPin size={13} style={{ marginTop: 1, flexShrink: 0 }} />{p.address}</div>}
          {p.phone && <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>☎ {p.phone}</div>}
          {placeFolders.length > 0 && (
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
              {placeFolders.map(f => {
                const c = colorFromKey(f.color, t);
                return <span key={f.id} style={{ fontSize: 10.5, color: c, backgroundColor: withAlpha(c, 0.13), borderRadius: 7, padding: '2px 8px' }}>{f.icon ? `${f.icon} ` : ''}{f.name}</span>;
              })}
            </div>
          )}
        </div>

        {/* 블로그 후기 — 3B 에서 채움 */}
        <div style={{ padding: '11px 16px', borderTop: `1px solid ${t.borderLight}`, backgroundColor: t.bgSub }}>
          <div style={{ fontSize: 10.5, color: t.textMuted, marginBottom: 4 }}>블로그·방문자 후기</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>곧 후기를 모아서 보여드릴게요 (준비 중)</div>
        </div>

        {/* 액션 */}
        <div className="flex gap-2" style={{ padding: '12px 16px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
          {canRoute && (
            <a href={directionsUrl(p.name, p.lat as number, p.lng as number)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5" style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <Navigation size={14} /> 길찾기
            </a>
          )}
          <a href={kakaoMapUrl({ kakaoPlaceId: p.kakaoPlaceId, name: p.name, lat: p.lat, lng: p.lng })} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5" style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <ExternalLink size={14} /> 카카오맵
          </a>
          {went ? (
            <div className="flex items-center justify-center gap-1.5" style={{ flex: 1, padding: '11px 0', borderRadius: 12, backgroundColor: withAlpha(t.success, 0.12), color: t.success, fontSize: 13, fontWeight: 700 }}>
              <Check size={15} /> 다녀온 곳
            </div>
          ) : (
            <button onClick={() => markVisited(p)} className="flex items-center justify-center gap-1.5" style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              방문 완료!
            </button>
          )}
        </div>
      </div>
    );
  };

  const noCoordCount = themePlaces.length - mapped.length;

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: t.bg }}>
      <ThemeBar />

      <div className="flex-1 min-h-0 flex">
        {/* PC 좌측 목록 */}
        <div className="hidden lg:flex lg:flex-col" style={{ width: 300, borderRight: `1px solid ${t.borderLight}`, flexShrink: 0 }}>
          <div style={{ padding: '12px 16px 6px', fontSize: 11.5, color: t.textSub }}>
            {theme === 'all' ? '전체' : folders.find(f => f.id === theme)?.name} · {themePlaces.length}곳
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
            {themePlaces.map(p => {
              const went = visitedIds.has(p.id);
              const on = selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => focusPlace(p)} className="flex items-center gap-2.5" style={{ padding: '9px 10px', borderRadius: 11, cursor: 'pointer', backgroundColor: on ? t.bgSub : 'transparent' }}>
                  <span className="flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 9, fontSize: 18, flexShrink: 0, backgroundColor: withAlpha(t.accent, 0.12) }}>{placeEmoji({ concept: p.concept, category: p.category })}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[p.category, p.regionCode ? REGION_LABELS[p.regionCode] : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, backgroundColor: went ? t.accent : 'transparent', border: `2px solid ${t.accent}` }} />
                </div>
              );
            })}
            {themePlaces.length === 0 && <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12.5, color: t.textSub }}>이 테마엔 아직 장소가 없어요</div>}
          </div>
        </div>

        {/* 지도 + (PC) 상세 패널 */}
        <div className="relative" style={{ flex: 1, minHeight: 0 }}>
          {mapError ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ textAlign: 'center', padding: '0 24px' }}>
              <div style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 22, color: t.textSub }}>지도를 띄울 수 없어요</div>
              <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 6 }}>{mapError}</div>
            </div>
          ) : (
            <div ref={mapElRef} style={{ position: 'absolute', inset: 0, backgroundColor: t.bgSub }} />
          )}

          {!mapError && noCoordCount > 0 && (
            <div className="lg:block" style={{ position: 'absolute', left: 12, top: 12, zIndex: 4, fontSize: 11, color: t.textSub, backgroundColor: withAlpha(t.card, 0.92), borderRadius: 9, padding: '5px 10px', boxShadow: `0 2px 8px ${withAlpha(t.text, 0.15)}` }}>
              위치 미설정 {noCoordCount}곳은 핀에서 빠져요
            </div>
          )}

          {/* PC 상세 패널 (우상단 슬라이드) */}
          {selected && (
            <div className="hidden lg:block" style={{ position: 'absolute', top: 16, right: 16, width: 300, zIndex: 6, borderRadius: 14, overflow: 'hidden', border: `1px solid ${t.borderLight}`, boxShadow: `0 14px 32px -14px ${withAlpha(t.text, 0.45)}` }}>
              <DetailCard p={selected} went={selectedWent} />
            </div>
          )}
        </div>
      </div>

      {/* 모바일 상세 바텀시트 */}
      {selected && (
        <div className="lg:hidden" style={{ position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 6, borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.borderLight}`, boxShadow: `0 -8px 30px -10px ${withAlpha(t.text, 0.4)}` }}>
          <DetailCard p={selected} went={selectedWent} />
        </div>
      )}

      {/* 토스트 */}
      {toastMsg && (
        <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 20, backgroundColor: t.text, color: t.card, fontSize: 12.5, fontWeight: 600, padding: '10px 16px', borderRadius: 999, boxShadow: `0 8px 24px -8px ${withAlpha(t.text, 0.5)}`, whiteSpace: 'nowrap' }}>
          {toastMsg}
        </div>
      )}

      {addFolder && <FolderFormSheet folders={folders} onClose={() => setAddFolder(false)} onSaved={refresh} />}
    </div>
  );
}
