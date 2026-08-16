import type { Todo } from '../app/store';

/**
 * 할일 완료/미완료 토글 시 적용할 updateTodo 패치를 계산한다 (캘린더·주간 타임라인 공유).
 *
 * 원칙: **완료 체크는 상태만 바꾼다.** 실적(DO) 시간은 명시적 행위로만 기록한다
 * (DO 드래그 / 타이머 완주 / 수동 입력). 이미 기록된 DO 시간은 토글로 건드리지 않는다
 * (완료↔미완료를 오가도 실측 기록은 보존).
 *
 * (과거: 완료 시 PLAN을 DO로 복사하거나 "현재 시각 +30분"을 자동 부여했다. 이는 실측이
 *  아닌 조작값을 만들어 시간 집계를 왜곡시켰다 — "즉시 끝나는 일에도 30분"이 잡히는 버그.
 *  "완료했는데 0분" 문제는 리뷰의 건수(件) 축이 해결하므로 시간을 지어낼 이유가 없다.)
 */
export function buildTodoToggleUpdate(todo: Todo): Partial<Todo> {
  return { status: todo.status === 'done' ? 'active' : 'done' };
}
