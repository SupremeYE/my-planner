# 모아모아 PC·iPhone 검토용 Preview

현재 탐색·캘린더·정원 구현과 최신 검증은 [Preview 탐색 개선 보고서](MOAMOA_PREVIEW_NAVIGATION.md)를 따른다. 아래 체크포인트/초기 검증 결과는 `c0ad0db` 기준 기록이다.

## 보존 및 브랜치

- 기존 음식 기록·카메라 보완 체크포인트: `4f6d3a058e2792f1c9ce525752af6e96ac04a033`.
- `codex/moamoa-step3b4-food-records`에만 체크포인트 Push 및 원격 SHA 확인을 완료했다.
- 검토 브랜치: `codex/moamoa-review-preview`. 이 브랜치만 GitHub 연동 Preview 대상으로 Push한다.
- 작업 시작 시점의 새 백업: `/workspace/moamoa-backups/review-preview/baseline.tar.gz`.
  `baseline.json`의 **709개 파일 SHA-256**을 별도 `restored/`에서 모두 검증했다. `.git`, 의존성, 빌드 결과, 환경변수·Secret 파일은 제외했다. 기존 백업과 별개의 기준선이다.
- 백업 이후 기존 브라우저 테스트에서 갱신된 스크린샷/검증 JSON도 체크포인트에 포함했다. 검토 화면 작업에서는 기존 제품 소스와 데이터 모델을 변경하지 않았다.

## 배포 방식과 현재 확인 범위

사용자가 확인한 `supremeyes-projects/my-planner`의 GitHub 자동 Preview 빌드를 사용한다. Vercel CLI 수동 배포, 프로젝트 설정·환경변수·Deployment Protection 변경은 하지 않는다.

이 환경에는 Vercel 연결 도구/인증이 없고 GitHub deployment 상태 API도 네트워크 정책으로 차단되어 있다. 따라서 **Push 및 원격 SHA 확인과 실제 Vercel READY 확인은 구분**한다. 배포 URL과 READY 여부는 대시보드에서 해당 검토 브랜치의 커밋을 선택하여 확인해야 한다. 앞서 확인된 `4f6d3a0` URL은 일반 음식 기록 체크포인트이며 새 샘플 검토 빌드의 URL이 아니다.

## 빌드 격리

| 항목 | 검토 Preview | 일반 제품 빌드 |
|---|---|---|
| HTML 진입점 | `review.html` → `dist-review/index.html` | 기존 `index.html` → `dist/` |
| 명령 | `npm run vercel-build` | `npm run build` |
| 데이터 | 샘플 + 메모리 DB/사진 Blob | 기존 제품 경로 유지 |
| 인증 | 가짜 세션, 실제 계정 변경 차단 | 기존 Auth 유지 |
| Supabase SDK | 빌드 alias로 제외, 실제 SDK 포함 시 빌드 실패 | 기존 구성 유지 |
| 서버 API | 정적 builder만 사용, `/api/*`는 503 | 기존 main/Production 설정 유지 |
| 네트워크 | fetch 차단 + CSP `connect-src 'none'`, 외부 이미지/폰트 차단 | 기존 제품 설정 유지 |
| PWA | manifest/SW 제외, SW 등록 차단 | 기존 PWA 유지 |

`vercel.json`은 이 브랜치에서 명시적인 `@vercel/static-build`만 실행한다. `api/`는 함수로 배포하지 않는다. Vercel 실행 시 `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=codex/moamoa-review-preview`만 허용하며 Production 대상은 실패하도록 했다. main에 병합하거나 Production으로 승격하면 안 된다.

검토용 alias, Blob URL 허용, 외부 폰트 제거, 샘플 안내 문구는 `vite.review.config.ts`에만 있다. 제품의 사진 검증·저장 코드를 수정하지 않는다. 일반 제품 빌드에는 샘플 fixture, 검토 라우트·배너 및 개발 음식 화면이 포함되지 않는 것을 별도로 검사했다. 외부 폰트 대신 기존 시스템 폰트 fallback을 사용하므로 기기별 글꼴 차이가 있을 수 있다.

## 접근과 체험

대시보드에서 **검토 브랜치의 Preview URL**을 열고 기존 Deployment Protection 인증을 통과한다. 루트 `/`는 오늘 화면으로 진입한다. PC와 iPhone Safari 모두 같은 URL을 사용한다.

| 메뉴 | 경로 | 범위 |
|---|---|---|
| 오늘 | `/__moamoa-today` | 주간 목표, 핵심 TODO, 일정·실제 시간, 빠른 입력 |
| 캘린더 | `/calendar` | 모아모아 월·주·일 / 주간 일정·플래너 + 같은 샘플 Provider |
| 할 일 | `/__moamoa-todos` | 기존 STEP 3B-2 화면, 메모리 CRUD·태그·목표 연결 |
| 기록 | `/__moamoa-records` | 일·주·월 시간 분석, 독립/할 일 연결 시간 기록 |
| 음식 | `/__moamoa-food` | 샘플 사진·갤러리, 등록·수정·삭제, 사진 촬영·앨범 선택 |
| 나의 정원 | `/profile` | 모아모아 정원 / 기존 진행률·XP 기준 / 같은 메모리 데이터 |

PC 사이드바 또는 모바일 하단 5개 탭으로 이동한다. 작은 샘플 안내와 초기화 동작을 유지하며 음식은 기록에서 진입한다. 캘린더·정원은 Preview 전용 모아모아 화면이다. 문화·독서 등 후속 화면은 같은 틀 안에서 미지원 안내를 표시한다. 음식 AI 버튼은 비활성화했다.

**입력과 사진은 현재 탭 메모리에만 있다.** 화면 이동 중에는 유지되지만 새로고침·탭 종료·상단 `샘플 초기화`로 사라진다. 다른 기기와 동기화하지 않는다. 샘플 저장 상태의 “저장됨”은 이 메모리 전송 계층에서 확인한 결과이며 실제 서버 저장을 뜻하지 않는다. 실제 개인정보 대신 테스트용 내용을 입력한다.

### 사진 체험

`기록 → 음식 → + 음식 기록`에서 `사진 촬영` 또는 `앨범에서 선택`을 누른다. 촬영 input은 `accept="image/*" capture="environment"`, 앨범 input은 capture 없이 기존 형식을 유지한다. 선택 후 미리보기·음식명 입력·저장을 체험할 수 있다. 업로드는 네트워크 요청 없이 브라우저 Blob 저장으로 대체한다. 저장된 사진도 화면 이동 중 표시되지만 새로고침하면 초기화된다.

실제 iPhone에서는 다음을 추가 확인해야 한다. **Chromium filechooser 테스트는 실물 카메라 테스트가 아니다.**

- Safari에서 카메라 호출/권한/취소와 앨범 선택이 구분되는지
- 세로·가로 촬영의 방향, 미리보기, 저장 후 같은 탭 재진입
- HEIC/HEIF 디코딩, 지원하지 않는 형식의 오류 안내, 10MB 초과 안내
- 키보드·안전 영역·시트 내부 스크롤과 저장 버튼 접근
- Deployment Protection 인증 후 HTTPS에서 위 흐름이 유지되는지

PWA 설치/SW는 검토 빌드에서 꺼두었으므로 홈 화면 설치형 PWA의 카메라 동작은 이번 Preview로 검증 완료했다고 간주하지 않는다.

## 초기 검증 (`c0ad0db`)

- 체크포인트 전 기존 단위 **159개**, 기존 브라우저/API·환경 회귀 **83개** 통과.
- 검토 전용 **2개** 자동화 통과: Production/다른 브랜치 빌드 거부; 정적 빌드의 실제 Chromium 화면·상호작용.
- 390×844 / 1440×1024에서 6개 화면, 빠른 TODO, 시간 기록, 카메라/앨범 미리보기, 사진 실패·재시도 **20장** 캡처.
- 가로 넘침 없음, 주간 목표 모바일 첫 화면 표시, 모달 제목이 검토 배너 아래 표시되는 것 확인.
- 메모리 TODO 생성, 활동 시간 +15분 반영, 사진 업로드 실패 후 초안 유지·동일 ID 재시도, Blob 이미지 재표시, 샘플 초기화 확인.
- 외부 요청 0, DB/Storage/API 네트워크 쓰기 0, 브라우저 pageerror 0. 실제 Supabase·물리 iPhone 검증은 하지 않았다.
- 일반 Production 빌드 통과. 기존 큰 번들 경고는 남는다.
- 기존 클라이언트 Secret canary/개발 라우트 제외 검사 **1개** 재통과.
- `lint:fonts`, `lint:colors` 통과. 독립 TypeScript 검사 명령/tsconfig는 없어 Vite 변환·번들링 범위로 검증했다.
- `HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar,todos`: 10장, FAIL 0; 기존 라벤더 색상 WARN 10.
- `git diff --check` 통과.

재실행:

```bash
node --test scripts/test/moa-review.test.mjs
node --test scripts/test/food-client-env.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=calendar,todos
```

[스크린샷 및 검증 JSON](screenshots/moamoa-review/README.md)

## 실제 DB 연결 전 남은 일

운영과 분리된 Supabase 프로젝트·테스트 사용자·사진 버킷에서 기존 SQL 초안/RLS/Storage 정책을 검토·적용한 후 승인된 연결 검증이 필요하다. 독립 활동 스키마가 운영에 적용됐다고 가정하지 않는다. 이번 단계는 해당 승인/적용을 수행하지 않는다. 실제 iPhone과 별도 PWA 설치 검증도 남는다.
