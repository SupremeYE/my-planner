/**
 * 컨디션 증상 태그 마스터
 * - 기본 칩: DEFAULT_SYMPTOMS (분류 불가용 "기타" 포함)
 * - 커스텀 칩: 사용자가 추가한 증상 (user_symptoms 테이블, 정규화 비교로 중복 차단)
 */
// ⚠️ '컨디션 좋음'·'집중 잘됨' 제거됨 — 이 둘은 증상(몸의 이상)이 아니라 '좋은 상태'다.
// 좋은 상태를 담을 곳이 없어 증상 목록으로 새어나온 것이라, 독립 축인 condition(몸 상태)으로 대체한다.
export const DEFAULT_SYMPTOMS: string[] = [
  '피로', '두통', '어지러움', '소화불량', '졸림',
  '부종', '근육통', '감기 기운', '알레르기', '기타',
];

/**
 * 증상 이름 정규화 — 중복 비교용
 * 앞뒤 공백 제거 + 내부 공백 단일화 + 소문자
 * (DB의 name_norm 컬럼·클라이언트 중복 검사가 동일 함수를 사용)
 */
export function normalizeSymptom(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 선택 가능한 증상 목록을 반환한다.
 * 기본 칩과 정규화 동등한 커스텀은 새로 추가하지 않음(기본이 우선).
 * @param custom 사용자 커스텀 증상 표시명 배열
 */
export function getSymptomOptions(custom: string[] = []): string[] {
  const seen = new Set(DEFAULT_SYMPTOMS.map(normalizeSymptom));
  const merged = [...DEFAULT_SYMPTOMS];
  custom.forEach(c => {
    const norm = normalizeSymptom(c);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    merged.push(c.trim());
  });
  return merged;
}

// 스트레스 5단계 라벨
export const STRESS_LEVELS: { value: number; label: string; short: string }[] = [
  { value: 1, label: '매우 낮음', short: '매우낮' },
  { value: 2, label: '낮음',     short: '낮음' },
  { value: 3, label: '보통',     short: '보통' },
  { value: 4, label: '높음',     short: '높음' },
  { value: 5, label: '매우 높음', short: '매우높' },
];

// 컨디션(몸 상태) 4단계 — 스트레스와 다른 축. 1=나쁨 … 4=아주 좋음.
export const CONDITION_LEVELS: { value: number; label: string; short: string }[] = [
  { value: 1, label: '나쁨',     short: '나쁨' },
  { value: 2, label: '보통',     short: '보통' },
  { value: 3, label: '좋음',     short: '좋음' },
  { value: 4, label: '아주 좋음', short: '아주좋' },
];
export const conditionLabel = (v: number | null | undefined): string =>
  v == null ? '—' : (CONDITION_LEVELS.find(c => c.value === v)?.label ?? String(v));

// 시점(slot) — weight_records.slot 과 값 체계 정합(한글). 비교 앵커 '아침'/'저녁' 재사용, '낮'만 컨디션 고유.
export const CONDITION_SLOTS = ['아침', '낮', '저녁'] as const;
export type ConditionSlot = typeof CONDITION_SLOTS[number];
// 시점 자동 추정(입력 폼 기본값) — 시각 기준. 사용자가 언제든 바꿀 수 있다.
export const autoConditionSlot = (d = new Date()): ConditionSlot => {
  const h = d.getHours();
  return h < 12 ? '아침' : h < 18 ? '낮' : '저녁';
};
// 그날 '마지막 상태' 판정용 시점 순위(저녁 > 낮 > 아침 > 미상). 하루 여러 건 요약에 쓰인다.
export const conditionSlotRank = (slot: string | null | undefined): number =>
  slot === '저녁' ? 3 : slot === '낮' ? 2 : slot === '아침' ? 1 : 0;
