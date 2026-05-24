/**
 * 식단 관련 아이콘 상수
 * 아이콘 변경 시 이 파일만 수정하면 됩니다.
 */
import type { MealType, DiningType } from '../app/store';

export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch:     '☀️',
  dinner:    '🌙',
  snack:     '🍪',
};

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch:     '점심',
  dinner:    '저녁',
  snack:     '간식',
};

export const DINING_ICONS: Record<DiningType, string> = {
  home:       '🏠',
  delivery:   '🛵',
  restaurant: '🍴',
  coffee:     '☕',
};

export const DINING_LABELS: Record<DiningType, string> = {
  home:       '집밥',
  delivery:   '배달',
  restaurant: '외식',
  coffee:     '커피',
};
