import type { Todo, TodoStatus } from '../app/store';

/**
 * 완료 시각 마커 판별 — DO 구간 길이가 0(순간)인 "언제 했다"만 남긴 기록.
 * do_start = do_end 이고 소요(doElapsedSec)가 0. 타임라인 DO 레인에 블록이 아니라
 * 점+선 마커로 렌더되고, 시간 집계엔 0초로 잡혀 시간 축을 오염시키지 않는다(건수 축만).
 * (예전 자동 30분 버그와 다름: 그건 소요를 30분으로 '지어냈고', 이건 길이 0으로 '언제'만 기록.)
 */
export function isCompletionMarker(t: Pick<Todo, 'doStart' | 'doEnd' | 'doElapsedSec'>): boolean {
  return t.doElapsedSec === 0 && !!t.doStart && t.doStart === t.doEnd;
}

/**
 * 상태 전환에 따른 완료 시각 마커 패치.
 *  - → 'done' 인데 실적 DO 가 아직 없으면: do_start=do_end=완료시각, doElapsedSec=0 (길이 0 마커).
 *    이미 do_* 가 있으면(타이머·드래그·수동 입력) 실제 기록을 존중해 건드리지 않는다.
 *    date 없는(인박스) 할일은 타임라인에 자리가 없어 마커를 남기지 않는다.
 *  - 'done' 에서 벗어나는데 기존이 마커(길이 0)면: do_* 정리(실제 소요가 있으면 보존).
 *  - 그 외: 빈 패치.
 * "완료했는데 0분"은 시간을 지어내지 않고 건수(件) 축으로 해결한다는 원칙(§통계·비교)과 일치.
 */
export function completionMarkerPatch(
  todo: Pick<Todo, 'date' | 'status' | 'doStart' | 'doEnd' | 'doElapsedSec'>,
  nextStatus: TodoStatus,
  nowHHMM: string,
): Partial<Todo> {
  const wasDone = todo.status === 'done';
  const willBeDone = nextStatus === 'done';
  if (willBeDone && !wasDone) {
    if (!todo.date || todo.doStart || todo.doEnd) return {};
    return { doStart: nowHHMM, doEnd: nowHHMM, doElapsedSec: 0 };
  }
  if (wasDone && !willBeDone && isCompletionMarker(todo)) {
    return { doStart: undefined, doEnd: undefined, doElapsedSec: undefined };
  }
  return {};
}

/** DO 구간의 실제 소요 시간(초). 타이머 기록이 있으면 우선, 없으면 doStart~doEnd 분 단위 차이를 초로 환산 */
export function todoDoDurationSeconds(t: Pick<Todo, 'doStart' | 'doEnd' | 'doElapsedSec'>): number {
  if (!t.doStart || !t.doEnd) return 0;
  if (t.doElapsedSec != null && t.doElapsedSec >= 0) return t.doElapsedSec;
  const [sh, sm] = t.doStart.split(':').map(Number);
  const [eh, em] = t.doEnd.split(':').map(Number);
  const durMin = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, durMin * 60);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '(0s)';
  if (seconds < 60) return `(${seconds}s)`;

  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return `(${totalMinutes}m)`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `(${hours}h ${minutes}m)` : `(${hours}h)`;
}

export function formatDoElapsedKo(sec: number): string {
  if (sec <= 0) return '0초';
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

export function formatTotalDoKo(totalSec: number): string {
  if (totalSec <= 0) return '0초';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return s === 0 && m === 0 ? `${h}시간` : `${h}시간 ${m}분${s > 0 ? ` ${s}초` : ''}`;
  if (m > 0) return s === 0 ? `${m}분` : `${m}분 ${s}초`;
  return `${s}초`;
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** DO 소요(분)가 PLAN 소요(분)보다 길면 true. 타이머 기록 초가 있으면 막대 HH:mm 대신 사용 */
export function isDoOvertimeVsPlan(todo: Pick<Todo, 'planStart' | 'planEnd' | 'doStart' | 'doEnd' | 'doElapsedSec'>): boolean {
  if (!todo.planStart || !todo.planEnd || !todo.doStart || !todo.doEnd) return false;
  const planDur = hhmmToMin(todo.planEnd) - hhmmToMin(todo.planStart);
  const doDurMin =
    todo.doElapsedSec != null && todo.doElapsedSec >= 0
      ? todo.doElapsedSec / 60
      : hhmmToMin(todo.doEnd) - hhmmToMin(todo.doStart);
  return doDurMin > planDur;
}

/** 툴팁/상세용: DO HH:mm 줄 아래 실제 소요 표기 */
export function doElapsedTitleSuffix(todo: Pick<Todo, 'doElapsedSec'>): string {
  if (todo.doElapsedSec == null || todo.doElapsedSec < 0) return '';
  return `\n${formatDuration(todo.doElapsedSec)}`;
}

/** 한 줄 요약용 */
export function doElapsedInlineSuffix(todo: Pick<Todo, 'doElapsedSec'>): string {
  if (todo.doElapsedSec == null || todo.doElapsedSec < 0) return '';
  return ` ${formatDuration(todo.doElapsedSec)}`;
}
