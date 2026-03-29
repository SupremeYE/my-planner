# PROJECT_SPEC.md — My Planner PWA 기능 명세서

> 최종 업데이트: 2026-03-29 (모바일 하단 네비 개선 + ConfirmModal + 모바일 반응형 개선)

---

## 1. 전체 페이지 목록과 각 기능

| 경로 | 컴포넌트 | 주요 기능 |
|------|---------|---------|
| `/` | → `/dashboard` 리다이렉트 | — |
| `/dashboard` | `DashboardView` | 통계 카드, 오늘 습관 체크, Top3 할일, 주간 진행률 |
| `/daily` | `DailyView` | PLAN/DO 타임라인, 스톱워치, 할일 CRUD, 타임라인 로그 |
| `/calendar` | `CalendarView` | 월/주/일 뷰, 필터 탭(할일·일정·습관·자기관리), 날짜 이동 |
| `/weekly` | `WeeklyView` | 브레인덤프, 일별 칼럼, 주간 목표, 요일 배정 |
| `/monthly` | `MonthlyView` | 월간 목표, 주간 목표 서브리스트, 월간 통계 |
| `/backlog` | `BacklogView` | 날짜 미지정 할일 목록, 카테고리 필터, 날짜 배정 |
| `/projects` | `ProjectsView` | 프로젝트 목록, 신규 프로젝트 생성 |
| `/projects/:id` | `ProjectDetailView` | 마일스톤 CRUD, 관련 할일 목록 |
| `/brainstorm` | `BrainstormView` | 아이디어 입력, 할일·일정으로 변환 |
| `/habits` | `HabitsView` | 습관 CRUD, 반복 설정, 5종 목표 유형 체크칩, 연속달성일, 월간 통계 |
| `/routines` | `RoutinesView` | 루틴 CRUD, 단계 체크 + 카운트다운 타이머, 연속달성일 |
| `/selfcare` | `SelfCareView` | 운동/공부/뷰티 기록, 월간 통계 |
| `/reviews` | `ReviewsView` | 감정·감사·KPT·데일리리뷰, 주간/월간 리뷰 |

### 1-1. 페이지별 상세 기능

#### `/daily` — 일간 뷰
- 날짜 이동 (전후 화살표, 오늘 버튼)
- 할일 목록 (상태별: 예정/진행중/완료/미루기/취소)
- Top3 중요 할일 표시
- 타임라인: PLAN(계획) / DO(실행) 블록
  - 블록 드래그로 이동/리사이징
  - 스톱워치 → 자동으로 DO 시간 기록
- 현재 시간 지시선
- 이벤트(일정) 블록 표시
- 타임라인 로그 (생각/감정 기록)
- 시간대 설정 모달 (전역 저장)
- 할일 추가/편집 모달
- 우클릭 컨텍스트 메뉴 (상태 변경)
- 미루기 모달

#### `/calendar` — 캘린더
- 월별 뷰: 7×7 그리드, 칩 표시(최대 4개 + 오버플로우)
- 주별 뷰: 일별 PLAN/DO 블록 타임라인
- 일별 뷰: 미니 타임테이블
- 필터 탭: 전체 / 할일 / 일정 / 습관 / 자기관리
- 날짜 클릭 → 일간 뷰로 이동

#### `/weekly` — 주간 뷰
- 브레인덤프 아이템 목록
- 요일 배정 팝오버 (아이디어 → 특정 날 할일 변환)
- 일별 칸반 칼럼 (요일별 할일 + 완료율 표시)
- 할일 카드 드래그앤드롭으로 날짜 이동 (@dnd-kit)
  - 드래그 중 카드 반투명 + 드롭 영역 강조 + "여기에 놓기" 표시
  - 드롭 시 `updateTodo` → Supabase 즉시 저장
- 주간 목표 CRUD

#### `/monthly` — 월간 뷰
- 월간 목표 카드 (진행률 바)
- 주간 목표 서브리스트 (접기/펼치기)
- 월간 완료 할일 수 / 달성률 통계

#### `/habits` — 습관
- 습관 추가/편집/삭제 모달
- 반복 설정: 매일 / 평일 / 주말 / 커스텀(요일 선택)
- **5종 목표 유형 (HabitChip)**:
  - `check`: 원형 체크 버튼
  - `count`: − / + 카운터, 목표 달성 시 자동 체크
  - `time`: 타이머 (시작/정지, 누적 시간 저장)
  - `value`: 인라인 숫자 입력 + 단위
  - `memo`: 체크 후 인라인 메모 입력
- 연속 달성일(streak) 표시
- 월간 달성률 그래프/통계

#### `/routines` — 루틴 실행
- 루틴 추가/편집/삭제 모달 (이름, 아이콘, 시작시간, 소요시간, 단계 목록)
- `RoutineCard`: 아이콘, 이름, 시간, 소요시간, 연속달성일 배지
- `ExecutionPanel`: 하단 시트
  - SVG 원형 카운트다운 타이머
  - 단계별 체크박스
  - "완료로 기록" 버튼 → `checked_dates` 토글 → Supabase 저장
- 연속 달성일(streak) 계산
- 완료 루틴은 하단으로 정렬 (미완료 → 시작시간 순)

#### `/selfcare` — 자기관리
- 카테고리: 운동 & 피트니스 / 퇴근 후 공부 / 뷰티 & 케어
- 기록 추가/삭제 (날짜, 내용, 소요시간)
- 월간 통계: 총 시간, 횟수, 평균 시간

#### `/reviews` — 리뷰 & 기록
- **일간 리뷰**: 감정 레벨(1-5), 감사 항목 3개, KPT, 행복한 일, 데일리 요약
- **기록 목록**: 날짜별 리뷰 카드
- **주간 리뷰**: 좋았던 것 / 힘들었던 것 / 다음 주 다짐
- **월간 리뷰**: 이달 성취 / 다음 달 집중

#### `/brainstorm` — 브레인스토밍
- 아이디어 텍스트 입력
- 변환: 할일로 만들기 (날짜 선택)
- 변환: 일정으로 만들기 (날짜, 시간, 장소, 태그)

#### `/backlog` — 보관함
- 백로그 할일 목록 (날짜 미지정 또는 status='backlog')
- 카테고리 필터
- 날짜 배정으로 활성화

---

## 2. DB 테이블 구조 (Supabase)

### 2-1. 연동된 테이블 목록

| 테이블명 | 설명 | 정렬 기준 | 코드 연동 |
|---------|------|---------|:--------:|
| `todos` | 할일 | `created_at` ASC | ✅ |
| `habits` | 습관 | `created_at` ASC | ✅ |
| `projects` | 프로젝트 | `created_at` ASC | ✅ |
| `milestones` | 프로젝트 마일스톤 | `date` ASC | ✅ |
| `self_care_records` | 자기관리 기록 | `date` DESC | ✅ |
| `review_records` | 리뷰 기록 | `date` DESC | ✅ |
| `timeline_logs` | 타임라인 로그 | `date` ASC, `time` ASC | ✅ |
| `user_settings` | 앱 설정 (타임라인 시간대) | — (싱글톤) | ✅ |
| `events` | 일정 | `date` ASC | ✅ |
| `weekly_goals` | 주간 목표 | `created_at` ASC | ✅ |
| `monthly_goals` | 월간 목표 | `created_at` ASC | ✅ |
| `brainstorm_items` | 브레인스톰 항목 | `created_at` ASC | ✅ |
| `brainstorm_memos` | 브레인스톰 날짜별 메모 | — (date PK) | ✅ |
| `tags` | 태그 | `created_at` ASC | ✅ |
| `routines` | 루틴 | `created_at` ASC | ✅ |

### 2-2. 테이블별 컬럼 상세

#### `todos`
```
id              text        PK
text            text        할일 내용
date            text|null   날짜 (yyyy-MM-dd)
due_date        text|null   마감일
status          text        active|inProgress|done|snoozed|backlog|cancelled
is_top3         boolean     중요 할일 여부
plan_start      text|null   계획 시작시간 (HH:mm)
plan_end        text|null   계획 종료시간 (HH:mm)
do_start        text|null   실행 시작시간 (HH:mm)
do_end          text|null   실행 종료시간 (HH:mm)
category        text|null   카테고리
project_id      text|null   연결된 프로젝트 ID
tags            text[]      태그 ID 배열
```

#### `habits`
```
id              text        PK
name            text        습관 이름
checked_dates   text[]      체크된 날짜 배열 (yyyy-MM-dd)
icon            text|null   이모지 아이콘
repeat          text|null   daily|weekday|weekend|custom
repeat_days     int[]|null  반복 요일 (0=일 ~ 6=토)
goal_text       text|null   목표 텍스트 (check 타입용)
alarm_time      text|null   알람 시간 (HH:mm)
category        text|null   health|selfdev|routine|other
color           text|null   색상 hex
habit_type      text        check|count|time|value|memo (기본값: 'check')
target_value    integer|null 목표 수치 (count=횟수, time=분, value=수치)
value_unit      text|null   수치 단위 (value 타입용)
daily_progress  jsonb       날짜별 진행 수치 { "yyyy-MM-dd": number }
daily_memos     jsonb       날짜별 메모 { "yyyy-MM-dd": string }
```

#### `projects`
```
id              text        PK
name            text        프로젝트 이름
color           text        색상 hex
description     text|null   설명
start_date      text|null   시작일 (yyyy-MM-dd)
end_date        text|null   종료일 (yyyy-MM-dd)
status          text        active|completed|paused
```

#### `milestones`
```
id              text        PK
project_id      text        FK → projects.id
title           text        마일스톤 제목
date            text        날짜 (yyyy-MM-dd)
done            boolean     완료 여부
```

#### `self_care_records`
```
id              text        PK
date            text        날짜 (yyyy-MM-dd)
category        text        exercise|study|beauty
content         text        기록 내용
duration        int         소요 시간 (분)
```

#### `review_records`
```
id              text        PK
date            text        날짜 (yyyy-MM-dd)
types           text[]      리뷰 유형 배열
emotion         int|null    감정 레벨 (1~5)
emotion_memo    text|null   감정 메모
gratitude       text[]|null 감사 항목
kpt_keep        text|null   KPT - Keep
kpt_problem     text|null   KPT - Problem
kpt_try         text|null   KPT - Try
happiness       text|null   행복한 일
daily_summary   text|null   데일리 요약
daily_good      text|null   잘한 점
daily_improve   text|null   개선할 점
```

#### `timeline_logs`
```
id              text        PK
date            text        날짜 (yyyy-MM-dd)
time            text        시간 (HH:mm)
text            text        로그 내용
color           text|null   색상 hex
icon            text|null   이모지 아이콘
```

#### `user_settings`
```
id              text        PK (항상 'default')
day_start_hour  int         타임라인 시작 시간 (기본값: 4)
day_end_hour    int         타임라인 종료 시간 (기본값: 26 = 다음날 2시)
```

#### `events`
```
id              text        PK
title           text        일정 제목
date            text        날짜 (yyyy-MM-dd)
start_time      text|null   시작 시간 (HH:mm)
end_time        text|null   종료 시간 (HH:mm)
location        text|null   장소
memo            text|null   메모
tags            text[]      태그 ID 배열 (기본값: {})
created_at      timestamptz 생성일시
```

#### `weekly_goals`
```
id              text        PK
text            text        목표 내용
done            boolean     완료 여부 (기본값: false)
monthly_goal_id text|null   연결된 월간 목표 ID
week_key        text        주차 키 (예: 2026-W12)
created_at      timestamptz 생성일시
```

#### `monthly_goals`
```
id              text        PK
text            text        목표 내용
month           text        월 (예: 2026-03)
project_id      text|null   연결된 프로젝트 ID
created_at      timestamptz 생성일시
```

#### `brainstorm_items`
```
id              text        PK
text            text        아이디어 내용
date            text        날짜 (yyyy-MM-dd)
week_key        text|null   주차 키 (예: 2026-W12)
created_at      timestamptz 생성일시
```

#### `brainstorm_memos`
```
date            text        PK (날짜 yyyy-MM-dd)
text            text        메모 내용
```

#### `tags`
```
id              text        PK
name            text        태그 이름
color           text        색상 hex
created_at      timestamptz 생성일시
```

#### `routines`
```
id              text        PK
name            text        루틴 이름
icon            text        이모지 아이콘
start_time      text|null   시작 시간 (HH:mm)
duration        int|null    소요 시간 (분)
steps           text[]      단계 목록
checked_dates   text[]      완료 날짜 배열 (yyyy-MM-dd)
created_at      timestamptz 생성일시
```

---

## 3. 페이지간 데이터 연동 관계

```
store.tsx (PlannerContext)
│
├── todos ──────────────────── DailyView (CRUD), BacklogView (CRUD)
│                              WeeklyView (조회), DashboardView (조회)
│                              CalendarView (조회), ProjectDetailView (조회)
│
├── habits ─────────────────── HabitsView (CRUD + toggle)
│                              DailyView (조회 + toggle)
│                              DashboardView (조회)
│                              CalendarView (조회)
│
├── projects ───────────────── ProjectsView (CRUD)
│                              ProjectDetailView (CRUD)
│                              Layout 사이드바 (조회)
│
├── milestones ─────────────── ProjectDetailView (CRUD)
│
├── selfCareRecords ─────────── SelfCareView (CRUD)
│                              CalendarView (조회)
│
├── reviewRecords ──────────── ReviewsView (CRUD)
│
├── timelineLogs (전역) ────── DailyView ← ✅ store 연동 완료
│
├── dayStartHour/dayEndHour ── DailyView (타임라인 범위)
│                              CalendarView (주별/일별 뷰 범위)
│
├── events ─────────────────── DailyView (조회), CalendarView (조회)
│                              BrainstormView (변환 시 생성) → Supabase ✅
│
├── weeklyGoals ────────────── WeeklyView (CRUD)
│                              MonthlyView (조회)
│                              DashboardView (조회) → Supabase ✅
│
├── monthlyGoals ───────────── MonthlyView (CRUD)
│                              DashboardView (조회) → Supabase ✅
│
├── brainstormItems ─────────── BrainstormView (CRUD)
│                              WeeklyView (CRUD + 변환) → Supabase ✅
│
├── tags ───────────────────── TodoModal (태그 선택) → Supabase ✅ (최초 기본값 5개 자동 시드)
│
├── routines ───────────────── RoutinesView (CRUD + toggleRoutineDate) → Supabase ✅
│
└── selectedDate ────────────── 모든 날짜 의존 컴포넌트
```

---

## 4. 구현 완료된 기능 목록

### ✅ 데이터 CRUD

| 기능 | Create | Read | Update | Delete | Supabase |
|------|:------:|:----:|:------:|:------:|:--------:|
| 할일 (Todo) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 습관 (Habit) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 프로젝트 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 마일스톤 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 자기관리 기록 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 리뷰 기록 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 타임라인 설정 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 타임라인 로그 | ✅ | ✅ | — | ✅ | ✅ 연동 (버그 수정 완료) |
| 일정 (Event) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 주간 목표 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 월간 목표 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 브레인덤프 아이템 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 브레인덤프 메모 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 태그 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 루틴 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 주간 리뷰 | ✅ | ✅ | ✅ | — | ❌ 메모리 (테이블 없음) |
| 월간 리뷰 | ✅ | ✅ | ✅ | — | ❌ 메모리 (테이블 없음) |

### ✅ UI/UX 기능

- 4가지 디자인 테마 (A/B/C/D)
- 테마 C: 탑네비 레이아웃, 나머지: 사이드바 레이아웃
- 반응형 레이아웃 (데스크탑 / 모바일)
- 일간 타임라인 블록 드래그 이동 / 리사이징
- 스톱워치 → DO 시간 자동 기록
- 타임라인 시간대 설정 전역 저장 (Supabase)
- 월별 캘린더 칩 표시 + 필터 탭
- 습관 연속달성일(streak) 계산
- 할일 Top3 설정 (날짜별 최대 3개)
- 상태 순환: 예정 → 진행중 → 완료
- 미루기 (snoozed) 기능
- 백로그 → 날짜 배정
- 브레인덤프 → 할일/일정 변환
- **주간 칸반 드래그앤드롭** — 할일 카드를 다른 날짜 컬럼으로 드래그해 날짜 이동, Supabase 즉시 저장 (@dnd-kit/core)
- **루틴 실행** — 단계 체크 + SVG 원형 카운트다운 타이머, 완료 기록 → Supabase
- **습관 5종 목표 유형** — check/count/time/value/memo 각각 전용 위젯
- **스마트 알림 시스템** — 할일 `planStart` 기준 로컬 알림, 알림 권한 배너, iOS 16.4+ 안내, 클릭 시 DailyView 해당 할일로 이동 (`useNotification.ts`, `NotificationPermissionBanner.tsx`)
- **공통 TimePicker 컴포넌트** — ▲▼ 버튼 + 마우스 휠(분 1분단위) + 드롭다운 선택 패널 + 패널 직접 입력, 앱 전체 11곳 적용 (`TimePicker.tsx`)
- **모바일 일간 탭 UI** — 모바일에서 할일 목록 / 타임라인 탭 전환 (`mobileTab` state, `lg:hidden` 탭 바), 데스크탑 좌우 분할 유지
- **모바일 캘린더 스크롤 구조** — 주별/일별 헤더 고정 + 타임라인 내부 단일 스크롤, 7열 자동 축소
- **공통 ConfirmModal** — `window.confirm()` 대체, `confirmDanger` prop으로 삭제(빨간)/일반(골드) 버튼 구분, 배경 클릭·ESC 닫기 (`ConfirmModal.tsx`)
- **모바일 하단 네비 개선** (`Layout.tsx`)
  - 8개 탭 → 4탭(홈·일간·캘린더·주간) + 메뉴 버튼으로 축소
  - 활성 탭: 골드 `accentLight` 배경 pill 강조
  - `MobileMenuOverlay` 바텀 시트: 전체 페이지 4열 그리드, 활성 항목 골드 강조, 배경 클릭 닫힘
  - 모바일 상단 topbar에 햄버거 버튼 추가
- PWA 지원 (서비스워커, manifest)
- 일일 긍정 메시지 (AffirmationCard)

---

## 5. 미구현 또는 버그 있는 기능 목록

### 🔴 버그 (즉시 수정 권장)

| 위치 | 문제 | 증상 | 상태 |
|------|------|------|:----:|
| `DailyView.tsx` (구 L856-861) | `timelineLogs` 로컬 state에 mock 데이터 하드코딩 | 전역 store와 무관하게 동작, 새로고침 시 목 데이터로 초기화 | ✅ 수정 완료 |
| `DailyView.tsx` (구 L952-958) | `addTimelineLog` / `deleteTimelineLog`가 로컬 state만 업데이트 | Supabase에 저장 안 됨 (store의 전역 함수 미사용) | ✅ 수정 완료 |

### ⚠️ 새로고침 시 데이터 소실 (Supabase 미연동)

| 데이터 | 영향 페이지 | 상태 |
|--------|-----------|:----:|
| 일정 (Event) | 일간, 캘린더, 브레인스토밍 | ✅ 연동 완료 |
| 주간 목표 | 주간, 월간, 대시보드 | ✅ 연동 완료 |
| 월간 목표 | 월간, 대시보드 | ✅ 연동 완료 |
| 브레인덤프 아이템 | 브레인스토밍, 주간 | ✅ 연동 완료 |
| 브레인덤프 메모 | 브레인스토밍 | ✅ 연동 완료 |
| 태그 | 할일 모달 | ✅ 연동 완료 (최초 실행 시 기본 5개 자동 시드) |
| 주간 리뷰 | 리뷰 | ❌ 테이블 없음 |
| 월간 리뷰 | 리뷰 | ❌ 테이블 없음 |
| 루틴 | 루틴 실행 페이지 | ✅ 연동 완료 |

### ❌ 미구현 기능

| 기능 | 설명 |
|------|------|
| 리뷰(Weekly/Monthly Review) Supabase 저장 | 테이블 없음, 설계 및 생성 필요 |
| 자기관리 기록 수정(Update) | 삭제 후 재등록만 가능 |
| 습관 alarmTime → 알림 연결 | `useNotification` 알림 시스템 구현됨, 하지만 HabitModal의 `alarmTime`은 DB 저장만 됨 — 습관 알림 스케줄링 별도 구현 필요 |
| 습관 반복 설정 기반 자동 표시 | `repeat_days` 저장되나 필터링 로직 미구현 |
| 루틴 반복 설정 | 현재 매일 표시 — weekly/custom 반복 필터 미구현 |
| PWA 오프라인 모드 | 서비스워커 등록됐으나 캐싱 전략 없음 |
| 데이터 내보내기/가져오기 | 미구현 |
| 사용자 인증 (멀티유저) | 현재 단일 사용자 구조 |

---

## 6. 컴포넌트 구조도

```
App.tsx
└── ThemeProvider (ThemeContext)
    └── PlannerProvider (store.tsx)
        └── RouterProvider (routes.tsx)
            └── RootLayout
                ├── Layout (테마 A/B/D — 사이드바)
                │   ├── aside (좌측 사이드바)
                │   │   ├── 네비게이션 링크
                │   │   ├── 프로젝트 목록
                │   │   ├── SidebarNewProjectForm
                │   │   └── MiniCalendar
                │   ├── main
                │   │   └── <Outlet /> → 각 페이지 컴포넌트
                │   └── aside (우측 패널)
                │       └── RightPanel (주간/월간 목표, 습관 요약)
                │
                └── LayoutC (테마 C — 탑네비)
                    ├── header (상단 네비바)
                    │   ├── 로고
                    │   ├── 네비게이션 탭
                    │   └── CalendarDropdown
                    ├── main (60%)
                    │   └── <Outlet /> → 각 페이지 컴포넌트
                    └── aside (40%)
                        └── DashboardPanel

페이지 컴포넌트
│
├── DailyView
│   ├── TodoRow (할일 행 — ?todoId 파라미터로 하이라이트+스크롤)
│   ├── TodoModal (추가/편집)
│   ├── SnoozeModal (미루기)
│   ├── ContextMenu (우클릭 메뉴)
│   ├── FloatingTimer (스톱워치)
│   ├── TimelineLogModal (로그 추가)
│   └── TimelineSettingsModal (시간대 설정)
│
├── CalendarView
│   ├── MonthView (월별 그리드)
│   ├── WeekView (주별 타임라인)
│   └── DayViewPanel (일별 미니 타임라인)
│
├── WeeklyView
│   ├── BrainDumpItem (브레인덤프 카드)
│   ├── AssignDayPopover (요일 배정)
│   ├── DayColumn (요일별 할일 칼럼 — useDroppable)
│   ├── DraggableTodoCard (드래그 가능한 할일 카드 — useDraggable)
│   └── OverlayCard (드래그 중 표시되는 고스트 카드 — DragOverlay)
│
├── MonthlyView
│   ├── MonthlyGoalCard
│   └── WeeklyGoalSubList
│
├── HabitsView
│   ├── HabitModal (추가/편집 — 5종 목표 유형 선택)
│   └── HabitChip (유형별 위젯: check/count/time/value/memo)
│
├── RoutinesView
│   ├── RoutineModal (추가/편집 — 단계 목록)
│   ├── RoutineCard (아이콘/이름/시간/연속일)
│   └── ExecutionPanel (하단 시트 — 타이머 + 단계 체크)
│
├── ReviewsView
│   ├── DailyReviewForm (감정/감사/KPT)
│   ├── ReviewCard (기록 목록)
│   ├── WeeklyReviewForm
│   └── MonthlyReviewForm
│
├── SelfCareView
│   ├── SelfCareForm (기록 추가)
│   └── SelfCareCard (기록 카드)
│
├── ProjectView
│   ├── ProjectsView (목록)
│   │   └── NewProjectModal
│   └── ProjectDetailView (상세)
│       ├── MilestoneItem
│       └── 관련 할일 목록
│
├── BacklogView
│   ├── BacklogTodoRow
│   └── AddBacklogModal
│
├── BrainstormView
│   ├── BrainstormItemCard
│   ├── ConvertToTodoModal
│   └── ConvertToEventModal
│
├── DashboardView
│   ├── StatCard (통계 카드)
│   ├── AffirmationCard (긍정 메시지)
│   ├── HabitChips (오늘 습관)
│   └── TodoSummary (Top3 + 기한 초과)
│
└── 공통 컴포넌트
    ├── TimePicker — ▲▼ 버튼 + 휠(분 1분단위) + 드롭다운 패널 + 패널 직접 입력
    │   └── 적용: DailyView 6곳, HabitsView 2곳, RoutinesView 1곳, BrainstormView 2곳
    ├── ConfirmModal — window.confirm() 대체 커스텀 확인 모달
    │   └── 적용: ProjectDetailView (프로젝트 삭제)
    ├── NotificationPermissionBanner — 알림 권한 요청 배너 (Layout.tsx에 마운트)
    │   └── useNotification — 알림 권한 관리, 할일 planStart 기준 알림 스케줄링
    └── MobileMenuOverlay (Layout.tsx 내부) — 모바일 전체 메뉴 바텀 시트 오버레이
```

---

## 부록: 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 번들러 | Vite 6 |
| 스타일 | Tailwind CSS v4 |
| 라우팅 | React Router v7 |
| 상태관리 | React Context API (PlannerContext) |
| UI 컴포넌트 | shadcn/ui + Radix UI |
| 아이콘 | Lucide React |
| DB/백엔드 | Supabase (PostgreSQL) |
| 배포 | Vercel (PWA) — `vercel.json` SPA 라우팅 rewrite 설정 포함 |
| 날짜 처리 | date-fns |
| 드래그앤드롭 | @dnd-kit/core + @dnd-kit/utilities |
