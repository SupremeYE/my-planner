# STEP 3B-4B-3 독서 기록

## 체크포인트와 작업 공간

- 문화 기준: `690f3ab0ca095c5213d4b7229192eefc4d6f9d83`.
- 음악 구현·검증 후 `codex/moamoa-step3b4b2-music`에 **`690aa546ce258e6403726a174d76508f2fe00fa8`** 커밋·Push 완료 및 원격 SHA 확인.
- 음악 단계: 단위180/180, 기존 통합97/97, 신규 음악 브라우저11/11, 빌드·폰트·색상 검사 통과. [음악 보고서](MOAMOA_STEP3B4B2_MUSIC.md).
- 이 음악 커밋에서 `codex/moamoa-step3b4b3-books` 분기. 독립 클론 `/workspace/moamoa-music-books` 사용.
- 기능 개발에 Preview 브랜치를 사용하지 않았다. 기존 `/workspace/my-planner`, main, Preview는 변경하지 않았다.

## 기존 모델 및 코드 분석

| 기존 자산 | 재사용·보존 |
| --- | --- |
| `BooksView.tsx`, `/books` | 레거시 화면과 코드 그대로. 실제 컬럼·ID·완독 판정·진행률·통계 규칙을 새 feature 경계에 적용 |
| `books` | id/title/author/publisher/thumbnail/total_pages/current_page/status/start_date/finish_date/added_at 사용. 조회 정렬은 **added_at**, 서버 페이지 제한 없이 페이지별 조회 |
| `book_quotes` | id/book_id/text/page/tags/starred/created_at/note/image_url 사용. 구절의 내 생각과 사진 URL 유지 |
| `book_notes` | 책 단위 purpose/output 및 기존 사용자 정의 type·ID 유지. 구절 note와 분리. 내용 변경 시 해당 필드만 저장 |
| `reading_logs` | 페이지 변경 시 누적 페이지 스냅샷 한 건. 기존 시간·메모 조회. 시간을 임의 생성하지 않음 |
| `book-photos` | 기존 public 버킷과 기존 URL 유지. 새 사진만 고유한 평면 경로. 원본 덮어쓰기·Storage 삭제 없음 |
| `api/kakao-books.ts` | 기존 서버 검색 경로 그대로. 실패·결과 없음·표지 없음에도 직접 책 추가 가능 |
| `QuoteSentenceSelector`, `imagePrep` | 기존 selector는 업로드 직후 자동 OCR 및 오류 시 재업로드 흐름이므로 그대로 삽입하지 않음. 기존 `prepImageForOcr`와 `vision-extract`의 reading 응답 계약 재사용, OCR은 명시적 버튼으로 분리 |
| `useVoiceInput`, `useVoiceRecorder`, `transcribeAudio` | 새 구절 입력에서도 재사용. 자동 테스트는 가상 마이크와 모의 transcribe 응답 |
| STEP2 저장/음식 사진 | `confirmedWrites`, `SaveCoordinator`, `mergeConfirmedRows`, `useRealtimeSync`, `foodPhotoStorage`의 확인 업로드 프로토콜 재사용. 버킷 어댑터만 book-photos로 지정 |

기존 books/book_quotes 최초 CREATE TABLE 파일은 현재 저장소에서 확인되지 않았다. 추가 컬럼·FK·Storage 정책 마이그레이션과 기존 CRUD를 기준으로 호환 구현했다. 운영 스키마가 동일하다는 주장은 하지 않는다. 기존 date-only 입력과 서버의 UTC 자정 timestamp 반환은 저장 확인 시 동등하게 처리하며, 무관한 기존 날짜를 수정하지 않는다.

## 화면과 버튼

개발 전용 `/__moamoa-books`, 기존 Auth/PlannerProvider 사용. Production에서는 DEV lazy import와 전용 코드·스타일이 제거된다. 전체 메뉴와 Preview 연결은 별도 작업이다.

- 책장: 읽고 싶은 책 / 읽는 중 / 완독 / 전체, 제목·저자·출판사 검색, 표지·페이지·진행률, 상세 보기.
- 책 추가·수정: 제목만 필수. Kakao 검색 또는 직접 입력, 저자·출판사·표지·전체 페이지·현재 페이지·상태·시작일·완독일.
- 마지막 페이지 도달 시 기존 규칙대로 done. 완독일이 없으면 저장 시 오늘. 기존 완독일 보존. 제목·표지만 수정할 때 기존 상태를 자동 재분류하지 않는다.
- 진도 저장: 바뀐 페이지에만 reading_logs 스냅샷 생성. `duration_minutes:null`, 새로운 독서 시간을 만들지 않는다.
- 구절 추가·수정·삭제: 본문·페이지·내 생각·태그·즐겨찾기·사진. 책별 및 전체 구절, 즐겨찾기 필터와 검색.
- 책 메모: 기존 purpose/output, 알 수 없는 기존 type도 표시·수정. 별도 ID 유지. 빈 내용 저장 시에도 기존 메모 행을 임의 삭제하지 않는다.
- 사진 촬영 / 앨범 / 선택 취소 / 미리보기. 파일 준비·업로드 실패 시 초안 유지. 10MB 이하, 지원 MIME 검증 및 기존 JPEG 전처리. HEIC 디코드 가능 여부는 브라우저에 따라 다르며 미지원 기기는 JPEG 변환 안내.
- OCR: 새 선택 사진을 사용자가 명시적으로 요청할 때만 업로드·전송. 결과 문장을 선택하면 기존 본문 뒤에 추가. 실패해도 사진·본문 유지, 직접 저장 가능.
- 음성 입력: 명시적 녹음 시작·종료·취소, 기존 음성 API. 실패 시 직접 입력 가능.
- 통계: 전체/완독 권수, 이번 달·올해 완독, 올해 월별 완독, 최근 독서 활동, 즐겨찾는 구절. 기존 `finish_date ?? added_at` 월별 집계 기준을 화면에 안내. 없는 시간·성취를 만들지 않는다.

## 저장·삭제·사진 보존

확인된 서버 행만 반영하고 저장 중 버튼 잠금, 실패 초안 유지, 명시적 재시도를 제공한다. 신규 UUID는 입력 세션 동안 고정이다. 수정은 변경 컬럼만 전송하며 다른 기기의 무관한 필드를 보호한다. 조회 실패는 빈 목록 성공으로 처리하지 않고 오류와 마지막 확인 데이터를 표시한다. 네 테이블의 Realtime 및 visibility/online 재조회가 있다.

**책 진도와 독서 이력은 두 테이블의 별도 요청이다.** 기존 스키마에 트랜잭션 RPC가 없으므로 원자적 저장을 주장하지 않는다. 책 확인 후 로그를 저장하고, 로그 실패 시 “책 정보는 저장됐지만 독서 이력을 확인하지 못했어요”로 표시한다. 같은 실행의 로그 UUID를 재사용하며, 재시도 시 확인된 책을 다시 덮어쓰지 않는다. 마지막에 책을 다시 조회하므로 그 사이 다른 기기에서 바뀐 진도도 보존한다. 브라우저를 닫으면 메모리 요청/미저장 초안 복구는 지원하지 않으므로 부분 성공 안내에서 재시도를 완료해야 한다.

**책 삭제는 연결된 구절·메모·독서 이력이 있으면 차단한다.** 연결이 없는 책만 확인창 이후 서버 삭제·부재 조회를 수행한다. 기존 FK의 ON DELETE CASCADE를 무조건 호출하지 않는다. 다만 연결 검사와 삭제는 클라이언트의 별도 요청이므로 다른 기기가 그 사이 새 연결을 만드는 경쟁을 DB 수준에서 원자적으로 막지는 못한다. 정식 다중 기기 운영 전에 조건부 삭제 RPC/트랜잭션 검토가 남아 있다. SQL이나 운영 정책은 변경하지 않았다.

구절 삭제는 해당 행만, 사진 원본과 별도 book_notes는 유지한다. 사진 변경은 새 고유 경로를 사용하며 기존 URL을 변경하는 것은 해당 구절을 명시적으로 저장했을 때뿐이다. 업로드 재시도는 같은 경로의 바이트 해시를 비교한다. DB 재시도는 이미 확인한 업로드 URL을 재사용한다. OCR 업로드 후 취소하거나 DB 저장을 끝내지 못한 새 객체는 남을 수 있으며 자동 삭제하지 않는다. 이 객체 정리도 별도 승인 작업이다.

## 검증 결과

- 최종 전체 단위 **193/193**: 기존170 + 음악10 + 독서13.
- 전체 브라우저/통합 **120/120**: 기존97 + 음악11 + 독서12. 신규 독서 단독도 최종 소스 기준 **12/12** 재검증.
- 실패 응답·응답 유실·오프라인·중복 클릭·명시적 재시도, 다른 기기 데이터 변경, 메모리 서버 재연결에 준하는 재조회 확인.
- 사진 업로드 실패·중복 경로 방지·DB 응답 유실 후 재업로드 없음·교체 취소·기존 URL 보존 확인.
- Kakao 성공/실패/빈 결과/표지 없음은 Playwright 응답. OCR 성공/실패 및 음성 변환은 mock Edge. 실제 외부 요청은 차단.
- 390/768/1440px 실제 렌더와 클릭 검사, 가로 넘침/pageerror0. [스크린샷 목록](screenshots/moamoa-books/README.md).
- Production 빌드, 폰트·색상 검사, git diff 공백 검사 통과. 기존 큰 번들 경고와 색상 baseline379 유지.
- Production JS/CSS/HTML에 `__moamoa-books`, `__moamoa-music`, 전용 화면/CSS 표식이 없음을 확인.
- 기존 `render:check --route=books`: 8장, FAIL0/WARN8(기존 라벤더). 모바일 일부 구절·상세 탐색은 기존 시드에서 찾지 못해 스킵했다. 새 독서 화면은 별도 브라우저 검증으로 확인했다.
- 별도 tsconfig/타입 검사 명령 없음. 전체 tsc 통과를 주장하지 않는다. esbuild 단위 테스트/Vite 브라우저 컴파일/제품 빌드 범위다.
- 실제 iPhone 촬영·마이크 권한·사진 방향·HEIC 처리는 검증하지 않았다. Chromium file chooser, 가상 미디어 입력까지 검증했다.

로그와 재생성된 기존 스크린샷 사본: `/workspace/books-validation/`. 타 기능 테스트 산출물은 사본을 남긴 뒤 기존 Git 바이트로 복원하며 해당 기능 소스를 수정하지 않는다.

## 변경 파일

- `src/app/routes.tsx`: DEV 독서 경로 한 줄.
- `src/lib/bookRecords.ts`, `.test.ts`: 기존 테이블 계약·확인 저장·사진 세션·완독/통계·검색.
- `src/app/hooks/useBookRecords.ts`: 독서 feature 안의 확인 상태·테이블별 Realtime.
- `src/app/components/moamoa/MoaBooksRoute.tsx`.
- `books/BookEditor.tsx`, `QuoteEditor.tsx`, `BookNoteEditor.tsx`, `BookImage.tsx`, `books.css`.
- `scripts/test/moa-books.test.mjs`, `fixtures/moa-books-data.mjs`, `moa-books-supabase.ts`.
- 본 문서와 독서 스크린샷. 기존 BooksView·문화·음악·음식·시간·API·전역 셸은 수정하지 않았다.

## 운영 연결 전 확인 및 Preview 통합

1. 승인된 격리 Supabase에서 실제 books/book_quotes 컬럼 타입·기본값, book_notes/reading_logs, RLS 및 Realtime publication을 확인한다. 메모리 검증은 실제 정책·외래키·인덱스까지 증명하지 않는다.
2. 소스상 book_notes는 기존 단일 소유자 정책이고 book-photos는 public read/authenticated write다. 다중 사용자용 소유자 분리 정책으로 검증된 상태라고 주장하지 않는다. 운영 변경 없이 후속 검토 대상으로 남긴다.
3. `api/kakao-books.ts`는 서버에서 `process.env.VITE_KAKAO_API_KEY`를 읽는다. 현재 검색 클라이언트는 키를 직접 참조하지 않지만 VITE_ 접두사는 클라이언트 주입 위험을 만든다. 정식 통합에서 서버 전용 `KAKAO_API_KEY`로 바꾸고 구 설정 제거/키 교체 여부를 별도 승인한다. 이번에는 API 코드·환경변수·Secret을 변경하지 않았다.
4. 실제 iPhone Safari/PWA에서 카메라/앨범·권한·회전·HEIC·음성 입력을 격리 HTTPS 환경으로 확인한다. 실제 Kakao/OCR/transcribe 과금 요청은 자동 테스트에서 실행하지 않았다.
5. 최신 Preview 셸에 기록→문화·음악→음악, 기록→독서 경로를 별도 통합한다. 실제 저장 모드와 메모리 검토 모드를 분리하고 네 테이블 및 book-photos 테스트 어댑터를 연결한다. Production 기본 경로 변경이나 Preview Push/배포는 이번 단계에서 하지 않는다.
