import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X, Link2, Loader2, Camera, ImagePlus, AlertCircle } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { ScrapSource } from '../../store';

// 출처 라벨 / 색 — 토큰 기반
const SOURCE_LABELS: Record<ScrapSource, string> = {
  youtube: '유튜브',
  instagram: '인스타',
  threads: '스레드',
  web: '웹',
};

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

// 클라이언트 측 출처 감지 — URL 입력 즉시 출처 칩 표시용. Edge Function 의 detectSource 와 동일 규칙.
function detectSource(raw: string): ScrapSource | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
      return 'youtube';
    }
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (host === 'threads.net' || host === 'threads.com' || host.endsWith('.threads.net') || host.endsWith('.threads.com')) {
      return 'threads';
    }
    return 'web';
  } catch {
    return null;
  }
}

export default function AddScrapModal({ onClose, onSaved }: Props) {
  const { t } = useTheme();

  // 폼 상태
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [source, setSource] = useState<ScrapSource | null>(null);
  const [comment, setComment] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // 자동 채움 상태
  const [fetching, setFetching] = useState(false);
  const [needsManual, setNeedsManual] = useState(false);  // 인스타/스레드 또는 web fetch 실패
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 수동 스크린샷
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualPreview, setManualPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // 진입 애니메이션 — VisionFormModal 패턴(모바일 슬라이드업)
  const [isIn, setIsIn] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setIsIn(true)); }, []);
  const handleClose = () => { setIsIn(false); setTimeout(onClose, 220); };

  // ESC 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 미리보기 ObjectURL 정리
  useEffect(() => {
    return () => { if (manualPreview) URL.revokeObjectURL(manualPreview); };
  }, [manualPreview]);

  // URL 변경 → 출처 칩 즉시 갱신 (자동 fetch 는 사용자가 '가져오기' 눌렀을 때만)
  useEffect(() => {
    const detected = detectSource(url);
    setSource(detected);
    // URL 비웠으면 자동 채움 흔적도 지움
    if (!url.trim()) {
      setNeedsManual(false);
      setFetchError(null);
    }
  }, [url]);

  const handleFetchMetadata = async () => {
    const trimmed = url.trim();
    if (!trimmed || fetching) return;
    setFetching(true);
    setFetchError(null);
    try {
      const result = await db.scraps.fetchLinkMetadata(trimmed);
      if (!result) {
        setFetchError('가져오기에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해주세요.');
        setNeedsManual(true);
        return;
      }
      setSource(result.source);
      setNeedsManual(result.needsManual);

      // 자동 채움 — 사용자 입력값이 비어있을 때만 덮어씀 (편집 가능 유지)
      if (result.title && !title.trim()) setTitle(result.title);
      if (result.thumbnail_url && !thumbnailUrl && !manualFile) setThumbnailUrl(result.thumbnail_url);

      if (result.needsManual && !result.title && !result.thumbnail_url) {
        // 인스타/스레드 안내
        if (result.source === 'instagram' || result.source === 'threads') {
          setFetchError(null);
        } else {
          setFetchError('자동 가져오기가 어려운 페이지예요. 제목을 직접 입력해주세요.');
        }
      }
    } finally {
      setFetching(false);
    }
  };

  const handlePickFile = (file: File | null) => {
    if (!file) return;
    if (manualPreview) URL.revokeObjectURL(manualPreview);
    setManualFile(file);
    setManualPreview(URL.createObjectURL(file));
    // 수동 스크린샷 선택 시 자동 썸네일 URL 은 비움 (수동 우선)
    setThumbnailUrl(null);
  };

  const handleRemoveThumb = () => {
    if (manualPreview) URL.revokeObjectURL(manualPreview);
    setManualFile(null);
    setManualPreview(null);
    setThumbnailUrl(null);
  };

  const canSubmit = (() => {
    const hasUrl = !!url.trim();
    const hasTitle = !!title.trim();
    // 최소 URL 또는 제목 하나는 필요
    return (hasUrl || hasTitle) && !saving;
  })();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      // 1) 수동 스크린샷이 있으면 먼저 업로드
      let finalThumbUrl: string | null = thumbnailUrl;
      if (manualFile) {
        const key = `${crypto.randomUUID()}_${Date.now()}`;
        const uploaded = await db.scraps.uploadThumb(manualFile, key);
        if (uploaded) finalThumbUrl = uploaded;
      }

      // 2) 태그 파싱 (콤마 구분, 공백 정리, 빈 항목 제거, 중복 제거)
      const tags = Array.from(
        new Set(
          tagsInput
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        )
      );

      await db.scraps.create({
        url: url.trim() || null,
        source: source,
        title: title.trim() || null,
        thumbnailUrl: finalThumbUrl,
        comment: comment.trim() || null,
        tags,
      });

      onSaved();
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  // 표시할 썸네일: 수동 미리보기 우선 → 자동 fetch URL
  const previewSrc = manualPreview ?? thumbnailUrl ?? null;

  // 인스타/스레드 안내 메시지
  const isManualSourceHint = (source === 'instagram' || source === 'threads') && needsManual;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch lg:items-center lg:justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', opacity: isIn ? 1 : 0, transition: 'opacity 0.22s ease' }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex flex-col w-full lg:w-[480px] lg:max-h-[90vh] lg:rounded-2xl overflow-hidden"
        style={{
          backgroundColor: t.card,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          transform: isIn ? 'translateY(0)' : 'translateY(24px)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          // 모바일: 상단 safe-area 보호용 패딩은 헤더에서 처리
          maxHeight: '92vh',
        }}
      >
        {/* 헤더 — 모바일 ← / PC × */}
        <div
          className="flex items-center justify-between px-4 lg:px-5 py-3 border-b flex-shrink-0"
          style={{
            borderColor: t.border,
            paddingTop: 'max(env(safe-area-inset-top), 12px)',
          }}
        >
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg"
            aria-label="취소"
          >
            <ArrowLeft size={20} color={t.text} className="lg:hidden" />
            <X size={20} color={t.text} className="hidden lg:block" />
          </button>
          <h2 style={{ fontFamily: t.fontPageTitle, fontSize: 22, color: t.text, lineHeight: 1 }}> {/* 모달 최상위 제목 */}
            스크랩 추가
          </h2>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              color: canSubmit ? t.accent : t.textMuted,
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
          {/* ── 링크 입력 + 가져오기 ── */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>링크</label>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                <Link2 size={14} color={t.textMuted} />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onPaste={e => {
                    // 붙여넣은 직후 자동 가져오기 — 사용자가 따로 '가져오기' 안 눌러도 되게
                    const pasted = e.clipboardData.getData('text').trim();
                    if (pasted) {
                      setTimeout(() => handleFetchMetadata(), 50);
                    }
                  }}
                  placeholder="https://..."
                  inputMode="url"
                  autoComplete="off"
                  style={{
                    flex: 1,
                    backgroundColor: 'transparent',
                    color: t.text,
                    fontSize: 14,
                    outline: 'none',
                    border: 'none',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleFetchMetadata}
                disabled={!url.trim() || fetching}
                style={{
                  backgroundColor: url.trim() && !fetching ? t.accent : t.bgSub,
                  color: url.trim() && !fetching ? '#fff' : t.textMuted,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: 'none',
                  minWidth: 80,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {fetching ? <Loader2 size={14} className="animate-spin" /> : null}
                가져오기
              </button>
            </div>

            {/* 출처 칩 + 인스타/스레드 안내 */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {source && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 999,
                    backgroundColor: t.accentLight,
                    color: t.accent,
                  }}
                >
                  {SOURCE_LABELS[source]}
                </span>
              )}
              {isManualSourceHint && (
                <span style={{ fontSize: 11, color: t.textSub, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} color={t.textMuted} />
                  로그인 벽 때문에 자동 가져오기가 어려워요. 스크린샷 + 제목을 직접 넣어주세요.
                </span>
              )}
              {fetchError && (
                <span style={{ fontSize: 11, color: t.danger, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} />
                  {fetchError}
                </span>
              )}
            </div>
          </div>

          {/* ── 썸네일(자동/수동) ── */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>
              썸네일
            </label>
            {previewSrc ? (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: t.bgSub, marginTop: 6 }}>
                <img src={previewSrc} alt="" style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={handleRemoveThumb}
                  className="absolute top-2 right-2 p-1.5 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
                  aria-label="썸네일 제거"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 6,
                  border: `2px dashed ${withAlpha(t.accentLight, 0.9)}`,
                  borderRadius: 12,
                  backgroundColor: withAlpha(t.card, 0.6),
                  padding: '20px 16px',
                  textAlign: 'center',
                  color: t.textSub,
                }}
              >
                <p style={{ fontSize: 12, marginBottom: 10 }}>
                  유튜브·웹은 자동 가져오기로 채워져요. 인스타·스레드는 스크린샷을 올려주세요.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600 }}
                  >
                    <ImagePlus size={14} /> 갤러리
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600 }}
                  >
                    <Camera size={14} /> 카메라
                  </button>
                </div>
              </div>
            )}
            <input ref={galleryRef} type="file" accept="image/*" hidden
              onChange={e => handlePickFile(e.target.files?.[0] ?? null)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
              onChange={e => handlePickFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* ── 제목 ── */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>제목</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="제목 (자동 채움 또는 직접 입력)"
              maxLength={200}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {/* ── 한 줄 코멘트(손글씨) ── */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>한 줄 코멘트</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="왜 저장했는지, 어떤 영감이었는지"
              rows={2}
              maxLength={200}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 16,
                resize: 'none',
                outline: 'none',
                fontFamily: 'var(--font-nanum-pen)',
                lineHeight: 1.4,
              }}
            />
          </div>

          {/* ── 태그 ── */}
          <div>
            <label style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>태그</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="쉼표로 구분 (예: 인테리어, 색감, 영감)"
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
