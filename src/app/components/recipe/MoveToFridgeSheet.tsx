import React, { useState } from 'react';
import { Refrigerator, Snowflake, Package, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { FridgeCategory, ShoppingItem } from '../../store';

const CATEGORIES: { key: FridgeCategory; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: '냉장', icon: Refrigerator },
  { key: '냉동', icon: Snowflake },
  { key: '실온', icon: Package },
];

interface MoveToFridgeSheetProps {
  item: ShoppingItem;
  onConfirm: (category: FridgeCategory) => void;     // 부모가 fridge insert + shopping setChecked 호출
  onClose: () => void;
}

// 장보기 항목을 체크할 때 뜨는 미니 바텀시트.
// 보관 위치(냉장/냉동/실온)를 골라 냉장고로 옮긴다.
export function MoveToFridgeSheet({ item, onConfirm, onClose }: MoveToFridgeSheetProps) {
  const { t } = useTheme();
  const [category, setCategory] = useState<FridgeCategory>('냉장');
  const [submitting, setSubmitting] = useState(false);

  const handle = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm(category);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes moveFridgeUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.move-fridge-sheet{animation:moveFridgeUp .26s ease-out}}`}</style>
      <div className="move-fridge-sheet shadow-2xl w-full max-w-full rounded-t-2xl
          lg:w-[400px] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 lg:px-5 pt-4 pb-2">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>냉장고에 옮기기</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }} aria-label="취소">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 lg:px-5 pb-5"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          <p className="mb-3" style={{ fontSize: 13, color: t.textSub }}>
            <span style={{ fontWeight: 700, color: t.text }}>{item.name}</span>
            {' '}{item.quantity}{item.unit ?? ''}을(를) 어디에 보관할까요?
          </p>

          <div className="flex gap-1.5 mb-4">
            {CATEGORIES.map(({ key, icon: Icon }) => {
              const active = category === key;
              return (
                <button key={key} type="button" onClick={() => setCategory(key)}
                  className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                  style={{ fontSize: 13, fontWeight: active ? 700 : 500,
                    backgroundColor: active ? t.accent : t.bgSub,
                    color: active ? '#fff' : t.textSub,
                    border: `1px solid ${active ? t.accent : t.border}` }}>
                  <Icon size={20} color={active ? '#fff' : t.textSub} />
                  {key}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              취소
            </button>
            <button type="button" onClick={handle} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? '옮기는 중…' : '냉장고에 추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
