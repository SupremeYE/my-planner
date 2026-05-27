import { useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo } from '../store';
import { useTheme } from '../ThemeContext';
import { isDoOvertimeVsPlan } from '../../lib/todoDoDuration';

const PC_HOUR_HEIGHT = 88;
const TIME_COL_WIDTH = 44;

// ─── helpers ──────────────────────────────────────────────────────────────────

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minToPx(totalMin: number, startHour: number): number {
  return (totalMin - startHour * 60) * (PC_HOUR_HEIGHT / 60);
}

function durationMin(start: string, end: string): number {
  return Math.max(0, hhmmToMin(end) - hhmmToMin(start));
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function achievementColor(pct: number): string {
  if (pct >= 90) return '#6BAA7A';
  if (pct >= 70) return '#E8A84A';
  return '#D4735A';
}

// ─── PlanBlock ────────────────────────────────────────────────────────────────

function PlanBlock({ todo, startHour }: { todo: Todo; startHour: number }) {
  const topPx = minToPx(hhmmToMin(todo.planStart!), startHour);
  const height = Math.max(durationMin(todo.planStart!, todo.planEnd!) * (PC_HOUR_HEIGHT / 60), 18);

  return (
    <div
      title={`${todo.text}\n${todo.planStart}–${todo.planEnd}`}
      style={{
        position: 'absolute',
        top: topPx,
        height,
        left: 2,
        right: 2,
        backgroundColor: '#E8F0FE',
        borderLeft: '2px solid #5B8FD8',
        borderRadius: 4,
        padding: '2px 4px',
        overflow: 'hidden',
        cursor: 'default',
        zIndex: 2,
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#3B6DC4',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.3,
      }}>
        {todo.text}
      </div>
      {height >= 30 && (
        <div style={{
          fontSize: 9,
          color: '#3B6DC4',
          opacity: 0.75,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {todo.planStart}–{todo.planEnd}
        </div>
      )}
    </div>
  );
}

// ─── DoBlock ──────────────────────────────────────────────────────────────────

function DoBlock({ todo, startHour }: { todo: Todo; startHour: number }) {
  const isOvertime = isDoOvertimeVsPlan(todo);
  const topPx = minToPx(hhmmToMin(todo.doStart!), startHour);
  const doMin = durationMin(todo.doStart!, todo.doEnd!);
  const height = Math.max(doMin * (PC_HOUR_HEIGHT / 60), 18);

  const planMin = todo.planStart && todo.planEnd ? durationMin(todo.planStart, todo.planEnd) : 0;
  const overtimeMin = planMin > 0 ? Math.max(0, doMin - planMin) : 0;

  const bgColor = isOvertime ? '#FEE8E8' : '#E8F8EE';
  const borderColor = isOvertime ? '#D4735A' : '#5BAA78';
  const textColor = isOvertime ? '#C45A42' : '#3B8A5A';

  return (
    <div
      title={`${todo.text}\n${todo.doStart}–${todo.doEnd}${isOvertime ? ` (초과 +${overtimeMin}m)` : ''}`}
      style={{
        position: 'absolute',
        top: topPx,
        height,
        left: 2,
        right: 2,
        backgroundColor: bgColor,
        borderLeft: `2px solid ${borderColor}`,
        borderRadius: 4,
        padding: '2px 4px',
        overflow: 'hidden',
        cursor: 'default',
        zIndex: 2,
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: textColor,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: 1.3,
      }}>
        {todo.text}
      </div>
      {height >= 30 && (
        <div style={{
          fontSize: 9,
          color: textColor,
          opacity: 0.75,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {todo.doStart}–{todo.doEnd}
        </div>
      )}
      {isOvertime && overtimeMin > 0 && height >= 42 && (
        <div style={{ fontSize: 9, color: '#D4735A', fontWeight: 700 }}>
          +{overtimeMin}m
        </div>
      )}
    </div>
  );
}

// ─── UnexecutedBlock (Plan 있는데 Do 없음) ────────────────────────────────────

function UnexecutedBlock({ todo, startHour }: { todo: Todo; startHour: number }) {
  const topPx = minToPx(hhmmToMin(todo.planStart!), startHour);
  const height = Math.max(durationMin(todo.planStart!, todo.planEnd!) * (PC_HOUR_HEIGHT / 60), 18);

  return (
    <div
      title={`미실행: ${todo.text}`}
      style={{
        position: 'absolute',
        top: topPx,
        height,
        left: 2,
        right: 2,
        backgroundColor: 'transparent',
        border: '1px dashed #C0C8D0',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}
    >
      <span style={{ fontSize: 11, color: '#C0C8D0' }}>—</span>
    </div>
  );
}

// ─── WeekViewPC ───────────────────────────────────────────────────────────────

interface WeekViewPCProps {
  viewDate: Date;
  weekStartsOn: 0 | 1;
  selectedDate: string;
  onSelectDate: (d: string) => void;
}

export function WeekViewPC({ viewDate, weekStartsOn, selectedDate, onSelectDate }: WeekViewPCProps) {
  const { todos, dayStartHour: startHour, dayEndHour: endHour } = usePlanner();
  const { t } = useTheme();
  const [nowTime, setNowTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const weekStart = startOfWeek(viewDate, { weekStartsOn });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowMin = nowTime.getHours() * 60 + nowTime.getMinutes();
  const totalHeight = (endHour - startHour) * PC_HOUR_HEIGHT + 16;

  // ─── per-day data ───────────────────────────────────────────────────────────
  const dayData = useMemo(() => {
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTodos = todos.filter(
        todo => todo.date === dateStr && todo.status !== 'backlog' && todo.status !== 'cancelled'
      );
      const planTodos = dayTodos.filter(todo => todo.planStart && todo.planEnd);
      const doTodos = dayTodos.filter(todo => todo.doStart && todo.doEnd);

      const totalPlanMin = planTodos.reduce((s, t) => s + durationMin(t.planStart!, t.planEnd!), 0);
      const totalDoMin = doTodos.reduce((s, t) => s + durationMin(t.doStart!, t.doEnd!), 0);

      // Plan 항목 중 Do가 없는 것
      const unexecutedTodos = planTodos.filter(t => !t.doStart || !t.doEnd);

      return { dateStr, planTodos, doTodos, unexecutedTodos, totalPlanMin, totalDoMin };
    });
  }, [days, todos]);

  // ─── weekly totals ──────────────────────────────────────────────────────────
  const weeklyStats = useMemo(() => {
    const totalPlanMin = dayData.reduce((s, d) => s + d.totalPlanMin, 0);
    const totalDoMin = dayData.reduce((s, d) => s + d.totalDoMin, 0);
    const activeDays = dayData.filter(d => d.totalPlanMin > 0 || d.totalDoMin > 0).length;

    const overtimeTodos = dayData.flatMap(d => d.doTodos.filter(todo => isDoOvertimeVsPlan(todo)));
    const totalOvertimeMin = overtimeTodos.reduce((s, todo) => {
      const p = durationMin(todo.planStart!, todo.planEnd!);
      const d = durationMin(todo.doStart!, todo.doEnd!);
      return s + Math.max(0, d - p);
    }, 0);

    const achievePct = totalPlanMin > 0 ? Math.round((totalDoMin / totalPlanMin) * 100) : 0;
    return { totalPlanMin, totalDoMin, activeDays, overtimeCount: overtimeTodos.length, totalOvertimeMin, achievePct };
  }, [dayData]);

  // ─── layout constants ───────────────────────────────────────────────────────
  const outerGridCols = `${TIME_COL_WIDTH}px repeat(7, minmax(0, 1fr))`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid #dbe6ee',
        backgroundColor: '#fff',
        zIndex: 20,
      }}>
        {/* Legend row */}
        <div className="px-3 py-2 flex items-center gap-4" style={{ borderBottom: '1px solid #F3F0EA' }}>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 700, color: '#5B8FD8' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E8F0FE', border: '1px solid #5B8FD888' }} />
            PLAN
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 700, color: '#5BAA78' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E8F8EE', border: '1px solid #5BAA7840' }} />
            DO
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 700, color: '#D4735A' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FEE8E8', border: '1px solid #D4735A60' }} />
            초과
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 600, color: '#9aa7b4' }}>
            <span style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, border: '1px dashed #C0C8D0', backgroundColor: 'transparent' }} />
            미실행
          </div>
        </div>

        {/* Day name row */}
        <div style={{ display: 'grid', gridTemplateColumns: outerGridCols }}>
          <div /> {/* time-label placeholder */}
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 4px 4px',
                  borderLeft: i > 0 ? '1px solid #eef4fa' : 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>
                  {format(day, 'E', { locale: ko })}
                </span>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  marginTop: 3,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: isSelected ? '#26343d' : isToday ? '#515f74' : 'transparent',
                  color: isSelected || isToday ? '#fff' : '#26343d',
                  border: isSelected ? '2px solid #d5e3fd' : '2px solid transparent',
                }}>
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>

        {/* P / D sub-header row */}
        <div style={{ display: 'grid', gridTemplateColumns: outerGridCols }}>
          <div />
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            return (
              <div
                key={dateStr}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderLeft: i > 0 ? '1px solid #eef4fa' : 'none',
                }}
              >
                <div style={{
                  textAlign: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#5B8FD8',
                  backgroundColor: '#EEF4FF',
                  padding: '3px 0',
                  borderRight: '1px dashed #C8D8F0',
                }}>
                  P
                </div>
                <div style={{
                  textAlign: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#5BAA78',
                  backgroundColor: '#EEFAF2',
                  padding: '3px 0',
                }}>
                  D
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable Timeline ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ position: 'relative', height: totalHeight }}>

          {/* Hour gridlines + time labels */}
          {hours.map(hour => (
            <div
              key={hour}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: (hour - startHour) * PC_HOUR_HEIGHT,
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              <span style={{
                width: TIME_COL_WIDTH,
                fontSize: 10,
                color: '#9aa7b4',
                textAlign: 'right',
                paddingRight: 8,
                flexShrink: 0,
              }}>
                {String(hour % 24).padStart(2, '0')}:00
              </span>
              <div style={{ flex: 1, borderTop: '1px solid #dbe6ee' }} />
            </div>
          ))}

          {/* Half-hour dashed lines */}
          {hours.slice(0, -1).map(hour => (
            <div
              key={`half-${hour}`}
              style={{
                position: 'absolute',
                left: TIME_COL_WIDTH,
                right: 0,
                top: (hour - startHour) * PC_HOUR_HEIGHT + PC_HOUR_HEIGHT / 2,
                borderTop: '1px dashed #e9eff5',
              }}
            />
          ))}

          {/* Day columns */}
          <div style={{
            position: 'absolute',
            left: TIME_COL_WIDTH,
            right: 0,
            top: 0,
            bottom: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(7, minmax(0, 1fr))`,
          }}>
            {dayData.map(({ dateStr, planTodos, doTodos, unexecutedTodos }, colIdx) => {
              const isToday = dateStr === todayStr;
              const showNowLine =
                isToday &&
                nowMin >= startHour * 60 &&
                nowMin <= endHour * 60;

              return (
                <div
                  key={dateStr}
                  style={{
                    position: 'relative',
                    borderLeft: colIdx > 0 ? '1px solid #eef4fa' : 'none',
                  }}
                >
                  {/* Inner P | D grid */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                  }}>
                    {/* Plan slot */}
                    <div style={{ position: 'relative', borderRight: '1px dashed #C8D8F0' }}>
                      {planTodos.map(todo => (
                        <PlanBlock key={`plan-${todo.id}`} todo={todo} startHour={startHour} />
                      ))}
                    </div>

                    {/* Do slot */}
                    <div style={{ position: 'relative' }}>
                      {unexecutedTodos.map(todo => (
                        <UnexecutedBlock key={`unexec-${todo.id}`} todo={todo} startHour={startHour} />
                      ))}
                      {doTodos.map(todo => (
                        <DoBlock key={`do-${todo.id}`} todo={todo} startHour={startHour} />
                      ))}
                    </div>
                  </div>

                  {/* Current time line — spans full day width */}
                  {showNowLine && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: minToPx(nowMin, startHour),
                        display: 'flex',
                        alignItems: 'center',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: '#D4735A',
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, height: 2, backgroundColor: '#D4735A' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Summary Section ────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderTop: '2px solid #eef4fa', backgroundColor: '#fff' }}>

        {/* Date-by-date progress bars */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: outerGridCols,
          borderBottom: '1px solid #eef4fa',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 6,
            fontSize: 9,
            color: '#9aa7b4',
          }}>
            실적
          </div>
          {dayData.map(({ dateStr, totalPlanMin, totalDoMin }, i) => {
            const isOver = totalDoMin > totalPlanMin && totalPlanMin > 0;
            const pct = totalPlanMin > 0 ? Math.min((totalDoMin / totalPlanMin) * 100, 100) : 0;
            const barColor = isOver ? '#D4735A' : '#6BAA7A';
            const diffMin = Math.abs(totalDoMin - totalPlanMin);

            return (
              <div
                key={dateStr}
                style={{
                  padding: '6px 5px',
                  borderLeft: i > 0 ? '1px solid #eef4fa' : 'none',
                }}
              >
                <div style={{
                  fontSize: 9,
                  color: '#9aa7b4',
                  marginBottom: 3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {totalPlanMin > 0 ? `계획 ${formatMin(totalPlanMin)}` : '—'}
                </div>
                <div style={{
                  height: 4,
                  backgroundColor: '#eef4fa',
                  borderRadius: 2,
                  overflow: 'hidden',
                  marginBottom: 3,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    backgroundColor: barColor,
                    borderRadius: 2,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: totalPlanMin > 0 ? barColor : '#ccc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {totalPlanMin > 0
                    ? isOver
                      ? `+${formatMin(diffMin)} 초과`
                      : `${Math.round(pct)}%`
                    : '—'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly totals row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(5, minmax(0, 1fr))`,
          padding: '7px 4px',
          gap: 4,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 6,
            fontSize: 9,
            color: '#9aa7b4',
          }}>
            주간
          </div>

          {/* 총 계획 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9aa7b4' }}>총 계획</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5B8FD8' }}>
              {weeklyStats.totalPlanMin > 0 ? formatMin(weeklyStats.totalPlanMin) : '—'}
            </div>
          </div>

          {/* 총 실제 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9aa7b4' }}>총 실제</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5BAA78' }}>
              {weeklyStats.totalDoMin > 0 ? formatMin(weeklyStats.totalDoMin) : '—'}
            </div>
          </div>

          {/* 주간 달성률 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9aa7b4' }}>달성률</div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: weeklyStats.totalPlanMin > 0
                ? achievementColor(weeklyStats.achievePct)
                : '#9aa7b4',
            }}>
              {weeklyStats.totalPlanMin > 0 ? `${weeklyStats.achievePct}%` : '—'}
            </div>
          </div>

          {/* 초과 항목 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9aa7b4' }}>초과</div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: weeklyStats.overtimeCount > 0 ? '#D4735A' : '#9aa7b4',
            }}>
              {weeklyStats.overtimeCount > 0
                ? `${weeklyStats.overtimeCount}회 (+${formatMin(weeklyStats.totalOvertimeMin)})`
                : '—'}
            </div>
          </div>

          {/* 활동 일수 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9aa7b4' }}>활동</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#26343d' }}>
              {weeklyStats.activeDays}일
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
