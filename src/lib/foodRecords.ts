import type { FoodRecord } from '../app/store';
import { validActivityDate } from './activityEntries';
import { SaveFailure } from './saveCoordinator';

/** Existing food_records columns. No new schema, synthetic title or photo URL rewriting. */
export type FoodRow = {
  id: string; date: string; meal_type: FoodRecord['mealType']; food_name: string;
  amount: number | null; photo_url: string | null; memo: string | null;
  calories: number | null; carbs: number | null; protein: number | null; fat: number | null;
  dining_type: FoodRecord['diningType']; taste_rating: FoodRecord['tasteRating']; taste_memo: string | null; is_fasting: boolean;
};
export const toFoodRecord = (r: FoodRow): FoodRecord => ({ id:r.id,date:r.date,mealType:r.meal_type,foodName:r.food_name,amount:r.amount ?? 0,photoUrl:r.photo_url ?? null,memo:r.memo ?? null,calories:r.calories ?? null,carbs:r.carbs ?? null,protein:r.protein ?? null,fat:r.fat ?? null,diningType:r.dining_type ?? null,tasteRating:r.taste_rating ?? null,tasteMemo:r.taste_memo ?? null,isFasting:r.is_fasting ?? false });
export const fromFoodRecord = (r: FoodRecord): FoodRow => ({ id:r.id,date:r.date,meal_type:r.mealType,food_name:r.foodName,amount:r.amount,photo_url:r.photoUrl ?? null,memo:r.memo ?? null,calories:r.calories ?? null,carbs:r.carbs ?? null,protein:r.protein ?? null,fat:r.fat ?? null,dining_type:r.diningType ?? null,taste_rating:r.tasteRating ?? null,taste_memo:r.tasteMemo ?? null,is_fasting:r.isFasting ?? false });
export function validateFoodRecord(r: FoodRecord) {
  if (!r.foodName.trim() || !validActivityDate(r.date) || !['breakfast','lunch','dinner','snack'].includes(r.mealType)) throw new SaveFailure('음식명과 식사 구분·날짜를 확인해주세요.',false);
  if (!Number.isFinite(r.amount) || r.amount < 0 || !Number.isInteger(r.amount) || (r.calories != null && (!Number.isFinite(r.calories) || r.calories < 0))) throw new SaveFailure('식비와 칼로리는 0 이상의 숫자로 입력해주세요.',false);
}
export function foodDateRecords(records: FoodRecord[], date: string) { return records.filter(r=>r.date===date); }
export function foodMonthGallery(records: FoodRecord[], month: string) { return records.filter(r=>r.date.startsWith(month) && !!r.photoUrl).sort((a,b)=>b.date.localeCompare(a.date)); }
