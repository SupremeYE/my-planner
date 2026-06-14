// 내 코스 다시 — 목표 경로(점선)를 깔고 그 위를 실제 GPS 로 따라 걷는다.
// 진행도 = 현재 위치에서 가장 가까운 목표 경로 점까지의 누적거리 비율(routeProgress 근사).
// 종료 → 완료 카드(mode:'repeat', planned_route=원본 목표 경로). 원본 세션은 그대로 둔다.
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { loadKakaoMaps, hasKakaoKey } from '../../../lib/kakaoMap';
import { useWalkTracker } from './useWalkTracker';
import { useWakeLock } from './useWakeLock';
import { formatDistance, formatDuration, formatPace, avgPaceSecPerKm, routeProgress } from './walkUtils';
import { RouteGlyph } from './RouteGlyph';
import { withAlpha } from '../places/placeHelpers';
import type { WalkPoint } from '../../../lib/db';
import type { WalkDraft } from './FreeWalkSession';

export function RepeatWalkSession({ target, name, onFinish, onCancel }: {
  target: WalkPoint[]; name: string; onFinish: (d: WalkDraft) => void; onCancel: () => void;
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

  useEffect(() => { tr.start(); /* eslint-disable-next-line */ }, []);

  // 지도 + 목표 경로 점선 + 출발/도착 dot + 실제 경로 폴리라인
  useEffect(() => {
    if (!useMap || target.length < 2) return;
    let cancelled = false;
    loadKakaoMaps().then(k => {
      if (cancelled || !mapElRef.current) return;
      const map = new k.maps.Map(mapElRef.current, { center: new k.maps.LatLng(target[0].lat, target[0].lng), level: 4 });
      mapRef.current = map;

      // 목표 경로(회색 점선)
      new k.maps.Polyline({
        map, path: target.map(p => new k.maps.LatLng(p.lat, p.lng)),
        strokeWeight: 5, strokeColor: t.textMuted, strokeOpacity: 0.7, strokeStyle: 'shortdash',
      });

      const dot = (p: WalkPoint, color: string, label: string) => {
        const el = document.createElement('div');
        el.style.cssText = 'transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;';
        el.innerHTML = `<span style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></span><span style="font-size:10.5px;font-weight:700;color:#fff;background:${color};padding:1px 6px;border-radius:8px">${label}</span>`;
        new k.maps.CustomOverlay({ map, position: new k.maps.LatLng(p.lat, p.lng), content: el, yAnchor: 0.5, xAnchor: 0.5 });
      };
      dot(target[0], t.success, '출발');
      dot(target[target.length - 1], t.danger, '도착');

      lineRef.current = new k.maps.Polyline({ map, path: [], strokeWeight: 6, strokeColor: t.accent, strokeOpacity: 0.95, strokeStyle: 'solid' });

      const b = new k.maps.LatLngBounds();
      target.forEach(p => b.extend(new k.maps.LatLng(p.lat, p.lng)));
      map.setBounds(b);
      setMapReady(true);
      setTimeout(() => map.relayout(), 80);
    }).catch(() => { /* 폴백: 글리프 */ });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        const k = window.kakao;
        if (k?.maps?.event) k.maps.event.removeListener(mapRef.current);
        mapRef.current = null;
      }
    };
  }, [useMap, target, t.accent, t.success, t.danger, t.textMuted]);

  // 실제 경로 갱신
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
  const prog = routeProgress(target, tr.current);
  const arrived = prog.remainingM < 30;

  const handleStop = () => {
    tr.stop();
    onFinish({
      path: tr.path, distanceM: tr.distanceM, durationS: tr.durationS,
      startLat: tr.path[0]?.lat ?? target[0]?.lat ?? null,
      startLng: tr.path[0]?.lng ?? target[0]?.lng ?? null,
      startedAt: startedAtRef.current, endedAt: new Date().toISOString(),
      mode: 'repeat', plannedRoute: target,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: t.bg, display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between" style={{ padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>내 코스 다시</span>
          <span style={{ display: 'block', fontSize: 12, color: t.textSub, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
        <button onClick={() => { tr.stop(); onCancel(); }} style={{ color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
      </div>

      {/* 진행도 */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12, color: t.textSub, marginBottom: 5 }}>
          <span>{arrived ? '🎉 코스 완주!' : `남은 거리 ${formatDistance(prog.remainingM)}`}</span>
          <span>{Math.round(prog.pct)}%</span>
        </div>
        <div style={{ height: 7, borderRadius: 999, backgroundColor: t.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${prog.pct}%`, backgroundColor: arrived ? t.success : t.accent, borderRadius: 999, transition: 'width .4s' }} />
        </div>
      </div>

      {denied && (
        <div style={{ margin: '0 16px 8px', padding: '12px 14px', borderRadius: 12, backgroundColor: withAlpha(t.danger, 0.12), color: t.danger, fontSize: 13, lineHeight: 1.5 }}>{tr.errorMsg}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative', margin: '0 16px', borderRadius: 18, overflow: 'hidden', backgroundColor: t.bgSub }}>
        {useMap ? (
          <div ref={mapElRef} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <RouteGlyph path={target} size={200} stroke={t.textMuted} bg={t.bgSub} />
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 10 }}>지도 키가 없어 목표 경로 모양만 표시해요</p>
          </div>
        )}
      </div>

      <div className="flex items-stretch" style={{ padding: 16, gap: 12, flexShrink: 0 }}>
        <Metric label="거리" value={formatDistance(tr.distanceM)} big t={t} />
        <Metric label="시간" value={formatDuration(tr.durationS)} big t={t} />
        <Metric label="페이스" value={formatPace(pace)} t={t} />
      </div>

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
