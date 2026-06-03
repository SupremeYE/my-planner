import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Clapperboard, ChevronDown } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { CultureRecord, CulturePlatform, CultureContentType, CultureStatus } from '../store';
import { CultureFormModal } from './culture/CultureFormModal';
import { StarRating } from './culture/StarRating';
import { useToasts, ToastHost } from './culture/CultureToast';
import ConfirmModal from './ConfirmModal';
import {
  PLATFORM_META, PLATFORM_ORDER, CONTENT_TYPE_META, CONTENT_TYPE_ORDER, STATUS_META, STATUS_ORDER,
} from './culture/cultureMeta';

type SortKey = 'created' | 'watched' | 'rating';
const SORT_LABELS: Record<SortKey, string> = {
  created: '기록일 순',
  watched: '본 날짜 순',
  rating: '별점 높은순',
};

export function CultureRecordView() {
  const { t } = useTheme();
  const [records, setRecords] = useState<CultureRecord[]>([]);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<CulturePlatform | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<CultureContentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CultureStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortOpen, setSortOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CultureRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toasts, notify } = useToasts();

  // ── 데이터 로드 + Realtime 동기화 ──
  const refresh = useCallback(() => { db.cultureRecords.fetchAll().then(setRecords); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('culture_records', refresh);

  // ── 필터 + 정렬 ──
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = records.filter(r => {
      if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
      if (typeFilter !== 'all' && r.contentType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const inTitle = r.title.toLowerCase().includes(q);
        const inTags = (r.tags ?? []).some(tag => tag.toLowerCase().includes(q));
        if (!inTitle && !inTags) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortKey === 'watched') return (b.watchedDate ?? '').localeCompare(a.watchedDate ?? '');
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
    return sorted;
  }, [records, search, platformFilter, typeFilter, statusFilter, sortKey]);

  // ── 핸들러 ──
  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: CultureRecord) => { setEditing(r); setModalOpen(true); };
  const handleSave = async (rec: CultureRecord) => {
    await db.cultureRecords.upsert(rec);
    setModalOpen(false);
    setEditing(null);
    refresh();
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await db.cultureRecords.delete(deleteId);
    setDeleteId(null);
    setModalOpen(false);
    setEditing(null);
    refresh();
  };
  // 카드 레벨 빠른 상태 변경 — optimistic update + 실패 시 롤백
  const handleQuickStatus = async (id: string, newStatus: CultureStatus) => {
    const prev = records;
    setRecords(rs => rs.map(r => (r.id === id ? { ...r, status: newStatus } : r)));
    const ok = await db.cultureRecords.updateStatus(id, newStatus);
    if (!ok) {
      setRecords(prev);
      notify('상태 변경 실패 — 다시 시도해주세요', 'error');
    }
  };

  // ── 필터 칩 렌더러 ──
  const ChipRow = <V extends string>(
    options: { value: V | 'all'; label: string }[],
    active: V | 'all',
    onSelect: (v: V | 'all') => void,
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const isActive = active === opt.value;
        return (
          <button key={opt.value} onClick={() => onSelect(opt.value)}
            className="px-3 py-1 rounded-full transition-all"
            style={{
              fontSize: 12, fontWeight: isActive ? 600 : 400,
              backgroundColor: isActive ? t.accent : t.bgSub,
              color: isActive ? '#fff' : t.textSub,
              border: `1px solid ${isActive ? t.accent : t.border}`,
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-5 lg:py-7">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <h1 className="flex items-center gap-2" style={{ fontSize: 24, fontWeight: 700, color: t.text }}>
            <Clapperboard size={24} color={t.accent} />
            문화 기록
          </h1>
          <div className="flex items-center gap-2">
            {/* 검색 */}
            <div className="relative hidden lg:block">
              <Search size={15} color={t.textMuted}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="제목·태그 검색"
                className="rounded-xl outline-none"
                style={{ width: 200, padding: '7px 10px 7px 30px', fontSize: 13,
                  border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text }}
              />
            </div>
            {/* 정렬 */}
            <div className="relative">
              <button onClick={() => setSortOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ fontSize: 13, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.textSub }}>
                {SORT_LABELS[sortKey]}
                <ChevronDown size={14} />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg"
                    style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, minWidth: 130 }}>
                    {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                      <button key={k} onClick={() => { setSortKey(k); setSortOpen(false); }}
                        className="block w-full text-left px-3 py-2 transition-colors"
                        style={{ fontSize: 13, color: sortKey === k ? t.accent : t.text,
                          fontWeight: sortKey === k ? 600 : 400, backgroundColor: sortKey === k ? t.bgSub : 'transparent' }}>
                        {SORT_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* 추가하기 */}
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
              <Plus size={16} /> 추가하기
            </button>
          </div>
        </div>

        {/* ── 필터 ── */}
        <div className="space-y-2 mb-6">
          {ChipRow<CulturePlatform>(
            [{ value: 'all', label: '전체' }, ...PLATFORM_ORDER.map(p => ({ value: p, label: PLATFORM_META[p].label }))],
            platformFilter, setPlatformFilter,
          )}
          {ChipRow<CultureContentType>(
            [{ value: 'all', label: '전체' }, ...CONTENT_TYPE_ORDER.map(c => ({ value: c, label: CONTENT_TYPE_META[c].label }))],
            typeFilter, setTypeFilter,
          )}
          {ChipRow<CultureStatus>(
            [{ value: 'all', label: '전체' }, ...STATUS_ORDER.map(s => ({ value: s, label: STATUS_META[s].label }))],
            statusFilter, setStatusFilter,
          )}
        </div>

        {/* ── 그리드 / 빈 상태 ── */}
        {visible.length === 0 ? (
          <EmptyState hasRecords={records.length > 0} onAdd={openAdd} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {visible.map(r => (
              <CultureCard key={r.id} record={r} onClick={() => openEdit(r)} onStatusChange={handleQuickStatus} />
            ))}
          </div>
        )}
      </div>

      {/* 토스트 */}
      <ToastHost toasts={toasts} />

      {/* 모달 */}
      {modalOpen && (
        <CultureFormModal
          record={editing}
          onSave={handleSave}
          onDelete={editing ? (id) => setDeleteId(id) : undefined}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          notify={notify}
        />
      )}

      {/* 삭제 확인 */}
      {deleteId && (
        <ConfirmModal
          message="이 문화 기록을 삭제할까요?"
          description="삭제하면 되돌릴 수 없습니다."
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

// ── 포스터 카드 ──
function CultureCard({ record, onClick, onStatusChange }: {
  record: CultureRecord;
  onClick: () => void;
  onStatusChange: (id: string, status: CultureStatus) => void;
}) {
  const { t } = useTheme();
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const platform = PLATFORM_META[record.platform];
  const TypeIcon = CONTENT_TYPE_META[record.contentType].icon;
  const StatusIcon = STATUS_META[record.status].icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="text-left flex flex-col cursor-pointer relative"
      style={{ transform: hover ? 'translateY(-4px)' : 'none', transition: 'transform 0.18s ease' }}
    >
      {/* 포스터 (2:3) */}
      <div className="relative rounded-xl overflow-hidden"
        style={{
          aspectRatio: '2 / 3',
          boxShadow: hover ? '0 10px 28px rgba(0,0,0,0.22)' : t.shadow,
          transition: 'box-shadow 0.18s ease',
        }}>
        {record.thumbnailUrl ? (
          <img src={record.thumbnailUrl} alt={record.title}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${platform.gradient[0]}, ${platform.gradient[1]})` }}>
            <TypeIcon size={40} color="rgba(255,255,255,0.85)" />
          </div>
        )}

        {/* 플랫폼 미니 뱃지 (좌상단) */}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md"
          style={{ fontSize: 9, fontWeight: 600, color: '#fff',
            backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
          {platform.label}
        </span>
      </div>

      {/* 상태 컨트롤 (우상단) — 카드 루트 기준 absolute 로 두어 드롭다운이 포스터 overflow에 잘리지 않게 함 */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1"
        onClick={e => e.stopPropagation()}>
        {/* hover 또는 메뉴 열림 시 chevron 노출 */}
        {(hover || menuOpen) && (
          <button type="button" title="상태 변경"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="flex items-center justify-center rounded-full"
            style={{ width: 20, height: 20, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <ChevronDown size={12} color="#fff" />
          </button>
        )}
        <span className="flex items-center justify-center rounded-full"
          style={{ width: 22, height: 22, backgroundColor: 'rgba(0,0,0,0.55)' }}
          title={STATUS_META[record.status].label}>
          <StatusIcon size={13} color="#fff" />
        </span>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10"
              onClick={e => { e.stopPropagation(); setMenuOpen(false); }} />
            <div className="absolute right-0 z-20 rounded-xl overflow-hidden shadow-lg"
              style={{ top: 26, minWidth: 116, backgroundColor: t.card, border: `1px solid ${t.border}` }}>
              {STATUS_ORDER.map(s => {
                const Icon = STATUS_META[s].icon;
                const active = record.status === s;
                return (
                  <button key={s} type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      if (s !== record.status) onStatusChange(record.id, s);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 transition-colors"
                    style={{ fontSize: 12, color: active ? t.accent : t.text,
                      fontWeight: active ? 600 : 400, backgroundColor: active ? t.bgSub : 'transparent' }}>
                    <Icon size={13} color={active ? t.accent : t.textSub} />
                    {STATUS_META[s].label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 제목 + 별점 */}
      <div className="mt-2 px-0.5">
        <p style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {record.title}
        </p>
        {record.rating != null && record.rating > 0 && (
          <div className="mt-1">
            <StarRating value={record.rating} readOnly size={13} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 빈 상태 ──
function EmptyState({ hasRecords, onAdd }: { hasRecords: boolean; onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="flex items-center justify-center rounded-full mb-4"
        style={{ width: 72, height: 72, backgroundColor: t.bgSub }}>
        <Clapperboard size={32} color={t.accent} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>
        {hasRecords ? '조건에 맞는 기록이 없어요' : '첫 문화 기록을 남겨보세요'}
      </p>
      <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 18 }}>
        {hasRecords ? '필터나 검색어를 바꿔보세요' : '영화·드라마·예능·유튜브 등 본 콘텐츠를 기록할 수 있어요'}
      </p>
      {!hasRecords && (
        <button onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
          <Plus size={16} /> 추가하기
        </button>
      )}
    </div>
  );
}
