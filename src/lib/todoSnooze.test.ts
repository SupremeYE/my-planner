/**
 * 미루기 end_date 동반 이동 유틸 단위 테스트. node:test + node:assert.
 * (러너 미설정 — esbuild 트랜스파일 후 node --test 로 실행)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { shiftedEndDate } from './todoSnooze';

test('end_date 없음 → undefined(제약 무관, 그대로 없음)', () => {
  assert.equal(shiftedEndDate({ date: '2026-08-10', endDate: null }, '2026-08-11'), undefined);
  assert.equal(shiftedEndDate({ date: '2026-08-10' }, '2026-08-11'), undefined);
});

test('단일일(end==date) → 새 날짜로 함께 이동(역전 방지)', () => {
  // 이게 핵심: date 만 옮기면 end_date(오늘) < date(내일) 로 CHECK 위반 → 저장 실패
  assert.equal(shiftedEndDate({ date: '2026-08-10', endDate: '2026-08-10' }, '2026-08-11'), '2026-08-11');
});

test('기간 할일(end>date) → 같은 간격 유지', () => {
  // 3일짜리 기간을 미루면 종료일도 3일 뒤로
  assert.equal(shiftedEndDate({ date: '2026-08-10', endDate: '2026-08-13' }, '2026-08-12'), '2026-08-15');
});

test('과거 → 오늘로 당길 때도 역전 없이 이동', () => {
  assert.equal(shiftedEndDate({ date: '2026-08-05', endDate: '2026-08-05' }, '2026-08-10'), '2026-08-10');
  assert.equal(shiftedEndDate({ date: '2026-08-04', endDate: '2026-08-06' }, '2026-08-10'), '2026-08-12');
});

test('시작일 없던(Inbox) 항목에 end 만 있는 비정상 케이스 → 단일일로', () => {
  assert.equal(shiftedEndDate({ date: null, endDate: '2026-08-10' }, '2026-08-11'), '2026-08-11');
});

test('결과는 항상 end_date >= date (CHECK todos_end_date_valid 충족)', () => {
  const cases = [
    { date: '2026-08-10', endDate: '2026-08-10' },
    { date: '2026-08-10', endDate: '2026-08-20' },
    { date: '2026-01-31', endDate: '2026-02-02' },
  ];
  for (const c of cases) {
    for (const nd of ['2026-08-11', '2026-12-01', '2026-01-01']) {
      const e = shiftedEndDate(c, nd);
      assert.ok(e !== undefined && e >= nd, `${JSON.stringify(c)} → ${nd} = ${e}`);
    }
  }
});
