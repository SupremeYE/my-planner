# HANDOFF — 만다라트 → 기간별 목표/할일 "보내기" 기능

> 작성일: 2026-06-06
> 작업 브랜치: `claude/happy-cerf-CiMry` → main 머지 완료
> 다음 세션에서 이 문서를 먼저 읽고 Phase 2부터 이어서 작업.

---

## 🎯 전체 목표

**만다라트**(`/goals` → 만다라트 모드)에서 구조화한 칸(세부/행동)을 **기간별 목표**(연간/월간/주간) 또는 **할일**로 "보내기" — 보낸 항목엔 ✦ 출처 표시, 같은 칸 중복 보내기 방지.

---

## ✅ Phase 1 — 마이그레이션 (완료)

### 작업물
- 마이그레이션 파일: `supabase/migrations/20260606040000_add_mandalart_cell_id_source.sql`
- Supabase 원격(`kfvijixulsvxelmmqzpm` = my-planner)에 `apply_migration` 적용 완료

### 변경 내용
4개 테이블에 출처 추적용 컬럼 추가:

| 테이블 | 컬럼 | 타입 | FK |
|--------|------|------|----|
| `annual_goals` | `mandalart_cell_id` | `uuid NULL` | → `mandalart_cells(id)` ON DELETE SET NULL |
| `monthly_goals` | `mandalart_cell_id` | `uuid NULL` | → `mandalart_cells(id)` ON DELETE SET NULL |
| `weekly_goals` | `mandalart_cell_id` | `uuid NULL` | → `mandalart_cells(id)` ON DELETE SET NULL |
| `todos` | `mandalart_cell_id` | `uuid NULL` | → `mandalart_cells(id)` ON DELETE SET NULL |

- partial btree 인덱스(`WHERE mandalart_cell_id IS NOT NULL`) — "이 셀에서 보낸 적 있는가?" 조회 최적화
- 셀이 삭제되어도 보내서 만든 목표/할일은 보존, 출처 배지만 사라짐
- Realtime publication 변경 불필요(`todos`는 이미 등록, 나머지는 영향 없음)

### 검증
```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and column_name='mandalart_cell_id'
order by table_name;
```
→ 4개 테이블 모두 `uuid, YES`(nullable) 확인 ✅

---

## 🚧 Phase 2 — 보내기 액션 (다음 세션에서 진행)

### 요구사항
만다라트의 **세부 칸** 또는 **행동 칸** 에서 "보내기" 액션 노출:

#### ① 기간별 목표로 보내기
- 종류 선택: 연간 / 월간 / 주간
- 기간 선택:
  - 연간 → `year` (기본값: 올해)
  - 월간 → `yyyy-MM` (기본값: 이번 달)
  - 주간 → `yyyy-Www` ISO 주 키 (기본값: 이번 주)
- 동작: 해당 goals 테이블에 `text` 복사 + `mandalart_cell_id` 기록하여 row 생성
  - `annual_goals.upsert` / `monthly_goals.upsert` / `weekly_goals.upsert` 활용
  - 신규 id 는 기존 패턴대로 클라이언트 생성 (text PK)

#### ② 할일로 보내기
- `todos` 테이블에 `text` 복사 + `mandalart_cell_id` 기록하여 생성
- 옵션: `weekly_goal_id` 지정 가능 (이미 같은 칸에서 주간 목표로 보낸 적 있으면 자동 연결 제안 검토)
- 옵션: 날짜 지정 (기본 미지정)

### UI 위치 후보
- 만다라트 셀 편집 모달(`MandalartBoardMobile.tsx` 의 `EditModal`)에 "보내기" 버튼 추가
- 또는 셀 우측 상단/하단에 작은 share 아이콘
- **사용자가 언급한 "첨부한 목업"이 이번 세션엔 첨부되어 있지 않아 디자인 확정 보류 — 다음 세션 시작 시 목업 재확인 필요**

### 구현 진입 지점 (코드)
- 만다라트 셀: `src/app/components/mandalart/MandalartBoardMobile.tsx`, `MandalartBoardPC.tsx`
- 셀 데이터 타입: `{ id, board_id, parent_id, position, content, is_done }`
  - `parent_id === null` → 세부 / `parent_id` 있음 → 행동
- DB 레이어: `src/lib/db.ts`
  - `db.annualGoals.upsert` / `db.monthlyGoals.upsert` / `db.weeklyGoals.upsert` / `db.todos.upsert` (확인 필요)
  - **TODO: 각 `from*` 변환 함수에 `mandalart_cell_id` 필드 추가 필요** (현재는 매핑 미반영)
  - **TODO: 각 `to*` 변환 함수에도 `mandalartCellId` 추가**
  - **TODO: `AnnualGoalRow`/`MonthlyGoalRow`/`WeeklyGoalRow`/`TodoRow` 타입에 `mandalart_cell_id: string | null` 추가**
  - **TODO: `Todo`/`WeeklyGoal`/`MonthlyGoal`/`AnnualGoal` 타입(`src/app/store.tsx`)에 `mandalartCellId?: string` 추가**

### 검증
- 세부/행동 칸 "보내기" → 종류·기간 선택 → 저장
- `/goals` 기간별 모드에서 해당 항목 출현
- `/할일` 또는 `/일간` 에서 해당 todo 출현
- DB 에서 `mandalart_cell_id` 가 정확한 셀 UUID 로 기록되는지 확인

---

## 🚧 Phase 3 — ✦ 출처 표시 + 중복 방지 (다음 세션)

### 요구사항
1. **만다라트 셀**: 이미 어딘가로 보낸 칸은 우상단에 작은 ✦ 마크 표시
   - "보낸 곳" 종류별 색/툴팁 (예: 연간/월간/주간/할일)
2. **보내서 생긴 목표/할일**: 카드/행에 "✦ 만다라트" 배지 표시
   - 색상 토큰 `t.accentLight` + `t.accent` (만다라트 핵심 색과 동일)
   - 적용 위치:
     - `/goals` 기간별 모드 캐스케이드 카드 (PC `PeriodCascadePC`, 모바일 `PeriodCascadeMobile`)
     - `/할일` `TodosView` TodoRow
     - `/일간` `DailyView` TodoRow
3. **중복 방지**: 같은 칸을 같은 종류로 다시 보내려 하면 안내 모달
   - "이 칸은 이미 [연간/월간/주간/할일]로 보냈어요" + 기존 항목 보기 옵션
   - 다른 종류로는 보낼 수 있음 (예: 주간으로 보낸 칸을 할일로도 보낼 수 있음)
   - 판정 쿼리: `select 1 from annual_goals where mandalart_cell_id = ? limit 1` (각 테이블별)

### 검증
- 만다라트 칸 보내기 → 칸에 ✦ 표시 즉시 반영(Realtime)
- 보내서 생긴 목표/할일에 "✦ 만다라트" 배지 표시
- 같은 칸을 같은 종류로 또 보내려 하면 안내 모달
- 다른 종류로는 보낼 수 있음

---

## 📌 작업 원칙 (세션 시작 시 재확인)

- Figma 생성 파일은 수정 금지 — 메뉴/탭/페이지가 Figma 파일이면 멈추고 보고
- 색상 하드코딩 금지, 기존 디자인 토큰만 사용 (`t.accent`/`t.accentLight`/`t.success`/`t.bgSub`/...)
- 폰트 DM Serif Display / Gaegu / Nanum Pen 없으면 추가, 기존 폰트 유지
- 모바일(lg 미만, iPhone14/390)·PC(lg 이상) 모두 작업, 다른 페이지 깨지지 않게
- 첨부 목업의 레이아웃·간격·인터랙션 기준 (다음 세션 시작 시 목업 첨부 재확인 필요)
- 각 Phase 끝나면 멈추고 한국어로 보고
- **Supabase Realtime 필수** — 기간별 목표/할일 변경 시 PC↔모바일 즉시 반영

---

## 🔗 관련 파일 빠른 참조

- **만다라트 컴포넌트**
  - `src/app/components/mandalart/MandalartView.tsx`
  - `src/app/components/mandalart/MandalartBoardMobile.tsx`
  - `src/app/components/mandalart/MandalartBoardPC.tsx`
- **기간별 모드 캐스케이드**
  - `src/app/components/goals/PeriodCascadePC.tsx` (위치 확인 필요)
  - `src/app/components/goals/PeriodCascadeMobile.tsx`
  - `src/app/components/goals/periodProgress.ts`
- **할일/일간 (Phase 3 배지 위치)**
  - `src/app/components/todos/TodosView.tsx` 안 TodoRow
  - `src/app/components/daily/DailyView.tsx` 안 TodoRow
- **DB 레이어**: `src/lib/db.ts` (1649~끝 줄: mandalartBoards/mandalartCells, 663~ weekly/monthly/annual)
- **타입**: `src/app/store.tsx` (Todo, WeeklyGoal, MonthlyGoal, AnnualGoal)
- **마이그레이션**: `supabase/migrations/20260606040000_add_mandalart_cell_id_source.sql`
