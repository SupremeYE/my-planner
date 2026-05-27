import { addDays, format, getDay, isAfter, isBefore, parseISO } from 'date-fns';
import type { Todo } from '../app/store';

/**
 * 반복 일정 가상 확장 (Virtual expansion)
 * DB에 저장된 raw todos를 받아 dateRange 안의 모든 인스턴스를 반환한다.
 *
 * - 비반복 할일은 그대로 반환
 * - 반복 부모(recurrenceRule 있고 recurrenceParentId 없음)는 날짜 범위 내 인스턴스를 가상 생성
 * - 예외(isException=true or recurrenceParentId 있음)는 해당 날짜의 가상 인스턴스를 대체
 * - 예외 중 status='cancelled'인 것은 "삭제"를 의미하므로 결과에서 제외
 * - 반복 종료일 없는 경우 endDate로부터 최대 1년치까지 생성
 */
export function expandRecurringTodos(
  rawTodos: Todo[],
  startDate: string,
  endDate: string,
): Todo[] {
  const rangeStart = parseISO(startDate);
  const rangeEnd = parseISO(endDate);

  // ── 분류 ─────────────────────────────────────────────────────────────────
  const nonRecurring: Todo[] = [];
  const parents: Todo[] = [];
  const exceptions: Todo[] = [];

  for (const t of rawTodos) {
    if (t.recurrenceParentId || t.isException) {
      exceptions.push(t);
    } else if (t.recurrenceRule) {
      parents.push(t);
    } else {
      nonRecurring.push(t);
    }
  }

  // ── 비반복 할일 ──────────────────────────────────────────────────────────
  const result: Todo[] = [...nonRecurring];

  // ── 반복 부모 → 인스턴스 확장 ────────────────────────────────────────────
  for (const parent of parents) {
    const parentOriginDate = parent.date ? parseISO(parent.date) : rangeStart;
    // 반복 종료일: 없으면 rangeEnd 기준으로 최대 1년
    const repeatEnd = parent.recurrenceEndDate
      ? parseISO(parent.recurrenceEndDate)
      : addDays(rangeEnd, 365);

    // 이 부모의 유효 생성 범위
    const effectiveStart = isAfter(rangeStart, parentOriginDate) ? rangeStart : parentOriginDate;
    const effectiveEnd = isBefore(rangeEnd, repeatEnd) ? rangeEnd : repeatEnd;

    if (isAfter(effectiveStart, effectiveEnd)) continue;

    // 이 부모의 예외 맵: date → Todo
    const exMap = new Map<string, Todo>();
    for (const ex of exceptions) {
      if (ex.recurrenceParentId === parent.id && ex.date) {
        exMap.set(ex.date, ex);
      }
    }

    // 매일 순회하며 recurrenceRule에 맞는 날짜에 인스턴스 생성
    const origDayOfWeek = getDay(parentOriginDate);
    let cur = effectiveStart;

    while (!isAfter(cur, effectiveEnd)) {
      const dateStr = format(cur, 'yyyy-MM-dd');
      const dow = getDay(cur);

      let include = false;
      switch (parent.recurrenceRule) {
        case 'daily':
          include = true;
          break;
        case 'weekly':
          include = dow === origDayOfWeek;
          break;
        case 'weekdays':
          include = dow >= 1 && dow <= 5;
          break;
        case 'custom':
          include = (parent.recurrenceDays ?? []).includes(dow);
          break;
      }

      if (include) {
        if (exMap.has(dateStr)) {
          const ex = exMap.get(dateStr)!;
          // status='cancelled'는 삭제 예외 → 결과에 포함하지 않음
          if (ex.status !== 'cancelled') {
            result.push(ex);
          }
        } else {
          // 가상 인스턴스: 원본 부모 데이터에 날짜만 교체
          // id = `{parentId}::{date}` (가상 ID, DB에 없음)
          const isOriginDate = dateStr === parent.date;
          result.push({
            ...parent,
            id: `${parent.id}::${dateStr}`,
            date: dateStr,
            // 원본 날짜가 아닌 인스턴스는 do 기록 초기화 (각 날 독립)
            doStart: isOriginDate ? parent.doStart : undefined,
            doEnd: isOriginDate ? parent.doEnd : undefined,
            doElapsedSec: isOriginDate ? parent.doElapsedSec : undefined,
          });
        }
      }

      cur = addDays(cur, 1);
    }
  }

  return result;
}

/**
 * 가상 인스턴스 ID인지 판별 (format: "{parentId}::{date}")
 */
export function isVirtualTodoId(id: string): boolean {
  return id.includes('::');
}

/**
 * 가상 인스턴스 ID에서 parentId와 instanceDate 추출
 */
export function parseVirtualTodoId(id: string): { parentId: string; instanceDate: string } | null {
  const parts = id.split('::');
  if (parts.length !== 2) return null;
  return { parentId: parts[0], instanceDate: parts[1] };
}

/**
 * 요일 인덱스 → 한글 이름
 */
export const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
