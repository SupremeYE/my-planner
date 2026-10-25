# STEP 3B-5B — 주간 회고 Preview 선별 통합

## 기준과 범위

- Preview 시작 SHA: `81f9aba370639f6e225668dc48c5991529edbdfb`.
- 기능 소스 SHA: `887f70ac1be0c8fe935965f7d090911867f4a1ea` (`codex/moamoa-step3b5-weekly-review`).
- 독립 clone: `/workspace/my-planner-preview-weekly`. 기존 작업 트리를 편집하지 않는다.
- 전체 merge/cherry-pick 없이 필요한 파일만 선택한다. `MoaWeeklyRoute.tsx`와 개발용 라우트는 가져오지 않았다.
- 시작 시 원격은 기준과 같았다. 다른 환경의 미Push 작업까지 확인할 수는 없으므로 공유 작업 트리를 쓰지 않고 Push 전에 원격을 재확인한다. 강제 Push하지 않는다.

## 체험 경로

**캘린더 → 주간 → 주간 플래너 → 주간 회고 작성 / 주간 회고 보기·수정**

현재 주는 회고 없이 시작하고, 이전 주에 편집할 수 있는 샘플 1개가 있다. 저장 후 버튼·요약이 갱신된다. 이전/다음 기간 또는 캘린더 날짜로 과거 주차를 선택한다. 다른 메뉴를 다녀와도 같은 세션의 내용은 유지되며 새로고침/샘플 초기화는 원래 샘플로 돌아간다.

기억하고 싶은 일, KEEP, NOTICE, TRY, NEXT 모두 선택 입력이다. 한 항목 또는 빈 회고도 명시적으로 저장할 수 있다. 통계를 본문에 삽입하거나 사용자 텍스트를 바꾸지 않는다. 기존 ID·원본 weekKey를 유지하고 명시적으로 비운 필드만 비운다.

PC/768px는 모달, 390px는 하단 입력 패널이다. 본문 스크롤과 별도 저장 footer를 사용하고 `visualViewport`의 높이 변화를 반영한다. 닫기/ESC는 변경사항 폐기 확인을 거치고 저장 중에는 닫히지 않는다. 실물 키보드 검증은 하지 않았으며 Chromium에서 NEXT 입력 중 viewport 축소를 검증한다.

## 선별 코드와 수정 파일

기능 SHA에서 다음 **6개 파일**을 선택했고 내용은 그대로 재사용한다.

- `src/lib/weeklyReviewRepository.ts`, `weeklyReviewRepository.test.ts`
- `src/app/hooks/useWeeklyReviews.ts`
- `src/app/components/moamoa/weekly/WeeklyReviewEditor.tsx`, `weekly.css`
- `src/app/components/moamoa/MoaDialog.tsx`의 선택적 class/style 확장

Preview 연결·검증 변경:

- `src/review/ReviewCalendar.tsx`: 조회 전용 팝업 제거, 선택한 `days`, `weekKey`, `week`, `actual` 전달.
- `src/review/ReviewWeeklyReview.tsx`, `weekly.css`: 버튼·요약·공존 회고 선택·참고 정보·편집기 연결.
- `src/review/weeklyBuildTransforms.ts`, `useReviewWeeklyReviews.ts`, `vite.review.config.ts`: Preview에서 하나의 확인 저장 controller를 Provider와 공유.
- `src/review/main.ts`: 과거 샘플 회고와 회고 테이블에 한정된 메모리 정렬/유일성 설정.
- `scripts/test/fixtures/memory-supabase.ts`, `moa-today-supabase.ts`: 선택적 제약/정렬과 `is(null)` 지원. 기존 테이블은 기본 동작 유지.
- `src/lib/weeklyReviewPreview.test.ts`: 메모리 제약·페이지 조회·조건부 수정·응답 유실·빌드 경계 검증.
- `scripts/test/moa-review-weekly.test.mjs`: 기능 단계의 회고 시나리오를 실제 정적 Preview 경로에 맞춰 검증. 개발용 플래너를 복사하지 않음.
- `scripts/test/moa-review.test.mjs`, `moa-review-ux.test.mjs`: 새 버튼명/5개 입력 기대값만 갱신. 기존 회귀 유지.
- 보고서와 `docs/screenshots/moamoa-preview-weekly/`.

제품 `store.tsx`, `db.ts`, `routes.tsx`, 주차/집계 계산, `ReviewShell.tsx`, 내비게이션, 음악·독서·문화·음식 코드는 수정하지 않는다.

## 같은 주차와 같은 확인 상태

`ReviewCalendar`가 계산한 ISO 주차와 월~일 배열을 직접 전달한다. 별도 현재 날짜를 계산해 다른 주차를 열지 않는다. 편집기를 열 때 주차/기간/날짜 배열을 보존한다. 편집 중 백그라운드 날짜가 다음 주로 바뀌어도 참고 정보와 저장 주차는 처음 연 주를 유지한다.

Preview 빌드 변환에서 `PlannerProvider`에 `useWeeklyReviews`를 **한 번** 설치한다. 공개 `weeklyReviews`와 `reviewWeekly.records`는 같은 배열이다. 기존 낙관적 회고 초기 조회와 중복 Realtime refetch는 Preview 빌드에서 제외한다. 제품 store 소스는 변경하지 않으며 변환 경계가 달라지면 빌드를 실패시킨다.

캘린더는 공유 controller를 읽고 별도 hook을 만들지 않는다. 응답을 잃은 메모리 행을 전역 목록만 먼저 성공으로 표시하지 않는다. 미확인 ID 보호, 늦은 읽기 무시, 오류 시 마지막 확인 목록 유지가 동일하게 적용된다. 저장 성공 후 refresh로 이전 조회 오류도 재확인한다.

참고 정보는 기존 progress, `moaTodayData`의 완료 TODO ID 집합, `aggregateActivity.coverage.recordedMinutes`(미분류 포함), 해당 주 `checkedDates`를 사용한다. 동일 데이터를 기능 개발 화면의 계산 방식에 넣은 값과 UI를 비교한다. 계획 시간을 실제 합계에 더하지 않고 목표·할 일·습관 상태도 변경하지 않는다.

## 저장 정책과 메모리 계층

- 세션 UUID 고정, submit ref/SaveCoordinator 중복 차단, 서버 반환 ID·키·변경 내용 확인.
- 원본 ID/weekKey 보존. 읽기만으로 저장하거나 키 변환하지 않음.
- 변경 필드만 PATCH하고 이전 값으로 조건부 update. null 비교는 `IS NULL`.
- 같은 필드의 동시 수정은 충돌, 무관한 필드 수정은 보존.
- 응답 실패 후 ID 재조회. 이미 반영된 동일 요청은 추가 쓰기 없이 확인. 재조회까지 실패하면 초안/동일 요청을 유지하고 명시적 재시도.
- 정규/레거시 주차 공존 시 각각 열기. 자동 병합·삭제·키 변경 없음.
- 확인 조회/500행 페이지 조회, `eq`, `is(null)`, 주차+ID 정렬 지원.
- Preview `weekly_reviews`에만 원문 `week_key` 유일성 모의 제약 적용. 충돌은 `23505`/409. 레거시 별칭을 자동 정규화하지 않음.
- 기존 controls로 Realtime 모의 알림, 실패·응답 유실·조회 오류·요청 보류/해제 검증.
- 메모리만 사용하며 localStorage/운영 DB/Storage/API 저장이 아님. 새로고침으로 초기화.

## 격리·사이드바

실제 Supabase SDK/API 모듈이 포함되면 Preview 빌드가 실패한다. 기존 fetch 차단, CSP `connect-src 'none'`/`form-action 'none'`, Blob 미디어 정책, 가짜 Auth, 서비스 워커 제외를 유지한다. 테스트는 CSP가 적용된 정적 서버에서 외부 HTTP/WS 및 API/Storage 요청이 없는지 검사한다.

`vercel.json`, Production/브랜치 빌드 차단, 프로젝트 환경변수, Deployment Protection은 변경하지 않는다. 일반 Production 산출물은 기준과 비교한다. Vercel 수동 배포·PR·main 병합은 수행하지 않는다.

시작 시 사이드바는 `PanelLeftOpen` / `PanelLeftClose`였다. 햄버거(☰) 변경은 아직 반영되지 않았고 이번 작업에서도 `ReviewShell.tsx`를 수정하지 않는다. Push 전 새 원격 변경이 있으면 보존해 검토한다.

## 화면

| 크기 | 입력 | 참고 정보 | 저장 후 요약 |
|---|---|---|---|
| 모바일 390px | [보기](screenshots/moamoa-preview-weekly/mobile-editor.png) | [보기](screenshots/moamoa-preview-weekly/mobile-reference.png) | [보기](screenshots/moamoa-preview-weekly/mobile-saved-summary.png) |
| 태블릿 768px | [보기](screenshots/moamoa-preview-weekly/tablet-editor.png) | [보기](screenshots/moamoa-preview-weekly/tablet-reference.png) | [보기](screenshots/moamoa-preview-weekly/tablet-saved-summary.png) |
| PC 1440px | [보기](screenshots/moamoa-preview-weekly/desktop-editor.png) | [보기](screenshots/moamoa-preview-weekly/desktop-reference.png) | [보기](screenshots/moamoa-preview-weekly/desktop-saved-summary.png) |

[입력 중 viewport 축소](screenshots/moamoa-preview-weekly/mobile-keyboard-height.png), [저장 실패·재시도](screenshots/moamoa-preview-weekly/desktop-save-failure.png). 파일명의 `planner-before`는 **새 회고 작성 전 샘플 상태**이며 코드 변경 전 캡처라는 뜻은 아니다.

## 재검증

```sh
node --test scripts/test/moa-review-weekly.test.mjs
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run vercel-build
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar,reviews
git diff --check
```

단위 테스트는 `src/lib/*.test.ts`를 esbuild로 Node ESM 번들링한 뒤 실행한다. 재생성된 과거 스크린샷/JSON은 해시 검증한 사본을 `/workspace/preview-weekly-validation/`에 보관한 뒤 원래 Git 버전으로 복원한다. 이번 회고 통합 사진만 새 폴더에 보존한다.

최종 결과는 [검증 요약](screenshots/moamoa-preview-weekly/verification.json)에 기록한다.

### 완료 결과

- 단위 **215/215**, 전체 브라우저·API·Preview 회귀 **141/141** 통과. 기능 단계의 단위 210개에 Preview 경계 5개를 추가했다. 브라우저는 기존 Preview 전체와 실제 Preview에 맞춘 회고 시나리오를 실행했다.
- 최종 주차 전환 보완 후 회고 통합 **10/10** 재검증 통과. 신규/빈 회고, 일부 삭제, 재열기, 과거·연말·레거시 주차, 공존 충돌, 실패·응답 유실·재시도, 전역 확인 상태, 새로고침·샘플 초기화를 검증했다.
- Production 빌드 성공. 기준 산출물 **19개 모두 SHA-256 일치**. 기존 500 kB 청크 경고만 남는다.
- 폰트 위반 0, 색상 위반 0, 라벤더 토큰 379/기준 379. `git diff --check` 통과.
- 제품 캘린더·회고 렌더 검사 14장: **FAIL 0 / WARN 14**. 경고는 기존 제품 라벤더 사용이며 관련 제품 소스·산출물은 변경하지 않았다.
- Preview 390/768/1440px 캡처 17장. JS 오류·외부 HTTP·WebSocket 요청 0. CSP와 실제 SDK/API/Storage 차단 유지.
- 기존 회귀 생성 자료 288개를 해시 검증된 archive에 보존한 뒤 기존 추적 파일 162개 복원, 새로 생성된 과거 자료 126개 제거. 이번 회고 캡처만 변경 목록에 남겼다.
- 커밋 전 원격 Preview는 `81f9aba` 그대로이며 `main`과 기능 브랜치 SHA도 유지됐다. 사이드바 햄버거 변경은 아직 반영되지 않았다.

## 실제 DB 연결 전 남은 사항

기능 단계의 경계는 그대로다. 문서에 `week_key UNIQUE`가 있지만 최초 CREATE TABLE이 저장소에 없고 운영 DDL은 조회하지 않았다. Preview 모의 제약을 실제 DB 보장으로 해석하지 않는다.

실제 PK/unique index·컬럼/nullability·소유 범위·RLS SELECT/INSERT/UPDATE 반환 권한·Realtime publication/재접속·기존 중복 분포를 검증해야 한다. 여러 기기에서 정규/레거시 별칭까지 같은 주차로 잠그려면 서버 트랜잭션/RPC가 필요하다. 기존 회고의 자동 병합·삭제·키 이행은 하지 않는다. 기존 `/reviews` 낙관적 writer와의 동시 편집 통일도 별도 제품 통합 항목이다.

이번 단계에서는 운영 DB·마이그레이션·Storage·Secret에 접근하거나 변경하지 않는다.
