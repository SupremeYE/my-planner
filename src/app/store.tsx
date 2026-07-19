import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format, getISOWeek, getYear, subDays, addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { db } from '../lib/db';
import { isVirtualTodoId, parseVirtualTodoId } from '../lib/recurrenceExpansion';
import { isVirtualEventId, parseVirtualEventId } from '../api/events';

// ───── Types ─────
export type TodoStatus = 'active' | 'done' | 'cancelled' | 'snoozed' | 'backlog' | 'inProgress';

export interface Tag {
  id: string;
  name: string;
  color: string;
  trackTime: boolean;
}

export interface Todo {
  id: string;
  text: string;
  date: string | null;
  dueDate?: string | null;
  endDate?: string | null;
  status: TodoStatus;
  isTop3: boolean;
  planStart?: string;
  planEnd?: string;
  doStart?: string;
  doEnd?: string;
  /** 타이머 완료 시 실제 경과 시간(초). 타임라인 막대는 분 단위 doEnd와 별개로 집계·표시에 사용 */
  doElapsedSec?: number;
  category?: string;
  projectId?: string;
  /** 연결된 주간 목표 id (Phase 4·5: 목표↔할일 롤업) */
  weeklyGoalId?: string;
  /** 연결된 마일스톤 id (프로젝트 진행률 자동 산출용) */
  milestoneId?: string;
  /** 만다라트에서 "보내기"로 생성된 경우 출처 셀 id */
  mandalartCellId?: string;
  tags?: string[];
  // 반복 일정 필드 (레거시 — dual-read 로 유지, 삭제 금지)
  recurrenceRule?: 'daily' | 'weekly' | 'weekdays' | 'custom';
  recurrenceDays?: number[];       // 0=일 ~ 6=토 (custom/weekly byday 겸용)
  recurrenceEndDate?: string;      // yyyy-MM-dd, null이면 무기한
  recurrenceParentId?: string;     // 원본 이벤트 ID (예외 인스턴스가 참조)
  isException?: boolean;           // 이 인스턴스만 수정·삭제된 예외
  // 반복 통합 스펙 (RecurrenceSpec, src/lib/recurrence.ts). recurrenceFreq 있으면 우선.
  recurrenceFreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval?: number;     // N — 매 N 주기마다 (기본 1)
  recurrencePreset?: 'weekday' | 'weekend';
  // 이월(carryover) — 처음 '진행중'이 된 날짜(yyyy-MM-dd). "N일째"·이어달리기 기준. (Stage 4)
  startedDate?: string;
}

/**
 * 할일 시간 블록 (Stage 3 — 누적).
 * 타이머 세션 1회 = 1블록. 날짜별로 쌓이며(덮어쓰기 아님) todos.do_* 를 대체·보완한다.
 */
export interface TodoTimeBlock {
  id: string;
  todoId: string;
  date: string;        // 작업한 날짜 yyyy-MM-dd (todo.date 예정일과 별개)
  start?: string;      // HH:mm
  end?: string;        // HH:mm
  elapsedSec: number;  // 타이머 실측 초
}

export interface Event {
  id: string;
  sourceEventId?: string;
  title: string;
  date: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  doStart?: string;  // 실제(actual) 시작 HH:mm — 계획(startTime)과 별개. 없으면 실적 없음.
  doEnd?: string;    // 실제(actual) 종료 HH:mm — 계획(endTime)과 별개. 없으면 실적 없음.
  isAllDay?: boolean;
  location?: string;
  linkUrl?: string;
  memo?: string;
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly';  // 레거시 — dual-read 로 유지
  repeatEndDate?: string;
  // 반복 통합 스펙 (RecurrenceSpec, src/lib/recurrence.ts). recurrenceFreq 있으면 우선.
  recurrenceFreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval?: number;     // N — 매 N 주기마다 (기본 1)
  recurrenceByday?: number[];      // 0=일 ~ 6=토 (weekly 전용)
  recurrencePreset?: 'weekday' | 'weekend';
  alertMinutes?: 0 | 10 | 30 | 60;
  projectId?: string;
  color?: string;
  startAt?: string;
  endAt?: string;
  isOccurrence?: boolean;
  tags?: string[];
  completed?: boolean;
  parentEventId?: string;   // 반복 마스터의 id (예외 행에만 채움)
  occurrenceDate?: string;  // 예외 행이 가리키는 회차 날짜 'yyyy-MM-dd'
  isException?: boolean;    // 이 회차만 변경된 예외 행
}

export interface Habit {
  id: string;
  name: string;
  checkedDates: string[];
  icon?: string;
  repeat?: 'daily' | 'weekday' | 'weekend' | 'custom' | 'weekly';
  repeatDays?: number[];
  weeklyTarget?: number; // repeat === 'weekly'일 때 주간 목표 횟수(요일 무관)
  goalText?: string;
  alarmTime?: string;
  category?: string;
  color?: string;
  habitType: 'check' | 'count' | 'time' | 'value' | 'memo';
  targetValue?: number;
  valueUnit?: string;
  dailyProgress: Record<string, number>;
  dailyMemos: Record<string, string>;
  reason?: string;
}

export interface HabitMonthlyMemo {
  id: string;
  habitId: string;   // 실제 습관 id, 또는 '__review__' (전체 월간 회고)
  year: number;
  month: number;     // 1-12
  memo: string;
  whatWorked: string;
  whatDidntWork: string;
  nextMonth: string;
}

export interface RoutineStep {
  title: string;
  durationMinutes: number;
  youtubeUrl?: string;
}

export interface Routine {
  id: string;
  name: string;
  icon: string;
  startTime: string;
  duration: number; // backward compat: auto-computed from routineSteps
  steps: string[]; // backward compat
  stepYoutubeUrls?: string[]; // backward compat
  routineSteps?: RoutineStep[]; // structured steps (new)
  checkedDates: string[];
  repeat?: 'daily' | 'weekday' | 'weekend' | 'custom';
  repeatDays?: number[]; // 0=일 ~ 6=토
}

/** routineSteps 합산 or 기존 duration 반환 */
export function getRoutineTotalMinutes(routine: Routine): number {
  if (routine.routineSteps && routine.routineSteps.length > 0) {
    return routine.routineSteps.reduce((s, step) => s + (step.durationMinutes || 0), 0);
  }
  return routine.duration;
}

/** routineSteps가 있으면 반환, 없으면 구버전 steps에서 마이그레이션 */
export function getRoutineSteps(routine: Routine): RoutineStep[] {
  if (routine.routineSteps && routine.routineSteps.length > 0) {
    return routine.routineSteps;
  }
  // 구버전 폴백: 단계당 1분으로 마이그레이션
  return (routine.steps ?? []).map((title, i) => ({
    title,
    durationMinutes: 1,
    youtubeUrl: routine.stepYoutubeUrls?.[i] || undefined,
  }));
}

export interface SelfCareRecord {
  id: string;
  date: string;
  category: 'exercise' | 'study' | 'beauty' | 'sleep';
  content: string;
  duration: number; // minutes
  sleepStart?: string; // "HH:mm" — sleep category only
  sleepEnd?: string;   // "HH:mm" — sleep category only
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DiningType = 'home' | 'delivery' | 'restaurant' | 'coffee';
export type TasteRating = 'good' | 'normal' | 'bad';

export interface FoodRecord {
  id: string;
  date: string;           // yyyy-MM-dd
  mealType: MealType;
  foodName: string;
  amount: number;         // 원
  photoUrl?: string | null;
  memo?: string | null;
  calories?: number | null;
  carbs?: number | null;
  protein?: number | null;
  fat?: number | null;
  diningType?: DiningType | null;
  tasteRating?: TasteRating | null;
  tasteMemo?: string | null;
  isFasting?: boolean;
}

// 몸무게 기록 시간대 — 하루에 아침/저녁/기타 공존 가능 (DB: UNIQUE(date, slot))
export type WeightSlot = '아침' | '저녁' | '기타';

export interface WeightRecord {
  id: string;
  date: string;             // yyyy-MM-dd
  slot: WeightSlot;         // 아침/저녁/기타 — 하루 여러 기록 구분 키
  weight: number;           // kg
  bodyFat?: number | null;  // %
  muscleMass?: number | null; // kg
  memo?: string | null;
}

export interface WeightGoal {
  startWeight: number;
  targetWeight: number;
  targetBodyFat?: number | null;
  targetMuscleMass?: number | null;
}

// 눈바디(몸 사진) — 민감 정보. photoPath 는 비공개 스토리지 경로만(서명 URL 아님, 표시 시점 발급).
export interface BodyPhoto {
  id: string;
  date: string;                     // yyyy-MM-dd
  photoPath: string;                // 'body-photos' 버킷 내 경로
  weightRecordId: string | null;    // 그날 체중 연결(nullable) — weight_records.id(text)
  createdAt?: string;
}

export interface ConditionRecord {
  id: string;
  date: string;             // yyyy-MM-dd
  stress: number;           // 1~5
  symptoms: string[];
  memo?: string | null;
}

// 사용자 커스텀 증상 (컨디션 칩 재사용 풀)
export interface UserSymptom {
  id: string;
  name: string;
}

// ── 문화 기록 (영화/드라마/예능/유튜브 등 시청 콘텐츠) ──
export type CulturePlatform =
  'netflix' | 'youtube' | 'disney_plus' | 'coupang_play' | 'tving' | 'watcha' | 'theater' | 'other';
export type CultureContentType =
  'movie' | 'drama' | 'variety' | 'documentary' | 'anime' | 'youtube_video' | 'lecture' | 'other';
export type CultureStatus = 'watchlist' | 'watching' | 'completed' | 'dropped';
export type CultureExternalSource = 'tmdb_movie' | 'tmdb_tv' | 'youtube' | 'manual';

export interface CultureRecord {
  id: string;
  title: string;
  platform: CulturePlatform;
  contentType: CultureContentType;
  url?: string | null;
  thumbnailUrl?: string | null;
  externalSource?: CultureExternalSource | null; // Stage 1: 'manual', Stage 2: tmdb/youtube 자동
  externalId?: string | null;                    // 외부 출처 콘텐츠 ID (TMDB id, YouTube video id 등)
  status: CultureStatus;
  rating?: number | null;     // 0~5, 0.5 단위
  review?: string | null;
  insight?: string | null;
  tags: string[];
  watchedDate?: string | null; // yyyy-MM-dd
  createdAt?: string;
  updatedAt?: string;
}

// ── 음악 기록 (문화 기록 > 음악, Stage 1) ──
// iTunes 검색으로 고른 곡 + 무드·메모. Stage 2 에서 LP 그리드 UI 예정.
export interface MusicRecord {
  id: string;
  trackTitle: string;
  artist: string;
  album?: string | null;
  artworkUrl?: string | null;
  releaseYear?: number | null;
  itunesTrackId?: number | null;  // 중복 추가 방지용
  previewUrl?: string | null;     // iTunes 30초 미리듣기
  mood: string[];                 // 무드·상황 태그(복수)
  genre?: string | null;
  memo?: string | null;
  listenUrl?: string | null;      // 비우면 제목으로 자동 검색 (Stage 2)
  stickers?: unknown[];           // Stage 3 에서 사용
  createdAt?: string;
}

// ── 레시피 모듈 (Phase 1) ───────────────────────────────────────────────────
export type RecipeSourceType = 'manual' | 'link' | 'reels' | 'receipt' | 'ai';

export interface RecipeIngredient {
  id: string;
  name: string;
  amount?: number | null;   // 분량 수치 (인분 환산 대상)
  unit?: string | null;     // 단위 (g, 개, 큰술 등)
  sortOrder: number;
}

export interface RecipeStep {
  id: string;
  stepNo: number;           // 1부터 시작하는 단계 번호
  instruction: string;
  timerSeconds?: number | null; // 단계 타이머 (초), 없으면 null
  sortOrder: number;
}

export interface Recipe {
  id: string;
  title: string;
  sourceType: RecipeSourceType; // Phase 1 직접입력은 'manual'
  sourceUrl?: string | null;
  thumbnailUrl?: string | null;  // 자동 썸네일(URL/oEmbed)
  myPhotoUrl?: string | null;    // 내가 만든 사진(Storage)
  coverSource: 'thumbnail' | 'my_photo'; // 대표 이미지 선택
  totalMinutes?: number | null;
  baseServings: number;     // 기준 인분 (기본 2) — 인분 환산 기준
  rating?: number | null;   // 0~5, 0.5 단위
  memo?: string | null;
  tags: string[];                 // 의도/상황 (해보고 싶음·혼밥·10분컷 등)
  mainIngredients: string[];      // 주재료 (두부·계란·닭 등) — 냉장고 연결용 별도 배열
  cookCount: number;              // 조리 횟수
  lastCookedAt?: string | null;   // 마지막 조리(timestamp)
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  createdAt?: string;
  updatedAt?: string;
}

// 레시피 조리 기록 — '만들었어요' 한 건 = 1행. 사진/노트는 선택.
export interface RecipeCookLog {
  id: string;
  recipeId: string;
  cookedAt: string;       // ISO timestamp
  photoUrl?: string | null;
  note?: string | null;
  createdAt?: string;
}

// ── 냉장고 / 장보기 (Phase 2) ────────────────────────────────────────────────
export type FridgeCategory = '냉장' | '냉동' | '실온';

export interface FridgeItem {
  id: string;
  name: string;
  category: FridgeCategory;
  quantity: number;
  unit?: string | null;
  expiryDate?: string | null;   // yyyy-MM-dd
  createdAt?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string | null;
  sourceRecipeId?: string | null;  // Phase 3 부족 재료 자동 담기 대비
  sourceLabel?: string | null;     // 레시피명 또는 '직접 추가'
  isChecked: boolean;
  createdAt?: string;
}

// ── 뷰티 케어 · 살림 (Stage 2 데이터 레이어) ──────────────────────────────
// DB snake_case ↔ TS camelCase. user_id 는 DB DEFAULT auth.uid() 로 채워지므로
// 클라이언트 매핑/저장에서 다루지 않지만(fridge 패턴), 타입에는 userId 를 둔다.
export interface BeautyProduct {
  id: string;
  userId?: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  photoUrl?: string | null;
  openedAt?: string | null;     // yyyy-MM-dd (개봉일)
  expiryMonths?: number | null; // 개봉 후 사용기한(PAO)
  purchasePlace?: string | null;
  price?: number | null;
  link?: string | null;
  memo?: string | null;
  isActive: boolean;            // 다 쓴 제품 보관 시 false
  createdAt?: string;
}

export interface BeautySpecialCare {
  id: string;
  userId?: string;
  name: string;
  icon?: string | null;
  cycleDays?: number | null;
  doneDates: string[];          // 'yyyy-MM-dd' 배열
  createdAt?: string;
}

export interface HouseholdItem {
  id: string;
  userId?: string;
  name: string;
  category?: string | null;
  quantity: number;
  unit?: string | null;
  thresholdQty: number;         // "곧 떨어져요" 임계
  brand?: string | null;
  purchasePlace?: string | null;
  price?: number | null;
  link?: string | null;
  memo?: string | null;
  photoUrl?: string | null;
  createdAt?: string;
}

export interface ConsumableCycle {
  id: string;
  userId?: string;
  name: string;
  cycleDays: number;
  replacedDates: string[];      // 'yyyy-MM-dd' 배열 (교체=restart)
  createdAt?: string;
}

export interface CleaningZone {
  id: string;
  userId?: string;
  name: string;
  cleanedDates: string[];       // 'yyyy-MM-dd' 배열
  createdAt?: string;
}

// ── 스크랩 / 영감 보관함 (Stage 0) ────────────────────────────────────────
export type ScrapSource = 'youtube' | 'instagram' | 'threads' | 'web';
export type ScrapStatus = 'unread' | 'revisit' | 'done';

export interface Scrap {
  id: string;
  url: string | null;
  source: ScrapSource | null;
  title: string | null;
  thumbnailUrl: string | null;
  comment: string | null;          // 한 줄 코멘트
  tags: string[];
  status: ScrapStatus;
  lastViewedAt: string | null;     // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface ScrapNote {
  id: string;
  scrapId: string;
  content: string;
  createdAt: string;
}

// ── 마인드맵 (Phase 5-0) ──────────────────────────────────────────────────
// 루트 직속 가지에만 의미 있는 방향. 그 아래는 부모 방향을 상속(클라이언트 계산).
export type MindmapDir = 'right' | 'left' | 'up' | 'down';

export interface MindmapNode {
  id: string;
  scrapId: string;
  parentId: string | null;   // 루트는 null
  text: string;
  dir: MindmapDir | null;     // 루트 직속 가지에만 의미
  sortOrder: number;
  createdAt: string;
}

// 트리 조립 결과 — children 으로 자식 노드를 품는다.
export interface MindmapTreeNode extends MindmapNode {
  children: MindmapTreeNode[];
}

export interface PeriodRecord {
  id: string;
  startDate: string;        // yyyy-MM-dd
  endDate: string | null;   // yyyy-MM-dd
  symptoms: string[];       // ["두통","복통",...]
  flowLevel: 'light' | 'medium' | 'heavy' | null;
  memo: string | null;
}

export type EmotionLevel = 1 | 2 | 3 | 4 | 5;

export interface ReviewRecord {
  id: string;
  date: string;
  types: string[];
  emotion?: EmotionLevel;
  emotionMemo?: string;
  gratitude?: string[];
  kptKeep?: string;
  kptProblem?: string;
  kptTry?: string;
  happiness?: string;
  dailySummary?: string;
  dailyGood?: string;
  dailyImprove?: string;
}

// 행복 기록 — review_records.happiness 에서 독립 분리한 전용 테이블.
// happenedAt(시각)은 nullable: 과거 백필 건은 date 만 있고 시각은 비어 있다.
export interface HappyMoment {
  id: string;
  content: string;
  date: string;
  happenedAt: string | null;
  createdAt: string;
}

export interface WeeklyReview {
  id: string;
  weekKey: string;
  good: string;
  hard: string;
  nextWeek: string;
  kptKeep?: string;
  kptProblem?: string;
  kptTry?: string;
}

export interface MonthlyReview {
  id: string;
  month: string;
  achievement: string;
  nextFocus: string;
  highlight?: string;
  didWell?: string;
  regret?: string;
  kptKeep?: string;
  kptProblem?: string;
  kptTry?: string;
  bestVideo?: string;
  bestMusic?: string;
  bestBook?: string;
  bestPlace?: string;
}

export interface WeeklyGoal {
  id: string;
  text: string;
  done: boolean;
  monthlyGoalId?: string;
  weekKey: string;
  mandalartCellId?: string;
}

export interface MonthlyGoal {
  id: string;
  text: string;
  month: string;
  projectId?: string;
  /** 연간 목표 1개에 연결 (레거시 행은 비어 있을 수 있음) */
  annualGoalId?: string;
  mandalartCellId?: string;
}

/** 연도별 연간 정체성·핵심 가치 (키: "2026" 등) */
export type AnnualYearProfile = { identity: string; values: string[] };

export function emptyAnnualYearProfile(): AnnualYearProfile {
  return { identity: '', values: [] };
}

export function parseAnnualProfiles(raw: unknown): Record<string, AnnualYearProfile> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, AnnualYearProfile> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(k)) continue;
    const o = v as { identity?: unknown; values?: unknown };
    out[k] = {
      identity: typeof o.identity === 'string' ? o.identity : '',
      values: Array.isArray(o.values) ? o.values.filter((x): x is string => typeof x === 'string') : [],
    };
  }
  return out;
}

export function getAnnualProfileForYear(
  profiles: Record<string, AnnualYearProfile> | undefined,
  year: number
): AnnualYearProfile {
  return profiles?.[String(year)] ?? emptyAnnualYearProfile();
}

export interface AnnualGoal {
  id: string;
  year: number;
  text: string;
  done: boolean;
  mandalartCellId?: string;
}

export interface QuarterlyGoal {
  id: string;
  year: number;
  quarter: number; // 1-4
  text: string;
  done: boolean;
}

export interface BrainstormItem {
  id: string;
  text: string;
  date: string;
  weekKey?: string;
}

export type TimerMode = 'pomodoro' | 'stopwatch';

export interface ActiveTimer {
  todoId: string;
  mode: TimerMode;
  startedAt: number;
  startHHMM: string;
  pausedDurationMs: number;
  isPaused: boolean;
  pauseStartedAt: number | null;
  pomoDurationSec: number;
}

export interface TimelineLog {
  id: string;
  date: string;
  time: string;
  text: string;
  color?: string;
  icon?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'paused';
  /** 연결 대상 목표 종류 — 연간/분기/월간. 미연결이면 undefined */
  goalKind?: 'annual' | 'quarterly' | 'monthly';
  /** 연결 대상 목표의 PK (goalKind 와 함께 해석) */
  goalId?: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  date: string;
  done: boolean;
}

// ───── Helpers ─────
// 하루 경계(논리적 날짜) 계산
// dayEndHour가 24를 넘으면(예: 26 = 새벽 2시, 25 = 새벽 1시) 자정~경계 시각 사이는 '전날'로 귀속한다.
// 예) 종료시간을 새벽 1시로 설정하면(dayEndHour=25) 00:30의 기록은 전날, 01:30의 기록은 다음날로 넘어간다.
export function logicalDateStr(now: Date, dayEndHour: number): string {
  const rollover = dayEndHour > 24 ? dayEndHour - 24 : 0; // 자정 이후 이 시각 전까지는 전날로 본다
  const ref = rollover > 0 && now.getHours() < rollover ? subDays(now, 1) : now;
  return format(ref, 'yyyy-MM-dd');
}

// 모듈 레벨 캐시: store가 dayEndHour를 로드/변경할 때마다 동기화한다.
// (각 컴포넌트가 store를 거치지 않고도 '오늘'을 논리적 날짜로 계산할 수 있게 함)
let currentDayEndHour = 26;
export function setCurrentDayEndHour(h: number): void {
  currentDayEndHour = h;
}

// 시간 설정(종료시간)을 반영한 '오늘' 날짜 문자열
export function getLogicalToday(): string {
  return logicalDateStr(new Date(), currentDayEndHour);
}

export const today = getLogicalToday();

export function getWeekKey(date: Date): string {
  const week = getISOWeek(date);
  const year = getYear(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ACTIVE_TIMER_STORAGE_KEY = 'planner-active-focus-timer';

function getTimerEffectiveNowMs(timer: ActiveTimer, nowMs = Date.now()): number {
  if (timer.isPaused && timer.pauseStartedAt != null) return timer.pauseStartedAt;
  return nowMs;
}

export function getTimerElapsedSec(timer: ActiveTimer, nowMs = Date.now()): number {
  const elapsedMs = Math.max(0, getTimerEffectiveNowMs(timer, nowMs) - timer.startedAt - timer.pausedDurationMs);
  return Math.floor(elapsedMs / 1000);
}

export function getTimerRemainingSec(timer: ActiveTimer, nowMs = Date.now()): number {
  if (timer.mode !== 'pomodoro') return getTimerElapsedSec(timer, nowMs);
  return Math.max(0, timer.pomoDurationSec - getTimerElapsedSec(timer, nowMs));
}

function getTimerEndHHMM(startHHMM: string, elapsedSec: number): string {
  const roundedMinutes = Math.max(1, Math.ceil(elapsedSec / 60));
  return minutesToTime(timeToMinutes(startHHMM) + roundedMinutes);
}

const currentWeekKey = getWeekKey(new Date());

// ── App Settings ──
export interface AppSettings {
  showQuarterlyGoals: boolean;
  showWeeklyKpt: boolean;
  showWeeklyHappiness: boolean;
  showMonthlyKpt: boolean;
  showHabitHeatmap: boolean;
  habitAlarmDefault: string;
  globalAffirmation: string;
  weekStartsOn: 0 | 1;
  mobileWeekDays: 2 | 3;
  /** 연도 문자열 키 → 정체성·가치 */
  annualProfiles: Record<string, AnnualYearProfile>;
  /** DB/구버전 호환용 (현재 연도 프로필과 동기화 가능) */
  annualIdentity: string;
  annualValues: string[];
  /** 식단 목표 (미설정 시 undefined) */
  foodGoalDelivery?: number;
  foodGoalRestaurant?: number;
  foodGoalCalories?: number;
  /** 수면 목표 시간 (분 단위, 미설정 시 undefined → 읽는 쪽에서 SLEEP_GOAL_DEFAULT_MIN 기본값 사용) */
  sleepGoalMinutes?: number;
}

/** 수면 목표 기본값 (분). 설정 미입력 시 전 화면에서 이 값을 기준으로 계산. */
export const SLEEP_GOAL_DEFAULT_MIN = 7 * 60;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showQuarterlyGoals: false,
  showWeeklyKpt: false,
  showWeeklyHappiness: false,
  showMonthlyKpt: false,
  showHabitHeatmap: false,
  habitAlarmDefault: '',
  globalAffirmation: '',
  weekStartsOn: 1,
  mobileWeekDays: 3,
  annualProfiles: {},
  annualIdentity: '',
  annualValues: [],
};

// ── Daily Affirmation ──
export const DEFAULT_AFFIRMATIONS = [
  "오늘 나는 내가 원하는 삶을 만들어가고 있다.",
  "나는 충분히 능력 있고, 충분히 가치 있는 사람이다.",
  "작은 진전도 앞으로 나아가는 것이다. 나는 성장하고 있다.",
  "나는 오늘 내가 통제할 수 있는 것에 집중한다.",
  "어려움은 나를 더 강하게 만드는 경험이다.",
  "나는 오늘도 최선을 다할 준비가 되어 있다.",
  "내 시간과 에너지는 소중하다. 나는 현명하게 사용한다.",
  "나는 배우고 성장하는 것을 즐긴다.",
  "긍정적인 변화는 지금 이 순간부터 시작된다.",
  "나는 내 목표를 향해 꾸준히 나아가고 있다.",
  "오늘 하루도 나만의 특별한 순간들로 가득할 것이다.",
  "나는 감사함으로 하루를 시작한다.",
  "나는 스스로를 믿고 나의 가능성을 신뢰한다.",
  "완벽하지 않아도 괜찮다. 시작하는 것이 중요하다.",
  "나는 집중하고, 실행하고, 완성한다.",
];

// ───── Context ─────
interface PlannerContextType {
  isLoading: boolean;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  todos: Todo[];
  timeBlocks: TodoTimeBlock[];
  deleteTimeBlock: (id: string) => void;
  updateTimeBlock: (id: string, changes: Partial<TodoTimeBlock>) => void;
  events: Event[];
  habits: Habit[];
  weeklyGoals: WeeklyGoal[];
  monthlyGoals: MonthlyGoal[];
  annualGoals: AnnualGoal[];
  quarterlyGoals: QuarterlyGoal[];
  brainstormItems: BrainstormItem[];
  brainstormMemos: Record<string, string>;
  activeTimer: ActiveTimer | null;
  projects: Project[];
  milestones: Milestone[];
  tags: Tag[];
  routines: Routine[];
  selfCareRecords: SelfCareRecord[];
  reviewRecords: ReviewRecord[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  happyMoments: HappyMoment[];
  timelineLogs: TimelineLog[];
  dailyAffirmations: Record<string, string>;
  setDailyAffirmation: (date: string, text: string) => void;

  // App settings
  appSettings: AppSettings;
  updateAppSettings: (s: Partial<AppSettings>) => void;

  // Todo actions
  addTodo: (todo: Omit<Todo, 'id'>) => void;
  updateTodo: (id: string, changes: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  deleteTodos: (ids: string[]) => void;
  toggleTop3: (id: string) => void;
  deleteRecurringTodo: (parentId: string, instanceDate: string, scope: 'this' | 'future' | 'all') => void;
  updateRecurringTodo: (parentId: string, instanceDate: string, changes: Partial<Todo>, scope: 'this' | 'future' | 'all') => void;

  // Event actions
  addEvent: (event: Omit<Event, 'id'>) => void;
  updateEvent: (id: string, changes: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  /** 완료 토글 전용. 반복 가상 occurrence 면 그 회차만 예외 행으로 구체화 후 completed 저장. */
  toggleEventCompleted: (id: string, completed: boolean) => void;
  /** "이대로 실행" — 계획(startTime/endTime)을 실적(doStart/doEnd)으로 복사. completed 무관. 계획 시각 없으면 no-op. */
  runEventAsPlanned: (id: string) => void;
  /** 일정 미루기. 단일=이동, 반복=scope(this|future|all) 분기. opts 로 시간/스코프 지정. */
  snoozeEvent: (event: Event, targetDate: string, opts?: { startTime?: string; endTime?: string; scope?: 'this' | 'future' | 'all' }) => void;

  // Habit actions
  addHabit: (name: string) => void;
  addHabitFull: (habit: Omit<Habit, 'id'>) => void;
  updateHabit: (id: string, changes: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (id: string, date: string) => void;
  updateHabitProgress: (id: string, date: string, value: number) => void;
  updateHabitMemo: (id: string, date: string, memo: string) => void;

  // HabitMonthlyMemo actions
  habitMonthlyMemos: HabitMonthlyMemo[];
  setHabitMonthlyMemo: (
    habitId: string,
    year: number,
    month: number,
    data: Partial<Omit<HabitMonthlyMemo, 'id' | 'habitId' | 'year' | 'month'>>
  ) => void;

  // Routine actions
  addRoutine: (routine: Omit<Routine, 'id'>) => void;
  updateRoutine: (id: string, changes: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  toggleRoutineDate: (id: string, date: string) => void;

  // Self-care actions
  addSelfCareRecord: (record: Omit<SelfCareRecord, 'id'>) => void;
  updateSelfCareRecord: (id: string, changes: Partial<Omit<SelfCareRecord, 'id'>>) => void;
  deleteSelfCareRecord: (id: string) => void;

  // Food actions
  foodRecords: FoodRecord[];
  addFoodRecord: (record: Omit<FoodRecord, 'id'>) => void;
  updateFoodRecord: (id: string, changes: Partial<Omit<FoodRecord, 'id'>>) => void;
  deleteFoodRecord: (id: string) => void;

  // Period actions
  periodRecords: PeriodRecord[];
  addPeriodRecord: (record: Omit<PeriodRecord, 'id'>) => void;
  updatePeriodRecord: (id: string, changes: Partial<PeriodRecord>) => void;
  deletePeriodRecord: (id: string) => void;

  // Review actions
  addReviewRecord: (record: Omit<ReviewRecord, 'id'>) => void;
  updateReviewRecord: (id: string, changes: Partial<ReviewRecord>) => void;
  deleteReviewRecord: (id: string) => void;
  addWeeklyReview: (review: Omit<WeeklyReview, 'id'>) => void;
  updateWeeklyReview: (id: string, changes: Partial<WeeklyReview>) => void;
  addMonthlyReview: (review: Omit<MonthlyReview, 'id'>) => void;
  updateMonthlyReview: (id: string, changes: Partial<MonthlyReview>) => void;

  // Happy moment actions (행복 기록)
  addHappyMoment: (content: string, date: string, happenedAt?: string | null) => void;
  deleteHappyMoment: (id: string) => void;

  // Weekly goal actions
  addWeeklyGoal: (text: string, monthlyGoalId: string | undefined, weekKey: string) => void;
  toggleWeeklyGoal: (id: string) => void;
  deleteWeeklyGoal: (id: string) => void;

  // Monthly goal actions
  addMonthlyGoal: (text: string, annualGoalId: string, month: string, projectId?: string) => void;
  updateMonthlyGoal: (id: string, changes: Partial<Pick<MonthlyGoal, 'text' | 'annualGoalId' | 'projectId'>>) => void;
  deleteMonthlyGoal: (id: string) => void;

  // Annual goal actions
  addAnnualGoal: (text: string, year: number) => void;
  toggleAnnualGoal: (id: string) => void;
  deleteAnnualGoal: (id: string) => void;

  // Quarterly goal actions
  addQuarterlyGoal: (text: string, year: number, quarter: number) => void;
  toggleQuarterlyGoal: (id: string) => void;
  deleteQuarterlyGoal: (id: string) => void;

  // Brainstorm actions
  addBrainstormItem: (text: string, date: string) => void;
  deleteBrainstormItem: (id: string) => void;
  brainstormToTodo: (id: string, date?: string) => void;
  brainstormToEvent: (id: string, eventData: { date: string; startTime?: string; endTime?: string; location?: string; tags?: string[] }) => void;
  setBrainstormMemo: (date: string, text: string) => void;
  addWeeklyBrainstorm: (text: string, weekKey: string) => void;
  weeklyBrainstormAssign: (id: string, date: string) => void;

  // Timer actions
  startTimer: (todoId: string, options?: { mode?: TimerMode; pomoDurationSec?: number }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  finishActiveTimer: () => void;

  // Project actions
  addProject: (project: Omit<Project, 'id'>) => string;
  updateProject: (id: string, changes: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Milestone actions
  addMilestone: (milestone: Omit<Milestone, 'id'>) => void;
  toggleMilestone: (id: string) => void;
  deleteMilestone: (id: string) => void;

  // Tag actions
  addTag: (name: string, color: string, trackTime?: boolean) => Tag;
  updateTag: (id: string, changes: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  // Timeline log actions
  addTimelineLog: (log: Omit<TimelineLog, 'id'>) => void;
  deleteTimelineLog: (id: string) => void;

  // Timeline hours (global settings)
  dayStartHour: number;
  dayEndHour: number;
  setDayHours: (s: number, e: number) => void;
}

const CONTEXT_KEY = '__PLANNER_CONTEXT__';
const PlannerContext: React.Context<PlannerContextType | null> =
  (globalThis as any)[CONTEXT_KEY] ??
  ((globalThis as any)[CONTEXT_KEY] = createContext<PlannerContextType | null>(null));

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getLogicalToday());
  const [dayStartHour, setDayStartHour] = useState(4);
  const [dayEndHour, setDayEndHour] = useState(26);

  // ── Supabase 연동 상태 ──
  const [todos, setTodos] = useState<Todo[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TodoTimeBlock[]>([]);
  // 최신 todos 스냅샷 (반복 가상 인스턴스 → 실제 예외 레코드 동기 변환 시 참조)
  const todosRef = useRef<Todo[]>([]);
  useEffect(() => { todosRef.current = todos; }, [todos]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitMonthlyMemos, setHabitMonthlyMemos] = useState<HabitMonthlyMemo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selfCareRecords, setSelfCareRecords] = useState<SelfCareRecord[]>([]);
  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>([]);
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>([]);
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLog[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  // 최신 events 스냅샷 (반복 가상 occurrence → 실제 예외 레코드 동기 구체화 시 참조)
  const eventsRef = useRef<Event[]>([]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [annualGoals, setAnnualGoals] = useState<AnnualGoal[]>([]);
  const [quarterlyGoals, setQuarterlyGoals] = useState<QuarterlyGoal[]>([]);
  const [brainstormItems, setBrainstormItems] = useState<BrainstormItem[]>([]);
  const [brainstormMemos, setBrainstormMemos] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Tag[]>([]);

  // ── in-memory 상태 ──
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]); // Supabase 연동은 db.routines 통해 진행
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);
  const [happyMoments, setHappyMoments] = useState<HappyMoment[]>([]);
  const [dailyAffirmations, setDailyAffirmations] = useState<Record<string, string>>({});
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const wakeLockRef = useRef<any>(null);

  // ── 앱 시작 시 Supabase에서 데이터 로드 ──
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [
        todosData, habitsData, projectsData, milestonesData,
        selfCareData, reviewData, timelineData, settingsData,
        eventsData, weeklyGoalsData, monthlyGoalsData,
        brainstormItemsData, brainstormMemosData, tagsData, routinesData,
        periodData, habitMonthlyMemosData, annualGoalsData, quarterlyGoalsData,
        weeklyReviewsData, monthlyReviewsData, foodRecordsData,
        happyMomentsData, timeBlocksData,
      ] = await Promise.all([
        db.todos.fetchAll(),
        db.habits.fetchAll(),
        db.projects.fetchAll(),
        db.milestones.fetchAll(),
        db.selfCareRecords.fetchAll(),
        db.reviewRecords.fetchAll(),
        db.timelineLogs.fetchAll(),
        db.settings.fetch(),
        db.events.fetchAll(),
        db.weeklyGoals.fetchAll(),
        db.monthlyGoals.fetchAll(),
        db.brainstormItems.fetchAll(),
        db.brainstormMemos.fetchAll(),
        db.tags.fetchAll(),
        db.routines.fetchAll(),
        db.periodRecords.fetchAll(),
        db.habitMonthlyMemos.fetchAll(),
        db.annualGoals.fetchAll(),
        db.quarterlyGoals.fetchAll(),
        db.weeklyReviews.fetchAll(),
        db.monthlyReviews.fetchAll(),
        db.foodRecords.fetchAll(),
        db.happyMoments.fetchAll(),
        db.todoTimeBlocks.fetchAll(),
      ]);
      setTodos(todosData);
      setTimeBlocks(timeBlocksData);
      setHabits(habitsData);
      setProjects(projectsData);
      setMilestones(milestonesData);
      setSelfCareRecords(selfCareData);
      setPeriodRecords(periodData);
      setHabitMonthlyMemos(habitMonthlyMemosData);
      setReviewRecords(reviewData);
      setTimelineLogs(timelineData);
      setDayStartHour(settingsData.dayStartHour);
      setDayEndHour(settingsData.dayEndHour);
      setCurrentDayEndHour(settingsData.dayEndHour);
      // 로드된 종료시간 기준으로 현재 선택 날짜가 '오늘'이면 논리적 오늘로 보정
      setSelectedDate(prev => (prev === today ? logicalDateStr(new Date(), settingsData.dayEndHour) : prev));
      setAppSettings(prev => ({ ...prev, ...settingsData.appSettings }));
      setEvents(eventsData);
      setWeeklyGoals(weeklyGoalsData);
      const normalizedMonthly = monthlyGoalsData.map(mg => {
        if (mg.annualGoalId) return mg;
        const y = parseInt(mg.month.slice(0, 4), 10);
        const first = annualGoalsData.find(a => a.year === y);
        return first ? { ...mg, annualGoalId: first.id } : mg;
      });
      normalizedMonthly.forEach(g => {
        const orig = monthlyGoalsData.find(o => o.id === g.id);
        if (orig && g.annualGoalId && orig.annualGoalId !== g.annualGoalId) {
          db.monthlyGoals.upsert(g);
        }
      });
      setMonthlyGoals(normalizedMonthly);
      setBrainstormItems(brainstormItemsData);
      setBrainstormMemos(brainstormMemosData);
      setRoutines(routinesData);
      setTags(tagsData);
      setAnnualGoals(annualGoalsData);
      setQuarterlyGoals(quarterlyGoalsData);
      setWeeklyReviews(weeklyReviewsData);
      setMonthlyReviews(monthlyReviewsData);
      setFoodRecords(foodRecordsData);
      setHappyMoments(happyMomentsData);
      setIsLoading(false);
    };
    load();
  }, []);

  // ── Supabase Realtime 구독 (변경 감지 → 전체 재fetch) ──────────────────────
  useEffect(() => {
    // 각 테이블별 재fetch 함수
    const refetchers: Record<string, () => Promise<void>> = {
      todos:             async () => setTodos(await db.todos.fetchAll()),
      habits:            async () => setHabits(await db.habits.fetchAll()),
      projects:          async () => setProjects(await db.projects.fetchAll()),
      milestones:        async () => setMilestones(await db.milestones.fetchAll()),
      self_care_records: async () => setSelfCareRecords(await db.selfCareRecords.fetchAll()),
      review_records:    async () => setReviewRecords(await db.reviewRecords.fetchAll()),
      timeline_logs:     async () => setTimelineLogs(await db.timelineLogs.fetchAll()),
      events:            async () => setEvents(await db.events.fetchAll()),
      todo_time_blocks:  async () => setTimeBlocks(await db.todoTimeBlocks.fetchAll()),
      weekly_goals:      async () => setWeeklyGoals(await db.weeklyGoals.fetchAll()),
      monthly_goals:     async () => setMonthlyGoals(await db.monthlyGoals.fetchAll()),
      brainstorm_items:  async () => setBrainstormItems(await db.brainstormItems.fetchAll()),
      brainstorm_memos:  async () => setBrainstormMemos(await db.brainstormMemos.fetchAll()),
      tags:              async () => setTags(await db.tags.fetchAll()),
      routines:          async () => setRoutines(await db.routines.fetchAll()),
      period_records:    async () => setPeriodRecords(await db.periodRecords.fetchAll()),
      habit_monthly_memos: async () => setHabitMonthlyMemos(await db.habitMonthlyMemos.fetchAll()),
      annual_goals:      async () => setAnnualGoals(await db.annualGoals.fetchAll()),
      quarterly_goals:   async () => setQuarterlyGoals(await db.quarterlyGoals.fetchAll()),
      weekly_reviews:    async () => setWeeklyReviews(await db.weeklyReviews.fetchAll()),
      monthly_reviews:   async () => setMonthlyReviews(await db.monthlyReviews.fetchAll()),
      food_records:      async () => setFoodRecords(await db.foodRecords.fetchAll()),
      happy_moments:     async () => setHappyMoments(await db.happyMoments.fetchAll()),
      // user_settings: 토글 등 설정 변경을 다른 탭/기기에 즉시 반영(기존 누락분 보완)
      user_settings:     async () => {
        const s = await db.settings.fetch();
        setDayStartHour(s.dayStartHour);
        setDayEndHour(s.dayEndHour);
        setAppSettings(prev => ({ ...prev, ...s.appSettings }));
      },
    };

    const channels = Object.entries(refetchers).map(([table, refetch]) =>
      supabase
        .channel(`realtime-store:${table}`)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table }, () => {
          void refetch();
        })
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const newId = () => Math.random().toString(36).slice(2, 9);
  const newEventId = () => globalThis.crypto?.randomUUID?.() ?? `${newId()}-${Date.now()}`;

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLockRef.current) return;
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current?.addEventListener?.('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  // 타이머 시간을 todo 에 기록하고 타이머를 정리한다.
  // markDone=false(정지): 상태를 'inProgress' 로 유지(시간만 기록) — "정지→진행중 유지".
  // markDone=true(완료): 상태를 'done' 으로 전환.
  const recordActiveTimer = useCallback((timer: ActiveTimer, markDone: boolean) => {
    const rawElapsedSec = getTimerElapsedSec(timer);
    const totalElapsedSec = timer.mode === 'pomodoro'
      ? Math.min(rawElapsedSec, timer.pomoDurationSec)
      : rawElapsedSec;
    const endHHMM = getTimerEndHHMM(timer.startHHMM, totalElapsedSec);
    const nextStatus: TodoStatus = markDone ? 'done' : 'inProgress';

    setTodos(currentTodos => {
      const updated = currentTodos.map(t =>
        t.id === timer.todoId
          ? { ...t, status: nextStatus, doStart: timer.startHHMM, doEnd: endHHMM, doElapsedSec: totalElapsedSec }
          : t
      );
      const todo = updated.find(t => t.id === timer.todoId);
      if (todo) db.todos.upsert(todo);
      return updated;
    });

    // Stage 3(누적): 이 세션을 시간 블록으로 적재(덮어쓰기 아님). do_* 는 dual-write 로 유지.
    // 블록 날짜 = 타이머 시작 시각의 날짜(자정 자동 일시정지로 하루를 넘기지 않음).
    if (totalElapsedSec > 0) {
      const blockDate = format(new Date(timer.startedAt), 'yyyy-MM-dd');
      const block: TodoTimeBlock = {
        id: newEventId(),
        todoId: timer.todoId,
        date: blockDate,
        start: timer.startHHMM,
        end: endHHMM,
        elapsedSec: totalElapsedSec,
      };
      setTimeBlocks(prev => [...prev, block]);
      void db.todoTimeBlocks.insert(block);
    }

    setActiveTimer(null);
    window.localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const restoreTimerFromStorage = () => {
      try {
        const raw = window.localStorage.getItem(ACTIVE_TIMER_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          taskId: string;
          mode: TimerMode;
          startedAt: number;
          pausedDuration: number;
          isPaused: boolean;
          pomoDuration: number;
          pauseStartedAt?: number | null;
          startHHMM?: string;
        };

        if (!parsed?.taskId || !parsed?.startedAt) return;

        const restoredTimer: ActiveTimer = {
          todoId: parsed.taskId,
          mode: parsed.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch',
          startedAt: parsed.startedAt,
          startHHMM: parsed.startHHMM || format(new Date(parsed.startedAt), 'HH:mm'),
          pausedDurationMs: parsed.pausedDuration ?? 0,
          isPaused: !!parsed.isPaused,
          pauseStartedAt: parsed.isPaused ? (parsed.pauseStartedAt ?? Date.now()) : null,
          pomoDurationSec: parsed.mode === 'pomodoro' ? Math.max(60, parsed.pomoDuration ?? 25 * 60) : 0,
        };

        setActiveTimer(current => current ?? restoredTimer);
      } catch {
        window.localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
      }
    };

    restoreTimerFromStorage();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        restoreTimerFromStorage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!activeTimer) {
      window.localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
      void releaseWakeLock();
      return;
    }

    window.localStorage.setItem(ACTIVE_TIMER_STORAGE_KEY, JSON.stringify({
      taskId: activeTimer.todoId,
      mode: activeTimer.mode,
      startedAt: activeTimer.startedAt,
      pausedDuration: activeTimer.pausedDurationMs,
      isPaused: activeTimer.isPaused,
      pomoDuration: activeTimer.pomoDurationSec,
      pauseStartedAt: activeTimer.pauseStartedAt,
      startHHMM: activeTimer.startHHMM,
    }));

    if (activeTimer.isPaused || document.visibilityState !== 'visible') {
      void releaseWakeLock();
      return;
    }

    void requestWakeLock();
  }, [activeTimer, releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        void releaseWakeLock();
        return;
      }
      if (activeTimer && !activeTimer.isPaused) {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeTimer, releaseWakeLock, requestWakeLock]);

  // ── Todo actions ──
  const addTodo = useCallback((todo: Omit<Todo, 'id'>) => {
    const newTodo: Todo = { ...todo, id: newId(), tags: todo.tags ?? [] };
    setTodos(prev => [...prev, newTodo]);
    db.todos.upsert(newTodo);
  }, []);

  // 반복 가상 인스턴스(`parentId::date`)를 실제 예외 레코드로 구체화하고 실제 todo id를 반환한다.
  // - 비반복 id: 그대로 반환
  // - 이미 해당 날짜 예외가 존재: 그 실제 id 반환
  // - 처음 변경: 부모를 복제한 예외 레코드를 생성(state+ref 즉시 반영, DB 저장은 호출자가 수행)
  // 이로써 체크박스 완료·미루기·상태변경·DO 편집·드래그·타이머가 가상 id에서도 동작한다.
  const ensureMaterializedTodoId = useCallback((id: string): string => {
    if (!isVirtualTodoId(id)) return id;
    const info = parseVirtualTodoId(id);
    if (!info) return id;
    const { parentId, instanceDate } = info;
    const list = todosRef.current;
    const existing = list.find(t => t.recurrenceParentId === parentId && t.date === instanceDate);
    if (existing) return existing.id;
    const parent = list.find(t => t.id === parentId);
    if (!parent) return id;
    const exId = newId();
    const exception: Todo = {
      ...parent,
      doStart: undefined, doEnd: undefined, doElapsedSec: undefined,
      id: exId,
      date: instanceDate,
      recurrenceParentId: parentId,
      recurrenceRule: undefined,
      recurrenceDays: undefined,
      recurrenceEndDate: undefined,
      isException: true,
    };
    todosRef.current = [...list, exception];
    setTodos(prev => [...prev, exception]);
    return exId;
  }, []);

  const updateTodo = useCallback((id: string, changes: Partial<Todo>) => {
    const realId = ensureMaterializedTodoId(id);
    setTodos(prev => {
      const updated = prev.map(t => t.id === realId ? { ...t, ...changes } : t);
      const todo = updated.find(t => t.id === realId);
      if (todo) db.todos.upsert(todo);
      return updated;
    });
  }, [ensureMaterializedTodoId]);

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => {
      return prev.filter(t => t.id !== id);
    });
    db.todos.delete(id);
  }, []);

  // 다중 선택 일괄 삭제 — 로컬 state 1회 필터 + DB batch delete(.in). Realtime(todos 구독)이 타 기기에 반영.
  const deleteTodos = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setTodos(prev => prev.filter(t => !idSet.has(t.id)));
    db.todos.deleteMany(ids);
  }, []);

  // 반복 일정 삭제 (scope: 'this' | 'future' | 'all')
  const deleteRecurringTodo = useCallback((parentId: string, instanceDate: string, scope: 'this' | 'future' | 'all') => {
    if (scope === 'all') {
      // 원본 + 모든 예외 삭제
      setTodos(prev => {
        const toDelete = prev.filter(t => t.id === parentId || t.recurrenceParentId === parentId);
        toDelete.forEach(t => db.todos.delete(t.id));
        return prev.filter(t => t.id !== parentId && t.recurrenceParentId !== parentId);
      });
    } else if (scope === 'future') {
      // 원본의 recurrenceEndDate를 instanceDate 하루 전으로 설정
      setTodos(prev => {
        const endDate = format(addDays(parseISO(instanceDate), -1), 'yyyy-MM-dd');
        const updated = prev.map(t => t.id === parentId ? { ...t, recurrenceEndDate: endDate } : t);
        const parent = updated.find(t => t.id === parentId);
        if (parent) db.todos.upsert(parent);
        return updated;
      });
    } else {
      // 이 인스턴스만 삭제: cancelled 예외 레코드 생성
      setTodos(prev => {
        const parent = prev.find(t => t.id === parentId);
        if (!parent) return prev;
        const exId = newId();
        const exception: Todo = {
          ...parent,
          id: exId,
          date: instanceDate,
          status: 'cancelled',
          recurrenceParentId: parentId,
          recurrenceRule: undefined,
          recurrenceDays: undefined,
          recurrenceEndDate: undefined,
          isException: true,
        };
        db.todos.upsert(exception);
        return [...prev, exception];
      });
    }
  }, []);

  // 반복 일정 수정 (scope: 'this' | 'future' | 'all')
  const updateRecurringTodo = useCallback((parentId: string, instanceDate: string, changes: Partial<Todo>, scope: 'this' | 'future' | 'all') => {
    if (scope === 'all') {
      // 원본 직접 수정
      setTodos(prev => {
        const updated = prev.map(t => t.id === parentId ? { ...t, ...changes } : t);
        const parent = updated.find(t => t.id === parentId);
        if (parent) db.todos.upsert(parent);
        return updated;
      });
    } else if (scope === 'future') {
      // 현재 날짜에서 원본 종료 + 새 반복 이벤트 생성
      setTodos(prev => {
        const endDate = format(addDays(parseISO(instanceDate), -1), 'yyyy-MM-dd');
        const parent = prev.find(t => t.id === parentId);
        if (!parent) return prev;
        const updatedParent = { ...parent, recurrenceEndDate: endDate };
        const newParentId = newId();
        const newParent: Todo = {
          ...parent, ...changes,
          id: newParentId,
          date: instanceDate,
          recurrenceParentId: undefined,
          isException: false,
          doStart: undefined, doEnd: undefined, doElapsedSec: undefined,
        };
        db.todos.upsert(updatedParent);
        db.todos.upsert(newParent);
        return [...prev.map(t => t.id === parentId ? updatedParent : t), newParent];
      });
    } else {
      // 이 인스턴스만 수정: 예외 레코드 생성
      setTodos(prev => {
        const parent = prev.find(t => t.id === parentId);
        if (!parent) return prev;
        const exId = newId();
        const exception: Todo = {
          ...parent, ...changes,
          id: exId,
          date: instanceDate,
          recurrenceParentId: parentId,
          recurrenceRule: undefined,
          recurrenceDays: undefined,
          recurrenceEndDate: undefined,
          isException: true,
        };
        db.todos.upsert(exception);
        return [...prev, exception];
      });
    }
  }, []);

  const toggleTop3 = useCallback((id: string) => {
    setTodos(prev => {
      const todo = prev.find(t => t.id === id);
      if (!todo) return prev;
      const top3Count = prev.filter(t => t.isTop3 && t.date === todo.date && t.id !== id).length;
      if (!todo.isTop3 && top3Count >= 3) return prev;
      const updated = prev.map(t => t.id === id ? { ...t, isTop3: !t.isTop3 } : t);
      const updatedTodo = updated.find(t => t.id === id);
      if (updatedTodo) db.todos.upsert(updatedTodo);
      return updated;
    });
  }, []);

  // ── Event actions ──
  const addEvent = useCallback((event: Omit<Event, 'id'>) => {
    const newEvent: Event = {
      ...event,
      id: newEventId(),
      sourceEventId: undefined,
      tags: event.tags ?? [],
      repeatType: event.repeatType ?? 'none',
      completed: event.completed ?? false,
      isException: event.isException ?? false,
    };
    void db.events.upsert(newEvent).then(() => {
      void db.events.fetchAll().then(setEvents);
    });
  }, []);

  // 반복 가상 occurrence(`parentId::date`)를 실제 예외 행으로 구체화하고 실제 event id 를 반환.
  // - 비가상 id: 그대로 반환
  // - 이미 같은 (parent, occurrence_date) 예외 행이 있으면 그 id 반환
  // - 처음이면 가상 occurrence 의 데이터를 복제한 예외 행을 즉시 state/ref 에 반영하고,
  //   호출자는 그 id 로 updateEvent → db.events.upsert 를 호출해 DB 에 저장한다.
  // 할일 ensureMaterializedTodoId 패턴과 동일.
  const ensureMaterializedEventId = useCallback((id: string): string => {
    if (!isVirtualEventId(id)) return id;
    const info = parseVirtualEventId(id);
    if (!info) return id;
    const { parentId, instanceDate } = info;
    const list = eventsRef.current;
    const existing = list.find(e => e.isException && e.parentEventId === parentId && e.occurrenceDate === instanceDate);
    if (existing) return existing.id;
    const occurrence = list.find(e => e.id === id);
    if (!occurrence) return id;
    const exId = newEventId();
    const exception: Event = {
      ...occurrence,
      id: exId,
      sourceEventId: undefined,
      isOccurrence: false,
      parentEventId: parentId,
      occurrenceDate: instanceDate,
      isException: true,
      // 예외 행은 그 회차 1일짜리 단일 일정으로 저장한다.
      // 반복은 마스터가 담당하므로 예외 행은 repeat 정보를 비움.
      date: instanceDate,
      startDate: instanceDate,
      endDate: instanceDate,
      repeatType: 'none',
      repeatEndDate: undefined,
    };
    // 가상 occurrence 자리를 예외 행으로 교체 (브리프 중복 렌더 방지).
    // 이후 fetchAll 이 완료되면 expandRecurringEvents 가 exMap 으로 동일 결과를 반환.
    eventsRef.current = list.filter(e => e.id !== id).concat(exception);
    setEvents(prev => prev.filter(e => e.id !== id).concat(exception));
    return exId;
  }, []);

  const updateEvent = useCallback((id: string, changes: Partial<Event>) => {
    setEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...changes } : e);
      const event = updated.find(e => e.id === id);
      if (event) {
        void db.events.upsert(event).then(() => {
          void db.events.fetchAll().then(setEvents);
        });
      }
      return updated;
    });
  }, []);

  // 완료 토글 전용: 반복 가상 occurrence 면 그 회차를 예외 행으로 구체화 후 그 행에만 completed 저장.
  // 분기 모달 없이 그 회차만 조용히 처리한다.
  const toggleEventCompleted = useCallback((id: string, completed: boolean) => {
    const realId = ensureMaterializedEventId(id);
    setEvents(prev => {
      const updated = prev.map(e => e.id === realId ? { ...e, completed } : e);
      const event = updated.find(e => e.id === realId);
      if (event) {
        void db.events.upsert(event).then(() => {
          void db.events.fetchAll().then(setEvents);
        });
      }
      return updated;
    });
  }, [ensureMaterializedEventId]);

  // "이대로 실행" — 계획(startTime/endTime)을 실적(doStart/doEnd)으로 복사한다.
  // 완료(completed)와 분리: 위치(actual)만 채우고 completed 는 건드리지 않는다.
  // 계획 시각이 없는 일정(종일·다중일 등)은 no-op. 반복 가상 회차는 그 회차만 예외 행으로 구체화 후 저장.
  const runEventAsPlanned = useCallback((id: string) => {
    const src = eventsRef.current.find(e => e.id === id);
    if (!src || !src.startTime || !src.endTime) return;
    const realId = ensureMaterializedEventId(id);
    updateEvent(realId, { doStart: src.startTime, doEnd: src.endTime });
  }, [ensureMaterializedEventId, updateEvent]);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    void db.events.delete(id).then(() => {
      void db.events.fetchAll().then(setEvents);
    });
  }, []);

  // 일정 미루기 — 단일 일정은 그대로 이동, 반복 일정은 scope(this|future|all)로 분기.
  // 할일 미루기와 동일한 UX를 위해: 탭=다음 날(반복이면 분기 모달), 롱프레스=날짜/시간 지정.
  //   this   = 이 회차만 예외로 구체화해 이동(시리즈 유지)
  //   future = 마스터를 이 회차 전날에 종료 + 이동본(단일) 생성
  //   all    = 시리즈 전체(마스터+예외) 삭제 + 이동본(단일) 생성
  // 반복 가상 occurrence 의 startDate/endDate 는 '마스터'의 기간이므로(회차 날짜 아님) this 이동은
  // ensureMaterializedEventId 가 만든 단일-일 예외행(date=회차일)을 targetDate 로 옮긴다.
  const snoozeEvent = useCallback((
    event: Event,
    targetDate: string,
    opts?: { startTime?: string; endTime?: string; scope?: 'this' | 'future' | 'all' },
  ) => {
    const baseDate = event.date;
    if (!baseDate) return;
    const delta = differenceInCalendarDays(parseISO(targetDate), parseISO(baseDate));
    const shiftDate = (d?: string) => d ? format(addDays(parseISO(d), delta), 'yyyy-MM-dd') : targetDate;
    const timeChanges = {
      ...(opts?.startTime !== undefined ? { startTime: opts.startTime } : {}),
      ...(opts?.endTime !== undefined ? { endTime: opts.endTime } : {}),
    };
    // future/all 스코프에서 생성할 단일 이동본 (반복 정보 제거)
    const singleFrom = (e: Event): Omit<Event, 'id'> => ({
      title: e.title,
      date: targetDate, startDate: targetDate, endDate: targetDate,
      startTime: opts?.startTime ?? e.startTime,
      endTime: opts?.endTime ?? e.endTime,
      isAllDay: e.isAllDay ?? false,
      location: e.location, linkUrl: e.linkUrl, memo: e.memo,
      color: e.color, projectId: e.projectId, tags: e.tags ?? [],
      alertMinutes: e.alertMinutes,
      repeatType: 'none',
    });

    if (!isVirtualEventId(event.id)) {
      // 단일 일정 — 다일 일정도 기간을 유지하며 delta 만큼 이동
      updateEvent(event.id, {
        date: shiftDate(event.date),
        startDate: shiftDate(event.startDate ?? event.date),
        endDate: shiftDate(event.endDate ?? event.date),
        ...timeChanges,
      });
      return;
    }

    const info = parseVirtualEventId(event.id);
    if (!info) return;
    const scope = opts?.scope ?? 'this';

    // 주의: 펼쳐진 events 상태에는 '가상 occurrence'만 있고 '마스터 행'은 없다.
    // 따라서 마스터 갱신/삭제는 state 조회가 아니라 DB 경로로 처리한다:
    //  - deleteEvent(parentId): deleteEventApi 가 id 로 직접 삭제(상태에 없어도 DB 삭제됨)
    //  - db.events.upsert(occurrence): sourceEventId=마스터로 라우팅되어 마스터 행을 갱신
    if (scope === 'all') {
      deleteEvent(info.parentId);
      addEvent(singleFrom(event));
    } else if (scope === 'future') {
      // 마스터의 반복 종료일을 이 회차 전날로 설정(occurrence 경유 upsert → 마스터 행) + 이동본 단일 생성
      const endDate = format(addDays(parseISO(info.instanceDate), -1), 'yyyy-MM-dd');
      void db.events.upsert({ ...event, repeatEndDate: endDate }).then(() => {
        void db.events.fetchAll().then(setEvents);
      });
      addEvent(singleFrom(event));
    } else {
      // this — 이 회차만 단일-일 예외로 구체화 후 targetDate 로 이동
      const exId = ensureMaterializedEventId(event.id);
      updateEvent(exId, {
        date: targetDate, startDate: targetDate, endDate: targetDate,
        ...timeChanges,
      });
    }
  }, [updateEvent, addEvent, deleteEvent, ensureMaterializedEventId]);

  // ── Habit actions ──
  const addHabit = useCallback((name: string) => {
    const newHabit: Habit = { id: newId(), name, checkedDates: [], habitType: 'check', dailyProgress: {}, dailyMemos: {} };
    setHabits(prev => [...prev, newHabit]);
    db.habits.upsert(newHabit);
  }, []);

  const addHabitFull = useCallback((habit: Omit<Habit, 'id'>) => {
    const newHabit: Habit = {
      ...habit, id: newId(),
      habitType: habit.habitType ?? 'check',
      dailyProgress: habit.dailyProgress ?? {},
      dailyMemos: habit.dailyMemos ?? {},
    };
    setHabits(prev => [...prev, newHabit]);
    db.habits.upsert(newHabit);
  }, []);

  const updateHabit = useCallback((id: string, changes: Partial<Habit>) => {
    setHabits(prev => {
      const updated = prev.map(h => h.id === id ? { ...h, ...changes } : h);
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    db.habits.delete(id);
  }, []);

  const toggleHabit = useCallback((id: string, date: string) => {
    setHabits(prev => {
      const updated = prev.map(h => {
        if (h.id !== id) return h;
        const checked = h.checkedDates.includes(date);
        return { ...h, checkedDates: checked ? h.checkedDates.filter(d => d !== date) : [...h.checkedDates, date] };
      });
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  const updateHabitProgress = useCallback((id: string, date: string, value: number) => {
    setHabits(prev => {
      const updated = prev.map(h => {
        if (h.id !== id) return h;
        const newProgress = { ...h.dailyProgress, [date]: value };
        const target = h.targetValue ?? 0;
        const targetSec = h.habitType === 'time' ? target * 60 : target;
        const targetMet = target > 0 && value >= targetSec;
        const wasChecked = h.checkedDates.includes(date);
        const newCheckedDates = targetMet && !wasChecked
          ? [...h.checkedDates, date]
          : !targetMet && wasChecked && h.habitType !== 'check' && h.habitType !== 'memo'
            ? h.checkedDates.filter(d => d !== date)
            : h.checkedDates;
        return { ...h, dailyProgress: newProgress, checkedDates: newCheckedDates };
      });
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  const updateHabitMemo = useCallback((id: string, date: string, memo: string) => {
    setHabits(prev => {
      const updated = prev.map(h => {
        if (h.id !== id) return h;
        return { ...h, dailyMemos: { ...h.dailyMemos, [date]: memo } };
      });
      const habit = updated.find(h => h.id === id);
      if (habit) db.habits.upsert(habit);
      return updated;
    });
  }, []);

  // ── Routine actions ──
  const addRoutine = useCallback((routine: Omit<Routine, 'id'>) => {
    const newRoutine: Routine = { ...routine, id: newId(), checkedDates: routine.checkedDates ?? [] };
    setRoutines(prev => [...prev, newRoutine]);
    db.routines.upsert(newRoutine);
  }, []);

  const updateRoutine = useCallback((id: string, changes: Partial<Routine>) => {
    setRoutines(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...changes } : r);
      const routine = updated.find(r => r.id === id);
      if (routine) db.routines.upsert(routine);
      return updated;
    });
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setRoutines(prev => prev.filter(r => r.id !== id));
    db.routines.delete(id);
  }, []);

  const toggleRoutineDate = useCallback((id: string, date: string) => {
    setRoutines(prev => {
      const updated = prev.map(r => {
        if (r.id !== id) return r;
        const checked = r.checkedDates.includes(date);
        return { ...r, checkedDates: checked ? r.checkedDates.filter(d => d !== date) : [...r.checkedDates, date] };
      });
      const routine = updated.find(r => r.id === id);
      if (routine) db.routines.upsert(routine);
      return updated;
    });
  }, []);

  // ── Self-care actions ──
  const addSelfCareRecord = useCallback((record: Omit<SelfCareRecord, 'id'>) => {
    const newRecord: SelfCareRecord = { ...record, id: newId() };
    setSelfCareRecords(prev => [...prev, newRecord]);
    db.selfCareRecords.upsert(newRecord);
  }, []);

  const updateSelfCareRecord = useCallback((id: string, changes: Partial<Omit<SelfCareRecord, 'id'>>) => {
    setSelfCareRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.selfCareRecords.upsert(updated);
      return updated;
    }));
  }, []);

  const deleteSelfCareRecord = useCallback((id: string) => {
    setSelfCareRecords(prev => prev.filter(r => r.id !== id));
    db.selfCareRecords.delete(id);
  }, []);

  // ── HabitMonthlyMemo actions ──
  const setHabitMonthlyMemo = useCallback((
    habitId: string,
    year: number,
    month: number,
    data: Partial<Omit<HabitMonthlyMemo, 'id' | 'habitId' | 'year' | 'month'>>
  ) => {
    setHabitMonthlyMemos(prev => {
      const existing = prev.find(m => m.habitId === habitId && m.year === year && m.month === month);
      if (existing) {
        const updated = { ...existing, ...data };
        db.habitMonthlyMemos.upsert(updated);
        return prev.map(m => m.habitId === habitId && m.year === year && m.month === month ? updated : m);
      } else {
        const created: HabitMonthlyMemo = {
          id: newId(), habitId, year, month,
          memo: '', whatWorked: '', whatDidntWork: '', nextMonth: '',
          ...data,
        };
        db.habitMonthlyMemos.upsert(created);
        return [...prev, created];
      }
    });
  }, []);

  // ── Food actions ──
  const addFoodRecord = useCallback((record: Omit<FoodRecord, 'id'>) => {
    const newRecord: FoodRecord = { ...record, id: newId() };
    setFoodRecords(prev => [...prev, newRecord]);
    db.foodRecords.upsert(newRecord);
  }, []);

  const updateFoodRecord = useCallback((id: string, changes: Partial<Omit<FoodRecord, 'id'>>) => {
    setFoodRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.foodRecords.upsert(updated);
      return updated;
    }));
  }, []);

  const deleteFoodRecord = useCallback((id: string) => {
    setFoodRecords(prev => prev.filter(r => r.id !== id));
    db.foodRecords.delete(id);
  }, []);

  // ── Period actions ──
  const addPeriodRecord = useCallback((record: Omit<PeriodRecord, 'id'>) => {
    const newRecord: PeriodRecord = { ...record, id: newId() };
    setPeriodRecords(prev => [...prev, newRecord].sort((a, b) => b.startDate.localeCompare(a.startDate)));
    db.periodRecords.upsert(newRecord);
  }, []);

  const updatePeriodRecord = useCallback((id: string, changes: Partial<PeriodRecord>) => {
    setPeriodRecords(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...changes } : r);
      const record = updated.find(r => r.id === id);
      if (record) db.periodRecords.upsert(record);
      return updated;
    });
  }, []);

  const deletePeriodRecord = useCallback((id: string) => {
    setPeriodRecords(prev => prev.filter(r => r.id !== id));
    db.periodRecords.delete(id);
  }, []);

  // ── Review actions ──
  const addReviewRecord = useCallback((record: Omit<ReviewRecord, 'id'>) => {
    const newRecord: ReviewRecord = { ...record, id: newId() };
    setReviewRecords(prev => [...prev, newRecord]);
    db.reviewRecords.upsert(newRecord);
  }, []);

  // 부분 업데이트(머지): undefined 값 키는 무시해 기존 레코드 값을 보존한다.
  // (현재 ReviewsView 는 매번 전체 필드를 전송하며 선택 안 한 타입은 undefined 로 보내므로,
  //  머지 없이 그대로 덮으면 daily_*/kpt_* 등 다른 날 적힌 값이 유실될 위험이 있었다.)
  const updateReviewRecord = useCallback((id: string, changes: Partial<ReviewRecord>) => {
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, v]) => v !== undefined)
    ) as Partial<ReviewRecord>;
    setReviewRecords(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...defined } : r);
      const record = updated.find(r => r.id === id);
      if (record) db.reviewRecords.upsert(record);
      return updated;
    });
  }, []);

  const deleteReviewRecord = useCallback((id: string) => {
    setReviewRecords(prev => prev.filter(r => r.id !== id));
    db.reviewRecords.delete(id);
  }, []);

  const addWeeklyReview = useCallback((review: Omit<WeeklyReview, 'id'>) => {
    const newReview = { ...review, id: newId() };
    setWeeklyReviews(prev => [...prev, newReview]);
    db.weeklyReviews.upsert(newReview);
  }, []);

  const updateWeeklyReview = useCallback((id: string, changes: Partial<WeeklyReview>) => {
    setWeeklyReviews(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.weeklyReviews.upsert(updated);
      return updated;
    }));
  }, []);

  const addMonthlyReview = useCallback((review: Omit<MonthlyReview, 'id'>) => {
    const newReview = { ...review, id: newId() };
    setMonthlyReviews(prev => [...prev, newReview]);
    db.monthlyReviews.upsert(newReview);
  }, []);

  const updateMonthlyReview = useCallback((id: string, changes: Partial<MonthlyReview>) => {
    setMonthlyReviews(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...changes };
      db.monthlyReviews.upsert(updated);
      return updated;
    }));
  }, []);

  // ── Happy moment actions (행복 기록) ──
  const addHappyMoment = useCallback((content: string, date: string, happenedAt: string | null = null) => {
    const newMoment: HappyMoment = {
      id: newEventId(),
      content,
      date,
      happenedAt,
      createdAt: new Date().toISOString(),
    };
    setHappyMoments(prev => [newMoment, ...prev]);
    db.happyMoments.upsert(newMoment);
  }, []);

  const deleteHappyMoment = useCallback((id: string) => {
    setHappyMoments(prev => prev.filter(m => m.id !== id));
    db.happyMoments.delete(id);
  }, []);

  // ── Weekly goal actions ──
  const addWeeklyGoal = useCallback((text: string, monthlyGoalId: string | undefined, weekKey: string) => {
    const newGoal: WeeklyGoal = { id: newId(), text, done: false, monthlyGoalId, weekKey };
    setWeeklyGoals(prev => [...prev, newGoal]);
    db.weeklyGoals.upsert(newGoal);
  }, []);

  const toggleWeeklyGoal = useCallback((id: string) => {
    setWeeklyGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, done: !g.done } : g);
      const goal = updated.find(g => g.id === id);
      if (goal) db.weeklyGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteWeeklyGoal = useCallback((id: string) => {
    setWeeklyGoals(prev => prev.filter(g => g.id !== id));
    db.weeklyGoals.delete(id);
  }, []);

  // ── Monthly goal actions ──
  const addMonthlyGoal = useCallback((text: string, annualGoalId: string, month: string, projectId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || !annualGoalId) return;
    const newGoal: MonthlyGoal = { id: newId(), text: trimmed, month, projectId, annualGoalId };
    setMonthlyGoals(prev => [...prev, newGoal]);
    db.monthlyGoals.upsert(newGoal);
  }, []);

  const updateMonthlyGoal = useCallback((id: string, changes: Partial<Pick<MonthlyGoal, 'text' | 'annualGoalId' | 'projectId'>>) => {
    setMonthlyGoals(prev => {
      const updated = prev.map(g => (g.id === id ? { ...g, ...changes } : g));
      const goal = updated.find(g => g.id === id);
      if (goal) db.monthlyGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteMonthlyGoal = useCallback((id: string) => {
    setMonthlyGoals(prev => prev.filter(g => g.id !== id));
    db.monthlyGoals.delete(id);
  }, []);

  // ── Annual goal actions ──
  const addAnnualGoal = useCallback((text: string, year: number) => {
    const newGoal: AnnualGoal = { id: newId(), text, year, done: false };
    setAnnualGoals(prev => [...prev, newGoal]);
    db.annualGoals.upsert(newGoal);
  }, []);

  const toggleAnnualGoal = useCallback((id: string) => {
    setAnnualGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, done: !g.done } : g);
      const goal = updated.find(g => g.id === id);
      if (goal) db.annualGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteAnnualGoal = useCallback((id: string) => {
    setAnnualGoals(prev => {
      const victim = prev.find(g => g.id === id);
      if (!victim) return prev;
      const replacement = prev.find(g => g.id !== id && g.year === victim.year)?.id;
      setMonthlyGoals(mgPrev => {
        const next = mgPrev.map(mg =>
          mg.annualGoalId === id ? { ...mg, annualGoalId: replacement } : mg
        );
        next.forEach(g => {
          const o = mgPrev.find(x => x.id === g.id);
          if (o && o.annualGoalId !== g.annualGoalId) db.monthlyGoals.upsert(g);
        });
        return next;
      });
      db.annualGoals.delete(id);
      return prev.filter(g => g.id !== id);
    });
  }, []);

  // ── Quarterly goal actions ──
  const addQuarterlyGoal = useCallback((text: string, year: number, quarter: number) => {
    const newGoal: QuarterlyGoal = { id: newId(), text, year, quarter, done: false };
    setQuarterlyGoals(prev => [...prev, newGoal]);
    db.quarterlyGoals.upsert(newGoal);
  }, []);

  const toggleQuarterlyGoal = useCallback((id: string) => {
    setQuarterlyGoals(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, done: !g.done } : g);
      const goal = updated.find(g => g.id === id);
      if (goal) db.quarterlyGoals.upsert(goal);
      return updated;
    });
  }, []);

  const deleteQuarterlyGoal = useCallback((id: string) => {
    setQuarterlyGoals(prev => prev.filter(g => g.id !== id));
    db.quarterlyGoals.delete(id);
  }, []);

  // ── Brainstorm actions ──
  const addBrainstormItem = useCallback((text: string, date: string) => {
    const newItem: BrainstormItem = { id: newId(), text, date };
    setBrainstormItems(prev => [...prev, newItem]);
    db.brainstormItems.upsert(newItem);
  }, []);

  const deleteBrainstormItem = useCallback((id: string) => {
    setBrainstormItems(prev => prev.filter(b => b.id !== id));
    db.brainstormItems.delete(id);
  }, []);

  const brainstormToTodo = useCallback((id: string, date?: string) => {
    setBrainstormItems(prev => {
      const item = prev.find(b => b.id === id);
      if (!item) return prev;
      const newTodo: Todo = { id: newId(), text: item.text, date: date ?? item.date, status: 'active', isTop3: false, tags: [] };
      setTodos(t => {
        db.todos.upsert(newTodo);
        return [...t, newTodo];
      });
      db.brainstormItems.delete(id);
      return prev.filter(b => b.id !== id);
    });
  }, []);

  const brainstormToEvent = useCallback((id: string, eventData: { date: string; startTime?: string; endTime?: string; location?: string; tags?: string[] }) => {
    setBrainstormItems(prev => {
      const item = prev.find(b => b.id === id);
      if (!item) return prev;
      const newEvent: Event = {
        id: newEventId(),
        title: item.text,
        date: eventData.date,
        startDate: eventData.date,
        endDate: eventData.date,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        location: eventData.location,
        tags: eventData.tags ?? [],
        repeatType: 'none',
        completed: false,
      };
      void db.events.upsert(newEvent).then(() => {
        void db.events.fetchAll().then(setEvents);
      });
      db.brainstormItems.delete(id);
      return prev.filter(b => b.id !== id);
    });
  }, []);

  const setBrainstormMemo = useCallback((date: string, text: string) => {
    setBrainstormMemos(prev => ({ ...prev, [date]: text }));
    db.brainstormMemos.upsert(date, text);
  }, []);

  const addWeeklyBrainstorm = useCallback((text: string, weekKey: string) => {
    const newItem: BrainstormItem = { id: newId(), text, date: today, weekKey };
    setBrainstormItems(prev => [...prev, newItem]);
    db.brainstormItems.upsert(newItem);
  }, []);

  const weeklyBrainstormAssign = useCallback((id: string, date: string) => {
    setBrainstormItems(prev => {
      const item = prev.find(b => b.id === id);
      if (!item) return prev;
      const newTodo: Todo = { id: newId(), text: item.text, date, status: 'active', isTop3: false, tags: [] };
      setTodos(t => {
        db.todos.upsert(newTodo);
        return [...t, newTodo];
      });
      db.brainstormItems.delete(id);
      return prev.filter(b => b.id !== id);
    });
  }, []);

  // ── Timer actions ──
  const startTimer = useCallback((todoId: string, options?: { mode?: TimerMode; pomoDurationSec?: number }) => {
    if (activeTimer && activeTimer.todoId !== todoId) return;
    const mode = options?.mode ?? 'stopwatch';
    const pomoDurationSec = mode === 'pomodoro' ? Math.max(60, options?.pomoDurationSec ?? 25 * 60) : 0;

    // 반복 가상 인스턴스면 실제 예외 레코드로 구체화한 뒤 그 실제 id로 타이머를 건다.
    const realId = ensureMaterializedTodoId(todoId);
    setTodos(prev => {
      const updated = prev.map(t =>
        t.id === realId
          ? { ...t, status: 'inProgress' as TodoStatus, startedDate: t.startedDate ?? format(new Date(), 'yyyy-MM-dd'), doStart: undefined, doEnd: undefined, doElapsedSec: undefined }
          : t
      );
      const todo = updated.find(t => t.id === realId);
      if (todo) db.todos.upsert(todo);
      return updated;
    });
    setActiveTimer(prev => {
      if (prev) return prev;
      const now = new Date();
      return {
        todoId: realId,
        mode,
        startedAt: now.getTime(),
        startHHMM: format(now, 'HH:mm'),
        pausedDurationMs: 0,
        isPaused: false,
        pauseStartedAt: null,
        pomoDurationSec,
      };
    });
  }, [activeTimer, ensureMaterializedTodoId]);

  const pauseTimer = useCallback(() => {
    setActiveTimer(prev => {
      if (!prev || prev.isPaused) return prev;
      return {
        ...prev,
        isPaused: true,
        pauseStartedAt: Date.now(),
      };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setActiveTimer(prev => {
      if (!prev || !prev.isPaused) return prev;
      const pausedFor = prev.pauseStartedAt ? Date.now() - prev.pauseStartedAt : 0;
      return {
        ...prev,
        isPaused: false,
        pauseStartedAt: null,
        pausedDurationMs: prev.pausedDurationMs + Math.max(0, pausedFor),
      };
    });
  }, []);

  // 정지: 시간만 기록하고 상태는 '진행중' 유지 (완료 아님).
  const stopTimer = useCallback(() => {
    if (!activeTimer) return;
    recordActiveTimer(activeTimer, false);
  }, [activeTimer, recordActiveTimer]);

  // 완료: 시간 기록 + 상태 'done' 전환 (체크박스로 완료 처리할 때).
  const finishActiveTimer = useCallback(() => {
    if (!activeTimer) return;
    recordActiveTimer(activeTimer, true);
  }, [activeTimer, recordActiveTimer]);

  // 시간 블록 삭제 (잘못 기록된 세션 제거).
  const deleteTimeBlock = useCallback((id: string) => {
    setTimeBlocks(prev => prev.filter(b => b.id !== id));
    void db.todoTimeBlocks.delete(id);
  }, []);

  // 시간 블록 수정 (타임라인에서 막대 드래그/리사이즈).
  const updateTimeBlock = useCallback((id: string, changes: Partial<TodoTimeBlock>) => {
    setTimeBlocks(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...changes } : b);
      const block = updated.find(b => b.id === id);
      if (block) void db.todoTimeBlocks.update(block);
      return updated;
    });
  }, []);

  // 자정 자동 일시정지: 진행 중 타이머가 날짜를 넘기지 않도록 00:00 에 일시정지.
  // (경과 시간이 다음 날로 새지 않게 — Stage 3 날짜별 블록 적재의 전제)
  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) return;
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
    const ms = Math.max(1000, nextMidnight.getTime() - now.getTime());
    const id = window.setTimeout(() => { pauseTimer(); }, ms);
    return () => window.clearTimeout(id);
  }, [activeTimer, pauseTimer]);

  // ── Project actions ──
  const addProject = useCallback((project: Omit<Project, 'id'>) => {
    const newProject: Project = { ...project, id: newId() };
    setProjects(prev => [...prev, newProject]);
    db.projects.upsert(newProject);
    return newProject.id;
  }, []);

  const updateProject = useCallback((id: string, changes: Partial<Project>) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...changes } : p);
      const project = updated.find(p => p.id === id);
      if (project) db.projects.upsert(project);
      return updated;
    });
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setMilestones(prev => prev.filter(m => m.projectId !== id));
    db.projects.delete(id);
    db.milestones.deleteByProject(id);
  }, []);

  // ── Milestone actions ──
  const addMilestone = useCallback((milestone: Omit<Milestone, 'id'>) => {
    const newMilestone: Milestone = { ...milestone, id: newId() };
    setMilestones(prev => [...prev, newMilestone]);
    db.milestones.upsert(newMilestone);
  }, []);

  const toggleMilestone = useCallback((id: string) => {
    setMilestones(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, done: !m.done } : m);
      const milestone = updated.find(m => m.id === id);
      if (milestone) db.milestones.upsert(milestone);
      return updated;
    });
  }, []);

  const deleteMilestone = useCallback((id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
    db.milestones.delete(id);
  }, []);

  // ── Tag actions ──
  const addTag = useCallback((name: string, color: string, trackTime = false): Tag => {
    const newTag: Tag = { id: newId(), name, color, trackTime };
    setTags(prev => [...prev, newTag]);
    db.tags.upsert(newTag);
    return newTag;
  }, []);

  const updateTag = useCallback((id: string, changes: Partial<Tag>) => {
    setTags(prev => {
      const updated = prev.map(tg => tg.id === id ? { ...tg, ...changes } : tg);
      const tag = updated.find(tg => tg.id === id);
      if (tag) db.tags.upsert(tag);
      return updated;
    });
  }, []);

  const deleteTag = useCallback((id: string) => {
    setTags(prev => prev.filter(tg => tg.id !== id));
    setTodos(prev => {
      const updatedTodos = prev.map(t => ({ ...t, tags: (t.tags || []).filter(tid => tid !== id) }));
      updatedTodos.forEach(todo => db.todos.upsert(todo));
      return updatedTodos;
    });
    db.tags.delete(id);
  }, []);

  // ── Settings actions ──
  const setDayHours = useCallback((s: number, e: number) => {
    setDayStartHour(s);
    setDayEndHour(e);
    setCurrentDayEndHour(e);
    db.settings.upsert(s, e, appSettings);
  }, [appSettings]);

  const updateAppSettings = useCallback((changes: Partial<AppSettings>) => {
    setAppSettings(prev => {
      const next = { ...prev, ...changes };
      db.settings.upsert(dayStartHour, dayEndHour, next);
      return next;
    });
  }, [dayStartHour, dayEndHour]);

  // ── Timeline log actions ──
  const addTimelineLog = useCallback((log: Omit<TimelineLog, 'id'>) => {
    const newLog: TimelineLog = { ...log, id: newId() };
    setTimelineLogs(prev => [...prev, newLog]);
    db.timelineLogs.upsert(newLog);
  }, []);

  const deleteTimelineLog = useCallback((id: string) => {
    setTimelineLogs(prev => prev.filter(l => l.id !== id));
    db.timelineLogs.delete(id);
  }, []);

  const setDailyAffirmation = useCallback((date: string, text: string) => {
    setDailyAffirmations(prev => ({ ...prev, [date]: text }));
  }, []);

  return (
    <PlannerContext.Provider value={{
      isLoading,
      selectedDate, setSelectedDate,
      todos, timeBlocks, deleteTimeBlock, updateTimeBlock, events, habits, weeklyGoals, monthlyGoals, annualGoals, quarterlyGoals, brainstormItems, brainstormMemos, activeTimer,
      projects, milestones, tags,
      routines, selfCareRecords, periodRecords, reviewRecords, weeklyReviews, monthlyReviews,
      happyMoments,
      timelineLogs,
      dailyAffirmations, setDailyAffirmation,
      appSettings, updateAppSettings,
      addTodo, updateTodo, deleteTodo, deleteTodos, toggleTop3, deleteRecurringTodo, updateRecurringTodo,
      addEvent, updateEvent, deleteEvent, toggleEventCompleted, runEventAsPlanned, snoozeEvent,
      addHabit, addHabitFull, updateHabit, deleteHabit, toggleHabit,
      updateHabitProgress, updateHabitMemo,
      habitMonthlyMemos, setHabitMonthlyMemo,
      addRoutine, updateRoutine, deleteRoutine, toggleRoutineDate,
      addSelfCareRecord, updateSelfCareRecord, deleteSelfCareRecord,
      foodRecords, addFoodRecord, updateFoodRecord, deleteFoodRecord,
      addPeriodRecord, updatePeriodRecord, deletePeriodRecord,
      addReviewRecord, updateReviewRecord, deleteReviewRecord,
      addWeeklyReview, updateWeeklyReview,
      addMonthlyReview, updateMonthlyReview,
      addHappyMoment, deleteHappyMoment,
      addWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
      addMonthlyGoal, updateMonthlyGoal, deleteMonthlyGoal,
      addAnnualGoal, toggleAnnualGoal, deleteAnnualGoal,
      addQuarterlyGoal, toggleQuarterlyGoal, deleteQuarterlyGoal,
      addBrainstormItem, deleteBrainstormItem, brainstormToTodo, brainstormToEvent,
      setBrainstormMemo,
      addWeeklyBrainstorm, weeklyBrainstormAssign,
      startTimer, pauseTimer, resumeTimer, stopTimer, finishActiveTimer,
      addProject, updateProject, deleteProject,
      addMilestone, toggleMilestone, deleteMilestone,
      addTag, updateTag, deleteTag,
      addTimelineLog, deleteTimelineLog,
      dayStartHour, dayEndHour, setDayHours,
    }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider');
  return ctx;
}
