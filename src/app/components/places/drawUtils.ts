// 뽑기(Stage 4) 로컬 계산 유틸 — 외부 API 호출 없음. 저장된 데이터만 읽어 계산한다.
import type { Place } from '../../../lib/db';

// ── 하버사인 거리(km) ────────────────────────────────────────────────────────
type LatLng = { lat: number | null; lng: number | null };
export function haversineKm(a: LatLng, b: LatLng): number {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── 가벼운 가중치: 안 가본 곳 + 오래된 저장을 살짝 우대 (완전 랜덤 아님) ──────────
function weightOf(p: Place, visited: Set<string>): number {
  const unvisited = !visited.has(p.id) ? 1.5 : 0;
  const ageDays = (Date.now() - Date.parse(p.createdAt)) / 86_400_000;
  const aging = Math.min(Math.max(ageDays, 0) / 30, 1); // 30일+ 묵힌 저장 → 최대 +1
  return 1 + unvisited + aging;
}

export function pickWeighted(pool: Place[], visited: Set<string>): Place | null {
  if (pool.length === 0) return null;
  const weights = pool.map(p => weightOf(p, visited));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ── 코스: 시드 + 가까운 곳 1~2개(가까운 순 동선). 좌표 있는 곳만, 너무 멀면 끊음. ──
export function buildCourse(pool: Place[], visited: Set<string>, max = 3): Place[] {
  const coord = pool.filter(p => p.lat != null && p.lng != null);
  if (coord.length === 0) return [];
  const seed = pickWeighted(coord, visited)!;
  const stops: Place[] = [seed];
  let current = seed;
  const left = coord.filter(p => p.id !== seed.id);
  while (stops.length < max && left.length) {
    left.sort((a, b) => haversineKm(current, a) - haversineKm(current, b));
    const next = left.shift()!;
    // 2스톱 이상 모였는데 다음이 너무 멀면(>12km) 동선이 늘어지지 않게 멈춤
    if (stops.length >= 2 && haversineKm(current, next) > 12) break;
    stops.push(next);
    current = next;
  }
  return stops;
}

// ── "왜 이 곳?" 템플릿 (손글씨로 렌더). memo 우선 → concept 풀 → 일반. 변형 2~3개. ──
// (나중에 Haiku 생성으로 교체 가능하도록 이 함수만 갈아끼우면 됨 — 호출부는 string 만 소비)
const CONCEPT_REASONS: Record<string, string[]> = {
  cafe:    ['조용히 작업하기 좋다고 담아둔 곳', '커피 한 잔 하기 딱이야', '오늘 노트북 펴기 좋은 곳'],
  charge:  ['혼자 충전하기 딱 좋은 곳', '조용히 나만의 시간 보내기 좋아', '한숨 돌리기 좋은 곳'],
  date:    ['분위기 잡기 좋다고 담아둔 곳', '둘이 가기 좋은 곳', '특별한 날 어울리는 곳'],
  friend:  ['친구랑 수다 떨기 좋은 곳', '왁자지껄 모이기 좋아', '같이 가면 즐거운 곳'],
  culture: ['천천히 둘러보기 좋은 곳', '영감 받기 좋은 곳', '책·전시 보며 쉬기 좋아'],
  food:    ['제대로 한 끼 하기 좋은 곳', '맛있다고 담아둔 곳', '오늘 든든하게 먹기 좋아'],
};
const GENERIC_REASONS = ['언젠가 가보려고 담아둔 곳', '마음에 들어서 저장해둔 곳', '오늘 한번 가볼까 싶은 곳'];
const UNVISITED_TAIL = '저장해두고 아직 안 가봤네 — 오늘 어때?';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildReason(p: Place, visited: Set<string>, short = false): string {
  let base: string;
  const memo = p.memo?.trim();
  if (memo) {
    const m = memo.length > 18 ? memo.slice(0, 18) + '…' : memo;
    base = pick([`네가 '${m}'라고 적어둔 곳`, `'${m}' — 그렇게 메모해둔 곳`]);
  } else {
    const poolReasons = p.concept && CONCEPT_REASONS[p.concept] ? CONCEPT_REASONS[p.concept] : GENERIC_REASONS;
    base = pick(poolReasons);
  }
  if (short) return base;
  return visited.has(p.id) ? base : `${base} · ${UNVISITED_TAIL}`;
}

// 뽑는 동안 회전하는 위트 카피
export const DRAW_COPY = [
  '고민은 내가 할게…',
  '네 취향만 믿고 고르는 중',
  '발걸음 예열 중',
  '지난 저장들 뒤적이는 중',
  '오늘 동선 그려보는 중',
];
