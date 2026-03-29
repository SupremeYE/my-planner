# PROGRESS_LOG.md — My Planner 진행 현황

> 사용법:
> - `todo로 넣어줘: [내용]` → 오늘 날짜 TODO에 추가
> - `진행현황 기록` → 오늘 작업 내용을 이 파일에 저장

---

## 2026-03-29

### 📋 TODO

### ✅ 완료
- [x] 모바일 반응형 개선 - 일간 페이지 탭 UI + 전역 가로 스크롤 제거
- [x] 모바일 일간 헤더 한 줄 표시 (날짜 + 버튼 줄바꿈 수정)
- [x] 캘린더 주별/일별 뷰 스크롤 구조 개선 (이중 스크롤 → 단일 스크롤)
- [x] CLAUDE.md 모바일 작업 원칙 및 주요 기능 항목 업데이트

### 🛠 오늘 작업 내용

**① 모바일 반응형 - 일간 탭 UI (`DailyView.tsx`, `Layout.tsx`)**
- `DailyView.tsx`: 할일 목록 + 타임라인 좌우 분할 → 모바일 탭 전환 방식으로 변경
  - `mobileTab` state (`'todos' | 'timeline'`), 탭 바 추가 (`lg:hidden`)
  - 탭 선택에 따라 패널 표시/숨김 (`hidden lg:block` / `hidden lg:flex`)
  - 데스크탑(`lg+`) 기존 좌우 분할 레이아웃 완전 유지
- `Layout.tsx`: 모바일 `<main>`에 `overflow-x-hidden` → 전 페이지 가로 스크롤 차단

**② 모바일 일간 헤더 한 줄 수정 (`DailyView.tsx`)**
- 헤더 패딩: `px-3 py-3` (모바일) / `px-6 py-4` (데스크탑 `lg:`)
- 좌측 gap: `gap-1.5` (모바일) / `gap-3` (데스크탑)
- "시간대 설정" 버튼: 모바일에서 아이콘만 (`<span className="hidden lg:inline">`)
- "할일 추가" 버튼: `whitespace-nowrap` 적용
- 날짜 폰트: 18px (모바일) / 20px (데스크탑)

**③ 캘린더 스크롤 구조 개선 (`CalendarView.tsx`)**
- `WeekView`: `overflow-x-auto` + `minWidth: 560` 제거 → 7열이 화면 너비에 맞게 자동 축소
  - 요일 헤더 `flex-shrink-0` 고정 / 타임라인은 `overflow-y-auto` 단일 스크롤
- `DayViewPanel`: `maxHeight: 60vh` 제거 → `flex-1`로 남은 높이 채움
- `CalendarView` 탭별 레이아웃 분리
  - 월별: 기존 페이지 스크롤 유지
  - 주별/일별: 헤더 고정 + 카드가 남은 높이 채움 + 타임라인 내부 단일 스크롤

**④ CLAUDE.md 업데이트**
- 작업 원칙에 "PC 레이아웃 유지 / 모바일 `lg:` prefix 사용" 규칙 추가
- 주요 기능에 모바일 탭 UI, 캘린더 스크롤 구조 반영

---

## 2026-03-23

### 📋 TODO
- [ ] 습관 alarmTime → useNotification 연결 (현재 DB 저장만 되고 알림 발송 미연결)
- [ ] 리뷰(Weekly/Monthly) Supabase 테이블 생성 및 연동
- [ ] 습관 반복 설정 기반 자동 표시 필터링 구현

### ✅ 완료
- [x] 스마트 알림 시스템 구현 (할일 planStart 기준 로컬 알림)
- [x] 공통 TimePicker 컴포넌트 생성 및 11곳 교체
- [x] TimePicker UX 3단계 개선 (스크롤+직접입력 → 드롭다운 패널 → 분 1분단위 휠+패널직접입력)
- [x] vercel.json SPA 라우팅 404 수정
- [x] 주간 칸반 드래그앤드롭 커밋 (미커밋 상태였던 WeeklyView.tsx + @dnd-kit 패키지)

### 🛠 오늘 작업 내용

**알림 시스템 (`useNotification.ts`, `NotificationPermissionBanner.tsx`)**
- `src/app/hooks/useNotification.ts` 신규: 권한 관리, 알림 스케줄링, 배너 표시 여부
- `src/app/components/NotificationPermissionBanner.tsx` 신규: 권한 배너 (알림 허용 버튼 + 5/10/30분/1시간 선택 + iOS 안내)
- `DailyView.tsx`: 오늘 todos의 `planStart` 기준 알림 자동 등록, URL params(`?date=&todoId=`) 로 해당 할일 하이라이트+스크롤
- `public/sw.js` + `usePWA.ts`: `notificationclick` 개선 — 열린 창 있으면 `client.navigate()`, 없으면 `openWindow()`
- `Layout.tsx`: 데스크탑/모바일 main 영역 상단에 배너 마운트
- ⚠️ **미연결**: HabitModal의 `alarmTime`은 DB 저장만 됨, 알림 발송 로직 별도 구현 필요

**공통 TimePicker (`src/app/components/TimePicker.tsx`)**
- 신규 파일: ▲▼ 버튼 + 휠 스크롤 + 드롭다운 패널 + 패널 직접 입력 통합 컴포넌트
- props: `value`, `onChange`, `placeholder`, `minuteStep`(기본 5, 버튼용), `size`(sm/md)
- 교체된 11곳: DailyView 6곳(SnoozeModal/TodoModal planStart+End/TimelineLogModal/TimelineSettings), HabitsView 2곳(alarmTime/startTime), RoutinesView 1곳, BrainstormView 2곳
- 분 휠: `minuteStep` 무시하고 항상 1분 단위
- 패널: 시(0-23)/분(0-59) 전체 리스트, 열리면 현재값 선택+스크롤+input 자동포커스
- 패널 input: 타이핑 → 리스트 스크롤, Enter 확정, Escape 취소

**배포**
- `vercel.json` 추가: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` — SPA 새로고침 404 해결

---

## 2026-03-22

### 📋 TODO

### ✅ 완료
- [x] Supabase 테이블 생성 SQL 실행 완료
- [x] Supabase 전면 연동 — events, weeklyGoals, monthlyGoals, brainstormItems, brainstormMemos, tags
- [x] 타임라인 로그 버그 수정 (DailyView mock 데이터 제거, store 연동)
- [x] 루틴 실행 UI 구현 (단계 체크 + 카운트다운 타이머)
- [x] 습관 목표 유형 5종 구현 (체크/횟수/시간/수치/메모)

### 🛠 오늘 작업 내용
- Supabase 대시보드에서 아래 테이블 수동 생성:
  - `events`: 일정 (id, title, date, start_time, end_time, location, memo, tags, created_at)
  - `weekly_goals`: 주간 목표 (id, text, done, monthly_goal_id, week_key, created_at)
  - `monthly_goals`: 월간 목표 (id, text, month, project_id, created_at)
  - `brainstorm_items`: 브레인스톰 항목 (id, text, date, week_key, created_at)
  - `brainstorm_memos`: 브레인스톰 메모 (date PK, text)
  - `tags`: 태그 (id, name, color, created_at)
  - `routines`: 루틴 (id, name, icon, ...)

- `src/lib/db.ts`: events, weeklyGoals, monthlyGoals, brainstormItems, brainstormMemos, tags CRUD 추가
  - Row 타입 6개 추가 (EventRow, WeeklyGoalRow, MonthlyGoalRow, BrainstormItemRow, BrainstormMemoRow, TagRow)
  - to/from 변환 함수 추가
  - db.events / db.weeklyGoals / db.monthlyGoals / db.brainstormItems / db.brainstormMemos / db.tags 객체 추가

- `src/app/store.tsx`: in-memory → Supabase 연동으로 전환
  - 앱 초기 로드 시 6개 테이블 데이터 fetch 추가
  - tags: DB가 비어있으면 기본 5개 태그 자동 시드
  - addEvent / updateEvent / deleteEvent → db.events 연동
  - addWeeklyGoal / toggleWeeklyGoal / deleteWeeklyGoal → db.weeklyGoals 연동
  - addMonthlyGoal / deleteMonthlyGoal → db.monthlyGoals 연동
  - addBrainstormItem / deleteBrainstormItem / brainstormToTodo / brainstormToEvent / setBrainstormMemo / addWeeklyBrainstorm / weeklyBrainstormAssign → db.brainstormItems + db.events 연동
  - addTag / updateTag / deleteTag → db.tags 연동

- `src/app/components/DailyView.tsx`: 타임라인 로그 버그 수정
  - 로컬 `timelineLogs` state 및 mock 데이터 4개 제거
  - store의 `timelineLogs`, `addTimelineLog`, `deleteTimelineLog` 사용
  - `addTimelineLog` 래퍼: modal이 넘긴 id를 제거하고 store 함수 호출 (store가 id 생성)

- `PROJECT_SPEC.md`: 연동 현황 전면 업데이트 (4번, 5번 항목)

- `src/app/components/RoutinesView.tsx` (신규): 루틴 실행 페이지
  - `RoutineModal`: 루틴 추가/편집 (이름, 아이콘, 시작시간, 소요시간, 단계 목록)
  - `ExecutionPanel`: 하단 시트 — SVG 원형 카운트다운 타이머 + 단계 체크박스 + "완료로 기록" 버튼
  - `RoutineCard`: 아이콘, 이름, 시간, 소요시간, 연속일 배지, 편집/실행 버튼
  - 연속 달성일 계산 (`getStreak`), 완료 순서 정렬 (미완료 → 완료, startTime 기준)
  - Supabase `checked_dates` 컬럼 마이그레이션 적용

- `src/app/components/HabitsView.tsx` (전면 재작성): 5종 목표 유형
  - `HABIT_TYPES` 상수 (check/count/time/value/memo)
  - `HabitModal`: 5열 세그먼트 선택 UI + 유형별 목표 필드 (횟수·단위·시간·수치+단위·없음)
  - `HabitChip`: 유형별 왼쪽 위젯
    - `check`: 기존 원형 체크 버튼
    - `count`: − 버튼 + 카운터 "진행/목표", 탭으로 +1, 목표 달성 시 자동 체크
    - `time`: 타이머 (setInterval + useRef 누적), 중지 시 Supabase 저장
    - `value`: 인라인 숫자 입력, blur/Enter 시 저장
    - `memo`: 체크 후 인라인 텍스트 영역 표시
  - `updateHabitProgress`, `updateHabitMemo` store 연동
  - Supabase `habit_type, target_value, value_unit, daily_progress, daily_memos` 마이그레이션 적용

- `src/app/components/Layout.tsx`: '루틴 실행' 사이드바 메뉴 추가
- `src/app/routes.tsx`: `/routines` 라우트 추가

---

## 2026-03-21

### 📋 TODO
- [ ] 스마트 알림 시스템 구현 (습관 알림 + 할일 사전 알림)

### ✅ 완료
- [x] 주간 칸반 보드 드래그앤드롭 구현 (@dnd-kit/core)
- [x] PROGRESS_LOG.md 초기 생성 및 GitHub 커밋
- [x] PROJECT_SPEC.md 최신화 (2026-03-21 기준)
- [x] CLAUDE.md 단축 명령어 규칙 추가 및 형식 정리

### 🛠 오늘 작업 내용
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
