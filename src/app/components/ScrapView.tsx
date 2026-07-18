import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Plus, Youtube, Instagram, Globe, MessageCircle, Search, Shuffle, X, Sparkles, Trash2, Check, CheckSquare } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { Scrap, ScrapSource, ScrapStatus } from '../store';
import AddScrapModal from './scrap/AddScrapModal';
import ScrapDetailSheet from './scrap/ScrapDetailSheet';
import ConfirmModal from './ConfirmModal';
import { useFabAction } from '../FabContext';

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

// ── 상단 우측 오버레이 컨트롤 (선택 체크박스 / 삭제 버튼) ──────────
// 선택 모드: 체크박스, 일반 모드: 삭제(휴지통) 버튼. 카드 탭과 분리(stopPropagation).
function CardCornerControl({
  selectionMode, selected, onDelete,
}: {
  selectionMode: boolean;
  selected: boolean;
  onDelete: () => void;
}) {
  const { t } = useTheme();
  if (selectionMode) {
    return (
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? t.accent : withAlpha(t.card, 0.92),
          border: `2px solid ${selected ? t.accent : withAlpha(t.textMuted, 0.5)}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {selected && <Check size={14} color="#fff" strokeWidth={3} />}
      </span>
    );
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onDelete(); }}
      aria-label="스크랩 삭제"
      className="scrap-del-btn"
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(t.card, 0.9),
        border: `1px solid ${t.borderLight}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(4px)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <Trash2 size={13} color={t.danger} />
    </button>
  );
}

// ── 카드 (메이슨리 column-flow 안의 한 셀) ─────────────────────────
function ScrapCard({
  scrap, onClick, selectionMode = false, selected = false, onToggleSelect, onDelete,
}: {
  scrap: Scrap;
  onClick?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTheme();
  const meta = scrap.source ? SOURCE_META[scrap.source] : SOURCE_META.web;
  const Icon = meta.Icon;
  const hasImage = !!scrap.thumbnailUrl;

  // 선택 모드에선 탭 = 선택 토글, 아니면 상세 열기
  const handleClick = selectionMode ? onToggleSelect : onClick;

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        breakInside: 'avoid',
        marginBottom: 14,
        backgroundColor: t.card,
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${selected ? t.accent : t.borderLight}`,
        boxShadow: selected ? `0 0 0 2px ${withAlpha(t.accent, 0.9)}` : '0 2px 8px rgba(0,0,0,0.05)',
        cursor: handleClick ? 'pointer' : 'default',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
      }}
      className="scrap-card"
    >
      {/* 상단 우측 컨트롤 — 선택 체크박스 / 삭제 버튼 */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 3 }}>
        <CardCornerControl
          selectionMode={selectionMode}
          selected={selected}
          onDelete={() => onDelete?.()}
        />
      </div>
      {/* 썸네일 영역 */}
      {hasImage ? (
        <div style={{ position: 'relative', backgroundColor: t.bgSub }}>
          <img
            src={scrap.thumbnailUrl!}
            alt={scrap.title ?? ''}
            loading="lazy"
            style={{ width: '100%', maxWidth: '100%', display: 'block', objectFit: 'cover' }}
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
            {/* 상태 점 (색만 — 표시 전용) — 우상단 컨트롤과 겹치지 않게 출처 칩 안으로 이동 */}
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: statusDotColor(scrap.status, t),
              }}
            />
          </div>
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
            {/* 상태 점 — 우상단 컨트롤과 겹치지 않게 출처 칩 안으로 이동 */}
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: statusDotColor(scrap.status, t),
              }}
            />
          </div>
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
              fontFamily: t.fontDecoratePen,
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

// ── 먼지 쌓인 스크랩 카드 (Stage 3) ───────────────────────────────
// "한참 안 들여다본 스크랩이에요" — 상단 가로 카드. 마스킹 테이프 + 미리보기 + 셔플 버튼.
function DustyResurfaceCard({
  scrap, canShuffle, onOpen, onShuffle,
}: {
  scrap: Scrap;
  canShuffle: boolean;
  onOpen: () => void;
  onShuffle: () => void;
}) {
  const { t } = useTheme();
  const meta = scrap.source ? SOURCE_META[scrap.source] : SOURCE_META.web;
  const Icon = meta.Icon;

  return (
    <div className="px-6 lg:px-14 mt-5">
      <div
        style={{
          position: 'relative',
          backgroundColor: t.card,
          border: `1px solid ${t.borderLight}`,
          borderRadius: 14,
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          padding: 12,
          paddingTop: 18,
          display: 'flex',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        {/* 마스킹 테이프 — 좌상단에 살짝 비스듬히 */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -8,
            left: 24,
            width: 78,
            height: 18,
            backgroundColor: withAlpha(t.accentLight, 0.95),
            borderTop: `1px solid ${withAlpha(t.accent, 0.25)}`,
            borderBottom: `1px solid ${withAlpha(t.accent, 0.25)}`,
            transform: 'rotate(-3deg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          }}
        />

        {/* 미리보기 썸네일 */}
        <button
          onClick={onOpen}
          aria-label={scrap.title ?? '스크랩 열기'}
          style={{
            flex: '0 0 auto',
            width: 84,
            height: 84,
            borderRadius: 10,
            overflow: 'hidden',
            border: `1px solid ${t.borderLight}`,
            backgroundColor: t.bgSub,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {scrap.thumbnailUrl ? (
            <img
              src={scrap.thumbnailUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${t.accentLight} 0%, ${withAlpha(t.accent, 0.2)} 100%)`,
              }}
            >
              <Icon size={24} color={t.accent} />
            </div>
          )}
        </button>

        {/* 본문 */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ paddingTop: 2 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: t.accent,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Sparkles size={11} />
            한참 안 들여다본 스크랩이에요
          </div>
          <button
            onClick={onOpen}
            style={{
              marginTop: 4,
              fontSize: 13,
              lineHeight: 1.35,
              color: t.text,
              fontWeight: 600,
              textAlign: 'left',
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {scrap.title ?? scrap.url ?? '제목 없는 스크랩'}
          </button>
          <div
            className="mt-auto flex items-center justify-between gap-2"
            style={{ paddingTop: 8 }}
          >
            <span
              style={{
                fontSize: 10,
                color: t.textMuted,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon size={10} color={t.textMuted} />
              {meta.label}
            </span>
            <button
              onClick={onShuffle}
              disabled={!canShuffle}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: canShuffle ? t.accent : t.textMuted,
                padding: '5px 10px',
                borderRadius: 999,
                backgroundColor: canShuffle ? t.accentLight : t.bgSub,
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: canShuffle ? 'pointer' : 'not-allowed',
                opacity: canShuffle ? 1 : 0.6,
              }}
            >
              <Shuffle size={11} />
              다른 거 보여줘
            </button>
          </div>
        </div>
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

  // ── Stage 3: 검색 + 안 본 것만 토글 + 먼지 쌓인 스크랩 ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Scrap[] | null>(null); // null=검색 안 함, []=검색했는데 없음
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [dustyCandidates, setDustyCandidates] = useState<Scrap[]>([]);
  const [dustyIndex, setDustyIndex] = useState(0);

  // ── 삭제 / 선택 모드 ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Scrap | null>(null); // 개별 삭제 확인 대상
  const [confirmBulk, setConfirmBulk] = useState(false);                   // 일괄 삭제 확인
  const [deleting, setDeleting] = useState(false);

  // 모든 supabase 호출은 db.ts 를 거쳐서만 (Stage 1 규칙)
  // 본 목록 + 먼지 후보를 함께 갱신해서 last_viewed_at 변경에 따라 먼지 후보도 자연 빠짐.
  const refresh = useCallback(async () => {
    const [data, dusty] = await Promise.all([
      db.scraps.listByUser(),
      db.scraps.listDusty(),
    ]);
    setScraps(data);
    setDustyCandidates(dusty);
    setDustyIndex(prev => (dusty.length === 0 ? 0 : Math.min(prev, dusty.length - 1)));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime 구독 — insert/update/delete 모두 자동 refresh (CLAUDE.md 규칙)
  // scrap_notes 구독은 Stage 2 상세 시트 내부에서 (열린 동안만)
  useRealtimeSync('scraps', refresh);

  // 검색 — db.ts.search 디바운스(200ms). 빈 문자열은 null 로 두어 전체 목록 사용.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); return; }
    const handle = setTimeout(async () => {
      const results = await db.scraps.search(q);
      setSearchResults(results);
    }, 200);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // 그리드용 베이스 — 검색 중이면 검색 결과, 아니면 전체. 그 위에 출처 + 안 본 것만 AND 결합.
  const filtered = useMemo(() => {
    const base = searchResults ?? scraps;
    return base.filter(s => {
      if (filter !== 'all' && s.source !== filter) return false;
      if (onlyUnread && s.status !== 'unread') return false;
      return true;
    });
  }, [scraps, searchResults, filter, onlyUnread]);

  const handleAddClick = useCallback(() => setModalOpen(true), []);
  // 전역 FAB — 스크랩 추가
  useFabAction({ kind: 'action', label: '스크랩 추가', icon: Plus, onPress: handleAddClick });
  const handleCardClick = useCallback((id: string) => setOpenId(id), []);
  const handleClearSearch = useCallback(() => { setSearchQuery(''); setSearchResults(null); }, []);

  // 셔플 — 후보 안에서 다른 인덱스로 교체. 후보 1개 이하면 동작 안 함.
  const handleShuffleDusty = useCallback(() => {
    setDustyIndex(prev => {
      if (dustyCandidates.length <= 1) return prev;
      let next = prev;
      while (next === prev) next = Math.floor(Math.random() * dustyCandidates.length);
      return next;
    });
  }, [dustyCandidates.length]);

  // ── 선택 모드 핸들러 ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // 현재 보이는(필터 적용된) 스크랩 전체 선택/해제 토글
  const filteredIds = useMemo(() => filtered.map(s => s.id), [filtered]);
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
  const handleSelectAllVisible = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (filteredIds.every(id => next.has(id))) {
        // 모두 선택돼 있으면 → 해제
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [filteredIds]);

  // 개별 삭제 확정
  const confirmSingleDelete = useCallback(async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await db.scraps.delete(pendingDelete.id);
      setSelectedIds(prev => {
        if (!prev.has(pendingDelete.id)) return prev;
        const next = new Set(prev);
        next.delete(pendingDelete.id);
        return next;
      });
      if (openId === pendingDelete.id) setOpenId(null);
      setPendingDelete(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, deleting, openId, refresh]);

  // 선택 항목 일괄 삭제 확정
  const confirmBulkDelete = useCallback(async () => {
    if (deleting || selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => db.scraps.delete(id)));
      setConfirmBulk(false);
      exitSelection();
      await refresh();
    } finally {
      setDeleting(false);
    }
  }, [deleting, selectedIds, exitSelection, refresh]);

  // 상세 시트 대상 — openId 가 가리키는 최신 스크랩. scraps 에 없으면 검색결과/먼지후보에서 보조 조회.
  const openScrap = useMemo(() => {
    if (!openId) return null;
    return (
      scraps.find(s => s.id === openId)
      ?? (searchResults?.find(s => s.id === openId) ?? null)
      ?? dustyCandidates.find(s => s.id === openId)
      ?? null
    );
  }, [openId, scraps, searchResults, dustyCandidates]);

  // 현재 먼지 카드에 표시할 스크랩 — 검색 중이거나 카드 없으면 숨김.
  const dustyScrap = useMemo(() => {
    if (searchResults !== null) return null; // 검색 중엔 숨김
    if (dustyCandidates.length === 0) return null;
    return dustyCandidates[Math.min(dustyIndex, dustyCandidates.length - 1)] ?? null;
  }, [dustyCandidates, dustyIndex, searchResults]);

  return (
    <div className="h-full overflow-y-auto relative" style={{ backgroundColor: t.bg, overflowX: 'clip' }}>
      {/* 메이슨리 column 폭 — 모바일 2열, lg 3열, xl 4열 */}
      <style>{`
        .scrap-grid { column-count: 2; column-gap: 12px; padding: 16px 24px 0; }
        @media (min-width: 1024px) { .scrap-grid { column-count: 3; column-gap: 18px; padding: 20px 56px 0; } }
        @media (min-width: 1440px) { .scrap-grid { column-count: 4; } }
        .scrap-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.10) !important; }
        .scrap-del-btn { opacity: 0.75; transition: opacity .15s ease, transform .15s ease; }
        .scrap-card:hover .scrap-del-btn { opacity: 1; }
        .scrap-del-btn:hover { transform: scale(1.08); }
      `}</style>

      {/* ── 헤더 ── */}
      <header className="px-6 lg:px-14 pt-12 lg:pt-12 pb-2">
        <div className="flex items-center gap-2" style={{ color: t.accent }}>
          <Bookmark size={16} strokeWidth={2.2} />
          <span
            style={{
              fontFamily: t.fontDecoratePen,
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
            fontFamily: t.fontPageTitle, // 페이지 최상위 제목
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

      {/* ── 검색창 + 안 본 것만 토글 (Stage 3) ── */}
      <div className="px-6 lg:px-14 mt-5 flex items-center gap-2">
        <div
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-full"
          style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}
        >
          <Search size={14} color={t.textMuted} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="제목·코멘트·태그로 찾기"
            style={{
              flex: 1,
              minWidth: 0,
              backgroundColor: 'transparent',
              color: t.text,
              fontSize: 13,
              outline: 'none',
              border: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              aria-label="검색 지우기"
              style={{ padding: 2, display: 'inline-flex', color: t.textMuted }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          onClick={() => setOnlyUnread(v => !v)}
          aria-pressed={onlyUnread}
          style={{
            flex: '0 0 auto',
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 12px',
            borderRadius: 999,
            backgroundColor: onlyUnread ? t.accent : 'transparent',
            color: onlyUnread ? '#fff' : t.textSub,
            border: `1px solid ${onlyUnread ? t.accent : withAlpha(t.textMuted, 0.35)}`,
            whiteSpace: 'nowrap',
            transition: 'background-color .15s ease, color .15s ease',
          }}
        >
          안 본 것만
        </button>
        {/* 선택 모드 토글 — 다중 선택 삭제 진입/종료 */}
        <button
          onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
          aria-pressed={selectionMode}
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 12px',
            borderRadius: 999,
            backgroundColor: selectionMode ? t.text : 'transparent',
            color: selectionMode ? t.card : t.textSub,
            border: `1px solid ${selectionMode ? t.text : withAlpha(t.textMuted, 0.35)}`,
            whiteSpace: 'nowrap',
            transition: 'background-color .15s ease, color .15s ease',
          }}
        >
          <CheckSquare size={13} />
          {selectionMode ? '완료' : '선택'}
        </button>
      </div>

      {/* ── 먼지 쌓인 스크랩 카드 (Stage 3) — 검색 중엔 숨김, 후보 없으면 숨김 ── */}
      {dustyScrap && (
        <DustyResurfaceCard
          scrap={dustyScrap}
          canShuffle={dustyCandidates.length > 1}
          onOpen={() => handleCardClick(dustyScrap.id)}
          onShuffle={handleShuffleDusty}
        />
      )}

      {/* ── 출처 필터 칩 (가로 스크롤) ── */}
      <div
        className="flex gap-2 overflow-x-auto px-6 lg:px-14 mt-4 pb-1"
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
              {searchResults !== null
                ? '검색 결과가 없어요'
                : onlyUnread
                ? '안 본 스크랩이 없어요'
                : filter === 'all'
                ? '아직 스크랩이 없어요'
                : '이 출처에 저장된 스크랩이 없어요'}
            </p>
            <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5, maxWidth: 260 }}>
              {searchResults !== null
                ? '다른 단어로 다시 찾아보세요.'
                : onlyUnread
                ? '모두 한 번씩 들여다봤거나, 다시봄·소화완료 상태예요.'
                : '우하단 + 버튼을 눌러 첫 스크랩을 추가해보세요.'}
            </p>
          </div>
        ) : (
          filtered.map(scrap => (
            <ScrapCard
              key={scrap.id}
              scrap={scrap}
              onClick={() => handleCardClick(scrap.id)}
              selectionMode={selectionMode}
              selected={selectedIds.has(scrap.id)}
              onToggleSelect={() => toggleSelect(scrap.id)}
              onDelete={() => setPendingDelete(scrap)}
            />
          ))
        )}
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
          onNavigateScrap={(id) => setOpenId(id)}
        />
      )}

      {/* ── 선택 모드 하단 액션 바 — 모바일 하단 네비(56px) 위에 띄움 ── */}
      {selectionMode && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 bottom-20 lg:bottom-6 w-[calc(100%-32px)] max-w-[440px]"
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-full"
            style={{
              backgroundColor: t.card,
              border: `1px solid ${t.borderLight}`,
              boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
            }}
          >
            <span style={{ flex: '0 0 auto', fontSize: 13, fontWeight: 700, color: t.text, paddingLeft: 6 }}>
              {selectedIds.size}개 선택
            </span>
            <button
              onClick={handleSelectAllVisible}
              disabled={filteredIds.length === 0}
              style={{
                flex: '0 0 auto',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 999,
                backgroundColor: 'transparent',
                color: t.textSub,
                border: `1px solid ${withAlpha(t.textMuted, 0.35)}`,
                whiteSpace: 'nowrap',
                opacity: filteredIds.length === 0 ? 0.5 : 1,
              }}
            >
              {allVisibleSelected ? '전체 해제' : '전체 선택'}
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setConfirmBulk(true)}
              disabled={selectedIds.size === 0 || deleting}
              style={{
                flex: '0 0 auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 999,
                backgroundColor: selectedIds.size === 0 ? t.bgSub : t.danger,
                color: selectedIds.size === 0 ? t.textMuted : '#fff',
                border: 'none',
                whiteSpace: 'nowrap',
                cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.6 : 1,
                transition: 'background-color .15s ease, color .15s ease',
              }}
            >
              <Trash2 size={14} />
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 개별 삭제 확인 */}
      {pendingDelete && (
        <ConfirmModal
          message="이 스크랩을 삭제할까요?"
          description={pendingDelete.title || pendingDelete.url || '제목 없는 스크랩'}
          confirmText="삭제"
          confirmDanger
          onConfirm={confirmSingleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* 일괄 삭제 확인 */}
      {confirmBulk && (
        <ConfirmModal
          message={`선택한 ${selectedIds.size}개 스크랩을 삭제할까요?`}
          description="삭제하면 되돌릴 수 없어요."
          confirmText="삭제"
          confirmDanger
          onConfirm={confirmBulkDelete}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </div>
  );
}
