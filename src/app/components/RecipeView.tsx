import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Plus, Clock, Star, Search } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { Recipe } from '../store';
import { RecipeFormSheet } from './recipe/RecipeFormSheet';
import ConfirmModal from './ConfirmModal';

// ── 레시피 카드 (PC·모바일 공용) ──
function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const { t } = useTheme();
  return (
    <button onClick={onClick}
      className="text-left rounded-2xl overflow-hidden transition-transform active:scale-[0.98] hover:-translate-y-0.5"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
      {/* 썸네일 / placeholder */}
      <div className="relative w-full" style={{ aspectRatio: '4 / 3', backgroundColor: t.bgSub }}>
        {recipe.thumbnailUrl ? (
          <img src={recipe.thumbnailUrl} alt="" className="w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat size={34} color={t.textMuted} />
          </div>
        )}
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

export function RecipeView() {
  const { t } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── 데이터 로드 + Realtime 동기화 ──
  const refresh = useCallback(() => {
    db.recipes.fetchAll().then(rs => { setRecipes(rs); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // 3개 테이블 모두 구독 — 자식 변경도 즉시 반영
  useRealtimeSync('recipes', refresh);
  useRealtimeSync('recipe_ingredients', refresh);
  useRealtimeSync('recipe_steps', refresh);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.ingredients.some(g => g.name.toLowerCase().includes(q)),
    );
  }, [recipes, search]);

  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  // Phase 1a: 카드 탭 → 수정 시트(CRUD 검증). 1b에서 상세 화면 진입으로 교체 예정.
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

  return (
    <>
      <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-5 lg:py-7"
          style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>

          {/* 헤더 */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <h1 className="flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, color: t.text }}>
              <ChefHat size={24} color={t.accent} />
              레시피
            </h1>
          </div>

          {/* 검색 */}
          <div className="relative mb-4">
            <Search size={16} color={t.textMuted}
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="레시피·재료 검색"
              className="w-full rounded-xl outline-none"
              style={{ padding: '9px 11px 9px 34px', fontSize: 14, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text }} />
          </div>

          {/* 저장한 레시피 */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>저장한 레시피</h2>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl" style={{ aspectRatio: '4 / 3.6', backgroundColor: t.bgSub }} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState onAdd={openAdd} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {visible.map(r => (
                <RecipeCard key={r.id} recipe={r} onClick={() => openEdit(r)} />
              ))}
            </div>
          )}
        </div>

        {/* FAB — 하단 탭바 위(safe-area). lg 에서는 탭바가 없어 동일 위치로 충분 */}
        <button onClick={openAdd} aria-label="레시피 추가"
          className="fixed right-4 z-30 flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', width: 56, height: 56,
            backgroundColor: t.accent, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.28)' }}>
          <Plus size={26} />
        </button>
      </div>

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
