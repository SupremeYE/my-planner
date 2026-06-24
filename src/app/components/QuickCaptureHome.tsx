import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  Bed, Sun, Scale, Activity, Droplet,
  Plus, Smile, BookOpen, Camera, Link as LinkIcon,
  Footprints, BookMarked, CheckCircle2, ArrowUpRight, Check,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';

/* ============================================================
 *  CAPTURE_REGISTRY  ── 런처 모델 (Stage 0 확정 13개 타일)
 *
 *  type:
 *    instant   1탭 = 즉시 기록 (취침/기상만)
 *    navigate  해당 페이지로 이동
 *
 *  accent: 히어로(지금 추천) 승격 시 색 역할 토큰 키
 *  promote: [from,to] 24h 윈도우. find() 첫 매칭 승격 →
 *           겹치는 구간(21~23시 diary vs sleep_in)은 배열 앞쪽이 우선.
 *           ⚠️ 그래서 diary 가 sleep_in 보다 앞에 와야 함.
 * ========================================================== */

type AccentRole = 'accent' | 'danger' | 'text';

type CaptureButton =
  | {
      type: 'instant';
      id: string;
      label: string;
      icon: LucideIcon;
      accent: AccentRole;
      promote?: [number, number];
      pairWith?: string;
    }
  | {
      type: 'navigate';
      id: string;
      label: string;
      icon: LucideIcon;
      route: string;
      promote?: [number, number];
      accent?: AccentRole;
    };

const CAPTURE_REGISTRY: CaptureButton[] = [
  // ── 회고 (저녁 승격) — sleep_in 보다 앞에 둬야 21~23시 우선순위가 맞음 ──
  { id: 'diary', label: '오늘 일기', icon: BookOpen, type: 'navigate', route: '/diary',
    promote: [20, 23], accent: 'danger' },

  // ── 즉시 기록 (취침/기상만) ──
  { id: 'wake_up',  label: '기상', icon: Sun, type: 'instant',
    promote: [5, 9],  accent: 'accent', pairWith: 'sleep_in' },
  { id: 'sleep_in', label: '취침', icon: Bed, type: 'instant',
    promote: [21, 4], accent: 'text',   pairWith: 'wake_up' },

  // ── 캡처 ──
  { id: 'todo',   label: '할 일',  icon: Plus,     type: 'navigate', route: '/inbox' },
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

const inWindow = (h: number, w?: [number, number]) => {
  if (!w) return false;
  const [a, b] = w;
  return a <= b ? h >= a && h <= b : h >= a || h <= b;
};
const pad = (n: number) => String(n).padStart(2, '0');
const greeting = (h: number) =>
  h >= 5 && h < 11 ? '좋은 아침이에요'
  : h >= 11 && h < 17 ? '좋은 오후예요'
  : h >= 17 && h < 21 ? '좋은 저녁이에요'
  : '좋은 밤이에요';

export function QuickCaptureHome() {
  const { t } = useTheme();
  const navigate = useNavigate();

  const now = useMemo(() => new Date(), []);
  const hour = now.getHours();
  const min = now.getMinutes();
  const time = `${pad(hour)}:${pad(min)}`;
  const [toast, setToast] = useState<string | null>(null);

  // accent 역할 키 → 실제 토큰(bg/fg/bd) 매핑. hex 하드코딩 없이 토큰만 사용.
  const palette = (role: AccentRole): { bg: string; fg: string; bd: string } => {
    switch (role) {
      case 'accent': return { bg: t.accentLight, fg: t.accent, bd: t.accentLight };
      case 'danger': return { bg: t.dangerLight, fg: t.danger, bd: t.dangerLight };
      case 'text':   return { bg: t.bgSub,       fg: t.text,   bd: t.border };
    }
  };

  const promoted = useMemo(
    () => CAPTURE_REGISTRY.find((b) => inWindow(hour, b.promote)),
    [hour]
  );

  // TODO Stage 3: 취침/기상 실제 self_care_records insert/update (페어링 모델)
  const record = (label: string) => {
    setToast(`${label} 기록됨 (임시) · ${time}`);
    window.setTimeout(() => setToast(null), 1800);
  };

  const trigger = (b: CaptureButton) => {
    if (b.type === 'instant') record(b.label);
    else navigate(b.route);
  };

  const pal = palette(promoted?.accent ?? 'accent');
  const heroSubtitle = promoted?.type === 'instant'
    ? `1탭이면 끝 · ${time}로 기록돼요`
    : '눌러서 페이지에서 적기';

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
