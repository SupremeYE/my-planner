# STEP 3B-6A-UI — 공통 시간축 주간 타임테이블

## 작업 기준과 범위

- 기준 브랜치/SHA: `codex/moamoa-step3b6a-plan-reconcile` / `9c73bce1520e05d02dd6a4753b3633413a775a52`
- UI 브랜치: `codex/moamoa-step3b6a-calendar-ui`
- 독립 worktree: `/workspace/moamoa-calendar-ui`
- 개발 진입: `/__moamoa-calendar-plan`

확인 저장소, PlannerProvider 단일 상태, hook, 파서, 기존 서비스 라우트 및 DB 모델은 변경하지 않았다. 기존 통합 브랜치·Preview·main에는 Push하지 않는다. UI 브랜치 검토를 위한 시안이며 Production 화면을 교체하지 않는다.

## 구조 변경

| 이전 | 변경 후 |
| --- | --- |
| 날짜별 독립 24시간 목록/스크롤 | 공통 세로 시간축과 단일 `.cp-hours` 스크롤 |
| hour로 필터한 행 안에 카드 추가 | 시작 분 × 0.8px의 top, 기간 분 × 0.8px의 height |
| 같은 19:00도 앞의 카드 수에 따라 밀림 | 모든 날짜의 19:00 좌표 동일 |
| 미지정 목록이 각 날짜의 시간행을 밀어냄 | 공통 상단 grid 행. 펼쳐도 모든 시간 컬럼이 함께 이동 |
| 반복되는 큰 ＋ 버튼 | 표시 없는 30분 단위 빈 영역. 클릭/키보드로 해당 시각 추가 |
| 계획만 표시, DO는 안내만 | 기존 집계 records의 실제 시각/소요를 읽기 전용 표시 |
| 날짜마다 PLAN/DO를 항상 반으로 분할 | 주간은 한 종류를 컬럼 전체 폭에 표시하고 선택 날짜 상세에서 함께 비교 |

`src/review/ReviewCalendar.tsx`와 `calendarGarden.css`는 기준 기능 브랜치에 없어 보존된 Preview worktree에서 읽기 참고했다. 공통 grid, 48px/hour, 분 단위 absolute 위치의 개념을 검토했으며 Preview의 저장/샘플 코드를 복사하지 않았다. Preview의 최소 높이 보정이나 무조건 50:50 분할 대신 새 순수 geometry와 겹침 분할을 사용한다.

## 수정 파일과 재사용 경계

- `src/lib/calendarTimeline.ts`: DOM/store와 독립적인 시각 파싱·표시 구간·겹침 lane·좌표 계산.
- `calendarTimeline.test.ts`: 7일 좌표, 분/높이, 연결된 겹침 그룹, 원본 불변, 종료 없는 표시, 자정/확장 시각.
- `CalendarTimeline.tsx`: 단일 grid/스크롤, 상단 목록, 주간 표시 모드, 선택일 비교, 읽기 전용 실제 기록 상세.
- `MoaCalendarPlanRoute.tsx`: 기존 day 모델을 타임라인 입력으로 projection. 기존 PlanEditor 및 CRUD 호출 유지. DO는 `aggregateActivity`의 records/unresolvedItems만 읽는다.
- `calendarPlan.css`: 공통 축/격자/분 단위 블록/반응형/헤더와 스크롤바 폭 정렬.
- `MoaFrame.tsx`: 선택적인 root className만 추가. 기존 호출의 기본 DOM class는 동일하다. 캘린더에만 고정 빈 dock을 숨기고 기존 FAB/모바일 5개 탭 유지. 마지막 내용은 스크롤 여백으로 보호한다.
- 기존 PLAN 브라우저 테스트: 새 상단 펼치기에서 숨겨진 항목을 실제로 펼쳐 편집하도록 helper만 변경. 검증 조건은 유지.
- 새 `moa-calendar-ui.test.mjs`: geometry 실제 DOM 좌표/높이, 배치·클릭·DO 불변과 3개 화면 크기를 검증.

## UI 사용

- **1440px 주간**: 월~일 7컬럼과 공통 축. `PLAN 보기` / `DO 보기`로 한 종류를 충분한 폭으로 표시한다. 날짜 헤더에 두 종류의 건수를 표시한다.
- **768px**: 7컬럼을 축소해 유지한다. 긴 제목은 블록에서 줄이고 선택일의 전체 제목·시각은 아래 상세에서 읽는다. 가로 넘침은 없다.
- **390px**: 선택 날짜 중심으로 PLAN/DO 두 레인을 같은 축에 비교한다. 주간 날짜 선택 버튼 또는 날짜/이전/다음으로 이동한다.
- 날짜 헤더 선택은 선택 날짜와 아래 상세를 갱신한다. 일간 버튼으로 선택일 비교를 큰 폭으로 볼 수 있다.
- 기본 시간창은 07:00 근처부터 시작하며 공통 본문만 스크롤한다. 주간 날짜/표시 모드 이동에도 시간 스크롤이 날짜별로 갈라지지 않는다.
- `전체 시간 보기`는 검토/전체 확인용 확장이다. 기본 화면이 매번 긴 24시간 공백을 펼치지는 않는다.
- 헤더/상단 목록은 본문 스크롤 바깥에 있어 시간 스크롤 중 유지된다. 축은 별도 반복 컬럼 없이 왼쪽에서 한 번만 표시한다. 스크롤바 폭도 헤더 grid에 반영하여 날짜의 X좌표를 맞춘다.
- 빈 PLAN 영역은 30분 단위로 클릭한다. 키보드는 날짜 컬럼의 09:00 위치로 Tab 진입 후 위/아래 화살표·Enter/Space로 추가할 수 있다. 기존 FAB로도 입력 가능하다.
- DO 클릭은 선택 날짜의 읽기 전용 상세로 이동한다. 입력/수정/삭제 액션이나 저장 요청은 없다.

## 위치·높이·겹침 정책

- 19:00~20:00 → top 912px, height 48px.
- 19:30~20:30 → top 936px, height 48px.
- 20:30~21:00 → top 984px, height 24px.
- 21:00~22:30 → height 72px.

높이는 내용 수나 카드 최소 높이로 늘리지 않는다. 짧은 블록은 제목을 우선하고 전체 시각·제목은 접근성 라벨/툴팁/상세에서 확인한다.

겹치는 구간의 연결 그룹마다 interval partitioning으로 최소 lane을 배정한다. 끝과 시작이 맞닿는 항목은 겹침으로 보지 않는다. 같은 그룹에서 나란히 폭을 나누며 정렬/배치는 원본 배열을 변경하지 않는다. 조밀한 기록의 전체 텍스트는 상세 목록에서 제공한다. 자동 이동·병합·삭제는 하지 않는다.

종료 시각이 없는 PLAN은 30분의 **표시용 구간**으로만 그린다. 저장된 planEnd는 계속 null이다. 시작만 있는 실제 기록은 저장된 소요 시간에 따라 표시하되 종료 시각을 저장하거나 입력값처럼 표시하지 않는다.

## 상단 목록과 실제 기록

상단은 날짜별 종일 일정 / 시간 미지정 TODO / 시작 시각 없는 실제 기록을 표시한다. 기본 2개 후 펼치기를 제공한다. 펼침은 공통 grid 행의 높이를 바꾸므로 특정 요일의 09:00만 밀리지 않는다. 날짜 미정 TODO는 별도 목록으로 유지하며 어느 요일에도 임의 배정하지 않는다.

DO는 `aggregateActivity`의 동일 결과를 사용하므로 TODO block/레거시 중복 제거, 독립 활동, snapshot 분류, 기록일 귀속, 계획 제외를 다시 구현하지 않는다. 수면/운동 로그를 자동 합산하지 않는다. 불명확한 시각은 상단에서 확인 필요로 보여주며 임의 위치를 생성하지 않는다. 유효한 저장 ISO 시작/종료는 자정 경계를 증명할 수 있고, 24시 이후의 확장 시각은 원래 기록일의 축에 표시한다. HH:mm 역전만으로 자정을 추정하지 않는다.

계획 없는 독립 DO도 표시한다. 실제 합계는 24시간 전체 생활 시간을 의미하지 않으며, 서로 겹친 실제 기록은 기존 합계에 모두 포함된다는 안내를 제공한다. 스냅샷·완료·DO 필드·시작/종료·기록 날짜를 수정하지 않는다.

## 검증

- 전체 단위 **229/229 통과** (기존 226 + 타임라인 3).
- 전체 브라우저/통합 **146/146 통과** (기존 142 + 새 UI 4).
- 최종 시각/레이아웃 보강 후 PLAN·UI·교차 화면 **16/16 통과**, 마지막 UI 표시/물리 좌표 보강 검사 **4/4 통과**.
- 7일 19:00의 실제 DOM Y좌표 일치, 19:30의 24px 차이, 30/60/90분의 실제 높이 24/48/72px 확인.
- 중복 항목의 실제 X영역이 겹치지 않음, 상단 목록 펼친 전후 7컬럼의 body Y좌표 일치, 헤더/body X좌표 일치.
- 17:30 빈 영역 클릭 → 17:30 입력 → 저장/블록, 기존 계획 수정 → 즉시 위치 변경.
- 종료 없는 새 TODO의 plan_end=null 유지, 표시만 30분.
- DO 클릭의 저장 요청 0건, 기존 TODO·status·block·activity·분류 스냅샷 원본 동등, 실제 합계 **105분 유지**.
- 390/768/1440px 가로 넘침 없음. PC 전체 주간 스크린샷은 **1440×2400 실제 브라우저**에서 전체 시간을 펼쳐 캡처했다.
- Production 빌드·fonts/colors 린트 통과. 기준 빌드와 출력 **19개 파일 SHA-256이 모두 동일**.
- 기존 calendar render 하네스 FAIL 0 / WARN 6 (기존 라벤더 경고), 6장. 새 UI는 별도 브라우저 검사로 실제 검토.
- 독립 tsc 설정은 없어 Vite/esbuild 변환과 실행 검사 범위이다. 실제 iPhone/PWA의 터치·키보드 검증은 수행하지 않았다.
- 자동화는 격리 메모리 Supabase/Auth/API만 사용했으며 운영 서비스 요청은 없다. 신규 UI의 외부 요청/JS 오류 0건.

실행: esbuild로 `src/lib/*.test.ts`를 Node ESM 번들 후 `node --test`; `node --test --test-concurrency=1 scripts/test/*.test.mjs`; `npm run build`; `npm run lint:fonts`; `npm run lint:colors`; `HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar`; `git diff --check`.

[검증 로그·빌드 비교](validation/moamoa-calendar-ui/) · [화면 상호작용 결과](screenshots/moamoa-calendar-ui/validation.json)

## 화면

- **[PC 전체 7일·24시간 / 1440×2400](screenshots/moamoa-calendar-ui/desktop-week-full.png)**
- [PC 기본 주간 / 1440×1024](screenshots/moamoa-calendar-ui/desktop-week.png)
- [PC DO 보기](screenshots/moamoa-calendar-ui/desktop-do.png)
- [태블릿 / 768×1024](screenshots/moamoa-calendar-ui/tablet-week.png)
- [모바일 선택일 PLAN/DO / 390×844](screenshots/moamoa-calendar-ui/mobile-compare.png)

## 다음 단계 경계

DO 입력/편집/삭제/타이머는 미구현이다. 읽기 전용 표시와 순수 geometry만 재사용하고 실제 저장은 기존 actual 모델의 확인 액션을 별도로 연결해야 한다. 드래그/리사이즈도 연결하지 않았다. 기존 PLAN·Provider·파서·집계 저장 정책 및 운영 DB·Storage·환경변수·Production은 변경하지 않았다. 기존 통합 브랜치와 Preview에 반영하려면 별도의 검토 후 이 UI 커밋과 의존성만 선별 적용한다.
