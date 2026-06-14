# PROJECT_SPEC.md — My Planner PWA 기능 명세서

> 최종 업데이트: 2026-06-14 (**컨디션 탭 기록 영역 — 날짜 필터 / 검색 / 빈날 넛지 + 커스텀 증상 추가** — `ConditionTab.tsx` 기록 리스트 영역을 상태 기반으로 재구성. **날짜 필터**: `selectedDate` 초기값을 오늘(로컬)로 시작, 주간 셀·이번달 히트맵 칸 클릭(`<button>`, `toggleDate` 재클릭/칩 × 해제, 선택칸 `t.danger` 보더 + `0 0 0 2px` 코랄 링, 오늘 `t.accent`보다 우선)으로 그 날짜 기록만 필터. 30일 추이 선그래프는 보기 전용. **필터 칩/힌트**: 선택 시 `M월 d일 ×`(`t.dangerLight`/`t.danger`) 또는 오늘이면 "오늘은 …" 빈 날 넛지 카드, 미선택(`null`)이면 "전체 기록 · 최신순" 힌트. **검색**: 기록 헤더 우측 돋보기 토글로 검색바 펼침/접힘(autoFocus, 본문·증상·레벨 라벨 텍스트). 검색·날짜 필터 상호 배타(검색 열 때 `selectedDate=null`, 날짜 클릭 시 검색 닫힘+비움), 결과 0이면 "검색 결과가 없어요". **빈 날 넛지 → 기존 입력 카드 재사용**: `openRecordFor(d)`=`resetForm`+`setDate(d)`+`setInputOpen(true)` — 새 입력 UI 없이 컴포넌트 내 인라인 입력 카드에 prefill, `formRef.scrollIntoView({block:'nearest'})`로 노출. **반응형**: `lg:` 클래스 0건 변경, 단일 반응형 컴포넌트라 PC(히트맵+추이 2열) 보존·모바일(주간→증상→히트맵→추이→기록) 세로 스택. **커스텀 증상 추가 + 재사용 칩 (Stage 1~3)**: 마이그레이션 `20260614020000_create_user_symptoms.sql` 적용 — `user_symptoms(id text PK, name text, name_norm text UNIQUE, created_at)` + owner uid 하드코딩 RLS(단일 사용자 패턴, 컨디션과 동일) + Realtime publication. `src/constants/symptoms.ts` `normalizeSymptom(s)`(`trim+/\s+/→' '+lower`) + `getSymptomOptions(custom)`이 정규화 기준 기본 중복 자동 배제. `db.userSymptoms.fetchAll/add`(정규화 사전 조회 + UNIQUE race 방어, 결과 `{ok,created}|{ok:false,reason:'duplicate',existing}|{ok:false,reason:'error'}`). `ConditionTab.tsx` 증상 영역에 점선 골드 **"+ 증상 추가"** 칩 → 클릭 시 인라인 input(autoFocus, maxLength 20) + [추가] + [×] (Enter/ESC 지원). `handleAddSymptom` ① 빈 값 무시 ② 화면 칩(기본+커스텀)에서 정규화 일치 → 그 칩 선택 + "OO은(는) 이미 있어서 선택했어요" 안내(3초 후 자동 사라짐) ③ 신규면 DB 저장 + 즉시 선택 + 칩 풀 영구 등록. 커스텀 미선택 칩은 **점선 골드**(`1px dashed t.accent` + `color: t.accent`, `defaultNormSet`으로 기본/커스텀 구분), 선택 시 기본과 동일 코랄 강조. 통계·표시·검색 자동 편입(저장 컬럼 `symptoms text[]`에 칩 이름 그대로). `useRealtimeSync('user_symptoms')` 로 PC↔모바일 즉시 반영. `UserSymptom { id, name }` 타입 추가, "기타" 칩 유지, v1 범위 외: 커스텀 삭제/관리. 색 디자인 토큰만 사용, 하드코딩 0, `npm run build` 통과. 이하 **통합 빠른 입력(Quick Add) + Inbox 독립 화면 — Stage 0~3** — 한 입력창에 자연어로 적으면 파싱→기존 `addTodo`/`addEvent` 저장하는 "파서 한 겹"과, `date===null` 할일을 모으는 독립 `/inbox` 화면. **Stage 0**: `src/lib/quickParse.ts` `parseQuickEntry(input, now?)`→`ParsedEntry`(UI·store 무관 순수 함수). 토큰 `#태그`(복수)·`@프로젝트`(첫 매치)·단독/선두 `!`(isTop3)·반복(`매일`/`평일`/`매주 [요일]`)·날짜(`오늘`/`내일`/`모레`/`X요일`/`M/D`/`M.D`/`M월 D일`)·시간(`(오전|오후)? N시 (반|N분)?`/`HH:MM`/`N-N시` 범위). 날짜 토큰 우선→시간만 있으면 오늘→둘 다 없으면 `date=null`(Inbox). weekly 는 다가오는 요일로 `date` 를 맞춰 `recurrenceExpansion`(weekly=시작일 요일 기준)과 정합, `'weekday'`→Todo `'weekdays'` 매핑은 호출부. date-fns 재사용·데이터 모델 변경 0. `quickParse.test.ts`(`node:test`) 9건 통과. **Stage 1**: `QuickAddInput.tsx`(Inbox·전역 FAB 공용) — 입력 중 실시간 칩 미리보기([할일=그린/일정=블루]·[날짜 or Inbox]·[시간]·[반복]·[#태그=코랄]·[@프로젝트]·[중요], 토큰+`${color}1A`), 시간 감지 시 "일정으로?" 토글(addEvent↔addTodo, 시간 사라지면 자동 할일), 프로젝트 이름 매칭 실패 시 @토큰 제목 복원(무시), 태그 미존재 시 공통 팔레트로 생성 후 id 매핑, 저장은 기존 `addTodo({...,status:'active'})`/`addEvent` 그대로, `defaultDate` 폴백, "자세히"→기존 모달. 부수: `src/lib/tagPalette.ts`(13색 팔레트/localStorage 단일화, TodoModal import), `addTag`→`Tag` 반환(하위 호환), `TodoModal`/`EventModal` `initial*` prop(제목·시간·태그·중요·반복 prefill). **Stage 2**: `InboxView.tsx`+`/inbox` — `date===null && status∉{backlog,cancelled}`(완료 접기), 헤더+상단 `QuickAddInput(defaultDate=null)`+항목 카드(체크 동그라미·메타 칩·triage `[오늘][내일][날짜][완료][삭제]`→`updateTodo`/`deleteTodo`), 최신순(created_at reverse), 빈 상태, PC max-w 760·모바일 sticky 입력·44px 터치. **Stage 3**: `src/lib/inbox.ts`(`isInboxCandidate`/`countInboxActive`)로 카운트 단일화, PC 사이드바(A/B/D)·모바일 햄버거 오버레이·테마 C 상단 네비에 미정리 카운트 배지(0 이면 숨김, store todos 의존 Realtime). 색 토큰만·PC 레이아웃 보존·기존 모달/반복 분기 무손상·`npm run build` 통과. 이하 산책(Walk) 모듈 신설 — Phase 0~3 — 좌측/모바일/테마C 메뉴 🚶 '산책'(`/walk`). 걸은 길을 GPS로 기록하고 끝낼 때 사진·경로·손글씨로 "거의 일기 같은" 완료 기록 카드를 남긴다. **Phase 0(스캐폴딩)**: `walk_sessions` 테이블(`20260614000000`, mode `free|course|repeat`·`path`/`planned_route` jsonb·거리/시간/페이스·`start_lat/lng`·`region_code`·`photo_url`/`memo`/`route_name`/`is_saved_route`, RLS 본인·Realtime) + `walk-photos` 버킷(`20260614010000`) + `db.walkSessions` 데이터레이어 + `walkUtils`(하버사인·누적거리·페이스·`routeProgress`)·`useWalkData`(Realtime). **Phase 1(자유 산책)**: `useWalkTracker`(watchPosition 고정밀 + 정확도45m·이동4m 필터·권한거부/신호약함/일시정지) + `useWakeLock`(화면유지·미지원 폴백) + `FreeWalkSession`(카카오맵 코랄 폴리라인 실시간·현재위치 팬·키없으면 글리프 폴백) + `RouteGlyph`(path 정규화 SVG 글리프) + `CompletionCard`(사진 walk-photos·카드 배경 + 미니맵 + 지표 + 손글씨 Nanum Pen → insert + region_code + 모먼트 씨앗 토글) + `WalkRecordDetail`(한 장 카드·메모수정/삭제). 1E 건강연동은 '걷기' 유산소 종목 부재로 스킵. **Phase 2(코스 산책)**: `CourseSetup`(출발=현재위치/검색·도착=카카오 검색/저장장소) + `CourseWalkSession`(출발·도착 dot + 참고직선/ORS 점선 + 진행도[직선대비 남은거리·%] + 도보 길찾기 `/link/by/walk`) + `lib/routing.ts`(OpenRouteService foot-walking, `VITE_ORS_API_KEY` 선택). 종료→완료카드(mode:course, planned_route). **Phase 3(내 코스 다시)**: `RepeatPicker`(저장코스 우선/전체, 목표=planned_route 우선) + `RepeatWalkSession`(목표 회색 점선 + GPS 트래킹 + 진행도=최근접 목표점 누적거리 비율) → 새 세션 저장(mode:repeat, planned_route=원본 보존) + `WalkRecordDetail` '코스로 저장'(이름→is_saved_route). 카카오 SDK/길찾기 링크는 가고싶은 곳 인프라 재사용, 외부 API 최소(지도 카카오 JS키·GPS 브라우저 기본·ORS 선택), 색 토큰만(코랄=accent), 전체화면 오버레이로 PC/모바일 공용(기존 PC 무영향). 이하 통합 일기 **Stage 1-V 음성 입력** — '오늘 일기' 작성에 음성 입력 추가. 동작: 녹음 시작→침묵에도 끊기지 않고 **연속 녹음**(자동 종료 로직 없음)→사용자가 **중지** 시 그때 오디오를 한 번에 STT 변환해 본문 **커서 위치(없으면 끝)**에 삽입(자동 확장 따라감, 실시간 부분표시 X). 구현: `useVoiceRecorder` 훅 — `getUserMedia({audio:true})`(사용자 제스처 내) + `MediaRecorder`(timeslice 없이 연속) + iOS 호환 mime 선택(`MediaRecorder.isTypeSupported` 우선순위 `audio/mp4`→`webm;opus`→`webm`→`ogg`) + `AudioContext`/`AnalyserNode`(파형용). 중지 시 chunk → Blob → `transcribeAudio`(`src/lib/transcribe.ts`)가 `supabase.functions.invoke('transcribe', {body: FormData})` 호출. **Edge Function `transcribe`**(신설, 배포 완료 v1, `verify_jwt:true`): FormData 오디오 받아 OpenAI Whisper(`whisper-1`, language=ko)로 변환→`{text}` 반환, **STT 키는 `OPENAI_API_KEY` secret**(클라 노출 0), 25MB 방어, **오디오 원본 미저장**(변환 후 폐기). UI(토큰만, coral): **PC** 작성 툴바 좌측 '음성으로 쓰기' 버튼(녹음 중 점멸+경과시간, 다시 누르면 중지→변환). **모바일** 작성칸 우하단 **플로팅 마이크**→하단 **녹음 시트**(큰 마이크 + `AnalyserNode` 실데이터로 구동되는 **파형 막대**(`requestAnimationFrame`, 24막대) + 경과시간 0:00 카운트업 + '중지하고 변환' 버튼, dim 탭=취소·변환 중엔 탭 무시). 에러(권한 거부/네트워크/변환 실패) 친화 안내. `AutoGrowTextarea` forwardRef 전환(커서 삽입용). **⚠️ 동작하려면 Supabase 프로젝트에 `OPENAI_API_KEY` secret 설정 필요.** 이하 통합 일기 '오늘 일기' 탭 **재설계(diary_v3 목업 기준)** — 질문일기·이날의 기억 탭은 기존 구현 그대로 유지, '오늘 일기'(자유일기)만 PC/모바일 새 UI로 교체. **PC 2단**: 좌측 사이드(290px, `t.bgSub` 배경+우측 보더) 최근 일기 **타임라인**(세로 라인 + 골드 점 + 날짜·제목·발췌) / 우측 메인 날짜 헤더+달력 아이콘 버튼 + 작성/읽기 영역. **모바일**: 상단 **주간 날짜 스트립**(월~일 칩, 오늘 `t.accent` 테두리·선택 `t.danger` 채움, 작성한 날 골드 점, 미래 비활성, 가로 스크롤) + 날짜 옆 달력 아이콘 임의 점프 + 작성/읽기 + **최근 일기(접기/펼치기)** 카드. **작성 = A 모드**: 따뜻한 카드(`t.card`) + 옅은 점 질감(radial-gradient dot 7px, `${t.accent}1A`) 둥근 카드, 가로 밑줄 없음, 제목 input(선택·DM Serif·하단 보더) + 본문 textarea(개구) **자동 확장**(`useLayoutEffect`로 height='auto'→scrollHeight, overflow:hidden). **읽기 = D 모드**: 기록 있는 날짜/최근 항목 클릭 시 **줄 친 종이**(div, line-height=배경 줄 간격 32px 동일) 렌더 + 제목(DM Serif)·날짜·**수정 버튼**(→작성 A) + 삭제. 동작: 빈 날짜=작성(A) / 기록 있는 날짜=읽기(D) → 수정 시 A → 저장 시 다시 읽기(D). 저장 버튼(coral, rounded-full+그림자), `(entry_date,type='free')` upsert(title 포함), 작성 모드 자동저장(1.5s 안전망, 모드 전환 X). `db.diaryEntries.listFreeDatesBetween`(주간 스트립 점) 추가, `diary_entries` Realtime 구독 유지. 'my diary' 키커 = Caveat(`--font-script` 토큰 신규, fonts.css), 본문 개구(`--font-hand`) 한정, 색 하드코딩 0(골드=accent/코랄=danger/그린=success). 다른 페이지 레이아웃 무영향. 이하 운동 모듈 **Stage 1(모바일 UI)** — 건강(`HealthView`) 메뉴에 '운동' 탭 추가(수면/컨디션/몸무게/생리/운동 5탭, 모바일 `grid-cols-5`·PC `lg:flex` 무변경). `workout/WorkoutTab.tsx` — 스트릭 히어로(연속일수·마지막 운동일·제안=오늘 루틴 우선/없으면 가장 오래 쉰 부위) + 오늘의 루틴 카드(각 "기록 ›") + 부위별 마지막 운동(가장 오래 쉰 부위 coral 강조) + 종목별 성장(근력 무게 추이 인라인 SVG, 최근 한 달) + 오늘의 운동(목록·＋추가·지난 기록). 바텀시트 4종(공용 `SheetShell`): `ExercisePickerSheet`(기본=내 운동 2열 사진그리드+부위/타입 필터, 검색=전체 카탈로그, 카탈로그 채택 시 한글 별칭 입력→`db.workouts.adopt`가 공용행 대신 내 소유 복사본 생성), `RecordSheet`(근력 세트[무게×횟수]/유산소[시간·거리], 직전 세션 회색 prefill, ▶자세영상, 신규 insert·편집 update·삭제, XP는 신규 저장 시 TODO 훅), `RoutineSheet`(요일별 라벨+종목 CRUD, Picker 재사용), `HistorySheet`(performed_on 날짜 그룹·항목 탭→편집). `db.workouts` 데이터 레이어 + 타입(Exercise/WorkoutLog/WorkoutSet/RoutineDay) + Realtime 4테이블 구독. 색상 토큰만·런타임 번역 호출 0(종목명은 DB name_ko/name_en 만 읽음). 이하 운동 모듈 **Stage 0(DB only)** — 마이그레이션 `20260608010000_create_workout_tables.sql` 로 운동 5테이블 생성·적용: `exercises`(종목 카탈로그, user_id null=공용·name_ko null=미채택·type 근력/유산소·body_part 9종 CHECK·source/source_id) + `workout_logs`(세션) + `workout_sets`(근력 weight/reps·유산소 duration_min/distance_km) + `routine_days`(요일 1~7 헤더) + `routine_exercises` — 전 테이블 RLS(exercises select=공용 OR 본인·변경=본인만, 나머지 소유자/EXISTS)·Realtime·인덱스(performed_on/exercise·log·name_ko/en/body_part). free-exercise-db(퍼블릭 도메인) 873종목 import: type/body_part 매핑 딕셔너리·image_url=GitHub raw 핫링크(`<id>/0.jpg`, Storage 이관은 Stage 3)·name_ko 전부 null(카탈로그). 스타터 9종목 name_ko 채움(바벨 스쿼트/루마니안 데드리프트/바벨 힙쓰러스트/랫풀다운/벤치프레스/숄더프레스/러닝/사이클/요가[custom]). **런타임 번역 금지**(name_ko 한글화는 seed/채택 시점 1회만, 페이지 조회 시 번역 API 호출 안 함)를 마이그레이션 주석+`scripts/seed-exercises.mjs`에 명시. UI/컴포넌트/라우트/store 미변경. 이하 통합 일기 Stage 0·1 — **Stage 0(DB)**: 마이그레이션 `20260607030000_create_diary_and_journal_questions.sql` 로 `diary_entries`(자유/질문일기 `type` 통합, `entry_date`·`question_id` FK ON DELETE SET NULL·`question_text` 스냅샷·소유자 RLS·이날의 기억용 월/일 expression 인덱스·`type='free'` 하루 1개 부분 유니크) + `journal_questions`(기본 질문 공용 `user_id=null` + 나만의 질문 소유자, 12 카테고리 108개 seed) 생성·RLS·Realtime, Supabase 적용 완료. **Stage 1(UI)**: 신규 `/diary` 라우트 + 일기 메뉴 진입점(`PenLine`, 기존 `/question-journal` 미변경). `DiaryView` — 탭 3개(오늘 일기/질문일기/이날의 기억, 활성 탭 coral 언더라인, 질문일기·이날의 기억은 placeholder). 오늘 일기 탭(자유일기): 날짜 선택(투명 `<input type=date max=today>` 오버레이, 과거 작성/조회·미래 차단) + 노트 줄 배경 손글씨 textarea + 자동저장(debounce 1.5s)·수동 저장(coral) `(entry_date,type='free')` upsert + 최근 일기 7건 리스트. `db.diaryEntries`(fetchFreeByDate/listRecentFree/upsertFree/delete) + `DiaryEntry` 타입, `diary_entries` Realtime 구독. 손글씨 토큰 `--font-hand`(=Gaegu) 추가 — 본문에만 적용. 색 토큰만 사용(골드=accent/코랄=danger/그린=success), PC 중앙 단일 컬럼 max-w 600px. 이하 독서 페이지 자동 완독 + 독서밭 완독일 강조: 현재 페이지=전체 페이지 입력 시 자동 완독 전환·완독 탭 이동, 독서밭에서 finishDate 있는 날은 무조건 최진한 색+테두리 강조. 이하 음악 기록 Stage 2 — 문화 기록 안에 음악 섹션 통합. 이하 상세: `CultureRecordView` 상단에 상위 섹션 탭 [영상/음악](`SectionTabs`, 영상=기존 PC/모바일 트리 그대로 + 탭 1행만 추가, 음악 선택 시 단일 반응형 `MusicSection` 으로 early-return → 영상 PC 레이아웃 무변형). `MusicSection`: "음악"(DM Serif) 제목 + 코랄(=`t.danger`) 원형 추가 버튼, "지금 이 무드엔?" 셔플 카드(현재 무드 필터 기준 랜덤 곡 상세 오픈), 무드 필터 칩 가로 스크롤(전체+집중/위로/신날 때/드라이브/잠들기 전, `mood text[]` 포함 필터), LP판 그리드(모바일 2열·`sm:`3·`lg:`5, 8s 회전). 신규 `music/` 컴포넌트: `LpDisc`(비닐 radial-gradient + 동심원 groove, 중앙 라벨=앨범아트 원형 크롭/없으면 `t.accent` 폴백, 가운데 구멍 `t.bg`, `spinning` prop → `lpspin 8s` — 그리드는 항상 회전, 상세는 재생 중에만), `MusicAddSheet`(Stage 1 검색·추가 흐름을 바텀시트로 이동 — iTunes 검색→곡 선택→무드·장르·메모·듣기링크→`itunes_track_id` 중복 확인 후 insert), `MusicDetailSheet`(큰 LP + ▶/⏸ 재생[`preview_url` `<audio>`, 단일 인스턴스·언마운트 시 정지·없으면 회전만 토글] + 🎨 꾸미기[Stage 3, 비활성], 제목 DM Serif/아티스트/앨범·발매연도, 무드 태그 coral=`t.danger`+`t.dangerLight`·장르 태그 green=`t.success`, 듣기 버튼 — `listen_url` 있으면 직접 링크 + 항상 유튜브뮤직/스포티파이 제목+아티스트 자동 검색, 내 메모 `t.card`+골드 왼쪽 라인+저장날짜, 삭제 ConfirmModal, 닫기 X/핸들/바깥). `musicMoods.ts` 무드 상수 공통. `music_records` Realtime 구독. 색 역할 매핑 골드=`t.accent`/코랄=`t.danger`/그린=`t.success`(하드코딩 0, 비닐 검정/홈만 실물 표현 고정색). Stage 1 임시 `/music` 라우트·네비·`MusicRecordView` 제거. 이하 2026-06-06: 기간별 모드 Phase 1·2·3·4·5 추가 — **Phase 5**: 자동 롤업 + 🎯 목표 배지. `/할일`(TodosView TodoRow) 과 `/일간`(DailyView TodoRow) 메타 영역에 프로젝트 배지 다음으로 🎯 목표 배지(`t.accentLight`/`t.accent`, truncate + title 풀텍스트). `weeklyGoals` 를 store 에서 추가 destructure 후 `todo.weeklyGoalId` 로 조회. 자동 롤업은 별도 코드 변경 없음 — Phase 2 `periodProgress` 가 todos 전역 state 의존이라 어디서 toggle 해도 주간%→월간%→연간% 즉시 재렌더. backlog/cancelled 는 EFFECTIVE 필터로 분모 제외. 이하 Phase 1~4 — **Phase 1**: 마이그레이션 `20260606030000_todos_weekly_goal_link.sql` — `todos` 에 `weekly_goal_id text NULL` 컬럼 + FK `→ weekly_goals(id) ON DELETE SET NULL` + partial index. 한 할일 = 하나의 주간 정책으로 join 테이블 없이 한 컬럼만 추가. `Todo` 인터페이스 + `db.ts` TodoRow/toTodo/fromTodo 매핑(`weeklyGoalId`)도 함께. 기존 todos 영향 0. **Phase 2**: PC 캐스케이드 3열 — 신규 `PeriodCascadePC` 좌(연간+IdentityCard/ValuesCard) → 중(선택된 연간에 연결된 월간만) → 우(선택된 월간에 연결된 주간만). 선택 카드 골드 강조(border `t.accent` + bg `t.accentLight`). 신규 `periodProgress.ts` `weeklyRollup`(연결 todos done/total, 없으면 `weeklyGoal.done` 폴백) → `monthlyRollup`(하위 주간 합산) → `annualRollup`(하위 월간 합산). 카드 풋라인 `Layers/BarChart2` 역추적 N · XX% + `t.success` 진행 바. 연도 ◀▶ 네비. `MonthlyView` PC 트리는 `<PeriodCascadePC/>` 만 렌더(기존 4탭 헤더/콘텐츠 `hidden` 보존). **Phase 3**: 모바일 드릴다운 — 신규 `PeriodCascadeMobile` 상태 `Level = annual | monthly | weekly`. 월간/주간 단계 breadcrumb "← 2026년 · 연간 · 월간"(중간 단계 클릭 가능). 공용 `DrillCard`(footer prop) + 신규 `IdentityValuesCards.tsx` 추출(PC·모바일 공용). `MonthlyView` 모바일 트리 = `<PeriodCascadeMobile/>` 교체. **Phase 4**: 주간 카드 todos 인라인 — 신규 `WeeklyTodosInline` (PC 주간 카드 하단 / 모바일 DrillCard footer). 연결 todos 좌측 ○/✓ + 제목 truncate + 짧은 날짜 + × 인라인 표시(체크 토글 = `updateTodo({status})` → `/할일`·`/일간`·`/캘린더` 같은 레코드 즉시 동기화). 행 탭 = `TodoModal` 편집. "할일 추가" → `TodoModal(initialWeeklyGoalId, date=그 주 월요일)`. "기존 할일 연결" → `LinkExistingTodoModal`(검색·미연결 우선 정렬·반복 가상 인스턴스 제외·"연결됨" 칩). × = `weeklyGoalId=undefined` (할일 보존). `TodoModal` 에 `initialWeeklyGoalId` prop 추가, `buildChanges` 에 `weeklyGoalId` 자동 적용(편집 시 기존값 보존). UI 변경 0. 색상 토큰만 사용, 만다라트·다른 페이지 무영향. — 이하 만다라트 후속 PC 버그 수정: GoalsHubView 루트 `flex-1 overflow-y-auto`(데스크톱 `<main>` overflow-hidden 잘림 해소), 새 보드 추가 `window.prompt` → 인라인 입력(임베드 환경 차단 회피), culture `useToasts`/`ToastHost` 재사용한 저장/추가/삭제 토스트, 드롭다운 폰트 DM Serif Display → `var(--font-gowun)` 16/600(DM Serif 한글 미지원), 빈 셀에 "세부 추가"/"행동 추가" 라벨. 이하 2026-06-06: 레시피 모듈 D — 냉장고 ↔ 레시피 연결: D-1 매칭 헬퍼(`fridgeMatch.ts` — 정규화 + 양방향 부분일치 + 동의어 그룹 면↔파스타·국수, 계란↔달걀, 돼지↔삼겹살 등) + `RecipeListTab` 상단 두 섹션 `지금 만들 수 있어요`(주재료 전부 있음 ready / 1개 부족 oneMissing) · `유통기한 임박 재료 레시피`(D-2 이내 fridge 매칭, 'D-1 두부' 배지). 카드 `matchBadge` (✓재료있음 accentLight / 부족 bgSub / D-N dangerLight). 주재료 없는 레시피는 ready 섹션 제외, 임박 품목 0개면 임박 섹션 숨김. fridge_items Realtime 구독으로 즉시 갱신. D-2 `RecipeDetail` 재료 섹션 각 행에 있음/부족 칩 + `부족한 재료 N개 장보기에 담기` 버튼 — 정규화 비교로 미체크 shopping_items 중복 제외, 모두 있으면 비활성 + `이미 장보기에 있어요`. 담길 때 `source_recipe_id` / `source_label=레시피 제목`. fridge_items + shopping_items 양쪽 Realtime 구독. RLS는 Phase 2a 정책 그대로(마이그레이션 추가 없음). 모바일·PC 레이아웃 무영향, 색상 토큰만 사용. textarea PC 키보드 단축키: FridgeTab 빠른 입력 / RecipeFormSheet 붙여넣기·재료·요리순서 textarea에 Cmd/Ctrl+Enter 제출 추가(Enter=줄바꿈 유지, 단일행 input은 기존 form onSubmit). 이하 만다라트 Phase 1·2·3·4 추가 — **Phase 4**: 자유도(펼침) + 빈 칸 + 여러 보드. `computeProgress` 확장 — leaf 세부(자식 행동 0)는 `(is_done?1:0, 1)` 단위로 전체%/세부%에 포함. 모바일 SubCell leaf 모드: 체크 동그라미 + 메인 탭=`is_done` 토글, 우하단 "+ 펼치기" 칩 탭 = drill 진입(첫 행동 +로 생성). PC 둘레 블록 분기 재정의: 세부 없음·세부 leaf 두 경우 모두 단일 "+" 큰 버튼 블록(dashed)으로 표시, 펼친 세부만 9칸 블록으로 확장 → 강제 81칸 아님. PC SubPCCell leaf 모드: 미니바 자리에 체크 동그라미, 좌클릭=토글·우클릭=편집. 여러 보드는 Phase 1 의 드롭다운/추가/이름변경/삭제 그대로 활용. **Phase 1**: `mandalart_boards`/`mandalart_cells` 2개 테이블(소유자/EXISTS RLS, Realtime, `(board_id, parent_id, position)` 유니크 + ON DELETE CASCADE), 빈 결과 시 "나의 만다라트" 보드 자동 시드. `/goals` 상위 래퍼 `GoalsHubView` 도입 — eyebrow "structure your dream"(Nanum Pen Script) + 제목 "목표"(DM Serif Display) + 최상위 모드 탭 [만다라트 / 기간별]. "기간별" 선택 시 기존 `MonthlyView`(연간/분기/월간/주간) 그대로 렌더. `MandalartView` 는 보드 드롭다운 + 이름변경(인라인) + 보드 추가/삭제(ConfirmModal). `useRealtimeSync` 양 테이블 구독. 진행률 유틸 `computeProgress(cells)` 공용. Phase 2: 모바일(`lg:hidden`) 드릴다운 3×3 — 중앙 보기는 핵심 헤더 카드(전체% 바) + 9칸 grid(중앙=핵심 `t.accent`, 둘레=세부 8 이름+미니바+▸ 또는 점선 +). 세부 칸 탭 → 그 세부의 3×3(중앙=세부+%, 둘레=행동 체크). breadcrumb "← 핵심". 행동 탭 = is_done 토글(낙관적), 빈 칸 = 편집 모달, 채워진 칸 500ms 롱프레스/우클릭 = 텍스트 편집(비워서 저장=셀 삭제). Phase 3: PC(`hidden lg:block`) 9×9 클래식 — 외곽 grid repeat(3,1fr) gap 12 ⊃ 블록 grid repeat(3,1fr) gap 4(블록 gap > 셀 gap). 가운데 블록=핵심+세부 8, 둘레 8블록=각 세부의 행동 8 미러링. 모든 셀 aspect-ratio:1 + min-width:0 + line-clamp:2 + word-break → 어떤 폭에서도 겹침 없음, 보드 max-width 780px. 행동 좌클릭=토글·우클릭=편집, 핵심/세부 클릭=편집. 세부 없는 둘레 블록은 비활성 placeholder(Phase 4 토대). 색상은 기존 토큰(t.*)만 사용. 모바일·PC 트리 완전 분리 → 기간별·다른 페이지 무영향. 이하 2026-06-05: 레시피 모듈 Phase 1a + 2a — Phase 1a: `recipes`/`recipe_ingredients`/`recipe_steps` 3개 테이블(소유자 RLS, 자식은 EXISTS 기반, Realtime publication), `/recipes` 목록 페이지 + 직접입력 추가/수정 시트(이름·기준 인분·조리 시간·재료 한 줄에 하나·단계별 선택 타이머·출처/썸네일), 인분 환산·재료 라인 파싱 유틸. Phase 2a: `fridge_items`/`shopping_items` 테이블(소유자 RLS, Realtime; `source_recipe_id`는 Phase 3 대비 ON DELETE SET NULL로만 미리 둠), `RecipeView`를 모듈 셸로 재구성하고 모듈 내부 하단 탭 네비(레시피/냉장고/장보기) 도입 — 모바일은 글로벌 5탭 네비 위 `bottom:56px` 별도 탭바, PC는 헤더 우측 세그먼트 컨트롤. 냉장고 페이지: 요약(전체/임박 D-2/다 떨어짐), 카테고리 섹션(냉장·냉동·실온, 유통기한 빠른 순), 행별 D-day·수량 +/− 스테퍼(낙관적 업데이트, D-2 강조). PC 레이아웃 무영향, 색 토큰만 사용. 이하 2026-06-03: 문화 기록 Stage 4: 저녁 daily-report Discord 리포트에 "오늘의 문화 기록" 섹션 추가 — 독서 다음, 상태 아이콘·플랫폼 한글·별점(completed/dropped)·리뷰/인사이트 발췌(80자·최대 8개·1900자 방어), KST 경계 UTC 변환 조회, 빈 상태 섹션 유지. 명세는 `DAILY_REPORT_SCHEMA.md`. 이하 Stage 3 모바일 레이아웃: 햄버거 진입(기존), sticky 헤더(검색 토글·상태 가로탭·필터 트리거), 3열 포스터 그리드, 필터 bottom sheet(플랫폼/유형/정렬), full-screen 슬라이드업 추가/수정 모달(헤더 ←·저장, 상단 빠른 상태칩 즉시반영, TMDB 1열 리스트), 골드 FAB(safe-area), 로딩 스켈레톤 — 모두 `lg:` 미만 전용, PC 미변경. 이하 Stage 2: YouTube oEmbed 자동 채움(제목·썸네일·플랫폼/유형), TMDB 영화·드라마 검색 통합(`VITE_TMDB_API_TOKEN`), 카드 hover 상태 빠른 변경(optimistic+롤백+토스트), `external_source`/`external_id` 기록. 이하 2026-06-02: 문화 기록 페이지 `/culture` 신규 추가 — Stage 1 PC 레이아웃: 영화/드라마/예능/유튜브 등 시청 콘텐츠 기록. culture_records 테이블·RLS·Realtime, 포스터 그리드(6열 2:3), 플랫폼/유형/상태 칩 필터·검색·정렬, 0.5단위 별점, 추가/수정 모달. 이하 동일 2026-06-02: 캘린더 하단 상세 패널을 조회 전용 → 일간 동일 CRUD로 확장: 할일·일정 직접 관리(체크/수정/미루기/삭제), 반복 할일 표시·분기 삭제, 상단 필터 탭 연동. 이하 2026-06-01: 독서 진행 이력 reading_logs 테이블·자동 로깅 추가, 마이그레이션 타임스탬프 충돌 수정, 식단 카페 저장 버그 수정, 일간 할일 체크박스 모바일 탭 유실 수정, 반복 할일 인스턴스 동작 복구·수정 모달 개선, daily-report Edge Function에 일정·식단·감정·독서 섹션 추가)

---

## 1. 전체 페이지 목록과 각 기능

| 경로 | 컴포넌트 | 주요 기능 |
|------|---------|---------|
| `/` | → `/dashboard` 리다이렉트 | — |
| `/dashboard` | `DashboardView` | 통계 카드, 오늘 습관 체크, Top3 할일, 주간 진행률 |
| `/daily` | `DailyView` | PLAN/DO 타임라인, 스톱워치, 할일 CRUD, 타임라인 로그 |
| `/calendar` | `CalendarView` | 월/주/일 뷰, 필터 탭(할일·일정·습관·자기관리), 날짜 이동 |
| `/todos` | `TodosView` | 전체 할일 날짜별 그룹 / 미지정 할일 탭 |
| `/inbox` | `InboxView` | 빠른 수집함 — 통합 빠른 입력(`QuickAddInput`)으로 자연어 한 줄을 던지면 파싱→`addTodo`/`addEvent` 저장. `date===null` 할일을 모아 triage(오늘/내일/날짜/완료/삭제). 사이드바·모바일 네비에 미정리 카운트 배지 |
| `/weekly` | `WeeklyView` | 날짜 미지정 할일 패널, 일별 칼럼, 주간 목표, 요일 배정 |
| `/goals` | `GoalsHubView` | 최상위 모드 탭: **만다라트** / **기간별**. 만다라트는 보드 드롭다운 + 모바일 드릴다운 3×3 / PC 9×9 클래식. 기간별은 PC 캐스케이드 3열(연간→월간→주간) / 모바일 드릴다운 — 주간 카드 안에 연결된 todos 인라인 체크리스트 + "할일 추가"·"기존 할일 연결" |
| `/projects` | `ProjectsView` | 프로젝트 목록, 신규 프로젝트 생성 |
| `/projects/:id` | `ProjectDetailView` | 마일스톤 CRUD, 관련 할일 목록 |
| `/habits` | `HabitsView` | 습관 CRUD, 반복 설정, 5종 목표 유형 체크칩, 연속달성일, 월간 통계 / **루틴 탭**: 루틴 CRUD, 단계 체크 + 카운트다운 타이머, YouTube URL, 연속달성일 |
| `/routines` | → `/habits` 리다이렉트 | 기존 루틴 페이지 호환용 alias |
| `/selfcare` | `SelfCareView` | 운동/공부/뷰티 기록, 월간 통계 |
| `/reviews` | `ReviewsView` | 감정·감사·KPT·데일리리뷰, 주간/월간 리뷰 |
| `/food` | `FoodView` | 식단 기록 3탭(오늘/달력/통계), 영양성분 API 연동, 사진 업로드, 끼니별 단식 기록 |
| `/moments` | `MomentView` | 모먼트 로그 — 사진(최대 5장)+텍스트 작성·저장, 날씨 자동 기록, 최신순 카드 목록 |
| `/diary` | `DiaryView` | 통합 일기 — 탭 3개(오늘 일기/질문일기/이날의 기억). **오늘 일기**(diary_v3 재설계): PC 2단(좌 최근 일기 타임라인 / 우 작성·읽기) · 모바일(주간 스트립 + 작성·읽기 + 최근 접기). 작성=A 모드(줄 없음·점 질감·자동확장·**음성 입력**), 읽기=D 모드(줄 친 종이) + 수정 전환. 음성 입력(Stage 1-V): MediaRecorder 연속 녹음→중지 시 Whisper(Edge Function `transcribe`) 변환→본문 삽입(PC 툴바 버튼 / 모바일 플로팅 마이크+파형 녹음 시트). **질문일기**: 오늘의 질문 답변·질문 탐색 시트·지난 질문일기. **이날의 기억**: 1~5년 전 오늘 기록(5년 일기) |
| `/question-journal` | `QuestionJournalView` | 질문일기(기존) — 오늘의 질문 답변, 질문 탐색, 질문별 모아보기(5년 다이어리 스타일). ※통합 일기(`/diary`)로 대체 예정 |
| `/culture` | `CultureRecordView` | 문화 기록 — 상위 섹션 탭 **[영상 / 음악]**. 영상: 영화/드라마/예능/유튜브 등 시청 콘텐츠 기록(포스터 그리드, 칩 필터, 별점, 리뷰/인사이트). 음악(`MusicSection`): iTunes 검색으로 추가한 곡을 **LP판 그리드**(회전)로 보여주고 무드 필터·셔플·상세(미리듣기 재생) 제공 |
| `/recipes` | `RecipeView` (모듈 셸) | 레시피 모듈 — 내부 탭 네비(레시피/냉장고/장보기). **Phase 1a + 2a + D**: 레시피 직접입력 CRUD + 냉장고(요약·카테고리 섹션·D-day·수량 스테퍼) + 레시피↔냉장고 연결(목록 상단 `지금 만들 수 있어요`/`유통기한 임박 재료 레시피`, 카드 매칭 배지, 상세 재료 있음/부족 + `부족 재료 장보기 담기`) |
| `/places` | `PlacesView` | 가고싶은 곳 — 상단 탭 4개(뽑기·보관함·지도·기억, `?tab=` 쿼리). **Stage 2**: **보관함** — 모바일(전체/폴더 서브탭, 폴더 드릴다운) + PC(폴더 레일 + 3열 카드). 폴더 CRUD·정렬, 장소 CRUD, **여러 폴더 동시 소속**(다대다 picker), 미분류 `＋폴더 지정`. **Stage 3A**: **지도**(`MapTab`) — 카카오맵 SDK(`VITE_KAKAO_JS_KEY`, `services,clusterer`) + 저장 장소 핀(가고싶은=빈/다녀온=채움, 토큰색 SVG) + 클러스터러 + 테마 바(폴더=지도 테마) + 상세(길찾기·카카오맵 외부링크·블로그후기 placeholder) + **방문 완료→`place_visits` insert**. 장소 추가 폼(`PlaceFormSheet`)에 **카카오 키워드 검색→후보 선택→저장 시점 1회 지오코딩**(lat/lng·address·region_code·kakao_place_id·phone). 외부 API는 저장 시점만, 지도는 저장값만 읽음. **Stage 3B**: 인리치먼트 — Edge Function `enrich-place`(네이버 블로그 검색 5개·HTML 정리 + 선택 Haiku 요약, 호출자 JWT로 RLS, 저장 직후 1회·실패해도 저장은 성공) → `places.blog_reviews/ai_summary/enriched_at`(마이그레이션 `20260613010000`) 캐시. 상세 패널에 후기(블로거·제목·새탭 링크)+AI 요약, 미인리치 시 자동 1회 시도·"불러오는 중…"·다시 찾기. 외부 API는 저장 시점만(지도 조회 재호출 0). 기억은 placeholder(Stage 5). **Stage 4**: **뽑기**(`DrawTab`) — 테마(폴더) 칩(아무거나=전체)으로 후보 풀 좁히고 한 곳/코스 + 이동수단(선택) 고른 뒤 **내 저장 풀에서만** 가중 추출(안 가본 곳·오래된 저장 약하게 우대, 외부 API 0). 결과: 한 곳 카드(이모지·테마칩·"왜 이 곳?" Nanum Pen 손글씨 템플릿[memo→concept풀→일반, 변형]·블로그 1줄·길찾기/지도/다시) / 코스(하버사인 근접 2~3스톱 가까운 순 동선·경유 길찾기). 길찾기는 카카오맵 URL 링크만(`link/to`·`link/by/{walk|traffic|car|bicycle}`). 후보 0 시 보관함 유도. `drawUtils`(haversine·가중치·이유 템플릿). **Stage 4-0**: 방문완료 **취소** 토글(`placeVisits.deleteByPlace`, 핀 복귀·히트맵 -1). 뽑기 외부 API 0. **Stage 5**: **기억**(`MemoryTab`) — `place_visits` 시도별 집계를 한국 17시도 SVG **초이플레스**(`KoreaHeatmap`, `krMap.ts` path id=region_code)로 색 농도(0/1~2/3~5/6~9/10+ 토큰 버킷 bgSub→accent→danger). 핀치·팬·탭(viewBox)+시도 줌+전체보기, 선택 시 그 지역 다녀온 곳(모바일 하단시트/PC 사이드패널), PC 상시패널=총계·랭킹막대·최근 발자국, 빈 상태 안내·region_code null=미분류. 카카오 SDK 아님·외부 API 0, 방문완료/취소 Realtime 즉시 반영. **v1 4탭 완성**. `usePlacesData` 훅(4탭 공용) + `place_*` 4테이블 Realtime |
| `/walk` | `WalkView` | 산책 — 상단 탭 4개(자유·코스·내 코스 다시·기록). 걸은 길을 GPS로 기록하고 끝낼 때 사진·경로·손글씨로 완료 기록 카드를 남긴다. **자유**: 시작 CTA→`FreeWalkSession`(카카오맵 코랄 폴리라인 실시간·거리/시간/페이스·Wake Lock). **코스**(`CourseSetup`→`CourseWalkSession`): 출발(현재위치/검색)·도착(카카오 검색/저장 장소) 지정→마커+참고직선(또는 ORS 도보 점선)+진행도+도보 길찾기. **내 코스 다시**(`RepeatPicker`→`RepeatWalkSession`): 저장/과거 코스 목표 경로 점선 따라 걷기. **기록**: 지난 산책 목록(미니맵 글리프/썸네일)→상세(`WalkRecordDetail`, 메모수정·삭제·코스로 저장). 종료 시 3모드 공통 `CompletionCard` 저장. `useWalkTracker`/`useWakeLock`/`RouteGlyph`/`walkUtils` 공용, `useWalkData`(walk_sessions Realtime) |

> 참고: `BrainstormView.tsx`, `BacklogView.tsx` 파일은 남아 있지만 현재 `routes.tsx`에는 연결되어 있지 않다.

### 1-1. 페이지별 상세 기능

#### `/daily` — 일간 뷰
- 날짜 이동 (전후 화살표, 오늘 버튼)
- 할일 목록 (상태별: 예정/진행중/완료/미루기/취소)
- Top3 중요 할일 표시
- `+ 추가` 드롭다운 메뉴 (할일 추가 / 일정 추가)
- 타임라인: PLAN(계획) / DO(실행) 블록
  - 블록 드래그로 이동/리사이징
  - 스톱워치 → 자동으로 DO 시간 기록
- 현재 시간 지시선
- 이벤트(일정) 블록 표시
- 타임라인 로그 (생각/감정 기록)
- 시간대 설정 모달 (전역 저장)
- 할일 추가/편집 모달
- 우클릭 컨텍스트 메뉴 (상태 변경)
- 미루기 모달

#### `/calendar` — 캘린더
- 월별 뷰: 7×7 그리드, 칩 표시(최대 4개 + 오버플로우)
- 주별 뷰: 일별 PLAN/DO 블록 타임라인
- 일별 뷰: 미니 타임테이블
- 헤더 `+ 추가` 드롭다운 (할일 / 일정 생성)
- 필터 탭: 전체 / 할일 / 일정 / 습관 / 자기관리
- 날짜 클릭 → 하단 상세 패널에 그 날짜의 항목 표시
- **하단 상세 패널**: 할일/일정/습관/자기관리/메모 섹션(divider 구분), 상단 필터 탭과 일관 동작
  - 반복 할일 포함 표시, 할일 완료 체크·수정·미루기(→ 다음날)·삭제 직접 가능(일간 핸들러/모달 재사용)
  - 반복 할일 삭제는 "이 항목만/이후/전체" 분기 모달, 일반 할일·일정은 확인 팝업
  - 일정은 완료 개념 없어 수정/미루기/삭제만 제공

#### `/weekly` — 주간 뷰
- 날짜 미지정 할일 목록
- 요일 배정 팝오버 (미지정 할일 → 특정 날 할일 배정)
- 일별 칸반 칼럼 (요일별 할일 + 완료율 표시)
- 할일 카드 드래그앤드롭으로 날짜 이동 (@dnd-kit)
  - 드래그 중 카드 반투명 + 드롭 영역 강조 + "여기에 놓기" 표시
  - 드롭 시 `updateTodo` → Supabase 즉시 저장
- 주간 목표 CRUD

#### `/todos` — 할일 페이지
- 탭1 "전체 할일": 날짜별 그룹 (오늘/내일/요일 레이블), 완료 항목 접기/펼치기
- 탭2 "미지정 할일": 날짜 없는 할일, 날짜 배정 패널
- TodoRow: 상태 순환 (active→inProgress→done), Top3 별표, 태그 칩, 프로젝트 배지, 편집/삭제
- 헤더 `+ 추가` 드롭다운 (할일 / 일정 생성)
- 공통 TodoModal 사용 (날짜 직접 선택/미지정 저장 가능)

#### `/goals` — 목표관리
- **최상위 모드 탭(`GoalsHubView`)**: **만다라트** / **기간별** — 만다라트는 새 모드, 기간별은 기존 `MonthlyView` 4탭(연간/분기/월간/주간) 그대로 렌더 (기능·DOM 변경 0)
- 페이지 상단: eyebrow "structure your dream"(Nanum Pen Script) + 제목 "목표"(DM Serif Display)

##### 만다라트 모드 (Phase 1·2·3·4)
- **보드 헤더**(공통): 보드 드롭다운(DM Serif) + ✎ 이름변경(인라인 input · Enter 저장 · ESC 취소) + ＋ 새 보드(prompt) + 🗑 보드 삭제(`ConfirmModal`)
- 첫 방문 시 "나의 만다라트" 보드 1개 자동 시드(db 레이어 `mandalartBoards.fetchAll`이 빈 결과면 시드, race 방어). `useRealtimeSync('mandalart_boards' / 'mandalart_cells')` 로 PC↔모바일 즉시 반영
- 진행률 유틸 `computeProgress(cells)`: 자식 있는 세부 = 자식 행동 비율, 자식 없는 leaf 세부 = `(is_done?1:0, 1)`. 전체 = sum done / sum total. `subHasActions(subId)` 가 leaf/펼침 판단의 단일 진실
- **모바일(`lg:hidden`, `MandalartBoardMobile`)**:
  - 중앙 보기: 핵심 헤더 카드(Gaegu 핵심 제목 + `t.success` 채움 전체% 바) + 9칸 grid — 중앙 = 핵심(`t.accent` coral, Gaegu/DM Serif) / 둘레 8 = 세부 칸 또는 비어 있으면 점선 +
  - **세부 칸 동작**: 행동 1+ 세부 = 이름 + 미니바 + ▸ (탭 = drill). leaf 세부(행동 0) = 체크 동그라미 + 이름 (탭 = `is_done` 토글, 우하단 "+ 펼치기" 칩 탭 = drill 진입 — drill 화면에서 점선 + 로 첫 행동 생성). 빈 칸 = 점선 + (탭 = 세부 셀 생성)
  - 드릴 보기: 그 세부의 3×3(중앙 = `t.accentLight` 세부 이름+%, 둘레 8 = 행동 체크 칸). breadcrumb "← 핵심"으로 복귀
  - 행동 칸 탭 = `is_done` 토글(낙관적 + Realtime). 빈 칸 탭 = 편집 모달로 신규 셀 `upsert`. 채워진 칸 500ms **롱프레스(터치)** 또는 **우클릭(contextmenu)** = 텍스트 편집 모달 — 내용을 비우고 저장하면 셀 삭제(자식 행동 CASCADE)
  - 핵심 헤더/중앙 코어 탭 = 보드 title 편집
  - 셀 텍스트는 `line-clamp:2` + `word-break` + `min-width:0` + `aspect-square` 로 절대 넘침 없음
- **PC(`hidden lg:block`, `MandalartBoardPC`)** — 오타니식 9×9:
  - 외곽 grid `repeat(3,1fr) gap 12px` ⊃ 각 블록 `padding 5 + radius 12 + bg t.bgSub`(가운데 블록은 `t.accentLight` + accent 글로우) ⊃ 내부 grid `repeat(3,1fr) gap 4px` ⊃ 셀 `aspect-ratio 1 + radius 9`. 블록 gap > 셀 gap, 보드 컨테이너 `max-width: 780px` 중앙 정렬
  - 가운데 블록(br=1,bc=1): 중앙 = 핵심(`t.accent` + 전체%) · 둘레 8 = 세부 8(`t.accentSoft` + 이름 + 미니바). leaf 세부는 미니바 대신 체크 동그라미 표시 — 좌클릭 = `is_done` 토글, 우클릭 = 편집
  - 둘레 8블록: **펼친 세부만** 9칸 미러 블록(중앙 = subc, 둘레 8 = 행동 체크). 세부 없음 / 세부 leaf 인 둘레 자리는 단일 "+" 큰 버튼 블록(점선 dashed, aspect-square) — 라벨 = "세부 추가" / "{세부명} 펼치기". 클릭 시 세부 셀 또는 첫 행동 셀 생성 모달 → 강제 81칸 아님
  - 행동 좌클릭 = `is_done` 토글, 우클릭 = 텍스트 편집 모달. 핵심/펼친 세부 클릭 = 텍스트 편집. 빈 행동 칸 = 점선 +
  - 모든 셀 `min-width:0` + `line-clamp:2` + `word-break:break-word` → 어떤 폭에서도 셀 간 겹침 없고 긴 텍스트는 ··· 말줄임. 음수 마진/절대 배치 사용 안 함
  - 상단 우측 전체 진행률 바 + DM Serif `XX%`
- 색상은 기존 디자인 토큰만 사용(`t.accent`/`t.accentLight`/`t.accentSoft`/`t.success`/`t.bgSub`/`t.borderLight`/`t.danger`) — 하드코딩 색 0
- 폰트: 제목 DM Serif Display, eyebrow Nanum Pen Script, 핵심/세부 라벨 Gaegu — `fonts.css` 의 기존 CDN import 그대로 활용
- 보드 여러 개 생성·전환 가능(드롭다운 + 추가/이름변경/삭제)

##### 기간별 모드 (`MonthlyView` 셸 + Phase 1·2·3·4·5 캐스케이드)
- **데이터 모델**: 기존 `annual_goals`/`quarterly_goals`/`monthly_goals`/`weekly_goals` 연결(월간→연간, 주간→월간) 유지. `todos.weekly_goal_id text NULL` 컬럼 추가(FK `→ weekly_goals(id) ON DELETE SET NULL`) — 한 할일 = 하나의 주간 목표 정책으로 별도 join 테이블 없이 한 컬럼만
- **진행률 유틸 `periodProgress.ts`** (Phase 2): `weeklyRollup(weeklyGoal, todos)` → 연결 todos done/total, 없으면 `weeklyGoal.done` 폴백 / `monthlyRollup(monthlyGoal, weeklyGoals, todos)` → 하위 주간 합산 / `annualRollup(annualGoal, monthlyGoals, weeklyGoals, todos)` → 하위 월간 합산. `EFFECTIVE` 필터로 `backlog`/`cancelled` todos는 분모에서 제외. `directChildCount('annual'|'monthly'|'weekly', id, args)` 로 카드 라벨용 "연결 하위 N"
- **PC 캐스케이드 3열** (`PeriodCascadePC`, `hidden lg:flex`):
  - 좌(연간) → 중(선택된 연간에 연결된 월간만) → 우(선택된 월간에 연결된 주간만). 선택 카드 골드 강조(border `1.5px t.accent` + bg `t.accentLight`)
  - 좌 상단: 신규 공용 `IdentityCard`(autosave 600ms) + `ValuesCard`(최대 3 칩, accentLight)
  - 각 카드 풋라인: `<Layers> 월간 N` / `<Layers> 주간 N` / `<BarChart2> 할일 N` + `XX%` + `t.success` 진행 바. 연도 ◀ 2026 ▶
  - 각 열 하단 추가 인풋(월간 열은 `<input type="month">` 추가). 빈 상태 안내 "연간을 먼저 선택" / "월간 목표를 먼저 추가"
- **모바일 드릴다운** (`PeriodCascadeMobile`, `lg:hidden`):
  - 상태 `Level = annual | monthly | weekly`. 한 번에 한 화면만. 월간/주간 단계 상단 breadcrumb `← 2026년 · 연간 텍스트 · 월간 텍스트` (중간 단계 클릭으로도 위로 복귀)
  - 공용 `DrillCard`: PC와 동일한 역추적 배지/진행률, 우측 ChevronRight, 연간/주간 좌측 체크 토글, 월간 eyebrow에 yyyy-MM
  - 연간 단계 상단에 IdentityCard + ValuesCard (PC 와 공용 `IdentityValuesCards.tsx` 모듈)
- **주간 카드 todos 인라인** (`WeeklyTodosInline`, Phase 4) — PC 주간 카드 하단 + 모바일 DrillCard `footer`:
  - 연결된 todos 좌측 ○/✓ + 제목 truncate + 짧은 날짜(MM-dd) + × 인라인 표시. 좌측 ○/✓ 클릭 = `updateTodo({status})` → `/할일`·`/일간`·`/캘린더` 모두 같은 레코드 동기화. 행 탭 = `TodoModal` 편집 진입
  - "할일 추가" → `TodoModal` 에 `initialWeeklyGoalId` 자동 지정 + 날짜 기본값 = 그 주 **월요일** (`weekKeyToMonday` ISO 주 → 월요일 변환)
  - "기존 할일 연결" → 별도 `LinkExistingTodoModal`: 검색 + 미연결 우선 정렬 + 다른 주간에 이미 연결된 항목엔 "연결됨" 칩, 가상 반복 인스턴스(`'__'` 포함 id) 제외. 선택 시 `updateTodo({weeklyGoalId})`
  - × 클릭 = `updateTodo({weeklyGoalId: undefined})` → DB null, 할일 자체는 보존
  - `TodoModal.tsx` 에 `initialWeeklyGoalId` prop 추가, `buildChanges` 에 `weeklyGoalId: todo?.weeklyGoalId ?? initialWeeklyGoalId` 자동 적용(편집 시 기존값 보존). UI 변경 0
- **기존 4탭 보존**: `MonthlyView` 의 `AnnualGoalsContent`/`QuarterlyGoalsContent`/`MonthlyGoalsContent`/`WeeklyGoalsSection` 정의는 그대로 유지 — `WeeklyGoalsSection`은 `WeeklyView` 등에서 여전히 import 사용. PC/모바일 트리는 모두 새 캐스케이드로 대체되어 `hidden` 으로 보존(롤백 안전)
- **자동 롤업 + 🎯 배지 (Phase 5)**:
  - `/할일`(TodosView TodoRow) 과 `/일간`(DailyView TodoRow) 메타 영역에 프로젝트 배지 다음으로 🎯 목표 배지 추가 — `t.accentLight`/`t.accent`, max-width 130/110 truncate + `title` 속성에 풀텍스트, 프로젝트+목표 둘 다 있으면 배지 2개 동시 표시
  - `weeklyGoals` 를 `usePlanner()` destructure 에 추가 → `todo.weeklyGoalId` 로 조회해 배지 렌더
  - 자동 롤업: 별도 코드 변경 없음 — Phase 2 `periodProgress.weeklyRollup/monthlyRollup/annualRollup` 이 todos 전역 state 의존이라 어디서 toggle 해도 주간%→월간%→연간% 즉시 재렌더. backlog/cancelled todos 는 EFFECTIVE 필터로 분모에서 제외

#### `/habits` — 습관
- 습관 추가/편집/삭제 모달
  - "이 습관을 하려는 이유" 입력 (`reason` 필드)
  - "이번달 메모" 입력 (편집 모드 전용, `habit_monthly_memos` 테이블 저장)
- 반복 설정: 매일 / 평일 / 주말 / 커스텀(요일 선택)
- **5종 목표 유형 (HabitChip)**:
  - `check`: 원형 체크 버튼
  - `count`: − / + 카운터, 목표 달성 시 자동 체크
  - `time`: 타이머 (시작/정지, 누적 시간 저장)
  - `value`: 인라인 숫자 입력 + 단위
  - `memo`: 체크 후 인라인 메모 입력
- 연속 달성일(streak) 표시
- **습관 트래커** 탭 (FM002 스타일):
  - 연도 ◀▶ 네비 + Jan~Dec 월 탭
  - 습관별 행: 이모지+이름+이유 | 날짜 점(PC: grid 균등, 모바일: 가로 스크롤) | 달성/전체
  - 달성률 진행 바, 이번달 메모 인라인 편집
  - 월간 회고 섹션 (This month / What worked / What didn't work / Next month)

#### `/habits` 루틴 탭 — 루틴 실행 (구 `/routines`, 통합됨)
- 루틴 추가/편집/삭제 모달 (이름, 아이콘, 시작시간, 소요시간, 단계 목록)
  - 단계별 YouTube URL 입력 (선택사항, 유효성 검증)
- 오늘 진행률 바 (완료 수 / 전체)
- `RoutineCard`: 아이콘, 이름, 시간, 소요시간, 연속달성일 배지
- `ExecutionPanel`: 하단 시트
  - SVG 원형 카운트다운 타이머
  - 단계별 체크박스 + URL 등록 시 "영상 보기" 버튼 (새 탭)
  - "완료로 기록" 버튼 → `checked_dates` 토글 → Supabase 저장
- 연속 달성일(streak) 계산
- 완료 루틴은 하단으로 정렬 (미완료 → 시작시간 순)

#### `/selfcare` — 자기관리
- 카테고리: 운동 & 피트니스 / 퇴근 후 공부 / 뷰티 & 케어
- 기록 추가/삭제 (날짜, 내용, 소요시간)
- 월간 통계: 총 시간, 횟수, 평균 시간
- **수면 기록**: 취침/기상 시간 입력 → 수면 시간 자동 계산, 최근 7일 바차트, 이번주/이번달 평균
- **생리 기록** (`PeriodSection`): 접기/펼치기 가능한 민감 정보 섹션
  - 입력: 시작일, 종료일, 흘림양(적음/보통/많음), 증상 다중 선택(8종), 메모
  - 기록 수정/삭제, 최근 6건 목록 표시
  - 예측: 과거 기록 기반 평균 주기 자동 계산 + 다음 예상 시작일 표시

#### `/reviews` — 리뷰 & 기록
- **일간 리뷰**: 감정 레벨(1-5), 감사 항목 3개, KPT, 행복한 일, 데일리 요약
- **기록 목록**: 날짜별 리뷰 카드
- **주간 리뷰**: 좋았던 것 / 힘들었던 것 / 다음 주 다짐
- **월간 리뷰**: 이달 성취 / 다음 달 집중

#### `/food` — 식단 기록
- **오늘 탭**: 날짜 헤더, 오늘 총 식비·칼로리 요약 카드, 아침/점심/저녁/간식 섹션별 기록 목록
  - 원형 사진 썸네일, 칼로리·금액·식사유형 표시, 맛 이모지+메모, 수정·삭제
- **7단계 바텀시트 추가 흐름**:
  1. 시간대 선택 (🌅 아침 / ☀️ 점심 / 🌙 저녁 / 🍪 간식)
  2. 사진 (카메라/갤러리/건너뛰기) → Supabase `food-photos` Storage 업로드
  3. 음식 이름+양 입력 (음성입력 지원) → AI 칼로리 자동 추정 (OpenAI gpt-4o-mini)
  4. 식사 유형 (🏠 집밥 / 🛵 배달 / 🍴 외식 / ☕ 커피)
  5. 금액 입력 (선택)
  6. 칼로리 입력 (AI 추정값 배너 표시 → 적용 또는 직접 입력, 선택)
  7. 맛 평가 (😋 맛있었어 / 😐 보통 / 😑 별로, 선택) + 한 줄 메모 입력
- **달력 탭**: 날짜 셀 4분할(아침/점심/저녁/간식) 그리드, 주간↔월간 접기/펼치기 애니메이션
  - 선택 날짜 기록 목록에서 수정·삭제 가능 (FoodCard UI 동일)
- **통계 탭**: 기간 필터 [이번달/지난달/최근14일/직접선택]
  - 식비 총액, 배달·외식 목표 대비 횟수 (설정에서 목표 설정 가능)
  - 식사유형 도넛 차트, 자주 먹은 음식 TOP5, ⭐ 맛있었던 것 모아보기
  - 칼로리 막대 그래프 (최근14일: 14개 / 월별: 해당 달 전체 일별)

#### `/culture` — 문화 기록 (Stage 1·2 PC / Stage 3 모바일)

##### 모바일 레이아웃 (Stage 3, `lg:` 미만 전용)
- 진입점: 모바일 하단 5탭은 그대로, **상단 햄버거 메뉴**에 "문화 기록"(`Clapperboard`) 항목 (Stage 1에서 추가됨)
- 구조: PC 트리(`hidden lg:block`)와 모바일 트리(`lg:hidden`)를 **완전히 분리** → PC 레이아웃 무변경 보장. 상태/핸들러는 부모에서 공유
- sticky 헤더(부모 `main`이 스크롤 컨테이너): ① 제목 + 검색 아이콘(탭 시 헤더 자리에 input 펼침, 취소로 닫기) ② 상태 가로 스크롤 탭(전체/보고싶음/보는중/완료/중단) ③ 필터 트리거(플랫폼·유형 / 정렬 → bottom sheet)
- 본문: **3열 포스터 그리드**(2:3, gap 8px, padding 16px), 로딩 시 스켈레톤 6장(3×2), 빈 상태 동일 컴포넌트
- 모바일 카드(`CultureCardMobile`): hover/드롭다운 없음, 플랫폼·상태 아이콘만, 제목 2줄·작은 별점, 탭 → 수정 모달
- **FAB**: 우하단 골드 원형(56×56), `bottom: calc(72px + safe-area-inset-bottom)`(하단 탭바 위), 탭 → 추가 모달
- 필터 bottom sheet(`CultureFilterSheet`): 드래그 핸들 + 플랫폼/유형/정렬 섹션 + 초기화/적용(임시 상태→적용 시 커밋), safe-area 하단 패딩
- 추가/수정 모달(모바일): **full-screen 슬라이드업**(`max-lg` 미디어쿼리 키프레임), 헤더 ←(취소)/제목/저장(`form` 제출), safe-area-inset-top. 폼 순서: TMDB 토글 → URL → 제목 → 플랫폼/유형 → **상단 빠른 상태칩(수정 모드 즉시 DB 반영)** → 본날짜/썸네일 → 별점 → 리뷰 → 인사이트 → 태그 → (수정 시) 삭제. PC용 인폼 상태 섹션은 `hidden lg:block`
- TMDB 검색 결과: 모바일은 **썸네일 좌측 1열 리스트**(`lg:hidden`), PC는 3열 그리드(`hidden lg:grid`) 그대로
- 터치 영역 ≥ 약 40~46px, iOS 모멘텀 스크롤(`-webkit-overflow-scrolling: touch`)
- 360px(소형)에서도 3열 그리드·칩 가로 스크롤로 깨지지 않게 설계

#### `/culture` — 문화 기록 (Stage 1·2, PC 전용)
- 영화/드라마/예능/다큐/애니/유튜브/강의 등 시청 콘텐츠 기록
- 헤더: 제목 + 제목·태그 검색 인풋 + 정렬 드롭다운(기록일/본 날짜/별점 높은순) + `+ 추가하기`
- 칩 필터 3줄(다중): 플랫폼 / 유형 / 상태 — active 시 골드(accent) 배경
- 포스터 그리드: PC 6열(`lg:grid-cols-6`), 카드 2:3 비율
  - 썸네일 이미지(있으면) / 없으면 플랫폼 그라데이션 + 유형 아이콘 placeholder
  - 좌상단 플랫폼 미니 뱃지, 우상단 상태 아이콘(보고싶음=북마크/보는중=재생/완료=체크/중단=X)
  - **(Stage 2) 카드 hover 시 우상단 chevron(▼) → 상태 빠른 변경 드롭다운**(보고싶음/보는중/완료/중단), 선택 시 optimistic update + 실패 롤백 + 토스트. 카드 클릭(모달)과 `stopPropagation`으로 분리
  - 하단 제목 + 골드 별점(read-only), hover 시 위로 살짝 + 그림자 강조
  - 카드 클릭 → 상세/수정 모달
- 추가/수정 모달(`CultureFormModal`): 제목*·URL·플랫폼*·유형*·상태*·본 날짜·썸네일 URL·별점(completed/dropped 시)·리뷰·인사이트·태그(콤마 구분), 저장/취소/삭제(수정 시)
  - **(Stage 2) YouTube URL 자동 채움**: URL 입력 onBlur/onPaste 시 YouTube면 oEmbed로 제목·썸네일(비어있을 때만)·플랫폼=youtube·유형=youtube_video·external_source=youtube·external_id 자동 채움, 로딩 스피너, 실패 시 토스트
  - **(Stage 2) TMDB 검색**: 상단 "🎬 TMDB에서 검색" 토글 → 패널(300ms debounce, 포스터·제목·원제·연도·영화/TV 뱃지). 결과 선택 시 제목·썸네일·유형(movie→movie, tv→drama)·external_source(tmdb_movie/tmdb_tv)·external_id 채움. **platform은 자동 설정 안 함**(사용자 선택). 토큰 없음/401/네트워크 오류는 안내·토스트, 수동 입력 병행 가능
  - 자동 채움은 편의 기능 — 채워진 값도 사용자가 모두 수정 가능, `external_source`는 마지막 자동 채움 출처(`youtube`/`tmdb_movie`/`tmdb_tv`/`manual`)를 기록
- 별점(`StarRating`): 0.5 단위 반쪽 별, read-only/인터랙티브 모드
- 빈 상태: 아이콘 + "첫 문화 기록을 남겨보세요" + `+ 추가하기`
- 토스트(`CultureToast`): 페이지 자체 호스팅 경량 토스트(전역 인프라 없음) — 자동 채움/상태 변경 결과 알림
- Realtime: `culture_records` 테이블 구독(PC↔모바일 즉시 반영)
- **모바일 전용 레이아웃은 Stage 3 예정** (현재 그리드는 모바일에서 2열로 동작하지만 전용 UI 미완)

##### 문화 기록 외부 연동 명세 (Stage 2)
- **YouTube oEmbed** (`src/lib/youtube.ts`, API 키 불필요)
  - URL: `GET https://www.youtube.com/oembed?url={URL}&format=json`
  - 반환 사용 필드: `title`, `author_name`, `thumbnail_url`
  - `extractYouTubeVideoId(url)`: `watch?v=` / `youtu.be/` / `shorts/` / `embed/` 패턴에서 11자 video ID 추출(미매치 null)
  - `fetchYouTubeMetadata(url)`: 비-YouTube URL·실패 시 null
- **TMDB** (`src/lib/tmdb.ts`)
  - 환경변수: `VITE_TMDB_API_TOKEN` (Vercel Production/Preview 등록 → 배포본 동작, 로컬은 `.env` 추가 필요)
  - 인증: `Authorization: Bearer ${VITE_TMDB_API_TOKEN}`
  - 검색: `GET https://api.themoviedb.org/3/search/multi?query=...&language=ko-KR&include_adult=false` — `media_type`가 `movie`/`tv`인 결과만 사용
  - 반환 매핑: `{ id, type:'movie'|'tv', title, original_title, year, poster_path }`
  - 포스터: `getPosterUrl(path)` → `https://image.tmdb.org/t/p/w500{path}` (없으면 null)
  - `hasTMDBToken()`로 토큰 유무 판단 → 검색 패널 활성/비활성, 401은 "토큰 유효하지 않음" 안내
  - 한계: 한국 예능·개인 유튜브 촬영물 등은 TMDB에 없을 수 있음 → 수동 입력 병행

#### 비라우팅 컴포넌트 (현재 `routes.tsx` 미연결)
- `BrainstormView`: 브레인스토밍 입력/할일·일정 변환 UI 컴포넌트 파일은 존재
- `BacklogView`: 백로그 할일 관리 UI 컴포넌트 파일은 존재

---

## 2. DB 테이블 구조 (Supabase)

### 2-1. 연동된 테이블 목록

| 테이블명 | 설명 | 정렬 기준 | 코드 연동 |
|---------|------|---------|:--------:|
| `todos` | 할일 | `created_at` ASC | ✅ |
| `habits` | 습관 | `created_at` ASC | ✅ |
| `projects` | 프로젝트 | `created_at` ASC | ✅ |
| `milestones` | 프로젝트 마일스톤 | `date` ASC | ✅ |
| `self_care_records` | 자기관리 기록 | `date` DESC | ✅ |
| `review_records` | 리뷰 기록 | `date` DESC | ✅ |
| `timeline_logs` | 타임라인 로그 | `date` ASC, `time` ASC | ✅ |
| `user_settings` | 앱 설정 (타임라인 시간대) | — (싱글톤) | ✅ |
| `events` | 일정 | `date` ASC | ✅ |
| `weekly_goals` | 주간 목표 | `created_at` ASC | ✅ |
| `monthly_goals` | 월간 목표 | `created_at` ASC | ✅ |
| `brainstorm_items` | 브레인스톰 항목 | `created_at` ASC | ✅ |
| `brainstorm_memos` | 브레인스톰 날짜별 메모 | — (date PK) | ✅ |
| `tags` | 태그 | `created_at` ASC | ✅ |
| `routines` | 루틴 | `created_at` ASC | ✅ |
| `period_records` | 생리 기록 | `start_date` DESC | ✅ |
| `habit_monthly_memos` | 습관별 월간 메모 + 전체 회고 | `year` ASC, `month` ASC | ✅ |
| `weekly_reviews` | 주간 리뷰 | `week_key` DESC | ✅ |
| `monthly_reviews` | 월간 리뷰 | `month` DESC | ✅ |
| `food_records` | 식단 기록 | `date` DESC, `created_at` DESC | ✅ |
| `moments` | 모먼트 로그 | `created_at` DESC | ✅ |
| `reading_logs` | 독서 진행 이력 (current_page 스냅샷) | `date` ASC | ✅ |
| `culture_records` | 문화 기록 (영화/드라마/예능/유튜브 등 시청 콘텐츠) | `created_at` DESC | ✅ |
| `music_records` | 음악 기록 (iTunes 검색 곡 + 무드·메모) | `created_at` DESC | ✅ |
| `recipes` | 레시피 본체 (직접입력) | `created_at` DESC | ✅ |
| `recipe_ingredients` | 레시피 재료 (recipe_id, name/amount/unit/sort_order) | `sort_order` ASC | ✅ |
| `recipe_steps` | 레시피 요리 순서 (step_no, instruction, timer_seconds) | `sort_order` ASC | ✅ |
| `fridge_items` | 냉장고 재고 (name, category, quantity, expiry_date) | `created_at` DESC | ✅ |
| `shopping_items` | 장보기 목록 (Phase 2c 본 구현 예정) | `is_checked` ASC, `created_at` DESC | ✅ (db 레이어 완료) |
| `mandalart_boards` | 만다라트 보드 (핵심 목표 = title) | `sort_order` ASC, `created_at` ASC | ✅ |
| `mandalart_cells` | 만다라트 셀 (parent_id NULL=세부, parent_id=세부id 면 행동) | `position` ASC | ✅ |
| `diary_entries` | 통합 일기 (자유/질문일기 `type` 통합, `entry_date`·`question_id`·`question_text` 스냅샷) | `entry_date` DESC | ✅ (자유일기) |
| `journal_questions` | 질문 풀 (기본 질문 공용 + 나만의 질문, 12 카테고리 108개 seed) | `category`, `sort_order` ASC | ✅ (seed) |
| `exercises` | 운동 종목 마스터/카탈로그 (user_id null=전체 공용, name_ko null=미채택, free-exercise-db 873종목 import) | `name_ko`, `name_en` | ✅ (건강>운동 탭, db.workouts) |
| `workout_logs` | 운동 세션 (한 날/한 종목, exercise_id FK) | `performed_on` DESC | ✅ (건강>운동 탭) |
| `workout_sets` | 운동 세트 (근력 weight/reps · 유산소 duration_min/distance_km, log_id ON DELETE CASCADE) | `set_no` ASC | ✅ (건강>운동 탭) |
| `routine_days` | 요일별 루틴 헤더 (day_of_week 1~7, unique(user_id,day_of_week)) | `day_of_week` ASC | ✅ (건강>운동 탭) |
| `routine_exercises` | 요일 루틴 종목 (routine_day_id ON DELETE CASCADE, exercise_id) | `sort_order` ASC | ✅ (건강>운동 탭) |
| `place_folders` | 가고싶은 곳 — 폴더=테마 지도 (color=토큰 키, sort_order) | `sort_order` ASC | ✅ (db.placeFolders, Stage 1) |
| `places` | 가고싶은 곳 — 저장 장소 (region_code 시도 코드, concept 뽑기 분류, 카카오 캐시 컬럼) | `created_at` DESC | ✅ (db.places, Stage 1) |
| `place_folder_items` | 장소 ↔ 폴더 다대다 (복합 PK, EXISTS RLS, ON DELETE CASCADE) | `added_at` | ✅ (db.placeFolderItems, Stage 1) |
| `place_visits` | 방문 기록=기억 탭 원천 (place_id nullable·이름/지역 비정규화, diary_entries FK SET NULL) | `visited_on` DESC | ✅ (db.placeVisits, Stage 1) |
| `walk_sessions` | 산책 세션 (mode free/course/repeat·path/planned_route jsonb·거리/시간/페이스·photo_url/memo/route_name/is_saved_route) | `started_at` DESC | ✅ (db.walkSessions, /walk) |

### 2-2. 테이블별 컬럼 상세

#### `todos`
```
id              text        PK
text            text        할일 내용
date            text|null   날짜 (yyyy-MM-dd)
due_date        text|null   마감일
status          text        active|inProgress|done|snoozed|backlog|cancelled
is_top3         boolean     중요 할일 여부
plan_start      text|null   계획 시작시간 (HH:mm)
plan_end        text|null   계획 종료시간 (HH:mm)
do_start        text|null   실행 시작시간 (HH:mm)
do_end          text|null   실행 종료시간 (HH:mm)
category        text|null   카테고리
project_id      text|null   연결된 프로젝트 ID
weekly_goal_id  text|null   연결된 주간 목표 ID (Phase 1 추가, FK → weekly_goals(id) ON DELETE SET NULL)
tags            text[]      태그 ID 배열
```

#### `habits`
```
id              text        PK
name            text        습관 이름
checked_dates   text[]      체크된 날짜 배열 (yyyy-MM-dd)
icon            text|null   이모지 아이콘
repeat          text|null   daily|weekday|weekend|custom
repeat_days     int[]|null  반복 요일 (0=일 ~ 6=토)
goal_text       text|null   목표 텍스트 (check 타입용)
alarm_time      text|null   알람 시간 (HH:mm)
category        text|null   health|selfdev|routine|other
color           text|null   색상 hex
habit_type      text        check|count|time|value|memo (기본값: 'check')
target_value    integer|null 목표 수치 (count=횟수, time=분, value=수치)
value_unit      text|null   수치 단위 (value 타입용)
daily_progress  jsonb       날짜별 진행 수치 { "yyyy-MM-dd": number }
daily_memos     jsonb       날짜별 메모 { "yyyy-MM-dd": string }
reason          text|null   이 습관을 하려는 이유
```

#### `projects`
```
id              text        PK
name            text        프로젝트 이름
color           text        색상 hex
description     text|null   설명
start_date      text|null   시작일 (yyyy-MM-dd)
end_date        text|null   종료일 (yyyy-MM-dd)
status          text        active|completed|paused
```

#### `milestones`
```
id              text        PK
project_id      text        FK → projects.id
title           text        마일스톤 제목
date            text        날짜 (yyyy-MM-dd)
done            boolean     완료 여부
```

#### `self_care_records`
```
id              text        PK
date            text        날짜 (yyyy-MM-dd)
category        text        exercise|study|beauty|sleep
content         text        기록 내용
duration        int         소요 시간 (분)
sleep_start     text|null   취침 시간 (HH:mm) — sleep 카테고리 전용
sleep_end       text|null   기상 시간 (HH:mm) — sleep 카테고리 전용
```

#### `period_records`
```
id              text        PK
start_date      text        시작일 (yyyy-MM-dd)
end_date        text|null   종료일 (yyyy-MM-dd)
symptoms        jsonb       증상 배열 ["두통","복통",...]
flow_level      text|null   흘림양: light|medium|heavy
memo            text|null   메모
created_at      timestamptz 생성일시
```

#### `habit_monthly_memos`
```
id              text        PK
habit_id        text        습관 id (또는 '__review__' for 전체 월간 회고)
year            int         연도
month           int         월 (1-12)
memo            text        이번달 메모 (습관별) / This month (전체 회고)
what_worked     text        What worked (전체 회고용)
what_didnt_work text        What didn't work (전체 회고용)
next_month      text        Next month (전체 회고용)
created_at      timestamptz 생성일시
UNIQUE(habit_id, year, month)
```

#### `review_records`
```
id              text        PK
date            text        날짜 (yyyy-MM-dd)
types           text[]      리뷰 유형 배열
emotion         int|null    감정 레벨 (1~5)
emotion_memo    text|null   감정 메모
gratitude       text[]|null 감사 항목
kpt_keep        text|null   KPT - Keep
kpt_problem     text|null   KPT - Problem
kpt_try         text|null   KPT - Try
happiness       text|null   행복한 일
daily_summary   text|null   데일리 요약
daily_good      text|null   잘한 점
daily_improve   text|null   개선할 점
```

#### `timeline_logs`
```
id              text        PK
date            text        날짜 (yyyy-MM-dd)
time            text        시간 (HH:mm)
text            text        로그 내용
color           text|null   색상 hex
icon            text|null   이모지 아이콘
```

#### `user_settings`
```
id              text        PK (항상 'default')
day_start_hour  int         타임라인 시작 시간 (기본값: 4)
day_end_hour    int         타임라인 종료 시간 (기본값: 26 = 다음날 2시)
```

#### `events`
```
id              uuid        PK
user_id         uuid        FK → auth.users.id
title           text        일정 제목
is_all_day      boolean     종일 여부
start_at        timestamptz 시작 일시
end_at          timestamptz 종료 일시
location        text|null   장소
link_url        text|null   링크 URL
repeat_type     text|null   none|daily|weekly|monthly
repeat_end_date date|null   반복 종료일
alert_minutes   int|null    0|10|30|60
memo            text|null   메모
project_id      text|null   FK → projects.id (앱 호환용)
color           text|null   일정 색상
created_at      timestamptz 생성일시
```

#### `weekly_goals`
```
id              text        PK
text            text        목표 내용
done            boolean     완료 여부 (기본값: false)
monthly_goal_id text|null   연결된 월간 목표 ID
week_key        text        주차 키 (예: 2026-W12)
created_at      timestamptz 생성일시
```

#### `monthly_goals`
```
id              text        PK
text            text        목표 내용
month           text        월 (예: 2026-03)
project_id      text|null   연결된 프로젝트 ID
created_at      timestamptz 생성일시
```

#### `brainstorm_items`
```
id              text        PK
text            text        아이디어 내용
date            text        날짜 (yyyy-MM-dd)
week_key        text|null   주차 키 (예: 2026-W12)
created_at      timestamptz 생성일시
```

#### `brainstorm_memos`
```
date            text        PK (날짜 yyyy-MM-dd)
text            text        메모 내용
```

#### `tags`
```
id              text        PK
name            text        태그 이름
color           text        색상 hex
created_at      timestamptz 생성일시
```

#### `routines`
```
id                  text        PK
name                text        루틴 이름
icon                text        이모지 아이콘
start_time          text|null   시작 시간 (HH:mm)
duration            int|null    소요 시간 (분)
steps               text[]      단계 목록
step_youtube_urls   text[]      단계별 YouTube URL (steps와 인덱스 1:1 대응)
checked_dates       text[]      완료 날짜 배열 (yyyy-MM-dd)
repeat              text        daily|weekday|weekend|custom (기본값: 'daily')
repeat_days         int[]       반복 요일 (0=일 ~ 6=토, custom일 때 사용)
created_at          timestamptz 생성일시
```

#### `weekly_reviews`
```
id          text        PK
week_key    text        UNIQUE (예: 2026-W21)
good        text        좋았던 것
hard        text        힘들었던 것
next_week   text        다음 주 다짐
created_at  timestamptz 생성일시
```

#### `monthly_reviews`
```
id           text        PK
month        text        UNIQUE (예: 2026-05)
achievement  text        이달의 성취
next_focus   text        다음 달 집중
created_at   timestamptz 생성일시
```

#### `food_records`
```
id           text        PK
date         text        날짜 (yyyy-MM-dd)
meal_type    text        breakfast|lunch|dinner|snack
food_name    text        음식 이름
amount       integer     식비 (원, 기본값 0)
photo_url    text|null   Supabase Storage 사진 URL
memo         text|null   메모
calories     numeric(7,1)|null  칼로리 (kcal)
carbs        numeric(7,1)|null  탄수화물 (g)
protein      numeric(7,1)|null  단백질 (g)
fat          numeric(7,1)|null  지방 (g)
dining_type  text|null   home|delivery|restaurant|coffee
taste_rating text|null   good|normal|bad
taste_memo   text|null   맛 평가 한 줄 메모
created_at   timestamptz 생성일시
```
> Storage: `food-photos` 버킷 (public, anon INSERT/UPDATE/DELETE/SELECT 정책 설정) — 사진 업로드/삭제 지원

#### `moments`
```
id              uuid        PK (gen_random_uuid())
created_at      timestamptz 생성일시 (default now())
content         text        짧은 텍스트 기록
photos          text[]      사진 Public URL 배열 (Supabase Storage moment-photos 버킷)
weather_temp    numeric     기온 (°C, nullable — 위치 권한 거부 시 null)
weather_code    int         WMO 날씨 코드 (nullable)
```
> Storage: `moment-photos` 버킷 (public, anon INSERT/UPDATE/DELETE/SELECT 정책 설정)

#### `culture_records`
```
id              uuid        PK (gen_random_uuid())
user_id         uuid        FK → auth.users.id (DEFAULT auth.uid(), on delete cascade)
title           text        제목
platform        text        netflix|youtube|disney_plus|coupang_play|tving|watcha|theater|other
content_type    text        movie|drama|variety|documentary|anime|youtube_video|lecture|other
url             text|null   콘텐츠 URL
thumbnail_url   text|null   썸네일 이미지 URL (Stage 2 유튜브 자동 fetch 예정)
external_source text|null   tmdb_movie|tmdb_tv|youtube|manual (Stage 1=manual, Stage 2 자동 검색 시 채움)
external_id     text|null   외부 출처 콘텐츠 ID (TMDB id, YouTube video id 등)
status          text        watchlist|watching|completed|dropped (기본값 completed)
rating          numeric(2,1)|null  별점 0~5 (0.5 단위)
review          text|null   리뷰
insight         text|null   인사이트/배운 점
tags            text[]      태그 배열 (기본값 '{}')
watched_date    date|null   본 날짜
created_at      timestamptz 생성일시 (default now())
updated_at      timestamptz 수정일시 (default now())
```
> RLS: "Users can {view,insert,update,delete} their own records" — `auth.uid() = user_id` (per-row 소유자 정책). user_id 는 INSERT 시 DB 기본값 auth.uid() 로 자동 충전(클라이언트 미전송).
> Realtime: `supabase_realtime` publication 등록 완료

#### `recipes` (Phase 1)
```
id              uuid        PK (gen_random_uuid())
user_id         uuid        FK → auth.users.id (DEFAULT auth.uid(), on delete cascade)
title           text        레시피 이름
source_type     text        manual|link|reels|receipt|ai (기본값 'manual'; Phase 1=manual만)
source_url      text|null   출처 URL
thumbnail_url   text|null   썸네일 URL
total_minutes   int|null    조리 시간(분)
base_servings   int         기준 인분 (기본값 2, 인분 환산 기준)
rating          numeric(2,1)|null  별점 0~5 (0.5 단위)
memo            text|null   메모
created_at      timestamptz 생성일시 (default now())
updated_at      timestamptz 수정일시 (default now())
```
> RLS: 본인 소유자만. Realtime: 등록 완료

#### `recipe_ingredients` (Phase 1)
```
id          uuid        PK
recipe_id   uuid        FK → recipes.id (ON DELETE CASCADE)
name        text        재료 이름
amount      numeric|null 분량 수치 (인분 환산 대상)
unit        text|null   단위 (g, 개, 큰술 등)
sort_order  int         정렬 순서 (기본값 0)
```
> RLS: 소속 recipe 소유권(EXISTS) 기반. Realtime: 등록 완료

#### `recipe_steps` (Phase 1)
```
id              uuid        PK
recipe_id       uuid        FK → recipes.id (ON DELETE CASCADE)
step_no         int         1부터 시작하는 단계 번호
instruction     text        단계 설명
timer_seconds   int|null    단계 타이머(초), 없으면 null
sort_order      int         정렬 순서 (기본값 0)
```
> RLS: 소속 recipe 소유권(EXISTS) 기반. Realtime: 등록 완료

#### `fridge_items` (Phase 2)
```
id           uuid        PK
user_id      uuid        FK → auth.users.id (DEFAULT auth.uid(), on delete cascade)
name         text        품목 이름
category     text        '냉장'|'냉동'|'실온' (CHECK, 기본값 '냉장')
quantity     numeric     수량 (기본값 1)
unit         text|null   단위
expiry_date  date|null   유통기한 (D-day 계산용)
created_at   timestamptz 생성일시
```
> RLS: 본인 소유자만. Realtime: 등록 완료

#### `shopping_items` (Phase 2)
```
id                uuid        PK
user_id           uuid        FK → auth.users.id (DEFAULT auth.uid(), on delete cascade)
name              text        품목 이름
quantity          numeric     수량 (기본값 1)
unit              text|null   단위
source_recipe_id  uuid|null   FK → recipes.id (ON DELETE SET NULL) — Phase 3 부족 재료 자동 담기 대비 컬럼만 미리 둠
source_label      text|null   레시피명 또는 '직접 추가' (Phase 2c)
is_checked        boolean     체크 여부 (기본값 false)
created_at        timestamptz 생성일시
```
> RLS: 본인 소유자만. Realtime: 등록 완료. db 레이어(`shoppingItems.fetchAll`/`upsert`/`setChecked`/`delete`) 완료, UI 본 구현은 Phase 2c

#### `mandalart_boards` (만다라트 Phase 1)
```
id          uuid        PK (gen_random_uuid())
user_id     uuid        FK → auth.users.id (DEFAULT auth.uid(), on delete cascade)
title       text        핵심 목표 (기본값 '')
sort_order  int         정렬 순서 (기본값 0)
created_at  timestamptz 생성일시
```
> RLS: 본인 소유자만. Realtime: 등록 완료. db 레이어 `mandalartBoards.fetchAll`(빈 결과면 "나의 만다라트" 자동 시드)/`ensureSeed`/`create`/`rename`/`delete`

#### `mandalart_cells` (만다라트 Phase 1)
```
id          uuid        PK
board_id    uuid        FK → mandalart_boards.id (ON DELETE CASCADE)
parent_id   uuid|null   FK → mandalart_cells.id (ON DELETE CASCADE) — NULL=세부 셀, 값=행동 셀
position    int         0~7 (board_id+parent_id 안에서 유니크, CHECK 0~7)
content     text        셀 내용 (기본값 '')
is_done     boolean     완료 여부 (기본값 false, 행동 셀에서 의미 있음)
created_at  timestamptz 생성일시
```
> 진행률은 클라이언트 `computeProgress()` 가 (자식 행동 완료/자식 행동 전체) 로 계산 — DB 트리거 없음
> 유니크 인덱스: `(board_id, coalesce(parent_id::text,''), position)`
> RLS: 소속 보드 소유권(EXISTS) 기반. Realtime: 등록 완료. db 레이어 `mandalartCells.fetchByBoard`/`upsert`(같은 board+parent+position 있으면 update, 없으면 insert)/`update`/`delete`

---

## 3. 페이지간 데이터 연동 관계

```
store.tsx (PlannerContext)
│
├── todos ──────────────────── DailyView (CRUD), BacklogView (CRUD)
│                              WeeklyView (조회), DashboardView (조회)
│                              CalendarView (조회), ProjectDetailView (조회)
│
├── habits ─────────────────── HabitsView (CRUD + toggle)
│                              DailyView (조회 + toggle)
│                              DashboardView (조회)
│                              CalendarView (조회)
│
├── projects ───────────────── ProjectsView (CRUD)
│                              ProjectDetailView (CRUD)
│                              Layout 사이드바 (조회)
│
├── milestones ─────────────── ProjectDetailView (CRUD)
│
├── selfCareRecords ─────────── SelfCareView (CRUD)
│                              CalendarView (조회)
│
├── reviewRecords ──────────── ReviewsView (CRUD)
│
├── timelineLogs (전역) ────── DailyView ← ✅ store 연동 완료
│
├── dayStartHour/dayEndHour ── DailyView (타임라인 범위)
│                              CalendarView (주별/일별 뷰 범위)
│
├── events ─────────────────── DailyView (조회), CalendarView (조회)
│                              BrainstormView (변환 시 생성) → Supabase ✅
│
├── weeklyGoals ────────────── WeeklyView (CRUD)
│                              MonthlyView (조회)
│                              DashboardView (조회) → Supabase ✅
│
├── monthlyGoals ───────────── MonthlyView (CRUD)
│                              DashboardView (조회) → Supabase ✅
│
├── brainstormItems ─────────── BrainstormView (CRUD, 현재 라우트 미연결)
│                              → Supabase ✅
│
├── brainstormMemos ─────────── BrainstormView (CRUD, 현재 라우트 미연결)
│
├── tags ───────────────────── TodoModal (태그 선택) → Supabase ✅ (최초 기본값 5개 자동 시드)
│
├── routines ───────────────── HabitsView 루틴 탭 (CRUD + toggleRoutineDate) → Supabase ✅
│
└── selectedDate ────────────── 모든 날짜 의존 컴포넌트
```

---

## 4. 구현 완료된 기능 목록

### ✅ 데이터 CRUD

| 기능 | Create | Read | Update | Delete | Supabase |
|------|:------:|:----:|:------:|:------:|:--------:|
| 할일 (Todo) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 습관 (Habit) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 프로젝트 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 마일스톤 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 자기관리 기록 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 생리 기록 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 습관 월간 메모 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 리뷰 기록 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 타임라인 설정 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 타임라인 로그 | ✅ | ✅ | — | ✅ | ✅ 연동 (버그 수정 완료) |
| 일정 (Event) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (events 스키마 버그 수정 완료) |
| 주간 목표 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 월간 목표 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 브레인덤프 아이템 | ✅ | ✅ | — | ✅ | ✅ 연동 |
| 브레인덤프 메모 | ✅ | ✅ | ✅ | — | ✅ 연동 |
| 태그 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 루틴 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 |
| 주간 리뷰 | ✅ | ✅ | ✅ | — | ✅ 연동 (weekly_reviews 테이블) |
| 월간 리뷰 | ✅ | ✅ | ✅ | — | ✅ 연동 (monthly_reviews 테이블) |
| 식단 기록 | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (food_records 테이블, is_fasting 단식 플래그 포함) |
| 모먼트 로그 | ✅ | ✅ | — | ✅ | ✅ 연동 (moments 테이블) |
| 질문일기 — 질문 풀 | ✅ | ✅ | — | ✅ | ✅ 연동 (question_pool 테이블) |
| 질문일기 — 답변 | ✅ | ✅ | ✅ | — | ✅ 연동 (question_answers 테이블) |
| 질문일기 — 오늘 배정 | ✅ | ✅ | — | — | ✅ 연동 (daily_question 테이블) |
| 문화 기록 (Culture) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (culture_records 테이블, Realtime) |
| 레시피 (Recipe — Phase 1a) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (recipes + recipe_ingredients + recipe_steps, Realtime 3개) |
| 냉장고 (Fridge — Phase 2a) | ✅ | ✅ | ✅ | ✅ | ✅ 연동 (fridge_items, Realtime) |
| 장보기 (Shopping — Phase 2c 예정) | ✅(db) | ✅(db) | ✅(db) | ✅(db) | ✅ 테이블·db 레이어 완료, UI 본 구현은 Phase 2c |

### ✅ UI/UX 기능

- 4가지 디자인 테마 (A/B/C/D)
- 테마 C: 탑네비 레이아웃, 나머지: 사이드바 레이아웃
- 반응형 레이아웃 (데스크탑 / 모바일)
- 일간 타임라인 블록 드래그 이동 / 리사이징
- 스톱워치 → DO 시간 자동 기록
- 타임라인 시간대 설정 전역 저장 (Supabase)
- 월별 캘린더 칩 표시 + 필터 탭
- 습관 연속달성일(streak) 계산
- 할일 Top3 설정 (날짜별 최대 3개)
- 상태 순환: 예정 → 진행중 → 완료
- 미루기 (snoozed) 기능
- 백로그 → 날짜 배정
- 브레인스토밍 컴포넌트(현재 라우트 미연결)에서 할일/일정 변환 지원
- **주간 칸반 드래그앤드롭** — 할일 카드를 다른 날짜 컬럼으로 드래그해 날짜 이동, Supabase 즉시 저장 (@dnd-kit/core)
- **루틴 실행** — 단계 체크 + SVG 원형 카운트다운 타이머, 완료 기록 → Supabase
- **습관 5종 목표 유형** — check/count/time/value/memo 각각 전용 위젯
- **스마트 알림 시스템** — 할일 `planStart` 기준 로컬 알림, 알림 권한 배너, iOS 16.4+ 안내, 클릭 시 DailyView 해당 할일로 이동 (`useNotification.ts`, `NotificationPermissionBanner.tsx`)
- **공통 TimePicker 컴포넌트** — ▲▼ 버튼 + 마우스 휠(분 1분단위) + 드롭다운 선택 패널 + 패널 직접 입력, 앱 전체 11곳 적용 (`TimePicker.tsx`)
- **공통 `+ 추가` 드롭다운 메뉴** — 일간/할일/캘린더 헤더에서 할일 추가·일정 추가를 같은 진입점으로 제공 (`AddEntryMenu.tsx`)
- **모바일 일간 탭 UI** — 모바일에서 할일 목록 / 타임라인 탭 전환 (`mobileTab` state, `lg:hidden` 탭 바), 데스크탑 좌우 분할 유지
- **모바일 캘린더 스크롤 구조** — 주별/일별 헤더 고정 + 타임라인 내부 단일 스크롤, 7열 자동 축소
- **공통 ConfirmModal** — `window.confirm()` 대체, `confirmDanger` prop으로 삭제(빨간)/일반(골드) 버튼 구분, 배경 클릭·ESC 닫기 (`ConfirmModal.tsx`)
- **자기관리 기록 수정** — 기록 행 hover 시 수정(✏️)/삭제(🗑️) 버튼 표시, `AddRecordModal` 수정 모드 지원 (`SelfCareView.tsx`)
- **습관 반복 설정 필터링** — 습관 탭에서 `isHabitApplicableOnDate` 적용, 오늘 요일에 해당하는 습관만 표시 (`HabitsView.tsx`)
- **습관 alarmTime 알림 연결** — `scheduleHabitAlerts(habits, date)` 추가, 알림 설정 시각에 푸시 알림 발송, 체크 완료 습관 skip (`useNotification.ts`)
- **루틴 반복 설정** — 루틴 편집 모달에 매일/평일/주말/직접 선택 UI, 오늘 해당 루틴만 목록/진행률 표시, Supabase `repeat`/`repeat_days` 컬럼 추가 (`RoutinesView.tsx`, `HabitsView.tsx`)
- **주간/월간 리뷰 Supabase 연동** — `weekly_reviews`, `monthly_reviews` 테이블 생성 및 CRUD 완성, 데이터 로드 후 state 동기화 (`store.tsx`, `db.ts`, `ReviewsView.tsx`)
- **자기관리 생리 기록** — 접기/펼치기 섹션, 시작일/종료일/흘림양/증상/메모 입력, 과거 기록 기반 평균 주기 + 다음 예상 시작일 자동 계산 (`SelfCareView.tsx` `PeriodSection`)
- **캘린더 생리 기간 핑크 점** — MonthView 날짜 셀에 period_records 기간 해당 날짜 핑크 원 표시 (`CalendarView.tsx`)
- **습관 트래커 탭 (FM002 스타일)** — 월별 날짜 점 히트맵 (PC: grid 균등, 모바일: 가로 스크롤), 습관 이유 표시, 이번달 메모 인라인 편집, 월간 회고 섹션 (`HabitsView.tsx` `HabitTrackerView`)
- **할일 페이지(`/todos`)** — 전체 할일 날짜별 그룹 + 미지정 할일 탭, 공통 TodoModal 날짜 네비, 프로젝트 배지
- **공통 TodoModal** — 날짜 직접 선택 + `미지정` 저장 지원, 날짜 없이 저장하면 `/todos`의 `미지정` 탭에 표시 (`TodoModal.tsx`)
- **EventModal** — 제목/종일/날짜/시간/장소/링크/반복/알림/메모/프로젝트/색상 입력으로 일정 생성 (`EventModal.tsx`)
- **이벤트 API 레이어** — `src/api/events.ts` 에서 Supabase `events` v2 스키마와 반복 일정 전개 유틸 제공
- **목표관리 페이지(`/goals`) 탭 개편** — 주간 목표 / 월간 목표 탭, 탭별 독립 날짜 네비, `WeeklyGoalsSection` 재사용
- **루틴 단계별 YouTube URL** — 편집 모달에 단계별 URL 입력(선택), 유효성 검증, 실행 화면에서 "영상 보기" 버튼 → 새 탭 열기
- **루틴 기능 통합** — 독립 루틴 페이지 대신 습관&루틴(`/habits`) 내부 루틴 탭을 사용하고, `/routines`는 `/habits`로 리다이렉트
- **메뉴 구조 개편** — 활성 네비게이션에서 보관함·브레인스토밍 제거, 월간→목표관리(`/goals`)로 정리, 할일 메뉴 추가
- **일간 할일 삭제 안정화** — 삭제 확인 모달 표시 중 컨텍스트 메뉴의 바깥 클릭 `mousedown` 닫힘을 차단해, 확인 버튼 클릭이 누락되지 않도록 수정 (`DailyView.tsx`)
- **모바일 하단 네비 개선** (`Layout.tsx`)
  - 하단 네비: 5개 고정 탭(대시보드·일간·캘린더·할일·습관&루틴)
  - 활성 탭: 골드 `accentLight` 배경 pill 강조
  - 모바일 상단 topbar 햄버거 버튼 → `MobileMenuOverlay` 바텀 시트(전체 페이지 4열 그리드)
- PWA 지원 (manifest + service worker + network-first/cache fallback)
- 일일 긍정 메시지 (AffirmationCard)
- **식단 기록 페이지(`/food`)** — 3탭(오늘/달력/통계), 7단계 바텀시트 추가 흐름, 식약처 영양성분 API 자동 검색, 사진 업로드(카메라/갤러리), 음성입력, 식사유형·맛평가, 도넛·바 차트 통계 (`FoodView.tsx`)
- **식약처 영양성분 API 프록시** — Vercel Edge Function `GET /api/food-nutrition?query=음식명` → 칼로리/탄수화물/단백질/지방 반환 (`api/food-nutrition.ts`)
- **일일 리포트(daily-report) Supabase Edge Function** — pg_cron이 KST 지정 시각(저녁 23:59 KST, `daily-report-evening`)에 호출 → 오늘(KST) 기준 **할일·습관·일정·식단·감정·독서·문화 기록** 7개 섹션을 조립해 Discord Webhook으로 전송. 섹션별 try/catch로 한 섹션 실패가 전체 전송을 막지 않음. events.start_at은 KST 벽시계 text라 동일 형식 문자열 범위로 조회(반복 일정 전개는 TODO). **문화 기록 섹션(Stage 4)**: `culture_records.created_at`(UTC timestamptz)을 KST 하루 경계(UTC ISO 변환)로 조회, 상태 아이콘+플랫폼 한글+별점(completed/dropped)·리뷰/인사이트 발췌(80자, 최대 8개, 1900자 방어 시 80→40→0 축소), 독서 다음 배치, 빈 상태는 섹션 유지+안내 문구 (`supabase/functions/daily-report/index.ts`, 명세: `DAILY_REPORT_SCHEMA.md`)
- **아침 어젠다(morning-report) Supabase Edge Function** — 저녁 회고 리포트와 별도 함수/별도 채널. KST 07:30(`30 22 * * *` UTC) cron → 오늘 **일정·할일(top3 우선)·습관** 3개 섹션을 어젠다 톤으로 조립해 **`DISCORD_MORNING_WEBHOOK_URL`** 웹훅으로 전송. 헤더 "☀️ 좋은 아침이에요", 마무리 "오늘도 화이팅 ✨". 섹션별 try/catch, esm.sh import 패턴 유지, daily-report 미변경 (`supabase/functions/morning-report/index.ts` + `README.md`)
- **모먼트 로그(`/moments`)** — 사진(카메라/갤러리, 최대 5장)+텍스트 작성·저장, 저장 시 Geolocation → Open-Meteo 날씨 자동 첨부, WMO 코드 → 이모지+한국어 매핑, 카드 날씨 배지 표시, 위치 거부 시 날씨 없이 폴백 저장 (`MomentView.tsx`)
- **질문일기(`/question-journal`)** — 오늘의 질문 탭(daily_question 랜덤 배정 + 답변 저장/수정), 질문 탐색 탭(내장 15개 + 커스텀 추가/삭제), 질문별 모아보기(연도별 섹션 + 5년 다이어리 스타일 카드, 바텀시트/모달 오버레이). Realtime 3테이블 연동 (`QuestionJournalView.tsx`)
- **문화 기록(`/culture`) — Stage 1 PC 레이아웃** — 영화/드라마/예능/유튜브 등 시청 콘텐츠 기록. 포스터 그리드(PC 6열, 2:3, 썸네일 또는 플랫폼 그라데이션+유형 아이콘 placeholder, 플랫폼 미니뱃지+상태 아이콘, hover 리프트), 플랫폼/유형/상태 칩 다중 필터 + 제목·태그 검색 + 정렬(기록일/본 날짜/별점), 0.5단위 인터랙티브 별점(`StarRating`), 추가/수정 모달(`CultureFormModal`, 리뷰·인사이트·태그·삭제), 빈 상태 UI, `culture_records` Realtime 구독. db.ts `cultureRecords` 레이어, store.tsx `CultureRecord` 타입. **모바일 전용 UI는 Stage 3 예정** (`CultureRecordView.tsx`, `culture/` 폴더)
- **문화 기록(`/culture`) — Stage 2 자동 fetch + 상태 관리** — YouTube oEmbed 자동 채움(`src/lib/youtube.ts`: URL onBlur/onPaste → 제목·썸네일·플랫폼=youtube·유형=youtube_video·external 채움, 비어있을 때만 덮어쓰지 않음), TMDB 검색 통합(`src/lib/tmdb.ts` + `culture/TMDBSearchPanel.tsx`: `VITE_TMDB_API_TOKEN` Bearer, `/search/multi` ko-KR, 300ms debounce, 포스터 그리드, 선택 시 제목·썸네일·유형·external 채움·platform 제외), 카드 hover 상태 빠른 변경(chevron 드롭다운, optimistic update + 롤백, `db.cultureRecords.updateStatus`), 경량 토스트(`culture/CultureToast.tsx`). 자동 채움 출처를 `external_source`로 기록(youtube/tmdb_movie/tmdb_tv/manual)
- **문화 기록(`/culture`) — Stage 3 모바일 레이아웃** — PC/모바일 트리 분리(`hidden lg:block` / `lg:hidden`)로 PC 무변경. 모바일 sticky 헤더(검색 토글·상태 가로탭·필터 트리거), 3열 포스터 그리드, 모바일 전용 카드(`CultureCardMobile`), 필터 bottom sheet(`culture/CultureFilterSheet.tsx` — 플랫폼/유형/정렬, 초기화/적용), full-screen 슬라이드업 모달(`max-lg` 키프레임, 헤더 ←·저장, 상단 빠른 상태칩 즉시반영), 골드 FAB(safe-area), 로딩 스켈레톤. TMDB 결과 모바일 1열 리스트. 햄버거 메뉴 진입점은 Stage 1에서 추가됨
- **모바일 타임라인 블록 생성 — 롱프레스 방식** — 빈 타임라인을 0.5초 꾹 누를 때만 블록 생성 모드 활성화(기본 30분 프리뷰 + 진동), 이전 드래그 방식은 일반 스크롤과 충돌했음. `WebkitTouchCallout/WebkitUserSelect: none` 으로 iOS 시스템 텍스트 선택 메뉴 차단 (`DailyView.tsx`)
- **DO 블록 독립 삭제** — DO 블록 삭제 시 `doStart/doEnd/doElapsedSec`만 비워 PLAN은 유지(기존: `deleteTodo`로 할일 전체 삭제됨). DO 블록도 모바일 롱프레스 컨텍스트 메뉴 지원 (`DailyView.tsx`)
- **식단 단식 기록** — 음식 추가 첫 단계(끼니 선택) 하단의 "🚫 끼니별 단식" 버튼으로 거른 끼니를 한 번에 기록(`FoodRecord.isFasting`, `food_records.is_fasting`). 기록 카드는 점선 🚫 표기, 식단 달력 셀 4분할에서 단식 끼니 🚫 표시, 통계에 "끼니별 단식" 분포 카드 추가(식비/칼로리/TOP5 등 일반 통계는 단식 제외) (`FoodView.tsx`)
- **캘린더 월별/주별 탭 색상** — 파란 계열을 서비스 골드/베이지 톤으로 통일(베이지 컨테이너 + 골드 활성 탭) (`CalendarView.tsx`)
- **할일 미루기 배지 정리** — 일간 미루기 시 `status`를 `snoozed`가 아닌 `active`로 저장해, 미룬 날짜 이동은 유지하되 "미루기" 상태 배지는 표시하지 않음(백로그 미루기와 동작 통일) (`DailyView.tsx`)
- **레시피 모듈(`/recipes`) — Phase 1a (직접입력 CRUD)** — `recipes`/`recipe_ingredients`/`recipe_steps` 3개 테이블(소유자 RLS, 자식은 소속 recipe EXISTS 기반, Realtime publication 3개 등록). `RecipeView` 목록 페이지(저장한 레시피 카드 그리드, 검색, 우하단 골드 FAB, 빈 상태 UI, 썸네일 placeholder=ChefHat+조리시간 배지+별점+재료/단계 수). `RecipeFormSheet` 추가/수정 시트(모바일 full-screen 슬라이드업 / PC 센터 모달): 이름·기준 인분 스테퍼·조리시간·재료(한 줄에 하나, "이름 수량 단위" 자동 파싱)·단계별 선택 타이머(분)·출처 링크·썸네일. `recipe/recipeUtils`: 재료 라인 파싱(분수/소수 지원)·인분 환산·타이머 포맷 (`recipe/RecipeListTab.tsx`, `recipe/RecipeFormSheet.tsx`, `recipe/recipeUtils.ts`)
- **레시피 모듈(`/recipes`) — Phase 2a (냉장고 + 모듈 하단 탭 네비)** — `RecipeView`를 모듈 셸로 재구성: 내부 탭 **레시피 / 냉장고 / 장보기**(라우트 변경 없이 상태로 전환), Phase 1 목록은 `RecipeListTab`으로 분리. 모바일은 글로벌 5탭 네비(56px) 바로 위 `bottom:56px` 별도 탭바(높이 54px), 스크롤 padding-bottom·FAB `bottom`을 124px+safe-area로 통일해 가림 방지; PC는 헤더 우측 세그먼트 컨트롤. `fridge_items`/`shopping_items` 테이블(소유자 RLS, Realtime; `source_recipe_id`는 Phase 3 대비 `ON DELETE SET NULL`로만 미리 둠). **냉장고 페이지**(`FridgeTab`): 요약(전체/임박 D-2 이내/다 떨어짐 — 위험 토큰 강조), 카테고리 섹션(냉장·냉동·실온, 섹션 내 유통기한 빠른 순; 기한 없는 건 뒤로), 행별 D-day(클라이언트 자정 기준 일수 계산, `D-day`/`D-n`/`D+n`)·수량 +/− 스테퍼(낙관적 업데이트), D-2 이내 강조 배경·테두리, 수량 0은 dim+취소선+"다 떨어짐". `FridgeItemSheet` 직접 추가/수정(이름·카테고리 3택·수량 스테퍼·단위·유통기한). `ShoppingTab`은 2c 전까지 플레이스홀더 (`RecipeView.tsx`, `recipe/FridgeTab.tsx`, `recipe/FridgeItemSheet.tsx`, `recipe/ShoppingTab.tsx`)
- **캘린더 하단 상세 패널 직접 관리** — 조회 전용이던 패널을 일간 페이지와 동일한 CRUD로 확장 (`CalendarView.tsx`)
  - 섹션: 할일/일정/습관/자기관리/메모 (divider 구분), 상단 필터 탭(전체/할일/일정/습관/자기관리)과 일관 동작
  - 할일: 원형 완료 체크박스 토글, 항목 탭 → `TodoModal` 수정, → 다음날 미루기, x 삭제. `expandRecurringTodos`로 반복 할일 인스턴스 포함 표시
  - 삭제: 반복 할일은 `RecurrenceBranchModal`("이 항목만/이후/전체"), 일반 할일·일정은 `ConfirmModal` 확인 팝업
  - 일정: 완료 개념 없어 수정(`EventModal`)/미루기/삭제만. store 핸들러 재사용으로 일간과 동작·데이터(Supabase) 일치, 디자인 토큰만 사용·PC 레이아웃 미변경

---

## 5. 미구현 또는 버그 있는 기능 목록

### 🔴 버그 (즉시 수정 권장)

| 위치 | 문제 | 증상 | 상태 |
|------|------|------|:----:|
| `DailyView.tsx` (구 L856-861) | `timelineLogs` 로컬 state에 mock 데이터 하드코딩 | 전역 store와 무관하게 동작, 새로고침 시 목 데이터로 초기화 | ✅ 수정 완료 |
| `DailyView.tsx` (구 L952-958) | `addTimelineLog` / `deleteTimelineLog`가 로컬 state만 업데이트 | Supabase에 저장 안 됨 (store의 전역 함수 미사용) | ✅ 수정 완료 |
| `DailyView.tsx` (ContextMenu 삭제 플로우) | 삭제 확인 모달에서 버튼 클릭 시 컨텍스트 메뉴가 먼저 닫혀 onConfirm 누락 가능 | 팝업 "삭제" 클릭 후 할일이 삭제되지 않음 | ✅ 수정 완료 |
| `DailyView.tsx` (모바일 타임라인) | 아래 드래그 8px 이상이면 블록 생성 → 일반 스크롤에도 블록 생성, 위 스크롤 불가 | 스크롤 시 타임블록 자동 생성 | ✅ 수정 완료 |
| `DailyView.tsx` (DO 블록 삭제) | DO 블록 `deleteTodo(id)` → PLAN/DO 공유 todo 전체 삭제 | DO 지우면 PLAN도 사라짐 | ✅ 수정 완료 |
| `events` 테이블 / `api/events.ts` | 운영 DB가 옛 스키마(date/start_time/end_time)만 보유, 코드가 쓰는 start_at 등 컬럼 누락 → `GET /events` 400 | 일정 추가/조회 전면 중단 + store Promise.all reject로 태그 등 미반영 | ✅ 수정 완료 (마이그레이션) |
| `food_records` 테이블 | dining_type CHECK 제약에 'coffee' 누락 (코드는 home/delivery/restaurant/coffee 제공) | 카페 식단 저장 시 400 → 화면엔 보였다가 재접속 시 사라짐 | ✅ 수정 완료 (마이그레이션 `20260601000000`) |
| `DailyView.tsx` (TodoRow) | `TodoRow`를 컴포넌트 내부에서 `<TodoRow/>` 엘리먼트로 렌더 → 매 렌더 새 타입 → 행 unmount/remount | 모바일(iOS)에서 할일 체크박스 탭이 유실되어 토글 안 됨 | ✅ 수정 완료 (함수 호출 인라인 렌더) |
| `store.tsx` / `DailyView.tsx` (반복 인스턴스) | 가상 id(`parentId::date`)에 `updateTodo`/`startTimer` 호출 → DB에 없는 id라 no-op | 반복 할일 인스턴스의 완료·실행·미루기·상태변경이 안 됨 | ✅ 수정 완료 (`ensureMaterializedTodoId`로 예외 레코드 구체화) |
| `TodoModal.tsx` (반복 수정) | 가상 인스턴스 편집 시 "반복 일정입니다" 배너만 노출, 설정 숨김 | 반복 주기 변경·반복 해제 불가 | ✅ 수정 완료 (분리 예외만 배너, 그 외 설정 UI 노출) |

### ⚠️ 새로고침 시 데이터 소실 (Supabase 미연동)

모든 데이터 Supabase 연동 완료 ✅

### ❌ 미구현 기능

| 기능 | 설명 |
|------|------|
| PWA 오프라인 모드 | 기본 service worker 캐시(`network-first + cache fallback`)는 있으나 정교한 오프라인 동기화/캐시 정책은 미구현 |
| 데이터 내보내기/가져오기 | 미구현 |
| 사용자 인증 (멀티유저) | 현재 단일 사용자 구조 |
#### 문화 기록(`/culture`) 향후 Stage 로드맵
- **Stage 1** ✅ — PC 포스터 그리드, 칩 필터·검색·정렬, 별점, 추가/수정 모달, Realtime
- **Stage 2** ✅ — YouTube oEmbed 자동 채움 + TMDB 영화·드라마 검색 통합 + 카드 빠른 상태 변경
- **Stage 3** ✅ — 모바일 전용 레이아웃(sticky 헤더, 3열 그리드, 필터 bottom sheet, full-screen 모달, FAB)
- **Stage 4** ✅ — 저녁 daily-report Discord 리포트에 "오늘의 문화 기록" 섹션 연동(독서 다음, 상태/플랫폼/별점/발췌, 길이 방어)
  - 향후: 통계/대시보드(플랫폼·유형별 시청량·별점 분포·월별 추이), 모먼트/리뷰 연동, Claude API 인사이트(별점 4+ 하이라이트, 주간/월간 문화 통계)

---

## 6. 컴포넌트 구조도

```
App.tsx
└── ThemeProvider (ThemeContext)
    └── PlannerProvider (store.tsx)
        └── RouterProvider (routes.tsx)
            ├── GlobalFloatingTimer
            ├── PWABanner
            ├── IOSInstallGuide
            └── RootLayout
                ├── Layout (테마 A/B/D — 사이드바)
                │   ├── aside (좌측 사이드바)
                │   │   ├── 네비게이션 링크
                │   │   ├── 프로젝트 목록
                │   │   ├── SidebarNewProjectForm
                │   │   └── MiniCalendar
                │   ├── main
                │   │   └── <Outlet /> → 각 페이지 컴포넌트
                │   └── aside (우측 패널)
                │       └── RightPanel (주간/월간 목표, 습관 요약)
                │
                └── LayoutC (테마 C — 탑네비)
                    ├── header (상단 네비바)
                    │   ├── 로고
                    │   ├── 네비게이션 탭
                    │   └── CalendarDropdown
                    ├── main (60%)
                    │   └── <Outlet /> → 각 페이지 컴포넌트
                    └── aside (40%)
                        └── DashboardPanel

페이지 컴포넌트
│
├── DailyView
│   ├── AddEntryMenu (`+ 추가` 드롭다운)
│   ├── TodoRow (할일 행 — ?todoId 파라미터로 하이라이트+스크롤)
│   ├── TodoModal (추가/편집)
│   ├── EventModal (일정 추가/편집)
│   ├── SnoozeModal (미루기)
│   ├── ContextMenu (우클릭 메뉴)
│   ├── TimelineLogModal (로그 추가)
│   └── TimelineSettingsModal (시간대 설정)
│
├── CalendarView
│   ├── AddEntryMenu (`+ 추가` 드롭다운)
│   ├── MonthView (월별 그리드)
│   ├── WeekView (주별 타임라인)
│   └── DayViewPanel (일별 미니 타임라인)
│
├── WeeklyView
│   ├── UnassignedTodoItem (날짜 미지정 할일 카드 — 드래그 + 날짜 배정)
│   ├── AssignDayPopover (요일 배정 팝오버)
│   ├── DayColumn (요일별 할일 칼럼 — useDroppable)
│   ├── DraggableTodoCard (드래그 가능한 할일 카드 — useDraggable)
│   └── OverlayCard (드래그 중 표시되는 고스트 카드 — DragOverlay)
│
├── TodosView
│   ├── AddEntryMenu (`+ 추가` 드롭다운)
│   ├── TodoRow (상태토글·Top3·태그칩·프로젝트배지·편집/삭제)
│   ├── AllTodosTab (날짜별 그룹, 완료 접기/펼치기)
│   └── UnassignedTab (미지정 할일, 날짜 배정 패널)
│
├── MonthlyView (목표관리 /goals)
│   ├── WeeklyGoalsSection (WeeklyView에서 export, 재사용)
│   └── MonthlyGoalsContent (이달 목표+통계+습관 달성률)
│
├── HabitsView
│   ├── HabitModal (추가/편집 — 5종 목표 유형, reason, 이번달 메모)
│   ├── HabitChip (유형별 위젯: check/count/time/value/memo)
│   ├── HabitTrackerView (FM002 스타일 월별 점 히트맵 + 월간 회고)
│   ├── RoutineCard (RoutinesView에서 export, 재사용)
│   ├── RoutineModal (RoutinesView에서 export, 재사용 — 단계 목록 + YouTube URL)
│   └── ExecutionPanel (RoutinesView에서 export, 재사용 — 타이머 + 단계 체크 + 영상 보기)
│
├── RoutinesView (페이지 없음, 컴포넌트 모듈로만 존재)
│   ├── export RoutineModal
│   ├── export RoutineCard
│   └── export ExecutionPanel
│
├── ReviewsView
│   ├── DailyReviewForm (감정/감사/KPT)
│   ├── ReviewCard (기록 목록)
│   ├── WeeklyReviewForm
│   └── MonthlyReviewForm
│
├── SelfCareView
│   ├── PeriodSection (생리 기록 — 접기/펼치기, 입력폼, 예측, 기록목록)
│   ├── SleepSection (수면 기록 — 취침/기상, 7일 바차트)
│   ├── SelfCareForm (기록 추가 모달)
│   └── SelfCareCard (기록 카드)
│
├── ProjectView
│   ├── ProjectsView (목록)
│   │   └── NewProjectModal
│   └── ProjectDetailView (상세)
│       ├── MilestoneItem
│       └── 관련 할일 목록
│
├── DashboardView
│   ├── StatCard (통계 카드)
│   ├── AffirmationCard (긍정 메시지)
│   ├── HabitChips (오늘 습관)
│   └── TodoSummary (Top3 + 기한 초과)
│
├── BacklogView (현재 라우트 미연결)
│   ├── BacklogTodoRow
│   └── AddBacklogModal
│
├── BrainstormView (현재 라우트 미연결)
│   ├── BrainstormItemCard
│   ├── ConvertToTodoModal
│   └── ConvertToEventModal
│
├── MomentView (/moments)
│   └── (단일 컴포넌트 — 작성 카드 + 목록 카드)
│
├── QuestionJournalView (/question-journal)
│   ├── TodayTab (오늘의 질문 — daily_question 배정, 답변 저장/수정)
│   ├── ExploreTab (질문 탐색 — 내장/커스텀 목록, 추가/삭제)
│   ├── HistoryPanel (질문별 모아보기 — 바텀시트/모달, 연도별 섹션)
│   ├── AnswerCard (날짜별 답변 카드 — 최신 배지, 골드 테두리)
│   └── QuestionItem (질문 카드 — 기록 보기 버튼, 삭제)
│
├── FoodView (/food)
│   ├── TodayTab (오늘 식단 — 요약 카드 + 식사 섹션별 기록)
│   │   └── MealSection (아침/점심/저녁/간식 + FoodCard)
│   ├── CalendarTab (월별 그리드 + 날짜별 기록 목록)
│   ├── StatsTab (식비·도넛차트·TOP5·맛있었던것·칼로리바차트)
│   └── AddFoodSheet (7단계 바텀시트 — 시간대/사진/음식명+영양검색/식사유형/금액/칼로리/맛평가)
│
├── RecipeView (/recipes) — Phase 1a + 2a 모듈 셸 (내부 탭 네비)
│   ├── 모듈 sticky 헤더 (활성 탭 아이콘+제목, PC 우측 세그먼트 컨트롤)
│   ├── 모바일 하단 탭바 (lg:hidden, glob nav 위 bottom:56px, 높이 54)
│   ├── RecipeListTab (Phase 1a + D-1 — 저장한 레시피 카드 그리드 + 검색 + FAB + 매칭 섹션)
│   │   ├── RecipeCard (matchBadge: ✓재료있음 / 1개 부족 / D-N 이름)
│   │   ├── CookableSection (지금 만들 수 있어요 — ready + oneMissing)
│   │   ├── UrgentRecipesSection (유통기한 임박 재료 레시피 — D-2 이내)
│   │   └── recipe/RecipeFormSheet (full-screen 슬라이드업 / PC 모달, 재료·단계·타이머 입력)
│   ├── RecipeDetail (Phase 1b + D-2 — 재료 있음/부족 칩 + 부족 재료 장보기 담기, 출처 임베드, 인분 환산, 만든 기록)
│   ├── FridgeTab (Phase 2a — 요약 + 카테고리 섹션 + 수량 스테퍼 + FAB)
│   │   ├── FridgeRow (D-day·수량 +/−, D-2 강조, 수량 0 dim+취소선)
│   │   ├── SummaryCard (전체/임박/다 떨어짐)
│   │   └── recipe/FridgeItemSheet (이름·카테고리·수량·단위·유통기한)
│   ├── ShoppingTab (Phase 2c 본 구현 예정, 현재 플레이스홀더)
│   ├── recipe/recipeUtils (parseIngredientLine / parseQuantity / formatScaledAmount / formatTimerLabel)
│   └── recipe/fridgeMatch (D — 정규화·동의어 매칭 / classifyCookable / findUrgentRecipes / evaluateIngredients)
│
├── CultureRecordView (/culture) — PC(Stage 1·2) + 모바일(Stage 3) 트리 분리
│   ├── CultureCard (PC 포스터 카드 — 플랫폼 뱃지, 상태 아이콘 + hover 상태 빠른변경 드롭다운)
│   ├── CultureCardMobile (모바일 카드 — 아이콘만, 탭→수정 모달, hover 없음)
│   ├── SkeletonGrid (모바일 로딩 스켈레톤 3×2)
│   ├── EmptyState (빈 상태 — 첫 기록 유도, PC·모바일 공용)
│   ├── culture/CultureFormModal (추가/수정 모달 — PC 센터 / 모바일 full-screen 슬라이드업, YouTube 자동채움 + TMDB 토글 + 빠른 상태칩)
│   ├── culture/TMDBSearchPanel (TMDB 검색 — PC 3열 그리드 / 모바일 1열 리스트)
│   ├── culture/CultureFilterSheet (모바일 필터 bottom sheet — 플랫폼/유형/정렬)
│   ├── culture/StarRating (0.5단위 별점 — read-only/인터랙티브)
│   ├── culture/CultureToast (경량 토스트 — useToasts/ToastHost)
│   ├── culture/cultureMeta (플랫폼/유형/상태/정렬 라벨·색상·아이콘 메타)
│   ├── lib/youtube (oEmbed — extractYouTubeVideoId/fetchYouTubeMetadata)
│   └── lib/tmdb (TMDB search/multi — searchTMDB/getPosterUrl/hasTMDBToken)
│
└── 공통 컴포넌트
    ├── AddEntryMenu — `+ 추가` 버튼 드롭다운 (할일 추가 / 일정 추가)
    ├── TodoModal — 할일 추가/편집 모달 (날짜 직접 선택, 미지정 저장 가능)
    │   └── 적용: DailyView, TodosView, CalendarView
    ├── EventModal — 일정 추가/편집 모달
    │   └── 적용: DailyView, TodosView, CalendarView
    ├── TimePicker — ▲▼ 버튼 + 휠(분 1분단위) + 드롭다운 패널 + 패널 직접 입력
    │   └── 적용: DailyView 6곳, HabitsView 2곳, RoutinesView 1곳
    ├── ConfirmModal — window.confirm() 대체 커스텀 확인 모달
    │   └── 적용: DailyView, TodoModal, TodosView, ProjectView, BacklogView
    ├── NotificationPermissionBanner — 알림 권한 요청 배너 (`Layout.tsx` 모바일/데스크탑 main에 마운트)
    │   └── useNotification — 알림 권한 관리, 할일 planStart 기준 알림 스케줄링
    └── MobileMenuOverlay (Layout.tsx 내부) — 모바일 상단 메뉴 버튼으로 여는 전체 메뉴 바텀 시트 오버레이
```

---

## 부록: 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 번들러 | Vite 6 |
| 스타일 | Tailwind CSS v4 |
| 라우팅 | React Router v7 |
| 상태관리 | React Context API (PlannerContext) |
| UI 컴포넌트 | shadcn/ui + Radix UI |
| 아이콘 | Lucide React |
| DB/백엔드 | Supabase (PostgreSQL) |
| 배포 | Vercel (PWA) — `vercel.json` SPA 라우팅 rewrite 설정 포함 |
| 날짜 처리 | date-fns |
| 드래그앤드롭 | @dnd-kit/core + @dnd-kit/utilities |
