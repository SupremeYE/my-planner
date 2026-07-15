import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, GitCompareArrows } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import {
  canvasStyle, glassBarStyle, photoTileStyle, photoBadgeStyle,
  solidCardStyle, selectedRowStyle, actionBarStyle,
} from '../../styles/haonStyles';
import { HaonButton } from '../ui/HaonButton';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { getLogicalToday, type BodyPhoto, type WeightRecord } from '../../store';
import { prepImage } from '../../../lib/imagePrep';
import { resolveWeightBadge } from './bodyPhotoUtils';
import ConfirmModal from '../ConfirmModal';

interface Props {
  weightRecords: WeightRecord[];
  onClose: () => void;
}

// 눈바디 전체화면 갤러리 — 최신순 그리드 + 직접 추가(체중 없이) + 삭제.
// 민감 사진: 표시용 서명 URL 만 발급(TTL 1h), 어디에도 영속 저장하지 않음(CLAUDE.md 규칙).
export function BodyGallery({ weightRecords, onClose }: Props) {
  const { t } = useTheme();
  const [photos, setPhotos] = useState<BodyPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({}); // path → signed url (표시 전용·비영속)
  const [deleteTarget, setDeleteTarget] = useState<BodyPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 비교 모드 — 사진 2장 선택 → 나란히 + Δ
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // 최대 2 (초과 선택 시 오래된 것 교체)
  const [comparing, setComparing] = useState(false);

  const refresh = useCallback(() => { db.bodyPhotos.fetchAll().then(setPhotos); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('body_photos', refresh);

  // 서명 URL 배치 발급(TTL 1h) — photos 변할 때마다 재발급. state 외 어디에도 저장하지 않음.
  useEffect(() => {
    const paths = photos.map(p => p.photoPath);
    if (!paths.length) { setUrls({}); return; }
    let alive = true;
    db.bodyPhotos.signUrls(paths).then(map => { if (alive) setUrls(map); });
    return () => { alive = false; };
  }, [photos]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    setUploading(true);
    try {
      const prepped = await prepImage(file);         // HEIC→JPEG + 다운스케일
      const id = crypto.randomUUID();
      const path = await db.bodyPhotos.uploadPhoto(prepped, id);
      if (path) {
        // 직접 추가 = 체중 없이. date=오늘, weight_record_id=null.
        await db.bodyPhotos.insert({ id, date: getLogicalToday(), photoPath: path, weightRecordId: null });
        refresh();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (p: BodyPhoto) => {
    // 삭제 무결성: storage.remove 성공 시에만 row 삭제(db 레이어가 보장).
    const ok = await db.bodyPhotos.delete(p.id, p.photoPath);
    if (ok) refresh();
    setSelectedIds(prev => prev.filter(x => x !== p.id));
    setDeleteTarget(null);
  };

  const toggleCompareMode = () => {
    setCompareMode(m => {
      if (m) { setSelectedIds([]); setComparing(false); } // 끄면 선택 초기화
      return !m;
    });
  };
  // 선택 토글 — 최대 2장(3번째 선택 시 가장 오래된 것 교체)
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-2)));

  // 비교 쌍 — 날짜 오름차순(a=이전, b=이후). Δ = 양쪽 slot 동일 시에만 (이후 − 이전).
  const comparePair = useMemo(() => {
    if (selectedIds.length !== 2) return null;
    const two = selectedIds.map(id => photos.find(p => p.id === id)).filter(Boolean) as BodyPhoto[];
    if (two.length !== 2) return null;
    const [a, b] = [...two].sort((x, y) => x.date.localeCompare(y.date));
    const ba = resolveWeightBadge(a, weightRecords);
    const bb = resolveWeightBadge(b, weightRecords);
    const sameSlot = !!ba && !!bb && ba.slot === bb.slot;
    const delta = sameSlot ? Math.round((bb!.weight - ba!.weight) * 10) / 10 : null;
    return { a, b, ba, bb, delta };
  }, [selectedIds, photos, weightRecords]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: t.bg, ...canvasStyle(t) }}>
      {/* 헤더 (오버레이 글래스) */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 lg:px-6" style={glassBarStyle(t)}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label="닫기" className="p-1.5 rounded-lg"
            style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}>
            <X size={20} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: t.fontSection }}>눈바디</span>
        </div>
        <div className="flex items-center gap-2">
          {photos.length >= 2 && (
            <HaonButton variant={compareMode ? 'primary' : 'secondary'} onClick={toggleCompareMode}
              leftIcon={<GitCompareArrows size={15} />} className="text-sm">비교</HaonButton>
          )}
          <HaonButton variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading}
            leftIcon={<Plus size={15} />} className="text-sm">
            {uploading ? '올리는 중…' : '사진 추가'}
          </HaonButton>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {/* 그리드 */}
      <div className="px-4 py-4 lg:px-6">
        {photos.length === 0 ? (
          <div className="py-20 text-center" style={{ fontSize: 14, color: t.textMuted }}>
            아직 눈바디 사진이 없어요.<br />오른쪽 위 "사진 추가"로 시작해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2" style={{ paddingBottom: compareMode ? 64 : 0 }}>
            {photos.map(p => {
              const badge = resolveWeightBadge(p, weightRecords);
              const url = urls[p.photoPath];
              const isSelected = selectedIds.includes(p.id);
              return (
                <div key={p.id} className="aspect-square"
                  onClick={compareMode ? () => toggleSelect(p.id) : undefined}
                  style={{
                    ...photoTileStyle(t),
                    ...(compareMode && isSelected ? selectedRowStyle(t) : null),
                    cursor: compareMode ? 'pointer' : 'default',
                  }}>
                  {url ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ fontSize: 11, color: t.textMuted }}>불러오는 중…</div>
                  )}
                  {/* 삭제 — 비교 모드에서는 숨김(탭=선택) */}
                  {!compareMode && (
                    <button onClick={() => setDeleteTarget(p)} aria-label="삭제"
                      className="absolute top-1 right-1 p-1 rounded-lg"
                      style={{ background: t.card, border: `1px solid ${t.border}`, cursor: 'pointer' }}>
                      <Trash2 size={12} color={t.danger} />
                    </button>
                  )}
                  {/* 뱃지: 날짜 · 체중 · slot (불투명 토큰 pill) */}
                  <div className="absolute left-1 right-1 bottom-1 px-1.5 py-0.5 flex items-center gap-1 flex-wrap"
                    style={{ ...photoBadgeStyle(t), fontSize: 10, fontWeight: 600 }}>
                    <span>{p.date.slice(5)}</span>
                    {badge && <span style={{ color: t.textSub }}>{badge.weight}kg · {badge.slot}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 비교 모드 하단 액션바 */}
      {compareMode && (
        <div className="fixed left-0 right-0 bottom-0 flex items-center justify-between gap-3 px-4 py-3 lg:px-6"
          style={actionBarStyle(t)}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{selectedIds.length}/2 선택</span>
          <div className="flex items-center gap-2">
            <HaonButton variant="secondary" onClick={toggleCompareMode} className="text-sm">취소</HaonButton>
            <HaonButton variant="primary" disabled={selectedIds.length !== 2}
              onClick={() => setComparing(true)} className="text-sm">비교하기</HaonButton>
          </div>
        </div>
      )}

      {/* 비교 뷰 — 2장 나란히 + Δ */}
      {comparing && comparePair && (() => {
        const { a, b, ba, bb, delta } = comparePair;
        const deltaColor = delta == null || delta === 0 ? t.textMuted : delta > 0 ? t.danger : t.success;
        const deltaText = delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta} kg`;
        const cell = (p: BodyPhoto, badge: typeof ba, label: string) => (
          <div className="rounded-2xl overflow-hidden" style={solidCardStyle(t)}>
            <div className="w-full" style={{ aspectRatio: '3 / 4', background: t.bgSub }}>
              {urls[p.photoPath]
                ? <img src={urls[p.photoPath]} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 12, color: t.textMuted }}>불러오는 중…</div>}
            </div>
            <div className="px-3 py-2">
              <p style={{ fontSize: 11, color: t.textMuted }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{p.date}</p>
              <p style={{ fontSize: 12, color: t.textSub }}>{badge ? `${badge.weight}kg · ${badge.slot}` : '체중 기록 없음'}</p>
            </div>
          </div>
        );
        return (
          <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ backgroundColor: t.bg, ...canvasStyle(t) }}>
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 lg:px-6" style={glassBarStyle(t)}>
              <button onClick={() => setComparing(false)} aria-label="뒤로" className="p-1.5 rounded-lg"
                style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}>
                <X size={20} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: t.fontSection }}>비교</span>
            </div>
            <div className="px-4 py-4 lg:px-6 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {cell(a, ba, '이전')}
                {cell(b, bb, '이후')}
              </div>
              {/* Δ — 양쪽 slot 동일 시에만, 아니면 "—" */}
              <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={solidCardStyle(t)}>
                <span style={{ fontSize: 13, color: t.textSub }}>변화량 (Δ)</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: deltaColor }}>{deltaText}</span>
              </div>
              {delta == null && (
                <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
                  양쪽 사진의 체중 시간대(slot)가 같아야 변화량을 계산해요.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {deleteTarget && (
        <ConfirmModal
          message="이 눈바디 사진을 삭제할까요?"
          description="사진 파일과 기록이 함께 삭제됩니다. 되돌릴 수 없어요."
          confirmText="삭제"
          confirmDanger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
