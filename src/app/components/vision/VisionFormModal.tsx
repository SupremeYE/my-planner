import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowLeft, Camera, ImagePlus, Trash2, Plus } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';

type Category = { id: string; name: string; sort_order: number; created_at: string };
type Item = {
  id: string;
  image_url: string | null;
  caption: string | null;
  category_id: string | null;
  sort_order: number;
  created_at: string;
};

interface Props {
  // 편집 대상이 있으면 편집 모드, 없으면 추가 모드
  item: Item | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;          // 저장 후 부모가 refresh 호출
  onRequestDelete: (item: Item) => void; // 삭제는 부모에서 ConfirmModal로 처리
}

// 토큰 hex → rgba (VisionBoardView/Layout과 동일 패턴)
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function VisionFormModal({ item, categories, onClose, onSaved, onRequestDelete }: Props) {
  const { t } = useTheme();
  const isEdit = !!item;

  // ── 폼 상태 ──
  const [caption, setCaption] = useState(item?.caption ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  // 기존 이미지 URL (편집 시), 신규 파일 둘 다 관리
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(item?.image_url ?? null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);

  // 인라인 신규 카테고리
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [saving, setSaving] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 신규 미리보기 ObjectURL 정리
  useEffect(() => {
    return () => { if (newPreview) URL.revokeObjectURL(newPreview); };
  }, [newPreview]);

  const handlePickFile = (file: File | null) => {
    if (!file) return;
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewFile(file);
    setNewPreview(URL.createObjectURL(file));
    // 새 파일이 선택되면 기존 이미지를 교체할 의도이므로 existing 클리어
    setExistingImageUrl(null);
  };

  const handleRemoveImage = () => {
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewFile(null);
    setNewPreview(null);
    setExistingImageUrl(null);
  };

  const handleCreateCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const nextOrder = (categories[categories.length - 1]?.sort_order ?? -1) + 1;
    const created = await db.visionCategories.create(name, nextOrder);
    if (created) {
      setCategoryId(created.id);
      setNewCatName('');
      setCreatingCat(false);
      // Realtime이 부모 refresh를 호출하지만, 모달 안에서 즉시 보이려면 부모도 알려야 함
      onSaved();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    const trimmedCaption = caption.trim();
    const hasImage = !!newFile || !!existingImageUrl;
    // 이미지/캡션 둘 다 비어 있으면 저장 불가
    if (!hasImage && !trimmedCaption) return;

    setSaving(true);
    try {
      let imageUrl: string | null = existingImageUrl;

      if (newFile) {
        // 업로드 키: 편집이면 itemId 재사용, 신규면 임시 키
        const uploadKey = `${item?.id ?? crypto.randomUUID()}_${Date.now()}`;
        imageUrl = await db.visionItems.uploadImage(newFile, uploadKey);
      }

      if (isEdit && item) {
        await db.visionItems.update(item.id, {
          imageUrl: imageUrl,
          caption: trimmedCaption || null,
          categoryId: categoryId,
        });
      } else {
        const sortOrder = await db.visionItems.nextSortOrder();
        await db.visionItems.create({
          imageUrl: imageUrl,
          caption: trimmedCaption || null,
          categoryId: categoryId,
          sortOrder,
        });
      }

      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = newPreview ?? existingImageUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch lg:items-center lg:justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex flex-col w-full lg:w-[480px] lg:max-h-[90vh] lg:rounded-2xl overflow-hidden"
        style={{
          backgroundColor: t.card,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 lg:px-5 py-3 border-b flex-shrink-0"
          style={{
            borderColor: t.border,
            paddingTop: 'max(env(safe-area-inset-top), 12px)',
          }}
        >
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            aria-label="취소"
          >
            <ArrowLeft size={20} color={t.text} className="lg:hidden" />
            <X size={20} color={t.text} className="hidden lg:block" />
          </button>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: t.text, lineHeight: 1 }}>
            {isEdit ? '비전 수정' : '비전 추가'}
          </h2>
          <button
            onClick={handleSubmit}
            disabled={saving || (!previewSrc && !caption.trim())}
            style={{
              color: (previewSrc || caption.trim()) ? t.accent : t.textMuted,
              fontSize: 14,
              fontWeight: 700,
              padding: '6px 10px',
              opacity: saving ? 0.5 : 1,
            }}
          >
            저장
          </button>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-6 pt-5 space-y-5">
          {/* 이미지 영역 */}
          <div>
            {previewSrc ? (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: t.bgSub }}>
                <img src={previewSrc} alt="" style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
                  aria-label="사진 제거"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                style={{
                  border: `2px dashed ${withAlpha(t.accentLight, 0.9)}`,
                  borderRadius: 12,
                  backgroundColor: withAlpha(t.card, 0.6),
                  padding: '28px 16px',
                  textAlign: 'center',
                  color: t.textSub,
                }}
              >
                <p style={{ fontSize: 13, marginBottom: 12 }}>이미지를 추가하거나 글만 적어도 돼요</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600 }}
                  >
                    <ImagePlus size={14} /> 갤러리
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600 }}
                  >
                    <Camera size={14} /> 카메라
                  </button>
                </div>
              </div>
            )}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => handlePickFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={e => handlePickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* 캡션 */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>한 줄 캡션</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="예: 제주 한 달 살기"
              rows={2}
              maxLength={120}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 14,
                resize: 'none',
                outline: 'none',
                fontFamily: 'var(--font-gaegu)',
              }}
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>카테고리</label>
            <div className="flex gap-2 mt-2 flex-wrap">
              <CatChip label="미분류" active={categoryId === null} onClick={() => setCategoryId(null)} />
              {categories.map(c => (
                <CatChip
                  key={c.id}
                  label={c.name}
                  active={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                />
              ))}
              {creatingCat ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onBlur={() => { if (!newCatName.trim()) setCreatingCat(false); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); }
                      else if (e.key === 'Escape') { setCreatingCat(false); setNewCatName(''); }
                    }}
                    placeholder="새 카테고리"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: `1px dashed ${t.accent}`,
                      backgroundColor: t.card,
                      color: t.text,
                      fontSize: 13,
                      outline: 'none',
                      minWidth: 110,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    style={{ color: t.accent, fontSize: 13, fontWeight: 700, padding: '4px 6px' }}
                  >
                    추가
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingCat(true)}
                  className="flex items-center gap-1"
                  style={{
                    fontSize: 13,
                    padding: '7px 12px',
                    borderRadius: 999,
                    border: `1px dashed ${withAlpha(t.accent, 0.6)}`,
                    color: t.accent,
                    fontWeight: 600,
                  }}
                >
                  <Plus size={12} /> 새 카테고리
                </button>
              )}
            </div>
          </div>

          {/* 편집 모드 — 삭제 */}
          {isEdit && item && (
            <div className="pt-3 border-t" style={{ borderColor: t.border }}>
              <button
                type="button"
                onClick={() => onRequestDelete(item)}
                className="flex items-center gap-1.5"
                style={{ color: t.danger, fontSize: 13, fontWeight: 600 }}
              >
                <Trash2 size={14} /> 이 비전 삭제
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { t } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 13,
        padding: '7px 14px',
        borderRadius: 999,
        backgroundColor: active ? t.accentLight : 'transparent',
        color: active ? t.accent : t.textSub,
        border: `1px solid ${active ? t.accent : withAlpha(t.textMuted, 0.3)}`,
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </button>
  );
}
