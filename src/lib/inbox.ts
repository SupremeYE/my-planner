import type { Todo } from '../app/store';
import { isVirtualTodoId } from './recurrenceExpansion';

/**
 * Inbox 표시 대상 판정 — 날짜 미지정 + backlog/cancelled 제외.
 * (backlog 는 BacklogView 소관, 가상 반복 인스턴스는 날짜가 있으므로 자연히 제외)
 */
export const isInboxCandidate = (t: Todo) =>
  t.date === null && t.status !== 'backlog' && t.status !== 'cancelled' && !isVirtualTodoId(t.id);

/**
 * 사이드바/네비 배지용 미정리 개수 = 날짜 미지정 + 미완료(active 등) 항목 수.
 * 할일 페이지 "미분류" 섹션의 항목 수와 동일하게 맞춘다(done 은 제외).
 */
export const countInboxActive = (todos: Todo[]): number =>
  todos.filter(t => isInboxCandidate(t) && t.status !== 'done').length;
