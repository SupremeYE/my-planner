/**
 * 공용 반복 엔진 (Unified recurrence engine)
 * ------------------------------------------------------------------
 * 할일(Todo)과 일정(Event)이 각자 갖고 있던 두 개의 반복 시스템을
 * 하나의 RRULE 유사 스펙(RecurrenceSpec) + 단일 확장 로직으로 통합한다.
 *
 * 지원 규칙(iOS 미리알림 수준):
 *   매일 / 평일 / 주말 / 매주 특정요일(다중) / 매월 / 매년 / N(일·주·월·년)마다
 *
 * 설계 잠금(Stage 0 승인):
 *  - 주 앵커: interval>1(격주 등)은 "시리즈 시작일이 속한 주"를 기준으로 계산.
 *            주 시작 = 일요일(앱의 getDay 규약, 0=일).
 *  - 월간/연간: 하루씩 순회가 아니라 addMonths/addYears 앵커-스텝으로 확장.
 *  - 말일 정책: 없는 날(2월 31일, 평년 2/29 등)은 clamp 하지 않고 "건너뛴다"(skip, iOS식).
 *  - 레거시 하위호환: 기존 컬럼(recurrenceRule / repeatType)은 삭제하지 않고
 *            dual-read 로 RecurrenceSpec 으로 정규화한다.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDate,
  getDay,
  getMonth,
  getYear,
  isAfter,
  isBefore,
  parseISO,
  startOfWeek,
} from 'date-fns';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurrencePreset = 'weekday' | 'weekend';

/** RRULE 유사 통합 반복 스펙 */
export interface RecurrenceSpec {
  freq: RecurrenceFreq;
  /** N — 매 N 주기마다. 1 이상. */
  interval: number;
  /** 0=일 ~ 6=토. freq='weekly' 전용(요일 다중). 비면 시작일 요일 1개로 간주. */
  byday?: number[];
  /** UI 편의 라벨. 저장/확장 시 byday 로 정규화됨. */
  preset?: RecurrencePreset;
  /** yyyy-MM-dd. null/undefined 이면 무기한. */
  endDate?: string | null;
}

/** 평일(월~금) / 주말(토·일) 프리셋의 요일 집합 */
export const WEEKDAY_BYDAY = [1, 2, 3, 4, 5];
export const WEEKEND_BYDAY = [0, 6];

/** 폭주 방지용 시리즈당 최대 인스턴스 수 (렌더 범위가 항상 유한하므로 안전망) */
const MAX_INSTANCES = 2000;

export function presetToByday(preset: RecurrencePreset): number[] {
  return preset === 'weekday' ? [...WEEKDAY_BYDAY] : [...WEEKEND_BYDAY];
}

/** interval 을 1 이상 정수로 정규화 */
function normInterval(n: number | undefined | null): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 1 ? v : 1;
}

/**
 * freq/interval/byday/preset 로부터 표준 RecurrenceSpec 을 만든다.
 * preset 이 있으면 byday 로 정규화한다.
 */
export function buildSpec(input: {
  freq: RecurrenceFreq;
  interval?: number;
  byday?: number[];
  preset?: RecurrencePreset;
  endDate?: string | null;
}): RecurrenceSpec {
  const interval = normInterval(input.interval);
  let byday = input.byday;
  if (input.preset) byday = presetToByday(input.preset);
  const spec: RecurrenceSpec = { freq: input.freq, interval };
  if (input.freq === 'weekly' && byday && byday.length) spec.byday = [...new Set(byday)].sort((a, b) => a - b);
  if (input.preset) spec.preset = input.preset;
  if (input.endDate) spec.endDate = input.endDate;
  return spec;
}

// ── 레거시 → RecurrenceSpec 정규화 (dual-read) ───────────────────────────────

/** 할일 레거시 규칙 → RecurrenceSpec (없으면 null) */
export function legacyTodoToSpec(
  rule: 'daily' | 'weekly' | 'weekdays' | 'custom' | null | undefined,
  days: number[] | undefined,
  endDate: string | null | undefined,
  origin: Date,
): RecurrenceSpec | null {
  switch (rule) {
    case 'daily':
      return buildSpec({ freq: 'daily', interval: 1, endDate });
    case 'weekly':
      return buildSpec({ freq: 'weekly', interval: 1, byday: [getDay(origin)], endDate });
    case 'weekdays':
      return buildSpec({ freq: 'weekly', interval: 1, preset: 'weekday', endDate });
    case 'custom':
      return buildSpec({ freq: 'weekly', interval: 1, byday: days ?? [], endDate });
    default:
      return null;
  }
}

/** 일정 레거시 규칙 → RecurrenceSpec (없으면 null) */
export function legacyEventToSpec(
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | null | undefined,
  endDate: string | null | undefined,
  origin: Date,
): RecurrenceSpec | null {
  switch (repeatType) {
    case 'daily':
      return buildSpec({ freq: 'daily', interval: 1, endDate });
    case 'weekly':
      return buildSpec({ freq: 'weekly', interval: 1, byday: [getDay(origin)], endDate });
    case 'monthly':
      return buildSpec({ freq: 'monthly', interval: 1, endDate });
    default:
      return null;
  }
}

// ── 확장 (expansion) ─────────────────────────────────────────────────────────

/** 일요일 시작 주의 시작일 */
function weekStartSun(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 0 });
}

/** daily / weekly 한 날짜가 스펙에 맞는지 (origin 이후 & 주기/요일 일치) */
function matchesDailyWeekly(spec: RecurrenceSpec, origin: Date, cur: Date): boolean {
  const diffDays = differenceInCalendarDays(cur, origin);
  if (diffDays < 0) return false;

  if (spec.freq === 'daily') {
    return diffDays % spec.interval === 0;
  }

  // weekly
  const byday = spec.byday && spec.byday.length ? spec.byday : [getDay(origin)];
  if (!byday.includes(getDay(cur))) return false;
  const anchorWeek = weekStartSun(origin);
  const curWeek = weekStartSun(cur);
  const weeks = differenceInCalendarDays(curWeek, anchorWeek) / 7;
  return weeks >= 0 && weeks % spec.interval === 0;
}

/**
 * 반복 스펙을 [rangeStart, rangeEnd] 구간에서 확장해 'yyyy-MM-dd' 날짜 문자열 배열을 반환한다.
 * - origin: 시리즈 시작일(첫 인스턴스 기준). 이 날짜 이전은 절대 생성하지 않는다.
 * - spec.endDate 가 있으면 그 날짜까지만.
 * - 없는 날(2월 31일, 평년 2/29 등)은 건너뛴다(skip).
 */
export function expandRecurrenceDates(
  spec: RecurrenceSpec,
  origin: Date,
  rangeStart: Date,
  rangeEnd: Date,
): string[] {
  // 유효 종료: rangeEnd 와 spec.endDate 중 이른 쪽
  let effectiveHi = rangeEnd;
  if (spec.endDate) {
    const specEnd = parseISO(spec.endDate);
    if (isBefore(specEnd, effectiveHi)) effectiveHi = specEnd;
  }
  // 유효 시작: rangeStart 와 origin 중 늦은 쪽(시리즈 시작 이전 금지)
  const effectiveLo = isAfter(rangeStart, origin) ? rangeStart : origin;
  if (isAfter(effectiveLo, effectiveHi)) return [];

  const out: string[] = [];
  const push = (d: Date) => {
    if (!isBefore(d, effectiveLo) && !isAfter(d, effectiveHi)) out.push(format(d, 'yyyy-MM-dd'));
  };

  if (spec.freq === 'daily' || spec.freq === 'weekly') {
    let cur = effectiveLo;
    let guard = 0;
    while (!isAfter(cur, effectiveHi) && guard < MAX_INSTANCES * 8) {
      if (matchesDailyWeekly(spec, origin, cur)) push(cur);
      cur = addDays(cur, 1);
      guard++;
    }
    return out;
  }

  if (spec.freq === 'monthly') {
    const targetDom = getDate(origin);
    for (let k = 0; k < MAX_INSTANCES; k++) {
      const base = addMonths(origin, k * spec.interval);
      const y = getYear(base);
      const m = getMonth(base);
      // 이 달 1일이 유효 종료를 넘으면 종료
      if (isAfter(new Date(y, m, 1), effectiveHi)) break;
      const cand = new Date(y, m, targetDom);
      // targetDom 이 존재하지 않는 달은 getDate 가 롤오버되어 달라짐 → skip
      if (getDate(cand) === targetDom) push(cand);
    }
    return out;
  }

  // yearly
  const tm = getMonth(origin);
  const td = getDate(origin);
  const y0 = getYear(origin);
  for (let k = 0; k < MAX_INSTANCES; k++) {
    const y = y0 + k * spec.interval;
    if (isAfter(new Date(y, 0, 1), effectiveHi)) break;
    const cand = new Date(y, tm, td);
    // 평년 2/29 처럼 없는 날은 skip
    if (getDate(cand) === td && getMonth(cand) === tm) push(cand);
  }
  return out;
}

// ── UI 보조 ──────────────────────────────────────────────────────────────────

/**
 * 월간 반복이 시작일 때문에 일부 달을 건너뛰는지 여부.
 * (29~31일 시작 → 해당 일이 없는 달은 건너뜀 → 안내 문구 노출용)
 */
export function monthlySkipsSomeMonths(origin: Date): boolean {
  return getDate(origin) >= 29;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 스펙을 한국어 라벨로 요약 (예: "격주 화·목", "3일마다", "매월 15일") */
export function describeRecurrence(spec: RecurrenceSpec, origin: Date): string {
  const n = spec.interval;
  switch (spec.freq) {
    case 'daily':
      return n === 1 ? '매일' : `${n}일마다`;
    case 'weekly': {
      if (spec.preset === 'weekday') return '평일(월~금)';
      if (spec.preset === 'weekend') return '주말(토·일)';
      const byday = spec.byday && spec.byday.length ? spec.byday : [getDay(origin)];
      const label = byday.map(d => DOW[d]).join('·');
      return n === 1 ? `매주 ${label}` : `${n}주마다 ${label}`;
    }
    case 'monthly':
      return n === 1 ? `매월 ${getDate(origin)}일` : `${n}개월마다 ${getDate(origin)}일`;
    case 'yearly':
      return n === 1
        ? `매년 ${getMonth(origin) + 1}월 ${getDate(origin)}일`
        : `${n}년마다 ${getMonth(origin) + 1}월 ${getDate(origin)}일`;
  }
}
