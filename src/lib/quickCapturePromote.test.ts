/**
 * 빠른 기록 홈 히어로 승격 단위 테스트.
 *
 * 테스트 러너 미설정 프로젝트(quickParse.test.ts 와 동일) — node:test + node:assert 표준 API만.
 * 즉석 실행: esbuild 로 트랜스파일 후 node 로 실행.
 *
 * 핵심: 21~23시 겹침 구간에서 diary 가 sleep_in 보다 우선해야 한다(registry 순서).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { inWindow, promotedIdAt } from './quickCapturePromote';

// Stage 3 작업 1 매트릭스 — [시각, 기대 히어로 id | null]
const MATRIX: [number, string | null][] = [
  [0, 'sleep_in'],
  [2, 'sleep_in'],
  [4, 'sleep_in'],   // [21,4] 경계 포함
  [5, 'wake_up'],    // sleep_in 벗어남, wake_up 시작
  [7, 'wake_up'],
  [9, 'wake_up'],    // [5,9] 경계 포함
  [10, null],        // 어느 윈도우에도 미매칭
  [14, null],
  [19, null],
  [20, 'diary'],     // diary 시작
  [21, 'diary'],     // ⚠️ diary·sleep_in 둘 다 매칭 → 순서로 diary 우선
  [22, 'diary'],     // ⚠️ 가장 중요
  [23, 'diary'],     // ⚠️
];

for (const [hour, expected] of MATRIX) {
  test(`promotedIdAt(${hour}) → ${expected ?? '없음'}`, () => {
    assert.equal(promotedIdAt(hour), expected);
  });
}

test('inWindow 자정 가로지름 [21,4]', () => {
  assert.equal(inWindow(23, [21, 4]), true);
  assert.equal(inWindow(0, [21, 4]), true);
  assert.equal(inWindow(4, [21, 4]), true);
  assert.equal(inWindow(5, [21, 4]), false);
  assert.equal(inWindow(20, [21, 4]), false);
});

test('inWindow 일반 윈도우 [5,9]', () => {
  assert.equal(inWindow(5, [5, 9]), true);
  assert.equal(inWindow(9, [5, 9]), true);
  assert.equal(inWindow(4, [5, 9]), false);
  assert.equal(inWindow(10, [5, 9]), false);
});

test('21~23시 핵심 — sleep_in 아님', () => {
  for (const h of [21, 22, 23]) {
    assert.equal(promotedIdAt(h), 'diary', `${h}시는 diary 여야 함`);
    assert.notEqual(promotedIdAt(h), 'sleep_in');
  }
});
