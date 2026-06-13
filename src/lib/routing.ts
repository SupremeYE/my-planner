// 정밀 도보 경로 라우팅(옵션) — OpenRouteService foot-walking.
// 무료 키(VITE_ORS_API_KEY)가 있을 때만 동작. 없으면 null → 호출부는 직선 참고선만 쓴다.
// 외부 API 는 코스 시작 시 1회만 호출(planned_route 캐시 후 재호출 없음).
import type { WalkPoint } from './db';

export function hasOrsKey(): boolean {
  return !!(import.meta.env.VITE_ORS_API_KEY as string | undefined);
}

interface LatLng { lat: number; lng: number }

/** 출발→도착 도보 경로를 받아 WalkPoint[] 로 반환. 키 없음/실패 시 null. */
export async function fetchFootRoute(start: LatLng, dest: LatLng): Promise<WalkPoint[] | null> {
  const key = import.meta.env.VITE_ORS_API_KEY as string | undefined;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: key },
      // ORS 좌표 순서는 [lng, lat]
      body: JSON.stringify({ coordinates: [[start.lng, start.lat], [dest.lng, dest.lat]] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const coords: [number, number][] | undefined = data?.features?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    return coords.map(([lng, lat]) => ({ lat, lng, t: 0 }));
  } catch {
    return null;
  }
}
