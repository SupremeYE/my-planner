import { addWeeks, format, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns';

/** New writes always use the ISO week-numbering year, including Dec/Jan boundaries. */
export function getWeekKey(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
}

/**
 * Read compatibility only; never rewrite a stored record.
 * The old calendar-year + ISO-week function could create an impossible W53 (2027-W53).
 * Resolve it only when Jan 1 proves it belongs to the preceding ISO year's W53.
 * Valid-but-ambiguous keys (2022-W52, 2018-W01) must keep their stored interpretation:
 * week_key alone cannot tell which year the user intended. Do not alias entire years.
 */
export function weekKeyForRead(key: string): string {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key);
  if (!match) return key;
  const year = Number(match[1]); const week = Number(match[2]);
  if (week < 1 || week > 53) return key;
  const padded = `${match[1]}-W${String(week).padStart(2, '0')}`;
  const monday = addWeeks(startOfISOWeek(new Date(year, 0, 4)), week - 1);
  if (getWeekKey(monday) === padded) return padded;
  const jan1Key = getWeekKey(new Date(year, 0, 1));
  if (week === 53 && jan1Key === `${year - 1}-W53`) return jan1Key;
  return key;
}

export function weekKeysMatch(a: string, b: string): boolean {
  return weekKeyForRead(a) === weekKeyForRead(b);
}

/** Prefer the exact record on collisions; do not merge or discard either stored row. */
export function findWeekRecord<T extends { weekKey: string }>(records: T[], key: string): T | undefined {
  return records.find(record => record.weekKey === key)
    ?? records.find(record => weekKeysMatch(record.weekKey, key));
}

export function weekKeyToMonday(key?: string): string | undefined {
  if (!key) return undefined;
  const match = /^(\d{4})-W(\d{1,2})$/.exec(weekKeyForRead(key));
  if (!match) return undefined;
  const year = Number(match[1]); const week = Number(match[2]);
  if (week < 1 || week > 53) return undefined;
  // Retain the historical range rendering for other unresolved W53 keys.
  return format(addWeeks(startOfISOWeek(new Date(year, 0, 4)), week - 1), 'yyyy-MM-dd');
}
