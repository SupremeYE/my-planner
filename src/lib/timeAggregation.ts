/**
 * 태그 기반 활동 집계 — 단일 진실(single source of truth).
 *
 * 목적: 「시간 리포트」 페이지와 리뷰의 「시간 스트립(TrackTimeStrip)」이 **같은 함수**를
 * 호출하게 만들어, 두 화면이 구조적으로 같은 숫자를 낼 수밖에 없게 한다.
 * (이전에는 시간 리포트=할일 do_* / 스트립=이벤트 로 소스가 갈라져 서로 다른 답을 냈다.)
 *
 * 집계 소스(확정):
 *  - 할일 `do_start`/`do_end` (+ `todo_time_blocks` dual-read)  → 현재 유일한 실데이터
 *  - 이벤트 `doStart`/`doEnd` (실적만; startTime/endTime 계획은 제외)
 *  - 할일 `plan_*`                                               → **제외**(계획 ≠ 실제)
 *
 * 두 축을 함께 낸다:
 *  - 시간(minutes): "얼마나 오래" — 실행 시각을 기록한 것만 잡힌다
 *  - 건수(count):   "얼마나 자주" — 태그만 붙으면 모두 잡힌다(누락이 적어 더 정직)
 */
import { validSnapshot, type ActivityEntry, type ClassificationSnapshot } from './activityEntries';
import type { Todo, Tag, Event, TodoTimeBlock } from '../app/store';

// ───────────────────────── 튜닝 상수 (하드코딩 금지 · 단일 출처) ─────────────────────────

export type ActivityPeriod = 'week' | 'month';

/**
 * 공백 알림 기준(日). 마지막 기록이 이 일수 이상 지나면 "기록이 없어요" 문장을 만든다.
 *  - week : 주간 회고에서 한 주 이상 통째로 빈 게 드러나는 지점 → 14일(약 2주)
 *  - month: 월간 회고에서 3주 이상 비어야 유의미 → 21일(약 3주)
 * 값만 바꾸면 민감도가 조정된다(주간 1~2주 / 월간 3~4주 범위 내에서 선택).
 */
export const GAP_ALERT_DAYS: Record<ActivityPeriod, number> = { week: 14, month: 21 };

/**
 * 공백 알림을 낼 최소 이력(件). 전체 기간 기록이 이 미만인 태그는 "습관"으로 보기 어려워
 * 공백 문장에서 제외한다. (예: 뷰티케어 1건 → "N개월째 기록 없음"이 매번 떠서 곧 무시하게 되는
 * 노이즈 방지.) **제외는 '공백 문장'에 한정** — 시간 축·건수 축 분포에는 그대로 표시된다.
 */
export const GAP_MIN_HISTORY = 3;

/** 인사이트를 아예 만들지 않는 하한(件). 현재 기간의 태그 기록이 이 미만이면 억지 문장 대신 빈 상태. */
export const INSIGHT_MIN_RECORDS = 2;

/** 기간 대비 변화 문장을 낼 최소 건수 차이(件). */
export const COUNT_DELTA_THRESHOLD = 2;

/** 노출할 인사이트 문장 최대 줄 수. */
export const MAX_INSIGHTS = 3;

// ───────────────────────── 집계 ─────────────────────────

/** 한 태그의 기간 내 집계. minutes/timeItems=시간 축, count=건수 축(서로 다른 지표). */
export interface TagAgg {
  minutes: number;
  /** 시간에 기여한 기록(할일 do_·블록·이벤트 시각). 시간 리포트의 todoCount·상세 목록용. */
  timeItems: Array<{ name: string; minutes: number; date: string; kind: 'todo' | 'event' | 'activity' }>;
  /** 건수 축 — 태그가 붙은 기록 수(시간 유무 무관). 한 기록에 태그 N개면 각 태그에 +1. */
  count: number;
}

export interface RangeAggregation {
  byTag: Map<string, TagAgg>;
  /** 기존 화면과 호환: 시간추적 태그로 분류된 시간만. */
  totalMinutes: number;
  totalCount: number;
  coverage: ActivityCoverage;
  records: ActivityRecord[];
  tagMetadata: Map<string, { name: string; color: string }>;
}

export interface ActivityRecord extends TimeRecord {
  minutes: number;
  shares: Array<{ tagId: string; name: string; color: string; weight: number }>;
  classification: 'snapshot' | 'legacy' | 'invalid';
  start?: string;
  end?: string;
}

interface TimeRecord {
  id: string;
  name: string;
  date: string;
  kind: 'todo' | 'event' | 'block' | 'activity';
}

/** UI를 추가하지 않고도 집계에서 빠진 실적을 확인할 수 있는 진단 데이터. */
export interface ActivityCoverage {
  /** 분류된 시간 + 분류할 수 없는 시간. 계산 불가능한 구간은 제외. */
  recordedMinutes: number;
  unclassifiedMinutes: number;
  unclassifiedItems: Array<TimeRecord & {
    minutes: number;
    reason: 'untagged' | 'untracked-tags' | 'unknown-tags' | 'missing-todo' | 'invalid-snapshot';
  }>;
  unresolvedItems: Array<TimeRecord & {
    reason: 'invalid-time' | 'ambiguous-overnight' | 'legacy-date-ambiguous';
    /** The legacy duration is known, but cannot safely be added to dated blocks. */
    candidateMinutes?: number;
  }>;
}

function toMin(s?: string): number | null {
  if (!s || !/^\d{1,2}:[0-5]\d$/.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  // Preserve explicit extended-hour timeline records (e.g. 23:50–24:10).
  return h > 47 ? null : h * 60 + m;
}

/**
 * 기간(startStr~endStr, yyyy-MM-dd 비교)의 시간추적 태그별 집계.
 * 시간 축은 블록(작업일 기준) 우선 → 블록 없는 TODO만 do_* 폴백 + 일정 do_*.
 * 날짜 귀속은 저장된 date를 보존한다. HH:mm만 있는 역전 구간은 자정 통과인지 오류인지
 * 판별할 수 없으므로 추정하지 않고 unresolvedItems에 남긴다. 라이프 로그는 입력에 포함하지 않는다.
 * 건수 축은 태그 붙은 할일·이벤트를 각자의 date 기준으로 센다(시간 유무 무관).
 */
export function aggregateActivity(
  todos: Todo[],
  events: Event[],
  tags: Tag[],
  startStr: string,
  endStr: string,
  timeBlocks: TodoTimeBlock[] = [],
  activityEntries: ActivityEntry[] = [],
): RangeAggregation {
  const trackTagIds = new Set(tags.filter(t => t.trackTime).map(t => t.id));
  const tagIds = new Set(tags.map(t => t.id));
  const coverage: ActivityCoverage = {
    recordedMinutes: 0, unclassifiedMinutes: 0, unclassifiedItems: [], unresolvedItems: [],
  };
  const records: ActivityRecord[] = [];
  const tagMetadata = new Map<string, { name: string; color: string }>();
  const byTag = new Map<string, TagAgg>();
  const ensure = (id: string): TagAgg => {
    let e = byTag.get(id);
    if (!e) { e = { minutes: 0, timeItems: [], count: 0 }; byTag.set(id, e); }
    return e;
  };

  const duration = (
    record: TimeRecord, start?: string, end?: string, elapsed?: number, zeroIsDuration = true,
  ) => {
    if (elapsed != null) {
      if (!Number.isFinite(elapsed) || elapsed < 0) {
        coverage.unresolvedItems.push({ ...record, reason: 'invalid-time' });
        return 0;
      }
      // TODO completion markers: elapsed=0 is authoritative. Blocks use 0 as legacy fallback.
      if (elapsed > 0 || zeroIsDuration) return elapsed;
    }
    if (!start && !end) return 0; // No actual time was recorded (e.g. a planned-only event).
    const s = toMin(start); const e = toMin(end);
    if (s == null || e == null || e < s) {
      coverage.unresolvedItems.push({
        ...record, reason: s != null && e != null && e < s ? 'ambiguous-overnight' : 'invalid-time',
      });
      return 0;
    }
    return (e - s) * 60;
  };

  const addTime = (record: TimeRecord, recordTags: string[] | undefined, sec: number,
    snapshot?: ClassificationSnapshot | null, start?: string, end?: string) => {
    if (sec <= 0) return;
    coverage.recordedMinutes += sec / 60;
    const explicit = snapshot != null;
    const matched = [...new Set(recordTags ?? [])].filter(id => trackTagIds.has(id));
    const shares = explicit ? (validSnapshot(snapshot) ? snapshot.shares : []) : matched.map(id => {
      const tag = tags.find(t => t.id === id)!;
      return { tagId: id, name: tag.name, color: tag.color, weight: 1 / matched.length };
    });
    records.push({ ...record, minutes: sec / 60, shares, classification: explicit ? validSnapshot(snapshot) ? 'snapshot' : 'invalid' : 'legacy', start, end });
    if (!shares.length) {
      const reason = explicit && !validSnapshot(snapshot) ? 'invalid-snapshot'
        : record.kind === 'block' && recordTags === undefined && !explicit ? 'missing-todo'
        : explicit || !recordTags?.length ? 'untagged'
        : recordTags.some(id => tagIds.has(id)) ? 'untracked-tags' : 'unknown-tags';
      coverage.unclassifiedMinutes += sec / 60;
      coverage.unclassifiedItems.push({ ...record, minutes: sec / 60, reason });
      return;
    }
    for (const share of shares) {
      // Frozen name/color and allocation survive tag edits/deletion. Never rewrite old rows.
      if (explicit || !tagMetadata.has(share.tagId)) tagMetadata.set(share.tagId, { name: share.name, color: share.color });
      const e = ensure(share.tagId);
      const minutes = sec / 60 * share.weight;
      e.minutes += minutes;
      e.timeItems.push({ name: record.name, minutes, date: record.date,
        kind: record.kind === 'event' ? 'event' : record.kind === 'activity' ? 'activity' : 'todo' });
    }
  };

  const inRange = (d?: string): d is string => !!d && d >= startStr && d <= endStr;
  const matchedTags = (t?: string[]) => (t ?? []).filter(id => trackTagIds.has(id));

  // ── 시간 축 ①: 할일 블록(작업일 기준) ──
  const todoById = new Map(todos.map(t => [t.id, t]));
  // Include blocks outside this range too: a one-day query must not resurrect an
  // undated legacy copy of a timer session that was actually recorded on another day.
  const todosWithBlocks = new Set(timeBlocks.map(b => b.todoId));
  const coveredByBlock = new Set<string>(); // `${todoId}|${date}`
  for (const b of timeBlocks) {
    if (!inRange(b.date)) continue;
    const todo = todoById.get(b.todoId);
    const record: TimeRecord = { id: b.id, name: todo?.text ?? '(연결된 할일 없음)', date: b.date, kind: 'block' };
    addTime(record, todo ? todo.tags ?? [] : undefined, duration(record, b.start, b.end, b.elapsedSec, false), b.classificationSnapshot, b.start, b.end);
    coveredByBlock.add(`${b.todoId}|${b.date}`);
  }
  // ── 시간 축 ②: 블록 없는 TODO의 레거시 do_* (다른 날짜 블록과의 관계는 진단) ──
  for (const todo of todos) {
    if (!inRange(todo.date)) continue;
    if (coveredByBlock.has(`${todo.id}|${todo.date}`)) continue;
    const record: TimeRecord = { id: todo.id, name: todo.text, date: todo.date, kind: 'todo' };
    const sec = duration(record, todo.doStart, todo.doEnd, todo.doElapsedSec);
    if (sec > 0 && todosWithBlocks.has(todo.id)) {
      // recordActiveTimer dual-writes do_* without its execution date. It may be a
      // copy of a block on another date or an older legacy session; do not guess.
      coverage.unresolvedItems.push({ ...record, reason: 'legacy-date-ambiguous', candidateMinutes: sec / 60 });
      continue;
    }
    addTime(record, todo.tags, sec, undefined, todo.doStart, todo.doEnd);
  }
  // ── 시간 축 ③: 일정의 실제 실행 시각. 계획 시각으로 폴백하지 않는다. ──
  for (const ev of events) {
    if (!inRange(ev.date)) continue;
    const record: TimeRecord = { id: ev.id, name: ev.title, date: ev.date, kind: 'event' };
    addTime(record, ev.tags, duration(record, ev.doStart, ev.doEnd), undefined, ev.doStart, ev.doEnd);
  }

  // Independent entries have no TODO identity or completion/goal side effects.
  for (const entry of activityEntries) {
    if (!inRange(entry.date)) continue;
    const record: TimeRecord = { id: entry.id, name: entry.name, date: entry.date, kind: 'activity' };
    addTime(record, entry.categoryId ? [entry.categoryId] : [], duration(record, undefined, undefined, entry.elapsedSec), entry.classificationSnapshot ?? ({} as ClassificationSnapshot), entry.startedAt, entry.endedAt);
  }

  // ── 건수 축: 태그 붙은 할일·이벤트(시간 유무 무관, 각자의 date 기준) ──
  for (const todo of todos) {
    if (!inRange(todo.date)) continue;
    for (const id of matchedTags(todo.tags)) ensure(id).count += 1;
  }
  for (const ev of events) {
    if (!inRange(ev.date)) continue;
    for (const id of matchedTags(ev.tags)) ensure(id).count += 1;
  }

  let totalMinutes = 0; let totalCount = 0;
  byTag.forEach(e => { totalMinutes += e.minutes; totalCount += e.count; });
  return { byTag, totalMinutes, totalCount, coverage, records, tagMetadata };
}

// ───────────────────────── 표시용 행(rows) ─────────────────────────

export interface TagRow {
  tagId: string;
  tagName: string;
  tagColor: string;
  minutes: number;
  count: number;
}

/** byTag → 태그 메타를 붙인 행 목록. minutes 또는 count 가 0보다 큰 태그만. */
export function toTagRows(agg: RangeAggregation, tags: Tag[]): TagRow[] {
  const tagMap = new Map(tags.map(t => [t.id, t]));
  return Array.from(agg.byTag.entries())
    .map(([tagId, v]) => ({
      tagId,
      tagName: agg.tagMetadata.get(tagId)?.name ?? tagMap.get(tagId)?.name ?? '(삭제된 태그)',
      tagColor: agg.tagMetadata.get(tagId)?.color ?? tagMap.get(tagId)?.color ?? '#999999',
      minutes: v.minutes,
      count: v.count,
    }))
    .filter(r => r.minutes > 0 || r.count > 0);
}

// ───────────────────────── 인사이트 문장 ─────────────────────────

const MS_DAY = 86400000;
function daysBetween(fromStr: string, toStr: string): number {
  const a = Date.parse(`${fromStr}T00:00:00`);
  const b = Date.parse(`${toStr}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / MS_DAY);
}

function fmtMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** 마지막 글자에 받침(종성)이 있으면 true. 한글 음절이 아니면 false(기본형 조사). */
function hasJongseong(word: string): boolean {
  if (!word) return false;
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
/** 받침 유무에 맞는 조사(은/는, 이/가)를 붙여 자연스러운 문장을 만든다. */
function withEunNeun(word: string): string { return word + (hasJongseong(word) ? '은' : '는'); }
function withIGa(word: string): string { return word + (hasJongseong(word) ? '이' : '가'); }

export interface InsightInput {
  todos: Todo[];
  events: Event[];
  tags: Tag[];
  period: ActivityPeriod;
  /** 현재 기간 */
  curStart: string;
  curEnd: string;
  /** 직전 동일 길이 기간 */
  prevStart: string;
  prevEnd: string;
  /** 오늘(논리 날짜) yyyy-MM-dd */
  todayStr: string;
}

/**
 * 문장형 인사이트(최대 3줄). 규칙:
 *  1) 공백 알림 우선 — 이력 GAP_MIN_HISTORY 이상인데 마지막 기록이 GAP_ALERT_DAYS 이상 지난 태그.
 *     "N일째 기록 없음"이 정보량이 가장 크므로 맨 위. 공백 긴 순 정렬.
 *  2) 이번 기간 최다 건수 태그.
 *  3) 지난 기간 대비 건수 변화(±COUNT_DELTA_THRESHOLD 이상).
 * 데이터가 부족하면(현재 기간 기록 < INSIGHT_MIN_RECORDS 이고 공백 알림도 없으면) 빈 배열.
 * 판단·훈계 없음(사실만).
 */
export function buildActivityInsights(input: InsightInput): string[] {
  const { todos, events, tags, period, curStart, curEnd, prevStart, prevEnd, todayStr } = input;
  const trackTags = tags.filter(t => t.trackTime);
  const trackTagIds = new Set(trackTags.map(t => t.id));

  // 공백 판정 기준일 = 보고 있는 기간의 끝, 단 오늘을 넘지 않음(미래 주 clamp).
  const refStr = curEnd < todayStr ? curEnd : todayStr;

  // 태그별 전체 이력(기준일 이하): 총 건수 + 마지막 기록일.
  const history = new Map<string, { count: number; last: string | null }>();
  trackTagIds.forEach(id => history.set(id, { count: 0, last: null }));
  const noteHistory = (tagIds: string[] | undefined, date?: string) => {
    if (!date || date > refStr) return;
    for (const id of tagIds ?? []) {
      const h = history.get(id);
      if (!h) continue;
      h.count += 1;
      if (!h.last || date > h.last) h.last = date;
    }
  };
  for (const td of todos) noteHistory(td.tags, td.date);
  for (const ev of events) noteHistory(ev.tags, ev.date);

  const cur = aggregateActivity(todos, events, tags, curStart, curEnd);
  const prev = aggregateActivity(todos, events, tags, prevStart, prevEnd);
  const nameOf = (id: string) => trackTags.find(t => t.id === id)?.name ?? '';

  const gapLines: Array<{ days: number; text: string }> = [];
  for (const [id, h] of history) {
    if (h.count < GAP_MIN_HISTORY || !h.last) continue;
    const days = daysBetween(h.last, refStr);
    if (days < GAP_ALERT_DAYS[period]) continue;
    gapLines.push({ days, text: `${withEunNeun(nameOf(id))} ${fmtMonthDay(h.last)} 이후 기록이 없어요` });
  }
  gapLines.sort((a, b) => b.days - a.days);

  const out: string[] = gapLines.map(g => g.text);

  // 현재 기간이 너무 비면 볼륨/변화 문장은 만들지 않는다(공백 알림만 유지).
  if (cur.totalCount >= INSIGHT_MIN_RECORDS) {
    // 최다 건수
    let topId = ''; let topCount = 0;
    cur.byTag.forEach((v, id) => { if (v.count > topCount) { topCount = v.count; topId = id; } });
    const periodWord = period === 'week' ? '주' : '달';
    if (topId && topCount > 0 && out.length < MAX_INSIGHTS) {
      out.push(`이번 ${periodWord} ${withIGa(nameOf(topId))} ${topCount}건으로 가장 많았어요`);
    }
    // 지난 기간 대비 최대 변화
    if (out.length < MAX_INSIGHTS) {
      const ids = new Set<string>([...cur.byTag.keys(), ...prev.byTag.keys()]);
      let bestId = ''; let bestDelta = 0;
      ids.forEach(id => {
        const diff = (cur.byTag.get(id)?.count ?? 0) - (prev.byTag.get(id)?.count ?? 0);
        if (Math.abs(diff) > Math.abs(bestDelta)) { bestDelta = diff; bestId = id; }
      });
      if (bestId && Math.abs(bestDelta) >= COUNT_DELTA_THRESHOLD) {
        const lastWord = period === 'week' ? '지난주' : '지난달';
        const verb = bestDelta > 0 ? '늘었어요' : '줄었어요';
        out.push(`${lastWord}보다 ${withIGa(nameOf(bestId))} ${Math.abs(bestDelta)}건 ${verb}`);
      }
    }
  }

  return out.slice(0, MAX_INSIGHTS);
}

/** 분 → "X시간 Y분" / "X시간" / "Y분" (반올림). */
export function formatMinutes(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}
