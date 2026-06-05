import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import VisionFormModal from './vision/VisionFormModal';
import ConfirmModal from './ConfirmModal';

// ── 토큰 hex → rgba (Layout.tsx의 withAlpha와 동일 패턴, 토큰 기반 투명도 표현)
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Category = { id: string; name: string; sort_order: number; created_at: string };
type Item = {
  id: string;
  image_url: string | null;
  caption: string | null;
  category_id: string | null;
  sort_order: number;
  created_at: string;
};

// 폴라로이드 카드별 약한 회전각 (목업: -1.6° / +1.4° / -0.6° 순환)
const PIN_ROTATIONS = ['-1.6deg', '1.4deg', '-0.6deg'];

// ── 카드(폴라로이드) ────────────────────────────────────────────────
function VisionCard({ item, rotation, onClick }: { item: Item; rotation: string; onClick?: () => void }) {
  const { t } = useTheme();
  const hasImage = !!item.image_url;

  return (
    <div
      onClick={onClick}
      style={{
        breakInside: 'avoid',
        marginBottom: 18,
        background: t.card,                                  // 폴라로이드 흰 프레임 = 카드 토큰
        padding: '8px 8px 0',
        borderRadius: 3,
        boxShadow: '0 6px 18px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.10)',
        position: 'relative',
        transform: `rotate(${rotation})`,
        transition: 'transform .25s ease, box-shadow .25s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      className="vision-pin"
    >
      {/* 마스킹 테이프: 카드 상단 중앙, gold/accentLight 토큰 + 투명도 */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: -9,
          left: '50%',
          transform: 'translateX(-50%) rotate(-3deg)',
          width: 54,
          height: 20,
          backgroundColor: withAlpha(t.accentLight, 0.55),   // 토큰 기반 반투명 테이프
          borderLeft: '1px dashed rgba(255,255,255,0.5)',
          borderRight: '1px dashed rgba(255,255,255,0.5)',
        }}
        className="vision-tape"
      />

      {hasImage ? (
        <img
          src={item.image_url!}
          alt={item.caption ?? ''}
          loading="lazy"
          style={{
            width: '100%',
            display: 'block',
            borderRadius: 2,
            objectFit: 'cover',
            filter: 'saturate(.95)',
          }}
        />
      ) : (
        // 글만 카드: 종이 질감 톤 박스 + 가운데 캡션 (목업 비율과 비슷한 0.95 정도로)
        <div
          style={{
            width: '100%',
            aspectRatio: '0.95',
            borderRadius: 2,
            backgroundColor: t.bgSub,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 12px',
          }}
        >
          {item.caption ? (
            <p
              style={{
                fontFamily: 'var(--font-gaegu)',
                fontWeight: 700,
                fontSize: 18,
                color: t.text,
                textAlign: 'center',
                lineHeight: 1.35,
                wordBreak: 'keep-all',
              }}
            >
              {item.caption}
            </p>
          ) : (
            <ImageIcon size={28} color={t.textMuted} />
          )}
        </div>
      )}

      {/* 이미지가 있을 때만 하단 캡션 영역 */}
      {hasImage && item.caption && (
        <div
          style={{
            fontFamily: 'var(--font-gaegu)',
            fontWeight: 700,
            fontSize: 16,
            color: t.text,
            padding: '9px 4px 11px',
            lineHeight: 1.25,
            textAlign: 'center',
          }}
        >
          {item.caption}
        </div>
      )}
      {/* 이미지만 있고 캡션 없을 땐 하단 흰 여백 살짝 */}
      {hasImage && !item.caption && <div style={{ height: 10 }} />}
    </div>
  );
}

// ── 빈 상태 (필터 결과 0개) ────────────────────────────────────────
function VisionEmpty() {
  const { t } = useTheme();
  return (
    <div
      style={{
        breakInside: 'avoid',
        marginBottom: 18,
        border: `2px dashed ${withAlpha(t.accentLight, 0.9)}`,
        borderRadius: 8,
        backgroundColor: withAlpha(t.card, 0.6),
        aspectRatio: '0.82',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: t.accent,
      }}
    >
      <Plus size={30} strokeWidth={1.2} />
      <span style={{ fontSize: 12, color: t.textSub }}>비전을 추가해보세요</span>
    </div>
  );
}

// ── /vision — 비전보드 본 화면 (Phase 2) ───────────────────────────
export function VisionBoardView() {
  const { t } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null); // null = 전체
  const [loading, setLoading] = useState(true);
  // 모달 상태 (Phase 3)
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);

  const refresh = useCallback(async () => {
    const [cats, its] = await Promise.all([
      db.visionCategories.fetchAll(),
      db.visionItems.fetchAll(),
    ]);
    setCategories(cats);
    setItems(its);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  // PC↔모바일 즉시 반영 (CLAUDE.md Realtime 필수 원칙)
  useRealtimeSync('vision_categories', refresh);
  useRealtimeSync('vision_items', refresh);

  const filteredItems = useMemo(() => {
    if (!activeCategoryId) return items;
    return items.filter(it => it.category_id === activeCategoryId);
  }, [items, activeCategoryId]);

  const handleAddClick = useCallback(() => {
    setEditingItem(null);
    setModalOpen(true);
  }, []);

  const handleCardClick = useCallback((item: Item) => {
    setEditingItem(item);
    setModalOpen(true);
  }, []);

  const handleRequestDelete = useCallback((item: Item) => {
    setPendingDelete(item);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await db.visionItems.delete(pendingDelete.id);
    setPendingDelete(null);
    setModalOpen(false);
    setEditingItem(null);
    refresh();
  }, [pendingDelete, refresh]);

  return (
    <div
      className="h-full overflow-y-auto relative"
      style={{
        backgroundColor: t.bg,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    >
      {/* 폴라로이드 hover 효과 (CSS 모듈 없이 인라인 <style>) */}
      <style>{`
        .vision-pin:hover { transform: rotate(0deg) scale(1.02) !important; box-shadow: 0 12px 28px rgba(0,0,0,0.20) !important; z-index: 2; }
        .vision-board { column-count: 2; column-gap: 14px; padding: 14px 18px 0; }
        @media (min-width: 680px)  { .vision-board { column-count: 3; column-gap: 20px; padding: 18px 28px 0; } }
        @media (min-width: 1024px) { .vision-board { column-count: 4; column-gap: 24px; padding: 24px 56px 12px; } .vision-tape { width: 70px !important; } }
        @media (min-width: 1440px) { .vision-board { column-count: 5; } }
      `}</style>

      {/* ── 헤더 ── */}
      <header className="px-6 lg:px-14 pt-12 lg:pt-12 pb-2 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-2 lg:gap-4">
        <div className="flex flex-col">
          <span
            style={{
              fontFamily: 'var(--font-nanum-pen)',
              fontSize: 22,
              color: t.accent,
              letterSpacing: 0.5,
              lineHeight: 1,
            }}
            className="lg:text-[26px]"
          >
            becoming…
          </span>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 40,
              lineHeight: 1,
              marginTop: 2,
              color: t.text,
            }}
            className="lg:text-[54px]"
          >
            비전보드
          </h1>
        </div>
        <p
          style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}
          className="lg:text-right lg:max-w-[280px] lg:mt-0 mt-2"
        >
          되고 싶은 나, 살고 싶은 하루를<br />
          눈에 보이게 걸어둬요
        </p>
      </header>

      {/* ── 카테고리 필터 칩 ── */}
      <div
        className="flex gap-2 overflow-x-auto px-6 lg:px-14 pb-1 mt-5"
        style={{ scrollbarWidth: 'none' as const }}
      >
        <style>{`.vision-chips::-webkit-scrollbar{display:none;}`}</style>
        <FilterChip
          label="전체"
          active={activeCategoryId === null}
          onClick={() => setActiveCategoryId(null)}
        />
        {categories.map(c => (
          <FilterChip
            key={c.id}
            label={c.name}
            active={activeCategoryId === c.id}
            onClick={() => setActiveCategoryId(c.id)}
          />
        ))}
      </div>

      {/* ── 보드(메이슨리) ── */}
      <div className="vision-board" style={{ paddingBottom: 130 }}>
        {loading ? null : filteredItems.length === 0 ? (
          <VisionEmpty />
        ) : (
          filteredItems.map((item, idx) => (
            <VisionCard
              key={item.id}
              item={item}
              rotation={PIN_ROTATIONS[idx % PIN_ROTATIONS.length]}
              onClick={() => handleCardClick(item)}
            />
          ))
        )}
      </div>

      {/* ── FAB (코랄 토큰) ── */}
      <div
        className="fixed left-0 right-0 flex z-30 pointer-events-none justify-center lg:justify-end lg:pr-10"
        style={{
          // 모바일: 떠 있는 하단 알약(약 56px) + 12px 여백 + safe-area를 피해 위로
          bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
        }}
      >
        <button
          onClick={handleAddClick}
          className="pointer-events-auto flex items-center gap-2 transition-transform active:scale-95"
          style={{
            backgroundColor: t.accent,                   // 코랄 토큰
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            padding: '15px 26px',
            borderRadius: 999,
            boxShadow: `0 8px 22px ${withAlpha(t.accent, 0.4)}`,
            border: 'none',
          }}
        >
          <Plus size={18} strokeWidth={2.4} />
          비전 추가하기
        </button>
      </div>

      {/* 추가/편집 모달 */}
      {modalOpen && (
        <VisionFormModal
          item={editingItem}
          categories={categories}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          onSaved={refresh}
          onRequestDelete={handleRequestDelete}
        />
      )}

      {/* 삭제 확인 */}
      {pendingDelete && (
        <ConfirmModal
          message="이 비전을 삭제할까요?"
          description="삭제하면 되돌릴 수 없어요."
          confirmText="삭제"
          confirmDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// ── 필터 칩 ──
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        fontSize: 13,
        fontWeight: 500,
        padding: '8px 16px',
        borderRadius: 999,
        backgroundColor: active ? t.text : 'transparent',
        color: active ? t.card : t.textSub,
        border: `1px solid ${active ? t.text : withAlpha(t.textMuted, 0.35)}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
