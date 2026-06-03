import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, SelfCareRecord } from '../store';
import { isDoOvertimeVsPlan } from '../../lib/todoDoDuration';
import { expandRecurringTodos } from '../../lib/recurrenceExpansion';
import { sleepRectsForColumn } from '../../lib/sleepTimeline';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

type MobileTab = '3day' | 'daily' | 'summary';

const HOUR_3DAY = 40;   // 3일 뷰: 1시간 = 40px
const HOUR_DAILY = 44;  // 일별 뷰: 1시간 = 44px
const TIME_W = 36;      // 시간 레이블 컬럼 너비
const BAR_MAX = 48;     // 주간 요약 바 최대 너비(px)

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function durMin(start: string, end: string): number {
  return Math.max(0, hhmmToMin(end) - hhmmToMin(start));
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function achColor(pct: number) {
  return pct >= 90 ? '#6BAA7A' : pct >= 70 ? '#E8A84A' : '#D4735A';
}

function minToPx(min: number, startHour: number, hourH: number) {
  return (min - startHour * 60) * (hourH / 60);
}

// ─── 공통 블록 컴포넌트 ────────────────────────────────────────────────────────

function PlanBlock({ todo, startHour, hourH }: { todo: Todo; startHour: number; hourH: number }) {
  const top = minToPx(hhmmToMin(todo.planStart!), startHour, hourH);
  const h = Math.max(durMin(todo.planStart!, todo.planEnd!) * (hourH / 60), 14);
  return (
    <div
      title={`${todo.text} ${todo.planStart}–${todo.planEnd}`}
      style={{
        position: 'absolute', top, height: h, left: 1, right: 1,
        backgroundColor: '#E8F0FE', borderLeft: '2px solid #5B8FD8',
        borderRadius: 3, padding: '1px 3px', overflow: 'hidden', zIndex: 2,
      }}
    >
      <div style={{ fontSize: 8, fontWeight: 700, color: '#3B6DC4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {todo.text}
      </div>
    </div>
  );
}

function DoBlock({ todo, startHour, hourH }: { todo: Todo; startHour: number; hourH: number }) {
  const isOver = isDoOvertimeVsPlan(todo);
  const top = minToPx(hhmmToMin(todo.doStart!), startHour, hourH);
  const doM = durMin(todo.doStart!, todo.doEnd!);
  const planM = todo.planStart && todo.planEnd ? durMin(todo.planStart, todo.planEnd) : 0;
  const overM = planM > 0 ? Math.max(0, doM - planM) : 0;
  const h = Math.max(doM * (hourH / 60), 14);
  const bg = isOver ? '#FEE8E8' : '#E8F8EE';
  const border = isOver ? '#D4735A' : '#5BAA78';
  const color = isOver ? '#C45A42' : '#3B8A5A';
  return (
    <div
      title={`${todo.text} ${todo.doStart}–${todo.doEnd}${isOver ? ` +${overM}m 초과` : ''}`}
      style={{
        position: 'absolute', top, height: h, left: 1, right: 1,
        backgroundColor: bg, borderLeft: `2px solid ${border}`,
        borderRadius: 3, padding: '1px 3px', overflow: 'hidden', zIndex: 2,
      }}
    >
      <div style={{ fontSize: 8, fontWeight: 700, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {isOver && overM > 0 ? `+${overM}m ` : ''}{todo.text}
      </div>
    </div>
  );
}

function UnexecBlock({ todo, startHour, hourH }: { todo: Todo; startHour: number; hourH: number }) {
  const top = minToPx(hhmmToMin(todo.planStart!), startHour, hourH);
  const h = Math.max(durMin(todo.planStart!, todo.planEnd!) * (hourH / 60), 14);
  return (
    <div
      title={`미실행: ${todo.text}`}
      style={{
        position: 'absolute', top, height: h, left: 1, right: 1,
        border: '1px dashed #C0C8D0', borderRadius: 3, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: 8, color: '#C0C8D0' }}>—</span>
    </div>
  );
}

// ─── 3일 뷰 ───────────────────────────────────────────────────────────────────

function ThreeDayView({ days, startHour, endHour, todayStr, selectedDate, todos, selfCareRecords }: {
  days: Date[];
  startHour: number;
  endHour: number;
  todayStr: string;
  selectedDate: string;
  todos: Todo[];
  selfCareRecords: SelfCareRecord[];
}) {
  const [page, setPage] = useState(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const totalH = (endHour - startHour) * HOUR_3DAY + 8;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // 주/선택 날짜 변경 시 선택 날짜(=Today 클릭 시 오늘)가 포함된 페이지로 이동
  useEffect(() => {
    const idx = days.findIndex(d => format(d, 'yyyy-MM-dd') === selectedDate);
    setPage(idx >= 0 ? Math.floor(idx / 3) : 0);
  }, [days, selectedDate]);

  const pages = [
    [days[0], days[1], days[2]],
    [days[3], days[4], days[5]],
    [days[6]],
  ];
  const pageDays = pages[page] ?? [];
  const padded = [...pageDays, ...Array(3 - pageDays.length).fill(null)] as (Date | null)[];

  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) <= 50) return;
    if (dx < 0 && page < 2) setPage(p => p + 1);
    if (dx > 0 && page > 0) setPage(p => p - 1);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 날짜 헤더 + P/D 서브헤더 */}
      <div style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: `${TIME_W}px repeat(3, minmax(0, 1fr))`,
        borderBottom: '1px solid #eef4fa',
        backgroundColor: '#fff',
      }}>
        <div />
        {padded.map((day, i) => (
          <div key={i} style={{ borderLeft: i > 0 ? '1px solid #eef4fa' : 'none' }}>
            {day ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px 2px' }}>
                  <span style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>
                    {format(day, 'E', { locale: ko })}
                  </span>
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, borderRadius: '50%', marginTop: 2,
                    fontSize: 11, fontWeight: 700,
                    backgroundColor: format(day, 'yyyy-MM-dd') === todayStr ? '#26343d' : 'transparent',
                    color: format(day, 'yyyy-MM-dd') === todayStr ? '#fff' : '#26343d',
                  }}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#5B8FD8', backgroundColor: '#EEF4FF', padding: '2px 0', borderRight: '1px dashed #C8D8F0' }}>P</div>
                  <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#5BAA78', backgroundColor: '#EEFAF2', padding: '2px 0' }}>D</div>
                </div>
              </>
            ) : (
              <div style={{ height: '100%', backgroundColor: '#fafafa' }} />
            )}
          </div>
        ))}
      </div>

      {/* 타임라인 */}
      <div
        style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ position: 'relative', height: totalH }}>
          {/* 시간 레이블 + 가로선 */}
          {hours.map(hour => (
            <div key={hour} style={{
              position: 'absolute', left: 0, right: 0,
              top: (hour - startHour) * HOUR_3DAY,
              display: 'flex', alignItems: 'flex-start',
            }}>
              <span style={{ width: TIME_W, fontSize: 9, color: '#9aa7b4', textAlign: 'right', paddingRight: 4, flexShrink: 0 }}>
                {String(hour % 24).padStart(2, '0')}:00
              </span>
              <div style={{ flex: 1, borderTop: '1px solid #dbe6ee' }} />
            </div>
          ))}
          {hours.slice(0, -1).map(hour => (
            <div key={`h${hour}`} style={{
              position: 'absolute', left: TIME_W, right: 0,
              top: (hour - startHour) * HOUR_3DAY + HOUR_3DAY / 2,
              borderTop: '1px dashed #e9eff5',
            }} />
          ))}

          {/* 날짜 열 */}
          <div style={{
            position: 'absolute', left: TIME_W, right: 0, top: 0, bottom: 0,
            display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          }}>
            {padded.map((day, ci) => {
              if (!day) return (
                <div key={`e${ci}`} style={{ borderLeft: ci > 0 ? '1px solid #eef4fa' : 'none', backgroundColor: '#fafafa' }} />
              );
              const ds = format(day, 'yyyy-MM-dd');
              const isToday = ds === todayStr;
              const dayTodos = todos.filter(t => t.date === ds && t.status !== 'backlog' && t.status !== 'cancelled');
              const planTs = dayTodos.filter(t => t.planStart && t.planEnd);
              const doTs = dayTodos.filter(t => t.doStart && t.doEnd);
              const unexTs = planTs.filter(t => !t.doStart || !t.doEnd);
              const showNow = isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60;
              const sleepRects = sleepRectsForColumn(ds, selfCareRecords, startHour, endHour);

              return (
                <div key={ds} style={{ position: 'relative', borderLeft: ci > 0 ? '1px solid #eef4fa' : 'none' }}>
                  {/* P | D 슬롯 */}
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div style={{ position: 'relative', borderRight: '1px dashed #C8D8F0' }}>
                      {planTs.map(t => <PlanBlock key={t.id} todo={t} startHour={startHour} hourH={HOUR_3DAY} />)}
                    </div>
                    <div style={{ position: 'relative' }}>
                      {sleepRects.map((rect, ri) => {
                        const hh = Math.floor(rect.totalMin / 60);
                        const mm = rect.totalMin % 60;
                        const dur = hh > 0 ? (mm > 0 ? `${hh}h ${mm}m` : `${hh}h`) : `${mm}m`;
                        const top = rect.offsetMin * (HOUR_3DAY / 60);
                        const h = Math.max(rect.lengthMin * (HOUR_3DAY / 60), 10);
                        return (
                          <div key={`sleep-${rect.record.id}-${ri}`}
                            title={`수면 ${dur}`}
                            style={{
                              position: 'absolute', top, height: h, left: 1, right: 1, zIndex: 1,
                              backgroundColor: '#EEF4FF', borderLeft: '2px solid #8BAAD8',
                              borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                              alignItems: 'flex-start', padding: '1px 2px',
                            }}>
                            <span style={{ fontSize: 7, fontWeight: 700, color: '#5B8FD8', lineHeight: 1.2 }}>🌙</span>
                            {h >= 20 && <span style={{ fontSize: 7, color: '#5B8FD8', lineHeight: 1.2 }}>{dur}</span>}
                          </div>
                        );
                      })}
                      {unexTs.map(t => <UnexecBlock key={t.id} todo={t} startHour={startHour} hourH={HOUR_3DAY} />)}
                      {doTs.map(t => <DoBlock key={t.id} todo={t} startHour={startHour} hourH={HOUR_3DAY} />)}
                    </div>
                  </div>
                  {/* 현재 시각선 */}
                  {showNow && (
                    <div style={{
                      position: 'absolute', left: 0, right: 0,
                      top: minToPx(nowMin, startHour, HOUR_3DAY),
                      display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none',
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#D4735A', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 1.5, backgroundColor: '#D4735A' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 페이지 인디케이터 */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '6px 0 4px', backgroundColor: '#fff' }}>
        {[0, 1, 2].map(p => (
          <button
            key={p}
            onClick={() => setPage(p)}
            style={{
              width: page === p ? 14 : 6, height: 6, borderRadius: 3,
              backgroundColor: page === p ? '#26343d' : '#D8D8D8',
              border: 'none', padding: 0, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 일별 뷰 ──────────────────────────────────────────────────────────────────

function DailyView({ days, startHour, endHour, todayStr, selectedDate, onSelectDate, todos, selfCareRecords }: {
  days: Date[];
  startHour: number;
  endHour: number;
  todayStr: string;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  todos: Todo[];
  selfCareRecords: SelfCareRecord[];
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const totalH = (endHour - startHour) * HOUR_DAILY + 8;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // 이번 주에 없는 selectedDate → days[0] 폴백
  const activeDateStr = days.find(d => format(d, 'yyyy-MM-dd') === selectedDate)
    ? selectedDate
    : format(days[0], 'yyyy-MM-dd');

  const dayTodos = todos.filter(t => t.date === activeDateStr && t.status !== 'backlog' && t.status !== 'cancelled');
  const planTs = dayTodos.filter(t => t.planStart && t.planEnd);
  const doTs = dayTodos.filter(t => t.doStart && t.doEnd);
  const unexTs = planTs.filter(t => !t.doStart || !t.doEnd);
  const isToday = activeDateStr === todayStr;
  const showNow = isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const sleepRects = sleepRectsForColumn(activeDateStr, selfCareRecords, startHour, endHour);

  // 선택 탭 자동 스크롤
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const idx = days.findIndex(d => format(d, 'yyyy-MM-dd') === activeDateStr);
    const el = container.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeDateStr]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) <= 50) return;
    const ci = days.findIndex(d => format(d, 'yyyy-MM-dd') === activeDateStr);
    if (dx < 0 && ci < days.length - 1) onSelectDate(format(days[ci + 1], 'yyyy-MM-dd'));
    if (dx > 0 && ci > 0) onSelectDate(format(days[ci - 1], 'yyyy-MM-dd'));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 요일 탭 바 */}
      <div
        ref={tabsRef}
        style={{ flexShrink: 0, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid #eef4fa' }}
      >
        {days.map(day => {
          const ds = format(day, 'yyyy-MM-dd');
          const isActive = ds === activeDateStr;
          const isT = ds === todayStr;
          const hasData = todos.some(t => t.date === ds && (t.planStart || t.doStart));
          return (
            <button
              key={ds}
              onClick={() => onSelectDate(ds)}
              style={{
                flex: '0 0 auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '5px 10px 3px',
                borderBottom: isActive ? '2px solid #26343d' : '2px solid transparent',
                background: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 9, color: isActive ? '#26343d' : '#888', fontWeight: 600 }}>
                {format(day, 'E', { locale: ko })}
              </span>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%', marginTop: 2,
                fontSize: 13, fontWeight: 700,
                backgroundColor: isT ? '#26343d' : 'transparent',
                color: isT ? '#fff' : isActive ? '#26343d' : '#555',
              }}>
                {format(day, 'd')}
              </span>
              {hasData ? (
                <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#6BAA7A', marginTop: 2 }} />
              ) : (
                <div style={{ height: 6 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* PLAN | DO 컬럼 헤더 */}
      <div style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: `${TIME_W}px 1fr 1fr`,
        borderBottom: '1px solid #eef4fa',
        backgroundColor: '#fff',
      }}>
        <div />
        <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#5B8FD8', backgroundColor: '#EEF4FF', padding: '4px 0', borderRight: '1px dashed #C8D8F0' }}>
          PLAN
        </div>
        <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#5BAA78', backgroundColor: '#EEFAF2', padding: '4px 0' }}>
          DO
        </div>
      </div>

      {/* 타임라인 */}
      <div
        style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ position: 'relative', height: totalH }}>
          {/* 시간 레이블 + 가로선 */}
          {hours.map(hour => (
            <div key={hour} style={{
              position: 'absolute', left: 0, right: 0,
              top: (hour - startHour) * HOUR_DAILY,
              display: 'flex', alignItems: 'flex-start',
            }}>
              <span style={{ width: TIME_W, fontSize: 9, color: '#9aa7b4', textAlign: 'right', paddingRight: 4, flexShrink: 0 }}>
                {String(hour % 24).padStart(2, '0')}:00
              </span>
              <div style={{ flex: 1, borderTop: '1px solid #dbe6ee' }} />
            </div>
          ))}
          {hours.slice(0, -1).map(hour => (
            <div key={`h${hour}`} style={{
              position: 'absolute', left: TIME_W, right: 0,
              top: (hour - startHour) * HOUR_DAILY + HOUR_DAILY / 2,
              borderTop: '1px dashed #e9eff5',
            }} />
          ))}

          {/* P | D 슬롯 */}
          <div style={{
            position: 'absolute', left: TIME_W, right: 0, top: 0, bottom: 0,
            display: 'grid', gridTemplateColumns: '1fr 1fr',
          }}>
            {/* Plan */}
            <div style={{ position: 'relative', borderRight: '1px dashed #C8D8F0' }}>
              {planTs.map(todo => {
                const top = minToPx(hhmmToMin(todo.planStart!), startHour, HOUR_DAILY);
                const h = Math.max(durMin(todo.planStart!, todo.planEnd!) * (HOUR_DAILY / 60), 18);
                return (
                  <div key={todo.id} title={`${todo.text} ${todo.planStart}–${todo.planEnd}`}
                    style={{ position: 'absolute', top, height: h, left: 2, right: 2, backgroundColor: '#E8F0FE', borderLeft: '2px solid #5B8FD8', borderRadius: 4, padding: '2px 4px', overflow: 'hidden', zIndex: 2 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#3B6DC4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todo.text}</div>
                    {h >= 30 && <div style={{ fontSize: 9, color: '#3B6DC4', opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todo.planStart}–{todo.planEnd}</div>}
                  </div>
                );
              })}
            </div>
            {/* Do */}
            <div style={{ position: 'relative' }}>
              {sleepRects.map((rect, ri) => {
                const hh = Math.floor(rect.totalMin / 60);
                const mm = rect.totalMin % 60;
                const dur = hh > 0 ? (mm > 0 ? `${hh}h ${mm}m` : `${hh}h`) : `${mm}m`;
                const top = rect.offsetMin * (HOUR_DAILY / 60);
                const h = Math.max(rect.lengthMin * (HOUR_DAILY / 60), 14);
                return (
                  <div key={`sleep-${rect.record.id}-${ri}`}
                    title={`수면 ${dur}`}
                    style={{
                      position: 'absolute', top, height: h, left: 2, right: 2, zIndex: 1,
                      backgroundColor: '#EEF4FF', borderLeft: '2px solid #8BAAD8',
                      borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      alignItems: 'flex-start', padding: '2px 4px',
                    }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#5B8FD8', lineHeight: 1.3 }}>🌙 수면</span>
                    {h >= 28 && <span style={{ fontSize: 9, color: '#5B8FD8', lineHeight: 1.3 }}>{dur}</span>}
                  </div>
                );
              })}
              {unexTs.map(todo => {
                const top = minToPx(hhmmToMin(todo.planStart!), startHour, HOUR_DAILY);
                const h = Math.max(durMin(todo.planStart!, todo.planEnd!) * (HOUR_DAILY / 60), 18);
                return (
                  <div key={todo.id} style={{ position: 'absolute', top, height: h, left: 2, right: 2, border: '1px dashed #C0C8D0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <span style={{ fontSize: 10, color: '#C0C8D0' }}>—</span>
                  </div>
                );
              })}
              {doTs.map(todo => {
                const isOver = isDoOvertimeVsPlan(todo);
                const doM = durMin(todo.doStart!, todo.doEnd!);
                const planM = todo.planStart && todo.planEnd ? durMin(todo.planStart, todo.planEnd) : 0;
                const overM = planM > 0 ? Math.max(0, doM - planM) : 0;
                const top = minToPx(hhmmToMin(todo.doStart!), startHour, HOUR_DAILY);
                const h = Math.max(doM * (HOUR_DAILY / 60), 18);
                const bg = isOver ? '#FEE8E8' : '#E8F8EE';
                const border = isOver ? '#D4735A' : '#5BAA78';
                const color = isOver ? '#C45A42' : '#3B8A5A';
                return (
                  <div key={todo.id} title={`${todo.text} ${todo.doStart}–${todo.doEnd}${isOver ? ` +${overM}m 초과` : ''}`}
                    style={{ position: 'absolute', top, height: h, left: 2, right: 2, backgroundColor: bg, borderLeft: `2px solid ${border}`, borderRadius: 4, padding: '2px 4px', overflow: 'hidden', zIndex: 2 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todo.text}</div>
                    {h >= 30 && <div style={{ fontSize: 9, color, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todo.doStart}–{todo.doEnd}{isOver ? ` +${overM}m` : ''}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 현재 시각선 — P+D 전체 너비 */}
          {showNow && (
            <div style={{
              position: 'absolute', left: TIME_W, right: 0,
              top: minToPx(nowMin, startHour, HOUR_DAILY),
              display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D4735A', flexShrink: 0 }} />
              <div style={{ flex: 1, height: 1.5, backgroundColor: '#D4735A' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 주간 요약 뷰 ─────────────────────────────────────────────────────────────

function WeeklySummaryView({ days, todayStr, todos }: {
  days: Date[];
  todayStr: string;
  todos: Todo[];
}) {
  const dayData = useMemo(() => days.map(day => {
    const ds = format(day, 'yyyy-MM-dd');
    const dt = todos.filter(t => t.date === ds && t.status !== 'backlog' && t.status !== 'cancelled');
    const planTs = dt.filter(t => t.planStart && t.planEnd);
    const doTs = dt.filter(t => t.doStart && t.doEnd);
    const totalPlanM = planTs.reduce((s, t) => s + durMin(t.planStart!, t.planEnd!), 0);
    const totalDoM = doTs.reduce((s, t) => s + durMin(t.doStart!, t.doEnd!), 0);
    const pct = totalPlanM > 0 ? Math.round((totalDoM / totalPlanM) * 100) : 0;
    // 화면용: plan 또는 do 있는 항목 합산
    const allItems = [
      ...planTs,
      ...doTs.filter(t => !planTs.find(p => p.id === t.id)),
    ];
    return { day, ds, allItems, planTs, doTs, totalPlanM, totalDoM, pct };
  }), [days, todos]);

  const weekly = useMemo(() => {
    const tPlan = dayData.reduce((s, d) => s + d.totalPlanM, 0);
    const tDo = dayData.reduce((s, d) => s + d.totalDoM, 0);
    const pct = tPlan > 0 ? Math.round((tDo / tPlan) * 100) : 0;
    const overCnt = dayData.flatMap(d => d.doTs).filter(t => isDoOvertimeVsPlan(t)).length;
    return { tPlan, tDo, pct, overCnt };
  }, [dayData]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 날짜 카드 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dayData.map(({ day, ds, allItems, planTs, doTs, totalPlanM, totalDoM, pct }) => {
          const isToday = ds === todayStr;
          const hasData = allItems.length > 0;
          const isOver = totalDoM > totalPlanM && totalPlanM > 0;
          const ach = totalPlanM > 0 ? achColor(pct) : '#9aa7b4';
          const achLabel = totalPlanM > 0
            ? isOver ? `+${fmtMin(totalDoM - totalPlanM)} 초과` : `${pct}%`
            : '—';

          return (
            <div key={ds} style={{
              borderRadius: 10,
              border: `1px solid ${isToday ? '#C4A882' : '#eef4fa'}`,
              backgroundColor: isToday ? '#FDFAF4' : '#fff',
              overflow: 'hidden',
            }}>
              {/* 카드 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#26343d' }}>
                    {format(day, 'E M월 d일', { locale: ko })}
                  </span>
                  {isToday && <span style={{ fontSize: 10, color: '#6BAA7A', fontWeight: 600 }}>오늘</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: isOver ? '#D4735A' : ach }}>
                  {achLabel}
                </span>
              </div>

              {/* 할일 바 리스트 */}
              {hasData ? (
                <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {allItems.map(todo => {
                    const pM = todo.planStart && todo.planEnd ? durMin(todo.planStart, todo.planEnd) : 0;
                    const dM = todo.doStart && todo.doEnd ? durMin(todo.doStart, todo.doEnd) : 0;
                    const isTOver = dM > pM && pM > 0;
                    const barDo = pM > 0 ? (dM / pM) * BAR_MAX : 0;
                    const barColor = isTOver ? '#D4735A' : '#6BAA7A';
                    return (
                      <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* 제목 */}
                        <div style={{ flex: 1, fontSize: 11, color: '#26343d', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {todo.text}
                        </div>
                        {/* 바 */}
                        <div style={{ position: 'relative', width: BAR_MAX + 4, flexShrink: 0, height: 5 }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, width: BAR_MAX, height: 5, backgroundColor: '#eef4fa', borderRadius: 3 }} />
                          {dM > 0 && (
                            <div style={{
                              position: 'absolute', top: 0, left: 0, height: 5,
                              width: Math.min(barDo, BAR_MAX + 4),
                              backgroundColor: barColor, borderRadius: 3,
                            }} />
                          )}
                        </div>
                        {/* 시간 */}
                        <div style={{ flexShrink: 0, minWidth: 64, textAlign: 'right' }}>
                          {pM > 0 && dM > 0 ? (
                            <span style={{ fontSize: 10, color: barColor, fontWeight: isTOver ? 700 : 400 }}>
                              {fmtMin(pM)} / {fmtMin(dM)}
                            </span>
                          ) : pM > 0 ? (
                            <span style={{ fontSize: 10, color: '#9aa7b4' }}>{fmtMin(pM)} / —</span>
                          ) : dM > 0 ? (
                            <span style={{ fontSize: 10, color: barColor }}>{fmtMin(dM)}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '0 12px 8px' }}>
                  <span style={{ fontSize: 11, color: '#ccc' }}>기록 없음</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단 고정 주간 총합 */}
      <div style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: '2px solid #eef4fa',
        backgroundColor: '#fff',
        padding: '8px 4px',
      }}>
        {[
          { label: '총 계획', value: weekly.tPlan > 0 ? fmtMin(weekly.tPlan) : '—', color: '#5B8FD8' },
          { label: '총 실제', value: weekly.tDo > 0 ? fmtMin(weekly.tDo) : '—', color: '#5BAA78' },
          { label: '달성률', value: weekly.tPlan > 0 ? `${weekly.pct}%` : '—', color: weekly.tPlan > 0 ? achColor(weekly.pct) : '#9aa7b4' },
          { label: '초과', value: weekly.overCnt > 0 ? `${weekly.overCnt}회` : '—', color: weekly.overCnt > 0 ? '#D4735A' : '#9aa7b4' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9aa7b4' }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WeekViewMobile (메인) ────────────────────────────────────────────────────

interface WeekViewMobileProps {
  viewDate: Date;
  weekStartsOn: 0 | 1;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  onToday: () => void;
}

export function WeekViewMobile({ viewDate, weekStartsOn, selectedDate, onSelectDate, onToday }: WeekViewMobileProps) {
  const { todos, selfCareRecords, dayStartHour: startHour, dayEndHour: endHour } = usePlanner();
  const [activeTab, setActiveTab] = useState<MobileTab>('3day');

  const weekStart = startOfWeek(viewDate, { weekStartsOn });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 이번 주 todo (반복 일정 포함 가상 확장)
  const weekTodos = useMemo(() => {
    const weekStartStr = format(days[0], 'yyyy-MM-dd');
    const weekEndStr = format(days[6], 'yyyy-MM-dd');
    return expandRecurringTodos(todos, weekStartStr, weekEndStr).filter(
      t => t.date && t.date >= weekStartStr && t.date <= weekEndStr
    );
  }, [days, todos]);

  const TABS: { key: MobileTab; label: string }[] = [
    { key: '3day', label: '3일' },
    { key: 'daily', label: '일별' },
    { key: 'summary', label: '주간 요약' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* 범례 */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #F3F0EA' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {[
            { label: 'P', bg: '#E8F0FE', border: '#5B8FD888', color: '#5B8FD8' },
            { label: 'D', bg: '#E8F8EE', border: '#5BAA7840', color: '#5BAA78' },
            { label: '초과', bg: '#FEE8E8', border: '#D4735A60', color: '#D4735A' },
          ].map(({ label, bg, border, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: bg, border: `1px solid ${border}` }} />
              {label}
            </div>
          ))}
        </div>
        <button
          onClick={onToday}
          style={{
            fontSize: 11, fontWeight: 700, color: '#C4A882',
            backgroundColor: '#FDF6EC', border: '1.5px solid #C4A88260',
            borderRadius: 8, padding: '2px 10px', lineHeight: 1.6,
          }}
        >
          Today
        </button>
      </div>

      {/* 뷰 전환 탭 */}
      <div style={{ flexShrink: 0, display: 'flex', backgroundColor: '#fff', borderBottom: '2px solid #eef4fa' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 4px',
              fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#26343d' : '#9aa7b4',
              backgroundColor: 'transparent', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #26343d' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === '3day' && (
          <ThreeDayView
            days={days}
            startHour={startHour}
            endHour={endHour}
            todayStr={todayStr}
            selectedDate={selectedDate}
            todos={weekTodos}
            selfCareRecords={selfCareRecords}
          />
        )}
        {activeTab === 'daily' && (
          <DailyView
            days={days}
            startHour={startHour}
            endHour={endHour}
            todayStr={todayStr}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            todos={weekTodos}
            selfCareRecords={selfCareRecords}
          />
        )}
        {activeTab === 'summary' && (
          <WeeklySummaryView
            days={days}
            todayStr={todayStr}
            todos={weekTodos}
          />
        )}
      </div>
    </div>
  );
}
