import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sprout, Plus, ChevronDown, Sparkles, Target, RotateCcw, ArrowUpRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../ThemeContext';
import { useFabAction } from '../FabContext';
import { useSomedaySeeds } from '../hooks/useSomedaySeeds';
import ConfirmModal from './ConfirmModal';
import { type SeedKind, type SomedaySeed } from '../../lib/db';
import {
  isHaon, solidCardStyle, solidRowStyle, glassBarStyle, addPopoverStyle,
  bottomSheetStyle, sheetBackdropStyle, buttonStyle, withAlpha,
} from '../styles/haonStyles';
import {
  seedKindColor, SEED_KIND_LABELS, SEED_KIND_ORDER,
  SEED_FILTER_ORDER, SEED_FILTER_LABELS, type SeedKindFilter,
} from '../styles/seedKind';

// 페이지 타이틀(잠정 '언젠가' — 한 곳에서만 정의, 변경 용이)
const PAGE_TITLE = '언젠가';
const PAGE_SUBTITLE = '문득 든 삶의 방향·바람을 한 줄로 던져두는 씨앗밭';
const TEXT_MAX = 280; // DB CHECK 와 동일 상한

export function SomedayView() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const haon = isHaon(t);
  const { seeds, loading, addSeed, growToGoal, growToBucket, revertSeed } = useSomedaySeeds();

  // ── 던지기 입력 ──
  const [text, setText] = useState('');
  const [draftKind, setDraftKind] = useState<SeedKind>('none');
  const [kindOpen, setKindOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 결 필터 ──
  const [filter, setFilter] = useState<SeedKindFilter>('all');

  // ── 승격/자람 상태 ──
  const [growTarget, setGrowTarget] = useState<SomedaySeed | null>(null);   // 키우기 시트 대상
  const [menuTarget, setMenuTarget] = useState<SomedaySeed | null>(null);   // 자람 뱃지 메뉴 대상
  const [revertTarget, setRevertTarget] = useState<SomedaySeed | null>(null); // 되돌리기 확인 대상
  const [toast, setToast] = useState<{ text: string; goalLink?: boolean } | null>(null);

  // 토스트 자동 dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const hasInput = text.trim().length > 0;

  const submit = useCallback(async () => {
    if (!text.trim()) return;
    await addSeed(text, draftKind);
    setText('');
    setDraftKind('none');
    inputRef.current?.focus();
  }, [text, draftKind, addSeed]);

  // add-action: 모바일 FAB / lg 헤더 "+ 추가" 모두 던지기 입력에 포커스(던지기입력 shape, §5)
  const focusInput = useCallback(() => {
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inputRef.current?.focus();
  }, []);
  useFabAction({ kind: 'action', label: '씨앗 던지기', icon: Plus, onPress: focusInput });

  // ── 승격/자람 핸들러 ──
  // 키우기 시트는 씨앗(seed)일 때만 연다(중복 승격 가드).
  const openGrow = useCallback((seed: SomedaySeed) => {
    if (seed.status === 'seed') setGrowTarget(seed);
  }, []);

  const handleGrowToGoal = useCallback(async () => {
    const seed = growTarget;
    setGrowTarget(null);
    if (!seed) return;
    await growToGoal(seed);
    setToast({ text: '🌿 올해 목표로 키웠어요', goalLink: true });
  }, [growTarget, growToGoal]);

  const handleGrowToBucket = useCallback(async () => {
    const seed = growTarget;
    setGrowTarget(null);
    if (!seed) return;
    await growToBucket(seed);
    setToast({ text: '🪣 버킷에 담아뒀어요' });
  }, [growTarget, growToBucket]);

  const confirmRevert = useCallback(async () => {
    const seed = revertTarget;
    setRevertTarget(null);
    if (!seed) return;
    await revertSeed(seed);
  }, [revertTarget, revertSeed]);

  const visible = useMemo(
    () => (filter === 'all' ? seeds : seeds.filter(s => s.kind === filter)),
    [seeds, filter],
  );

  const draftColor = seedKindColor(t, draftKind);

  return (
    <div className="h-full overflow-y-auto relative" style={{ backgroundColor: t.bg, overflowX: 'clip' }}>
      {/* ── 헤더 (glassBarStyle 오버레이) ── */}
      <header
        className="sticky top-0 z-20 px-5 lg:px-14 pt-10 lg:pt-12 pb-4 flex items-start justify-between gap-3"
        style={{ ...glassBarStyle(t), ...(haon ? {} : { backgroundColor: t.bg }) }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5" style={{ color: t.accent }}>
            <Sprout size={16} strokeWidth={2.2} />
            <span style={{ fontFamily: t.fontNumeric, fontSize: 12, letterSpacing: 1, opacity: 0.9 }}>
              SOMEDAY
            </span>
          </div>
          <h1
            style={{ fontFamily: t.fontPageTitle, fontWeight: 700, fontSize: 28, lineHeight: 1.05, marginTop: 6, color: t.text }}
            className="lg:text-[30px]"
          >
            {PAGE_TITLE}
          </h1>
          <p style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5, marginTop: 6 }} className="lg:text-[14px]">
            {PAGE_SUBTITLE}
          </p>
        </div>
        {/* PC 전용 "+ 추가" — 던지기 입력으로 포커스(§5 ghost). 모바일은 하단 FAB */}
        <button
          onClick={focusInput}
          className="hidden lg:flex items-center gap-1.5 rounded-full flex-shrink-0"
          style={{ ...buttonStyle(t, 'ghost'), fontSize: 14, padding: '9px 16px', marginTop: 8 }}
        >
          <Plus size={17} /> 추가
        </button>
      </header>

      <div className="px-5 lg:px-14 pt-4 pb-24 lg:pb-10 max-w-3xl mx-auto">
        {/* ── 던지기 입력 (solidCardStyle) ── */}
        <div className="relative flex items-center gap-2 rounded-2xl px-3 py-2.5" style={solidCardStyle(t)}>
          {/* 결 칩 (▾ 팝오버, 기본 미분류) */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setKindOpen(o => !o)}
              className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-1.5 py-1"
              style={{ fontSize: 12, fontWeight: 600, color: draftColor.text, backgroundColor: draftColor.fill, whiteSpace: 'nowrap' }}
              aria-haspopup="listbox"
              aria-expanded={kindOpen}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: draftColor.dot, flexShrink: 0 }} />
              {SEED_KIND_LABELS[draftKind]}
              <ChevronDown size={13} />
            </button>
            {kindOpen && (
              <>
                {/* click-away */}
                <div className="fixed inset-0 z-30" onClick={() => setKindOpen(false)} />
                <div
                  role="listbox"
                  className="absolute left-0 top-full mt-1.5 z-40 py-1.5 min-w-[140px]"
                  style={addPopoverStyle(t)}
                >
                  {SEED_KIND_ORDER.map(k => {
                    const c = seedKindColor(t, k);
                    const on = k === draftKind;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => { setDraftKind(k); setKindOpen(false); inputRef.current?.focus(); }}
                        className="flex items-center gap-2 w-full text-left px-3 py-2"
                        style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: t.text, backgroundColor: on ? withAlpha(c.dot, 0.12) : 'transparent' }}
                      >
                        <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: c.dot, flexShrink: 0 }} />
                        {SEED_KIND_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            value={text}
            maxLength={TEXT_MAX}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="언젠가 …  한 줄로 던져두기"
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{ color: t.text, fontSize: 14 }}
          />

          {/* 코랄 그라디언트 원 버튼 */}
          <button
            type="button"
            onClick={submit}
            disabled={!hasInput}
            aria-label="씨앗 던지기"
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 34, height: 34,
              background: hasInput ? (t.primaryGradient ?? t.accent) : t.border,
              color: '#fff',
              opacity: hasInput ? 1 : 0.6,
              cursor: hasInput ? 'pointer' : 'not-allowed',
            }}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* ── 결 필터 칩 (가로 스크롤, §6.3 idiom) ── */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {SEED_FILTER_ORDER.map(f => {
            const on = f === filter;
            const c = f === 'all' ? null : seedKindColor(t, f);
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 flex-shrink-0"
                style={{
                  fontSize: 12.5, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap',
                  backgroundColor: on ? (c ? c.fill : t.text) : 'transparent',
                  color: on ? (c ? c.text : t.card) : t.textSub,
                  border: `1px solid ${on ? (c ? c.fill : t.text) : withAlpha(t.textMuted, 0.32)}`,
                  transition: 'background-color .15s, color .15s',
                }}
              >
                {c && <span style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: c.dot, flexShrink: 0 }} />}
                {SEED_FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>

        {/* ── 씨앗 리스트 ── */}
        <div className="mt-4 space-y-2.5">
          {loading ? null : visible.length === 0 ? (
            <EmptyState filtered={filter !== 'all'} />
          ) : (
            visible.map(seed => (
              <SeedRow
                key={seed.id}
                seed={seed}
                haon={haon}
                onGrow={() => openGrow(seed)}
                onOpenMenu={() => setMenuTarget(seed)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── 승격(키우기) 시트 — 모바일 바텀시트 / lg 중앙 팝오버(오버레이 글래스) ── */}
      {growTarget && (
        <GrowSheet
          seed={growTarget}
          onGoal={handleGrowToGoal}
          onBucket={handleGrowToBucket}
          onClose={() => setGrowTarget(null)}
        />
      )}

      {/* ── 자람 뱃지 메뉴 — 목표에서 보기 / 되돌리기 ── */}
      {menuTarget && (
        <GrownMenu
          seed={menuTarget}
          onViewGoal={() => { setMenuTarget(null); navigate('/goals'); }}
          onRevert={() => { const s = menuTarget; setMenuTarget(null); setRevertTarget(s); }}
          onClose={() => setMenuTarget(null)}
        />
      )}

      {/* ── 되돌리기 확인 (목표는 보존) ── */}
      {revertTarget && (
        <ConfirmModal
          message="이 씨앗을 되돌릴까요?"
          description="만들어둔 목표는 목표 페이지에 그대로 남아요. 씨앗만 다시 씨앗 상태로 돌아갑니다."
          confirmText="되돌리기"
          onConfirm={confirmRevert}
          onCancel={() => setRevertTarget(null)}
        />
      )}

      {/* ── 승격 피드백 토스트 (로컬 pill, 토큰만) ── */}
      {toast && (
        <div
          className="fixed left-1/2 z-[60] flex items-center gap-3 rounded-full px-4 py-2.5"
          style={{
            bottom: 'calc(84px + env(safe-area-inset-bottom))',
            transform: 'translateX(-50%)',
            backgroundColor: t.text, color: t.bg,
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(120,90,160,0.28)',
          }}
        >
          {toast.text}
          {toast.goalLink && (
            <button
              onClick={() => { setToast(null); navigate('/goals'); }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: withAlpha(t.bg, 0.18), color: t.bg, fontSize: 12, fontWeight: 700 }}
            >
              목표 보기 <ArrowUpRight size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 승격 시트 (모바일 바텀시트 / lg 중앙 팝오버) ──
function GrowSheet({ seed, onGoal, onBucket, onClose }: {
  seed: SomedaySeed; onGoal: () => void; onBucket: () => void; onClose: () => void;
}) {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0" style={sheetBackdropStyle()} onClick={onClose} />
      <div
        className="relative w-full lg:w-auto lg:min-w-[360px] lg:max-w-md px-5 pt-3 pb-6 lg:rounded-3xl"
        style={bottomSheetStyle(t)}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="lg:hidden mx-auto mb-3" style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: withAlpha(t.textMuted, 0.4) }} />
        <p style={{ fontFamily: t.fontSection, fontWeight: 700, fontSize: 16, color: t.text }}>씨앗 키우기</p>
        <p className="truncate" style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>“{seed.text}”</p>

        <div className="mt-4 space-y-2.5">
          <button
            onClick={onGoal}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
            style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
          >
            <span className="flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: t.primaryGradient ?? t.accent, color: '#fff', flexShrink: 0 }}>
              <Target size={18} />
            </span>
            <span className="min-w-0">
              <span className="block" style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>목표로</span>
              <span className="block" style={{ fontSize: 12, color: t.textSub }}>올해 연간 목표로 추가돼요</span>
            </span>
          </button>

          <button
            onClick={onBucket}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
            style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
          >
            <span className="flex items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: t.accentSoft, color: t.textSub, flexShrink: 0 }}>
              <Sprout size={18} />
            </span>
            <span className="min-w-0">
              <span className="block" style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>버킷으로</span>
              <span className="block" style={{ fontSize: 12, color: t.textMuted }}>버킷리스트 전용 뷰는 곧 — 지금은 담아만 둬요</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 자람 뱃지 메뉴 (목표에서 보기 / 되돌리기) ──
function GrownMenu({ seed, onViewGoal, onRevert, onClose }: {
  seed: SomedaySeed; onViewGoal: () => void; onRevert: () => void; onClose: () => void;
}) {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0" style={sheetBackdropStyle()} onClick={onClose} />
      <div
        className="relative w-full lg:w-auto lg:min-w-[280px] lg:max-w-xs px-3 pt-3 pb-5 lg:py-2 lg:rounded-2xl"
        style={bottomSheetStyle(t)}
      >
        <div className="lg:hidden mx-auto mb-2" style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: withAlpha(t.textMuted, 0.4) }} />
        {seed.grownTo === 'goal' && (
          <button onClick={onViewGoal} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-3 text-left" style={{ color: t.text }}>
            <ArrowUpRight size={16} color={t.accent} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>목표에서 보기</span>
          </button>
        )}
        <button onClick={onRevert} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-3 text-left" style={{ color: t.text }}>
          <RotateCcw size={16} color={t.textSub} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>되돌리기</span>
        </button>
      </div>
    </div>
  );
}

// ── 씨앗 행 (solidRowStyle + 3px 결 accent + dot + 결 태그 + 날짜 + 키우기/자람) ──
function SeedRow({ seed, haon, onGrow, onOpenMenu }: {
  seed: SomedaySeed; haon: boolean; onGrow: () => void; onOpenMenu: () => void;
}) {
  const { t } = useTheme();
  const c = seedKindColor(t, seed.kind);
  const grown = seed.status === 'grown';

  const base = solidRowStyle(t);
  const rowStyle = haon
    ? { ...base, borderLeft: `3px solid ${c.dot}` }
    : { backgroundColor: t.card, border: `1px solid ${t.border}`, borderLeft: `3px solid ${c.dot}`, borderRadius: 14 };

  return (
    <div className="flex items-start gap-3 px-3.5 py-3" style={rowStyle}>
      <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: c.dot, flexShrink: 0, marginTop: 6 }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 14.5, color: t.text, lineHeight: 1.45, wordBreak: 'break-word' }}>{seed.text}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {seed.kind !== 'none' && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5"
              style={{ fontSize: 11, fontWeight: 600, color: c.text, backgroundColor: c.fill }}>
              {SEED_KIND_LABELS[seed.kind]}
            </span>
          )}
          <span style={{ fontSize: 11.5, color: t.textMuted, fontFamily: t.fontNumeric }}>
            {format(parseISO(seed.createdAt), 'yyyy.M.d')}
          </span>
        </div>
      </div>
      {/* 우측: 자람 뱃지(grown, 클릭→메뉴) / 키우기 액션(seed) */}
      {grown ? (
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 flex-shrink-0"
          style={{ fontSize: 11, fontWeight: 700, color: t.accent, backgroundColor: withAlpha(t.accent, 0.12) }}
          aria-label="자람 메뉴 열기"
        >
          <Sparkles size={12} /> 자람
          <ChevronDown size={12} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onGrow}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 flex-shrink-0"
          style={{ ...buttonStyle(t, 'secondary'), fontSize: 12 }}
        >
          <Sprout size={13} /> 키우기
        </button>
      )}
    </div>
  );
}

// ── 빈 상태 (recipe 유지, 텍스트만 muted) ──
function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center py-16" style={{ color: t.textMuted }}>
      <Sprout size={30} strokeWidth={1.6} style={{ marginBottom: 10, opacity: 0.7 }} />
      <p style={{ fontSize: 14, fontWeight: 600 }}>
        {filtered ? '이 결의 씨앗이 아직 없어요' : '아직 던져둔 씨앗이 없어요'}
      </p>
      <p style={{ fontSize: 12.5, marginTop: 4, opacity: 0.85 }}>
        {filtered ? '다른 결을 보거나 새 씨앗을 던져보세요' : '문득 든 바람을 한 줄로 던져두세요'}
      </p>
    </div>
  );
}
