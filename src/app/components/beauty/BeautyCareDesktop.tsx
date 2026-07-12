// 뷰티 케어 — PC 데스크톱 전용 레이아웃 (Stage 7).
//  · WorkoutTabDesktop 관습: 상단 히어로(2열) + 본문 2단 그리드 + DCard 빌딩블록 + hover 액션.
//  · 데이터·액션은 모바일과 "같은 훅" useBeauty 를 호출(로직 재구현 0). 모바일 컴포넌트는 미수정.
//  · 시트는 반응형(lg:에서 중앙 모달)이라 그대로 재사용 — 모바일 바텀시트 / PC 모달 자동 분기.
//  · 사용기한·카테고리 이모지는 BeautyShelf 의 순수 헬퍼를 재사용(careUtils/훅 로직 미수정).
import { useMemo, useState } from 'react';
import { Plus, Camera, Sparkles, Check, RotateCcw, Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from '../../ThemeContext';
import ConfirmModal from '../ConfirmModal';
import { useBeauty, type CareDerived } from './useBeauty';
import { SelfCareGauge } from './SelfCareGauge';
import { SpecialCareSheet } from './SpecialCareSheet';
import { BeautyProductSheet } from './BeautyProductSheet';
import { BeautyAddSheet } from './BeautyAddSheet';
import { categoryEmoji, productExpiry } from './BeautyShelf';
import { PhotoCaptureSheet } from '../capture/PhotoCaptureSheet';
import type { ExtractedItem } from '../capture/useVisionExtract';
import type { BeautyProduct, BeautySpecialCare } from '../../store';
import type { CareStatus } from '../../../lib/careUtils';

const SERIF = "'DM Serif Display', serif";
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
function DCardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <span style={{ fontFamily: SERIF, fontSize: 20, color: t.text }}>{title}</span>
      {action}
    </div>
  );
}

const STATUS_META: Record<CareStatus, { label: string; key: 'success' | 'accent' | 'danger' }> = {
  fresh: { label: '최근', key: 'success' },
  soon: { label: '곧', key: 'accent' },
  over: { label: '지남', key: 'danger' },
};

// PC 스페셜케어 카드 (hover 로 편집 힌트)
function CareCardPC({ care, onDone, onEdit }: { care: CareDerived; onDone: (id: string) => void; onEdit: (c: CareDerived) => void }) {
  const { t } = useTheme();
  const ds = care.daysSince;
  const meta = STATUS_META[care.status];
  const badge = meta.key === 'success' ? t.success : meta.key === 'accent' ? t.accent : t.danger;
  const doneToday = ds === 0;
  const last = ds == null ? '아직 안 했어요' : ds === 0 ? '방금 했어요' : `마지막 ${ds}일 전`;
  return (
    <div className="group relative rounded-2xl p-3 flex flex-col"
      style={{ backgroundColor: care.status === 'over' ? t.dangerLight : t.bgSub, border: `1px solid ${care.status === 'over' ? `${t.danger}55` : t.borderLight}`, minHeight: 128 }}>
      <div className="flex items-start justify-between gap-1.5">
        <span aria-hidden style={{ fontSize: 24, lineHeight: 1 }}>{care.icon || '🧖‍♀️'}</span>
        <span className="px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ fontSize: 10.5, fontWeight: 700, color: badge, backgroundColor: `${badge}1A`, border: `1px solid ${badge}55` }}>{meta.label}</span>
      </div>
      <button onClick={() => onEdit(care)} className="text-left mt-2">
        <p className="truncate" style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>{care.name}</p>
        <p style={{ fontSize: 11.5, color: care.status === 'over' ? t.danger : t.textMuted, marginTop: 2 }}>{last}{care.cycleDays ? ` · ${care.cycleDays}일 주기` : ''}</p>
      </button>
      <div className="flex-1" />
      <button onClick={() => { if (!doneToday) onDone(care.id); }}
        className="mt-2.5 flex items-center justify-center gap-1 rounded-xl py-2 active:scale-95 transition-transform"
        style={{ fontSize: 12.5, fontWeight: 700, color: doneToday ? t.success : '#fff', backgroundColor: doneToday ? `${t.success}1A` : t.accent, border: doneToday ? `1px solid ${t.success}55` : 'none', cursor: doneToday ? 'default' : 'pointer' }}>
        <Check size={14} /> {doneToday ? '오늘 완료' : '오늘 했어요'}
      </button>
      {/* hover 편집 힌트 */}
      <button onClick={() => onEdit(care)} aria-label="수정"
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center"
        style={{ width: 26, height: 26, color: t.textSub, backgroundColor: t.card, border: `1px solid ${t.border}`, transition: 'opacity 0.15s ease' }}>
        <Pencil size={13} />
      </button>
    </div>
  );
}

// PC 보유함 카드 (hover 로 재구매/보관 빠른 액션)
function ProductCardPC({ p, onOpen, onRepurchase, onSetActive }: {
  p: BeautyProduct; onOpen: (p: BeautyProduct) => void; onRepurchase: (p: BeautyProduct) => void; onSetActive: (id: string, a: boolean) => void;
}) {
  const { t } = useTheme();
  const info = productExpiry(p);
  const expColor = info ? (info.tier === 'fresh' ? t.success : t.danger) : t.textMuted;
  return (
    <div className="group relative rounded-2xl p-2.5 flex flex-col"
      style={{ backgroundColor: t.bgSub, border: `1px solid ${info?.tier === 'expired' ? `${t.danger}55` : t.borderLight}`, opacity: p.isActive ? 1 : 0.5 }}>
      <button onClick={() => onOpen(p)} className="text-left">
        <div className="rounded-xl overflow-hidden flex items-center justify-center mb-2" style={{ width: '100%', aspectRatio: '1 / 1', backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          {p.photoUrl ? <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-hidden style={{ fontSize: 30 }}>{categoryEmoji(p.category)}</span>}
        </div>
        {p.brand && <span className="truncate block" style={{ fontSize: 10.5, color: t.textMuted }}>{p.brand}</span>}
        <span className="truncate block" style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.25 }}>{p.name}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: expColor, marginTop: 2, display: 'block' }}>
          {info ? (info.remaining <= 0 ? '기한 지남' : `D-${info.remaining}`) : '개봉일 미입력'}
        </span>
      </button>
      {/* hover 빠른 액션 */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1" style={{ transition: 'opacity 0.15s ease' }}>
        {p.isActive ? (
          <>
            <button onClick={() => onRepurchase(p)} aria-label="또 샀어요" className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, color: '#fff', backgroundColor: t.accent }}><RotateCcw size={13} /></button>
            <button onClick={() => onSetActive(p.id, false)} aria-label="보관" className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, color: t.textSub, backgroundColor: t.card, border: `1px solid ${t.border}` }}><Archive size={13} /></button>
          </>
        ) : (
          <button onClick={() => onSetActive(p.id, true)} aria-label="복원" className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, color: t.success, backgroundColor: t.card, border: `1px solid ${t.success}55` }}><ArchiveRestore size={13} /></button>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  const { t } = useTheme();
  return (
    <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
      <div style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: SERIF, color: accent ? t.accent : t.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export function BeautyCareDesktop() {
  const { t } = useTheme();
  const b = useBeauty();

  const [careSheet, setCareSheet] = useState<{ care: BeautySpecialCare | null } | null>(null);
  const [productSheet, setProductSheet] = useState<{ product: BeautyProduct | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deleteCareId, setDeleteCareId] = useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [cat, setCat] = useState('전체');
  const [toast, setToast] = useState<string | null>(null);
  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 1900); };

  const handlePhotoConfirm = (items: ExtractedItem[], photoUrl: string | null) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    items.forEach(it => b.addProduct({
      id: newId(), name: it.name, brand: it.brand ?? null, category: it.category ?? null,
      photoUrl: photoUrl ?? null, openedAt: today, expiryMonths: null,
      purchasePlace: null, price: null, link: null, memo: null, isActive: true,
    }));
    setPhotoOpen(false);
    notify(`${items.length}개 등록했어요`);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    b.activeProducts.forEach(p => { if (p.category?.trim()) set.add(p.category.trim()); });
    return ['전체', ...Array.from(set)];
  }, [b.activeProducts]);

  const shownProducts = useMemo(() => {
    const filtered = cat === '전체' ? b.activeProducts : b.activeProducts.filter(p => (p.category?.trim() ?? '') === cat);
    return [...filtered].sort((a, x) => {
      const ea = productExpiry(a), ex = productExpiry(x);
      if (ea && ex) return ea.remaining - ex.remaining;
      if (ea) return -1; if (ex) return 1;
      return a.name.localeCompare(x.name);
    });
  }, [b.activeProducts, cat]);

  const imminentCount = useMemo(
    () => b.activeProducts.filter(p => { const i = productExpiry(p); return i && (i.tier === 'soon' || i.tier === 'expired'); }).length,
    [b.activeProducts],
  );
  const overCount = useMemo(() => b.specialCares.filter(c => c.status === 'over').length, [b.specialCares]);

  return (
    <div className="w-full px-6 pt-6 pb-10" style={{ fontFamily: t.fontBody }}>
      {/* 헤더 */}
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, color: t.text, lineHeight: 1.1 }}>케어</h1>
          <p style={{ fontSize: 13.5, color: t.textSub, marginTop: 3 }}>잘 돌보고 있는지, 하온이 지켜볼게요</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPhotoOpen(true)} className="flex items-center gap-1.5 rounded-full" style={{ fontSize: 13.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, padding: '8px 14px' }}>
            <Camera size={16} /> 사진으로
          </button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-full" style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', backgroundColor: t.accent, padding: '8px 16px' }}>
            <Plus size={16} /> 추가
          </button>
        </div>
      </div>

      {/* 히어로 2열: 게이지 + 요약 통계 */}
      <div className="grid gap-4 items-stretch" style={{ gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)' }}>
        {b.loading ? <div className="rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }} />
          : <SelfCareGauge score={b.selfCareScore} recentCareCount={b.recentCareCount} spark={b.careSpark} careCount={b.specialCares.length} />}
        <DCard>
          <DCardHeader title="한눈에" />
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <StatBox label="이번 주 케어" value={<>{b.recentCareCount}<span style={{ fontSize: 14 }}>회</span></>} accent />
            <StatBox label="스페셜케어" value={<>{b.specialCares.length}<span style={{ fontSize: 14 }}>개</span></>} />
            <StatBox label="보유 화장품" value={<>{b.activeProducts.length}<span style={{ fontSize: 14 }}>개</span></>} />
            <StatBox label="사용기한 임박" value={<>{imminentCount}<span style={{ fontSize: 14 }}>개</span></>} accent={imminentCount > 0} />
          </div>
          {overCount > 0 && (
            <p style={{ fontFamily: t.fontDecoratePen, fontSize: 20, color: t.danger, marginTop: 12 }}>{/* 손글씨 장식 */}
              주기 지난 케어 {overCount}개 — 슬슬 챙겨줄까요?
            </p>
          )}
        </DCard>
      </div>

      {/* 본문 2단: 좌 스페셜케어 / 우 보유함 */}
      <div className="grid gap-4 mt-4 items-start" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)' }}>
        {/* 스페셜케어 */}
        <DCard className="min-w-0">
          <DCardHeader title="스페셜케어" action={
            <button onClick={() => setCareSheet({ care: null })} className="flex items-center gap-1 rounded-full" style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, padding: '6px 12px' }}><Plus size={14} /> 추가</button>
          } />
          {b.specialCares.length === 0 ? (
            <EmptyInline icon={<Sparkles size={20} style={{ color: t.accent }} />} text="모공팩·발각질처럼 가끔 챙기는 케어를 추가해 보세요" />
          ) : (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              {b.specialCares.map(c => (
                <CareCardPC key={c.id} care={c}
                  onDone={(id) => { b.markCareDone(id); notify('오늘 케어 완료!'); }}
                  onEdit={(care) => setCareSheet({ care })} />
              ))}
            </div>
          )}
        </DCard>

        {/* 화장품 보유함 */}
        <DCard className="min-w-0">
          <DCardHeader title="화장품 보유함" action={
            <button onClick={() => setProductSheet({ product: null })} className="flex items-center gap-1 rounded-full" style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, padding: '6px 12px' }}><Plus size={14} /> 추가</button>
          } />
          {/* 카테고리 필터 칩 */}
          {b.activeProducts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map(c => (
                <button key={c} onClick={() => setCat(c)} style={{ fontSize: 12.5, fontWeight: 700, color: cat === c ? '#fff' : t.textSub, backgroundColor: cat === c ? t.accent : t.bgSub, border: `1px solid ${cat === c ? t.accent : t.borderLight}`, padding: '5px 12px', borderRadius: 999 }}>{c}</button>
              ))}
            </div>
          )}
          {b.activeProducts.length === 0 ? (
            <EmptyInline icon={<span style={{ fontSize: 22 }}>💖</span>} text="보유한 화장품을 등록하면 사용기한을 챙겨드려요" />
          ) : (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {shownProducts.map(p => (
                <ProductCardPC key={p.id} p={p}
                  onOpen={(pp) => setProductSheet({ product: pp })}
                  onRepurchase={(pp) => { b.repurchase(pp); notify('또 샀어요 — 새로 등록했어요'); }}
                  onSetActive={(id, a) => { b.setProductActive(id, a); notify(a ? '복원했어요' : '보관함으로 옮겼어요'); }} />
              ))}
            </div>
          )}

          {/* 다 쓴 보관함 */}
          {b.archivedProducts.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-5 mb-2.5">
                <span style={{ fontSize: 13.5, fontWeight: 700, color: t.textSub }}>다 쓴 보관함</span>
                <span style={{ fontSize: 12, color: t.textMuted }}>{b.archivedProducts.length}</span>
                <div className="flex-1" style={{ height: 1, backgroundColor: t.borderLight }} />
              </div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {[...b.archivedProducts].sort((a, x) => a.name.localeCompare(x.name)).map(p => (
                  <ProductCardPC key={p.id} p={p}
                    onOpen={(pp) => setProductSheet({ product: pp })}
                    onRepurchase={(pp) => { b.repurchase(pp); notify('또 샀어요 — 새로 등록했어요'); }}
                    onSetActive={(id, a) => { b.setProductActive(id, a); notify(a ? '복원했어요' : '보관함으로 옮겼어요'); }} />
                ))}
              </div>
            </>
          )}
        </DCard>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 bottom-8 z-50 px-4 py-2.5 rounded-xl shadow-lg pointer-events-none"
          style={{ transform: 'translateX(-50%)', backgroundColor: t.text, color: t.bg, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      )}

      {/* 시트(반응형 → PC 중앙 모달) */}
      {careSheet && (
        <SpecialCareSheet care={careSheet.care}
          onSave={(item) => { careSheet.care ? b.editCare(item) : b.addCare(item); setCareSheet(null); notify(careSheet.care ? '수정했어요' : '추가했어요'); }}
          onDelete={careSheet.care ? (id) => setDeleteCareId(id) : undefined}
          onClose={() => setCareSheet(null)} />
      )}
      {productSheet && (
        <BeautyProductSheet product={productSheet.product}
          onSave={(item) => { productSheet.product ? b.editProduct(item) : b.addProduct(item); setProductSheet(null); notify(productSheet.product ? '수정했어요' : '추가했어요'); }}
          onRepurchase={productSheet.product ? (p) => { b.repurchase(p); setProductSheet(null); notify('또 샀어요 — 새로 등록했어요'); } : undefined}
          onSetActive={productSheet.product ? (id, active) => { b.setProductActive(id, active); setProductSheet(null); notify(active ? '복원했어요' : '보관함으로 옮겼어요'); } : undefined}
          onDelete={productSheet.product ? (id) => setDeleteProductId(id) : undefined}
          onClose={() => setProductSheet(null)} />
      )}
      {addOpen && (
        <BeautyAddSheet
          onPickProduct={() => setProductSheet({ product: null })}
          onPickCare={() => setCareSheet({ care: null })}
          onPickPhoto={() => setPhotoOpen(true)}
          onClose={() => setAddOpen(false)} />
      )}
      {photoOpen && (
        <PhotoCaptureSheet domain="beauty"
          onConfirm={handlePhotoConfirm}
          onManualFallback={() => { setPhotoOpen(false); setProductSheet({ product: null }); }}
          onClose={() => setPhotoOpen(false)} />
      )}
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

function EmptyInline({ icon, text }: { icon: React.ReactNode; text: string }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: '28px 20px' }}>
      <div className="flex items-center justify-center mb-2.5" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: t.accentLight }}>{icon}</div>
      <p style={{ fontSize: 13.5, color: t.textSub }}>{text}</p>
    </div>
  );
}
