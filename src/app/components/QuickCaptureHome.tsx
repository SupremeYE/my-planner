import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import {
  Bed, Sun, Scale, Activity, Droplet,
  Plus, Smile, BookOpen, Camera, Link as LinkIcon,
  Footprints, BookMarked, CheckCircle2, ArrowUpRight, Check,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { usePlanner, type SelfCareRecord } from '../store';
import { promotedIdAt } from '../../lib/quickCapturePromote';

/* ============================================================
 *  CAPTURE_REGISTRY  ── 런처 모델 (Stage 0 확정 13개 타일)
 *
 *  type:
 *    instant   1탭 = 즉시 기록 (취침/기상만)
 *    navigate  해당 페이지로 이동
 *
 *  accent: 히어로(지금 추천) 승격 시 색 역할 토큰 키
 *
 *  ⚠️ 시간대 승격 우선순위(diary > sleep_in 등)는 lib/quickCapturePromote.ts 의
 *     PROMOTE_ORDER 가 단일 소스(단위 테스트로 보호). 여기선 id 로 조회만 한다.
 * ========================================================== */

type AccentRole = 'accent' | 'danger' | 'text';

type CaptureButton =
  | {
      type: 'instant';
      id: string;
      label: string;
      icon: LucideIcon;
      accent: AccentRole;
      pairWith?: string;
    }
  | {
      type: 'navigate';
      id: string;
      label: string;
      icon: LucideIcon;
      route: string;
      accent?: AccentRole;
    };

const CAPTURE_REGISTRY: CaptureButton[] = [
  // ── 회고 ──
  { id: 'diary', label: '오늘 일기', icon: BookOpen, type: 'navigate', route: '/diary', accent: 'danger' },

  // ── 즉시 기록 (취침/기상만) ──
  { id: 'wake_up',  label: '기상', icon: Sun, type: 'instant', accent: 'accent', pairWith: 'sleep_in' },
  { id: 'sleep_in', label: '취침', icon: Bed, type: 'instant', accent: 'text',   pairWith: 'wake_up' },

  // ── 캡처 ──
  { id: 'todo',   label: '할 일',  icon: Plus,     type: 'navigate', route: '/todos' },
  { id: 'moment', label: '모먼트', icon: Camera,   type: 'navigate', route: '/moments' },
  { id: 'scrap',  label: '스크랩', icon: LinkIcon, type: 'navigate', route: '/scraps' },

  // ── 기분 · 건강 ──
  { id: 'mood',   label: '기분',     icon: Smile,    type: 'navigate', route: '/mood' },
  { id: 'stress', label: '스트레스', icon: Activity, type: 'navigate', route: '/health?tab=condition' },
  { id: 'weight', label: '몸무게',   icon: Scale,    type: 'navigate', route: '/health?tab=weight' },
  { id: 'period', label: '생리',     icon: Droplet,  type: 'navigate', route: '/health?tab=period' },

  // ── 활동 ──
  { id: 'walk',    label: '산책', icon: Footprints,   type: 'navigate', route: '/walk' },
  { id: 'reading', label: '독서', icon: BookMarked,   type: 'navigate', route: '/books' },
  { id: 'habit',   label: '습관', icon: CheckCircle2, type: 'navigate', route: '/habits' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const greeting = (h: number) =>
  h >= 5 && h < 11 ? '좋은 아침이에요'
  : h >= 11 && h < 17 ? '좋은 오후예요'
  : h >= 17 && h < 21 ? '좋은 저녁이에요'
  : '좋은 밤이에요';

// ── 취침/기상 페어링 (정책 B) ──
// 취침 = sleepStart 만 든 미해결 레코드 insert (date=취침일)
// 기상 = 지난 24h 내 미해결 레코드를 찾아 sleepEnd+duration 채우고 date=기상일로 정규화.
//        못 찾으면 기상 시각만 든 레코드를 새로 만들어 누른 시각이 버려지지 않게 한다.
const SLEEP_PAIR_WINDOW_MS = 24 * 60 * 60 * 1000;

// 레코드의 취침 시점 datetime 재구성 ("yyyy-MM-dd" + "HH:mm" → 로컬 Date ms). 실패 시 NaN
const sleepStartMs = (r: SelfCareRecord): number =>
  r.sleepStart ? new Date(`${r.date}T${r.sleepStart}:00`).getTime() : NaN;

// 미해결(취침만, 기상 없음) 레코드 중 now 기준 16h 이내 시작된 최신 1개
const findUnresolvedSleep = (records: SelfCareRecord[], now: Date): SelfCareRecord | null => {
  const cutoff = now.getTime() - SLEEP_PAIR_WINDOW_MS;
  return records
    .filter(r => r.category === 'sleep' && r.sleepStart && !r.sleepEnd)
    .filter(r => {
      const ms = sleepStartMs(r);
      return !Number.isNaN(ms) && ms >= cutoff && ms <= now.getTime();
    })
    .sort((a, b) => sleepStartMs(b) - sleepStartMs(a))[0] ?? null;
};

const fmtDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

export function QuickCaptureHome() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { selfCareRecords, addSelfCareRecord, updateSelfCareRecord } = usePlanner();

  const now = useMemo(() => new Date(), []);
  const hour = now.getHours();
  const min = now.getMinutes();
  const time = `${pad(hour)}:${pad(min)}`;
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(false); // 더블탭 중복 기록 방지

  // accent 역할 키 → 실제 토큰(bg/fg/bd) 매핑. hex 하드코딩 없이 토큰만 사용.
  const palette = (role: AccentRole): { bg: string; fg: string; bd: string } => {
    switch (role) {
      case 'accent': return { bg: t.accentLight, fg: t.accent, bd: t.accentLight };
      case 'danger': return { bg: t.dangerLight, fg: t.danger, bd: t.dangerLight };
      case 'text':   return { bg: t.bgSub,       fg: t.text,   bd: t.border };
    }
  };

  const promoted = useMemo(() => {
    const id = promotedIdAt(hour);
    return id ? CAPTURE_REGISTRY.find((b) => b.id === id) : undefined;
  }, [hour]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  // 더블탭 가드 — 동기 ref 로 막고 잠시 후 해제
  const guard = (): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    window.setTimeout(() => { busyRef.current = false; }, 1500);
    return true;
  };

  // 취침: sleepStart 만 든 미해결 레코드 insert (date=취침일). 빈 레코드 생성 아님 — 시작 시각은 항상 기록됨
  const handleSleepIn = () => {
    if (!guard()) return;
    try {
      const ts = new Date();
      const hhmm = format(ts, 'HH:mm');
      addSelfCareRecord({
        date: format(ts, 'yyyy-MM-dd'),
        category: 'sleep',
        content: `${hhmm} ~`,
        duration: 0,
        sleepStart: hhmm,
        // sleepEnd 미지정(undefined) → DB null → 미해결 상태
      });
      showToast(`취침 기록됨 · ${hhmm}`);
    } catch (e) {
      console.error('[QuickCaptureHome] sleep_in failed', e);
      showToast('기록 실패. 잠시 후 다시 시도해주세요.');
    }
  };

  // 기상: 24h 내 미해결 레코드를 찾아 sleepEnd+duration 채우고 date=기상일로 정규화.
  //   짝 취침이 없으면(또는 24h 초과) 기상 시각만 든 레코드를 새로 만든다 — 누른 시각이
  //   통째로 버려지지 않게(취침 시각은 수면 페이지에서 나중에 채워 완성 가능).
  const handleWakeUp = () => {
    if (!guard()) return;
    try {
      const ts = new Date();
      const hhmm = format(ts, 'HH:mm');
      const pending = findUnresolvedSleep(selfCareRecords, ts);
      if (!pending) {
        addSelfCareRecord({
          date: format(ts, 'yyyy-MM-dd'),
          category: 'sleep',
          content: `~ ${hhmm}`,
          duration: 0,
          sleepEnd: hhmm,
          // sleepStart 미지정 → 수면 페이지에서 취침 시각을 채우면 수면시간 계산됨
        });
        showToast(`기상 기록됨 · ${hhmm} · 취침 시각은 수면 페이지에서 채워주세요`);
        return;
      }
      const durationMin = Math.max(0, Math.round((ts.getTime() - sleepStartMs(pending)) / 60000));
      updateSelfCareRecord(pending.id, {
        sleepEnd: hhmm,
        duration: durationMin,
        content: `${pending.sleepStart} ~ ${hhmm}`,
        date: format(ts, 'yyyy-MM-dd'), // 기상일로 정규화
      });
      showToast(`기상 기록됨 · ${hhmm} (${fmtDuration(durationMin)})`);
    } catch (e) {
      console.error('[QuickCaptureHome] wake_up failed', e);
      showToast('기록 실패. 잠시 후 다시 시도해주세요.');
    }
  };

  const trigger = (b: CaptureButton) => {
    if (b.type !== 'instant') { navigate(b.route); return; }
    if (b.id === 'sleep_in') handleSleepIn();
    else if (b.id === 'wake_up') handleWakeUp();
  };

  const pal = palette(promoted?.accent ?? 'accent');

  // 히어로 부제 — instant 면 짝 상태 힌트(있으면), 아니면 안내
  const heroSubtitle = (() => {
    if (promoted?.type !== 'instant') return '눌러서 페이지에서 적기';
    if (promoted.id === 'wake_up') {
      const pending = findUnresolvedSleep(selfCareRecords, now);
      return pending ? `${pending.sleepStart} 취침과 짝` : `1탭이면 끝 · ${time}로 기록돼요`;
    }
    if (promoted.id === 'sleep_in') {
      const todayStr = format(now, 'yyyy-MM-dd');
      const wokeToday = selfCareRecords.find(r => r.category === 'sleep' && r.date === todayStr && r.sleepEnd);
      return wokeToday ? `오늘 ${wokeToday.sleepEnd} 기상과 짝` : `1탭이면 끝 · ${time}로 기록돼요`;
    }
    return `1탭이면 끝 · ${time}로 기록돼요`;
  })();

  const tiles = CAPTURE_REGISTRY.filter((b) => b.id !== promoted?.id);

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      <div className="px-4 pt-5 pb-8" style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* 헤더 */}
        <div className="mb-1 flex justify-between" style={{ fontSize: 12.5, color: t.textMuted }}>
          <span>{now.getMonth() + 1}월 {now.getDate()}일</span>
          <span>{time}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: t.text, marginBottom: 16 }}>
          {greeting(hour)}
        </div>

        {/* 히어로 (지금 추천) — 10~19시엔 promoted 없음 → 영역 자체 미렌더 */}
        {promoted && (
          <div className="mb-5">
            <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 8 }}>지금 추천</div>
            <button
              onClick={() => trigger(promoted)}
              className="w-full flex items-center text-left"
              style={{
                gap: 14, background: pal.bg, border: `1px solid ${pal.bd}`,
                borderRadius: 16, padding: 16, cursor: 'pointer',
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{ width: 46, height: 46, borderRadius: '50%', background: t.card, flexShrink: 0 }}
              >
                <promoted.icon size={24} color={pal.fg} />
              </span>
              <span className="flex-1 min-w-0">
                <span style={{ display: 'block', fontSize: 20, fontWeight: 600, color: pal.fg }}>
                  {promoted.label}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: t.textSub, marginTop: 2 }}>
                  {heroSubtitle}
                </span>
              </span>
              {promoted.type === 'instant'
                ? <Check size={20} color={pal.fg} />
                : <ArrowUpRight size={20} color={pal.fg} />}
            </button>
          </div>
        )}

        {/* 타일 그리드 */}
        <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 8, paddingLeft: 2 }}>모든 기록</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {tiles.map((b) => {
            const isInstant = b.type === 'instant';
            return (
              <button
                key={b.id}
                onClick={() => trigger(b)}
                className="relative flex flex-col items-center justify-center"
                style={{
                  gap: 7, aspectRatio: '1 / 0.9', padding: '12px 6px', borderRadius: 14,
                  border: `1px solid ${t.border}`,
                  background: isInstant ? t.bgSub : t.card,
                  cursor: 'pointer',
                }}
              >
                <b.icon size={22} color={isInstant ? t.accent : t.textSub} />
                <span style={{ fontSize: 12, color: t.text }}>{b.label}</span>
                {!isInstant && (
                  <ArrowUpRight
                    size={11}
                    color={t.textMuted}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 안내 — 즉시 기록은 여기서, 나머지는 각 페이지에서 */}
        <div style={{ marginTop: 16, fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
          취침·기상은 여기서 바로, 다른 건 각 페이지에서 적어요
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div
          className="fixed flex items-center"
          style={{
            left: 20, right: 20, bottom: 76, maxWidth: 440, margin: '0 auto',
            background: t.text, color: t.card, fontSize: 13, padding: '11px 14px',
            borderRadius: 11, gap: 8, zIndex: 50,
          }}
        >
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
