import type { SelfCareRecord } from '../app/store';

// 수면 블록을 "절대 시간축" 기준으로 각 날짜 컬럼의 타임라인 윈도우에 배치하는 공용 유틸.
//
// 타임라인 시작 시각(dayStartHour)이 0보다 크면(예: 04:00 시작, 02:00 다음날 종료=endHour 26)
// 한 날짜 컬럼이 다음날 새벽까지 포함한다. 따라서 한 수면(예: 00:30~07:27)이
// 두 날짜 컬럼에 걸쳐 표시되어야 한다.
//   - 00:30~02:00 → 전날 컬럼 아래쪽(24:30~26:00 위치)
//   - 04:00~07:27 → 당일 컬럼 위쪽(04:00~07:27)
// (설정상 02:00~04:00 구간은 타임라인에 없으므로 컬럼 사이에서 자연히 빠진다.)

export interface SleepColumnRect {
  record: SelfCareRecord;
  /** 렌더 top = offsetMin * pxPerMin (컬럼 시작 시각 기준) */
  offsetMin: number;
  /** 렌더 height = lengthMin * pxPerMin */
  lengthMin: number;
  /** 이 조각이 취침 시작(instant)을 포함하는가 — DailyView 드래그/리사이즈 기준 */
  isStart: boolean;
  /** 수면 총 길이(분) — 라벨용 */
  totalMin: number;
  /** 클립 전 구간 시작(컬럼 자정 기준, 분) — 드래그 origin */
  naturalStartMin: number;
  /** 클립 전 구간 끝(컬럼 자정 기준, 분) — 드래그 origin */
  naturalEndMin: number;
}

function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * 한 날짜 컬럼(columnDateStr)의 타임라인 윈도우 [startHour, endHour]에
 * 표시할 수면 사각형들을 반환한다. endHour는 24를 초과할 수 있다(예: 26 = 02:00 다음날).
 *
 * columnDate 전날(-1)·당일(0)·다음날(+1)에 기록된 수면을 절대 시간축으로 환산해
 * 윈도우와 교차하는 부분만 컬럼 좌표로 변환한다. (자정 넘김은 endHour+1440 처리)
 */
export function sleepRectsForColumn(
  columnDateStr: string,
  records: SelfCareRecord[],
  startHour: number,
  endHour: number,
): SleepColumnRect[] {
  const W0 = startHour * 60;
  const W1 = endHour * 60;
  const out: SleepColumnRect[] = [];

  for (const offsetDays of [-1, 0, 1]) {
    const recDate = shiftDateStr(columnDateStr, offsetDays);
    for (const r of records) {
      if (r.category !== 'sleep' || r.date !== recDate || !r.sleepStart || !r.sleepEnd) continue;

      const [sh, sm] = r.sleepStart.split(':').map(Number);
      const [eh, em] = r.sleepEnd.split(':').map(Number);
      const s = sh * 60 + sm;
      const eRaw = eh * 60 + em;
      const e = eRaw <= s ? eRaw + 1440 : eRaw; // 자정 넘김
      const total = e - s;

      // recDate 자정은 columnDate 자정 기준 offsetDays*1440 만큼 떨어져 있다.
      const intervalStart = offsetDays * 1440 + s;
      const intervalEnd = offsetDays * 1440 + e;

      const lo = Math.max(intervalStart, W0);
      const hi = Math.min(intervalEnd, W1);
      if (hi > lo) {
        out.push({
          record: r,
          offsetMin: lo - W0,
          lengthMin: hi - lo,
          isStart: intervalStart >= W0, // 취침 시작이 이 컬럼 윈도우 안에서 시작
          totalMin: total,
          naturalStartMin: intervalStart,
          naturalEndMin: intervalEnd,
        });
      }
    }
  }

  return out;
}
