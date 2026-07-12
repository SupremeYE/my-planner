// 살림 — PC 데스크톱 전용 레이아웃 (Stage 7).
//  · WorkoutTabDesktop 관습: 상단 와이드 넛지 + 본문 멀티컬럼 + DCard 빌딩블록 + hover 액션.
//  · 데이터·액션은 모바일과 "같은 훅" useHousekeeping 호출(로직 재구현 0). 모바일 컴포넌트 미수정.
//  · 카드(ConsumableCycleCard)·먼지 헬퍼(zoneDust)·시트는 기존 것을 재사용(반응형 → PC 모달).
import { useMemo, useState } from 'react';
import { Plus, Minus, Receipt, Package, RefreshCw, Trash2, RotateCcw, SprayCan, ShoppingCart } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import ConfirmModal from '../ConfirmModal';
import { useHousekeeping } from './useHousekeeping';
import { isLowStock, isDepleted } from '../../../lib/careUtils';
import { ConsumableCycleCard } from './ConsumableCycleCard';
import { zoneDust } from './CleaningHeatmap';
import { HouseholdStockSheet } from './HouseholdStockSheet';
import { HousekeepingAddSheet } from './HousekeepingAddSheet';
import { PhotoCaptureSheet } from '../capture/PhotoCaptureSheet';
import type { ExtractedItem } from '../capture/useVisionExtract';
import type { HouseholdItem } from '../../store';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function DCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const { t } = useTheme();
  return (
    <div className={className} style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 18, padding: 18 }}>
      {children}
    </div>
  );
}
function DCardHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: t.fontSection, fontSize: 20, color: t.text }}>{title}</span>
        {count != null && <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>{count}</span>}
      </div>
      {action}
    </div>
  );
}

// PC 생필품 재고 카드 (± 항상 노출 + hover 편집)
function StockCardPC({ item, onQty, onOpen }: { item: HouseholdItem; onQty: (d: number) => void; onOpen: () => void }) {
  const { t } = useTheme();
  const low = isLowStock(item);
  const empty = isDepleted(item);
  const denom = Math.max(item.thresholdQty * 2, item.quantity, 1);
  const fill = Math.min(1, item.quantity / denom);
  const barColor = empty ? t.textMuted : low ? t.danger : t.success;
  return (
    <div className="group flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5"
      style={{ backgroundColor: low ? t.dangerLight : t.bgSub, border: `1px solid ${low ? `${t.danger}55` : t.borderLight}`, opacity: empty ? 0.65 : 1 }}>
      <button onClick={onOpen} className="flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
        style={{ width: 44, height: 44, backgroundColor: t.card, border: `1px solid ${t.borderLight}`, fontSize: 22 }} aria-label={`${item.name} 수정`}>
        {item.photoUrl ? <img src={item.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-hidden>📦</span>}
      </button>
      <button onClick={onOpen} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate" style={{ fontSize: 14.5, fontWeight: 600, color: t.text, textDecoration: empty ? 'line-through' : 'none' }}>{item.name}</span>
          {empty ? <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full" style={{ fontSize: 10.5, fontWeight: 700, backgroundColor: t.card, color: t.textMuted }}>다 썼어요</span>
            : low ? <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full" style={{ fontSize: 10.5, fontWeight: 700, backgroundColor: t.card, color: t.danger, border: `1px solid ${t.danger}55` }}>곧 떨어져요</span> : null}
        </div>
        <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: t.card }}>
          <div style={{ width: `${fill * 100}%`, height: '100%', backgroundColor: barColor, borderRadius: 999 }} />
        </div>
        <span style={{ fontSize: 11.5, color: t.textMuted, marginTop: 3, display: 'block' }}>{item.quantity}{item.unit ?? ''} {item.category ? `· ${item.category}` : ''}</span>
      </button>
      <div className="flex items-center flex-shrink-0 rounded-full overflow-hidden" style={{ border: `1px solid ${t.border}`, backgroundColor: t.card }}>
        <button onClick={() => onQty(-1)} className="flex items-center justify-center active:scale-95" style={{ width: 30, height: 30, color: t.text }} aria-label="수량 감소"><Minus size={14} /></button>
        <span style={{ minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 700, color: t.text }}>{item.quantity}</span>
        <button onClick={() => onQty(1)} className="flex items-center justify-center active:scale-95" style={{ width: 30, height: 30, color: t.accent }} aria-label="수량 증가"><Plus size={14} /></button>
      </div>
    </div>
  );
}

// PC 청소구역 카드 (더 넓은 그리드)
function ZoneCardPC({ zone, onClean, onDelete }: { zone: { id: string; name: string; daysSince: number | null }; onClean: (id: string) => void; onDelete: (id: string) => void }) {
  const { t } = useTheme();
  const ds = zone.daysSince;
  const { emoji, tier } = zoneDust(ds);
  const bg = tier === 'fresh' ? t.bgSub : tier === 'mid' ? `${t.danger}14` : `${t.danger}26`;
  const border = tier === 'fresh' ? t.borderLight : tier === 'mid' ? `${t.danger}33` : `${t.danger}55`;
  const label = ds == null ? '아직 안 했어요' : ds === 0 ? '오늘 했어요' : `${ds}일 전`;
  return (
    <button onClick={() => onClean(zone.id)} className="group relative text-left rounded-2xl px-3 py-3.5 active:scale-[0.98] transition-transform"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
      <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
      <p className="truncate mt-1.5" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{zone.name}</p>
      <p style={{ fontSize: 11.5, color: tier === 'old' ? t.danger : t.textMuted, marginTop: 2 }}>마지막 청소 {label}</p>
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onDelete(zone.id); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(zone.id); } }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded-md flex items-center justify-center"
        style={{ width: 24, height: 24, color: t.textMuted, transition: 'opacity 0.15s ease' }} aria-label="구역 삭제"><Trash2 size={13} /></span>
    </button>
  );
}

function EmptyInline({ icon, title, desc, onAdd }: { icon: React.ReactNode; title: string; desc: string; onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: '26px 20px' }}>
      <div className="flex items-center justify-center mb-2.5" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: t.accentLight }}>{icon}</div>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{title}</p>
      <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>{desc}</p>
      <button onClick={onAdd} className="mt-3 flex items-center gap-1.5 px-3.5 py-2 rounded-xl" style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}><Plus size={15} /> 추가</button>
    </div>
  );
}

type Nudge = { key: string; severity: number; icon: string; text: string; actionLabel: string; onAction: () => void };

export function HousekeepingDesktop() {
  const { t } = useTheme();
  const hk = useHousekeeping();

  const [stockSheet, setStockSheet] = useState<{ item: HouseholdItem | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 1900); };

  const handlePhotoConfirm = (items: ExtractedItem[], photoUrl: string | null) => {
    items.forEach(it => hk.addItem({
      id: newId(), name: it.name, category: it.category ?? null,
      quantity: it.quantity != null && it.quantity > 0 ? it.quantity : 1, unit: null, thresholdQty: 1,
      brand: it.brand ?? null, purchasePlace: it.purchase_place ?? null, price: it.price ?? null,
      link: null, memo: null, photoUrl: photoUrl ?? null,
    }));
    setPhotoOpen(false);
    notify(`${items.length}개 등록했어요`);
  };

  // 넛지(모바일과 동일 우선순위: 소진4 > 교체지남3 > 저재고2 > 오래된청소1)
  const nudges = useMemo<Nudge[]>(() => {
    const list: Nudge[] = [];
    for (const it of hk.items) {
      if (isDepleted(it)) list.push({ key: `dep-${it.id}`, severity: 4, icon: '🪫', text: `${it.name} 다 썼어요`, actionLabel: '채움', onAction: () => { hk.refill(it.id); notify('다시 채웠어요'); } });
      else if (isLowStock(it)) list.push({ key: `low-${it.id}`, severity: 2, icon: '🧴', text: `${it.name} ${it.quantity}${it.unit ?? ''} 남음`, actionLabel: '채움', onAction: () => { hk.refill(it.id); notify('다시 채웠어요'); } });
    }
    for (const c of hk.cycles) if (c.status === 'over') list.push({ key: `cyc-${c.id}`, severity: 3, icon: '🔁', text: c.daysSince == null ? `${c.name} 아직 교체 안 함` : `${c.name} 교체한 지 ${c.daysSince}일`, actionLabel: '교체', onAction: () => { hk.replaceConsumable(c.id); notify('교체했어요'); } });
    for (const z of hk.zones) if (zoneDust(z.daysSince).tier === 'old') list.push({ key: `zone-${z.id}`, severity: 1, icon: '🧹', text: z.daysSince == null ? `${z.name} 청소 아직이에요` : `${z.name} 청소 ${z.daysSince}일 됐어요`, actionLabel: '완료', onAction: () => { hk.markCleaned(z.id); notify('청소 완료!'); } });
    return list.sort((a, b) => b.severity - a.severity);
  }, [hk]);

  const sortedItems = useMemo(() => {
    const rank = (it: HouseholdItem) => (isDepleted(it) ? 0 : isLowStock(it) ? 1 : 2);
    return [...hk.items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [hk.items]);

  const chip = (sev: number) => sev >= 3 ? { bg: t.accent, fg: '#fff' } : { bg: t.accentLight, fg: t.accent };

  return (
    <div className="w-full px-6 pt-6 pb-10" style={{ fontFamily: t.fontBody }}>
      {/* 헤더 */}
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 style={{ fontFamily: t.fontPageTitle, fontSize: 30, color: t.text, lineHeight: 1.1 }}>살림 노트</h1>
          <p style={{ fontSize: 13.5, color: t.textSub, marginTop: 3 }}>슬슬 할 때 된 것들, 하온이 챙겨줄게요</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPhotoOpen(true)} className="flex items-center gap-1.5 rounded-full" style={{ fontSize: 13.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, padding: '8px 14px' }}><Receipt size={16} /> 영수증/사진</button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-full" style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', backgroundColor: t.accent, padding: '8px 16px' }}><Plus size={16} /> 추가</button>
        </div>
      </div>

      {/* 오늘의 넛지 — 와이드 배너 */}
      <DCard>
        <DCardHeader title="오늘의 살림" />
        {hk.loading ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))' }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-xl" style={{ height: 44, backgroundColor: t.bgSub }} />)}</div>
        ) : nudges.length === 0 ? (
          <div className="flex items-center gap-2 py-1.5"><span aria-hidden style={{ fontSize: 20 }}>☺️</span><span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>오늘은 다 괜찮아요</span></div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {nudges.map(n => {
              const c = chip(n.severity);
              return (
                <div key={n.key} className="flex items-center gap-2 rounded-xl px-2.5 py-2" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
                  <span aria-hidden style={{ fontSize: 17 }}>{n.icon}</span>
                  <span className="flex-1 truncate" style={{ fontSize: 13.5, color: t.text }}>{n.text}</span>
                  <button onClick={n.onAction} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full active:scale-95 transition-transform" style={{ fontSize: 12, fontWeight: 700, color: c.fg, backgroundColor: c.bg }}>
                    {n.actionLabel === '교체' ? <RotateCcw size={12} /> : n.actionLabel === '완료' ? <SprayCan size={12} /> : <ShoppingCart size={12} />}{n.actionLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </DCard>

      {/* 본문 2단: 좌 재고 / 우 교체주기 */}
      <div className="grid gap-4 mt-4 items-start" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' }}>
        <DCard className="min-w-0">
          <DCardHeader title="생필품 재고" count={hk.items.length} action={
            <button onClick={() => setStockSheet({ item: null })} className="flex items-center gap-1 rounded-full" style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, padding: '6px 12px' }}><Plus size={14} /> 추가</button>
          } />
          {hk.items.length === 0 ? (
            <EmptyInline icon={<Package size={20} style={{ color: t.accent }} />} title="아직 등록된 생필품이 없어요" desc="휴지·세제처럼 떨어지면 곤란한 것을 추가해 보세요" onAdd={() => setStockSheet({ item: null })} />
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {sortedItems.map(it => <StockCardPC key={it.id} item={it} onQty={(d) => hk.updateQuantity(it.id, d)} onOpen={() => setStockSheet({ item: it })} />)}
            </div>
          )}
        </DCard>

        <DCard className="min-w-0">
          <DCardHeader title="소모품 교체주기" count={hk.cycles.length} action={
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 rounded-full" style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, padding: '6px 12px' }}><Plus size={14} /> 추가</button>
          } />
          {hk.cycles.length === 0 ? (
            <EmptyInline icon={<RefreshCw size={20} style={{ color: t.accent }} />} title="교체주기를 추가해 보세요" desc="수세미·칫솔처럼 주기로 바꾸는 것을 챙겨드려요" onAdd={() => setAddOpen(true)} />
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {hk.cycles.map(c => (
                <ConsumableCycleCard key={c.id} cycle={c}
                  onReplace={(id) => { hk.replaceConsumable(id); notify('교체했어요'); }}
                  onSetCycle={(id, days) => { hk.setCycle(id, days); notify('주기를 바꿨어요'); }}
                  onDelete={(id) => setDeleteCycleId(id)} />
              ))}
            </div>
          )}
        </DCard>
      </div>

      {/* 청소구역 히트맵 — 풀폭 멀티컬럼 */}
      <DCard className="mt-4">
        <DCardHeader title="청소구역" count={hk.zones.length} action={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 rounded-full" style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, padding: '6px 12px' }}><Plus size={14} /> 추가</button>
        } />
        {hk.zones.length === 0 ? (
          <EmptyInline icon={<SprayCan size={20} style={{ color: t.accent }} />} title="청소구역을 추가해 보세요" desc="화장실·주방처럼 챙길 곳을 만들면 먼지를 추적해요" onAdd={() => setAddOpen(true)} />
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {hk.zones.map(z => <ZoneCardPC key={z.id} zone={z} onClean={(id) => { hk.markCleaned(id); notify('청소 완료!'); }} onDelete={(id) => setDeleteZoneId(id)} />)}
          </div>
        )}
      </DCard>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 bottom-8 z-50 px-4 py-2.5 rounded-xl shadow-lg pointer-events-none" style={{ transform: 'translateX(-50%)', backgroundColor: t.text, color: t.bg, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      )}

      {/* 시트(반응형 → PC 중앙 모달) */}
      {stockSheet && (
        <HouseholdStockSheet item={stockSheet.item}
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
      {photoOpen && (
        <PhotoCaptureSheet domain="household"
          onConfirm={handlePhotoConfirm}
          onManualFallback={() => { setPhotoOpen(false); setStockSheet({ item: null }); }}
          onClose={() => setPhotoOpen(false)} />
      )}
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
