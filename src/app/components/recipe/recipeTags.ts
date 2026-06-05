// 레시피 추가 폼 태그 프리셋.
// - 의도/상황 태그 → recipes.tags 에 저장
// - 주재료 → recipes.main_ingredients 에 저장(냉장고 연결용 별도 배열)
// - 둘 다 사용자가 '직접 추가' 가능

export const INTENT_TAG_PRESETS: string[] = [
  '해보고 싶음', '또 해먹기', '혼밥', '손님', '10분컷',
  '야식', '도시락', '간단', '술안주', '비건', '다이어트', '아이반찬',
];

export const MAIN_INGREDIENT_PRESETS: { name: string; emoji: string }[] = [
  { name: '두부', emoji: '🟨' },
  { name: '계란', emoji: '🥚' },
  { name: '닭',   emoji: '🍗' },
  { name: '돼지', emoji: '🥩' },
  { name: '소',   emoji: '🥓' },
  { name: '해산물', emoji: '🦐' },
  { name: '생선', emoji: '🐟' },
  { name: '면',   emoji: '🍜' },
  { name: '밥',   emoji: '🍚' },
  { name: '야채', emoji: '🥬' },
  { name: '버섯', emoji: '🍄' },
  { name: '치즈', emoji: '🧀' },
];
