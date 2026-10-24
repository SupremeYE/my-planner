# STEP 3B-4B-2 음악 기록

## 기준과 범위

문화 기록 체크포인트 `690f3ab0ca095c5213d4b7229192eefc4d6f9d83`에서 독립 클론 `/workspace/moamoa-music-books`를 만들고 `codex/moamoa-step3b4b2-music`에서 구현했다. Preview 원격은 시작 시 `715476777529aa4b77ade678c9c6f779251ec525`, main은 `5fac23d1f7c727e1c4ee3bd8c7986705b91efd71`이었다. 두 브랜치와 기존 작업 공간은 수정하지 않았다.

개발 경로는 `/__moamoa-music`. 기존 Auth/PlannerProvider 아래에서 실제 `music_records`와 연결하며, 자동 테스트에서만 메모리 전송 계층으로 대체한다. Production의 기존 `/culture` 및 MusicSection은 그대로다. 전체 기록 메뉴 연결은 후속 Preview 통합 대상이다.

## 기존 구현 분석 및 보존

- `MusicSection`, `MusicAddSheet`, `MusicDetailSheet`, `MusicDetailPanel`: 기존 CRUD는 일부 오류를 로그로만 남기고 낙관적 표시/꾸미기 자동 저장을 사용한다. 새 경로는 새 UI와 확인 저장을 연결했고 기존 화면 코드는 변경하지 않았다.
- `MusicRecord`의 모든 컬럼을 feature-local codec에 매핑했다. ID, iTunes ID, artwork/preview/listen URL, 앨범, 연도, 장르, 무드, 메모, 스티커 원본을 보존한다. 알 수 없는 스티커 항목과 추가 속성도 일반 편집/꾸미기 추가 시 유지한다.
- 기존 `20260629000000_add_music_listened_date.sql`에 `listened_date`가 이미 있다. legacy db codec에는 누락되어 있어 새 경로의 `MusicEntry`에만 추가했다. 기존 날짜를 생성일로 추측하거나 보정하지 않는다. 신규 날짜 기본값은 기존 logical today다.
- 기존 `(user_id, itunes_track_id)` 부분 UNIQUE 인덱스가 동시 기기의 최종 중복 방지 수단이다. 새 저장은 사전 중복 조회도 수행하며 조회 실패를 중복 없음으로 처리하지 않는다. 수동 입력은 iTunes ID null로 가능하다. artist는 NOT NULL이지만 빈 문자열을 허용하는 기존 스키마이며 곡명만 필수다.
- `searchMusic`의 기존 `itunes-search` Edge Function을 그대로 사용한다. 사용자가 명시적으로 검색할 때만 호출한다. 빈 결과/실패 후 직접 입력 가능. 늦은 응답은 폐기한다. 검색 선택은 비어 있고 직접 수정하지 않은 필드만 채우며 기존 메모/날짜/이미지/연결 ID를 덮어쓰지 않는다.
- `LpDisc`, `StickerLayer`, `musicMoods`, 스티커 규칙을 재사용한다. 자동 저장하는 `useStickerEditor`는 사용하지 않고 꾸미기 저장/취소를 명시적으로 제공한다.

## 실제 버튼 동작

| 기능 | 동작 및 검증 |
| --- | --- |
| + 음악 기록 / 빠른 기록 | 같은 입력창, 제목만으로 확인 저장 |
| 검색 / 검색 결과 선택 | 모의 Edge 성공·실패·빈 결과·늦은 응답, 직접 입력 보존 |
| 무드 / 검색 / 날짜 / 정렬 | 조합 필터, 필터 초기화, 곡명·들은 날짜·생성일 정렬 |
| 상세 / 수정 | PC 모달·모바일 바텀시트, 기존 ID 및 변경하지 않은 필드 보존 |
| 저장 / 재시도 | 저장 중 잠금, 실패 초안 유지, 동일 UUID 재시도 |
| 삭제 / 취소 | 확인창, 서버 삭제 및 부재 조회 확인. 원본 미디어 삭제 없음 |
| 30초 미리듣기 | URL 있을 때만 활성화. 모의 WAV 실제 재생·실패 안내·닫기 시 정지 확인 |
| LP 꾸미기 | 기존 스티커 표시, 추가·드래그·더블탭 삭제, 명시적 저장·취소. 자동화는 추가·취소·저장과 원본 보존 검증 |
| 음악 서비스 | 기존 안전한 http(s) 링크 유지, 미지정은 제목·가수 YouTube Music 검색 링크. 자동으로 열지 않음 |

## 저장 안정성

`confirmedWrites`, `SaveCoordinator`, `mergeConfirmedRows`, 기존 `useRealtimeSync`를 재사용한다. 초기 읽기는 쓰지 않으며 실패 시 마지막 확인 목록을 유지한다. 신규 UUID는 입력창이 열린 동안 고정된다. 응답 유실 후 같은 ID로 재시도해도 중복 행을 만들지 않는다. 수정은 baseline 대비 바뀐 컬럼만 전송하고 반환 행을 검증한다. 다른 기기에서 변경한 무관한 필드 및 알 수 없는 서버 컬럼은 유지한다. Realtime/visibility/online 조회에서도 미확인 저장 상태는 보호한다.

초안과 요청 상태는 화면 메모리 범위다. 새로고침 후 미저장 초안을 복원하거나 오프라인 영속 저장하지 않는다. 같은 필드를 두 기기에서 동시에 변경하면 기존 정책대로 마지막 쓰기가 우선한다. 실제 RLS/인덱스/Realtime 적용 상태는 운영 조회 없이 마이그레이션 소스만 검토했다.

## 검증

- 기존 단위 **170/170**, 신규 음악 **10/10**, 최종 합계 **180/180**.
- 기존 전체 브라우저/통합 **97/97**, 신규 음악 **11/11** (상위 1 + 시나리오 10).
- 모의 서버 재연결로 저장 ID·URL 재조회, Realtime, 응답 유실·오프라인·403·503·재시도 확인.
- 음악 화면 **40장** (390/768/1440px 13세트 + 모바일 빈 상태), 가로 넘침·pageerror 0.
- Production 빌드, 폰트 검사, 색상 검사, `git diff --check` 통과. 색상 baseline379 유지. 기존 번들 크기 경고는 유지.
- Production JS/CSS/HTML에 음악 개발 경로·전용 UI/CSS 표식이 없는 것을 확인했다. Vite DEV lazy route로 제외한다.
- 기존 `render:check --route=culture,books`: 지원되는 books 8장, FAIL0/WARN8(기존 라벤더). culture는 하네스 대상에 없고, 모바일 quotes/detail 일부는 기존 시드 탐색 실패로 스킵. 새 음악은 별도 브라우저 테스트에서 실제 렌더했다.
- 별도 tsconfig/타입 검사 명령이 없어 전체 tsc 통과를 주장하지 않는다. esbuild 단위 테스트·Vite 컴파일/브라우저·Production 빌드를 수행했다.
- 로그: `/workspace/music-validation/`. 초기 npm ci는 기본 캐시 경로 권한 문제로 실패했고 `/workspace/.npm-cache`로 재실행해 성공했다.
- 기존 테스트가 재생성한 타 기능 스크린샷은 `/workspace/music-validation/regenerated-screenshots`에 SHA-256과 함께 보존한 뒤 기존 Git 바이트로 돌렸다. 기존 소스나 테스트 조건은 삭제·완화하지 않았다.

## 변경 파일

- `src/app/routes.tsx`: DEV lazy route 한 줄.
- `src/lib/musicRecords.ts`, `.test.ts`: 기존 컬럼 codec·확인 저장·필터·검증.
- `src/app/hooks/useMusicRecords.ts`: feature-local 확인 상태·Realtime.
- `src/app/components/moamoa/MoaMusicRoute.tsx`, `music/MusicEditor.tsx`, `MusicDetail.tsx`, `music.css`.
- `scripts/test/moa-music.test.mjs`, `fixtures/moa-music-data.mjs`, `moa-music-supabase.ts`.
- 본 보고서와 `docs/screenshots/moamoa-music/`.

## 운영 연결 및 후속 통합

운영 Supabase/Storage/API, 실제 사용자 데이터, 환경변수, DB 스키마에 접근·변경하지 않았다. 테스트 Edge 검색은 메모리 응답, 미디어는 Playwright 로컬 응답이며 나머지 외부 HTTP는 차단했다. 실제 iPhone 오디오 정책·백그라운드 전환 및 실제 iTunes 서비스 가용성은 승인된 격리 환경에서 추가 확인해야 한다.

Preview 통합 때 기록→문화·음악→음악을 연결하고 활성 메뉴·최신 공통 셸을 적용한다. 현재 기능 브랜치에는 샘플/검토 셸을 가져오지 않았다. 독서는 검증된 음악 체크포인트에서 별도 분기하며 기존 책·구절·별도 노트·독서 이력·사진을 재사용한다.
