import { parseISO, addDays, differenceInCalendarDays, format } from 'date-fns';

/**
 * 할일을 다른 날짜로 옮길 때(미루기·오늘로·드래그) 함께 옮겨야 하는 end_date 를 계산한다.
 *
 * DB 제약 `todos_end_date_valid`:
 *   (date IS NULL AND end_date IS NULL) OR (date IS NOT NULL AND (end_date IS NULL OR end_date >= date))
 *
 * date 만 앞으로 옮기면 **단일일 할일(end_date == date)** 도 `end_date < date` 로 역전되어
 * upsert 가 CHECK 위반(23514)으로 통째로 실패한다. 이때 낙관적 로컬 state 는 이미 이동해
 * "화면엔 옮겨졌는데 DB·일간 화면엔 그대로"인 데이터 불일치가 생긴다(미루기 버그의 근본 원인).
 *
 * 규칙:
 * - end_date 없음(null/undefined) → 그대로 없음(제약 무관, undefined 반환)
 * - 기간 할일(end_date > date) → 같은 간격(span)만큼 함께 이동해 **기간 보존**
 * - 단일일(end_date == date) 또는 시작일 없던 항목 → 새 날짜로
 */
export function shiftedEndDate(
  todo: { date: string | null; endDate?: string | null },
  newDate: string,
): string | undefined {
  if (!todo.endDate) return undefined;
  if (!todo.date) return newDate;
  const span = differenceInCalendarDays(parseISO(todo.endDate), parseISO(todo.date));
  if (span <= 0) return newDate;
  return format(addDays(parseISO(newDate), span), 'yyyy-MM-dd');
}
