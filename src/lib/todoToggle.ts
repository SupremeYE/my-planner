import { addMinutes, format } from 'date-fns';
import type { Todo } from '../app/store';

/**
 * 할일 완료/미완료 토글 시 적용할 updateTodo 패치를 계산한다 (캘린더·주간 타임라인 공유).
 * 완료 처리 시 실적(DO) 시간을 채워 "0분 완료"로 통계가 왜곡되는 것을 막는다.
 *  1) 이미 DO 기록이 있으면 그대로 완료
 *  2) PLAN이 있으면 PLAN을 DO로 복사 (소요 초 포함)
 *  3) 둘 다 없으면 현재 시각 기준 30분 블록
 * 되돌리기(done→active)는 자동 채워진 DO 시간까지 정리한다.
 *
 * NOTE: 일간 타임라인 체크(handleTodoCheckboxAction)는 진행 중 타이머 정지 분기가
 * 추가로 필요하고 DO 시간을 보존하므로 의도적으로 별도 유지한다.
 */
export function buildTodoToggleUpdate(todo: Todo): Partial<Todo> {
  if (todo.status === 'done') {
    return { status: 'active', doStart: undefined, doEnd: undefined, doElapsedSec: undefined };
  }
  if (todo.doStart && todo.doEnd) {
    return { status: 'done' };
  }
  if (todo.planStart && todo.planEnd) {
    const [sh, sm] = todo.planStart.split(':').map(Number);
    const [eh, em] = todo.planEnd.split(':').map(Number);
    const durSec = Math.max(0, (eh * 60 + em - (sh * 60 + sm)) * 60);
    return { status: 'done', doStart: todo.planStart, doEnd: todo.planEnd, doElapsedSec: durSec };
  }
  const s = format(new Date(), 'HH:mm');
  const e = format(addMinutes(new Date(), 30), 'HH:mm');
  return { status: 'done', doStart: s, doEnd: e, doElapsedSec: 1800 };
}
