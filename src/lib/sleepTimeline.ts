// 수면 블록을 타임라인 윈도우에 배치하는 공용 유틸.
// 타임라인 시작 시각(dayStartHour)이 0보다 클 때, 그보다 이른 새벽 시각은
// 위치 계산이 음수가 되어 잘리던 문제를 해결한다(새벽 시각을 아래로 감싸기).

export interface SleepRect {
  /** 픽셀 top = offsetMin * pxPerMin */
  offsetMin: number;
  /** 픽셀 height = lengthMin * pxPerMin */
  lengthMin: number;
  /** 세그먼트의 자연 시작점을 포함하는 사각형(드래그/리사이즈·라벨 기준) */
  primary: boolean;
}

/**
 * 클럭 구간 [startMin, endMin] (0 <= startMin < endMin <= 1440)을
 * 타임라인 윈도우 [startHour*60, endHour*60] (endHour는 24 초과 가능)에 매핑한다.
 * +0 / +1440 두 시프트를 검사해 새벽 시각을 타임라인 아래쪽으로 감싸고,
 * endHour를 넘는 부분은 클립한다. 0~2개의 사각형을 반환한다.
 */
export function placeSleepSegment(
  startMin: number,
  endMin: number,
  startHour: number,
  endHour: number,
): SleepRect[] {
  const W0 = startHour * 60;
  const W1 = endHour * 60;
  const out: SleepRect[] = [];
  for (const shift of [0, 1440]) {
    const lo = Math.max(startMin + shift, W0);
    const hi = Math.min(endMin + shift, W1);
    if (hi > lo) out.push({ offsetMin: lo - W0, lengthMin: hi - lo, primary: shift === 0 });
  }
  // primary가 하나도 없으면(시프트된 사각형만 보이는 경우) 첫 사각형을 primary로 승격
  if (out.length && !out.some(r => r.primary)) out[0].primary = true;
  return out;
}
