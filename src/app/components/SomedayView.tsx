import { useCallback, useMemo, useRef, useState } from 'react';
import { Sprout, Plus, ChevronDown, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../ThemeContext';
import { useFabAction } from '../FabContext';
import { useSomedaySeeds } from '../hooks/useSomedaySeeds';
import { type SeedKind, type SomedaySeed } from '../../lib/db';
import {
  isHaon, solidCardStyle, solidRowStyle, glassBarStyle, addPopoverStyle,
  buttonStyle, withAlpha,
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
  const haon = isHaon(t);
  const { seeds, loading, addSeed } = useSomedaySeeds();

  // ── 던지기 입력 ──
  const [text, setText] = useState('');
  const [draftKind, setDraftKind] = useState<SeedKind>('none');
  const [kindOpen, setKindOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 결 필터 ──
  const [filter, setFilter] = useState<SeedKindFilter>('all');

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
            visible.map(seed => <SeedRow key={seed.id} seed={seed} haon={haon} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ── 씨앗 행 (solidRowStyle + 3px 결 accent + dot + 결 태그 + 날짜 + 키우기/자람) ──
function SeedRow({ seed, haon }: { seed: SomedaySeed; haon: boolean }) {
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
      {/* 우측: 자람 뱃지(grown) / 키우기 액션(seed) — 키우기 동작은 Stage 4에서 연결 */}
      {grown ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 flex-shrink-0"
          style={{ fontSize: 11, fontWeight: 700, color: t.accent, backgroundColor: withAlpha(t.accent, 0.12) }}>
          <Sparkles size={12} /> 자람
        </span>
      ) : (
        <button
          type="button"
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
