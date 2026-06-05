import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ShoppingCart, Check, Trash2, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { ShoppingItem, FridgeCategory, FridgeItem } from '../../store';
import { ShoppingItemSheet } from './ShoppingItemSheet';
import { MoveToFridgeSheet } from './MoveToFridgeSheet';
import ConfirmModal from '../ConfirmModal';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 행
function ShoppingRow({ item, onCheck, onUncheck, onEdit, selectMode, selected, onToggleSelect }: {
  item: ShoppingItem;
  onCheck: () => void;
  onUncheck: () => void;
  onEdit: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useTheme();
  const checked = item.isChecked;

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        backgroundColor: selectMode && selected ? t.accentLight : t.card,
        border: `1px solid ${selectMode && selected ? t.accent : t.border}`,
        opacity: checked && !(selectMode && selected) ? 0.55 : 1,
      }}>
      {/* 좌측: 선택 모드면 선택 체크, 아니면 완료 체크 */}
      {selectMode ? (
        <button onClick={onToggleSelect} aria-label={selected ? '선택 해제' : '선택'}
          className="flex-shrink-0 rounded-full flex items-center justify-center"
          style={{ width: 26, height: 26,
            backgroundColor: selected ? t.accent : 'transparent',
            border: `2px solid ${selected ? t.accent : t.border}` }}>
          {selected && <Check size={14} color="#fff" />}
        </button>
      ) : (
        <button onClick={checked ? onUncheck : onCheck}
          aria-label={checked ? '완료 해제' : '구매 완료 — 냉장고로 옮기기'}
          className="flex-shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ width: 26, height: 26,
            backgroundColor: checked ? t.accent : 'transparent',
            border: `2px solid ${checked ? t.accent : t.border}` }}>
          {checked && <Check size={14} color="#fff" />}
        </button>
      )}

      {/* 본문 (탭 → 수정) */}
      <button onClick={selectMode ? onToggleSelect : onEdit} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: t.text,
            textDecoration: checked ? 'line-through' : 'none' }}>{item.name}</span>
          {item.sourceLabel && (
            <span className="px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ fontSize: 10, fontWeight: 600,
                backgroundColor: t.bgSub, color: t.textSub, border: `1px solid ${t.border}` }}>
              {item.sourceLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
          {item.quantity}{item.unit ?? ''}
        </div>
      </button>
    </div>
  );
}

export function ShoppingTab() {
  const { t } = useTheme();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<ShoppingItem | null>(null);

  // 다중 선택 삭제
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // 토스트
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  const refresh = useCallback(() => {
    db.shoppingItems.fetchAll().then(rs => { setItems(rs); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('shopping_items', refresh);

  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (it: ShoppingItem) => { setEditing(it); setSheetOpen(true); };

  const handleSave = async (item: ShoppingItem) => {
    const wasEdit = !!editing;
    await db.shoppingItems.upsert(item);
    setSheetOpen(false); setEditing(null); refresh();
    notify(wasEdit ? '수정했어요' : '저장했어요');
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await db.shoppingItems.delete(deleteId);
    setDeleteId(null); setSheetOpen(false); setEditing(null); refresh();
    notify('삭제했어요');
  };

  // 체크: 미니 시트로 카테고리 선택 → 냉장고 추가 + shopping 체크 처리
  const handleCheck = (item: ShoppingItem) => setMoveTarget(item);
  const handleMoveConfirm = async (category: FridgeCategory) => {
    if (!moveTarget) return;
    const fridgeItem: FridgeItem = {
      id: newId(),
      name: moveTarget.name,
      category,
      quantity: moveTarget.quantity,
      unit: moveTarget.unit ?? null,
      expiryDate: null,
    };
    await db.fridgeItems.insertMany([fridgeItem]);
    await db.shoppingItems.setChecked(moveTarget.id, true);
    setMoveTarget(null);
    refresh();
    notify(`${moveTarget.name} → 냉장고로 옮겼어요`);
  };
  const handleUncheck = async (item: ShoppingItem) => {
    // 낙관적 + DB. 냉장고 항목은 별개로 두고 자동 삭제하지 않음(중복 추가는 사용자 책임)
    setItems(prev => prev.map(p => (p.id === item.id ? { ...p, isChecked: false } : p)));
    await db.shoppingItems.setChecked(item.id, false);
    refresh();
  };

  // ── 다중 선택 ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map(i => i.id)));
  };
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setItems(prev => prev.filter(p => !selectedIds.has(p.id))); // optimistic
    await db.shoppingItems.deleteMany(ids);
    setBulkConfirm(false);
    exitSelectMode();
    refresh();
    notify(`${ids.length}개 삭제했어요`);
  };

  // 분류: 미체크 / 완료
  const pending = items.filter(i => !i.isChecked);
  const done = items.filter(i => i.isChecked);

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-4 lg:py-6">
        {/* 선택/액션 바 */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between mb-3" style={{ minHeight: 34 }}>
            {selectMode ? (
              <>
                <button onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{ fontSize: 13, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <span className="rounded-full flex items-center justify-center"
                    style={{ width: 18, height: 18, backgroundColor: allSelected ? t.accent : 'transparent', border: `2px solid ${allSelected ? t.accent : t.border}` }}>
                    {allSelected && <Check size={11} color="#fff" />}
                  </span>
                  전체 선택
                </button>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13, color: t.textSub }}>{selectedIds.size}개 선택</span>
                  <button onClick={() => selectedIds.size > 0 && setBulkConfirm(true)} disabled={selectedIds.size === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                    style={{ fontSize: 13, fontWeight: 700,
                      color: selectedIds.size > 0 ? '#fff' : t.textMuted,
                      backgroundColor: selectedIds.size > 0 ? t.danger : t.bgSub,
                      opacity: selectedIds.size > 0 ? 1 : 0.6 }}>
                    <Trash2 size={14} /> 삭제
                  </button>
                  <button onClick={exitSelectMode}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                    style={{ fontSize: 13, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                    <X size={14} /> 취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 12, color: t.textMuted }}>체크하면 냉장고로 옮겨요</span>
                <button onClick={() => setSelectMode(true)}
                  className="px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 13, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  선택
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl" style={{ height: 54, backgroundColor: t.bgSub }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="rounded-full flex items-center justify-center mb-4"
              style={{ width: 72, height: 72, backgroundColor: t.accentLight }}>
              <ShoppingCart size={32} color={t.accent} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>장보기 목록이 비어 있어요</p>
            <p style={{ fontSize: 13, color: t.textSub, marginTop: 6 }}>+ 버튼으로 살 것을 추가해 보세요</p>
            <button onClick={openAdd} className="mt-5 flex items-center gap-1.5 px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
              <Plus size={16} /> 항목 추가
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 살 것 */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textSub }}>살 것</h3>
                <span style={{ fontSize: 12, color: t.textMuted }}>{pending.length}</span>
              </div>
              {pending.length === 0 ? (
                <p style={{ fontSize: 13, color: t.textMuted, padding: '8px 4px' }}>
                  모두 다 샀어요! 👏
                </p>
              ) : (
                <div className="space-y-2">
                  {pending.map(it => (
                    <ShoppingRow key={it.id} item={it}
                      onCheck={() => handleCheck(it)} onUncheck={() => handleUncheck(it)}
                      onEdit={() => openEdit(it)}
                      selectMode={selectMode} selected={selectedIds.has(it.id)} onToggleSelect={() => toggleSelect(it.id)} />
                  ))}
                </div>
              )}
            </section>

            {/* 완료 */}
            {done.length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textSub }}>완료</h3>
                  <span style={{ fontSize: 12, color: t.textMuted }}>{done.length}</span>
                </div>
                <div className="space-y-2">
                  {done.map(it => (
                    <ShoppingRow key={it.id} item={it}
                      onCheck={() => handleCheck(it)} onUncheck={() => handleUncheck(it)}
                      onEdit={() => openEdit(it)}
                      selectMode={selectMode} selected={selectedIds.has(it.id)} onToggleSelect={() => toggleSelect(it.id)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* FAB (선택 모드에서는 숨김) */}
      {!selectMode && (
        <button onClick={openAdd} aria-label="장보기 항목 추가"
          className="recipe-mod-fab fixed right-4 z-40 flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ width: 56, height: 56, backgroundColor: t.accent, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.28)' }}>
          <Plus size={26} />
        </button>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="recipe-mod-fab fixed left-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg pointer-events-none"
          style={{ transform: 'translateX(-50%)', backgroundColor: t.text, color: t.bg, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {sheetOpen && (
        <ShoppingItemSheet
          item={editing}
          onSave={handleSave}
          onDelete={editing ? (id) => setDeleteId(id) : undefined}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
      {moveTarget && (
        <MoveToFridgeSheet
          item={moveTarget}
          onConfirm={handleMoveConfirm}
          onClose={() => setMoveTarget(null)}
        />
      )}
      {deleteId && (
        <ConfirmModal
          message="이 항목을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
      {bulkConfirm && (
        <ConfirmModal
          message={`선택한 ${selectedIds.size}개 항목을 삭제할까요?`}
          confirmText="삭제"
          confirmDanger
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkConfirm(false)}
        />
      )}
    </>
  );
}
