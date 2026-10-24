import { addDays, addMonths, addWeeks, differenceInCalendarDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { ActivityRecord } from './timeAggregation';
export type ReportPeriod = 'day' | 'week' | 'month';
export function reportRange(date: string, period: ReportPeriod, weekStartsOn: 0 | 1 = 1) {
  const ref = parseISO(date);
  const start = period === 'day' ? ref : period === 'week' ? startOfWeek(ref, { weekStartsOn }) : startOfMonth(ref);
  const end = period === 'day' ? ref : period === 'week' ? endOfWeek(ref, { weekStartsOn }) : endOfMonth(ref);
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd'), dates: Array.from({ length: differenceInCalendarDays(end, start) + 1 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd')) };
}
export function moveReportDate(date: string, period: ReportPeriod, direction: number) {
  const ref = parseISO(date);
  return format(period === 'day' ? addDays(ref, direction) : period === 'week' ? addWeeks(ref, direction) : addMonths(ref, direction), 'yyyy-MM-dd');
}
function interval(record: ActivityRecord): [number, number] | undefined {
  if (!record.start || !record.end) return;
  const parse = (value: string) => {
    if (value.includes('T')) return Date.parse(value);
    const [h, m] = value.split(':').map(Number); const date = parseISO(record.date);
    date.setHours(h, m, 0, 0); return date.getTime();
  };
  const start = parse(record.start), end = parse(record.end);
  if (Number.isFinite(start) && end > start) return [start, end];
}
/** Only known real intervals can identify overlap; duration-only entries are unknowable. */
export function activityOverlaps(records: ActivityRecord[]) {
  const pairs: Array<{ a: ActivityRecord; b: ActivityRecord; minutes: number }> = [];
  const timed = records.map(record => ({ record, interval: interval(record) }))
    .filter((value): value is { record: ActivityRecord; interval: [number, number] } => !!value.interval)
    .sort((a,b) => a.interval[0] - b.interval[0]);
  for (let i = 0; i < timed.length; i++) {
    const a = timed[i];
    for (let j = i + 1; j < timed.length && timed[j].interval[0] < a.interval[1]; j++) {
      const b = timed[j]; const overlap = Math.min(a.interval[1], b.interval[1]) - b.interval[0];
      if (overlap > 0) pairs.push({ a: a.record, b: b.record, minutes: overlap / 60000 });
    }
  }
  return pairs;
}
