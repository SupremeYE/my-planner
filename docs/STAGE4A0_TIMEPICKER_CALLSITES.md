# Stage 4a-0 — TimePicker 호출부 조사 보고서

> **조사 전용. 코드 변경 없음.** 확인된 사실만 기재하고, 확인 못 한 항목은 "확인 불가"로 표기.
> 기준 파일: `src/app/components/TimePicker.tsx`, 각 호출부 소스, `src/app/store.tsx`(저장 타입),
> `src/app/ThemeContext.tsx`(토큰), `src/styles/haon.css`(카테고리 토큰), `DESIGN.md`, `docs/STAGE0_TASK_EDITOR.md`.
> 조사일: 2026-07-17

---

## 0. 스코프 정정 — "12곳"은 12개 **파일**, 실제 `<TimePicker>` 인스턴스는 **23개**

Stage 1.5가 확정한 "12곳"은 **12개 호출 파일**을 뜻한다. 그러나 파일당 시작/종료 쌍이 많아
실제 렌더되는 `<TimePicker>` 인스턴스는 **23개**다. 아래 인벤토리는 **파일 단위 12행**으로 정리하되,
각 행에 인스턴스 수와 개별 line을 병기한다.

TimePicker 자체 스펙(`TimePicker.tsx`):
- props: `value:"HH:mm"|""`, `onChange`, `placeholder`, `minuteStep`(기본 **5**), `size`(`'sm'|'md'`, 기본 **sm**).
- **▲▼ 버튼 = `minuteStep` 단위**, **휠 = 항상 1분 단위**(`minuteStep` 무시, `:82-85`).
- 드롭다운 리스트는 **항상 분 0–59 전체**(`minuteList`, `:45`) — `minuteStep`은 리스트를 제한하지 않는다.
- **✕(클리어) 버튼은 컴포넌트에 항상 존재**(`:304-325`), 값이 빈 문자열이면 비활성(disabled)만 된다.
  즉 "null 허용"은 컴포넌트가 아니라 **각 호출부가 빈 값을 유효 상태로 저장하는지**로 갈린다.
- **시각 전용 컴포넌트**: 값 파싱이 `HH:mm`(시 0–23, 분 0–59) 고정(`:37-39`). 24시간을 넘는 "길이" 개념 없음.

---

## 1. 호출부 인벤토리 (12파일 / 23인스턴스)

| # | 파일:line | 화면상 라벨 | 의미 분류 | `minuteStep` | `size` | 저장 컬럼·필드 | 저장 포맷 | 값 범위 제약 | null 허용(빈 값 유효) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `TodoModal.tsx:439/445/456/462` (4) | 계획 시작·(계획)종료·**실적 시작·실적 종료** | `time-of-day` | 미지정→**5** | 미지정→**sm** | `todos.plan_start`/`plan_end`/`do_start`/`do_end` | `HH:mm` 문자열 | 00:00–23:59. do_*는 `hasDoTime` 게이트로만 노출 | ✕ 버튼 有. 빈 값 = 미지정(유효) |
| 2 | `EventModal.tsx:191/197` (2) | 시작시간·종료시간 | `time-of-day` | 미지정→**5** | 미지정→**sm** | `events.start_at`/`end_at` (date와 합쳐 `yyyy-MM-ddTHH:mm:00`) | `HH:mm` 상태 → ISO 문자열 저장 | 종일(`is_all_day`) 아닐 때만 노출 | ✕ 버튼 有. (종일 토글이 실제 클리어 경로) |
| 3 | `timeline/TimelineAddModal.tsx:95/99` (2) | 시작·종료 | `time-of-day` | **5**(명시) | **md**(명시) | 레인 따라 `todos.plan_*`/`do_*` 또는 `events.start_at/end_at` | `HH:mm` 문자열 | **종료 > 시작** 강제(`invalidTime` 배너, `:102`) | ✕ 버튼 有 (단, 저장은 start/end 둘 다 필요) |
| 4 | `timeline/TimelineLogModal.tsx:70` (1) | 시간 | `time-of-day` | 미지정→**5** | **md**(명시) | `TimelineLog.time` | `HH:mm` 문자열 | 없음. 기본값 = 현재 시각(`format(now,'HH:mm')`) | ✕ 버튼 有 (기본이 현재시각이라 실질 비움 드묾) |
| 5 | `timeline/TimelineSettingsModal.tsx:44/48` (2) | 시작 시간·종료 시간 (타임라인 시간 설정) | **`range-bound`(시 전용)** | **1**(명시) | **md**(명시) | `dayStartHour`/`dayEndHour` (`onSave(sh,eh)`) | **정수 시(hour)** — `parseInt(v.split(':')[0])`, **분은 폐기** | 종료 ≤ 시작이면 `+24`(다음날). 하루 경계 | ✕ 버튼 有이나 빈 값 저장 안 함(항상 시각 유지) |
| 6 | `timeline/SleepTimeEditModal.tsx:27/31` (2) | 취침·기상 | `time-of-day` | **30**(명시) | 미지정→**sm** | `SelfCareRecord.sleepStart`/`sleepEnd` | `HH:mm` 문자열 | 확인 버튼은 start·end 둘 다 있어야 활성 | ✕ 버튼 有. 빈 값이면 확인 비활성 |
| 7 | `DailyView.tsx:211`(할일 미루기)·`413`(일정 옮기기) (2) | 시간 선택 (선택) | `time-of-day` | 미지정→**5** | 미지정→**sm** | `todos.plan_start`(할일) / `events.start_at`(일정, dur 유지 재계산) | `HH:mm` 문자열 | 없음(선택 입력). 기본 `planStart`/`startTime`\|\|`'09:00'` | ✕ 버튼 有. 빈 값 = 시간 없이 미룸(유효) |
| 8 | `CalendarView.tsx:346/350` (2) | 취침·기상 (수면 시간 수정) | `time-of-day` | 미지정→**5** | 미지정→**sm** | `SelfCareRecord.sleepStart`/`sleepEnd` | `HH:mm` 문자열 | 확인 버튼은 start·end 둘 다 필요 | ✕ 버튼 有. 빈 값이면 확인 비활성 |
| 9 | `SettingsView.tsx:94/98` (2) | 시작 시간·종료 시간 (타임라인 설정) | **`range-bound`(시 전용)** | **1**(명시) | **md**(명시) | `dayStartHour`/`dayEndHour` (`setDayHours(sh,eh)`) | **정수 시(hour)** — `parseInt(v.split(':')[0])`, **분은 폐기** | 종료 ≤ 시작이면 `+24`(다음날) | ✕ 버튼 有이나 빈 값 저장 안 함 |
| 10 | `HabitsView.tsx:412` (1) | 알림 시간 (placeholder **"알림 없음"**) | `time-of-day` | **1**(명시) | 미지정→**sm** | `Habit.alarmTime` | `HH:mm` 문자열 또는 `''` | 없음 | ✕ 버튼 有. **빈 값 = 알림 없음(명시적 유효)** |
| 11 | `RoutinesView.tsx:166` (1) | 시작 시간 | `time-of-day` | 미지정→**5** | 미지정→**sm** | `Routine.startTime` | `HH:mm` 문자열 | 없음. 기본 `'07:00'` | ✕ 버튼 有 (단 `startTime`은 필수 필드) |
| 12 | `BrainstormView.tsx:304/311` (2) | 시작 시간·종료 시간 (아이디어→일정 변환) | `time-of-day` | 미지정→**5** | 미지정→**sm** | 변환 시 `events.startTime`/`endTime`(→ event 저장) | `HH:mm` 문자열 | 없음(선택) | ✕ 버튼 有. 빈 값 = 시간 미지정 변환(유효) |

**저장 타입 근거**: `store.tsx:142`(`Routine.startTime: string` 필수), `:110`(`Habit.alarmTime?: string`),
`:179`(`SelfCareRecord.sleepStart?: string // "HH:mm"`), `:628`(`TimelineLog.time: string`),
`:945/947`(`dayStartHour: number`, `setDayHours:(s:number,e:number)`),
`:2026`(`brainstormToEvent(... startTime?, endTime? ...)`), `:833`(`snoozeEvent(... opts.startTime? ...)`).
`todos.plan_*`/`do_*` = `HH:mm`(STAGE0 §1.1). `events.start_at/end_at` = ISO text(STAGE0 §1.5).

---

## 2. 판정

### 2.1 `duration`(길이) 의미로 쓰는 호출부가 있는가? → **없음 (0곳)**

23개 인스턴스 전부 **시각(time-of-day)** 또는 **범위 경계(range-bound)** 이며, **"N시간짜리 길이"를
입력·저장하는 호출부는 하나도 없다.**

- 배경에서 우려한 **"수면 목표 8시간"류 duration은 실재하지 않는다.** 수면은 `SleepTimeEditModal` /
  `CalendarView`에서 **취침·기상 두 시각**(`sleepStart`/`sleepEnd`, `HH:mm`)으로 저장되며,
  길이는 두 시각의 차로 파생될 뿐 TimePicker에 "8시간"을 넣지 않는다.
- `TodoModal`의 "누적 시간"은 초 정수 파생 표시값(STAGE0 §1.4)이며 **TimePicker로 입력하지 않는다**(무관).
- ⇒ **`<input type="time">` 대체에서 duration 사유로 제외해야 할 호출부: 없음.**

### 2.2 `minuteStep` 값별 그룹핑

| `minuteStep` | 호출부 (파일) | 인스턴스 |
|---|---|---|
| **1** (명시) | SettingsView, TimelineSettingsModal, HabitsView | 2+2+1 = 5 |
| **5** (명시) | TimelineAddModal | 2 |
| **30** (명시) | SleepTimeEditModal | 2 |
| **미지정 → 기본 5** | TodoModal, EventModal, TimelineLogModal, DailyView, CalendarView, RoutinesView, BrainstormView | 4+2+1+2+2+1+2 = 14 |

- **핵심 불일치**: `minuteStep=1`을 쓰는 5개 인스턴스 중 **SettingsView·TimelineSettingsModal 4개는 저장 시
  분을 통째로 버린다**(정수 시만 저장). 즉 이들의 `minuteStep=1`은 **실효 없는(오히려 오해를 부르는) prop**이다.
- **CalendarView의 취침/기상(기본 5)** vs **SleepTimeEditModal의 취침/기상(명시 30)** — **같은 필드
  (`sleepStart`/`sleepEnd`)를 편집하는데 step이 다르다**(5 vs 30). 드리프트.

### 2.3 몇 종류로 묶이는가? → **2종 (예상한 3종 아님 — duration 부재)**

| 종류 | 정의 | 소속 호출부 (파일) |
|---|---|---|
| **A. 시각 입력 (time-of-day)** | 하루 중 한 시점(`HH:mm`)을 그대로 저장 | TodoModal, EventModal, TimelineAddModal, TimelineLogModal, SleepTimeEditModal, DailyView, CalendarView, HabitsView, RoutinesView, BrainstormView (**10파일 / 19인스턴스**) |
| **B. 범위 경계 · 시 전용 (range-bound, hour-only)** | 하루 타임라인의 시작/끝 **정시 경계**. 저장은 **정수 시**, 분 폐기, 종료 wrap(+24) | SettingsView, TimelineSettingsModal (**2파일 / 4인스턴스**) |

> duration 종류는 **존재하지 않으므로** 3종이 아니라 **2종**이다.

### 2.4 종류별 `<input type="time">` 네이티브 대체 가능 판정

| 종류 | 네이티브 대체 | 판정 사유 |
|---|---|---|
| **A. 시각 입력** | **가능(조건부)** | `HH:mm` 시각 입력에 네이티브가 정확히 대응. **단 조건**: (1) 빈 값 허용 필드(HabitsView "알림 없음", DailyView, Brainstormform)는 네이티브도 empty value 지원 → OK. (2) `minuteStep=30`(Sleep)은 `step=1800`으로 근사 가능하나 **키보드로는 임의 분 입력 허용**(강제 아님) — 현행 ▲▼ 30분 강제와 동작 차이. (3) 초기값 "현재 시각"(TimelineLog)·"07:00"(Routine) 등은 호출부에서 세팅하므로 무관. |
| **B. 범위 경계·시 전용** | **불가** | 네이티브는 **분 선택을 허용**하는데 저장 계층은 **분을 버린다** → 사용자가 06:30을 골라도 06:00으로 조용히 저장되는 **무음 데이터 손실**. 또 종료 wrap(+24, "다음날 새벽") 개념을 네이티브 time input이 표현 못 함. **이 종류는 "정시(hour) 전용 선택기"가 맞고, 범용 time-of-day 네이티브 입력으로 옮기면 안 된다.** |

---

## 3. 교체 순서 제안 (구현 없음 — 순서/근거만)

### 3.1 가장 안전한 순서 (근거: (a) 영향 범위 (b) 회귀 발견 난이도)

**원칙**: 블래스트 반경이 작고 회귀가 **눈에 잘 띄는** 것부터 → 엔탱글먼트가 크고 **조용히 망가지는** 것 나중.

1. **`TimelineLogModal`** — 인스턴스 1, 완전 독립, 결과가 타임라인 컬러 마커로 즉시 보임. (가장 안전)
2. **`RoutinesView`(1) · `BrainstormView`(2)** — 단일 목적, 결과가 리스트/변환 결과에 바로 노출.
3. **`SleepTimeEditModal` + `CalendarView` 수면(각 2)** — **동일 필드**(`sleepStart/End`)라 **함께** 교체해
   step 드리프트(30 vs 5)를 이때 정리. 수면 바로 시각 확인 가능.
4. **`DailyView` 미루기/옮기기(2)** — 선택 입력, 결과가 요약 문구·일정 이동으로 보임(반semi-visible).
5. **`HabitsView` 알림(1)** — 교체는 쉬우나 **결과(알림 발화)가 화면에 안 보임** → 회귀가 조용함. 4 이후.
6. **`EventModal`(2)** — `HH:mm` → ISO 합성 경로가 끼어 있어 포맷 변환 주의. 캘린더/타임라인에 보임.
7. **`TodoModal`(4)** — **모델 A(PLAN/DO 이중)** + `hasDoTime` 게이트 + 실적 라벨. 가장 로직이 얽힘(STAGE0 §4).
8. **`TimelineAddModal`(2)** — 레인 따라 todo/event 양쪽 저장 + 종료>시작 가드 + 하드코딩 위반(V1/V2). 통합 폼과 함께 다뤄야.
9. **(별도 트랙) `SettingsView` + `TimelineSettingsModal`(각 2)** — **종류 B. 시각 컴포넌트로 옮기지 말 것**
   (§3.3). 마지막에, 그것도 **정시 전용 선택기로 별도 처리**. 여기서 범용 time input을 쓰면 무음 손실.

### 3.2 회귀 시 눈에 띄는가 / 조용히 망가지는가 (**조용한 것부터**)

**⚠️ 조용히 망가짐 (우선 경계):**
- **`SettingsView` · `TimelineSettingsModal`** — 하루 경계(`dayStartHour/EndHour`)는 **모든 타임라인 기록의
  날짜 버킷팅**에 영향. 잘못되면 자정 근처 기록이 엉뚱한 날로 넘어가지만 **즉시 안 보인다.** + 분 폐기(무음 손실).
- **`HabitsView` 알림 시간** — 알림이 안 울려도 **화면상 표시 없음.** 회귀가 가장 늦게 발견됨.
- **`DailyView` 미루기 시간** — 잘못된 시각이 `planStart`에 조용히 반영(요약 문구를 안 보면 놓침).

**✅ 눈에 띔 (회귀 즉시 발견):**
- `TodoModal`/`TimelineAddModal`/`EventModal` — 블록·일정이 타임라인/캘린더에 잘못된 위치로 렌더.
- `TimelineLogModal` — 컬러 마커 위치가 틀리면 바로 보임.
- `SleepTimeEditModal`/`CalendarView` 수면 — 수면 바 위치/길이가 틀리면 보임.
- `RoutinesView` 시작 시간 — 루틴 리스트에 `startTime` 텍스트로 노출.

### 3.3 TimePicker를 **남겨야 하는(신규 컴포넌트로 못 옮기는)** 호출부

- **`SettingsView` · `TimelineSettingsModal`** — **종류 B(범위 경계·시 전용).** 저장이 정수 시이고 분을 버리며,
  종료 wrap(+24)까지 있어 **범용 `<input type="time">`(time-of-day)로는 대체 부적합.** 신규 시각 피커가
  "하루 중 시각" 전제로 설계되면 **이 두 곳은 그 대상이 아니다.** → 현행 TimePicker 유지 **또는** 별도
  "정시(hour) 전용 선택기"로 분리하는 것이 맞다. (판정: **남겨야 함 / 최소한 분리 대상**)
- 나머지 10파일(종류 A)은 신규 시각 컴포넌트로 이관 가능(§2.4 조건부).

---

## 4. 곁다리 — "실적 라벨 초록" 검증

**대상 확정**: "실적 라벨"은 `TodoModal.tsx`의 **"실적 시작"(`:454`) · "실적 종료"(`:460`)** 라벨.
(문자열에 "실적"이 있는 유일한 라벨.)

### 4.1 정확한 값과 위치 — **토큰(`t.success`)**, 하드코딩 아님
- 위치: `TodoModal.tsx:454`, `TodoModal.tsx:460` — `style={{ ..., color: t.success, ... }}`.
- **하드코딩 아님 = `t.success` 토큰 소비.** Theme H에서 `t.success = '#7FCB8F'`(`ThemeContext.tsx:307`,
  민트 그린). 참고 타 테마: B=`#7FB89A`(`:169`), A/C/D=`#006b62`(`:124/214/259`).

### 4.2 `--cat-selfcare-dot`(세이지 `#6baa7a`)와 같은 값인가? → **아니다(다름)**
- `t.success`(H) = **`#7FCB8F`** vs `--cat-selfcare-dot` = **`#6baa7a`**(`haon.css:45`). **서로 다른 색.**
- ⇒ 실적 라벨의 초록은 **자기관리 카테고리 세이지가 아니다.**

### 4.3 `t.doBlock`(`ThemeContext.tsx:300`) 값과 "실적 라벨이 그걸 써야 하는가?"
- `t.doBlock`(H) = **`#FF6F91`**(코랄→핑크, `t.accent`와 동일). 타 테마 B=`#F4A582`, A/C/D=`#515f74`.
- **실적 라벨은 `t.doBlock`을 쓰면 안 된다.** `doBlock`은 **DO 블록의 배경 fill** 토큰이지 "성취/완료" 의미색이
  아니다. H에서는 코랄이라 초록의 "완료/양호" 의미가 사라지고, 라벨 텍스트로 쓰면 의미가 어긋난다.
  현행 `t.success`(완료·양호 시맨틱)가 라벨 의미에 맞는 선택이다.

### 4.4 `TimelineAddModal.tsx:54`의 `doClr='#6BAA7A'`(V2 하드코딩)와 **같은 부류의 누출인가?** → **별개(누출 아님)**
- `TimelineAddModal:54`는 **하드코딩 리터럴 `#6BAA7A`** (STAGE0 §3.2 V2 위반 확정).
- 실적 라벨은 **`t.success` 토큰**. 값도 다르고(`#7FCB8F`≠`#6BAA7A`), 성질도 다르다(토큰 vs 리터럴).
- ⇒ **같은 부류의 누출이 아니다. 실적 라벨 초록은 정당(토큰 기반 시맨틱 사용).**

### 4.5 "카테고리 토큰을 카테고리 아닌 용도로 쓰지 않는다" SSOT와 충돌하는가? → **충돌 없음**
- `t.success`는 **시맨틱 토큰**(성공/완료/양호)이지 **카테고리 토큰(`--cat-*`)이 아니다.**
- 실적("DO=한 일=완료 실적")에 성공 시맨틱을 쓰는 건 **정확히 시맨틱 용도** → SSOT 위반 아님.
- (역으로, 만약 실적 라벨이 `--cat-selfcare-dot`(#6baa7a)를 썼다면 그것이 "카테고리 토큰 오용"이었을 것.
  현재는 그 값도 아니고 그 토큰도 아니므로 안전.)

**§4 최종 판정: 실적 라벨 초록 = `t.success`(#7FCB8F, H) 토큰 사용 → 정당(누출 아님). Stage 1.5의
"실적 라벨 초록 의미 유지" 판정은 타당하다.**

---

## 5. 산출물 요약 (필수 결론)

### 종류 분류표 (2종)

| 종류 | 소속 (파일 / 인스턴스) |
|---|---|
| **A. 시각 입력 (time-of-day)** | TodoModal(4)·EventModal(2)·TimelineAddModal(2)·TimelineLogModal(1)·SleepTimeEditModal(2)·DailyView(2)·CalendarView(2)·HabitsView(1)·RoutinesView(1)·BrainstormView(2) = **10파일 / 19** |
| **B. 범위 경계·시 전용 (range-bound, hour-only)** | SettingsView(2)·TimelineSettingsModal(2) = **2파일 / 4** |

### `duration` 오용 위험 목록
- **없음(0곳).** 어떤 호출부도 "길이"를 입력·저장하지 않는다. "수면 목표 8시간"류 우려는 실재하지 않으며,
  수면은 취침/기상 **두 시각**으로 저장된다. ⇒ duration 사유의 네이티브 제외 대상 없음.

### 네이티브(`<input type="time">`) 대체 가능/불가
- **가능(조건부)**: 종류 A 10파일 — 빈 값 허용(Habits/Daily/Brainstorm)·30분 스텝(Sleep)의 동작 차이만 확인.
- **불가**: 종류 B 2파일(SettingsView, TimelineSettingsModal) — 저장이 **정수 시(분 폐기)** + 종료 **wrap(+24)**.
  범용 time input은 분 손실을 유발. **정시 전용 선택기로 별도 처리.**

### 권장 교체 순서 + 근거
1. TimelineLogModal → 2. Routines·Brainstorm → 3. Sleep(SleepTimeEditModal+CalendarView 함께, step 정리)
→ 4. DailyView → 5. HabitsView(조용한 회귀 주의) → 6. EventModal(ISO 합성) → 7. TodoModal(모델 A/실적/게이트)
→ 8. TimelineAddModal(양쪽 저장+가드+V1/V2) → 9. **(별도 트랙) SettingsView+TimelineSettingsModal(시각 컴포넌트로 이관 금지).**
근거: **블래스트 반경 작고 회귀가 눈에 띄는 것 먼저**, 얽히고 **조용히 망가지는 것 나중**.

### 실적 라벨 초록 판정
- **정당(누출 아님).** `TodoModal:454/460`이 **`t.success` 토큰**(H=`#7FCB8F`)을 쓴다.
  카테고리 세이지(`#6baa7a`)와 **다른 값**, `TimelineAddModal:54`의 하드코딩 `#6BAA7A`(V2 누출)와 **별개**,
  `t.doBlock`(H=`#FF6F91`)로 바꿀 필요 **없음**, SSOT(카테고리 토큰 오용 금지)와 **충돌 없음**.

---

### 확인 불가 항목
- 각 호출부의 "화면상 라벨"은 소스의 `<label>`/placeholder 문자열로 확정했다. 실제 렌더 스크린샷 대조는
  본 조사 범위 밖(코드 기준으로만 기재).
- `minuteStep=30`(Sleep) 등 스텝의 **의도**(왜 30분인지)는 주석/스펙에 근거가 없어 **확인 불가**(현행 값만 기재).
