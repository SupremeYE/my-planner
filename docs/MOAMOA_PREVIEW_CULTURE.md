# MoaMoa Preview — 문화 기록 통합

## 기준과 통합 범위

- Preview 기준: `30517fc0b785058f1a0b9bcebd5c5b76db8b5ec2`, `codex/moamoa-review-preview`.
- 문화 기록 소스: 검증·Push된 `690f3ab0ca095c5213d4b7229192eefc4d6f9d83`, `codex/moamoa-step3b4b-culture`.
- `/workspace/my-planner-preview`의 독립 clone에서 작업했다. 문화 기록 작업 디렉터리는 변경하지 않았다.
- merge/cherry-pick 없이 아래 10개 파일만 해당 소스 커밋에서 가져왔다. SHA-256 비교로 원본과 동일함을 확인했다.
- main, 기존 Production 파일, 운영 DB/Storage/환경변수, Vercel 설정 및 Deployment Protection은 변경하지 않았다.

| 변경 파일 | 내용 |
|---|---|
| `src/app/components/moamoa/MoaCultureRoute.tsx` | 문화 목록·상세·상태·검색·필터·삭제 UI 재사용 |
| `src/app/components/moamoa/culture/CultureEditor.tsx` | 수동/메타데이터 입력·수정 재사용 |
| 같은 폴더 `CultureImage.tsx`, `CultureMetadataSearch.tsx`, `CultureSaveFeedback.tsx`, `culture.css` | 이미지·검색·확인 저장 UI 원본 보존 |
| `src/app/hooks/useCultureRecords.ts` | 기존 ID·확인 저장·재시도·Realtime 인터페이스 재사용, Preview에서는 메모리 transport |
| `src/lib/cultureRecords.ts`, `cultureMetadata.ts`, `cultureRecords.test.ts` | codec·저장·필터·메타데이터 적용 및 단위 테스트 재사용 |
| `src/review/cultureApi.ts` | TMDB/YouTube의 명시적 로컬 샘플 응답·실패 샘플 |
| `src/review/cultureSamples.ts`, `culture-assets/*.svg` | 5개 샘플 기록과 직접 작성한 로컬 이미지 3개 |
| `src/review/ReviewCultureImage.tsx` | 등록된 샘플 URL만 번들 이미지로 표시; 임의 외부 이미지 URL은 요청하지 않음 |
| `src/review/ReviewCultureNav.tsx`, `ReviewCultureMusic.tsx`, `culture.css` | 영상/음악 탭·기록 복귀·후속 개발 안내·태블릿 레이아웃 |
| `src/review/main.ts`, `reviewRoutes.tsx`, `ReviewShell.tsx` | 같은 메모리 테이블 시드, 영상/음악 라우트, 기록 메뉴 활성 상태 |
| `vite.review.config.ts` | Preview만 적용하는 API/이미지 alias·탐색 교체·로컬 검색 안내·실제 API 모듈 번들 거부 |
| `scripts/test/moa-review-culture.test.mjs` | 세 화면 크기의 문화 기록 통합·네트워크 격리 검증 |
| `scripts/test/moa-review.test.mjs` | 문화 미지원 화면 기대값을 실제 문화 기록 진입으로 변경; 나머지 회귀 유지 |
| 관련 문서, `docs/screenshots/moamoa-preview-culture/` | 확인 방법과 이번 검증 자료 |

## 충돌 지점과 Preview 경계

제품의 `src/app/routes.tsx`와 `MoaFrame.tsx`, 공통 `MoaRecordsNav.tsx`·5개 메뉴 정의·전역 스타일은 수정하지 않았다. Preview 전용 라우터에서 `/culture`를 `/culture/video`로 연결한다. 기존 기록 분류 링크를 그대로 사용할 수 있고, 주요 메뉴는 추가되지 않는다. 음악은 `/culture/music`에서 후속 개발 안내를 표시한다.

문화 소스의 기존 화면/독서 링크는 Preview 빌드에서 `ReviewCultureNav`로 교체한다. 외부 작품 링크는 클릭 가능한 링크 대신 저장한 문자열로 표시한다. 변환 대상 슬롯이 사라지면 빌드가 실패한다. 제품 컴포넌트 복사본은 원본과 동일하다.

문화 브랜치의 실제 TMDB/YouTube 유틸리티 변경과 제품 라우터 변경은 가져오지 않았다. Preview에서는 `cultureApi.ts`로 해석하며 실제 `supabase.ts`, `tmdb.ts`, `youtube.ts` 또는 Supabase SDK가 번들에 포함되면 빌드가 실패한다. API 키·운영 인증 정보 없이 동작하며 `VITE_` 환경값 제거, fetch 차단, `connect-src 'none'`, 외부 이미지 차단을 유지한다.

포스터 URL·작품 URL·ID·메타데이터는 원래 필드 형태로 메모리에 저장한다. 이미지 컴포넌트는 허용된 가상 샘플 URL만 번들 이미지로 바꾼다. 사용자가 외부 이미지 주소를 입력해도 요청하지 않고 안내를 표시한다. 새 탭/브라우저 새로고침은 기본 5개 샘플로 돌아간다. 실제 DB 동기화·서버 저장은 하지 않는다.

## 확인 방법

Vercel `supremeyes-projects/my-planner`의 Deployments에서 이번 `codex/moamoa-review-preview` 커밋에 해당하는 **Preview**를 선택하고 기존 Deployment Protection 인증을 통과한다. GitHub Push가 자동 Preview 빌드 요청이며, 수동 Vercel 배포나 보호 설정 변경은 하지 않는다. 이 환경에서 Vercel READY 상태·배포 URL을 직접 조회할 연결 도구는 제공되지 않는다.

1. `기록 → 문화·음악 → 영상`으로 진입한다. 직접 주소는 `/culture/video`다.
2. `+ 문화 기록`에서 작품명만 입력해 저장한다. 상세의 수정에서 별점·날짜·감상·태그를 추가하고 상태를 바꾼다.
3. 제목/태그 검색, 상태/유형/플랫폼 필터, 별점 정렬을 체험한다. 삭제는 확인 대화상자를 거친다.
4. 입력 화면의 `작품 검색`은 고정 로컬 영화·드라마 샘플을 반환한다. `오류`는 실패, `없음`은 빈 결과다. 실패 후 `직접 입력`으로 저장할 수 있다.
5. `YouTube URL 입력`에 `https://youtu.be/sample00001`을 넣으면 로컬 샘플 영상이 표시된다. `https://youtu.be/failure0000`은 실패 샘플이며 `URL만 입력에 사용` 후 작품명을 직접 입력할 수 있다. 실제 영상은 조회하거나 열지 않는다.
6. 다른 주요 메뉴나 음악 안내를 방문한 뒤 돌아오면 입력이 유지된다. 새로고침 또는 `샘플 초기화`를 누르면 원래 샘플로 돌아간다.
7. `기록으로 돌아가기`로 시간/음식 등 기존 기록 화면으로 복귀한다.

실물 iPhone/Safari와 Vercel Protection 통과 후의 원격 화면은 별도 확인 대상이다. 자동 브라우저 검증은 로컬 정적 빌드와 실제 Vercel CSP를 사용하는 Chromium에서 수행한다.

## 재검증

| 검증 | 최종 결과 |
|---|---|
| 전체 단위 테스트 | 170개 통과, 실패 0 |
| 전체 브라우저/API 회귀 | 89개 통과, 실패·스킵 0; 기존 음식·시간·TODO·오늘·캘린더·정원 및 Preview 격리 포함 |
| 문화 Preview | 390×844 / 768×1024 / 1440×1024 모두 통과, 스크린샷 33장 |
| 문화 주요 동작 | 진입, 수동 추가·수정·삭제/취소, 상태·별점·검색·필터·정렬, 저장 실패 재시도, TMDB/YouTube 샘플 및 실패 후 직접 입력, 메뉴 복귀, 이동 중 유지·새로고침 초기화 |
| 외부 연결 | 세 화면 크기에서 외부 요청·WebSocket·pageerror 0; DB/Storage/API HTTP 요청 0 |
| 빌드 격리 | 실제 SDK/API 모듈 거부, 합성 환경값 미노출, Production/다른 브랜치 Preview 빌드 거부 통과 |
| Production 빌드 | 성공; 기준 빌드의 전체 19개 파일과 SHA-256 동일. 기존 큰 번들 경고만 유지 |
| 폰트·색상 린트 | 위반 0, 통과 |
| 전체 `render:check` | 73장, FAIL 0. 기존 제품의 라벤더 색상 WARN 73; 일부 기존 일간/독서 화면 하네스 선택자 미일치로 건너뛴 동작은 검증 완료로 간주하지 않음 |

문화 Preview의 세 화면 크기 자동화는 건너뛴 동작 없이 완료했다. 기존 렌더 하네스의 세부 스킵 목록과 빌드/소스 비교 결과는 [verification.json](screenshots/moamoa-preview-culture/verification.json), 문화 동작·외부 연결 결과는 [validation.json](screenshots/moamoa-preview-culture/validation.json)에 기록했다.

회귀 테스트가 다시 생성한 과거 스크린샷 15개와 기존 프로토타입 검증 JSON은 `/workspace/preview-culture-validation/regenerated-existing/`에 복사·검증하고 원래 Git 버전으로 돌렸다. 이번 커밋에는 이번 문화 기록 화면과 검증 자료만 추가한다. 실행 로그와 기준선은 `/workspace/preview-culture-validation/`에 보관했다.

```bash
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run vercel-build
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check
```

단위 테스트는 `src/lib/*.test.ts`를 esbuild로 Node용 번들링한 뒤 `node --test`로 실행한다. 저장소에는 별도 TypeScript 검사 명령/tsconfig가 없어 Vite 변환·번들링과 실행 테스트 범위로 검증했다.

스크린샷: [PC 목록](screenshots/moamoa-preview-culture/desktop-list.png), [모바일 목록](screenshots/moamoa-preview-culture/mobile-list.png), [태블릿 목록](screenshots/moamoa-preview-culture/tablet-list.png), [모바일 입력](screenshots/moamoa-preview-culture/mobile-manual-add.png). 상세·수정·삭제·실패·검색·음악 안내도 같은 폴더에 보관한다.
