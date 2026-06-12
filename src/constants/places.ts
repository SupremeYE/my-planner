/**
 * 가고싶은 곳(Place) 모듈 공유 상수 — Stage 1
 *
 * 지도(Stage 2 보관함) · 기억(히트맵) · 뽑기 단계가 함께 사용한다.
 * 색은 디자인 토큰 키 문자열(gold/coral/green 등)로만 다룬다 — 하드코딩 hex 금지.
 *
 * ⚠️ REGION_CODES 의 코드값은 기억 탭 한국 SVG 지도의 path id 와 1:1 일치해야 한다.
 */

// ── 4-1. 시도 코드 매핑 (카카오 region_1depth_name → region_code) ─────────────────
// 저장 시점(Stage 3) 좌표→주소 변환 결과의 시도명을 코드로 환산할 때 사용.
// 행정구역 개편(강원/전북 특별자치도 등)으로 명칭이 둘일 수 있어 둘 다 매핑한다.
export const REGION_CODE_MAP: Record<string, string> = {
  서울특별시: 'seoul',
  부산광역시: 'busan',
  대구광역시: 'daegu',
  인천광역시: 'incheon',
  광주광역시: 'gwangju',
  대전광역시: 'daejeon',
  울산광역시: 'ulsan',
  세종특별자치시: 'sejong',
  경기도: 'gyeonggi',
  강원도: 'gangwon',
  강원특별자치도: 'gangwon',
  충청북도: 'north-chungcheong',
  충청남도: 'south-chungcheong',
  전라북도: 'north-jeolla',
  전북특별자치도: 'north-jeolla',
  전라남도: 'south-jeolla',
  경상북도: 'north-gyeongsang',
  경상남도: 'south-gyeongsang',
  제주특별자치도: 'jeju',
};

// region_code → 한글 시도명(짧은 표시용). 히트맵/배지 라벨에 사용.
export const REGION_LABELS: Record<string, string> = {
  seoul: '서울',
  busan: '부산',
  daegu: '대구',
  incheon: '인천',
  gwangju: '광주',
  daejeon: '대전',
  ulsan: '울산',
  sejong: '세종',
  gyeonggi: '경기',
  gangwon: '강원',
  'north-chungcheong': '충북',
  'south-chungcheong': '충남',
  'north-jeolla': '전북',
  'south-jeolla': '전남',
  'north-gyeongsang': '경북',
  'south-gyeongsang': '경남',
  jeju: '제주',
};

// 한국 SVG 지도 path id 와 1:1 일치하는 전체 시도 코드 목록(17개).
export const REGION_CODES = Object.keys(REGION_LABELS);

/**
 * 카카오 시도명을 region_code 로 변환. 미매칭 시 null.
 * (런타임 외부 API 호출 아님 — 단순 룩업. 좌표→시도명 변환 자체는 Stage 3.)
 */
export function regionNameToCode(regionName: string | null | undefined): string | null {
  if (!regionName) return null;
  return REGION_CODE_MAP[regionName.trim()] ?? null;
}

// ── 4-2. 뽑기 분류 상수 ────────────────────────────────────────────────────────
// key 는 places.concept 컬럼에 저장되는 값. color 는 토큰 키만.
export type ConceptKey = 'cafe' | 'charge' | 'date' | 'friend' | 'culture' | 'food';

export type ConceptDef = {
  key: ConceptKey;
  icon: string;   // 이모지
  label: string;  // 한글 표시명
  color: string;  // 디자인 토큰 키 (gold/coral/green 등) — 하드코딩 hex 금지
};

export const CONCEPTS: ConceptDef[] = [
  { key: 'cafe',    icon: '☕', label: '카페·작업', color: 'gold' },
  { key: 'charge',  icon: '🌿', label: '혼자 충전', color: 'green' },
  { key: 'date',    icon: '🍷', label: '데이트',    color: 'coral' },
  { key: 'friend',  icon: '🥂', label: '친구랑',    color: 'gold' },
  { key: 'culture', icon: '📖', label: '책·전시',   color: 'green' },
  { key: 'food',    icon: '🍜', label: '맛집',      color: 'coral' },
];

export const CONCEPT_BY_KEY: Record<ConceptKey, ConceptDef> =
  Object.fromEntries(CONCEPTS.map(c => [c.key, c])) as Record<ConceptKey, ConceptDef>;

// ── 4-3. 교통수단 상수 ─────────────────────────────────────────────────────────
export type TransportKey = 'walk' | 'bus' | 'subway' | 'car';

export type TransportDef = {
  key: TransportKey;
  icon: string;
  label: string;
};

export const TRANSPORT: TransportDef[] = [
  { key: 'walk',   icon: '🚶', label: '도보' },
  { key: 'bus',    icon: '🚌', label: '버스' },
  { key: 'subway', icon: '🚇', label: '지하철' },
  { key: 'car',    icon: '🚗', label: '차' },
];

export const TRANSPORT_BY_KEY: Record<TransportKey, TransportDef> =
  Object.fromEntries(TRANSPORT.map(t => [t.key, t])) as Record<TransportKey, TransportDef>;
