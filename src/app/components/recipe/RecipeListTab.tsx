import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Plus, Clock, Star, Search, Shuffle, Sparkles, X, Youtube, Instagram, Link2, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { Recipe, FridgeItem } from '../../store';
import { RecipeFormSheet } from './RecipeFormSheet';
import { RecipeDetail } from './RecipeDetail';
import ConfirmModal from '../ConfirmModal';
import { detectRecipeSourcePlatform, type RecipeSourcePlatform } from '../../../lib/recipeSource';
import { INTENT_TAG_PRESETS, MAIN_INGREDIENT_PRESETS } from './recipeTags';
import { classifyCookable, findUrgentRecipes, type RecipeMatchResult, type UrgentRecipeHit } from './fridgeMatch';

// 대표 이미지 결정 — coverSource 기준, 비어 있으면 다른 쪽 폴백
function coverImage(r: Recipe): string | null {
  if (r.coverSource === 'my_photo' && r.myPhotoUrl) return r.myPhotoUrl;
  if (r.coverSource === 'thumbnail' && r.thumbnailUrl) return r.thumbnailUrl;
  return r.myPhotoUrl || r.thumbnailUrl || null;
}

// 출처 플랫폼 → 아이콘 컴포넌트 / 이모지 폴백
function SourceBadge({ platform }: { platform: RecipeSourcePlatform }) {
  if (!platform) return null;
  const common: React.CSSProperties = {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  let Icon: React.ComponentType<{ size?: number; color?: string }> = Link2;
  if (platform === 'youtube' || platform === 'shorts') Icon = Youtube;
  else if (platform === 'instagram') Icon = Instagram;
  return (
    <span style={common} aria-label={platform}>
      <Icon size={13} color="#fff" />
    </span>
  );
}

// 주재료 이모지 매핑 (recipeTags 프리셋 기반)
const MAIN_EMOJI: Record<string, string> = Object.fromEntries(
  MAIN_INGREDIENT_PRESETS.map(p => [p.name, p.emoji]),
);

// ── 레시피 카드 ──
// matchBadge: 우상단에 표시할 매칭 배지(있음/부족/임박)
type MatchBadgeKind = 'ready' | 'oneMissing' | 'urgent';
interface MatchBadge {
  kind: MatchBadgeKind;
  label: string;     // 예: '✓ 재료 있음', '1개 부족', 'D-1 두부'
}
function RecipeCard({ recipe, onClick, highlight, matchBadge }:
  { recipe: Recipe; onClick: () => void; highlight?: boolean; matchBadge?: MatchBadge }) {
  const { t } = useTheme();
  const cover = coverImage(recipe);
  const isMyPhoto = recipe.coverSource === 'my_photo' && !!recipe.myPhotoUrl;
  const platform = detectRecipeSourcePlatform(recipe.sourceUrl || '');

  // 카드 하단에 보여줄 칩 — 주재료(이모지) + 의도 태그, 최대 3개
  const chips: { label: string; kind: 'main' | 'intent' }[] = [];
  recipe.mainIngredients.slice(0, 2).forEach(m => {
    chips.push({ label: `${MAIN_EMOJI[m] ?? ''} ${m}`.trim(), kind: 'main' });
  });
  recipe.tags.slice(0, 2).forEach(tag => chips.push({ label: tag, kind: 'intent' }));
  const visibleChips = chips.slice(0, 3);

  return (
    <button onClick={onClick}
      className="text-left rounded-2xl overflow-hidden transition-transform active:scale-[0.98] hover:-translate-y-0.5"
      style={{
        backgroundColor: t.card,
        border: `${highlight ? 2 : 1}px solid ${highlight ? t.accent : t.border}`,
        boxShadow: highlight ? `0 8px 24px ${t.accent}33` : t.shadow,
      }}>
      {/* 썸네일 / placeholder */}
      <div className="relative w-full" style={{ aspectRatio: '4 / 3', backgroundColor: t.bgSub }}>
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat size={34} color={t.textMuted} />
          </div>
        )}
        {isMyPhoto && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md"
            style={{ fontSize: 10, fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}>📸 내 사진</span>
        )}
        <SourceBadge platform={platform} />
        {recipe.totalMinutes != null && (
          <span className="absolute left-2 bottom-2 flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ fontSize: 11, fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}>
            <Clock size={11} /> {recipe.totalMinutes}분
          </span>
        )}
      </div>
      {/* 본문 */}
      <div className="px-3 py-2.5">
        {matchBadge && (
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md"
              style={{
                fontSize: 10, fontWeight: 700,
                backgroundColor:
                  matchBadge.kind === 'ready' ? t.accentLight
                  : matchBadge.kind === 'urgent' ? t.dangerLight
                  : t.bgSub,
                color:
                  matchBadge.kind === 'ready' ? t.accent
                  : matchBadge.kind === 'urgent' ? t.danger
                  : t.textSub,
                border: `1px solid ${
                  matchBadge.kind === 'ready' ? `${t.accent}55`
                  : matchBadge.kind === 'urgent' ? `${t.danger}55`
                  : t.border}`,
              }}>
              {matchBadge.kind === 'ready' && <Check size={10} />}
              {matchBadge.kind === 'urgent' && <AlertCircle size={10} />}
              {matchBadge.label}
            </span>
          </div>
        )}
        <h3 className="truncate" style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{recipe.title}</h3>
        <div className="flex items-center gap-2 mt-1" style={{ fontSize: 12, color: t.textSub }}>
          {recipe.rating != null && recipe.rating > 0 ? (
            <span className="flex items-center gap-0.5" style={{ color: t.accent }}>
              <Star size={12} fill={t.accent} color={t.accent} /> {recipe.rating}
            </span>
          ) : null}
          <span>재료 {recipe.ingredients.length} · {recipe.steps.length}단계</span>
        </div>
        {visibleChips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {visibleChips.map((c, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded-md"
                style={{
                  fontSize: 10, fontWeight: 600,
                  backgroundColor: c.kind === 'main' ? t.bgSub : t.accentLight,
                  color: c.kind === 'main' ? t.textSub : t.accent,
                  border: `1px solid ${c.kind === 'main' ? t.border : 'transparent'}`,
                }}>{c.label}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="rounded-full flex items-center justify-center mb-4"
        style={{ width: 72, height: 72, backgroundColor: t.accentLight }}>
        <ChefHat size={34} color={t.accent} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>아직 저장한 레시피가 없어요</p>
      <p style={{ fontSize: 13, color: t.textSub, marginTop: 6 }}>+ 버튼으로 첫 레시피를 직접 입력해 보세요</p>
      <button onClick={onAdd}
        className="mt-5 flex items-center gap-1.5 px-4 py-2.5 rounded-xl"
        style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
        <Plus size={16} /> 레시피 추가
      </button>
    </div>
  );
}

// 필터 칩 한 줄
function FilterChip({ label, active, onClick, color }:
  { label: string; active: boolean; onClick: () => void; color: { bg: string; on: string; text: string; border: string } }) {
  return (
    <button onClick={onClick}
      className="shrink-0 px-2.5 py-1 rounded-full transition-colors"
      style={{
        fontSize: 12, fontWeight: active ? 700 : 500,
        backgroundColor: active ? color.on : color.bg,
        color: active ? '#fff' : color.text,
        border: `1px solid ${active ? color.on : color.border}`,
      }}>{label}</button>
  );
}

export function RecipeListTab() {
  const { t } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // 카드 탭 → 상세 읽기 화면. 편집은 상세 안의 '편집' 버튼으로만 진입.
  const [detailId, setDetailId] = useState<string | null>(null);

  // 태그 필터 — 다중 선택
  const [activeIntents, setActiveIntents] = useState<Set<string>>(new Set());
  const [activeMains, setActiveMains] = useState<Set<string>>(new Set());

  // 셔플 추천
  const [shuffled, setShuffled] = useState<Recipe | null>(null);

  // ── 데이터 로드 + Realtime 동기화 ──
  const refresh = useCallback(() => {
    db.recipes.fetchAll().then(rs => { setRecipes(rs); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('recipes', refresh);
  useRealtimeSync('recipe_ingredients', refresh);
  useRealtimeSync('recipe_steps', refresh);

  // ── 냉장고 — 매칭 섹션용 ──
  const [fridge, setFridge] = useState<FridgeItem[]>([]);
  const refreshFridge = useCallback(() => {
    db.fridgeItems.fetchAll().then(setFridge);
  }, []);
  useEffect(() => { refreshFridge(); }, [refreshFridge]);
  useRealtimeSync('fridge_items', refreshFridge);

  // 매칭 결과 — recipes / fridge 가 바뀌면 재계산 (Realtime 으로 자동 트리거)
  const cookable = useMemo(() => classifyCookable(recipes, fridge), [recipes, fridge]);
  const urgentRecipes = useMemo(() => findUrgentRecipes(recipes, fridge), [recipes, fridge]);

  // 저장된 레시피에 실제로 존재하는 태그/주재료 (프리셋 + 사용자 정의 모두)
  const { availableIntents, availableMains } = useMemo(() => {
    const intents = new Set<string>();
    const mains = new Set<string>();
    recipes.forEach(r => {
      r.tags.forEach(x => intents.add(x));
      r.mainIngredients.forEach(x => mains.add(x));
    });
    const orderedIntents = [
      ...INTENT_TAG_PRESETS.filter(x => intents.has(x)),
      ...Array.from(intents).filter(x => !INTENT_TAG_PRESETS.includes(x)),
    ];
    const presetMainNames = MAIN_INGREDIENT_PRESETS.map(p => p.name);
    const orderedMains = [
      ...presetMainNames.filter(x => mains.has(x)),
      ...Array.from(mains).filter(x => !presetMainNames.includes(x)),
    ];
    return { availableIntents: orderedIntents, availableMains: orderedMains };
  }, [recipes]);

  // 검색 + 태그 필터 적용
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter(r => {
      if (q) {
        const hit = r.title.toLowerCase().includes(q)
          || r.ingredients.some(g => g.name.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (activeIntents.size > 0 && !r.tags.some(x => activeIntents.has(x))) return false;
      if (activeMains.size > 0 && !r.mainIngredients.some(x => activeMains.has(x))) return false;
      return true;
    });
  }, [recipes, search, activeIntents, activeMains]);

  // 먼지 쌓인 레시피 — cookCount === 0 AND createdAt 14일 이상 경과 (필터와 무관, 전체 기준)
  const dusty = useMemo(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const candidates = recipes.filter(r => {
      if ((r.cookCount ?? 0) !== 0) return false;
      if (!r.createdAt) return false;
      const ts = new Date(r.createdAt).getTime();
      return Number.isFinite(ts) && ts <= cutoff;
    });
    // 가장 오래된 것부터 2개
    candidates.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
    return candidates.slice(0, 2);
  }, [recipes]);

  // 필터 변경 시 셔플 카드 무효화
  useEffect(() => { setShuffled(null); }, [search, activeIntents, activeMains]);

  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  // 카드 탭 → 상세 화면 진입
  const openDetail = (r: Recipe) => { setDetailId(r.id); };
  // 상세 → 편집: 상세를 닫고 폼 시트(편집 모드) 오픈
  const openEditFromDetail = (r: Recipe) => { setDetailId(null); setEditing(r); setSheetOpen(true); };

  const handleSave = async (rec: Recipe) => {
    const wasEditing = !!editing;
    await db.recipes.upsert(rec);
    setSheetOpen(false);
    setEditing(null);
    // 편집 모드에서 저장한 경우 상세 화면으로 자연스럽게 복귀
    if (wasEditing) setDetailId(rec.id);
    refresh();
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await db.recipes.delete(deleteId);
    setDeleteId(null);
    setSheetOpen(false);
    setEditing(null);
    // 삭제한 레시피의 상세가 열려 있다면 함께 닫기
    if (detailId === deleteId) setDetailId(null);
    refresh();
  };

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const handleShuffle = () => {
    if (filtered.length === 0) return;
    if (filtered.length === 1) { setShuffled(filtered[0]); return; }
    // 직전과 같은 카드 피하기
    let next = filtered[Math.floor(Math.random() * filtered.length)];
    if (shuffled && next.id === shuffled.id) {
      const rest = filtered.filter(r => r.id !== shuffled.id);
      next = rest[Math.floor(Math.random() * rest.length)];
    }
    setShuffled(next);
  };

  const hasAnyFilter = activeIntents.size > 0 || activeMains.size > 0 || search.trim() !== '';

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-4 lg:py-6">
        {/* 검색 */}
        <div className="relative mb-3">
          <Search size={16} color={t.textMuted}
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="레시피·재료 검색"
            className="w-full rounded-xl outline-none"
            style={{ padding: '9px 11px 9px 34px', fontSize: 14, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text }} />
        </div>

        {/* 태그 필터 칩 — 의도/상황 */}
        {availableIntents.length > 0 && (
          <div className="mb-2">
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>의도 · 상황</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {availableIntents.map(tag => (
                <FilterChip key={tag} label={tag}
                  active={activeIntents.has(tag)}
                  onClick={() => toggle(activeIntents, tag, setActiveIntents)}
                  color={{ bg: t.card, on: t.accent, text: t.textSub, border: t.border }} />
              ))}
            </div>
          </div>
        )}

        {/* 태그 필터 칩 — 주재료 */}
        {availableMains.length > 0 && (
          <div className="mb-3">
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>주재료</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {availableMains.map(m => (
                <FilterChip key={m} label={`${MAIN_EMOJI[m] ?? ''} ${m}`.trim()}
                  active={activeMains.has(m)}
                  onClick={() => toggle(activeMains, m, setActiveMains)}
                  color={{ bg: t.card, on: t.accent, text: t.textSub, border: t.border }} />
              ))}
            </div>
          </div>
        )}

        {/* 활성 필터 해제 버튼 */}
        {hasAnyFilter && (activeIntents.size > 0 || activeMains.size > 0) && (
          <button onClick={() => { setActiveIntents(new Set()); setActiveMains(new Set()); }}
            className="inline-flex items-center gap-1 mb-3 px-2 py-1 rounded-md"
            style={{ fontSize: 11, color: t.textMuted, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            <X size={11} /> 필터 해제
          </button>
        )}

        {/* "지금 만들 수 있어요" — 주재료가 냉장고에 모두 있는 레시피 + 1개 부족 */}
        {!loading && recipes.length > 0 && (cookable.ready.length > 0 || cookable.oneMissing.length > 0) && (
          <CookableSection
            ready={cookable.ready}
            oneMissing={cookable.oneMissing}
            onPickRecipe={openDetail}
          />
        )}

        {/* "유통기한 임박 재료 레시피" — fridge D-2 이내 품목이 들어간 레시피 */}
        {!loading && urgentRecipes.length > 0 && (
          <UrgentRecipesSection hits={urgentRecipes} onPickRecipe={openDetail} />
        )}

        {/* "오늘 뭐먹지? 셔플" 배너 — 한 줄 컴팩트. 셔플된 카드는 아래 그리드에서 highlight 로 강조됨 */}
        {!loading && recipes.length > 0 && (
          <div className="mb-4 rounded-2xl flex items-center justify-between gap-3 px-3 py-2.5"
            style={{ backgroundColor: t.accentLight, border: `1px solid ${t.accent}33` }}>
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={16} color={t.accent} />
              <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>
                오늘 뭐먹지?
              </span>
              <span className="truncate hidden sm:inline" style={{ fontSize: 11, color: t.textSub }}>
                {hasAnyFilter ? '필터 안에서 랜덤 추천' : '저장한 레시피 중 랜덤 추천'}
              </span>
              {/* 셔플된 레시피 인라인 미리보기 — 작은 칩 형태로 (그리드 내 카드 강조와 중복 표시 방지) */}
              {shuffled && (
                <button onClick={() => openDetail(shuffled)}
                  className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2 py-1 rounded-full active:scale-95 transition-transform"
                  style={{ fontSize: 11, fontWeight: 700, color: t.accent, backgroundColor: t.card,
                    border: `1px solid ${t.accent}55`, maxWidth: 220 }}>
                  <span aria-hidden>🎯</span>
                  <span className="truncate">{shuffled.title}</span>
                </button>
              )}
            </div>
            <button onClick={handleShuffle}
              disabled={filtered.length === 0}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
              style={{
                fontSize: 12, fontWeight: 700,
                backgroundColor: filtered.length === 0 ? t.bgSub : t.accent,
                color: filtered.length === 0 ? t.textMuted : '#fff',
                cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
              }}>
              <Shuffle size={13} /> 셔플
            </button>
          </div>
        )}

        {/* "먼지 쌓인 레시피" 섹션 */}
        {!loading && dusty.length > 0 && (
          <section className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 14 }}>🕸️</span>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: t.textSub }}>먼지 쌓인 레시피</h2>
              <span style={{ fontSize: 11, color: t.textMuted }}>저장만 하고 안 해봤어요 👀</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {dusty.map(r => (
                <RecipeCard key={r.id} recipe={r} onClick={() => openDetail(r)} />
              ))}
            </div>
          </section>
        )}

        <h2 style={{ fontSize: 14, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>
          저장한 레시피 {hasAnyFilter && filtered.length !== recipes.length ? `(${filtered.length})` : ''}
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl" style={{ aspectRatio: '4 / 3.6', backgroundColor: t.bgSub }} />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p style={{ fontSize: 13, color: t.textSub }}>조건에 맞는 레시피가 없어요.</p>
            <button onClick={() => { setActiveIntents(new Set()); setActiveMains(new Set()); setSearch(''); }}
              className="mt-3 px-3 py-1.5 rounded-lg"
              style={{ fontSize: 12, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight }}>
              필터 모두 해제
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {filtered.map(r => (
              <RecipeCard key={r.id} recipe={r}
                onClick={() => openDetail(r)}
                highlight={shuffled?.id === r.id} />
            ))}
          </div>
        )}
      </div>

      {/* FAB — 모듈 탭바 + 글로벌 네비 위(safe-area) */}
      <button onClick={openAdd} aria-label="레시피 추가"
        className="recipe-mod-fab fixed right-4 z-40 flex items-center justify-center rounded-full active:scale-95 transition-transform"
        style={{ width: 56, height: 56, backgroundColor: t.accent, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.28)' }}>
        <Plus size={26} />
      </button>

      {detailId && (() => {
        // Realtime/refresh로 최신 객체를 항상 찾아 전달 (편집 직후 반영)
        const r = recipes.find(x => x.id === detailId);
        if (!r) return null;
        return (
          <RecipeDetail
            recipe={r}
            onClose={() => setDetailId(null)}
            onEdit={() => openEditFromDetail(r)}
          />
        );
      })()}

      {sheetOpen && (
        <RecipeFormSheet
          recipe={editing}
          onSave={handleSave}
          onDelete={editing ? (id) => setDeleteId(id) : undefined}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}

      {deleteId && (
        <ConfirmModal
          message="이 레시피를 삭제할까요?"
          description="재료·요리 순서도 함께 삭제됩니다."
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  );
}

// ── 냉장고 매칭 섹션들 ──────────────────────────────────────────────────

// 접기/펼치기 가능한 섹션 헤더 — 카드 카운트가 많으면 자리를 많이 차지하므로 사용자가 접을 수 있게.
// localStorage 로 상태 유지(탭 전환/새로고침에도). 모바일·PC 동일 동작.
function useCollapsed(key: string, defaultOpen: boolean): [boolean, () => void] {
  const storageKey = `recipe.section.${key}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const raw = window.localStorage.getItem(storageKey);
    return raw == null ? defaultOpen : raw === '1';
  });
  const toggle = () => setOpen(prev => {
    const next = !prev;
    try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch {}
    return next;
  });
  return [open, toggle];
}

function SectionHeader({ icon, color, title, hint, count, open, onToggle }: {
  icon: React.ReactNode; color: string; title: string; hint: string; count: number;
  open: boolean; onToggle: () => void;
}) {
  const { t } = useTheme();
  return (
    <button type="button" onClick={onToggle}
      className="w-full flex items-center gap-2 mb-2 px-1 py-1 rounded-lg active:scale-[0.99] transition-transform"
      aria-expanded={open}>
      {icon}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: t.textSub }}>{title}</h2>
      <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 700,
        backgroundColor: `${color}1A`, color, border: `1px solid ${color}55` }}>{count}</span>
      <span style={{ fontSize: 11, color: t.textMuted }}>{hint}</span>
      <span className="ml-auto flex items-center" style={{ color: t.textMuted }}>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </span>
    </button>
  );
}

function CookableSection({ ready, oneMissing, onPickRecipe }:
  { ready: RecipeMatchResult[]; oneMissing: RecipeMatchResult[]; onPickRecipe: (r: Recipe) => void }) {
  const { t } = useTheme();
  const items: Array<{ m: RecipeMatchResult; kind: MatchBadgeKind }> = [
    ...ready.map(m => ({ m, kind: 'ready' as const })),
    ...oneMissing.map(m => ({ m, kind: 'oneMissing' as const })),
  ];
  const [open, toggle] = useCollapsed('cookable', true);
  return (
    <section className="mb-5">
      <SectionHeader icon={<Check size={14} color={t.accent} />} color={t.accent}
        title="지금 만들 수 있어요" hint="냉장고 주재료 매칭" count={items.length}
        open={open} onToggle={toggle} />
      {open && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map(({ m, kind }) => {
            const badge: MatchBadge = kind === 'ready'
              ? { kind: 'ready', label: '✓ 재료 있음' }
              : { kind: 'oneMissing', label: `1개 부족: ${m.missingKeys[0]}` };
            return (
              <RecipeCard key={m.recipe.id} recipe={m.recipe}
                onClick={() => onPickRecipe(m.recipe)} matchBadge={badge} />
            );
          })}
        </div>
      )}
    </section>
  );
}

function UrgentRecipesSection({ hits, onPickRecipe }:
  { hits: UrgentRecipeHit[]; onPickRecipe: (r: Recipe) => void }) {
  const { t } = useTheme();
  const [open, toggle] = useCollapsed('urgent', true);
  return (
    <section className="mb-5">
      <SectionHeader icon={<AlertCircle size={14} color={t.danger} />} color={t.danger}
        title="유통기한 임박 재료 레시피" hint="D-2 이내 재료 활용" count={hits.length}
        open={open} onToggle={toggle} />
      {open && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {hits.map(h => {
            const top = h.urgentItems[0];
            const label = top.daysLeft === 0
              ? `D-day ${top.name}`
              : top.daysLeft > 0
                ? `D-${top.daysLeft} ${top.name}`
                : `D+${-top.daysLeft} ${top.name}`;
            return (
              <RecipeCard key={h.recipe.id} recipe={h.recipe}
                onClick={() => onPickRecipe(h.recipe)}
                matchBadge={{ kind: 'urgent', label }} />
            );
          })}
        </div>
      )}
    </section>
  );
}
