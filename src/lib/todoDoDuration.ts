import type { Todo } from '../app/store';

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
