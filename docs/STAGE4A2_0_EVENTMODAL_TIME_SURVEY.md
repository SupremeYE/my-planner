# Stage 4a-2-0 — EventModal 시각 입력 조사 (`TimePicker` → `TimeField` 이전 前)

> **목적:** EventModal 의 `TimePicker`(시작/종료 시각) 를 `TimeField` 로 이전(4a-2)하기 전, 현재 코드를
> 실측해 이전 계획의 근거를 굳힌다. **조사 전용 — 코드 0줄 수정.** 날짜(시작일/종료일) 필드는 **불가침**
> (§11.4 `DateField` 트랙 소관), 현황만 기록.
>
> 계약: `DESIGN.md` §5 「시각 입력」. 실측 인벤토리: `docs/STAGE4A0_TIMEPICKER_CALLSITES.md`.
> 이전 지침: `docs/HAON_MIGRATION.md` §10.

최종 업데이트: 2026-07-18
대상 파일: `src/app/components/EventModal.tsx` (전량 375줄 확인)

---

## 1. `TimePicker` 인스턴스 전수

**2개 인스턴스** — 모두 시각(time-of-day) 입력. 종일 토글 조건부 블록(`{!isAllDay && …}`) 안에 있다.

| # | 필드 | 라인 | 넘기는 prop |
|---|---|---|---|
| 1 | **시작 시각** | `EventModal.tsx:191` | `value={startTime}` · `onChange={setStartTime}` · `placeholder="시작 시간"` |
| 2 | **종료 시각** | `EventModal.tsx:197` | `value={endTime}` · `onChange={setEndTime}` · `placeholder="종료 시간"` |

- `minuteStep` **미전달**(컴포넌트 기본값 사용) · `size` **미전달** · 그 외 prop 없음.
- 두 인스턴스 모두 `HH:mm` 문자열 계약(state `startTime`/`endTime`, 초기값 `'09:00'`/`'10:00'` — 라인 43·44).
- 저장: `startTime: isAllDay ? undefined : startTime` / `endTime: isAllDay ? undefined : endTime` (라인 90·91).

> 근거상 EventModal 의 시각 입력은 **오직 이 2곳**이며 둘 다 종류 A(`TimeField`). `HourField` 대상 없음.

---

## 2. 종일(all-day) 토글 로직

- **토글 있음.** state: `isAllDay` / `setIsAllDay` (라인 40, 초기값 `event?.isAllDay ?? false`).
- 체크박스 UI: 라인 153–161 (`<input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />` + "종일" 라벨).
- **시각 필드 소거 방식 = 조건부 렌더(언마운트)**, `disabled` 아님:

```tsx
{!isAllDay && (
  <div className="grid grid-cols-2 gap-3">
    <div>…<TimePicker value={startTime} onChange={setStartTime} … /></div>   // L191
    <div>…<TimePicker value={endTime}   onChange={setEndTime}   … /></div>   // L197
  </div>
)}
```
(라인 186–201). 종일 ON → 시각 그리드 전체가 DOM 에서 빠진다.

- **TimeField 이전 시 조건부 렌더 그대로 유지 가능 — 문제없음.** TimeField 는 자체적으로 마운트/언마운트에
  안전(내부 state 뿐, 외부 부수효과 없음). 단 TodoModal 처럼 **시작→종료 포커스 이동 ref**(`planEndRef` 류)를
  쓴다면 그 ref 대상(종료 TimeField)이 조건부 블록 안에 있어야 하는데, 위 구조가 이미 시작·종료를 **같은
  블록**에 담으므로 정합. (종일 토글로 블록이 통째로 언마운트되면 ref 도 함께 사라짐 — 정상.)

---

## 3. 시작↔종료 시각 연동

- **연동 로직 없음.** `setStartTime` 과 `setEndTime` 은 독립. 시작 시각을 바꿔도 종료가 기존 길이를 유지한 채
  따라가는 로직(TimeField/TodoModal 의 "기본 길이 1시간" 자동 추종)은 **EventModal 에 존재하지 않는다.**
- **duration chip 없음.** EventModal 어디에도 `DurationChips`/duration 칩 UI 가 없다. (TodoModal 은 라인 474
  에서 `<DurationChips … className="lg:hidden" />` 로 추가돼 있으나 EventModal 엔 없음.)

> 즉 현재 EventModal 은 시작/종료를 **각각 독립적으로** 고르는 구조. `endTime` 초기값만 `'10:00'` 으로
> 시작(`'09:00'`)+1시간에 해당하지만, 이후 자동 추종/보정은 없다.

---

## 4. 다중일(multi-day) 처리

- **가능한 구조.** 시작일(`startDate`, 라인 41)·종료일(`endDate`, 라인 42)이 **각각 별도 state + 별도
  `<input type="date">`** (라인 166–172, 176–183). `startDate !== endDate` 가 될 수 있다.
- 유효성 검증(`handleSubmit`, 라인 72–83):

```tsx
if (!startDate || !endDate) { setError('시작일과 종료일을 입력해 주세요.'); return; }   // L72–75
if (endDate < startDate)    { setError('종료일은 시작일보다 빠를 수 없어요.'); return; } // L76–79
if (!isAllDay && endDate === startDate && endTime < startTime) {                        // L80–83
  setError('종료 시간은 시작 시간보다 늦어야 해요.'); return;
}
```

- **핵심:** 시각 대소 비교는 **`endDate === startDate`(같은 날)일 때만** 수행. 다중일(`endDate > startDate`)
  이면 종료 시각이 시작 시각보다 일러도(예: 시작 7/18 22:00 → 종료 7/19 06:00) **정상 허용**한다. duration
  계산 자체는 이 폼에 없음(위 검증만).
- **`HH:mm` 계약 동일** → TimeField 이전 후에도 이 폼-레벨 검증 로직은 그대로 동작한다.

> ⚠️ **TimeField 이전 시 충돌 지점(중요).** TimeField 의 `role='end' + rangeStart` 는 "**시작 이전 시각을
> 목록에서 배제**"(TimeField.tsx:84–87·135)한다 — 이는 **같은 날 전제**의 제약이다. EventModal 은 다중일이
> 가능하므로, 종료 TimeField 에 무조건 `rangeStart={startTime}` 을 넘기면 **다중일의 정당한 "종료<시작"
> (다음날) 케이스를 막아버린다.** TodoModal(단일 날짜)엔 없던 문제. → 구현 시 `endDate > startDate` 이면
> `role`/`rangeStart` 를 넘기지 않거나 배제를 해제해야 한다(구현 단계 결정 사항, 여기선 기록만).

---

## 5. do(실적) 시각 필드 확인

- **없음.** EventModal 에는 계획/실적(PLAN/DO) 구분이 없다. `Event` 는 `startTime`/`endTime` 단일 쌍만
  가지며 `do_start`/`do_end` 류 필드·읽기전용 요약 대상이 전혀 없다.
- → **4a-2 범위 재검토 불필요.** TodoModal 의 Stage 2(do 읽기전용 요약 강등, 계획/실제 대칭 라벨,
  `HAON_MIGRATION.md` §10.3) 작업은 EventModal 에 해당 없음.

---

## 6. 날짜 필드 현황 (조사만 — 불가침)

전부 네이티브 `<input type="date">`. 커스텀 포맷터/컴포넌트 없음. **이번에 손대지 않는다** — §11.4 `DateField`
트랙이 가져갈 대상.

| 필드 | state | 라인 | 구현 |
|---|---|---|---|
| 시작일 | `startDate` (L41) | `EventModal.tsx:166–172` | 네이티브 `<input type="date">` |
| 종료일 | `endDate` (L42) | `EventModal.tsx:176–183` | 네이티브 `<input type="date">` |
| 반복 종료일 | `repeatEndDate` (L48) | `EventModal.tsx:281–287` | 네이티브 `<input type="date">` (반복≠none 조건부) |

- 3개 모두 §11.3 조사 결론과 동일 패턴(네이티브, 로케일 포맷은 앱이 못 바꿈).

---

## 7. STAGE4A0 보고서 대조 (머지 이후 변화)

| 항목 | STAGE4A0 §2.1 | 현재 실측 | 판정 |
|---|---|---|---|
| 파일 | `EventModal.tsx` | 동일 | ✅ 일치 |
| 인스턴스 수 | 2 | 2 | ✅ 일치 |
| 라인 | 191·197 | 191·197 | ✅ 일치 |
| 용도 | 일정 시작/종료 | 일정 시작/종료 | ✅ 일치 |
| 종류 | `TimeField`(A) | `TimeField`(A) | ✅ 일치 |
| `minuteStep` 비고 | 비고 없음(기본) | 미전달(기본) | ✅ 일치 |

**결론: 머지 이후 EventModal 시각 입력부는 변한 것 없음.** STAGE4A0 전수조사 행이 현재 코드와 정확히
일치하며, 라인 번호까지 유효하다.

---

## 8. 4a-2 구현 시 TodoModal 과 다르게 처리할 지점 (요약)

1. **종일 토글(TodoModal 엔 없음).** 시각 2곳은 `{!isAllDay && …}` 조건부 렌더 안에 있다. TimeField 로
   갈아끼울 때 이 조건부 블록 구조를 유지한다(disabled 아님, 언마운트). `isHaon(t) ? <TimeField> : <TimePicker>`
   삼항도 이 블록 안에서.
2. **다중일(TodoModal 은 단일 날짜).** 종료 TimeField 에 `rangeStart`/`role='end'` 를 무조건 넘기면 TimeField
   의 "시작 이전 배제"가 **다중일의 정당한 다음날 종료 시각을 막는다.** `endDate > startDate` 분기 필요(§4).
   또한 폼-레벨 검증(`endDate === startDate && endTime < startTime`, L80–83)은 TimeField 이전 후에도 **유지**한다.
3. **do 없음(TodoModal 은 do 2곳 → 읽기전용 요약).** EventModal 은 계획/실적 구분이 없어 읽기전용 요약·
   계획/실제 대칭 라벨 작업이 **불필요**. 시작/종료 시각 2곳만 단순 이전.
4. **시작↔종료 자동추종·duration chip 없음(TodoModal 은 `DurationChips` 추가).** 현재 EventModal 엔 자동
   추종도 duration 칩도 없다. 이전 시 이를 **추가할지 여부는 구현 결정** — 특히 다중일에서는 `DurationChips`
   의 `Math.min(startMin + d, DAY_MAX)` clamp(TimeField.tsx:284)가 종료를 같은 날로 묶어 다중일과 충돌할 수
   있으므로, 도입한다면 다중일 케이스와의 정합을 별도 검토해야 한다. (조사 시점 현황 = **없음**.)
5. **날짜 필드 불가침.** 시작일/종료일/반복 종료일 3개 네이티브 date 입력은 이번에 건드리지 않는다(§6, §11.4).

---

## 준수 확인
- 코드 **0줄 수정.** 날짜 필드 불가침(현황만 기록). 조사 전용.
- 구현(Stage 4a-2-1)은 이 보고서 검토·승인 후 별도 지시로 진행.
