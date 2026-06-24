// 뷰티 케어 — 화장품 추가/수정 바텀시트 (Stage 5, 모바일).
//  · 시트 UI 관습은 HouseholdStockSheet 와 동일. 저장은 부모(useBeauty 액션)로만 — 폼만 담당.
//  · 수정 모드 원터치: 또 샀어요(repurchase·개봉일 오늘로 복제) / 다 씀 보관·복원(setActive) / 삭제.
//  · 사진 업로드/AI 버튼은 만들지 않는다(S6). photoUrl 이 이미 있으면 썸네일만.
import React, { useState } from 'react';
import { X, ChevronLeft, Trash2, RotateCcw, ExternalLink, Archive, ArchiveRestore } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { BeautyProduct } from '../../store';
import { categoryEmoji, productExpiry } from './BeautyShelf';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface Props {
  product: BeautyProduct | null;                 // null = 신규
  onSave: (item: BeautyProduct) => void;
  onRepurchase?: (product: BeautyProduct) => void;
  onSetActive?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function BeautyProductSheet({ product, onSave, onRepurchase, onSetActive, onDelete, onClose }: Props) {
  const { t } = useTheme();
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [openedAt, setOpenedAt] = useState(product?.openedAt ?? '');
  const [expiryMonths, setExpiryMonths] = useState<string>(product?.expiryMonths != null ? String(product.expiryMonths) : '');
  const [purchasePlace, setPurchasePlace] = useState(product?.purchasePlace ?? '');
  const [price, setPrice] = useState<string>(product?.price != null ? String(product.price) : '');
  const [link, setLink] = useState(product?.link ?? '');
  const [memo, setMemo] = useState(product?.memo ?? '');
  const [submitting, setSubmitting] = useState(false);

  const info = product ? productExpiry(product) : null;

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
      id: product?.id ?? newId(),
      name: name.trim(),
      brand: brand.trim() || null,
      category: category.trim() || null,
      photoUrl: product?.photoUrl ?? null,
      openedAt: openedAt || null,
      expiryMonths: expiryMonths.trim() ? Number(expiryMonths) : null,
      purchasePlace: purchasePlace.trim() || null,
      price: price.trim() ? Number(price) : null,
      link: link.trim() || null,
      memo: memo.trim() || null,
      isActive: product?.isActive ?? true,
      createdAt: product?.createdAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes bcProdUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.bc-prod-sheet{animation:bcProdUp .26s ease-out}}`}</style>
      <div className="bc-prod-sheet shadow-2xl overflow-y-auto w-full max-w-full rounded-t-2xl
          lg:w-[460px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="취소">
            <ChevronLeft size={22} />
          </button>
          <h2 className="flex-1 text-center lg:flex-none lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {isEdit ? '화장품 수정' : '화장품 추가'}
          </h2>
          <button type="submit" form="bc-prod-form" disabled={submitting} className="lg:hidden px-3 py-1.5 rounded-lg"
            style={{ fontSize: 14, fontWeight: 700, color: submitting ? t.textMuted : t.accent, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? '저장 중…' : '저장'}
          </button>
          <button type="button" onClick={onClose} className="hidden lg:block p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form id="bc-prod-form" onSubmit={handleSubmit}
          className="px-4 lg:px-5 pb-5 space-y-4"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* 썸네일 + 잔여 */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ width: 64, height: 64, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
              {product?.photoUrl
                ? <img src={product.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span aria-hidden style={{ fontSize: 30 }}>{categoryEmoji(category)}</span>}
            </div>
            <div className="min-w-0">
              {info ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: info.tier === 'fresh' ? t.success : t.danger }}>
                  {info.remaining <= 0 ? '사용기한 지남' : `사용기한까지 D-${info.remaining}`}
                </span>
              ) : (
                <span style={{ fontSize: 12.5, color: t.textMuted }}>개봉일·사용기한을 적으면 잔여를 알려드려요</span>
              )}
              {product && !product.isActive && (
                <span className="block" style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>다 쓴 보관 상태</span>
              )}
            </div>
          </div>

          {/* 이름 + 브랜드 */}
          <div>
            <label style={labelStyle}>이름 *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예: 수분크림" style={fieldStyle} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>브랜드</label>
              <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="예: 라네즈" style={fieldStyle} />
            </div>
            <div className="flex-1">
              <label style={labelStyle}>카테고리</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 스킨케어" style={fieldStyle} />
            </div>
          </div>

          {/* 개봉일 + 사용기한 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>개봉일</label>
              <input type="date" value={openedAt} onChange={e => setOpenedAt(e.target.value)} style={fieldStyle} />
            </div>
            <div className="w-32">
              <label style={labelStyle}>사용기한(개월)</label>
              <input type="number" inputMode="numeric" min={1} value={expiryMonths} onChange={e => setExpiryMonths(e.target.value)} placeholder="12" style={fieldStyle} />
            </div>
          </div>

          {/* 제품정보 — 다시 살 때 도움 */}
          <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>다시 살 때 도움되는 정보</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label style={labelStyle}>구매처</label>
                <input value={purchasePlace} onChange={e => setPurchasePlace(e.target.value)} placeholder="예: 올리브영" style={fieldStyle} />
              </div>
              <div className="flex-1">
                <label style={labelStyle}>가격</label>
                <input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder="원" style={fieldStyle} />
              </div>
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
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="발색/사용감 등"
                style={{ ...fieldStyle, resize: 'none' }} />
            </div>
          </div>

          {/* 수정 모드: 원터치 액션 */}
          {isEdit && (
            <div className="space-y-2">
              {onRepurchase && (
                <button type="button" onClick={() => onRepurchase(product!)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl"
                  style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
                  <RotateCcw size={16} /> 또 샀어요 (개봉일 오늘로 새로 등록)
                </button>
              )}
              <div className="flex items-center gap-2">
                {onSetActive && (
                  product.isActive ? (
                    <button type="button" onClick={() => onSetActive(product.id, false)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl"
                      style={{ fontSize: 13.5, fontWeight: 700, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                      <Archive size={15} /> 다 씀 보관
                    </button>
                  ) : (
                    <button type="button" onClick={() => onSetActive(product.id, true)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl"
                      style={{ fontSize: 13.5, fontWeight: 700, color: t.success, backgroundColor: `${t.success}1A`, border: `1px solid ${t.success}55` }}>
                      <ArchiveRestore size={15} /> 보유함으로 복원
                    </button>
                  )
                )}
                {onDelete && (
                  <button type="button" onClick={() => onDelete(product.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl"
                    style={{ fontSize: 13.5, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                    <Trash2 size={15} /> 삭제
                  </button>
                )}
              </div>
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
