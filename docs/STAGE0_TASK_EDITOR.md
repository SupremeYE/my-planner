# Stage 0 — 할일/일정 편집 모달 구조 보고서

> 조사 전용. 코드 변경 없음. 확인된 사실만 기재하고, 확인 못 한 항목은 "확인 불가"로 표기.
> 라이브 스키마는 Supabase 프로젝트 `my-planner`(`kfvijixulsvxelmmqzpm`)의 `information_schema` 직접 조회.
> 조사일: 2026-07-16

---

## 1. 데이터 모델 (최우선)

### 1.1 `todos` 테이블 — 전체 컬럼 (라이브 스키마)

| 컬럼 | 타입 | nullable | 기본값 | 비고 |
|---|---|---|---|---|
| `id` | text | NO | — | PK |
| `text` | text | NO | — | 할일 본문 |
| `date` | text | **YES** | — | 예정일 `yyyy-MM-dd`. **null = "미지정"(Inbox)** |
| `due_date` | text | YES | — | 마감일 |
| `end_date` | text | YES | — | 멀티데이 종료일(반복 아님) |
| `status` | text | NO | `'active'` | **CHECK 없음**. `active\|inProgress\|done\|cancelled\|snoozed\|backlog` |
| `is_top3` | boolean | NO | `false` | Top3 표시 |
| **`plan_start`** | text | YES | — | **계획 시작(PLAN)** `HH:mm` |
| **`plan_end`** | text | YES | — | **계획 종료(PLAN)** `HH:mm` |
| **`do_start`** | text | YES | — | **실적 시작(DO)** `HH:mm` |
| **`do_end`** | text | YES | — | **실적 종료(DO)** `HH:mm` |
| `do_elapsed_sec` | integer | YES | — | 타이머 실측 소요(초) |
| `do_date` | **date** | YES | — | ⚠️ **오펀 컬럼** — `db.ts`의 `TodoRow`/`toTodo`/`fromTodo`에 매핑 없음(앱에서 읽지도 쓰지도 않음) |
| `category` | text | YES | — | |
| `project_id` | text | YES | — | |
| `weekly_goal_id` | text | YES | — | 주간 목표 롤업 |
| `milestone_id` | text | YES | — | |
| `mandalart_cell_id` | uuid | YES | — | |
| `tags` | text[] | YES | `'{}'` | |
| `note` | text | YES | — | ⚠️ `TodoRow`에 미매핑(오펀) |
| `source_url` | text | YES | — | ⚠️ `TodoRow`에 미매핑(오펀) |
| `recurrence_rule` | text | YES | — | 레거시 반복 `daily\|weekly\|weekdays\|custom` |
| `recurrence_days` | int[] | YES | — | 레거시 byday(0=일~6=토) |
| `recurrence_end_date` | text | YES | — | 반복 종료일 |
| `recurrence_parent_id` | text | YES | — | 예외 인스턴스 부모 |
| `is_exception` | boolean | YES | `false` | |
| `recurrence_freq` | text | YES | — | 통합 스펙 `daily\|weekly\|monthly\|yearly` |
| `recurrence_interval` | integer | NO | `1` | 통합 스펙 |
| `recurrence_preset` | text | YES | — | 통합 스펙 `weekday\|weekend` |
| `started_date` | text | YES | — | 처음 진행중이 된 날(이월 기준) |
| `created_at` | timestamptz | YES | `now()` | |

**질문 답변**
- **계획 시각 컬럼**: `plan_start` / `plan_end` (정확한 이름).
- **실적 시각 컬럼**: `do_start` / `do_end`, 추가로 `do_elapsed_sec`(타이머 실측 초).
- **`lane` / PLAN·DO 구분 컬럼**: **없음.** 별도 lane 컬럼 없이 **한 행이 `plan_*`와 `do_*`를 동시에 보유**하고, 어느 필드가 채워졌는지로 레인이 결정된다.
- **날짜 nullable**: `date`가 nullable → **"미지정" 구현 = `date IS NULL`**(Inbox 전담).

### 1.2 모델 판정: **모델 A**

한 행이 계획·실적 시각을 모두 가지며, PLAN 레인은 `plan_*`로, DO 레인은 `do_*`로 렌더된다. 따라서 한 항목이 두 레인에 동시에 나타날 수 있다.

**근거 3줄**
1. 스키마·타입: 단일 `todos` 행이 `plan_start/plan_end` + `do_start/do_end` + `do_elapsed_sec`를 모두 보유(`store.tsx:26-31`, 라이브 스키마 §1.1). lane 구분 컬럼 부재.
2. 타임라인 렌더: `planTodos = dateTodos.filter(td => td.planStart && td.planEnd)`(`Timeline.tsx:852`)와 DO 막대(`Timeline.tsx:857-871`)가 **같은 `dateTodos` 집합**에서 각각 파생된다.
3. `renderBlock(todo, type)`이 같은 `todo`에서 `type==='plan'`이면 `planStart/planEnd`, `'do'`면 `doStart/doEnd`를 뽑는다(`Timeline.tsx:885-887`) → 한 행이 PLAN·DO 두 블록으로 렌더.

### 1.3 모델 A — PLAN/DO 같은 행 렌더 코드 인용

```
// Timeline.tsx:852
const planTodos = dateTodos.filter(td => td.planStart && td.planEnd);

// Timeline.tsx:857-871  (DO 막대: 시간블록 우선, 없으면 레거시 do_*)
//   bars.push({ ...real, ...doStart:b.start, doEnd:b.end, ... })      // 시간블록
//   if (td.doStart && td.doEnd && !renderedBlockTodoIds.has(td.id)) bars.push(td)  // 레거시

// Timeline.tsx:885-887
const renderBlock = (todo, type) => {
  const start = type === 'plan' ? todo.planStart : todo.doStart;
  const end   = type === 'plan' ? todo.planEnd   : todo.doEnd;
```

`compare` 탭에서 좌 PLAN / 우 DO 레인으로 분할 렌더(`getTimelineLaneBounds`, `Timeline.tsx:735-743`).

### 1.4 `누적 시간` 값의 출처

**파생값(별도 저장 컬럼 아님).**
- 화면 표기: `TodoModal.tsx:110-116` → `accumulated = totalElapsedForTodo(timeBlocks, todo)`, 표시 `formatTotalDoKo(accumulated.sec)` + 세션 수(`TodoModal.tsx:467-477`).
- 집계 로직: `timeBlocks.ts:27-31` — 해당 todo의 `todo_time_blocks` 블록이 하나라도 있으면 **블록들의 `elapsed_sec` 합**, 없으면 `todoDoDurationSeconds(todo)`(=`do_elapsed_sec` 우선, 없으면 `do_start~do_end` 분차)로 폴백(dual-read).
- 저장되는 raw는 `todos.do_elapsed_sec`(타이머 실측)와 `todo_time_blocks.elapsed_sec`(세션별 1행). "누적 시간"은 이들을 **합산한 파생 표시값**이다.

### 1.5 `events` 테이블 — 전체 컬럼 & `todos`와의 차이

**⚠️ 중요: `events`는 레거시 컬럼과 v2 컬럼이 공존한다.**

| 컬럼 | 타입 | nullable | 계층 | 쓰기 여부 |
|---|---|---|---|---|
| `id` | text | NO | — | PK |
| `title` | text | NO | 공통 | O |
| `date` | text | YES | **레거시** | ✗ (미사용) |
| `start_time` | text | YES | **레거시** | ✗ |
| `end_time` | text | YES | **레거시** | ✗ |
| `tags` | text[] | YES | **레거시** | ✗ (항상 `[]`) |
| `start_at` | **text** | YES | v2 | **O(주 저장)** |
| `end_at` | **text** | YES | v2 | **O(주 저장)** |
| `is_all_day` | boolean | YES | v2 | O |
| `location` | text | YES | 공통 | O |
| `link_url` | text | YES | v2 | O |
| `memo` | text | YES | 공통 | O |
| `repeat_type` | text | YES(`'none'`) | v2 레거시반복 | O |
| `repeat_end_date` | text | YES | v2 | O |
| `alert_minutes` | integer | YES | v2 | O |
| `project_id` | text | YES | v2 | O |
| `color` | text | YES | v2 | O |
| `completed` | boolean | NO(`false`) | v2 | O |
| `parent_event_id` | text | YES | v2 예외 | O |
| `occurrence_date` | text | YES | v2 예외 | O |
| `is_exception` | boolean | NO(`false`) | v2 예외 | O |
| `recurrence_freq` | text | YES | v2 통합반복 | O |
| `recurrence_interval` | integer | NO(`1`) | v2 통합반복 | O |
| `recurrence_byday` | int[] | YES | v2 통합반복 | O |
| `recurrence_preset` | text | YES | v2 통합반복 | O |
| `created_at` | timestamptz | YES(`now()`) | — | |

> 참고: 마이그레이션(`20260412010000`)은 `start_at/end_at`를 `timestamptz`로 정의했으나 **라이브 컬럼은 `text`**(테이블이 레거시로 선존재해 else 분기로 컬럼만 가산된 결과). `api/events.ts`는 `"yyyy-MM-ddTHH:mm:00"` 문자열로 저장·`parseISO`로 읽음.

**할일 vs 일정 필드 차이**

| 항목 | 할일(`todos`) | 일정(`events`) |
|---|---|---|
| 시각 구조 | **PLAN + DO 2범위**(`plan_*`, `do_*`) | **단일 범위**(`start_at`~`end_at`) |
| 계획/실적 구분 | **있음**(모델 A) | **없음** |
| 완료 개념 | `status`(6값) | `completed` boolean만 |
| 타이머/누적 | `do_elapsed_sec` + `todo_time_blocks` | 없음 |
| 종일 | 없음 | `is_all_day` |
| 알림 | 없음 | `alert_minutes`(0/10/30/60) |
| 링크/장소 | 없음(할일) | `link_url` / `location` |
| Top3 | `is_top3` | 없음 |
| 태그 | `tags`(사용) | `tags`(레거시, 항상 `[]`) |
| 반복 예외 방식 | `recurrence_parent_id`+`is_exception` | `parent_event_id`+`occurrence_date`+`is_exception` |
| id 타입 | text | text |

**일정에 계획/실적 구분: 없음.** 일정은 단일 시간 범위 + `completed` 체크만 가진다.

### 1.6 반복(recurrence) 저장 방식

**RRULE 아님 — 커스텀 flat 컬럼** (JSONB 미사용, 하온 전체 패턴).

- **`todos`**: 레거시 `recurrence_rule`(`daily|weekly|weekdays|custom`) + `recurrence_days` + `recurrence_end_date` + `recurrence_parent_id` + `is_exception`. 통합 스펙 `recurrence_freq`/`recurrence_interval`/`recurrence_preset`(dual-read, freq 있으면 우선). **`TodoModal`은 레거시 필드만 쓴다**(`TodoModal.tsx:99-101`, UI `481-557`).
- **`events`**: 레거시 `repeat_type`(`none|daily|weekly|monthly`) + `repeat_end_date`. 통합 `recurrence_freq`/`interval`/`byday`/`preset`(dual-read, `api/events.ts:212-223`). **`EventModal`은 레거시 `repeat_type`만 쓴다**(`EventModal.tsx:20-25, 46-47, 94-95`).
- **`종료일` 컬럼**: 할일 = `recurrence_end_date`, 일정 = `repeat_end_date`.
- **반복이 없을 때**: 종료일은 `null`로 저장된다. 일정은 `hasRecurrence` 가드로 비반복 시 `repeat_end_date=null`(`api/events.ts:126`); 할일은 반복 미선택 시 `recurrenceEndDate` 미전송(`TodoModal.tsx:271` — `recurrenceRule` 있을 때만 UI 노출).
- 별개 주의: **멀티데이 종료일**(`todos.end_date`)은 반복과 무관한 별도 필드(`TodoModal.tsx:96, 391-411`, 반복 선택 시 상호 배타).

### 1.7 Top 3 저장 방식 / 3개 제한

- **저장**: `todos.is_top3` boolean 컬럼(별도 테이블 아님).
- **3개 제한 강제 위치**: **앱 로직 1곳에서만** — `store.tsx:1444-1451` `toggleTop3`(같은 `todo.date` 기준 이미 3개면 토글 거부). **DB constraint 없음.**
- ⚠️ **우회 경로(드리프트)**: `TodoModal`의 체크박스는 `toggleTop3`가 아니라 `buildChanges`의 `isTop3`(`TodoModal.tsx:262`)로 직접 저장, `TimelineAddModal`도 `addTodo({ isTop3 })`(`TimelineAddModal.tsx:36, 43`)로 직접 저장 → **두 모달 경로는 3개 제한을 강제하지 않는다**(4개 이상 지정 가능).

---

## 2. 컴포넌트 지형

### 2.1 파일 경로 / 컴포넌트명

| 역할 | 파일 | 컴포넌트 | 타이틀 |
|---|---|---|---|
| 할일 수정 = 할일 추가 | `src/app/components/TodoModal.tsx` | `TodoModal` | `할일 수정`/`할일 추가`(`:346`) |
| 일정 수정 = 일정 추가 | `src/app/components/EventModal.tsx` | `EventModal`(`:34`) | `일정 수정`/`일정 추가` |
| 새 항목 추가(타임라인 슬롯) | `src/app/components/timeline/TimelineAddModal.tsx` | `TimelineAddModal`(`:9`) | `새 항목 추가`(`:62`) |
| 통합 빠른 입력 | `src/app/components/QuickAddInput.tsx` | `QuickAddInput` | (인라인, 모달 아님) |
| 시각 입력 스피너 | `src/app/components/TimePicker.tsx` | `TimePicker`(`:13`) | — |

> `TimeBlockModal`은 존재하지 않는다. 타임라인 추가 모달은 `TimelineAddModal`.

### 2.2 같은 컴포넌트인가? — **3개 별개**

- **할일 수정 = 할일 추가**는 `TodoModal` 하나(`todo` prop 유무로 분기).
- 그러나 **`TimelineAddModal`(타임라인 추가)와 `EventModal`(일정)은 완전 별개** → 편집 로직이 **3분할**.

**중복 로직**
- `TimePicker` 사용: `TodoModal` `:438/:444/:455/:461` · `EventModal` `:190/:196` · `TimelineAddModal` `:97/:101`.
- 태그 토글: `TodoModal:679-706`(생성·편집·팔레트 풀기능) vs `TimelineAddModal:106-128`(**선택만, 생성 불가**) — 중복이자 기능 격차.
- Top3/KEY 토글: `TodoModal:568-577` vs `TimelineAddModal:135-144`.
- `addTodo` 저장: `TodoModal:288`, `TimelineAddModal:36,43`.
- `addEvent` 저장: `EventModal:107`, `TimelineAddModal:34`.
- 반복: `TodoModal`(레거시 rule 칩) vs `EventModal`(`repeat_type` select) — **서로 다른 방식** / `TimelineAddModal`은 **반복 기능 없음**.

### 2.3 모든 진입점 & 프리필 props

**TodoModal**

| 파일:line | 상태 | 프리필 |
|---|---|---|
| `DailyView.tsx:1319` | 추가 | `date={selectedDate}` |
| `DailyView.tsx:1321` | 수정 | `date`, `todo={editingTodo}` |
| `CalendarView.tsx:1064` | 추가 | `date={selectedDate}` |
| `CalendarView.tsx:1069` | 수정 | `date`, `todo` |
| `TodosView.tsx:602` | 수정(진행중) | `todo` |
| `TodosView.tsx:687` | 수정(완료함) | `todo` |
| `ProjectView.tsx:445` | 추가(마일스톤) | `initialProjectId`, `initialMilestoneId` |
| `ProjectView.tsx:873` | 수정 | `todo` |
| `ProjectView.tsx:876` | 추가 | `initialProjectId` |
| `period/WeeklyTodosInline.tsx:109` | 추가 | `date={weekStartDate}`, `initialWeeklyGoalId` |
| `period/WeeklyTodosInline.tsx:116` | 수정 | `todo` |
| `QuickAddInput.tsx:297` | 추가("자세히") | `date`, `initialText`, `initialPlanStart`, `initialPlanEnd`, `initialProjectId`, `initialTags`, `initialIsTop3`, `initialRecurrenceRule` |

**EventModal**

| 파일:line | 상태 | 프리필 |
|---|---|---|
| `DailyView.tsx:1320` | 추가 | `date={selectedDate}` |
| `DailyView.tsx:1322` | 수정 | `date`, `event={editingEvent}` |
| `CalendarView.tsx:1065` | 추가 | `date` |
| `CalendarView.tsx:1072` | 수정 | `date`, `event` |
| `QuickAddInput.tsx:310` | 추가("자세히") | `date`, `initialTitle`, `initialStartTime`, `initialEndTime`, `initialTags` |

**TimelineAddModal**

| 파일:line | 프리필 |
|---|---|
| `Timeline.tsx:1359` | `date={createTarget.date ?? selectedDate}`, `initialStart`, `initialEnd`, `initialLane`('plan'/'do') |

- 편집 트리거는 대부분 `CustomEvent` 디스패치: `editTodo`(리스너 `DailyView.tsx:613-617`, `CalendarView.tsx:415`), `editEvent`(리스너 `DailyView.tsx:627-631`, `CalendarView.tsx:422`). 타임라인 블록 탭 → 디스패치(`Timeline.tsx:247, 326, 389`).
- `createTarget`은 빈 슬롯 드래그/탭으로 세팅(`Timeline.tsx:503 openCreateFromDrag`, 주간 `592-610`).
- ⚠️ prop 이름 불일치: 할일=`initialPlanStart/PlanEnd`, 일정=`initialStartTime/EndTime`.

### 2.4 타임라인 블록 드래그 조정 — **가능(마우스+터치+펜)**

`Timeline.tsx`에 Pointer Events 기반 이동/리사이즈 완비:
- 할일 블록: down `handleBlockPointerDown:258-283`(마우스 5px/터치 250ms 롱프레스), move `190-221`(15분 스냅 `BLOCK_SNAP_MIN`), **커밋** up `223-250`(PLAN→`planStart/planEnd`, 레거시 DO 행→`doStart/doEnd`, DO 시간블록→`updateTimeBlock`). 짧은 탭이면 편집 모달로 위임(`:247`).
- 리사이즈 핸들: `handleResizePointerDown:285-303`, 손잡이 렌더 `1071-1084`(`cursor:'ns-resize'`).
- 일정 블록: `EventDrag:308-441`(down `403`, resize `424`, 커밋 `updateEvent`).
- 수면 블록: 별도 드래그 `443-479`.

→ **드래그가 PC의 1차 시간 조정 수단**이므로, 재설계 시 모달의 시간 입력 우선순위를 낮출 근거가 된다.

### 2.5 시각 입력 컴포넌트(스피너 UI)

`src/app/components/TimePicker.tsx`(`TimePicker`, `:13`) — ▲▼ 스피너 + 클릭 시 드롭다운(직접 입력·스크롤 리스트), `size:'sm'|'md'`, `minuteStep`.

**재사용처(소스 import 확인)**: `TodoModal.tsx`(4곳), `EventModal.tsx`(2곳), `TimelineAddModal.tsx`(2곳). 그 외 페이지의 import는 현재 grep으로 확인되지 않음(다른 페이지 사용 여부는 **확인 불가** — PROGRESS_LOG 언급은 있으나 소스 import는 위 3파일).

---

## 3. 디자인 토큰 출처 (드리프트 감사)

> 기준 파일: `src/app/ThemeContext.tsx`, `src/styles/haon.css`, `DESIGN.md`.

### 3.1 입력 필드 라일락/연보라 배경

- **"입력 필드는 팔레트 색으로 채운다"는 규칙 존재 여부: 없음.** 오히려 `DESIGN.md §5 Input`은 "`solid-card` fill(=불투명 흰색), hairline border"를 규정 → 라일락 채움은 **§5 Input 규정과 어긋남**.
- **실제 값**: `t.bgSub` 토큰(하드코딩·`--cat-*` 아님). Theme H에서 `bgSub: '#F4E7FB'`(lavender-mist, `ThemeContext.tsx:285`).
- **인용**: `TodoModal.tsx:368, 425, 599, 661` / `EventModal.tsx:148, 170, 180, 210, …` / `TimelineAddModal.tsx:91, 134` — 모두 `backgroundColor: t.bgSub`.
- **모달 내부 불일치**: 태그 생성/편집 하위 패널의 입력만 `t.card`(흰색)를 씀(`TodoModal.tsx:722, 773, 859, 908`) → 같은 모달 안에서 라일락/흰색 혼재.

### 3.2 `종류`(핫핑크) · `레인`(초록) 토글 — `TimelineAddModal`

- 공통 스타일 `seg(active, accent)`(`TimelineAddModal.tsx:48-53`): `backgroundColor: active ? accent : 'transparent'`, 활성 텍스트 `#fff`(풀필).
- **종류 토글**(`:69-72`): 할일 = `t.accent`(=`#FF6F91` pink-vivid 토큰, `ThemeContext.tsx:292`) 풀필 = **핫핑크의 정체**; 일정 = **하드코딩 `#7B9ED9`**(블루, `:71`).
- **레인 토글**(`:79-80`, 색 정의 `:54`): `const planClr = '#C4A882', doClr = '#6BAA7A';` — PLAN=탄/골드, DO=초록 **둘 다 하드코딩**.
- **초록 출처 추적**: `--cat-자기관리`(세이지)가 CSS 변수로 "새어나온" 것이 **아니다**. `#6BAA7A`를 **손으로 복사한 하드코딩 리터럴**(`TimelineAddModal.tsx:54`)이며, 우연히 `haon.css:45`의 `--cat-selfcare-dot: #6baa7a`(자기관리 세이지)와 같은 값. 또한 테마 토큰 `t.planBlock`/`t.doBlock`(`ThemeContext.tsx:297, 300`)도 사용하지 않음(2차 드리프트).
- **`DESIGN.md §5 세그먼트 규칙 위반 판정: 위반.** §5는 "세그먼트 = 흰 pill + soft shadow + deep-indigo 600 라벨 + **3px coral 언더라인**, **풀필 금지**"인데, 이 토글들은 accent/blue/tan/green **풀필**이다.

### 3.3 `isHaon(t)` 게이트

**세 모달 모두 사용 없음.** `TodoModal.tsx`/`EventModal.tsx`/`TimelineAddModal.tsx` grep 결과 `isHaon` 0건 → **Theme H 마이그레이션 미적용**(raw `t.*` 토큰만 소비, H 분기 없음).

### 3.4 하드코딩 폰트 문자열 리터럴

**세 모달 모두 없음.** `font-family` / `'Pretendard'` / `'Gmarket'` / `var(--font-*)` 리터럴 0건(모든 `font*`는 `fontSize`/`fontWeight` 숫자 prop). → `scripts/check-fonts.mjs` 규칙 위반 없음.

### 3.5 하드코딩 색상값 전체 목록

**TodoModal.tsx**
- `:328` `rgba(0,0,0,0.4)`(오버레이) · `:336` 그림자 `rgba(0,0,0,0.1)`×2
- `:507, :529, :633, :819, :955, :1007` `'#fff'`(활성 칩/버튼 텍스트)
- `:561-563` 분리 예외 배너 `#EEF6FF` / `#C0D8F8` / `#5B8FD8`
- danger 계열 `#DC2626`·`#FEE2E2`·`#FEF2F2`·`#FCA5A5`: `:750, :770, :782-784, :807, :886, :906, :918-920, :943, :991`

**EventModal.tsx**
- `:51` `#7B9ED9`(기본 이벤트 색) · `:115` `rgba(0,0,0,0.4)` · `:123` 그림자 `rgba(0,0,0,0.1)`×2
- `:332` 에러 배너 `#FEF2F2`/`#DC2626` · `:344` 삭제 버튼 `#DC2626`/`#FEE2E2` · `:353` `'#fff'`

**TimelineAddModal.tsx**
- `:34, :71` `#7B9ED9`(일정 색/토글) · `:54` `#C4A882`+`#6BAA7A`(PLAN/DO) · `:52, :152` `'#fff'`
- `:57` `rgba(0,0,0,0.35)` · `:59` 그림자 `rgba(0,0,0,0.15)`

---

## 4. 요약 (필수 결론)

### 모델 판정 — **A**
1. 단일 `todos` 행이 `plan_*` + `do_*` + `do_elapsed_sec`를 모두 보유하고 lane 컬럼이 없다(라이브 스키마 · `store.tsx:26-31`).
2. `planTodos`(`Timeline.tsx:852`)와 DO 막대(`:857-871`)가 같은 `dateTodos`에서 파생되어 한 행이 두 레인에 렌더된다.
3. `renderBlock`이 같은 todo에서 plan/do 필드를 선택(`:885-887`) → 한 항목이 PLAN·DO 동시 출현.

### "실적" 필드의 운명 — **살아있는 컬럼(도달 가능)**
- `do_start`/`do_end`는 `TimelineAddModal`의 DO 레인 추가(`TimelineAddModal.tsx:43`)·타임라인 DO 드래그(`Timeline.tsx:236-243`)로 실제 저장되고, `TodoModal`의 "실적 시작/실적 종료" 입력(`TodoModal.tsx:449-465`, `hasDoTime` 게이트 `:76`)으로 편집된다. `누적 시간`(`:467-477`)도 timeBlocks 합으로 실제 렌더 → **죽은 코드 아님.**
- 예외: `todos.do_date`(date) 컬럼은 `db.ts`의 `TodoRow`/매핑에 없어 **앱 계층에서 미사용(오펀)**. `todos.note`·`source_url`도 동일하게 미매핑.
- 별도 죽은 코드: `db.ts`의 레거시 `EventRow`/`toEvent`/`fromEvent`(`:116, :491, :500`)는 어디서도 호출되지 않음 — `db.events`가 `api/events.ts`(v2 `start_at/end_at`)에 전량 위임(`db.ts:1291-1308`). `events`의 레거시 컬럼 `date`/`start_time`/`end_time`/`tags`도 쓰기 경로 없음(`Event.tags`는 항상 `[]`, `api/events.ts:175`).

### 일정 vs 할일 — 필드 차이 표
§1.5 표 참조. 핵심: 할일은 **PLAN+DO 2범위·계획/실적·타이머·Top3**, 일정은 **단일 범위·completed만·알림/링크/장소·종일**. 일정에는 계획/실적 구분이 없다.

### DESIGN.md 위반 목록

| # | 위치 | 규칙 | 위반 내용 |
|---|---|---|---|
| V1 | `TimelineAddModal.tsx:48-53, 69-80` | §5 세그먼트(흰 pill+3px coral 언더라인, **풀필 금지**) | 종류·레인 토글이 accent/blue/tan/green **풀필** |
| V2 | `TimelineAddModal.tsx:54, 71` / `:34` | §3·§5 "하드코딩 색 금지, 토큰만" | `#7B9ED9`, `#C4A882`, `#6BAA7A` 하드코딩(토큰 `t.doBlock`/`t.planBlock` 미사용) |
| V3 | `TodoModal.tsx`(다수), `EventModal.tsx:51, 332, 344`, `TimelineAddModal.tsx` | §5 "off-palette 하드코딩 색 금지"(danger는 `t.danger`/`t.dangerLight`) | `#DC2626`/`#FEE2E2`/`#FEF2F2`/`#FCA5A5`, `#5B8FD8`/`#EEF6FF`/`#C0D8F8` 하드코딩 |
| V4 | `TodoModal.tsx:368…`, `EventModal.tsx:148…`, `TimelineAddModal.tsx:91,134` | §5 Input(=`solid-card`/불투명 흰색 fill) | 입력 배경을 `t.bgSub`(라일락)로 채움. 게다가 태그 하위패널만 `t.card`(흰색)로 혼재 |
| V5 | 세 모달 전체 | §10 "Pastel-glass는 Theme H", 컴포넌트는 H 계약 대상 | `isHaon` 게이트 0건 — Theme H 마이그레이션 미적용 |
| — | (위반 아님) | §4/§8 폰트 리터럴 금지 | 하드코딩 폰트 문자열 없음(통과) |

### 재설계 시 깨질 위험이 있는 지점

1. **모델 A 이중성.** PLAN/DO를 하나의 "시간 범위" UI로 합치면 `plan_*`↔`do_*` 이원 구조가 깨진다. `TodoModal`의 `hasDoTime` 분기(계획/실적 라벨 전환, `:436/:442/:449`)와 `buildChanges`의 조건부 do_* 반영(`:260-261`)을 그대로 유지하지 않으면 실적 편집이 유실될 수 있다.
2. **3분할 모달.** `TodoModal` / `EventModal` / `TimelineAddModal` 3곳을 동시에 손대야 하며, 태그 생성·반복·프로젝트 등 기능 격차(§2.2)를 통합하지 않으면 진입점별로 동작이 갈린다.
3. **드래그 커밋 경로와의 정합.** 시간 편집을 모달로 옮기면, 드래그 up 커밋(`Timeline.tsx:223-250`: PLAN→`plan_*`, 레거시 DO→`do_*`, 시간블록→`updateTimeBlock`)과 저장 필드가 일치해야 한다. 특히 DO는 **레거시 do_* vs `todo_time_blocks` 이중 경로**(dual-read, `timeBlocks.ts:42-48`)라 어느 쪽에 쓰는지 혼동 위험.
4. **Top3 3개 제한 우회.** 모달 저장 경로가 `toggleTop3`(`store.tsx:1448-1449`)를 우회 → 통합 폼에서도 동일 우회가 이어지면 제한이 무력화된다. DB constraint 부재.
5. **반복 레거시/통합 이원.** 두 모달은 레거시 필드(`recurrence_rule` / `repeat_type`)만 쓰는데 통합 컬럼(`recurrence_freq` 등)이 dual-read로 공존한다. 재설계 시 어느 스펙에 쓸지 결정하지 않으면 두 시스템이 어긋난다.
6. **events 레거시/v2 컬럼 + 죽은 매핑.** `db.ts`의 레거시 `toEvent/fromEvent`(죽은 코드)와 `events`의 레거시 컬럼(`date/start_time/end_time`)을 실 스키마로 오인하면 잘못된 필드에 쓰게 된다. 쓰기 SSOT는 `api/events.ts`(`start_at/end_at` text).
7. **QuickAddInput 프리필 prop 이름 불일치.** "자세히" 진입 시 할일=`initialPlanStart/PlanEnd`·일정=`initialStartTime/EndTime`(§2.3)로 이름이 달라, 통합 폼이 한쪽 이름만 받으면 프리필이 유실된다.
8. **오펀 컬럼.** `do_date`/`note`/`source_url`은 DB에 존재하나 `TodoRow`에 미매핑 — 재설계에서 "쓰면 되겠지"로 접근하면 매핑 계층(`db.ts` `toTodo`/`fromTodo`)부터 손봐야 한다.
