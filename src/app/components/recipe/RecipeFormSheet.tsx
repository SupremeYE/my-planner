import React, { useState } from 'react';
import { X, ChevronLeft, Trash2, Plus, Clock } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { Recipe, RecipeIngredient, RecipeStep } from '../../store';
import { parseIngredientLine } from './recipeUtils';

interface RecipeFormSheetProps {
  recipe: Recipe | null;          // null = 신규 추가
  onSave: (recipe: Recipe) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

interface StepDraft {
  instruction: string;
  timerMin: string;               // 분 단위 입력 (선택)
}

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 편집 시 재료 배열 → 텍스트(한 줄에 하나) 복원
function ingredientsToText(ings: RecipeIngredient[]): string {
  return ings
    .map(g => [g.name, g.amount != null ? String(g.amount) : '', g.unit ?? ''].join(' ').replace(/\s+/g, ' ').trim())
    .join('\n');
}

export function RecipeFormSheet({ recipe, onSave, onDelete, onClose }: RecipeFormSheetProps) {
  const { t } = useTheme();
  const isEdit = !!recipe;

  const [title, setTitle] = useState(recipe?.title ?? '');
  const [baseServings, setBaseServings] = useState<number>(recipe?.baseServings ?? 2);
  const [totalMinutes, setTotalMinutes] = useState(
    recipe?.totalMinutes != null ? String(recipe.totalMinutes) : '',
  );
  const [ingredientsText, setIngredientsText] = useState(
    recipe ? ingredientsToText(recipe.ingredients) : '',
  );
  const [steps, setSteps] = useState<StepDraft[]>(
    recipe && recipe.steps.length > 0
      ? recipe.steps.map(s => ({
          instruction: s.instruction,
          timerMin: s.timerSeconds != null ? String(Math.round((s.timerSeconds / 60) * 10) / 10) : '',
        }))
      : [{ instruction: '', timerMin: '' }],
  );
  const [sourceUrl, setSourceUrl] = useState(recipe?.sourceUrl ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(recipe?.thumbnailUrl ?? '');
  const [submitting, setSubmitting] = useState(false);

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 10, padding: '9px 11px', fontSize: 14,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  const updateStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addStep = () => setSteps(prev => [...prev, { instruction: '', timerMin: '' }]);
  const removeStep = (i: number) =>
    setSteps(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);

    // 재료 분해
    const ingredients: RecipeIngredient[] = ingredientsText
      .split('\n')
      .map(parseIngredientLine)
      .filter((x): x is NonNullable<typeof x> => x != null)
      .map((x, i) => ({ id: newId(), name: x.name, amount: x.amount, unit: x.unit, sortOrder: i }));

    // 단계 분해 (빈 단계 제외)
    const recipeSteps: RecipeStep[] = steps
      .filter(s => s.instruction.trim())
      .map((s, i) => {
        const min = parseFloat(s.timerMin);
        const timerSeconds = Number.isFinite(min) && min > 0 ? Math.round(min * 60) : null;
        return { id: newId(), stepNo: i + 1, instruction: s.instruction.trim(), timerSeconds, sortOrder: i };
      });

    const minNum = parseInt(totalMinutes, 10);

    const result: Recipe = {
      id: recipe?.id ?? newId(),
      title: title.trim(),
      sourceType: recipe?.sourceType ?? 'manual',
      sourceUrl: sourceUrl.trim() || null,
      thumbnailUrl: thumbnailUrl.trim() || null,
      totalMinutes: Number.isFinite(minNum) && minNum > 0 ? minNum : null,
      baseServings: baseServings >= 1 ? baseServings : 1,
      rating: recipe?.rating ?? null,
      memo: recipe?.memo ?? null,
      ingredients,
      steps: recipeSteps,
      createdAt: recipe?.createdAt,
    };
    onSave(result);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <style>{`@keyframes recipeSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.recipe-form-sheet{animation:recipeSheetUp .26s ease-out}}`}</style>
      <div
        className="recipe-form-sheet shadow-2xl overflow-y-auto w-full max-w-full h-[100dvh] rounded-t-2xl
          lg:w-[520px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="취소">
            <ChevronLeft size={22} />
          </button>
          <h2 className="flex-1 text-center lg:flex-none lg:text-left"
            style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {isEdit ? '레시피 수정' : '레시피 추가'}
          </h2>
          <button type="submit" form="recipe-form" disabled={submitting}
            className="lg:hidden px-3 py-1.5 rounded-lg"
            style={{ fontSize: 14, fontWeight: 700, color: submitting ? t.textMuted : t.accent, opacity: submitting ? 0.5 : 1 }}>
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

          {/* 재료 */}
          <div>
            <label style={labelStyle}>재료 — 한 줄에 하나</label>
            <textarea value={ingredientsText} onChange={e => setIngredientsText(e.target.value)}
              rows={5} placeholder={'예)\n돼지고기 200g\n양파 1개\n간장 2큰술'}
              style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }} />
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
              "이름 수량 단위" 순으로 적으면 인분 환산에 사용돼요. (예: 양파 1개)
            </p>
          </div>

          {/* 요리 순서 */}
          <div>
            <label style={labelStyle}>요리 순서 — 단계별 타이머(분)는 선택</label>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 rounded-full flex items-center justify-center"
                    style={{ width: 24, height: 24, marginTop: 8, backgroundColor: t.accentLight, color: t.accent, fontSize: 12, fontWeight: 700 }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <textarea value={s.instruction} onChange={e => updateStep(i, { instruction: e.target.value })}
                      rows={2} placeholder={`${i + 1}단계 설명`}
                      style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} color={t.textMuted} />
                      <input type="number" inputMode="decimal" min={0} step="0.5" value={s.timerMin}
                        onChange={e => updateStep(i, { timerMin: e.target.value })}
                        placeholder="타이머(분)"
                        style={{ ...fieldStyle, width: 120, padding: '6px 9px', fontSize: 13 }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeStep(i)} disabled={steps.length <= 1}
                    className="flex-shrink-0 p-1.5 rounded-lg" style={{ marginTop: 6, color: steps.length <= 1 ? t.textMuted : t.danger, opacity: steps.length <= 1 ? 0.4 : 1 }}
                    aria-label="단계 삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addStep}
              className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl w-full justify-center"
              style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.bgSub, color: t.textSub, border: `1px solid ${t.border}` }}>
              <Plus size={15} /> 단계 추가
            </button>
          </div>

          {/* 출처 링크 / 썸네일 */}
          <div>
            <label style={labelStyle}>출처 링크 (선택)</label>
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://…" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>썸네일 이미지 URL (선택)</label>
            <input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)}
              placeholder="https://…" style={fieldStyle} />
            {thumbnailUrl.trim() && (
              <img src={thumbnailUrl} alt="" className="mt-2 rounded-lg object-cover"
                style={{ width: '100%', maxHeight: 160, border: `1px solid ${t.border}` }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
          </div>

          {/* PC 저장 / 삭제 */}
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
            <button type="submit" disabled={submitting}
              className="px-5 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
