import { format, isBefore, parseISO } from 'date-fns';
import type { Event } from '../app/store';
import { supabase } from '../lib/supabase';
import {
  buildSpec,
  expandRecurrenceDates,
  legacyEventToSpec,
  type RecurrenceFreq,
  type RecurrencePreset,
  type RecurrenceSpec,
} from '../lib/recurrence';

export type EventRepeatType = 'none' | 'daily' | 'weekly' | 'monthly';
export type EventAlertMinutes = 0 | 10 | 30 | 60;

export interface EventMutationInput {
  id?: string;
  title: string;
  isAllDay?: boolean;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  doStart?: string;
  doEnd?: string;
  location?: string;
  linkUrl?: string;
  repeatType?: EventRepeatType;
  repeatEndDate?: string;
  recurrenceFreq?: RecurrenceFreq;
  recurrenceInterval?: number;
  recurrenceByday?: number[];
  recurrencePreset?: RecurrencePreset;
  alertMinutes?: EventAlertMinutes;
  memo?: string;
  projectId?: string;
  color?: string;
  completed?: boolean;
  parentEventId?: string;
  occurrenceDate?: string;
  isException?: boolean;
}

type EventRow = {
  id: string;
  user_id: string | null;
  title: string;
  is_all_day: boolean | null;
  start_at: string;
  end_at: string;
  do_start: string | null;
  do_end: string | null;
  location: string | null;
  link_url: string | null;
  repeat_type: EventRepeatType | null;
  repeat_end_date: string | null;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_interval: number | null;
  recurrence_byday: number[] | null;
  recurrence_preset: RecurrencePreset | null;
  alert_minutes: EventAlertMinutes | null;
  memo: string | null;
  project_id: string | null;
  color: string | null;
  completed: boolean | null;
  parent_event_id: string | null;
  occurrence_date: string | null;
  is_exception: boolean | null;
  created_at: string | null;
};

const FAR_PAST = '2025-01-01';
const FAR_FUTURE = '2028-12-31';

function toDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

/** 신규 스펙(recurrenceFreq) 또는 레거시(repeatType != none) 중 하나라도 있으면 반복 */
function hasRecurrence(input: EventMutationInput): boolean {
  return !!input.recurrenceFreq || (!!input.repeatType && input.repeatType !== 'none');
}

function toEventInput(event: Event | EventMutationInput): EventMutationInput {
  if ('startDate' in event) return event;
  return {
    id: event.sourceEventId || event.id,
    title: event.title,
    isAllDay: event.isAllDay ?? false,
    startDate: event.startDate || event.date,
    endDate: event.endDate || event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    doStart: event.doStart,
    doEnd: event.doEnd,
    location: event.location,
    linkUrl: event.linkUrl,
    repeatType: event.repeatType || 'none',
    repeatEndDate: event.repeatEndDate,
    recurrenceFreq: event.recurrenceFreq,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceByday: event.recurrenceByday,
    recurrencePreset: event.recurrencePreset,
    alertMinutes: event.alertMinutes,
    memo: event.memo,
    projectId: event.projectId,
    color: event.color,
    completed: event.completed,
    parentEventId: event.parentEventId,
    occurrenceDate: event.occurrenceDate,
    isException: event.isException,
  };
}

function toRowPayload(event: Event | EventMutationInput) {
  const input = toEventInput(event);
  const isAllDay = input.isAllDay ?? false;
  const startDate = input.startDate;
  const endDate = input.endDate || input.startDate;
  const startTime = isAllDay ? '00:00' : (input.startTime || '09:00');
  const endTime = isAllDay ? '23:59' : (input.endTime || input.startTime || '10:00');

  return {
    id: input.id,
    title: input.title.trim(),
    is_all_day: isAllDay,
    start_at: toDateTime(startDate, startTime),
    end_at: toDateTime(endDate, endTime),
    // 실적(actual) 시각 — 계획(start_at/end_at)과 별개. 없으면 NULL 유지(실적 없음).
    do_start: input.doStart || null,
    do_end: input.doEnd || null,
    location: input.location?.trim() || null,
    link_url: input.linkUrl?.trim() || null,
    repeat_type: input.repeatType || 'none',
    repeat_end_date: hasRecurrence(input) ? (input.repeatEndDate || null) : null,
    recurrence_freq: input.recurrenceFreq ?? null,
    // recurrence_interval 컬럼은 NOT NULL(DEFAULT 1) — 비반복 일정도 null 을 보내면 안 된다.
    // (20260714 add_unified_recurrence_columns 이후 null 저장 시 23502 로 insert 전체가 실패했다.)
    // recurrence_freq 가 null 이면 읽기 시 interval 은 무시되므로 1 로 채워도 동작에 영향 없음.
    recurrence_interval: input.recurrenceFreq ? (input.recurrenceInterval ?? 1) : 1,
    recurrence_byday: input.recurrenceFreq === 'weekly' ? (input.recurrenceByday ?? null) : null,
    recurrence_preset: input.recurrenceFreq === 'weekly' ? (input.recurrencePreset ?? null) : null,
    alert_minutes: input.alertMinutes ?? null,
    memo: input.memo?.trim() || null,
    project_id: input.projectId || null,
    color: input.color || null,
    completed: input.completed ?? false,
    parent_event_id: input.parentEventId || null,
    occurrence_date: input.occurrenceDate || null,
    is_exception: input.isException ?? false,
  };
}

function toLegacyEvent(row: EventRow, occurrenceDate?: string): Event {
  const startAt = parseISO(row.start_at);
  const endAt = parseISO(row.end_at);
  const date = occurrenceDate || format(startAt, 'yyyy-MM-dd');
  return {
    id: occurrenceDate ? `${row.id}::${date}` : row.id,
    sourceEventId: row.id,
    title: row.title,
    date,
    startDate: format(startAt, 'yyyy-MM-dd'),
    endDate: format(endAt, 'yyyy-MM-dd'),
    startTime: row.is_all_day ? undefined : format(startAt, 'HH:mm'),
    endTime: row.is_all_day ? undefined : format(endAt, 'HH:mm'),
    doStart: row.do_start ?? undefined,
    doEnd: row.do_end ?? undefined,
    location: row.location ?? undefined,
    linkUrl: row.link_url ?? undefined,
    memo: row.memo ?? undefined,
    isAllDay: row.is_all_day ?? false,
    repeatType: row.repeat_type ?? 'none',
    repeatEndDate: row.repeat_end_date ?? undefined,
    recurrenceFreq: row.recurrence_freq ?? undefined,
    recurrenceInterval: row.recurrence_interval ?? undefined,
    recurrenceByday: row.recurrence_byday ?? undefined,
    recurrencePreset: row.recurrence_preset ?? undefined,
    alertMinutes: row.alert_minutes ?? undefined,
    projectId: row.project_id ?? undefined,
    color: row.color ?? undefined,
    completed: row.completed ?? false,
    parentEventId: row.parent_event_id ?? undefined,
    occurrenceDate: row.occurrence_date ?? undefined,
    isException: row.is_exception ?? false,
    startAt: row.start_at,
    endAt: row.end_at,
    isOccurrence: Boolean(occurrenceDate),
    tags: [],
  };
}

/** 가상 occurrence id ("{masterId}::{yyyy-MM-dd}") 판별/파싱 — 할일 패턴과 동일 */
export function isVirtualEventId(id: string): boolean {
  return id.includes('::');
}

export function parseVirtualEventId(id: string): { parentId: string; instanceDate: string } | null {
  const idx = id.indexOf('::');
  if (idx < 0) return null;
  return { parentId: id.slice(0, idx), instanceDate: id.slice(idx + 2) };
}

/**
 * 일정이 현재 시각보다 "지났는지" 여부.
 * 완료 체크와는 별개로, endTime/endAt 이 과거이면 true.
 * - 종일 일정: endDate 가 오늘보다 과거이면 true (오늘은 false)
 * - 시간 일정: endDate + endTime 이 현재보다 과거이면 true
 */
export function isEventPast(event: Event, now: Date = new Date()): boolean {
  const endDate = event.endDate || event.date;
  if (!endDate) return false;
  if (event.isAllDay || !event.endTime) {
    const todayStr = format(now, 'yyyy-MM-dd');
    return endDate < todayStr;
  }
  const endDateTime = parseISO(`${endDate}T${event.endTime}:00`);
  return isBefore(endDateTime, now);
}

function overlapsRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

/** 이벤트 행 → RecurrenceSpec (신규 recurrence_freq 우선, 없으면 레거시 정규화) */
function resolveEventSpec(row: EventRow, origin: Date): RecurrenceSpec | null {
  if (row.recurrence_freq) {
    return buildSpec({
      freq: row.recurrence_freq,
      interval: row.recurrence_interval ?? 1,
      byday: row.recurrence_byday ?? undefined,
      preset: row.recurrence_preset ?? undefined,
      endDate: row.repeat_end_date,
    });
  }
  return legacyEventToSpec(row.repeat_type, row.repeat_end_date, origin);
}

export function getRepeatedEvents(rows: EventRow[], startDate: string, endDate: string): Event[] {
  const rangeStart = parseISO(`${startDate}T00:00:00`);
  const rangeEnd = parseISO(`${endDate}T23:59:59`);

  // 예외 행은 마스터 펼침 시 대체용으로만 쓰이고, 그 외 경로로는 렌더되지 않는다.
  const exceptionRows: EventRow[] = [];
  const otherRows: EventRow[] = [];
  for (const row of rows) {
    if (row.is_exception) exceptionRows.push(row);
    else otherRows.push(row);
  }
  const exMap = new Map<string, EventRow>();
  for (const ex of exceptionRows) {
    if (ex.parent_event_id && ex.occurrence_date) {
      exMap.set(`${ex.parent_event_id}|${ex.occurrence_date}`, ex);
    }
  }

  return otherRows.flatMap((row) => {
    const origin = parseISO(row.start_at);
    const firstDate = format(origin, 'yyyy-MM-dd');
    const spec = resolveEventSpec(row, origin);

    if (!spec) {
      return overlapsRange(firstDate, startDate, endDate) ? [toLegacyEvent(row)] : [];
    }

    // 공용 엔진이 스펙(일/주/월/년 + interval + byday + preset)에 맞는 날짜를 생성
    const dates = expandRecurrenceDates(spec, origin, rangeStart, rangeEnd);
    return dates.map((dateStr) => {
      const ex = exMap.get(`${row.id}|${dateStr}`);
      // 그 회차에 예외 행이 있으면 가상 occurrence 대신 예외 행을 emit (실제 id)
      return ex ? toLegacyEvent(ex) : toLegacyEvent(row, dateStr);
    });
  });
}

/** 할일의 expandRecurringTodos 와 같은 역할 — 기존 getRepeatedEvents 에 대한 별칭 */
export const expandRecurringEvents = getRepeatedEvents;

export async function getEvents(userId?: string, startDate = FAR_PAST, endDate = FAR_FUTURE): Promise<Event[]> {
  let query = supabase.from('events').select('*').order('start_at');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) {
    console.error('[api/events] getEvents:', error.message);
    return [];
  }
  return getRepeatedEvents((data ?? []) as EventRow[], startDate, endDate);
}

export async function createEvent(eventData: Event | EventMutationInput): Promise<Event | null> {
  const payload = toRowPayload(eventData);
  const eventId = payload.id || globalThis.crypto?.randomUUID?.();
  const { data, error } = await supabase
    .from('events')
    .insert({ ...payload, id: eventId })
    .select('*')
    .single();

  if (error) {
    console.error('[api/events] createEvent:', error.message);
    return null;
  }
  return toLegacyEvent(data as EventRow);
}

export async function updateEvent(id: string, eventData: Partial<EventMutationInput & Event>): Promise<Event | null> {
  const payload = toRowPayload({ ...toEventInput(eventData as Event), id });
  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[api/events] updateEvent:', error.message);
    return null;
  }
  return toLegacyEvent(data as EventRow);
}

// insert-or-update by primary key. 신규 이벤트(아직 행 없음)는 insert,
// 기존 이벤트나 반복 일정 마스터(sourceEventId)는 update로 동작한다.
export async function upsertEvent(id: string, eventData: Partial<EventMutationInput & Event>): Promise<Event | null> {
  const payload = toRowPayload({ ...toEventInput(eventData as Event), id });
  const { data, error } = await supabase
    .from('events')
    .upsert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[api/events] upsertEvent:', error.message);
    return null;
  }
  return toLegacyEvent(data as EventRow);
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) {
    console.error('[api/events] deleteEvent:', error.message);
    return false;
  }
  return true;
}
