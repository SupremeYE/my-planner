# MoaMoa STEP 3B-4B-1 — 문화 기록

## 2026-10-25 체크포인트 재검증

사용자의 추가 승인에 따라 아래 구현 완료 시점의 미커밋 작업을 `codex/moamoa-step3b4b-culture`에만 보존한다. 아래의 HEAD·미커밋·Push 미수행 설명은 최초 구현 완료 시점의 기록이다.

- 작업 전 브랜치와 부모 커밋 `4f6d3a058e2792f1c9ce525752af6e96ac04a033`을 확인했다. 문화 변경 파일 **45개**가 기존 복구 tar·SHA-256 매니페스트·tracked diff와 모두 일치했다. 누락·예상 밖 소스 변경은 없었다.
- 전체 단위 테스트 **170/170**, 전체 브라우저·API 테스트 **97/97** 재검증 통과. 실패·취소·스킵 **0개**. 테스트는 기존 격리 전송 계층과 모의 API를 사용했다.
- Production 빌드, `lint:fonts`, `lint:colors`, diff 공백 검사 통과. 기존 번들 크기 경고는 유지된다.
- 후보 텍스트의 비공개 키·GitHub 토큰·AWS 키·API 키·JWT 패턴을 검사했고 일치 항목은 없었다. 캡처는 격리된 샘플 데이터다.
- 다른 기능의 재생성 캡처와 이번 재검증 캡처는 `/workspace/culture-validation/checkpoint-20261025/rerun-artifacts/`에 별도 보존했다. 커밋 후보는 검증한 원래 문화 작업과 이 재검증 기록으로 한정한다.
- 검증 로그: `/workspace/culture-validation/checkpoint-20261025/`. 커밋 직전 45개 파일 복구 tar·SHA-256 매니페스트도 이 폴더의 `precommit/`에 보관한다.
- 커밋 메시지: `feat(moamoa): add culture journal and confirmed saving`.
- Preview 병합, main 변경, PR 생성, Production 배포, 운영 Supabase·Storage·환경변수 변경은 이번 보존 작업에도 포함하지 않는다.

## 작업 기준과 분리

- 작업 경로: `/workspace/my-planner-culture`. 이 작업에 연결된 클라우드에서 새로 만든 **독립 클론**이다. 기존 체크아웃과 `.git`, object alternates, worktree를 공유하지 않는다.
- 원격 기준 브랜치: `codex/moamoa-step3b4-food-records`.
- 기준 커밋 / 현재 HEAD: `4f6d3a058e2792f1c9ce525752af6e96ac04a033`.
- 작업 브랜치: `codex/moamoa-step3b4b-culture`.
- 지정한 음식 체크포인트는 이미 원격에 커밋되어 있어 그대로 보존했다. 첨부 요구사항의 오래된 `becf876...` 기준 및 체크포인트 커밋·Push 절차는 최신 지시에 따라 실행하지 않았다.
- Preview 브랜치를 가져오거나 병합하지 않았다. 커밋·스테이징·Push·PR·배포를 수행하지 않았다.
- main, 운영 Supabase/Storage, 클라우드 설정·환경변수를 변경하지 않았다. 새 마이그레이션도 없다.
- 기존 `/workspace/my-planner`의 `work` 브랜치, HEAD `5fac23d1...`와 깨끗한 작업 트리를 유지했다.
- 독립 클론 생성 전 사용자 변경이 없음을 확인했다. 기존 테스트가 재생성한 다른 기능의 스크린샷은 저장소 밖 검증 폴더에 보관하고 원래 버전으로 복원했다.

## 기존 기능 분석

| 대상 | 기존 계약 / 문제 | 이번 재사용 및 보존 |
| --- | --- | --- |
| `CultureRecordView.tsx` | 컴포넌트 로컬 데이터, `db.cultureRecords` 호출, Realtime 갱신, 영상/음악 전환 | 기존 `/culture`와 음악 전환 그대로 유지 |
| `CultureFormModal.tsx` | 전체 객체 upsert 후 완료 콜백, API와 수동 입력, 상태별 별점 표시 | 기존 폼은 변경하지 않음. 새 폼은 확인 저장 및 모든 상태의 기존 별점을 유지 |
| `db.cultureRecords` | 조회 오류를 빈 배열로 바꿀 수 있음. upsert/delete 오류를 로그만 남겨 호출부가 성공으로 오인 가능 | 기존 계약은 유지. 문화 전용 codec + 기존 `confirmedWrites`로 오류를 전파하는 새 경로 추가 |
| `CultureRecord` | id/title/platform/contentType/status/rating/review/insight/tags/watchedDate/url/thumbnailUrl/externalSource/externalId/createdAt/updatedAt | 같은 테이블·필드·ID·미디어 URL 사용. user_id는 기존 DB 기본값 `auth.uid()` 사용 |
| `cultureMeta.ts` | 플랫폼 8개, 콘텐츠 유형 8개, 상태 4개 | 플랫폼·유형·정렬 상수 재사용. 임의 재분류 없음 |
| `TMDBSearchPanel.tsx` | 기존 테마와 자동 debounce 검색에 결합 | 새 입력에는 명시적 검색/선택 UI 적용. 요청과 결과 변환은 기존 `src/lib/tmdb.ts` 재사용 |
| `src/lib/youtube.ts` | URL에서 영상 ID 추출, 키 없는 YouTube oEmbed 요청 | 같은 메타데이터 조회 재사용. 새 경로에서 URL hostname·경로·ID 길이를 먼저 확인 |
| 음악 / 독서 | `MusicSection`, 기존 책 화면·DB·API | 변경 없음. 기존 문화·음악 화면 및 독서 화면으로 이동하는 링크 유지 |

DB 상태는 `watchlist` → **보고 싶은**, `watching` → **보는 중**, `completed` → **감상 완료**, `dropped` → **중단**으로 표시한다. `dropped` 기록은 전체 목록과 중단 필터에 남는다. `movie`/`drama`/`youtube_video`를 주요 필터로 제공하되, 예능·다큐·애니·강의·기타도 전체 목록에 보존하고 펼침 필터와 기존 유형 편집을 지원한다. 새 레코드의 기본값은 영화/감상 완료/플랫폼 기타이며 기존 레코드의 값은 재설정하지 않는다.

## 독립 개발 경로와 구현

개발 전용 **`/__moamoa-culture`**에서 기존 Auth/PlannerProvider 아래 새 문화 기능을 실행한다. Production 빌드에서는 이 lazy route와 문화 전용 UI/CSS가 제외된다. 기본 `/culture`, 기존 메뉴 및 음악·독서 화면은 교체하지 않았다.

- 모바일 390px: 포스터·썸네일과 텍스트를 가로로 배치한 목록, 한 줄 스크롤 상태/유형 필터, 펼침 플랫폼·정렬, 바텀시트 입력.
- PC 1440px: 3열 포스터 갤러리, 기존 모아모아 모달 재사용.
- 제목·유형·감상 상태만 기본 입력. 제목 외 기본값으로 바로 등록 가능.
- 선택 항목: 플랫폼, 날짜, 0~5점/0.5 단위 별점, 감상평, 기억에 남는 내용, 태그, 작품 URL, 포스터·썸네일 URL.
- `null` 별점과 실제 0점을 구분한다. 상태 변경으로 후기·별점을 지우지 않는다.
- 이미지 없음/실패는 대체 영역을 표시하며 제목·후기·상태·수정 기능은 계속 사용할 수 있다. 긴 제목은 카드에서 줄이고 상세에서 전부 표시한다.
- 저장 확인 후 전체 필터와 해당 기록 상세를 열어 저장 결과가 현재 필터에 가려지지 않게 한다.

## 버튼 검증

| 입력 / 버튼 | 검증 결과 |
| --- | --- |
| 문화 기록 / 빠른 기록 | 같은 문화 입력 시트 연결. 제목만 입력 후 저장 가능 |
| 직접 입력 | 외부 API 요청 없이 저장 |
| 작품 검색 / 검색 / 입력에 사용 | 기존 TMDB 응답을 영화·TV 결과로 표시. 선택 후 빈 제목·포스터·필드를 채우고 직접 쓴 제목·후기·별점은 보존 |
| YouTube URL 입력 / 영상 정보 가져오기 | 유효한 hostname과 영상 ID 확인 후 기존 oEmbed 호출. 선택한 제목/썸네일/URL 수정 가능 |
| URL만 입력에 사용 | API 실패 때도 입력한 유효한 YouTube URL과 ID로 수동 등록 가능. 썸네일을 만들어 넣지 않음 |
| 저장 / 수정 / 재시도 | 서버 확인 전 닫지 않음. 저장 중 닫기 방지. 실패 시 입력 유지, 명시적 재시도 |
| 별점 / 날짜 / 태그 / 감상평 | PC에서 실제 입력·저장·재조회. 4.5점 → 0점 편집과 기존 이미지·출처 보존 확인 |
| 상태 변경 | 상태만 바꾸고 서버 확인 후 화면 반영. 실패 시 기존 상태 유지, 재시도 가능 |
| 삭제 / 삭제 확인 / 취소 | 확인 모달, DB 행 삭제 후 부재 조회. 확인 실패 시 목록 유지. 이미지 원본 삭제 없음 |
| 상세 보기 / 이미지 다시 불러오기 | 전체 후기·메모·태그·URL 확인, 같은 이미지 URL로 재시도 |
| 검색 / 상태·유형·플랫폼 필터 / 정렬 | 제목·태그 검색, 기존 상태/유형 유지, 별점·기록일·감상일 정렬 |
| 기존 문화·음악 화면 | `/culture` 이동과 원래 음악 탭 유지 확인 |

## 확인 저장와 실패 처리

새 `useCultureRecords`는 문화 화면 범위에서 기존 `SaveCoordinator`, `confirmedWrites`, `mergeConfirmedRows`, `useRealtimeSync`를 사용한다. 전역 store/db에 문화 상태를 추가하지 않아 Preview 및 음식·시간 작업과 충돌하는 면적을 줄였다.

1. 신규 초안을 열 때 UUID를 고정한다. 중복 클릭은 동일 요청으로 합친다.
2. 생성은 동일 ID `DO NOTHING` + 저장 행 조회·내용 비교로 확인한다. 응답 유실 후 재시도해도 행을 새 ID로 생성하지 않는다.
3. 수정은 입력창을 열 때의 기준선과 비교하여 **변경한 필드 + 수정 시각(updated_at)**만 전송한다. 다른 기기에서 변경한 무관한 감상·메타데이터와 알려지지 않은 서버 컬럼은 보존한다.
4. 변경 없는 저장도 최신 서버 행을 조회한다. 삭제되거나 권한이 없는 행을 성공으로 간주하지 않는다.
5. 삭제는 실제 부재 조회가 통과한 뒤 목록에서 제거한다. Storage 업로드/삭제/재업로드를 호출하지 않는다.
6. 저장 중·확인 불확실 ID는 Realtime 재조회 결과로 덮어쓰지 않는다. 실패한 조회는 기존 목록을 빈 배열로 바꾸지 않는다. 화면을 벗어나기 전 입력을 버릴 때는 확인하고 목록을 다시 읽는다.
7. 503/연결 오류/오프라인은 명시적 재시도를 제공한다. 권한 오류는 자동 재시도하지 않고 입력 확인·권한 안내를 제공한다.

기존 `/culture`의 낙관적 액션과 오류를 로그만 남기는 레거시 저장 방식은 전면 교체하지 않았다. 새 화면만 확인 저장 경로를 사용한다.

## API 검증과 키 검토

- 자동 저장과 API 요청을 분리했다. 검색·조회는 버튼/Enter로만 시작하며 같은 요청 진행 중 중복 클릭을 막고 동일 검색 결과를 시트 범위에서 캐시한다.
- 입력/방식 변경, 저장 시작, 시트 종료 시 요청을 취소하고 오래된 응답을 무시한다. 12초 제한 후 직접 입력으로 복구할 수 있다.
- 기존 `searchTMDB`와 `fetchYouTubeMetadata`에 **선택적 AbortSignal만 추가**했다. 기존 호출자는 인자를 추가할 필요가 없고 요청 URL·인증 방식은 유지된다.
- 기존 TMDB 키 이름은 `VITE_TMDB_API_TOKEN`이다. **이 값은 브라우저 번들과 요청에서 보일 수 있는 기존 구조**다. 이번에 실제 키를 읽거나 환경변수/서버 프록시를 변경하지 않았다. 비공개 서버 토큰으로 간주하면 안 되며, 서버 프록시 전환은 별도 통합 검토 대상이다.
- YouTube oEmbed는 API 키를 쓰지 않는다. YouTube/CORS/공급자 정책이나 TMDB 요금·쿼터를 실제 운영 호출로 검증하지 않았다.
- 모든 자동 테스트는 TMDB·YouTube HTTP 응답과 이미지까지 가로챈다. Supabase/Storage는 기존 메모리 fixture로 교체하고 나머지 외부 요청은 차단한다. 테스트용 토큰은 소스 변환에만 존재하는 가짜 문자열이며 환경변수를 설정하지 않는다.

## 파일과 통합 경계

| 파일 | 역할 |
| --- | --- |
| `src/app/components/moamoa/MoaCultureRoute.tsx` | 문화 목록·필터·상세·상태 변경·삭제 |
| `src/app/components/moamoa/culture/CultureEditor.tsx` | 최소 입력·선택 항목·확인 저장·초안 유지 |
| `culture/CultureMetadataSearch.tsx`, `CultureImage.tsx`, `CultureSaveFeedback.tsx`, `culture.css` | API 선택·이미지 대체·저장 피드백·문화 전용 스타일 |
| `src/app/hooks/useCultureRecords.ts` | 문화 전용 확인 상태와 Realtime |
| `src/lib/cultureRecords.ts`, `cultureMetadata.ts` | 기존 컬럼 codec·확인 CRUD·필터·메타데이터 적용/URL 검증 |
| `src/lib/tmdb.ts`, `youtube.ts` | 기존 문화 API의 선택적 요청 취소 지원 |
| `src/lib/cultureRecords.test.ts`, `scripts/test/moa-culture.test.mjs`, `fixtures/moa-culture-data.mjs` | 단위/브라우저 격리 테스트 |
| `docs/screenshots/moamoa-culture/` | 390/1440px 샘플 데이터 캡처와 검증 JSON |

**공통 파일 수정은 `src/app/routes.tsx`의 개발 lazy route 한 줄이다.** Preview가 같은 개발 경로 배열을 편집할 경우 충돌 가능성이 있으므로 이 줄을 별도 통합 대상으로 남긴다. 전체 메뉴 연결과 활성 메뉴 표시 조정은 하지 않았다. `MoaFrame`, `MoaRecordsNav`, `moaShared`, 공통 내비게이션, 전역 스타일, `App`, 전역 `store.tsx`와 `db.ts`, 음악·독서 파일은 변경하지 않았다.

## 검증 결과

기준 체크포인트: 단위 159개 통과, 기존 브라우저 82개 통과 후 포트 충돌 검사 1개 재실행 통과(총 83개 확인), 빌드·폰트·색상 검사 통과. 포트 충돌은 이 대화의 이전 환경 설정에서 시작한 Vite 서버만 종료하여 해결했다.

| 최종 검사 | 결과 |
| --- | --- |
| 전체 기존 + 문화 단위 테스트 | **170/170 통과**, 스킵 0 |
| 문화 기록 브라우저 | **14/14 통과** (상위 테스트 + 13개 시나리오), pageerror 0 |
| 음식·시간 기록 브라우저 회귀 | **24/24 통과**, 스킵 0 |
| Production 빌드 | 통과. 기존 큰 번들 경고 유지 |
| 폰트·색상 가드 | 통과. 기존 baseline 수정 없음 |
| 기존 render:check, daily/todos | **13장, FAIL 0 / WARN 13**. 경고는 기존 라벤더 색상 |
| 기존 렌더 하네스 제한 | PC timeblock 탭, 일부 메뉴/일정 편집/종일/반복 흐름은 현재 시드에서 찾지 못해 스킵. 통과로 간주하지 않음 |
| 문화 화면 | **28장**: 390/1440px 13쌍 + 모바일 초기 로딩/빈 목록. 가로 넘침 없음, 빠른 기록 버튼과 콘텐츠 영역 겹침 없음 |
| 개발 경로 제외 | Production 산출물에 문화 개발 경로·전용 UI/CSS가 포함되지 않음을 확인 |
| 저장소 | diff 공백 검사, 기준 HEAD, 기존 파일 변경 범위 확인 |

전체 타입 검사 스크립트/tsconfig는 이 저장소에 없으므로 별도 `tsc` 검증을 주장하지 않는다. Vite 브라우저 컴파일, esbuild 기반 기존 node:test, 제품 빌드를 실행했다.

검증 로그: `/workspace/culture-validation/baseline/`, `/workspace/culture-validation/final/`.
미커밋 변경 복구본: `/workspace/culture-validation/recovery/`의 변경 파일 tar, tracked diff, SHA-256 매니페스트. 환경변수 파일·자격증명·node_modules는 포함하지 않는다.

```sh
cd /workspace/my-planner-culture
npm ci
mkdir -p /workspace/culture-validation/final/unit
node_modules/.bin/esbuild src/lib/*.test.ts --bundle --platform=node --format=esm --out-extension:.js=.mjs --outdir=/workspace/culture-validation/final/unit
node --test /workspace/culture-validation/final/unit/*.mjs
node --test scripts/test/moa-culture.test.mjs
node --test --test-concurrency=1 scripts/test/moa-food.test.mjs scripts/test/moa-time.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=daily,todos
git diff --check
```

### 대표 캡처

- [모바일 목록](screenshots/moamoa-culture/mobile-list.png)
- [PC 갤러리](screenshots/moamoa-culture/desktop-list.png)
- [모바일 입력](screenshots/moamoa-culture/mobile-add.png)
- [PC 수정](screenshots/moamoa-culture/desktop-edit.png)
- [저장 실패와 재시도](screenshots/moamoa-culture/mobile-save-failure.png)
- [TMDB 결과](screenshots/moamoa-culture/desktop-tmdb-results.png)
- [YouTube 입력](screenshots/moamoa-culture/mobile-youtube.png)

## 남은 제약과 다음 단계

- 운영 Supabase RLS/실제 Realtime publication, 원격 저장·복수 기기 종단 검증, 실제 TMDB/YouTube 접근은 실행하지 않았다. 통합 시 승인된 격리 백엔드에서 검증해야 한다.
- 재시도 UUID/초안/검색 캐시는 현재 화면 메모리 범위다. 새로고침 후 미저장 초안 복구는 제공하지 않는다. 같은 필드를 여러 기기에서 동시에 수정하면 기존 확인 저장 정책처럼 마지막 쓰기가 우선한다.
- Preview 통합 시 `/__moamoa-culture` 경로 한 줄을 재검토하고 기록→문화·음악→영상 메뉴를 연결한다. 이 단계에서는 자동 병합·메뉴 교체를 하지 않았다.
- STEP 3B-4B-2 음악은 기존 MusicRecord ID/artworkUrl/previewUrl/iTunes ID/무드·메모를 보존하는 codec와 확인 CRUD부터 적용하고, 별도 음악 개발 경로에서 기존 MusicSection 검색/듣기 UI를 연결하는 범위를 추천한다. iTunes 호출 실패 시 수동 입력과 기존 미디어 보존을 먼저 검증한다.
- 독서는 이번 범위 밖이다. 기존 책 ID·표지·독서 로그·구절과 Kakao 검색은 후속 단계에서 다룬다.
