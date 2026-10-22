# MoaMoa STEP 3B-1 — 오늘 홈 실사용 연결

## 체크포인트와 작업 상태

- 시작 브랜치: `codex/moamoa-step3-ui-prototype`
- 시작 HEAD: `e56020acb065cbec95a24c0cca6808eaafc21240`
- STEP 3A 변경 36개가 UX 문서 및 허용된 프로토타입 경로와 일치함을 확인했다. 예상 밖 파일 및 자격증명 패턴은 없었다.
- 보존 전 단위 테스트 132개, 프로토타입 브라우저 테스트 9개, 빌드, 폰트·색상 검사 통과.
- 체크포인트: `e633a0df44ee5006cf1323695d8ffe644d34c6bd`
- 커밋 메시지: `feat(moamoa): add isolated UX prototype`
- `origin/codex/moamoa-step3-ui-prototype`에만 Push했으며 원격 SHA도 확인했다.
- 현재 브랜치: `codex/moamoa-step3b-today`. HEAD는 위 체크포인트이며 STEP 3B 변경은 미커밋 상태다.
- 확인한 원격 main: `5fac23d1f7c727e1c4ee3bd8c7986705b91efd71`. 현재 HEAD는 main 대비 0 behind / 3 ahead이다.
- 추가 Push, PR, 병합, DB 변경, 환경변수 변경 및 배포는 수행하지 않았다.

## 접근 방법과 격리

실제 제품 연결 경로는 개발 서버의 `/__moamoa-today`이다. `import.meta.env.DEV` 조건의 lazy route로 등록했다. 기존 App의 Auth → PlannerProvider → TimerProvider/FabProvider 구조 안에서 실행되며 기본 `/dashboard`, 기존 홈 및 내비게이션은 유지한다. 프로덕션 빌드에는 새 경로·화면·CSS가 포함되지 않는다.

현재 클라우드에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 및 이를 제공하는 `.env*`가 없다. 값을 만들거나 운영 설정을 가져오지 않았다. 실제 계정/RLS/서버 저장 검증은 별도로 격리 Supabase 설정이 준비되어야 한다. 실제 연결 설정이 있는 환경에서는 다음과 같이 접근한다.

```sh
npm run dev -- --host 0.0.0.0 --port 5174
# http://localhost:5174/__moamoa-today — 기존 로그인 필요
```

바로 시연할 수 있도록 실제 App/Auth/Provider/DB 변환 코드를 사용하면서 전송 계층만 메모리로 바꾸는 별도 서버도 제공한다.

```sh
TZ=Asia/Seoul node scripts/test/serve-moa-today.mjs
# http://localhost:5175/__moamoa-today
```

이 서버 상단에는 **격리 시연 · 메모리 샘플 · 새로고침 시 초기화**가 표시된다. 샘플은 `scripts/test/fixtures/`에만 있으며 제품 코드에서 가져오지 않는다. DB 요청은 메모리 전송 계층이 처리하고 새로고침 시 초기화된다. 실제 제품에서 샘플을 채워 빈 데이터를 감추는 fallback은 없다. 이 서버를 실제 데이터 저장 확인 용도로 사용하면 안 된다.

## 수정 파일

| 파일 | 변경 |
| --- | --- |
| `src/app/routes.tsx` | Auth를 우회하지 않는 개발 전용 lazy route 추가 |
| `src/app/components/moamoa/MoaTodayRoute.tsx` | 실제 Provider 기반 홈, 날짜 이동, 완료 액션, 빠른 TODO 시트, 기존 회고 시트 진입 |
| `src/app/components/moamoa/today.css` | 크림·세이지 스타일을 새 화면 안에 한정, 반응형, 하단 안전 영역과 기록 버튼 전용 공간 |
| `src/app/components/moamoa/MoaBuddy.tsx` | 프로토타입의 순수 캐릭터 SVG를 공유 위치로 이동 |
| `src/prototypes/moamoa/ui.tsx` | 기존 캐릭터 export를 공유 SVG로 연결. 샘플 상태는 기존 경로에 유지 |
| `src/app/components/SaveStatus.tsx` | 선택적 inline/키 필터 표시 추가. 기본 표시와 재시도·저장 로직은 유지 |
| `src/lib/moaToday.ts` | 읽기 전용 화면 투영. 공통 진행률·반복 TODO·기간·ISO 주차·활동 시간 집계 사용 |
| `src/lib/moaToday.test.ts` | 투영과 경계 조건의 단위 테스트 5개 |
| `scripts/test/moa-today.test.mjs` | 실제 App/Auth/Provider를 사용하는 브라우저 검증 및 캡처 |
| `scripts/test/fixtures/moa-today-data.mjs` | 격리된 테스트 데이터 |
| `scripts/test/fixtures/moa-today-supabase.ts` | STEP 2 메모리 전송 계층 재사용, 테스트용 세션·초기 로딩 지연 |
| `scripts/test/serve-moa-today.mjs` | 실제 날짜를 사용하는 격리 시연 서버 |
| `docs/screenshots/moamoa-today/` | PC·모바일 실제 렌더링 결과와 검증 자료 |

`store.tsx`, 공통 진행률, SaveCoordinator, confirmedWrites, 시간 집계 및 DB 스키마는 수정하지 않았다.

## 화면과 실제 데이터 연결

| 요소 | 연결 / 동작 |
| --- | --- |
| 날짜·인사 | 브라우저 로컬 시간과 기존 `logicalDateStr(now, dayEndHour)` 사용. 설정 변경, 15초 간격, focus/visibility 복귀 시 갱신. 날짜 선택을 하지 않았다면 논리적 오늘을 계속 따라간다 |
| 주간 목표 | `getWeekKey` + `weekKeysMatch`, 원본 TODO로 `weeklyRollup`, 전체는 `combineRollups`. 수동 완료와 연결 TODO 완료를 서로 다른 설명으로 표시 |
| 목표 우선순위 | 기본 두 목표, 긴 제목 두 줄. 나머지와 전체 제목은 펼치기. 전체 진행률은 숨겨진 목표까지 모두 포함한다 |
| 핵심 TODO | `expandRecurringTodos`, 기간 규칙, `isTop3` 기준 최대 3개. 취소·백로그 제외, 완료 행은 유지. 날짜 없는 TODO도 주간 목표 진행률에는 공통 규칙대로 포함 |
| 완료 | 기존 `updateTodo` 및 `completionMarkerPatch`. 실측 시간을 만들지 않는다. 해당 TODO에 활성 타이머가 있으면 기존 `finishActiveTimer` 사용 |
| 일정 | Provider에서 이미 확장된 Event를 다시 확장하지 않는다. 반복 예외·시간대 변환은 `api/events` 재사용. 종일 기간 일정은 기존 캘린더의 포함 날짜 규칙 사용. 계획 일정임을 표시 |
| 실제 활동 | 원본 todos/events/tags/timeBlocks로 `aggregateActivity`. `coverage.recordedMinutes` 표시, 미분류 시간과 계산 불가 기록의 건수 구분. 수면·운동 로그를 별도 합산하지 않음 |
| 빠른 기록 | 현재 단계는 제목만 필요한 TODO 생성. 기본 날짜는 시트를 처음 연 논리적 오늘. `isTop3=false`; 별표 선택은 기존 일간 화면에서 제공 |
| 회고 | 선택 날짜의 기존 `RetroSheet` 열기. 별도 저장소·새 저장 액션을 만들지 않음 |
| 빈 상태 | 목표·핵심 TODO·일정 각각 안내. 데이터가 없으면 0분이며 가짜 기록·XP는 없음 |
| 오프라인 | 저장 불가·데이터 최신성 주의 표시. 저장 큐나 자동 재시도가 있는 것처럼 표현하지 않음 |

반복 TODO에는 기존 확장 코드가 원본 `endDate`를 남기는 경우가 있었다. 새 홈에서는 확장 엔진이 선택한 회차의 날짜로 표시 여부를 판단한다. 원본/예외 행의 endDate를 자동 수정하지 않는다. 다른 레거시 화면의 동일 문제까지 확장하여 수정하지 않았다.

## 저장 확인과 실패 처리

1. TODO 완료는 서버 확인 전 기존 체크 상태를 유지한다. 동기적인 중복 클릭은 ref로 막고, 저장 중 버튼을 비활성화한다. 불확실한 TODO 요청이 남아 있는 동안 다른 체크도 보수적으로 잠근다.
2. 빠른 TODO는 초안마다 UUID 하나를 만들고 기존 `addTodo(value, creationId)`에 전달한다. 저장 실패·명시적 재시도는 같은 ID와 payload를 사용한다.
3. 성공은 Provider에 확인된 ID가 나타난 뒤 처리한다. 전역/시트 재시도에서 성공해도 시트를 닫고 초안을 비운다. 실패 시 제목과 날짜를 보존한다. 시트만 닫았다 다시 열어도 유지한다.
4. 시트 안에서는 공통 SaveStatus를 inline으로 표시해 모달 focus 범위 안에서 키보드로 재시도할 수 있다. 이때 배경의 동일 알림은 가린다. 영구 오류에는 재시도 버튼이 없다.
5. 오류가 남아 있을 때 입력을 잠가 재시도 payload와 다른 제목을 성공으로 오인하지 않게 한다. 알림을 닫고 수정할 때도 생성 ID를 유지한다. 응답 유실 뒤 다른 내용으로 덮어쓰는 동작은 기존 confirmed writer가 거절한다.
6. 초안은 현재 화면의 메모리에만 보관한다. 브라우저 새로고침이나 화면을 완전히 떠난 뒤의 초안 복구, 오프라인 영구 보관은 제공하지 않는다.
7. 기존 Realtime/visibility 동기화와 확인 저장 계층을 그대로 사용한다.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `src/lib/*.test.ts` esbuild 번들 후 `node --test` | **137/137 통과**. STEP 1·2 시간/주차/진행률/저장 회귀 포함 |
| 기존 `events-actual`, `goal-pages`, `planner-persistence`, `planner-read-only`, `moamoa-prototype` | **32/32 통과** |
| `node --test scripts/test/moa-today.test.mjs` | **11/11 통과** (상위 suite 포함) |
| `npm run build` | 통과. 기존 500kB 초과 chunk 경고는 남아 있음 |
| `npm run lint:fonts` | 하드코딩 위반 0 |
| `npm run lint:colors` | 379/379 baseline, 초과·금지 색상 위반 0 |
| `HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=daily,todos,calendar,goals` | 21장, FAIL 0 / WARN 21. WARN은 기존 라벤더 사용 안내 |
| `git diff --check` | 통과 |
| 독립 TypeScript 검사 | 설정·의존성·명령이 없어 실행하지 않음. Vite/esbuild 변환·빌드 성공을 독립 타입 검사 성공으로 간주하지 않음 |

브라우저 자동 검증은 다음을 포함한다.

- 홈 진행률과 공통 계산 일치, 날짜 없는 연결 TODO, 취소, 수동 완료 및 ISO 연초 레거시 키 조회.
- 완료 저장 지연 시 미완료 유지, 반복 클릭 1회 요청, 저장 실패 상태 유지·명시적 재시도.
- 제목만으로 생성, 시트 닫기/열기 초안 보존, 저장 중 중복 submit 방지, 응답 유실 후 1행만 생성.
- 권한 오류에는 재시도 없음, 오류 알림을 닫고 수정하는 경로.
- 저장 결과를 메모리 서버 행으로 새로고침해 재조회하는 경로.
- 반복 TODO의 확정 예외 생성, 다음 날짜의 가상 회차, 반복 일정의 계획만 표시.
- 실제 활동 45분(블록 30 + 미분류 일정 실적 15), TODO 레거시 60분과 블록의 중복 방지, 계획 시간 제외.
- 새벽 01:59→02:01의 논리적 날짜 갱신, 빈 화면·로딩·오프라인·긴 제목.
- 390/1440px 가로 넘침 없음, 목표 첫 화면 노출, 44px 체크 영역, 기록 버튼 위에서 스크롤 콘텐츠 종료.
- 비로그인 시 실제 Auth gate에 의해 Provider 조회 없음, 제품 모듈에 프로토타입 sample/PrototypeState 유입 없음.

운영 DB를 사용한 검증은 없다. 외부 요청을 가로채 차단했으며 시도된 것은 기존 CSS의 외부 폰트 주소뿐이었다. Supabase/API 요청은 없었다. 캡처는 로컬/대체 폰트로 렌더링된다.

중간 실패는 테스트 선택자(`감사` 대신 실제 `🙏 감사한 것`), 확장 결과 정렬에 대한 테스트 기대값, 외부 폰트 차단 감사의 기대값, 병렬 콜드 서버 구동 시 초기 12초 navigation timeout이었다. 선택자/기대값과 초기 탐색 제한을 수정한 최종 검증은 통과했다. 기능 오류를 성공으로 무시한 것은 없다.

기존 렌더 하네스는 PC timeblock 탭 및 일부 daily 메뉴·반복 편집·모바일 일정 편집 팝업을 찾지 못해 스킵했다. 해당 팝업 전체를 검증했다고 주장하지 않는다.

## 스크린샷

[스크린샷 안내와 링크](screenshots/moamoa-today/README.md)를 참고한다. 새 홈·시트·오류·로딩·긴 제목·기록 요약을 실제 Chromium 렌더링으로 검토했다.

- `mobile-review-live.png`, `desktop-review-live.png`: 현재 날짜, 격리 시연 서버, 화면 상단 샘플 배지.
- `mobile-today.png`, `desktop-today.png`: 2027-01-01 / Asia/Seoul의 재현 가능한 ISO 경계 fixture.
- `mobile-long-titles.png`: 자세히 펼친 상태. 기본 요약 상태에서는 두 줄 표시와 첫 화면 노출을 별도로 자동 확인했다.

## 남은 한계와 회귀 위험

- 실제 Supabase/Auth/RLS/서버 간 동기화의 종단 검증은 격리 환경 설정이 없어 미실시했다. 운영 DB로 대신하지 않았다.
- 기존 Provider의 일부 초기 읽기 API는 실패를 빈 배열로 반환한다. 온라인 상태의 초기 서버 읽기 실패와 진짜 빈 데이터를 완전히 구분하는 공통 오류 모델은 기존 한계이며 이번 단계에서 DB 계층을 재작성하지 않았다.
- 회고는 진입점만 연결했다. `RetroSheet`의 기존 낙관적 저장·실패 처리 한계는 TODO·목표용 확인 저장과 별개로 남는다.
- 날짜 없는 주간 TODO 배정, 독립 활동 기록, 프로덕션 기본 홈 교체는 구현하지 않았다.
- Provider 일정 읽기 범위는 기존 현재일 기준 과거 365일~미래 730일이다. 홈에서 그 범위 밖의 일정 완전성을 보장하지 않는다. 야간 시각의 불명확성도 공통 집계 진단을 유지한다.
- 저장 중/불확실한 TODO 오류가 있을 때 홈의 다른 체크도 잠그는 방식은 안전을 우선한 보수적 제한이다. 후속 UX에서 항목별 잠금을 다듬을 수 있다.
- 개발 전용 라우트·CSS 격리, 기본 SaveStatus의 기존 기본값 유지, 공통 계산/저장 코드 무수정으로 기존 제품 화면의 회귀 범위를 줄였다. 기본 홈·기존 목표 화면 회귀 테스트와 빌드를 확인했다.

## STEP 3B-2 권장 범위

1. 이번 홈의 실제 사용성 확인: 목표 요약 두 개, 펼치기, 제목만 기록, 핵심 별표는 기존 일간 화면에서 고르는 흐름.
2. 할 일 최소 목록을 별도 개발 경로에 연결: 기존 TODO ID·필터·확인 저장 액션으로 홈과 상태 일치 검증. 신규 저장소는 만들지 않는다.
3. 공통 초기 조회 오류와 회고 저장 실패 표시를 작은 단위로 개선. 격리 Supabase에서 RLS·새로고침·두 기기 동기화를 검증한다.
4. 주간 플래너는 날짜 없는 TODO의 주 배정 모델을 먼저 합의한 뒤 동일 데이터를 투영한다. DB 변경이 필요하면 별도 승인 절차로 분리한다.
5. 독립 활동 기록은 `activity_entries` 설계를 승인받은 다음 단계에서 다룬다. 홈 교체·배포는 디자인/실사용 검토 후 별도 승인 대상으로 남긴다.

## 후속 요청 반영 — 문구·메뉴·기록 기능 계획

- 오늘의 응원은 `오늘도, 힘내자!` / `작은 일부터 하나씩.`으로 변경했다. 실제 오늘 화면과 STEP 3A 시안을 함께 반영했다.
- 메뉴는 `오늘 / 캘린더 / 할 일 / 기록 / 나의 정원`으로 통일했다. 새 오늘 화면에만 모바일 하단 메뉴를 두고 기록 버튼과 함께 별도 공간을 확보했다. 기존 프로덕션 내비게이션은 교체하지 않았다. 현재 정원 진입은 기존 `/profile`을 재사용한다.
- 할 일의 내부 ID·`quests` 화면 키·저장 액션·목표 연결은 변경하지 않았다. 퀘스트는 게임적 완료 축하·보상 용어로만 남긴다.
- 음식·문화·음악·독서는 삭제하지 않고, 독립 시간 기록 이후 **STEP 3B-4**에서 기존 화면·사진·데이터·API·DB 구조를 우선 재사용해 개선한다. 기록 화면의 빠른 진입, 사진 중심 입력/조회, 외부 API·AI 실패와 무관한 수동 기록을 명세에 포함했다.
- 주간 플래너는 STEP 3B-5, 나머지 생활 기록·정원 연결은 STEP 3B-6으로 후순위를 조정했다. 이번에는 음식·문화 등 기능이나 저장 구조를 구현·수정하지 않았다.

추가 요청 검증: 오늘 화면·프로토타입 브라우저 테스트 **20/20 통과**, 390px 제목 한 줄/캐릭터 비겹침과 PC·모바일 5개 메뉴명 일치를 확인했다. Production 빌드·폰트·색상·diff 검사는 통과했다. 이번 추가 작업의 `render:check -- --route=todos`는 4장 FAIL 0 / 기존 라벤더 WARN 4였다(앞 절의 21장은 최초 STEP 3B-1 검증 이력). 현재 날짜 격리 시연 및 고정 경계 fixture의 스크린샷을 모두 갱신했다.

## 후속 요청 반영 — 태그와 시간 분석 연계 계획

이번에는 문서만 수정했다. STEP 3B-2에는 할 일 등록/수정의 대표 시간 분석 태그(선택·최대 1개)와 일반 보조 태그 여러 개, 독립된 목표 연결, 태그 관리·확인 저장을 배치했다. STEP 3B-3에는 일·주·월 공통 집계와 미분류/계산 불가 기록 구분을 배치했다.

최소안은 `Todo.tags`에 신규 선택 규칙을 적용해 DB 변경 없이 기존 엔진을 재사용하는 것이다. 기존 다중 `trackTime` 태그는 균등 분할을 유지한다. 전역 `Tag.trackTime`으로 TODO별 대표/보조 역할을 자유롭게 표현할 수는 없으므로, 그 기능이 필요하면 별도 역할 모델을 검토해야 한다. 현재 태그 변경은 과거 블록의 분류에도 영향을 주므로 영향을 안내한다.

읽기 검토에서 기존 태그 CRUD의 낙관적 저장과 `deleteTag`의 모든 TODO upsert를 확인했다. 이를 무검토 재사용하지 않고, 확인 저장과 참조 검증·안전한 삭제를 후속 최소 개선에 포함했다. 기존 태그·DB·집계 코드와 STEP 3B-1 UI는 이번 요청으로 수정하지 않았다. 상세 입력·호환·검증 계약은 [UX 명세](MOAMOA_V01_UX_SPEC.md)의 ‘할 일 태그와 실제 시간 분석’ 절을 따른다.
