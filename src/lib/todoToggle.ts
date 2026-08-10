import type { Todo } from '../app/store';

/**
 * 할일 완료/미완료 토글 시 적용할 updateTodo 패치를 계산한다 (캘린더·주간 타임라인 공유).
 *
 * **완료는 상태(status)만 바꾼다. 실적(DO) 시간을 자동으로 채우지 않는다.**
 * (구버전은 PLAN 복사·현재시각 30분 블록을 자동 부여했으나, 이는 "완료했으니 30분 걸렸을 것"이라는
 *  추측을 실측처럼 저장해 시간 집계를 오염시켰다. 시간 기록은 오직 명시적 행위 — DO 드래그 /
 *  타이머 완주 / 수동 입력 / "계획대로 함" 버튼 — 로만 남긴다.)
 * "완료했는데 0분" 문제는 시간 축이 아니라 건수 축(timeAggregation)이 해결한다.
 *
 * 되돌리기(done→active)도 상태만 되돌린다. DO는 명시적 기록이므로 지우지 않는다.
 *
 * NOTE: 일간 타임라인 체크(handleTodoCheckboxAction)는 진행 중 타이머 정지 분기가
 * 추가로 필요하므로 의도적으로 별도 유지한다.
 */
export function buildTodoToggleUpdate(todo: Todo): Partial<Todo> {
  return { status: todo.status === 'done' ? 'active' : 'done' };
}
