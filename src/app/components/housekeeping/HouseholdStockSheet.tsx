// 살림 — 생필품 재고 추가/수정 바텀시트 (Stage 4, 모바일).
//  · FridgeItemSheet 의 시트 UI 관습(바텀시트/PC 모달, 헤더, 필드 스타일)을 그대로 따른다.
//  · 데이터 저장은 부모(useHousekeeping 훅 액션)를 통해서만 — 여기선 폼만.
//  · 사진 업로드/AI 버튼은 만들지 않는다(S6). photoUrl 이 이미 있으면 썸네일만 보여줌.
import React, { useState } from 'react';
import { X, ChevronLeft, Trash2, RotateCcw, ExternalLink } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { HouseholdItem } from '../../store';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface Props {
  item: HouseholdItem | null;             // null = 신규 추가
  onSave: (item: HouseholdItem) => void;
  onRefill?: (id: string) => void;        // 재구매 완료(수량 다시 채움) — 수정 모드만
  onDelete?: (id: string) => void;        // 삭제 — 수정 모드만
  onClose: () => void;
}

export function HouseholdStockSheet({ item, onSave, onRefill, onDelete, onClose }: Props) {
  const { t } = useTheme();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [quantity, setQuantity] = useState<number>(item?.quantity ?? 1);
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [thresholdQty, setThresholdQty] = useState<number>(item?.thresholdQty ?? 1);
  const [brand, setBrand] = useState(item?.brand ?? '');
  const [purchasePlace, setPurchasePlace] = useState(item?.purchasePlace ?? '');
  const [price, setPrice] = useState<string>(item?.price != null ? String(item.price) : '');
  const [link, setLink] = useState(item?.link ?? '');
  const [memo, setMemo] = useState(item?.memo ?? '');
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
      category: category.trim() || null,
      quantity: quantity >= 0 ? quantity : 0,
      unit: unit.trim() || null,
      thresholdQty: thresholdQty >= 0 ? thresholdQty : 1,
      brand: brand.trim() || null,
      purchasePlace: purchasePlace.trim() || null,
      price: price.trim() ? Number(price) : null,
      link: link.trim() || null,
      memo: memo.trim() || null,
      photoUrl: item?.photoUrl ?? null,
      createdAt: item?.createdAt,
    });
  };

  const Stepper = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(0, Math.round((value - 1) * 10) / 10))}
        className="rounded-lg flex items-center justify-center"
        style={{ width: 38, height: 38, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 18 }}>−</button>
      <input type="number" inputMode="decimal" min={0} step="1" value={value}
        onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={{ ...fieldStyle, width: 64, textAlign: 'center', padding: '8px 4px' }} />
      <button type="button" onClick={() => onChange(Math.round((value + 1) * 10) / 10)}
        className="rounded-lg flex items-center justify-center"
        style={{ width: 38, height: 38, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 18 }}>+</button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes hkSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.hk-stock-sheet{animation:hkSheetUp .26s ease-out}}`}</style>
      <div className="hk-stock-sheet shadow-2xl overflow-y-auto w-full max-w-full rounded-t-2xl
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
            {isEdit ? '생필품 수정' : '생필품 추가'}
          </h2>
          <button type="submit" form="hk-stock-form" disabled={submitting} className="lg:hidden px-3 py-1.5 rounded-lg"
            style={{ fontSize: 14, fontWeight: 700, color: submitting ? t.textMuted : t.accent, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? '저장 중…' : '저장'}
          </button>
          <button type="button" onClick={onClose} className="hidden lg:block p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form id="hk-stock-form" onSubmit={handleSubmit}
          className="px-4 lg:px-5 pb-5 space-y-4"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* 사진 썸네일(있을 때만) */}
          {item?.photoUrl && (
            <img src={item.photoUrl} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12 }} />
          )}

          {/* 이름 */}
          <div>
            <label style={labelStyle}>이름 *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예: 화장지" style={fieldStyle} />
          </div>

          {/* 카테고리 + 단위 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>카테고리</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 욕실, 주방" style={fieldStyle} />
            </div>
            <div className="w-28">
              <label style={labelStyle}>단위</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="개, 롤, 통" style={fieldStyle} />
            </div>
          </div>

          {/* 수량 + 임계수량 */}
          <div className="flex gap-3 flex-wrap">
            <div>
              <label style={labelStyle}>현재 수량</label>
              <Stepper value={quantity} onChange={setQuantity} />
            </div>
            <div>
              <label style={labelStyle}>곧 떨어짐 기준</label>
              <Stepper value={thresholdQty} onChange={setThresholdQty} />
            </div>
          </div>

          {/* 제품정보 — 다시 살 때 도움 */}
          <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>다시 살 때 도움되는 정보</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label style={labelStyle}>브랜드</label>
                <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="예: 크리넥스" style={fieldStyle} />
              </div>
              <div className="flex-1">
                <label style={labelStyle}>구매처</label>
                <input value={purchasePlace} onChange={e => setPurchasePlace(e.target.value)} placeholder="예: 쿠팡" style={fieldStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>가격</label>
              <input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder="원" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>링크</label>
              <div className="flex gap-2">
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://" style={fieldStyle} />
                {link.trim() && (
                  <a href={link} target="_blank" rel="noreferrer"
                    className="flex-shrink-0 rounded-lg flex items-center justify-center"
                    style={{ width: 38, height: 38, backgroundColor: t.accentLight, color: t.accent, border: `1px solid ${t.border}` }}
                    aria-label="링크 열기">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label style={labelStyle}>메모</label>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="용량/특이사항 등"
                style={{ ...fieldStyle, resize: 'none' }} />
            </div>
          </div>

          {/* 수정 모드: 재구매 완료 / 삭제 */}
          {isEdit && (
            <div className="flex items-center gap-2">
              {onRefill && (
                <button type="button" onClick={() => onRefill(item!.id)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl"
                  style={{ fontSize: 14, fontWeight: 700, color: t.success, backgroundColor: `${t.success}1A`, border: `1px solid ${t.success}55` }}>
                  <RotateCcw size={16} /> 다시 채움
                </button>
              )}
              {onDelete && (
                <button type="button" onClick={() => onDelete(item!.id)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl"
                  style={{ fontSize: 14, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                  <Trash2 size={16} /> 삭제
                </button>
              )}
            </div>
          )}

          {/* PC 저장 */}
          <div className="hidden lg:flex items-center gap-2 pt-1">
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>취소</button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
