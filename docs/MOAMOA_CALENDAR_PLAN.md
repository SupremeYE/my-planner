# STEP 3B-6A — 캘린더 PLAN CRUD와 자연어 입력

## 기준·실행

- 기준: `codex/moamoa-step3b5-weekly-review`, `887f70ac1be0c8fe935965f7d090911867f4a1ea`.
- 독립 clone: `/workspace/my-planner-calendar-plan`, 새 브랜치 `codex/moamoa-step3b6a-calendar-plan`.
- 시작 시 기능 원격은 기준 SHA, Preview는 `9b623b9f6e9088a3b304bf0927c6d8c2e7e6be67`. 다른 환경의 미Push 작업은 보이지 않으므로 기존 클론을 수정하지 않는다.
- 개발 서버 `npm run dev`의 `/__moamoa-calendar-plan`. 기존 Auth/PlannerProvider 하위 개발 전용 라우트다. 실제 계정으로 접속하면 실제 데이터 경로이므로 **이번 검증은 테스트 서버의 메모리 Supabase alias와 샘플 계정으로만 수행**했다.
- Preview 연결은 이번 범위 밖이다. Preview·main·환경변수·운영 DB/Storage/Secret·배포 설정은 변경하지 않는다.

## 기존 코드 조사와 재사용

| 코드 | 확인한 구조 / 적용 |
|---|---|
| `quickParse.ts`, 기존 테스트 | 순수 파서의 태그·프로젝트·중요·유형 힌트·반복을 보존. 월요일 기준 이번/다음 주와 HH:mm 범위·시간 검증 추가 |
| `QuickAddInput.tsx` | 수동 유형 > 문장 프리픽스 > 기본 할 일. 시간만으로 Event 전환하지 않는 정책 재사용. 미리보기 중 태그 생성/DB 쓰기 없음 |
| `MoaTodoEditor.tsx`, `TodoModal.tsx` | 제목만 생성, 날짜 미정, planStart/planEnd·목표·태그 모델 유지. 기존 this/future/all 반복 수정 분기는 확인 저장 트랜잭션이 없어 새 경로에 연결하지 않음 |
| `CalendarView.tsx` | 기존 월/주/일 화면·가상 TODO 회차 유지. 새 전용 UI는 주간/일간과 날짜·빈 시간·블록 클릭을 제공 |
| `EventModal.tsx`, `api/events.ts` | 일정은 실제로 start_at/end_at 저장. 기존 변환·종일 날짜 규칙과 `getRepeatedEvents`를 재사용. 레거시 오류 로그 저장 함수 대신 새 확인 저장 경로 사용 |
| `store.tsx`, `db.ts` | 기존 ID·연결·상태·실제 시간 보존. 기존 TODO 변환 함수 본문을 그대로 `todoCodec.ts`로 옮겨 DB와 개발 화면이 공유. store 수정 없음 |
| `moaToday.ts`, `moaTodos.ts` | 읽기 전용 날짜 투영, 기간·반복 TODO 및 목표 연결 검토. 기존 `moaTodayData`를 직접 사용하고 집계 규칙 변경 없음 |
| `recurrenceExpansion.ts`, `recurrence.ts` | TODO 마스터/가상 회차/예외와 Event 확장 엔진 재사용. 조회만으로 회차를 저장하지 않음 |
| `SaveCoordinator`, `confirmedWrites` | 생성 UUID 고정, 중복 요청 합침, 명시적 재시도, 확인 결과 후 commit, 미확인 ID 보호 재사용 |

## 구현과 화면

- 일정: 제목·날짜·시작/종료·종일·기본 반복·태그·프로젝트, 일반 일정 수정·삭제.
- 할 일: 제목만 생성, 날짜 미정/시간 미지정, 예정 시간·태그·카테고리·주간 목표·프로젝트·기본 반복, 일반 할 일 수정·삭제.
- 날짜 클릭 → 일간, 날짜 입력/이전·다음 이동, 빈 시각 클릭 → 날짜·시각이 채워진 폼, 계획 클릭 → 상세·편집.
- 요일 경계·한글 날짜 헤더·오늘 강조. 시간 미지정/종일은 각 날짜의 시간표 위, 날짜 미정은 별도 목록. 시간표에 같은 항목을 중복 표시하지 않는다.
- PLAN과 DO 후속 영역 라벨 분리. 24시간 목록은 독립 스크롤하며 각 블록에 시작/종료·유형 표시. 기본 07시 부근에서 시작한다.
- 1440px 7열, 태블릿 2열, 모바일 1열. 가로 넘침 없이 같은 날짜별 모델을 사용한다. 드래그·리사이즈는 연결하지 않았다.
- PC 모달/모바일 바텀시트, 본문 스크롤과 고정 저장 footer. visualViewport 높이 반영, safe area 고려. 입력 폐기 확인과 저장 중 닫기 금지. 실물 키보드는 미검증이다.

## 자연어 결과

논리적 오늘 `2026-12-31` 기준:

| 입력 | 결과 |
|---|---|
| 다음주 월요일 운동가기 | 할 일 / 운동가기 / 2027-01-04 |
| 다음주 월요일 운동가기 #자기계발 19:00~20:00 | 위 날짜 / 19:00~20:00 / 기존 자기계발 태그 ID |
| 18:00 퇴근 | 퇴근 / 선택 날짜가 있으면 해당 날짜, 없으면 논리적 오늘 / 18:00 |
| 내일 오후 3시 병원 | 병원 / 2027-01-01 / 15:00 |
| 빨래개기 #집안일 | 빨래개기 / 날짜 미정 / 집안일 태그 후보 |
| 매주 월요일 운동가기 | 2027-01-04 시작 / 월요일 반복 |
| 일정 내일 10시 회의 | 일정 힌트 / 2027-01-01 / 10:00. 수동 유형 선택이 우선 |

폼의 **해석 확인**은 저장하지 않는다. 제목·날짜·시각·태그·유형을 직접 수정한 뒤 저장한다. 상대 날짜는 logical today, 날짜 없는 단일 시각은 선택 날짜를 사용한다. 날짜와 시간이 모두 없는 일반 제목은 날짜 미정이다.

잘못된 시간은 파싱하지 않고 안내한다. 수정 또는 명시적 시간 해제가 필요하다. 역전 범위는 자정 경계 후보로 안내하며, 저장 시 날짜별로 나누도록 요구한다. 같은 시작·종료도 거부한다. 모호한 날짜 표현 전체를 해석하는 AI 파서는 아니다. 명시하지 않은 종료 시간을 임의로 생성하지 않으며, 일반 일정은 종일 또는 시작/종료를 입력해야 한다.

기존 사용자 정의 태그는 이름으로 ID를 찾고 저장된 미등록/과거 태그 ID도 보존한다. **새 태그 생성은 지원하지 않는다.** 알 수 없는 #태그는 안내 후 기존 태그 선택/해제 필요. 다중 엔터티 태그 생성의 부분 실패를 숨기지 않기 위한 제한이다.

## 확인 저장·보존

- UUID는 폼 세션 동안 고정. 같은 버튼 중복/진행 중 닫기 차단. 오류 초안 유지, 재시도는 같은 요청/ID.
- 신규는 stable-ID upsert DO NOTHING 후 실제 내용 확인. 응답 유실은 ID 재조회로 확인한다.
- 기존은 변경된 PLAN 필드만 수정. 바뀐 필드와 반복 메타데이터의 이전 값으로 조건부 UPDATE, null은 IS NULL, 배열은 PostgreSQL 배열 리터럴로 비교한다. 같은 필드 동시 수정은 충돌로 표시한다.
- 알 수 없는 컬럼·메모·상태·ID·프로젝트·목표·반복 메타데이터·실제 시각은 전체 행 덮어쓰기 없이 보존한다. 요청한 프로젝트·목표 변경은 해당 필드만 수정한다.
- Realtime/재접속/화면 복귀 재조회. 오래된 읽기는 generation으로 무시하며, pending/error ID는 기존 확인 상태를 유지한다. 조회 실패는 빈 목록으로 바꾸지 않는다.
- 일반 삭제도 확인 UI와 삭제 결과/부재 조회를 거친다. 완료/실제 시각/시간 블록이 있는 항목은 삭제 거부한다. 삭제 실패에도 일반 저장 상태 영역에서 오류와 재시도를 표시한다.
- 실제 활동이 연결된 기존 항목의 날짜·태그·카테고리 변경은 제한한다. 제목·예정 시각 수정으로 실제 활동의 날짜/태그 귀속이 바뀌지 않는다.
- 기본 매일/매주/평일 반복 생성과 기존 회차 조회 지원. **기존 반복의 수정·삭제와 고급 반복/범위 선택은 지원하지 않는다.** 마스터·예외·가상 ID를 일반 계획처럼 저장하지 않는다.

## PLAN / DO 경계와 다음 단계

TODO.planStart/planEnd와 Event.startTime/endTime만 PLAN이다. todo_time_blocks, ActivityEntry, doStart/doEnd, status/completed는 PLAN 수정에서 생성/변경하지 않는다. 계획 시간 등록·변경 후 `aggregateActivity`의 실제 합계 불변을 테스트한다. 완료 체크·타이머·DO CRUD는 새 화면에 연결하지 않는다.

다음 DO 단계에서는 계획과 무관한 ActivityEntry 생성, TODO 연결 블록, Event 실제 시각, 타이머의 별도 confirmed 저장 controller를 사용해야 한다. 계획 블록을 실제 기록으로 자동 복제하지 않고 기존 snapshot·기록 날짜 정책을 재사용한다. 향후 Preview는 새 route를 복사하기보다 repository/hook/editor 경계를 검토해 기존 ReviewCalendar에 선별 연결한다.

## 실제 DB 연결 전 검증

이번 테스트는 메모리 DB·모의 API만 사용했다. 운영 스키마/권한/인덱스는 조회하지 않았다. 특히 Event tags 컬럼은 기존 읽기 코드에서 선택적 메타데이터이므로 실제 컬럼 존재·쓰기 권한을 확인해야 한다. 최초 신규 일정의 소유권 기본값/RLS INSERT·SELECT·UPDATE·DELETE, Realtime publication, nullable/배열 컬럼과 PostgREST wire 동작도 확인 대상이다.

클라이언트의 연결 시간 블록 조회와 삭제 사이에는 DB 트랜잭션이 없다. 다른 기기가 그 사이 실제 활동을 추가하는 경쟁까지 보장하려면 서버 RPC/트랜잭션·FK 정책 검증이 필요하다. 현재 원자적 조건 수정은 단일 행 변경 감지를 보장하며 다중 테이블 잠금 보장은 아니다. 운영 마이그레이션은 적용하지 않았다.

## 테스트·화면

```sh
node --test scripts/test/moa-calendar-plan.test.mjs
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar,reviews
git diff --check
```

단위 테스트는 src/lib/*.test.ts를 esbuild Node ESM 번들 후 node --test로 실행한다. 기존 회귀가 재생성한 과거 스크린샷은 복구 archive를 확인한 후 기준 Git 버전으로 복원한다.

[PC 계획표](screenshots/moamoa-calendar-plan/desktop-timed-plan.png) · [모바일](screenshots/moamoa-calendar-plan/mobile-plan.png) · [태블릿](screenshots/moamoa-calendar-plan/tablet-plan.png) · [모바일 입력](screenshots/moamoa-calendar-plan/mobile-editor.png) · [저장 실패](screenshots/moamoa-calendar-plan/desktop-save-failure.png)

## 최종 검증 결과

- 단위 **223/223** 통과(기능 기준 210 + PLAN/파서 13). ISO 주차·선택 날짜·시간 검증, 확인 CRUD·부분 수정·충돌·응답 유실·반복 보호와 실제 집계 60분 불변을 포함한다.
- 전체 브라우저·API 회귀 **138/138** 통과. 음악·독서·문화·음식·시간 분석·오늘·할 일·주간 회고·레거시 저장/목표 화면을 포함한다.
- PLAN 브라우저 8개에는 신규·변경·삭제, 예정 시간 해제, 다음 주 파싱·태그 ID·유형 우선순위, 읽기 전 쓰기 0, 실패·중복·응답 유실·동시 수정, 조회 오류·실제 기록 삭제 차단, 기존 원본·DO 불변, 390/768/1440px·닫기 확인·키보드 높이 축소를 포함한다.
- 초반 병행 검증에서 기존 독서 테스트 2건이 각각 다른 단계에서 시간 초과했다. 독서 단독 12/12 및 다른 브라우저 작업을 마친 뒤 전체 단독 순차 실행 138/138로 재확인했다. 독서 제품 코드나 기존 테스트를 변경하거나 timeout을 늘리지 않았다.
- 렌더 14장 **FAIL 0 / WARN 14**. 기존 제품 라벤더 사용 경고이며 해당 제품 UI는 수정하지 않았다.
- Production 산출물은 기준과 동일하게 19개. 17개 해시 동일, 공용 파서 개선으로 JS와 그 파일을 참조하는 index.html만 변경. 새 개발 경로·PLAN UI/CSS·확인 저장 코드 제외 확인.
- 폰트 위반 0, 색상 위반 0(라벤더 379/기준 379), diff 검사 통과. 외부 서비스 요청은 테스트에서 차단/모의 응답했다. 운영 DB/API/Storage 호출 없이 실행했다.
- 모바일 키보드는 Chromium에서 입력 영역 포커스와 viewport 축소로 검증했으며 실물 키보드 검증을 대체하지 않는다.
- 작업 중 Preview 원격이 별도 작업으로 `4ffefb2bc5d4e47f990e0ac95235d3c4b5e5db8b`로 진행된 것을 확인했다. 이번 변경은 그 브랜치에 적용하지 않는다.

[기계 판독 검증 요약](screenshots/moamoa-calendar-plan/verification.json)에 산출물 해시와 격리 결과를 보존한다. 추가 화면: [모바일 PLAN 블록](screenshots/moamoa-calendar-plan/mobile-timed-plan.png) · [태블릿 PLAN 블록](screenshots/moamoa-calendar-plan/tablet-timed-plan.png) · [키보드 높이 축소](screenshots/moamoa-calendar-plan/mobile-keyboard-height.png).
