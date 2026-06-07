import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Shuffle, Music } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { MusicRecord } from '../../store';
import { MOOD_OPTIONS, type MoodFilter } from './musicMoods';
import { LpDisc } from './LpDisc';
import { MusicAddSheet } from './MusicAddSheet';
import { MusicDetailSheet } from './MusicDetailSheet';
import { useToasts, ToastHost } from '../culture/CultureToast';
import ConfirmModal from '../ConfirmModal';

export type CultureSection = 'video' | 'music';

/** 영상 / 음악 섹션 전환 탭 (문화 기록 공통) */
export function SectionTabs({ section, setSection }: {
  section: CultureSection;
  setSection: (s: CultureSection) => void;
}) {
  const { t } = useTheme();
  const tabs: { key: CultureSection; label: string }[] = [
    { key: 'video', label: '영상' },
    { key: 'music', label: '음악' },
  ];
  return (
    <div className="inline-flex rounded-full p-1 mb-4"
      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
      {tabs.map(tab => {
        const active = section === tab.key;
        return (
          <button key={tab.key} onClick={() => setSection(tab.key)}
            className="px-4 py-1.5 rounded-full transition-all"
            style={{ fontSize: 13, fontWeight: active ? 700 : 500,
              backgroundColor: active ? t.accent : 'transparent',
              color: active ? '#fff' : t.textSub }}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 음악 섹션 — LP판 그리드 + 무드 필터 + 셔플 + 추가/상세.
 * 단일 컴포넌트로 모바일/PC 반응형(그리드 열 수만 다름). 한 번만 마운트된다.
 */
export function MusicSection({ section, setSection }: {
  section: CultureSection;
  setSection: (s: CultureSection) => void;
}) {
  const { t } = useTheme();
  const { toasts, notify } = useToasts();

  const [records, setRecords] = useState<MusicRecord[]>([]);
  const [moodFilter, setMoodFilter] = useState<MoodFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<MusicRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 색 역할 매핑(토큰만): 골드=accent, 코랄=danger, 그린=success
  const coral = t.danger;

  const refresh = useCallback(() => { db.musicRecords.fetchAll().then(setRecords); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('music_records', refresh);

  const filtered = useMemo(
    () => (moodFilter === 'all' ? records : records.filter(r => (r.mood ?? []).includes(moodFilter))),
    [records, moodFilter],
  );

  // "지금 이 무드엔?" — 현재 필터 기준 곡 중 랜덤 한 곡의 상세를 연다
  const shuffle = () => {
    if (filtered.length === 0) {
      notify('곡이 없어요. 먼저 곡을 추가해 주세요.', 'info');
      return;
    }
    setDetail(filtered[Math.floor(Math.random() * filtered.length)]);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await db.musicRecords.delete(deleteId);
    setDeleteId(null);
    setDetail(null);
    refresh();
  };

  const moodChips: MoodFilter[] = ['all', ...MOOD_OPTIONS];

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      {/* LP 회전 / 바텀시트 키프레임 (1회 주입) */}
      <style>{`@keyframes lpspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes musicSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 lg:py-7"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>

        <SectionTabs section={section} setSection={setSection} />

        {/* 헤더: "음악"(DM Serif) + 코랄 원형 추가 버튼 */}
        <div className="flex items-center justify-between mb-4">
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: t.text }}>음악</h1>
          <button onClick={() => setAddOpen(true)} aria-label="곡 추가"
            className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{ width: 44, height: 44, backgroundColor: coral, color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
            <Plus size={24} />
          </button>
        </div>

        {/* "지금 이 무드엔?" 셔플 카드 */}
        <button onClick={shuffle}
          className="flex items-center gap-3 w-full rounded-2xl p-4 mb-4 text-left active:scale-[0.99] transition-transform"
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 44, height: 44, backgroundColor: t.accentLight }}>
            <Shuffle size={22} color={t.accent} />
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text }}>지금 이 무드엔?</p>
            <p style={{ fontSize: 12, color: t.textMuted }}>
              {moodFilter === 'all' ? '전체' : `'${moodFilter}'`} 곡 중 한 곡을 랜덤으로 골라드려요
            </p>
          </div>
        </button>

        {/* 무드 필터 칩 (가로 스크롤) */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {moodChips.map(m => {
            const active = moodFilter === m;
            const label = m === 'all' ? '전체' : m;
            return (
              <button key={m} onClick={() => setMoodFilter(m)}
                className="flex-shrink-0 px-3 rounded-full transition-all"
                style={{ minHeight: 34, fontSize: 13, fontWeight: active ? 600 : 400,
                  backgroundColor: active ? t.accent : t.bgSub, color: active ? '#fff' : t.textSub,
                  border: `1px solid ${active ? t.accent : t.border}` }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* LP 그리드 / 빈 상태 */}
        {filtered.length === 0 ? (
          <EmptyState hasAny={records.length > 0} onAdd={() => setAddOpen(true)} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6 mt-3">
            {filtered.map(r => (
              <button key={r.id} onClick={() => setDetail(r)}
                className="flex flex-col items-center text-center active:opacity-80 transition-opacity">
                <div className="w-full" style={{ maxWidth: 200 }}>
                  <LpDisc artworkUrl={r.artworkUrl} spinning />
                </div>
                <p className="mt-2 w-full truncate" style={{ fontSize: 13, fontWeight: 700, color: t.text }}
                  title={r.trackTitle}>{r.trackTitle}</p>
                <p className="w-full truncate" style={{ fontSize: 12, color: t.textMuted }}
                  title={r.artist}>{r.artist}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 오버레이 */}
      {addOpen && (
        <MusicAddSheet onClose={() => setAddOpen(false)} onAdded={refresh} notify={notify} />
      )}
      {detail && (
        <MusicDetailSheet record={detail} onClose={() => setDetail(null)}
          onDelete={(id) => setDeleteId(id)} />
      )}
      {deleteId && (
        <ConfirmModal
          message="이 곡 기록을 삭제할까요?"
          description="삭제하면 되돌릴 수 없습니다."
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
      <ToastHost toasts={toasts} />
    </div>
  );
}

// ── 빈 상태 ──
function EmptyState({ hasAny, onAdd }: { hasAny: boolean; onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="flex items-center justify-center rounded-full mb-4"
        style={{ width: 72, height: 72, backgroundColor: t.bgSub }}>
        <Music size={32} color={t.accent} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>
        {hasAny ? '이 무드의 곡이 없어요' : '첫 곡을 기록해보세요'}
      </p>
      <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 18 }}>
        {hasAny ? '다른 무드를 골라보세요' : '곡을 검색해 무드·메모와 함께 LP로 모아보세요'}
      </p>
      {!hasAny && (
        <button onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
          <Plus size={16} /> 곡 추가
        </button>
      )}
    </div>
  );
}
