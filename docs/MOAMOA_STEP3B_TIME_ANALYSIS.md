# MoaMoa STEP 3B-3 — 독립 활동과 시간 분석

## 1. 작업 보존과 체크포인트

이번 작업 시작 시 `/tmp/moamoa-step3b1-preserved`와 이전 테스트 원본 로그가 없었다. 사용자 승인 후 **현재 작업물의 새 기준선**을 만들었다. 사라진 이전 사본과 동일함을 증명하거나 원본 50개 파일을 재생성했다고 주장하지 않는다.

- 새 백업: `/workspace/moamoa-backups/step3b2-baseline-20261022T130724Z/`
- `working-tree.tar.gz`, `sha256.json`, `files.txt`, `git-status.z`, `README.md`, `VERIFIED.json` 및 실제 압축 해제한 `restore-verification/`을 보존했다.
- Git 추적 파일과 미추적 소스·문서·이미지 **600개**를 담았다. `.git`, 의존성, 환경변수 파일, credential/secret 파일은 수집 대상에서 제외하는 규칙을 적용했다. 실제 목록에 해당 제외 파일은 없었다.
- 소스를 수정하기 전에 압축을 읽고 별도 디렉터리에 복원하여 파일 목록·원본/복원본 SHA-256 전부 일치를 확인했다. 해시 매니페스트는 저장소 밖에 있다.
- 기존 소스를 그대로 재검증: 단위 **142/142**, 브라우저 **57/57**, Production 빌드·폰트·색상·diff 검사 통과. 기존 렌더 21장, FAIL 0 / WARN 21. 원본 로그는 `/workspace/moamoa-backups/revalidation/`에 보존했다.
- 검증 전후 소스 누락·변경 없음. 테스트가 이미지와 검증 JSON을 재생성한 차이만 확인했다. 변경 텍스트 43개의 private key/JWT/대표 토큰 패턴 검사에서 발견 0건(완전한 비밀 탐지 보장은 아님).
- 검증한 **93개 파일**을 `codex/moamoa-step3b-todo-tags`에 커밋했다.
- 커밋: `ef27206814209d33da2355323006186267dc3838`
- 메시지: `feat(moamoa): implement today and todo tag workflows`
- 해당 브랜치만 Push하고 `git ls-remote`로 같은 SHA를 확인했다. 확인한 main은 `5fac23d1f7c727e1c4ee3bd8c7986705b91efd71`이다.
- 이후 `codex/moamoa-step3b-time-analysis` 생성. HEAD는 위 체크포인트이며 확인한 원격 main보다 4커밋 앞/0커밋 뒤다. 이 단계의 변경은 미커밋으로 유지한다. 추가 Push·PR·병합·DB 적용·배포 없음.

## 2. 접근과 실제 데이터 연결

개발 전용 경로: **`/__moamoa-records`**. 기존 App → Auth → PlannerProvider 안에서 동작한다. 프로덕션 기본 홈·내비게이션은 교체하지 않았다. Vite Production 산출물에는 이 경로·새 기록 시트·시연 fixture가 포함되지 않는지 확인한다.

제품 경로는 샘플을 가져오지 않는다. Provider의 TODO·블록·태그·일정과 같은 SaveCoordinator를 사용하며, 별도 파일에 독립 활동을 확인 저장하는 어댑터를 추가했다. `activity_entries`와 블록 스냅샷 컬럼의 존재를 읽기 전용으로 확인한다. 미적용·권한·연결 실패는 저장 불가로 표시하고 버튼을 비활성화한다. 실패를 성공 또는 빈 서버 데이터로 위장하지 않는다.

격리 시연(실제 Auth/Provider/codec, 전송만 메모리):

```sh
TZ=Asia/Seoul MOA_REVIEW_PORT=5176 node scripts/test/serve-moa-today.mjs
# http://localhost:5176/__moamoa-records
# /__moamoa-today, /__moamoa-todos도 같은 시연 데이터 사용
```

시연 상단에 **격리 시연 · 메모리 샘플 · 새로고침 시 초기화**를 표시한다. 시연은 브라우저 메모리만 사용하며 실제 서버 영구 저장을 증명하지 않는다. 자동 검증에서 서버 행을 다음 Provider 마운트의 seed로 넘겨 재조회/새로고침 동작을 검증한 것과, 시연 자체의 영구 저장을 구분한다. 운영 Supabase/Auth/Secret은 조회하지 않았다.

## 3. 구현 범위와 버튼

| 동작 | 결과 |
| --- | --- |
| 기록 메뉴·시간 분석 | 일간·주간·월간을 같은 `aggregateActivity`로 계산 |
| 이전·다음·날짜·오늘 | 선택 기간 이동, 사용자 로컬/논리적 오늘 기본값, 기존 주 시작 설정 유지 |
| 빠른 기록 / 시간 기록 | 모바일 바텀시트·PC 모달. 독립 활동 / 할 일 연결 전환 |
| 독립 활동 | 활동명·분·대표 카테고리·날짜. 제목/시간으로도 미분류 저장 가능. 메모·실제 시각은 선택 확장 |
| 15/30/60/90분 / 직접 입력 | 입력 시간만 변경. 실제 시각을 모르면 null, 가짜 시각 생성 없음 |
| 카테고리 선택 | 기존 시간 태그 선택·검색·관리 UI 재사용. 최대 1개, 선택 없음은 미분류 |
| 할 일 연결 | 기존 TODO ID 선택, 현재 대표/기존 다중 카테고리 확인, 기존 수동 블록 확인 저장 재사용 |
| 기록 저장 | 서버 응답 확인 전 목록·합계 변경 없음. 실패 시 입력과 operation ID 유지 |
| 수정 | 독립 활동의 내용·날짜·소요·카테고리·메모·선택 실제 시각. 소요만 있는 TODO 블록은 날짜/소요 수정 |
| 삭제 | 확인 후 서버 삭제 및 부재 확인. 응답 유실 실패도 같은 ID로 명시적 재시도 |
| 취소 | 저장 중 닫기 방지, 작성 내용은 확인 후 닫기. 오프라인 영구 초안 지원은 아님 |
| 카테고리 필터 | 선택 합계·일별 수치·기록 목록에 적용. 전체 분포·기간 비교는 전체 카테고리임을 명시 |
| 일별 막대 | 일별 숫자와 높이 표시, 해당 날짜 일간 보기 진입 |
| 재조회 | 독립 활동·과거 일정 실적·TODO/블록을 실패 소스별로 다시 확인 가능 |
| 회고·음식·문화/음악·독서·건강 | 기존 기능 경로로 이동. 해당 데이터/저장 코드는 변경하지 않음 |

오늘 홈의 기존 빠른 TODO 입력을 유지하고, 그 시트에서 **활동 시간 기록**으로 진입한다. 홈·할 일·시간 분석은 같은 Provider의 독립 활동까지 포함한 실제 합계를 표시한다. 달력의 TODO를 복제하지 않으며 TODO 완료 상태·목표 진행률·XP는 변경하지 않는다.

반복 TODO 기록은 기존 제한을 유지한다. 실제 시각이 있는 기존 TODO 블록의 수정은 타임라인으로 안내한다. 보존한 레거시 블록과 삭제 시 `do_*` 실적이 부활할 수 있는 마지막 블록은 확인 액션에서 차단한다. 독립 활동은 수정·삭제 모두 가능하다.

## 4. 모델과 SQL 초안

[검토용 SQL](sql-drafts/moamoa_activity_entries.sql)은 **docs/sql-drafts**에만 있다. 자동 마이그레이션 디렉터리에 추가하거나 DB에 적용하지 않았다.

`activity_entries`:

- `id` UUID, `user_id`(서버 `auth.uid()` 기본값), `operation_id` UUID
- `date` date, `name`, `elapsed_sec` 정수(1~86400)
- `category_id` text nullable, `classification_snapshot` JSONB
- `memo`, `started_at`, `ended_at` nullable
- 서버 `created_at`, `updated_at`
- `id = operation_id`, `(user_id, operation_id)` UNIQUE. 같은 초안의 UUID를 유지해 PK conflict DO NOTHING + 조회 확인으로 재시도한다.
- 사용자 소유 SELECT/INSERT/UPDATE/DELETE RLS. UPDATE는 USING과 WITH CHECK 양쪽을 명시한다. 소유자·ID·operation ID 변경 차단, updated_at 갱신 트리거.
- 분류 JSON 구조/유일 태그/가중치 합 검증, 대표 최대 1개, 대표 ID와 snapshot 일치, 실제 시각 쌍과 소요 일치 제약.
- 소유자+날짜 인덱스, Realtime publication 등록 초안.

태그 삭제 후에도 당시 분류를 읽을 수 있도록 `category_id`는 살아 있는 태그에 FK를 걸지 않는다. 사용자 소유 활동 행의 JSON이 분류의 권위다. 운영 사진·인증·기존 데이터에는 접근하지 않았다.

`todo_time_blocks`에는 nullable `classification_snapshot` 1개 컬럼과 이미 있는 스냅샷 변경을 거부하는 트리거 초안을 제안한다. 과거 행의 일괄 보정은 없다. 기존 TODO 소유권 RLS의 cross-owner todo_id 관계와 cascade 정책은 격리 DB에서 별도 검토가 필요하다.

**RLS·트리거·SQL 제약을 실제 PostgreSQL에 적용해 통과했다고 주장하지 않는다.** 메모리 전송은 RLS를 구현하는 DB가 아니다. 승인 후 격리 DB에서 두 사용자/익명 접근, 직접 REST 입력, 동시 생성·삭제, 스키마 캐시, publication 권한을 검증해야 한다.

## 5. 분류 스냅샷과 호환성

```ts
{ version: 1, shares: [{ tagId, name, color, weight }] }
```

| 소스 | 분류 기준 |
| --- | --- |
| 신규 독립 활동 | 대표 0~1개 당시 ID·이름·색상·비율. 명시적 기록 편집 이외에는 변경하지 않음 |
| 신규 TODO 수동 블록 | 당시 TODO 시간 태그를 보존. 일반 태그 제외. 기존 다중 태그는 같은 비율로 보존 |
| 타이머 신규 블록 | 개발 환경에서 보존 스키마를 확인한 경우 당시 분류 저장. 기존 프로덕션 경로는 승인 전 기존 쓰기 계약 유지 |
| 기존 스냅샷 없는 블록 | 현재 TODO의 시간 태그로 균등 분할. 당시 분류를 추측해 저장하지 않음 |
| 기존 `do_*`와 일정 실적 | 기존 현재 태그 기준. 원본 데이터/관계 변경 없음 |
| 명시적 빈 shares | 당시 미분류를 고정. 나중에 TODO 태그를 붙여도 과거 기록을 자동 분류하지 않음 |
| 잘못된 분류 정보 | 현재 태그로 추측하지 않고 실제 시간은 미분류에 포함, 확인 필요로 식별 |

새 TODO 블록의 분류는 수정 화면에서도 바꾸지 않는다. 독립 활동에서 사용자가 그 기록의 카테고리를 직접 편집하는 것은 허용하며, 내용/소요만 바꾸면 원래 스냅샷을 보존한다. 삭제된 태그의 이름·색상도 읽을 수 있다. 카테고리별 합계는 안정적인 태그 ID로 묶고, 상세에는 각 기록 당시 이름을 표시한다. 같은 ID에 서로 다른 당시 이름이 있으면 합계 라벨은 해당 집계에서 선택된 스냅샷 메타를 사용한다.

STEP 3B-2 테스트 중 신규 90분 블록의 TODO 태그 해제 기대값을 새 정책에 맞췄다. 실제 총시간 유지 검증을 그대로 두고 미분류 105분→15분과 **블록의 원래 work 분류 보존**을 추가 확인한다. 기존 복수 태그 배열·분할, 목표 관계, 레거시 60+15분 검증은 유지했다. 테스트를 삭제하거나 검증 강도를 낮추지 않았다.

## 6. 집계·날짜·중복 정책

- `aggregateActivity`의 선택적 7번째 인자로 독립 활동을 더한다. 기존 호출과 `totalMinutes`(분류된 시간) 계약은 유지하며 전체 실적은 `coverage.recordedMinutes`로 표시한다.
- `useTimeReport`를 일간까지 확장하고 기준 날짜를 받을 수 있게 했다. `TrackTimeStrip`, 오늘, 할 일 요약도 같은 엔진을 사용한다.
- 계획 일정과 TODO 계획 시각 제외. 실제 일정 DO만 집계. TODO 블록 우선/레거시 복사 중복 배제·불명확 날짜 진단 유지. 수면·운동 라이프 로그를 입력 소스로 추가하지 않았다.
- 독립 활동은 TODO/목표와 연결하지 않으며 숨긴 TODO를 만들지 않는다. 할 일 연결 모드는 기존 블록에만 저장하고 독립 행에 이중 저장하지 않는다.
- 기록된 `date`에 소요 전체를 귀속한다. 선택한 기록일과 실제 시작일이 다를 수 있으며 자정에 자동 분할하지 않는다. 일별 합계와 포함하는 주/월 합계가 일치한다. 주간 시간 범위는 기존 주 시작 설정, 목표 ISO 주차 함수는 그대로 유지한다.
- 기본 기록 날짜는 사용자 dayEndHour의 논리적 오늘이다. 기존 타이머의 캘린더 날짜 귀속은 변경하지 않았다. 이미 저장된 날짜를 논리적 오늘로 옮기는 마이그레이션은 하지 않는다.
- 시각이 알려진 기록은 날짜를 넘어서 겹침 후보를 찾고, 선택 기간 기록과 관련된 쌍을 표시한다. 이름이 같거나 다르다는 이유로 제거/병합/차감하지 않는다. 소요만 있는 기록은 겹침 판정 불가다.
- 반복 일정은 기존 `getRepeatedEvents`를 재사용한다. Provider의 -365~+730일 계획 창 밖에 있는 실제 기록도 읽도록, 실제 값이 있는 원본 날짜만 별도 투영한다. 반복 계획을 실적 복사본으로 확대하지 않는다.
- 500행 단위 페이지 조회를 활동/확인 조회·TODO/블록 초기 조회·일정 실적에 적용해 기본 REST 상한으로 이력이 잘리는 문제를 줄였다. 1,201개 행 및 중간 페이지 오류를 검증한다. 별도 페이지 요청은 DB snapshot transaction이 아니므로 동시 삽입/삭제 중 결과는 이후 Realtime/명시적 재조회로 다시 확인해야 한다. API의 최대 행 설정은 격리 적용 시 확인해야 한다.

## 7. 저장 신뢰성

SaveCoordinator 자체를 다시 구현하지 않았다. 같은 인스턴스의 run/retry/saveStates와 `confirmedWrites` create/update/delete를 재사용한다. 작업 중 반복 클릭은 같은 요청을 공유하고, 응답 유실 후 동일 PK·operation ID로 재시도한다. 생성 충돌은 기존 행을 덮어쓰지 않고 조회·내용 확인한다. 업데이트는 변경된 컬럼만 전송하며 삭제 후 부재를 확인한다.

JSONB 응답의 객체 키 순서는 바뀔 수 있으므로 확인 비교는 기존 `saveIntent`의 정규화 비교를 사용한다. 단순 문자열화 순서 차이를 저장 실패로 오판하지 않는 회귀 테스트를 추가했다.

실패 시 화면의 확인된 행은 유지하고 초안을 잠가 명시적 재시도를 제공한다. 영구 오류는 재시도를 노출하지 않고 알림 닫기 후 입력 수정이 가능하다. Realtime/visibility/online 재조회는 저장 중 행을 보호하고, 실패가 기존 행을 지우지 않게 한다. 새 기록·과거 일정 및 TODO/블록 조회 실패는 합계 불완전 안내와 재조회로 구분한다.

오프라인 영구 저장, 새로고침 후 미저장 초안 복구, 자동 재시도, 다중 기기 동시 편집의 버전 충돌 해결은 지원하지 않는다. 기존 저장 정책처럼 같은 필드를 동시에 고치면 마지막 서버 쓰기가 우선한다. 메모리 재조회 검증을 실제 Supabase 복수 기기 종단 검증으로 표현하지 않는다.

## 8. 파일별 재사용/변경

| 파일 | 역할 |
| --- | --- |
| `src/lib/activityEntries.ts`, `activityRepository.ts` | 새 활동 타입·검증·분류 캡처·기존 확인 저장 어댑터 |
| `src/lib/activityReport.ts` | 기간 이동과 알려진 실제 구간의 겹침 판정 |
| `src/lib/timeAggregation.ts` | 기존 공통 엔진에 독립 활동·스냅샷·상세 행 추가 |
| `src/lib/readAllRows.ts`, `confirmedWrites.ts`, `db.ts` | 페이지 조회, JSONB 확인 비교, 기존 블록 codec 선택 필드 |
| `src/api/events.ts` | 기존 반복 투영을 이용한 기간 창 밖 실적 확인 조회 |
| `src/app/hooks/useActivityStorage.ts`, `store.tsx` | 공통 Provider/SaveCoordinator·Realtime, 확인된 활동 상태, 안전한 블록 수정/삭제, 조회 실패 진단 |
| `src/app/hooks/useTimeReport.ts`, `components/review/TrackTimeStrip.tsx` | 일간/날짜 선택·새 소스까지 공통 집계 |
| `MoaTimeAnalysisRoute.tsx`, `MoaActivitySheet.tsx`, `time.css` | 새 기록/분석 화면·시트 |
| `MoaFrame`, `moaShared`, `MoaTodayRoute`, `MoaTodosRoute`, `MoaTimeSheet`, `MoaTodoEditor`, `moaToday.ts`, `routes.tsx` | 기존 셸·홈·할 일에서 새 기록 경로 및 보존 정책 연결 |
| `activityEntries.test.ts`, `moa-time.test.mjs`, 관련 fixture | 계산·확인 저장·실제 Provider UI 격리 검증 |
| `docs/sql-drafts/`, `docs/screenshots/moamoa-time/` | 미적용 SQL·실제 렌더 캡처 |

목표 진행률·XP·전체 캘린더·음식/문화 DB·기존 Auth·환경변수는 바꾸지 않았다. 기존 프로토타입은 샘플 시안으로 유지하며 독립 활동을 지원하지 않는 STEP 3A의 상태와 제품 개발 경로를 구분한다.

## 9. 검증

최종 로그 경로: `/workspace/moamoa-backups/step3b3-tests/`.

- 최종 단위: **152/152 통과**(기존 142 + 신규 10), 결과는 `unit-verified.tap`.
- 전체 브라우저: **68/68 통과**. 기존 57 + 신규 11(상위 테스트 포함), 최종 결과는 `browser-verified.tap`.
- Provider/저장/읽기 전용 하네스의 IIFE 번들에는 Vite 환경 변수가 없어 새 훅이 처음에는 예외를 냈다. 제품 코드에서 환경 변수 접근을 보강했고 테스트 조건을 완화하지 않았다. 관련 Provider 테스트 20개 재통과 후 전체를 다시 실행했다. IIFE에서 import.meta를 비우는 esbuild 경고는 별도 환경 안내다.
- 수정 직후 삭제 확인 시트가 직전 수정 성공 상태를 재사용해 즉시 닫히는 문제를 새 인터랙션 테스트가 잡았다. 삭제를 실제 시도한 요청의 성공만 닫기 조건으로 사용하도록 수정했다.
- Production 빌드·폰트·색상·diff 검사 통과. 기존 큰 chunk 경고와 라벤더 baseline 379는 유지한다.
- 기존 렌더 `daily,todos,calendar,goals`: **21장, FAIL 0 / WARN 21**(기존 라벤더 안내). 실제 실행 로그/캡처를 보존한다. 찾지 못한 기존 팝업·메뉴는 스킵으로 보고하며 검증했다고 주장하지 않는다.
- 캡처에 격리 샘플 표시를 추가한 뒤 신규 UI 11/11도 재통과했다. 새 캡처 31장(390/1440px)을 보존하고 주요 PC/모바일·긴 제목·스키마 미적용 이미지를 직접 검토했다.
- 독립 TypeScript 검사용 tsconfig/typecheck 명령은 기존 프로젝트에 없다. Vite/esbuild 변환·빌드 통과를 독립 타입 검사 통과로 표현하지 않는다.
- 운영 DB/RLS/SQL/실제 Realtime 복수 기기 검증은 하지 않았다. 브라우저는 localhost 외 요청을 차단한다. 시도된 외부 주소는 기존 폰트 CSS뿐이다.

실행 명령:

```sh
node_modules/.bin/esbuild src/lib/*.test.ts --bundle --platform=node --format=esm --out-extension:.js=.mjs --outdir=/workspace/moamoa-backups/step3b3-tests/unit
node --test /workspace/moamoa-backups/step3b3-tests/unit/*.mjs
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=daily,todos,calendar,goals
git diff --check
```

## 10. 화면과 공식 문서

[PC/모바일 캡처 목록](screenshots/moamoa-time/README.md). 390×844 / 1440×1024의 실제 Chromium 렌더이며 테스트 시각은 Asia/Seoul 2027-01-01이다. 제품 날짜를 고정한 것이 아니다.

2026-10-22에 Supabase 공식 저장소 최신 master의 다음 원문을 읽었다. 다운로드 원문과 해시는 `/workspace/moamoa-backups/official-docs/`에 보존했다.

- [RLS 공식 문서](https://supabase.com/docs/guides/database/postgres/row-level-security) / [확인한 원문](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx): 소유자 UID, SELECT 필요성, UPDATE USING/WITH CHECK, authenticated 정책.
- [Postgres Changes 공식 문서](https://supabase.com/docs/guides/realtime/postgres-changes) / [원문](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/realtime/postgres-changes.mdx): publication 등록과 table/schema postgres_changes 구독, payload를 믿고 합산하는 대신 소유 범위 재조회.
- [공식 PostgREST SDK QueryBuilder](https://github.com/supabase/postgrest-js/blob/master/src/PostgrestQueryBuilder.ts): upsert onConflict/ignoreDuplicates와 저장 응답 조회 방식 확인. 설치된 Supabase JS 2.x 기존 패턴과 호환되는 API를 사용했다.

문서 검토는 실제 프로젝트 스키마·권한 적용 검증을 대신하지 않는다.

## 11. 실제 Supabase 적용 전 / STEP 3B-4

1. SQL·분류 당시 이름/색상 보존·기록 날짜 귀속 정책을 검토한다. 검토 후 별도 승인된 격리 DB에만 적용해 PostgreSQL 문법/트리거/제약/RLS를 실행 검증한다.
2. 두 사용자·익명·다른 소유자 ID, 같은 operation 동시 생성, 응답 유실 후 재시도, update/delete 확인, 1,000행 이상 조회 및 구독 재접속을 검증한다. 기존 TODO cascade/권한 경쟁 조건은 별도 서버 보강 대상으로 남는다.
3. 검증된 스키마 적용과 실제 새 경로 공개는 별도 승인 후 진행한다. 현재는 SQL 미적용·개발 경로 상태다.
4. STEP 3B-4는 기존 FoodView의 사진/음식명/식비/평가 → CultureRecordView·MusicSection의 리뷰/미디어 → BooksView의 독서/구절 순으로, 동일 ID·사진 경로·DB/API를 유지하며 새 셸과 입력 UX를 연결한다.
5. 사진 중심 조회와 최소 입력을 먼저 만들고 Kakao/TMDB/YouTube 실패 시 수동 입력을 제공한다. 선택 AI는 기본 저장을 막지 않게 한다. 음식·운동·문화 기록을 활동 시간으로 자동 합산하지 않는다. 이번 단계에서는 해당 기능의 UI·데이터·API를 변경하지 않았다.
