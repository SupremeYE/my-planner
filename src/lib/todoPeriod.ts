import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Todo, TodoStatus } from '../app/store';

/**
 * 할일 기간(period) 파생 유틸 — 단일 진실.
 *
 * 배경: 과거 status(inProgress)가 "진행중 표시"와 "오늘 화면 이월 자격"을 겸해,
 * 완료(→done)·진행중 해제(→active) 어느 쪽이든 이월이 끊기며 할일이 사라졌다.
 * 이제 진행중은 저장 상태가 아니라 기간(date=시작 ~ endDate=종료) + 미완료에서 파생한다.
 * (마이그레이션 20260808020000 로 단일 날짜 할일은 endDate=date 로 백필됨.)
 */

/** 기간 종료일. 단일 날짜면 date와 같음. date 없으면(인박스) null. */
export function todoEndDate(t: Pick<Todo, 'date' | 'endDate'>): string | null {
  return t.endDate ?? t.date;
}

/** 완료/취소/보관을 제외한 "미완료" — 기간 파생 판정의 공통 기준. */
export function isTodoIncomplete(status: TodoStatus): boolean {
  return status !== 'done' && status !== 'cancelled' && status !== 'backlog';
}

export type DerivedTodoPhase = 'upcoming' | 'inProgress' | 'late' | 'done' | 'inactive';

/**
 * 기간 + 완료 여부에서 파생되는 표시 상태 (기준일 refDate = 보통 오늘).
 * status(inProgress) 수동 토글을 대체한다 — 진행중/늦음은 날짜가 결정한다.
 *  - done       : 완료
 *  - inactive   : 취소/보관/미지정(date null)
 *  - upcoming   : 시작 전 (refDate < 시작)
 *  - inProgress : 시작 <= refDate <= 종료 AND 미완료
 *  - late       : 종료 < refDate AND 미완료 (늦음)
 */
export function deriveTodoPhase(
  t: Pick<Todo, 'date' | 'endDate' | 'status'>,
  refDate: string,
): DerivedTodoPhase {
  if (t.status === 'done') return 'done';
  if (!isTodoIncomplete(t.status)) return 'inactive';
  const start = t.date;
  if (!start) return 'inactive';
  const end = todoEndDate(t)!;
  if (refDate < start) return 'upcoming';
  if (refDate > end) return 'late';
  return 'inProgress';
}

/** 기간이 기준일을 포함하는가 (시작 <= refDate <= 종료). date null이면 false. */
export function periodCoversDate(t: Pick<Todo, 'date' | 'endDate'>, refDate: string): boolean {
  if (!t.date) return false;
  return t.date <= refDate && refDate <= todoEndDate(t)!;
}

/** 오늘 기준 "늦음" (종료 < 오늘 AND 미완료). */
export function isTodoLate(t: Pick<Todo, 'date' | 'endDate' | 'status'>, todayStr: string): boolean {
  return deriveTodoPhase(t, todayStr) === 'late';
}

/**
 * "N일째" — 기간 시작일부터 오늘까지의 경과일(+1). 시작 당일=1.
 * 기존 started_date(수동 진행중 앵커) 대신 date=시작일에서 파생한다.
 * 시작 전이면 0.
 */
export function todoRunningDays(t: Pick<Todo, 'date'>, todayStr: string): number {
  if (!t.date || todayStr < t.date) return 0;
  return differenceInCalendarDays(parseISO(todayStr), parseISO(t.date)) + 1;
}
