import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, X, Pencil, Clock, Star, ChefHat, Play, ExternalLink,
  Youtube, Instagram, Link2, Minus, Plus, Utensils, History,
  Check, Camera, ImagePlus, Loader2, Trash2,
} from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { Recipe, RecipeCookLog } from '../../store';
import { detectRecipeSourcePlatform, sourcePlatformLabel, type RecipeSourcePlatform } from '../../../lib/recipeSource';
import { extractYouTubeVideoId } from '../../../lib/youtube';
import { MAIN_INGREDIENT_PRESETS } from './recipeTags';
import ConfirmModal from '../ConfirmModal';

interface RecipeDetailProps {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
}

// 대표 이미지 결정 — coverSource 기준, 비어 있으면 폴백
function coverImage(r: Recipe): string | null {
  if (r.coverSource === 'my_photo' && r.myPhotoUrl) return r.myPhotoUrl;
  if (r.coverSource === 'thumbnail' && r.thumbnailUrl) return r.thumbnailUrl;
  return r.myPhotoUrl || r.thumbnailUrl || null;
}

// 비례 환산 — 소수 1자리에서 반올림. amount가 null이면 null 유지.
function scaleAmount(amount: number | null | undefined, factor: number): number | null {
  if (amount == null) return null;
  return Math.round(amount * factor * 10) / 10;
}

// 양 표시 — 0.5 처럼 자연스럽게 (1.0 → 1)
function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

// 주재료 이모지 매핑
const MAIN_EMOJI: Record<string, string> = Object.fromEntries(
  MAIN_INGREDIENT_PRESETS.map(p => [p.name, p.emoji]),
);

function PlatformIcon({ p, size = 14, color }: { p: RecipeSourcePlatform; size?: number; color: string }) {
  if (p === 'youtube' || p === 'shorts') return <Youtube size={size} color={color} />;
  if (p === 'instagram') return <Instagram size={size} color={color} />;
  if (p === 'other') return <Link2 size={size} color={color} />;
  return null;
}

// 읽기 전용 별점 표시 (0~5, 0.5 단위 — 채워진 정도를 컬러로)
function StarRow({ value, color }: { value: number; color: string }) {
  const items = [1, 2, 3, 4, 5];
  return (
    <span className="inline-flex items-center gap-0.5">
      {items.map(i => {
        const full = value >= i;
        const half = !full && value >= i - 0.5;
        return (
          <span key={i} className="relative inline-flex" style={{ width: 14, height: 14 }}>
            <Star size={14} color={color} fill={full ? color : 'transparent'} />
            {half && (
              <span className="absolute left-0 top-0 overflow-hidden" style={{ width: 7, height: 14 }}>
                <Star size={14} color={color} fill={color} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function RecipeDetail({ recipe, onClose, onEdit }: RecipeDetailProps) {
  const { t } = useTheme();
  const cover = coverImage(recipe);
  const platform = detectRecipeSourcePlatform(recipe.sourceUrl || '');
  const ytId = (platform === 'youtube' || platform === 'shorts') ? extractYouTubeVideoId(recipe.sourceUrl || '') : null;
  const isMyPhoto = recipe.coverSource === 'my_photo' && !!recipe.myPhotoUrl;

  // 인분 환산
  const base = recipe.baseServings ?? 2;
  const [servings, setServings] = useState<number>(base);
  const factor = base > 0 ? servings / base : 1;
  const hasIngredients = recipe.ingredients.length > 0;
  const hasSteps = recipe.steps.length > 0;

  // YouTube 인라인 임베드 토글
  const [showEmbed, setShowEmbed] = useState(false);

  // ── 조리 기록 (cook logs) ──
  const [cookLogs, setCookLogs] = useState<RecipeCookLog[]>([]);
  const [marking, setMarking] = useState(false);
  // 사진 추가 안내 시트 — 방금 추가한 cook log id 보관
  const [pendingPhotoLogId, setPendingPhotoLogId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // 갤러리/카메라 트리거용 두 개 input
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<string | null>(null);

  const refreshLogs = useCallback(() => {
    db.recipeCookLogs.fetchByRecipe(recipe.id).then(setCookLogs);
  }, [recipe.id]);
  useEffect(() => { refreshLogs(); }, [refreshLogs]);
  // Realtime — 다른 기기에서 기록 추가/삭제 시 즉시 반영
  useRealtimeSync('recipe_cook_logs', refreshLogs);

  const handleMarkCooked = async () => {
    if (marking) return;
    setMarking(true);
    const inserted = await db.recipeCookLogs.insert({ recipeId: recipe.id });
    if (inserted) {
      // recipes.cook_count + 1, last_cooked_at 갱신 — 기존 markCooked 재사용
      await db.recipes.markCooked(recipe.id, recipe.cookCount ?? 0);
      setCookLogs(prev => [inserted, ...prev]);
      setPendingPhotoLogId(inserted.id); // 사진 추가 안내 시트 열기
    }
    setMarking(false);
  };

  const onPickPhoto = (source: 'camera' | 'gallery') => {
    if (source === 'camera') cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingPhotoLogId) return;
    setUploadingPhoto(true);
    const url = await db.recipeCookLogs.uploadPhoto(recipe.id, file);
    if (url) {
      await db.recipeCookLogs.setPhotoUrl(pendingPhotoLogId, url);
      setCookLogs(prev => prev.map(l => l.id === pendingPhotoLogId ? { ...l, photoUrl: url } : l));
    }
    setUploadingPhoto(false);
    setPendingPhotoLogId(null);
  };

  const handleDeleteLog = async () => {
    if (!confirmDeleteLogId) return;
    const id = confirmDeleteLogId;
    setConfirmDeleteLogId(null);
    setCookLogs(prev => prev.filter(l => l.id !== id)); // optimistic
    await db.recipeCookLogs.delete(id);
  };

  const lastCookedLabel = useMemo(() => {
    if (!recipe.lastCookedAt) return null;
    const d = new Date(recipe.lastCookedAt);
    if (!Number.isFinite(d.getTime())) return null;
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays <= 0) return '오늘 만들었어요';
    if (diffDays === 1) return '어제 만들었어요';
    if (diffDays < 7) return `${diffDays}일 전 만들었어요`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }, [recipe.lastCookedAt]);

  const handleOpenSource = () => {
    if (!recipe.sourceUrl) return;
    if (ytId) { setShowEmbed(v => !v); return; }
    window.open(recipe.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <style>{`@keyframes recipeDetailUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.recipe-detail-panel{animation:recipeDetailUp .26s ease-out}}`}</style>

      <div className="recipe-detail-panel shadow-2xl overflow-y-auto w-full max-w-full h-[100dvh] rounded-t-2xl
          lg:w-[720px] lg:h-auto lg:max-h-[92vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 (sticky) */}
        <div className="flex items-center justify-between gap-2 px-3 lg:px-5 pb-2 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 12px)', borderBottom: `1px solid ${t.border}` }}>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1.5 -ml-1 rounded-lg" style={{ color: t.textSub }}>
            <ChevronLeft size={22} className="lg:hidden" />
            <X size={20} className="hidden lg:block" />
          </button>
          <h2 className="flex-1 text-center lg:text-left truncate" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            레시피
          </h2>
          <button type="button" onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
            style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>
            <Pencil size={14} /> 편집
          </button>
        </div>

        {/* 히어로 */}
        <div className="relative w-full" style={{ aspectRatio: '16 / 10', backgroundColor: t.bgSub }}>
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat size={48} color={t.textMuted} />
            </div>
          )}
          {isMyPhoto && (
            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md"
              style={{ fontSize: 11, fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}>📸 내 사진</span>
          )}
        </div>

        <div className="px-4 lg:px-6 pt-4 pb-8 space-y-5"
          style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>

          {/* 제목 + 메타 라인 */}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1.25 }}>{recipe.title}</h1>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
              {recipe.rating != null && recipe.rating > 0 && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 13, color: t.text }}>
                  <StarRow value={recipe.rating} color={t.accent} />
                  <span style={{ color: t.textSub, fontWeight: 600 }}>{recipe.rating}</span>
                </span>
              )}
              {recipe.totalMinutes != null && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 13, color: t.textSub }}>
                  <Clock size={13} /> {recipe.totalMinutes}분
                </span>
              )}
              {(recipe.cookCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 13, color: t.textSub }}>
                  <Utensils size={13} /> {recipe.cookCount}회 만듦
                </span>
              )}
              {lastCookedLabel && (
                <span style={{ fontSize: 12, color: t.textMuted }}>· {lastCookedLabel}</span>
              )}
            </div>
          </div>

          {/* 출처 + 다시보기 */}
          {platform && recipe.sourceUrl && (
            <div className="rounded-xl overflow-hidden"
              style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center justify-center rounded-full"
                    style={{ width: 26, height: 26, backgroundColor: t.accentLight }}>
                    <PlatformIcon p={platform} size={14} color={t.accent} />
                  </span>
                  <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                    {sourcePlatformLabel(platform)} 원본
                  </span>
                </div>
                <button onClick={handleOpenSource}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                  style={{ fontSize: 12, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
                  {ytId
                    ? (<><Play size={12} /> {showEmbed ? '접기' : '다시보기'}</>)
                    : (<><ExternalLink size={12} /> 새 탭으로 열기</>)}
                </button>
              </div>
              {ytId && showEmbed && (
                <div className="w-full" style={{ aspectRatio: '16 / 9', backgroundColor: '#000' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}`}
                    title="레시피 영상"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* 태그 칩 — 주재료 + 의도 */}
          {(recipe.mainIngredients.length > 0 || recipe.tags.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.mainIngredients.map(m => (
                <span key={`m-${m}`} className="px-2 py-1 rounded-full"
                  style={{
                    fontSize: 12, fontWeight: 600,
                    backgroundColor: t.bgSub, color: t.textSub,
                    border: `1px solid ${t.border}`,
                  }}>{`${MAIN_EMOJI[m] ?? ''} ${m}`.trim()}</span>
              ))}
              {recipe.tags.map(tag => (
                <span key={`t-${tag}`} className="px-2 py-1 rounded-full"
                  style={{
                    fontSize: 12, fontWeight: 600,
                    backgroundColor: t.accentLight, color: t.accent,
                  }}>{tag}</span>
              ))}
            </div>
          )}

          {/* 인분 환산 */}
          {hasIngredients && (
            <div className="rounded-xl p-3 flex items-center justify-between gap-3"
              style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
              <div className="min-w-0">
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>인분</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                  기본 {base}인분 기준 · ×{factor.toFixed(1)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setServings(s => Math.max(1, s - 1))}
                  className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 32, height: 32, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }}
                  aria-label="인분 줄이기">
                  <Minus size={14} />
                </button>
                <span className="min-w-[60px] text-center" style={{ fontSize: 16, fontWeight: 700, color: t.accent }}>
                  {servings}인분
                </span>
                <button onClick={() => setServings(s => Math.min(20, s + 1))}
                  className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 32, height: 32, backgroundColor: t.accent, color: '#fff' }}
                  aria-label="인분 늘리기">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* 재료 */}
          {hasIngredients && (
            <section>
              <h3 className="flex items-center gap-1.5 mb-2" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                재료 <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>({recipe.ingredients.length})</span>
              </h3>
              <ul className="rounded-xl overflow-hidden" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                {recipe.ingredients.map((g, idx) => {
                  const scaled = scaleAmount(g.amount, factor);
                  return (
                    <li key={g.id ?? idx} className="flex items-center justify-between gap-3 px-3 py-2.5"
                      style={{ borderTop: idx === 0 ? 'none' : `1px solid ${t.border}` }}>
                      <span className="truncate" style={{ fontSize: 14, color: t.text }}>{g.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}>
                        {scaled != null ? (
                          <>
                            {formatAmount(scaled)}
                            {g.unit ? <span style={{ color: t.textMuted, marginLeft: 2 }}>{g.unit}</span> : null}
                          </>
                        ) : (
                          <span style={{ color: t.textMuted }}>{g.unit ?? '적당량'}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* 요리 순서 */}
          {hasSteps && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  요리 순서 <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>({recipe.steps.length}단계)</span>
                </h3>
                <button
                  onClick={() => alert('요리 시작 화면은 다음 업데이트에서 연결돼요.')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                  style={{
                    fontSize: 12, fontWeight: 700,
                    color: t.textMuted, backgroundColor: t.bgSub,
                    border: `1px dashed ${t.border}`,
                    cursor: 'not-allowed',
                  }}
                  aria-disabled="true">
                  <Play size={12} /> 요리 시작
                </button>
              </div>
              <ol className="space-y-2">
                {recipe.steps.map((s, idx) => (
                  <li key={s.id ?? idx} className="flex gap-3 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                    <span className="flex-shrink-0 rounded-full flex items-center justify-center"
                      style={{ width: 22, height: 22, backgroundColor: t.accentLight, color: t.accent,
                        fontSize: 11, fontWeight: 800 }}>{s.stepNo ?? idx + 1}</span>
                    <p className="whitespace-pre-wrap" style={{ fontSize: 14, color: t.text, lineHeight: 1.55 }}>
                      {s.instruction}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 메모 */}
          {recipe.memo && recipe.memo.trim() !== '' && (
            <section>
              <h3 className="mb-2" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>메모</h3>
              <div className="rounded-xl px-3 py-2.5 whitespace-pre-wrap"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}`,
                  fontSize: 14, color: t.text, lineHeight: 1.55 }}>
                {recipe.memo}
              </div>
            </section>
          )}

          {/* 만든 기록 — cook_logs 타임라인 (Realtime) */}
          <section>
            <h3 className="flex items-center gap-1.5 mb-2" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
              <History size={14} color={t.textMuted} /> 만든 기록
              {cookLogs.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>({cookLogs.length})</span>
              )}
            </h3>
            {cookLogs.length === 0 ? (
              <div className="rounded-xl px-3 py-4 text-center"
                style={{ backgroundColor: t.card, border: `1px dashed ${t.border}`,
                  fontSize: 12, color: t.textMuted }}>
                아직 기록이 없어요. 아래 <b style={{ color: t.accent }}>만들었어요</b>로 첫 기록을 남겨보세요.
              </div>
            ) : (
              <ul className="space-y-2">
                {cookLogs.map(log => <CookLogRow key={log.id} log={log}
                  onDelete={() => setConfirmDeleteLogId(log.id)} />)}
              </ul>
            )}
          </section>
        </div>

        {/* 하단 sticky 액션 — '편집' + '만들었어요' */}
        <div className="sticky bottom-0 left-0 right-0 px-4 lg:px-6 py-3 flex gap-2"
          style={{
            backgroundColor: t.bg, borderTop: `1px solid ${t.border}`,
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          }}>
          <button onClick={onEdit}
            className="flex items-center justify-center gap-1.5 rounded-xl py-3 px-4 active:scale-[0.99] transition-transform"
            style={{ fontSize: 14, fontWeight: 700, color: t.accent,
              backgroundColor: t.accentLight, border: `1px solid ${t.accent}33` }}>
            <Pencil size={15} /> 편집
          </button>
          <button onClick={handleMarkCooked} disabled={marking}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 active:scale-[0.99] transition-transform"
            style={{ fontSize: 14, fontWeight: 700, color: '#fff',
              backgroundColor: t.accent, opacity: marking ? 0.6 : 1 }}>
            {marking ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            만들었어요
          </button>
        </div>
      </div>

      {/* 사진 추가 안내 시트 (만들었어요 직후) */}
      {pendingPhotoLogId && (
        <PhotoPromptSheet
          onPick={(src) => onPickPhoto(src)}
          onSkip={() => setPendingPhotoLogId(null)}
          uploading={uploadingPhoto}
        />
      )}

      {/* 숨겨진 파일 input — 카메라 / 갤러리 */}
      <input ref={galleryInputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handlePhotoFile} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={handlePhotoFile} />

      {/* 기록 삭제 확인 */}
      {confirmDeleteLogId && (
        <ConfirmModal
          message="이 만든 기록을 삭제할까요?"
          description="첨부한 사진도 함께 사라져요."
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDeleteLog}
          onCancel={() => setConfirmDeleteLogId(null)}
        />
      )}
    </div>
  );
}

// ── 보조 컴포넌트들 ─────────────────────────────────────────────────────────

function CookLogRow({ log, onDelete }: { log: RecipeCookLog; onDelete: () => void }) {
  const { t } = useTheme();
  const d = new Date(log.cookedAt);
  const dateLabel = Number.isFinite(d.getTime())
    ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    : '';
  const timeLabel = Number.isFinite(d.getTime())
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '';

  return (
    <li className="flex items-center gap-3 rounded-xl p-2"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      {/* 사진 썸네일 또는 아이콘 */}
      <div className="flex-shrink-0 rounded-lg overflow-hidden"
        style={{ width: 56, height: 56, backgroundColor: t.bgSub,
          border: `1px solid ${t.border}` }}>
        {log.photoUrl ? (
          <img src={log.photoUrl} alt="" className="w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils size={20} color={t.textMuted} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{dateLabel}</div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
          {timeLabel}{log.photoUrl ? ' · 📸 사진' : ''}
        </div>
      </div>
      <button onClick={onDelete} aria-label="기록 삭제"
        className="p-2 rounded-lg active:scale-95 transition-transform"
        style={{ color: t.textMuted }}>
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function PhotoPromptSheet({ onPick, onSkip, uploading }:
  { onPick: (src: 'camera' | 'gallery') => void; onSkip: () => void; uploading: boolean }) {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={uploading ? undefined : onSkip}>
      <div className="w-full max-w-full rounded-t-2xl lg:max-w-[420px] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`,
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: t.text }}>오늘 만든 사진을 남길까요?</h3>
          <p style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>
            완성 사진은 만든 기록 타임라인에 함께 저장돼요.
          </p>
        </div>
        <div className="px-5 space-y-2">
          <button onClick={() => onPick('camera')} disabled={uploading}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 active:scale-[0.99]"
            style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent,
              opacity: uploading ? 0.6 : 1 }}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            카메라로 찍기
          </button>
          <button onClick={() => onPick('gallery')} disabled={uploading}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 active:scale-[0.99]"
            style={{ fontSize: 14, fontWeight: 700, color: t.accent,
              backgroundColor: t.accentLight, border: `1px solid ${t.accent}33`,
              opacity: uploading ? 0.6 : 1 }}>
            <ImagePlus size={15} /> 앨범에서 선택
          </button>
          <button onClick={onSkip} disabled={uploading}
            className="w-full rounded-xl py-2.5"
            style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, backgroundColor: 'transparent' }}>
            건너뛰기
          </button>
        </div>
      </div>
    </div>
  );
}
