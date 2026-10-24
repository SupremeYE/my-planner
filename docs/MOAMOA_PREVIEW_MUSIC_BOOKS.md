# MoaMoa Preview — 음악·독서 선별 통합

## 기준과 범위

- 저장소: `SupremeYE/my-planner`
- Preview 기준: `715476777529aa4b77ade678c9c6f779251ec525`
- 음악: `690aa546ce258e6403726a174d76508f2fe00fa8`
- 독서: `b27cda5eb2b647c2d39a4a94dd849c973b06ddf5` (음악 커밋의 후속 커밋임을 확인)
- 문화 공통 기반: `690f3ab0ca095c5213d4b7229192eefc4d6f9d83`
- main 기준: `5fac23d1f7c727e1c4ee3bd8c7986705b91efd71`

기존 작업 공간을 덮어쓰지 않고 `/workspace/moamoa-review-media`의 독립 브랜치 `codex/moamoa-review-media-integration`에서 준비했다. 전체 기능 브랜치 병합 없이 필요한 파일만 가져왔다. 검증 후 `codex/moamoa-review-preview`로만 fast-forward Push한다. 실제 앱의 `src/app/routes.tsx`, 기존 사이드바·캘린더·정원, DB 모델, 환경변수, Deployment Protection을 수정하지 않았다.

## 선별 파일 및 원본 비교

[원본 Git blob 및 SHA-256 매니페스트](validation/moamoa-preview-media/source-manifest.json)에 24개 파일의 원본과 통합 해시를 기록했다. 21개는 바이트 단위로 동일하다. 나머지 3개는 음악·독서·문화 브라우저 테스트로, 실제 제품 라우터를 바꾸지 않기 위한 **테스트 중 개발 경로 주입**만 추가했다. 기존 검증 조건을 제거하거나 완화하지 않았다.

- 음악: `MoaMusicRoute`, `MusicEditor`, `MusicDetail`, CSS, `musicRecords`, `useMusicRecords`, 단위·브라우저 테스트 및 샘플 fixture.
- 독서: `MoaBooksRoute`, `BookEditor`, `QuoteEditor`, `BookNoteEditor`, `BookImage`, CSS, `bookRecords`, `useBookRecords`, 단위·브라우저 테스트 및 fixture.
- 문화: 기존 Preview에 없던 원본 문화 브라우저 테스트와 fixture를 추가하여 원래 기능 회귀 120개를 통합 작업 환경에서 실행했다.
- 기존 `cultureRecords`, `confirmedWrites`, `SaveCoordinator`, `CultureSaveFeedback`, `MoaDialog`, `LpDisc`·스티커, 사진 업로드 공통 코드와 의존성을 확인했다. 기능 저장 로직은 복제하거나 재작성하지 않았다.

Preview 수정 파일: `src/review/{main,transport,reviewRoutes}`, `vite.review.config.ts`, `vercel.json`. 신규 어댑터: `mediaSamples`, `mediaApi`, `reviewMedia`, `ReviewMediaNav`, `ReviewBookImage`, `disabledVoice`, `mediaBuildTransforms`, 전용 CSS 및 로컬 SVG/WAV. `mediaBuildTransforms`는 원본 코드 위치가 달라지면 빌드를 실패시켜 격리 경계의 조용한 훼손을 막는다.

## 진입 및 기능

주요 메뉴는 오늘 / 캘린더 / 할 일 / 기록 / 나의 정원으로 유지한다.

| 진입 | 검토 URL 경로 | 동작 |
| --- | --- | --- |
| 기록 → 문화·음악 → 영상 | `/culture/video` | 기존 문화 Preview 유지 |
| 기록 → 문화·음악 → 음악 | `/culture/music` | 목록·검색·무드 필터, 직접 추가·수정·삭제, LP 꾸미기·취소·저장, 로컬 미리듣기 |
| 기록 → 독서 | `/books` | 읽고 싶은 책·읽는 중·완독, 책·진도, 구절·즐겨찾기·메모·통계 |

`/books`는 **검토 빌드 내부의 라우트만** 새 독서 UI로 연결한다. Production의 `/books`와 `/culture`는 그대로다. 음악의 준비 중 화면을 새 기능으로 교체했다. 각 화면의 빠른 기록은 음악 또는 책 추가를 연다.

샘플은 동일한 메모리 전송 계층에 `music_records`, `books`, `book_quotes`, `book_notes`, `reading_logs`를 추가한다. 같은 탭에서 저장·화면 이동 시 유지되며 **새로고침 및 샘플 초기화 시 복원**된다. 원본 ID·관계·미디어 URL은 변경하지 않고 표시 단계에서 허용된 가상 URL을 로컬 이미지로 매핑한다. 허용되지 않은 외부 URL은 대체 표시하며 요청하지 않는다.

## 저장·사진·오디오·검색

- 기존 확인 저장·중복 방지·명시적 재시도 사용. 실패 시 초안과 기존 확정 데이터 유지.
- 음악/책 저장, 구절 저장, 사진 업로드, 독서 이력 부분 실패를 안내 영역의 버튼으로 체험할 수 있다. 실패 준비 안내는 저장 성공 메시지가 아니다.
- 책 정보 저장 후 독서 이력의 응답이 유실되는 부분 성공 시 상태를 구분하고 동일 이력 ID로 재시도한다. 이력 중복이 생기지 않는 것을 확인했다.
- 구절·메모·로그가 있는 책 삭제는 차단한다. 연결 없는 새 책과 음악은 삭제 확인 후 제거한다.
- `book-photos`는 실제 Storage 대신 메모리 Blob 저장. 고유 경로, `upsert: false`, 원본 객체 미삭제 유지. 사진 교체 취소 시 기존 URL 유지, 교체 저장 시 새 객체 사용. 업로드 실패 후 재시도 가능.
- iTunes/Kakao 모의 검색: 일반 검색은 로컬 결과, `오류` 또는 `실패`는 실패, `없음`은 빈 결과, 책의 `표지없음`은 표지 없는 결과. 수동 입력 가능.
- 직접 만든 3초 WAV만 미리듣기. 재생 종료와 상세 화면 이탈 시 정지. 외부 음악 링크는 보관 값만 표시하며 열지 않는다.
- OCR·음성 입력은 Preview에서 비활성화하고 안내한다. 권한·마이크·실제 OCR·전사 요청을 보내지 않는다.

## 격리와 Production 비교

- 기존 Vite alias·빌드 경계 검사 유지. 실제 Supabase SDK, 원본 Supabase·iTunes·TMDB·YouTube·전사 모듈 포함을 차단한다.
- 실제 서비스 호출을 모의 함수/메모리 계층으로 대체. `connect-src 'none'`, 이미지 self/data/blob, 추가한 `media-src 'self' blob:` 유지.
- VITE 환경변수 제거, 합성 Secret canary 비노출 검사. SW/manifest 제외 및 등록 차단. Production/다른 Vercel 브랜치의 검토 빌드 거부 검증.
- 390/768/1440px 정적 Preview에서 외부 요청·WebSocket·JS 오류 모두 0건. DB/API/Storage HTTP 요청 없음.
- 깨끗한 `7154767` 별도 worktree의 Production 빌드와 최종 빌드 **19개 파일의 SHA-256이 모두 동일**하다. [비교 결과](validation/moamoa-preview-media/production-comparison.json).
- main, 운영 DB·Storage·인증·Secret·배포 설정값 변경 없음. API/스키마 마이그레이션 없음.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `src/lib/*.test.ts` esbuild 번들 후 Node 테스트 | **193/193 통과** |
| 기존 기능 브라우저·통합 테스트 | **120/120 통과**: 기존 106개 + 문화 14개, 모두 통합 작업 환경에서 실행 |
| 기존 Preview 회귀 (`moa-review`, `moa-review-culture`) | **6/6 통과** |
| 새 정적 Preview 음악·독서 상호작용 | **4/4 통과**: 상위 검사와 390/768/1440px 시나리오 |
| Production 빌드·검토 정적 빌드 | 통과 |
| `lint:fonts` / `lint:colors` | 0건 / baseline 379 유지, 신규 위반 0건 |
| `render:check -- --route=books` (기존 BooksView) | 8장, FAIL 0 / WARN 8: 기존 라벤더 색상 7건씩. 일부 모바일 구절/상세 탐색을 하네스가 찾지 못해 스킵 |
| 신규 모아모아 화면 렌더 | 3개 너비에서 가로 넘침 없음, 모달·저장 버튼 화면 범위 확인, 실제 캡처 검토 |
| `git diff --check` | 통과 |

독립 TypeScript 검사 설정/명령은 기존 프로젝트에 없다. Vite/esbuild 변환·빌드 및 실행 테스트를 수행했으며 완전한 `tsc --noEmit` 검사로 표현하지 않는다.

[테스트 로그](validation/moamoa-preview-media/)와 [상호작용 결과](screenshots/moamoa-preview-media/validation.json)를 참고한다. 기존 Preview 문화 테스트의 ‘음악 준비 중’ 검사는 실제 음악 목록 및 영상 탭 복귀 검사로 변경했다. 재생 종료, 사진 교체 저장/취소·원본 보존, 저장 실패·재시도, 화면 이동·초기화도 포함했다.

재실행 명령:

```sh
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=books
git diff --check
```

Preview 테스트는 동일한 `dist-review`를 사용하므로 병렬 실행하지 않는다. 단위 테스트는 `src/lib/*.test.ts`를 설치된 esbuild로 Node용 ESM에 bundle한 후 `node --test`로 실행했다. 별도 package 테스트 명령을 가정하지 않았다.

## 스크린샷

각 너비에서 목록, 추가·검색, 로컬 오디오, LP 꾸미기, 책 상세·구절·사진, 오류·재시도, 삭제 보호, 통계를 캡처했다.

| 크기 | 음악 | 독서 | 사진·실패 |
| --- | --- | --- | --- |
| 모바일 390px | [목록](screenshots/moamoa-preview-media/mobile-music-list.png), [앨범](screenshots/moamoa-preview-media/mobile-music-album.png) | [책장](screenshots/moamoa-preview-media/mobile-books-list.png), [통계](screenshots/moamoa-preview-media/mobile-books-stats.png) | [사진](screenshots/moamoa-preview-media/mobile-books-photo.png), [부분 실패](screenshots/moamoa-preview-media/mobile-books-partial-retry.png) |
| 태블릿 768px | [목록](screenshots/moamoa-preview-media/tablet-music-list.png) | [책장](screenshots/moamoa-preview-media/tablet-books-list.png) | [사진](screenshots/moamoa-preview-media/tablet-books-photo.png) |
| PC 1440px | [목록](screenshots/moamoa-preview-media/desktop-music-list.png), [LP](screenshots/moamoa-preview-media/desktop-music-stickers.png) | [책장](screenshots/moamoa-preview-media/desktop-books-list.png), [상세](screenshots/moamoa-preview-media/desktop-books-detail.png) | [사진 교체](screenshots/moamoa-preview-media/desktop-books-photo-replaced.png) |

## 남은 검증

- 실제 iPhone Safari/PWA의 카메라 실행, HEIC/사진 방향·권한·앨범 선택, 키보드·safe area, 오디오 사용자 제스처/백그라운드 중단은 실기기 검증 필요. Chromium 파일 선택 자동화가 실기기 카메라 검증을 대체하지 않는다.
- 실제 Supabase RLS·Storage 정책·다중 기기 동기화는 이번에 접근/검증하지 않았다. 운영 연결 전 격리 환경에서 별도 검증 필요.
- OCR·음성 입력, 실제 음악/도서 검색 API는 이 Preview에서 지원하지 않는다.
- 사진/음악 파일은 현재 탭 메모리에만 있다. 새로고침 후 사용자가 추가한 데이터가 보존되는 서비스가 아니다.
- Vercel은 허용된 브랜치의 GitHub Push 자동 Preview만 사용한다. Vercel 도구로 READY를 확인하지 못한 경우 배포 완료라고 표시하지 않는다. 대시보드에서 최종 커밋 SHA와 READY를 확인한 뒤 해당 HTTPS URL을 사용한다.

## 보존

원본 작업 공간 `/workspace/my-planner`는 변경하지 않았다. 테스트가 재생성한 기존 캡처는 `/workspace/review-media-validation/regenerated-artifacts`에 191개 파일을 해시 검증하여 보관하고 원래 커밋의 캡처로 되돌렸다. 이번 신규 캡처만 통합한다. 코드·문서·신규 캡처의 최종 복구 사본은 `/workspace/moamoa-review-media-checkpoint-backup`에 SHA-256 매니페스트와 함께 보관한다. `.git`, node_modules, 환경변수·Secret은 백업/커밋 대상에서 제외한다.
