import React, { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { CultureRecord, CulturePlatform, CultureContentType, CultureStatus } from '../../store';
import { StarRating } from './StarRating';
import {
  PLATFORM_META, PLATFORM_ORDER, CONTENT_TYPE_META, CONTENT_TYPE_ORDER, STATUS_META, STATUS_ORDER,
} from './cultureMeta';

interface CultureFormModalProps {
  record: CultureRecord | null;     // null = 신규 추가
  onSave: (record: CultureRecord) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function CultureFormModal({ record, onSave, onDelete, onClose }: CultureFormModalProps) {
  const { t } = useTheme();
  const isEdit = !!record;

  const [title, setTitle] = useState(record?.title ?? '');
  const [url, setUrl] = useState(record?.url ?? '');
  const [platform, setPlatform] = useState<CulturePlatform>(record?.platform ?? 'netflix');
  const [contentType, setContentType] = useState<CultureContentType>(record?.contentType ?? 'movie');
  const [status, setStatus] = useState<CultureStatus>(record?.status ?? 'completed');
  const [watchedDate, setWatchedDate] = useState(record?.watchedDate ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(record?.thumbnailUrl ?? '');
  const [rating, setRating] = useState<number>(record?.rating ?? 0);
  const [review, setReview] = useState(record?.review ?? '');
  const [insight, setInsight] = useState(record?.insight ?? '');
  const [tagsInput, setTagsInput] = useState((record?.tags ?? []).join(', '));

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const showRating = status === 'completed' || status === 'dropped';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const tags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);
    onSave({
      id: record?.id ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      title: title.trim(),
      platform,
      contentType,
      url: url.trim() || null,
      thumbnailUrl: thumbnailUrl.trim() || null,
      status,
      rating: showRating && rating > 0 ? rating : null,
      review: review.trim() || null,
      insight: insight.trim() || null,
      tags,
      watchedDate: watchedDate || null,
      createdAt: record?.createdAt,
    });
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6, display: 'block' };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 10, padding: '8px 10px', fontSize: 13,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-[480px] max-w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {isEdit ? '문화 기록 수정' : '문화 기록 추가'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          {/* 제목 */}
          <div>
            <label style={labelStyle}>제목 *</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="예: 오징어 게임 시즌2" style={fieldStyle} />
          </div>

          {/* URL */}
          <div>
            <label style={labelStyle}>URL (선택)</label>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://..." style={fieldStyle} />
          </div>

          {/* 플랫폼 / 유형 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>플랫폼 *</label>
              <select value={platform} onChange={e => setPlatform(e.target.value as CulturePlatform)} style={fieldStyle}>
                {PLATFORM_ORDER.map(p => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>유형 *</label>
              <select value={contentType} onChange={e => setContentType(e.target.value as CultureContentType)} style={fieldStyle}>
                {CONTENT_TYPE_ORDER.map(c => <option key={c} value={c}>{CONTENT_TYPE_META[c].label}</option>)}
              </select>
            </div>
          </div>

          {/* 상태 (라디오 4개) */}
          <div>
            <label style={labelStyle}>상태 *</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map(s => {
                const active = status === s;
                const Icon = STATUS_META[s].icon;
                return (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
                    style={{
                      fontSize: 12, fontWeight: active ? 600 : 400,
                      backgroundColor: active ? t.accent : t.bgSub,
                      color: active ? '#fff' : t.textSub,
                      border: `1px solid ${active ? t.accent : t.border}`,
                    }}>
                    <Icon size={13} />
                    {STATUS_META[s].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 본 날짜 / 썸네일 URL */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>본 날짜</label>
              <input type="date" value={watchedDate} onChange={e => setWatchedDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>썸네일 URL (선택)</label>
              <input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)}
                placeholder="이미지 주소" style={fieldStyle} />
            </div>
          </div>

          {/* 별점 — completed/dropped 일 때만 */}
          {showRating && (
            <div>
              <label style={labelStyle}>별점</label>
              <StarRating value={rating} onChange={setRating} />
            </div>
          )}

          {/* 리뷰 */}
          <div>
            <label style={labelStyle}>리뷰</label>
            <textarea value={review} onChange={e => setReview(e.target.value)} rows={3}
              placeholder="감상평을 남겨보세요" style={{ ...fieldStyle, resize: 'vertical' }} />
          </div>

          {/* 인사이트 */}
          <div>
            <label style={labelStyle}>인사이트 / 배운 점</label>
            <textarea value={insight} onChange={e => setInsight(e.target.value)} rows={3}
              placeholder="이 콘텐츠에서 얻은 생각이나 배운 점" style={{ ...fieldStyle, resize: 'vertical' }} />
          </div>

          {/* 태그 */}
          <div>
            <label style={labelStyle}>태그 (콤마로 구분)</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
              placeholder="예: 스릴러, 정주행, 추천" style={fieldStyle} />
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-2 pt-1">
            {isEdit && onDelete && (
              <button type="button" onClick={() => onDelete(record!.id)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-colors"
                style={{ backgroundColor: t.dangerLight, color: t.danger, fontSize: 13, fontWeight: 600 }}>
                <Trash2 size={14} /> 삭제
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl transition-colors"
              style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 13, fontWeight: 500, border: `1px solid ${t.border}` }}>
              취소
            </button>
            <button type="submit"
              className="px-5 py-2 rounded-xl transition-colors"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
