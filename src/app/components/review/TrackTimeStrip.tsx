import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { usePlanner } from '../../store';
import { useTheme } from '../../ThemeContext';

// ─── 시간 스트립 (track_time 태그별 기간 내 이벤트 시간) — 주간·월간 공용 ───
// 주간 탭에서 인라인이던 것을 기간(startStr~endStr)만 인자로 받는 재사용 컴포넌트로 추출.
// events·tags 는 store 에서 직접 읽으므로 소비처는 기간만 넘긴다.
// 축은 동적(track_time=true 태그). 태그 색은 tag.color 그대로(주간 결정과 동일 — 태그 정체성 일관).

function toMin(s?: string): number | null {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
}

export function TrackTimeStrip({ startStr, endStr }: { startStr: string; endStr: string }) {
  const { events, tags } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();

  const trackTime = useMemo(() => {
    const trackTags = tags.filter(tg => tg.trackTime);
    const minutes = new Map<string, number>();
    trackTags.forEach(tg => minutes.set(tg.id, 0));
    for (const e of events) {
      if (!e.date || e.date < startStr || e.date > endStr) continue;
      if (!e.tags || e.tags.length === 0) continue;
      const s = toMin(e.startTime); const en = toMin(e.endTime);
      if (s == null || en == null) continue;
      const dur = Math.max(0, en - s);
      if (dur === 0) continue;
      for (const tagId of e.tags) {
        if (minutes.has(tagId)) minutes.set(tagId, (minutes.get(tagId) ?? 0) + dur);
      }
    }
    const rows = trackTags
      .map(tg => ({ tag: tg, minutes: minutes.get(tg.id) ?? 0 }))
      .filter(r => r.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
    const total = rows.reduce((s, r) => s + r.minutes, 0);
    return { rows, total };
  }, [events, tags, startStr, endStr]);

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>⏱ 시간</h3>
        {trackTime.total > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: t.fontStat }}>{fmtMin(trackTime.total)}</span>}
      </div>
      {trackTime.total === 0 ? (
        <div className="rounded-lg px-3 py-3" style={{ backgroundColor: t.surfaceMuted, border: `1px dashed ${t.border}` }}>
          <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
            캘린더 일정에 <b style={{ fontWeight: 600 }}>태그</b>를 붙이면 태그별 시간이 여기 쌓여요.
          </p>
          <button onClick={() => navigate('/calendar')} className="mt-2" style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>
            캘린더로 가기 →
          </button>
        </div>
      ) : (
        <>
          <div className="flex w-full rounded-full overflow-hidden" style={{ height: 12, backgroundColor: t.surfaceMuted }}>
            {trackTime.rows.map(r => (
              <div key={r.tag.id} title={`${r.tag.name} · ${fmtMin(r.minutes)}`}
                style={{ width: `${(r.minutes / trackTime.total) * 100}%`, backgroundColor: r.tag.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {trackTime.rows.map(r => (
              <div key={r.tag.id} className="flex items-center gap-1.5" style={{ fontSize: 11, color: t.textSub }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: r.tag.color, display: 'inline-block' }} />
                <span style={{ fontWeight: 600, color: t.text }}>{r.tag.name}</span>
                <span style={{ color: t.textMuted }}>{fmtMin(r.minutes)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
