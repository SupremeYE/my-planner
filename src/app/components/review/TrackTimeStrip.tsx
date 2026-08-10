import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { usePlanner } from '../../store';
import { useTheme } from '../../ThemeContext';
import { aggregateActivity, toTagRows, formatMinutes } from '../../../lib/timeAggregation';

// ─── 시간 스트립 (track_time 태그별 기간 집계) — 주간·월간 공용 ───
// 소스 통일: 「시간 리포트」와 **같은 함수**(aggregateActivity)를 호출한다.
// = 할일 do_*(+블록 dual-read) + 이벤트 시각. plan_* 제외.
// 이전에는 이벤트만 봐서 항상 비어 있었다(이벤트 시각 0건). 이제 두 화면이 같은 숫자를 낸다.

export function fmtMin(min: number): string {
  return formatMinutes(min);
}

export function TrackTimeStrip({ startStr, endStr }: { startStr: string; endStr: string }) {
  const { todos, events, tags, timeBlocks } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();

  const time = useMemo(() => {
    const agg = aggregateActivity(todos, events, tags, startStr, endStr, timeBlocks);
    const rows = toTagRows(agg, tags)
      .filter(r => r.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
    return { rows, total: agg.totalMinutes };
  }, [todos, events, tags, timeBlocks, startStr, endStr]);

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>⏱ 시간</h3>
        {time.total > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: t.fontStat }}>{formatMinutes(time.total)}</span>}
      </div>
      {time.total === 0 ? (
        <div className="rounded-lg px-3 py-3" style={{ backgroundColor: t.surfaceMuted, border: `1px dashed ${t.border}` }}>
          <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
            <b style={{ fontWeight: 600 }}>태그</b>가 붙은 할일을 <b style={{ fontWeight: 600 }}>실행 시각</b>과 함께 기록하거나(스톱워치·타임라인),
            캘린더 일정에 태그를 붙이면 태그별 시간이 여기 쌓여요.
          </p>
          <button onClick={() => navigate('/calendar')} className="mt-2" style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>
            캘린더로 가기 →
          </button>
        </div>
      ) : (
        <>
          <div className="flex w-full rounded-full overflow-hidden" style={{ height: 12, backgroundColor: t.surfaceMuted }}>
            {time.rows.map(r => (
              <div key={r.tagId} title={`${r.tagName} · ${formatMinutes(r.minutes)}`}
                style={{ width: `${(r.minutes / time.total) * 100}%`, backgroundColor: r.tagColor }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {time.rows.map(r => (
              <div key={r.tagId} className="flex items-center gap-1.5" style={{ fontSize: 11, color: t.textSub }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: r.tagColor, display: 'inline-block' }} />
                <span style={{ fontWeight: 600, color: t.text }}>{r.tagName}</span>
                <span style={{ color: t.textMuted }}>{formatMinutes(r.minutes)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
