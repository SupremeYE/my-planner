# MoaMoa Preview 탐색·레이아웃 통일

이 문서는 `30517fc`까지의 탐색 개선 기록이다. 이후 문화·음악의 영상 화면 연결 및 최신 검증은 [문화 기록 Preview 통합 보고서](MOAMOA_PREVIEW_CULTURE.md)를 따른다.

## 작업 기준과 보존

- 브랜치 `codex/moamoa-review-preview`, 시작 HEAD `c0ad0db5d42c339ee8d86bc577999d9e9cab543b`와 원격 SHA 일치, 작업 트리 깨끗함을 확인했다.
- 기존 샘플 Provider·메모리 DB/사진 Blob·저장 확인/재시도 로직을 유지한다. `src/app`·`src/lib`의 제품 소스, 실제 서비스 라우트, 데이터 모델/SQL은 수정하지 않았다.
- Vercel 정적 Preview 설정과 Production 거부 조건, SDK/환경값 격리, API 차단, Deployment Protection은 유지한다. main·운영 DB/Storage·환경변수에 변경하지 않는다.
- 기준 커밋을 실제 렌더한 수정 전 자료 30장과 수정 후 56장을 분리했다. 기존 회귀 테스트에서 다시 생성된 과거 스크린샷/JSON 11개는 `/workspace/moamoa-backups/review-preview/navigation-regenerated-docs`에 해시 목록과 보존한 뒤 해당 원래 버전으로 돌렸다. 이번 변경에는 새 비교 자료만 포함한다.

## 변경 파일과 방식

| 파일 | 변경 |
|---|---|
| `src/review/main.ts` | 상단 배너/별도 nav/DOM 초기화 버튼 제거. 정원·습관 데모 행도 같은 메모리 테이블에 시드 |
| `ReviewShell.tsx` | 유일한 PC 사이드바, 모바일 5개 하단 탭, 작은 샘플 안내·초기화, 정상 흐름의 저장 알림 |
| `ReviewFrame.tsx` | 기존 페이지의 본문·빠른 기록 액션을 공통 Shell에 표시 |
| `reviewRoutes.tsx` | Preview 전용 라우터. 캘린더·정원 연결 및 미지원 페이지 안내 |
| `ReviewCalendar.tsx` | 월·주·일 / 주간 일정·플래너. 실제 Provider와 공통 집계·진행률 사용 |
| `ReviewGarden.tsx` | 모아·레벨/XP·목표·성장 요약·씨앗·완료 성취 조회 |
| `ReviewQuick.tsx` | 캘린더·정원에서 기존 `MoaTodoEditor` 및 확인 저장 액션 재사용 |
| `review.css`, `calendarGarden.css` | 고정 Dock 제거, 자연스러운 스크롤, 플로팅 버튼, 접힌 사이드바·태블릿·모바일 레이아웃 |
| `vite.review.config.ts` | Preview에서만 라우터/Frame alias 및 Today의 중복 레이아웃 제거. 실제 Today 데이터/액션은 유지 |
| `scripts/test/moa-review.test.mjs` | 기존 격리 테스트를 3개 크기와 새 탐색/상호작용 검증으로 확장 |
| 관련 문서·스크린샷 | 현재 동작과 전후 비교·검증 기록 |

`MoaFrame.tsx`, `MoaTodayRoute.tsx`, `moaShared.ts`의 제품 파일은 변경하지 않는다. 기존 5개 메뉴 정의를 `ReviewShell`이 재사용하고, 검토 빌드에서만 Frame과 라우터를 교체한다. Today는 데이터·저장 액션을 그대로 실행하면서 별도 aside/header/bottom nav만 빌드 변환으로 제외한다. 해당 레이아웃 슬롯이 바뀌거나 원래 라우터/실제 Supabase SDK가 검토 번들에 들어오면 빌드가 실패한다.

## 내비게이션과 스크롤

- PC·태블릿(768px 이상): 좌측 5개 메뉴만 사용. 상단 가로 메뉴 없음. 펼침 216px / 접힘 76px.
- 접어도 현재 URL·활성 메뉴 유지, 페이지 이동 후에도 같은 Shell이 접힘 상태를 유지한다. 아이콘에 `title`·접근성 이름, 토글에 `aria-expanded`·`aria-controls`가 있다. Space 키로 펼침을 검증했다. 새로고침 시 기본 펼침 상태다.
- 모바일: PC 사이드바를 숨기고 하단 `오늘 / 캘린더 / 할 일 / 기록 / 나의 정원`만 사용. 상단은 로고·샘플 상태·초기화 버튼이다.
- 음식은 `기록 → 음식`에서 진입한다. 별도 주요 음식 메뉴를 만들지 않는다.
- 검토 배너의 88px 고정 높이/padding 제거, `.mt-root::after` Dock 비활성화, `.mt-scroll`이 실제 가용 높이 전체를 사용한다.
- 빠른 기록 버튼만 우측 하단 고정. 모바일은 하단 탭과 safe area 위로 배치한다. 본문 끝에 100~120px의 **스크롤 여백**을 두며 고정 배경/보더는 없다.
- 저장 알림은 본문 위의 정상 레이아웃 흐름으로 옮겨 기간 버튼을 덮지 않는다. 모달에서는 기존 inline 저장/재시도를 사용한다. 확인 저장 정책은 바꾸지 않았다.
- 기존 홈 링크·기존 음식 화면 링크를 Preview에서 제거했다. 문화·독서 등 후속 화면은 모아모아 틀 안에서 미지원 안내를 표시하며 My Planner UI로 전환하지 않는다.

## 캘린더

STEP 3A `Calendar.tsx`의 종이 위클리 구조와 PLAN/DO 표현을 참고했지만 `PrototypeState`, `sample.ts`는 연결하지 않았다.

- 월간: 42일 달력, 일정 요약/할 일 수, 날짜 클릭으로 일간 이동.
- 주간 일정: PC는 월~일 7열, 1100px 미만은 요일 선택 후 하루 중심. 계획/실제 2개 레인. 24시간 전체를 내부 스크롤로 확인할 수 있고 처음에는 07시 부근을 보여준다.
- 일간: 선택 날짜의 계획·실제와 시각 없는 기록. 날짜 선택/이전·다음/오늘 동작.
- 주간 플래너: 공통 주간 목표 진행률, 요일별 일정·할 일, 날짜 미정 목록, 주간 습관 조회, 실제 시간 요약, 주간 회고 진입.
- 이번 주 목표에 연결된 날짜 미정 TODO와 나머지 날짜 미정 TODO를 구분한다. 후자는 특정 주에 배정되었다고 추정하지 않는다.
- 할 일은 `moaTodayData`의 기간/반복 해석을 재사용한다. Provider에서 확장한 반복 일정을 다시 확장하지 않는다.
- 실제 기록은 `aggregateActivity`를 사용한다. 계획·완료 체크로 시간을 생성하지 않고, 블록/레거시 중복 방지·미분류·당시 분류 규칙을 유지한다. 시각이 없는 활동은 시간표 아래에 소요만 표시한다. 합계는 기록 날짜에 귀속하는 기존 규칙이다.
- 완료 체크는 동일 TODO ID에 `updateTodo`·기존 완료 마커·SaveCoordinator를 사용한다. 실패하면 기존 상태/진행률을 유지하고 정상 흐름의 저장 알림에서 재시도한다.
- 일정 추가·시간 이동·편집, 습관 체크/편집, 주간 회고 편집은 미지원으로 안내한다. 회고 버튼은 기존 주간 회고 하이라이트 또는 빈 상태와 기간 요약을 보는 모아모아 다이얼로그를 연다.
- 샘플 Provider에서 불러온 일정 범위만 표시한다. 운영 일정이나 별도 서버를 조회하지 않는다.

## 나의 정원

STEP 3A `RecordsGarden.tsx`의 캐릭터·목표·씨앗·성취 카드 구성을 참고했다.

- 캐릭터는 기존 `MoaBuddy`, 월·연간 목표는 Provider와 `monthlyRollup`/`annualRollup`을 사용한다.
- XP는 `ProfileView`의 기존 공식과 레벨 곡선을 현재 샘플에 읽기 전용으로 투영한다. 완료 TODO×10 + 습관 체크×5 + 기존 스트릭 보너스 + 기존 TODO 실적 기반 집중시간 항을 유지한다. XP를 저장하거나 새 보상을 생성하지 않는다.
- 성장 기록은 완료 수·습관 체크 수·기록일 수의 현재 요약이다. 과거 XP 변동 이력을 가짜로 생성하지 않는다.
- 씨앗은 기존 `useSomedaySeeds`/DB codec을 같은 메모리 테이블에서 읽는다. 목표/씨앗 편집은 미지원으로 표시한다.
- 기억에 남는 성취는 실제로 완료 상태인 샘플 TODO에서 표시한다. 할 일 완료를 바꾸면 같은 데이터에 따라 갱신된다.

## 실제 검증 결과

| 검사 | 결과 |
|---|---|
| 기존 단위 | 159/159 통과 |
| 기존 브라우저/API·저장·환경 회귀 | 83/83 통과 |
| Preview 통합/격리 | 2/2 통과, 기존 조건 유지 및 새 시나리오 추가 |
| 일반 Production 빌드 | 통과, 기존 큰 번들 경고 유지 |
| 폰트/색상 lint | 통과, 색상 baseline 379 유지 |
| 기존 `render:check --route=calendar,todos` | 10장, FAIL 0 / 기존 라벤더 WARN 10 |
| Preview 실제 Chromium | 390×844 / 768×1024 / 1440×1024, 가로 넘침·pageerror·외부 요청 0 |
| 전후 비교 | 전 30장 / 후 56장 |
| `git diff --check` | 통과 |

독립 TypeScript 검사 명령/tsconfig는 없어 Vite 변환·번들링 및 브라우저 실행 범위로 검증했다. 실제 iPhone 촬영/PWA 검증과 운영 Supabase 검증은 하지 않았다.

새 통합 검증은 다음을 포함한다.

- 크기별 주요 메뉴 중복 없음, 각 메뉴 5개, 기존 홈/음식 화면 링크 없음
- 사이드바 폭과 본문 확장, 활성 메뉴·URL·접힘 상태 유지, 키보드 펼침
- 캘린더 월·주·일, 일정/플래너, 날짜 이동, 미정 TODO, 습관·주간 회고
- 동일 TODO 완료가 오늘·할 일·정원의 동일 목표 진행률에 반영
- 캘린더 완료 쓰기 실패 시 상태/진행률 보존 및 명시적 재시도
- 오늘·캘린더·정원 빠른 TODO, 기록의 독립 활동, 음식 사진 선택·실패·재시도
- 고정 Dock 없음, 가용 영역 전체 스크롤, 각 크기의 오늘·플래너·정원 마지막 콘텐츠가 FAB 위로 노출됨
- 샘플 초기화, 실제 DB/Storage/API 네트워크 요청 없음, Production/다른 브랜치 검토 빌드 거부

재실행:

```bash
node --test scripts/test/moa-review.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar,todos
```

[전후 스크린샷](screenshots/moamoa-navigation/README.md)

## Preview 확인

승인된 `codex/moamoa-review-preview`에만 커밋·Push하여 기존 GitHub 연동 자동 Preview를 사용한다. Vercel 도구/인증이 없으므로 READY 상태나 새 URL을 임의로 확정하지 않는다.

Vercel의 `supremeyes-projects/my-planner` → Deployments에서 검토 브랜치와 최종 Push 커밋 SHA를 대조하고 READY 후 URL의 `/`로 진입한다. 기존 Deployment Protection을 통과한 뒤 PC·iPhone에서 같은 URL을 사용한다. 입력과 사진은 탭 메모리에만 있으며 새로고침/초기화 시 사라진다. 이번 작업에서 main 병합·Production 배포·DB/Storage·운영 Secret 변경은 하지 않는다.
