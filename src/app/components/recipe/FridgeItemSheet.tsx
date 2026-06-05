import React, { useState } from 'react';
import { X, ChevronLeft, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { FridgeItem, FridgeCategory } from '../../store';

const CATEGORIES: FridgeCategory[] = ['냉장', '냉동', '실온'];

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface FridgeItemSheetProps {
  item: FridgeItem | null;        // null = 신규 추가
  onSave: (item: FridgeItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function FridgeItemSheet({ item, onSave, onDelete, onClose }: FridgeItemSheetProps) {
  const { t } = useTheme();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<FridgeCategory>(item?.category ?? '냉장');
  const [quantity, setQuantity] = useState<number>(item?.quantity ?? 1);
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [expiryDate, setExpiryDate] = useState(item?.expiryDate ?? '');
  const [submitting, setSubmitting] = useState(false);

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 10, padding: '9px 11px', fontSize: 14,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    onSave({
      id: item?.id ?? newId(),
      name: name.trim(),
      category,
      quantity: quantity >= 0 ? quantity : 0,
      unit: unit.trim() || null,
      expiryDate: expiryDate || null,
      createdAt: item?.createdAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes fridgeSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.fridge-item-sheet{animation:fridgeSheetUp .26s ease-out}}`}</style>
      <div className="fridge-item-sheet shadow-2xl overflow-y-auto w-full max-w-full rounded-t-2xl
          lg:w-[440px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="취소">
            <ChevronLeft size={22} />
          </button>
          <h2 className="flex-1 text-center lg:flex-none lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {isEdit ? '냉장고 품목 수정' : '냉장고 품목 추가'}
          </h2>
          <button type="submit" form="fridge-item-form" disabled={submitting} className="lg:hidden px-3 py-1.5 rounded-lg" style={{ fontSize: 14, fontWeight: 700, color: submitting ? t.textMuted : t.accent, opacity: submitting ? 0.5 : 1 }}>{submitting ? '저장 중…' : '저장'}</button>
          <button type="button" onClick={onClose} className="hidden lg:block p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form id="fridge-item-form" onSubmit={handleSubmit}
          className="px-4 lg:px-5 pb-5 space-y-4"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* 이름 */}
          <div>
            <label style={labelStyle}>이름 *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예: 계란" style={fieldStyle} />
          </div>

          {/* 카테고리 */}
          <div>
            <label style={labelStyle}>보관 위치</label>
            <div className="flex gap-1.5">
              {CATEGORIES.map(c => {
                const active = category === c;
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className="flex-1 rounded-xl transition-all"
                    style={{ minHeight: 40, fontSize: 14, fontWeight: active ? 700 : 400,
                      backgroundColor: active ? t.accent : t.bgSub, color: active ? '#fff' : t.textSub,
                      border: `1px solid ${active ? t.accent : t.border}` }}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 수량 + 단위 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>수량</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQuantity(v => Math.max(0, Math.round((v - 1) * 10) / 10))}
                  className="rounded-lg flex items-center justify-center"
                  style={{ width: 38, height: 38, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 18 }}>−</button>
                <input type="number" inputMode="decimal" min={0} step="1" value={quantity}
                  onChange={e => setQuantity(Math.max(0, Number(e.target.value) || 0))}
                  style={{ ...fieldStyle, width: 64, textAlign: 'center', padding: '8px 4px' }} />
                <button type="button" onClick={() => setQuantity(v => Math.round((v + 1) * 10) / 10)}
                  className="rounded-lg flex items-center justify-center"
                  style={{ width: 38, height: 38, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 18 }}>+</button>
              </div>
            </div>
            <div className="w-28">
              <label style={labelStyle}>단위</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="개, g, ml" style={fieldStyle} />
            </div>
          </div>

          {/* 유통기한 */}
          <div>
            <label style={labelStyle}>유통기한 (선택)</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={fieldStyle} />
          </div>

          {/* PC 저장 / 삭제 */}
          <div className="flex items-center gap-2 pt-1">
            {isEdit && onDelete && (
              <button type="button" onClick={() => onDelete(item!.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl"
                style={{ fontSize: 14, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                <Trash2 size={16} /> 삭제
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="hidden lg:block px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>취소</button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: submitting ? 0.6 : 1 }}>{submitting ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
