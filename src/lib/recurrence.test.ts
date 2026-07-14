/**
 * 공용 반복 엔진 단위 테스트.
 *
 * 이 프로젝트엔 테스트 러너가 설정돼 있지 않다(package.json). vitest 등 도입 시
 * 이 파일이 그대로 동작하도록 `node:test` + `node:assert` 표준 API 만 사용한다.
 * 러너 없이 즉석 확인하려면 esbuild 로 트랜스파일 후 node 로 실행할 수 있다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseISO } from 'date-fns';
import {
  buildSpec,
  expandRecurrenceDates,
  legacyTodoToSpec,
  legacyEventToSpec,
  monthlySkipsSomeMonths,
} from './recurrence';

const d = (s: string) => parseISO(s);
const expand = (spec: Parameters<typeof expandRecurrenceDates>[0], origin: string, start: string, end: string) =>
  expandRecurrenceDates(spec, d(origin), d(start), d(end));

// ── 매일 / N일마다 ────────────────────────────────────────────────────────────
test('매일', () => {
  const s = buildSpec({ freq: 'daily' });
  assert.deepEqual(expand(s, '2026-06-01', '2026-06-01', '2026-06-04'),
    ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']);
});

test('3일마다 (interval)', () => {
  const s = buildSpec({ freq: 'daily', interval: 3 });
  assert.deepEqual(expand(s, '2026-06-01', '2026-06-01', '2026-06-10'),
    ['2026-06-01', '2026-06-04', '2026-06-07', '2026-06-10']);
});

test('origin 이전 날짜는 생성 안 됨', () => {
  const s = buildSpec({ freq: 'daily' });
  assert.deepEqual(expand(s, '2026-06-05', '2026-06-01', '2026-06-06'),
    ['2026-06-05', '2026-06-06']);
});

// ── 평일 / 주말 프리셋 ────────────────────────────────────────────────────────
test('평일 프리셋 (월~금)', () => {
  const s = buildSpec({ freq: 'weekly', preset: 'weekday' });
  // 2026-06-08(월)~06-14(일)
  assert.deepEqual(expand(s, '2026-06-08', '2026-06-08', '2026-06-14'),
    ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12']);
});

test('주말 프리셋 (토·일)', () => {
  const s = buildSpec({ freq: 'weekly', preset: 'weekend' });
  assert.deepEqual(expand(s, '2026-06-08', '2026-06-08', '2026-06-14'),
    ['2026-06-13', '2026-06-14']);
});

// ── 매주 특정요일(다중) ───────────────────────────────────────────────────────
test('매주 월·수', () => {
  const s = buildSpec({ freq: 'weekly', byday: [1, 3] });
  assert.deepEqual(expand(s, '2026-06-08', '2026-06-08', '2026-06-21'),
    ['2026-06-08', '2026-06-10', '2026-06-15', '2026-06-17']);
});

// ── 주 앵커 잠금: 격주 화요일 ─────────────────────────────────────────────────
// origin = 2026-06-07(일). 주 시작=일요일이므로 origin 은 주 0의 시작.
// 화요일: 주0=06-09, 주1=06-16, 주2=06-23 ... interval 2 → 짝수 주만.
// ⇒ 06-09, 06-23, 07-07 (3주 뒤 화요일이 아니라 "짝수 주" 화요일)
test('격주 화요일 — 주 앵커=시작주 기준', () => {
  const s = buildSpec({ freq: 'weekly', interval: 2, byday: [2] });
  assert.deepEqual(expand(s, '2026-06-07', '2026-06-07', '2026-07-10'),
    ['2026-06-09', '2026-06-23', '2026-07-07']);
});

// origin 이 화요일 자신이면 그 날부터 시작
test('격주 화요일 — 시작일이 화요일', () => {
  const s = buildSpec({ freq: 'weekly', interval: 2, byday: [2] });
  assert.deepEqual(expand(s, '2026-06-09', '2026-06-09', '2026-07-10'),
    ['2026-06-09', '2026-06-23', '2026-07-07']);
});

// ── 매월 + 말일 skip ──────────────────────────────────────────────────────────
test('매월 15일', () => {
  const s = buildSpec({ freq: 'monthly' });
  assert.deepEqual(expand(s, '2026-01-15', '2026-01-01', '2026-04-30'),
    ['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
});

test('매월 31일 — 없는 달은 건너뜀(skip)', () => {
  const s = buildSpec({ freq: 'monthly' });
  // 2월(28), 4월(30), 6월(30), 9월(30), 11월(30)은 31일 없음 → skip
  assert.deepEqual(expand(s, '2026-01-31', '2026-01-01', '2026-12-31'),
    ['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31', '2026-08-31', '2026-10-31', '2026-12-31']);
});

test('격월(2개월마다) 10일', () => {
  const s = buildSpec({ freq: 'monthly', interval: 2 });
  assert.deepEqual(expand(s, '2026-01-10', '2026-01-01', '2026-07-31'),
    ['2026-01-10', '2026-03-10', '2026-05-10', '2026-07-10']);
});

// ── 매년 + 2/29 skip ──────────────────────────────────────────────────────────
test('매년', () => {
  const s = buildSpec({ freq: 'yearly' });
  assert.deepEqual(expand(s, '2026-03-14', '2026-01-01', '2028-12-31'),
    ['2026-03-14', '2027-03-14', '2028-03-14']);
});

test('매년 2월 29일 — 평년은 건너뜀(skip)', () => {
  const s = buildSpec({ freq: 'yearly' });
  // 2024(윤), 2028(윤)만 존재. 2025~2027 평년 skip.
  assert.deepEqual(expand(s, '2024-02-29', '2024-01-01', '2029-12-31'),
    ['2024-02-29', '2028-02-29']);
});

// ── endDate 경계 ──────────────────────────────────────────────────────────────
test('endDate 로 종료', () => {
  const s = buildSpec({ freq: 'daily', endDate: '2026-06-03' });
  assert.deepEqual(expand(s, '2026-06-01', '2026-06-01', '2026-06-10'),
    ['2026-06-01', '2026-06-02', '2026-06-03']);
});

// ── 레거시 정규화(dual-read) ──────────────────────────────────────────────────
test('레거시 할일 weekdays → 평일 스펙', () => {
  const s = legacyTodoToSpec('weekdays', undefined, undefined, d('2026-06-08'));
  assert.deepEqual(s, buildSpec({ freq: 'weekly', preset: 'weekday' }));
});

test('레거시 할일 weekly → 시작요일 byday', () => {
  const s = legacyTodoToSpec('weekly', undefined, undefined, d('2026-06-08')); // 월요일
  assert.deepEqual(s?.byday, [1]);
});

test('레거시 할일 custom → byday 그대로', () => {
  const s = legacyTodoToSpec('custom', [2, 4], undefined, d('2026-06-08'));
  assert.deepEqual(s?.byday, [2, 4]);
});

test('레거시 일정 monthly → monthly 스펙', () => {
  const s = legacyEventToSpec('monthly', undefined, d('2026-06-15'));
  assert.equal(s?.freq, 'monthly');
});

test('레거시 일정 none → null', () => {
  assert.equal(legacyEventToSpec('none', undefined, d('2026-06-15')), null);
});

// ── UI 보조 ──────────────────────────────────────────────────────────────────
test('monthlySkipsSomeMonths', () => {
  assert.equal(monthlySkipsSomeMonths(d('2026-01-31')), true);
  assert.equal(monthlySkipsSomeMonths(d('2026-01-29')), true);
  assert.equal(monthlySkipsSomeMonths(d('2026-01-15')), false);
});
