import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Plus, Clock, Star, Search, Shuffle, Sparkles, X, Youtube, Instagram, Link2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { Recipe } from '../../store';
import { RecipeFormSheet } from './RecipeFormSheet';
import ConfirmModal from '../ConfirmModal';
import { detectRecipeSourcePlatform, type RecipeSourcePlatform } from '../../../lib/recipeSource';
import { INTENT_TAG_PRESETS, MAIN_INGREDIENT_PRESETS } from './recipeTags';

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
function RecipeCard({ recipe, onClick, highlight }: { recipe: Recipe; onClick: () => void; highlight?: boolean }) {
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
  const openEdit = (r: Recipe) => { setEditing(r); setSheetOpen(true); };

  const handleSave = async (rec: Recipe) => {
    await db.recipes.upsert(rec);
    setSheetOpen(false);
    setEditing(null);
    refresh();
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await db.recipes.delete(deleteId);
    setDeleteId(null);
    setSheetOpen(false);
    setEditing(null);
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

        {/* "오늘 뭐먹지? 셔플" 배너 */}
        {!loading && recipes.length > 0 && (
          <div className="mb-4 rounded-2xl overflow-hidden"
            style={{ backgroundColor: t.accentLight, border: `1px solid ${t.accent}33` }}>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles size={16} color={t.accent} />
                <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>
                  오늘 뭐먹지?
                </span>
                <span className="truncate hidden sm:inline" style={{ fontSize: 11, color: t.textSub }}>
                  {hasAnyFilter ? '필터 안에서 랜덤 추천' : '저장한 레시피 중 랜덤 추천'}
                </span>
              </div>
              <button onClick={handleShuffle}
                disabled={filtered.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                style={{
                  fontSize: 12, fontWeight: 700,
                  backgroundColor: filtered.length === 0 ? t.bgSub : t.accent,
                  color: filtered.length === 0 ? t.textMuted : '#fff',
                  cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                }}>
                <Shuffle size={13} /> 셔플
              </button>
            </div>
            {shuffled && (
              <div className="px-3 pb-3">
                <div className="max-w-[260px]">
                  <RecipeCard recipe={shuffled} onClick={() => openEdit(shuffled)} highlight />
                </div>
              </div>
            )}
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
                <RecipeCard key={r.id} recipe={r} onClick={() => openEdit(r)} />
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
                onClick={() => openEdit(r)}
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
