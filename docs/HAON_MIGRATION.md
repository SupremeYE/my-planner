# Haon 디자인 마이그레이션 — 일간 페이지 레퍼런스

> **목적:** 일간(DailyView) 페이지가 Haon "Soft Pastel — Solid Elevation" v1.1의 **레퍼런스 구현**이다.
> 다른 페이지를 마이그레이션할 때 이 문서의 표면 모델·토큰·헬퍼·규칙을 그대로 따른다.
> UI 단일 기준은 루트 `DESIGN.md`. 이 문서는 그 구현 현황과 페이지 이전 지침을 정리한다.

최종 업데이트: 2026-07-11

---

## 1. 적용된 디자인 시스템
- **Haon "Soft Pastel — Solid Elevation" v1.1** (루트 `DESIGN.md`가 단일 기준)
- **테마 H** (`tokenH`, `src/app/ThemeContext.tsx`)에 구현. **기본 테마도 H** (`DEFAULT_THEME = 'H'`)
- **게이팅 원칙:** 신규 파스텔 스타일은 `isHaon(t) = !!t.cardFrosted`(사이드바는 `isPastel`)로 **H 테마에서만** 적용.
  기존 테마(A/B/C/D)는 전부 원래대로 유지 → **회귀 0, opt-in 마이그레이션.**

## 2. 표면 모델 (가장 중요한 규칙)
| 구분 | 처리 | backdrop-filter |
|---|---|---|
| **본문**(카드·행·배너·입력) | **솔리드** — 불투명 흰색 + 하이라인 테두리 + 소프트 그림자 | ❌ 없음 |
| **오버레이**(상단 날짜 바·모바일 탭바·모달·팝오버) | **글래스** — 반투명 + blur | ✅ 여기만 |

> 규칙: **스크롤과 함께 움직이면 솔리드, 화면 위에 떠 있으면 글래스.**

## 3. 토큰 (`tokenH` 확장 — `ThemeContext.tsx`)
- **캔버스:** `appGradient` (near-white `#FBF8FC` + 라일락/코랄 방사형 blob 2개)
- **솔리드 카드:** `solidCardBg #FFF` / `solidCardBorder rgba(122,92,162,.12)` / `solidCardShadow 0 8px 20px rgba(120,90,160,.12)` / `solidCardRadius 20`
- **솔리드 행(항목 카드):** `solidRowBorder rgba(122,92,162,.20)`(더 진함) / `solidRowShadow`(2겹, 입체감) / `solidRowRadius 14`
- **기록 카드:** `recordCard*` (솔리드 카드와 동일 recipe)
- **핵심(KEY) 행:** `keyRowBg #FFF5F2` / `keyRowBorder rgba(255,111,145,.35)` / `keyRowShadow`(핑크 글로우)
- **글래스:** `cardFrosted rgba(255,255,255,.55)` / `glassBorder` / `glassBlur blur(20px) saturate(140%)`
- **그라데이션:** `primaryGradient`(코랄→핑크, 주 CTA·강조) / `accentGradientWarm` / `accentGradientCool`
- **그림자:** `shadowCard` / `shadowButton`(핑크) / `shadowFab`
- **타임블록:** `blockDefaultBg/Border/Text`(라일락) / `nowLine #FF9A8B`(소프트 코랄)
- **색·타이포:** `accent #FF6F91` / `accentLight #F6BCBA` / `accentSoft #F4E7FB`(라벤더) / `text #2E2A5B` / `textSub` / `textMuted` / `bgHover #EFE3FA` / `fontNumeric(Sora)`

## 4. 공용 헬퍼 — `src/app/styles/haonStyles.ts` ✅ 추출 완료
페이지 마이그레이션용 공유 모듈. 각 페이지는 여기서 import 해서 동일 recipe를 재사용한다.

| 헬퍼 | 용도 |
|---|---|
| `isHaon(t)` | 파스텔(H) 테마 게이팅 (`!!t.cardFrosted`) |
| `canvasStyle(t)` | 페이지 캔버스 배경(방사형 blob) |
| `solidCardStyle(t)` | 본문 카드(불투명 흰색 + 하이라인 + 소프트 그림자) |
| `solidRowStyle(t)` | 항목 행 카드(진한 테두리 + 2겹 그림자) |
| `glassBarStyle(t)` | 오버레이 글래스(떠 있는 바) |
| `mixHex()` / `hexToRgb()` | 태그 칩 채도 파스텔 채움 + 어두운 텍스트 |

> 모든 헬퍼는 `isHaon(t)`가 아니면 기존(base 토큰) 스타일을 반환 → 다른 테마에서 안전.

## 5. 일간 페이지 요소별 적용 현황 ✅
- 캔버스 배경 blob / 상단 날짜 바·모바일 탭바 **글래스**
- 던지기 박스(`QuickAddInput solid` prop) → 솔리드 + **코랄 그라데이션 + 버튼**
- 오늘 일정 카드 → 솔리드 / 이벤트 항목도 **솔리드 행 카드화**
- 오늘 할 일 카드 → 솔리드 / 할 일 행 → 솔리드 행(진한 테두리 + 2겹 그림자) + **태그 좌측 3px 액센트 바**
- **핵심(KEY) 섹션 분리**("⭐ 핵심 n/3" 헤더 + "그 외" 구분선) + 코랄 좌측 바·틴트·글로우·'핵심' 배지
- 기록 카드 / 습관 배너 → 솔리드
- 태그 칩 → 채도 파스텔 채움 + 어두운 텍스트 (`mixHex`)
- 타임라인 블록·now 라인 파스텔
- **Today 버튼** → 라벤더 pill(레드온레드 제거) / **스크롤바 숨김**(레이아웃 시프트 제거)
- **사이드바 hover 피드백**(전역 chrome, `Layout.tsx`, 파스텔 한정)

## 6. 상호작용·반응형
- 전환은 `transition-all`(~150ms).
- 모바일 **오늘/타임블록 2탭** + 하단 네비, `lg:` prefix로 PC/모바일 개별 최적화 유지.

## 7. 다른 페이지 마이그레이션 지침
**따라야 할 규칙**
1. 페이지마다 `isHaon(t)` 게이팅으로 opt-in (기존 테마 보존).
2. 카드 = `solidCardStyle`, 항목 행 = `solidRowStyle`, 오버레이만 `glassBarStyle`, 강조 = `primaryGradient`, 태그 = `mixHex`.
3. `backdrop-filter`는 오버레이 전용, 페이지 배경은 `canvasStyle`.
4. **토큰만 사용, 하드코딩 금지** (필요한 토큰이 없으면 `tokenH`에 추가).
5. 기본 테마 전환은 **전 페이지 완료 후** (DESIGN.md §10). 지금은 opt-in 단계.

**참고**
- `QuickAddInput`은 `solid` prop opt-in → 다른 페이지에서 쓸 때 `solid` 전달 필요.
- 다른 페이지들은 아직 미마이그레이션 — 지금은 파스텔 캔버스 위에 기존(base 토큰) 카드로 렌더됨.

## 8. 페이지별 진행 체크리스트
- [x] 일간 (DailyView) — 레퍼런스 완료
- [x] 공용 헬퍼 추출 (`haonStyles.ts`)
- [x] 공용 편집 모달 3종 (`TodoModal`·`EventModal`·`TimelineAddModal`) — **Stage 1 토큰 정합만**
      (STAGE0 보고서 V1~V5): 입력 배경 §5 solid-card(흰색)·세그먼트 §5(흰 pill+코랄 언더라인, 풀필 제거)·
      danger 계열 토큰 회수, 전부 `isHaon` 게이트(비-H 픽셀 보존). 신규 헬퍼 `inputBg`/`dangerText`/
      `dangerFill`/`segmentTrackStyle`/`segmentItemStyle`(§5 근거). 구조·동작·`TimePicker`·실적칸·반복·
      Top3·모달 컨테이너 글래스는 **범위 밖**(후속 Stage). 미해소: V2 `planBlock/doBlock`·`#7B9ED9`(사유는 아래 §9)
- [ ] 대시보드 (DashboardView)
- [ ] 캘린더 (CalendarView)
- [x] 할일 (TodosView) — 순수 스타일 마이그레이션 (태그 칩·좌측 액센트 바 parity는 별도 태스크)
- [ ] 주간 (WeeklyView)
- [ ] 목표관리 (Goals / Projects)
- [ ] 습관 & 루틴
- [ ] 리뷰 & 기록
- [ ] 자기관리(건강/식단/독서 등 라이프스타일)
- [ ] 설정
- [~] 시각 입력 컴포넌트 이전 (`TimePicker` → `TimeField`/`HourField`) — 아래 §10 참조.
      **DESIGN.md 등록 완료**(§5 「시각 입력」). Stage 4a-1: `TimeField` 생성 + `TodoModal` plan 2곳 이전
      완료. 잔여(do 2 + 10파일)는 후속 Stage(§10.1).
- [ ] (전 페이지 완료 후) 기본 테마 파스텔 확정

## 9. 알려진 기존 이슈 (이번 리팩터 범위 아님, 참고용)
- KEY n>3 시 헤더 "4/3"(소프트 캡, 의도됨).
- 스토어 `toggleTop3`(하드 3) vs DailyView `toggleKeyTodo`(소프트 토스트) 캡 정책 불일치.
- Dashboard '중요' 카운트는 `starred` 필드 사용(≠ `isTop3`).
- **편집 모달 Stage 1 미해소분(의도된 보류):**
  - **V2** `TimelineAddModal` `planClr`/`doClr`(`#C4A882`/`#6BAA7A`): H 세그먼트가 §5 무채움(코랄 언더라인)이라
    `t.planBlock`/`t.doBlock` 소비처가 없고, 비-H 는 픽셀 보존을 위해 하드코딩 유지 필요 → 토큰 미채택. 두 리터럴은
    `segmentItemStyle`의 비-H `legacyFill` 로만 참조됨.
  - `#7B9ED9`(일정 색): 대응 색 토큰 부재 → 유지(임의 신규 토큰 생성 금지).
  - `#5B8FD8`/`#EEF6FF`/`#C0D8F8`(TodoModal 분리-예외 배너): info 계열 **배경/보더 토큰 부재**(있는 건 `t.info` 텍스트뿐)
    → 부분 매핑 시 불일치라 전체 보류.
  - 모달 컨테이너 자체의 §5 글래스(`glassBarStyle`) 전환: 밀도 높은 폼 가독성 리스크로 이번엔 미적용(디자인 검토 후 후속).
  - `'#fff'`(활성 칩/버튼 텍스트)·`rgba(0,0,0,0.4)`(오버레이 scrim): 과제에서 이번 범위 제외로 명시됨.

## 10. 시각 입력 컴포넌트 이전 (`TimePicker` → `TimeField` / `HourField`)
> 디자인 계약은 `DESIGN.md` §5 「시각 입력」. 실측 소비처 조사는 `docs/STAGE4A0_TIMEPICKER_CALLSITES.md`
> (12파일 / 23인스턴스 / 2종 분류). 이 절은 **이전 지침**만 담는다.

- **전량 이전 후 삭제.** `TimePicker`(`src/app/components/TimePicker.tsx`)는 `TimeField`(19인스턴스 /
  10파일) + `HourField`(4인스턴스 / 2파일)로 **전량 이전한 뒤 삭제**한다. 두 컴포넌트 공존은 이전 기간 한정.
- **이전 순서(각 단계 STOP):** `TodoModal` → `EventModal` → `TimelineAddModal` → 나머지 7파일
  (`BrainstormView`·`CalendarView`·`SleepTimeEditModal`·`DailyView`·`RoutinesView`·`HabitsView`·
  `TimelineLogModal`) → `HourField` 2파일(`SettingsView`·`TimelineSettingsModal`).
- **종류 B(`HourField`)는 종류 A 이전에 영향받지 않는다** — 파일이 겹치지 않는다(독립 이전 가능).
- **조용히 망가지는 곳 우선 경계:**
  - `SettingsView` / `TimelineSettingsModal`(하루 경계) — 이 값이 **전 기록의 날짜 버킷팅**을 좌우한다.
    경계 오저장 시 자정 근방 기록이 엉뚱한 날짜로 새고 화면엔 즉시 안 보인다. `HourField` 이전 1순위.
  - `HabitsView` 알림(`alarmTime`) — 알림 발화 실패는 화면에 드러나지 않음(무음 실패).
- **무음 손실 제거가 이전의 핵심.** 현재 두 경계 호출부는 `minuteStep={1}`로 분을 받고 저장 시 버린다
  (`parseInt(split(':')[0])`). `HourField`는 분 입력 UI 자체를 없애 받은 값 = 저장 값을 보장한다.
- **실적 라벨 색 보존.** `TodoModal` 실적(DO) 쌍 라벨의 `t.success`(§7.2 증감 토큰과 별개, 계획/실적 구분용)는
  이전 시 호출부에 **그대로 둔다** — 컴포넌트 종류(둘 다 `TimeField`)와 무관하다.
- **`haonStyles.ts` 신규 헬퍼 없음(Stage 4a-1 확정).** 트리거 표면 = 기존 `inputBg`, 팝오버 = 기존
  **`addPopoverStyle`**(떠 있는 드롭다운 패널 recipe; 상단 바 전용 `glassBarStyle` 아님 — DESIGN.md §5
  「시각 입력」도 이에 맞춰 정정됨). 목록 항목 상태(hover/active·정시/30분 강약)는 기존 토큰
  (`t.bgSub`·`t.accentLight`·`t.accent`·`t.text`·`t.textMuted`) 인라인 조합으로 커버.

### 10.1 Stage 4a-1 진행 현황 (2026-07-18)
- **`TimeField` 신규 생성** (`src/app/components/TimeField.tsx`). 모바일 = `<input type="time">`(OS 위임),
  PC(`lg:`) = 콤보박스(타이핑·5분 목록·정시/30분 강조·↑↓/Enter/Esc·종료 duration 병기·시작 이전 배제).
  `minuteStep` 미수용(5분 고정). `role='end'` 모바일 duration chip(시작 + chip = 종료 자동설정).
- **[x] `TodoModal` 계획(plan) 시작/종료 2곳 이전 완료.** `isHaon(t) ? <TimeField> : <TimePicker>`
  조건 렌더 — **H만 TimeField, A/B/C/D는 `TimePicker` 그대로**(회귀 0). start 확정 → 종료 포커스 이동
  (`planEndRef`). 저장 로직·plan 컬럼 매핑·모달 레이아웃 불변.
- **非-H 폴백:** `TimeField` 내부에도 안전망 정의(콤보박스 없이 전 브레이크포인트 네이티브 + `inputBg`).
  단 TodoModal이 게이트하므로 이번 소비처에선 미사용.
- **라벨 = Stage 2에서 계획/실제 대칭으로 확정**(§10.3). 초기엔 "계획 라벨 제거"로 계획했으나, do를
  읽기전용 요약으로 남기기로 하면서 `[계획]/[실제]` 위아래 대칭 라벨로 변경. `hasDoTime ? '계획 시작' : '시작'`
  조건 로직은 제거하고 plan은 항상 "계획 시작/계획 종료".
- **잔여 이전 대상:**
  - ~~`TodoModal` do(실적) 2곳~~ — **Stage 2 완료.** do는 `TimeField`로 이전하지 않고 **읽기전용 요약으로
    강등**(§10.3). 모달에서 `TimePicker` 소비 종료(단 plan 非-H 폴백으로 `TimePicker` 여전히 사용).
  - **나머지 10파일**(`EventModal`·`TimelineAddModal`·`BrainstormView`·`CalendarView`·`SleepTimeEditModal`·
    `DailyView`·`RoutinesView`·`HabitsView`·`TimelineLogModal` = TimeField / `SettingsView`·
    `TimelineSettingsModal` = HourField) — 후속 Stage. `TimePicker`는 이들이 모두 이전될 때까지 삭제 금지.

### 10.2 Stage 4a-1b — duration chip 선택 상태
- **DESIGN.md §5 「시각 입력」에 duration chip 스펙 추가**(3단계 상태·단일 선택 토글·코랄 금지·라일락 선택).
- **`DurationChips` 선택 상태 구현.** 현재 계획 길이(end−start)와 일치하는 칩만 활성:
  기본=`t.card`(흰) + `t.textMuted` + hairline / 선택=`t.accentSoft`(라일락 `#F4E7FB`) + `t.text`(딥 인디고) + hairline.
  코랄 제거(이전엔 `t.accentLight`(소프트 코랄) fill + `t.accent` 텍스트 = 붉은 위 붉은 + 선택 상태 없음).
- **토큰 주의(SSOT):** 라일락 tint = **`t.accentSoft`**(`#F4E7FB`). `t.accentLight`(`#F6BCBA`)은 **소프트 코랄**이다 — 혼동 금지.
- **선택 fill 강도:** 흰 카드 위 `accentSoft` 대비가 부족하면 `t.bgHover`(`#EFE3FA`)로 한 단계 상향 가능(옵션). 현재는 `accentSoft` 확정.
- **후속 과제(기록):** `haonStyles.buttonStyle`에는 `selected` 변형이 없어 이번엔 인라인(토큰) 유지.
  버튼 recipe에 selected 변형을 추가하면 이 칩을 recipe 경유로 회수(§5 "single recipe") — 후속 Stage.

### 10.3 Stage 2 — 실적(do) 입력칸 → 읽기전용 요약 강등 + 계획/실제 라벨 대칭 (2026-07-18)
- **근거:** `docs/STAGE2_0_DO_USAGE.md` 조사. do는 73% 채워지나 모달로 **생성 불가**(편집 전용), 비교는
  타임라인 compare 탭이 이미 제공, 모달 do 편집은 타이머 4행에서 desync. → 읽기전용 요약으로 강등.
- **DESIGN.md §5 「읽기전용 값 요약」 신규 등록** — 값은 보여주되 편집·생성 권한은 다른 표면이 갖는
  필드 패턴(입력기 아님 / 단일 소스 표시 / 편집 경로 유도 / 빈 상태=영역 없음 / 라벨 대칭·SSOT).
- **`TodoModal` 변경:**
  - do "실적 시작/종료" `TimePicker` 2개 → **읽기전용 요약** `실제 HH:mm ~ HH:mm · N시간`
    (라벨 `실제`=`t.success`, 값=`t.text`, 소요=`t.textMuted`) + "타임라인에서 조정" 저강조 힌트.
  - **표시 소스 = `do_start~do_end` 단일**(`do_elapsed_sec` 안 섞음 — 표기 시각과 소요 어긋남 방지).
  - `hasDoTime` false → **영역 자체 미렌더**(게이트 유지).
  - `buildChanges`에서 **do 쓰기 제거** → 모달발 desync 경로 차단. do 컬럼·타임라인·타이머·누적 시간은 불변.
  - **계획/실제 라벨 대칭:** plan은 항상 `계획 시작/계획 종료`(조건 로직 제거), do 요약은 `실제`.
- **SSOT(계획↔실제):** 타임라인 요약이 이미 화면에 "계획 시간/실제 시간"을 렌더 → do 화면명을 "실제"로
  통일(모달의 기존 "실적" 폐기). "실행"은 루틴/습관 도메인과 충돌해 불채택.
- **테마:** do 읽기전용 요약은 토큰 텍스트라 **테마 무관**(isHaon 게이트 없음, 非-H 동일 구조). plan은
  기존대로 `isHaon ? TimeField : TimePicker`. `TimePicker`는 plan 非-H 폴백으로 남아 삭제 금지.
- 검증: `npm run build`·`lint:fonts` 통과, 격리 하버스 스크린샷(PC/모바일 × do 유무) 4종 확인.
