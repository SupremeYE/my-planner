// 냉장고 ↔ 레시피 매칭 헬퍼 (Phase 3 D)
// 원칙: 표기 차이에 관대하게 (공백 제거, 소문자, 끝의 부속 토큰 무시).
// 신호:
//   1차 — recipe.mainIngredients (사용자가 명시한 주재료)
//   2차 — recipe.ingredients[].name (입력된 재료 이름, 보조)
// 매칭: 정규화한 키워드 부분일치 + 동의어 맵.
//
// 의도적으로 단순: AI/형태소 분석 없음. Phase 3 후속에서 고도화 여지.
import type { Recipe, FridgeItem } from '../../store';
import { MAIN_INGREDIENT_PRESETS } from './recipeTags';

// ── 정규화 ──────────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim();
}

// 동의어/표기 변형 그룹 — 같은 그룹은 서로 매칭으로 인정.
// 좌측이 "대표 키워드", 우측 배열이 그 그룹에 속하는 다른 표기들.
// 매칭 시 양방향으로 본다.
const SYNONYM_GROUPS: Array<string[]> = [
  ['면', '파스타', '국수', '스파게티', '라면', '소면', '우동'],
  ['계란', '달걀', '에그'],
  ['돼지', '돼지고기', '삼겹살', '목살'],
  ['소', '소고기', '쇠고기', '한우'],
  ['닭', '닭고기', '치킨'],
  ['해산물', '새우', '오징어', '문어', '조개'],
  ['생선', '연어', '참치', '고등어', '갈치', '명태'],
  ['두부', '연두부', '순두부', '단단한두부'],
  ['야채', '채소', '양배추', '양상추', '시금치', '상추', '청경채'],
  ['버섯', '표고', '느타리', '새송이', '팽이'],
  ['치즈', '모짜렐라', '체다', '파마산'],
  ['밥', '쌀', '백미', '현미'],
  ['김치', '배추김치', '묵은지'],
  ['양파', '대파', '쪽파'],   // 파류 — 같은 그룹으로 묶으면 너무 헐거워질 수 있어 보수적
];

// 한 키워드의 "확장 집합" 반환 — 그 키워드를 포함하는 모든 동의어 그룹의 원소.
function expand(keyword: string): string[] {
  const k = normalize(keyword);
  const hits = SYNONYM_GROUPS.filter(g => g.some(x => normalize(x) === k));
  if (hits.length === 0) return [k];
  const set = new Set<string>([k]);
  hits.forEach(g => g.forEach(x => set.add(normalize(x))));
  return Array.from(set);
}

// 한 측의 텍스트(레시피 키워드)와 다른 측의 텍스트(냉장고 이름)가 매칭되는지.
// 양방향 부분일치 + 동의어 확장.
//   recipeKey가 fridge 이름에 포함되거나, fridge 이름이 recipeKey에 포함되면 hit.
//   예: '계란' ↔ '계란 12' (포함), '면' ↔ '파스타면' (동의어 확장 후 포함)
function isMatch(recipeKey: string, fridgeName: string): boolean {
  const a = normalize(recipeKey);
  const b = normalize(fridgeName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // 동의어 확장
  const ax = expand(a);
  const bx = expand(b);
  for (const x of ax) {
    for (const y of bx) {
      if (x === y) return true;
      if (x.includes(y) || y.includes(x)) return true;
    }
  }
  return false;
}

// ── 공개 API ──────────────────────────────────────────────────────────────

// 레시피 주재료(있으면 우선) + 재료 이름(보조)에서 매칭 후보 키워드 모음.
// 빈 배열 = 매칭 신호 없음(랭킹 제외 권장).
export function recipeKeywords(recipe: Recipe): string[] {
  const ks: string[] = [];
  recipe.mainIngredients.forEach(m => { if (m && m.trim()) ks.push(m.trim()); });
  // 보조 신호: 재료 이름 (너무 일반적인 양념류는 제외해도 좋지만
  // 단순화를 위해 모두 포함. 매칭은 어차피 냉장고 품목과 교집합)
  recipe.ingredients.forEach(g => { if (g.name && g.name.trim()) ks.push(g.name.trim()); });
  return ks;
}

// fridge_items 중 D-day 임박(<=2일) 품목만.
export function fridgeUrgentItems(fridge: FridgeItem[]): FridgeItem[] {
  const todayMid = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  })();
  return fridge.filter(it => {
    if (!it.expiryDate) return false;
    const [y, m, d] = it.expiryDate.split('-').map(Number);
    if (!y || !m || !d) return false;
    const target = new Date(y, m - 1, d).getTime();
    const days = Math.round((target - todayMid) / 86400000);
    return days <= 2;
  });
}

// fridge_items 의 한 품목이 "남아있는" 상태인지 (수량 > 0).
export function isFridgeAvailable(it: FridgeItem): boolean {
  return it.quantity > 0;
}

// ── 레시피 ↔ 냉장고 매칭 결과 ────────────────────────────────────────────
// 한 레시피에 대해 주재료 중 냉장고에 "있는 것"/"없는 것" 분리.
// matchedFridgeItem: 매칭된 냉장고 품목(여러 개면 첫 번째).
export interface RecipeMatchResult {
  recipe: Recipe;
  matchedKeys: string[];        // 냉장고에서 찾은 주재료 키워드
  missingKeys: string[];        // 주재료 중 없는 키워드
  matchedFridge: FridgeItem[];  // 매칭된 냉장고 품목들(중복 제거)
}

// 주재료 기준 매칭 (mainIngredients 가 있을 때만 의미 있음).
// 주재료가 없는 레시피는 matchedKeys=[], missingKeys=[]로 반환 → 호출부에서 제외 판단.
export function matchRecipeToFridge(recipe: Recipe, fridge: FridgeItem[]): RecipeMatchResult {
  const available = fridge.filter(isFridgeAvailable);
  const keys = recipe.mainIngredients.map(k => k.trim()).filter(Boolean);
  const matched: string[] = [];
  const missing: string[] = [];
  const matchedFridge: FridgeItem[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const hit = available.find(f => isMatch(k, f.name));
    if (hit) {
      matched.push(k);
      if (!seen.has(hit.id)) { matchedFridge.push(hit); seen.add(hit.id); }
    } else {
      missing.push(k);
    }
  }
  return { recipe, matchedKeys: matched, missingKeys: missing, matchedFridge };
}

// ── 부족 재료 (RecipeDetail "장보기 담기"용) ─────────────────────────────
// 레시피의 ingredients(파싱된 재료 라인) 각각에 대해 냉장고에 있는지 판단.
// 주재료가 비어 있어도 ingredients 단위로 판단할 수 있게 별도 함수.
export interface IngredientAvailability {
  ingredientId: string;
  name: string;
  amount?: number | null;
  unit?: string | null;
  hasInFridge: boolean;
  matchedFridgeName?: string;   // 매칭된 냉장고 품목 이름(있을 때)
}

export function evaluateIngredients(recipe: Recipe, fridge: FridgeItem[]): IngredientAvailability[] {
  const available = fridge.filter(isFridgeAvailable);
  return recipe.ingredients.map(g => {
    const hit = available.find(f => isMatch(g.name, f.name));
    return {
      ingredientId: g.id,
      name: g.name,
      amount: g.amount,
      unit: g.unit,
      hasInFridge: !!hit,
      matchedFridgeName: hit?.name,
    };
  });
}

// ── RecipeListTab 섹션용 분류 ───────────────────────────────────────────
// "지금 만들 수 있어요": 주재료 모두 있음(부족 0).  "1개 부족": missingKeys.length === 1.
// 주재료가 없는 레시피는 제외(신호 없음).
export interface CookableBucket {
  ready: RecipeMatchResult[];          // 모두 있음
  oneMissing: RecipeMatchResult[];     // 1개 부족
}

export function classifyCookable(recipes: Recipe[], fridge: FridgeItem[]): CookableBucket {
  const ready: RecipeMatchResult[] = [];
  const oneMissing: RecipeMatchResult[] = [];
  for (const r of recipes) {
    if (r.mainIngredients.length === 0) continue;
    const m = matchRecipeToFridge(r, fridge);
    if (m.matchedKeys.length === 0) continue;
    if (m.missingKeys.length === 0) ready.push(m);
    else if (m.missingKeys.length === 1) oneMissing.push(m);
  }
  // 많이 매칭된 순 → 적게 매칭된 순
  ready.sort((a, b) => b.matchedKeys.length - a.matchedKeys.length);
  oneMissing.sort((a, b) => b.matchedKeys.length - a.matchedKeys.length);
  return { ready, oneMissing };
}

// "유통기한 임박 재료가 들어간 레시피":
// urgent(D-2 이내) 품목 중 하나라도 매칭되는 레시피만 반환. 카드 배지용으로
// 어떤 임박 품목이 매칭됐는지(이름 + 남은일수) 함께 반환.
export interface UrgentRecipeHit {
  recipe: Recipe;
  urgentItems: Array<{ name: string; daysLeft: number }>;   // 배지 표기에 사용 (D-1 두부 등)
}

export function findUrgentRecipes(recipes: Recipe[], fridge: FridgeItem[]): UrgentRecipeHit[] {
  const urgent = fridgeUrgentItems(fridge).filter(isFridgeAvailable);
  if (urgent.length === 0) return [];
  const todayMid = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  })();
  const out: UrgentRecipeHit[] = [];
  for (const r of recipes) {
    const keys = recipeKeywords(r);
    if (keys.length === 0) continue;
    const hits: Array<{ name: string; daysLeft: number }> = [];
    const seen = new Set<string>();
    for (const f of urgent) {
      const matched = keys.some(k => isMatch(k, f.name));
      if (matched && !seen.has(f.id)) {
        const [y, m, d] = (f.expiryDate ?? '').split('-').map(Number);
        const target = new Date(y, m - 1, d).getTime();
        const days = Math.round((target - todayMid) / 86400000);
        hits.push({ name: f.name, daysLeft: days });
        seen.add(f.id);
      }
    }
    if (hits.length > 0) {
      // 가장 임박한 순으로 정렬
      hits.sort((a, b) => a.daysLeft - b.daysLeft);
      out.push({ recipe: r, urgentItems: hits });
    }
  }
  // 카드 정렬: 가장 임박한 품목이 있는 레시피 먼저
  out.sort((a, b) => a.urgentItems[0].daysLeft - b.urgentItems[0].daysLeft);
  return out;
}

// 보조 노출 — 외부에서 동의어 그룹 확인용(테스트/디버깅).
export const __INTERNAL__ = { normalize, expand, isMatch };

// 프리셋 주재료 이름 목록 (UI 쪽 노출 보조)
export const PRESET_MAIN_NAMES: string[] = MAIN_INGREDIENT_PRESETS.map(p => p.name);
