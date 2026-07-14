import { parseISO } from 'date-fns';
import type { Todo } from '../app/store';
import { buildSpec, expandRecurrenceDates, legacyTodoToSpec, type RecurrenceSpec } from './recurrence';

/** 할일이 반복인지(레거시 또는 신규 스펙) */
function todoHasRecurrence(t: Todo): boolean {
  return !!(t.recurrenceRule || t.recurrenceFreq);
}

/** 할일 → RecurrenceSpec (신규 recurrenceFreq 우선, 없으면 레거시 정규화) */
function resolveTodoSpec(t: Todo, origin: Date): RecurrenceSpec | null {
  if (t.recurrenceFreq) {
    return buildSpec({
      freq: t.recurrenceFreq,
      interval: t.recurrenceInterval,
      byday: t.recurrenceDays,
      preset: t.recurrencePreset,
      endDate: t.recurrenceEndDate,
    });
  }
  return legacyTodoToSpec(t.recurrenceRule, t.recurrenceDays, t.recurrenceEndDate, origin);
}

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
    } else if (todoHasRecurrence(t)) {
      parents.push(t);
    } else {
      nonRecurring.push(t);
    }
  }

  // ── 비반복 할일 ──────────────────────────────────────────────────────────
  const result: Todo[] = [...nonRecurring];

  // ── 반복 부모 → 인스턴스 확장 (공용 엔진 위임) ───────────────────────────
  for (const parent of parents) {
    const parentOriginDate = parent.date ? parseISO(parent.date) : rangeStart;
    const spec = resolveTodoSpec(parent, parentOriginDate);
    if (!spec) continue;

    // 이 부모의 예외 맵: date → Todo
    const exMap = new Map<string, Todo>();
    for (const ex of exceptions) {
      if (ex.recurrenceParentId === parent.id && ex.date) {
        exMap.set(ex.date, ex);
      }
    }

    // 공용 엔진이 스펙(일/주/월/년 + interval + byday + preset)에 맞는 날짜를 생성
    const dates = expandRecurrenceDates(spec, parentOriginDate, rangeStart, rangeEnd);

    for (const dateStr of dates) {
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
