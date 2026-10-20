import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Todo, Tag, Event, TodoTimeBlock } from '../app/store';
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

test('계획 일정 60분 / 실제 실행 없음 → 실적 0분', () => {
  const events = [ev({ id: 'e1', tags: ['work'], date: '2026-08-05', startTime: '13:00', endTime: '14:00' })];
  const agg = aggregateActivity([], events, tags, '2026-08-03', '2026-08-09');
  assert.equal(agg.totalMinutes, 0);
  assert.equal(agg.coverage.recordedMinutes, 0);
  assert.deepEqual(agg.coverage.unresolvedItems, []);
  assert.equal(agg.totalCount, 1); // 계획 건수와 실적 시간은 별개 지표를 유지한다.
});

test('계획 60분 / 실제 실행 30분 → 실적 30분', () => {
  const event = ev({ id: 'e', date: '2026-08-05', tags: ['work'],
    startTime: '13:00', endTime: '14:00', doStart: '15:00', doEnd: '15:30' });
  const agg = aggregateActivity([], [event], tags, event.date, event.date);
  assert.equal(agg.totalMinutes, 30);
  assert.equal(agg.byTag.get('work')!.minutes, 30);
});

const block = (p: Partial<TodoTimeBlock>): TodoTimeBlock => ({
  id: 'block', todoId: 'a', date: '2026-08-05', elapsedSec: 600, ...p,
});

test('여러 블록은 누적하고 같은 TODO·날짜 레거시 실적은 중복하지 않는다', () => {
  const td = todo({ id: 'a', date: '2026-08-05', tags: ['work'],
    doStart: '09:00', doEnd: '10:00', doElapsedSec: 3600 });
  const blocks = [block({ id: 'b1', elapsedSec: 600 }), block({ id: 'b2', elapsedSec: 1200 })];
  const agg = aggregateActivity([td], [], tags, td.date!, td.date!, blocks);
  assert.equal(agg.totalMinutes, 30);
  assert.equal(agg.coverage.recordedMinutes, 30);
  assert.equal(agg.byTag.get('work')!.timeItems.length, 2);
});

test('다른 작업일의 블록과 날짜 없는 레거시는 중복하지 않고 모호성을 진단한다', () => {
  const td = todo({ id: 'a', date: '2026-08-04', tags: ['work'], doStart: '10:00', doEnd: '10:30' });
  const blocks = [block({ date: '2026-08-05', elapsedSec: 1200 })];
  const agg = aggregateActivity([td], [], tags, '2026-08-01', '2026-08-31', blocks);
  assert.equal(agg.totalMinutes, 20);
  assert.equal(agg.coverage.unresolvedItems[0].reason, 'legacy-date-ambiguous');
  assert.equal(agg.coverage.unresolvedItems[0].candidateMinutes, 30);
  // The same rule applies even when the block is outside the selected day.
  const day = aggregateActivity([td], [], tags, '2026-08-04', '2026-08-04', blocks);
  assert.equal(day.totalMinutes, 0);
  assert.equal(day.coverage.unresolvedItems[0].reason, 'legacy-date-ambiguous');
});

test('복수 추적 태그의 균등 분할과 기존 건수 기준을 유지한다', () => {
  const td = todo({ id: 'a', date: '2026-08-05', tags: ['work', 'self', 'off'],
    doStart: '10:00', doEnd: '11:00' });
  const agg = aggregateActivity([td], [], tags, td.date!, td.date!);
  assert.equal(agg.byTag.get('work')!.minutes, 30);
  assert.equal(agg.byTag.get('self')!.minutes, 30);
  assert.equal(agg.byTag.has('off'), false);
  assert.equal(agg.totalMinutes, 60);
  assert.equal(agg.totalCount, 2);
});

test('태그 없음·삭제된 태그·추적 OFF 실적을 이유별로 식별한다', () => {
  const records = [undefined, ['removed'], ['off']].map((tagIds, i) => todo({
    id: String(i), date: '2026-08-05', tags: tagIds, doStart: '10:00', doEnd: '10:20',
  }));
  const agg = aggregateActivity(records, [], tags, '2026-08-05', '2026-08-05');
  assert.equal(agg.totalMinutes, 0); // 기존 추적 태그 총합의 의미를 바꾸지 않는다.
  assert.equal(agg.coverage.recordedMinutes, 60);
  assert.equal(agg.coverage.unclassifiedMinutes, 60);
  assert.deepEqual(agg.coverage.unclassifiedItems.map(i => i.reason), ['untagged', 'unknown-tags', 'untracked-tags']);
});

test('미분류 일정 실적과 연결 TODO가 없는 블록도 조용히 누락하지 않는다', () => {
  const event = ev({ id: 'e', date: '2026-08-05', doStart: '10:00', doEnd: '10:15' });
  const agg = aggregateActivity([], [event], tags, event.date, event.date, [block({ elapsedSec: 1200 })]);
  assert.equal(agg.coverage.recordedMinutes, 35);
  assert.equal(agg.coverage.unclassifiedMinutes, 35);
  assert.deepEqual(agg.coverage.unclassifiedItems.map(i => i.reason), ['missing-todo', 'untagged']);
});

test('일간 합계 = 같은 기록 범위의 주간 합계 = 월간 합계 (분류·미분류 모두)', () => {
  const todos = [
    todo({ id: 'a', date: '2026-08-03', tags: ['work'], doStart: '09:00', doEnd: '09:10' }),
    todo({ id: 'b', date: '2026-08-06', tags: [], doStart: '09:00', doEnd: '09:20' }),
  ];
  const events = [ev({ id: 'e', date: '2026-08-07', tags: ['work', 'self'], doStart: '09:00', doEnd: '09:30' })];
  const blocks = [block({ date: '2026-08-04', elapsedSec: 2400 }), block({ date: '2026-08-05', elapsedSec: 600 })];
  const run = (s: string, e = s) => aggregateActivity(todos, events, tags, s, e, blocks);
  const days = Array.from({ length: 7 }, (_, i) => run(`2026-08-${String(i + 3).padStart(2, '0')}`));
  for (const aggregate of [run('2026-08-03', '2026-08-09'), run('2026-08-01', '2026-08-31')]) {
    assert.equal(aggregate.totalMinutes, days.reduce((s, d) => s + d.totalMinutes, 0));
    assert.equal(aggregate.coverage.unclassifiedMinutes, days.reduce((s, d) => s + d.coverage.unclassifiedMinutes, 0));
    assert.equal(aggregate.coverage.recordedMinutes, aggregate.totalMinutes + aggregate.coverage.unclassifiedMinutes);
    for (const id of ['work', 'self']) {
      assert.equal(aggregate.byTag.get(id)!.minutes, days.reduce((s, d) => s + (d.byTag.get(id)?.minutes ?? 0), 0));
    }
  }
});

test('자정 전후 블록은 저장된 작업일을 보존하며 실측 초를 우선한다', () => {
  const td = todo({ id: 'a', date: '2026-08-03', tags: ['work'] });
  const blocks = [
    block({ id: 'before', date: '2026-08-03', start: '23:50', end: '00:10', elapsedSec: 1200 }),
    block({ id: 'after', date: '2026-08-04', start: '00:15', end: '00:25', elapsedSec: 600 }),
  ];
  assert.equal(aggregateActivity([td], [], tags, '2026-08-03', '2026-08-03', blocks).totalMinutes, 20);
  assert.equal(aggregateActivity([td], [], tags, '2026-08-04', '2026-08-04', blocks).totalMinutes, 10);
  assert.equal(aggregateActivity([td], [], tags, '2026-08-01', '2026-08-31', blocks).totalMinutes, 30);
});

test('날짜 없는 역전 HH:mm은 자정 통과로 추측하지 않고 진단한다', () => {
  const event = ev({ id: 'e', date: '2026-08-05', tags: ['work'], doStart: '23:50', doEnd: '00:10' });
  const agg = aggregateActivity([], [event], tags, event.date, event.date);
  assert.equal(agg.totalMinutes, 0);
  assert.equal(agg.coverage.unresolvedItems[0].reason, 'ambiguous-overnight');
});

test('명시적인 확장 시각은 보존하고 잘못된 시각·실측 값은 진단한다', () => {
  const events = [
    ev({ id: 'extended', date: '2026-08-05', tags: ['work'], doStart: '23:50', doEnd: '24:10' }),
    ev({ id: 'bad', date: '2026-08-05', tags: ['work'], doStart: '09:99', doEnd: '10:00' }),
    ev({ id: 'partial', date: '2026-08-05', tags: ['work'], doStart: '09:00' }),
  ];
  const agg = aggregateActivity([], events, tags, '2026-08-05', '2026-08-05', [block({ elapsedSec: NaN })]);
  assert.equal(agg.totalMinutes, 20);
  assert.equal(agg.coverage.unresolvedItems.length, 3);
  assert.ok(agg.coverage.unresolvedItems.every(i => i.reason === 'invalid-time'));
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

test('완료 시각 마커(do_start=do_end, elapsed 0): 건수엔 잡히고 시간 축은 오염 안 됨', () => {
  const todos = [
    // 길이 있는 실적 1건(60분)
    todo({ id: 'a', tags: ['work'], date: '2026-08-05', doStart: '09:00', doEnd: '10:00', doElapsedSec: 3600 }),
    // 완료 시각 마커 2건 — do_start=do_end, elapsed 0 (길이 0 → 시간 0)
    todo({ id: 'm1', tags: ['work'], date: '2026-08-06', doStart: '16:00', doEnd: '16:00', doElapsedSec: 0 }),
    todo({ id: 'm2', tags: ['work'], date: '2026-08-07', doStart: '11:39', doEnd: '11:39', doElapsedSec: 0 }),
  ];
  const agg = aggregateActivity(todos, [], tags, '2026-08-03', '2026-08-09');
  // 시간 축: 마커는 0초라 60분만(마커가 늘어도 시간 축 불변 — 예전 30분 버그 재발 아님)
  assert.equal(Math.round(agg.byTag.get('work')!.minutes), 60);
  // 건수 축: 마커도 '했다'는 사실이라 모두 잡힘(3건)
  assert.equal(agg.byTag.get('work')!.count, 3);
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
