# STEP 3B-6A PLAN 선별 통합

## 기준과 보존

| 항목 | 값 |
| --- | --- |
| 공통 기준 | `887f70ac1be0c8fe935965f7d090911867f4a1ea` |
| 원격 구현 | `b3d2fdb9181b8a70143d5a568456c688fa2c4443` |
| 보존 로컬 구현 | `56ccb40a469fe94179f4fe4204c8566c173d77f6` |
| 통합 브랜치 | `codex/moamoa-step3b6a-plan-reconcile` |
| 독립 작업 공간 | `/workspace/moamoa-plan-reconcile` |

양쪽 Git 객체와 깨끗한 작업 트리를 확인했다. 로컬 복구 사본 `/workspace/moamoa-backups/calendar-plan-local`의 29개 파일을 SHA-256 매니페스트로 재검증했다. 원격 커밋에서 별도 worktree를 만들었으며 로컬 전체 커밋의 merge/cherry-pick은 수행하지 않았다.

## 상세 비교 및 결정

| 기능/파일 | 원격 구현 | 로컬 구현 | 최종 결정과 이유 |
| --- | --- | --- | --- |
| `quickParse.ts` | ISO 이번/다음 주, 시간 범위·AM/PM 검증, issues, 선택 날짜, 자정 경고 | 같은 주차/선택 날짜와 원문, HH~HH, warnings | **부분 통합**: 더 엄격한 원격 시간 검증 유지 + 로컬 원문·HH~HH 지원. 파서는 하나 |
| `quickParse.test.ts` / `calendarPlan.test.ts` | 기존 파서 회귀 + 저장소·파서 단위 테스트 | 파서 2개 확장 테스트, UI에서 저장소 검증 | **원격 유지·보강**: 동등 사례는 원격 테스트로 유지하고 원문/약식/일요일·Event 태그·경쟁 CAS만 추가 |
| `calendarPlanRepository.ts` / 로컬 `calendarPlan.ts` | raw row, 최신 조회, 변경 컬럼 CAS, 실패 재조회, 완료/DO 삭제 보호 | 기존 Event 코덱·confirmedWrites, 충돌 사전 조회, DO 날짜 보호 | **원격 유지·보강**: 서버 갱신 조건이 있는 원격 저장소 하나 사용. 로컬 별도 저장소는 가져오지 않음 |
| `todoCodec.ts` | db에서 추출한 동일 TODO 코덱 | db 내부 코덱 재사용 | **원격 유지**: 변환을 복제하지 않고 Provider와 hook이 같은 코덱 사용 |
| `api/events.ts` | v2 `start_at/end_at` 코덱 export | 같은 코덱 export + 저장소에서 사용 | **원격 유지**: v2 코덱과 반복 확장 재사용. 구형 db의 `date/start_time` 형식 신규 사용 없음 |
| `db.ts` | 기존 TODO 코덱 정리, PLAN hook이 별도로 저장 | Provider에 Event 확인 저장 확장 | **부분 통합**: 원격 저장소를 db.plans로 제공하고 예외를 던지는 Event 확인 조회 추가 |
| `store.tsx` | PLAN 쓰기/목록을 모름 | Provider 확인 저장 후 공유 TODO/Event 갱신 | **로컬 접근 채택·보강**: 원격 CAS 저장소를 Provider의 기존 SaveCoordinator로 실행, 확정 후 같은 ref/state 갱신 |
| `useCalendarPlans.ts` | 화면별 rows/state/coordinator, 자체 Realtime | 대응 hook 없음, Provider 직접 호출 | **부분 통합**: API 모양은 유지하되 Provider의 읽기 전용 projection/액션 어댑터로 교체. 자체 목록·coordinator·Realtime 제거 |
| 화면 `MoaCalendarPlanRoute.tsx` / 편집기 | 프로젝트·분류·dirty 확인, visualViewport·키보드, 시간 해제, 오류 재시도 | 주간 7열 절대 위치·분 단위 높이, 명시 종료 날짜 | **원격 유지·보강**: 성숙한 입력/키보드/취소 UI 유지. 초기 읽기 중 추가 차단, Event 태그 편집 제한 |
| 캘린더 CSS | 일별 카드·시간별 스크롤, 모바일/태블릿 grid | 연속 24시간 7열, 분 단위 블록 높이 | **원격 유지**: 두 레이아웃을 합치지 않음. 정밀 분 단위 위치/중첩 lane은 후속 UI 개선 |
| 반복 | 새 반복 생성, 기존 마스터/회차/예외 읽기 전용 | 같음, Provider 확정 직후 반복 재확장 | **부분 통합**: Provider commit에서 같은 v2 확장을 사용하여 새 반복도 즉시 반영 |
| 자정 범위 | 경고 + 날짜별 분리 안내 | 종료 날짜를 직접 지정 | **보류**: 기존 여러 날짜 기간 보존, 신규 자정 범위는 명시 안내/거부. 새 기간 편집 UI를 중복 도입하지 않음 |
| Event 태그 | 확인되지 않은 `tags`를 신규 payload에 포함 | UI에서 제한 | **로컬 정책 채택**: UI 비활성 + 저장소 생성/갱신에서 신규 tags 쓰기 제외, 기존 값 보존 |
| PLAN/DO 보호 | 실제 기록의 날짜/태그/분류 보호, CAS | 종료 날짜 이동과 삭제 추가 보호 | **부분 통합**: 실제 Event의 종료 날짜 이동도 보호. CAS에 actual/completed/status/분류·날짜 소유 필드 추가 |
| 기존/신규 브라우저 테스트 | 강한 CRUD·재시도·DO·반복·키보드 검사 | 동등 CRUD·분류 보존·메모 충돌·집계 검사 | **원격 유지·보강**: 기존 조건 유지, 교차 화면 E2E 및 단위 CAS 보강. 중복 화면 테스트 파일은 추가하지 않음 |

## 단일 저장 구조

```text
PLAN 편집기
  → useCalendarPlans (Provider projection/액션 어댑터)
  → PlannerProvider.saveCalendarPlan
  → 기존 Provider SaveCoordinator (todos:ID / events:ID)
  → calendarPlanRepository (최신 읽기 + 변경 컬럼 CAS + 응답 확인/재조회)
  → 확정된 row를 기존 codec으로 변환
  → Provider todosRef/todos 또는 eventsRef/events 갱신
  → 오늘 / 할 일 / 목표 / 캘린더 / PLAN projection
```

hook 안에 가변 records 배열이나 SaveCoordinator가 없다. TODO는 Provider.todos를 `fromTodo`로, Event는 Provider.events를 v2 코덱으로 projection한다. 반복 Event는 source ID로 중복 제거하며 원본 startDate/endDate를 사용한다. 이벤트 timestamp 비교는 `start_at/end_at`에 한해 같은 instant로 정규화하여 PostgreSQL의 UTC 표기와 클라이언트 지역 표기를 동등하게 처리한다. 제목 등 일반 문자열은 정규화하지 않는다.

확정 쓰기 후 Provider의 동일 ID가 즉시 갱신된다. 새 반복 Event는 확정 원본 row를 기존 확장 함수로 확장해 같은 목록에 반영한다. 별도 PLAN 목록이 남아 화면 이동 후 오래된 값이 다시 보이는 구조를 제거했다. 수동 재조회·online/visibility 복귀도 Provider 액션을 사용한다. 선택한 Event 조회 기간은 Provider의 공통 범위를 확장하며(2030년 등 기본 범위 밖도 검증), 원격 구현의 과거/미래 탐색을 기본 캐시 범위로 좁히지 않는다. 초기 로드·수동 조회·Realtime은 공통 generation과 revision을 확인해 늦은 성공/실패 응답이 새 결과를 덮어쓰지 않게 한다. Provider Realtime은 revision/protected ID로 저장 도중 오래된 응답을 배제하고 실패한 조회로 마지막 확인 목록을 지우지 않는다.

기존 서비스의 낙관적 Event 편집 액션은 기존 라우트에 남아 있지만 **새 PLAN 경로에서는 호출하지 않는다**. 기존 앱 전체 저장 계층을 이번에 재작성하지 않았다.

## 저장·데이터 보호

- 생성 UUID와 불확실한 요청을 유지하며 중복 클릭을 차단한다. 서버 오류는 초안/오류 상태로 남고 명시적으로 재시도한다.
- 응답 유실은 같은 ID로 읽어 확인하거나 같은 요청으로 재시도한다. 읽기/쓰기의 정상 확인 전에 Provider에 성공 데이터를 넣지 않는다.
- 수정은 whitelist 내 변경 컬럼만 쓰며, 읽은 최신 필드에 대한 UPDATE 조건으로 동일 필드 충돌을 차단한다. 다른 기기의 메모·알 수 없는 기존 컬럼은 덮어쓰지 않는다.
- 실제 값/완료/반복/날짜/분류가 조회 이후 바뀌면 CAS가 갱신을 거부한다. TODO 연결 블록 조회 실패도 보호 실패로 처리한다.
- 실제 기록/완료가 있는 삭제 및 기존 반복 수정·삭제는 차단한다. Event 실제 기록의 시작/종료 날짜 이동도 제한한다.
- TODO.planStart/planEnd와 Event.start_at/end_at은 PLAN만 바꾼다. do_*·완료·time blocks·activity entries·분류 스냅샷은 쓰지 않는다.
- 한계: TODO 연결 블록 조회 직후 다른 클라이언트가 블록을 INSERT하는 경쟁을 단일 트랜잭션으로 잠그는 DB 변경은 하지 않았다. 운영 연결 전 격리 환경에서 FK/트랜잭션 정책을 추가 검증해야 한다. RLS/운영 권한은 소스만으로 실제 적용 상태를 주장하지 않는다.

## Event 태그 근거

`supabase/migrations/20260412010000_add_events_v2_schema.sql`의 Event 컬럼에 tags가 없으며, 이후 저장소 마이그레이션에서도 events tags 추가/권한을 확인할 수 없었다. v2 코덱은 선택적 레거시 tags를 읽지만 기존 `toRowPayload`는 이를 쓰지 않는다. 따라서 신규 Event 태그 입력은 비활성화하고 repository에서도 tags를 제거한다. 기존 optional tags가 있으면 조회/표시는 유지하고 제목 수정 등에서 해당 컬럼을 변경하지 않는다. 운영 DB 조회나 SQL 적용은 하지 않았다.

## 자연어 결과

logical today=2027-01-01, 기본 선택일 없음 기준:

| 입력 | 결과 |
| --- | --- |
| 다음주 월요일 운동가기 | 할 일 / 운동가기 / 2027-01-04 |
| 다음주 월요일 운동가기 #자기계발 19:00~20:00 | 같은 날짜/제목 + 기존 자기계발 태그 ID + 19:00~20:00 |
| 18:00 퇴근 | 할 일 / 퇴근 / 오늘 또는 명시 선택일 / 18:00 |
| 내일 오후 3시 병원 | 할 일 / 병원 / 2027-01-02 / 15:00 |
| 빨래개기 #집안일 | 날짜 미정 / 기존 집안일 태그 연결 |
| 매주 월요일 운동가기 | 다가오는 월요일 / weekly |
| 일정 내일 10시 회의 | 일정 힌트 / 2027-01-02 / 10:00; 종료 또는 종일 확인 필요 |

수동 종류 선택 > 프리픽스 > 할 일 기본값. 시간만으로 Event로 바꾸지 않는다. 원문은 입력창과 parser.originalInput으로 보존한다. 미등록 태그는 자동 쓰기하지 않고 기존 태그로 수정/해제하게 한다. 선택 날짜는 날짜 토큰 없는 시간 입력에만 사용한다. 명시 상대 날짜는 logical today 기준이다. 기존 오전/오후·반·분·N-N시·프로젝트·중요·날짜 표현 회귀 테스트를 유지했다.

## 교차 화면 검증

새 `moa-plan-cross-screen.test.mjs`는 실제 Auth/Provider/라우터를 사용하고 전송 계층만 메모리로 바꾼다. 390/768/1440px 각각:

1. 운동가기 + 자기계발 + 19:00~20:00 + 기존 주간 목표를 PLAN에서 저장.
2. 같은 Provider ID를 할 일 화면에서 확인하고 상세의 공통 주간 진행률 확인.
3. 같은 ID를 기존 액션으로 Top 3 선택 후 오늘 홈에서 제목/예정 값 확인. 모바일 홈은 기존 디자인상 예정 시간을 숨기므로 DOM에 렌더된 값과 표시된 제목을 나누어 확인한다.
4. 목표 화면의 월간 목표를 펼쳐 같은 주간 진행률 확인.
5. PLAN에서 20:00~21:00로 수정 → 할 일 → 기존 캘린더 → PLAN 일간에서 같은 값 확인.
6. PLAN에서 새 Event → 오늘 홈에서 동일 Event 확인.
7. PLAN에서 실패한 요청을 편집기 이탈 후 오늘 홈의 전역 재시도로 이어 처리하여 단일 행/공통 상태를 확인.
8. 메모리 서버 상태를 테스트 전용 sessionStorage로 전달해 hard reload 후 같은 ID/값/단일 row 확인. 실제 제품에 sessionStorage 저장 기능을 추가한 것이 아니다.
9. 원본 actual/status, TODO blocks, 독립 활동 데이터가 동일함을 확인. 오늘 실제 활동 45분이 계획 생성·수정·메뉴 이동·재조회 후에도 유지되는지 확인.

기존 PLAN suite는 시간 해제·날짜 미정·Event CRUD/종일·빈 칸 입력·오류/응답 유실·삭제 보호·반복·DO 불변·키보드/모달을 계속 검증한다. 새 unit은 actual ownership이 읽기 후 바뀌는 CAS 경쟁과 Event 태그 미쓰기/원본 보존을 추가한다.

## Production 및 검증 경계

공유 파서와 Provider 확인 저장 경로가 의도적으로 변경되어 Production JS hash가 바뀐다. 원격 b3d2fdb를 별도 worktree에서 빌드해 비교했으며, 파일 수는 19개로 동일하고 **메인 JS와 이를 참조하는 index.html만 변경**되었다. CSS·이미지·SW 등 나머지 파일은 동일하다. 개발 PLAN 라우트/화면 문구/CSS는 Production에 포함되지 않는 것을 검사했다. [해시 비교](validation/moamoa-plan-reconcile/production-comparison.json).

독립 tsc 명령/설정이 없으므로 Vite/esbuild 변환·빌드·실행 검사이며 완전한 tsc 검사로 표현하지 않는다. 기존 render 하네스는 calendar 경로를 격리 mock으로 확인하고, 새 개발 화면은 전용 브라우저 검사로 확인했다. 실제 iPhone 카메라/키보드 및 Supabase/RLS 검증은 수행하지 않았다. 운영 DB·Storage·API 호출/Secret/환경변수/배포 변경은 없다.

## 반영 권장 절차

1. 이 통합 브랜치만 검토한다. 기존 원격 PLAN/Preview/main의 최신 SHA가 그대로인지 확인한다.
2. 격리 DB에서 v2 코덱의 timezone/RLS/동시성 및 연결 블록 경쟁을 검증한다. Event 태그 정책은 별도 승인 전까지 제한 유지.
3. 검토 승인 후 기존 PLAN 브랜치에 이 통합 변경만 fast-forward/선별 반영한다. 두 PLAN 구현을 추가로 merge하지 않는다.
4. Preview에는 검증된 화면/Provider/저장소/코덱/테스트와 의존성을 함께 선별 적용하고 기존 메모리 격리 정책 아래 재검증한다.
5. DO 단계는 별도 actual 저장 액션으로 연결한다. PLAN 시간·완료를 실제 활동으로 변환하거나 임의 시각을 생성하지 않는다.

[교차 화면 결과](screenshots/moamoa-plan-reconcile/validation.json) · [모바일 입력](screenshots/moamoa-plan-reconcile/mobile-editor.png) · [모바일 오늘](screenshots/moamoa-plan-reconcile/mobile-today.png) · [태블릿](screenshots/moamoa-plan-reconcile/tablet-calendar.png) · [PC](screenshots/moamoa-plan-reconcile/desktop-calendar.png)

## 최종 검증 결과

| 검사 | 결과 |
| --- | --- |
| 전체 단위 (기존+원격+선별 추가) | **226/226 통과** |
| 전체 브라우저/통합 | **142/142 통과** (최종 Provider/조회 범위 보강 후 재실행) |
| PLAN + 교차 화면 영향 검사 | **12/12 통과**, 추가 보강한 교차 화면도 별도 재실행 |
| Production 빌드 | 통과, 개발 PLAN 화면/라우트/CSS 제외 |
| 폰트 / 색상 린트 | 통과, baseline 379 / 신규 위반 0건 |
| 기존 calendar 렌더 하네스 | FAIL 0 / WARN 6 (기존 라벤더 경고), 6장 |
| 390/768/1440px 실제 렌더 | 가로 넘침 없음, 모달 저장 버튼 화면 내 유지 |
| diff / 민감정보 검사 | 통과 / 패턴 발견 0건 |

기존 테스트 조건은 제거/완화하지 않았다. 초기에 새 E2E의 페이지 전환 대기·모바일 목표 아코디언·숨겨진 예정 시간 선택자를 실제 UI에 맞게 수정했다. 원격의 CRUD/오류/회귀 검사는 그대로 유지했다. 전체 로그와 Production 비교는 [validation](validation/moamoa-plan-reconcile/)에 보관한다.

실행 방법: 설치된 esbuild로 `src/lib/*.test.ts`를 Node ESM 번들 후 `node --test`; `node --test --test-concurrency=1 scripts/test/*.test.mjs`; `npm run build`; `npm run lint:fonts`; `npm run lint:colors`; `HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar`; `git diff --check`.
