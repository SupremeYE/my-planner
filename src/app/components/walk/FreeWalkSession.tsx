// 자유 산책 실시간 화면 — GPS 추적 + 카카오맵 폴리라인(코랄) + 큰 지표 + 컨트롤.
// 전체화면 오버레이(모바일/PC 공용). 종료 시 onFinish(draft) 로 완료 카드 흐름으로 넘긴다.
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, X, MapPin } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { loadKakaoMaps, hasKakaoKey } from '../../../lib/kakaoMap';
import { useWalkTracker } from './useWalkTracker';
import { useWakeLock } from './useWakeLock';
import { formatDistance, formatDuration, formatPace, avgPaceSecPerKm } from './walkUtils';
import { RouteGlyph } from './RouteGlyph';
import { withAlpha } from '../places/placeHelpers';
import type { WalkPoint } from '../../../lib/db';

export interface WalkDraft {
  path: WalkPoint[];
  distanceM: number;
  durationS: number;
  startLat: number | null;
  startLng: number | null;
  startedAt: string;
  endedAt: string;
  mode?: 'free' | 'course' | 'repeat';   // 미지정 = free
  plannedRoute?: WalkPoint[] | null;      // 코스/내코스 목표 경로(있으면 저장)
}

export function FreeWalkSession({ onFinish, onCancel }: { onFinish: (d: WalkDraft) => void; onCancel: () => void }) {
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

  // 마운트 시 자동 시작
  useEffect(() => { tr.start(); /* eslint-disable-next-line */ }, []);

  // 카카오맵 1회 생성
  useEffect(() => {
    if (!useMap) return;
    let cancelled = false;
    loadKakaoMaps().then(k => {
      if (cancelled || !mapElRef.current) return;
      const map = new k.maps.Map(mapElRef.current, {
        center: new k.maps.LatLng(37.5665, 126.978), level: 3,
      });
      mapRef.current = map;
      lineRef.current = new k.maps.Polyline({
        map, path: [], strokeWeight: 6, strokeColor: t.accent, strokeOpacity: 0.95, strokeStyle: 'solid',
      });
      setMapReady(true);
      setTimeout(() => map.relayout(), 80);
    }).catch(() => { /* 키/로드 실패 → 글리프 폴백 */ });
    return () => { cancelled = true; };
  }, [useMap, t.accent]);

  // 경로 갱신 → 폴리라인 setPath + 현재 위치 마커 + 부드러운 팬
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const k = window.kakao;
    const latlngs = tr.path.map(p => new k.maps.LatLng(p.lat, p.lng));
    lineRef.current?.setPath(latlngs);
    if (tr.current) {
      const here = new k.maps.LatLng(tr.current.lat, tr.current.lng);
      if (!markerRef.current) {
        markerRef.current = new k.maps.Marker({ map: mapRef.current, position: here });
      } else {
        markerRef.current.setPosition(here);
      }
      mapRef.current.panTo(here);
    }
  }, [mapReady, tr.path, tr.current]);

  const pace = avgPaceSecPerKm(tr.distanceM, tr.durationS);
  const denied = tr.status === 'denied';

  const handleStop = () => {
    tr.stop();
    onFinish({
      path: tr.path,
      distanceM: tr.distanceM,
      durationS: tr.durationS,
      startLat: tr.path[0]?.lat ?? tr.current?.lat ?? null,
      startLng: tr.path[0]?.lng ?? tr.current?.lng ?? null,
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: t.bg, display: 'flex', flexDirection: 'column' }}>
      {/* 상단 바 */}
      <div className="flex items-center justify-between" style={{ padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>자유 산책</span>
        <button onClick={() => { tr.stop(); onCancel(); }} style={{ color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={22} />
        </button>
      </div>

      {/* 신호/권한 안내 배너 */}
      {denied ? (
        <div style={{ margin: '0 16px 8px', padding: '12px 14px', borderRadius: 12, backgroundColor: withAlpha(t.danger, 0.12), color: t.danger, fontSize: 13, lineHeight: 1.5 }}>
          {tr.errorMsg}
        </div>
      ) : (tr.weakSignal || tr.status === 'acquiring' || tr.errorMsg) && (
        <div className="flex items-center gap-1.5" style={{ margin: '0 16px 8px', padding: '8px 12px', borderRadius: 10, backgroundColor: withAlpha(t.accent, 0.1), color: t.accent, fontSize: 12.5 }}>
          <MapPin size={13} />
          {tr.status === 'acquiring' ? 'GPS 신호를 잡는 중이에요…' : tr.errorMsg ?? '신호 약함 — 경로가 튈 수 있어요'}
        </div>
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
      </div>

      {/* 지표 */}
      <div className="flex items-stretch" style={{ padding: '16px', gap: 12, flexShrink: 0 }}>
        <Metric label="거리" value={formatDistance(tr.distanceM)} big t={t} />
        <Metric label="시간" value={formatDuration(tr.durationS)} big t={t} />
        <Metric label="페이스" value={formatPace(pace)} t={t} />
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center justify-center" style={{ gap: 16, padding: '0 16px calc(20px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
        {tr.status !== 'paused' ? (
          <button onClick={tr.pause} disabled={denied}
            className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 999, border: `2px solid ${t.border}`, backgroundColor: t.card, color: t.text, cursor: denied ? 'not-allowed' : 'pointer', opacity: denied ? 0.5 : 1 }}>
            <Pause size={26} />
          </button>
        ) : (
          <button onClick={tr.resume}
            className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 999, border: 'none', backgroundColor: t.accent, color: '#fff', cursor: 'pointer' }}>
            <Play size={26} />
          </button>
        )}
        <button onClick={handleStop}
          className="flex items-center justify-center gap-2" style={{ flex: 1, maxWidth: 220, height: 64, borderRadius: 999, border: 'none', backgroundColor: t.danger, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
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
