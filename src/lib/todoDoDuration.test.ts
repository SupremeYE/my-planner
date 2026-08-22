import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Todo } from '../app/store';
import {
  isCompletionMarker, completionMarkerPatch, todoDoDurationSeconds,
} from './todoDoDuration';

const todo = (p: Partial<Todo>): Todo => ({
  id: 'x', text: 't', date: '2026-08-05', status: 'active', tags: [],
  ...p,
} as Todo);

test('isCompletionMarker: do_start=do_end + elapsed 0 만 마커', () => {
  assert.equal(isCompletionMarker(todo({ doStart: '16:00', doEnd: '16:00', doElapsedSec: 0 })), true);
  // 길이 있는 실적(elapsed>0) 은 마커 아님
  assert.equal(isCompletionMarker(todo({ doStart: '16:00', doEnd: '16:45', doElapsedSec: 2700 })), false);
  // do_* 없음 → 마커 아님
  assert.equal(isCompletionMarker(todo({})), false);
  // start≠end 인데 elapsed 0 (비정상) → 마커로 보지 않음
  assert.equal(isCompletionMarker(todo({ doStart: '16:00', doEnd: '16:30', doElapsedSec: 0 })), false);
});

test('마커는 소요 0초 — 시간 축을 오염시키지 않는다', () => {
  assert.equal(todoDoDurationSeconds(todo({ doStart: '16:00', doEnd: '16:00', doElapsedSec: 0 })), 0);
});

test('completionMarkerPatch: 완료 전환 시 실적 없으면 완료시각 마커를 남긴다', () => {
  const patch = completionMarkerPatch(todo({ status: 'active' }), 'done', '16:00');
  assert.deepEqual(patch, { doStart: '16:00', doEnd: '16:00', doElapsedSec: 0 });
});

test('completionMarkerPatch: 이미 실적 DO 가 있으면 건드리지 않는다(지어내지 않음)', () => {
  const patch = completionMarkerPatch(
    todo({ status: 'active', doStart: '14:00', doEnd: '14:45', doElapsedSec: 2700 }), 'done', '16:00');
  assert.deepEqual(patch, {});
});

test('completionMarkerPatch: date 없는(인박스) 할일은 마커 없음(타임라인 자리 없음)', () => {
  const patch = completionMarkerPatch(todo({ date: undefined, status: 'active' }), 'done', '16:00');
  assert.deepEqual(patch, {});
});

test('completionMarkerPatch: 완료 해제 시 마커는 정리, 실제 소요는 보존', () => {
  // 마커였던 것 → 완료 해제 시 do_* 정리
  const cleared = completionMarkerPatch(
    todo({ status: 'done', doStart: '16:00', doEnd: '16:00', doElapsedSec: 0 }), 'active', '17:00');
  assert.deepEqual(cleared, { doStart: undefined, doEnd: undefined, doElapsedSec: undefined });
  // 실제 소요가 있던 것 → 완료 해제해도 보존
  const kept = completionMarkerPatch(
    todo({ status: 'done', doStart: '14:00', doEnd: '14:45', doElapsedSec: 2700 }), 'active', '17:00');
  assert.deepEqual(kept, {});
});

test('completionMarkerPatch: done↔done 외 전환(예: 미루기)은 빈 패치', () => {
  assert.deepEqual(completionMarkerPatch(todo({ status: 'active' }), 'snoozed', '16:00'), {});
});
