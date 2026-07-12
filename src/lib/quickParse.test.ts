/**
 * quickParse 파서 단위 테스트.
 *
 * 이 프로젝트엔 테스트 러너가 설정돼 있지 않다(package.json). vitest 등 도입 시
 * 이 파일이 그대로 동작하도록 `node:test` + `node:assert` 표준 API 만 사용한다.
 * 러너 없이 즉석 확인하려면 esbuild 로 트랜스파일 후 node 로 실행할 수 있다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseQuickEntry } from './quickParse';

// 고정된 "오늘": 2026-06-13 (토)
const NOW = new Date(2026, 5, 13, 9, 0, 0);

test('토큰 없는 입력 → Inbox', () => {
  const r = parseQuickEntry('장보기', NOW);
  assert.equal(r.title, '장보기');
  assert.equal(r.date, null);
  assert.equal(r.hasTime, false);
  assert.deepEqual(r.tags, []);
  assert.equal(r.isTop3, false);
});

test('날짜 + 시간 + 태그', () => {
  const r = parseQuickEntry('내일 오후 3시 치과 #케어', NOW);
  assert.equal(r.title, '치과');
  assert.equal(r.date, '2026-06-14');
  assert.equal(r.hasTime, true);
  assert.equal(r.startTime, '15:00');
  assert.deepEqual(r.tags, ['케어']);
});

test('매주 [요일] 반복 + 태그', () => {
  const r = parseQuickEntry('매주 월 운동 #건강', NOW);
  assert.equal(r.title, '운동');
  assert.equal(r.recurrenceRule, 'weekly');
  assert.deepEqual(r.recurrenceDays, ['월']);
  assert.deepEqual(r.tags, ['건강']);
  // weekly 시작일은 다가오는 월요일(2026-06-15)로 맞춰 TodoModal 과 정합
  assert.equal(r.date, '2026-06-15');
});

test('중요(!) + 요일 + 프로젝트', () => {
  const r = parseQuickEntry('!보고서 마감 금요일 @하온', NOW);
  assert.equal(r.title, '보고서 마감');
  assert.equal(r.date, '2026-06-19'); // 가장 가까운 금요일
  assert.equal(r.isTop3, true);
  assert.equal(r.projectName, '하온');
});

test('시간만 있으면 오늘', () => {
  const r = parseQuickEntry('9시 회의', NOW);
  assert.equal(r.title, '회의');
  assert.equal(r.date, '2026-06-13');
  assert.equal(r.hasTime, true);
  assert.equal(r.startTime, '09:00');
});

// 추가 회귀 케이스
test('범위 시간 N-N시', () => {
  const r = parseQuickEntry('오후 3-4시 미팅', NOW);
  assert.equal(r.startTime, '15:00');
  assert.equal(r.endTime, '16:00');
  assert.equal(r.hasTime, true);
});

test('M/D 날짜', () => {
  const r = parseQuickEntry('6/20 워크샵', NOW);
  assert.equal(r.date, '2026-06-20');
});

test('매일/평일 반복은 시작일 오늘', () => {
  assert.equal(parseQuickEntry('매일 스트레칭', NOW).recurrenceRule, 'daily');
  assert.equal(parseQuickEntry('평일 출근', NOW).recurrenceRule, 'weekday');
  assert.equal(parseQuickEntry('매일 스트레칭', NOW).date, '2026-06-13');
});

test('N시간은 시간으로 오인하지 않음', () => {
  const r = parseQuickEntry('3시간 공부', NOW);
  assert.equal(r.hasTime, false);
  assert.equal(r.title, '3시간 공부');
});

// 타입 프리픽스 (일정/할일)
test("'일정' 프리픽스 → typeHint event + 키워드 제거 후 정상 파싱", () => {
  const r = parseQuickEntry('일정 내일 10시 미팅', NOW);
  assert.equal(r.typeHint, 'event');
  assert.equal(r.title, '미팅');
  assert.equal(r.hasTime, true);
  assert.equal(r.startTime, '10:00');
  assert.equal(r.date, '2026-06-14');
});

test("'할일' 프리픽스 → typeHint todo", () => {
  const r = parseQuickEntry('할일 3시까지 보고서', NOW);
  assert.equal(r.typeHint, 'todo');
  assert.equal(r.hasTime, true);
});

test('프리픽스 없으면 typeHint null (기존 케이스 회귀)', () => {
  assert.equal(parseQuickEntry('장보기', NOW).typeHint, null);
  assert.equal(parseQuickEntry('내일 오후 3시 치과 #케어', NOW).typeHint, null);
});

test("붙여쓴 '일정미팅' / 단독 '일정' 은 프리픽스 아님(제목 유지)", () => {
  const r1 = parseQuickEntry('일정미팅 준비', NOW);
  assert.equal(r1.typeHint, null);
  assert.equal(r1.title, '일정미팅 준비');
  const r2 = parseQuickEntry('일정', NOW);
  assert.equal(r2.typeHint, null);
  assert.equal(r2.title, '일정');
});
