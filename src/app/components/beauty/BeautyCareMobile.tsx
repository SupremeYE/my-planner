// 뷰티 케어 — 모바일 화면 (Stage 5). 셀프케어 게이지 + 스페셜케어 + 화장품 보유함 + 추가 FAB.
//  · 데이터·파생값·액션은 전부 useBeauty(S2) 훅에서 받아 호출만 한다(로직 재구현 X).
//  · 전체 보기는 새 라우트 없이 내부 상태(shelfFull) 토글 오버레이로 처리.
//  · 전역 FloatingAddFab(빠른 캡처, bottom-20)이 이미 떠 있어, 뷰티 추가 FAB 는 살림(S4) 관습대로
//    그 위(bottom 142px)로 띄운다. (Layout 미수정)
//  · PC(hidden lg:block)는 S7에서 — 이 컴포넌트는 lg:hidden 래퍼 안에서만 렌더된다.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from '../../ThemeContext';
import ConfirmModal from '../ConfirmModal';
import { useBeauty, type CareDerived } from './useBeauty';
import { SelfCareGauge } from './SelfCareGauge';
import { SpecialCareSection } from './SpecialCareSection';
import { SpecialCareSheet } from './SpecialCareSheet';
import { BeautyShelfPreview, BeautyShelfFull } from './BeautyShelf';
import { BeautyProductSheet } from './BeautyProductSheet';
import { BeautyAddSheet } from './BeautyAddSheet';
import { PhotoCaptureSheet } from '../capture/PhotoCaptureSheet';
import type { ExtractedItem } from '../capture/useVisionExtract';
import type { BeautyProduct, BeautySpecialCare } from '../../store';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function SectionTitle({ children, count, action }: { children: React.ReactNode; count?: number; action?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center gap-2 mb-2.5 mt-6">
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: t.text }}>{children}</h2>
      {count != null && <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>{count}</span>}
      <div className="flex-1" style={{ height: 1, backgroundColor: `${t.accent}33` }} />
      {action}
    </div>
  );
}

export function BeautyCareMobile() {
  const { t } = useTheme();
  const b = useBeauty();

  // 시트/오버레이/모달 상태
  const [careSheet, setCareSheet] = useState<{ care: BeautySpecialCare | null } | null>(null);
  const [productSheet, setProductSheet] = useState<{ product: BeautyProduct | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [shelfFull, setShelfFull] = useState(false);
  const [deleteCareId, setDeleteCareId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 1900); };

  // 사진 AI 등록 — 추출 항목을 화장품으로 등록(개봉일 오늘, 찍은 사진을 썸네일로 재사용).
  const handlePhotoConfirm = (items: ExtractedItem[], photoUrl: string | null) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    items.forEach(it => b.addProduct({
      id: newId(),
      name: it.name,
      brand: it.brand ?? null,
      category: it.category ?? null,
      photoUrl: photoUrl ?? null,
      openedAt: today,
      expiryMonths: null,
      purchasePlace: null,
      price: null,
      link: null,
      memo: null,
      isActive: true,
    }));
    setPhotoOpen(false);
    notify(`${items.length}개 등록했어요`);
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: t.bg }}>
      <style>{`.bc-add-fab{bottom:calc(142px + env(safe-area-inset-bottom));}`}</style>

      <div className="px-4 pt-5 pb-24">
        {/* 헤더 */}
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: t.text, lineHeight: 1.1 }}>케어</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>잘 돌보고 있는지, 하온이 지켜볼게요</p>

        {/* ① 셀프케어 게이지 */}
        <div className="mt-4">
          {b.loading ? (
            <div className="rounded-2xl" style={{ height: 250, backgroundColor: t.card, border: `1px solid ${t.border}` }} />
          ) : (
            <SelfCareGauge score={b.selfCareScore} recentCareCount={b.recentCareCount} spark={b.careSpark} careCount={b.specialCares.length} />
          )}
        </div>

        {/* ② 스페셜케어 */}
        <SectionTitle count={b.specialCares.length}>스페셜케어</SectionTitle>
        {b.loading ? (
          <div className="grid grid-cols-2 gap-2.5">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-2xl" style={{ height: 132, backgroundColor: t.bgSub }} />)}</div>
        ) : (
          <SpecialCareSection
            cares={b.specialCares}
            onDone={(id) => { b.markCareDone(id); notify('오늘 케어 완료!'); }}
            onEdit={(care: CareDerived) => setCareSheet({ care })}
            onAdd={() => setCareSheet({ care: null })} />
        )}

        {/* ③ 화장품 보유함 */}
        <SectionTitle
          count={b.activeProducts.length}
          action={b.activeProducts.length > 0 ? (
            <button onClick={() => setShelfFull(true)} style={{ fontSize: 12.5, fontWeight: 700, color: t.accent }}>전체 보기</button>
          ) : undefined}>
          화장품 보유함
        </SectionTitle>
        {b.loading ? (
          <div className="flex gap-2.5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl flex-shrink-0" style={{ width: 118, height: 168, backgroundColor: t.bgSub }} />)}</div>
        ) : (
          <BeautyShelfPreview
            products={b.activeProducts}
            onOpen={(p) => setProductSheet({ product: p })}
            onAdd={() => setProductSheet({ product: null })} />
        )}
      </div>

      {/* 추가 FAB — 전역 빠른캡처 FAB 위(bottom 142px) */}
      <button onClick={() => setAddOpen(true)} aria-label="뷰티 항목 추가"
        className="bc-add-fab fixed right-4 z-40 flex items-center justify-center rounded-full active:scale-95 transition-transform"
        style={{ width: 56, height: 56, backgroundColor: t.accent, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.28)' }}>
        <Plus size={26} />
      </button>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg pointer-events-none"
          style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', backgroundColor: t.text, color: t.bg, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* 전체 보기 오버레이 */}
      {shelfFull && (
        <BeautyShelfFull
          active={b.activeProducts}
          archived={b.archivedProducts}
          onOpen={(p) => setProductSheet({ product: p })}
          onClose={() => setShelfFull(false)}
          onAdd={() => setProductSheet({ product: null })} />
      )}

      {/* 스페셜케어 시트 */}
      {careSheet && (
        <SpecialCareSheet
          care={careSheet.care}
          onSave={(item) => { careSheet.care ? b.editCare(item) : b.addCare(item); setCareSheet(null); notify(careSheet.care ? '수정했어요' : '추가했어요'); }}
          onDelete={careSheet.care ? (id) => setDeleteCareId(id) : undefined}
          onClose={() => setCareSheet(null)} />
      )}

      {/* 화장품 시트 */}
      {productSheet && (
        <BeautyProductSheet
          product={productSheet.product}
          onSave={(item) => { productSheet.product ? b.editProduct(item) : b.addProduct(item); setProductSheet(null); notify(productSheet.product ? '수정했어요' : '추가했어요'); }}
          onRepurchase={productSheet.product ? (p) => { b.repurchase(p); setProductSheet(null); notify('또 샀어요 — 새로 등록했어요'); } : undefined}
          onSetActive={productSheet.product ? (id, active) => { b.setProductActive(id, active); setProductSheet(null); notify(active ? '보유함으로 복원했어요' : '보관함으로 옮겼어요'); } : undefined}
          onDelete={productSheet.product ? (id) => setDeleteProductId(id) : undefined}
          onClose={() => setProductSheet(null)} />
      )}

      {/* 추가 종류 선택 */}
      {addOpen && (
        <BeautyAddSheet
          onPickProduct={() => setProductSheet({ product: null })}
          onPickCare={() => setCareSheet({ care: null })}
          onPickPhoto={() => setPhotoOpen(true)}
          onClose={() => setAddOpen(false)} />
      )}

      {/* 사진 AI 등록 */}
      {photoOpen && (
        <PhotoCaptureSheet
          domain="beauty"
          onConfirm={handlePhotoConfirm}
          onManualFallback={() => { setPhotoOpen(false); setProductSheet({ product: null }); }}
          onClose={() => setPhotoOpen(false)} />
      )}

      {/* 삭제 확인 */}
      {deleteCareId && (
        <ConfirmModal message="이 스페셜케어를 삭제할까요?" confirmText="삭제" confirmDanger
          onConfirm={() => { b.deleteCare(deleteCareId); setDeleteCareId(null); setCareSheet(null); notify('삭제했어요'); }}
          onCancel={() => setDeleteCareId(null)} />
      )}
      {deleteProductId && (
        <ConfirmModal message="이 화장품을 삭제할까요?" confirmText="삭제" confirmDanger
          onConfirm={() => { b.deleteProduct(deleteProductId); setDeleteProductId(null); setProductSheet(null); notify('삭제했어요'); }}
          onCancel={() => setDeleteProductId(null)} />
      )}
    </div>
  );
}
