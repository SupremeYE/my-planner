import React, { useMemo, useState } from 'react';
import { Timer, X, Plus, Check, Bell } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useTimers, remainingSec, formatClock, type CookTimer } from '../timers/TimerProvider';

// 시간 프리셋 (분)
const PRESETS = [1, 3, 5, 8, 10];

// ── 원형 카운트다운 링 ───────────────────────────────────────────────────────
function CountdownRing({ timer, nowMs, size = 56 }: { timer: CookTimer; nowMs: number; size?: number }) {
  const { t } = useTheme();
  const rem = remainingSec(timer, nowMs);
  const done = timer.status === 'done' || rem <= 0;
  const ratio = timer.totalSec > 0 ? Math.min(1, Math.max(0, rem / timer.totalSec)) : 0;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = done ? t.accent : t.accent;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.bgSub} strokeWidth={stroke} />
        {!done && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: 12, fontWeight: 800, color: done ? t.accent : t.text }}>
          {done ? '완료' : formatClock(rem)}
        </span>
      </div>
    </div>
  );
}

// ── 타이머 카드 (패널 내부) ──────────────────────────────────────────────────
function TimerCard({ timer }: { timer: CookTimer }) {
  const { t } = useTheme();
  const { nowMs, cancelTimer, dismissTimer, addMinute } = useTimers();
  const done = timer.status === 'done';

  return (
    <div className="flex items-center gap-3 rounded-2xl p-3"
      style={{ backgroundColor: t.card, border: `1px solid ${done ? t.accent : t.border}`,
        boxShadow: done ? `0 0 0 3px ${t.accent}22` : 'none' }}>
      <CountdownRing timer={timer} nowMs={nowMs} />
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
          {timer.label || '타이머'}
        </div>
        <div style={{ fontSize: 11, color: done ? t.accent : t.textMuted, marginTop: 2, fontWeight: done ? 700 : 400 }}>
          {done ? '⏰ 시간이 다 됐어요!' : `${formatClock(timer.totalSec)} 설정`}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => addMinute(timer.id)}
          className="px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
          style={{ fontSize: 12, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight }}>
          +1분
        </button>
        {done ? (
          <button onClick={() => dismissTimer(timer.id)} aria-label="닫기"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
            style={{ fontSize: 12, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
            <Check size={13} /> 확인
          </button>
        ) : (
          <button onClick={() => cancelTimer(timer.id)} aria-label="취소"
            className="p-1.5 rounded-lg active:scale-95 transition-transform"
            style={{ color: t.textMuted, backgroundColor: t.bgSub }}>
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── 타이머 패널 (바텀 시트 / PC 우측 모달) ─────────────────────────────────────
function TimerPanel() {
  const { t } = useTheme();
  const { timers, startTimer, closePanel } = useTimers();
  const [label, setLabel] = useState('');
  const [customMin, setCustomMin] = useState('');

  const sorted = useMemo(
    () => [...timers].sort((a, b) => {
      // 완료된 것을 위로, 그다음 임박한 순
      if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? -1 : 1;
      return a.endsAt - b.endsAt;
    }),
    [timers],
  );

  const start = (totalSec: number) => {
    const id = startTimer(totalSec, label);
    if (id) setLabel('');
  };

  const startCustom = () => {
    const min = parseFloat(customMin.replace(',', '.'));
    if (!Number.isFinite(min) || min <= 0) return;
    start(Math.round(min * 60));
    setCustomMin('');
  };

  return (
    <div className="fixed inset-0 z-[65] flex justify-center items-end lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={closePanel}>
      <style>{`@keyframes cookTimerUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.cook-timer-panel{animation:cookTimerUp .26s ease-out}}`}</style>
      <div className="cook-timer-panel w-full max-w-full rounded-t-2xl lg:max-w-[440px] lg:rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
            <Timer size={18} color={t.accent} /> 타이머
          </h3>
          <button onClick={closePanel} aria-label="닫기" className="p-1.5 rounded-lg" style={{ color: t.textSub }}>
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-4"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          {/* 새 타이머 만들기 */}
          <div className="rounded-2xl p-3 space-y-3" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
            <input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="이름 (선택) — 예: 면 삶기"
              className="w-full rounded-xl outline-none"
              style={{ padding: '9px 11px', fontSize: 14, border: `1px solid ${t.border}`, backgroundColor: t.bg, color: t.text }} />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(m => (
                <button key={m} onClick={() => start(m * 60)}
                  className="px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                  style={{ fontSize: 13, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight }}>
                  {m}분
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={customMin} onChange={e => setCustomMin(e.target.value)}
                inputMode="decimal" placeholder="직접 입력(분)"
                onKeyDown={e => { if (e.key === 'Enter') startCustom(); }}
                className="flex-1 rounded-xl outline-none"
                style={{ padding: '9px 11px', fontSize: 14, border: `1px solid ${t.border}`, backgroundColor: t.bg, color: t.text }} />
              <button onClick={startCustom}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
                style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
                <Plus size={14} /> 시작
              </button>
            </div>
          </div>

          {/* 진행 중 / 완료 타이머 리스트 */}
          {sorted.length === 0 ? (
            <div className="rounded-2xl px-3 py-6 text-center"
              style={{ backgroundColor: t.card, border: `1px dashed ${t.border}`, fontSize: 12, color: t.textMuted }}>
              실행 중인 타이머가 없어요. 위에서 시간을 골라 시작해 보세요.
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map(tm => <TimerCard key={tm.id} timer={tm} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 떠 있는 미니 칩 — 활성 개수 + 가장 임박한 남은 시간 ─────────────────────────
function MiniChip() {
  const { t } = useTheme();
  const { timers, nowMs, openPanel } = useTimers();

  const { count, doneCount, soonest } = useMemo(() => {
    const running = timers.filter(x => x.status === 'running');
    const done = timers.filter(x => x.status === 'done');
    const soon = running.reduce<CookTimer | null>((acc, x) =>
      !acc || x.endsAt < acc.endsAt ? x : acc, null);
    return { count: running.length, doneCount: done.length, soonest: soon };
  }, [timers]);

  if (timers.length === 0) return null;

  const anyDone = doneCount > 0;
  const remLabel = soonest ? formatClock(remainingSec(soonest, nowMs)) : null;

  return (
    <button onClick={openPanel}
      className="cook-mini-chip fixed z-[55] flex items-center gap-2 rounded-full active:scale-95 transition-transform"
      style={{
        backgroundColor: anyDone ? t.accent : t.card,
        border: `1px solid ${anyDone ? t.accent : t.border}`,
        boxShadow: '0 8px 22px rgba(0,0,0,0.20)',
        padding: '8px 14px 8px 10px',
      }}>
      <span className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 30, height: 30, backgroundColor: anyDone ? 'rgba(255,255,255,0.25)' : t.accentLight }}>
        {anyDone
          ? <Bell size={16} color="#fff" className="animate-pulse" />
          : <Timer size={16} color={t.accent} className="animate-pulse" />}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span style={{ fontSize: 10, fontWeight: 600, color: anyDone ? 'rgba(255,255,255,0.85)' : t.textMuted }}>
          {anyDone ? `완료 ${doneCount}` : `타이머 ${count}개`}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: anyDone ? '#fff' : t.text, fontVariantNumeric: 'tabular-nums' }}>
          {anyDone ? '⏰ 시간 끝!' : remLabel}
        </span>
      </span>
    </button>
  );
}

// 글로벌 레이어 — App에 1회 마운트. 타이머가 있을 때만 칩 노출 → 다른 페이지 영향 없음.
export function CookingTimers() {
  const { panelOpen } = useTimers();
  return (
    <>
      {/* 미니 칩 위치 — 모바일: 글로벌 네비 위 왼쪽(레시피 추가 FAB 반대쪽) / PC: 좌하단 */}
      <style>{`
        .cook-mini-chip{ bottom:calc(132px + env(safe-area-inset-bottom)); left:16px; }
        @media (min-width:1024px){ .cook-mini-chip{ bottom:24px; left:24px; } }
      `}</style>
      <MiniChip />
      {panelOpen && <TimerPanel />}
    </>
  );
}
