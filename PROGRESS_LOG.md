# PROGRESS_LOG.md — My Planner 진행 현황

> 사용법:
> - `todo로 넣어줘: [내용]` → 오늘 날짜 TODO에 추가
> - `진행현황 기록` → 오늘 작업 내용을 이 파일에 저장

---

## 2026-06-14

### 🛠 오늘 작업 내용

**컨디션 탭 기록 영역 — 날짜 필터 / 검색 / 빈날 넛지 (Stage 1~5 + 패치)**
- **Stage 1 (필터/검색 파생 로직 기반)** — `ConditionTab.tsx` 에 `selectedDate`/`searchQuery` 상태 + `displayedRecords` useMemo(검색어 우선 → 선택 날짜 → 전체 최신순 `listLimit` 적용). 기존 리스트 UI를 파생 결과로 교체(겉모습 무변화), `isDefaultView`일 때만 "더보기" 노출. PC/모바일 외형 변화 0.
- **Stage 2 (날짜 트리거 + 칩 + 빈날 넛지)** — 주간 셀·히트맵 칸 `<div>→<button>`, `toggleDate`(같은 날 재클릭/칩 × 해제), 선택칸 강조(`border t.danger` + `0 0 0 2px` 코랄 링, 오늘 `t.accent` 보다 우선). 기록 헤더: 날짜 선택 시 `M월 d일 ×` 칩(`t.dangerLight`/`t.danger`) / 미선택 시 `전체 기록 · 최신순` 힌트. 선택 날짜에 기록 없으면 **빈 날 넛지 카드**(문구 + [기록하기] 버튼, Stage 4에서 동작 연결) — 모두 디자인 토큰.
- **Stage 3 (검색)** — 기록 헤더 우측 돋보기 토글로 검색바 펼침/접힘. 활성 시 `t.dangerLight`/`t.danger` 강조 + autoFocus input(본문·증상·레벨 라벨 텍스트). **상호 배타**: 검색 열 때 `selectedDate=null`, 날짜 클릭 시 검색 닫힘+비움 → 검색·날짜 필터 동시 적용 X. 검색바 닫으면 전체로 복귀, 결과 0이면 "검색 결과가 없어요"(빈날 넛지보다 우선).
- **Stage 4 (빈 날 넛지 → 기존 입력 카드 재사용)** — `openRecordFor(d)` = `resetForm()`+`setDate(d)`+`setInputOpen(true)`. 새 UI 만들지 않고 컴포넌트 내 기존 인라인 입력 카드에 prefill. 카드 열림 시 `formRef.scrollIntoView({block:'nearest'})` — 이미 보이면 이동 없음. 저장 후 기존 `refresh()`로 records 갱신 → `selectedDate` 유지로 새 기록이 즉시 그 날짜 뷰에 등장(Realtime 구독도 그대로).
- **Stage 5 (반응형 확인, 무코드)** — PC 2열(`lg:grid-cols-2` 히트맵+추이) 보존, 모바일 세로 스택 정상. `lg:` 클래스 0건 변경. 단일 반응형 컴포넌트라 필터/검색/넛지 로직이 PC/모바일 공통 동작.
- **패치 (기본값을 "오늘"로 변경)** — `selectedDate` 초기값을 `null`(전체) → `format(new Date(),'yyyy-MM-dd')`(오늘). 빈 날 넛지 문구는 `selectedDate===todayStr`이면 "오늘은 아직 기록이 없어요" 분기, 아니면 기존 "M월 d일은…". 칩 × → `null` → 전체 최신순으로 전환(전체 보기는 기본이 아니라 ×로 진입하는 상태).

**컨디션 기록 입력 폼 — 커스텀 증상 추가 + 재사용 칩 (Stage 1~3)**
- **Stage 1 (데이터 레이어)** — 마이그레이션 `20260614020000_create_user_symptoms.sql` 적용: `user_symptoms(id text PK, name text, name_norm text UNIQUE, created_at)` + 컨디션과 동일한 owner uid 하드코딩 RLS(단일 사용자 패턴) + Realtime publication. `src/constants/symptoms.ts`에 `normalizeSymptom(s)`(`trim + /\s+/→' ' + lower`) 추가, `getSymptomOptions(custom)`이 정규화 기준으로 기본과 중복되는 커스텀 자동 배제. `db.userSymptoms.fetchAll/add`(정규화 사전 조회 + UNIQUE race 방어, `{ok,created}|{ok:false,reason:'duplicate',existing}|{ok:false,reason:'error'}`). `UserSymptom { id, name }` 타입 추가. `ConditionTab.tsx`에서 `userSymptoms` 상태 + `useRealtimeSync('user_symptoms')` + `symptomOptions` useMemo로 기본+커스텀 합산.
- **Stage 2 (입력 UI)** — 증상 영역에 점선 골드 **"+ 증상 추가"** 칩 → 클릭 시 인라인 input(autoFocus, maxLength 20) + [추가] + [×]. Enter로 추가, ESC로 취소. `handleAddSymptom`: ① 빈 값 무시 ② 화면 칩(기본+커스텀)에서 정규화 일치 → 그 칩 선택 + "OO은(는) 이미 있어서 선택했어요" 안내(3초 후 자동 사라짐) ③ 신규면 `db.userSymptoms.add` → 즉시 선택 + 칩 풀 영구 저장 + 입력 닫힘. 커스텀 미선택 칩은 **점선 골드**(`1px dashed t.accent` + `color: t.accent`), 선택 시 둘 다 코랄(`STRESS_COLOR`) 강조 — `defaultNormSet`(useMemo)으로 기본/커스텀 구분. `resetForm`에 인라인 입력 상태 포함.
- **Stage 3 (통계·표시 연동 확인, 무코드)** — `symptoms text[]`에 칩 이름 그대로 저장되는 평등 모델이라 자동 편입: `topSymptoms` useMemo(빈도 키=문자열)에서 같은 이름 합산, 기록 카드 `(r.symptoms ?? []).map(s => …)`에서 그대로 노출, `displayedRecords` 검색 파생에서 `[...r.symptoms]` 텍스트 매칭으로 커스텀 증상명 검색 가능.

- 원칙 준수: 색 디자인 토큰만(코랄=`t.danger`/`t.dangerLight`, 골드=`t.accent`, `t.bgSub`/`t.border`/`t.textSub` 등) · PC 레이아웃 보존(`lg:` 분기 0건 추가/변경, 단일 반응형 컴포넌트라 PC/모바일 로직 공통) · DB "한 번 저장 → 이후 읽기만" 원칙(`name_norm` UNIQUE + 사전 조회로 중복 차단) · `npm run build` 통과.

---

**통합 빠른 입력(Quick Add) + Inbox 독립 화면 — Stage 0~3**
- **Stage 0 (자연어 파서, UI 무관 순수 함수)** — `src/lib/quickParse.ts` `parseQuickEntry(input, now?)` → `ParsedEntry`. 토큰 인식: `#태그`(복수)·`@프로젝트`(첫 매치, id 매칭은 호출부)·단독/선두 `!`(중요=isTop3)·반복(`매일`→daily/`평일`→weekday/`매주 [요일]`→weekly+요일)·날짜(`오늘`/`내일`/`모레`/`X요일`/`M/D`/`M.D`/`M월 D일`, 지난 날짜는 내년으로)·시간(`(오전|오후)? N시 (반|N분)?`/`HH:MM`/`N-N시` 범위). 날짜·시간 분기: 날짜 토큰 우선 → 시간만 있으면 오늘 → 둘 다 없으면 `date=null`(Inbox). **weekly 는 다가오는 해당 요일로 `date` 를 맞춰** 기존 `TodoModal`/`recurrenceExpansion`(weekly=시작일 요일 기준 확장)과 정합. 새 라이브러리 없이 date-fns 재사용, 데이터 모델 변경 0. `quickParse.test.ts`(`node:test`) 9건 전부 통과.
- **Stage 1 (통합 입력 컴포넌트)** — `QuickAddInput.tsx`: 입력 중 실시간 칩 미리보기([할일=그린/일정=블루]·[날짜 or Inbox]·[시간]·[반복]·[#태그=코랄]·[@프로젝트]·[중요], 토큰+`${color}1A` 알파 파생, 하드코딩 색 0). 시간 감지 시 "일정으로?" 토글 칩(누르면 addEvent, 다시 누르면 addTodo, 시간 사라지면 자동 할일 복귀). 프로젝트는 이름 매칭 성공 시 `projectId`·실패 시 `@토큰`을 제목에 되돌려 무시(새 프로젝트 안 생김). 태그는 기존 매칭, 없으면 공통 팔레트로 새 태그 생성 후 id 매핑. 저장은 기존 `addTodo({...changes,status:'active'})`/`addEvent(payload)` 그대로(Realtime 경로 유지). `defaultDate` 폴백(파싱 날짜 없을 때, Inbox 는 null). "자세히" → 기존 모달 오픈. 부수: `src/lib/tagPalette.ts`(13색 팔레트/localStorage 공통화, TodoModal 도 import), `addTag` 가 생성 `Tag` 반환(하위 호환), `TodoModal`/`EventModal` 에 `initial*` optional prop 추가(자세히 prefill — 제목·시간·태그·중요·반복).
- **Stage 2 (Inbox 독립 화면)** — `InboxView.tsx` + `/inbox` 라우트. 대상 = `date===null && status ∉ {backlog,cancelled}`(완료는 접기). 헤더("Inbox"/"막 던지고, 한가할 때 비우기") + 상단 `QuickAddInput(defaultDate=null)` + 항목 카드(체크 동그라미 완료 토글 + 본문 + 메타 칩 + triage `[오늘][내일][날짜(네이티브 picker)][완료][삭제(ConfirmModal)]` → `updateTodo`/`deleteTodo`). 정렬 = `created_at` ASC 적재를 reverse(최신순, 추후 토글 여지). 빈 상태(체크 아이콘 + "Inbox를 다 비웠어요"). PC max-w 760 중앙·액션 우측, 모바일 헤더+입력 상단 sticky·triage 44px 터치 타겟·하단 safe-area.
- **Stage 3 (네비 진입점 + 카운트 배지)** — `src/lib/inbox.ts`(`isInboxCandidate`/`countInboxActive`=날짜 미지정·미완료 수)로 카운트 단일화. PC 사이드바(테마 A/B/D, `Layout`) 메인 네비 '인박스' + 배지(펼침=숫자/접힘=점), 모바일 햄버거 오버레이 원형 아이콘 우상단 배지, 테마 C(`LayoutC`) 상단 네비 라벨 옆 배지. 0 이면 모두 숨김, store `todos` 의존이라 추가/배정/삭제 시 4곳 Realtime 동시 갱신. 기존 네비 레이아웃 DOM 무변경(항목/배지만 추가).
- 원칙 준수: 색 디자인 토큰만(배지 텍스트 #fff·이벤트 기본색만 기존 관례 유지)·PC 레이아웃 보존(모바일 `lg:` 분기)·Todo/Event 데이터 모델 무변경(파서 한 겹만)·기존 TodoModal/EventModal/TodoRow/반복 분기 무손상·`npm run build` 통과.

---

## 2026-06-13

### 🛠 오늘 작업 내용
- 독서 기록 구절에 **"내 생각"(개인 메모)** 기능 추가 — `book_quotes.note text NULL` 컬럼 마이그레이션(`20260613000000_book_quotes_add_note.sql`) 적용 + 작성 폼에 옅은 점선 구분선 위 전구 아이콘 + "이 구절에 대한 내 생각…" textarea(선택 입력) + 재사용 표시 컴포넌트 `QuoteCard` 신설(책 상세·구절 탭 공용). 메모 있는 구절은 인용선을 강조 토큰(`t.accent`)으로, 없는 구절은 옅은 토큰(`t.borderLight`)으로 칠해 한눈에 구분 / 내 생각은 카드에서 2줄 line-clamp + 클릭 시 펼침(전체 노출). 색 하드코딩 0, 폰트 추가 0, PC/모바일 레이아웃 무변경
- 독서 책 상세 모달 **PC 전용 split 레이아웃** (2단계) — `lg:` 이상에서 모달을 92vw·max 1280·h 88vh 로 크게 키우고, 구절 탭 본문을 좌(40%, 구절 리스트 + `+ 구절 추가` 버튼) / 우(작성 폼 또는 선택 구절 상세) split 으로 분할. 좌측 리스트 행은 1줄 요약 + 메모 있으면 전구 아이콘 표시(인용선도 강조 토큰). 우측 상세는 1단계 `QuoteCard` 재사용(expanded=true). `+ 구절 추가` → 우측 빈 작성 상태(입력 필드 초기화). `lg:` 미만 모바일은 기존 단일 컬럼 그대로(`lg:hidden`로 감쌈, 변경 0). 토큰만 사용, 새 폰트 0
- 독서 책 상세 모달 **모바일 전용 풀스크린 작성/수정 화면 push** (3단계) — `lg:` 미만에서 구절 탭은 작은 인라인 입력 폼을 제거하고 **목록 + 상단 `+ 구절 추가` 버튼**만 노출. 목록 카드 탭 = 풀스크린(`fixed inset-0 z-[60]`) 작성/수정 시트 push (상단 ← 뒤로가기 / 제목(새 구절 ↔ 구절 수정) / `저장` 버튼, 본문에 구절 textarea 160px → 내 생각 textarea 110px → 페이지·태그 → 음성으로 입력 버튼, safe-area-inset 대응). `+ 구절 추가` → 빈 작성 화면 / 기존 구절 탭 = 그 구절 값으로 채워진 수정 화면. 신규 `handleUpdateQuote`/`handleSaveMobileSheet` 추가 — write 모드는 기존 `handleAddQuote`, edit 모드는 `book_quotes` UPDATE + 낙관적 반영. `lg:` 이상 PC split(2단계)는 변경 0(`lg:hidden`로만 분기). 토큰만 사용, 새 폰트 0
- 독서 책 상세 모달 **노트 탭** 추가 (4단계) — 책 전체에 대한 자유 메모(왜 읽는가=목적 / 읽고 나서=아웃풋). 마이그레이션 `20260613010000_create_book_notes.sql` — `book_notes(id, book_id FK→books, type text, content text, created_at, updated_at)` + `(book_id, type)` UNIQUE 로 한 책당 같은 종류 노트 1행 보장 + RLS owner only + Realtime publication + `updated_at` 트리거 자동 갱신. `type` 는 자유 text(현재 `'purpose'`/`'output'` 두 값, 향후 `'reread'`/`'takeaway'` 등 확장 가능). 모달 탭 [독서 진도 / 구절 / 노트] 3탭 구성. 노트 탭 UI: 위/아래 2섹션(라벨 + textarea 140·180px) + 저장 버튼(dirty 일 때만 활성). 저장은 빈 입력 행 미생성·기존 비우면 DELETE·둘 다 onConflict='book_id,type' upsert. `useRealtimeSync('book_notes', fetchNotes)` 로 PC↔모바일 동기화. PC 는 노트 탭 내부 `max-w-[820px]` 가운데 정렬, 모바일은 기존 탭 전환과 동일. 토큰만, 새 폰트 0

**산책(Walk) 모듈 신설 — Phase 0~3 (좌측/모바일/테마C 메뉴 🚶 산책, `/walk`)**
- **Phase 0 (스캐폴딩)**: 마이그레이션 `20260614000000_create_walk_sessions.sql` — `walk_sessions`(mode `free|course|repeat` CHECK, `path`/`planned_route` jsonb 좌표배열, `distance_m`/`duration_s`/`avg_pace_s_per_km` 계산 저장, `start_lat/lng`·`region_code`(시작점, 기억·지도 연동 여지), `photo_url`/`memo`/`route_name`/`is_saved_route`) + RLS 본인만 + Realtime. `20260614010000_create_walk_photos_bucket.sql` — `walk-photos` public 버킷(food/moment-photos 패턴). `db.ts` `WalkSession`/`WalkPoint` 타입 + `walkSessions` 데이터 레이어(목록/저장코스/생성/수정/삭제/사진업로드). `walk/walkUtils.ts`(하버사인 미터·경로 누적거리·평균 페이스·포매터·`routeProgress`) + `walk/useWalkData.ts`(로드+Realtime+CRUD 래퍼). `WalkView` + `/walk` 라우트 + 메뉴(Footprints).
- **Phase 1 (자유 산책 + 완료 카드)**: `useWalkTracker`(GPS `watchPosition` 고정밀 + 정확도 45m·이동 4m 미만 필터 + 거리/시간/신호약함/권한거부/일시정지) · `useWakeLock`(화면유지, 미지원 폴백+visibilitychange 재요청) · `FreeWalkSession`(카카오맵 코랄 폴리라인 실시간 + 현재위치 팬, 큰 지표, 키 없으면 글리프 폴백) · `RouteGlyph`(path 바운딩박스 정규화 SVG 폴리라인, 지도 타일 없이 모양만) · `CompletionCard`(사진 walk-photos 업로드·카드 배경 + 미니맵 + 지표 + 손글씨 메모 Nanum Pen → insert + 시작점 region_code + **모먼트 씨앗**[1E, 토글]) · `WalkRecordDetail`(사진배경+글리프+지표+손글씨 한 장 카드, 메모 수정·삭제). 1E 건강 연동은 '걷기' 유산소 종목 부재로 스킵(가이드대로).
- **Phase 2 (코스 산책)**: `CourseSetup`(출발=현재위치 기본/검색, 도착=카카오 키워드 검색·저장 장소 픽) · `CourseWalkSession`(출발/도착 dot + 참고 직선[또는 ORS 도보경로 점선] + 진행도[직선 대비 남은거리·%] + 도보 길찾기 `/link/by/walk`) · `lib/routing.ts`(OpenRouteService foot-walking 옵션, `VITE_ORS_API_KEY` 있을 때만 `planned_route`). 종료 → 완료 카드 재사용(mode:course).
- **Phase 3 (내 코스 다시)**: `RepeatPicker`(따라 걸을 수 있는 과거 세션, 저장 코스 우선/전체, 목표경로=planned_route 우선/없으면 path) · `RepeatWalkSession`(목표 경로 회색 점선 + 출발/도착 dot, 그 위 GPS 트래킹, 진행도=최근접 목표점 누적거리 비율) · 종료 → 새 세션 저장(mode:repeat, planned_route=원본, 원본 보존) · `WalkRecordDetail` "이 경로 코스로 저장"(이름→is_saved_route)/해제 액션.
- 원칙: 색 토큰만(코랄=accent, 손글씨=Nanum Pen) · 카카오 SDK/폴리라인/좌표·길찾기 링크는 가고싶은 곳 인프라 재사용 · 외부 API 최소(지도 카카오 JS 키, GPS 브라우저 기본, ORS 선택) · 전체화면 오버레이로 모바일/PC 공용(기존 PC 레이아웃 무영향) · `npm run build` 통과.

---

## 2026-06-12

### ✅ 완료
- [x] 운동 탭 **PC 전용 레이아웃** — 모바일 단일 컬럼을 넓은 화면 가운데 띄우던 문제 해소. 데이터 로직(`useWorkout`) 1벌 공유 + 레이아웃만 분리(`WorkoutTabMobile`/`WorkoutTabDesktop`). PC=전체폭 대시보드(상단 히어로 배너 + 2단 그리드) + 중앙 모달, 주간 루틴은 PC 7일 그리드(`RoutineWeekModal`). 모바일 Stage 1 무회귀

### 🛠 오늘 작업 내용

**운동 탭 PC 전용 레이아웃 — 로직 공유 + 레이아웃 분리**
- 배경: PC에서 운동 탭이 "모바일 단일 컬럼(max-w 440)을 넓은 화면 가운데 띄운" 상태(좌측 여백 과다·좁은 한 줄)로 보였음 → PC를 가로 공간 쓰는 대시보드로 별도 레이아웃 구성
- **① 공유 데이터 훅 추출** `useWorkout.ts`: 기존 `WorkoutTab` 안에 섞여 있던 쿼리/상태/파생값/CRUD 진입점/시트 열림 상태/Realtime 4구독을 훅 하나로 추출. 모바일·PC가 같은 훅 인스턴스를 공유(로직 1벌, 중복 0). `useIsDesktop`(matchMedia 1024px) 보조 훅도 동봉 — 시트 표현/루틴 에디터 분기에만 사용
- **② 레이아웃 분리**: `WorkoutTabMobile`(Stage 1 그대로 단일 컬럼) / `WorkoutTabDesktop`(신규 PC 대시보드). `WorkoutTab`은 셸로서 `lg:hidden`/`hidden lg:block` 분기 + 공유 시트 1회 렌더(이중 마운트 방지). 한쪽 수정이 다른 쪽에 무영향
- **③ PC 대시보드 명세 구현**:
  - 컨테이너: `w-full`(모바일의 max-w 가운데 정렬 제거) → HealthView 콘텐츠 영역 전체폭 채움, 좌측 빈 여백 제거
  - 상단 히어로 배너(가로 1줄, 전체폭, accent 그라데이션): 🔥 스트릭 | 마지막 운동일 | "오늘 뭐하지" 제안 | 부위별 휴식 칩(가장 오래 쉰 부위 흰 pill 강조)
  - 2단 그리드(`1.5fr / 1fr`): 좌=오늘의 루틴 카드(2열)+오늘의 운동 카드(목록+운동 추가), 우=종목별 성장 그래프 카드+지난 기록(최근 6세션 인라인, "전체 보기"로 모달)
  - 오늘의 운동 항목 hover 시 "편집" 라벨 노출(모바일엔 없음)
- **④ 시트→모달**: Picker/Record/History 는 공용 `SheetShell`(모바일 바텀시트 / PC 중앙 모달)로 폼 본체 공유. `SheetShell`·`ExercisePickerSheet`에 `wide` prop 추가 — PC Picker 는 넓은 모달(760px) + 사진 그리드 `lg:grid-cols-4`(모바일은 동일 full-width·2열, `lg:` 한정이라 모바일 무변경)
- **⑤ 주간 루틴(PC 강점)** `RoutineWeekModal.tsx`: 월~일 7일을 7열 그리드로 한 화면에 펼쳐 편집(요일별 라벨 input + 종목 목록/추가/삭제), 오늘 요일 컬럼 accent 강조. CRUD 는 모바일 `RoutineSheet` 와 동일한 `db.workouts` 메서드 공유. 모바일은 단일 요일 뷰(`RoutineSheet`) 유지
- **원칙 준수**: 색상 토큰만(accent/accentSoft/accentLight/danger/dangerLight/success/bgSub/borderLight 등, 히어로 위 흰색/반투명만 실물 표현 고정) · 폰트 규칙 동일(제목 DM Serif/본문 Noto Sans KR) · PC 데이터 쿼리/CRUD 재사용(재구현 0) · 런타임 번역 호출 0 · `npm run build` 통과(vite 6). 뷰포트를 모바일 폭으로 줄이면 `WorkoutTabMobile`(Stage 1 그대로)로 자동 분기

---

## 2026-06-08

### ✅ 완료
- [x] 운동 종목 한글명 일괄 채움 (seed 1회 배치) — `name_ko IS NULL` 카탈로그 865개를 한국 헬스장 자연 음차 한글명으로 채움(멱등). "스쿼트" 검색 1→56건, 미번역 0. 런타임 번역 코드 없음
- [x] 운동 모듈 **Stage 3** — 종목 이미지 GitHub raw 핫링크 → Supabase Storage(`exercise-images`) 이관(자립화). 버킷 생성 + 멱등 이관 스크립트/Edge Function + image_url 갱신 (UI 로직 무변경)
- [x] 운동 모듈 **Stage 1** — 건강 메뉴 '운동' 탭(모바일): 스트릭 히어로 + 오늘의 루틴 + 부위별 마지막 운동 + 종목별 성장 그래프 + 오늘의 운동, 바텀시트 4종(종목선택/기록/주간루틴/지난기록). 색상 토큰만·PC 미변경·런타임 번역 호출 없음
- [x] 운동 모듈 **Stage 0** — Supabase 스키마 5테이블 + free-exercise-db(873종목) import + 스타터 한글 9종목 (DB only, UI/컴포넌트 미변경, 런타임 번역 금지 원칙 명시)
- [x] 통합 일기 **Stage 2** — 질문일기 탭: 오늘의 질문 카드(날짜 deterministic 기본 질문 + localStorage 고정) + 답변 작성·자동저장 + "다른 질문" 셔플 + 질문 탐색 시트(카테고리 필터/나만의 질문 추가·삭제) + 지난 질문일기 리스트 + 기존 `/question-journal` → `/diary` 리다이렉트
- [x] 통합 일기 **Stage 3** — 이날의 기억(5년 일기) 탭: 기준 날짜의 월/일 같은 1~5년 전 기록 조회(월/일 expression 인덱스) + 연도 블록(자유/질문 type 뱃지) + 기록 없는 연도 흐린 빈 카드 + 전부 비면 안내 문구 + 읽기 전용 상세 시트
- [x] **통합 일기 페이지(오늘 일기 / 질문일기 / 이날의 기억) 3탭 전체 완성**

### 🛠 오늘 작업 내용

**운동 종목 한글명(name_ko) 일괄 채움 — seed 1회 배치**
- 배경: 카탈로그 865개가 영어 이름만 있어 한글 검색이 거의 안 됐음(스타터 9개만 한글). 일괄 한글화로 검색성 확보
- 대상: `exercises` 중 `name_ko IS NULL` 인 free-exercise-db 865개. 이미 한글명 있던 스타터 9개는 건너뜀(멱등). `name_en` 중복 0 확인 → `name_en` 매칭 UPDATE
- 번역 지침(스펙대로): 한국 헬스장 자연 음차(Barbell→바벨, Incline→인클라인, Squat→스쿼트, Press→프레스 …), 군더더기·괄호 설명 금지, 약어(SMR/EZ바/V바 등)는 음차 안 함. 결과를 `scripts/exercise-name-ko.seed.json`(en→ko 맵)에 기록
- 적용: 멱등 UPDATE `set name_ko=v.ko ... where name_en=v.en and name_ko is null` 4배치(220개씩). 재실행해도 채워진 행은 0건 매칭(멱등)
- 검수 결과(`scripts/exercise-name-ko.review.md`): 전체 874 전부 name_ko 채워짐(null 0), name_ko==name_en 0, 길이 이상치 0, 라틴 3자+ 잔존 13개(전부 `SMR` 약어 — 허용). **"스쿼트" 검색 1→56건**
- 검색 동작: `db.workouts.search` 가 `name_ko OR name_en OR equipment OR primary_muscles` 매칭 → 한글/영어 모두, custom·미채택 종목도 영어로 안전 검색(기존 구현 충족, 변경 없음)
- **런타임 번역 금지 준수**: 페이지 진입/조회 시 번역 호출 코드 없음. 재현용 Haiku 스크립트 `scripts/translate-exercise-names.mjs`(claude-haiku-4-5, 40개씩 JSON in/out, `name_ko IS NULL` 만, 검수 리스트 출력)도 커밋

**운동 모듈 Stage 3 — 종목 이미지 Storage 이관(자립화)**
- 목적: 종목 이미지를 외부 GitHub raw 핫링크 의존에서 벗어나 Supabase Storage 로 자체 호스팅(대역폭·가용성 안정화). UI 로직 변경 없이 `exercises.image_url` 값만 교체
- 마이그레이션 `20260608020000_create_exercise_images_bucket.sql`: 공개 읽기 버킷 `exercise-images` 생성(scrap-thumbs/food-photos 패턴) — 공개 select 정책 + 인증 사용자 쓰기 정책(실제 이관은 service_role 로 RLS 우회 업로드)
- 이관 로직(멱등): `source='free-exercise-db'` 이고 image_url 이 아직 GitHub raw 핫링크인 행만 대상 → 이미지 다운로드 → `exercise-images/{source_id}/0.jpg` upsert 업로드 → image_url 을 Storage 공개 URL 로 UPDATE. 실패 항목은 핫링크 유지(앱 무손상). 이미 Storage URL 인 행은 건너뜀(재실행 안전). `--adopted-only` 모드(채택 종목=name_ko 보유/logs·routines 등장만 우선 이관)
- 두 가지 실행 경로 제공: ① `scripts/migrate-exercise-images.mjs`(서비스롤 키로 로컬 1회 실행) ② Edge Function `migrate-exercise-images`(서버 측 실행 — 네트워크 송신 제한 환경 대비, `?adoptedOnly`/`?limit` 파라미터·배치·토큰 가드)
- **실행 결과**: 채택 8종목 우선 이관 후 전체 873종목 배치 이관 완료(`uploaded` 누계 = 873, `failed` 0, 남은 핫링크 0). 공개 URL 200·image/jpeg 응답 확인(예: `.../exercise-images/Romanian_Deadlift/0.jpg` 59,859 bytes). 무료 플랜 1GB 대비 합계 ~50MB 수준
- `ExerciseThumb` 등 UI 는 image_url 을 그대로 읽으므로 코드 변경 0 — 핫링크와 동일 외형

**운동 모듈 Stage 1 — 모바일 운동 탭 UI (`workout/`)**
- `HealthView` 탭에 '운동' 추가(수면/컨디션/몸무게/생리/운동 5탭) — 모바일 탭바 `grid-cols-4`→`grid-cols-5`, PC 는 `lg:flex` 그대로(PC 레이아웃 무변경). 운동 탭 콘텐츠는 `max-w-440` 중앙 컬럼(모바일 기준, PC 별도 레이아웃은 Stage 2)
- **데이터 레이어** `db.workouts` (db.ts): 종목(`listMine`/`search`/`adopt`) · 세션(`listByDate`/`listAll`/`lastSessionFor`/`growthSeries`/`createLog`/`updateLog`/`deleteLog`/`fetchLog`) · 루틴(`listRoutineDays`/`ensureRoutineDay`/`setRoutineLabel`/`addRoutineExercise`/`removeRoutineExercise`). 타입 `Exercise`/`WorkoutLog`/`WorkoutSet`/`RoutineDay`/`RoutineExerciseItem` + `exerciseLabel`(한글 우선) 추가. supabase 임베드 조인(`exercises(*)`,`workout_sets(*)`,`routine_exercises(*, exercises(*))`) — FK 4종 검증 완료
- **메인 탭(`WorkoutTab.tsx`)** 위→아래 5블록:
  1. 스트릭/요약 히어로(🔥 연속일수·마지막 운동일·제안). 제안=오늘 요일 루틴 우선("오늘 루틴은 OOO"), 없으면 가장 오래 쉰 부위 추천(한 번도 안 한 부위 최우선)
  2. 오늘의 루틴 카드: 오늘 요일 routine_exercises 목록, 각 "기록 ›"→기록 시트, "루틴 편집"→주간 루틴 시트
  3. 부위별 마지막 운동: 6개 주요 부위 칩 + "N일 전", 가장 오래 쉰 부위 coral(=danger) 강조
  4. 종목별 성장: 근력 종목 칩 선택 → 최근 한 달 세션별 대표 무게(최대) 추이 라인 그래프(의존성 없는 인라인 SVG)
  5. 오늘의 운동: 오늘 기록 목록(탭=편집) + "＋ 운동 추가", 헤더 "지난 기록 ›"→히스토리
- **바텀시트 4종** (공용 `SheetShell` — 모바일 슬라이드업/PC 중앙카드, ScrapDetailSheet 애니메이션 패턴):
  - A) `ExercisePickerSheet`: 기본=내 운동(2열 사진 그리드 + 부위/타입 필터), 검색 시 전체 카탈로그(한글·영어·근육·장비) 노출. 카드=이미지(`ExerciseThumb`, 실패 시 부위 이모지 폴백)+한글/영어명+"지난 기록 있음/첫 기록". 카탈로그(name_ko=null·공용) 탭→한글 별칭 입력 오버레이→채택. 공용 행은 RLS상 수정 불가→`adopt`가 내 소유 복사본 생성(중복 방지), 이미 내 소유면 name_ko만 갱신
  - B) `RecordSheet`(신규/편집 공용): 사진·한글/영어명·부위/타입 태그·▶자세 영상(youtube_url 있을 때만). 근력=[무게×횟수] 세트, 유산소=[시간/거리]. 신규는 직전 세션 sets 회색 prefill→포커스/수정 시 일반색. ＋세트 추가·✕삭제·메모. 저장=신규 insert/편집 update(세트 전체 교체), 편집만 "이 기록 삭제"(ConfirmModal, cascade). XP는 신규 저장 시 TODO 주석(현재 명령형 XP 적립 훅 없음)
  - C) `RoutineSheet`: 월~일 선택→라벨 편집 + 종목 목록 추가(Picker 재사용)/삭제. routine_days/routine_exercises CRUD
  - D) `HistorySheet`: workout_logs를 performed_on 내림차순 날짜 그룹, 종목·세트 요약(+총 볼륨), 항목 탭→기록 편집(performed_on 유지)
- Realtime: `workout_logs`/`workout_sets`/`routine_days`/`routine_exercises` 구독(PC↔모바일 즉시 반영)
- **원칙 준수**: 색상 토큰만(골드=accent/코랄=danger/그린=success/`bgSub`/`borderLight` 등, hex 0) · 타이틀 DM Serif Display·본문 Noto Sans KR(손글씨 미사용) · PC 레이아웃 무변경(`lg:flex` 탭바 유지) · **런타임 번역 호출 0**(종목명은 DB name_ko/name_en 만 읽음, 한글화는 채택 시 1회 수동 입력) · `npm run build` 통과 + `tsc --noEmit` 0 에러

**운동 모듈 Stage 0 — Supabase 스키마 + free-exercise-db import (DB only)**
- 마이그레이션 `20260608010000_create_workout_tables.sql` (Supabase MCP `apply_migration` 으로 production 적용 완료) — 5테이블:
  - `exercises`(종목 마스터/카탈로그): `user_id` null=전체 공용·있으면 내 커스텀, `name_ko`(null=미채택 카탈로그)·`name_en`·`type`(근력/유산소 CHECK)·`body_part`(9종 CHECK)·`equipment`·`primary_muscles text[]`·`youtube_url`·`image_url`·`source`('free-exercise-db'|'custom')·`source_id`
  - `workout_logs`(한 날/한 종목 세션: user_id·exercise_id FK·performed_on·memo) / `workout_sets`(세트=근력 weight/reps 또는 유산소 duration_min/distance_km, log_id ON DELETE CASCADE) / `routine_days`(요일별 헤더, day_of_week 1~7 CHECK, unique(user_id,day_of_week)) / `routine_exercises`(routine_day_id ON DELETE CASCADE·exercise_id·sort_order)
  - 인덱스: workout_logs(user_id,performed_on desc)·(exercise_id,performed_on desc) / workout_sets(log_id) / routine_exercises(routine_day_id,sort_order) / exercises(name_ko)·(name_en)·(body_part)
  - RLS: 전 테이블 활성. exercises select=(user_id is null OR =auth.uid())·insert/update/delete=내 행만 / workout_logs·routine_days=user_id 기준 / workout_sets·routine_exercises=부모(EXISTS) 기준. 5테이블 모두 `supabase_realtime` publication 등록
- free-exercise-db(yuhonas/free-exercise-db, 퍼블릭 도메인) `dist/exercises.json` 873종목 import (execute_sql 3배치):
  - 매핑 딕셔너리: type=cardio→유산소·그외→근력 / body_part=primaryMuscles[0] 기준(하체/가슴/등/어깨/팔/코어, 유산소면 강제 유산소) → 873종목 전부 매핑 성공
  - 각 항목 user_id=null·source='free-exercise-db'·source_id=원본 id·name_en=원본 name·equipment·primary_muscles=원본 primaryMuscles
  - 이미지: `images[0] === source_id || '/0.jpg'` 임을 확인 → image_url = GitHub raw 핫링크(`.../exercises/<id>/0.jpg`)로 873개 전부 채움. **Storage 이관은 Stage 3** (지금은 Storage·대역폭 미사용)
  - name_ko: import 시 전부 null(=카탈로그). 일괄 번역 안 함
- 스타터 한글 종목 9개 name_ko 채움(name_en 매칭 UPDATE, 정해진 텍스트 1회성·번역 API 미사용): 바벨 스쿼트/루마니안 데드리프트/바벨 힙쓰러스트/랫풀다운(Wide-Grip Lat Pulldown)/벤치프레스(Barbell Bench Press - Medium Grip)/숄더프레스(Barbell Shoulder Press)/러닝(Running, Treadmill)/사이클(Bicycling). 요가는 매칭 항목 없어 custom 공용(user_id=null)으로 직접 insert
- 검증: imported 873 / with_image 873 / with_name_ko 9 / cardio 15 / total 874. security advisor — 신규 5테이블 RLS 정상(전용 경고 없음)
- **런타임 번역 금지 원칙**을 마이그레이션 주석 + `scripts/seed-exercises.mjs`(재현용 seed 스크립트, 매핑 딕셔너리·스타터 매핑 포함)에 명시
- 이 스테이지는 DB만 — UI/컴포넌트/라우트/store 미변경

**통합 일기 Stage 2 — 질문일기 탭 (`DiaryView.tsx`)**
- 오늘의 질문 카드: 답변 있으면 `question_text` 스냅샷+답변 로드(편집), 없으면 날짜 deterministic 기본 질문(최근 답한 질문 가급적 제외) + `localStorage`로 같은 날 질문 고정. coral 좌측 강조 + 카테고리 태그(accentLight) + DM Serif 질문 문장
- 답변: 개구 폰트 textarea + 자동저장(debounce 1.5s)·수동 저장. `(entry_date, type='question')` 앱 레벨 upsert(하루 1건), `question_id` + `question_text`(작성 시점 스냅샷) 함께 기록
- "다른 질문" 셔플(미답 상태에서만, 현재/최근 제외) + 질문 탐색 시트(`ExploreSheet`): 카테고리 필터칩(전체/나만의 질문/12 카테고리 등장 순) + 질문 선택→오늘의 질문 지정 + 나만의 질문 추가(`is_default=false`)·삭제(기본 질문은 RLS 차단)
- 지난 질문일기 7건(`entry_date` 내림차순): 날짜 + 질문(이탤릭 회색) + 답변 발췌(개구 2줄), 클릭 시 해당 날짜 로드
- `db.diaryEntries`(fetchQuestionByDate/listRecentQuestion/upsertQuestion) + `db.journalQuestions`(fetchAll/createCustom/delete) + `JournalQuestion` 타입. `diary_entries`·`journal_questions` Realtime 구독
- 기존 질문일기 데이터 0건 확인 → 마이그레이션 불필요. `/question-journal` 라우트 `/diary` 리다이렉트, 네비에서 '질문일기' 제거(`QuestionJournalView.tsx` 파일은 미변경)

**통합 일기 Stage 3 — 이날의 기억(5년 일기) 탭 (`DiaryView.tsx`)**
- 조회 RPC `diary_on_this_day(month, day, fromYear, toYear)` 신규(`20260608000000_diary_on_this_day_rpc.sql`, Supabase 적용 완료): `extract(month/day)` 필터 → `diary_entries_user_monthday_idx` 사용(쿼리 플랜 `Index Scan` 확인). security invoker + RLS로 본인 기록만. 2월 29일은 윤년만 매칭되어 평년 자연 제외
- `MemoryTab`: 기준 날짜(기본 오늘, 달력으로 변경·미래 차단)의 월/일과 같고 연도 1~5년 전 기록 전부(자유·질문 무관) 조회 → 연도별 그룹(1년 전이 위)
- `YearBlock`: "N년 전 · YYYY" 뱃지(gold) + 그 해 기록 카드. 기록 없는 연도는 흐린 빈 카드("이날의 기록이 아직 없어요"). 1~5년 전 전부 비면 안내 문구("매년 같은 날, 오늘의 기록이 이곳에 쌓여요…")
- `MemoryCard`: type 뱃지(자유=success/질문=danger) + 좌측 강조선 + (질문이면 질문 문장 이탤릭) + 본문 발췌(개구). 클릭 → 읽기 전용 상세 시트(`MemoryDetailSheet`, 전체 본문 개구·whitespace 보존)
- `db.diaryEntries.listOnThisDay` 추가. 색상 토큰만 사용(골드=accent/코랄=danger/그린=success), 본문 개구(`--font-hand`), 모바일 우선, 다른 페이지 무영향

**통합 일기 PC 레이아웃 — 가로폭 채움 (`DiaryView.tsx`)**
- PC에서 좁은 600px 중앙 정렬 컬럼(`lg:max-w-[600px]`)으로 몰려 보이던 문제 수정 → 다른 페이지처럼 가로폭을 채우도록 `w-full px-4 lg:px-10`로 변경(좁은 max-width 제거)
- 모바일(`px-4` 단일 컬럼)은 그대로 유지, 변경은 `lg:` prefix에 한정

**통합 일기 — 줄 배경 정렬 + 삭제/편집 (`DiaryView.tsx`)**
- 노트 줄 배경 가로선이 글자 줄과 어긋나 간격이 불규칙해 보이던 문제 수정: textarea `padding 0`+`border none`으로 글자를 선에 맞추고 `background-attachment: local`로 스크롤 시 선이 글자를 따라가게 함. 줄 간격 상수(`NOTE_LINE_H=32`)로 line-height·배경 주기 일치
- 편집: 날짜 선택 → 본문/답변 수정(자동저장)으로 동작. 질문일기는 질문 탐색으로 질문 자체도 교체 가능
- 삭제: 작성칸 하단 '삭제' 버튼(저장된 기록일 때만) + 최근/지난 일기 카드 우상단 휴지통 + 이날의 기억 상세 시트 '삭제'. 모두 공통 `ConfirmModal`(빨간 위험 버튼) 확인 후 `db.diaryEntries.delete`. 현재 편집 중 기록 삭제 시 작성칸 비움(질문일기는 질문 재배정), Realtime 반영

**통합 일기 — 제목칸 분리 + 원하는 줄 클릭 작성 (`DiaryView.tsx`, DB)**
- `diary_entries.title text` 컬럼 추가(`20260608010000_diary_entries_add_title.sql`, Supabase 적용 완료). 자유일기 전용(질문일기는 질문이 제목 역할 → null). `db.DiaryEntry.title` + `upsertFree(date, content, title?)` 반영
- 오늘 일기: 작성 카드 상단에 제목 입력칸(선택) + 구분선 + 본문. 제목은 손글씨 22px 볼드. 제목/본문 어느 쪽이든 입력 있으면 저장. 최근 일기·이날의 기억 카드/상세에 제목 표시
- `LinedTextarea` 공용 컴포넌트: 빈 줄을 클릭하면 그 줄까지 줄바꿈을 채워 커서를 놓아 노트처럼 원하는 줄부터 작성 가능(일반 textarea는 첫 줄에서만 시작됨). 오늘 일기 본문·질문일기 답변 모두 적용
- 저장 시 본문은 끝 공백/줄바꿈만 정리(`replace(/\s+$/,'')`)하고 앞쪽 줄 위치는 보존 → 원하는 줄에 쓴 위치 유지. 엔터 시 다음 줄(라인)에 맞춰 작성됨(line-height=줄 간격 32px 일치)

## 2026-06-07

### 📋 TODO
- [ ] 음악 기록 Stage 3 — 스티커 꾸미기 + 위치 저장 (stickers jsonb 컬럼·🎨 꾸미기 버튼 자리 이미 준비됨)
- (스크랩 Stage 4 — 비전보드·할일·저널 실제 연결, 디스코드)

### ✅ 완료
- [x] 음악 기록 Stage 1 — 데이터 토대 + iTunes 검색·추가 (`music_records` 테이블 + RLS + Realtime, iTunes Search API 프록시 Edge Function `itunes-search`, 검색→결과 리스트→선택→무드·장르·메모·듣기링크 입력→저장, `itunes_track_id` 중복 방지)
- [x] 음악 기록 Stage 2 — LP 그리드 + 상세 + 무드 필터·셔플 (문화 기록 안에 [영상/음악] 섹션 탭으로 통합)
- [x] 스크랩 / 영감 보관함 **Stage 0** — 스키마 + 라우트 + 빈 페이지 셸
- [x] 스크랩 / 영감 보관함 **Stage 1** — 저장 + Realtime + 메타 자동 채움(유튜브 oEmbed / 웹 OG / 인스타·스레드 수동 스크린샷) + db.ts 일원화 + 메이슨리 그리드 + 출처 필터 5종
- [x] 스크랩 / 영감 보관함 **Stage 2** — 카드 상세 시트(썸네일·원본열기·코멘트·태그 인라인 편집) + 상태 세그먼트(미확인/다시봄/소화완료) + 노트 글 기록 패널(시간순 + 추가 시 소화완료 자동 승격) + scrap_notes Realtime + 연결 버튼 placeholder + touchViewed(last_viewed_at)
- [x] 스크랩 / 영감 보관함 **Stage 3** — 재노출: 먼지 쌓인 스크랩 카드(마스킹테이프 + 미리보기 + 셔플) + "안 본 것만" 토글 + 제목·코멘트·태그 검색(디바운스 200ms, 출처 필터와 AND 결합) + db.scraps.listDusty / search
- [x] 독서 페이지 자동 완독 + 독서밭 완독일 강조
- [x] 통합 일기 **Stage 0** — DB 셋업: `diary_entries` + `journal_questions` 테이블 + RLS + Realtime + 질문 108개(12 카테고리) seed (Supabase 적용 완료)
- [x] 통합 일기 **Stage 1** — 탭 셸(오늘 일기/질문일기/이날의 기억) + 오늘 일기(자유일기) 작성·자동저장·최근 일기 리스트 (질문일기·이날의 기억은 placeholder)

### 🛠 오늘 작업 내용

**통합 일기 Stage 0 — DB 셋업**
- 마이그레이션 `20260607030000_create_diary_and_journal_questions.sql` (Supabase MCP `apply_migration` 으로 production 적용 완료)
- `diary_entries`: 자유일기/질문일기를 `type`(free/question)으로 통합. `entry_date date` + `question_id`(FK→journal_questions, ON DELETE SET NULL) + `question_text`(작성 시점 질문 스냅샷 → 질문 수정·삭제돼도 일기 보존) + `content` + user_id(DEFAULT auth.uid())
- 인덱스: `(user_id, entry_date)` / 이날의 기억용 `(user_id, EXTRACT(MONTH), EXTRACT(DAY))` expression 인덱스 / `type='free'` 하루 1개 부분 유니크 `(user_id, entry_date)`
- `journal_questions`: 기본 질문(공용 `user_id=null`) + 나만의 질문(소유자). 12 카테고리 108개 seed(`is_default=true`)
- RLS: 소유자 전용 4정책 + 기본 질문은 누구나 SELECT. 두 테이블 `supabase_realtime` publication 등록

**통합 일기 Stage 1 — 탭 셸 + 오늘 일기(자유일기) (`DiaryView.tsx`)**
- `/diary` 라우트 + 일기 메뉴 진입점(`PenLine`) 추가 — PC 사이드바·모바일 오버레이 두 네비 배열에. 기존 질문일기(`/question-journal`) 페이지는 미변경
- 탭 3개(오늘 일기 기본 / 질문일기 / 이날의 기억). 활성 탭 coral(`t.danger`) 언더라인, 탭 전환 시 스크롤 상단. 질문일기·이날의 기억은 "준비 중 — 곧 추가됩니다" placeholder (Stage 2·3)
- 오늘 일기 탭: 날짜 영역("M월 d일 · EEEE" + 달력 아이콘에 투명 `<input type="date" max={today}>` 오버레이 → 과거 작성/조회, 미래 차단). 노트 줄 배경 카드 + 손글씨(`--font-hand`) textarea + 자동저장(debounce 1.5s)·수동 저장(coral). `(entry_date, type='free')` 부분 유니크 기준 select 후 update/insert upsert
- 최근 일기 7건(`entry_date` 내림차순): 날짜 + 본문 2줄 말줄임(손글씨), 클릭 시 해당 날짜 로드(선택 날짜 coral 테두리). 빈 상태 안내
- `db.diaryEntries`(fetchFreeByDate/listRecentFree/upsertFree/delete) + `DiaryEntry` 타입. `diary_entries` Realtime 구독(편집 중 본문 보존)
- 손글씨 토큰 `--font-hand`(=Gaegu) 추가 → 일기 본문(textarea·미리보기)에만 적용, UI 폰트(DM Serif/기존) 유지. 색상 토큰만 사용(골드=accent/코랄=danger/그린=success), PC 중앙 단일 컬럼(max-w 600px)

**독서 페이지 자동 완독 + 독서밭 완독일 강조 (`BooksView.tsx`)**
- `BookDetailModal`: 현재 페이지 ≥ 전체 페이지(>0) 입력 시 `isAutoComplete` 플래그 활성
  - 진행 바 색상 그린(`#6BAA7A`)으로 변경, "🎉 완독! 저장하면 완독 탭으로 이동돼요" 안내 배너 표시
  - 저장 버튼 "완독 저장하기 🎉" 로 변경
  - `handleSaveProgress`: `finalStatus = isAutoComplete ? 'done' : status` — status를 강제로 done 처리 + finishDate 자동 기록
  - `onComplete` 콜백 prop 추가 → done 저장 시 호출
- `BooksView`: `BookDetailModal`에 `onComplete={() => setActiveTab('done')}` 전달 → 완독 저장 후 자동으로 완독 탭 이동
- `getReadingActivityData` (리팩터링): 기존 `getReadingActivityCounts` → `{ counts, completions }` 분리 반환. `completions`는 `finishDate` 날짜들의 Set
- `pulseColor`: `isCompletion` 파라미터 추가 → 완독일은 활동 횟수 무관하게 `#D4603A`(최진한 색) 고정
- `ReadingPulse` 셀: 완독일에 주황 테두리(`outline: 1.5px solid #D4603A`) + 툴팁 "🎉 완독!" 표시

**음악 기록 Stage 1 — 데이터 토대 + iTunes 검색·추가**
- 마이그레이션 `20260607000000_create_music_records.sql`: `music_records` 테이블(track_title/artist/album/artwork_url/release_year/itunes_track_id/preview_url/mood text[]/genre/memo/listen_url/stickers jsonb) + 소유자 RLS 4종 + `supabase_realtime` publication 등록 + 부분 unique index(`user_id, itunes_track_id`)로 중복 방지
- Edge Function `itunes-search`: iTunes Search API(`media=music&entity=song&country=KR`) CORS 프록시, 결과를 camelCase 매핑(artworkUrl 100x100→600x600), `verify_jwt:true`
- `src/lib/itunes.ts`: `searchMusic(term)` — `supabase.functions.invoke('itunes-search')` 호출
- `src/lib/db.ts`: `musicRecords` 객체(fetchAll/existsByItunesId/insert/delete, snake_case↔camelCase 변환, user_id 미전송)
- `src/app/store.tsx`: `MusicRecord` 인터페이스 추가

**음악 기록 Stage 2 — LP 그리드 + 상세 + 무드 필터·셔플**
- 문화 기록(`CultureRecordView`) 상단에 [영상/음악] 섹션 탭(`SectionTabs`) 추가 — 영상 탭은 기존 PC/모바일 트리 그대로 유지, 음악 탭은 단일 반응형 `MusicSection` early-return(PC 영상 레이아웃 무변형, 이중 구독 방지)
- Stage 1 임시 `/music` 라우트·네비(Layout/LayoutC)·`MusicRecordView` 제거 → 문화 기록 안에서만 접근
- `LpDisc`: 검은 비닐(radial-gradient) + 동심원 groove + 중앙 라벨 앨범아트 원형 크롭(없으면 골드 폴백) + 중앙 구멍, 8s 회전 / 그리드 모바일 2열·sm 3·lg 5
- 무드 필터 칩(전체/집중/위로/신날 때/드라이브/잠들기 전, mood text[] 포함 필터) + "지금 이 무드엔?" 셔플 카드
- `MusicDetailSheet` 상세 바텀시트: 큰 LP + ▶/⏸ 미리듣기(preview_url `<audio>`, 단일 인스턴스, 없으면 회전만 토글) + 🎨 꾸미기(Stage 3 비활성), 제목(DM Serif)/아티스트/앨범·연도, 무드(코랄)·장르(그린) 태그, 듣기 링크(listen_url 직접 + 유튜브뮤직/스포티파이 자동검색), 메모(골드 좌측 라인 + 저장일)
- 색상은 디자인 토큰만(골드=accent/코랄=danger/그린=success), 비닐 검정·홈만 실물 LP 표현용 고정색
- [x] 스크랩 / 영감 보관함 **Stage 0** — 스키마 + 라우트 + 빈 페이지 셸
- [x] 스크랩 / 영감 보관함 **Stage 1** — 저장 + Realtime + 메타 자동 채움(유튜브 oEmbed / 웹 OG / 인스타·스레드 수동 스크린샷) + db.ts 일원화 + 메이슨리 그리드 + 출처 필터 5종

**스크랩 Stage 3 — 재노출: 먼지 쌓인 스크랩 + 셔플 + 안 본 것만 + 검색**

데이터 레이어 (`src/lib/db.ts`)
- `db.scraps.listDusty(minDaysSinceView=14, limit=20)` — status != 'done' AND `COALESCE(last_viewed_at, created_at) < (now - 14d)`. PostgREST `.or()` 로 `and(last_viewed_at.is.null, created_at.lt.X)` OR `last_viewed_at.lt.X` 분기. 결과는 클라이언트에서 `COALESCE` 키로 오래된 순(asc) 정렬해 반환 (PostgREST 가 COALESCE 정렬을 직접 지원하지 않아서)
- `db.scraps.search(q)` — `title.ilike.%q% OR comment.ilike.%q% OR tags.cs.{q}` (태그는 text[] contains, 정확 매칭). 와일드카드/콤마/괄호 sanitize 후 호출. 빈 쿼리는 즉시 빈 배열 반환
- 두 메서드 모두 컴포넌트의 supabase direct import 0 유지 — db.ts 경유

ScrapView (`src/app/components/ScrapView.tsx`)
- 새 state: `searchQuery` / `searchResults`(null=비검색, []=결과없음) / `onlyUnread` / `dustyCandidates` / `dustyIndex`
- `refresh()` 가 `listByUser` + `listDusty` 를 `Promise.all` 로 동시 호출 → Realtime `scraps` 변경 / 시트 닫힘 / 노트 추가(소화완료 자동승격) 모두에서 먼지 후보 자동 재계산
- 검색 — `useEffect` 디바운스 200ms → `db.scraps.search(q)` 호출. 빈 문자열은 `searchResults=null` 로 두어 전체 스크랩 사용
- `filtered` 베이스 = `searchResults ?? scraps` → 출처 필터 + `onlyUnread`(status==='unread') 모두 AND 결합
- 검색창: 라운드 pill 입력 + `Search`/`X`(클리어) 아이콘, `t.bgSub` 배경 + `t.borderLight` 테두리
- "안 본 것만" 토글: 활성 시 `t.accent` 배경/흰 글씨, 비활성 시 투명 + 외곽선 (출처 필터 칩과 시각적 구분)
- 빈 상태 메시지 분기: 검색결과 없음 / 안 본 것 없음 / 출처별 없음 / 첫 사용 — 각각 다른 안내문

먼지 쌓인 스크랩 카드 — `DustyResurfaceCard` 컴포넌트 (ScrapView 안 헬퍼)
- 검색 중이거나 후보 없으면 자동 숨김
- 좌상단 마스킹 테이프(작은 `t.accentLight` 직사각형 + -3deg rotate + 상하 골드 hairline + 그림자)
- 좌측: 84x84 미리보기 썸네일(없으면 출처별 그라데이션 + Sparkles 아이콘), 탭 시 상세 시트 오픈
- 우측: ✨ "한참 안 들여다본 스크랩이에요" 골드 라벨 + 제목 2줄 클램프 + 하단 출처 라벨 + `Shuffle` 아이콘 "다른 거 보여줘" 버튼(`t.accentLight` 배경)
- 셔플: 후보 안에서 다른 인덱스 랜덤 픽 (후보 1개 이하면 비활성)
- 카드 탭 → 상세 시트 오픈 → 시트에서 `touchViewed` 호출 → 닫힘 시 `refresh` → `listDusty` 재호출 → 본 스크랩은 자동으로 후보에서 빠짐

원칙 준수
- 모든 supabase 호출 db.ts 경유 (`listDusty`/`search` 도)
- 색상 토큰만(`t.accent`/`t.accentLight`/`t.bgSub`/`t.borderLight`/`t.textSub`/`t.textMuted` 등) + `withAlpha`
- 모바일(390) 기준 + PC `lg:` 분기 — 헤더 폭은 기존 `px-6 lg:px-14` 그대로 사용
- Figma 디렉터리(`src/app/components/figma/`) 미수정
- 폰트 추가 import 0
- Stage 4 보류 항목 미구현: 비전보드·할일·저널 실제 연결 / 디스코드
- `npm run build` 통과 (vite 6 production)

---

**스크랩 Stage 2 — 상세 시트 + 상태 전환 + 노트 기록**

데이터 레이어 (`src/lib/db.ts`)
- `db.scrapNotes` 본 구현: `listByScrap(scrapId)` (created_at asc, 시간순) / `create({ scrapId, content })` (user_id DB DEFAULT auth.uid()) / `delete(id)`
- `db.scraps.updateStatus(id, status)` — 세그먼트 컨트롤 전용 편의 메서드 (`updated_at` 동시 갱신)
- `db.scraps.touchViewed(id)` — `last_viewed_at = now()` (Stage 3 먼지 로직 기반 데이터)
- `ScrapNoteRow` + `toScrapNote` 변환기 추가 (snake_case → camelCase)
- 컴포넌트의 supabase direct import 0, 모두 db.ts 경유 유지

상세 시트 — `src/app/components/scrap/ScrapDetailSheet.tsx` (신규)
- 모바일 슬라이드업 + PC 중앙 카드(560px, max-h 92vh) — AddScrapModal 동일 애니메이션 패턴(`isIn` + `requestAnimationFrame` + 220ms 언마운트), ESC 닫기
- 카드 탭 → 시트 오픈 시 자동으로 `db.scraps.touchViewed(id)` 1회 호출 (useRef 가드)
- 큰 썸네일(maxHeight 360, objectFit cover) / 썸네일 없으면 출처별 그라데이션(`t.accentLight`→`t.accent` 20%) + 큰 출처 아이콘
- 출처 + "원본 열기" 핀치 칩(target=_blank rel=noopener noreferrer) — scrap.url 있을 때만
- 제목(DM Serif Display 22) + 코멘트(Nanum Pen 18, 손글씨)

상태 세그먼트 컨트롤
- 미확인 / 다시봄 / 소화완료 — pill 그룹 형태, 활성 옵션은 `t.card` 배경 + 그림자
- 탭 시 낙관적 업데이트(`setScrap`) + `db.scraps.updateStatus` + `onChanged()` 콜백으로 그리드 상태 점 즉시 반영
- 미확인=`t.textMuted` / 다시봄=`t.accent` / 소화완료=`t.success` 점 색 (Stage 1 규칙 유지)

노트 패널 (핵심)
- 상단: textarea (Nanum Pen 16) + 초록 "글 추가" 버튼(`t.success` 배경) — 입력 비어있으면 비활성
- "글 추가" → `db.scrapNotes.create` + 상태가 'done' 이 아니면 자동으로 'done' 승격 (낙관적 + DB)
- 하단: 기존 노트들을 **날짜별 그룹화** 후 시간순 표시 (시각 `HH:mm` + `YYYY년 M월 D일 (요일)` 헤더)
- 노트 카드: bgSub 배경 + 좌측 시각 표시 + Nanum Pen 본문 + 우측 휴지통 아이콘(낙관적 삭제 + DB)
- 빈 상태: dashed 카드 "아직 쌓인 기록이 없어요"

코멘트·태그 인라인 편집
- 코멘트: "수정/추가" 버튼 → textarea (autoFocus, 200자) + 취소/저장 → `db.scraps.update({ comment })`
- 태그: 기존 칩에 X 버튼으로 개별 삭제 / "+ 태그" 입력 → Enter·콤마·blur 시 추가, 중복 무시 / 모든 변경은 `db.scraps.update({ tags })` (전체 배열 교체)

연결 버튼 (Stage 4 placeholder)
- 비전보드로 / 할일로 / 저널로 — 3-col 그리드, disabled + dashed border + opacity 0.7 + "곧 지원돼요" 안내

Realtime
- 시트 열려 있는 동안만 `useRealtimeSync('scrap_notes', refreshNotes)` — 다른 기기/탭에서 글 추가 시 즉시 노트 타임라인에 반영, 시트 언마운트 시 채널 자동 해제 (훅이 처리)
- `scrap_notes` 는 Stage 0 마이그레이션에서 이미 `supabase_realtime` publication 등록됨 → 추가 마이그레이션 0

ScrapView 연결
- `ScrapCard onClick` 부착 → `setOpenId(scrap.id)` 로 시트 오픈
- `openScrap` 은 `scraps.find(s => s.id === openId)` 로 최신 상태 사본 사용 (낙관적 업데이트 즉시 반영)
- 시트의 `onChanged` 콜백 → `refresh()` 그리드 재조회

원칙 준수
- 컴포넌트 supabase direct import 0 — 모두 db.ts 경유
- 색상 토큰만(`t.accent`/`t.accentLight`/`t.success`/`t.danger`/`t.text`/`t.textSub`/`t.textMuted`/`t.border`/`t.borderLight`/`t.bg`/`t.bgSub`/`t.card`) + withAlpha — 새 hex 0
- 폰트 추가 import 0 — 기존 DM Serif Display(제목) + Nanum Pen Script(코멘트·노트 본문) 재사용
- 모바일(390) 기준 + PC 분기 `lg:` 만 — PC 사이드바 레이아웃 무영향
- Figma 디렉터리(`src/app/components/figma/`) 미수정
- Stage 3·4 보류 항목 미구현: 먼지 쌓인 스크랩 / 셔플 / 안 본 것만 토글 / 검색 / 비전보드·할일·저널 실제 연결 / 디스코드
- `npm run build` 통과 (vite 6 production)

---

**스크랩 Stage 1 — 저장 + Realtime**

데이터/인프라
- 마이그레이션 `20260607020000_create_scrap_thumbs_bucket.sql`: Supabase Storage `scrap-thumbs` 버킷 + RLS (public read + authenticated insert/update/delete). vision-board·moment-photos·food-photos 패턴 그대로
- Edge Function `fetch-link-metadata` 배포: `{ url }` → `{ source, title, thumbnail_url, description, needsManual }`. 출처 감지 후 youtube=oEmbed(키 불필요) / web=HTML fetch + og:title/og:image/og:description 정규식 파싱(상대경로→절대경로, HTML 엔티티 디코드, 200KB cap, 브라우저 UA 위장) / instagram·threads=로그인 벽 → `needsManual:true` 즉시 반환(자동 fetch 금지). 실패해도 항상 200 graceful. verify_jwt=true

db.ts 일원화 (Stage 1 규칙: 모든 supabase 호출은 db 레이어 경유)
- `db.scraps`: `listByUser`(created_at desc) / `create` / `update`(부분 패치 + `updated_at` 자동 갱신) / `delete` / `uploadThumb`(scrap-thumbs 버킷) / `fetchLinkMetadata`(Edge Function invoke 래퍼)
- `db.scrapNotes`: Stage 2 용 시그니처만 (`listByScrap`/`create`/`delete`)
- `ScrapRow` + `toScrap` 변환기 추가

AddScrapModal (모바일 슬라이드업 + PC 중앙 카드)
- 링크 입력 → 클라이언트 측 출처 감지로 칩 즉시 표시 + '가져오기' 버튼/붙여넣기 자동 트리거 → `db.scraps.fetchLinkMetadata`
- youtube/web: 제목·썸네일 자동 채움(사용자 입력값이 비어있을 때만 → 편집 가능 유지)
- needsManual(인스타·스레드 또는 web fetch 실패): 안내 메시지 + 갤러리/카메라 스크린샷 업로드 → scrap-thumbs 버킷
- 코멘트 textarea = Nanum Pen Script(손글씨), 태그 쉼표 구분 → text[] (trim/중복/빈 항목 제거)
- 저장 시 `db.scraps.create({ url, source, title, thumbnailUrl, comment, tags })` — `status` 는 DB DEFAULT 'unread'

ScrapView 본 구현
- `db.scraps.listByUser` 로 fetch + `useRealtimeSync('scraps', refresh)` 구독 → 다른 기기/탭에서 추가/수정/삭제 시 즉시 반영, 언마운트 자동 해제
- 출처 필터 칩 5종(전체/유튜브/인스타/스레드/웹) — 활성 칩은 `t.text` 배경 + `t.card` 글씨
- CSS columns 메이슨리(모바일 2열 / lg 3열 / xl 4열) — `break-inside:avoid`, 폭 변동에 자연 적응
- `ScrapCard`: 썸네일 있으면 이미지, 없으면 출처별 그라데이션(`t.accentLight` → `t.accent` 18%) + 큰 출처 아이콘 placeholder. 좌상단 출처 칩 + 우상단 상태 점(unread=`t.textMuted`/revisit=`t.accent`/done=`t.success` — 색만, 전환 액션은 Stage 2)
- 본문: 제목(2줄 clamp) + 코멘트(Nanum Pen 손글씨, 2줄 clamp) + 태그 칩 최대 4개 + 잔여 +N
- 로딩 텍스트 + 빈 상태(전체/필터별 메시지 분기)
- 출처 lucide 아이콘: Youtube / Instagram / MessageCircle(threads) / Globe(web)
- 카드 탭 동작은 Stage 2 placeholder — onClick 미부착(`cursor:default`)

원칙 준수
- 컴포넌트에서 supabase direct import 0 — 모두 db.ts 경유
- 색상 토큰만(`t.accent`/`t.accentLight`/`t.bgSub`/`t.success`/`t.textMuted`/`t.border` 등) + withAlpha — 새 hex 0
- 모바일(390) 기준 + PC 분기 `lg:` + CSS column-count 미디어쿼리만 — PC 사이드바 레이아웃 무영향
- Figma 디렉터리(`src/app/components/figma/`) 미수정
- 폰트 추가 import 0 — 기존 DM Serif Display(제목) + Nanum Pen Script(eyebrow/코멘트) 재사용
- Stage 2 보류 항목 미구현: 카드 상세 시트, 상태 전환 액션, scrap_notes 글 기록 패널, scrap_notes Realtime 구독
- `npm run build` 통과 (vite 6 production)

---

**스크랩 / 영감 보관함 Stage 0 — 기반**
- 마이그레이션 `20260607000000_create_scraps.sql`: `scraps` (id/user_id default auth.uid()/url/source/title/thumbnail_url/comment/tags text[]/status default 'unread'/last_viewed_at/created_at/updated_at) + `scrap_notes` (1:N, scrap_id ON DELETE CASCADE). 두 테이블 모두 RLS 활성 + 본인 행만 select/insert/update/delete (vision_*·culture_records 패턴 그대로). 인덱스 `scraps(user_id, created_at desc)` / `scrap_notes(scrap_id, created_at)`. Realtime publication 등록. Supabase MCP 로 my-planner 프로젝트 적용 완료
- `store.tsx`: `Scrap` / `ScrapNote` / `ScrapSource('youtube'|'instagram'|'threads'|'web')` / `ScrapStatus('unread'|'revisit'|'done')` 타입 추가 — store 연동/Realtime 구독은 Stage 1에서
- `routes.tsx`: `/scraps` 라우트 + `ScrapView` 컴포넌트 연결 (비전보드 라우트 다음에 배치)
- 네비게이션: `Layout.tsx` 사이드바 라이프스타일 그룹 + 모바일 햄버거 시트, `LayoutC.tsx` 테마 C 상단바 모두에 "스크랩" 메뉴 항목 + `Bookmark` 아이콘 추가 (비전보드 옆 영감 계열 묶음)
- `ScrapView.tsx` 빈 셸: 헤더(eyebrow `inspiration` Nanum Pen + 제목 `스크랩` DM Serif + 서브 `영감 보관함`) + dashed border 빈 그리드 영역(추후 메이슨리 자리) + 빈 상태 메시지("아직 스크랩이 없어요") + 우하단 확장형 FAB `스크랩 추가` (Stage 1까지는 placeholder 안내 토스트). 데이터 fetch / 모달 / Realtime 구독은 모두 다음 단계
- 디자인 토큰만 사용(`t.accent`/`t.accentLight`/`t.card`/`t.bg`/`t.textSub` 등) — hex 하드코딩 0. 모바일(390px) 기준 + PC 분기는 Tailwind `lg:` 로만 (PC 사이드바 레이아웃 무영향)
- `npm run build` 통과 (vite 6 production build)

---

## 2026-06-06

### 📋 TODO
- (기간별 모드 Phase 1~5 완료)

### ✅ 완료
- [x] 레시피 모듈 모듈 D-1 — 냉장고 ↔ 레시피 매칭 헬퍼 + 레시피 목록 연결 섹션 (`지금 만들 수 있어요` ready/1개 부족 + `유통기한 임박 재료 레시피` D-2 이내)
- [x] 레시피 모듈 D-2 — RecipeDetail 재료 섹션 있음/부족 표시 + `부족한 재료 N개 장보기에 담기` (중복 방지, source_recipe_id/source_label 기록)
- [x] 레시피/냉장고 textarea PC 키보드 단축키 — Cmd/Ctrl+Enter 제출 (Enter=줄바꿈 유지)
- [x] 만다라트 Phase 1 — 데이터 모델(`mandalart_boards`/`mandalart_cells`) + `/goals` 허브 모드 스위치(만다라트/기간별) + 보드 선택·추가·이름변경·삭제 + 기본 보드 자동 시드
- [x] 만다라트 Phase 2 — 모바일 드릴다운 3×3 (중앙→세부 칸 탭으로 행동 펼침, 행동 체크 시 진행률 자동 갱신, 빈 칸 +로 추가, 롱프레스로 편집)
- [x] 만다라트 Phase 3 — PC 9×9 클래식 (가운데 블록 = 핵심+세부8, 둘레 8블록 = 각 세부의 행동8 미러링, 좌클릭 토글·우클릭 편집)
- [x] 만다라트 Phase 4 — 자유도(펼침/체크 leaf) · 빈 칸 + · 여러 보드 (강제 81칸 아님, 채운 만큼만 표시)
- [x] 만다라트 후속 버그 수정 — PC 잘림(GoalsHubView flex-1 overflow-y-auto), 새 보드 추가(window.prompt → 인라인 입력), 저장 토스트(culture useToasts 재사용), 드롭다운 폰트(DM Serif → var(--font-gowun) 16/600), 빈 칸 + 라벨("세부 추가"/"행동 추가")
- [x] 기간별 모드 Phase 1 — `todos.weekly_goal_id text NULL FK ON DELETE SET NULL` 컬럼 + partial index 추가 (별도 join 테이블 없이 한 컬럼만, ON DELETE SET NULL 로 할일 자체는 보존)
- [x] 기간별 모드 Phase 2 — PC 캐스케이드 3열(연간→월간→주간) + 정체성·핵심가치 카드 + 역추적 배지(`Layers/BarChart2` N · XX%) + `t.success` 진행 바 + 연도 ◀▶ 네비
- [x] 기간별 모드 Phase 3 — 모바일 드릴다운(연간→월간→주간) + breadcrumb 복귀 + 동일 역추적 배지 + 공용 IdentityValuesCards 추출
- [x] 기간별 모드 Phase 4 — 주간 카드 안 todos 인라인 체크리스트 + "할일 추가"(weeklyGoalId 자동 지정 + 그 주 월요일 날짜 제안) + "기존 할일 연결" 모달(검색·미연결 우선 정렬·반복 가상 인스턴스 제외)
- [x] 기간별 모드 Phase 5 — /할일·/일간 카드에 🎯 목표 배지(프로젝트 배지와 같은 줄, 길면 truncate + title 풀텍스트). 자동 롤업은 Phase 2 의 `periodProgress` + `todos` 전역 state 의존이라 추가 코드 없이 자동 — 어디서 체크해도 주간%→월간%→연간% 즉시 재렌더

### 🛠 오늘 작업 내용

**만다라트 후속 PC 버그 수정**
- PC에서 9×9 보드 하단이 잘려 보이던 문제: 데스크톱 `<main>` 이 `overflow-hidden` 이라 콘텐츠가 스크롤 없이 클립됨 → `GoalsHubView` 루트를 `flex-1 overflow-y-auto` 스크롤 컨테이너로 변경(다른 뷰와 동일 패턴). 기간별 모드도 자연스럽게 스크롤 가능
- "새 보드 추가" 버튼이 동작하지 않던 문제: `window.prompt()` 가 임베드/프리뷰 환경에서 차단됨 → 인라인 입력(이름변경과 동일 UX, Enter/체크 버튼 제출)으로 교체. 드롭다운 메뉴 + 우측 ＋ 버튼 모두 인라인 생성 진입
- 저장 시 피드백 없음: culture 페이지의 경량 토스트(`useToasts`/`ToastHost`) 재사용 → 셀 추가/저장/삭제 + 보드 추가/이름변경/삭제 시 하단에 "추가/저장/삭제되었습니다" 토스트
- 드롭다운 보드 제목 글씨체 문제: `DM Serif Display` 는 한글 미지원 → 못생긴 serif 폴백 → `var(--font-gowun)` 16px/600 으로 변경, 인라인 입력도 동일 폰트
- 빈 칸 + 버튼 의미 불명확: PC/모바일 빈 셀에 "세부 추가"/"행동 추가" 작은 라벨 추가

**기간별 모드 Phase 1 — 마이그레이션 (todos ↔ weekly_goals)**
- 마이그레이션 `20260606030000_todos_weekly_goal_link.sql`: `todos` 에 `weekly_goal_id text NULL` 컬럼 + FK `→ weekly_goals(id) ON DELETE SET NULL` (주간 목표 삭제 시 할일은 보존되고 연결만 끊김) + partial index `todos_weekly_goal_idx WHERE weekly_goal_id IS NOT NULL` (주간 카드의 "연결된 todos" 조회 최적화)
- 한 할일 = 하나의 주간 목표 정책으로 별도 join 테이블 미사용
- Supabase MCP 로 원격 DB 에 적용 완료, 기존 todos 4건 모두 `weekly_goal_id=null` 유지 → 다른 페이지 영향 0
- `store.tsx` `Todo` 인터페이스 + `db.ts` `TodoRow`/`toTodo`/`fromTodo` 에 `weeklyGoalId` 매핑 추가 (`select('*')` 사용 중이라 자동 포함)

**기간별 모드 Phase 2 — PC 캐스케이드 3열**
- PC 4탭 화면이 빈 공간이 많고 연간→월간→주간 연결을 한눈에 보기 어렵던 문제 해결 → 한 화면 캐스케이드
- 신규 `period/PeriodCascadePC.tsx`: 좌(연간 + 상단 IdentityCard/ValuesCard) → 중(선택된 연간에 연결된 월간만) → 우(선택된 월간에 연결된 주간만). 선택 카드 골드 강조(`border: 1.5px t.accent` + `bg: t.accentLight`). 연도 ◀ 2026 ▶
- 신규 `period/periodProgress.ts`: `weeklyRollup`(연결된 todos done/total, 없으면 `weeklyGoal.done` 폴백) → `monthlyRollup`(하위 주간 합산) → `annualRollup`(하위 월간 합산). Phase 4 todos 연결 즉시 자동 반영
- 카드 풋라인: `<Layers> 월간 N` / `<Layers> 주간 N` / `<BarChart2> 할일 N` + `XX%` + `t.success` 진행 바 → 모든 단계에서 부모-자식 연결 + 진행률이 즉시 보임
- 각 열 하단 추가 인풋 (월간 열은 `<input type="month">` 추가) + 빈 상태 안내("연간을 먼저 선택" 등)
- 기존 CRUD/연결 로직 보존: `addAnnualGoal`/`addMonthlyGoal`/`addWeeklyGoal`/toggle/delete/AnnualProfile 그대로 사용
- `MonthlyView.tsx`: PC 트리는 `<PeriodCascadePC/>` 만 렌더, 기존 헤더/4탭은 `hidden` 으로 보존(롤백 안전)

**기간별 모드 Phase 3 — 모바일 드릴다운**
- 신규 `period/PeriodCascadeMobile.tsx`: 단계 상태 `Level = annual | monthly | weekly` 로 한 번에 한 화면만. 월간/주간 단계 상단 breadcrumb (`← 2026년 · 연간 텍스트 · 월간 텍스트`) — 중간 단계 텍스트도 클릭으로 위로 복귀
- 각 카드 = 공용 `DrillCard`: PC 와 같은 역추적 배지/진행률, 우측 ChevronRight 로 드릴 가능 시각화, 연간/주간 카드에 좌측 체크 토글, 월간은 eyebrow 에 `yyyy-MM`. 연간 단계 상단에 IdentityCard + ValuesCard
- 신규 `period/IdentityValuesCards.tsx`: PC 내부 정의를 추출한 공용 정체성/핵심가치 카드(autosave 600ms, 최대 3 칩). PC/모바일 둘 다 이 모듈을 import 해서 행동 통일
- `MonthlyView.tsx` 모바일 트리 = `<PeriodCascadeMobile/>` 로 교체. 기존 4탭 콘텐츠 보존(hidden)

**기간별 모드 Phase 5 — 자동 롤업 + 🎯 목표 배지**
- `/할일`(`TodosView` TodoRow) 메타 영역에 프로젝트 배지 다음으로 🎯 목표 배지 추가 — `t.accentLight` 배경 + `t.accent` 글씨, 길면 `max-width: 130` truncate + `title` 속성에 풀텍스트
- `/일간`(`DailyView` TodoRow) 메타 영역도 동일하게 — 작은 글씨(`fontSize: 9`, `max-width: 110`) 로 일간 칸반 폭 보호
- `usePlanner()` destructure 에 `weeklyGoals` 추가 → `todo.weeklyGoalId` 가 있으면 `weeklyGoals.find` 로 해당 주간 목표 객체 조회 후 배지로 표시
- 자동 롤업 정밀화는 별도 코드 변경 없음 — Phase 2 `periodProgress.weeklyRollup/monthlyRollup/annualRollup` 이 todos 전역 state 의존이라, 어디서 todo 완료해도 React 트리 전체 재렌더링되며 주간%→월간%→연간% 즉시 갱신됨. backlog/cancelled todos 는 분모에서 제외하는 EFFECTIVE 필터로 명세("연결 todos 완료/전체") 정확히 충족

**기간별 모드 Phase 4 — 주간 카드 안 todos 인라인 체크리스트**
- 신규 `period/WeeklyTodosInline.tsx`: 주간 카드 하단(PC) 또는 footer(모바일 DrillCard) 에 끼움
  - 연결된 todos 를 좌측 ○/✓ + 제목 truncate + 짧은 날짜(MM-dd) + × 로 인라인 표시. 좌측 ○/✓ 클릭 = `updateTodo({status})` (기존 레코드 그대로 → `/할일`·`/일간`·`/주간`·`/캘린더` 모두 동일 항목 동기화). 행 탭 = `TodoModal` 편집 진입
  - "할일 추가" → `TodoModal` 진입 시 `initialWeeklyGoalId` 자동 지정 + 그 주 **월요일** 을 `date` 기본값으로 제안(`weekKeyToMonday` ISO 주 → 월요일 변환)
  - "기존 할일 연결" → 별도 모달 `LinkExistingTodoModal`: 검색 + 미연결 우선 정렬 + 다른 주간에 이미 연결된 항목에는 "연결됨" 칩. 가상 반복 인스턴스(`'__'` 포함 id) 제외. 선택 시 `updateTodo({weeklyGoalId})`
  - × 클릭 = `updateTodo({weeklyGoalId: undefined})` → DB null (`fromTodo` 매핑이 `?? null` 처리), 할일 자체는 보존
- `TodoModal.tsx`: `initialWeeklyGoalId` prop 추가, `buildChanges` 에서 `weeklyGoalId: todo?.weeklyGoalId ?? initialWeeklyGoalId ?? undefined` 로 자동 적용(편집 시 기존값 보존). UI 변경 0
- `DrillCard` 에 `footer?: React.ReactNode` prop 추가

**원칙 준수**
- 새 색상 값 하드코딩 0 — `t.accent / t.accentLight / t.accentSoft / t.success / t.bgSub / t.borderLight / t.card / t.sidebar` 등 기존 토큰만 사용
- 폰트 추가 import 0 — 기존 `fonts.css` 의 DM Serif Display·Nanum Pen·Gaegu·Gowun 그대로 활용
- 다른 페이지 무영향 — 만다라트·`/할일`·`/일간`·`/캘린더`·`/주간` 등 기존 동작/스키마 변경 없음 (Todo 옵셔널 필드 1개 추가뿐)
- Figma 디렉터리(`src/app/components/figma/`) 미수정
- `MonthlyView` 기존 4탭 컴포넌트(`AnnualGoalsContent`/`QuarterlyGoalsContent`/`MonthlyGoalsContent`/`WeeklyGoalsSection`) 는 정의 보존 — `WeeklyGoalsSection` 은 다른 페이지에서도 import 사용 중
- 모든 Phase 후 `npm run build` 통과, main 에 직접 푸시(사용자 명시 허가)

**레시피 모듈 D-1 — 냉장고 ↔ 레시피 매칭 + 목록 연결 섹션**
- 신규 `src/app/components/recipe/fridgeMatch.ts`: 정규화(공백/대소문자 무시) + 양방향 부분일치 + 동의어 그룹(면↔파스타·국수·스파게티, 계란↔달걀, 돼지↔돼지고기·삼겹살 등)으로 표기 차이('계란' vs '계란 12') 흡수
- 공개 API: `classifyCookable(recipes, fridge)` — 주재료가 냉장고에 모두 있는 `ready` / 1개 부족인 `oneMissing` 분리. `findUrgentRecipes(recipes, fridge)` — D-2 이내 fridge 품목이 매칭되는 레시피 + 가장 임박한 품목 + 남은 일수. `evaluateIngredients(recipe, fridge)` — 재료 단위 가용성(D-2 RecipeDetail용)
- `RecipeListTab`에 두 섹션(`CookableSection`/`UrgentRecipesSection`) 추가 — 셔플/먼지 위. 카드에 `matchBadge` 추가 (`✓ 재료 있음` accentLight / `1개 부족: X` bgSub / `D-1 두부` dangerLight) — 색상은 글로벌 토큰만 사용
- `db.fridgeItems.fetchAll()` 로딩 + `useRealtimeSync('fridge_items')` 로 냉장고 변경 시 매칭 자동 재계산
- 주재료(mainIngredients)가 비어 있는 레시피는 `지금 만들 수 있어요`에서 제외(신호 없음). 임박 fridge 품목 0개면 임박 섹션 자체 숨김

**레시피 모듈 D-2 — 부족 재료 표시 + 장보기 자동 담기**
- `RecipeDetail` 재료 섹션 각 행에 `있음` / `부족` 칩 표시 (`evaluateIngredients` 기반, 글로벌 토큰)
- 섹션 하단에 `부족한 재료 N개 장보기에 담기` 버튼 — `t.accent` accentLight 톤. 정규화 비교로 `shopping_items` 미체크 중 같은 이름은 제외, 모두 이미 있으면 버튼 비활성 + `부족 재료가 이미 장보기에 있어요` 라벨
- 담길 때 `source_recipe_id=레시피.id`, `source_label=레시피 제목`. 수량은 재료의 amount(있을 때) 또는 1
- `fridge_items` / `shopping_items` 양쪽 `useRealtimeSync` 구독 — 다른 기기/탭에서 냉장고를 채우면 자동 갱신, 장보기 중복 방지도 실시간 반영
- 토스트로 추가 개수 피드백, 모바일/PC 레이아웃 영향 없음(기존 섹션 구조 재사용). RLS는 Phase 2a 정책(소유자만) 그대로 — 마이그레이션 추가 없음

**레시피/냉장고 textarea PC 키보드 단축키**
- FridgeTab 빠른 입력 textarea, RecipeFormSheet 붙여넣기/재료/요리순서 textarea에 `Cmd/Ctrl+Enter` → 제출(확인하기 / form.requestSubmit) 추가
- Enter 단독은 줄바꿈 유지 → 다중 줄 입력 도중 의도치 않은 제출 방지
- 단일행 input은 기존 `<form onSubmit>` 구조라 브라우저 기본 동작으로 Enter 제출이 이미 작동 — 추가 작업 없음. metaKey/ctrlKey 조건이라 모바일 영향 없음

**원칙 준수 (D-1·D-2)**
- 색상 하드코딩 0 — `t.accent / t.accentLight / t.danger / t.dangerLight / t.bgSub / t.border / t.textMuted` 등 글로벌 토큰만 사용
- 모바일 카드 grid(`grid-cols-2`) / PC grid(`lg:grid-cols-4`) 기존 패턴 재사용 → 다른 페이지 PC 레이아웃 무영향
- Realtime 필수 원칙 준수 — fridge/shopping 양쪽 구독, PC↔모바일 즉시 반영
- `npm run build` 통과(각 단계 별 검증)

**만다라트 Phase 1 — 데이터 모델 + /goals 허브 모드**
- 마이그레이션 `20260606020000_create_mandalart.sql`: `mandalart_boards`(id/user_id/title/sort_order, RLS) + `mandalart_cells`(id/board_id/parent_id/position 0~7/content/is_done, 보드 소유권 EXISTS RLS, `(board_id, parent_id, position)` 유니크 인덱스, ON DELETE CASCADE). 두 테이블 모두 `supabase_realtime` publication 등록 → Supabase MCP로 원격 DB에 적용 완료
- `db.ts` `mandalartBoards` 레이어: `fetchAll`(빈 결과면 "나의 만다라트" 자동 시드)/`ensureSeed`(race 방어)/`create`/`rename`/`delete`. `mandalartCells` 레이어: `fetchByBoard`/`upsert`(같은 board+parent+position 있으면 update, 없으면 insert)/`update`/`delete`
- 신규 `GoalsHubView.tsx`: `/goals` 상위 래퍼 — eyebrow "structure your dream"(Nanum Pen Script) + 제목 "목표"(DM Serif Display) + 모드 탭 [만다라트 / 기간별]. "기간별" 선택 시 기존 `MonthlyView`(연간/분기/월간/주간 4탭)를 그대로 렌더 — 로직·DOM 미변경
- 신규 `mandalart/MandalartView.tsx`: 보드 드롭다운(DM Serif Display) + ✎ 이름변경(인라인 input) + ＋ 새 보드(window.prompt) + 🗑 보드 삭제(ConfirmModal). `useRealtimeSync('mandalart_boards' / 'mandalart_cells')` 로 PC↔모바일 즉시 반영
- 진행률 유틸 `computeProgress(cells)`: 전체(행동 완료/행동 전체)·세부별 %·행동 보유 여부. Phase 2~3 양쪽에서 공용
- `routes.tsx`: `/goals` → `MonthlyView` 를 → `GoalsHubView` 로 교체 (`MonthlyView` import 제거; `GoalsHubView` 내부에서 import해 그대로 사용)

**만다라트 Phase 2 — 모바일 드릴다운 3×3**
- 신규 `mandalart/MandalartBoardMobile.tsx`: 중앙 보기 = 핵심 헤더 카드(전체% 바 + Gaegu 핵심 제목 + `t.success` 채움) + 9칸 grid(중앙=핵심 coral 칸 `t.accent`, 둘레=세부 8 — 이름+미니바+▸ 또는 빈 점선 +)
- 세부 칸 탭 → drillSubId 세팅, 그 세부의 3×3 렌더(중앙=`t.accentLight` 세부+%, 둘레=행동 체크 칸). 상단 breadcrumb "← 핵심"으로 복귀
- 행동 칸 탭 → `db.mandalartCells.update isDone` 토글, 즉시 재조회(낙관적/Realtime 양쪽). 빈 칸 탭 → 편집 모달로 신규 셀 `upsert`
- 채워진 칸 500ms 롱프레스(touchstart 타이머) 또는 우클릭(contextmenu) → 편집 모달. 내용을 비워 저장 = 셀 삭제(자식 행동 CASCADE). 핵심 헤더/중앙 코어 탭 = 보드 title 편집
- 셀 텍스트 `line-clamp:2` + `word-break` + `min-width:0` + `aspect-square` → 어떤 폭에서도 칸 넘침 없음. PC는 `hidden lg:block` placeholder 유지

**만다라트 Phase 3 — PC 9×9 클래식**
- 신규 `mandalart/MandalartBoardPC.tsx`: 외곽 grid `repeat(3,1fr) gap 12px` ⊃ 각 블록 `padding 5px + radius 12 + bg t.bgSub`(가운데 블록은 `t.accentLight` + accent 글로우) ⊃ 내부 grid `repeat(3,1fr) gap 4px` ⊃ 셀 `aspect-ratio 1 + radius 9`. 블록 gap > 셀 gap, 보드 컨테이너 `max-width: 780px` 중앙 정렬
- 가운데 블록(br=1,bc=1): 중앙=핵심(`t.accent` coral + 전체%) / 둘레 8=세부 8(`t.accentSoft` + 이름 + 미니바). 둘레 8블록은 미러링 — 각 블록 중앙=`subc`(세부 이름 + 세부%) / 둘레 8=행동 체크 칸
- 행동 좌클릭 = is_done 토글, 우클릭 = 텍스트 편집 모달. 핵심/세부 칸 클릭 = 텍스트 편집. 빈 칸 = 점선 + → 클릭 시 생성. **세부가 비어 있는 둘레 블록**은 비활성 placeholder(`opacity 0.4`, dashed) — Phase 4 자유도(펼친 세부만 활성)의 토대
- 모든 셀 `min-width:0` + `line-clamp:2` + `word-break:break-word` → 어떤 폭에서도 셀 간 겹침 없고 긴 텍스트는 ··· 말줄임. 음수 마진/절대 배치 사용 안 함
- 상단 우측 전체 진행률 바 + DM Serif `XX%`

**만다라트 Phase 4 — 자유도(펼침) + 빈 칸 + 여러 보드**
- `computeProgress(cells)` 확장: leaf 세부(자식 행동 0)는 `(is_done ? 1 : 0, 1)` 단위로 전체 진행률·세부% 에 포함. 행동 있는 세부는 그대로 자식 비율. `subHasActions(subId)` 가 leaf/펼침 판단의 단일 진실
- 모바일(`MandalartBoardMobile`):
  - 중앙 보기 SubCell이 leaf인 경우 행동 셀과 유사하게 체크 동그라미(`t.success`) + 이름. 메인 탭 = `is_done` 토글(낙관적). 우하단 작은 "+ 펼치기" 칩(`t.accentLight`) 탭 = drill 진입(첫 행동 + 로 생성 가능)
  - 행동 1+ 세부는 기존대로 미니바 + ▸ + 탭=drill
  - 안내 텍스트 갱신: "세부 칸을 탭하면 체크 / 행동이 있으면 펼쳐져요 · 길게 눌러 편집"
- PC(`MandalartBoardPC`):
  - 둘레 블록 분기 재정의: 세부 없음·세부 leaf 두 경우 모두 **단일 "+" 큰 버튼 블록**(점선 dashed, aspect-square)으로 표시 — 펼친 세부만 둘레 9칸 블록으로 확장 → 자유도 충족. 세부 leaf 버튼 라벨 = "{세부명} 펼치기"(클릭 시 첫 행동 셀 생성 모달), 세부 없음 = "세부 추가"(세부 셀 생성 모달)
  - 가운데 블록 SubPCCell이 leaf인 경우 미니바 자리에 작은 체크 동그라미 표시, 좌클릭 = `is_done` 토글, 우클릭 = 텍스트 편집. 행동 있는 세부는 기존대로 좌클릭 = 편집
  - 안내 텍스트 갱신: "가운데 9칸 = 핵심 + 세부 8 · 펼친 세부만 둘레 판으로 확장 · 빈 둘레 판의 + 를 눌러 펼치기"
- 여러 보드: Phase 1 의 보드 드롭다운 + 추가/이름변경/삭제 + 자동 시드가 그대로 작동 (별도 변경 없음)
- 빈 칸 + 는 Phase 2·3 부터 이미 지원됨 — Phase 4 는 leaf 인식과 둘레 블록 자유도(펼친 세부만 활성)를 더한 것

**원칙 준수**
- 새 색상 값 하드코딩 0 — `t.accent / t.accentLight / t.accentSoft / t.success / t.bgSub / t.borderLight / t.danger` 등 기존 토큰만 사용
- 폰트는 기존 `fonts.css`의 DM Serif Display·Nanum Pen Script·Gaegu CDN import 그대로 활용 (추가 import 없음)
- Figma 디렉터리(`src/app/components/figma/`) 미수정 — `/goals`(`MonthlyView.tsx`)는 일반 컴포넌트로 확인됨
- "기간별" 탭(연간·분기·월간·주간) 및 다른 페이지 영향 0 — `GoalsHubView` 내부에서 기존 `MonthlyView` 컴포넌트를 그대로 렌더
- 모바일·PC 트리는 `lg:hidden` / `hidden lg:block` 으로 완전 분리
- `npm run build` 통과(각 Phase 별로 검증)

---

## 2026-06-05

### 📋 TODO
- [ ] 모먼트 모바일 UI Phase 3 — 누적 카운트("이번 달 N개 · 올해 M개")
- [ ] 레시피 Phase 1b — 레시피 상세(히어로/별점/인분 환산/메모/요리 시작)
- [ ] 레시피 Phase 1c — 공용 타이머(별도 실행 + 단계 연동) + 릴스형 요리 뷰
- [ ] 레시피 Phase 2b — 빠른 입력(텍스트 + 음성 webkitSpeechRecognition)
- [ ] 레시피 Phase 2c — 장보기 페이지(체크 → 냉장고 이동, 직접 추가)

### ✅ 완료
- [x] 모먼트 모바일 UI Phase 1 — 컴팩트 가로 카드 + 탭하면 펼침
- [x] 모먼트 모바일 UI Phase 2 — 피드 ↔ 모아보기 세그먼트 토글 + 월별 3열 사진 그리드
- [x] 레시피 모듈 Phase 1a — 데이터 + 목록/입력 (`recipes`/`recipe_ingredients`/`recipe_steps` 3개 테이블, 소유자 RLS, Realtime, `/recipes` 목록 페이지 + 직접입력 추가/수정 시트)
- [x] 레시피 모듈 Phase 2a — 냉장고 + 모듈 내부 하단 탭 네비(`fridge_items`/`shopping_items` 테이블, RLS, Realtime, 레시피/냉장고/장보기 탭 도입, 냉장고 요약·카테고리 섹션·D-day·수량 스테퍼)

### 🛠 오늘 작업 내용

**모먼트 페이지 모바일 UI 리디자인 — Phase 1 (컴팩트 카드 + 탭 펼침)**
- 디자인 시스템에 손글씨 폰트 토큰 추가: `src/styles/fonts.css`에 Google Fonts `Gaegu` import + `--font-gaegu`(미로드 시 `--font-gowun` 폴백). 색/팔레트는 미변경
- `MomentView.tsx` 모먼트 목록을 PC/모바일 트리로 분리
  - PC: 기존 큰 세로 카드 그대로 `hidden lg:block`으로 보존 → PC 레이아웃 무변경
  - 모바일(`lg:hidden`): 신규 `MomentCardMobile` — 왼쪽 64px 정사각 썸네일(radius 11, 사진 없으면 `bgSub`+📝), 오른쪽 제목(Gaegu, 1줄 truncate)+메타(날씨 칩+날짜·시간), 끝에 ▸ chevron
  - 탭 시 해당 카드만 펼침: 썸네일이 가로 full(`aspect 1.25`)로 확대, 제목/메타 아래로, 삭제 버튼 노출, chevron 90° 회전. 다시 탭하면 접힘
  - 기본 전부 접힘, 펼침 상태는 `Set<id>`로 독립 토글, 썸네일 크기 전환 `0.3s ease`
- 데이터 흐름·Supabase 스키마·상단 입력 박스 모두 유지(렌더링만 교체), `npm run build` 통과

**모먼트 페이지 모바일 UI Phase 2 — 피드 ↔ 모아보기 세그먼트 토글**
- (origin/main에서 머지된 작업) 모먼트 모바일 상단에 피드 ↔ 모아보기 세그먼트 토글 + 월별 3열 사진 그리드 추가

**① 레시피 모듈 Phase 1a — 데이터 + 목록/입력**
- 마이그레이션 `20260604000000_create_recipes.sql`: `recipes`(user_id DEFAULT auth.uid, base_servings·rating·thumbnail_url·source_type 등) + `recipe_ingredients`(name/amount/unit/sort_order, ON DELETE CASCADE) + `recipe_steps`(step_no/instruction/timer_seconds, ON DELETE CASCADE). RLS는 본인 소유; 자식 테이블은 소속 recipe 소유권(EXISTS) 기반. 3개 테이블 모두 `supabase_realtime` publication 등록
- `store.tsx`: `Recipe`/`RecipeIngredient`/`RecipeStep` 타입 정의(전역 state엔 미보유, self-contained + `useRealtimeSync` 패턴 — culture_records와 동일)
- `db.ts` `recipes` 레이어: 중첩 select(`recipe_ingredients(*), recipe_steps(*)`)로 `fetchAll`, `upsert`는 본체 upsert + 자식 전량 교체(delete-then-insert), `updateRating`/`updateMemo`/`delete`
- nav 진입점 "레시피"(`ChefHat`): `Layout.tsx`(사이드바·모바일 메뉴)·`LayoutC.tsx`(테마 C 탑네비) 추가, `routes.tsx` `/recipes` 라우트 추가
- `RecipeView` 목록 페이지: "저장한 레시피" 카드 그리드(2열/lg:4열), 검색, 우하단 골드 FAB, 빈 상태 UI, 카드는 썸네일(없으면 ChefHat placeholder)+조리시간 배지+별점+재료/단계 수
- `RecipeFormSheet` 추가/수정 시트: 모바일 full-screen 슬라이드업 / PC 센터 모달(culture 패턴). 이름·기준 인분 스테퍼·조리시간·재료(한 줄에 하나, "이름 수량 단위" 자동 파싱)·단계별 선택 타이머(분)·출처 링크·썸네일 URL
- `recipeUtils`: `parseIngredientLine`(끝의 수량+단위 추출)·`parseQuantity`(분수/소수 지원)·`formatScaledAmount`(인분 환산)·`formatTimerLabel`·`formatDurationKo`

**② 레시피 모듈 Phase 2a — 냉장고 + 모듈 하단 탭 네비**
- 마이그레이션 `20260605000000_create_fridge_shopping.sql`: `fridge_items`(category check '냉장'/'냉동'/'실온', quantity numeric, expiry_date date) + `shopping_items`(`source_recipe_id` → recipes, ON DELETE SET NULL — Phase 3 대비 컬럼만 미리 둠, `is_checked` boolean). 소유자 RLS, 두 테이블 모두 Realtime publication 등록
- `store.tsx`: `FridgeItem`/`FridgeCategory`/`ShoppingItem` 타입 추가
- `db.ts` `fridgeItems` 레이어: `fetchAll`/`upsert`/`insertMany`(2b 빠른 입력 대비)/`updateQuantity`(낙관적 업데이트용)/`delete`. `shoppingItems` 레이어: `fetchAll`(체크 안 됨 → 체크됨 순)·`upsert`·`setChecked`·`delete`
- `RecipeView`를 모듈 셸로 재구성: 내부 탭 **레시피 / 냉장고 / 장보기**(라우트 변경 없이 상태로 전환). Phase 1 목록은 `recipe/RecipeListTab.tsx`로 분리. 모듈 sticky 헤더에 활성 탭 아이콘·제목 표시
- 모바일 하단 탭바: `lg:hidden fixed`, **글로벌 5탭 네비(56px) 바로 위**(`bottom:56px`), 높이 54px. 스크롤 padding-bottom과 FAB `bottom`을 124px+safe-area로 통일해 가림 방지. PC는 헤더 우측 **세그먼트 컨트롤**로 전환
- `FridgeTab`: 상단 요약(전체/임박 D-2 이내/다 떨어짐 — 위험 토큰 강조), 카테고리 섹션(냉장·냉동·실온, 섹션 내 유통기한 빠른 순; 기한 없는 건 뒤로), 행별 D-day(클라이언트 자정 기준 일수 계산, `D-day`/`D-n`/`D+n`)·수량 +/− 스테퍼(낙관적 업데이트). D-2 이내 강조 배경·테두리, 수량 0은 dim+취소선+"다 떨어짐"
- `FridgeItemSheet` 직접 추가/수정 시트: 이름·카테고리 3택·수량 스테퍼·단위·유통기한(date)
- `ShoppingTab`은 2c 전까지 "곧 추가됩니다" 플레이스홀더

**원칙 준수**
- 모든 색은 기존 디자인 토큰(`t.*`)만 사용 — 하드코딩 색 없음
- PC 레이아웃 영향 0: 모듈 내부 탭바·FAB 위치값은 모두 `@media (min-width:1024px)`에서 재설정, 모듈 외 페이지 미변경
- Figma 디렉터리(`src/app/components/figma/`) 미수정
- `npm run build` 통과 (1a·2a 각각)

---

## 2026-06-03

### 📋 TODO
- [ ] (향후) 문화 기록 통계/대시보드 + Claude API 인사이트(별점 4+ 하이라이트, 주간/월간 통계)
- [ ] 로컬 `.env` 에 `VITE_TMDB_API_TOKEN` 추가 (Vercel엔 이미 등록, 로컬 개발 시 필요)
- [ ] (선택) 캘린더 `CalendarView.tsx` 미사용 `WeekView` 함수(약 350줄)·미사용 상수 3개 제거

### ✅ 완료
- [x] 문화 기록 Stage 4 — 저녁 Discord 리포트(daily-report)에 "오늘의 문화 기록" 섹션 추가
- [x] daily-report Edge Function 배포(v6) + pg_net 수동호출로 0/2/9 케이스 실제 Discord 검증(모두 200)
- [x] 문화 기록 리포트 섹션 항목 간 세로 여백 확대(헤더 아래 1줄·항목 사이 2줄)
- [x] `DAILY_REPORT_SCHEMA.md` 신규 작성 (저녁 리포트 전체 명세 + 문화 섹션)
- [x] 문화 기록 페이지(`/culture`) 신규 추가 — Stage 1 PC 레이아웃
- [x] `culture_records` 테이블 마이그레이션 작성 + Supabase(my-planner) 적용
- [x] `culture_records` 에 `external_source`/`external_id` 컬럼 추가 (Stage 2 TMDB/유튜브 자동검색 대비, Stage 1=manual)
- [x] 문화 기록 Stage 2 — YouTube oEmbed 자동 채움 + TMDB 검색 통합 + 카드 빠른 상태 변경
- [x] 문화 기록 Stage 3 — 모바일 전용 레이아웃(sticky 헤더·3열 그리드·필터 시트·full-screen 모달·FAB)
- [x] 사이드바/모바일 오버레이/탑네비에 "문화 기록" 메뉴 추가
- [x] 캘린더 주별 Today 버튼 동작 안 함 수정 (모바일 3일 탭이 오늘 페이지로 이동)
- [x] 캘린더 월별 뷰 모바일 좌우 스와이프로 이전/다음 달 전환 추가
- [x] 캘린더 주별 타임라인 좌우 스와이프 시 화면 바운스(고무줄 오버스크롤) 제거
- [x] 새벽 수면(시작 시각 이전, 예 00:30~07:27)이 타임라인에서 잘리던 버그 수정 (주별·일간 공용 유틸)
- [x] 캘린더 월별 하단 패널: 습관이 날짜 무관하게 항상 떠 빈 메시지가 안 뜨던 버그 수정 (그날 완료 습관만 표시)
- [x] 수면 블록을 타임라인 설정에 맞춰 두 날짜 컬럼에 걸쳐 표시 (절대 시간축 기준 컬럼 분할로 전환)

### 🛠 오늘 작업 내용

**② 아침 어젠다 morning-report Edge Function 신규 생성**
- `supabase/functions/morning-report/index.ts` + `README.md` 신규 (daily-report 미변경, 프론트/마이그레이션 미변경, 의존성 추가 없음)
- 저녁(회고)과 분리된 어젠다 톤 + **별도 웹훅 `DISCORD_MORNING_WEBHOOK_URL`**(없으면 500)
- 섹션: 헤더(☀️ 좋은 아침이에요) → 오늘 일정(events) → 오늘 할일(todos, top3 우선·done ✔️/그외 □) → 오늘 체크할 습관(habits, 오늘 요일 해당분) → 마무리(오늘도 화이팅 ✨), 섹션 사이 빈 줄 1개
- 헬퍼(kstNowInfo/isHabitApplicableOnDow/WEEKDAY_KR/kstTomorrow)·events 처리(KST 벽시계 text 범위)·전체/섹션별 try/catch는 daily-report 패턴 그대로
- README: Discord 새 채널·웹훅, secrets 등록, 배포, curl, pg_cron(KST 07:30=`30 22 * * *`, job 'morning-report'), 확인/삭제 SQL
- 미배포 상태 — 사용자가 시크릿 등록 + `supabase functions deploy morning-report` + cron 등록 필요

**①-5 Stage 4 배포·검증 + 리포트 여백 조정**
- Supabase MCP `deploy_edge_function`으로 `daily-report` 배포(v5→v6, verify_jwt 유지)
- 컨테이너 egress가 `*.supabase.co` 차단(`host_not_allowed`) → cron과 동일한 **서버사이드 `pg_net`(`net.http_post`)**으로 함수 호출
- 0개/2개/9개 케이스 전송 → `net._http_response` 모두 **200 ok**, Discord 정상 수신 확인(8개+`외 N개`, 80자 `…` 발췌, watchlist 별점 생략)
- 테스트 데이터는 `tags @> '{stage4-test}'`로만 삽입/삭제 → 실데이터 무영향, 검증 후 전량 정리(오늘 KST 0건 복구)
- 피드백 반영: 문화 섹션 항목 간 간격이 빽빽 → 헤더 아래 1줄·항목 사이 2줄로 여백 확대 후 재배포·재검증

**①-4 문화 기록 Stage 4 — 저녁 Discord 리포트 연동 (백엔드)**
- 분석: Edge Function은 `daily-report` **단일** 함수. 아침/저녁 별도 함수 없음 — 저녁 cron `daily-report-evening`(`59 14 * * *` UTC = 23:59 KST)이 이 함수를 호출(아침 cron은 README 주석 처리). plain text 1 메시지, 섹션별 try/catch, 빈 상태는 "기록 없음" 표시(섹션 생략 X)
- `supabase/functions/daily-report/index.ts`: `fetchCultureRows` + `formatCultureSection` + 매핑 상수 추가
  - `culture_records.created_at`(UTC timestamptz)을 KST 하루 경계(`+09:00`→`toISOString()`)로 범위 조회, `created_at ASC`, 상태 필터 없음
  - 상태 아이콘(🔖▶️✅❌)·플랫폼 한글·별점(completed/dropped만 `⭐ N.N`)·리뷰💬/인사이트💡 발췌(80자 `…`)
  - 최대 8개 + `… 외 N개 더`, 1900자 초과 시 발췌 80→40→0 단계 축소(`compose(limit)`)
  - **독서 다음**에 배치(둘 다 "오늘 인풋된 콘텐츠"), 응원 문구 앞. Promise.all에 합류(에러 격리)
  - 빈 상태: `🎬 오늘의 문화 기록 — 오늘은 기록된 문화 활동이 없습니다`
- `DAILY_REPORT_SCHEMA.md`(신규): 리포트 전체 명세 + 문화 섹션(쿼리/포맷/매핑/길이규칙/빈상태/예시/배포)
- **아침 리포트 미수정**(별도 함수 없음), 프론트엔드 무변경. ⚠️ 운영 반영은 `supabase functions deploy daily-report` 필요(미배포)

**①-3 문화 기록 Stage 3 — 모바일 레이아웃 (lg: 미만 전용, PC 무변경)**
- 구조: `CultureRecordView`를 PC 트리(`hidden lg:block`) / 모바일 트리(`lg:hidden`)로 분리 → 상태·핸들러는 부모 공유, PC 마크업은 그대로 보존
- 모바일 sticky 헤더: 제목+검색 토글(헤더 자리 input 펼침/취소), 상태 가로 스크롤 탭, 필터 트리거(플랫폼·유형/정렬)
- 본문: 3열 포스터 그리드 + 로딩 스켈레톤(`SkeletonGrid`) + 빈 상태
- `CultureCardMobile`: hover/드롭다운 없이 아이콘만, 탭 → 수정 모달
- `culture/CultureFilterSheet.tsx`(신규): 필터 bottom sheet — 드래그 핸들, 플랫폼/유형/정렬 섹션, 초기화/적용(임시 상태→적용 커밋), safe-area
- `CultureFormModal`: 컨테이너 반응형(모바일 full-screen 슬라이드업/PC 센터), 헤더 모바일 ←·저장(form 제출)·PC 제목·X, 상단 빠른 상태칩(`lg:hidden`, 수정 모드 즉시 DB 반영) + 기존 인폼 상태 섹션 `hidden lg:block`, 하단 버튼 반응형(모바일 삭제만), `max-lg` 키프레임 슬라이드업, safe-area
- `TMDBSearchPanel`: 결과를 PC 3열 그리드(`hidden lg:grid`) + 모바일 1열 리스트(`lg:hidden`)로 분기
- `cultureMeta.ts`: 공용 `CultureSortKey`/`SORT_LABELS` 분리(뷰·시트 공유)
- 골드 FAB: `fixed` 우하단, `bottom: calc(72px + safe-area)`, 하단 탭바 위, 탭 → 추가
- 진입점(햄버거 메뉴 "문화 기록")은 Stage 1에서 이미 추가됨 → 변경 없음
- 확인: 수정 파일 모두 `lg:` 이상 영역 변경 없음(PC 트리는 `hidden lg:block`으로 감싸기만, 기존 마크업·클래스 보존)

**①-2 문화 기록 Stage 2 — 자동 fetch + 상태 관리 강화**
- `src/lib/youtube.ts`: `extractYouTubeVideoId`(watch/youtu.be/shorts/embed) + `fetchYouTubeMetadata`(oEmbed, 키 불필요)
- `src/lib/tmdb.ts`: `searchTMDB`(`/search/multi` ko-KR, Bearer `VITE_TMDB_API_TOKEN`, movie/tv 필터) + `getPosterUrl` + `hasTMDBToken`
- `culture/TMDBSearchPanel.tsx`: 모달 상단 "🎬 TMDB에서 검색" 토글, 300ms debounce, 포스터 결과 그리드, 토큰 없음/401/네트워크 오류 안내
- `CultureFormModal.tsx`: URL onBlur/onPaste → YouTube 자동 채움(제목·썸네일은 비어있을 때만, platform/유형/external는 갱신), TMDB 선택 시 채움(platform 제외), 로딩 스피너, `external_source`/`external_id` 저장
- `CultureRecordView.tsx`: 카드 hover chevron → 상태 빠른 변경 드롭다운(optimistic update + 실패 롤백), 카드 클릭과 `stopPropagation` 분리. `CultureCard` `<button>`→`<div role=button>` (중첩 버튼 방지)
- `culture/CultureToast.tsx`: 페이지 자체 호스팅 경량 토스트(전역 인프라 미사용)
- `db.ts`: `cultureRecords.updateStatus(id,status)` 추가(성공여부 반환), fetch/upsert에 external 매핑(미지정 시 'manual')
- 원칙: 자동 채움은 편의 기능 — 모든 필드 수정 가능, `external_source`는 마지막 자동 채움 출처 기록
- 비고: 로컬 `.env` 없음 → TMDB는 토큰 추가 전까지 패널 비활성(YouTube·수동 입력은 정상)

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

**⑥ 월별 하단 패널 빈 상태 버그 수정 (`CalendarView.tsx`)**
- 증상: 월별에서 날짜를 클릭해 할일/일정이 없어도 "표시할 기록이 없어요" 문구가 안 뜨고, 날짜를 바꿔도 패널이 안 바뀌는 것처럼 보임
- 원인: `panelHabits = panelDate ? habits : []` 로 **모든 습관을 날짜 무관하게 항상** 표시 →
  `hasPanelContent` 가 습관 때문에 항상 true → 빈 메시지가 절대 안 뜨고, 매일 같은 습관 목록이 떠 "안 바뀜"처럼 보임
- 수정: `habits.filter(h => h.checkedDates.includes(panelDate))` 로 **그날 완료한 습관만** 표시
  (월별 달력 셀과 동일 기준) → 빈 날짜에서 빈 메시지 정상 노출, 날짜별로 패널 갱신

**⑦ 수면 블록 타임라인 컬럼 분할로 전환 (⑤ 보완, `src/lib/sleepTimeline.ts`)**
- 요구: 시작 04:00/종료 02:00(다음날) 설정에서 00:30~07:27 수면은 6/1 컬럼(00:30~02:00)과
  6/2 컬럼(04:00~07:27)에 **걸쳐** 표시되어야 함 (⑤는 한 컬럼 안에서만 위/아래 분할이었음)
- 변경: `placeSleepSegment`(컬럼 내 분할) → `sleepRectsForColumn(columnDate, records, startHour, endHour)`
  로 교체. 전날/당일/다음날 기록을 **절대 시간축**으로 환산해 각 날짜 컬럼 윈도우 `[startHour, endHour]`
  와 교차하는 부분만 그림(자정 넘김 endHour+1440, 02:00~04:00 갭은 컬럼 사이에서 자연 제외)
- 적용: `WeekViewMobile`(3일·일별)·`WeekViewPC`·`DailyView` 모두 동일 유틸 사용. 기존 per-day
  midnight-split/prev-day-spill 로직 제거(유틸로 통합)
- `DailyView` 드래그: 취침 시작(isStart) 포함 조각만 이동/리사이즈, 다음날 이어지는 조각은 표시 전용(탭=편집).
  드래그 origin은 컬럼 자정 기준 naturalStart/End → 기존 모듈로 저장 로직과 호환
- 타임라인 시간대를 바꿔도 그 설정에 맞게 자동 분할(기본 0~24도 무회귀 확인)

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
