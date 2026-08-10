/**
 * 시계 포맷 헬퍼 단위 테스트. node:test + node:assert.
 * (러너 미설정 — esbuild 트랜스파일 후 node --test 로 실행)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatClock } from './formatClock';

test('1시간 미만: MM:SS', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(9), '00:09');
  assert.equal(formatClock(63), '01:03');
  assert.equal(formatClock(3599), '59:59');
});

test('1시간 이상: H:MM:SS (시 분리)', () => {
  assert.equal(formatClock(3600), '1:00:00');
  // 회귀: 102분 12초 = 6132초 → 예전 "102:12" 가 아니라 "1:42:12"
  assert.equal(formatClock(6132), '1:42:12');
  assert.equal(formatClock(7200), '2:00:00');
  assert.equal(formatClock(36000), '10:00:00');
});

test('음수는 절대값으로', () => {
  assert.equal(formatClock(-63), '01:03');
  assert.equal(formatClock(-6132), '1:42:12');
});
