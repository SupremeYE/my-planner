import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Todo, Event } from '../../store';
import { useTheme } from '../../ThemeContext';

// ─── 주별 캘린더 종일(All-day) 레인 ───
// 시간 격자 "밖"에 두는 별도 레인. 시각 없는 항목(대부분의 할일)과 종일 이벤트,
// 그리고 여러 날에 걸치는 기간 할일을 담는다.
//  · 단일 날짜 항목 → 그 날짜 칸에 칩
//  · 여러 날 걸침(endDate > date) → 시작~종료일을 가로로 뻗는 막대(그리드 컬럼 span)
//  · 주 경계를 넘는 기간 → 잘린 쪽에 ‹ / › 화살표
//  · 완료 → 배경 불변(체크 + 취소선 + 뮤트, DESIGN §5 등록 규칙)
//  · 늦음(미완료 + 종료일 지남) → t.warning 마커
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
}

const ROW_H = 20;              // 한 줄(막대) 높이
const ROW_GAP = 3;
const COLLAPSED_LINES = 3;     // 접힘 상태 최대 표시 줄(항목+토글 포함) — 격자 보호 상한
// 펼침 시 PC(lg:) 레인 콘텐츠 max-height + 내부 스크롤은 haon.css `.lane-expanded-scroll`(lg: 한정).

export function WeekAllDayLane({ dates, items, timeColWidth, onEdit, onEmptyAdd }: WeekAllDayLaneProps) {
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
        {/* 좌측 "종일" 라벨칸 */}
        <div
          style={{
            gridColumn: 1,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
            padding: '4px 8px 4px 0',
            fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: '0.02em',
          }}
        >
          종일
        </div>

        {/* 우측 항목 영역 — dayCount 컬럼 중첩 그리드 */}
        <div style={{ gridColumn: `2 / -1`, position: 'relative', padding: '4px 0' }}>
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
                <LaneChip key={it.id} item={it} row={ri + 1} onEdit={onEdit} />
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
    </div>
  );
}

function LaneChip({ item, row, onEdit }: {
  item: PlacedItem;
  row: number;
  onEdit: (raw: Todo | Event, kind: 'todo' | 'event') => void;
}) {
  const { t } = useTheme();
  const isTodo = item.kind === 'todo';
  const fill = isTodo ? 'var(--cat-todo-fill)' : 'var(--cat-schedule-fill)';
  const dot = isTodo ? 'var(--cat-todo-dot)' : 'var(--cat-schedule-dot)';

  return (
    <button
      type="button"
      onClick={() => onEdit(item.raw, item.kind)}
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
        cursor: 'pointer', textAlign: 'left',
        opacity: item.done ? 0.7 : 1,
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
