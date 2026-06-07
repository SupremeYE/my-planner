import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Plus, Youtube, Instagram, Globe, MessageCircle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { Scrap, ScrapSource, ScrapStatus } from '../store';
import AddScrapModal from './scrap/AddScrapModal';
import ScrapDetailSheet from './scrap/ScrapDetailSheet';

// 토큰 hex → rgba (다른 뷰들과 동일 패턴)
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── 출처 메타 (라벨 / 아이콘) ────────────────────────────────────────
// 색은 토큰에서 뽑되, 출처별 그라데이션은 t.accent / t.accentLight 의 알파 변형으로 구성
// → 새 hex 추가 없음. 출처별 인상만 다르게.
const SOURCE_META: Record<ScrapSource, { label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  youtube:   { label: '유튜브', Icon: Youtube },
  instagram: { label: '인스타', Icon: Instagram },
  threads:   { label: '스레드', Icon: MessageCircle },
  web:       { label: '웹',     Icon: Globe },
};

// 출처 필터 칩 키. 'all' 은 전체.
type SourceFilter = 'all' | ScrapSource;
const FILTER_ORDER: SourceFilter[] = ['all', 'youtube', 'instagram', 'threads', 'web'];
const FILTER_LABELS: Record<SourceFilter, string> = {
  all: '전체',
  youtube: '유튜브',
  instagram: '인스타',
  threads: '스레드',
  web: '웹',
};

// 상태 점 색상 — 토큰만
function statusDotColor(status: ScrapStatus, t: ReturnType<typeof useTheme>['t']): string {
  if (status === 'done') return t.success;
  if (status === 'revisit') return t.accent;
  return t.textMuted; // unread
}

// ── 필터 칩 ──────────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        fontSize: 13,
        fontWeight: 600,
        padding: '7px 14px',
        borderRadius: 999,
        backgroundColor: active ? t.text : 'transparent',
        color: active ? t.card : t.textSub,
        border: `1px solid ${active ? t.text : withAlpha(t.textMuted, 0.35)}`,
        whiteSpace: 'nowrap',
        transition: 'background-color .15s ease, color .15s ease',
      }}
    >
      {label}
    </button>
  );
}

// ── 카드 (메이슨리 column-flow 안의 한 셀) ─────────────────────────
function ScrapCard({ scrap, onClick }: { scrap: Scrap; onClick?: () => void }) {
  const { t } = useTheme();
  const meta = scrap.source ? SOURCE_META[scrap.source] : SOURCE_META.web;
  const Icon = meta.Icon;
  const hasImage = !!scrap.thumbnailUrl;

  return (
    <div
      onClick={onClick}
      style={{
        breakInside: 'avoid',
        marginBottom: 14,
        backgroundColor: t.card,
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${t.borderLight}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .18s ease, box-shadow .18s ease',
      }}
      className="scrap-card"
    >
      {/* 썸네일 영역 */}
      {hasImage ? (
        <div style={{ position: 'relative', backgroundColor: t.bgSub }}>
          <img
            src={scrap.thumbnailUrl!}
            alt={scrap.title ?? ''}
            loading="lazy"
            style={{ width: '100%', display: 'block', objectFit: 'cover' }}
          />
          {/* 좌상단 출처 칩 */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px 3px 6px',
              borderRadius: 999,
              backgroundColor: withAlpha(t.card, 0.92),
              backdropFilter: 'blur(6px)',
              color: t.textSub,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <Icon size={11} color={t.textSub} />
            {meta.label}
          </div>
          {/* 우상단 상태 점 (색만 — Stage 1 은 표시 전용, 전환은 Stage 2) */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: statusDotColor(scrap.status, t),
              boxShadow: '0 0 0 2px rgba(255,255,255,0.8)',
            }}
          />
        </div>
      ) : (
        // 썸네일 없음 — 출처별 그라데이션 + 큰 아이콘 placeholder (토큰만)
        <div
          style={{
            position: 'relative',
            aspectRatio: '4 / 3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${t.accentLight} 0%, ${withAlpha(t.accent, 0.18)} 100%)`,
          }}
        >
          <Icon size={36} color={t.accent} />
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px 3px 6px',
              borderRadius: 999,
              backgroundColor: withAlpha(t.card, 0.92),
              color: t.textSub,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <Icon size={11} color={t.textSub} />
            {meta.label}
          </div>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: statusDotColor(scrap.status, t),
              boxShadow: '0 0 0 2px rgba(255,255,255,0.8)',
            }}
          />
        </div>
      )}

      {/* 본문 */}
      <div style={{ padding: '10px 12px 12px' }}>
        {scrap.title && (
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.35,
              color: t.text,
              fontWeight: 600,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {scrap.title}
          </p>
        )}
        {scrap.comment && (
          <p
            style={{
              marginTop: 6,
              fontSize: 14,
              lineHeight: 1.3,
              color: t.textSub,
              fontFamily: 'var(--font-nanum-pen)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {scrap.comment}
          </p>
        )}
        {scrap.tags.length > 0 && (
          <div className="flex flex-wrap gap-1" style={{ marginTop: 8 }}>
            {scrap.tags.slice(0, 4).map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  color: t.textSub,
                  backgroundColor: t.bgSub,
                  padding: '2px 7px',
                  borderRadius: 999,
                  border: `1px solid ${t.borderLight}`,
                }}
              >
                #{tag}
              </span>
            ))}
            {scrap.tags.length > 4 && (
              <span style={{ fontSize: 10, color: t.textMuted, padding: '2px 4px' }}>
                +{scrap.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── /scraps — 본 화면 (Stage 1) ───────────────────────────────────
export function ScrapView() {
  const { t } = useTheme();
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  // Stage 2: 카드 탭 → 상세 시트 (현재 열린 스크랩 id)
  const [openId, setOpenId] = useState<string | null>(null);

  // 모든 supabase 호출은 db.ts 를 거쳐서만 (Stage 1 규칙)
  const refresh = useCallback(async () => {
    const data = await db.scraps.listByUser();
    setScraps(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime 구독 — insert/update/delete 모두 자동 refresh (CLAUDE.md 규칙)
  // scrap_notes 구독은 Stage 2 에서 추가
  useRealtimeSync('scraps', refresh);

  const filtered = useMemo(() => {
    if (filter === 'all') return scraps;
    return scraps.filter(s => s.source === filter);
  }, [scraps, filter]);

  const handleAddClick = useCallback(() => setModalOpen(true), []);
  const handleCardClick = useCallback((id: string) => setOpenId(id), []);

  // 상세 시트 대상 — openId 가 가리키는 최신 스크랩 (낙관적 업데이트는 시트 내부에서 처리)
  const openScrap = useMemo(
    () => (openId ? scraps.find(s => s.id === openId) ?? null : null),
    [openId, scraps],
  );

  return (
    <div className="h-full overflow-y-auto relative" style={{ backgroundColor: t.bg }}>
      {/* 메이슨리 column 폭 — 모바일 2열, lg 3열, xl 4열 */}
      <style>{`
        .scrap-grid { column-count: 2; column-gap: 12px; padding: 16px 24px 0; }
        @media (min-width: 1024px) { .scrap-grid { column-count: 3; column-gap: 18px; padding: 20px 56px 0; } }
        @media (min-width: 1440px) { .scrap-grid { column-count: 4; } }
        .scrap-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.10) !important; }
      `}</style>

      {/* ── 헤더 ── */}
      <header className="px-6 lg:px-14 pt-12 lg:pt-12 pb-2">
        <div className="flex items-center gap-2" style={{ color: t.accent }}>
          <Bookmark size={16} strokeWidth={2.2} />
          <span
            style={{
              fontFamily: 'var(--font-nanum-pen)',
              fontSize: 22,
              letterSpacing: 0.5,
              lineHeight: 1,
            }}
            className="lg:text-[26px]"
          >
            inspiration
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 40,
            lineHeight: 1,
            marginTop: 6,
            color: t.text,
          }}
          className="lg:text-[54px]"
        >
          스크랩
        </h1>
        <p
          style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5, marginTop: 8 }}
          className="lg:text-[14px]"
        >
          영감 보관함
        </p>
      </header>

      {/* ── 출처 필터 칩 (가로 스크롤) ── */}
      <div
        className="flex gap-2 overflow-x-auto px-6 lg:px-14 mt-5 pb-1"
        style={{ scrollbarWidth: 'none' as const }}
      >
        <style>{`.scrap-filters::-webkit-scrollbar{display:none;}`}</style>
        {FILTER_ORDER.map(f => (
          <FilterChip
            key={f}
            label={FILTER_LABELS[f]}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {/* ── 본문 ── */}
      <div className="scrap-grid" style={{ paddingBottom: 140 }}>
        {loading ? (
          // 로딩 — 단순 텍스트 (스켈레톤은 Stage 2)
          <div style={{ gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center', color: t.textMuted, fontSize: 12 }}>
            불러오는 중…
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              border: `1.5px dashed ${withAlpha(t.accentLight, 0.9)}`,
              borderRadius: 16,
              backgroundColor: withAlpha(t.card, 0.6),
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '32px 20px',
              textAlign: 'center',
            }}
          >
            <Bookmark size={32} strokeWidth={1.4} color={t.accent} />
            <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
              {filter === 'all' ? '아직 스크랩이 없어요' : '이 출처에 저장된 스크랩이 없어요'}
            </p>
            <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5, maxWidth: 260 }}>
              우하단 + 버튼을 눌러 첫 스크랩을 추가해보세요.
            </p>
          </div>
        ) : (
          filtered.map(scrap => (
            <ScrapCard key={scrap.id} scrap={scrap} onClick={() => handleCardClick(scrap.id)} />
          ))
        )}
      </div>

      {/* ── FAB (확장형 라벨 버튼) ── */}
      <div
        className="fixed left-0 right-0 flex z-30 pointer-events-none justify-center lg:justify-end lg:pr-10"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
      >
        <button
          onClick={handleAddClick}
          className="pointer-events-auto flex items-center gap-2 transition-transform active:scale-95"
          style={{
            backgroundColor: t.accent,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            padding: '15px 26px',
            borderRadius: 999,
            boxShadow: `0 8px 22px ${withAlpha(t.accent, 0.4)}`,
            border: 'none',
          }}
          aria-label="스크랩 추가"
        >
          <Plus size={18} strokeWidth={2.4} />
          스크랩 추가
        </button>
      </div>

      {/* 추가 모달 */}
      {modalOpen && (
        <AddScrapModal
          onClose={() => setModalOpen(false)}
          onSaved={refresh}
        />
      )}

      {/* 상세 시트 — Stage 2 */}
      {openScrap && (
        <ScrapDetailSheet
          key={openScrap.id}
          scrap={openScrap}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
