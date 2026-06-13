// 내 코스 다시 — 과거 세션(저장 코스 우선/전체) 중 목표 경로를 고른다.
// 목표 경로 = planned_route 우선, 없으면 실제 걸은 path. 점 2개 미만이면 따라 걸을 수 없어 제외.
import { useMemo } from 'react';
import { Bookmark, Play } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { useWalkData } from './useWalkData';
import { RouteGlyph } from './RouteGlyph';
import { formatDistance, formatDuration } from './walkUtils';
import type { WalkSession, WalkPoint } from '../../../lib/db';

export function targetRouteOf(s: WalkSession): WalkPoint[] {
  return (s.plannedRoute && s.plannedRoute.length >= 2) ? s.plannedRoute : s.path;
}

export function RepeatPicker({ onPick }: { onPick: (source: WalkSession, target: WalkPoint[]) => void }) {
  const { t } = useTheme();
  const { sessions, loading } = useWalkData();

  // 따라 걸을 수 있는(점 2개 이상) 세션만, 저장 코스 먼저.
  const usable = useMemo(() => {
    return sessions
      .filter(s => targetRouteOf(s).length >= 2)
      .sort((a, b) => Number(b.isSavedRoute) - Number(a.isSavedRoute));
  }, [sessions]);

  if (loading) {
    return <p className="px-4 py-6 lg:px-6" style={{ fontSize: 13, color: t.textSub }}>불러오는 중…</p>;
  }
  if (usable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: 320 }}>
        <div className="flex items-center justify-center mb-3" style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.accentLight }}>
          <Bookmark size={24} style={{ color: t.accent }} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>다시 걸을 코스가 없어요</p>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 6, maxWidth: 300, lineHeight: 1.6 }}>
          자유·코스 산책을 한 뒤 기록 카드에서 "코스로 저장"하면 여기서 다시 걸을 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 lg:px-6 mx-auto flex flex-col gap-2" style={{ maxWidth: 560 }}>
      {usable.map(s => {
        const target = targetRouteOf(s);
        const date = s.startedAt ? new Date(s.startedAt) : new Date(s.createdAt);
        return (
          <div key={s.id} className="flex items-center gap-3" style={{ padding: 10, borderRadius: 14, backgroundColor: t.card, border: `1px solid ${s.isSavedRoute ? t.accent : t.border}` }}>
            <div style={{ flexShrink: 0 }}><RouteGlyph path={target} size={56} stroke={t.accent} bg={t.bgSub} strokeWidth={4} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="flex items-center gap-1" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                {s.isSavedRoute && <Bookmark size={12} style={{ color: t.accent }} fill={t.accent} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.routeName ?? date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </span>
              </p>
              <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 2 }}>{formatDistance(s.distanceM)} · {formatDuration(s.durationS)}</p>
            </div>
            <button onClick={() => onPick(s, target)} className="flex items-center gap-1.5" style={{ flexShrink: 0, padding: '9px 14px', borderRadius: 999, border: 'none', backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Play size={14} fill="#fff" /> 따라 걷기
            </button>
          </div>
        );
      })}
    </div>
  );
}
