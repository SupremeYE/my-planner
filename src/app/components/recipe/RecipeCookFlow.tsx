import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Timer, Check, Utensils, Play, PartyPopper,
} from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { usePlanner, type Recipe, type MealType } from '../../store';
import { useTimers, remainingSec, formatClock } from '../../timers/TimerProvider';
import { MAIN_INGREDIENT_PRESETS } from './recipeTags';

// DB에 저장된 timerSeconds가 null인 기존 레시피를 위한 폴백 — 단계 텍스트에서 실시간 감지.
// RecipeFormSheet의 detectTimerSeconds와 동일 로직.
function detectTimerSec(instruction: string): number | null {
  let total = 0;
  let found = false;
  const h = instruction.match(/(\d+(?:\.\d+)?)\s*시간/);
  if (h) { total += Math.round(parseFloat(h[1]) * 3600); found = true; }
  const m = instruction.match(/(\d+(?:\.\d+)?)\s*분/);
  if (m) { total += Math.round(parseFloat(m[1]) * 60); found = true; }
  if (!h && !m) {
    const s = instruction.match(/(\d+(?:\.\d+)?)\s*초/);
    if (s) { total += Math.round(parseFloat(s[1])); found = true; }
  }
  return found && total > 0 ? total : null;
}

// 대표 이미지 — RecipeDetail과 동일 규칙
function coverImage(r: Recipe): string | null {
  if (r.coverSource === 'my_photo' && r.myPhotoUrl) return r.myPhotoUrl;
  if (r.coverSource === 'thumbnail' && r.thumbnailUrl) return r.thumbnailUrl;
  return r.myPhotoUrl || r.thumbnailUrl || null;
}

const MAIN_EMOJI: Record<string, string> = Object.fromEntries(
  MAIN_INGREDIENT_PRESETS.map(p => [p.name, p.emoji]),
);

// 현재 시각 기반 기본 끼니 추정
function guessMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

const MEAL_OPTIONS: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast', label: '아침', emoji: '🌅' },
  { key: 'lunch', label: '점심', emoji: '☀️' },
  { key: 'dinner', label: '저녁', emoji: '🌙' },
  { key: 'snack', label: '간식', emoji: '🍪' },
];

interface RecipeCookFlowProps {
  recipe: Recipe;
  onClose: () => void;
}

// 릴스형 요리 뷰 — 한 단계 = 한 전체화면 카드. C-1 공용 타이머 엔진 사용.
export function RecipeCookFlow({ recipe, onClose }: RecipeCookFlowProps) {
  const { t } = useTheme();
  const { startTimer, timers, nowMs, openPanel } = useTimers();
  const { addFoodRecord } = usePlanner();

  const steps = useMemo(
    () => [...recipe.steps].sort((a, b) => (a.sortOrder ?? a.stepNo) - (b.sortOrder ?? b.stepNo)),
    [recipe.steps],
  );
  const total = steps.length;
  // index === total → '완성' 화면
  const [index, setIndex] = useState(0);
  const isDone = index >= total;

  // 완성 화면 상태
  const [savedMeal, setSavedMeal] = useState<MealType | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(guessMeal());

  // 스와이프 트래킹
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goNext = () => setIndex(i => Math.min(i + 1, total));
  const goPrev = () => setIndex(i => Math.max(i - 1, 0));

  // 키보드 좌우 네비 (PC)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // 수평 스와이프만 인식 (수직 스크롤 제스처 무시)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  // 화면 좌/우 탭 영역 클릭으로 이동
  const onTapZone = (dir: 'prev' | 'next') => (dir === 'next' ? goNext() : goPrev());

  const cover = coverImage(recipe);

  const handleAddMeal = () => {
    addFoodRecord({
      date: new Date().toISOString().slice(0, 10),
      mealType: selectedMeal,
      foodName: recipe.title,
      amount: 0,
      photoUrl: cover,
      memo: '레시피로 직접 만든 요리 🍳',
      calories: null,
      carbs: null,
      protein: null,
      fat: null,
      diningType: 'home',
      tasteRating: null,
      tasteMemo: null,
      isFasting: false,
    });
    setSavedMeal(selectedMeal);
  };

  const step = !isDone ? steps[index] : null;

  // 현재 단계 설명에 언급된 재료만 칩으로 (단계별 재료 매핑이 없으므로 텍스트 매칭)
  const stepIngredients = useMemo(() => {
    if (!step) return [];
    const instr = step.instruction || '';
    return recipe.ingredients.filter(g => g.name && instr.includes(g.name));
  }, [step, recipe.ingredients]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.stopPropagation()}>
      {/* PC: 중앙 정렬 모바일 폭 / 모바일: 풀스크린 */}
      <div className="relative w-full h-[100dvh] lg:h-[88vh] lg:my-[6vh] lg:max-w-[440px] lg:rounded-3xl overflow-hidden flex flex-col"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        {/* 상단: 진행 바 + 닫기 */}
        <div className="flex-shrink-0 px-4 z-20"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}>
          <div className="flex items-center gap-2 mb-2">
            {/* 세그먼트 진행 바 */}
            <div className="flex-1 flex gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className="flex-1 rounded-full overflow-hidden" style={{ height: 3, backgroundColor: t.bgSub }}>
                  <div className="h-full rounded-full" style={{
                    width: i < index ? '100%' : i === index && !isDone ? '100%' : '0%',
                    backgroundColor: t.accent, transition: 'width .3s ease',
                  }} />
                </div>
              ))}
              {/* 완성 세그먼트 */}
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, backgroundColor: t.bgSub }}>
                <div className="h-full rounded-full" style={{ width: isDone ? '100%' : '0%', backgroundColor: t.accent, transition: 'width .3s ease' }} />
              </div>
            </div>
            <button onClick={onClose} aria-label="닫기" className="p-1 -mr-1 rounded-lg" style={{ color: t.textSub }}>
              <X size={22} />
            </button>
          </div>
          <div className="flex items-center justify-between pb-2">
            <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: t.textSub, maxWidth: '70%' }}>
              {recipe.title}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>
              {isDone ? '완성' : `${index + 1} / ${total}`}
            </span>
          </div>

          {/* 실행 중 타이머 — 미니칩이 이 풀스크린 뒤에 가려지므로 여기서 직접 시간 표시 */}
          {timers.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {timers.map(tm => {
                const done = tm.status === 'done';
                const rem = remainingSec(tm, nowMs);
                return (
                  <button key={tm.id} onClick={openPanel}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full flex-shrink-0 active:scale-95 transition-transform"
                    style={{
                      backgroundColor: done ? t.accent : t.accentLight,
                      border: `1px solid ${done ? t.accent : 'transparent'}`,
                    }}>
                    <Timer size={13} color={done ? '#fff' : t.accent} className={done ? '' : 'animate-pulse'} />
                    <span className="truncate" style={{ fontSize: 11, fontWeight: 600, maxWidth: 80,
                      color: done ? 'rgba(255,255,255,0.85)' : t.textSub }}>
                      {tm.label || '타이머'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                      color: done ? '#fff' : t.accent }}>
                      {done ? '완료!' : formatClock(rem)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 본문 */}
        {!isDone && step ? (
          <div className="flex-1 min-h-0 relative">
            {/* 좌/우 탭 영역 (투명) */}
            <button aria-label="이전 단계" onClick={() => onTapZone('prev')}
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10" style={{ background: 'transparent' }} />
            <button aria-label="다음 단계" onClick={() => onTapZone('next')}
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10" style={{ background: 'transparent' }} />

            <div className="h-full overflow-y-auto px-6 py-4 flex flex-col">
              {/* 단계 번호 배지 */}
              <div className="flex items-center justify-center rounded-full mx-auto mb-6"
                style={{ width: 52, height: 52, backgroundColor: t.accentLight, color: t.accent,
                  fontSize: 22, fontWeight: 800 }}>
                {step.stepNo ?? index + 1}
              </div>

              {/* 단계 설명 — 세리프 크게 */}
              <p className="text-center whitespace-pre-wrap"
                style={{ fontFamily: 'var(--font-gowun-serif)', fontSize: 24, lineHeight: 1.5,
                  color: t.text, fontWeight: 700 }}>
                {step.instruction}
              </p>

              {/* 단계 재료 칩 */}
              {stepIngredients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center mt-6">
                  {stepIngredients.map((g, i) => (
                    <span key={g.id ?? i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
                      style={{ fontSize: 12, fontWeight: 600, backgroundColor: t.card,
                        color: t.textSub, border: `1px solid ${t.border}` }}>
                      <Utensils size={11} color={t.accent} />
                      {g.name}
                      {g.amount != null && (
                        <span style={{ color: t.textMuted }}>{g.amount}{g.unit ?? ''}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex-1" />

              {/* 단계 타이머 — timerSeconds 있을 때만 */}
              {(() => {
                // DB 저장값 우선, null이면 텍스트에서 실시간 감지 (기존 레시피 폴백)
                const timerSec = (step.timerSeconds != null && step.timerSeconds > 0)
                  ? step.timerSeconds
                  : detectTimerSec(step.instruction);
                if (!timerSec) return null;
                const timerLabel = `${step.stepNo ?? index + 1}단계 · ${recipe.title}`;
                // 이미 이 단계 타이머가 실행/완료 중이면 라이브 카운트다운으로 전환 (중복 시작 방지)
                const active = timers.find(tm => tm.label === timerLabel);
                const durLabel = timerSec >= 60
                  ? `${Math.floor(timerSec / 60)}분${timerSec % 60 > 0 ? ` ${timerSec % 60}초` : ''}`
                  : `${timerSec}초`;

                if (active) {
                  const done = active.status === 'done';
                  const rem = remainingSec(active, nowMs);
                  return (
                    <button onClick={openPanel}
                      className="mx-auto mb-4 flex items-center gap-2.5 px-5 py-3 rounded-2xl active:scale-95 transition-transform"
                      style={{ fontSize: 16, fontWeight: 800,
                        color: '#fff', backgroundColor: done ? '#6BAA7A' : t.accent,
                        boxShadow: `0 8px 22px ${(done ? '#6BAA7A' : t.accent)}55` }}>
                      <Timer size={18} className={done ? '' : 'animate-pulse'} />
                      {done ? '⏰ 시간 완료!' : (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatClock(rem)} 남음</span>
                      )}
                    </button>
                  );
                }

                return (
                  <button
                    onClick={() => startTimer(timerSec, timerLabel)}
                    className="mx-auto mb-4 flex items-center gap-2 px-5 py-3 rounded-2xl active:scale-95 transition-transform"
                    style={{ fontSize: 15, fontWeight: 800, color: '#fff', backgroundColor: t.accent,
                      boxShadow: `0 8px 22px ${t.accent}55` }}>
                    <Timer size={18} />
                    타이머 시작 ({durLabel})
                  </button>
                );
              })()}
            </div>
          </div>
        ) : (
          // ── 완성 화면 ──
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 flex flex-col items-center">
            <div className="flex items-center justify-center rounded-full mb-4"
              style={{ width: 72, height: 72, backgroundColor: t.accentLight }}>
              <PartyPopper size={36} color={t.accent} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-gowun-serif)', fontSize: 26, fontWeight: 800, color: t.text, textAlign: 'center' }}>
              완성!
            </h2>
            <p style={{ fontSize: 14, color: t.textSub, marginTop: 6, textAlign: 'center' }}>
              {recipe.title} 요리를 끝냈어요 👏
            </p>

            {cover && (
              <img src={cover} alt="" className="mt-5 rounded-2xl object-cover"
                style={{ width: '100%', maxWidth: 280, aspectRatio: '16/10', border: `1px solid ${t.border}` }} />
            )}

            <div className="flex-1" />

            {savedMeal == null ? (
              <div className="w-full max-w-[340px] mt-6">
                {/* 끼니 선택 */}
                <p style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 8, textAlign: 'center' }}>
                  어떤 끼니로 기록할까요?
                </p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {MEAL_OPTIONS.map(m => {
                    const on = selectedMeal === m.key;
                    return (
                      <button key={m.key} onClick={() => setSelectedMeal(m.key)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                        style={{ backgroundColor: on ? t.accent : t.card,
                          border: `1px solid ${on ? t.accent : t.border}` }}>
                        <span style={{ fontSize: 18 }}>{m.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#fff' : t.textSub }}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleAddMeal}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 active:scale-[0.99] transition-transform"
                  style={{ fontSize: 15, fontWeight: 800, color: '#fff', backgroundColor: t.accent }}>
                  <Utensils size={18} /> 식사 기록에 추가
                </button>
                <button onClick={onClose}
                  className="w-full rounded-2xl py-3 mt-2"
                  style={{ fontSize: 14, fontWeight: 700, color: t.textMuted, backgroundColor: 'transparent' }}>
                  닫기
                </button>
              </div>
            ) : (
              <div className="w-full max-w-[340px] mt-6">
                <div className="flex items-center justify-center gap-2 rounded-2xl py-3.5 mb-2"
                  style={{ backgroundColor: '#6BAA7A', color: '#fff', fontSize: 14, fontWeight: 800 }}>
                  <Check size={18} /> 식사 기록에 추가됐어요
                </div>
                <button onClick={onClose}
                  className="w-full rounded-2xl py-4"
                  style={{ fontSize: 15, fontWeight: 800, color: '#fff', backgroundColor: t.accent }}>
                  닫기
                </button>
              </div>
            )}
          </div>
        )}

        {/* 하단 네비 (PC 화살표 + 모바일 보조) */}
        {!isDone && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 pb-4 pt-2"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
            <button onClick={goPrev} disabled={index === 0}
              className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
              style={{ width: 44, height: 44, backgroundColor: t.card, border: `1px solid ${t.border}`,
                color: index === 0 ? t.textMuted : t.text, opacity: index === 0 ? 0.4 : 1 }}>
              <ChevronLeft size={22} />
            </button>
            <span style={{ fontSize: 11, color: t.textMuted }}>좌우로 넘기기</span>
            <button onClick={goNext}
              className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
              style={{ width: 44, height: 44, backgroundColor: t.accent, color: '#fff' }}>
              {index === total - 1 ? <Play size={20} /> : <ChevronRight size={22} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
