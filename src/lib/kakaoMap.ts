// 카카오맵 JS SDK 로더 + 장소 검색/지오코딩 유틸 (Stage 3A)
//
// 핵심 원칙: 외부 API(카카오)는 "장소를 저장/갱신하는 순간"에만 호출한다.
//  - 키워드 검색 / 좌표→지역 변환은 PlaceFormSheet 저장 흐름에서만 사용.
//  - 지도 표시(MapTab)는 저장된 lat/lng 만 읽어 핀을 찍는다 (검색 API 재호출 없음).
//
// 키는 프론트 전용 JS 키(VITE_KAKAO_JS_KEY)만 사용한다. 시크릿은 절대 번들에 넣지 않는다.
import { REGION_CODE_MAP, REGION_LABELS, regionNameToCode } from '../constants/places';

const SDK_ID = 'kakao-maps-sdk';
let loadPromise: Promise<any> | null = null;

/** 카카오맵 SDK 를 한 번만 로드하고 kakao 네임스페이스를 반환한다. */
export function loadKakaoMaps(): Promise<any> {
  if (typeof window !== 'undefined' && window.kakao?.maps) return Promise.resolve(window.kakao);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
    if (!key) { reject(new Error('VITE_KAKAO_JS_KEY 가 설정되지 않았어요')); return; }

    const ready = () => window.kakao.maps.load(() => resolve(window.kakao));
    const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.kakao?.maps) ready();
      else existing.addEventListener('load', ready, { once: true });
      return;
    }

    const s = document.createElement('script');
    s.id = SDK_ID;
    s.async = true;
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services,clusterer&autoload=false`;
    s.onload = ready;
    s.onerror = () => reject(new Error('카카오맵 SDK 로드에 실패했어요'));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export function hasKakaoKey(): boolean {
  return !!(import.meta.env.VITE_KAKAO_JS_KEY as string | undefined);
}

// 카카오 키워드 검색 결과 1건 (필요한 필드만)
export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;     // "음식점 > 카페 > 커피전문점"
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  x: string;                 // 경도(lng)
  y: string;                 // 위도(lat)
}

/** 키워드로 장소 후보를 검색한다. (저장 시점 1회용) */
export function keywordSearch(query: string): Promise<KakaoPlace[]> {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  return loadKakaoMaps().then(
    k =>
      new Promise<KakaoPlace[]>(resolve => {
        const ps = new k.maps.services.Places();
        ps.keywordSearch(q, (data: KakaoPlace[], status: string) => {
          resolve(status === k.maps.services.Status.OK ? data : []);
        });
      }),
  );
}

// 짧은 시도 라벨(예: "인천") → region_code 역매핑 (coord2RegionCode 보완용)
const SHORT_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(REGION_LABELS).map(([code, label]) => [label, code]),
);

/** 주소 문자열 앞부분의 시도명을 region_code 로 변환. 미매칭 시 null. */
export function addressToRegionCode(address: string | null | undefined): string | null {
  if (!address) return null;
  const a = address.trim();
  for (const key of Object.keys(REGION_CODE_MAP)) {
    if (a.startsWith(key)) return REGION_CODE_MAP[key];
  }
  for (const [label, code] of Object.entries(SHORT_TO_CODE)) {
    if (a.startsWith(label)) return code;
  }
  return null;
}

/** 좌표 → region_code (주소에서 시도명이 안 잡힐 때 보완). */
export function coord2RegionCode(lng: number, lat: number): Promise<string | null> {
  return loadKakaoMaps().then(
    k =>
      new Promise<string | null>(resolve => {
        const geocoder = new k.maps.services.Geocoder();
        geocoder.coord2RegionCode(lng, lat, (result: any[], status: string) => {
          if (status === k.maps.services.Status.OK && result?.length) {
            const r = result.find(x => x.region_type === 'H') ?? result[0];
            const name = r?.region_1depth_name as string | undefined;
            resolve(regionNameToCode(name) ?? (name ? SHORT_TO_CODE[name.trim()] ?? null : null));
          } else resolve(null);
        });
      }),
  );
}

// 카카오 category_name("음식점 > 카페 > 커피전문점") → 마지막 의미 조각("커피전문점")
export function shortCategory(categoryName: string | null | undefined): string | null {
  if (!categoryName) return null;
  const parts = categoryName.split('>').map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

// 저장용으로 정규화된 지오코딩 결과
export interface GeocodedPlace {
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  kakaoPlaceId: string | null;
  phone: string | null;
  regionCode: string | null;
}

/** 카카오 검색 결과 1건을 places 저장 필드로 변환 (region_code 까지 확정). */
export async function geocodeFromKakao(p: KakaoPlace): Promise<GeocodedPlace> {
  const address = p.road_address_name || p.address_name || null;
  const lat = parseFloat(p.y);
  const lng = parseFloat(p.x);
  let regionCode = addressToRegionCode(address);
  if (!regionCode && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    regionCode = await coord2RegionCode(lng, lat);
  }
  return {
    category: shortCategory(p.category_name),
    address,
    lat,
    lng,
    kakaoPlaceId: p.id || null,
    phone: p.phone || null,
    regionCode,
  };
}

// 길찾기 / 카카오맵 보기 외부 링크 (API 호출 없음, 무료)
export function directionsUrl(name: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
}
export function kakaoMapUrl(opts: { kakaoPlaceId?: string | null; name: string; lat?: number | null; lng?: number | null }): string {
  if (opts.kakaoPlaceId) return `https://place.map.kakao.com/${opts.kakaoPlaceId}`;
  if (opts.lat != null && opts.lng != null) return `https://map.kakao.com/link/map/${encodeURIComponent(opts.name)},${opts.lat},${opts.lng}`;
  return `https://map.kakao.com/?q=${encodeURIComponent(opts.name)}`;
}
