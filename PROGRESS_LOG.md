# PROGRESS_LOG.md — My Planner 진행 현황

> 사용법:
> - `todo로 넣어줘: [내용]` → 오늘 날짜 TODO에 추가
> - `진행현황 기록` → 오늘 작업 내용을 이 파일에 저장

---

## 2026-03-21

### 📋 TODO
- [ ] 스마트 알림 시스템 구현 (습관 알림 + 할일 사전 알림)
- [ ] **[수동 작업 필요]** Supabase SQL Editor에서 10개 테이블 생성 SQL 실행 (아래 `⚠️ 다음 세션 전 필수 작업` 섹션 참고) — 실행 전까지 events/goals/brainstorm 등 저장 안 됨

### ✅ 완료
- [x] 주간 칸반 보드 드래그앤드롭 구현 (@dnd-kit/core)
- [x] PROGRESS_LOG.md 초기 생성 및 GitHub 커밋
- [x] PROJECT_SPEC.md 최신화 (2026-03-21 기준)
- [x] CLAUDE.md 단축 명령어 규칙 추가 및 형식 정리
- [x] 타임라인 로그 하드코딩 목 데이터 버그 수정 → 전역 store + Supabase 연동
- [x] 새로고침 시 데이터 소실 문제 전면 해결 — 10개 in-memory 항목 Supabase 연동

### 🛠 오늘 작업 내용

#### [이전 세션] WeeklyView 드래그앤드롭
- `WeeklyView.tsx`: @dnd-kit/core 기반 드래그앤드롭 전면 적용
  - `DraggableTodoCard` (useDraggable) — 드래그 중 카드 반투명 처리
  - `DayColumn` (useDroppable) — 드롭 영역 강조 + "여기에 놓기" 표시
  - `OverlayCard` (DragOverlay) — 떠다니는 고스트 카드
  - 드롭 시 `updateTodo` → Supabase 즉시 저장
  - `PointerSensor distance:5` 으로 클릭/드래그 구분
- `PROGRESS_LOG.md`: 파일 신규 생성
- `PROJECT_SPEC.md`: 최종 업데이트 날짜 수정, 버그 라인번호 정정(L856/L952), 드래그앤드롭 구현 완료 반영, @dnd-kit 스택 추가, 미구현 항목에서 "할일 날짜 이동" 제거
- `CLAUDE.md`: 단축 명령어 섹션에 `todo로 넣어줘` / `진행현황 기록` 규칙 추가 후 형식 정리

---

#### [이번 세션] 버그 수정 — 타임라인 로그 & 데이터 소실

---

##### 1. 타임라인 로그 버그 수정
**파일**: `src/app/components/DailyView.tsx`

**문제**:
- `timelineLogs`가 하드코딩된 목 데이터 4개(하루 시작, 점심 식사, 집중 모드, 저녁 산책)를 로컬 `useState`로 관리
- 실제 store/Supabase와 완전히 분리되어 저장 안 됨
- `addTimelineLog`도 로컬 state에만 push → 새로고침 시 소실

**수정 내용**:
- 로컬 `useState<TimelineLog[]>([...mock...])` 제거
- `usePlanner()`에서 `timelineLogs: allTimelineLogs`, `addTimelineLog: storeAddTimelineLog`, `deleteTimelineLog: storeDeleteTimelineLog` 구조분해
- `const timelineLogs = allTimelineLogs.filter(l => l.date === selectedDate)` 로 날짜 필터링
- `addTimelineLog` / `deleteTimelineLog`를 store 함수 래핑으로 교체
- `TimelineLogModal`의 `onAdd` 타입을 `(log: TimelineLog)` → `(log: Omit<TimelineLog, 'id'>)`로 변경
- `handleSave` 내 `id: Math.random().toString(36).slice(2, 9)` 직접 생성 제거 → id는 store의 `newId()`에서 생성

---

##### 2. 새로고침 시 데이터 소실 전면 수정
**파일**: `src/lib/db.ts`, `src/app/store.tsx`

**문제**: 아래 10개 항목이 in-memory 상태로만 관리되어 새로고침 시 전부 초기화됨

| 항목 | 기존 | 수정 후 |
|------|------|---------|
| events (일정) | in-memory | Supabase `events` |
| weeklyGoals (주간 목표) | in-memory | Supabase `weekly_goals` |
| monthlyGoals (월간 목표) | in-memory | Supabase `monthly_goals` |
| brainstormItems (브레인스토밍) | in-memory | Supabase `brainstorm_items` |
| brainstormMemos (브레인스토밍 메모) | in-memory | Supabase `brainstorm_memos` |
| tags (태그) | in-memory (initialTags 초기화) | Supabase `tags` |
| routines (루틴) | in-memory | Supabase `routines` |
| weeklyReviews (주간 리뷰) | in-memory | Supabase `weekly_reviews` |
| monthlyReviews (월간 리뷰) | in-memory | Supabase `monthly_reviews` |
| dailyAffirmations (일일 확언) | in-memory | Supabase `daily_affirmations` |

**`src/lib/db.ts` 변경**:
- 상단 import에 `Event, WeeklyGoal, MonthlyGoal, BrainstormItem, Tag, Routine, WeeklyReview, MonthlyReview` 추가
- Row 타입 8개 추가: `EventRow`, `WeeklyGoalRow`, `MonthlyGoalRow`, `BrainstormItemRow`, `TagRow`, `RoutineRow`, `WeeklyReviewRow`, `MonthlyReviewRow`
- camelCase ↔ snake_case 변환 함수 추가: `toEvent/fromEvent`, `toWeeklyGoal/fromWeeklyGoal`, `toMonthlyGoal/fromMonthlyGoal`, `toBrainstormItem/fromBrainstormItem`, `toTag/fromTag`, `toRoutine/fromRoutine`, `toWeeklyReview/fromWeeklyReview`, `toMonthlyReview/fromMonthlyReview`
- `db` 객체에 10개 테이블 CRUD 추가:
  - `events`: fetchAll, upsert, delete
  - `weeklyGoals`: fetchAll, upsert, delete
  - `monthlyGoals`: fetchAll, upsert, delete
  - `brainstormItems`: fetchAll, upsert, delete
  - `brainstormMemos`: fetchAll(→ Record<string,string>), upsert(date, text)
  - `tags`: fetchAll, upsert, delete, **seed** (빈 경우 initialTags 삽입용)
  - `routines`: fetchAll, upsert, delete
  - `weeklyReviews`: fetchAll, upsert
  - `monthlyReviews`: fetchAll, upsert
  - `dailyAffirmations`: fetchAll(→ Record<string,string>), upsert(date, text)

**`src/app/store.tsx` 변경**:
- `// in-memory 상태 (비연동)` 주석 → `// Supabase 연동 상태 (추가분)`으로 변경
- `useEffect` load 함수: 기존 8개 → 18개 `Promise.all` 병렬 fetch로 확장
- tags 특별 처리: fetch 결과가 비어있으면 `db.tags.seed(initialTags)` 호출 → 기본 태그 자동 생성
- 액션 함수에 db 호출 추가:
  - **Event**: `addEvent`, `updateEvent`, `deleteEvent` → `db.events.upsert/delete`
  - **Routine**: `addRoutine`, `updateRoutine`, `deleteRoutine` → `db.routines.upsert/delete`
  - **WeeklyReview**: `addWeeklyReview`, `updateWeeklyReview` → `db.weeklyReviews.upsert`
  - **MonthlyReview**: `addMonthlyReview`, `updateMonthlyReview` → `db.monthlyReviews.upsert`
  - **WeeklyGoal**: `addWeeklyGoal`, `toggleWeeklyGoal`, `deleteWeeklyGoal` → `db.weeklyGoals.upsert/delete`
  - **MonthlyGoal**: `addMonthlyGoal`, `deleteMonthlyGoal` → `db.monthlyGoals.upsert/delete`
  - **Brainstorm**: `addBrainstormItem`, `deleteBrainstormItem` → `db.brainstormItems.upsert/delete`
  - **Brainstorm 버그 수정**: `brainstormToTodo`, `brainstormToEvent`, `weeklyBrainstormAssign`에서 brainstorm 삭제 db 호출 누락 버그 함께 수정
  - **BrainstormMemo**: `setBrainstormMemo` → `db.brainstormMemos.upsert`
  - **WeeklyBrainstorm**: `addWeeklyBrainstorm` → `db.brainstormItems.upsert`
  - **Tag**: `addTag`, `updateTag`, `deleteTag` → `db.tags.upsert/delete`
  - **DailyAffirmation**: `setDailyAffirmation` → `db.dailyAffirmations.upsert`

---

### ⚠️ 다음 세션 전 필수 작업 — Supabase 테이블 생성

Supabase 대시보드 → **SQL Editor**에서 아래 SQL을 실행해야 합니다 (한 번만):

```sql
CREATE TABLE events (
  id text PRIMARY KEY,
  title text NOT NULL,
  date text NOT NULL,
  start_time text, end_time text, location text, memo text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE weekly_goals (
  id text PRIMARY KEY,
  text text NOT NULL, done boolean DEFAULT false,
  monthly_goal_id text, week_key text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE monthly_goals (
  id text PRIMARY KEY,
  text text NOT NULL, month text NOT NULL, project_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE brainstorm_items (
  id text PRIMARY KEY,
  text text NOT NULL, date text NOT NULL, week_key text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE brainstorm_memos (
  date text PRIMARY KEY,
  text text NOT NULL
);

CREATE TABLE tags (
  id text PRIMARY KEY,
  name text NOT NULL, color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE routines (
  id text PRIMARY KEY,
  name text NOT NULL, icon text NOT NULL,
  start_time text NOT NULL, duration integer NOT NULL,
  steps text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE weekly_reviews (
  id text PRIMARY KEY,
  week_key text NOT NULL,
  good text DEFAULT '', hard text DEFAULT '', next_week text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE monthly_reviews (
  id text PRIMARY KEY,
  month text NOT NULL,
  achievement text DEFAULT '', next_focus text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE daily_affirmations (
  date text PRIMARY KEY,
  text text NOT NULL
);
```

> 테이블 생성 후 앱을 처음 열면 tags 테이블에 기본 태그(일, 자기계발, 자기관리, 일상, 건강)가 자동 seed됩니다.

---

### 🔜 다음 세션 인수인계

#### 1순위 — 수동 작업 (코드 없이 Supabase 콘솔에서)
- [ ] Supabase 대시보드 → SQL Editor → 아래 섹션의 SQL 10개 테이블 생성 실행
  - 실행 후 앱을 열면 tags 기본 5개 자동 seed됨
  - 완료 후 PROGRESS_LOG.md TODO에서 체크 처리

#### 2순위 — 다음 개발 작업 후보
| 우선순위 | 기능 | 비고 |
|---------|------|------|
| 높음 | SQL 실행 후 전체 페이지 동작 확인 | events, goals, brainstorm, tags, reviews, affirmations |
| 중간 | 자기관리 기록 수정(Update) 기능 | 현재 삭제 후 재등록만 가능 |
| 중간 | 스마트 알림 시스템 | 습관 알림 + 할일 사전 알림 (alarm_time 컬럼 이미 존재) |
| 낮음 | 루틴(Routine) UI 구현 | Supabase 연동 코드는 완성, UI만 없음 |
| 낮음 | 습관 반복 설정 필터링 로직 | repeat_days 저장되나 표시 필터링 미구현 |

#### 현재 코드 상태 요약
- `src/lib/db.ts`: 총 18개 테이블 CRUD 함수 구현 완료
- `src/app/store.tsx`: 전체 18개 항목 Supabase 연동 완료 (초기화 load + 액션 함수)
- `src/app/components/DailyView.tsx`: 타임라인 로그 전역 store 연동 완료
- **빌드 상태**: ✅ 정상 (vite build 성공 확인)

---

### 📌 현재 Supabase 연동 완료 테이블 전체 목록

| 테이블 | 설명 | 상태 |
|--------|------|------|
| `todos` | 할일 | ✅ 기존 |
| `habits` | 습관 | ✅ 기존 |
| `projects` | 프로젝트 | ✅ 기존 |
| `milestones` | 마일스톤 | ✅ 기존 |
| `self_care_records` | 자기관리 기록 | ✅ 기존 |
| `review_records` | 데일리 리뷰 | ✅ 기존 |
| `timeline_logs` | 타임라인 로그 | ✅ 기존 |
| `user_settings` | 타임라인 시간 설정 | ✅ 기존 |
| `events` | 일정 | 🆕 이번 세션 |
| `weekly_goals` | 주간 목표 | 🆕 이번 세션 |
| `monthly_goals` | 월간 목표 | 🆕 이번 세션 |
| `brainstorm_items` | 브레인스토밍 항목 | 🆕 이번 세션 |
| `brainstorm_memos` | 브레인스토밍 메모 | 🆕 이번 세션 |
| `tags` | 태그 | 🆕 이번 세션 |
| `routines` | 루틴 | 🆕 이번 세션 |
| `weekly_reviews` | 주간 리뷰 | 🆕 이번 세션 |
| `monthly_reviews` | 월간 리뷰 | 🆕 이번 세션 |
| `daily_affirmations` | 일일 확언 | 🆕 이번 세션 |

---
