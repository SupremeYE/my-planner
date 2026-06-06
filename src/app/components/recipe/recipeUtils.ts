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

// 냉장고 빠른 입력 — 쉼표·줄바꿈으로 분리 후 각 항목에서 끝의 "수량+단위" 추출.
//  - 예: "계란 12" → { name:'계란', quantity:12, unit:null }
//        "사과 3개" → { name:'사과', quantity:3, unit:'개' }
//        "우유" → { name:'우유', quantity:1, unit:null }
//  - 자연어("한 판"→30 등)는 Phase 3 AI 고도화 범위로 두고, 여기선 숫자 기반 기본 파싱만.
export function parseFridgeQuickInput(
  text: string,
): Array<{ name: string; quantity: number; unit: string | null }> {
  return text
    .split(/[,，\n]/)           // 쉼표(반각/전각)·줄바꿈으로 분리
    .map(s => s.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/(\d+(?:\.\d+)?)\s*([^\d\s]+)?\s*$/);
      if (m && (m.index ?? 0) > 0) {
        return {
          name: line.slice(0, m.index).trim(),
          quantity: parseFloat(m[1]),
          unit: (m[2] ?? '').trim() || null,
        };
      }
      return { name: line, quantity: 1, unit: null };
    });
}

// yyyy-MM-dd 포맷 — 로컬 자정 기준.
export function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 오늘 기준 N일/N주/N개월 후 yyyy-MM-dd (로컬). 음수도 허용.
export function expiryFromToday(amount: number, unit: 'day' | 'week' | 'month'): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (unit === 'day') d.setDate(d.getDate() + amount);
  else if (unit === 'week') d.setDate(d.getDate() + amount * 7);
  else d.setMonth(d.getMonth() + amount);
  return formatDateYmd(d);
}

// 유통기한 빠른 버튼 프리셋 — 라벨/값 계산. '모름' 은 빈 문자열로 처리.
export const EXPIRY_PRESETS: Array<{ label: string; getValue: () => string }> = [
  { label: '+3일',  getValue: () => expiryFromToday(3, 'day') },
  { label: '+1주',  getValue: () => expiryFromToday(1, 'week') },
  { label: '+1달',  getValue: () => expiryFromToday(1, 'month') },
  { label: '모름',  getValue: () => '' },
];

// 초 → 사람이 읽는 한국어 ("5분", "1분 30초", "45초")
export function formatDurationKo(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m && s) return `${m}분 ${s}초`;
  if (m) return `${m}분`;
  return `${s}초`;
}
