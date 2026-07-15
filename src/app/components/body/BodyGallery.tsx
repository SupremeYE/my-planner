import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { canvasStyle, glassBarStyle, photoTileStyle, photoBadgeStyle } from '../../styles/haonStyles';
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
    setDeleteTarget(null);
  };

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
        <HaonButton variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading}
          leftIcon={<Plus size={15} />} className="text-sm">
          {uploading ? '올리는 중…' : '사진 추가'}
        </HaonButton>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {/* 그리드 */}
      <div className="px-4 py-4 lg:px-6">
        {photos.length === 0 ? (
          <div className="py-20 text-center" style={{ fontSize: 14, color: t.textMuted }}>
            아직 눈바디 사진이 없어요.<br />오른쪽 위 "사진 추가"로 시작해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
            {photos.map(p => {
              const badge = resolveWeightBadge(p, weightRecords);
              const url = urls[p.photoPath];
              return (
                <div key={p.id} className="aspect-square" style={photoTileStyle(t)}>
                  {url ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ fontSize: 11, color: t.textMuted }}>불러오는 중…</div>
                  )}
                  {/* 삭제 */}
                  <button onClick={() => setDeleteTarget(p)} aria-label="삭제"
                    className="absolute top-1 right-1 p-1 rounded-lg"
                    style={{ background: t.card, border: `1px solid ${t.border}`, cursor: 'pointer' }}>
                    <Trash2 size={12} color={t.danger} />
                  </button>
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
