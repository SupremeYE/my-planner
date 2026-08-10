import type { Todo, Event } from '../app/store';

/**
 * 월별 캘린더 기간 막대(span bar) 배치 로직 — 순수 함수 단일 진실.
 *
 * 월별 뷰는 "여러 주 그리드"라 주별 종일 레인(WeekAllDayLane, 7칸 한 줄)과 배치가 다르다:
 *  · lane(줄) = 월 전체에서 안정 배정 → 같은 항목은 주가 바뀌어도 같은 줄 위치 유지
 *  · 컬럼    = 주 행 단위로 계산(주 경계에서 잘라 각 줄에 그림)
 * 색·완료·잘림의 "시각" 표현은 소비처(CalendarView.MonthSpanBar)가, "배치 수학"은 여기가 담당한다.
 * (주별 파일은 범위상 수정 금지 → 개념만 공유하고 배치는 여기 독립 재구현.)
 */

export interface MonthSpan {
  id: string;
  kind: 'todo' | 'event';
  text: string;
  startDate: string;  // yyyy-MM-dd (기간 시작)
  endDate: string;    // yyyy-MM-dd (기간 종료, > startDate)
  done: boolean;
  late: boolean;
  color?: string;     // 첫 태그 색 — 없으면 undefined → 소비처가 카테고리 색 폴백
  lane: number;       // 월 전체 안정 lane(줄)
  raw: Todo | Event;
}

export interface SpanPlacement {
  startCol: number;    // 주 행 내 시작 컬럼 (0..6)
  endCol: number;      // 주 행 내 종료 컬럼 (0..6)
  clipStart: boolean;  // 이 주 시작 이전부터 이어짐(이전 주/이전 달) → 왼쪽 ‹
  clipEnd: boolean;    // 이 주 끝 이후로 이어짐(다음 주/다음 달) → 오른쪽 ›
}

/**
 * 월 전체 안정 lane 배정 — 시작일 오름차순 그리디. 날짜가 겹치지 않는 가장 낮은 lane 재사용.
 * → 같은 항목은 어느 주 행에서든 동일 lane(세로 위치)로 그려진다(요구: 주 바뀌어도 같은 줄).
 * 동률(같은 시작일)은 긴 기간을 먼저(낮은 lane) 배치해 짧은 막대가 위로 오는 흔한 관례를 따른다.
 */
export function assignSpanLanes(spans: Omit<MonthSpan, 'lane'>[]): MonthSpan[] {
  const sorted = [...spans].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate),
  );
  const laneEnds: string[] = []; // laneEnds[k] = 그 lane 마지막 항목의 종료일
  return sorted.map(s => {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= s.startDate) lane++;
    laneEnds[lane] = s.endDate;
    return { ...s, lane };
  });
}

/**
 * 주 행(7칸, null=이전/다음 달의 빈칸) 안에서 span의 컬럼 범위 + 잘림 여부.
 * 교집합이 없으면 null(이 주에는 안 그림).
 */
export function placeSpanInWeek(weekDates: (string | null)[], span: MonthSpan): SpanPlacement | null {
  const valid = weekDates
    .map((d, i) => ({ d, i }))
    .filter((x): x is { d: string; i: number } => !!x.d);
  if (valid.length === 0) return null;
  const weekStart = valid[0].d;
  const weekEnd = valid[valid.length - 1].d;
  if (span.endDate < weekStart || span.startDate > weekEnd) return null;
  const startEntry = valid.find(x => x.d >= span.startDate) ?? valid[0];
  const endEntry = [...valid].reverse().find(x => x.d <= span.endDate) ?? valid[valid.length - 1];
  return {
    startCol: startEntry.i,
    endCol: endEntry.i,
    clipStart: span.startDate < weekStart,
    clipEnd: span.endDate > weekEnd,
  };
}
