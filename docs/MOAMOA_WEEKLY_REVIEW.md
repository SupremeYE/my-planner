# MoaMoa STEP 3B-5A — 주간 회고 확인 저장

## 범위와 실행 경계

- 기준: `codex/moamoa-step3b4b3-books`, `b27cda5eb2b647c2d39a4a94dd849c973b06ddf5`.
- 독립 clone: `/workspace/my-planner-weekly-review`.
- 기능 브랜치: `codex/moamoa-step3b5-weekly-review`.
- 개발 진입점: `/__moamoa-weekly` → **주간 회고**. `import.meta.env.DEV` 경계 안의 lazy route다. Production 기본 라우트·내비게이션·`/reviews`는 그대로다.
- 기준 기능 브랜치에는 Preview 주간 플래너가 없으므로, 읽기 전용 주간 정보와 회고 버튼을 가진 개발 전용 플래너를 추가했다. Preview 코드나 브랜치를 가져오지 않았다.
- 테스트는 실제 App/Auth/PlannerProvider와 기능 코드를 실행하되 Supabase 전송 계층만 메모리 구현으로 대체한다. 운영 DB·Storage·Secret·환경변수에 접근하거나 변경하지 않는다. 기존 외부 폰트 요청도 차단한다.

## 기존 구현 분석

| 대상 | 확인 내용 | 이번 처리 |
|---|---|---|
| `ReviewsView.tsx` WeekTab | `findWeekRecord`로 주차 조회, 5개 텍스트를 폼 상태에 로드. 기존 저장은 즉시 성공 표시 | 기존 화면과 동작을 수정하지 않음 |
| `WeeklyReview` | `id`, `weekKey`, `highlights`, `kptKeep`, `notice`, `kptTry`, `nextWeek` | 타입 재사용, 타입 변경 없음 |
| `db.weeklyReviews` | `week_key` 정렬 조회와 upsert. 오류를 로그로 남기며 호출자에게 확인 결과를 전달하지 않음 | 기존 경로를 유지하고 별도의 확인 저장 repository 추가 |
| `addWeeklyReview` / `updateWeeklyReview` | 낙관적 state 변경, DB 완료를 기다리지 않음 | 새 기능에서는 호출하지 않음 |
| `weekKeys.ts` | ISO week-year, 한 자리 주차, 명백히 잘못된 연초 W53 읽기 호환, 충돌 시 정확한 키 우선 | 기존 함수 그대로 사용. 읽기 정규화 결과를 원본에 저장하지 않음 |
| `confirmedWrites` | 고정 ID 생성, ID 중복 시 덮어쓰기 방지, 확인 조회 | 생성·ID 재조회에 재사용. 수정은 주간 회고 전용 조건부 PATCH |
| `SaveCoordinator` | 진행 중 중복 차단, 성공 응답 후 commit, 명시적 재시도, 미확인 ID 보호 | 기능 전용 인스턴스 사용. 기존 전역 상태 변경 없음 |
| Realtime | store에서 이미 `weekly_reviews` 구독. 기존 refetch는 낙관적 store 배열을 대체 | 새 hook도 `useRealtimeSync`로 구독하되 확인 저장 상태와 독립 관리 |
| `MoaDialog` | Radix 포커스/오버레이, 스크롤 본문과 고정 footer | 선택적 class/style 확장으로 회고에만 visual viewport 높이 적용 |

`20260628050000_review_record_improvements.sql`에는 KPT 컬럼 추가가, `20260816000000_weekly_review_restructure.sql`에는 highlights 추가와 `kpt_problem → notice` 변경이 있다. 후자는 당시 0행을 전제로 good/hard 제거도 포함한다. **과거 마이그레이션을 다시 실행하지 않는다.** 실제 DB의 적용 여부는 조회하지 않았다.

## UI와 사용 방법

주차 선택은 월요일~일요일이다. 이전/다음 주 또는 날짜 입력으로 이동한다. 기존 내용이 있으면 불러오고, 없으면 새 입력 세션의 UUID를 한 번 생성한다.

| 입력 제목 | 기존 필드 |
|---|---|
| 기억하고 싶은 일 | `highlights` |
| 잘한 점 · KEEP | `kptKeep` / `kpt_keep` |
| 아쉬웠던 점 · NOTICE | `notice` |
| 다음에 시도할 점 · TRY | `kptTry` / `kpt_try` |
| 다음 주 계획 · NEXT | `nextWeek` / `next_week` |

모두 선택 입력이다. 한 항목 또는 빈 회고도 명시적으로 저장할 수 있고 임의 내용을 채우지 않는다. 수정 시 빈칸으로 바꾼 필드만 비우고, 손대지 않은 null·텍스트·다른 기기의 무관한 수정은 보존한다. 저장 성공 후 닫고 다시 열 수 있다. 닫기·Escape는 변경사항 폐기 확인을 거치며 저장 중에는 닫히지 않는다. 오류가 나도 초안은 남아 있고 복사할 수 있다. 응답 유실 가능성이 있는 요청을 닫을 때는 서버에 이미 반영됐을 수 있음을 알린다.

PC/태블릿은 모달, 모바일은 하단에 놓이는 넓은 입력 패널이다. 본문만 스크롤하고 저장 버튼은 별도 footer에 둔다. `visualViewport`의 높이·이동을 반영한다. 새 class/style은 이 회고 모달에만 전달하며 기존 모달에는 적용하지 않는다.

참고 정보는 사용자가 펼쳐 읽을 수 있다. `moaTodayData`/`weeklyRollup`으로 주간 목표 진행률, 날짜가 해당 주에 포함된 할 일의 완료 건수(기간 할 일 중복 제거), 기존 `aggregateActivity.coverage.recordedMinutes`로 **미분류를 포함한 실제 활동 시간**, 습관의 해당 주 `checkedDates` 수를 표시한다. 계획 시간을 실제 시간에 더하지 않는다. 목표·습관·집계·회고 본문을 자동 변경하지 않는다. 활동 읽기 오류 시 합계가 일부일 수 있음을 알린다.

## 확인 저장과 충돌 처리

1. 입력 세션의 ID와 기존 원본 weekKey를 고정한다.
2. submit ref와 SaveCoordinator로 같은 요청의 이중 클릭을 차단한다. 같은 Supabase client의 repository끼리는 읽기 호환 주차 키로 생성 요청을 직렬화한다.
3. 매 시도마다 ID를 확인 조회한다. 같은 내용이 이미 저장돼 있으면 그 기록으로 성공을 확인한다.
4. 신규는 전체 회고를 페이지 단위로 읽어 같은 주차의 정규/호환 키 존재를 확인한다. 읽기에 실패하면 생성하지 않는다. 기존 기록이 발견되면 자동 덮어쓰기 없이 기존 회고를 열도록 안내한다.
5. 기존 기록은 변경 필드만 PATCH한다. 수정 직전 조회와 **변경 컬럼의 원래 값을 WHERE 조건으로 건 원자적 update**를 사용한다. 다른 필드를 수정한 기기의 내용은 보존한다. 동일 필드가 달라졌거나 ID/키가 바뀌면 충돌로 처리한다. null 비교는 `IS NULL`이다.
6. 서버 반환값의 ID·원본 키·변경 내용을 검증한다. 응답 실패 후 ID 재조회로 내용이 일치하면 성공을 확인한다. 재조회까지 실패하면 초안과 동일 요청을 유지하고 명시적 재시도 때 다시 확인한다.
7. Realtime/online/visibility 재조회는 generation으로 늦은 응답을 버리고 미확인 저장 ID를 보호한다. 열린 폼은 최초 스냅샷과 초안을 유지한다. 조회 오류는 마지막 목록을 지우거나 '회고 없음'으로 바꾸지 않는다.

기존 정규 키와 레거시 키가 공존하면 정확한 키를 기본으로 선택하고 **모든 일치 기록에 별도 열기 버튼**을 제공한다. 어느 기록도 자동 병합·삭제·키 변환하지 않는다. 이전 회고 목록도 ID별로 제공한다. 유효하지만 해석이 모호한 과거 키는 기존 `weekKeyForRead` 규칙을 따른다.

## DB가 보장하는 범위와 운영 적용 전 확인

`PROJECT_SPEC.md`는 `weekly_reviews.id text PK`, **`week_key text UNIQUE`**를 기록한다. `PROGRESS_LOG.md`에는 테이블을 당시 MCP로 직접 생성했다고 기록돼 있으며, 저장소에는 최초 CREATE TABLE/실제 unique index 정의가 없다. 운영 DB에 접근하지 않았으므로 이 문서를 실제 제약 검증으로 간주할 수 없다.

- 현재 보장: 같은 입력 세션·같은 client의 병렬 생성·명시적 재시도에서 중복 방지. 조건부 PATCH로 같은 필드의 동시 수정 덮어쓰기 방지. 읽기/권한/unique 오류는 성공으로 표시하지 않음.
- 여러 브라우저/기기는 JS lock을 공유하지 않는다. `week_key UNIQUE`가 실제 존재하면 **동일한 원문 키**의 동시 생성은 DB가 거부할 수 있다. 정규 키/레거시 별칭의 의미상 중복까지 보장하지는 않는다.
- 운영 적용 전 별도 DB 검증: 실제 PK/unique index와 키 범위, 5개 컬럼/nullability, RLS의 SELECT/INSERT/UPDATE 및 반환 행 권한, Realtime publication/권한/재접속, 데이터 중복 분포를 확인해야 한다.
- 저장소의 RLS는 단일 소유자 기반 정책이다. `user_id + week_key` 같은 다중 사용자 제약이 있다고 가정하지 않았다. 소유 범위를 명확히 확인한 뒤 동시 생성 제약을 설계해야 한다.
- 의미상 같은 주차에 대한 여러 기기 동시 생성 보장이 필요하면 **서버 트랜잭션/RPC 내 주차 잠금 + 기존 별칭 조회 + 생성**이 필요하다. 기존 중복 행을 정리하거나 week_key를 일괄 변환하는 마이그레이션은 별도 사용자 검토 없이는 수행하지 않는다.
- 기존 `/reviews`의 낙관적 writer에는 이번 조건부 PATCH가 적용되지 않는다. 운영에서 양 화면을 동시에 편집하는 상황까지 통일하려면 기존 writer 전환을 별도 검토해야 한다.

이번 작업은 DB DDL·마이그레이션·Storage·환경변수를 추가하거나 적용하지 않는다. 메모리 테스트는 실제 PostgreSQL의 격리 수준·RLS·publication을 검증하지 않는다.

## Preview 통합 시 필요한 작업

1. `WeeklyReviewEditor`, `useWeeklyReviews`, repository와 스타일만 선별 적용한다. 개발용 `MoaWeeklyRoute`나 공통 메뉴를 통째로 Preview에 합치지 않는다.
2. Preview `ReviewCalendar`의 선택 주차/기간과 기존 참고 정보를 편집기에 전달하고 현재 조회 전용 회고를 교체한다.
3. Preview 전용 메모리 transport에 `weekly_reviews` 확인 조회·생성·조건부 PATCH(`eq`, `is`)·Realtime 알림을 지원한다. 실제 Supabase SDK·운영 API를 연결하지 않는다.
4. 새로고침 시 초기화, 같은 Preview 세션의 재조회, 오류/재시도 샘플, 기존 회고 목록 및 주차 충돌 표시를 검증한다.
5. Preview 격리·문화/음악/독서/음식/시간/할 일/정원 회귀, Production 제외, CSP와 Deployment Protection을 별도 검증한 뒤 별도 승인 범위로 통합한다.

## 수정 파일

- `src/lib/weeklyReviewRepository.ts`: 확인 저장, 원본 보존, 부분/조건부 PATCH, 재조회·주차 lock.
- `src/app/hooks/useWeeklyReviews.ts`: 확인된 회고 목록, 오류·재시도·Realtime.
- `src/app/components/moamoa/weekly/WeeklyReviewEditor.tsx`, `weekly.css`: 선택 입력과 반응형 편집기.
- `src/app/components/moamoa/MoaWeeklyRoute.tsx`: 개발 전용 주간 플래너/참고 정보/과거 회고.
- `src/app/components/moamoa/MoaDialog.tsx`: 선택적 class/style 확장.
- `src/app/routes.tsx`: DEV lazy route 1개.
- `src/lib/weeklyReviewRepository.test.ts`, `scripts/test/moa-weekly-review.test.mjs`: 저장·호환·UI 격리 검증.
- `scripts/test/fixtures/memory-supabase.ts`: 조건부 수정의 null 비교용 `is` 지원 1줄.
- 이 보고서와 `docs/screenshots/moamoa-weekly-review/`: 샘플 화면·검증 기록.

## 화면

| 크기 | 주간 플래너 | 회고 작성 | 아래 항목·저장 |
|---|---|---|---|
| 390px | [모바일](screenshots/moamoa-weekly-review/mobile-planner.png) | [작성](screenshots/moamoa-weekly-review/mobile-editor.png) | [NEXT](screenshots/moamoa-weekly-review/mobile-editor-next.png) |
| 768px | [태블릿](screenshots/moamoa-weekly-review/tablet-planner.png) | [작성](screenshots/moamoa-weekly-review/tablet-editor.png) | [NEXT](screenshots/moamoa-weekly-review/tablet-editor-next.png) |
| 1440px | [PC](screenshots/moamoa-weekly-review/desktop-planner.png) | [작성](screenshots/moamoa-weekly-review/desktop-editor.png) | [NEXT](screenshots/moamoa-weekly-review/desktop-editor-next.png) |

[저장 실패·재시도](screenshots/moamoa-weekly-review/desktop-save-retry.png), [모바일 축소 viewport](screenshots/moamoa-weekly-review/mobile-keyboard-height.png). 축소 viewport는 키보드 높이를 고려한 Chromium 검증이며 실물 iOS/Android 키보드 검증은 아니다. 기본 외부 폰트를 차단하므로 캡처는 로컬 대체 폰트를 사용할 수 있다.

## 재검증

```sh
node --test scripts/test/moa-weekly-review.test.mjs
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=reviews
git diff --check
```

단위 테스트는 `src/lib/*.test.ts`를 esbuild `--bundle --platform=node --format=esm`으로 임시 디렉터리에 번들한 후 `node --test`로 실행한다. 운영 연결 없는 브라우저 검증은 일반 dev 서버가 아닌 위 테스트 명령을 사용한다. 일반 dev route는 기존 제품 Auth/DB 설정을 따르므로 운영 인증으로 시연하지 않는다.

최종 결과는 [검증 요약](screenshots/moamoa-weekly-review/verification.json)에 기록한다.

## 최종 검증 결과

- 전체 단위 **210개 통과**. 주간 회고 신규 단위 17개 포함. 응답·재조회 유실, 조건부 수정 경쟁, 권한/unique 거부, 1,001행 페이지 조회와 client lock의 한계까지 검증했다.
- 전체 브라우저/API 모의 회귀 **130개 통과**, 실패·스킵 0. 기존 음식·문화·음악·독서·시간·할 일·목표·프로토타입·저장 회귀를 포함한다.
- 최종 주간 회고 브라우저 **10개 통과**. 390/768/1440px, 입력 중 390×844 → 390×400 viewport 축소, 저장 버튼 접근, 주차 이동, 과거 키의 날짜순 정렬, 부분 저장·명시적 비우기·실패·중복 클릭·응답 유실·Realtime·조회 오류를 확인했다.
- Production 빌드 성공. 기준과 최종 빌드 **19개 파일의 SHA-256이 모두 동일**하다. 새 route·편집기·repository·스타일이 일반 Production 빌드에 들어가지 않는다.
- `lint:fonts`, `lint:colors`, `git diff --check` 통과. 기존 큰 번들 크기 경고는 유지한다.
- 기존 `/reviews` 일간·주간·월간 렌더: PC/모바일 **8장, FAIL 0, WARN 8**. 경고는 기존 라벤더 표시다. 새 모아모아 화면은 별도 브라우저 테스트로 검증했다.
- 첫 전체 회귀에서 기존 TODO 상세의 수정 버튼 대기가 7초를 초과했다. 코드/테스트 기준을 완화하지 않고 TODO 단독 14개와 전체 130개를 재실행해 통과했다. 최초 실패 로그도 `/workspace/weekly-review-validation/`에 보존했다.
- 다시 생성된 기존 스크린샷·JSON **68개**를 해시 검증한 압축 사본으로 보관한 뒤 기준 버전으로 복원했다. 이번 회고의 샘플 스크린샷 11장만 새 폴더에 보존한다.
- 기존 회고·전역 store·db·주차/집계·저장 coordinator·공통 프레임·패키지·Vercel 설정을 보존했다. 민감정보 패턴 검사에서 새 변경의 credential 값이 발견되지 않았다.

복구 사본과 상세 실행 로그: `/workspace/weekly-review-validation/`. 실제 PostgreSQL 제약/RLS/Realtime 전달과 실물 모바일 키보드는 이번 격리 검증 범위 밖이다. Preview 통합과 운영 DB 검증은 위 후속 항목으로 남긴다.
