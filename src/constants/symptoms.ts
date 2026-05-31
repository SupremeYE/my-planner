/**
 * 컨디션 증상 태그 마스터
 * 향후 사용자 커스텀 태그를 더하려면 getSymptomOptions에 커스텀 목록을 합치면 된다.
 */
export const DEFAULT_SYMPTOMS: string[] = [
  '피로', '두통', '어지러움', '소화불량', '졸림', '컨디션 좋음',
  '집중 잘됨', '부종', '근육통', '감기 기운', '알레르기', '기타',
];

/**
 * 선택 가능한 증상 목록을 반환한다.
 * @param custom 사용자 커스텀 태그(향후 Supabase/설정에서 주입)
 */
export function getSymptomOptions(custom: string[] = []): string[] {
  const merged = [...DEFAULT_SYMPTOMS];
  custom.forEach(c => {
    const v = c.trim();
    if (v && !merged.includes(v)) merged.push(v);
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
