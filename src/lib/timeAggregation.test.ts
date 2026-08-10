import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Todo, Tag, Event } from '../app/store';
import {
  aggregateActivity, toTagRows, buildActivityInsights,
  GAP_ALERT_DAYS, GAP_MIN_HISTORY,
} from './timeAggregation';

const tags: Tag[] = [
  { id: 'work', name: '업무', color: '#111', trackTime: true },
  { id: 'life', name: '일상', color: '#222', trackTime: true },
  { id: 'self', name: '자기관리/계발', color: '#333', trackTime: true },
  { id: 'beauty', name: '뷰티케어', color: '#444', trackTime: true },
  { id: 'off', name: '집계안함', color: '#555', trackTime: false },
];

const todo = (p: Partial<Todo>): Todo => ({
  id: 'x', text: 't', date: undefined, status: 'active', tags: [],
  ...p,
} as Todo);
const ev = (p: Partial<Event>): Event => ({ id: 'e', title: 'ev', date: '', tags: [], ...p } as Event);

test('시간 축: 할일 do_* 로 집계, plan 은 무시, track_time=false 태그 제외', () => {
  const todos = [
    todo({ id: 'a', tags: ['work'], date: '2026-08-05', doStart: '09:00', doEnd: '10:00', doElapsedSec: 3600 }),
    todo({ id: 'b', tags: ['life'], date: '2026-08-06', doStart: '11:00', doEnd: '11:30', doElapsedSec: 1800 }),
    todo({ id: 'c', tags: ['off'],  date: '2026-08-06', doStart: '12:00', doEnd: '13:00', doElapsedSec: 3600 }),
    // plan_* 만 있는 할일은 시간에 안 잡힘 (doStart/doEnd 없음)
    todo({ id: 'd', tags: ['work'], date: '2026-08-06', planStart: '14:00', planEnd: '15:00' }),
  ];
  const agg = aggregateActivity(todos, [], tags, '2026-08-03', '2026-08-09');
  assert.equal(Math.round(agg.byTag.get('work')!.minutes), 60);
  assert.equal(Math.round(agg.byTag.get('life')!.minutes), 30);
  assert.equal(agg.byTag.has('off'), false);
  assert.equal(Math.round(agg.totalMinutes), 90); // 업무 60 + 일상 30 (= 시간 리포트 "총 1시간 30분")
});

test('시간 축: 이벤트 시각도 같은 엔진으로 포함된다', () => {
  const events = [ev({ id: 'e1', tags: ['work'], date: '2026-08-05', startTime: '13:00', endTime: '14:00' })];
  const agg = aggregateActivity([], events, tags, '2026-08-03', '2026-08-09');
  assert.equal(Math.round(agg.byTag.get('work')!.minutes), 60);
});

test('건수 축: 시간이 없어도 태그만 붙으면 잡힌다 (시간 축과 독립)', () => {
  const todos = [
    todo({ id: 'a', tags: ['work'], date: '2026-08-05', doStart: '09:00', doEnd: '10:00', doElapsedSec: 3600 }),
    todo({ id: 'b', tags: ['work'], date: '2026-08-06' }), // 시간 없음
    todo({ id: 'c', tags: ['work'], date: '2026-08-07' }), // 시간 없음
  ];
  const agg = aggregateActivity(todos, [], tags, '2026-08-03', '2026-08-09');
  assert.equal(agg.byTag.get('work')!.count, 3);           // 건수는 3
  assert.equal(Math.round(agg.byTag.get('work')!.minutes), 60); // 시간은 1건만
  const rows = toTagRows(agg, tags);
  assert.equal(rows.find(r => r.tagId === 'work')!.count, 3);
});

test('인사이트: 이력 충분한 태그의 공백은 알림, 이력 적은 태그는 제외', () => {
  const today = '2026-08-10';
  // 자기관리: 3건(=GAP_MIN_HISTORY), 마지막 7/17 → 24일 공백 → 주간(14)·월간(21) 모두 알림
  const selfTodos = [
    todo({ id: 's1', tags: ['self'], date: '2026-07-10' }),
    todo({ id: 's2', tags: ['self'], date: '2026-07-15' }),
    todo({ id: 's3', tags: ['self'], date: '2026-07-17' }),
  ];
  // 뷰티케어: 1건뿐 → 공백 알림 제외(노이즈 방지)
  const beautyTodos = [todo({ id: 'bt', tags: ['beauty'], date: '2026-06-08' })];
  // 업무: 이번 달 활발
  const workTodos = [
    todo({ id: 'w1', tags: ['work'], date: '2026-08-05' }),
    todo({ id: 'w2', tags: ['work'], date: '2026-08-10' }),
  ];
  const lines = buildActivityInsights({
    todos: [...selfTodos, ...beautyTodos, ...workTodos], events: [], tags,
    period: 'month', curStart: '2026-08-01', curEnd: '2026-08-31',
    prevStart: '2026-07-01', prevEnd: '2026-07-31', todayStr: today,
  });
  assert.ok(lines.length > 0 && lines.length <= 3);
  assert.ok(lines[0].includes('자기관리/계발') && lines[0].includes('7월 17일'), `gap line first: ${lines.join(' | ')}`);
  assert.ok(!lines.some(l => l.includes('뷰티케어')), `beauty must be excluded: ${lines.join(' | ')}`);
});

test('인사이트: 기록이 거의 없으면 억지 문장 없이 빈 배열', () => {
  const lines = buildActivityInsights({
    todos: [todo({ id: 'a', tags: ['work'], date: '2026-08-05' })], events: [], tags,
    period: 'week', curStart: '2026-08-03', curEnd: '2026-08-09',
    prevStart: '2026-07-27', prevEnd: '2026-08-02', todayStr: '2026-08-10',
  });
  // 현재 1건(<INSIGHT_MIN_RECORDS=2) & 공백 알림 대상 없음 → 빈 배열
  assert.deepEqual(lines, []);
});

test('상수 문서화 값 확인 (주간 1~2주 / 월간 3~4주, 최소 이력)', () => {
  assert.equal(GAP_ALERT_DAYS.week, 14);
  assert.equal(GAP_ALERT_DAYS.month, 21);
  assert.equal(GAP_MIN_HISTORY, 3);
});
