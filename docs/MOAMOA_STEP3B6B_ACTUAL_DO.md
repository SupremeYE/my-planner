# MoaMoa STEP 3B-6B — DO 실제 수행 기록

## 기준과 접근 경로

- 기능 기준: `codex/moamoa-step3b6a-calendar-ui`, `5aa02a7c3f1e3ff557de4042a9f20431aa856202`.
- 독립 클론: `/workspace/moamoa-actual-do`, 작업 브랜치 `codex/moamoa-step3b6b-actual-do`.
- 기존 `/__moamoa-calendar-plan` 개발 전용 경로에서 PLAN과 새 DO 기능을 함께 사용한다. 일반 서비스 라우터와 기본 홈은 변경하지 않았다.
- 참고 Preview는 `8f6799f3c942df344495d05d6e1023c5b4ee423e`. Preview 코드를 병합하지 않았으며 해당 브랜치에는 Push하지 않는다.
- 운영 Supabase·Storage·API·Secret·배포 환경은 조회하거나 수정하지 않았다. 데이터 검증은 메모리 전송 계층으로 수행했다.

## 기존 방식 분석

| 모델/경로 | 기존 제약 | 이번 적용 |
|---|---|---|
| activity_entries | 소요·날짜·이름·메모·카테고리 스냅샷·선택적 실제 ISO 시각 지원. 입력 시 소요를 따로 맞춰야 했음 | 실제 시작/종료 입력 시 소요 자동 계산. 기록 ID/operation ID 유지. 수정 CAS·삭제 확인 추가 |
| todo_time_blocks | start_time/end_time은 text HH:mm, elapsed_sec는 실제 초. 기존 간편 기록은 소요만 입력하고 시각이 있으면 편집 금지 | 동일 테이블에 실제 시각과 소요 저장. 시각·소요·기록 날짜·기록 자체의 분류 스냅샷 수정/삭제 지원 |
| legacy TODO do_* | 작업 블록과 중복 집계될 수 있어 첫 새 세션 시 결정적 ID로 원본 보존 블록을 생성하는 기존 정책 | preservedLegacyBlock / legacyBlockId와 기존 집계를 유지. 보존용 블록 수정/삭제 및 레거시 재등장 위험 삭제 제한 유지 |
| Event doStart/doEnd | events v2 계획은 start_at/end_at. 마이그레이션에는 do_start/do_end text HH:mm만 있고 별도 실제 날짜·회차 식별 저장 정책이 부족. 기존 경로는 낙관적 저장 포함 | **조회 전용 유지**. 이번 작업에서 Event 실제 저장·수정·삭제를 추측해서 구현하지 않음 |
| 저장 | SaveCoordinator, confirmedWrites, Provider Realtime | 기존 coordinator와 확인 저장을 재사용. 실제 기록용 조건부 수정/삭제를 별도 작은 wrapper로 확장 |

스키마 근거는 `supabase/migrations/20260714020000_create_todo_time_blocks.sql`, `20260718000000_add_events_actual_do_columns.sql`, 기존 `docs/sql-drafts/moamoa_activity_entries.sql`이다. 새 테이블·컬럼·마이그레이션을 만들거나 적용하지 않았다. 분류 보존 SQL이 적용되지 않은 환경에서는 기존 activityStorageStatus 차단 안내를 유지한다.

## 변경 및 재사용 파일

- `src/lib/actualDo.ts`: 실제 날짜/시각 검증·초 계산, 명시적 자정 경계의 블록 clock 변환, 타이머 세션 어댑터 계약.
- `src/lib/actualWrites.ts`: confirmedWrites를 사용한 변경 필드 CAS, 같은 필드 충돌 방지, 삭제 전 원본 비교/삭제 후 부재 확인, 원본 TODO/operation ID 변경 차단.
- `activityRepository.ts`: actualWrites 적용. Postgres의 Z / +00:00 표현 차이 때문에 동일한 시각을 불일치로 판단하지 않도록 encode 시각 정규화.
- `db.ts`: 기존 time block 코덱·테이블에 actualWrites 적용. 다른 DB 계층은 재작성하지 않음.
- `store.tsx`: recordTodoActualConfirmed 추가, addManualTimeConfirmed는 이 경로로 위임. 기존 amendTimeBlockConfirmed의 시각 편집 제한을 안전 검증으로 대체. 동일 TODO의 실제 저장은 큐에서 순차 처리.
- `useActivityStorage.ts`: 편집 시작 시 원본 스냅샷을 선택적으로 받아, Realtime 이후 새 상태를 편집 기준으로 오인하지 않도록 처리. 삭제도 원본 비교 지원.
- `MoaActivitySheet.tsx`: 독립/TODO 연결 선택, 시각·소요·분류·메모(지원 범위)·날짜 입력, 수정·삭제 확인. 초안/상태/명시적 재시도는 기존 MoaDialog/SaveStatus 사용.
- `MoaCalendarPlanRoute.tsx`, `CalendarTimeline.tsx`, `calendarPlan.css`: 빈 DO 영역 추가, DO 블록/시각 미지정 기록 편집, 기존 TODO의 PLAN 상세에서 실제 기록 연결, 빠른 기록의 PLAN/DO 선택. 공통 시간축 계산은 그대로 사용.
- `MoaTimeAnalysisRoute.tsx`: 시각 있는 작업 블록도 같은 편집기로 열고 삭제 확인 시 원본을 보존.
- `MoaTodayRoute.tsx`, `MoaTodosRoute.tsx`: 모아모아 완료 체크는 status만 저장. 완료만으로 임의 do_start/do_end 마커를 만들지 않음. 기존 My Planner의 helper와 레거시 기록은 변경하지 않음.
- 테스트: `actualDo.test.ts`, `moa-actual-do.test.mjs`, memory-supabase JSON/null 비교 보완. 기존 calendar UI 테스트는 DO 클릭 시 편집기를 열고 취소하여 쓰기 0건/원본·집계 불변을 확인하도록 갱신. TODO 완료 테스트에는 실제 시각 필드가 null로 유지되는 단언을 추가.
- 기존 `MoaTimeSheet`의 소요 전용 UI/API는 유지한다. CalendarTimeline의 DO 콜백은 선택적이므로, 후속 통합 없이 사용하는 읽기 전용 호출부도 유지된다.

## PLAN/DO 연결과 실제 동작

1. 빈 DO 칸 클릭 → 해당 날짜·실제 시작 시각을 입력 폼에 제안한다. 저장하기 전에는 실제 기록을 만들지 않는다.
2. 빨래 개기 20:30~21:00 → activity_entries 한 행, 1,800초, DO 20:30 위치에 30분 높이로 표시. 숨겨진 TODO를 만들지 않는다.
3. 운동하기 PLAN 19:00~20:00 → 할 일 연결 선택 후 실제 21:00~22:00 → 원래 TODO ID를 가리키는 todo_time_blocks 한 행, 3,600초. PLAN 값은 그대로 유지한다.
4. PLAN과 같은 시각의 실제 세션도 별도 블록으로 저장한다. 같은 TODO의 여러 세션은 각 ID로 누적한다.
5. DO를 21:30~22:00으로 수정 → 같은 블록 ID로 1,800초 및 top/height 갱신. 원본 TODO·PLAN·완료·목표 관계는 수정하지 않는다.
6. 소요만 저장한 기록은 시작/종료가 null이며 상단 시각 미지정 영역에 표시한다. 임의 시간대 배치를 하지 않는다.
7. 실제 기록 삭제 확인 → 서버 부재 확인 뒤 목록/집계에서 제거. 삭제 실패나 확인 실패 상태에서는 기존 확인 목록을 유지한다.
8. 빠른 기록 버튼 → 할 일 계획 / 일정 계획 / 실제 활동 DO 선택. 기존 PLAN 입력을 없애지 않는다.
9. 시간 분석과 캘린더는 같은 Provider의 activityEntries/timeBlocks를 사용한다. 새로고침 검증은 테스트 서버 상태를 재주입하여 재조회하는 방식이며 브라우저 로컬 오프라인 저장을 의미하지 않는다.

## 시간·분류·보존 기준

- 실제 시작/종료를 모두 입력하면 유효한 날짜·시각 차이로 초를 계산한다. 반대 순서의 HH:mm만 보고 다음 날로 추정하지 않는다.
- 독립 활동은 실제 ISO 시작/종료와 기록 날짜를 각각 보존한다. 선택 기록 날짜에 소요 전체를 귀속하며 자동 분할하지 않는다.
- TODO 블록은 현재 모델이 clock 문자열만 보관하므로, 기록 날짜 또는 명시된 다음 날 범위의 실제 시각만 지원한다. 정확한 다음 날 날짜를 입력한 경우에만 시작/종료를 24:15~24:45 같은 기존 확장 시각으로 변환한다. 기록 날짜보다 앞선 시각이나 이틀 뒤 이상의 시각은 거부한다. 날짜 정보를 잃거나 역전만으로 다음 날을 추정하는 변환은 하지 않는다.
- 새 시각 입력의 소요는 간격과 맞아야 한다. 기존 타이머의 일시정지 제외 소요 및 분 단위 clock 정밀도 차이는 시각/소요/날짜를 그대로 두는 편집에서는 보존하고 임의 보정하지 않는다.
- 독립 활동은 메모·대표 카테고리 1개, TODO 블록은 기존 분류 스냅샷을 지원한다. 블록에는 메모 컬럼이 없어 메모를 저장하는 것처럼 표시하지 않는다.
- 기존 복수 태그 스냅샷과 균등 분할은 그대로 유지한다. 사용자가 명시적으로 해당 기록의 카테고리를 바꾼 경우에만 그 블록 스냅샷을 수정한다. TODO 태그나 다른 과거 기록은 바꾸지 않는다.
- aggregateActivity/timeAggregation/useTimeReport의 집계 규칙은 변경하지 않았다. 미분류도 총 실제 시간에 포함한다. PLAN, 완료 체크, 수면/운동 라이프 로그는 자동 합산하지 않는다.
- 반복 TODO의 마스터·가상 회차·예외 시간 기록은 정확한 회차 저장 정책이 확정되기 전까지 제한한다. 기존 부모 ID에 잘못 저장하는 우회는 없다.
- 레거시 do_*와 분류 스냅샷 및 기존 모든 기록은 재분류/초기화하지 않았다. 기존 보존용 블록은 편집/삭제를 제한한다.

## 저장 신뢰성과 충돌

- 새 기록 ID를 폼에서 한 번 생성한다. activity_entries의 operation_id도 같은 값이다. TODO 블록의 PK를 세션 operation ID로 사용한다.
- 같은 요청의 중복 클릭은 UI와 coordinator가 막는다. 명시적 재시도는 동일 ID와 원래 요청을 사용한다. 다른 세션은 새로운 ID로 정상 누적한다.
- 생성/삭제 응답 유실 시 초안/마지막 확인 목록과 오류 상태를 유지한다. 재시도는 같은 ID 조회·중복 무시 upsert 또는 부재 확인을 수행한다. 검증하지 못한 성공을 표시하지 않는다.
- 수정은 바뀐 필드만 보내고 DB 조건으로 읽은 값을 비교한다. 같은 필드 변경, 요청 이후 변경, 연결 TODO/operation ID 변경은 차단한다. 관계없는 필드는 보존한다.
- 편집기의 원본 스냅샷과 Provider 최신 상태를 분리했다. Realtime이 도착해도 기존 초안을 새로운 기준으로 덮어쓰지 않는다.
- Realtime은 기존 Provider 구독을 재사용하며 pending/error ID와 revision 보호를 유지한다. 실패한 조회로 확인 목록을 비우지 않는다.
- 동일 TODO에서 첫 블록/레거시 보존이 충돌하지 않도록 로컬 저장 큐를 사용한다. DB 간 동시성은 조건부 쓰기와 고정 PK가 담당하며 브라우저 큐를 서버 트랜잭션처럼 표현하지 않는다.

## 타이머 STEP 3B-6C 경계

`ActualSession` → `timerSessionBlock()` → `recordTodoActualConfirmed()` 경로를 사용할 수 있다.

- sessionId를 블록 ID로 사용하여 같은 세션을 여러 번 저장하지 않음.
- startedAt/endedAt는 실제 날짜가 있는 값, elapsedSec는 일시정지 제외 실제 초.
- pausedSec가 제공되면 전체 간격 - pausedSec = elapsedSec를 검증한다.
- 현재 모델은 순 소요와 clock을 보관한다. 일시정지 구간 목록·세션 추가 메타데이터는 현 스키마에 컬럼이 없으며 향후 별도 승인된 모델/컨트롤러 검토가 필요하다. TODO 블록 clock은 분 단위여서 초 단위 시작/종료 원문 전체 보존도 후속 모델 검토 대상이다. 어댑터가 표현할 수 없는 0분 clock/실제 소요 관계는 시각을 조작하지 않고 거부한다.
- 기존 recordActiveTimer의 완료/dual-write 정책을 이번 작업에서 재설계하지 않았다. 다음 단계에서 기존 세션 ID 재사용과 TODO 완료 정책을 명시적으로 검토해야 한다.

## 검증 및 산출물

- 단위 **236개 통과**: 실제 시각/자정/날짜·타이머 순 소요, CAS 전후 충돌·원본 보존·삭제·중복/응답 유실·타임스탬프 정규화·명시적 다음 날 시작, 기존 집계·파서·주차·목표 테스트 포함.
- 전체 브라우저 **150개 통과**. 최종 `docs/validation/moamoa-actual-do/browser-final.tap` 참조. 소스 변경 중 실행에서 DOM detached 타임아웃이 발생하여 소스를 고정한 뒤 전체 재실행했다. 테스트 삭제나 조건 완화는 하지 않았다. 전체 회귀 이후 명시적 다음 날 시각 경계와 원문 보존/삭제 반환값을 보완한 부분은 단위 및 관련 DO·시간 분석 브라우저 15개를 추가 재검증했다.
- 새 DO 브라우저 **4개 통과** (부모 + 1440/768/390px). 실제 클릭 CRUD, 같은/다른 PLAN·DO 시각, 시각/분류/날짜/메모 편집, 삭제, 시각 없는 기록, 복수/동시 세션, 실패/응답 유실/재시도, Realtime 충돌, 원본 TODO/Event/목표/기존 기록 불변, 재조회, 일/주 합계 검증.
- Production 빌드·fonts/colors·diff 통과. render:check calendar는 FAIL 0, 기존 일반 캘린더 라벤더 검출 WARN 6.
- 일반 빌드 19개 산출물 중 17개 동일. Provider/실제 기록 저장·검증 공용 코드 변경으로 JS 및 이를 참조하는 HTML만 변경. CSS·폰트·아이콘·SW·manifest는 동일. 개발용 라우트/새 DO UI와 테스트 샘플은 일반 빌드에 포함되지 않는다.
- 별도 tsconfig/tsc 검사 명령은 없다. Vite/esbuild 변환·빌드와 실행 검증을 수행했으며 독립 전체 타입 검사로 보고하지 않는다.
- 새 DO E2E는 테스트 빌드의 외부 폰트 import를 제거하고 실제 SDK를 메모리 전송으로 대체했다. 외부 API/Storage 요청은 차단하며 허용하지 않은 외부 요청·페이지 JS 오류는 0건이다. 운영 Supabase 검증은 수행하지 않았다.
- 실기기 iPhone Safari/PWA·카메라/네트워크 검증을 수행한 것으로 표시하지 않는다. 실제 모바일 키보드·안전 영역은 실기기 확인이 남아 있다.

스크린샷: `docs/screenshots/moamoa-actual-do/`.

- `desktop-plan-do-full.png`: 1440px 7일 공통 시간축, DO 운동하기 21:00~22:00과 선택일 PLAN 19:00~20:00 비교.
- `desktop-week-full.png`: 전체 DO 주간 시간표·자정 확장 시각.
- `*-independent.png`: 빨래 개기 20:30~21:00.
- `*-linked-editor.png`, `*-linked-session.png`: TODO 연결 실제 입력과 저장 결과.
- `*-moved.png`: 21:30~22:00으로 이동한 30분 블록.
- `*-failure.png`: 저장 실패·초안·명시적 재시도.
- `*-timeline.png`, `validation.json`: 세 화면 크기 시간표, 데이터 보존/외부 요청/오류 검증 결과.

## Preview 선별 통합 시

1. 새 저장/검증 함수와 Provider·activityRepository·db 변경을 먼저 통합한다. Preview의 주간 회고 고유성 검사 등을 가진 메모리 계층을 통째로 덮어쓰지 말고 JSON/null 비교 지원만 필요한 만큼 추가한다.
2. ReviewCalendar의 기존 월간·주간 플래너·회고를 유지한다. 현재 actual.records의 block/activity에만 편집 콜백을 붙이고 Event/legacy는 조회 전용으로 둔다.
3. 기존 ReviewShell·사이드바를 유지하고 CalendarTimeline onAddActual, MoaActivitySheet, 빠른 기록 선택만 연결한다. 이 기능 브랜치의 개발용 프레임 전체를 복사하지 않는다.
4. 기존 Preview 완료 adapter와 새 모아모아 status-only 동작의 중복을 정리한다. 기존 실제 기록은 지우지 않는다.
5. Preview의 SDK 제외·CSP·환경변수 차단·메모리 저장·새로고침 초기화 정책을 재검증하고 DO E2E를 정적 Preview에서도 실행한다.
6. 실제 Supabase 적용은 별도 승인·격리 DB에서 기존 스키마/RLS/Realtime/분류 보존 SQL 적용 상태와 응답 형식을 확인한 뒤 진행한다.
