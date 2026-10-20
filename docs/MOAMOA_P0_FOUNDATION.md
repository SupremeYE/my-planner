# MoaMoa STEP 1 — 데이터 정합성 기반

## 범위와 작업 기준

- 작업 브랜치: `codex/moamoa-p0-foundation`
- 시작 HEAD / 확인한 원격 main: `5fac23d1f7c727e1c4ee3bd8c7986705b91efd71`
- 시작 시 작업 트리가 깨끗했고 `git ls-remote`와 `git fetch origin main`으로 일치를 확인했다.
- 운영 Supabase 접속·DB 변경·마이그레이션 실행·배포·push·PR·환경변수 변경은 하지 않았다.
- 신규 메뉴, 독립 활동 테이블, XP, 목표 진행률 통일, 저장 실패 UX는 이번 범위에서 제외했다.

## P0-A: 조회와 저장 분리

`PlannerProvider` 초기 로드에서 연결이 없는 월간 목표를 같은 해의 첫 연간 목표에 연결한 뒤
upsert하던 코드를 제거했다. 연결이 없는 상태도 유효한 데이터로 읽으며, 기존 명시적 연결을
그대로 유지한다. 연간 목표 연결 변경은 기존 `addMonthlyGoal` / `updateMonthlyGoal`의
명시적 동작에서만 저장한다. 별도 추정 부모나 자동 데이터 보정은 추가하지 않았다.

관련 초기 로드, Realtime 재조회, 설정 조회, 목표 화면의 effect, 타이머 복원 effect를 확인했다.
설정의 옛 필드 해석은 메모리 안에서만 수행하며 타이머 복원은 로컬 상태와 wake lock만 다룬다.
타이머 종료·목표 편집·목표 삭제에 따른 기존 쓰기는 명시적인 사용자 동작이므로 유지했다.

`scripts/test/planner-read-only.test.mjs`는 실제 Provider를 브라우저에 마운트한다.
DB와 Supabase 모듈은 메모리 안의 가짜 모듈로 대체하고 외부 요청을 차단한다.
초기 조회·Realtime 재조회 시 쓰기 0회, 원본 연결 보존, 명시적 편집 시에만 저장됨을 확인한다.
수정 전 테스트는 초기 로드의 자동 upsert 때문에 실패했고, 제거 후 통과했다.

## P0-B: 실제 활동 시간

공통 엔진은 `aggregateActivity`다. `useTimeReport`, 리뷰의 `TrackTimeStrip`, 일간 TODO 합계의
`dateDoSeconds`가 이를 사용한다. 일간 범위는 start=end로 계산하며 새 일간 UI는 만들지 않았다.

- 일정은 `doStart` / `doEnd`만 사용한다. `startTime` / `endTime` 계획으로 폴백하지 않는다.
- TODO 블록은 저장된 작업일의 실측 초를 우선하고 여러 세션을 누적한다.
- 같은 TODO·날짜의 레거시 `do_*`는 블록과 중복 합산하지 않는다.
- 다른 날짜 블록이 있는 TODO의 `do_*`에는 실행 날짜가 없다. 타이머가 이 필드에도 같은 값을
  쓰기 때문에 독립적인 과거 기록인지 블록의 복사본인지 판별할 수 없다. 이 경우 블록만 합산하고
  레거시는 `legacy-date-ambiguous`와 `candidateMinutes` 진단으로 남긴다. 원본은 변경하지 않는다.
- 복수 추적 태그의 균등 분할, 기존 태그 연결 건수 지표는 유지한다. 건수는 완료 횟수와 다르다.
- 수면·운동 등 라이프 로그를 집계 입력에 새로 연결하지 않았다.
- 반복 일정 원본의 실제 시각이 다른 가상 회차에 복제되지 않게 읽기 어댑터를 수정했다.
  실제 예외 행의 실적은 유지한다. 조회 응답에 tags가 있으면 보존하며 없는 컬럼을 가정해 쓰지 않는다.

### 진단 API

`RangeAggregation.coverage`와 `TimeReportData.coverage` / `daily[].coverage`:

| 필드 | 의미 |
| --- | --- |
| `recordedMinutes` | 계산 가능한 분류 시간 + 미분류 시간 |
| `unclassifiedMinutes` | 추적 태그로 배분하지 못한 실적 |
| `unclassifiedItems` | 원본 ID·날짜·종류·소요와 이유 |
| `unresolvedItems` | 시각 오류·자정 역전·레거시 날짜 모호성으로 계산하지 않은 원본 |

미분류 이유는 `untagged`, `unknown-tags`, `untracked-tags`, `missing-todo`로 구분한다.
기존 `totalMinutes`는 추적 태그 시간만 의미한다. 추적 OFF 시간을 임의로 추적 ON으로 바꾸지 않는다.
진단은 데이터로만 노출하고 이번 단계에서는 새 UI나 경고 배너를 추가하지 않았다.

### 날짜 제약

- 저장된 date의 귀속을 바꾸지 않는다. 브라우저 시간대나 논리적 하루로 과거 자료를 재배치하지 않는다.
- 실측 초가 있는 23:50–00:10 블록은 저장된 작업일에 실측값을 합산한다.
- 실측 없이 HH:mm만 역전된 경우, 실제 익일 종료인지 입력 오류인지 알 수 없어
  `ambiguous-overnight`로 남긴다. 24시간을 임의로 더하지 않는다.
- 기존 타임라인의 명시적 확장 시각(예: 24:10)은 유지한다.
- 일자별 정확한 분할에는 실제 시작/종료 날짜·타임존 등 추가 정보가 필요하다. 이행은 하지 않았다.

## P0-C: ISO 주차와 읽기 호환

`weekKeys.ts`의 `getWeekKey`는 ISO 주차 연도와 번호를 함께 사용한다.
예: 2027-01-01 → `2026-W53`, 2018-12-31 → `2019-W01`.
store의 기존 export도 이 함수로 연결해 호출 경로를 유지했다.

대시보드·사이드 패널·주간 목표·월간 목표의 주 라벨·만다라트 전송·주간 회고 조회가
같은 키 도우미를 사용한다. `WeeklyTodosInline`의 기본 월요일 계산도 공유한다.

### 안전하게 처리 가능한 옛 키

해당 연도에 ISO 53주가 존재하지 않고 1월 1일이 전년도 53주에 속하면 옛 키임을 판별할 수 있다.
예: `2027-W53`은 조회에서 `2026-W53`과 호환된다. DB 값은 변경하지 않는다.
회고 편집 시에도 기존 레코드의 원본 weekKey를 유지한다.
정상 키와 옛 키의 행이 동시에 있으면 정상 키를 우선하며 다른 행도 과거 목록에 남긴다.
한 자리 주차 키도 읽기 호환한다.

### 자동 처리할 수 없는 옛 키

`2022-W52`는 정상적인 2022년 말의 키일 수도, 2022년 초를 잘못 기록한 키일 수도 있다.
`2018-W01`도 연초/연말 중 어느 쪽을 뜻했는지 키만으로는 구분할 수 없다.
이런 값은 기존 키 해석과 조회 경로를 보존하고 다른 해에 자동 연결하지 않는다.
실제 의도 확인에는 사용자 확인이나 원본 자료의 별도 조사가 필요하다.
전체 키 변경·레코드 병합·운영 데이터 수정은 하지 않았다.

## 검증 방법

package.json에는 test/typecheck 스크립트가 없다. 기존 테스트는 node:test 기반이며 파일 주석에
esbuild 변환 후 실행하는 방식이 명시돼 있다. 새 패키지나 테스트 프레임워크를 설치하지 않았다.

```bash
cd /workspace/my-planner
mkdir -p /tmp/moamoa-p0-tests
node_modules/.bin/esbuild src/lib/*.test.ts --bundle --platform=node --format=esm \
  --out-extension:.js=.mjs --outdir=/tmp/moamoa-p0-tests
node --test /tmp/moamoa-p0-tests/*.mjs
node --test scripts/test/*.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=time-report,reviews,goals
git diff --check
```

tsconfig, TypeScript 의존성, typecheck 스크립트가 없어 독립적인 TypeScript 타입 검사는 미실행이다.
Vite 빌드 성공을 타입 검사 성공으로 취급하지 않는다.
브라우저를 쓰는 Provider 회귀 테스트는 `HAON_CHROME`을 지원한다.
렌더 하네스도 인증·DB를 모의 처리하며 이미지·리포트는 기존 gitignore 대상에 생성한다.

### 최종 결과

- 기존 단위 테스트 101개 → 수정 후 119개 모두 통과.
- 실제 Provider의 읽기/재조회/명시적 편집 3개 하위 검사 통과.
- 반복 일정 실적 변환 2개 검사 통과. 위 두 스크립트의 node:test 출력은 상위 테스트를 포함해 6개다.
- Asia/Seoul 시간대로 주차·시간 집계 24개를 재검증해 모두 통과.
- Production 빌드, lint:fonts, lint:colors, git diff --check 통과.
- 원본과 수정본의 최종 렌더 검사 모두 12장, FAIL 0 / WARN 12. 경고는 기존 라벤더 색상이다.
- 초기 수정본 렌더에서 모바일 주간 회고가 한 차례 빈 화면으로 판정되고 월간 캡처가 건너뛰어졌다.
  원본 비교, 별도 브라우저 안정 상태 확인, 최종 동일 하네스 재검사에서는 재현되지 않았다.
  이 일시적 실패의 원인은 확정하지 않았으며 기존 버그로 단정하지 않는다.
- 빌드의 500kB 초과 번들 경고는 변경 전에도 존재했다.

## 변경 파일

| 목적 | 파일 |
| --- | --- |
| 읽기 전용 초기 로드 | `src/app/store.tsx` |
| 실제 Provider 회귀 검사 | `scripts/test/planner-read-only.test.mjs` |
| 공통 시간 집계·진단 | `src/lib/timeAggregation.ts`, `src/lib/timeBlocks.ts`, `src/app/hooks/useTimeReport.ts` |
| 시간 회귀 검사 | `src/lib/timeAggregation.test.ts`, `src/lib/timeBlocks.test.ts` |
| 일정 읽기 변환·회귀 검사 | `src/api/events.ts`, `scripts/test/events-actual.test.mjs` |
| 스트립의 집계 기준 주석 | `src/app/components/review/TrackTimeStrip.tsx` |
| 공통 주차 도우미·검사 | `src/lib/weekKeys.ts`, `src/lib/weekKeys.test.ts` |
| 주차 읽기 호환 적용 | `src/app/components/DashboardView.tsx`, `Layout.tsx`, `ReviewsView.tsx`, `WeeklyView.tsx` |
| 주차 라벨·월요일·전송 키 공유 | `src/app/components/period/GoalsMonthlyBoard.tsx`, `period/WeeklyTodosInline.tsx`, `mandalart/SendCellModal.tsx` |
| 범위·검증·제약 기록 | `docs/MOAMOA_P0_FOUNDATION.md` |

## 남은 문제와 다음 작업 순서

1. 위의 모호한 기존 키, 실행일을 잃은 레거시 기록, 자정 통과 시간의 정확한 분할에는 데이터 제약이 있다.
   추측으로 고치지 않고 별도로 확인한다.
2. 현재 일정 API의 tags 저장 경로는 미지원이다. 이번에는 조회 시 존재하는 태그를 보존하는 수정만 했다.
   실제 DB 컬럼과 마이그레이션 적용 여부는 확인하지 않았으므로 컬럼 추가나 운영 조회는 하지 않았다.
3. 기존 반복 일정에는 시각이 있는 시작값과 날짜만 있는 종료값을 비교해 마지막 날이 빠지는 사례가 있다.
   이번 실적 복제 회귀와 분리해 별도의 반복 처리 작업으로 다룬다.
4. 다음 P0에서 홈과 목표 화면의 진행률 계산을 통일하고 저장 실패·재시도·동기화 상태를 다룬다.
5. 이후 주간 목표가 보이는 '오늘' → 기존 TODO와 목표를 쓰는 '퀘스트' → TODO에 연결된 간단 시간 입력
   순서로 구현한다. 독립 활동 테이블과 UI는 데이터 설계를 확인한 뒤 추가한다.
