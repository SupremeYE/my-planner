# MoaMoa Preview — 최종 PLAN 타임테이블 통합

## 기준 및 범위

- Preview 기준: `4ffefb2bc5d4e47f990e0ac95235d3c4b5e5db8b`.
- 선별 기능 소스: `5aa02a7c3f1e3ff557de4042a9f20431aa856202` (`codex/moamoa-step3b6a-calendar-ui`).
- 독립 클론: `/workspace/moamoa-preview-plan`. 대상 브랜치: `codex/moamoa-review-preview`.
- 개발용 `MoaCalendarPlanRoute`나 사이드바/라우터 전체를 가져오지 않았다. 기존 ReviewShell·ReviewCalendar에 공통 시간표와 편집기만 연결했다.
- main, 다른 기능 브랜치, 운영 DB/Storage, 환경변수, Vercel 설정·Deployment Protection은 변경하지 않는다.

## 선별 통합

| 영역 | 채택 및 조정 |
|---|---|
| 타임라인 | CalendarTimeline, calendarTimeline 및 계산 테스트·스타일. 7일 공통 축, 분 단위 높이, 겹침 분할, 모바일 선택일 PLAN/DO 비교 유지 |
| 편집기 | 개발용 Route의 PlanEditor 본문을 CalendarPlanEditor로 분리. 개발용 화면 구조는 제외 |
| 저장 | calendarPlanRepository, useCalendarPlans, todoCodec 및 Provider 확인 저장 액션. 기존 SaveCoordinator 하나만 사용 |
| Event | 기존 v2 start_at/end_at 코덱을 내보내어 재사용. 신규 Event 태그 쓰기는 제한 |
| 자연어 | 기능 소스의 quickParse 채택. 기존 파서 테스트와 신규 PLAN 경계 테스트 함께 실행 |
| Preview | ReviewCalendar의 주간 일정/일간만 새 시간표에 연결. 월간·주간 플래너·회고는 보존 |
| 메모리 DB | 기존 주간 회고 uniqueness/정렬 설정 유지. CAS 배열 비교만 보완 |

원본 Git blob·SHA-256 및 통합 후 해시는 `docs/validation/moamoa-preview-plan/source-manifest.json`에 기록했다. 원본과 다른 공통 파일은 타임라인의 상단 영역/접근성 표시와 기존 `is_top3` 입력·패치 허용 및 그 테스트다.

## 화면·저장 동작

- 캘린더 → 월간/주간/일간, 주간 → 일정/플래너와 회고 작성·수정 경로를 유지한다.
- 시간 미지정 할 일·종일 일정·시작 없는 실제 기록은 시간축 바깥 상단에 날짜별로 표시한다. 많은 항목은 펼치기로 확인한다. 날짜 미정 할 일은 별도 접힌 목록이며 비어 있으면 영역을 만들지 않는다.
- `일정 추가`, `할 일 추가·빠른 입력`, 빈 PLAN 칸, 기존 블록, 플로팅 빠른 기록에서 같은 편집기로 진입한다. 삭제 확인, 초안 유지, 저장 상태와 명시적 재시도를 제공한다.
- 일정/할 일 종류·날짜·시간·태그·주간 목표를 저장 전 확인·변경한다. Event 태그는 스키마 근거 부족으로 입력하지 않고 기존 값은 보존한다.
- `다음주 월요일 운동가기 #자기계발 19:00~20:00`은 2027-01-01 기준 제목 운동가기, 날짜 2027-01-04, 19:00~20:00, 기존 growth 태그 ID로 해석한다. 해석 중 DB 쓰기는 없다.
- Provider의 todos/events 상태를 직접 갱신한다. useCalendarPlans는 같은 상태의 코덱 투영이며 별도 레코드 저장소가 아니다. 확인 응답 전 성공 목록을 만들지 않는다.
- 생성 ID 고정, 중복 실행 잠금, 변경 필드 CAS, 충돌·삭제 보호, 응답 유실 후 재조회, 조회 실패 시 마지막 데이터 보존을 사용한다. 반복 마스터/회차 수정·삭제는 안전을 위해 제한한다.
- 캘린더 날짜 선택은 Provider selectedDate와 연결했다. Preview 할 일 화면에 같은 날짜 필터를 제공하여 미래 계획도 같은 ID로 확인할 수 있다. 오늘 화면은 실제 날짜와 기존 최대 3개 Top3 규칙을 유지한다. 편집기의 명시적 Top3 옵션으로 홈 표시를 선택한다.

## PLAN / DO

- 계획은 TODO plan_start/plan_end 또는 Event start_at/end_at에만 저장한다.
- DO는 기존 aggregateActivity의 기록일·시각·분류·소요 시간을 읽기 전용 표시한다. 시작 없는 수동 시간은 임의 시각을 만들지 않는다.
- Preview 전용 planCompletion adapter는 완료 체크를 status 변경으로만 처리한다. 기존 제품 helper를 수정하지 않았으며 기존 do_start/do_end와 실제 기록을 덮어쓰지 않는다.
- 테스트에서 기존 TODO/Event 전체 행, todo_time_blocks, activity_entries가 PLAN CRUD 전후 동일함을 비교했다. 완료/해제만으로 새 DO 시각이 생기지 않음도 확인했다.
- 종료가 없는 블록은 표시용 길이만 사용한다. 실제 저장된 종료 시각을 만들지 않는다. 겹친 실제 기록은 삭제·병합하지 않는다.

## 보존·격리

- ReviewShell 햄버거·모바일 탭, ReviewWeeklyReview와 확인 저장 controller·변환, 음식·문화·음악·독서 화면 코드는 유지했다.
- 기존 Vite 검토 alias/transform/CSP와 SDK 제외 검사를 유지했다. 메모리 Provider만 사용한다.
- 정적 빌드에 가짜 환경변수 canary를 넣고 산출물 노출 없음, 실제 Supabase SDK 제외, API/Storage 요청 없음, 외부 HTTP/WebSocket 0건, 서비스 워커 등록 0건을 검사했다.
- 같은 탭의 메뉴 이동 시 유지되고 새로고침/샘플 초기화 시 복원된다. 샘플 상태임을 명시한다.
- Vercel review build의 Production 및 다른 브랜치 차단 조건, connect-src 'none', API 차단, manifest/SW 제외 정책은 변경하지 않았다.

## 검증

- 전체 단위 테스트: **235개 통과**. 파서 경계, CAS, 응답 유실, 중복 방지, 실제 기록 보호, 분 단위 기하 계산 포함.
- 전체 브라우저 회귀: **146개 통과**. 최종 결과는 `docs/validation/moamoa-preview-plan/browser-passing.tap` 참조.
- 원본 기능 브랜치의 PLAN CRUD·타임라인·교차 화면 브라우저 3파일: **16개 통과** (별도 소스 클론에서 재검증).
- 신규 정적 Preview PLAN E2E: **4개 통과** (부모 + 1440/768/390px). 자연어·교차 화면·PLAN 이동·CRUD·저장 오류/재시도·응답 유실·회고 저장/재열기·음악/독서/음식 탐색·초기화·실제 기록 불변·외부 요청 차단 검증.
- 기존 상단 목록 테스트는 새 타임라인의 접힌 항목을 펼쳐서 확인하고 완료 체크는 보존된 주간 플래너에서 수행하도록 갱신했다. 빈 데이터에서 상단 영역 자체가 없는지도 추가 확인했다. 검증 조건 삭제나 성공 기준 완화는 하지 않았다.
- Production 및 review build 성공. fonts/colors 검사 성공. render:check calendar: **FAIL 0 / WARN 6** (기존 일반 캘린더 라벤더 색상 검출; 4ffefb2 기준 동일 검사에서도 WARN 6 / FAIL 0). git diff --check 통과.
- 별도 tsconfig/타입 검사 명령은 없다. Vite/esbuild TSX 변환·빌드와 실행 테스트를 수행했으며 독립 tsc 전체 검사로 표현하지 않는다.
- 일반 빌드 19개 산출물 비교: 공용 Provider/파서/코덱 변경으로 JS와 해당 파일을 참조하는 HTML만 변경. CSS·폰트·아이콘·manifest·SW는 동일. 일반 산출물에 ReviewShell·샘플 실패 UI·testDb·환경변수 canary가 없음을 별도로 검사했다. Preview 전용 페이지/샘플이 일반 빌드에 섞이지 않음을 확인했다. `production-comparison.json` 참조.

## 화면

`docs/screenshots/moamoa-preview-plan/before/`와 `after/`:

- desktop/tablet/mobile-week.png: 변경 전후 초기 주간 화면.
- after/desktop-week-full.png: **1440px, 7일 전체 24시간 공통 축**. 같은 19:00 기록 7개 정렬과 21:00으로 수정한 할 일을 확인할 수 있다.
- after/*-timeline.png: 공통 시간표 실제 화면 크기.
- after/*-nlp.png / *-failure.png: 해석 확인·저장 오류와 재시도.
- after/*-todo.png / *-today.png: 같은 TODO ID의 교차 화면 표시.
- after/*-month.png / *-planner.png / *-day.png: 기존 월간·플래너와 통합 일간.
- after/validation.json: 크기별 가로 넘침/JS 오류/외부 요청/DO 불변 결과.

## 남은 확인

- 실제 iPhone Safari/PWA 터치·키보드·안전 영역은 실기기 확인이 필요하다. 자동화는 Chromium에서 수행했다.
- 실제 Supabase 검증이나 운영 데이터 조회/쓰기는 수행하지 않았다. Event 태그와 반복 범위 편집은 후속 별도 검증 대상이다.
- 다음 DO 단계는 기존 TodoTimeBlock/ActivityEntry/Event.do_*의 확인 저장·수정·삭제를 분리해 추가해야 한다. PLAN 저장 경로·목표 진행률·기록 당시 분류는 유지한다.
- 승인된 브랜치 Push로 GitHub 연동 Preview가 생성된다. Vercel 도구로 READY를 확인하지 않았으므로 대시보드에서 브랜치/최종 커밋의 빌드 상태와 HTTPS URL을 확인한다.
