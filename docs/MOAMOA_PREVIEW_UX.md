# MoaMoa Preview 캘린더·UX 개선

## 변경안과 적용 경계

시작 기준 `715476777529aa4b77ade678c9c6f779251ec525`. Push 경합으로 추가된 음악·독서 통합 `282d2e06cfa479d087d1cfb8f8038511e7273ab3` 위에 이번 변경만 다시 적용했다. 독립 clone `/workspace/my-planner-preview-ux`에서 진행한다. 공통 제품 소스, 사용자 입력, 집계·상태 타입·데이터 저장 로직은 수정하지 않는다. 아래 문구 변경안은 `scripts/review-ux-copy.mjs`의 파일별 정적 문자열 변환으로 Preview 빌드에만 반영한다. 원문이 달라지면 빌드를 실패시켜 의도하지 않은 치환을 막는다. 사용자 목표명·할 일·버킷리스트 문장에는 치환을 적용하지 않는다.

| 화면/파일 | 기존 표현 | 변경안 |
|---|---|---|
| MoaTodayRoute.tsx | 하루의 조각을 돌아봐요 | 선택한 날짜의 기록 |
| MoaTodayRoute.tsx | 작은 걸음을 모으는 중 | 이번 주 목표 진행률 |
| MoaTodayRoute.tsx | 무엇을 모아볼까요? | 할 일 제목 |
| MoaTodayRoute.tsx | 하루를 살며시 접어요 | 하루 회고 |
| MoaTodayRoute.tsx | 좋았던 순간 한 줄이면 충분해요.<br />비워둔 날도 괜찮아요. | 선택한 날짜의 감사와 좋았던 순간을 기록해요. |
| MoaTodayRoute.tsx | 시간 리포트 | 시간 분석 |
| MoaTodayRoute.tsx | 기록 메뉴에서 실제 활동 시간을 함께 모아보세요. | 기록 메뉴에서 실제 활동 시간을 확인해요. |
| MoaTodayRoute.tsx | 기존 목표와 기록을 확인하는 중이에요. | 목표와 기록을 불러오고 있어요. |
| MoaTodosRoute.tsx | 오늘 실제 기록 | 오늘 실제 활동 시간 |
| MoaTodosRoute.tsx | 기존 회차/분기 정책 검토가 필요해 여기서는 지원하지 않아요. 완료 체크는 기존 확인 저장 액션을 사용해요. | 이 화면에서 아직 지원하지 않아요. 완료 체크는 사용할 수 있어요. |
| MoaTodosRoute.tsx | 새 기록은 당시 분류를 보존해요. 스냅샷 없는 레거시 블록은 현재 태그를 따라가요. 시작·종료 시각 없는 기록은 소요만 보관해요. | 새 활동은 기록할 때의 카테고리를 유지해요. 분류 정보가 없는 이전 활동은 현재 태그로 표시해요. 시각을 입력하지 않은 활동은 걸린 시간만 저장해요. |
| MoaTodosRoute.tsx | 목표가 없어도 괜찮아요 | 태그·목표 연결은 선택 사항 |
| MoaTodoEditor.tsx | 기존 TODO에 메모 저장 필드가 없어 후속 모델 검토가 필요해요. | 할 일 메모는 아직 지원하지 않아요. |
| MoaTodoEditor.tsx | 태그 선택은 목표와 독립적이에요. 새 시간 기록은 당시 분류를 보존해요. 스냅샷 없는 과거 기록은 태그 변경 시 재분류돼요. | 태그와 목표는 각각 선택해요. 새 활동은 기록할 때의 분류를 유지하고, 분류 정보가 없는 이전 활동은 현재 태그로 표시해요. |
| MoaTodoEditor.tsx | 기존 다중 시간 태그는 그대로 유지해요. 대표 선택을 바꿀 때만 분할 연결을 변경해요. | 여러 시간 태그가 연결돼 있어요. 대표 카테고리를 바꾸면 시간 분류도 바뀌어요. |
| MoaTimeAnalysisRoute.tsx | 기록(화면 제목) | 시간 분석 |
| MoaTimeAnalysisRoute.tsx | 기록(본문 제목) | 시간 분석 |
| MoaTimeAnalysisRoute.tsx | 일상의 조각을, 내 시간으로 모아요. | 직접 기록한 활동 시간을 날짜와 카테고리별로 확인해요. |
| MoaTimeAnalysisRoute.tsx | 기록한 소요의 합계 비교예요. 기록이 적은 날에도 불이익은 없어요. | 직접 기록한 활동 시간의 합계를 비교해요. |
| MoaTimeAnalysisRoute.tsx | '독립 활동' | '할 일 연결 없음' |
| MoaTimeAnalysisRoute.tsx | '기존 실적' | '이전 활동 기록' |
| MoaTimeAnalysisRoute.tsx | '당시 분류 보존' | '기록할 때의 카테고리' |
| MoaTimeAnalysisRoute.tsx | '현재 태그 기준(기존 기록)' | '현재 태그로 분류' |
| MoaTimeAnalysisRoute.tsx | 실제 시각·레거시 원본은 기존 타임라인에서 확인해주세요. | 시작·종료 시각이 있는 활동과 이전 기록의 수정은 이 Preview에서 지원하지 않아요. |
| MoaTimeAnalysisRoute.tsx | 기존 원본 화면에서 관리해주세요. | 이전 기록의 삭제는 이 Preview에서 지원하지 않아요. |
| MoaTimeAnalysisRoute.tsx | 기록 날짜에 소요 전체를 귀속해요. 자정을 지난 실제 시각도 자동 분할하지 않아요. 분류 보존 정보가 없는 과거 기록은 현재 태그를 기준으로 보여줘요. | 활동에 걸린 시간은 입력한 기록 날짜에 합산해요. 자정을 지나도 날짜별로 나누지 않아요. 분류 정보가 없는 이전 활동은 현재 태그로 표시해요. |
| MoaActivitySheet.tsx | 어떤 활동을 모았나요? | 무슨 활동을 했나요? |
| MoaActivitySheet.tsx | 모르면 비워두세요. 자정을 넘어도 선택한 기록 날짜에 소요 전체를 귀속해요. | 시각을 모르면 비워두세요. 자정을 지나도 활동 시간은 선택한 기록 날짜에 합산해요. |
| MoaFoodRoute.tsx | 맛있는 순간을, 한 장씩 모아요. | 먹은 음식과 사진, 식비를 기록해요. |
| MoaFoodRoute.tsx | 한 달의 맛있는 장면 | 이번 달 음식 사진 |
| MoaFoodRoute.tsx | 기존 영양 기록 | 입력한 영양 정보 |
| MoaFoodRoute.tsx | 기존 단식 기록이에요. | 단식 기록이에요. |
| MoaFoodRoute.tsx | 삭제 실패 시 목록을 유지하고 같은 요청으로 재시도해요. | 삭제하지 못하면 목록에 남아요. 재시도로 다시 삭제할 수 있어요. |
| MoaFoodEditor.tsx | 기존 맛 메모 | 맛 메모 |
| MoaFoodEditor.tsx | 사진은 선택 사항이에요. 연결을 바꿔도 기존 사진 원본은 삭제하지 않아요. AI 없이 저장할 수 있어요. | 사진 없이 음식명만으로 저장할 수 있어요. 이 Preview에서는 AI 기능을 제공하지 않아요. |
| MoaCultureRoute.tsx | 보고 느낀 순간들을 모아두는 공간 | 영화·드라마·영상의 감상과 별점을 기록해요. |
| MoaCultureRoute.tsx | 기존 콘텐츠 유형 더 보기 | 다른 콘텐츠 유형 보기 |
| MoaCultureRoute.tsx | 기존 콘텐츠 필터 | 다른 콘텐츠 필터 |

장식성 영어 소제목은 Preview의 공통 모아모아 컴포넌트에서 제거한다. 기능 제목과 주요 버튼(저장·수정·삭제·취소·시간 기록)은 동작과 일치하므로 유지한다. 모아모아·나의 정원·모아·캐릭터 인사말은 브랜드/환영 문구로 유지한다. `미분류`, `계획`, `실제 활동`은 집계 의미가 달라 그대로 구분한다. TMDB·YouTube는 기능 식별에 필요한 서비스명이며 로컬 샘플임을 알리는 안내도 유지한다.

## 주간 회고: 음악·독서 기록 이후 필수 개발

이번 작업에서는 조회 전용 안내만 명확히 하고 저장 기능을 구현하지 않는다. 현재 Preview 팝업은 기억하고 싶은 일(highlights)과 주간 실제 시간만 보여주며, 후속 단계에서는 아래 5개 회고 필드를 모두 조회·수정할 수 있어야 한다.

- `src/app/components/ReviewsView.tsx` 396행 이후: `findWeekRecord`로 주차를 찾고 입력 상태를 채운다. 수정 시 기존 ID와 저장된 `weekKey`를 보존하고 `updateWeeklyReview`, 신규는 `addWeeklyReview`를 호출한다.
- `src/app/store.tsx`의 `WeeklyReview`: `id`, `weekKey`, `highlights`, `kptKeep`, `notice`, `kptTry`, `nextWeek`. 현재 add/update는 낙관적으로 배열을 갱신하고 DB 호출 완료를 기다리지 않는다.
- `src/lib/db.ts`의 `toWeeklyReview`/`fromWeeklyReview`, `weeklyReviews`: `weekly_reviews`의 `week_key`, `highlights`, `kpt_keep`, `notice`, `kpt_try`, `next_week`로 매핑한다. 현재 upsert는 오류를 로그로 남기므로 그대로 재사용해 저장 성공을 표시하면 안 된다.
- `src/lib/weekKeys.ts`의 ISO 주차/기존 한 자리 주차 읽기 호환을 유지한다. 같은 주차 검색 후 기존 ID 수정, 정규/호환 키가 모두 있으면 자동 병합·삭제 금지. 기존 값과 미편집 필드는 보존한다.

후속 작업의 완료 조건:

1. 주간 플래너에서 새 회고 작성 및 기존 회고 조회·수정. `기억하고 싶은 일`, `KEEP: 잘한 점·유지할 점`, `NOTICE: 아쉬운 점·발견한 점`, `TRY: 다음에 시도할 점`, `NEXT: 다음 주에 할 일`을 기존 필드에 매핑하고 부분 저장을 허용한다.
2. 신규 회고 UUID를 초안 단계에서 고정하고 반복 클릭·재시도로 같은 ID를 사용한다. 쓰기 전 재조회와 주차 단위 잠금, 같은 주차 중복 생성 방지를 검증한다. 실제 동시 기기 경쟁까지 방지하려면 운영과 분리된 환경에서 사용자+정규 주차 유일성 정책을 별도 설계·승인해야 한다. 이번 작업에서 스키마/운영 DB는 바꾸지 않는다.
3. SaveCoordinator/confirmedWrites 패턴을 적용해 저장 확인 후 성공을 표시한다. 실패 시 입력 유지·명시적 재시도·응답 유실 후 존재 확인·중복 방지, Realtime 충돌/삭제·기존 데이터 보존을 검증한다.
4. PC 모달·모바일 바텀시트, 키보드/포커스/닫기 확인, 390·768·1440px 저장 버튼 접근을 검증한다.
5. 기존 주차 ID와 과거 회고 텍스트 보존, 같은 주차 재진입/수정, 네트워크 실패/권한 오류/응답 유실 테스트를 포함한다. Preview는 메모리 transport만 사용하고 새로고침 초기화를 유지한다.

## 캘린더 배치 변경

`ReviewCalendar.tsx`의 `.rc-untimed`를 `.rc-time-day`의 24시간 본문 뒤에서 제거하고 `.rc-grid-scroll` 앞의 독립된 section으로 이동했다. 순서는 날짜 선택 → 시간 미지정 할 일·종일 일정 → 시각 없이 기록한 실제 활동 → 시간별 일정이다. 시간표 내부 스크롤과 07시 초기 위치는 유지한다. 상단 목록은 그 스크롤 컨테이너 밖에 있으므로 23시 뒤로 이동하지 않는다.

주간 PC는 날짜별 카드를, 1100px 미만 주간 보기는 선택한 요일의 카드를, 일간은 선택한 날짜만 표시한다. 같은 `moaTodayData.dayTodos/dayEvents`와 `actual.records`를 읽어 각 목록을 분리한다. 날짜 없는 할 일을 새로운 날짜에 배정하지 않는다. 날짜 미정 할 일은 기존 주간 플래너에 남긴다. 시작 시각이 있는 실제 활동은 기존 시간표에 표시한다.

내용이 있는 날짜/영역만 표시하고 날짜별로 첫 3개 이후는 더 보기/접기를 제공한다. 기존 `ReviewTodoRow`의 완료·확인 저장·실패 재시도를 재사용한다. `aggregateActivity`, 목표 진행률, TODO·활동 데이터, 샘플 시드, 인증/Storage/API 설정은 수정하지 않는다.

## 필수 명칭 및 추가 문구 적용

| 기존 | 적용 |
|---|---|
| 멀리 바라보는 목표(주간 링크) | 월간·연간 목표 보기 |
| MY DIRECTION / 멀리 바라보는 목표(정원 제목) | 목표 / 월간·연간 목표 |
| 이번 달 / 올해 | 이번 달 목표 / 올해 목표 (월·연도 표시 유지) |
| 언젠가 피워낼 씨앗 | 버킷리스트 |
| 버킷리스트 / 언젠가 하고 싶은 일 · 기존 씨앗 데이터 조회 | 등록한 버킷리스트 |
| 꿈꾸는 중 / 피어난 씨앗 | 미완료 / 완료 |
| 씨앗 빈 목록·편집 안내 | 등록한 버킷리스트가 없어요. / 버킷리스트 추가·수정은 아직 지원하지 않아요. |
| 이번 주 모은 시간 | 이번 주 실제 활동 시간 |
| 계획과 별도로 쌓인 실제 기록 | 직접 기록한 활동 시간 |
| 한 주의 작은 습관 | 이번 주 습관 기록 |
| 기억에 남는 작은 성취 | 최근 완료한 할 일 |
| 성장 기록 | 활동 현황 |
| 오늘의 한 걸음으로 이어가기 | 할 일 보기 |
| 기록을 모은 날 | 할 일 완료 또는 습관 체크한 날 |
| 주간 회고 열기 | 주간 회고 보기 |
| 주간 회고 입력·편집은 이번 Preview에서 지원하지 않아요. | 주간 회고 작성·수정은 아직 지원하지 않아요. |
| Lv. · 함께 자라는 중 / 마지막 성장 단계 | 레벨 / 최고 레벨 |
| 기존 프로필의 XP 기준을 현재 샘플로 계산 | 할 일 완료·습관 체크·연속 기록·할 일 집중시간에 따른 경험치 |
| 올해의 방향은 천천히 정해도 괜찮아요. | 올해 목표가 없어요. |
| 여유로운 하루(빈 일정) | 등록한 일정과 할 일이 없어요. |
| 특정 주에 배정된 데이터는 아니에요. | 날짜를 정하지 않아 특정 요일에 표시하지 않아요. |
| 시각이 없는 실제 기록은 시간표 아래에 표시 | 시각 없이 기록한 실제 활동 영역 + 시작 시각을 입력하지 않아 시간표에는 표시하지 않음 |
| COMING SOON | 제거; 실제 미지원 상태를 한글 제목·설명으로 안내 |
| 기존 기록과 연결 경로 보존 / My Planner 이동 안 함(미지원 화면) | 다른 기능은 주요 메뉴나 기록 메뉴에서 이용할 수 있어요. |
| 문화 검색 실패: 주소·연결 확인 | 샘플 정보를 불러오지 못했어요. 직접 입력으로 기록할 수 있어요. |
| 오늘: 이번 주 목표를 하나 정해볼까요? / 목표 보기·기존 목표에서 시작하기 | 이번 주 목표가 없어요. / 월간·연간 목표 보기 (실제 이동 대상과 일치) |

활동 현황의 날짜 수와 최근 완료 목록은 기존 계산상 **완료한 할 일에 지정된 날짜**를 사용한다. 완료 시각으로 새롭게 계산하지 않고 이 기준을 화면에 설명했다. 날짜 없는 완료 할 일은 날짜 수에서 제외된다. 샘플 데이터에 포함된 `기존 두 카테고리의 할 일` 같은 사용자 작성형 제목은 문구 정리 대상에서 제외해 그대로 보존한다.

## 수정 파일

- `src/review/ReviewCalendar.tsx`, `calendarGarden.css`: 상단 목록, 날짜 구분, 펼치기, 직접적인 설명.
- `src/review/ReviewGarden.tsx`: 목표·버킷리스트·활동 현황·완료 목록의 명칭과 계산 기준 안내.
- `src/review/reviewRoutes.tsx`: 미지원 상태 안내. 최신 원격의 음악·독서 실제 기능 라우트를 그대로 유지한다.
- `scripts/review-ux-copy.mjs`, `vite.review.config.ts`: 공통 제품 소스를 수정하지 않는 Preview 전용 문구 변환.
- `scripts/test/moa-review-ux.test.mjs`: 수정 전/후 촬영 및 날짜·시간·완료·빈 목록·외부 요청 검증.
- `scripts/test/moa-review.test.mjs`, `moa-review-culture.test.mjs`: 바뀐 표시 문구 기대값만 수정; 동작 검증 유지.
- 이 보고서와 `docs/screenshots/moamoa-preview-ux/`: 전후 화면과 검증 결과.

`ReviewShell.tsx`·사이드바 아이콘·공통 메뉴·Production 소스·음악/독서 브랜치는 변경하지 않는다. Push 전 원격 Preview HEAD를 다시 확인하며 force push하지 않는다.

## 최종 검증 결과

- 최신 음악·독서 통합 후 전체 단위 **193개 통과**.
- 최신 음악·독서를 포함한 전체 브라우저/API 회귀 **131개 통과**, 실패·스킵 0. Preview 격리, 문화·음악·독서 CRUD/로컬 API, 음식·시간·TODO·오늘·캘린더·정원 회귀 포함. 마지막 음악·독서 소개 문구 변경은 별도 Preview 테스트 **4개**로 다시 통과했다.
- 최종 UX 테스트를 별도로 재실행해 **390×844 / 768×1024 / 1440×1024** 모두 통과했다. 상단 위치, 시간표/페이지 끝 스크롤, 중복 없음, 날짜 구분, 펼치기, 주간·일간 및 이전·다음 날짜, 완료 실패·재시도·진행률, 실제 시간 유지, 빈 영역 숨김, 버킷리스트 빈 목록, 하단 버튼/메뉴 여백을 확인했다.
- 외부 요청·브라우저 오류 0. 모든 요청은 정적 리소스 GET이며 DB/Storage/API 네트워크 요청은 없다. 실제 운영 인증 정보는 사용하지 않았다.
- Production 빌드 성공. 의존성 준비 후 기준 커밋의 별도 스냅샷에서 빌드해 **산출물 19개 전체 SHA-256 동일**을 확인했다. Preview 문구와 레이아웃은 Production 빌드에 포함되지 않는다.
- `lint:fonts`, `lint:colors` 통과. 기존 큰 번들 크기 경고만 유지.
- `render:check -- --route=calendar,todos`: 10장, **FAIL 0**, 기존 라벤더 색상 WARN 10. Preview 자체는 위 별도 정적 빌드 테스트로 검증했다. 실물 iPhone/Safari 검증은 포함하지 않는다.
- `git diff --check` 통과. 테스트가 덮어쓴 과거 문서 스크린샷/JSON은 해시 검증한 복구 사본을 `/workspace/preview-ux-validation/regenerated-existing/`에 보존한 뒤 원래 Git 버전으로 복원했다. 이번 검증 사진만 새 폴더에 추가한다.
- 시작과 사전 확인 시 원격은 `7154767`이었으나 실제 Push 직전에 `282d2e0`이 추가돼 non-fast-forward로 거부됐다. 강제 Push하지 않고 새 원격 위로 rebase했다. 음악·독서 통합의 라우터·API/음성 격리·Storage·CSP 변경은 유지했다. `vite.review.config.ts`의 import/transform 순서 충돌만 해결하여 문구 변환 후 미디어 격리 변환을 실행한다. 사용되지 않게 된 `ReviewCultureMusic.tsx`의 문구 변경은 제외했다. `ReviewShell.tsx` 및 음악·독서 작업 브랜치에는 변경하지 않았다.

### 비교 화면

동일한 메모리 샘플에 종일 일정·시간 미지정 할 일 여러 개·완료 버킷리스트를 추가해 촬영했다. 테스트용 데이터는 브라우저 메모리에만 있고 제품/Preview 기본 시드는 수정하지 않는다. 완료 테스트 이후 원래 완료 상태로 되돌려 비교하며, 수정 후 화면 일부에는 검증 중 발생한 저장 확인 알림이 표시된다.

| 화면 | 수정 전 | 수정 후 |
|---|---|---|
| PC 캘린더 | [전](screenshots/moamoa-preview-ux/before/desktop-calendar-week.png) | [후](screenshots/moamoa-preview-ux/after/desktop-calendar-week.png) |
| 모바일 캘린더 | [전](screenshots/moamoa-preview-ux/before/mobile-calendar-week.png) | [후](screenshots/moamoa-preview-ux/after/mobile-calendar-week.png) |
| 태블릿 캘린더 | [전](screenshots/moamoa-preview-ux/before/tablet-calendar-week.png) | [후](screenshots/moamoa-preview-ux/after/tablet-calendar-week.png) |
| PC 정원 | [전](screenshots/moamoa-preview-ux/before/desktop-garden.png) | [후](screenshots/moamoa-preview-ux/after/desktop-garden.png) |
| 모바일 정원 하단 | [전](screenshots/moamoa-preview-ux/before/mobile-garden-bottom.png) | [후](screenshots/moamoa-preview-ux/after/mobile-garden-bottom.png) |

수정 전 36장(7154767), 수정 후 42장(282d2e0 통합 후 최종 UX). 같은 폴더에 일간·주간 플래너·회고·오늘·할 일·시간 분석·음식·문화 및 스크롤 하단 화면이 있다. [검증 요약](screenshots/moamoa-preview-ux/verification.json)과 각 폴더의 `validation.json`에서 범위를 확인할 수 있다.

재실행:

```bash
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run vercel-build
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar,todos
```

`MOA_UX_BEFORE=1 node --test scripts/test/moa-review-ux.test.mjs`는 사전에 기준 Preview를 빌드한 상태에서만 수정 전 캡처용으로 사용한다. 일반 실행은 새 Preview 빌드와 전체 UX 검증을 수행한다. 단위 테스트는 `src/lib/*.test.ts`를 esbuild로 Node용 번들링한 뒤 `node --test`로 실행한다.

최신 원격 통합 후 새로 확인한 음악·독서 화면도 같은 Preview 전용 변환으로 소개 문구만 명확히 했다. 제품 소스와 기능은 그대로 유지한다.

| 화면 | 기존 | 변경 |
|---|---|---|
| 음악 | 오늘 마음에 머문 음악을 모아요. | 곡·아티스트와 감상, 들은 날짜를 기록해요. |
| 음악 개수 | N곡의 기억 | N개의 음악 기록 |
| 독서 | 한 페이지씩, 나에게 남는 이야기. | 읽은 책과 구절, 독서 메모를 기록해요. |

최신 음악·독서 소개 문구의 별도 검증 화면 6장은 [latest-media](screenshots/moamoa-preview-ux/latest-media/)에 보관했다. 이 폴더의 validation.json은 전체 미디어 재검증 목록이며, 대표 목록 화면 6개만 복사하고 나머지 실행 캡처는 `/workspace/preview-ux-validation/rebased/regenerated-existing/`의 검증된 복구 사본에 보관했다.
