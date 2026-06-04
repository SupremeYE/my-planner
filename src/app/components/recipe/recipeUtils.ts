// 레시피 모듈 공용 유틸 (Phase 1)

// "1/2" / "1.5" / "200" 같은 수치 문자열을 number 로 파싱
export function parseQuantity(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// 재료 한 줄을 { name, amount, unit } 로 파싱.
//  - 한국어 레시피 관용 포맷(이름 + 수량 + 단위) 우선: "돼지고기 200g", "양파 1개", "간장 2큰술", "양파 1/2개"
//  - 수치가 없으면 전체를 이름으로 (예: "소금 약간")
export function parseIngredientLine(
  line: string,
): { name: string; amount: number | null; unit: string | null } | null {
  const t = line.trim();
  if (!t) return null;
  // 줄 끝의 "수량+단위" 패턴 (수량: 정수/소수/분수, 단위: 숫자/공백 아닌 문자들)
  const m = t.match(/(\d+(?:\.\d+)?|\d+\/\d+)\s*([^\d\s][^\s]*)?\s*$/);
  if (m && (m.index ?? 0) > 0) {
    const name = t.slice(0, m.index).trim();
    const amount = parseQuantity(m[1]);
    const unit = (m[2] ?? '').trim() || null;
    if (name) return { name, amount, unit };
  }
  return { name: t, amount: null, unit: null };
}

// 인분 환산된 분량을 표시용 문자열로. base 기준 amount 를 ratio 배 → 소수 1자리 반올림.
export function formatScaledAmount(amount: number, ratio: number): string {
  const scaled = Math.round(amount * ratio * 10) / 10;
  // 정수면 소수점 제거 (200.0 → 200), 아니면 1자리 (1.5)
  return Number.isInteger(scaled) ? String(scaled) : String(scaled);
}

// 초 → "M:SS" (타이머 표시)
export function formatTimerLabel(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 초 → 사람이 읽는 한국어 ("5분", "1분 30초", "45초")
export function formatDurationKo(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m && s) return `${m}분 ${s}초`;
  if (m) return `${m}분`;
  return `${s}초`;
}
