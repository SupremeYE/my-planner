# PROGRESS_LOG.md — My Planner 진행 현황

> 사용법:
> - `todo로 넣어줘: [내용]` → 오늘 날짜 TODO에 추가
> - `진행현황 기록` → 오늘 작업 내용을 이 파일에 저장

---

## 2026-06-03

### 📋 TODO
- [ ] 문화 기록 Stage 2: 모바일 전용 레이아웃 + 유튜브/플랫폼 썸네일 자동 fetch
- [ ] (선택) 캘린더 `CalendarView.tsx` 미사용 `WeekView` 함수(약 350줄)·미사용 상수 3개 제거

### ✅ 완료
- [x] 문화 기록 페이지(`/culture`) 신규 추가 — Stage 1 PC 레이아웃
- [x] `culture_records` 테이블 마이그레이션 작성 + Supabase(my-planner) 적용
- [x] `culture_records` 에 `external_source`/`external_id` 컬럼 추가 (Stage 2 TMDB/유튜브 자동검색 대비, Stage 1=manual)
- [x] 사이드바/모바일 오버레이/탑네비에 "문화 기록" 메뉴 추가
- [x] 캘린더 주별 Today 버튼 동작 안 함 수정 (모바일 3일 탭이 오늘 페이지로 이동)
- [x] 캘린더 월별 뷰 모바일 좌우 스와이프로 이전/다음 달 전환 추가
- [x] 캘린더 주별 타임라인 좌우 스와이프 시 화면 바운스(고무줄 오버스크롤) 제거
- [x] 새벽 수면(시작 시각 이전, 예 00:30~07:27)이 타임라인에서 잘리던 버그 수정 (주별·일간 공용 유틸)

### 🛠 오늘 작업 내용

**① 문화 기록 페이지 신규 추가 — Stage 1 (PC 전용)**
- 목적: 영화/드라마/예능/다큐/애니/유튜브/강의 등 시청 콘텐츠 기록
- `supabase/migrations/20260602000000_create_culture_records.sql`: `culture_records` 테이블
  - `user_id uuid DEFAULT auth.uid()` + per-row RLS(`auth.uid() = user_id`) — `reading_logs` 패턴
  - `supabase_realtime` publication 등록 (PC↔모바일 즉시 반영)
  - Supabase MCP `apply_migration` 으로 운영 DB(my-planner) 적용 완료
- `src/lib/db.ts`: `db.cultureRecords` CRUD 레이어 (user_id 미전송 → DB 기본값으로 충전)
- `src/app/store.tsx`: `CultureRecord` 타입 + 플랫폼/유형/상태 유니온 타입 추가
- `src/app/components/CultureRecordView.tsx`: 페이지
  - 포스터 그리드(PC 6열, 2:3), 썸네일 또는 플랫폼 그라데이션+유형 아이콘 placeholder
  - 좌상단 플랫폼 미니뱃지 / 우상단 상태 아이콘 / 하단 제목+골드 별점, hover 리프트
  - 플랫폼·유형·상태 칩 다중 필터 + 제목/태그 검색 + 정렬(기록일/본날짜/별점)
  - 빈 상태 UI, `useRealtimeSync('culture_records', refresh)` 구독
- `src/app/components/culture/CultureFormModal.tsx`: 추가/수정 모달 (제목·URL·플랫폼·유형·상태·본날짜·썸네일·별점·리뷰·인사이트·태그, 저장/취소/삭제)
- `src/app/components/culture/StarRating.tsx`: 0.5단위 반쪽 별, read-only/인터랙티브
- `src/app/components/culture/cultureMeta.ts`: 플랫폼/유형/상태 라벨·색상·아이콘 메타
- `src/app/routes.tsx`: `/culture` 라우트 연결
- `src/app/components/Layout.tsx` / `LayoutC.tsx`: "문화 기록"(Clapperboard) 메뉴 추가
- 디자인 시스템 토큰만 사용, 기존 페이지 PC 레이아웃 미변경
- 메모: 작업 지시서의 `.jsx`/`src/pages/` 대신, 저장소 규칙(TS·`src/app/components/XxxView.tsx`)에 맞춰 `.tsx`로 구현
- 추가(같은 날): `external_source`(`tmdb_movie|tmdb_tv|youtube|manual`)·`external_id` 컬럼 추가
  - `20260603000000_add_culture_external_source.sql` 신규 ALTER 마이그레이션 + create 마이그레이션 정의에도 반영, Supabase MCP 로 운영 DB 적용
  - `db.ts` upsert 시 출처 미지정이면 `'manual'` 저장 → Stage 2 자동검색이 출처/ID 채움

**② 주별 Today 버튼 수정 (`WeekViewMobile.tsx`)**
- 증상: 주별 화면에서 Today 버튼을 눌러도 동작하지 않는 것처럼 보임
- 원인: 모바일 주별 기본 탭인 **3일 탭(`ThreeDayView`)** 은 내부 `page`(0/1/2) 상태를 가지는데,
  Today 클릭 시 `viewDate` 는 오늘 주로 바뀌어도 페이지가 **항상 0(주의 첫 3일)으로만 리셋** 되어
  오늘이 페이지 1·2에 있으면 화면에 안 보였음 (일별·주간요약 탭, PC 주별은 정상)
- 수정: `ThreeDayView` 에 `selectedDate` 전달 + 페이지 동기화 effect 를
  `days[0]` 변경 → `[days, selectedDate]` 기준으로 변경하여 **선택 날짜(=오늘)가 포함된 페이지로 이동**
- 부수효과: 화면 첫 진입 시에도 오늘이 보이는 페이지로 열림

**③ 월별 모바일 좌우 스와이프 추가 (`CalendarView.tsx`)**
- 월별 캘린더 카드에 `onTouchStart/onTouchEnd` 추가 → 왼쪽 스와이프=다음 달 / 오른쪽 스와이프=이전 달
- 가로 이동이 세로보다 크고 50px 초과일 때만 발동 → 날짜 탭/세로 스크롤과 오인 방지
- PC 는 마우스라 터치 이벤트 미발생 → PC 레이아웃·동작 영향 없음 (모바일 전용 보완)

**④ 주별 타임라인 바운스 제거 (`WeekViewMobile.tsx`, `WeekViewPC.tsx`)**
- 증상: 주별 탭 타임라인을 좌우 스와이프할 때 화면이 위아래로 퉁퉁 튕김(iOS 고무줄 오버스크롤)
- 원인: 주별 내부 스크롤 컨테이너에 `overscroll-behavior` 미설정 + 스와이프가 `onTouchEnd`에서만 판정
- 수정: 3일·일별 스크롤러에 `overscroll-behavior: contain` + `touch-action: pan-y`(가로 스와이프가
  네이티브 스크롤/바운스를 유발하지 않게), 주간요약·WeekViewPC 스크롤러에 `overscroll-behavior: contain`

**⑤ 새벽 수면 타임라인 잘림 수정 (`src/lib/sleepTimeline.ts` 신규, 주별·일간 공용)**
- 증상: 타임라인 시작 시각(예 04:00)보다 이른 새벽 수면(예 00:30~07:27)이 일부만 희미하게 보임
- 원인: 위치 계산이 `(분 − startHour×60)`라 startHour보다 이른 시각은 top이 음수 → 화면 위로 잘림
- 수정: 공용 유틸 `placeSleepSegment()` 신규 — 새벽 시각을 타임라인 아래로 감싸고(+24h) endHour에서
  클립해 0~2개 사각형으로 분할. `WeekViewMobile`(3일·일별)·`WeekViewPC`·`DailyView` 수면 렌더를 유틸로 교체
- `DailyView`: 드래그 중엔 단일 블록(연속 이동감) 유지, 비드래그 시 분할 렌더 — 이동/리사이즈 핸들은
  primary 조각에만, 보조 조각은 탭하면 편집 모달. 기본 설정(시작0/종료24)은 단일 블록 그대로(무회귀)

---

## 2026-06-02

### 📋 TODO

### ✅ 완료
- [x] 캘린더 하단 상세 패널에 할일·일정 직접 관리(체크/수정/미루기/삭제) 추가
- [x] 캘린더에서 반복 할일 표시 및 "이 항목만/이후/전체" 분기 삭제 지원
- [x] 하단 패널을 상단 필터 탭(전체/할일/일정/습관/자기관리)과 일관되게 동작하도록 연동

### 🛠 오늘 작업 내용

**① 캘린더 하단 상세 패널 확장 — 조회 전용 → 일간 동일 CRUD (`CalendarView.tsx`)**
- 배경: 기존 하단 패널은 할일·일정·습관을 **조회만** 했고(완료 토글·수정·삭제 불가), 반복 할일은 표시조차 안 됐음
- 목적: 날짜를 누르면 그 날짜의 항목을 일간 페이지와 동일하게 직접 관리
- 섹션 구성: `할일 / 일정 / 습관 / 자기관리 / 메모` 를 divider 로 구분 (자기관리 섹션 신규 추가)
- 상단 필터 탭과 일관: `전체`면 전 섹션, 특정 탭이면 해당 섹션만 표시 (`showTodoSection` 등 플래그)
- 반복 할일: `expandRecurringTodos(todos, panelDate, panelDate)` 로 가상 인스턴스 포함 표시 → 반복이든 일반이든 그 날짜 항목 모두 노출
- 할일 카드: 일간 `TodoRow` 스타일(좌측 원형 완료 체크박스 + 항목명 + Top3 별 + 태그). 태그는 각 `tag.color` 그대로 렌더
- 동작(일간 핸들러/모달 재사용):
  - 완료 체크 → store `updateTodo`(가상 인스턴스는 내부 `ensureMaterializedTodoId` 로 자동 구체화)
  - 항목 탭 → `TodoModal`/`EventModal` 수정 모달
  - 미루기(→) → 다음 날짜로 이동(반복 인스턴스는 `SnoozeModal` 과 동일하게 이 날짜만 취소 후 단일 할일 생성)
  - 삭제(x) → 반복 할일은 `RecurrenceBranchModal`("이 항목만/이후/전체"), 일반 할일·일정은 `ConfirmModal` 확인 팝업
- 일정(이벤트): 완료 개념 없어 체크 생략, 수정/미루기/삭제만 제공
- 제약 준수: 색상값 하드코딩 없이 디자인 토큰(`t.*`)만 사용, 기존 습관 섹션 표시 유지, PC 레이아웃 미변경
- 데이터 일치: 일간 페이지와 동일한 store 핸들러(Supabase) 재사용으로 동작·데이터 100% 일치

---

## 2026-06-01

### 📋 TODO

### ✅ 완료
- [x] 독서 진행 이력(`reading_logs`) 테이블 추가 + 현재 페이지 저장 시 자동 스냅샷 로깅
- [x] reading_logs 마이그레이션 타임스탬프 충돌 수정 (add_weight_tracking 과 동일 prefix 였음)
- [x] 식단 페이지 데이터 사라짐 버그 수정 (카페 식사유형 저장 실패)
- [x] 일간 페이지 할일 체크박스 모바일 탭 유실 버그 수정
- [x] 반복 할일 인스턴스 완료/실행/미루기/수정/삭제 동작 복구
- [x] 반복 할일 수정 모달에서 주기 변경·반복 해제 가능하도록 수정
- [x] reading_logs 테이블 운영 DB에 실제 적용(MCP)
- [x] daily-report Edge Function에 일정·식단·감정·독서 4개 섹션 추가

### 🛠 오늘 작업 내용

**① 독서 진행 이력 reading_logs 테이블·자동 로깅 (`supabase/migrations/`, `BooksView.tsx`)**
- 목적: `books.current_page` 는 누적값만 가져 "오늘 몇 페이지 읽었는지" 알 수 없었음 → 변경 이력 보존
- DB: 마이그레이션 `20260531025000_create_reading_logs.sql`
  - 컬럼: `id uuid PK / user_id uuid DEFAULT auth.uid() FK→auth.users / book_id text FK→books(id) ON DELETE CASCADE / page int / date text(yyyy-MM-dd) / duration_minutes int null / note text null / created_at timestamptz`
  - `book_id` 는 스펙의 uuid 가 아니라 실제 `books.id` 타입(text, nanoid)에 맞춰 text 로 정의 (FK 타입 불일치 방지)
  - 인덱스: `(user_id, date)` 데일리 리포트용 · `(book_id, date)` 책별 이력용
  - RLS: owner-only (`FOR ALL / TO authenticated`, `auth.uid() = user_id`)
  - Realtime: `supabase_realtime` publication 등록 (PC↔모바일 즉시 반영)
- 저장 로직 (`BooksView.handleSaveProgress`):
  - `current_page` 가 **실제로 바뀐 경우에만**(`updated.currentPage !== book.currentPage`) INSERT → 변경 없이 저장 시 중복 로그 방지
  - `date` 는 기존 패턴(`format(new Date(),'yyyy-MM-dd')`) 재사용, `duration_minutes`·`note` 는 null, `user_id` 는 DB DEFAULT `auth.uid()` 가 채움
  - INSERT 는 books 저장과 독립된 fire-and-forget → 실패해도 현재 페이지 저장은 정상 처리, 콘솔 에러만 남김
- 독서 페이지 시각적 UI/PC 레이아웃 변경 없음 (이력 표시 UI 는 별도 작업)

**② 마이그레이션 타임스탬프 충돌 수정 (`supabase/migrations/`)**
- `create_reading_logs` 와 `add_weight_tracking` 이 동일 버전 prefix `20260531020000` 를 사용 → `supabase db push` 시 버전 중복으로 적용 실패/순서 모호 위험
- `git mv` 로 `20260531020000_create_reading_logs.sql` → `20260531025000_create_reading_logs.sql` (내용 동일)
- books(20260530130000) 이후·condition_records(030000) 이전으로 정렬돼 FK 의존성 그대로 충족, 전체 마이그레이션 버전 모두 유일 확인

**③ 식단 데이터 사라짐 버그 — `food_records` dining_type CHECK 제약 (`supabase/migrations/`)**
- 증상: 모바일에서 식단 추가 후 앱을 다시 열면 사라짐 (특히 "카페" 선택 시)
- 원인: 앱 코드(`DiningType`, `FoodView`)는 집밥/배달/외식/**카페(coffee)** 4종을 제공하나,
  DB 제약 `food_records_dining_type_check`는 home/delivery/restaurant 3종만 허용 → 카페 저장 시
  INSERT가 CHECK 위반으로 400, 낙관적 업데이트로 화면엔 보였다가 재조회 시 사라짐
- 진단 근거: DB 마지막 식단 05-26이 끝, 인증 컨텍스트로 `dining_type='coffee'` insert 시
  `ERROR 23514 violates check constraint` 재현, API 로그에 `POST /food_records 400` 확인
- 조치: 마이그레이션 `20260601000000_fix_food_dining_type_allow_coffee.sql` — 제약에 'coffee' 추가,
  운영 DB 적용 완료

**④ 일간 할일 체크박스 모바일 탭 유실 (`DailyView.tsx`)**
- 증상: 일간 페이지 할일(top3로 본 것 포함)의 원형 완료 체크박스가 모바일에서 토글 안 됨
- 원인: `TodoRow`가 `DailyView` 내부에 정의된 채 `<TodoRow/>` 엘리먼트로 렌더 → 매 렌더마다
  새 컴포넌트 타입이 되어 행 전체가 unmount/remount. 포커스 타이머 1초 틱·Realtime 갱신 등으로
  리렌더가 겹치면 iOS Safari에서 touch→click 사이 노드 교체로 클릭이 유실됨
  (top3/일반 구분 없이 동일 — 두 영역 모두 같은 `TodoRow` 사용, top3 전용 로직 차이 없음)
- 조치: `TodoRow`를 엘리먼트가 아닌 **함수 호출(인라인 렌더)** 로 변경해 리마운트 제거, 루트 div에 key 유지

**⑤ 반복 할일 인스턴스 동작 복구 (`store.tsx`, `DailyView.tsx`)**
- 원인: 일간뷰는 반복 할일을 가상 id(`parentId::date`)로 전개하는데, 체크박스·미루기·상태변경·
  DO편집·드래그·포커스 타이머가 `updateTodo(가상id)`를 호출 → DB에 없는 id라 no-op
- 조치: store에 `ensureMaterializedTodoId` 추가 — 가상 인스턴스를 그 날짜의 실제 예외 레코드로
  구체화한 뒤 실제 id로 변경 적용 (`updateTodo`·`startTimer`가 사용). 미루기는 원래 occurrence 취소 +
  선택 날짜에 단일 할일 생성으로 처리
- 반복 할일을 top3로 지정하면 `expandRecurringTodos`가 `isTop3`를 각 날짜 인스턴스에 복사 →
  다른 날짜 페이지 top3 영역에도 표시 (강제 top3 아님)

**⑥ 반복 할일 수정 모달 — 주기 수정/해제 (`TodoModal.tsx`)**
- 증상: 반복 할일 수정 모달이 "반복 일정입니다" 배너만 보이고 주기 변경·해제 불가
- 원인: 가상 인스턴스면 반복 설정 UI를 숨기고 배너만 노출(`isRecurringInstanceUI`)
- 조치: 반복에서 분리된 단일 예외 레코드(`recurrenceParentId`)만 배너 유지, 그 외(가상 인스턴스·
  부모 반복)는 현재 값으로 채워진 반복 설정 UI 노출 → 주기 변경/반복 해제 가능.
  저장은 기존 scope(이 일정만/이후/전체) 모달 → `updateRecurringTodo`로 Supabase 갱신

**⑦ reading_logs 테이블 운영 DB 실제 생성 (Supabase MCP)**
- 마이그레이션 파일만으로는 운영 DB에 테이블이 안 생기는 상태였음 → MCP `apply_migration` 으로 `my-planner`(kfvijixulsvxelmmqzpm) 프로젝트에 직접 적용
- 검증: 컬럼 8개·인덱스 3개(pkey 포함)·RLS 활성+owner-only 정책 1개·`supabase_realtime` 등록 모두 확인
- 참고: `create table if not exists` 라 추후 `supabase db push` 와 충돌 없음

**⑧ daily-report Edge Function 카테고리 확장 (`supabase/functions/daily-report/index.ts` 단일 파일)**
- 기존 todos/habits 만 담던 일일 리포트에 **오늘 일정(events) / 식단(food_records) / 감정(mood_records) / 독서(reading_logs+books)** 4개 섹션 추가 (헤더-할일-습관 다음, 마무리 멘트 앞)
- 섹션별 빌더 함수로 분리(`buildEventsSection`/`buildFoodSection`/`buildMoodSection`/`buildReadingSection`), 각자 try/catch 로 감싸 한 섹션 실패가 다른 섹션·전체 전송을 막지 않게 함(실패 시 "… 데이터 불러오기 실패" 한 줄)
- **events.start_at 지시-실제 스키마 불일치 처리**: 작업 지시는 timestamptz 전제(UTC 범위 쿼리)였으나 실제 DB·`src/api/events.ts`는 `start_at`이 `"yyyy-MM-ddTHH:mm:ss"` 형태의 KST 벽시계 **text** → 동일 고정폭 ISO 문자열 범위로 KST 하루를 조회하도록 구현(주석 명시), 반복 일정 전개는 TODO 주석만 남김
- 독서: 오늘 로그의 book_id별 max page − 이전(date<today) max page = delta, delta>0인 책만 books와 조인해 "오늘 +Np / 📖 〈제목〉 cur/total p" 표시
- 의존성 추가 없음, 프론트엔드/마이그레이션 미수정, 기존 kstNowInfo·헤더·마무리·todos/habits·Discord POST 로직 유지
- ⚠️ 아직 **배포(`supabase functions deploy daily-report`) 안 함** — 운영은 여전히 v2(구 코드). 배포해야 새 섹션 반영됨

---

## 2026-05-31

### 📋 TODO

### ✅ 완료
- [x] 질문일기(`/question-journal`) 신규 페이지 추가
- [x] 질문별 모아보기 기능 추가 (바텀시트/모달, 연도별 섹션, 5년 다이어리 스타일)
- [x] 캘린더 월별/주별 탭 색상을 서비스 골드/베이지 톤으로 변경
- [x] 일간 페이지 할일 미루기 시 "미루기" 상태 배지가 생기지 않도록 수정
- [x] 일정(캘린더 events) 기능 복구 — events 테이블 스키마 불일치 버그 수정
- [x] 식단 단식(끼니 거름) 기록 기능 추가 (끼니별 토글 + 달력 표시 + 통계)

### 🛠 오늘 작업 내용

**① 캘린더 월별/주별 탭 색상 개선 (`CalendarView.tsx`)**
- 파란 계열(`#eef4fa`/`#26343d`)이라 서비스 톤과 겉돌던 탭을 골드/베이지로 통일
- 컨테이너 베이지 배경(`#EFE7D8`) + 활성 탭 카드색(`#FDFAF4`)·골드 테두리(`#C4A882`)·골드 텍스트(`#8D7152`)
- PC 레이아웃 미변경, 색상만 조정

**② 일간 페이지 할일 미루기 수정 (`DailyView.tsx`)**
- `SnoozeModal.handleConfirm`의 `status: 'snoozed'` → `'active'`로 변경
- 미룬 날짜·시간 이동은 그대로 유지하되, 주황색 "미루기" 상태 배지가 더 이상 표시되지 않도록 백로그 미루기와 동작 통일

**③ 일정(events) 기능 복구 — 코드–DB 스키마 불일치 버그 (`supabase/migrations/`)**
- 원인: 운영 DB `events` 테이블에 옛 스키마(`date`/`start_time`/`end_time`)만 있고
  코드(`src/api/events.ts`)가 쓰는 `start_at`/`end_at`/`is_all_day`/`repeat_*` 컬럼이 없어
  `GET /events`가 400(`column events.start_at does not exist`)으로 실패 → 일정 추가/조회 전면 중단
- 부작용: store 초기 로딩의 `Promise.all`이 events fetch 실패로 reject되어 **태그 등 다른 상태까지 미반영**
- 조치: 마이그레이션 `20260531000000_fix_events_schema_alignment.sql` — 누락 컬럼 추가 + `date` NOT NULL 완화 (events 0행이라 데이터 손실 없음)
- events는 이미 `supabase_realtime`에 등록되어 있어 PC↔모바일 즉시 반영 정상

**④ 식단 단식 기록 기능 (`FoodView.tsx`, `store.tsx`, `db.ts`, `constants/foodIcons.ts`, `supabase/migrations/`)**
- 거른 끼니를 명시적으로 "단식"으로 기록 (별도 테이블 없이 `FoodRecord.isFasting` 플래그로 표현)
- DB: 마이그레이션 `20260531010000_add_food_is_fasting.sql` — `food_records.is_fasting boolean DEFAULT false`
- 단식 레코드 저장 형태: `food_name='단식', amount=0, calories=0, isFasting=true`
- **입력**: 음식 추가 첫 단계(끼니 선택) 하단에 "🚫 끼니별 단식" 버튼 → 한 번 누르면 즉시 저장 후 닫힘
- **기록 카드**: 🚫 아이콘 + "단식 / 이 끼니를 걸렀어요" 점선 카드 (수정 없이 삭제만)
- **식단 페이지 달력**: 날짜 셀 4분할에서 단식한 끼니를 🚫로 표시
- **통계**: "🚫 끼니별 단식" 분포 카드 신규 추가(끼니별 막대 + 총 횟수), 식비/칼로리/TOP5 등 일반 통계는 단식 제외(`mealRecords`)
- food_records는 이미 Realtime 등록됨

**⑤ 질문일기 신규 페이지 (`QuestionJournalView.tsx`, `routes.tsx`, `Layout.tsx`, `db.ts`)**
- Supabase 테이블 3개: `question_pool` / `question_answers` / `daily_question`
- Realtime 등록: 3개 테이블 모두 `supabase_realtime` publication 추가
- 내장 질문 15개 시드 데이터 (`is_custom=false`)
- `db.ts` 함수 추가:
  - `questionPool.fetchAll / create / delete`
  - `questionAnswers.fetchAll / upsertByDate / fetchByDate / fetchByQuestionId`
  - `dailyQuestion.fetchByDate / assignRandom`
- **오늘의 질문 탭**: `daily_question` 테이블에서 오늘 질문 조회, 없으면 랜덤 배정 후 저장. 답변 저장/수정 가능, `useRealtimeSync` 다기기 동기화
- **질문 탐색 탭**: 내장 15개 + 커스텀 질문 목록. 커스텀 질문 추가(Enter 지원)/삭제
- `routes.tsx`: `/question-journal` 라우트 추가
- `Layout.tsx`: 사이드바 `lifestyleNavItems` + 모바일 `MobileMenuOverlay`에 📔 질문일기 항목 추가

**② 질문별 모아보기 (`QuestionJournalView.tsx`)**
- 질문 탐색 탭 각 카드에 "기록" 버튼 추가 (ScrollText 아이콘, 항상 표시)
- `HistoryPanel` 컴포넌트: 모바일 바텀시트(90dvh) / PC 중앙 모달 오버레이
  - 배경 클릭 / ESC 키로 닫기
  - 답변 없음: "아직 이 질문에 답한 기록이 없어요" 안내
  - 답변 있음: 연도별 섹션(골드 pill 구분선) + 날짜별 `AnswerCard`
  - 최신 답변: 골드 왼쪽 테두리 + "최신" 배지 (5년 다이어리 스타일)
  - `useRealtimeSync('question_answers')` — 실시간 반영

---

## 2026-05-30

### 📋 TODO

### ✅ 완료
- [x] 모먼트 로그 독립 메뉴 + 저장 (사진 + 텍스트) — `/moments` 신규 라우트
- [x] 모먼트 저장 시 날씨 자동 기록 — Geolocation + Open-Meteo 연동
- [x] WMO 날씨 코드 → 이모지 + 한국어 매핑 헬퍼
- [x] 모먼트 카드 날씨 배지 표시 (이모지 + 기온 + 레이블)
- [x] 버그 수정: 저장 무한 로딩 (Geolocation 권한 다이얼로그 무한 대기 + moments RLS 정책 누락)

### 🛠 오늘 작업 내용

**① 모먼트 로그 독립 메뉴 추가 (`MomentView.tsx`, `routes.tsx`, `Layout.tsx`, `db.ts`)**
- `moments` Supabase 테이블 생성: `id / created_at / content / photos text[] / weather_temp / weather_code`
- `moment-photos` Storage 버킷 생성 (public, anon CRUD 정책)
- `db.ts`: `moments.fetchAll / create / delete / uploadPhoto` 함수 추가
- `MomentView.tsx` 신규 생성:
  - 작성 카드: 사진 첨부(카메라/갤러리, 최대 5장) + 텍스트 입력 + 저장 버튼
  - 목록: 최신순 카드 (사진 썸네일 + 텍스트 + 시각 + 삭제)
- `routes.tsx`: `/moments` 라우트 추가
- `Layout.tsx`: 사이드바 `lifestyleNavItems` + 모바일 `MobileMenuOverlay`에 📸 모먼트 추가

**② 모먼트 저장 시 날씨 자동 기록 (`MomentView.tsx`)**
- `weatherInfo(code)`: WMO 코드 → 이모지 + 한국어 레이블 매핑 (맑음/구름/안개/비/눈/소나기/뇌우 등 전체 범위)
- `fetchCurrentWeather()`: Geolocation → Open-Meteo `forecast?current=temperature_2m,weather_code` 호출
  - 위치 권한 거부 / 실패 / 타임아웃 → `null` 반환, 날씨 없이 저장 계속 진행
- 저장 시 날씨 + 사진 업로드 `Promise.all` 병렬 실행
- 카드 푸터에 날씨 배지(이모지 + 기온°C + 레이블), 날씨 없으면 배지 생략

**③ 버그 수정: 저장 무한 로딩 (`MomentView.tsx`, Supabase)**
- 원인1 — Geolocation 권한 다이얼로그 무한 대기:
  iOS에서 `getCurrentPosition`의 `timeout` 옵션이 권한 응답 대기에는 적용 안 됨
  → `fetchWeatherImpl` 분리 + 외부 `Promise.race([ impl, 6초 타임아웃 ])` 적용
- 원인2 — moments 테이블 RLS 정책 누락:
  마이그레이션에서 테이블만 생성하고 anon 정책이 없어 INSERT가 DB에서 차단됨
  → `moments anon SELECT/INSERT/DELETE` 정책 추가 (Supabase 마이그레이션)
- Promise.all 구조 개선: 스프레드 방식 → 명시적 중첩 구조, 개별 업로드 `.catch(() => null)` 격리

---

## 2026-05-27

### 📋 TODO

### ✅ 완료
- [x] 모바일 일간 타임라인 스크롤 시 블록 생성되던 버그 수정 (롱프레스 방식으로 전환)
- [x] iOS 롱프레스 시 시스템 텍스트 선택 메뉴(파란 핸들) 제거
- [x] DO 블록 삭제 시 PLAN 할일까지 사라지던 버그 수정
- [x] DO 블록 모바일 롱프레스 컨텍스트 메뉴 추가
- [x] ⋮(점 3개) 메뉴 제거 — 주간 네비게이션 바 우측 드롭다운 전체 제거
- [x] Today 버튼 추가 — WeekViewMobile·WeekViewPC 범례 행 우측에 골드 스타일 버튼
- [x] 수면 블록 DO 슬롯 전용 표시 — WeekViewPC·DailyView 모두 DO 컬럼에만 렌더링
- [x] 자정 넘김 수면 블록 처리 — 취침일 하단 + 기상일 상단으로 세그먼트 분할
- [x] 수면 블록 텍스트 → "수면 Xh Xm" 형식으로 변경
- [x] 반복 일정 DB 마이그레이션 — todos 테이블에 recurrence 컬럼 5개 추가
- [x] 반복 일정 타입 추가 — Todo 인터페이스 + db.ts TodoRow 확장
- [x] recurrenceExpansion.ts 생성 — 가상 확장(Virtual expansion) 유틸리티
- [x] RecurrenceBranchModal 생성 — 이 일정만/이후 모두/모든 반복 선택 모달
- [x] TodoModal 반복 설정 UI — 매일/매주X요일/평일/직접설정 + 종료일 + 반복 아이콘
- [x] store.tsx deleteRecurringTodo·updateRecurringTodo 액션 추가
- [x] WeekViewPC·WeekViewMobile·DailyView·CalendarView 반복 일정 가상 확장 적용
- [x] Supabase Realtime 전체 적용 — store.tsx 22개 테이블 구독 + books·mood 개별 구독
- [x] useRealtimeSync 공통 훅 생성

### 🛠 오늘 작업 내용

**⑤ 주간 뷰 ⋮ 메뉴 제거 + Today 버튼 추가 (`CalendarView.tsx`, `WeekViewPC.tsx`, `WeekViewMobile.tsx`)**
- ⋮(MoreVertical) 버튼 + 드롭다운 전체 제거, outside-click useEffect 제거
- 범례 행(●P ●D ●초과) 우측에 Today 버튼 추가 (골드 스타일, `#C4A882`)
- CalendarView에서 `onToday={handleToday}` prop 양쪽에 전달

**⑥ 수면 블록 DO 슬롯 전용 + 자정 넘김 처리 (`WeekViewPC.tsx`, `DailyView.tsx`)**
- 수면 블록을 Plan 슬롯이 아닌 Do 슬롯 안에만 렌더링
- 자정 넘김(예: 23:30~07:20): 취침일 DO 하단 + 기상일 DO 상단으로 세그먼트 분할
- 전날 sleep_records를 조회해 오늘 오전으로 이어지는 세그먼트 자동 추가
- 텍스트 형식: "🌙 수면 7h 20m"

**⑦ 반복 일정 전체 구현 (`store.tsx`, `db.ts`, `TodoModal.tsx`, 뷰 전체)**
- DB 마이그레이션: todos 테이블에 `recurrence_rule / recurrence_days / recurrence_end_date / recurrence_parent_id / is_exception` 컬럼 추가
- `recurrenceExpansion.ts`: Virtual expansion — DB에 인스턴스 저장 없이 날짜 범위로 가상 생성
  - 가상 ID: `{parentId}::{date}` 형식
  - 예외 레코드(is_exception) 있으면 가상 인스턴스 대체, status='cancelled'이면 제외
- `RecurrenceBranchModal.tsx`: "이 일정만 / 이후 모든 / 모든 반복" 선택 모달
- `TodoModal.tsx` 반복 설정 UI: 반복 없음/매일/매주X요일/평일/직접설정 + 종료일
- store 액션: `deleteRecurringTodo`, `updateRecurringTodo` (scope별 분기)
- WeekViewPC·WeekViewMobile·DailyView·CalendarView MonthView에 `expandRecurringTodos` 적용

**⑧ Supabase Realtime 전체 적용 (`store.tsx`, `BooksView.tsx`, `MoodView.tsx`)**
- `useRealtimeSync.ts` 공통 훅: 테이블명 + 콜백만 넘기면 자동 구독/해제
- store.tsx: 22개 테이블 Realtime 구독 (변경 감지 시 해당 테이블만 재fetch)
- BooksView: books + book_quotes 구독, MoodView: mood_records 구독
- 컴포넌트 언마운트 시 `supabase.removeChannel()` 자동 해제

**① 모바일 타임라인 블록 생성 — 스크롤 → 롱프레스 방식으로 전환 (`DailyView.tsx`)**
- 기존: 빈 타임라인 영역을 아래로 8px 이상 드래그하면 블록 생성 모드 활성화
  → 일반 스크롤(특히 위로 스크롤)에도 블록이 생성되고 위 방향 스크롤이 막히던 문제
- 변경: 빈 영역을 **0.5초 꾹 누른 경우에만** 생성 모드 활성화 (기본 30분 프리뷰 + 진동)
  - 롱프레스 전 5px 이상 이동하면 스크롤로 간주 → 타이머 취소, `preventDefault` 없음
  - 생성 모드 활성화 후에는 손가락을 드래그해 블록 길이 조절 가능
  - `touchcancel`도 정리 핸들러 연결

**② iOS 텍스트 선택 메뉴 차단 (`DailyView.tsx`)**
- 타임라인 컨테이너에 `WebkitTouchCallout: 'none'` → iOS 공유/복사 팝업 방지
- `WebkitUserSelect: 'none'` + `userSelect: 'none'` → 텍스트 선택 핸들(파란 점) 제거

**③ DO 블록 삭제 버그 수정 (`DailyView.tsx`)**
- 원인: PLAN/DO는 같은 todo 객체(planStart/doStart 공유). DO 블록의 우클릭 메뉴가
  `deleteTodo(id)`로 할일 전체를 삭제 → PLAN까지 사라지던 문제
- 수정: DO 블록 삭제 시 `doStart/doEnd/doElapsedSec`만 비우도록 변경
  → DO 블록만 사라지고 PLAN은 유지. 확인 메시지 "DO 블록을 삭제할까요? (PLAN은 유지됩니다)"

**④ DO 블록 모바일 롱프레스 메뉴 추가 (`DailyView.tsx`)**
- 기존: PLAN 블록만 `onTouchStart` 롱프레스(0.5초) → 컨텍스트 메뉴
- 변경: DO 블록도 동일하게 롱프레스 → 상태 변경/편집/삭제 메뉴 표시
- `contextMenu` state에 `source: 'do'` 필드 추가 → DO 전용 삭제 동작 분기

---

## 2026-05-25

### 📋 TODO

### ✅ 완료
- [x] 식단 오늘 탭 날짜 헤더 표시
- [x] 식단 통계 탭 기간 필터 추가 (이번달/지난달/최근14일/직접선택)
- [x] 식단 달력 PC 레이아웃 버그 수정 (max-w 제약 제거, 셀 높이 수학적 계산)
- [x] 식단 사진 업로드 안 되는 버그 수정 (Supabase storage RLS 정책 추가)
- [x] 식단 달력 탭 선택 날짜 기록에 수정/삭제 기능 추가 (FoodCard 교체)
- [x] 식사 유형에 ☕ 커피 추가
- [x] 맛 평가 메모 기능 추가 (평가 선택 시 한 줄 메모 입력, tasteMemo 저장)

### 🛠 오늘 작업 내용

**① 식단 오늘 탭 날짜 헤더 (`FoodView.tsx`)**
- 요약 카드 위에 `2026년 5월 25일 (월)` 형식 날짜 표시

**② 식단 통계 탭 기간 필터 (`FoodView.tsx`, `StatsTab`)**
- 필터 칩: `[이번달] [지난달] [최근14일] [직접선택]`
- 직접선택: `◀ 2026년 5월 ▶` 월 네비게이션
- 식비 총액 레이블 동적 변경 (`5월 식비 총액`, `최근 14일 식비` 등)
- 칼로리 차트: 최근14일 → 일별 14개, 이번달/지난달/직접선택 → 해당 달 전체 일별 데이터
- 식사유형 횟수·도넛·TOP5·맛있었던 것 모두 선택 기간 기준으로 필터링

**③ 식단 달력 접기/펼치기 + PC 레이아웃 버그 수정 (`FoodView.tsx`, `CalendarTab`)**
- `max-w-sm/md` 제약 제거 → PC에서 가로 너비 꽉 채움
- `overflow-hidden` 내부 `getBoundingClientRect()` 측정 문제 해결
  → 컨테이너 너비 `ResizeObserver` 측정 → `cellW * 4/3 = cellH` 수학적 계산
- `collapsedH / expandedH` 정확히 계산해 접힘·펼침 모두 잘리지 않음
- Supabase `food-photos` 버킷에 anon INSERT/UPDATE/DELETE/SELECT 정책 추가
  → 갤러리/카메라 사진 업로드 정상 작동

**④ 식단 달력 탭 수정/삭제 기능 (`FoodView.tsx`, `CalendarTab`)**
- 선택 날짜 기록 목록: 단순 버튼 → `FoodCard` 컴포넌트로 교체
- 연필(수정) · 휴지통(삭제, ConfirmModal 포함) 버튼 표시
- 오늘 탭과 동일한 UX

**⑤ 식사 유형 ☕ 커피 추가**
- `DiningType`에 `'coffee'` 추가 (`store.tsx`)
- `foodIcons.ts`: `coffee: '☕'` 아이콘/레이블 추가
- `FoodView` DINING_TYPES 배열 및 DINING_DOT_COLOR에 coffee 추가

**⑥ 맛 평가 메모 기능**
- `FoodRecord`에 `tasteMemo?: string | null` 추가 (`store.tsx`)
- Supabase `food_records` 테이블에 `taste_memo TEXT` 컬럼 추가 (마이그레이션)
- `db.ts` fetchAll/upsert에 `taste_memo` 매핑 추가
- `AddFoodSheet` step 7: 맛 평가 선택 시 한 줄 메모 입력폼 표출 (최대 50자, 저장하기 버튼 위)
- `FoodCard`: 맛 이모지 옆에 `tasteMemo` 텍스트 표시
- 수정 모드에서도 기존 메모 불러와 편집 가능

---

## 2026-05-24

### 📋 TODO

### ✅ 완료
- [x] Vercel Edge Function 프록시 생성 (api/food-nutrition.ts) — 식약처 영양성분 API 연동
- [x] vercel.json /api/ 경로 SPA rewrite 제외 처리
- [x] food_records 테이블 컬럼 추가 마이그레이션 (calories, carbs, protein, fat, dining_type, taste_rating)
- [x] FoodRecord 인터페이스 + DiningType/TasteRating 타입 추가 (store.tsx)
- [x] db.ts food_records fetchAll/upsert 신규 필드 매핑
- [x] 식단 기록 페이지 UI 구현 (/food, FoodView.tsx)
- [x] /food 라우트 등록 및 사이드바·모바일 메뉴에 🍽️ 식단 추가

### 🛠 오늘 작업 내용

**① Vercel Edge Function — 식약처 영양성분 API 프록시 (`api/food-nutrition.ts`)**
- `GET /api/food-nutrition?query=음식명` → 식약처 API 호출 후 칼로리/탄수화물/단백질/지방 반환
- `VITE_FOOD_API_KEY` 환경변수, 이중 인코딩 방지 처리
- `vercel.json` 수정: `/((?!api/).*)` 패턴으로 /api/ 경로 SPA rewrite 제외

**② Supabase food_records 컬럼 추가 마이그레이션**
- `calories NUMERIC(7,1)`, `carbs NUMERIC(7,1)`, `protein NUMERIC(7,1)`, `fat NUMERIC(7,1)`
- `dining_type TEXT` (home|delivery|restaurant CHECK), `taste_rating TEXT` (good|normal|bad CHECK)
- `food-photos` Storage 버킷 이미 존재 확인 (public)

**③ 식단 기록 페이지 UI (`FoodView.tsx`, 신규)**
- 3탭 구조: **오늘** / **달력** / **통계**
- **오늘 탭**: 식비·칼로리 요약 카드, 아침/점심/저녁/간식 섹션별 기록, 사진 썸네일, 수정·삭제
- **7단계 바텀시트 추가 흐름**:
  1. 시간대 선택 (아침/점심/저녁/간식)
  2. 사진 (카메라/갤러리/건너뛰기) → Supabase Storage 업로드
  3. 음식 이름 입력 + 식약처 API 실시간 검색 → 영양소 자동입력 + 음성입력 지원
  4. 식사 유형 (집밥/배달/외식)
  5. 금액 입력 (선택)
  6. 칼로리 입력 (API 자동입력 또는 수정, 선택)
  7. 맛 평가 (😋/😐/😑, 선택)
- **달력 탭**: 월별 그리드, 사진 썸네일, 날짜 탭 → 그날 기록 목록
- **통계 탭**: 월 식비 총액, 식사유형 도넛 차트(recharts), 자주 먹은 음식 TOP5, ⭐ 맛있었던 것 모아보기, 최근 14일 칼로리 바차트
- 수정 모드: 모든 필드 인라인 수정 지원

**④ 라우트 및 네비게이션 추가**
- `routes.tsx`: `/food` 라우트 등록
- `Layout.tsx`: 사이드바 lifestyleNavItems·모바일 MobileMenuOverlay allItems에 🍽️ 식단 추가

---

## 2026-05-22

### 📋 TODO

### ✅ 완료
- [x] 모바일 메뉴 레이블 줄바꿈 버그 수정 (공백 제거 + nowrap)
- [x] 주간/월간 리뷰 PC-모바일 동기화 (Supabase weekly_reviews / monthly_reviews 테이블 연동)
- [x] 수면 시간 동일 시각 → 24시간 표시 버그 수정 (diff < 0 조건으로 수정)
- [x] 리뷰 데이터 Supabase 로드 후 화면 미반영 버그 수정 (useEffect 동기화)
- [x] 습관 반복 설정 기반 자동 표시 필터링 구현 (오늘 요일 기준)
- [x] 자기관리 기록 수정 기능 추가 (기록 행 hover → 수정/삭제 버튼)
- [x] 습관 alarmTime → useNotification 알림 연결 (scheduleHabitAlerts)
- [x] 루틴 반복 설정 구현 (매일/평일/주말/직접 선택, Supabase 컬럼 추가)

### 🛠 오늘 작업 내용

**① 버그 수정 3건**
- `Layout.tsx`: 모바일 메뉴 '습관 & 루틴', '리뷰 & 기록' 레이블 줄바꿈 → 공백 제거 + `whiteSpace: 'nowrap'`
- `SelfCareView.tsx`: `calcSleepMinutes` 함수 `diff <= 0` → `diff < 0` 수정 (동일 시각 0시간 처리)
- `ReviewsView.tsx`: `useEffect` 추가 — `todayRecord`, `weeklyReview`, `monthlyReview` 각각 Supabase 로드 후 state 동기화

**② 주간/월간 리뷰 Supabase 연동 완성**
- Supabase MCP로 `weekly_reviews`, `monthly_reviews` 테이블 직접 생성
- `db.ts`: `WeeklyReviewRow`, `MonthlyReviewRow`, `toWeeklyReview`, `fromWeeklyReview`, `toMonthlyReview`, `fromMonthlyReview`, CRUD 추가
- `store.tsx`: 앱 로드 시 fetch → setState 연결, `addWeeklyReview` / `updateWeeklyReview` / `addMonthlyReview` / `updateMonthlyReview`에 `db.upsert()` 호출 추가

**③ 습관 반복 설정 필터링**
- `HabitsView.tsx` 습관 탭: `isHabitApplicableOnDate(h, new Date())` 필터 적용
- 평일 전용, 주말 전용, 커스텀 요일 설정 습관이 오늘 해당하지 않으면 숨김

**④ 자기관리 기록 수정 기능**
- `store.tsx`: `updateSelfCareRecord(id, changes)` 함수 추가 → `db.selfCareRecords.upsert()` 연동
- `SelfCareView.tsx`: `AddRecordModal`에 `editRecord?: SelfCareRecord` prop 추가 (수정 모드 지원)
- 기록 행 hover 시 수정(✏️) / 삭제(🗑️) 버튼 표시

**⑤ 습관 alarmTime → 알림 연결**
- `useNotification.ts`: `scheduleHabitAlerts(habits, date)` 함수 추가
  - `alarmTime` 설정 습관 → 해당 시각 푸시 알림 발송
  - 이미 오늘 체크 완료된 습관은 skip
- `HabitsView.tsx`: 알림 권한이 있을 때 습관 변경 시 자동 재스케줄링

**⑥ 루틴 반복 설정**
- `store.tsx`: `Routine` 인터페이스에 `repeat`, `repeatDays` 필드 추가
- `db.ts`: `RoutineRow`에 `repeat`, `repeat_days` 컬럼, `toRoutine` / `fromRoutine` 변환 함수 업데이트
- `RoutinesView.tsx`: `RoutineModal`에 반복 설정 UI 추가 (매일/평일/주말/직접 선택 + 요일 버튼)
- `HabitsView.tsx`: `isRoutineApplicableToday` 필터 — 루틴 탭 목록 및 진행률을 오늘 해당 루틴만 표시
- Supabase MCP: `routines` 테이블에 `repeat TEXT DEFAULT 'daily'`, `repeat_days INT[] DEFAULT '{}'` 컬럼 추가

---

## 2026-03-30

### 📋 TODO

### ✅ 완료
- [x] 일간/캘린더 타임라인 UI를 PLAN vs DO 비교 구조로 재정렬
- [x] 일간 타임라인 요약 라벨 수정 (`계획 시간`, `실제 시간`, `달성률`)
- [x] 할일 체크 버튼과 화살표 버튼을 동일한 타이머 시작/완료 흐름으로 통합
- [x] 전역 플로팅 타이머 추가 (일시정지/재개/완료, 페이지 이동 후 유지)
- [x] 진행 중 타이머 시간을 일간 요약 및 DO 타임라인에 실시간 반영
- [x] 자기관리 페이지 — 생리 기록 기능 추가 (PeriodSection, period_records DB)
- [x] 습관 트래커 탭 UI FM002 스타일로 전면 개편 (월별 점 히트맵, 월간 회고)
- [x] 습관 편집 모달 — "이유" 및 "이번달 메모" 필드 추가 (reason, habit_monthly_memos DB)
- [x] 캘린더 MonthView 생리 기간 날짜 핑크 점 표시 연동
- [x] 일간 페이지 할일 삭제 확인 모달에서 삭제 버튼 미동작 버그 수정 (컨텍스트 메뉴 선종료 방지)
- [x] 자기관리 수면 기록 컬럼 마이그레이션 추가 (`self_care_records.sleep_start`, `sleep_end`)

### 🛠 오늘 작업 내용

**① 자기관리 — 생리 기록 기능 추가 (`SelfCareView.tsx`, `store.tsx`, `db.ts`)**
- `PeriodRecord` 인터페이스 신규 추가 (`store.tsx`)
  - 필드: `id, startDate, endDate, symptoms[], flowLevel(light|medium|heavy), memo`
- `db.periodRecords` CRUD (`db.ts`) + Supabase 마이그레이션 SQL 작성
- `SelfCareView.tsx` — `PeriodSection` 컴포넌트 신규 추가
  - 섹션 접기/펼치기 (Heart 아이콘, 닫힌 상태에서도 다음 예상일 표시)
  - 입력 폼: 시작일/종료일, 흘림양(3단계 버튼), 증상 8종 다중 체크, 메모
  - 기록 수정(인라인 편집 재진입) + 삭제
  - 예측 카드: 최근 기록 기반 평균 주기 자동 계산 + 다음 예상 시작일 표시
- `CalendarView.tsx` — `MonthView` 날짜 셀에 `isPeriodDate()` 핑크 점(#E07899) 표시

**② 습관 트래커 탭 UI 전면 개편 (`HabitsView.tsx`, `store.tsx`, `db.ts`)**
- `HabitMonthlyMemo` 인터페이스 신규 추가 (`store.tsx`)
  - 필드: `id, habitId, year, month, memo, whatWorked, whatDidntWork, nextMonth`
  - `habitId = '__review__'` → 전체 월간 회고 특수 레코드
- `db.habitMonthlyMemos` CRUD (`db.ts`) + Supabase 마이그레이션 SQL 작성
  - `habits` 테이블에 `reason TEXT` 컬럼 추가
  - `habit_monthly_memos` 신규 테이블 생성 (UNIQUE(habit_id, year, month))
- `HabitsView.tsx` — `HabitModal` 필드 추가
  - "이 습관을 하려는 이유" 텍스트 입력 (`reason` → `habits` 테이블 저장)
  - "이번달 메모" 입력 (편집 모드 전용, `habit_monthly_memos` 테이블 저장)
- `HabitsView.tsx` — `HabitTrackerView` 컴포넌트 신규 구현 (FM002 스타일)
  - 연도 ◀ ▶ 네비게이션
  - Jan~Dec 월 탭 (현재월 강조, 선택월 골드 강조)
  - 습관별 행: 이모지 + 이름 + 이유 | 날짜 점 히트맵 | score(달성일/전체일)
    - PC: CSS Grid로 전체 너비 균등 분배 (큰 원)
    - 모바일: 가로 스크롤 (14px 원, 날짜 숫자 아래 표시)
  - 달성률 진행 바
  - 이번달 메모 인라인 편집 (클릭 → input 전환, blur/Enter 저장)
  - 월간 회고 섹션: This month / What worked / What didn't work / Next month
- 탭3 이름 "통계 & 히트맵" → **"습관 트래커"** 교체

**③ 타임라인 UI 개편 (`DailyView.tsx`, `CalendarView.tsx`)**
- 일간 타임라인에 PLAN/DO 레인 배경, 중앙 구분선, 레인 라벨을 추가해 비교 구조를 더 명확하게 정리
- 캘린더 주간 뷰(`WeekView`)도 동일한 PLAN/DO 시각 규칙으로 맞추고, 모바일에서는 선택 블록 상세 정보를 하단에 표시
- 하단 요약은 카드형으로 바꾸지 않고 기존 텍스트형 유지, 라벨만 `계획 시간 / 실제 시간 / 달성률`로 수정

**② 할일 타이머 로직 통합 (`store.tsx`, `DailyView.tsx`)**
- 기존에는 체크 버튼은 상태만 변경하고, 화살표 버튼은 타이머만 시작하는 구조였음
- 체크 버튼과 화살표 버튼 모두 `startTimer(todo.id)` 기반의 동일한 시작 액션으로 통합
- 타이머 시작 시 해당 할일 상태를 `inProgress`로 변경하고, 완료 시 `doStart`/`doEnd` 저장 + `done` 처리되도록 변경
- 진행 중 타이머는 일간 요약(`실제 시간`, `달성률`)과 DO 타임라인 블록에 즉시 반영되도록 계산식 수정

**③ 전역 플로팅 타이머 추가 (`GlobalFloatingTimer.tsx`, `App.tsx`)**
- `src/app/components/GlobalFloatingTimer.tsx` 신규 생성
- 플로팅 타이머를 `App.tsx`에 전역 마운트해 페이지 이동 후에도 유지되도록 변경
- 플로팅 타이머에서 `일시정지 / 재개 / 완료`를 지원하도록 `store.tsx`의 `activeTimer` 구조를 확장 (`elapsedSec`, `isPaused`)

**④ 삭제 확인 모달 통일 (`DailyView.tsx`, `TodoModal.tsx`, `ProjectView.tsx`, `BacklogView.tsx`)**
- `DailyView` 컨텍스트 메뉴의 브라우저 기본 `confirm(...)`를 `ConfirmModal`로 교체
- `TodoModal`, `ProjectView`의 프로젝트 할일/마일스톤 삭제, `BacklogView`의 데스크탑/모바일 삭제 버튼도 모두 `ConfirmModal`을 거치도록 통일
- 전체 코드베이스 기준 브라우저 기본 confirm 사용이 남아있지 않은 상태로 정리

**⑤ 일간 할일 삭제 버그 수정 (`DailyView.tsx`)**
- 증상: 컨텍스트 메뉴에서 "삭제"를 눌러 확인 팝업까지는 열리지만, 팝업의 "삭제" 버튼 클릭 시 실제 삭제가 실행되지 않는 케이스 발생
- 원인: `ContextMenu`의 `document.mousedown` 바깥 클릭 닫기 로직이 ConfirmModal 클릭 시점보다 먼저 실행되어 메뉴/모달이 언마운트됨
- 조치: `showDeleteConfirm`가 `true`일 때는 바깥 클릭 닫기 핸들러를 무시하도록 가드 추가

**⑥ 수면 기록 스키마 보강 (`supabase/migrations/20260330130000_add_sleep_columns_to_self_care_records.sql`)**
- `self_care_records` 테이블에 `sleep_start`, `sleep_end` 컬럼을 `IF NOT EXISTS`로 추가
- 수면 카테고리에서 취침/기상 시간을 분리 저장해 duration 외 시각 정보 기반 분석 가능하도록 확장

---

## 2026-03-29

### 📋 TODO

### ✅ 완료
- [x] 메뉴 구조 개편 (브레인스토밍·보관함 비활성 라우트화, 월간→목표관리(/goals), 모바일 하단 5탭 + 상단 메뉴 오버레이)
- [x] 할일 페이지(/todos) 신규 개발 (전체 할일 날짜별 그룹 + 미지정 할일 탭)
- [x] TodoModal 공통 컴포넌트 분리 (DailyView/TodosView 공용)
- [x] TodoRow 프로젝트 배지 표시
- [x] 목표관리(/goals) 페이지 주간/월간 탭 구성으로 전면 개편
- [x] 모바일 반응형 개선 - 일간 페이지 탭 UI + 전역 가로 스크롤 제거
- [x] 모바일 일간 헤더 한 줄 표시 (날짜 + 버튼 줄바꿈 수정)
- [x] 캘린더 주별/일별 뷰 스크롤 구조 개선 (이중 스크롤 → 단일 스크롤)
- [x] CLAUDE.md 모바일 작업 원칙 및 주요 기능 항목 업데이트
- [x] window.confirm() → 커스텀 ConfirmModal 교체 (ProjectView.tsx 프로젝트 삭제)
- [x] 모바일 네비게이션 개선 (하단 5탭 + 상단 메뉴 바텀 시트 오버레이)
- [x] CLAUDE.md, PROGRESS_LOG.md, PROJECT_SPEC.md 업데이트 + GitHub push
- [x] 루틴 단계별 YouTube URL 등록 기능 추가 (편집 모달 URL 입력 + 유효성 검증)
- [x] 루틴 실행 화면 "영상 보기" 버튼 추가 (YouTube 새 탭 열기)
- [x] Supabase routines 테이블 step_youtube_urls 컬럼 마이그레이션
- [x] RoutineModal 모바일 너비 대응 (w-[460px] → w-full max-w-[460px])
- [x] WeeklyView 브레인덤프 → 미지정 할일 기반 좌측 패널로 개편
- [x] 루틴 실행 기능을 습관&루틴(/habits) 루틴 탭으로 통합, `/routines`는 `/habits` 리다이렉트로 정리

### 🛠 오늘 작업 내용

**① 메뉴 구조 개편 (`routes.tsx`, `Layout.tsx`, `LayoutC.tsx`)**
- 활성 메뉴/직접 진입 라우트에서 제거: `/backlog`(보관함), `/brainstorm`(브레인스토밍)
- 리네임: 월간 → 목표관리, `/monthly` → `/goals`
- 사이드바 재구성: 대시보드→일간→캘린더→할일→주간→목표관리 순
- 모바일 네비: 하단 5개 고정 탭(대시보드·일간·캘린더·할일·습관&루틴) + 상단 햄버거 메뉴 오버레이

**② 할일 페이지(`/todos`) 신규 개발 (`TodosView.tsx`)**
- 탭1 "전체 할일": 날짜별 그룹, 완료 접기/펼치기, 상태 순환 (active→inProgress→done)
- 탭2 "미지정 할일": 날짜 없는 할일, 날짜 배정 패널
- `TodoRow`: 상태 토글, Top3 별표, 편집/삭제, 태그 칩, 프로젝트 배지

**③ TodoModal 공통화 (`TodoModal.tsx`, `DailyView.tsx`)**
- `TodoModal.tsx` 신규 생성: `date` prop optional
  - `date` 있으면 날짜 고정 (DailyView 기존 동작)
  - `date` 없으면 모달 내 `← M월 d일 (요일) → [오늘]` 날짜 네비게이션 표시
- `DailyView.tsx`: 내부 TodoModal 함수 제거 → 공통 컴포넌트 import
- `TodosView.tsx`: 공통 TodoModal 적용

**④ 목표관리 페이지 개편 (`MonthlyView.tsx`, `WeeklyView.tsx`)**
- `MonthlyView.tsx` 전면 재작성: 탭 구조 도입
  - 상단 탭: **주간 목표** / **월간 목표**
  - 탭별 독립 날짜 네비 (주간: 주차+날짜범위, 월간: yyyy년 M월)
  - 주간 탭: `WeeklyGoalsSection` 재사용 (목표 CRUD + 달성률 바 + 월간 목표 연결 select)
  - 월간 탭: 통계 카드(완료 할일 수/달성률) + 이달의 목표 + 습관 달성률 (기존 내용 유지)
- `WeeklyView.tsx`: `WeeklyGoalsSection` export 추가 → MonthlyView에서 중복 없이 재사용

**⑤ 모바일 반응형 - 일간 탭 UI (`DailyView.tsx`, `Layout.tsx`)**
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

**④ window.confirm → ConfirmModal (`ConfirmModal.tsx`, `ProjectView.tsx`)**
- `src/app/components/ConfirmModal.tsx` 신규 생성 — 재사용 가능한 확인 모달
  - props: `message`, `description?`, `confirmText?`, `cancelText?`, `confirmDanger?`, `onConfirm`, `onCancel`
  - 배경 클릭 + ESC 키로 닫기, `confirmDanger` 시 빨간 버튼, 일반은 골드 버튼
- `ProjectView.tsx`: 프로젝트 삭제 `window.confirm()` → `ConfirmModal` 교체
  - `showDeleteConfirm` state 추가, 삭제 버튼 → `setShowDeleteConfirm(true)`

**⑤ 모바일 네비게이션 개선 (`Layout.tsx`)**
- 하단 네비: **5개 고정 탭** (대시보드, 일간, 캘린더, 할일, 습관&루틴)
- 활성 탭: 아이콘 주위 골드 `accentLight` 배경 pill 강조
- `MobileMenuOverlay` 컴포넌트 추가 — 상단 햄버거 버튼으로 여는 바텀 시트 오버레이
  - 모든 페이지(mainNavItems + 프로젝트 + lifestyleNavItems) 4열 그리드
  - 현재 활성 페이지 골드 배경 강조, 배경 클릭 시 닫힘
- 모바일 상단 topbar에 햄버거 버튼 추가
- `mobileMenuOpen` state 추가

**⑥ 문서 업데이트**
- `CLAUDE.md`: 주요 기능에 모바일 하단 네비·ConfirmModal 추가, `/진행현황 저장해줘` 명령어 → PROGRESS_LOG.md + PROJECT_SPEC.md 동시 업데이트 규칙으로 확장
- `PROJECT_SPEC.md`: 최종 업데이트 날짜, UI/UX 기능 목록, 컴포넌트 구조도 업데이트

**⑦ 루틴 단계별 YouTube URL 기능 (`RoutinesView.tsx`, `store.tsx`, `db.ts`)**
- Supabase `routines` 테이블에 `step_youtube_urls text[] DEFAULT '{}'` 컬럼 마이그레이션
- `Routine` 인터페이스 `stepYoutubeUrls?: string[]` 추가
- `RoutineRow` + `toRoutine` / `fromRoutine` 변환 함수 업데이트
- `RoutineModal`: 단계별 YouTube URL 입력 필드 추가 (빈값 허용, 잘못된 URL 빨간 경고)
  - `isValidYoutubeUrl()` 검증 함수 (youtube.com/watch?v= / youtu.be/ 모두 허용)
- `ExecutionPanel`: URL 등록 단계에 빨간 "영상 보기" 버튼, `stopPropagation()` 처리
- `RoutineModal` 모바일 너비 대응: `w-[460px]` → `w-full max-w-[460px] mx-4`

**⑧ WeeklyView 좌측 패널 개편 (`WeeklyView.tsx`)**
- 브레인덤프 아이템 → 날짜 미지정 할일 목록으로 교체 (`BrainDumpItem` → `UnassignedTodoItem`)
- `AssignDayPopover` 위치 `left-0` → `right-0` (화면 밖 잘림 방지)

**⑨ 루틴 기능 습관&루틴 탭으로 통합 (`HabitsView.tsx`, `routes.tsx`, `Layout.tsx`)**
- `RoutinesView.tsx`: `RoutineModal`, `ExecutionPanel`, `RoutineCard`, `today`, `getStreak` export 추가
- `HabitsView.tsx` 루틴 탭: 단순 카드 목록 → 오늘 진행률 바 + RoutineCard(실행/편집) + ExecutionPanel 전체 기능으로 교체
- 기존 단순 `RoutineModal` 컴포넌트 삭제 → RoutinesView 것 재사용
- `runningRoutine` state 추가 → ExecutionPanel 연결
- `routes.tsx`: 독립 루틴 페이지 대신 `/routines` → `/habits` 리다이렉트로 정리
- `Layout.tsx`: 사이드바 '루틴 실행' 메뉴 항목 삭제

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
