/**
 * 시간 블록(todo_time_blocks) 집계 헬퍼 (Stage 3 — 누적).
 *
 * dual-read 원칙:
 *  - 신규 세션은 블록(todo_time_blocks)으로 적재된다.
 *  - 블록이 없는 레거시/단순 케이스는 todos 행의 do_* 컬럼으로 계속 읽는다.
 *  - 같은 (todo, date)에 블록이 하나라도 있으면 그 날의 do_* 는 무시(이중 집계 방지).
 */
import type { Todo, TodoTimeBlock } from '../app/store';
import { todoDoDurationSeconds } from './todoDoDuration';

/** 블록 1개의 소요(초). elapsedSec 우선, 없으면 start~end 분 차이. */
export function blockDurationSec(b: TodoTimeBlock): number {
  if (b.elapsedSec != null && b.elapsedSec > 0) return b.elapsedSec;
  if (!b.start || !b.end) return Math.max(0, b.elapsedSec ?? 0);
  const [sh, sm] = b.start.split(':').map(Number);
  const [eh, em] = b.end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) * 60);
}

/** 특정 날짜의 블록만 */
export function blocksForDate(blocks: TodoTimeBlock[], date: string): TodoTimeBlock[] {
  return blocks.filter(b => b.date === date);
}

/** 특정 할일의 누적 시간(초) — 모든 블록 합. 블록이 없으면 do_* 폴백. */
export function totalElapsedForTodo(blocks: TodoTimeBlock[], todo: Todo): number {
  const own = blocks.filter(b => b.todoId === todo.id);
  if (own.length > 0) return own.reduce((s, b) => s + blockDurationSec(b), 0);
  return todoDoDurationSeconds(todo);
}

/** 특정 할일이 특정 날짜에 블록을 갖는지 */
function todoHasBlockOnDate(blocks: TodoTimeBlock[], todoId: string, date: string): boolean {
  return blocks.some(b => b.todoId === todoId && b.date === date);
}

/**
 * 특정 날짜의 총 DO 초 (dual-read).
 * = 그 날짜 블록 합 + (그 날짜 예정 할일 중 그 날 블록이 없는 do_* 레거시 합)
 */
export function dateDoSeconds(blocks: TodoTimeBlock[], todosOnDate: Todo[], date: string): number {
  const blockSum = blocksForDate(blocks, date).reduce((s, b) => s + blockDurationSec(b), 0);
  const legacySum = todosOnDate
    .filter(td => td.doStart && td.doEnd && !todoHasBlockOnDate(blocks, td.id, date))
    .reduce((s, td) => s + todoDoDurationSeconds(td), 0);
  return blockSum + legacySum;
}

/**
 * 시간 리포트용: 태그별(또는 프로젝트별) 누적 시간 집계.
 * keyOf 로 그룹 키를 뽑는다(예: 첫 태그 id, projectId). null 키는 '미분류'.
 */
export function elapsedByKey(
  blocks: TodoTimeBlock[],
  todosInRange: Todo[],
  keyOf: (todo: Todo) => string | null,
): Map<string, number> {
  const todoById = new Map(todosInRange.map(t => [t.id, t]));
  const out = new Map<string, number>();
  const add = (key: string | null, sec: number) => {
    if (sec <= 0) return;
    const k = key ?? '__none__';
    out.set(k, (out.get(k) ?? 0) + sec);
  };
  const countedByDate = new Set<string>(); // `${todoId}|${date}` — 블록 집계된 것
  for (const b of blocks) {
    const todo = todoById.get(b.todoId);
    if (!todo) continue;
    add(keyOf(todo), blockDurationSec(b));
    countedByDate.add(`${b.todoId}|${b.date}`);
  }
  // 블록 없는 레거시 do_*
  for (const td of todosInRange) {
    if (!td.doStart || !td.doEnd || !td.date) continue;
    if (countedByDate.has(`${td.id}|${td.date}`)) continue;
    add(keyOf(td), todoDoDurationSeconds(td));
  }
  return out;
}
