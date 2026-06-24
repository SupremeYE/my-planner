import React, { useEffect, useRef, useState } from 'react';
import {
  X, ChevronLeft, Trash2, Camera, ImagePlus, Wand2, Mic, MicOff, Youtube, Instagram, Link2, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { fetchYouTubeMetadata } from '../../../lib/youtube';
import { detectRecipeSourcePlatform, sourcePlatformLabel } from '../../../lib/recipeSource';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import type { Recipe, RecipeIngredient, RecipeStep } from '../../store';
import { parseIngredientLine } from './recipeUtils';
import { INTENT_TAG_PRESETS, MAIN_INGREDIENT_PRESETS } from './recipeTags';
import { PhotoCaptureSheet } from '../capture/PhotoCaptureSheet';
import type { ExtractedRecipe } from '../capture/useVisionExtract';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 요리 순서 한 줄에서 시간 표현("5분", "1시간 30분", "30초" 등)을 감지해 초로 변환.
// 감지된 시간이 있으면 그 단계에 timerSeconds 를 자동 세팅.
function detectTimerSeconds(instruction: string): number | null {
  let totalSec = 0;
  let found = false;

  // "X시간" or "X 시간"
  const hourMatch = instruction.match(/(\d+(?:\.\d+)?)\s*시간/);
  if (hourMatch) {
    totalSec += Math.round(parseFloat(hourMatch[1]) * 3600);
    found = true;
  }

  // "X분" or "X분간" or "X분 동안" (앞에 시간이 있어도 추가)
  const minMatch = instruction.match(/(\d+(?:\.\d+)?)\s*분/);
  if (minMatch) {
    totalSec += Math.round(parseFloat(minMatch[1]) * 60);
    found = true;
  }

  // "X초" — 시간/분이 없을 때만 (단독 "30초" 등)
  if (!hourMatch && !minMatch) {
    const secMatch = instruction.match(/(\d+(?:\.\d+)?)\s*초/);
    if (secMatch) {
      totalSec += Math.round(parseFloat(secMatch[1]));
      found = true;
    }
  }

  return found && totalSec > 0 ? totalSec : null;
}



interface RecipeFormSheetProps {
  recipe: Recipe | null;          // null = 신규 추가
  onSave: (recipe: Recipe) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

// 편집 모드에서 재료 배열 → textarea 텍스트 복원
function ingredientsToText(ings: RecipeIngredient[]): string {
  return ings
    .map(g => [g.name, g.amount != null ? String(g.amount) : '', g.unit ?? ''].join(' ').replace(/\s+/g, ' ').trim())
    .join('\n');
}
function stepsToText(steps: RecipeStep[]): string {
  return steps.map(s => s.instruction).join('\n');
}

// 출처 플랫폼 아이콘
function PlatformIcon({ platform, size = 16, color }: { platform: ReturnType<typeof detectRecipeSourcePlatform>; size?: number; color: string }) {
  if (platform === 'youtube' || platform === 'shorts') return <Youtube size={size} color={color} />;
  if (platform === 'instagram') return <Instagram size={size} color={color} />;
  if (platform === 'other') return <Link2 size={size} color={color} />;
  return null;
}

export function RecipeFormSheet({ recipe, onSave, onDelete, onClose }: RecipeFormSheetProps) {
  const { t } = useTheme();
  const isEdit = !!recipe;

  // 기본
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [baseServings, setBaseServings] = useState<number>(recipe?.baseServings ?? 2);
  const [totalMinutes, setTotalMinutes] = useState(
    recipe?.totalMinutes != null ? String(recipe.totalMinutes) : '',
  );

  // 사진
  const [thumbnailUrl, setThumbnailUrl] = useState(recipe?.thumbnailUrl ?? '');
  const [myPhotoUrl, setMyPhotoUrl] = useState(recipe?.myPhotoUrl ?? '');
  const [coverSource, setCoverSource] = useState<Recipe['coverSource']>(recipe?.coverSource ?? 'thumbnail');
  const [uploading, setUploading] = useState(false);
  const recipeIdRef = useRef<string>(recipe?.id ?? newId());

  // 출처
  const [sourceUrl, setSourceUrl] = useState(recipe?.sourceUrl ?? '');
  const [oembedLoading, setOembedLoading] = useState(false);
  const platform = detectRecipeSourcePlatform(sourceUrl);

  // 태그
  // 구조: "후보 칩(프리셋 + 직접 추가)" 과 "선택된 것(Set)" 을 분리.
  //  - 탭 = 선택/해제만(칩은 사라지지 않음), 저장 시 선택된 것만 tags/main_ingredients 에 저장.
  //  - 직접 추가 = 후보에 등록 + 자동 선택. 커스텀 칩은 ✕ 로 후보에서 삭제.
  const presetIntents = INTENT_TAG_PRESETS;
  const presetMainNames = MAIN_INGREDIENT_PRESETS.map(p => p.name);
  const [intentTags, setIntentTags] = useState<Set<string>>(new Set(recipe?.tags ?? []));
  const [mainIngs, setMainIngs] = useState<Set<string>>(new Set(recipe?.mainIngredients ?? []));
  const [customIntentOptions, setCustomIntentOptions] = useState<string[]>(
    (recipe?.tags ?? []).filter(x => !presetIntents.includes(x)),
  );
  const [customMainOptions, setCustomMainOptions] = useState<string[]>(
    (recipe?.mainIngredients ?? []).filter(x => !presetMainNames.includes(x)),
  );
  const [customIntentInput, setCustomIntentInput] = useState('');
  const [customMainInput, setCustomMainInput] = useState('');

  // 재료·요리 순서 (접힌 선택 섹션)
  const initialHasDetails = (recipe?.ingredients?.length ?? 0) > 0 || (recipe?.steps?.length ?? 0) > 0;
  const [detailsOpen, setDetailsOpen] = useState(initialHasDetails);
  const [ingredientsText, setIngredientsText] = useState(recipe ? ingredientsToText(recipe.ingredients) : '');
  const [stepsText, setStepsText] = useState(recipe ? stepsToText(recipe.steps) : '');
  const [pasteText, setPasteText] = useState('');
  const [showCapture, setShowCapture] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // PC: textarea에서 Cmd/Ctrl+Enter 로 폼 제출 (Enter 단독은 줄바꿈 유지)
  const submitOnModEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  // 음성 입력 — 각 textarea 별로 append (Whisper 단일 경로)
  const voiceIng = useVoiceInput();
  const voiceStep = useVoiceInput();
  const ingListening = voiceIng.status === 'recording';
  const ingBusy = voiceIng.status === 'transcribing';
  const stepListening = voiceStep.status === 'recording';
  const stepBusy = voiceStep.status === 'transcribing';
  const speechErr = voiceIng.error ?? voiceStep.error;

  useEffect(() => {
    if (voiceIng.text) {
      setIngredientsText(prev => (prev.trim() ? `${prev.trim()}\n${voiceIng.text}` : voiceIng.text));
      voiceIng.setText('');
    }
  }, [voiceIng.text, voiceIng.setText]);
  useEffect(() => {
    if (voiceStep.text) {
      setStepsText(prev => (prev.trim() ? `${prev.trim()}\n${voiceStep.text}` : voiceStep.text));
      voiceStep.setText('');
    }
  }, [voiceStep.text, voiceStep.setText]);

  // 출처 URL: YouTube/쇼츠면 oEmbed 자동 채움 — 비어있을 때만 덮어쓰지 않음.
  // onBlur 처리 + paste 직후 처리.
  const tryFetchOembed = async (url: string) => {
    const p = detectRecipeSourcePlatform(url);
    if (p !== 'youtube' && p !== 'shorts') return;
    setOembedLoading(true);
    try {
      const meta = await fetchYouTubeMetadata(url);
      if (meta) {
        if (!title.trim() && meta.title) setTitle(meta.title);
        if (!thumbnailUrl.trim() && meta.thumbnail_url) setThumbnailUrl(meta.thumbnail_url);
      }
    } finally {
      setOembedLoading(false);
    }
  };

  // 사진 업로드
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onPickPhoto = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try {
      const url = await db.recipes.uploadPhoto(recipeIdRef.current, f);
      if (url) {
        setMyPhotoUrl(url);
        setCoverSource('my_photo');
      }
    } finally {
      setUploading(false);
    }
  };

  // 태그 토글(선택/해제만 — 칩은 사라지지 않음)
  const toggleIntent = (tag: string) =>
    setIntentTags(prev => { const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next; });
  const toggleMain = (name: string) =>
    setMainIngs(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });

  // 직접 추가 = 후보 등록 + 자동 선택
  const addCustomIntent = () => {
    const v = customIntentInput.trim();
    if (!v) return;
    if (!presetIntents.includes(v) && !customIntentOptions.includes(v)) {
      setCustomIntentOptions(prev => [...prev, v]);
    }
    setIntentTags(prev => new Set([...prev, v]));
    setCustomIntentInput('');
  };
  const addCustomMain = () => {
    const v = customMainInput.trim();
    if (!v) return;
    if (!presetMainNames.includes(v) && !customMainOptions.includes(v)) {
      setCustomMainOptions(prev => [...prev, v]);
    }
    setMainIngs(prev => new Set([...prev, v]));
    setCustomMainInput('');
  };

  // 커스텀 칩 후보 삭제(✕) — 후보·선택에서 모두 제거
  const removeCustomIntent = (tag: string) => {
    setCustomIntentOptions(prev => prev.filter(x => x !== tag));
    setIntentTags(prev => { const next = new Set(prev); next.delete(tag); return next; });
  };
  const removeCustomMain = (name: string) => {
    setCustomMainOptions(prev => prev.filter(x => x !== name));
    setMainIngs(prev => { const next = new Set(prev); next.delete(name); return next; });
  };

  // 붙여넣기 → '줄 단위로 정리' (AI 아님): 빈 줄 기준으로 위/아래 두 블록이면 위는 재료, 아래는 단계.
  // 단일 블록이면 우선 단계로 채움(사용자가 잘라 옮기기 쉬움).
  const handleOrganizePaste = () => {
    const t2 = pasteText.trim();
    if (!t2) return;
    const blocks = t2.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (blocks.length >= 2) {
      const ingBlock = blocks[0];
      const stepBlock = blocks.slice(1).join('\n');
      setIngredientsText(prev => (prev.trim() ? `${prev.trim()}\n${ingBlock}` : ingBlock));
      setStepsText(prev => (prev.trim() ? `${prev.trim()}\n${stepBlock}` : stepBlock));
    } else {
      // 한 덩어리 — 단계로 채움
      setStepsText(prev => (prev.trim() ? `${prev.trim()}\n${blocks[0] ?? ''}` : (blocks[0] ?? '')));
    }
    setPasteText('');
  };

  // 사진 AI 추출 결과 → 재료/순서 텍스트에 추가(붙여넣기 정리와 동일한 텍스트 경로).
  //  - ingredients/steps 줄은 그대로 textarea 에 합치고, 저장 시 기존 parseIngredientLine·detectTimerSeconds 가 처리.
  //  - title 은 제목이 비어 있을 때만 채움. (사진 자체는 레시피 대표 사진과 무관 — 캡처 화면이므로 버림)
  const handlePhotoConfirm = (r: ExtractedRecipe) => {
    if (r.title && !title.trim()) setTitle(r.title);
    if (r.ingredients.length) {
      const block = r.ingredients.join('\n');
      setIngredientsText(prev => (prev.trim() ? `${prev.trim()}\n${block}` : block));
    }
    if (r.steps.length) {
      const block = r.steps.join('\n');
      setStepsText(prev => (prev.trim() ? `${prev.trim()}\n${block}` : block));
    }
    if (r.ingredients.length || r.steps.length) setDetailsOpen(true);
    setShowCapture(false);
  };

  // 저장
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting || uploading) return;
    setSubmitting(true);

    // 재료 분해(있을 때만)
    const ingredients: RecipeIngredient[] = (detailsOpen ? ingredientsText : '')
      .split(/[\n,]/)
      .map(parseIngredientLine)
      .filter((x): x is NonNullable<typeof x> => x != null)
      .map((x, i) => ({ id: newId(), name: x.name, amount: x.amount, unit: x.unit, sortOrder: i }));

    // 단계 분해(있을 때만)
    const steps: RecipeStep[] = (detailsOpen ? stepsText : '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map((s, i) => ({ id: newId(), stepNo: i + 1, instruction: s, timerSeconds: detectTimerSeconds(s), sortOrder: i }));

    const minNum = parseInt(totalMinutes, 10);
    const detected = detectRecipeSourcePlatform(sourceUrl);
    const sourceType: Recipe['sourceType'] =
      detected === 'youtube' || detected === 'shorts' ? 'reels'
      : detected === 'instagram' ? 'reels'
      : detected === 'other' ? 'link'
      : 'manual';

    const result: Recipe = {
      id: recipeIdRef.current,
      title: title.trim(),
      sourceType: recipe?.sourceType ?? sourceType,
      sourceUrl: sourceUrl.trim() || null,
      thumbnailUrl: thumbnailUrl.trim() || null,
      myPhotoUrl: myPhotoUrl.trim() || null,
      coverSource: myPhotoUrl.trim()
        ? coverSource
        : 'thumbnail',     // 내 사진이 비어 있으면 자동 썸네일로 강제
      totalMinutes: Number.isFinite(minNum) && minNum > 0 ? minNum : null,
      baseServings: baseServings >= 1 ? baseServings : 1,
      rating: recipe?.rating ?? null,
      memo: recipe?.memo ?? null,
      tags: Array.from(intentTags),
      mainIngredients: Array.from(mainIngs),
      cookCount: recipe?.cookCount ?? 0,
      lastCookedAt: recipe?.lastCookedAt ?? null,
      ingredients,
      steps,
      createdAt: recipe?.createdAt,
    };
    onSave(result);
  };

  // ── 스타일 헬퍼 ──
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 10, padding: '9px 11px', fontSize: 14,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };
  const chip = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap',
    padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: active ? 700 : 500,
    backgroundColor: active ? t.accent : t.bgSub,
    color: active ? '#fff' : t.textSub,
    border: `1px solid ${active ? t.accent : t.border}`,
  });

  // ── 사진 타일 ──
  const PhotoTile = ({
    label, url, isCover, onSelect, onAction, actionLabel, actionIcon,
    placeholder,
  }: {
    label: string; url: string; isCover: boolean;
    onSelect: () => void; onAction?: () => void;
    actionLabel?: string; actionIcon?: React.ReactNode;
    placeholder: React.ReactNode;
  }) => (
    <div className="flex-1 min-w-0">
      <button type="button" onClick={url ? onSelect : (onAction ?? (() => {}))}
        className="w-full rounded-xl overflow-hidden relative active:scale-[0.98] transition-transform"
        style={{
          aspectRatio: '4 / 3',
          border: `2px solid ${isCover && url ? t.accent : t.border}`,
          backgroundColor: t.bgSub,
        }}>
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : placeholder}
        {url && isCover && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md"
            style={{ fontSize: 10, fontWeight: 700, backgroundColor: t.accent, color: '#fff' }}>대표</span>
        )}
      </button>
      <div className="flex items-center justify-between gap-1 mt-1.5" style={{ fontSize: 11, color: t.textSub }}>
        <span>{label}</span>
        {onAction && (
          <button type="button" onClick={onAction}
            className="flex items-center gap-1 px-2 py-1 rounded-md active:scale-95"
            style={{ fontSize: 11, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight }}>
            {actionIcon} {actionLabel}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes recipeSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.recipe-form-sheet{animation:recipeSheetUp .26s ease-out}}`}</style>
      <div className="recipe-form-sheet shadow-2xl overflow-y-auto w-full max-w-full h-[100dvh] rounded-t-2xl
          lg:w-[560px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="취소">
            <ChevronLeft size={22} />
          </button>
          <h2 className="flex-1 text-center lg:flex-none lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {isEdit ? '레시피 수정' : '레시피 추가'}
          </h2>
          <button type="submit" form="recipe-form" disabled={submitting || uploading}
            className="lg:hidden px-3 py-1.5 rounded-lg"
            style={{ fontSize: 14, fontWeight: 700, color: (submitting || uploading) ? t.textMuted : t.accent, opacity: (submitting || uploading) ? 0.5 : 1 }}>
            {submitting ? '저장 중…' : '저장'}
          </button>
          <button type="button" onClick={onClose} className="hidden lg:block p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <form id="recipe-form" onSubmit={handleSubmit}
          className="px-4 lg:px-5 pb-5 space-y-4"
          style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* 이름 */}
          <div>
            <label style={labelStyle}>레시피 이름 *</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="예: 김치볶음밥" style={fieldStyle} />
          </div>

          {/* 사진 영역 */}
          <div>
            <label style={labelStyle}>대표 사진</label>
            <div className="flex gap-3">
              {/* 자동 썸네일 타일 */}
              <PhotoTile
                label="자동 썸네일"
                url={thumbnailUrl}
                isCover={coverSource === 'thumbnail'}
                onSelect={() => setCoverSource('thumbnail')}
                placeholder={
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1"
                    style={{ color: t.textMuted, fontSize: 11 }}>
                    {oembedLoading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={22} />}
                    <span>{oembedLoading ? '불러오는 중…' : '링크에서 자동'}</span>
                  </div>
                }
              />
              {/* 내가 만든 사진 타일 */}
              <PhotoTile
                label="내가 만든 사진"
                url={myPhotoUrl}
                isCover={coverSource === 'my_photo' && !!myPhotoUrl}
                onSelect={() => myPhotoUrl && setCoverSource('my_photo')}
                onAction={onPickPhoto}
                actionLabel={uploading ? '업로드 중…' : myPhotoUrl ? '교체' : '추가'}
                actionIcon={uploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                placeholder={
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1"
                    style={{ color: t.textMuted, fontSize: 11 }}>
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={22} />}
                    <span>{uploading ? '업로드 중…' : '카메라/갤러리'}</span>
                  </div>
                }
              />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            {!!myPhotoUrl && (
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                탭하면 대표 이미지가 바뀌어요. (현재: {coverSource === 'my_photo' ? '내 사진' : '자동 썸네일'})
              </p>
            )}
          </div>

          {/* 인분 + 조리 시간 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>기준 인분</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setBaseServings(v => Math.max(1, v - 1))}
                  className="rounded-lg flex items-center justify-center"
                  style={{ width: 38, height: 38, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 18 }}>−</button>
                <span style={{ minWidth: 56, textAlign: 'center', fontSize: 15, fontWeight: 600, color: t.text }}>{baseServings}인분</span>
                <button type="button" onClick={() => setBaseServings(v => v + 1)}
                  className="rounded-lg flex items-center justify-center"
                  style={{ width: 38, height: 38, border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, fontSize: 18 }}>+</button>
              </div>
            </div>
            <div className="w-28">
              <label style={labelStyle}>조리 시간(분)</label>
              <input type="number" inputMode="numeric" min={0} value={totalMinutes}
                onChange={e => setTotalMinutes(e.target.value)} placeholder="선택" style={fieldStyle} />
            </div>
          </div>

          {/* 출처 링크 */}
          <div>
            <label style={labelStyle}>출처 링크 (선택)</label>
            <div className="relative">
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                onBlur={(e) => tryFetchOembed(e.target.value)}
                onPaste={(e) => {
                  const txt = e.clipboardData.getData('text');
                  if (txt) setTimeout(() => tryFetchOembed(txt), 0);
                }}
                placeholder="유튜브/쇼츠/인스타 링크 붙여넣기" style={fieldStyle} />
              {platform && (
                <div className="absolute right-2.5 top-1/2 flex items-center gap-1"
                  style={{ transform: 'translateY(-50%)', fontSize: 11, color: t.textSub }}>
                  <PlatformIcon platform={platform} color={t.textSub} />
                  <span>{sourcePlatformLabel(platform)}</span>
                </div>
              )}
            </div>
            {(platform === 'youtube' || platform === 'shorts') && (
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                {oembedLoading ? '유튜브에서 제목·썸네일 가져오는 중…' : '입력란 밖을 탭하면 자동으로 제목·썸네일을 채워요'}
              </p>
            )}
            {platform === 'instagram' && (
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>인스타그램은 링크·아이콘만 저장돼요</p>
            )}
          </div>

          {/* 태그 — 의도/상황 */}
          <div>
            <label style={labelStyle}>의도 · 상황</label>
            <div className="flex flex-wrap gap-1.5">
              {presetIntents.map(tag => (
                <button key={tag} type="button" onClick={() => toggleIntent(tag)} style={chip(intentTags.has(tag))}>
                  {tag}
                </button>
              ))}
              {/* 직접 추가한 후보(선택 해제해도 사라지지 않음, ✕로 삭제) */}
              {customIntentOptions.map(tag => {
                const active = intentTags.has(tag);
                return (
                  <span key={tag} style={chip(active)}>
                    <button type="button" onClick={() => toggleIntent(tag)} style={{ color: 'inherit', font: 'inherit' }}>{tag}</button>
                    <span role="button" tabIndex={0} aria-label={`${tag} 삭제`}
                      onClick={(e) => { e.stopPropagation(); removeCustomIntent(tag); }}
                      style={{ marginLeft: 5, opacity: 0.85, cursor: 'pointer', display: 'inline-flex' }}>
                      <X size={12} color={active ? '#fff' : t.textMuted} />
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input value={customIntentInput} onChange={e => setCustomIntentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomIntent(); } }}
                placeholder="직접 추가" className="flex-1 min-w-0" style={{ ...fieldStyle, padding: '7px 10px', fontSize: 13 }} />
              <button type="button" onClick={addCustomIntent} disabled={!customIntentInput.trim()}
                className="px-3 rounded-lg flex-shrink-0" style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                  color: customIntentInput.trim() ? '#fff' : t.textMuted,
                  backgroundColor: customIntentInput.trim() ? t.accent : t.bgSub,
                  opacity: customIntentInput.trim() ? 1 : 0.6 }}>추가</button>
            </div>
          </div>

          {/* 태그 — 주재료 */}
          <div>
            <label style={labelStyle}>주재료 (냉장고 연결용)</label>
            <div className="flex flex-wrap gap-1.5">
              {MAIN_INGREDIENT_PRESETS.map(({ name, emoji }) => (
                <button key={name} type="button" onClick={() => toggleMain(name)} style={chip(mainIngs.has(name))}>
                  <span style={{ marginRight: 4 }}>{emoji}</span>{name}
                </button>
              ))}
              {customMainOptions.map(name => {
                const active = mainIngs.has(name);
                return (
                  <span key={name} style={chip(active)}>
                    <button type="button" onClick={() => toggleMain(name)} style={{ color: 'inherit', font: 'inherit' }}>{name}</button>
                    <span role="button" tabIndex={0} aria-label={`${name} 삭제`}
                      onClick={(e) => { e.stopPropagation(); removeCustomMain(name); }}
                      style={{ marginLeft: 5, opacity: 0.85, cursor: 'pointer', display: 'inline-flex' }}>
                      <X size={12} color={active ? '#fff' : t.textMuted} />
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input value={customMainInput} onChange={e => setCustomMainInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomMain(); } }}
                placeholder="직접 추가" className="flex-1 min-w-0" style={{ ...fieldStyle, padding: '7px 10px', fontSize: 13 }} />
              <button type="button" onClick={addCustomMain} disabled={!customMainInput.trim()}
                className="px-3 rounded-lg flex-shrink-0" style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                  color: customMainInput.trim() ? '#fff' : t.textMuted,
                  backgroundColor: customMainInput.trim() ? t.accent : t.bgSub,
                  opacity: customMainInput.trim() ? 1 : 0.6 }}>추가</button>
            </div>
          </div>

          {/* 재료·요리 순서 — 접힌 선택 섹션 */}
          <div>
            <button type="button" onClick={() => setDetailsOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600 }}>
              <span>재료 · 요리 순서 (선택)</span>
              {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {detailsOpen && (
              <div className="mt-3 space-y-4">
                {/* 사진으로 자동 채우기 (AI) */}
                <div>
                  <button type="button" onClick={() => setShowCapture(true)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl w-full justify-center active:scale-[0.99] transition-transform"
                    style={{ fontSize: 13, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, border: `1px dashed ${t.accent}` }}>
                    📸 사진으로 채우기
                  </button>
                  <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                    레시피 화면(숏츠/블로그)을 캡처해서 올리면 재료·순서를 자동으로 읽어와요.
                  </p>
                </div>

                {/* 붙여넣기 + 정리 버튼 */}
                <div>
                  <label style={labelStyle}>캡션/메모 붙여넣기 (자동 정리)</label>
                  <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                    onKeyDown={submitOnModEnter}
                    rows={3}
                    placeholder={'유튜브 캡션이나 메모를 그대로 붙여넣어요.\n빈 줄로 구분하면 위는 재료, 아래는 순서로 넣어요.'}
                    style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
                  <button type="button" onClick={handleOrganizePaste} disabled={!pasteText.trim()}
                    className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl w-full justify-center"
                    style={{ fontSize: 13, fontWeight: 700,
                      color: pasteText.trim() ? '#fff' : t.textMuted,
                      backgroundColor: pasteText.trim() ? t.accent : t.bgSub,
                      opacity: pasteText.trim() ? 1 : 0.6 }}>
                    <Wand2 size={14} /> 줄 단위로 정리
                  </button>
                  {speechErr && (
                    <p style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{speechErr}</p>
                  )}
                </div>

                {/* 재료 textarea + 음성 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>재료 — 한 줄에 하나</label>
                    <button type="button"
                      onClick={() => (ingListening ? voiceIng.stopRecording() : voiceIng.startRecording())}
                      disabled={ingBusy}
                      className="flex items-center gap-1 px-2 py-1 rounded-md"
                      style={{ fontSize: 11, fontWeight: 600,
                        color: ingListening ? '#fff' : t.textSub,
                        backgroundColor: ingListening ? t.danger : t.bgSub,
                        border: `1px solid ${ingListening ? t.danger : t.border}` }}>
                      {ingListening ? <MicOff size={11} /> : <Mic size={11} />}
                      {ingBusy ? '변환…' : ingListening ? '정지' : '음성'}
                    </button>
                  </div>
                  <textarea value={ingredientsText} onChange={e => setIngredientsText(e.target.value)}
                    onKeyDown={submitOnModEnter}
                    rows={4} placeholder={'예)\n돼지고기 200g\n양파 1개\n간장 2큰술'}
                    style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }} />
                  <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                    "이름 수량 단위" 순으로 적으면 인분 환산에 사용돼요.
                  </p>
                </div>

                {/* 요리 순서 textarea + 음성 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>요리 순서 — 한 줄에 한 단계</label>
                    <button type="button"
                      onClick={() => (stepListening ? voiceStep.stopRecording() : voiceStep.startRecording())}
                      disabled={stepBusy}
                      className="flex items-center gap-1 px-2 py-1 rounded-md"
                      style={{ fontSize: 11, fontWeight: 600,
                        color: stepListening ? '#fff' : t.textSub,
                        backgroundColor: stepListening ? t.danger : t.bgSub,
                        border: `1px solid ${stepListening ? t.danger : t.border}` }}>
                      {stepListening ? <MicOff size={11} /> : <Mic size={11} />}
                      {stepBusy ? '변환…' : stepListening ? '정지' : '음성'}
                    </button>
                  </div>
                  <textarea value={stepsText} onChange={e => setStepsText(e.target.value)}
                    onKeyDown={submitOnModEnter}
                    rows={5} placeholder={'예)\n팬에 기름을 두르고 양파를 볶는다\n돼지고기를 넣고 갈색이 될 때까지 5분 동안 익힌다\n…'}
                    style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }} />
                  <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                    ⏱ "5분", "10분 동안", "30초" 등 시간 표현이 있으면 요리 뷰에서 타이머 버튼이 자동으로 나타나요.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 저장 / 삭제 */}
          <div className="flex items-center gap-2 pt-1">
            {isEdit && onDelete && (
              <button type="button" onClick={() => onDelete(recipe!.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl"
                style={{ fontSize: 14, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                <Trash2 size={16} /> 삭제
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="hidden lg:block px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              취소
            </button>
            <button type="submit" disabled={submitting || uploading}
              className="px-5 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: (submitting || uploading) ? 0.6 : 1 }}>
              {submitting ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* 사진 캡처 시트 — 폼 위에 떠야 하므로 폼 div 뒤(상단 스택)에 렌더 */}
    {showCapture && (
      <PhotoCaptureSheet
        domain="recipe"
        onConfirmRecipe={handlePhotoConfirm}
        onManualFallback={() => setShowCapture(false)}
        onClose={() => setShowCapture(false)}
      />
    )}
    </>
  );
}
