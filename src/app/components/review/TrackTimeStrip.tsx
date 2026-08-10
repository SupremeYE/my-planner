import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { usePlanner } from '../../store';
import { useTheme } from '../../ThemeContext';
import { aggregateActivity, toTagRows, formatMinutes } from '../../../lib/timeAggregation';
import { useActivityInsights } from '../../hooks/useActivityInsights';

// ─── 활동 스트립 (track_time 태그별 기간 집계) — 주간·월간 공용 ───
// 소스 통일: 「시간 리포트」와 **같은 함수**(aggregateActivity)를 호출한다.
// = 할일 do_*(+블록 dual-read) + 이벤트 시각. plan_* 제외.
//
// 두 축을 함께 보여준다(서로 다른 것을 말한다):
//  · ⏱ 시간 = "얼마나 오래" — 실행 시각을 기록한 것만 잡힘(스택 바, 단위 시간/분)
//  · 🔢 건수 = "얼마나 자주" — 태그만 붙으면 모두 잡힘(태그별 막대, 단위 건)

export function fmtMin(min: number): string {
  return formatMinutes(min);
}

export function TrackTimeStrip({ startStr, endStr, period }: { startStr: string; endStr: string; period?: 'week' | 'month' }) {
  const { todos, events, tags, timeBlocks } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();

  const { timeRows, timeTotal, countRows, countTotal } = useMemo(() => {
    const agg = aggregateActivity(todos, events, tags, startStr, endStr, timeBlocks);
    const rows = toTagRows(agg, tags);
    return {
      timeRows: rows.filter(r => r.minutes > 0).sort((a, b) => b.minutes - a.minutes),
      timeTotal: agg.totalMinutes,
      countRows: rows.filter(r => r.count > 0).sort((a, b) => b.count - a.count),
      countTotal: agg.totalCount,
    };
  }, [todos, events, tags, timeBlocks, startStr, endStr]);

  // ── 문장형 인사이트 (최대 3줄, 공백 알림 우선) — 시간 리포트와 같은 공용 훅 ──
  const insights = useActivityInsights(startStr, endStr, period);

  const bothEmpty = timeTotal === 0 && countTotal === 0;

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      {bothEmpty ? (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>⏱ 시간 · 🔢 건수</h3>
          <div className="rounded-lg px-3 py-3" style={{ backgroundColor: t.surfaceMuted, border: `1px dashed ${t.border}` }}>
            <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
              할일이나 캘린더 일정에 <b style={{ fontWeight: 600 }}>태그</b>를 붙이면 태그별 <b style={{ fontWeight: 600 }}>건수</b>가 쌓이고,
              <b style={{ fontWeight: 600 }}>실행 시각</b>까지 기록하면(스톱워치·타임라인) 태그별 <b style={{ fontWeight: 600 }}>시간</b>도 함께 쌓여요.
            </p>
            <button onClick={() => navigate('/calendar')} className="mt-2" style={{ fontSize: 12, fontWeight: 600, color: t.accent }}>
              캘린더로 가기 →
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* ── 문장형 인사이트: 빠진 것을 먼저 짚어준다(공백 알림 우선, 최대 3줄) ── */}
          {insights.length > 0 && (
            <div className="rounded-lg px-3 py-2.5 space-y-1" style={{ backgroundColor: t.surfaceMuted }}>
              {insights.map((line, i) => (
                <p key={i} className="flex items-start gap-1.5" style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
                  <span style={{ color: t.accent, flexShrink: 0 }}>·</span>
                  <span>{line}</span>
                </p>
              ))}
            </div>
          )}

          {/* ── ⏱ 시간 축: "얼마나 오래" (실행 시각 기록분만) ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>⏱ 시간 <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>얼마나 오래</span></h3>
              {timeTotal > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: t.fontStat }}>{formatMinutes(timeTotal)}</span>}
            </div>
            {timeTotal === 0 ? (
              <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
                실행 시각이 기록된 활동이 아직 없어요. (건수는 아래에서 볼 수 있어요)
              </p>
            ) : (
              <>
                <div className="flex w-full rounded-full overflow-hidden" style={{ height: 12, backgroundColor: t.surfaceMuted }}>
                  {timeRows.map(r => (
                    <div key={r.tagId} title={`${r.tagName} · ${formatMinutes(r.minutes)}`}
                      style={{ width: `${(r.minutes / timeTotal) * 100}%`, backgroundColor: r.tagColor }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                  {timeRows.map(r => (
                    <div key={r.tagId} className="flex items-center gap-1.5" style={{ fontSize: 11, color: t.textSub }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: r.tagColor, display: 'inline-block' }} />
                      <span style={{ fontWeight: 600, color: t.text }}>{r.tagName}</span>
                      <span style={{ color: t.textMuted }}>{formatMinutes(r.minutes)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <div style={{ height: 1, backgroundColor: t.borderLight }} />

          {/* ── 🔢 건수 축: "얼마나 자주" (태그만 붙으면 모두) ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>🔢 건수 <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>얼마나 자주</span></h3>
              {countTotal > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: t.fontStat }}>{countTotal}건</span>}
            </div>
            {countTotal === 0 ? (
              <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>태그가 붙은 기록이 아직 없어요.</p>
            ) : (
              <div className="space-y-1.5">
                {countRows.map(r => {
                  const pct = Math.round((r.count / countTotal) * 100);
                  return (
                    <div key={r.tagId} className="flex items-center gap-2">
                      <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: r.tagColor, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.text, minWidth: 0, flexShrink: 0 }} className="truncate">{r.tagName}</span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: t.surfaceMuted, minWidth: 24 }}>
                        <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', backgroundColor: r.tagColor, opacity: 0.55, borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: t.fontStat, flexShrink: 0 }}>{r.count}건</span>
                      <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0, width: 30, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
