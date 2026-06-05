import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Refrigerator, Snowflake, Package, Minus } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { FridgeItem, FridgeCategory } from '../../store';
import { FridgeItemSheet } from './FridgeItemSheet';
import ConfirmModal from '../ConfirmModal';

const CATEGORY_ORDER: FridgeCategory[] = ['냉장', '냉동', '실온'];
const CATEGORY_ICON: Record<FridgeCategory, React.ComponentType<{ size?: number; color?: string }>> = {
  냉장: Refrigerator, 냉동: Snowflake, 실온: Package,
};

// yyyy-MM-dd → 오늘 기준 남은 일수(로컬 자정 기준). null이면 유통기한 없음.
function daysUntil(expiry?: string | null): number | null {
  if (!expiry) return null;
  const [y, m, d] = expiry.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - todayMid) / 86400000);
}

function dDayLabel(days: number): string {
  if (days === 0) return 'D-day';
  if (days > 0) return `D-${days}`;
  return `D+${-days}`;
}

// 품목 행
function FridgeRow({ item, onEdit, onQty }: {
  item: FridgeItem;
  onEdit: () => void;
  onQty: (delta: number) => void;
}) {
  const { t } = useTheme();
  const days = daysUntil(item.expiryDate);
  const urgent = days != null && days <= 2;     // D-2 이내(만료 포함) 강조
  const empty = item.quantity <= 0;

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        backgroundColor: urgent ? t.dangerLight : t.card,
        border: `1px solid ${urgent ? t.danger : t.border}`,
        opacity: empty ? 0.6 : 1,
      }}>
      {/* 이름 + D-day (탭 → 수정) */}
      <button onClick={onEdit} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: t.text,
            textDecoration: empty ? 'line-through' : 'none' }}>{item.name}</span>
          {days != null && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md"
              style={{ fontSize: 11, fontWeight: 700,
                backgroundColor: urgent ? t.danger : t.bgSub,
                color: urgent ? '#fff' : t.textSub }}>
              {dDayLabel(days)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: empty ? t.danger : t.textMuted, marginTop: 2 }}>
          {empty ? '다 떨어짐' : `${item.quantity}${item.unit ?? ''}`}
        </div>
      </button>

      {/* 수량 스테퍼 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => onQty(-1)} className="rounded-lg flex items-center justify-center active:scale-95"
          style={{ width: 32, height: 32, border: `1px solid ${t.border}`, backgroundColor: t.bg, color: t.text }}
          aria-label="수량 감소">
          <Minus size={15} />
        </button>
        <span style={{ minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: 600, color: t.text }}>{item.quantity}</span>
        <button onClick={() => onQty(1)} className="rounded-lg flex items-center justify-center active:scale-95"
          style={{ width: 32, height: 32, border: `1px solid ${t.border}`, backgroundColor: t.bg, color: t.text }}
          aria-label="수량 증가">
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

// 요약 카드
function SummaryCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <div className="flex-1 rounded-xl px-3 py-2.5 text-center"
      style={{ backgroundColor: t.card, border: `1px solid ${danger && value > 0 ? t.danger : t.border}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: danger && value > 0 ? t.danger : t.text }}>{value}</div>
      <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function FridgeTab() {
  const { t } = useTheme();
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FridgeItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    db.fridgeItems.fetchAll().then(rs => { setItems(rs); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('fridge_items', refresh);

  // 요약
  const summary = useMemo(() => {
    let near = 0, out = 0;
    for (const it of items) {
      const d = daysUntil(it.expiryDate);
      if (d != null && d <= 2) near++;
      if (it.quantity <= 0) out++;
    }
    return { total: items.length, near, out };
  }, [items]);

  // 카테고리별 그룹 + 유통기한 빠른 순(없으면 뒤로)
  const grouped = useMemo(() => {
    const byCat: Record<FridgeCategory, FridgeItem[]> = { 냉장: [], 냉동: [], 실온: [] };
    for (const it of items) (byCat[it.category] ?? byCat['냉장']).push(it);
    for (const cat of CATEGORY_ORDER) {
      byCat[cat].sort((a, b) => {
        const da = daysUntil(a.expiryDate);
        const dbb = daysUntil(b.expiryDate);
        if (da == null && dbb == null) return 0;
        if (da == null) return 1;
        if (dbb == null) return -1;
        return da - dbb;
      });
    }
    return byCat;
  }, [items]);

  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (it: FridgeItem) => { setEditing(it); setSheetOpen(true); };

  const handleQty = (it: FridgeItem, delta: number) => {
    const next = Math.max(0, Math.round((it.quantity + delta) * 10) / 10);
    setItems(prev => prev.map(p => (p.id === it.id ? { ...p, quantity: next } : p))); // optimistic
    db.fridgeItems.updateQuantity(it.id, next);
  };
  const handleSave = async (item: FridgeItem) => {
    await db.fridgeItems.upsert(item);
    setSheetOpen(false); setEditing(null); refresh();
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await db.fridgeItems.delete(deleteId);
    setDeleteId(null); setSheetOpen(false); setEditing(null); refresh();
  };

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-4 lg:py-6">
        {/* 요약 */}
        <div className="flex gap-2 mb-5">
          <SummaryCard label="전체 품목" value={summary.total} />
          <SummaryCard label="임박 (D-2 이내)" value={summary.near} danger />
          <SummaryCard label="다 떨어짐" value={summary.out} danger />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl" style={{ height: 56, backgroundColor: t.bgSub }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="rounded-full flex items-center justify-center mb-4"
              style={{ width: 72, height: 72, backgroundColor: t.accentLight }}>
              <Refrigerator size={32} color={t.accent} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>냉장고가 비어 있어요</p>
            <p style={{ fontSize: 13, color: t.textSub, marginTop: 6 }}>+ 버튼으로 보관 중인 식재료를 추가해 보세요</p>
            <button onClick={openAdd} className="mt-5 flex items-center gap-1.5 px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
              <Plus size={16} /> 품목 추가
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {CATEGORY_ORDER.map(cat => {
              const list = grouped[cat];
              if (list.length === 0) return null;
              const Icon = CATEGORY_ICON[cat];
              return (
                <section key={cat}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={15} color={t.textSub} />
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textSub }}>{cat}</h3>
                    <span style={{ fontSize: 12, color: t.textMuted }}>{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map(it => (
                      <FridgeRow key={it.id} item={it} onEdit={() => openEdit(it)} onQty={(d) => handleQty(it, d)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={openAdd} aria-label="냉장고 품목 추가"
        className="recipe-mod-fab fixed right-4 z-40 flex items-center justify-center rounded-full active:scale-95 transition-transform"
        style={{ width: 56, height: 56, backgroundColor: t.accent, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.28)' }}>
        <Plus size={26} />
      </button>

      {sheetOpen && (
        <FridgeItemSheet
          item={editing}
          onSave={handleSave}
          onDelete={editing ? (id) => setDeleteId(id) : undefined}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
      {deleteId && (
        <ConfirmModal
          message="이 품목을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  );
}
