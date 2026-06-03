# PROJECT_SPEC.md — My Planner PWA 기능 명세서

> 최종 업데이트: 2026-06-03 (문화 기록 Stage 4: 저녁 daily-report Discord 리포트에 "오늘의 문화 기록" 섹션 추가 — 독서 다음, 상태 아이콘·플랫폼 한글·별점(completed/dropped)·리뷰/인사이트 발췌(80자·최대 8개·1900자 방어), KST 경계 UTC 변환 조회, 빈 상태 섹션 유지. 명세는 `DAILY_REPORT_SCHEMA.md`. 이하 Stage 3 모바일 레이아웃: 햄버거 진입(기존), sticky 헤더(검색 토글·상태 가로탭·필터 트리거), 3열 포스터 그리드, 필터 bottom sheet(플랫폼/유형/정렬), full-screen 슬라이드업 추가/수정 모달(헤더 ←·저장, 상단 빠른 상태칩 즉시반영, TMDB 1열 리스트), 골드 FAB(safe-area), 로딩 스켈레톤 — 모두 `lg:` 미만 전용, PC 미변경. 이하 Stage 2: YouTube oEmbed 자동 채움(제목·썸네일·플랫폼/유형), TMDB 영화·드라마 검색 통합(`VITE_TMDB_API_TOKEN`), 카드 hover 상태 빠른 변경(optimistic+롤백+토스트), `external_source`/`external_id` 기록. 이하 2026-06-02: 문화 기록 페이지 `/culture` 신규 추가 — Stage 1 PC 레이아웃: 영화/드라마/예능/유튜브 등 시청 콘텐츠 기록. culture_records 테이블·RLS·Realtime, 포스터 그리드(6열 2:3), 플랫폼/유형/상태 칩 필터·검색·정렬, 0.5단위 별점, 추가/수정 모달. 이하 동일 2026-06-02: 캘린더 하단 상세 패널을 조회 전용 → 일간 동일 CRUD로 확장: 할일·일정 직접 관리(체크/수정/미루기/삭제), 반복 할일 표시·분기 삭제, 상단 필터 탭 연동. 이하 2026-06-01: 독서 진행 이력 reading_logs 테이블·자동 로깅 추가, 마이그레이션 타임스탬프 충돌 수정, 식단 카페 저장 버그 수정, 일간 할일 체크박스 모바일 탭 유실 수정, 반복 할일 인스턴스 동작 복구·수정 모달 개선, daily-report Edge Function에 일정·식단·감정·독서 섹션 추가)

---

## 1. 전체 페이지 목록과 각 기능

| 경로 | 컴포넌트 | 주요 기능 |
|------|---------|---------|
| `/` | → `/dashboard` 리다이렉트 | — |
| `/dashboard` | `DashboardView` | 통계 카드, 오늘 습관 체크, Top3 할일, 주간 진행률 |
| `/daily` | `DailyView` | PLAN/DO 타임라인, 스톱워치, 할일 CRUD, 타임라인 로그 |
| `/calendar` | `CalendarView` | 월/주/일 뷰, 필터 탭(할일·일정·습관·자기관리), 날짜 이동 |
| `/todos` | `TodosView` | 전체 할일 날짜별 그룹 / 미지정 할일 탭 |
| `/weekly` | `WeeklyView` | 날짜 미지정 할일 패널, 일별 칼럼, 주간 목표, 요일 배정 |
| `/goals` | `MonthlyView` | 주간 목표 탭 / 월간 목표 탭 (통계+목표+습관 달성률) |
| `/projects` | `ProjectsView` | 프로젝트 목록, 신규 프로젝트 생성 |
| `/projects/:id` | `ProjectDetailView` | 마일스톤 CRUD, 관련 할일 목록 |
| `/habits` | `HabitsView` | 습관 CRUD, 반복 설정, 5종 목표 유형 체크칩, 연속달성일, 월간 통계 / **루틴 탭**: 루틴 CRUD, 단계 체크 + 카운트다운 타이머, YouTube URL, 연속달성일 |
| `/routines` | → `/habits` 리다이렉트 | 기존 루틴 페이지 호환용 alias |
| `/selfcare` | `SelfCareView` | 운동/공부/뷰티 기록, 월간 통계 |
| `/reviews` | `ReviewsView` | 감정·감사·KPT·데일리리뷰, 주간/월간 리뷰 |
| `/food` | `FoodView` | 식단 기록 3탭(오늘/달력/통계), 영양성분 API 연동, 사진 업로드, 끼니별 단식 기록 |
| `/moments` | `MomentView` | 모먼트 로그 — 사진(최대 5장)+텍스트 작성·저장, 날씨 자동 기록, 최신순 카드 목록 |
| `/question-journal` | `QuestionJournalView` | 질문일기 — 오늘의 질문 답변, 질문 탐색, 질문별 모아보기(5년 다이어리 스타일) |
| `/culture` | `CultureRecordView` | 문화 기록 — 영화/드라마/예능/유튜브 등 시청 콘텐츠 기록(포스터 그리드, 칩 필터, 별점, 리뷰/인사이트). **Stage 1: PC 레이아웃만** |

> 참고: `BrainstormView.tsx`, `BacklogView.tsx` 파일은 남아 있지만 현재 `routes.tsx`에는 연결되어 있지 않다.

### 1-1. 페이지별 상세 기능

#### `/daily` — 일간 뷰
- 날짜 이동 (전후 화살표, 오늘 버튼)
- 할일 목록 (상태별: 예정/진행중/완료/미루기/취소)
- Top3 중요 할일 표시
- `+ 추가` 드롭다운 메뉴 (할일 추가 / 일정 추가)
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
- 헤더 `+ 추가` 드롭다운 (할일 / 일정 생성)
- 필터 탭: 전체 / 할일 / 일정 / 습관 / 자기관리
- 날짜 클릭 → 하단 상세 패널에 그 날짜의 항목 표시
- **하단 상세 패널**: 할일/일정/습관/자기관리/메모 섹션(divider 구분), 상단 필터 탭과 일관 동작
  - 반복 할일 포함 표시, 할일 완료 체크·수정·미루기(→ 다음날)·삭제 직접 가능(일간 핸들러/모달 재사용)
  - 반복 할일 삭제는 "이 항목만/이후/전체" 분기 모달, 일반 할일·일정은 확인 팝업
  - 일정은 완료 개념 없어 수정/미루기/삭제만 제공

#### `/weekly` — 주간 뷰
- 날짜 미지정 할일 목록
- 요일 배정 팝오버 (미지정 할일 → 특정 날 할일 배정)
- 일별 칸반 칼럼 (요일별 할일 + 완료율 표시)
- 할일 카드 드래그앤드롭으로 날짜 이동 (@dnd-kit)
  - 드래그 중 카드 반투명 + 드롭 영역 강조 + "여기에 놓기" 표시
  - 드롭 시 `updateTodo` → Supabase 즉시 저장
- 주간 목표 CRUD

#### `/todos` — 할일 페이지
- 탭1 "전체 할일": 날짜별 그룹 (오늘/내일/요일 레이블), 완료 항목 접기/펼치기
- 탭2 "미지정 할일": 날짜 없는 할일, 날짜 배정 패널
- TodoRow: 상태 순환 (active→inProgress→done), Top3 별표, 태그 칩, 프로젝트 배지, 편집/삭제
- 헤더 `+ 추가` 드롭다운 (할일 / 일정 생성)
- 공통 TodoModal 사용 (날짜 직접 선택/미지정 저장 가능)

#### `/goals` — 목표관리
- 상단 탭: **주간 목표** / **월간 목표**
- 주간 목표 탭: 주차 네비, 목표 CRUD, 달성률 바, 월간 목표 연결 select
- 월간 목표 탭: 월 네비, 통계 카드(완료 할일 수/달성률), 이달의 목표 카드(진행률 바+서브리스트), 이달 습관 달성률

#### `/habits` — 습관
- 습관 추가/편집/삭제 모달
  - "이 습관을 하려는 이유" 입력 (`reason` 필드)
  - "이번달 메모" 입력 (편집 모드 전용, `habit_monthly_memos` 테이블 저장)
- 반복 설정: 매일 / 평일 / 주말 / 커스텀(요일 선택)
- **5종 목표 유형 (HabitChip)**:
  - `check`: 원형 체크 버튼
  - `count`: − / + 카운터, 목표 달성 시 자동 체크
  - `time`: 타이머 (시작/정지, 누적 시간 저장)
  - `value`: 인라인 숫자 입력 + 단위
  - `memo`: 체크 후 인라인 메모 입력
- 연속 달성일(streak) 표시
- **습관 트래커** 탭 (FM002 스타일):
  - 연도 ◀▶ 네비 + Jan~Dec 월 탭
  - 습관별 행: 이모지+이름+이유 | 날짜 점(PC: grid 균등, 모바일: 가로 스크롤) | 달성/전체
  - 달성률 진행 바, 이번달 메모 인라인 편집
  - 월간 회고 섹션 (This month / What worked / What didn't work / Next month)

#### `/habits` 루틴 탭 — 루틴 실행 (구 `/routines`, 통합됨)
- 루틴 추가/편집/삭제 모달 (이름, 아이콘, 시작시간, 소요시간, 단계 목록)
  - 단계별 YouTube URL 입력 (선택사항, 유효성 검증)
- 오늘 진행률 바 (완료 수 / 전체)
- `RoutineCard`: 아이콘, 이름, 시간, 소요시간, 연속달성일 배지
- `ExecutionPanel`: 하단 시트
  - SVG 원형 카운트다운 타이머
  - 단계별 체크박스 + URL 등록 시 "영상 보기" 버튼 (새 탭)
  - "완료로 기록" 버튼 → `checked_dates` 토글 → Supabase 저장
- 연속 달성일(streak) 계산
- 완료 루틴은 하단으로 정렬 (미완료 → 시작시간 순)

#### `/selfcare` — 자기관리
- 카테고리: 운동 & 피트니스 / 퇴근 후 공부 / 뷰티 & 케어
- 기록 추가/삭제 (날짜, 내용, 소요시간)
- 월간 통계: 총 시간, 횟수, 평균 시간
- **수면 기록**: 취침/기상 시간 입력 → 수면 시간 자동 계산, 최근 7일 바차트, 이번주/이번달 평균
- **생리 기록** (`PeriodSection`): 접기/펼치기 가능한 민감 정보 섹션
  - 입력: 시작일, 종료일, 흘림양(적음/보통/많음), 증상 다중 선택(8종), 메모
  - 기록 수정/삭제, 최근 6건 목록 표시
  - 예측: 과거 기록 기반 평균 주기 자동 계산 + 다음 예상 시작일 표시

#### `/reviews` — 리뷰 & 기록
- **일간 리뷰**: 감정 레벨(1-5), 감사 항목 3개, KPT, 행복한 일, 데일리 요약
- **기록 목록**: 날짜별 리뷰 카드
- **주간 리뷰**: 좋았던 것 / 힘들었던 것 / 다음 주 다짐
- **월간 리뷰**: 이달 성취 / 다음 달 집중

#### `/food` — 식단 기록
- **오늘 탭**: 날짜 헤더, 오늘 총 식비·칼로리 요약 카드, 아침/점심/저녁/간식 섹션별 기록 목록
  - 원형 사진 썸네일, 칼로리·금액·식사유형 표시, 맛 이모지+메모, 수정·삭제
- **7단계 바텀시트 추가 흐름**:
  1. 시간대 선택 (🌅 아침 / ☀️ 점심 / 🌙 저녁 / 🍪 간식)
  2. 사진 (카메라/갤러리/건너뛰기) → Supabase `food-photos` Storage 업로드
  3. 음식 이름+양 입력 (음성입력 지원) → AI 칼로리 자동 추정 (OpenAI gpt-4o-mini)
  4. 식사 유형 (🏠 집밥 / 🛵 배달 / 🍴 외식 / ☕ 커피)
  5. 금액 입력 (선택)
  6. 칼로리 입력 (AI 추정값 배너 표시 → 적용 또는 직접 입력, 선택)
  7. 맛 평가 (😋 맛있었어 / 😐 보통 / 😑 별로, 선택) + 한 줄 메모 입력
- **달력 탭**: 날짜 셀 4분할(아침/점심/저녁/간식) 그리드, 주간↔월간 접기/펼치기 애니메이션
  - 선택 날짜 기록 목록에서 수정·삭제 가능 (FoodCard UI 동일)
- **통계 탭**: 기간 필터 [이번달/지난달/최근14일/직접선택]
  - 식비 총액, 배달·외식 목표 대비 횟수 (설정에서 목표 설정 가능)
  - 식사유형 도넛 차트, 자주 먹은 음식 TOP5, ⭐ 맛있었던 것 모아보기
  - 칼로리 막대 그래프 (최근14일: 14개 / 월별: 해당 달 전체 일별)

#### `/culture` — 문화 기록 (Stage 1·2 PC / Stage 3 모바일)

##### 모바일 레이아웃 (Stage 3, `lg:` 미만 전용)
- 진입점: 모바일 하단 5탭은 그대로, **상단 햄버거 메뉴**에 "문화 기록"(`Clapperboard`) 항목 (Stage 1에서 추가됨)
- 구조: PC 트리(`hidden lg:block`)와 모바일 트리(`lg:hidden`)를 **완전히 분리** → PC 레이아웃 무변경 보장. 상태/핸들러는 부모에서 공유
- sticky 헤더(부모 `main`이 스크롤 컨테이너): ① 제목 + 검색 아이콘(탭 시 헤더 자리에 input 펼침, 취소로 닫기) ② 상태 가로 스크롤 탭(전체/보고싶음/보는중/완료/중단) ③ 필터 트리거(플랫폼·유형 / 정렬 → bottom sheet)
- 본문: **3열 포스터 그리드**(2:3, gap 8px, padding 16px), 로딩 시 스켈레톤 6장(3×2), 빈 상태 동일 컴포넌트
- 모바일 카드(`CultureCardMobile`): hover/드롭다운 없음, 플랫폼·상태 아이콘만, 제목 2줄·작은 별점, 탭 → 수정 모달
- **FAB**: 우하단 골드 원형(56×56), `bottom: calc(72px + safe-area-inset-bottom)`(하단 탭바 위), 탭 → 추가 모달
- 필터 bottom sheet(`CultureFilterSheet`): 드래그 핸들 + 플랫폼/유형/정렬 섹션 + 초기화/적용(임시 상태→적용 시 커밋), safe-area 하단 패딩
- 추가/수정 모달(모바일): **full-screen 슬라이드업**(`max-lg` 미디어쿼리 키프레임), 헤더 ←(취소)/제목/저장(`form` 제출), safe-area-inset-top. 폼 순서: TMDB 토글 → URL → 제목 → 플랫폼/유형 → **상단 빠른 상태칩(수정 모드 즉시 DB 반영)** → 본날짜/썸네일 → 별점 → 리뷰 → 인사이트 → 태그 → (수정 시) 삭제. PC용 인폼 상태 섹션은 `hidden lg:block`
- TMDB 검색 결과: 모바일은 **썸네일 좌측 1열 리스트**(`lg:hidden`), PC는 3열 그리드(`hidden lg:grid`) 그대로
- 터치 영역 ≥ 약 40~46px, iOS 모멘텀 스크롤(`-webkit-overflow-scrolling: touch`)
- 360px(소형)에서도 3열 그리드·칩 가로 스크롤로 깨지지 않게 설계

#### `/culture` — 문화 기록 (Stage 1·2, PC 전용)
- 영화/드라마/예능/다큐/애니/유튜브/강의 등 시청 콘텐츠 기록
- 헤더: 제목 + 제목·태그 검색 인풋 + 정렬 드롭다운(기록일/본 날짜/별점 높은순) + `+ 추가하기`
- 칩 필터 3줄(다중): 플랫폼 / 유형 / 상태 — active 시 골드(accent) 배경
- 포스터 그리드: PC 6열(`lg:grid-cols-6`), 카드 2:3 비율
  - 썸네일 이미지(있으면) / 없으면 플랫폼 그라데이션 + 유형 아이콘 placeholder
  - 좌상단 플랫폼 미니 뱃지, 우상단 상태 아이콘(보고싶음=북마크/보는중=재생/완료=체크/중단=X)
  - **(Stage 2) 카드 hover 시 우상단 chevron(▼) → 상태 빠른 변경 드롭다운**(보고싶음/보는중/완료/중단), 선택 시 optimistic update + 실패 롤백 + 토스트. 카드 클릭(모달)과 `stopPropagation`으로 분리
  - 하단 제목 + 골드 별점(read-only), hover 시 위로 살짝 + 그림자 강조
  - 카드 클릭 → 상세/수정 모달
- 추가/수정 모달(`CultureFormModal`): 제목*·URL·플랫폼*·유형*·상태*·본 날짜·썸네일 URL·별점(completed/dropped 시)·리뷰·인사이트·태그(콤마 구분), 저장/취소/삭제(수정 시)
  - **(Stage 2) YouTube URL 자동 채움**: URL 입력 onBlur/onPaste 시 YouTube면 oEmbed로 제목·썸네일(비어있을 때만)·플랫폼=youtube·유형=youtube_video·external_source=youtube·external_id 자동 채움, 로딩 스피너, 실패 시 토스트
  - **(Stage 2) TMDB 검색**: 상단 "🎬 TMDB에서 검색" 토글 → 패널(300ms debounce, 포스터·제목·원제·연도·영화/TV 뱃지). 결과 선택 시 제목·썸네일·유형(movie→movie, tv→drama)·external_source(tmdb_movie/tmdb_tv)·external_id 채움. **platform은 자동 설정 안 함**(사용자 선택). 토큰 없음/401/네트워크 오류는 안내·토스트, 수동 입력 병행 가능
  - 자동 채움은 편의 기능 — 채워진 값도 사용자가 모두 수정 가능, `external_source`는 마지막 자동 채움 출처(`youtube`/`tmdb_movie`/`tmdb_tv`/`manual`)를 기록
- 별점(`StarRating`): 0.5 단위 반쪽 별, read-only/인터랙티브 모드
- 빈 상태: 아이콘 + "첫 문화 기록을 남겨보세요" + `+ 추가하기`
- 토스트(`CultureToast`): 페이지 자체 호스팅 경량 토스트(전역 인프라 없음) — 자동 채움/상태 변경 결과 알림
- Realtime: `culture_records` 테이블 구독(PC↔모바일 즉시 반영)
- **모바일 전용 레이아웃은 Stage 3 예정** (현재 그리드는 모바일에서 2열로 동작하지만 전용 UI 미완)

##### 문화 기록 외부 연동 명세 (Stage 2)
- **YouTube oEmbed** (`src/lib/youtube.ts`, API 키 불필요)
  - URL: `GET https://www.youtube.com/oembed?url={URL}&format=json`
  - 반환 사용 필드: `title`, `author_name`, `thumbnail_url`
  - `extractYouTubeVideoId(url)`: `watch?v=` / `youtu.be/` / `shorts/` / `embed/` 패턴에서 11자 video ID 추출(미매치 null)
  - `fetchYouTubeMetadata(url)`: 비-YouTube URL·실패 시 null
- **TMDB** (`src/lib/tmdb.ts`)
  - 환경변수: `VITE_TMDB_API_TOKEN` (Vercel Production/Preview 등록 → 배포본 동작, 로컬은 `.env` 추가 필요)
  - 인증: `Authorization: Bearer ${VITE_TMDB_API_TOKEN}`
  - 검색: `GET https://api.themoviedb.org/3/search/multi?query=...&language=ko-KR&include_adult=false` — `media_type`가 `movie`/`tv`인 결과만 사용
  - 반환 매핑: `{ id, type:'movie'|'tv', title, original_title, year, poster_path }`
  - 포스터: `getPosterUrl(path)` → `https://image.tmdb.org/t/p/w500{path}` (없으면 null)
  - `hasTMDBToken()`로 토큰 유무 판단 → 검색 패널 활성/비활성, 401은 "토큰 유효하지 않음" 안내
  - 한계: 한국 예능·개인 유튜브 촬영물 등은 TMDB에 없을 수 있음 → 수동 입력 병행

#### 비라우팅 컴포넌트 (현재 `routes.tsx` 미연결)
- `BrainstormView`: 브레인스토밍 입력/할일·일정 변환 UI 컴포넌트 파일은 존재
- `BacklogView`: 백로그 할일 관리 UI 컴포넌트 파일은 존재

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
| `period_records` | 생리 기록 | `start_date` DESC | ✅ |
| `habit_monthly_memos` | 습관별 월간 메모 + 전체 회고 | `year` ASC, `month` ASC | ✅ |
| `weekly_reviews` | 주간 리뷰 | `week_key` DESC | ✅ |
| `monthly_reviews` | 월간 리뷰 | `month` DESC | ✅ |
| `food_records` | 식단 기록 | `date` DESC, `created_at` DESC | ✅ |
| `moments` | 모먼트 로그 | `created_at` DESC | ✅ |
| `reading_logs` | 독서 진행 이력 (current_page 스냅샷) | `date` ASC | ✅ |
| `culture_records` | 문화 기록 (영화/드라마/예능/유튜브 등 시청 콘텐츠) | `created_at` DESC | ✅ |

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
reason          text|null   이 습관을 하려는 이유
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
category        text        exercise|study|beauty|sleep
content         text        기록 내용
duration        int         소요 시간 (분)
sleep_start     text|null   취침 시간 (HH:mm) — sleep 카테고리 전용
sleep_end       text|null   기상 시간 (HH:mm) — sleep 카테고리 전용
```

#### `period_records`
```
id              text        PK
start_date      text        시작일 (yyyy-MM-dd)
end_date        text|null   종료일 (yyyy-MM-dd)
symptoms        jsonb       증상 배열 ["두통","복통",...]
flow_level      text|null   흘림양: light|medium|heavy
memo            text|null   메모
created_at      timestamptz 생성일시
```

#### `habit_monthly_memos`
```
id              text        PK
habit_id        text        습관 id (또는 '__review__' for 전체 월간 회고)
year            int         연도
month           int         월 (1-12)
memo            text        이번달 메모 (습관별) / This month (전체 회고)
what_worked     text        What worked (전체 회고용)
what_didnt_work text        What didn't work (전체 회고용)
next_month      text        Next month (전체 회고용)
created_at      timestamptz 생성일시
UNIQUE(habit_id, year, month)
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
id              uuid        PK
user_id         uuid        FK → auth.users.id
title           text        일정 제목
is_all_day      boolean     종일 여부
start_at        timestamptz 시작 일시
end_at          timestamptz 종료 일시
location        text|null   장소
link_url        text|null   링크 URL
repeat_type     text|null   none|daily|weekly|monthly
repeat_end_date date|null   반복 종료일
alert_minutes   int|null    0|10|30|60
memo            text|null   메모
project_id      text|null   FK → projects.id (앱 호환용)
color           text|null   일정 색상
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
id                  text        PK
name                text        루틴 이름
icon                text        이모지 아이콘
start_time          text|null   시작 시간 (HH:mm)
duration            int|null    소요 시간 (분)
steps               text[]      단계 목록
step_youtube_urls   text[]      단계별 YouTube URL (steps와 인덱스 1:1 대응)
checked_dates       text[]      완료 날짜 배열 (yyyy-MM-dd)
repeat              text        daily|weekday|weekend|custom (기본값: 'daily')
repeat_days         int[]       반복 요일 (0=일 ~ 6=토, custom일 때 사용)
created_at          timestamptz 생성일시
```

#### `weekly_reviews`
```
id          text        PK
week_key    text        UNIQUE (예: 2026-W21)
good        text        좋았던 것
hard        text        힘들었던 것
next_week   text        다음 주 다짐
created_at  timestamptz 생성일시
```

#### `monthly_reviews`
```
id           text        PK
month        text        UNIQUE (예: 2026-05)
achievement  text        이달의 성취
next_focus   text        다음 달 집중
created_at   timestamptz 생성일시
```

#### `food_records`
```
id           text        PK
date         text        날짜 (yyyy-MM-dd)
meal_type    text        breakfast|lunch|dinner|snack
food_name    text        음식 이름
amount       integer     식비 (원, 기본값 0)
photo_url    text|null   Supabase Storage 사진 URL
memo         text|null   메모
calories     numeric(7,1)|null  칼로리 (kcal)
carbs        numeric(7,1)|null  탄수화물 (g)
protein      numeric(7,1)|null  단백질 (g)
fat          numeric(7,1)|null  지방 (g)
dining_type  text|null   home|delivery|restaurant|coffee
taste_rating text|null   good|normal|bad
taste_memo   text|null   맛 평가 한 줄 메모
created_at   timestamptz 생성일시
```
> Storage: `food-photos` 버킷 (public, anon INSERT/UPDATE/DELETE/SELECT 정책 설정) — 사진 업로드/삭제 지원

#### `moments`
```
id              uuid        PK (gen_random_uuid())
created_at      timestamptz 생성일시 (default now())
content         text        짧은 텍스트 기록
photos          text[]      사진 Public URL 배열 (Supabase Storage moment-photos 버킷)
weather_temp    numeric     기온 (°C, nullable — 위치 권한 거부 시 null)
weather_code    int         WMO 날씨 코드 (nullable)
```
> Storage: `moment-photos` 버킷 (public, anon INSERT/UPDATE/DELETE/SELECT 정책 설정)

#### `culture_records`
```
id              uuid        PK (gen_random_uuid())
user_id         uuid        FK → auth.users.id (DEFAULT auth.uid(), on delete cascade)
title           text        제목
platform        text        netflix|youtube|disney_plus|coupang_play|tving|watcha|theater|other
content_type    text        movie|drama|variety|documentary|anime|youtube_video|lecture|other
url             text|null   콘텐츠 URL
thumbnail_url   text|null   썸네일 이미지 URL (Stage 2 유튜브 자동 fetch 예정)
external_source text|null   tmdb_movie|tmdb_tv|youtube|manual (Stage 1=manual, Stage 2 자동 검색 시 채움)
external_id     text|null   외부 출처 콘텐츠 ID (TMDB id, YouTube video id 등)
status          text        watchlist|watching|completed|dropped (기본값 completed)
rating          numeric(2,1)|null  별점 0~5 (0.5 단위)
review          text|null   리뷰
insight         text|null   인사이트/배운 점
tags            text[]      태그 배열 (기본값 '{}')
watched_date    date|null   본 날짜
created_at      timestamptz 생성일시 (default now())
updated_at      timestamptz 수정일시 (default now())
```
> RLS: "Users can {view,insert,update,delete} their own records" — `auth.uid() = user_id` (per-row 소유자 정책). user_id 는 INSERT 시 DB 기본값 auth.uid() 로 자동 충전(클라이언트 미전송).
> Realtime: `supabase_realtime` publication 등록 완료

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
├── brainstormItems ─────────── BrainstormView (CRUD, 현재 라우트 미연결)
│                              → Supabase ✅
│
├── brainstormMemos ─────────── BrainstormView (CRUD, 현재 라우트 미연결)
│
├── tags ───────────────────── TodoModal (태그 선택) → Supabase ✅ (최초 기본값 5개 자동 시드)
│
├── routines ───────────────── HabitsView 루틴 탭 (CRUD + toggleRoutineDate) → Supabase ✅
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
| 생리 기록 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 습관 월간 메모 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 리뷰 기록 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 타임라인 설정 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 타임라인 로그 | ✅ | ✅ | — | ✅ | ✅ 연동 (버그 수정 완료) |
| 일정 (Event) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (events 스키마 버그 수정 완료) |
| 주간 목표 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 월간 목표 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 브레인덤프 아이템 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 브레인덤프 메모 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 태그 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 루틴 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 주간 리뷰 | ✅ | ✅ | ✅ | — | ✅ 연동 (weekly_reviews 테이블) |
| 월간 리뷰 | ✅ | ✅ | ✅ | — | ✅ 연동 (monthly_reviews 테이블) |
| 식단 기록 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (food_records 테이블, is_fasting 단식 플래그 포함) |
| 모먼트 로그 | ✅ | ✅ | — | ✅ | ✅ 연동 (moments 테이블) |
| 질문일기 — 질문 풀 | ✅ | ✅ | — | ✅ | ✅ 연동 (question_pool 테이블) |
| 질문일기 — 답변 | ✅ | ✅ | ✅ | — | ✅ 연동 (question_answers 테이블) |
| 질문일기 — 오늘 배정 | ✅ | ✅ | — | — | ✅ 연동 (daily_question 테이블) |
| 문화 기록 (Culture) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (culture_records 테이블, Realtime) |

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
- 브레인스토밍 컴포넌트(현재 라우트 미연결)에서 할일/일정 변환 지원
- **주간 칸반 드래그앤드롭** — 할일 카드를 다른 날짜 컬럼으로 드래그해 날짜 이동, Supabase 즉시 저장 (@dnd-kit/core)
- **루틴 실행** — 단계 체크 + SVG 원형 카운트다운 타이머, 완료 기록 → Supabase
- **습관 5종 목표 유형** — check/count/time/value/memo 각각 전용 위젯
- **스마트 알림 시스템** — 할일 `planStart` 기준 로컬 알림, 알림 권한 배너, iOS 16.4+ 안내, 클릭 시 DailyView 해당 할일로 이동 (`useNotification.ts`, `NotificationPermissionBanner.tsx`)
- **공통 TimePicker 컴포넌트** — ▲▼ 버튼 + 마우스 휠(분 1분단위) + 드롭다운 선택 패널 + 패널 직접 입력, 앱 전체 11곳 적용 (`TimePicker.tsx`)
- **공통 `+ 추가` 드롭다운 메뉴** — 일간/할일/캘린더 헤더에서 할일 추가·일정 추가를 같은 진입점으로 제공 (`AddEntryMenu.tsx`)
- **모바일 일간 탭 UI** — 모바일에서 할일 목록 / 타임라인 탭 전환 (`mobileTab` state, `lg:hidden` 탭 바), 데스크탑 좌우 분할 유지
- **모바일 캘린더 스크롤 구조** — 주별/일별 헤더 고정 + 타임라인 내부 단일 스크롤, 7열 자동 축소
- **공통 ConfirmModal** — `window.confirm()` 대체, `confirmDanger` prop으로 삭제(빨간)/일반(골드) 버튼 구분, 배경 클릭·ESC 닫기 (`ConfirmModal.tsx`)
- **자기관리 기록 수정** — 기록 행 hover 시 수정(✏️)/삭제(🗑️) 버튼 표시, `AddRecordModal` 수정 모드 지원 (`SelfCareView.tsx`)
- **습관 반복 설정 필터링** — 습관 탭에서 `isHabitApplicableOnDate` 적용, 오늘 요일에 해당하는 습관만 표시 (`HabitsView.tsx`)
- **습관 alarmTime 알림 연결** — `scheduleHabitAlerts(habits, date)` 추가, 알림 설정 시각에 푸시 알림 발송, 체크 완료 습관 skip (`useNotification.ts`)
- **루틴 반복 설정** — 루틴 편집 모달에 매일/평일/주말/직접 선택 UI, 오늘 해당 루틴만 목록/진행률 표시, Supabase `repeat`/`repeat_days` 컬럼 추가 (`RoutinesView.tsx`, `HabitsView.tsx`)
- **주간/월간 리뷰 Supabase 연동** — `weekly_reviews`, `monthly_reviews` 테이블 생성 및 CRUD 완성, 데이터 로드 후 state 동기화 (`store.tsx`, `db.ts`, `ReviewsView.tsx`)
- **자기관리 생리 기록** — 접기/펼치기 섹션, 시작일/종료일/흘림양/증상/메모 입력, 과거 기록 기반 평균 주기 + 다음 예상 시작일 자동 계산 (`SelfCareView.tsx` `PeriodSection`)
- **캘린더 생리 기간 핑크 점** — MonthView 날짜 셀에 period_records 기간 해당 날짜 핑크 원 표시 (`CalendarView.tsx`)
- **습관 트래커 탭 (FM002 스타일)** — 월별 날짜 점 히트맵 (PC: grid 균등, 모바일: 가로 스크롤), 습관 이유 표시, 이번달 메모 인라인 편집, 월간 회고 섹션 (`HabitsView.tsx` `HabitTrackerView`)
- **할일 페이지(`/todos`)** — 전체 할일 날짜별 그룹 + 미지정 할일 탭, 공통 TodoModal 날짜 네비, 프로젝트 배지
- **공통 TodoModal** — 날짜 직접 선택 + `미지정` 저장 지원, 날짜 없이 저장하면 `/todos`의 `미지정` 탭에 표시 (`TodoModal.tsx`)
- **EventModal** — 제목/종일/날짜/시간/장소/링크/반복/알림/메모/프로젝트/색상 입력으로 일정 생성 (`EventModal.tsx`)
- **이벤트 API 레이어** — `src/api/events.ts` 에서 Supabase `events` v2 스키마와 반복 일정 전개 유틸 제공
- **목표관리 페이지(`/goals`) 탭 개편** — 주간 목표 / 월간 목표 탭, 탭별 독립 날짜 네비, `WeeklyGoalsSection` 재사용
- **루틴 단계별 YouTube URL** — 편집 모달에 단계별 URL 입력(선택), 유효성 검증, 실행 화면에서 "영상 보기" 버튼 → 새 탭 열기
- **루틴 기능 통합** — 독립 루틴 페이지 대신 습관&루틴(`/habits`) 내부 루틴 탭을 사용하고, `/routines`는 `/habits`로 리다이렉트
- **메뉴 구조 개편** — 활성 네비게이션에서 보관함·브레인스토밍 제거, 월간→목표관리(`/goals`)로 정리, 할일 메뉴 추가
- **일간 할일 삭제 안정화** — 삭제 확인 모달 표시 중 컨텍스트 메뉴의 바깥 클릭 `mousedown` 닫힘을 차단해, 확인 버튼 클릭이 누락되지 않도록 수정 (`DailyView.tsx`)
- **모바일 하단 네비 개선** (`Layout.tsx`)
  - 하단 네비: 5개 고정 탭(대시보드·일간·캘린더·할일·습관&루틴)
  - 활성 탭: 골드 `accentLight` 배경 pill 강조
  - 모바일 상단 topbar 햄버거 버튼 → `MobileMenuOverlay` 바텀 시트(전체 페이지 4열 그리드)
- PWA 지원 (manifest + service worker + network-first/cache fallback)
- 일일 긍정 메시지 (AffirmationCard)
- **식단 기록 페이지(`/food`)** — 3탭(오늘/달력/통계), 7단계 바텀시트 추가 흐름, 식약처 영양성분 API 자동 검색, 사진 업로드(카메라/갤러리), 음성입력, 식사유형·맛평가, 도넛·바 차트 통계 (`FoodView.tsx`)
- **식약처 영양성분 API 프록시** — Vercel Edge Function `GET /api/food-nutrition?query=음식명` → 칼로리/탄수화물/단백질/지방 반환 (`api/food-nutrition.ts`)
- **일일 리포트(daily-report) Supabase Edge Function** — pg_cron이 KST 지정 시각(저녁 23:59 KST, `daily-report-evening`)에 호출 → 오늘(KST) 기준 **할일·습관·일정·식단·감정·독서·문화 기록** 7개 섹션을 조립해 Discord Webhook으로 전송. 섹션별 try/catch로 한 섹션 실패가 전체 전송을 막지 않음. events.start_at은 KST 벽시계 text라 동일 형식 문자열 범위로 조회(반복 일정 전개는 TODO). **문화 기록 섹션(Stage 4)**: `culture_records.created_at`(UTC timestamptz)을 KST 하루 경계(UTC ISO 변환)로 조회, 상태 아이콘+플랫폼 한글+별점(completed/dropped)·리뷰/인사이트 발췌(80자, 최대 8개, 1900자 방어 시 80→40→0 축소), 독서 다음 배치, 빈 상태는 섹션 유지+안내 문구 (`supabase/functions/daily-report/index.ts`, 명세: `DAILY_REPORT_SCHEMA.md`)
- **모먼트 로그(`/moments`)** — 사진(카메라/갤러리, 최대 5장)+텍스트 작성·저장, 저장 시 Geolocation → Open-Meteo 날씨 자동 첨부, WMO 코드 → 이모지+한국어 매핑, 카드 날씨 배지 표시, 위치 거부 시 날씨 없이 폴백 저장 (`MomentView.tsx`)
- **질문일기(`/question-journal`)** — 오늘의 질문 탭(daily_question 랜덤 배정 + 답변 저장/수정), 질문 탐색 탭(내장 15개 + 커스텀 추가/삭제), 질문별 모아보기(연도별 섹션 + 5년 다이어리 스타일 카드, 바텀시트/모달 오버레이). Realtime 3테이블 연동 (`QuestionJournalView.tsx`)
- **문화 기록(`/culture`) — Stage 1 PC 레이아웃** — 영화/드라마/예능/유튜브 등 시청 콘텐츠 기록. 포스터 그리드(PC 6열, 2:3, 썸네일 또는 플랫폼 그라데이션+유형 아이콘 placeholder, 플랫폼 미니뱃지+상태 아이콘, hover 리프트), 플랫폼/유형/상태 칩 다중 필터 + 제목·태그 검색 + 정렬(기록일/본 날짜/별점), 0.5단위 인터랙티브 별점(`StarRating`), 추가/수정 모달(`CultureFormModal`, 리뷰·인사이트·태그·삭제), 빈 상태 UI, `culture_records` Realtime 구독. db.ts `cultureRecords` 레이어, store.tsx `CultureRecord` 타입. **모바일 전용 UI는 Stage 3 예정** (`CultureRecordView.tsx`, `culture/` 폴더)
- **문화 기록(`/culture`) — Stage 2 자동 fetch + 상태 관리** — YouTube oEmbed 자동 채움(`src/lib/youtube.ts`: URL onBlur/onPaste → 제목·썸네일·플랫폼=youtube·유형=youtube_video·external 채움, 비어있을 때만 덮어쓰지 않음), TMDB 검색 통합(`src/lib/tmdb.ts` + `culture/TMDBSearchPanel.tsx`: `VITE_TMDB_API_TOKEN` Bearer, `/search/multi` ko-KR, 300ms debounce, 포스터 그리드, 선택 시 제목·썸네일·유형·external 채움·platform 제외), 카드 hover 상태 빠른 변경(chevron 드롭다운, optimistic update + 롤백, `db.cultureRecords.updateStatus`), 경량 토스트(`culture/CultureToast.tsx`). 자동 채움 출처를 `external_source`로 기록(youtube/tmdb_movie/tmdb_tv/manual)
- **문화 기록(`/culture`) — Stage 3 모바일 레이아웃** — PC/모바일 트리 분리(`hidden lg:block` / `lg:hidden`)로 PC 무변경. 모바일 sticky 헤더(검색 토글·상태 가로탭·필터 트리거), 3열 포스터 그리드, 모바일 전용 카드(`CultureCardMobile`), 필터 bottom sheet(`culture/CultureFilterSheet.tsx` — 플랫폼/유형/정렬, 초기화/적용), full-screen 슬라이드업 모달(`max-lg` 키프레임, 헤더 ←·저장, 상단 빠른 상태칩 즉시반영), 골드 FAB(safe-area), 로딩 스켈레톤. TMDB 결과 모바일 1열 리스트. 햄버거 메뉴 진입점은 Stage 1에서 추가됨
- **모바일 타임라인 블록 생성 — 롱프레스 방식** — 빈 타임라인을 0.5초 꾹 누를 때만 블록 생성 모드 활성화(기본 30분 프리뷰 + 진동), 이전 드래그 방식은 일반 스크롤과 충돌했음. `WebkitTouchCallout/WebkitUserSelect: none` 으로 iOS 시스템 텍스트 선택 메뉴 차단 (`DailyView.tsx`)
- **DO 블록 독립 삭제** — DO 블록 삭제 시 `doStart/doEnd/doElapsedSec`만 비워 PLAN은 유지(기존: `deleteTodo`로 할일 전체 삭제됨). DO 블록도 모바일 롱프레스 컨텍스트 메뉴 지원 (`DailyView.tsx`)
- **식단 단식 기록** — 음식 추가 첫 단계(끼니 선택) 하단의 "🚫 끼니별 단식" 버튼으로 거른 끼니를 한 번에 기록(`FoodRecord.isFasting`, `food_records.is_fasting`). 기록 카드는 점선 🚫 표기, 식단 달력 셀 4분할에서 단식 끼니 🚫 표시, 통계에 "끼니별 단식" 분포 카드 추가(식비/칼로리/TOP5 등 일반 통계는 단식 제외) (`FoodView.tsx`)
- **캘린더 월별/주별 탭 색상** — 파란 계열을 서비스 골드/베이지 톤으로 통일(베이지 컨테이너 + 골드 활성 탭) (`CalendarView.tsx`)
- **할일 미루기 배지 정리** — 일간 미루기 시 `status`를 `snoozed`가 아닌 `active`로 저장해, 미룬 날짜 이동은 유지하되 "미루기" 상태 배지는 표시하지 않음(백로그 미루기와 동작 통일) (`DailyView.tsx`)
- **캘린더 하단 상세 패널 직접 관리** — 조회 전용이던 패널을 일간 페이지와 동일한 CRUD로 확장 (`CalendarView.tsx`)
  - 섹션: 할일/일정/습관/자기관리/메모 (divider 구분), 상단 필터 탭(전체/할일/일정/습관/자기관리)과 일관 동작
  - 할일: 원형 완료 체크박스 토글, 항목 탭 → `TodoModal` 수정, → 다음날 미루기, x 삭제. `expandRecurringTodos`로 반복 할일 인스턴스 포함 표시
  - 삭제: 반복 할일은 `RecurrenceBranchModal`("이 항목만/이후/전체"), 일반 할일·일정은 `ConfirmModal` 확인 팝업
  - 일정: 완료 개념 없어 수정(`EventModal`)/미루기/삭제만. store 핸들러 재사용으로 일간과 동작·데이터(Supabase) 일치, 디자인 토큰만 사용·PC 레이아웃 미변경

---

## 5. 미구현 또는 버그 있는 기능 목록

### 🔴 버그 (즉시 수정 권장)

| 위치 | 문제 | 증상 | 상태 |
|------|------|------|:----:|
| `DailyView.tsx` (구 L856-861) | `timelineLogs` 로컬 state에 mock 데이터 하드코딩 | 전역 store와 무관하게 동작, 새로고침 시 목 데이터로 초기화 | ✅ 수정 완료 |
| `DailyView.tsx` (구 L952-958) | `addTimelineLog` / `deleteTimelineLog`가 로컬 state만 업데이트 | Supabase에 저장 안 됨 (store의 전역 함수 미사용) | ✅ 수정 완료 |
| `DailyView.tsx` (ContextMenu 삭제 플로우) | 삭제 확인 모달에서 버튼 클릭 시 컨텍스트 메뉴가 먼저 닫혀 onConfirm 누락 가능 | 팝업 "삭제" 클릭 후 할일이 삭제되지 않음 | ✅ 수정 완료 |
| `DailyView.tsx` (모바일 타임라인) | 아래 드래그 8px 이상이면 블록 생성 → 일반 스크롤에도 블록 생성, 위 스크롤 불가 | 스크롤 시 타임블록 자동 생성 | ✅ 수정 완료 |
| `DailyView.tsx` (DO 블록 삭제) | DO 블록 `deleteTodo(id)` → PLAN/DO 공유 todo 전체 삭제 | DO 지우면 PLAN도 사라짐 | ✅ 수정 완료 |
| `events` 테이블 / `api/events.ts` | 운영 DB가 옛 스키마(date/start_time/end_time)만 보유, 코드가 쓰는 start_at 등 컬럼 누락 → `GET /events` 400 | 일정 추가/조회 전면 중단 + store Promise.all reject로 태그 등 미반영 | ✅ 수정 완료 (마이그레이션) |
| `food_records` 테이블 | dining_type CHECK 제약에 'coffee' 누락 (코드는 home/delivery/restaurant/coffee 제공) | 카페 식단 저장 시 400 → 화면엔 보였다가 재접속 시 사라짐 | ✅ 수정 완료 (마이그레이션 `20260601000000`) |
| `DailyView.tsx` (TodoRow) | `TodoRow`를 컴포넌트 내부에서 `<TodoRow/>` 엘리먼트로 렌더 → 매 렌더 새 타입 → 행 unmount/remount | 모바일(iOS)에서 할일 체크박스 탭이 유실되어 토글 안 됨 | ✅ 수정 완료 (함수 호출 인라인 렌더) |
| `store.tsx` / `DailyView.tsx` (반복 인스턴스) | 가상 id(`parentId::date`)에 `updateTodo`/`startTimer` 호출 → DB에 없는 id라 no-op | 반복 할일 인스턴스의 완료·실행·미루기·상태변경이 안 됨 | ✅ 수정 완료 (`ensureMaterializedTodoId`로 예외 레코드 구체화) |
| `TodoModal.tsx` (반복 수정) | 가상 인스턴스 편집 시 "반복 일정입니다" 배너만 노출, 설정 숨김 | 반복 주기 변경·반복 해제 불가 | ✅ 수정 완료 (분리 예외만 배너, 그 외 설정 UI 노출) |

### ⚠️ 새로고침 시 데이터 소실 (Supabase 미연동)

모든 데이터 Supabase 연동 완료 ✅

### ❌ 미구현 기능

| 기능 | 설명 |
|------|------|
| PWA 오프라인 모드 | 기본 service worker 캐시(`network-first + cache fallback`)는 있으나 정교한 오프라인 동기화/캐시 정책은 미구현 |
| 데이터 내보내기/가져오기 | 미구현 |
| 사용자 인증 (멀티유저) | 현재 단일 사용자 구조 |
#### 문화 기록(`/culture`) 향후 Stage 로드맵
- **Stage 1** ✅ — PC 포스터 그리드, 칩 필터·검색·정렬, 별점, 추가/수정 모달, Realtime
- **Stage 2** ✅ — YouTube oEmbed 자동 채움 + TMDB 영화·드라마 검색 통합 + 카드 빠른 상태 변경
- **Stage 3** ✅ — 모바일 전용 레이아웃(sticky 헤더, 3열 그리드, 필터 bottom sheet, full-screen 모달, FAB)
- **Stage 4** ✅ — 저녁 daily-report Discord 리포트에 "오늘의 문화 기록" 섹션 연동(독서 다음, 상태/플랫폼/별점/발췌, 길이 방어)
  - 향후: 통계/대시보드(플랫폼·유형별 시청량·별점 분포·월별 추이), 모먼트/리뷰 연동, Claude API 인사이트(별점 4+ 하이라이트, 주간/월간 문화 통계)

---

## 6. 컴포넌트 구조도

```
App.tsx
└── ThemeProvider (ThemeContext)
    └── PlannerProvider (store.tsx)
        └── RouterProvider (routes.tsx)
            ├── GlobalFloatingTimer
            ├── PWABanner
            ├── IOSInstallGuide
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
│   ├── AddEntryMenu (`+ 추가` 드롭다운)
│   ├── TodoRow (할일 행 — ?todoId 파라미터로 하이라이트+스크롤)
│   ├── TodoModal (추가/편집)
│   ├── EventModal (일정 추가/편집)
│   ├── SnoozeModal (미루기)
│   ├── ContextMenu (우클릭 메뉴)
│   ├── TimelineLogModal (로그 추가)
│   └── TimelineSettingsModal (시간대 설정)
│
├── CalendarView
│   ├── AddEntryMenu (`+ 추가` 드롭다운)
│   ├── MonthView (월별 그리드)
│   ├── WeekView (주별 타임라인)
│   └── DayViewPanel (일별 미니 타임라인)
│
├── WeeklyView
│   ├── UnassignedTodoItem (날짜 미지정 할일 카드 — 드래그 + 날짜 배정)
│   ├── AssignDayPopover (요일 배정 팝오버)
│   ├── DayColumn (요일별 할일 칼럼 — useDroppable)
│   ├── DraggableTodoCard (드래그 가능한 할일 카드 — useDraggable)
│   └── OverlayCard (드래그 중 표시되는 고스트 카드 — DragOverlay)
│
├── TodosView
│   ├── AddEntryMenu (`+ 추가` 드롭다운)
│   ├── TodoRow (상태토글·Top3·태그칩·프로젝트배지·편집/삭제)
│   ├── AllTodosTab (날짜별 그룹, 완료 접기/펼치기)
│   └── UnassignedTab (미지정 할일, 날짜 배정 패널)
│
├── MonthlyView (목표관리 /goals)
│   ├── WeeklyGoalsSection (WeeklyView에서 export, 재사용)
│   └── MonthlyGoalsContent (이달 목표+통계+습관 달성률)
│
├── HabitsView
│   ├── HabitModal (추가/편집 — 5종 목표 유형, reason, 이번달 메모)
│   ├── HabitChip (유형별 위젯: check/count/time/value/memo)
│   ├── HabitTrackerView (FM002 스타일 월별 점 히트맵 + 월간 회고)
│   ├── RoutineCard (RoutinesView에서 export, 재사용)
│   ├── RoutineModal (RoutinesView에서 export, 재사용 — 단계 목록 + YouTube URL)
│   └── ExecutionPanel (RoutinesView에서 export, 재사용 — 타이머 + 단계 체크 + 영상 보기)
│
├── RoutinesView (페이지 없음, 컴포넌트 모듈로만 존재)
│   ├── export RoutineModal
│   ├── export RoutineCard
│   └── export ExecutionPanel
│
├── ReviewsView
│   ├── DailyReviewForm (감정/감사/KPT)
│   ├── ReviewCard (기록 목록)
│   ├── WeeklyReviewForm
│   └── MonthlyReviewForm
│
├── SelfCareView
│   ├── PeriodSection (생리 기록 — 접기/펼치기, 입력폼, 예측, 기록목록)
│   ├── SleepSection (수면 기록 — 취침/기상, 7일 바차트)
│   ├── SelfCareForm (기록 추가 모달)
│   └── SelfCareCard (기록 카드)
│
├── ProjectView
│   ├── ProjectsView (목록)
│   │   └── NewProjectModal
│   └── ProjectDetailView (상세)
│       ├── MilestoneItem
│       └── 관련 할일 목록
│
├── DashboardView
│   ├── StatCard (통계 카드)
│   ├── AffirmationCard (긍정 메시지)
│   ├── HabitChips (오늘 습관)
│   └── TodoSummary (Top3 + 기한 초과)
│
├── BacklogView (현재 라우트 미연결)
│   ├── BacklogTodoRow
│   └── AddBacklogModal
│
├── BrainstormView (현재 라우트 미연결)
│   ├── BrainstormItemCard
│   ├── ConvertToTodoModal
│   └── ConvertToEventModal
│
├── MomentView (/moments)
│   └── (단일 컴포넌트 — 작성 카드 + 목록 카드)
│
├── QuestionJournalView (/question-journal)
│   ├── TodayTab (오늘의 질문 — daily_question 배정, 답변 저장/수정)
│   ├── ExploreTab (질문 탐색 — 내장/커스텀 목록, 추가/삭제)
│   ├── HistoryPanel (질문별 모아보기 — 바텀시트/모달, 연도별 섹션)
│   ├── AnswerCard (날짜별 답변 카드 — 최신 배지, 골드 테두리)
│   └── QuestionItem (질문 카드 — 기록 보기 버튼, 삭제)
│
├── FoodView (/food)
│   ├── TodayTab (오늘 식단 — 요약 카드 + 식사 섹션별 기록)
│   │   └── MealSection (아침/점심/저녁/간식 + FoodCard)
│   ├── CalendarTab (월별 그리드 + 날짜별 기록 목록)
│   ├── StatsTab (식비·도넛차트·TOP5·맛있었던것·칼로리바차트)
│   └── AddFoodSheet (7단계 바텀시트 — 시간대/사진/음식명+영양검색/식사유형/금액/칼로리/맛평가)
│
├── CultureRecordView (/culture) — PC(Stage 1·2) + 모바일(Stage 3) 트리 분리
│   ├── CultureCard (PC 포스터 카드 — 플랫폼 뱃지, 상태 아이콘 + hover 상태 빠른변경 드롭다운)
│   ├── CultureCardMobile (모바일 카드 — 아이콘만, 탭→수정 모달, hover 없음)
│   ├── SkeletonGrid (모바일 로딩 스켈레톤 3×2)
│   ├── EmptyState (빈 상태 — 첫 기록 유도, PC·모바일 공용)
│   ├── culture/CultureFormModal (추가/수정 모달 — PC 센터 / 모바일 full-screen 슬라이드업, YouTube 자동채움 + TMDB 토글 + 빠른 상태칩)
│   ├── culture/TMDBSearchPanel (TMDB 검색 — PC 3열 그리드 / 모바일 1열 리스트)
│   ├── culture/CultureFilterSheet (모바일 필터 bottom sheet — 플랫폼/유형/정렬)
│   ├── culture/StarRating (0.5단위 별점 — read-only/인터랙티브)
│   ├── culture/CultureToast (경량 토스트 — useToasts/ToastHost)
│   ├── culture/cultureMeta (플랫폼/유형/상태/정렬 라벨·색상·아이콘 메타)
│   ├── lib/youtube (oEmbed — extractYouTubeVideoId/fetchYouTubeMetadata)
│   └── lib/tmdb (TMDB search/multi — searchTMDB/getPosterUrl/hasTMDBToken)
│
└── 공통 컴포넌트
    ├── AddEntryMenu — `+ 추가` 버튼 드롭다운 (할일 추가 / 일정 추가)
    ├── TodoModal — 할일 추가/편집 모달 (날짜 직접 선택, 미지정 저장 가능)
    │   └── 적용: DailyView, TodosView, CalendarView
    ├── EventModal — 일정 추가/편집 모달
    │   └── 적용: DailyView, TodosView, CalendarView
    ├── TimePicker — ▲▼ 버튼 + 휠(분 1분단위) + 드롭다운 패널 + 패널 직접 입력
    │   └── 적용: DailyView 6곳, HabitsView 2곳, RoutinesView 1곳
    ├── ConfirmModal — window.confirm() 대체 커스텀 확인 모달
    │   └── 적용: DailyView, TodoModal, TodosView, ProjectView, BacklogView
    ├── NotificationPermissionBanner — 알림 권한 요청 배너 (`Layout.tsx` 모바일/데스크탑 main에 마운트)
    │   └── useNotification — 알림 권한 관리, 할일 planStart 기준 알림 스케줄링
    └── MobileMenuOverlay (Layout.tsx 내부) — 모바일 상단 메뉴 버튼으로 여는 전체 메뉴 바텀 시트 오버레이
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
