/**
 * 컨디션 증상 태그 마스터
 * - 기본 칩: DEFAULT_SYMPTOMS (분류 불가용 "기타" 포함)
 * - 커스텀 칩: 사용자가 추가한 증상 (user_symptoms 테이블, 정규화 비교로 중복 차단)
 */
export const DEFAULT_SYMPTOMS: string[] = [
  '피로', '두통', '어지러움', '소화불량', '졸림', '컨디션 좋음',
  '집중 잘됨', '부종', '근육통', '감기 기운', '알레르기', '기타',
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
