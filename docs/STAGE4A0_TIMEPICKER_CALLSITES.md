# Stage 4a-0 — `TimePicker` 소비처 조사 (TimeField / HourField 분류)

> **목적:** 기존 `TimePicker`(`src/app/components/TimePicker.tsx`) 전량을 `TimeField`(모바일 네이티브 /
> PC 콤보박스)와 `HourField`(정시 전용)로 이전하기 전, **모든 호출부를 실측·분류**한다. 이 조사가
> `DESIGN.md` §5 「시각 입력」 삽입문과 `HAON_MIGRATION.md` 이전 계획의 근거(카운트·경계·순서)다.
>
> 방법: `src/**/*.tsx`에서 `<TimePicker …>` 전량 grep + 각 호출부의 **저장 의미**(무엇으로 저장되는가)
> 확인. UI 계약이 아니라 데이터 의미로 분류한다.

최종 업데이트: 2026-07-18

---

## 1. 요약

- **소비처: 12파일 / 23인스턴스.** (+ 컴포넌트 본체 `TimePicker.tsx` = 총 13파일)
- **2종으로 분류(혼동 금지):**
  - **`TimeField`(하루 중 시각, `HH:mm`) — 19인스턴스 / 10파일.**
  - **`HourField`(범위 경계, 정수 시(hour)) — 4인스턴스 / 2파일.**
- **`duration`(길이) 의미의 입력은 0곳.** (시작~종료 쌍은 두 개의 시각 입력이지 "길이" 입력이 아니다.)
- 두 종류는 **파일이 겹치지 않는다** → `HourField`(종류 B) 이전은 `TimeField`(종류 A) 이전에 영향받지 않는다.

---

## 2. 소비처 인벤토리

### 2.1 `TimeField` — 하루 중 시각(`HH:mm`) · 19인스턴스 / 10파일

| 파일 | 인스턴스 | 라인 | 용도 | 비고 |
|---|---|---|---|---|
| `TodoModal.tsx` | 4 | 439·445·456·462 | 계획 시작/종료 · **실적** 시작/종료 | 실적 쌍(456·462) 라벨은 `t.success`(§2.3) |
| `EventModal.tsx` | 2 | 191·197 | 일정 시작/종료 | |
| `timeline/TimelineAddModal.tsx` | 2 | 95·99 | 타임블록 시작/종료 | `minuteStep={5}` |
| `BrainstormView.tsx` | 2 | 304·311 | 브레인스톰→일정 변환 시작/종료 | |
| `CalendarView.tsx` | 2 | 346·350 | 취침/기상 시각 | 수면 기록(5분 의도) |
| `timeline/SleepTimeEditModal.tsx` | 2 | 27·31 | 취침/기상 시각 | **`minuteStep={30}`** (동일 필드 드리프트, §4) |
| `DailyView.tsx` | 2 | 211·413 | 스누즈(알림 미루기) 시각 | |
| `RoutinesView.tsx` | 1 | 166 | 루틴 시작 시각 | |
| `HabitsView.tsx` | 1 | 412 | 습관 알림 시각 | `minuteStep={1}`, "알림 없음" placeholder |
| `timeline/TimelineLogModal.tsx` | 1 | 70 | 생각/감정 로그 시각 | |

### 2.2 `HourField` — 범위 경계(정수 시) · 4인스턴스 / 2파일

| 파일 | 인스턴스 | 라인 | 용도 | 저장 의미 |
|---|---|---|---|---|
| `SettingsView.tsx` (`TimelineSection`) | 2 | 94·98 | **앱 하루 경계** 시작/끝 (`dayStartHour`/`dayEndHour`) | 정수 시. `setDayHours(sh, eh)` |
| `timeline/TimelineSettingsModal.tsx` | 2 | 44·48 | 타임라인 표시 범위 시작/끝 | 정수 시. props `startHour: number` / `endHour: number` |

### 2.3 컴포넌트 본체

| 파일 | 역할 |
|---|---|
| `TimePicker.tsx` | 현행 공통 컴포넌트(시·분 스피너 + 드롭다운). 이전 완료 후 삭제 대상. |

---

## 3. `HourField` 근거 — 무음 손실(silent minute drop)

`HourField`로 분리하는 이유는 스타일이 아니라 **거짓 계약**이다. 두 경계 호출부는 `minuteStep={1}`로
분 입력을 열어놓지만, 저장 시 **시(hour)만 취하고 분을 버린다** → 사용자가 `06:30`을 넣어도 `6`이 저장된다.

`TimelineSettingsModal.tsx`:
```ts
export function TimelineSettingsModal({ startHour, endHour, ... }: {
  startHour: number; endHour: number; ...           // ← 저장 단위가 정수 시
}) {
  const toTimeStr = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;  // 항상 :00
  ...
  const sh = parseInt(startVal.split(':')[0]);       // ← 분을 버림
  const eh = parseInt(endVal.split(':')[0]);
  onSave(sh, finalEnd);                              // 정수 시만 전달
}
```

`SettingsView.tsx`(`TimelineSection`)도 동일 패턴(`setDayHours(sh, eh)`, `parseInt(split(':')[0])`).

→ `HourField`는 분 입력 UI 자체를 제거해 이 무음 손실을 없앤다(받은 값 = 저장 값). 표시는 `06시`/`24시`,
하루 경계이므로 `+24` wrap을 명시(`26시 (다음날 02시)`).

---

## 4. step 드리프트 — 제약이 가짜였다는 증거

같은 "취침/기상 시각" 필드가 호출부마다 다른 `minuteStep`으로 갈려 있다:

| 필드 | 파일 | `minuteStep` |
|---|---|---|
| 취침/기상(캘린더) | `CalendarView.tsx` | (기본 5) |
| 취침/기상(수면 편집) | `SleepTimeEditModal.tsx` | **30** |

한 화면에서 `23:47`을 넣을 수 있으면(휠은 항상 1분 단위) 그 30분 제약은 **이미 존재하지 않는다**.
→ 새 컴포넌트는 step 스냅 제약을 컴포넌트에 넣지 않는다(진짜 제약이면 데이터 계층에서 강제). (DESIGN.md §5 「시각 입력」 step 메모)

---

## 5. 실적 라벨 판정 — `t.success`

`TodoModal.tsx`의 시각 입력은 **계획(PLAN)** 쌍과 **실적(DO)** 쌍 2세트다. 실적 쌍의 라벨만 `t.success`(그린)로 칠해 계획과 구분한다:
```tsx
<label style={{ ... color: t.success ... }}>실적 시작</label>   // L454
<label style={{ ... color: t.success ... }}>실적 종료</label>   // L460
```
**판정:** 실적(DO) 쌍도 저장 의미는 하루 중 시각(`HH:mm`)이므로 **`TimeField`**다. 라벨 색 `t.success`는
계획/실적 구분용 표시일 뿐 **컴포넌트 종류(TimeField/HourField)와 무관**하다 — 이전 시 라벨 색은 호출부에
그대로 두고 컴포넌트만 교체한다(§6 증감/실적 색은 §7.2 토큰 소관, 여기서 재정의 안 함).

---

## 6. 조용히 망가지는 곳 (우선 경계)

이전 시 화면에 **에러가 안 보이는 채** 데이터가 틀어질 수 있는 곳. 여기부터 신중히.

- **`SettingsView.tsx` / `TimelineSettingsModal.tsx`(하루 경계).** 이 값은 **전 기록의 날짜 버킷팅**을 좌우한다
  (SettingsView 안내문: "종료 시간 이전까지는 같은 날로 기록돼요"). 경계가 잘못 저장되면 자정 근방 기록이
  엉뚱한 날짜로 새며, 화면엔 즉시 표시되지 않는다. → `HourField` 이전 1순위.
- **`HabitsView.tsx` 알림(`alarmTime`).** 알림 발화 실패는 화면에 드러나지 않는다(무음 실패). 값 손실이
  조용히 알림을 깨뜨릴 수 있음.

---

## 7. 이전 순서 (제안)

종류 A(`TimeField`) 먼저, 각 단계 STOP:
1. `TodoModal` → 2. `EventModal` → 3. `TimelineAddModal` → 4. 나머지 7파일
   (`BrainstormView`·`CalendarView`·`SleepTimeEditModal`·`DailyView`·`RoutinesView`·`HabitsView`·`TimelineLogModal`)
5. 종류 B(`HourField`) 2파일(`SettingsView`·`TimelineSettingsModal`) — A와 파일이 겹치지 않아 독립.
6. 전량 이전 확인 후 `TimePicker.tsx` 삭제.

> 계약(2종 분류·`duration` 0곳·무음 손실 제거·step 제약 금지)은 `DESIGN.md` §5 「시각 입력」이 단일 기준.
> 이 문서는 그 계약의 **실측 근거**(카운트·라인·경계)이며, 이전이 끝나면 카운트는 낡은 값이 된다.
