import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Pause, Play, Square, Timer } from 'lucide-react';
import { getTimerElapsedSec, getTimerRemainingSec, usePlanner } from '../store';
import { useTheme } from '../ThemeContext';
import { formatClock } from '../../lib/formatClock';

function playDoneSound() {
  try {
    const ctx = new AudioContext();
    const times = [0, 0.35, 0.7];
    const freqs = [523, 659, 784]; // C5 E5 G5
    times.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freqs[i];
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.6);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.65);
    });
  } catch {
    // 오디오 미지원 환경 무시
  }
}

export function GlobalFloatingTimer() {
  const { activeTimer, todos, pauseTimer, resumeTimer, stopTimer, finishActiveTimer } = usePlanner();
  const { t } = useTheme();
  const [nowMs, setNowMs] = useState(Date.now());
  const [pomoDone, setPomoDone] = useState<string | null>(null); // todoText 저장
  // 모바일 전체화면 확대 상태 — 컴포넌트 로컬 전용(localStorage/DB 저장 안 함). 새로고침 시 축소로 시작.
  const [expanded, setExpanded] = useState(false);
  const pomoDoneFiredRef = useRef(false);

  const todo = activeTimer ? todos.find(td => td.id === activeTimer.todoId) ?? null : null;
  const elapsedSec = activeTimer ? getTimerElapsedSec(activeTimer, nowMs) : 0;
  const displaySec = activeTimer
    ? (activeTimer.mode === 'pomodoro' ? getTimerRemainingSec(activeTimer, nowMs) : elapsedSec)
    : 0;
  const todoText = todo?.text ?? '';
  const truncatedTitle = todoText.length > 15 ? `${todoText.slice(0, 15)}…` : todoText;

  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  // 타이머가 사라지면(정지/완료/포모 자동완료) 확대 상태 해제 — 타이머 없는데 전체화면이 남지 않게.
  useEffect(() => {
    if (!activeTimer) setExpanded(false);
  }, [activeTimer]);

  useEffect(() => {
    if (!activeTimer || !todo) {
      document.title = 'My Planner';
      return;
    }

    const nextTitle = activeTimer.mode === 'pomodoro'
      ? `🍅 ${formatClock(displaySec)} - ${todoText}`
      : `⏱ ${formatClock(displaySec)} - ${todoText}`;
    document.title = nextTitle;

    return () => {
      document.title = 'My Planner';
    };
  }, [activeTimer, displaySec, todo, todoText]);

  // 포모도로 완료 감지
  useEffect(() => {
    if (!activeTimer || activeTimer.mode !== 'pomodoro' || activeTimer.isPaused) return;
    if (displaySec > 0) {
      pomoDoneFiredRef.current = false;
      return;
    }
    if (pomoDoneFiredRef.current) return;
    pomoDoneFiredRef.current = true;

    playDoneSound();
    navigator.vibrate?.([300, 100, 300]);
    setPomoDone(todoText);
    stopTimer();
  }, [activeTimer, displaySec, stopTimer, todoText]);

  // 완료 배너 4초 후 자동 닫기
  useEffect(() => {
    if (!pomoDone) return;
    const id = window.setTimeout(() => setPomoDone(null), 4000);
    return () => window.clearTimeout(id);
  }, [pomoDone]);

  // 포모도로 완료 배너
  if (pomoDone) {
    return (
      <div
        className="fixed bottom-[72px] left-3 right-3 z-50 rounded-[22px] px-4 py-3.5 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px]"
        style={{ backgroundColor: t.success, boxShadow: '0 16px 36px rgba(38,52,61,0.18)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.22)', color: '#fff' }}>
            <Check size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>포모도로 완료!</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pomoDone.length > 22 ? `${pomoDone.slice(0, 22)}…` : pomoDone}
            </div>
          </div>
          <button
            onClick={() => setPomoDone(null)}
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1, padding: '4px 6px' }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (!activeTimer || !todo) return null;

  const isPomodoro = activeTimer.mode === 'pomodoro';
  const isPaused = activeTimer.isPaused;
  const togglePause = isPaused ? resumeTimer : pauseTimer;
  // 정지/완료 후 확대 상태 해제 — 축소 뷰로 복귀(store 로직은 그대로 호출만).
  const stopAndCollapse = () => { stopTimer(); setExpanded(false); };
  const finishAndCollapse = () => { finishActiveTimer(); setExpanded(false); };

  // 진행 링(포모도로 전용) — 진행률 = 1 - 남은/총. 반지름 104·두께 13·236px 캔버스(DESIGN.md §5).
  const RING_SIZE = 236;
  const RING_STROKE = 13;
  const RING_R = 104;
  const ringCenter = RING_SIZE / 2;
  const ringCircumference = 2 * Math.PI * RING_R;
  const ringProgress = isPomodoro && activeTimer.pomoDurationSec > 0
    ? Math.min(1, Math.max(0, 1 - displaySec / activeTimer.pomoDurationSec))
    : 0;
  const ringOffset = ringCircumference * (1 - ringProgress);
  const ringTrack = t.lavenderTint; // lint-colors-ok: 전체화면 포커스 링 트랙(히어로 강조·DESIGN.md §5)

  return (
    <>
      {/* ── 모바일 전체화면 확대 뷰 (lg 이상엔 없음). 하단 탭바(z-40)를 z-50 inset-0 로 덮는다. ── */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden" style={{ backgroundColor: t.bg }}>
          {/* 상단: 축소 버튼(좌) + 모드 라벨(중앙, 뮤트) */}
          <div className="flex items-center justify-between px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
            <button onClick={() => setExpanded(false)} aria-label="축소" className="flex h-10 w-10 items-center justify-center rounded-full" style={{ color: t.textMuted }}>
              <ChevronDown size={22} />
            </button>
            <span style={{ fontFamily: t.fontLabel, fontSize: 13, fontWeight: 500, color: t.textMuted }}>
              {isPomodoro ? '포모도로' : '스톱워치'}
            </span>
            <span className="h-10 w-10" aria-hidden />
          </div>

          {/* 중앙: 상태 라벨(코랄) → 제목(딥인디고 600) → 링/숫자 → 컨트롤 */}
          <div className="flex flex-1 flex-col items-center justify-center gap-7 px-6">
            <div className="flex flex-col items-center gap-2">
              <div style={{ fontFamily: t.fontLabel, fontSize: 13, fontWeight: 600, color: t.accent, letterSpacing: '0.02em' }}>
                {isPaused ? '일시정지' : '진행중'}
              </div>
              <div className="text-center" style={{ fontFamily: t.fontBody, fontSize: 20, fontWeight: 600, color: t.text, lineHeight: 1.35, maxWidth: 300 }}>
                {todoText}
              </div>
            </div>

            {isPomodoro ? (
              <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
                <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                  <circle cx={ringCenter} cy={ringCenter} r={RING_R} fill="none" stroke={ringTrack} strokeWidth={RING_STROKE} />
                  <circle
                    cx={ringCenter} cy={ringCenter} r={RING_R} fill="none"
                    stroke={t.accent} strokeWidth={RING_STROKE} strokeLinecap="round"
                    strokeDasharray={ringCircumference} strokeDashoffset={ringOffset}
                    transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div style={{ fontFamily: t.fontNumeric, fontSize: 48, fontWeight: 700, color: t.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {formatClock(displaySec)}
                  </div>
                  <div style={{ fontFamily: t.fontLabel, fontSize: 12, color: t.textMuted, marginTop: 8 }}>남은 시간</div>
                </div>
              </div>
            ) : (
              /* 스톱워치: 목표가 없어 링을 그리지 않고 숫자만(빈 링=0% 오독 방지). */
              <div className="flex flex-col items-center justify-center" style={{ minHeight: RING_SIZE }}>
                <div style={{ fontFamily: t.fontNumeric, fontSize: 60, fontWeight: 700, color: t.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {formatClock(displaySec)}
                </div>
                <div style={{ fontFamily: t.fontLabel, fontSize: 12, color: t.textMuted, marginTop: 12 }}>경과 시간</div>
              </div>
            )}

            {/* 컨트롤 — 중립 2(정지·완료, 흰 원) + 주 액션 1(일시정지/재개, 코랄 그라데이션·최대) */}
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={stopAndCollapse}
                aria-label="정지"
                title="타이머 정지 (할일은 진행중 유지)"
                className="flex items-center justify-center rounded-full"
                style={{ width: 60, height: 60, backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text, boxShadow: '0 8px 20px rgba(38,52,61,0.10)' }}
              >
                <Square size={20} fill={t.text} />
              </button>
              <button
                onClick={togglePause}
                aria-label={isPaused ? '재개' : '일시정지'}
                className="flex items-center justify-center rounded-full"
                style={{ width: 78, height: 78, background: t.primaryGradient ?? t.accent, color: '#fff', boxShadow: '0 14px 30px rgba(212,115,90,0.32)' }}
              >
                {isPaused ? <Play size={30} fill="#fff" /> : <Pause size={30} fill="#fff" />}
              </button>
              <button
                onClick={finishAndCollapse}
                aria-label="완료"
                title="타이머 종료 + 할일 완료 처리"
                className="flex items-center justify-center rounded-full"
                style={{ width: 60, height: 60, backgroundColor: t.card, border: `1px solid ${t.border}`, color: t.text, boxShadow: '0 8px 20px rgba(38,52,61,0.10)' }}
              >
                <Check size={22} />
              </button>
            </div>
          </div>

          {/* 하단: 보조 안내(뮤트) — 정지 vs 완료의 의미 구분 */}
          <div className="px-8 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <p style={{ fontFamily: t.fontLabel, fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
              정지는 기록만 남기고 진행중을 유지해요 · 완료는 할일을 끝냈다고 표시해요
            </p>
          </div>
        </div>
      )}

      {/* ── 축소 카드 (모바일 하단 + PC 우하단). 모바일 확대 중엔 숨김, PC 는 항상 노출. ── */}
      <div
        className={`fixed bottom-[72px] left-3 right-3 z-50 rounded-[22px] px-3 py-3 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px] lg:px-4 ${expanded ? 'hidden lg:block' : ''}`}
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 16px 36px rgba(38,52,61,0.18)' }}
      >
        <div className="flex items-center gap-3">
          {/* 아이콘+제목 탭 → 확대 (모바일 전용). PC 는 확대 없음 → pointer-events 차단. */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left lg:pointer-events-none"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
              style={{ backgroundColor: activeTimer.isPaused ? t.lavenderTint : t.accent, color: activeTimer.isPaused ? t.textMuted : '#fff' }}
            >
              <Timer size={17} className={activeTimer.isPaused ? '' : 'animate-pulse'} />
            </div>
            <div className="min-w-0">
              <div style={{ fontSize: 11, color: t.textMuted }}>
                {activeTimer.mode === 'pomodoro' ? '포모도로' : '스톱워치'} · {activeTimer.isPaused ? '일시정지' : '진행중'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                {truncatedTitle}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                {activeTimer.mode === 'pomodoro' ? '남은 시간' : '경과 시간'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: t.text, marginTop: 1 }}>
                {formatClock(displaySec)}
              </div>
            </div>
            <ChevronUp size={16} className="ml-1 flex-shrink-0 lg:hidden" style={{ color: t.textMuted }} aria-hidden />
          </button>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <button
              onClick={activeTimer.isPaused ? resumeTimer : pauseTimer}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2"
              style={{ backgroundColor: t.lavenderTint, color: t.text, fontSize: 12, fontWeight: 700, border: `1px solid ${t.borderLight}` }}
            >
              {activeTimer.isPaused ? <Play size={12} /> : <Pause size={12} />}
              {activeTimer.isPaused ? '재개' : '일시정지'}
            </button>
            <button
              onClick={stopTimer}
              title="타이머 정지 (할일은 진행중 유지)"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2"
              style={{ backgroundColor: t.danger, color: '#fff', fontSize: 12, fontWeight: 700 }}
            >
              <Square size={12} fill="#fff" />
              정지
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
