// 살림 — 모바일 화면 (Stage 4). 넛지 배너 + 재고/교체주기/청소 3섹션 + 추가 FAB.
//  · 데이터·파생값·액션은 전부 useHousekeeping(S2) 훅에서 받아 호출만 한다(로직 재구현 X).
//  · 낙관적 업데이트도 훅 액션을 통해서만. careUtils 의 isLowStock/isDepleted 등은 훅이 이미 적용.
//  · 전역 FloatingAddFab(빠른 캡처, bottom-20)이 이미 떠 있어, 살림 추가 FAB 는 RecipeView 관습대로
//    그 위(bottom 142px)로 띄운다. (Layout 미수정)
//  · PC(hidden lg:block)는 S7에서 처리 — 이 컴포넌트는 lg:hidden 래퍼 안에서만 렌더된다.
import { useMemo, useState } from 'react';
import { Plus, Minus, Package, RefreshCw, SprayCan, ShoppingCart, RotateCcw } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import ConfirmModal from '../ConfirmModal';
import { useHousekeeping } from './useHousekeeping';
import { isLowStock, isDepleted } from '../../../lib/careUtils';
import { ConsumableCycleCard } from './ConsumableCycleCard';
import { CleaningHeatmap, zoneDust } from './CleaningHeatmap';
import { HouseholdStockSheet } from './HouseholdStockSheet';
import { HousekeepingAddSheet } from './HousekeepingAddSheet';
import { PhotoCaptureSheet } from '../capture/PhotoCaptureSheet';
import type { ExtractedItem } from '../capture/useVisionExtract';
import type { HouseholdItem } from '../../store';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── 넛지 우선순위 (높을수록 위) ──
//   4 소진(다 씀) > 3 교체 지난 소모품(over) > 2 저재고(곧 떨어짐) > 1 오래된 청소구역.
//   "지금 당장 막힘(없으면 곤란)" → "주기 놓침" → "곧 곤란" → "미루면 쌓임" 순서.
type Nudge = { key: string; severity: number; icon: string; text: string; actionLabel: string; onAction: () => void };

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center gap-2 mb-2.5 mt-5">
      <h2 style={{ fontFamily: t.fontSection, fontSize: 20, color: t.text }}>{children}</h2>{/* 섹션 헤더 */}
      {count != null && <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>{count}</span>}
      <div className="flex-1" style={{ height: 1, backgroundColor: `${t.accent}33` }} />
    </div>
  );
}

// 생필품 재고 카드
function StockCard({ item, onQty, onOpen }: {
  item: HouseholdItem; onQty: (delta: number) => void; onOpen: () => void;
}) {
  const { t } = useTheme();
  const low = isLowStock(item);
  const empty = isDepleted(item);
  // 수량 바 — 임계의 2배를 가득으로 보고 채움 비율 표시(시각용)
  const denom = Math.max(item.thresholdQty * 2, item.quantity, 1);
  const fill = Math.min(1, item.quantity / denom);
  const barColor = empty ? t.textMuted : low ? t.danger : t.success;

  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5"
      style={{
        backgroundColor: low ? t.dangerLight : t.card,
        border: `1px solid ${low ? `${t.danger}55` : t.border}`,
        opacity: empty ? 0.6 : 1,
        boxShadow: t.shadow,
      }}>
      {/* 아이콘/사진 */}
      <button onClick={onOpen} className="flex-shrink-0 rounded-xl flex items-center justify-center active:scale-95 transition-transform overflow-hidden"
        style={{ width: 44, height: 44, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, fontSize: 22, lineHeight: 1 }}
        aria-label={`${item.name} 수정`}>
        {item.photoUrl ? <img src={item.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-hidden>📦</span>}
      </button>

      {/* 이름 + 상태 + 수량 바 */}
      <button onClick={onOpen} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: t.text, textDecoration: empty ? 'line-through' : 'none' }}>
            {item.name}
          </span>
          {empty ? (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 700, backgroundColor: t.bgSub, color: t.textMuted }}>다 썼어요</span>
          ) : low ? (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 700, backgroundColor: t.dangerLight, color: t.danger, border: `1px solid ${t.danger}55` }}>곧 떨어져요</span>
          ) : null}
        </div>
        {/* 수량 바 */}
        <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: t.bgSub }}>
          <div style={{ width: `${fill * 100}%`, height: '100%', backgroundColor: barColor, borderRadius: 999 }} />
        </div>
        <span style={{ fontSize: 11.5, color: t.textMuted, marginTop: 3, display: 'block' }}>
          {item.quantity}{item.unit ?? ''} {item.category ? `· ${item.category}` : ''}
        </span>
      </button>

      {/* 스테퍼 */}
      <div className="flex items-center flex-shrink-0 rounded-full overflow-hidden" style={{ border: `1px solid ${t.border}`, backgroundColor: t.card }}>
        <button onClick={() => onQty(-1)} className="flex items-center justify-center active:scale-95" style={{ width: 30, height: 30, color: t.text }} aria-label="수량 감소">
          <Minus size={14} />
        </button>
        <span style={{ minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 700, color: t.text }}>{item.quantity}</span>
        <button onClick={() => onQty(1)} className="flex items-center justify-center active:scale-95" style={{ width: 30, height: 30, color: t.accent }} aria-label="수량 증가">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export function HousekeepingMobile() {
  const { t } = useTheme();
  const hk = useHousekeeping();

  // 시트/모달 상태
  const [stockSheet, setStockSheet] = useState<{ item: HouseholdItem | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 1900); };

  // 사진/영수증 AI 등록 — 추출 품목을 생필품 재고로 등록(찍은 사진을 대표 썸네일로 공유).
  const handlePhotoConfirm = (items: ExtractedItem[], photoUrl: string | null) => {
    items.forEach(it => hk.addItem({
      id: newId(),
      name: it.name,
      category: it.category ?? null,
      quantity: it.quantity != null && it.quantity > 0 ? it.quantity : 1,
      unit: null,
      thresholdQty: 1,
      brand: it.brand ?? null,
      purchasePlace: it.purchase_place ?? null,
      price: it.price ?? null,
      link: null,
      memo: null,
      photoUrl: photoUrl ?? null,
    }));
    setPhotoOpen(false);
    notify(`${items.length}개 등록했어요`);
  };

  // ── 넛지 생성 + 우선순위 정렬 ──
  const nudges = useMemo<Nudge[]>(() => {
    const list: Nudge[] = [];
    for (const it of hk.items) {
      if (isDepleted(it)) {
        list.push({ key: `dep-${it.id}`, severity: 4, icon: '🪫', text: `${it.name} 다 썼어요`, actionLabel: '채움', onAction: () => { hk.refill(it.id); notify('다시 채웠어요'); } });
      } else if (isLowStock(it)) {
        list.push({ key: `low-${it.id}`, severity: 2, icon: '🧴', text: `${it.name} ${it.quantity}${it.unit ?? ''} 남음`, actionLabel: '채움', onAction: () => { hk.refill(it.id); notify('다시 채웠어요'); } });
      }
    }
    for (const c of hk.cycles) {
      if (c.status === 'over') {
        list.push({ key: `cyc-${c.id}`, severity: 3, icon: '🔁', text: c.daysSince == null ? `${c.name} 아직 교체 안 함` : `${c.name} 교체한 지 ${c.daysSince}일`, actionLabel: '교체', onAction: () => { hk.replaceConsumable(c.id); notify('교체했어요'); } });
      }
    }
    for (const z of hk.zones) {
      if (zoneDust(z.daysSince).tier === 'old') {
        list.push({ key: `zone-${z.id}`, severity: 1, icon: '🧹', text: z.daysSince == null ? `${z.name} 청소 아직이에요` : `${z.name} 청소 ${z.daysSince}일 됐어요`, actionLabel: '완료', onAction: () => { hk.markCleaned(z.id); notify('청소 완료!'); } });
      }
    }
    return list.sort((a, b) => b.severity - a.severity);
  }, [hk]);

  // 재고 정렬 — 소진/저재고 먼저, 그다음 이름
  const sortedItems = useMemo(() => {
    const rank = (it: HouseholdItem) => (isDepleted(it) ? 0 : isLowStock(it) ? 1 : 2);
    return [...hk.items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [hk.items]);

  const ActionChipColor = (sev: number) => sev >= 3 ? { bg: t.accent, fg: '#fff' } : { bg: t.accentLight, fg: t.accent };

  return (
    <div className="min-h-full" style={{ backgroundColor: t.bg }}>
      <style>{`.hk-add-fab{bottom:calc(142px + env(safe-area-inset-bottom));}`}</style>

      <div className="px-4 pt-5 pb-24">
        {/* 헤더 */}
        <h1 style={{ fontFamily: t.fontPageTitle, fontSize: 28, color: t.text, lineHeight: 1.1 }}>살림 노트</h1>{/* 페이지 최상위 제목 */}
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>슬슬 할 때 된 것들, 하온이 챙겨줄게요</p>

        {/* ① 넛지 배너 */}
        <div className="mt-4 rounded-2xl p-3" style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <p className="mb-2" style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>오늘의 살림</p>
          {hk.loading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-lg" style={{ height: 36, backgroundColor: t.bgSub }} />)}</div>
          ) : nudges.length === 0 ? (
            <div className="flex items-center gap-2 py-1.5">
              <span aria-hidden style={{ fontSize: 20 }}>☺️</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>오늘은 다 괜찮아요</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {nudges.map(n => {
                const c = ActionChipColor(n.severity);
                return (
                  <div key={n.key} className="flex items-center gap-2 rounded-xl px-2.5 py-2" style={{ backgroundColor: t.bgSub }}>
                    <span aria-hidden style={{ fontSize: 17 }}>{n.icon}</span>
                    <span className="flex-1 truncate" style={{ fontSize: 13.5, color: t.text }}>{n.text}</span>
                    <button onClick={n.onAction} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                      style={{ fontSize: 12, fontWeight: 700, color: c.fg, backgroundColor: c.bg }}>
                      {n.actionLabel === '교체' ? <RotateCcw size={12} /> : n.actionLabel === '완료' ? <SprayCan size={12} /> : <ShoppingCart size={12} />}
                      {n.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ② 생필품 재고 */}
        <SectionTitle count={hk.items.length}>생필품 재고</SectionTitle>
        {hk.loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-xl" style={{ height: 64, backgroundColor: t.bgSub }} />)}</div>
        ) : hk.items.length === 0 ? (
          <EmptyCard icon={<Package size={22} style={{ color: t.accent }} />} title="아직 등록된 생필품이 없어요" desc="휴지·세제처럼 떨어지면 곤란한 것을 추가해 보세요"
            onAdd={() => setStockSheet({ item: null })} />
        ) : (
          <div className="space-y-2">
            {sortedItems.map(it => (
              <StockCard key={it.id} item={it}
                onQty={(d) => hk.updateQuantity(it.id, d)}
                onOpen={() => setStockSheet({ item: it })} />
            ))}
          </div>
        )}

        {/* ③ 소모품 교체주기 */}
        <SectionTitle count={hk.cycles.length}>소모품 교체주기</SectionTitle>
        {hk.loading ? (
          <div className="rounded-xl" style={{ height: 76, backgroundColor: t.bgSub }} />
        ) : hk.cycles.length === 0 ? (
          <EmptyCard icon={<RefreshCw size={22} style={{ color: t.accent }} />} title="교체주기를 추가해 보세요" desc="수세미·칫솔처럼 주기로 바꾸는 것을 챙겨드려요"
            onAdd={() => setAddOpen(true)} />
        ) : (
          <div className="space-y-2">
            {hk.cycles.map(c => (
              <ConsumableCycleCard key={c.id} cycle={c}
                onReplace={(id) => { hk.replaceConsumable(id); notify('교체했어요'); }}
                onSetCycle={(id, days) => { hk.setCycle(id, days); notify('주기를 바꿨어요'); }}
                onDelete={(id) => setDeleteCycleId(id)} />
            ))}
          </div>
        )}

        {/* ④ 청소구역 */}
        <SectionTitle count={hk.zones.length}>청소구역</SectionTitle>
        {hk.loading ? (
          <div className="grid grid-cols-2 gap-2.5">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-2xl" style={{ height: 92, backgroundColor: t.bgSub }} />)}</div>
        ) : (
          <CleaningHeatmap zones={hk.zones}
            onClean={(id) => { hk.markCleaned(id); notify('청소 완료!'); }}
            onDelete={(id) => setDeleteZoneId(id)}
            onAdd={() => setAddOpen(true)} />
        )}
      </div>

      {/* 추가 FAB — 전역 빠른캡처 FAB 위(bottom 142px) */}
      <button onClick={() => setAddOpen(true)} aria-label="살림 항목 추가"
        className="hk-add-fab fixed right-4 z-40 flex items-center justify-center rounded-full active:scale-95 transition-transform"
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

      {/* 시트 */}
      {stockSheet && (
        <HouseholdStockSheet
          item={stockSheet.item}
          onSave={(item) => { stockSheet.item ? hk.editItem(item) : hk.addItem(item); setStockSheet(null); notify(stockSheet.item ? '수정했어요' : '추가했어요'); }}
          onRefill={stockSheet.item ? (id) => { hk.refill(id); setStockSheet(null); notify('다시 채웠어요'); } : undefined}
          onDelete={stockSheet.item ? (id) => setDeleteItemId(id) : undefined}
          onClose={() => setStockSheet(null)} />
      )}
      {addOpen && (
        <HousekeepingAddSheet
          onPickStock={() => setStockSheet({ item: null })}
          onPickPhoto={() => setPhotoOpen(true)}
          onAddCycle={(c) => { hk.addCycle(c); notify('추가했어요'); }}
          onAddZone={(z) => { hk.addZone(z); notify('추가했어요'); }}
          onClose={() => setAddOpen(false)} />
      )}

      {/* 사진/영수증 AI 등록 */}
      {photoOpen && (
        <PhotoCaptureSheet
          domain="household"
          onConfirm={handlePhotoConfirm}
          onManualFallback={() => { setPhotoOpen(false); setStockSheet({ item: null }); }}
          onClose={() => setPhotoOpen(false)} />
      )}

      {/* 삭제 확인 */}
      {deleteItemId && (
        <ConfirmModal message="이 생필품을 삭제할까요?" confirmText="삭제" confirmDanger
          onConfirm={() => { hk.deleteItem(deleteItemId); setDeleteItemId(null); setStockSheet(null); notify('삭제했어요'); }}
          onCancel={() => setDeleteItemId(null)} />
      )}
      {deleteCycleId && (
        <ConfirmModal message="이 교체주기를 삭제할까요?" confirmText="삭제" confirmDanger
          onConfirm={() => { hk.deleteCycle(deleteCycleId); setDeleteCycleId(null); notify('삭제했어요'); }}
          onCancel={() => setDeleteCycleId(null)} />
      )}
      {deleteZoneId && (
        <ConfirmModal message="이 청소구역을 삭제할까요?" confirmText="삭제" confirmDanger
          onConfirm={() => { hk.deleteZone(deleteZoneId); setDeleteZoneId(null); notify('삭제했어요'); }}
          onCancel={() => setDeleteZoneId(null)} />
      )}
    </div>
  );
}

// 섹션 공통 빈 상태 카드
function EmptyCard({ icon, title, desc, onAdd }: { icon: React.ReactNode; title: string; desc: string; onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-2xl"
      style={{ padding: '28px 20px', backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <div className="flex items-center justify-center mb-2.5" style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.accentLight }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</p>
      <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>{desc}</p>
      <button onClick={onAdd} className="mt-3.5 flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
        style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
        <Plus size={15} /> 추가
      </button>
    </div>
  );
}
