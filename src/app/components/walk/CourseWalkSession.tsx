// 코스 산책 실시간 — 출발/도착 마커 + 참고 직선(또는 ORS 도보 경로 점선) + 진행도 + 도보 길찾기.
// 실제 걷는 경로는 자유 산책과 동일하게 GPS 로 그린다(useWalkTracker 공용). 종료 → 완료 카드(mode:course).
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, X, Navigation, MapPin } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { loadKakaoMaps, hasKakaoKey, courseDirectionsUrl } from '../../../lib/kakaoMap';
import { hasOrsKey, fetchFootRoute } from '../../../lib/routing';
import { useWalkTracker } from './useWalkTracker';
import { useWakeLock } from './useWakeLock';
import { formatDistance, formatDuration, formatPace, avgPaceSecPerKm, haversineMeters } from './walkUtils';
import { RouteGlyph } from './RouteGlyph';
import { withAlpha } from '../places/placeHelpers';
import type { WalkPoint } from '../../../lib/db';
import type { WalkDraft } from './FreeWalkSession';
import type { CoursePoint } from './CourseSetup';

export function CourseWalkSession({ start, dest, onFinish, onCancel }: {
  start: CoursePoint; dest: CoursePoint; onFinish: (d: WalkDraft) => void; onCancel: () => void;
}) {
  const { t } = useTheme();
  const tr = useWalkTracker();
  useWakeLock(tr.status === 'tracking' || tr.status === 'paused' || tr.status === 'acquiring');

  const startedAtRef = useRef<string>(new Date().toISOString());
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [useMap] = useState(hasKakaoKey());
  const [planned, setPlanned] = useState<WalkPoint[] | null>(null);

  useEffect(() => { tr.start(); /* eslint-disable-next-line */ }, []);

  // ORS 도보 경로(옵션) — 시작 시 1회. 키 없으면 null(직선 참고선만).
  useEffect(() => {
    if (!hasOrsKey()) return;
    fetchFootRoute(start, dest).then(r => { if (r) setPlanned(r); });
  }, [start, dest]);

  // 지도 1회 생성 + 출발/도착/참고선
  useEffect(() => {
    if (!useMap) return;
    let cancelled = false;
    loadKakaoMaps().then(k => {
      if (cancelled || !mapElRef.current) return;
      const map = new k.maps.Map(mapElRef.current, { center: new k.maps.LatLng(start.lat, start.lng), level: 4 });
      mapRef.current = map;

      // 출발/도착 마커(토큰색 dot CustomOverlay)
      const dot = (lat: number, lng: number, color: string, label: string) => {
        const el = document.createElement('div');
        el.style.cssText = `transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;`;
        el.innerHTML = `<span style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></span><span style="font-size:11px;font-weight:700;color:#fff;background:${color};padding:1px 6px;border-radius:8px;white-space:nowrap">${label}</span>`;
        new k.maps.CustomOverlay({ map, position: new k.maps.LatLng(lat, lng), content: el, yAnchor: 0.5, xAnchor: 0.5 });
      };
      dot(start.lat, start.lng, t.success, '출발');
      dot(dest.lat, dest.lng, t.danger, dest.name.length > 6 ? '도착' : dest.name);

      // 실제 걸은 경로 폴리라인(코랄)
      lineRef.current = new k.maps.Polyline({ map, path: [], strokeWeight: 6, strokeColor: t.accent, strokeOpacity: 0.95, strokeStyle: 'solid' });

      // 출발-도착 바운드로 맞춤
      const b = new k.maps.LatLngBounds();
      b.extend(new k.maps.LatLng(start.lat, start.lng));
      b.extend(new k.maps.LatLng(dest.lat, dest.lng));
      map.setBounds(b);
      setMapReady(true);
      setTimeout(() => map.relayout(), 80);
    }).catch(() => { /* 폴백: 글리프 */ });
    return () => { cancelled = true; };
  }, [useMap, start, dest, t.accent, t.success, t.danger]);

  // 참고선 / ORS 점선 — planned 유무에 따라 한 번 그림
  const guideRef = useRef<any>(null);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const k = window.kakao;
    guideRef.current?.setMap(null);
    const path = planned
      ? planned.map(p => new k.maps.LatLng(p.lat, p.lng))
      : [new k.maps.LatLng(start.lat, start.lng), new k.maps.LatLng(dest.lat, dest.lng)];
    guideRef.current = new k.maps.Polyline({
      map: mapRef.current, path, strokeWeight: 4, strokeColor: t.textMuted, strokeOpacity: 0.7, strokeStyle: 'shortdash',
    });
  }, [mapReady, planned, start, dest, t.textMuted]);

  // 경로 갱신
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const k = window.kakao;
    lineRef.current?.setPath(tr.path.map(p => new k.maps.LatLng(p.lat, p.lng)));
    if (tr.current) {
      const here = new k.maps.LatLng(tr.current.lat, tr.current.lng);
      if (!markerRef.current) markerRef.current = new k.maps.Marker({ map: mapRef.current, position: here });
      else markerRef.current.setPosition(here);
      mapRef.current.panTo(here);
    }
  }, [mapReady, tr.path, tr.current]);

  const pace = avgPaceSecPerKm(tr.distanceM, tr.durationS);
  const denied = tr.status === 'denied';

  // 진행도: 출발-도착 직선 대비 (남은 거리)
  const totalStraight = haversineMeters(start, dest);
  const remaining = tr.current ? haversineMeters(tr.current, dest) : totalStraight;
  const progressPct = totalStraight > 0 ? Math.max(0, Math.min(100, ((totalStraight - remaining) / totalStraight) * 100)) : 0;
  const arrived = remaining < 30; // 30m 이내 = 거의 도착

  const handleStop = () => {
    tr.stop();
    onFinish({
      path: tr.path, distanceM: tr.distanceM, durationS: tr.durationS,
      startLat: start.lat, startLng: start.lng,
      startedAt: startedAtRef.current, endedAt: new Date().toISOString(),
      mode: 'course', plannedRoute: planned,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: t.bg, display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between" style={{ padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>코스 산책</span>
          <span className="flex items-center gap-1" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>
            <MapPin size={11} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dest.name}</span>
          </span>
        </div>
        <button onClick={() => { tr.stop(); onCancel(); }} style={{ color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
      </div>

      {/* 진행도 바 */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12, color: t.textSub, marginBottom: 5 }}>
          <span>{arrived ? '🎉 거의 도착했어요!' : `남은 거리 ${formatDistance(remaining)}`}</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div style={{ height: 7, borderRadius: 999, backgroundColor: t.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: arrived ? t.success : t.accent, borderRadius: 999, transition: 'width .4s' }} />
        </div>
      </div>

      {denied && (
        <div style={{ margin: '0 16px 8px', padding: '12px 14px', borderRadius: 12, backgroundColor: withAlpha(t.danger, 0.12), color: t.danger, fontSize: 13, lineHeight: 1.5 }}>{tr.errorMsg}</div>
      )}

      {/* 지도 / 글리프 */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', margin: '0 16px', borderRadius: 18, overflow: 'hidden', backgroundColor: t.bgSub }}>
        {useMap ? (
          <div ref={mapElRef} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <RouteGlyph path={tr.path} size={220} stroke={t.accent} bg={t.bgSub} />
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 10 }}>지도 키가 없어 경로 모양만 표시해요</p>
          </div>
        )}
        {/* 도보 길찾기 외부 링크 */}
        <a href={courseDirectionsUrl([start, dest], 'walk')} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5" style={{ position: 'absolute', right: 12, bottom: 12, padding: '9px 13px', borderRadius: 999, backgroundColor: withAlpha(t.card, 0.95), color: t.text, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', boxShadow: `0 2px 10px ${withAlpha(t.text, 0.2)}` }}>
          <Navigation size={13} /> 도보 길찾기
        </a>
      </div>

      {/* 지표 */}
      <div className="flex items-stretch" style={{ padding: 16, gap: 12, flexShrink: 0 }}>
        <Metric label="거리" value={formatDistance(tr.distanceM)} big t={t} />
        <Metric label="시간" value={formatDuration(tr.durationS)} big t={t} />
        <Metric label="페이스" value={formatPace(pace)} t={t} />
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center justify-center" style={{ gap: 16, padding: '0 16px calc(20px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
        {tr.status !== 'paused' ? (
          <button onClick={tr.pause} disabled={denied} className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 999, border: `2px solid ${t.border}`, backgroundColor: t.card, color: t.text, cursor: denied ? 'not-allowed' : 'pointer', opacity: denied ? 0.5 : 1 }}><Pause size={26} /></button>
        ) : (
          <button onClick={tr.resume} className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 999, border: 'none', backgroundColor: t.accent, color: '#fff', cursor: 'pointer' }}><Play size={26} /></button>
        )}
        <button onClick={handleStop} className="flex items-center justify-center gap-2" style={{ flex: 1, maxWidth: 220, height: 64, borderRadius: 999, border: 'none', backgroundColor: t.danger, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          <Square size={20} fill="#fff" /> 종료
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, big, t }: { label: string; value: string; big?: boolean; t: any }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ flex: 1, padding: '12px 6px', borderRadius: 14, backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <span style={{ fontSize: 11, color: t.textSub, marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: big ? 28 : 20, fontWeight: 800, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
