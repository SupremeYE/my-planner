import { addDays, addMonths, addWeeks, format, isAfter, isBefore, parseISO } from 'date-fns';
import type { Event } from '../app/store';
import { supabase } from '../lib/supabase';

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
  location?: string;
  linkUrl?: string;
  repeatType?: EventRepeatType;
  repeatEndDate?: string;
  alertMinutes?: EventAlertMinutes;
  memo?: string;
  projectId?: string;
  color?: string;
}

type EventRow = {
  id: string;
  user_id: string | null;
  title: string;
  is_all_day: boolean | null;
  start_at: string;
  end_at: string;
  location: string | null;
  link_url: string | null;
  repeat_type: EventRepeatType | null;
  repeat_end_date: string | null;
  alert_minutes: EventAlertMinutes | null;
  memo: string | null;
  project_id: string | null;
  color: string | null;
  created_at: string | null;
};

const FAR_PAST = '2025-01-01';
const FAR_FUTURE = '2028-12-31';

function toDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
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
    location: event.location,
    linkUrl: event.linkUrl,
    repeatType: event.repeatType || 'none',
    repeatEndDate: event.repeatEndDate,
    alertMinutes: event.alertMinutes,
    memo: event.memo,
    projectId: event.projectId,
    color: event.color,
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
    location: input.location?.trim() || null,
    link_url: input.linkUrl?.trim() || null,
    repeat_type: input.repeatType || 'none',
    repeat_end_date: input.repeatType && input.repeatType !== 'none' ? (input.repeatEndDate || null) : null,
    alert_minutes: input.alertMinutes ?? null,
    memo: input.memo?.trim() || null,
    project_id: input.projectId || null,
    color: input.color || null,
  };
}

function toLegacyEvent(row: EventRow, occurrenceDate?: string): Event {
  const startAt = parseISO(row.start_at);
  const endAt = parseISO(row.end_at);
  const date = occurrenceDate || format(startAt, 'yyyy-MM-dd');
  return {
    id: occurrenceDate ? `${row.id}__${date}` : row.id,
    sourceEventId: row.id,
    title: row.title,
    date,
    startDate: format(startAt, 'yyyy-MM-dd'),
    endDate: format(endAt, 'yyyy-MM-dd'),
    startTime: row.is_all_day ? undefined : format(startAt, 'HH:mm'),
    endTime: row.is_all_day ? undefined : format(endAt, 'HH:mm'),
    location: row.location ?? undefined,
    linkUrl: row.link_url ?? undefined,
    memo: row.memo ?? undefined,
    isAllDay: row.is_all_day ?? false,
    repeatType: row.repeat_type ?? 'none',
    repeatEndDate: row.repeat_end_date ?? undefined,
    alertMinutes: row.alert_minutes ?? undefined,
    projectId: row.project_id ?? undefined,
    color: row.color ?? undefined,
    startAt: row.start_at,
    endAt: row.end_at,
    isOccurrence: Boolean(occurrenceDate),
    tags: [],
  };
}

function overlapsRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

export function getRepeatedEvents(rows: EventRow[], startDate: string, endDate: string): Event[] {
  const rangeStart = parseISO(`${startDate}T00:00:00`);
  const rangeEnd = parseISO(`${endDate}T23:59:59`);

  return rows.flatMap((row) => {
    const repeatType = row.repeat_type ?? 'none';
    const firstDate = format(parseISO(row.start_at), 'yyyy-MM-dd');
    const repeatUntil = row.repeat_end_date ?? endDate;

    if (repeatType === 'none') {
      return overlapsRange(firstDate, startDate, endDate) ? [toLegacyEvent(row)] : [];
    }

    const items: Event[] = [];
    let cursor = parseISO(`${firstDate}T00:00:00`);
    const limit = parseISO(`${repeatUntil}T23:59:59`);

    while (!isAfter(cursor, rangeEnd) && !isAfter(cursor, limit)) {
      if (!isBefore(cursor, rangeStart)) {
        items.push(toLegacyEvent(row, format(cursor, 'yyyy-MM-dd')));
      }

      if (repeatType === 'daily') cursor = addDays(cursor, 1);
      else if (repeatType === 'weekly') cursor = addWeeks(cursor, 1);
      else cursor = addMonths(cursor, 1);
    }

    return items;
  });
}

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
