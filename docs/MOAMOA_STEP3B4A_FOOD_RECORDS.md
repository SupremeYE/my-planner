# MoaMoa STEP 3B-4A — 음식 기록과 사진 보존

## 1. STEP 3B-3 체크포인트

- 시작: `codex/moamoa-step3b-time-analysis`, HEAD `ef27206814209d33da2355323006186267dc3838`.
- 이전 검증 매니페스트의 변경 소스 30개가 현재 파일과 SHA-256 전부 일치했다. 기존 STEP 3B-2 백업도 실제 tar 내용을 읽어 검증했다. 소스 누락이나 예상 밖 사용자 수정은 발견하지 않았다.
- STEP 3B-3 현재 작업물 646개를 저장소 밖 **`/workspace/moamoa-backups/step3b3-baseline-20261024T032224Z/`**에 새로 백업했다. 파일 목록·SHA-256·Git 상태·tar·별도 복원본을 보관하고 복원 해시를 검증했다. Git metadata, node_modules, 환경변수/자격증명 파일은 수집 대상에서 제외했다.
- 소스를 바꾸기 전에 단위 **152/152**, 브라우저 **68/68**, Production 빌드·폰트·색상·diff 검사 통과. 기존 렌더 21장, FAIL 0 / WARN 21. 로그는 `/workspace/moamoa-backups/step3b4a-validation/baseline-*`에 있다.
- 검증 중 재생성된 이미지/validation JSON 이외의 소스 변경이 없음을 확인하고, 민감 토큰 패턴을 다시 검사했다.
- **83개 파일**을 승인한 메시지로 커밋했다.
  - 메시지: `feat(moamoa): add independent activity tracking and time analysis`
  - SHA: `becf876e865b7525d5d081583665d446ebef099c`
  - Push: `codex/moamoa-step3b-time-analysis`만 수행, `git ls-remote`로 같은 SHA 확인.
- 이어 `codex/moamoa-step3b4-food-records` 생성. HEAD는 위 체크포인트다. STEP 3B-4A 변경은 미커밋으로 유지한다.
- main은 `5fac23d1f7c727e1c4ee3bd8c7986705b91efd71`로 확인했다. main·PR·병합·강제 Push·운영 DB·Storage 정책·환경변수·배포는 변경하지 않았다.
- 실행 환경이 일시적으로 starting을 보고했을 때 ready를 기다린 뒤 브랜치·소스·백업·검증 로그가 유지됨을 확인하고 계속했다.

## 2. 기존 구현 분석과 재사용

| 대상 | 확인한 기존 동작 | 이번 적용 |
| --- | --- | --- |
| FoodView | 날짜별/통계/7단계 입력, 음식명 필수, 선택 사진·식비·칼로리·평가, 기존 단식 기록 | 기존 `/food` 화면 그대로 보존. 새 화면에서 원래 통계로 이동 가능 |
| FoodRecord | id/date/mealType/foodName/amount/photoUrl/memo, calories·탄단지, diningType/tasteRating/tasteMemo/isFasting | 같은 타입·컬럼·ID 사용. 숨은 영양/맛 메모와 단식 필드도 유지 |
| DB CRUD | 실패를 로그만 남기는 upsert/delete, 낙관적 Provider 반영 | 기존 메서드 계약 유지 + 새 화면용 확인 CRUD 추가. 인코더/디코더를 공통 모듈로 추출 |
| 사진 | `food-photos` 버킷의 public URL을 photo_url에 저장 | 같은 버킷·공개 URL 관례 재사용. 과거 URL을 재작성하지 않음 |
| 업로드 경로 | 신규 사진 `tmp-시간.ext`, 편집 사진 `recordId.ext`, upsert=true | 새 요청만 `recordId-사진요청UUID.ext`, upsert=false. 기존 파일명은 변환하지 않음 |
| AI | `/api/food-calorie?input=음식명` 서버 프록시 | 같은 API 재사용, 명시적 요청·중복 방지·제안값 분리 |
| 통계 | 기존 식비/칼로리/끼니/단식 제외 등 | 원래 통계 유지. 새 화면은 선택 날짜의 입력 식비/칼로리 요약만 |
| 공통 UI | MoaFrame/MoaDialog/SaveStatus/크림·세이지 토큰, 음식 아이콘 상수 | 같은 셸·저장 피드백·식사/장소 라벨 재사용 |

기존 사진의 식별 근거는 **저장된 `photo_url` 전체 문자열**이다. 기록 ID로 파일 경로를 역산하면 초기 tmp 경로나 외부 URL을 잘못 처리할 수 있다. 새 화면은 과거 URL의 호스트·경로·쿼리를 바꾸지 않고 그대로 읽는다.

기존 편집 업로드는 같은 `recordId.ext`를 다시 사용할 때 이전 사진을 덮어쓸 수 있다. 업로드 실패가 null을 반환해도 기존 입력 흐름은 DB 저장을 계속할 수 있어, 사진 연결이 null로 저장되거나 성공처럼 보이는 위험도 있었다. 새 화면은 업로드 확인 전 DB 쓰기를 시작하지 않는다. 기존 `/food`의 UI와 레거시 액션 전체를 전면 교체하지는 않았다.

### 확인할 수 없었던 제약

저장소에서 **food_records 최초 CREATE TABLE 및 food-photos 전체 생성/정책 SQL을 찾지 못했다**. 기존 타입·CRUD·변경 마이그레이션은 확인했지만, 실제 NOT NULL/default/Storage 정책을 운영 DB에서 조회하지 않았다. 따라서 사진만 저장할 수 있다고 가정하지 않고 기존처럼 **음식명을 필수**로 유지한다. 사진만 올렸을 때 저장 버튼은 비활성화되며 가짜 음식명을 생성하지 않는다.

기존 타입에서 amount는 number이고 미입력도 0으로 저장해 왔다. 이번에도 이 계약을 유지하며 UI는 양수 식비만 표시한다. 명시적 0원과 미입력의 영구 구분은 기존 모델만으로 불가능하다. dining_type의 coffee 허용 마이그레이션과 기존 4종 코드를 재사용한다.

## 3. 새 화면과 실제 버튼

개발 전용 **`/__moamoa-food`** → 기존 App/Auth/PlannerProvider 안에서 실제 제품 데이터/저장 액션을 사용한다. 샘플 fixture를 제품 모듈에서 가져오지 않는다. 프로덕션 기본 `/food`·홈·내비게이션은 교체하지 않았다.

| 버튼/입력 | 동작 |
| --- | --- |
| 기록 → 음식 | 새 개발용 음식 화면. 시간 분석/회고·일기/문화·음악/독서/건강 연결 유지 |
| + 음식 기록 / 빠른 기록 | 모바일 바텀시트·PC 모달. 제목만으로 가능, 사진 선택 |
| 사진 추가/변경 | 실제 file chooser. JPEG/PNG/WebP/GIF/AVIF/HEIC/HEIF, 10MB 이하. 새 파일만 선택하며 원본 Storage를 수정하지 않음 |
| 사진 연결 해제 | 저장 후 그 행의 photo_url만 null로 변경. Storage 원본은 유지 |
| 저장 | 제목/날짜/숫자 검증 → 선택 업로드 확인 → 서버 행 확인 → 목록 반영 |
| 수정 | 같은 ID의 변경 필드만 저장. 숨은 영양/기존 맛 메모/알 수 없는 서버 컬럼을 덮어쓰지 않음 |
| 삭제 | 확인 시트에서 기록만 삭제하고 서버 부재 확인. 파일은 삭제하지 않는다고 명시 |
| 이전/다음 날짜, 오늘, 날짜 선택 | 선택 일 이동. 사용자 로컬·dayEndHour의 논리적 오늘 사용 |
| 아침/점심/저녁/간식 | 같은 원본 행의 끼니 필터. 신규 입력은 선택 끼니 또는 기존 화면과 같은 현재 시간대 기본값 |
| 갤러리 보기 | 선택 월의 사진 연결 기록을 날짜별로 모음. 이전/다음 달·월 선택 가능. ID 복제 없음 |
| 상세 보기 | 사진 원본 비율 표시, 입력된 식비·칼로리·평가·메모·기존 영양 정보. 사진 실패 시 같은 URL로 다시 불러오기 |
| AI 칼로리 제안 | 음식명 텍스트만 서버 프록시에 명시적 요청. 결과는 별도 제안 카드, 입력에 사용은 별도 클릭 |
| 취소 | 저장 중 닫기 방지. 변경된 초안은 확인 후 닫기. 저장 불확실 상태의 닫기에는 재시도 권장 안내 |
| 음식 기록 다시 불러오기 | 실패 시 확인된 목록을 유지하며 재조회. 조회 실패를 빈 기록이라고 표시하지 않음 |
| 기존 음식 화면·통계 | `/food`로 이동. 원래 화면/Provider 데이터 유지도 브라우저에서 확인 |

등록/수정 성공 후 해당 날짜의 **전체 목록**을 연다. 갤러리에서 제목만 저장했거나 끼니 필터와 다른 기록을 저장해도 결과가 숨겨지지 않는다. 단식 기존 기록은 조회·삭제 가능하며 편집은 기존 화면으로 안내한다. 단식 생성/통계 정책을 새로 만들지 않았다.

## 4. 사진·저장 안정성

1. 초안의 기록 UUID와 파일 선택별 사진 UUID를 고정한다. 기존 행 편집에서는 원래 ID를 유지한다.
2. 새 파일에 대해서만 안전한 새 경로를 만든다. SDK `upload(..., {upsert:false})`로 원본을 덮어쓰지 않는다. 파일명 확장자는 허용 MIME에 맞추고 원본 파일 내용을 업로드한다.
3. 업로드 응답의 경로를 확인한다. 업로드 응답 유실 후 같은 경로가 이미 있으면 **그 새 요청 경로만** 다운로드하여 SHA-256이 선택 파일과 같은지 확인한다. 다른 바이트이면 중단하며 덮어쓰지 않는다.
4. 업로드를 확인한 뒤 create/update 확인 저장을 실행한다. DB 실패 시 업로드 URL을 같은 요청의 메모리에 보관해 명시적 재시도 때 재업로드하지 않는다.
5. 확인된 행만 Provider에 반영한다. 반복 클릭은 공통 SaveCoordinator가 합치고, 생성은 같은 PK로 DO NOTHING 후 내용 확인한다.
6. 수정은 UI를 열었을 때 기준선과 변경한 필드만 비교해 전송한다. 다른 기기에서 바꾼 무관한 메모/컬럼을 덮어쓰지 않는다. 무변경 저장은 최신 서버 행을 다시 확인해 보여준다.
7. 삭제는 DB 행 삭제와 서버 부재 확인까지만 수행한다. **Storage remove는 호출하지 않는다.** 공유 사진, 과거 외부 링크, 파일 소유권을 확정할 수 없기 때문이다. 사진 교체/연결 해제 때도 이전 객체를 남긴다.

업로드 중 / 업로드 확인 후 DB 저장 중 / 실패 / 확인 성공을 구분한다. 실패하면 제목·식비·파일·미리보기를 유지하고 재시도한다. 401/403 등 영구 오류는 공통 정책대로 재시도를 노출하지 않는다. 미리보기 object URL은 파일 교체/시트 종료 시 해제하지만 Storage 파일은 건드리지 않는다.

### 보존에 따른 제한

Storage와 DB 쓰기는 하나의 트랜잭션이 아니다. 업로드 성공 후 DB 실패/입력 취소/사진 교체/기록 삭제로 **미참조 파일이 남을 수 있다**. 오류 처리에서 불확실한 파일을 자동 삭제하지 않는다. 정리가 필요하면 기존 참조·공유 링크와 소유권을 조사한 별도 검토/승인이 필요하다. 이 단계에서 파일 정리나 데이터 마이그레이션은 하지 않았다.

음식 사진의 기존 public URL 관례를 유지했다. 공개/비공개 전환, signed URL 도입, Storage 정책 변경도 하지 않았다. HEIC 표시 가능 여부는 브라우저에 달려 있고, 표시 실패 시 원본 연결을 유지한 채 안내한다.

## 5. AI와 키 검토

- AI 없이 저장할 수 있고 추정 중에도 기본 저장을 막지 않는다. 자동 호출·Enter에 의한 추정은 추가하지 않았다.
- 같은 입력은 시트 안에서 캐시하고 진행 중 클릭은 합친다. 입력 변경/닫기는 요청을 취소하고 오래된 응답은 무시한다. 이미 시작된 외부 서버 작업의 비용까지 취소한다고 주장하지 않는다.
- 제안값과 기록 입력값은 별도다. 사용자가 **입력에 사용**을 눌러야 칼로리 필드에 들어가고, 이후 수동 수정 가능하다. API 오류는 수동 입력/미입력 저장으로 복구한다.
- 기존 DB에는 칼로리 출처 컬럼이 없다. 저장 후 재조회한 숫자의 AI/수동 출처는 구분할 수 없으므로 상세에서는 어느 쪽이라고 단정하지 않는다. 영구 출처 구분이 필요하면 nullable calorie_source/추정 메타데이터 등의 별도 모델 검토가 필요하다. 메모에 숨긴 메타데이터나 가짜 데이터를 넣지 않았다.
- 서버 프록시는 **OPENAI_API_KEY 우선 + 기존 VITE_OPENAI_API_KEY fallback**으로 호환성을 유지한다. 서버는 키를 응답에 포함하지 않는다. 실제 키·환경변수를 읽거나 변경하지 않았다.
- VITE_ 이름은 클라이언트 수집 대상이므로 서버 파일에서 참조한다는 이유만으로 안전하다고 가정할 수 없다. Vite 설정에서 기존 음식 서버 키 2종(VITE_OPENAI_API_KEY/VITE_FOOD_API_KEY)을 브라우저 env 객체에서 제외했다. 프로세스/운영 환경변수는 바꾸지 않는다.
- 개발 여부를 App의 정적 DEV 값으로 Provider에 전달해 훅이 전체 env 객체를 소비하지 않게 했다. 시간 집계·실적 모델 변경이 아닌 브라우저 환경 노출 방지다.
- 가짜 키만 넣은 개발 모듈 변환 및 Production 빌드에서 키 미포함을 자동 검증했다. 운영 배포의 실제 설정/과거 노출 여부는 확인하지 않았다. 운영 설정을 새 서버 전용 이름으로 바꾸거나 키 회전을 판단하는 작업은 별도 승인 범위다.
- 기존 `/api/food-nutrition`, TMDB/YouTube/Kakao 코드는 변경하지 않았다. 새 음식 화면은 식약처 검색을 새로 구현하지 않으며 기존 화면의 기능을 유지한다. AI에 사진·Storage 경로를 전송하지 않는다.

## 6. 시간 분석 UI만 정리

- 모바일 기록 메뉴는 한 줄 가로 스크롤 탭. 페이지 전체 가로 넘침과 구분하여 의도된 메뉴 스크롤만 허용한다.
- 보이는 날짜/기간 라벨은 하나로 줄이고 옆 44px 달력 영역에 native date/month 입력을 배치했다. 이전/다음·오늘은 유지한다.
- 긴 설명은 **직접 기록한 시간만 모아요**와 펼칠 수 있는 집계 기준 도움말로 정리했다.
- 기존 실제 스크롤 viewport와 하단 dock 분리를 재사용했다. 390/1440px에서 콘텐츠 viewport 끝이 빠른 기록 버튼 위에 있는지 자동 검사했다. 음식에서도 같은 안전 영역을 사용한다.
- `timeAggregation.ts`, `useTimeReport.ts`, 활동 데이터 모델/SQL 초안, 목표 진행률 로직은 수정하지 않았다. 기존 일·주·월·자정·ISO·중복/미분류 회귀 테스트를 유지한다.

## 7. 접근·캡처

[스크린샷 목록](screenshots/moamoa-food/README.md): **40장**, 390×844 / 1440×1024 실제 Chromium. 고정 2027-01-01 Asia/Seoul은 테스트 날짜이며 제품 날짜는 사용자 로컬/논리적 날짜다. 개인정보 대신 직접 만든 샘플 식사 이미지와 메모리 행만 사용한다.

격리 시연:

```sh
TZ=Asia/Seoul MOA_REVIEW_PORT=5177 node scripts/test/serve-moa-today.mjs
# http://localhost:5177/__moamoa-food
# /__moamoa-records, /__moamoa-today, /__moamoa-todos도 동일한 시연 Provider
```

상단에 메모리 샘플·새로고침 시 초기화를 표시한다. 실제 DB/Storage 자격증명은 사용하지 않는다. 사진은 로컬 시연 서버의 메모리만 사용하며 새 업로드/표시를 실제로 눌러 확인했다. AI 프록시는 격리 시연에서 503을 반환해 외부 AI를 부르지 않는다. 수동 저장은 가능하다. 메모리 시연을 실제 영구 저장이라고 표현하지 않는다.

## 8. 검증과 파일

| 검사 | 결과 |
| --- | --- |
| 시작 소스 재검증 | 단위 152 / 브라우저 68 전부 통과 |
| 변경 후 단위 | **158/158** (기존 152 + 음식 codec/조회·사진·확인 CRUD 6) |
| 전체 브라우저 | **83/83** (기존 68 + 음식 13 + 서버 API 1 + 키 비노출 1) |
| 최종 음식 UX 보완 후 | `food-complete.tap`로 음식 13개 추가 재검증 |
| Production 빌드 / 폰트·색상 / diff | 통과. 색상 baseline 379 유지, 폰트 위반 0 |
| 기존 render:check | 21장, FAIL 0 / WARN 21(기존 라벤더 안내). 기존 일부 팝업 스킵은 미검증으로 남김 |
| 새 실제 화면 | 목록/상세/추가/수정/갤러리/사진/저장 실패/AI/오프라인/긴 제목/로딩/빈 상태 및 시간 UI |
| 격리 시연 smoke | 현재 날짜의 기존 사진·새 업로드 이미지 디코드·AI 미사용 수동 저장·390/1440px 확인 |
| TypeScript | 독립 tsconfig/typecheck 명령 없음. Vite/esbuild 변환·빌드를 독립 타입 검사라고 부르지 않음 |

음식 테스트는 식비/평가 입력, 사진 추가/변경 file chooser, 제목만 생성, 사진만 저장 차단, URL/ID/영양/맛 메모/알 수 없는 서버 컬럼 보존, 업로드 실패·응답 유실·DB 응답 유실·중복 클릭, 원본 공유/연결 해제/삭제 후 객체 유지, AI 오류/캐시/대기 중 수동 저장, 날짜/식사/갤러리, Realtime/조회 실패/다른 기기 편집/Provider 재마운트, 기존 `/food` 이동, 시간 합계와 하단 배치를 포함한다.

개발 중에는 새 도움말 summary 때문에 기존 시간 테스트의 범용 summary 선택자가 2개를 선택했다. 겹침 안내 summary를 명시적으로 선택하도록 수정했으며 집계 기대값/검증은 유지했다. 개발 환경 키 검증 하네스의 종료 문제는 의존성 사전 탐색 없이 실제 Vite 모듈 변환을 검증하도록 고쳤다. 테스트를 삭제하거나 수치 기대값을 완화하지 않았다.

주요 파일:

| 파일 | 역할 |
| --- | --- |
| `src/app/components/moamoa/MoaFoodRoute.tsx`, `MoaFoodEditor.tsx`, `MoaFoodImage.tsx`, `food.css` | 새 음식 목록·월 갤러리·상세·입력·사진 오류/저장 상태 |
| `MoaRecordsNav.tsx`, `MoaRecordDateBar.tsx`, `MoaTimeAnalysisRoute.tsx`, `time.css`, `MoaFrame.tsx` | 기록 탐색/날짜 UI 공통화·모바일 정리 |
| `src/lib/foodRecords.ts`, `foodPhotos.ts`, `db.ts`, `src/app/store.tsx` | 기존 codec·테이블·Storage 재사용, 확인 액션·원본 보호·Realtime |
| `src/app/hooks/useFoodCalorieEstimate.ts`, `api/food-calorie.ts` | 선택 AI 제안과 서버 키 호환 |
| `src/app/App.tsx`, `hooks/useActivityStorage.ts`, `vite.config.ts`, `routes.tsx` | 개발 경로·env 수집 보강. 인증 정책/기본 라우트는 유지 |
| `foodRecords.test.ts`, `scripts/test/moa-food.test.mjs`, `food-calorie-api.test.mjs`, `food-client-env.test.mjs`, fixture | 격리 DB/Blob/서버 API·렌더 검증 |

명령과 원본 로그는 `/workspace/moamoa-backups/step3b4a-validation/`에 보관한다.

```sh
node_modules/.bin/esbuild src/lib/*.test.ts --bundle --platform=node --format=esm --out-extension:.js=.mjs --outdir=/workspace/moamoa-backups/step3b4a-validation/unit
node --test /workspace/moamoa-backups/step3b4a-validation/unit/*.mjs
node --test --test-concurrency=1 scripts/test/*.test.mjs
npm run build
npm run lint:fonts
npm run lint:colors
HAON_CHROME=/usr/bin/chromium npm run render:check -- --route=daily,todos,calendar,goals
git diff --check
```

## 9. 운영 적용 전 남은 제약

- 실제 Supabase 테이블 제약·RLS·public bucket 접근·업로드/다운로드·Realtime publication·복수 기기 종단 검증은 하지 않았다. 운영 데이터 대신 메모리 전송/파일과 API mock을 사용했다. 승인된 격리 환경에서 먼저 검증해야 한다.
- 새 기능을 위해 DB/Storage 정책 변경이나 신규 SQL을 추가하지 않았다. 기존 운영 기능의 기본 경로도 교체하지 않았다. 개발 경로 공개·운영 적용·배포는 별도 승인 대상이다.
- 사진만 등록, 0원/미입력 구분, 영구 칼로리 출처 구분은 현재 확인된 모델로 보장하지 않는다. 스키마 검토안을 먼저 결정해야 한다.
- 사진 객체는 보존하므로 미참조 파일이 남는다. 파일 정리는 별도 검토 대상이다. 과거 사진/행의 일괄 변환·초기화는 하지 않았다.
- 재시도 ID/파일 초안은 현재 화면 메모리 범위다. 오프라인 영구 저장·새로고침 후 미저장 초안 복구는 지원하지 않는다. 같은 필드를 동시에 바꾸는 경우 기존 공통 저장 정책처럼 마지막 쓰기가 우선한다.
- 기존 FoodView의 낙관적 레거시 저장/업로드 액션은 보존했다. 이번 확인 저장 보강이 모든 레거시 음식 입력 경로를 교체한 것은 아니다.

## 10. STEP 3B-4B 추천

1. 문화·음악·독서 기존 ID/DB/API/사진·표지·구절 모델을 먼저 대조한다. Food와 같은 기록 셸·한 줄 탭·최소 입력·확인 저장 패턴을 확장한다.
2. CultureRecordView의 수동 영화/드라마/YouTube 기록·별점/리뷰를 먼저 연결하고 TMDB/YouTube 오류에도 직접 입력할 수 있게 한다.
3. MusicSection의 현재 데이터/섹션 전환을 유지하며 짧은 감상과 기존 음악 입력 흐름을 연결한다.
4. BooksView의 Kakao 검색·독서 상태·구절을 동일 ID로 옮긴다. 검색/표지 실패를 기본 기록의 실패로 처리하지 않는다.
5. 선택 AI는 저장과 분리하고, 기존 미디어 파일의 덮어쓰기/공유/삭제 정책부터 확인한다. 이번에는 해당 화면·데이터·API를 변경하지 않았다.
