import { addDays, format, getDay, isBefore, startOfDay } from 'date-fns';
import { DOW_LABELS } from './recurrenceExpansion';

/**
 * 통합 빠른 입력 — 자연어 한 줄 파서 (UI·store 무관 순수 함수)
 *
 * 텍스트 한 줄을 받아 구조화된 {@link ParsedEntry} 로 변환만 한다.
 * 호출부(다음 Stage)에서 이 결과를 기존 `addTodo({...changes, status:'active'})`
 * 또는 `addEvent(payload)` 페이로드로 매핑한다. 데이터 모델은 변경하지 않는다.
 *
 * 인식 토큰
 * - 태그       #케어        → tags[]
 * - 프로젝트   @하온        → projectName (id 매칭은 호출부에서)
 * - 중요       단독/선두 !  → isTop3
 * - 반복       매일/평일/매주 [요일]
 * - 날짜       오늘/내일/모레/[요일]요일/M/D/M.D/M월 D일
 * - 시간       (오전|오후)? N시 (반|N분)? / HH:MM / N-N시(범위)
 *
 * 날짜·시간 분기
 * - 날짜 토큰이 있으면 그 날짜
 * - 날짜 없고 시간만 있으면 오늘
 * - 둘 다 없으면 date = null (= Inbox)
 *
 * 반복 시작일(TodoModal 정합)
 * - TodoModal 의 `weekly` 반복은 **시작 날짜(date)의 요일**을 기준으로 확장된다
 *   (`recurrenceExpansion`: weekly → dow === getDay(parent.date)).
 *   그래서 "매주 월"처럼 명시 날짜가 없으면 date 를 **다가오는 해당 요일**로 맞춰
 *   호출부가 그대로 저장해도 weekly 가 올바르게 확장되도록 한다.
 * - daily/weekday 는 명시 날짜가 없으면 시작일을 오늘로 둔다.
 */
export interface ParsedEntry {
  /** 토큰 제거 후 남은 본문. 비면 '(제목 없음)' */
  title: string;
  /** 'YYYY-MM-DD' (없으면 null = Inbox) */
  date: string | null;
  hasTime: boolean;
  /** 'HH:MM' */
  startTime?: string;
  /** 'HH:MM' (범위 입력 시) */
  endTime?: string;
  /**
   * 파서 중간 표현. 호출부에서 Todo 모델로 매핑한다:
   * 'weekday' → Todo.recurrenceRule 'weekdays',
   * recurrenceDays(한글 라벨) → custom 의 number[] (필요 시 {@link dowLabelToNumber}).
   */
  recurrenceRule: 'daily' | 'weekly' | 'weekday' | null;
  /** 매주 [요일] 의 한글 요일 라벨. 예: ['월'] (v2에서 다중 요일 지원) */
  recurrenceDays: string[];
  /** # 토큰 (복수 허용) */
  tags: string[];
  /** @ 토큰 원문 (첫 매치). id 매칭은 호출부에서 */
  projectName: string | null;
  /** 단독/선두 '!' 토큰 */
  isTop3: boolean;
  /**
   * 문장 맨 앞 키워드 프리픽스로 지정된 타입 힌트.
   * '일정 ...' → 'event', '할일 ...' → 'todo', 없으면 null.
   * 호출부에서 타입 결정 우선순위(수동 탭 > 프리픽스 > 기본 할일)에 사용한다.
   */
  typeHint?: 'event' | 'todo' | null;
}

/** 한글 요일 라벨 → getDay 숫자 (0=일). 호출부에서 custom recurrenceDays 변환용 */
export function dowLabelToNumber(label: string): number {
  return DOW_LABELS.indexOf(label);
}

function fmt(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** now(포함)부터 가장 가까운 targetDow 요일의 날짜 */
function nextWeekday(now: Date, targetDow: number): Date {
  const offset = (targetDow - getDay(now) + 7) % 7; // 0 = 오늘
  return addDays(startOfDay(now), offset);
}

/** 올해 M월 D일. 이미 지났으면 내년으로 굴린다(플래너 기본 동작) */
function resolveMonthDay(now: Date, month: number, day: number): string {
  const year = now.getFullYear();
  let d = new Date(year, month - 1, day);
  if (isBefore(startOfDay(d), startOfDay(now))) d = new Date(year + 1, month - 1, day);
  return fmt(d);
}

function hourTo24(hour: number, meridiem?: string): number {
  if (meridiem === '오후') return hour < 12 ? hour + 12 : hour;
  if (meridiem === '오전') return hour === 12 ? 0 : hour;
  return hour;
}

export function parseQuickEntry(input: string, now: Date = new Date()): ParsedEntry {
  let working = input ?? '';
  const today = startOfDay(now);

  // ── 타입 프리픽스 (맨 앞 '일정 '/'할일 ', 나머지 파싱보다 먼저 strip) ──────────
  // '일정 내일 10시 미팅' → typeHint 'event' + '내일 10시 미팅' 로 이어서 파싱.
  // 공백 구분자 필수: '일정'/'할일' 단독이거나 '일정미팅'처럼 붙으면 프리픽스가 아니라 제목이다.
  let typeHint: ParsedEntry['typeHint'] = null;
  working = working.replace(/^\s*(일정|할일)\s+/, (_, kw: string) => {
    typeHint = kw === '일정' ? 'event' : 'todo';
    return '';
  });

  // ── 태그 (#케어, 복수) ──────────────────────────────────────────────────
  const tags: string[] = [];
  working = working.replace(/#([^\s#@!]+)/g, (_, tag: string) => {
    tags.push(tag);
    return ' ';
  });

  // ── 프로젝트 (@하온, 첫 매치만) ──────────────────────────────────────────
  let projectName: string | null = null;
  working = working.replace(/@([^\s#@!]+)/, (_, p: string) => {
    projectName = p;
    return ' ';
  });

  // ── 반복 (날짜/시간보다 먼저: "매주 월요일"이 날짜로 오인되지 않게) ────────
  let recurrenceRule: ParsedEntry['recurrenceRule'] = null;
  const recurrenceDays: string[] = [];
  working = working.replace(/매주\s*([일월화수목금토])(?:요일)?/, (_, d: string) => {
    recurrenceRule = 'weekly';
    recurrenceDays.push(d);
    return ' ';
  });
  if (recurrenceRule === null) {
    if (/매일/.test(working)) {
      recurrenceRule = 'daily';
      working = working.replace(/매일/, ' ');
    } else if (/평일/.test(working)) {
      recurrenceRule = 'weekday';
      working = working.replace(/평일/, ' ');
    }
  }

  // ── 날짜 ────────────────────────────────────────────────────────────────
  let dateFromToken: string | null = null;
  if (/오늘/.test(working)) {
    dateFromToken = fmt(today);
    working = working.replace(/오늘/, ' ');
  } else if (/모레/.test(working)) {
    dateFromToken = fmt(addDays(today, 2));
    working = working.replace(/모레/, ' ');
  } else if (/내일/.test(working)) {
    dateFromToken = fmt(addDays(today, 1));
    working = working.replace(/내일/, ' ');
  }
  if (!dateFromToken) {
    const m = working.match(/([일월화수목금토])요일/);
    if (m) {
      dateFromToken = fmt(nextWeekday(today, DOW_LABELS.indexOf(m[1])));
      working = working.replace(m[0], ' ');
    }
  }
  if (!dateFromToken) {
    const m = working.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (m) {
      dateFromToken = resolveMonthDay(now, +m[1], +m[2]);
      working = working.replace(m[0], ' ');
    }
  }
  if (!dateFromToken) {
    const m = working.match(/(\d{1,2})\/(\d{1,2})/);
    if (m) {
      dateFromToken = resolveMonthDay(now, +m[1], +m[2]);
      working = working.replace(m[0], ' ');
    }
  }
  if (!dateFromToken) {
    const m = working.match(/(\d{1,2})\.(\d{1,2})/);
    if (m) {
      dateFromToken = resolveMonthDay(now, +m[1], +m[2]);
      working = working.replace(m[0], ' ');
    }
  }

  // ── 시간 ────────────────────────────────────────────────────────────────
  let hasTime = false;
  let startTime: string | undefined;
  let endTime: string | undefined;

  // 범위: (오전|오후)? N-N시
  let tm = working.match(/(오전|오후)?\s*(\d{1,2})\s*[-~]\s*(\d{1,2})\s*시(?!간)/);
  if (tm) {
    const mer = tm[1];
    startTime = `${pad(hourTo24(+tm[2], mer))}:00`;
    endTime = `${pad(hourTo24(+tm[3], mer))}:00`;
    hasTime = true;
    working = working.replace(tm[0], ' ');
  }
  // 단일: (오전|오후)? N시 (반|N분)?
  if (!hasTime) {
    tm = working.match(/(오전|오후)?\s*(\d{1,2})\s*시(?!간)\s*(?:(반)|(\d{1,2})\s*분)?/);
    if (tm) {
      const h = hourTo24(+tm[2], tm[1]);
      let min = 0;
      if (tm[3] === '반') min = 30;
      else if (tm[4]) min = +tm[4];
      startTime = `${pad(h)}:${pad(min)}`;
      hasTime = true;
      working = working.replace(tm[0], ' ');
    }
  }
  // HH:MM
  if (!hasTime) {
    tm = working.match(/(\d{1,2}):(\d{2})/);
    if (tm) {
      startTime = `${pad(+tm[1])}:${pad(+tm[2])}`;
      hasTime = true;
      working = working.replace(tm[0], ' ');
    }
  }

  // ── 중요: 단독('운동 !') 또는 선두('!보고서') '!' 토큰 ────────────────────
  let isTop3 = false;
  if (/(^|\s)!/.test(working)) {
    isTop3 = true;
    working = working.replace(/(^|\s)!/g, '$1');
  }

  // ── 제목 ────────────────────────────────────────────────────────────────
  const title = working.replace(/\s+/g, ' ').trim() || '(제목 없음)';

  // ── 날짜 최종 분기 ────────────────────────────────────────────────────────
  let date: string | null;
  if (dateFromToken) {
    date = dateFromToken;
  } else if (recurrenceRule === 'weekly' && recurrenceDays.length) {
    date = fmt(nextWeekday(today, DOW_LABELS.indexOf(recurrenceDays[0])));
  } else if (recurrenceRule === 'daily' || recurrenceRule === 'weekday') {
    date = fmt(today);
  } else if (hasTime) {
    date = fmt(today);
  } else {
    date = null;
  }

  return {
    title,
    date,
    hasTime,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    recurrenceRule,
    recurrenceDays,
    tags,
    projectName,
    isTop3,
    typeHint,
  };
}
