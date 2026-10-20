import assert from 'node:assert/strict';
import test from 'node:test';
import { getWeekKey, weekKeyForRead, weekKeysMatch, findWeekRecord, weekKeyToMonday } from './weekKeys';

test('ISO 주차 연도: 연초·연말·일반 날짜', () => {
  for (const [date, expected] of [
    ['2027-01-01', '2026-W53'], ['2026-12-31', '2026-W53'],
    ['2027-01-04', '2027-W01'], ['2018-12-31', '2019-W01'],
    ['2022-01-01', '2021-W52'], ['2026-10-19', '2026-W43'],
  ]) assert.equal(getWeekKey(new Date(`${date}T12:00:00`)), expected);
});

test('한 ISO 주의 연말·연초 날짜는 같은 키를 갖는다', () => {
  const days = ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'];
  assert.deepEqual(days.map(d => getWeekKey(new Date(`${d}T12:00:00`))), days.map(() => '2026-W53'));
});

test('명백한 옛 W53 키는 읽을 때만 전년도 W53과 호환된다', () => {
  assert.equal(weekKeyForRead('2027-W53'), '2026-W53');
  assert.equal(weekKeyForRead('2021-W53'), '2020-W53');
  assert.equal(weekKeysMatch('2027-W53', '2026-W53'), true);
  assert.equal(weekKeyForRead('2026-W53'), '2026-W53');
  assert.equal(weekKeyToMonday('2027-W53'), '2026-12-28');
});

test('유효하지만 의도가 모호한 옛 키를 다른 연도로 추정하지 않는다', () => {
  assert.equal(weekKeyForRead('2022-W52'), '2022-W52');
  assert.equal(weekKeysMatch('2022-W52', '2021-W52'), false);
  assert.equal(weekKeyForRead('2018-W01'), '2018-W01');
  assert.equal(weekKeysMatch('2018-W01', '2019-W01'), false);
  assert.equal(weekKeyToMonday('2018-W01'), '2018-01-01');
});

test('기존 목표·회고 원본 키와 연결은 읽기 후에도 변하지 않는다', () => {
  const goals = [{ id: 'goal', weekKey: '2027-W53', monthlyGoalId: 'month', done: true }];
  const review = { id: 'review', weekKey: '2027-W53', nextWeek: 'Keep this text' };
  const original = structuredClone({ goals, review });
  assert.equal(goals.filter(g => weekKeysMatch(g.weekKey, '2026-W53')).length, 1);
  assert.equal(findWeekRecord([review], '2026-W53'), review);
  assert.deepEqual({ goals, review }, original);
});

test('정상 키와 호환 키가 모두 있으면 정상 키를 우선하고 어느 행도 병합하지 않는다', () => {
  const records = [{ id: 'legacy', weekKey: '2027-W53' }, { id: 'canonical', weekKey: '2026-W53' }];
  assert.equal(findWeekRecord(records, '2026-W53')!.id, 'canonical');
  assert.equal(records.length, 2);
  assert.equal(findWeekRecord(records, '2027-W53')!.id, 'legacy');
  assert.equal(findWeekRecord(records, '2026-W52'), undefined);
});

test('기존 한 자리 주차는 읽기 호환하며 잘못된 키는 임의 보정하지 않는다', () => {
  assert.equal(weekKeysMatch('2026-W1', '2026-W01'), true);
  assert.equal(weekKeyToMonday('2026-W1'), '2025-12-29');
  for (const key of ['bad', '2026-W00', '2026-W54']) {
    assert.equal(weekKeyForRead(key), key);
    assert.equal(weekKeyToMonday(key), undefined);
  }
});
