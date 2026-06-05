import React, { useState } from 'react';
import { X, ChevronLeft, Trash2, Plus } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { FridgeItem, FridgeCategory } from '../../store';

const CATEGORIES: FridgeCategory[] = ['냉장', '냉동', '실온'];

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 확인 화면 한 행 (저장 전 수정 가능)
interface DraftRow {
  key: string;             // 로컬 식별자
  name: string;
  quantity: number;
  unit: string;
  category: FridgeCategory;
  expiryDate: string;       // yyyy-MM-dd 또는 ''
}

interface FridgeQuickAddSheetProps {
  initialDrafts: DraftRow[];   // 파싱 결과에서 만들어진 초기 행들
  onSave: (items: FridgeItem[]) => void;
  onClose: () => void;
}

// 빠른 입력 파싱 결과를 저장 전 다듬는 확인 시트.
// 이름·수량·카테고리·유통기한 모두 수정 가능, 빈 이름 행은 저장 시 제외.
export function FridgeQuickAddSheet({ initialDrafts, onSave, onClose }: FridgeQuickAddSheetProps) {
  const { t } = useTheme();
  const [rows, setRows] = useState<DraftRow[]>(initialDrafts);

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));
  const addRow = () => setRows(prev => [...prev, blankRow()]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items: FridgeItem[] = rows
      .filter(r => r.name.trim())
      .map(r => ({
        id: newId(),
        name: r.name.trim(),
        category: r.category,
        quantity: Number.isFinite(r.quantity) && r.quantity >= 0 ? r.quantity : 1,
        unit: r.unit.trim() || null,
        expiryDate: r.expiryDate || null,
      }));
    onSave(items);
  };

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: t.textMuted, marginBottom: 3 };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 8, padding: '7px 9px', fontSize: 13,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes quickAddSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.quick-add-sheet{animation:quickAddSheetUp .26s ease-out}}`}</style>
      <div className="quick-add-sheet shadow-2xl overflow-y-auto w-full max-w-full h-[100dvh] rounded-t-2xl
          lg:w-[560px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="취소">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 text-center lg:text-left">
            <h2 style={{ fontSize: 17, fontWeight: 700, color: t.text }}>입력 내용 확인</h2>
            <p style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>저장 전에 수정할 수 있어요</p>
          </div>
          <button type="submit" form="fridge-quick-form"
            className="lg:hidden px-3 py-1.5 rounded-lg"
            style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>저장</button>
          <button type="button" onClick={onClose} className="hidden lg:block p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form id="fridge-quick-form" onSubmit={handleSubmit}
          className="px-4 lg:px-5 pb-5"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          <div className="space-y-3">
            {rows.length === 0 && (
              <p className="text-center py-6" style={{ fontSize: 13, color: t.textSub }}>
                추가할 항목이 없어요. 아래 + 로 직접 추가할 수 있어요.
              </p>
            )}
            {rows.map((r) => (
              <div key={r.key} className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                {/* 1행: 이름 + 삭제 */}
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <label style={labelStyle}>이름</label>
                    <input value={r.name} onChange={e => updateRow(r.key, { name: e.target.value })}
                      placeholder="예: 계란" style={fieldStyle} />
                  </div>
                  <button type="button" onClick={() => removeRow(r.key)}
                    className="flex-shrink-0 p-1.5 rounded-lg"
                    style={{ color: t.danger, marginTop: 16 }}
                    aria-label="행 삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
                {/* 2행: 수량 / 단위 / 카테고리 */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label style={labelStyle}>수량</label>
                    <input type="number" inputMode="decimal" min={0} step="1" value={r.quantity}
                      onChange={e => updateRow(r.key, { quantity: Number(e.target.value) || 0 })}
                      style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>단위</label>
                    <input value={r.unit} onChange={e => updateRow(r.key, { unit: e.target.value })}
                      placeholder="개·g" style={fieldStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>위치</label>
                    <select value={r.category}
                      onChange={e => updateRow(r.key, { category: e.target.value as FridgeCategory })}
                      style={fieldStyle}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                {/* 3행: 유통기한 */}
                <div>
                  <label style={labelStyle}>유통기한 (선택)</label>
                  <input type="date" value={r.expiryDate}
                    onChange={e => updateRow(r.key, { expiryDate: e.target.value })}
                    style={fieldStyle} />
                </div>
              </div>
            ))}
          </div>

          {/* 행 추가 */}
          <button type="button" onClick={addRow}
            className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl w-full justify-center"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.bgSub, color: t.textSub, border: `1px solid ${t.border}` }}>
            <Plus size={15} /> 직접 추가
          </button>

          {/* PC 저장/취소 */}
          <div className="hidden lg:flex items-center justify-end gap-2 mt-5">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              취소
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
              모두 저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function blankRow(): DraftRow {
  return {
    key: newId(),
    name: '',
    quantity: 1,
    unit: '',
    category: '냉장',
    expiryDate: '',
  };
}

// 파싱 결과 → 초기 draft 행
export function draftsFromParsed(
  parsed: Array<{ name: string; quantity: number; unit: string | null }>,
): DraftRow[] {
  return parsed.map(p => ({
    key: newId(),
    name: p.name,
    quantity: p.quantity,
    unit: p.unit ?? '',
    category: '냉장',
    expiryDate: '',
  }));
}
