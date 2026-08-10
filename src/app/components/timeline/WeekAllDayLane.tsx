import React, { useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { Todo, Event } from '../../store';
import { useTheme } from '../../ThemeContext';
import { mixHex, withAlpha } from '../../styles/haonStyles';
import { PX_PER_MIN, minutesToTime } from './timelineConstants';

/** 격자 드롭 대상(4-2) — 종일 레인 칩을 시간 격자 P/D 슬롯에 떨어뜨렸을 때 해석된 지점. */
export interface GridDropTarget {
  date: string;
  lane: 'plan' | 'do';
  start: string;   // HH:mm
  end: string;     // HH:mm (기본 시작+60분, 그리드 끝으로 클램프)
}

// (clientX,clientY) 아래에 시간 격자 P/D 슬롯이 있으면 드롭 지점을 해석. 없으면 null(레인 내부 취급).
// 슬롯 top = 그 슬롯의 data-start-hour 시각. 시각 = startHour*60 + (y - slotTop)/PX_PER_MIN, 15분 스냅.
function resolveGridDrop(clientX: number, clientY: number): GridDropTarget | null {
  const els = typeof document !== 'undefined' ? document.elementsFromPoint(clientX, clientY) : [];
  const slot = els.find(el => el instanceof HTMLElement && el.dataset.weekSlot) as HTMLElement | undefined;
  if (!slot) return null;
  const lane = slot.dataset.weekSlot as 'plan' | 'do';
  const date = slot.dataset.weekDate;
  if (!date || (lane !== 'plan' && lane !== 'do')) return null;
  const startHour = parseInt(slot.dataset.startHour || '0', 10);
  const endHour = parseInt(slot.dataset.endHour || '24', 10);
  const rect = slot.getBoundingClientRect();
  const rawMin = startHour * 60 + (clientY - rect.top) / PX_PER_MIN;
  const startMin = Math.max(startHour * 60, Math.min(endHour * 60 - 60, Math.round(rawMin / 15) * 15));
  const endMin = Math.min(endHour * 60, startMin + 60);
  return { date, lane, start: minutesToTime(startMin), end: minutesToTime(endMin) };
}

// ─── 주별 캘린더 종일(All-day) 레인 ───
// 시간 격자 "밖"에 두는 별도 레인. 시각 없는 항목(대부분의 할일)과 종일 이벤트,
// 그리고 여러 날에 걸치는 기간 할일을 담는다.
//  · 단일 날짜 항목 → 그 날짜 칸에 칩
//  · 여러 날 걸침(endDate > date) → 시작~종료일을 가로로 뻗는 막대(그리드 컬럼 span)
//  · 주 경계를 넘는 기간 → 잘린 쪽에 ‹ / › 화살표
//  · 완료 → 배경 불변(체크 + 취소선 + 뮤트, DESIGN §5 등록 규칙)
//  · 늦음(미완료 + 종료일 지남) → t.warning 마커
//  · 색 = 태그 색(첫 태그, tag.color) 우선 → 없으면 카테고리 색(--cat-todo/--cat-schedule) 폴백
// 레이아웃: 좌측 "종일" 라벨칸(시간 레이블 폭과 정렬) + 우측 dayCount 컬럼 중첩 그리드.
//
// 높이 계약(중요): 접힘(기본)은 항상 최대 3줄(2줄 항목 + '+N 더보기' 토글 줄)로 고정한다 —
// 레인이 시간 격자를 밀어내지 못하게 하는 핵심 보호장치. 펼침은 전부 표시하되 PC(lg:)에서만
// maxHeight + 내부 스크롤로 격자를 지킨다. 모바일은 고정 높이·flex 잠금을 쓰지 않고 자연 높이
// (펼침은 사용자가 명시적으로 연 것 → 허용). 빈 레인은 최소 한 줄 높이만 차지.

/** 레인에 넣을 정규화된 항목(할일/이벤트 공용). geometry(컬럼 인덱스)는 레인 내부에서 계산. */
export interface AllDayItemInput {
  id: string;
  kind: 'todo' | 'event';
  text: string;
  startDate: string;      // yyyy-MM-dd (기간 시작 = todo.date / event.startDate)
  endDate: string;        // yyyy-MM-dd (기간 종료 = todo.endDate ?? date)
  done: boolean;
  late: boolean;
  color?: string;         // 태그 색(첫 태그). 없으면 undefined → 카테고리 색 폴백
  raw: Todo | Event;
}

interface PlacedItem extends AllDayItemInput {
  startIdx: number;   // 창(window) 내 시작 컬럼 (0..dayCount-1, 클램프됨)
  endIdx: number;     // 창 내 종료 컬럼 (0..dayCount-1, 클램프됨)
  clipStart: boolean; // 실제 시작이 창 이전 (왼쪽 잘림)
  clipEnd: boolean;   // 실제 종료가 창 이후 (오른쪽 잘림)
}

interface WeekAllDayLaneProps {
  dates: string[];                       // 창의 날짜들 (week=7, day=1)
  items: AllDayItemInput[];
  timeColWidth: number;                  // 좌측 라벨칸 폭 (시간 격자 정렬용)
  onEdit: (raw: Todo | Event, kind: 'todo' | 'event') => void;
  onEmptyAdd: (date: string) => void;
  // 단일일(모바일) 레인에서 "종일" 라벨 아래 표기할 선택 요일(예: '화') — 선택 탭과의 연결 명확화.
  // 미전달(PC 7일)이면 표기 안 함.
  sublabel?: string;
  // Stage 4-1: 할일 칩을 다른 요일 칸으로 드래그 → 날짜 이동(deltaDays 만큼 date·endDate 동시 이동).
  // 전달 + 7일(주간) 변형일 때만 드래그 활성 — 모바일 단일일(dates=1)은 드롭 대상이 없어 비활성(편집 모달로 대체).
  onMoveDate?: (raw: Todo, deltaDays: number) => void;
  // Stage 4-2: 칩을 시간 격자 P/D 슬롯으로 드롭 → 계획(plan)/실적(do) 시각 부여.
  onDropToGrid?: (raw: Todo, target: GridDropTarget) => void;
}

const ROW_H = 20;              // 한 줄(막대) 높이
const ROW_GAP = 3;
const COLLAPSED_LINES = 3;     // 접힘 상태 최대 표시 줄(항목+토글 포함) — 격자 보호 상한
// 펼침 시 PC(lg:) 레인 콘텐츠 max-height + 내부 스크롤은 haon.css `.lane-expanded-scroll`(lg: 한정).

export function WeekAllDayLane({ dates, items, timeColWidth, onEdit, onEmptyAdd, sublabel, onMoveDate, onDropToGrid }: WeekAllDayLaneProps) {
  const { t } = useTheme();
  // 세션 내 유지(컴포넌트가 마운트 유지되므로 주 이동에도 상태 보존)
  const [expanded, setExpanded] = useState(false);
  const dayCount = dates.length;
  const winStart = dates[0];
  const winEnd = dates[dayCount - 1];

  // 창과 겹치는 항목만 남기고, 시작/종료 컬럼 인덱스 + 잘림 여부 계산
  const placed: PlacedItem[] = useMemo(() => {
    const out: PlacedItem[] = [];
    for (const it of items) {
      if (it.endDate < winStart || it.startDate > winEnd) continue; // 창 밖
      let startIdx = dates.indexOf(it.startDate);
      let endIdx = dates.indexOf(it.endDate);
      const clipStart = it.startDate < winStart;
      const clipEnd = it.endDate > winEnd;
      if (startIdx < 0) startIdx = 0;             // 창 이전 시작 → 창 왼쪽 끝부터
      if (endIdx < 0) endIdx = dayCount - 1;      // 창 이후 종료 → 창 오른쪽 끝까지
      out.push({ ...it, startIdx, endIdx, clipStart, clipEnd });
    }
    return out;
  }, [items, dates, winStart, winEnd, dayCount]);

  // 그리디 행 배치: 긴 막대 먼저 → 겹치지 않는 첫 행에 배치
  const rows: PlacedItem[][] = useMemo(() => {
    const sorted = [...placed].sort(
      (a, b) => (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx) || a.startIdx - b.startIdx,
    );
    const r: PlacedItem[][] = [];
    for (const it of sorted) {
      let row = r.find(rw => rw.every(o => it.endIdx < o.startIdx || it.startIdx > o.endIdx));
      if (!row) { row = []; r.push(row); }
      row.push(it);
    }
    return r;
  }, [placed]);

  // 접힘: COLLAPSED_LINES 초과 시 (LINES-1)줄만 보이고 마지막 줄은 '+N 더보기' 토글.
  // 펼침: 전부 표시 + '접기'. 토글은 항상 보이며(양방향) 칩과 겹치지 않는 별도 하단 바.
  const hasOverflow = rows.length > COLLAPSED_LINES;
  const visibleRows = expanded || !hasOverflow ? rows : rows.slice(0, COLLAPSED_LINES - 1);
  const hiddenCount = hasOverflow && !expanded
    ? rows.slice(COLLAPSED_LINES - 1).reduce((s, r) => s + r.length, 0)
    : 0;

  const contentRows = Math.max(visibleRows.length, 1);
  const contentHeight = contentRows * ROW_H + Math.max(contentRows - 1, 0) * ROW_GAP;

  // ── Stage 4-1: 날짜 이동 드래그(할일만, 7일 주간 변형 전용) ──
  // 좌표는 요일 컬럼 단위. 그랩 컬럼(originIdx) → 드롭 컬럼(targetIdx) 차이만큼 date·endDate 이동.
  // 마우스=5px 임계로 드래그 시작(그 미만은 탭=편집), 터치/펜=250ms 롱프레스(대기 중 이동은 스크롤로 간주).
  // 시각 피드백: 칩이 커서를 따라오는 고스트(fixed) + 드롭 대상 요일 옅은 틴트. (커서에 '들려' 이동하는 모션)
  const draggable = dayCount > 1 && !!onMoveDate;
  const dayAreaRef = useRef<HTMLDivElement>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragTargetIdx, setDragTargetIdx] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; text: string; fill: string } | null>(null);
  const dragRef = useRef<{
    pointerId: number; el: HTMLElement; raw: Todo; originIdx: number;
    activated: boolean; moved: boolean; pointerType: string;
    startX: number; startY: number; targetIdx: number;
    text: string; fill: string;
    longPressTimer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const colFromClientX = (clientX: number): number => {
    const el = dayAreaRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const w = r.width / dayCount;
    return Math.max(0, Math.min(dayCount - 1, Math.floor((clientX - r.left) / w)));
  };
  // 드래그 종료 시 모든 상태를 확실히 정리한다. 정리 누락 → hover 마다 하이라이트가 되살아나는 버그의 원인.
  const clearDrag = () => {
    const d = dragRef.current;
    if (d?.longPressTimer) clearTimeout(d.longPressTimer);
    if (d) { try { d.el.releasePointerCapture(d.pointerId); } catch { /* noop */ } }
    dragRef.current = null;
    setDragItemId(null);
    setDragTargetIdx(null);
    setGhost(null);
  };
  const activateDrag = (d: NonNullable<typeof dragRef.current>, clientX: number, clientY: number) => {
    d.activated = true;
    setDragItemId(d.raw.id);
    setDragTargetIdx(d.originIdx);
    setGhost({ x: clientX, y: clientY, text: d.text, fill: d.fill });
    if (d.pointerType !== 'mouse' && navigator.vibrate) { try { navigator.vibrate(10); } catch { /* noop */ } }
  };
  const onChipPointerDown = (e: React.PointerEvent, item: PlacedItem) => {
    if (!draggable || item.kind !== 'todo' || e.button === 2) return;
    const el = e.currentTarget as HTMLElement;
    const originIdx = colFromClientX(e.clientX);
    const fill = item.color ? mixHex(item.color, 255, 0.72) : 'var(--cat-todo-fill)';
    const d = {
      pointerId: e.pointerId, el, raw: item.raw as Todo, originIdx,
      activated: false, moved: false, pointerType: e.pointerType,
      startX: e.clientX, startY: e.clientY, targetIdx: originIdx,
      text: item.text, fill,
      longPressTimer: null as ReturnType<typeof setTimeout> | null,
    };
    dragRef.current = d;
    if (e.pointerType === 'mouse') {
      try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    } else {
      d.longPressTimer = setTimeout(() => {
        d.longPressTimer = null;
        if (dragRef.current !== d) return;
        try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
        activateDrag(d, d.startX, d.startY);
      }, 250);
    }
  };
  const onChipPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    // 마우스에서 버튼이 안 눌린 이동(=hover)인데 dragRef 가 남아 있으면 정리(유실된 드래그 잔재 방어).
    // 이 가드가 "드롭 후 마우스 움직일 때마다 계속 하이라이트되는" 버그를 원천 차단한다.
    if (d.pointerType === 'mouse' && e.buttons === 0) { clearDrag(); return; }
    if (!d.activated) {
      const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      if (d.pointerType === 'mouse') {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) activateDrag(d, e.clientX, e.clientY);
        else return;
      } else {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearDrag(); // 롱프레스 전 이동 = 스크롤
        return;
      }
    }
    d.moved = true;
    setGhost(g => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    // 격자 슬롯 위면 레인 요일 하이라이트를 끄고(격자로 떨어질 것), 아니면 대상 요일 하이라이트.
    const overGrid = onDropToGrid && resolveGridDrop(e.clientX, e.clientY);
    if (overGrid) {
      d.targetIdx = -1;         // 레인 밖(격자) 표시
      setDragTargetIdx(null);
    } else {
      const idx = colFromClientX(e.clientX);
      d.targetIdx = idx;
      setDragTargetIdx(idx);
    }
  };
  const onChipPointerUp = (e: React.PointerEvent, item: PlacedItem) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) { clearDrag(); return; }
    if (d.longPressTimer) { clearTimeout(d.longPressTimer); d.longPressTimer = null; }
    if (d.activated && d.moved) {
      // 격자 P/D 슬롯 위에 드롭 → 계획/실적 시각 부여(4-2). 아니면 레인 내 날짜 이동(4-1).
      const gridTarget = onDropToGrid ? resolveGridDrop(e.clientX, e.clientY) : null;
      if (gridTarget) {
        onDropToGrid!(d.raw, gridTarget);
      } else if (d.targetIdx >= 0 && d.targetIdx !== d.originIdx) {
        onMoveDate!(d.raw, d.targetIdx - d.originIdx);
      }
    } else if (!d.activated) {
      onEdit(item.raw, item.kind); // 탭 = 편집(드래그 활성 칩은 onClick 미부착)
    }
    clearDrag();
  };
  const onChipPointerCancel = () => clearDrag();
  const onChipLostCapture = () => clearDrag();

  return (
    <div style={{ borderTop: `1px solid ${t.borderLight}`, backgroundColor: t.surfaceMuted }}>
      {/* 상단: 라벨칸 + 항목 영역 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${timeColWidth}px repeat(${dayCount}, minmax(0, 1fr))`,
          alignItems: 'stretch',
        }}
      >
        {/* 좌측 "종일" 라벨칸 — 단일일(모바일)이면 선택 요일을 코랄로 병기해 선택 탭과 연결 */}
        <div
          style={{
            gridColumn: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start',
            gap: 1, padding: '4px 8px 4px 0',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: '0.02em' }}>종일</span>
          {sublabel && <span style={{ fontSize: 9, fontWeight: 800, color: t.accent }}>{sublabel}</span>}
        </div>

        {/* 우측 항목 영역 — dayCount 컬럼 중첩 그리드 */}
        <div ref={dayAreaRef} style={{ gridColumn: `2 / -1`, position: 'relative', padding: '4px 0' }}>
          {/* 드래그 중 드롭 대상 요일 — 옅은 틴트만(주 피드백은 커서를 따라오는 고스트). */}
          {dragTargetIdx !== null && (
            <div
              aria-hidden
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${(dragTargetIdx / dayCount) * 100}%`,
                width: `${100 / dayCount}%`,
                backgroundColor: withAlpha(t.accent, 0.09),
                border: `1px solid ${withAlpha(t.accent, 0.3)}`,
                borderRadius: 6, pointerEvents: 'none', zIndex: 4,
              }}
            />
          )}
          {/* 빈 칸 클릭 → 그 날짜로 할일 추가 (항목 아래 배경 레이어) */}
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'grid', gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))`,
            }}
          >
            {dates.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-label={`${d} 할일 추가`}
                onClick={() => onEmptyAdd(d)}
                style={{
                  borderLeft: i > 0 ? `1px solid ${t.borderLight}` : 'none',
                  background: 'transparent', cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {/* 항목 그리드 — 펼침 시 PC(lg:)만 maxHeight+스크롤로 격자 보호(lane-scroll 클래스) */}
          <div
            className={expanded ? 'lane-expanded-scroll' : undefined}
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))`,
              gridAutoRows: `${ROW_H}px`,
              rowGap: ROW_GAP,
              minHeight: contentHeight,
              pointerEvents: 'none', // 칩만 개별적으로 pointerEvents 복구
            }}
          >
            {visibleRows.map((row, ri) =>
              row.map(it => (
                <LaneChip
                  key={it.id}
                  item={it}
                  row={ri + 1}
                  onEdit={onEdit}
                  draggable={draggable && it.kind === 'todo'}
                  dragging={dragItemId === it.id}
                  onChipPointerDown={onChipPointerDown}
                  onChipPointerMove={onChipPointerMove}
                  onChipPointerUp={onChipPointerUp}
                  onChipPointerCancel={onChipPointerCancel}
                  onChipLostCapture={onChipLostCapture}
                />
              )),
            )}
          </div>
        </div>
      </div>

      {/* 토글 바 — 항목 영역 아래 전폭(라벨칸만큼 들여쓰기). 오버플로 있을 때만. 양방향. */}
      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            paddingLeft: timeColWidth + 6, paddingRight: 8,
            paddingTop: 2, paddingBottom: 3,
            fontSize: 9, fontWeight: 700, color: t.textMuted,
            background: 'transparent', cursor: 'pointer',
          }}
        >
          {expanded ? '접기' : `+${hiddenCount} 더보기`}
        </button>
      )}

      {/* 드래그 고스트 — 커서를 따라오는 '들린 칩'. fixed 라 레이아웃에 영향 없음. */}
      {ghost && (
        <div
          aria-hidden
          style={{
            position: 'fixed', left: ghost.x + 12, top: ghost.y + 8,
            zIndex: 9999, pointerEvents: 'none',
            maxWidth: 200, height: ROW_H, padding: '0 8px',
            display: 'flex', alignItems: 'center',
            backgroundColor: ghost.fill, color: t.text,
            borderRadius: 6, fontSize: 10, fontWeight: 700,
            boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            opacity: 0.95, transform: 'rotate(-1.5deg)',
          }}
        >
          {ghost.text}
        </div>
      )}
    </div>
  );
}

function LaneChip({ item, row, onEdit, draggable, dragging, onChipPointerDown, onChipPointerMove, onChipPointerUp, onChipPointerCancel, onChipLostCapture }: {
  item: PlacedItem;
  row: number;
  onEdit: (raw: Todo | Event, kind: 'todo' | 'event') => void;
  draggable: boolean;
  dragging: boolean;
  onChipPointerDown: (e: React.PointerEvent, item: PlacedItem) => void;
  onChipPointerMove: (e: React.PointerEvent) => void;
  onChipPointerUp: (e: React.PointerEvent, item: PlacedItem) => void;
  onChipPointerCancel: (e: React.PointerEvent) => void;
  onChipLostCapture: () => void;
}) {
  const { t } = useTheme();
  const isTodo = item.kind === 'todo';
  // 색: 태그 색(첫 태그) 우선 → 없으면 카테고리 색 폴백. dot 은 정확한 tag.color(시간 스트립과 동일 색 인식).
  let fill: string;
  let dot: string;
  if (item.color) {
    fill = mixHex(item.color, 255, 0.72); // 채도 낮춘 파스텔 채움(가독) + 정확 색 dot
    dot = item.color;
  } else if (isTodo) {
    fill = 'var(--cat-todo-fill)';
    dot = 'var(--cat-todo-dot)';
  } else {
    fill = 'var(--cat-schedule-fill)';
    dot = 'var(--cat-schedule-dot)';
  }

  // 드래그 활성 칩은 onClick 미부착 — 탭=편집을 pointerup 이 판정(드래그와 탭 구분).
  // 비드래그(이벤트·모바일 단일일)는 기존 onClick=편집.
  return (
    <button
      type="button"
      onClick={draggable ? undefined : () => onEdit(item.raw, item.kind)}
      onPointerDown={draggable ? (e) => onChipPointerDown(e, item) : undefined}
      onPointerMove={draggable ? onChipPointerMove : undefined}
      onPointerUp={draggable ? (e) => onChipPointerUp(e, item) : undefined}
      onPointerCancel={draggable ? onChipPointerCancel : undefined}
      onLostPointerCapture={draggable ? onChipLostCapture : undefined}
      title={item.text}
      style={{
        gridColumn: `${item.startIdx + 1} / ${item.endIdx + 2}`,
        gridRow: row,
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', gap: 4,
        minWidth: 0, height: ROW_H,
        margin: '0 2px',
        padding: '0 6px',
        // 완료여도 배경은 그대로 — 완료는 체크/취소선/뮤트로만 표현(DESIGN §5)
        backgroundColor: fill,
        // 주 경계 잘림: 잘린 쪽 모서리를 평평하게
        borderTopLeftRadius: item.clipStart ? 0 : 6,
        borderBottomLeftRadius: item.clipStart ? 0 : 6,
        borderTopRightRadius: item.clipEnd ? 0 : 6,
        borderBottomRightRadius: item.clipEnd ? 0 : 6,
        cursor: draggable ? 'grab' : 'pointer', textAlign: 'left',
        opacity: dragging ? 0.4 : (item.done ? 0.7 : 1),
        overflow: 'hidden',
      }}
    >
      {/* 왼쪽 잘림 화살표 */}
      {item.clipStart && <span style={{ fontSize: 10, color: t.text, flexShrink: 0, lineHeight: 1 }}>‹</span>}
      {/* 할일=체크 동그라미 / 이벤트=dot. 늦음이면 warning 색 테두리 우선 */}
      {isTodo ? (
        <span
          aria-hidden
          style={{
            width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: item.done ? 'none' : `1.5px solid ${item.late ? t.warning : dot}`,
            backgroundColor: item.done ? dot : 'transparent',
          }}
        >
          {item.done && <Check size={7} color="#fff" strokeWidth={3.5} />}
        </span>
      ) : (
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
      )}
      <span
        style={{
          fontSize: 10, fontWeight: 600, minWidth: 0,
          color: item.done ? t.textMuted : t.text,
          textDecoration: item.done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: `${ROW_H}px`,
        }}
      >
        {item.text}
      </span>
      {/* 늦음 표시(미완료) */}
      {item.late && !item.done && (
        <span style={{ fontSize: 8, fontWeight: 800, color: t.warning, flexShrink: 0, letterSpacing: '0.02em' }}>늦음</span>
      )}
      {/* 오른쪽 잘림 화살표 */}
      {item.clipEnd && (
        <span style={{ fontSize: 10, color: t.text, flexShrink: 0, marginLeft: 'auto', lineHeight: 1 }}>›</span>
      )}
    </button>
  );
}
