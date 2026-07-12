// 뷰티 케어 — 화장품 보유함 (Stage 5, 모바일).
//  · 미리보기: 가로 스크롤 한 줄(사용기한 임박순). "전체 보기" → 전체 그리드 오버레이(3열, 카테고리 필터 + 임박순).
//  · 전체보기는 새 라우트 없이 부모(BeautyCareMobile)의 내부 상태 토글로 띄운다.
//  · 카드 탭 → onOpen(product) → 부모가 BeautyProductSheet 오픈.
//  · 사용기한 잔여는 개봉일(openedAt)+사용기한(expiryMonths, PAO) 기반으로 이 파일의 순수 헬퍼가 계산.
//    careUtils 에는 제품 만료 계산이 없어 여기서 로컬 헬퍼로 둔다(careStatus 등 기존 로직은 미수정).
import { useMemo, useState } from 'react';
import { X, ChevronLeft, Plus } from 'lucide-react';
import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import { useTheme } from '../../ThemeContext';
import type { BeautyProduct } from '../../store';

// 카테고리 → 플레이스홀더 이모지(사진 없을 때)
export function categoryEmoji(category?: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (/스킨|토너|로션|에센스|세럼|크림|수분|보습/.test(c)) return '🧴';
  if (/선|자외선|spf/.test(c)) return '☀️';
  if (/클렌|폼|세안|클렌징/.test(c)) return '🫧';
  if (/메이크|쿠션|파운|립|틴트|섀도|마스카라/.test(c)) return '💄';
  if (/향수|퍼퓸/.test(c)) return '🌸';
  if (/바디|샤워|핸드/.test(c)) return '🧼';
  if (/헤어|샴푸|트리트/.test(c)) return '💆‍♀️';
  if (/팩|마스크/.test(c)) return '🧖‍♀️';
  return '💖';
}

export type ExpiryTier = 'fresh' | 'soon' | 'expired';
export interface ExpiryInfo { total: number; remaining: number; fill: number; tier: ExpiryTier; }

// 개봉 후 사용기한 잔여. 개봉일/사용기한이 없으면 null(= 알 수 없음).
export function productExpiry(p: Pick<BeautyProduct, 'openedAt' | 'expiryMonths'>): ExpiryInfo | null {
  if (!p.openedAt || !p.expiryMonths || p.expiryMonths <= 0) return null;
  const opened = parseISO(p.openedAt);
  const expiry = addMonths(opened, p.expiryMonths);
  const total = differenceInCalendarDays(expiry, opened);
  const remaining = differenceInCalendarDays(expiry, new Date());
  const fill = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const tier: ExpiryTier = remaining <= 0 ? 'expired' : remaining <= 30 ? 'soon' : 'fresh';
  return { total, remaining, fill, tier };
}

// 임박순 정렬: 기한 임박(잔여 적음) 먼저, 기한 미입력은 뒤로.
function byImminence(a: BeautyProduct, b: BeautyProduct): number {
  const ea = productExpiry(a), eb = productExpiry(b);
  if (ea && eb) return ea.remaining - eb.remaining;
  if (ea) return -1;
  if (eb) return 1;
  return a.name.localeCompare(b.name);
}

function ExpiryBar({ info }: { info: ExpiryInfo | null }) {
  const { t } = useTheme();
  if (!info) {
    return <span style={{ fontSize: 10.5, color: t.textMuted }}>개봉일 미입력</span>;
  }
  const color = info.tier === 'expired' ? t.danger : info.tier === 'soon' ? t.danger : t.success;
  const label = info.remaining <= 0 ? '기한 지남' : `D-${info.remaining}`;
  return (
    <div className="w-full">
      <div className="rounded-full overflow-hidden" style={{ height: 5, backgroundColor: t.bgSub }}>
        <div style={{ width: `${info.fill * 100}%`, height: '100%', backgroundColor: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: info.tier === 'fresh' ? t.textMuted : t.danger, marginTop: 3, display: 'block' }}>
        {label}
      </span>
    </div>
  );
}

// 보유함 카드 (미리보기/그리드 공용)
function ProductCard({ product, onOpen, width }: {
  product: BeautyProduct; onOpen: (p: BeautyProduct) => void; width?: number;
}) {
  const { t } = useTheme();
  const info = productExpiry(product);
  const archived = !product.isActive;

  return (
    <button onClick={() => onOpen(product)}
      className="text-left rounded-2xl p-2.5 flex flex-col active:scale-[0.98] transition-transform"
      style={{
        width, flexShrink: 0,
        backgroundColor: t.card, border: `1px solid ${info?.tier === 'expired' ? `${t.danger}55` : t.border}`,
        boxShadow: t.shadow, opacity: archived ? 0.5 : 1,
      }}>
      {/* 썸네일 */}
      <div className="rounded-xl overflow-hidden flex items-center justify-center mb-2"
        style={{ width: '100%', aspectRatio: '1 / 1', backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        {product.photoUrl
          ? <img src={product.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span aria-hidden style={{ fontSize: 30 }}>{categoryEmoji(product.category)}</span>}
      </div>
      {product.brand && <span className="truncate" style={{ fontSize: 10.5, color: t.textMuted }}>{product.brand}</span>}
      <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.25 }}>{product.name}</span>
      <div className="mt-1.5"><ExpiryBar info={info} /></div>
    </button>
  );
}

// ── 미리보기 섹션(가로 스크롤) ──
export function BeautyShelfPreview({ products, onOpen, onAdd }: {
  products: BeautyProduct[];           // active 만 넘겨받음
  onOpen: (p: BeautyProduct) => void;
  onAdd: () => void;
}) {
  const { t } = useTheme();
  const sorted = useMemo(() => [...products].sort(byImminence), [products]);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center rounded-2xl"
        style={{ padding: '26px 20px', backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <span aria-hidden style={{ fontSize: 30 }}>💖</span>
        <p style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 6 }}>보유한 화장품을 등록해 보세요</p>
        <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>개봉일과 사용기한을 적으면 기한을 챙겨드려요</p>
        <button onClick={onAdd} className="mt-3.5 flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
          <Plus size={15} /> 화장품 추가
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <style>{`.bc-hscroll::-webkit-scrollbar{display:none}`}</style>
      <div className="bc-hscroll flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {sorted.map(p => <ProductCard key={p.id} product={p} onOpen={onOpen} width={118} />)}
        {/* 추가 카드 */}
        <button onClick={onAdd}
          className="flex flex-col items-center justify-center rounded-2xl flex-shrink-0 active:scale-95 transition-transform"
          style={{ width: 118, backgroundColor: t.card, border: `1.5px dashed ${t.border}`, color: t.textSub }}>
          <Plus size={22} />
          <span style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>추가</span>
        </button>
      </div>
    </div>
  );
}

// ── 전체 보기 오버레이(3열 그리드 + 카테고리 필터) ──
export function BeautyShelfFull({ active, archived, onOpen, onClose, onAdd }: {
  active: BeautyProduct[];
  archived: BeautyProduct[];
  onOpen: (p: BeautyProduct) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const { t } = useTheme();
  const [cat, setCat] = useState<string>('전체');

  const categories = useMemo(() => {
    const set = new Set<string>();
    active.forEach(p => { if (p.category?.trim()) set.add(p.category.trim()); });
    return ['전체', ...Array.from(set)];
  }, [active]);

  const shown = useMemo(() => {
    const filtered = cat === '전체' ? active : active.filter(p => (p.category?.trim() ?? '') === cat);
    return [...filtered].sort(byImminence);
  }, [active, cat]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: t.bg }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 pb-3 sticky top-0 z-10"
        style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)', borderBottom: `1px solid ${t.borderLight}` }}>
        <button type="button" onClick={onClose} className="p-1.5 -ml-1.5 rounded-lg lg:hidden" style={{ color: t.textSub }} aria-label="뒤로">
          <ChevronLeft size={22} />
        </button>
        <h2 className="flex-1" style={{ fontFamily: t.fontPageTitle, fontSize: 22, color: t.text }}>화장품 보유함</h2>{/* 전체화면 오버레이 최상위 제목 */}
        <button type="button" onClick={onClose} className="hidden lg:block p-1.5 rounded-lg" style={{ color: t.textMuted }} aria-label="닫기">
          <X size={18} />
        </button>
        <button onClick={onAdd} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
          <Plus size={15} /> 추가
        </button>
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="bc-hscroll flex gap-2 overflow-x-auto px-4 py-3" style={{ scrollbarWidth: 'none' }}>
        {categories.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full"
            style={{
              fontSize: 12.5, fontWeight: 700,
              color: cat === c ? '#fff' : t.textSub,
              backgroundColor: cat === c ? t.accent : t.card,
              border: `1px solid ${cat === c ? t.accent : t.border}`,
            }}>{c}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* 사용 중 그리드 */}
        {shown.length === 0 ? (
          <p className="text-center py-10" style={{ fontSize: 13, color: t.textMuted }}>이 카테고리에 제품이 없어요</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {shown.map(p => <ProductCard key={p.id} product={p} onOpen={onOpen} />)}
          </div>
        )}

        {/* 다 쓴 보관함 */}
        {archived.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-6 mb-2.5">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.textSub }}>다 쓴 보관함</h3>
              <span style={{ fontSize: 12, color: t.textMuted }}>{archived.length}</span>
              <div className="flex-1" style={{ height: 1, backgroundColor: t.borderLight }} />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[...archived].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                <ProductCard key={p.id} product={p} onOpen={onOpen} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
