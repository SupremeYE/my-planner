# DAILY_REPORT_SCHEMA.md

> daily-report Edge Function이 "오늘자 데이터"로 가져올 수 있는 카테고리 조사 보고서
> (코드 수정 없이 `supabase/migrations/` + `src/`의 `.from()` 쿼리·row 타입 정의를 기반으로 작성)
>
> 작성일: 2026-05-31 / 조사 대상 프로젝트: `kfvijixulsvxelmmqzpm` (my-planner)

---

## 요약 표

| 카테고리 | 테이블 | 존재 | 오늘자 필터 | 비고 |
|---------|--------|:----:|------------|------|
| 일정 (이벤트) | `events` | ✅ | `start_at` 범위 (timestamptz) | KST 날짜 → UTC 범위 변환 필요 |
| 타임라인/시간박스(PLAN/DO) | `todos` + `timeline_logs` | ✅ | `date = 'YYYY-MM-DD'` | PLAN/DO는 todos 컬럼, 로그는 timeline_logs |
| 식단 기록 | `food_records` | ✅ | `date = 'YYYY-MM-DD'` | 끼니별 |
| 독서 기록 | `books` + `book_quotes` | ✅ | 날짜 컬럼 없음(주의) | "오늘 읽음" 직접 필터 불가 |
| 회고/저널 | `review_records` (+ `question_answers`) | ✅ | `date = 'YYYY-MM-DD'` | 질문일기는 `answered_at` |
| 자기관리 | `self_care_records` | ✅ | `date = 'YYYY-MM-DD'` | 수면 포함, 생리는 `period_records` |
| 목표 (오늘 관련) | `weekly_goals` / `monthly_goals` | ⚠️ 부분 | 직접적인 "오늘" 컬럼 없음 | 주차/월 키로 간접 필터 |
| 감정 기록 | `mood_records` | ✅(추가발견) | `date = 'YYYY-MM-DD'` | 회고와 별개 |

> **날짜 기준 주의:** 기존 daily-report 함수는 KST(UTC+9)로 `today = 'YYYY-MM-DD'`를 계산한다. `date` 컬럼이 text(`yyyy-MM-dd`)인 테이블은 그 값으로 `.eq('date', today)` 하면 되지만, `events`는 `timestamptz`라 KST 하루의 시작/끝을 UTC로 변환해 범위 쿼리해야 한다.

---

## 1. 일정 (오늘 스케줄/이벤트)

- **카테고리명:** 일정 (이벤트)
- **테이블명:** `events`
- **주요 컬럼** (마이그레이션 `20260412010000_add_events_v2_schema.sql` 기준):
  - `title` text — 일정 제목
  - `is_all_day` boolean — 종일 여부
  - `start_at` timestamptz — 시작 일시
  - `end_at` timestamptz — 종료 일시
  - `location` text|null, `memo` text|null, `color` text|null
  - `repeat_type` (`none|daily|weekly|monthly`), `repeat_end_date` date
  - `user_id` uuid (소유자)
- **오늘자 데이터 쿼리 방법:**
  - `date` 텍스트 컬럼이 **없음**. `start_at`(timestamptz)로 범위 필터.
  - KST 오늘 = `[오늘 00:00 KST, 다음날 00:00 KST)` → UTC로는 `[전날 15:00Z, 오늘 15:00Z)`
  - 예: `.gte('start_at', '<오늘0시 KST의 UTC>').lt('start_at', '<내일0시 KST의 UTC>')`
  - ⚠️ 반복 일정(`repeat_type != 'none'`)은 row가 하루치만 저장되고 앱(`src/api/events.ts`)에서 전개하는 구조 → Edge Function에서 단순 범위 쿼리하면 반복 인스턴스는 누락될 수 있음.
- **리포트에 보이면 좋을 정보:** `start_at` 시각(HH:mm) + `title` (+ 종일이면 "종일", `location` 있으면 장소)

## 2. 타임라인 / 시간박스 (PLAN/DO)

- **카테고리명:** 타임라인 / 시간박스
- **테이블명:** `todos` (PLAN/DO 블록) + `timeline_logs` (생각·감정 로그)
- **주요 컬럼:**
  - `todos`: `text`, `date`(text yyyy-MM-dd), `plan_start`/`plan_end`(HH:mm), `do_start`/`do_end`(HH:mm), `do_elapsed_sec`, `status`, `is_top3`
  - `timeline_logs`: `date`(text), `time`(HH:mm), `text`, `icon`, `color`
- **오늘자 데이터 쿼리 방법:**
  - 둘 다 `date` text 컬럼 → `.eq('date', today)`
  - PLAN이 있는 항목: `plan_start IS NOT NULL`, DO(실행 완료) 항목: `do_start IS NOT NULL`
- **리포트에 보이면 좋을 정보:**
  - PLAN: `plan_start~plan_end` + `text`
  - DO: `do_start~do_end` (또는 `do_elapsed_sec`를 분으로) + `text`
  - 타임라인 로그: `time` + `icon` + `text`

## 3. 식단 기록

- **카테고리명:** 식단 기록
- **테이블명:** `food_records`
- **주요 컬럼** (`src/lib/db.ts` foodRecords 매핑 기준):
  - `date`(text yyyy-MM-dd), `meal_type`(`breakfast|lunch|dinner|snack`)
  - `food_name`, `amount`(식비 원), `calories`, `carbs`, `protein`, `fat`
  - `dining_type`(`home|delivery|restaurant|coffee`), `taste_rating`(`good|normal|bad`), `taste_memo`, `photo_url`, `memo`
- **오늘자 데이터 쿼리 방법:** `.eq('date', today)`
- **리포트에 보이면 좋을 정보:** 끼니(`meal_type`, 이모지: 아침🌅/점심☀️/저녁🌙/간식🍪) + `food_name`, 하루 총 칼로리 합계, 총 식비(`amount` 합)

## 4. 독서 기록

- **카테고리명:** 독서 기록
- **테이블명:** `books` (+ 인용구 `book_quotes`)
- **주요 컬럼:**
  - `books`: `title`, `author`, `publisher`, `total_pages`, `current_page`, `status`(`reading|want|done`), `start_date`, `finish_date`, `added_at`
  - `book_quotes`: `book_id`, `text`, `page`, `tags`, `starred`, `created_at`
- **오늘자 데이터 쿼리 방법:**
  - ⚠️ **"오늘 읽은 분량"을 직접 나타내는 날짜 컬럼이 없음.** `current_page`는 누적 현재 페이지일 뿐 날짜별 진행 이력이 없다.
  - 간접 활용 가능한 것:
    - 오늘 추가한 인용구: `book_quotes.created_at`이 오늘인 것 (timestamptz → 범위 필터)
    - 오늘 완독: `books.finish_date = today`
    - 오늘 시작: `books.start_date = today`
    - 현재 읽는 중인 책 목록: `books.status = 'reading'` (날짜 무관)
- **리포트에 보이면 좋을 정보:** "읽는 중: {title} ({current_page}/{total_pages}p)", 오늘 기록한 인용구 수/내용
- **결론:** 카테고리는 존재하나 **"오늘자 독서량" 필터는 구조적으로 제한적**. 인용구 작성일/완독일 정도만 오늘 기준 추출 가능.

## 5. 회고 / 저널

- **카테고리명:** 회고 / 저널
- **테이블명:** `review_records` (일간 회고) — 보조: `question_answers`(질문일기), `weekly_reviews`/`monthly_reviews`(주/월 회고)
- **주요 컬럼:**
  - `review_records`: `date`(text), `types`(text[]), `emotion`(1~5), `emotion_memo`, `gratitude`(text[]), `kpt_keep`/`kpt_problem`/`kpt_try`, `happiness`, `daily_summary`, `daily_good`, `daily_improve`
  - `question_answers`: `question_id`, `answer`, `answered_at`(text yyyy-MM-dd)
- **오늘자 데이터 쿼리 방법:**
  - `review_records`: `.eq('date', today)`
  - `question_answers`: `.eq('answered_at', today)` (+ `question_pool`에서 질문 본문 조인)
- **리포트에 보이면 좋을 정보:** 오늘 회고 작성 여부, 감정 레벨, 감사 항목, KPT 한 줄, 오늘의 질문+답변

## 6. 자기관리

- **카테고리명:** 자기관리
- **테이블명:** `self_care_records` (+ 민감정보 `period_records`)
- **주요 컬럼:**
  - `self_care_records`: `date`(text), `category`(`exercise|study|beauty|sleep`), `content`, `duration`(분), `sleep_start`/`sleep_end`(수면 카테고리 전용)
  - `period_records`: `start_date`, `end_date`, `symptoms`(text[]), `flow_level`, `memo`
- **오늘자 데이터 쿼리 방법:**
  - `self_care_records`: `.eq('date', today)`
  - 수면: 같은 테이블 `category = 'sleep'` + `sleep_start`/`sleep_end`로 수면시간 계산
  - `period_records`: 오늘이 `start_date`~`end_date` 사이인지 범위 판단 (리포트에 노출은 민감정보라 신중)
- **리포트에 보이면 좋을 정보:** 카테고리별 기록(운동/공부/케어) + `content` + `duration`(분), 수면 시간

## 7. 목표 (오늘 관련 있는 부분만)

- **카테고리명:** 목표
- **테이블명:** `weekly_goals`, `monthly_goals` (+ `annual_goals`, `quarterly_goals`)
- **주요 컬럼:**
  - `weekly_goals`: `text`, `done`(boolean), `week_key`(예 `2026-W22`), `monthly_goal_id`
  - `monthly_goals`: `text`, `month`(예 `2026-05`), `project_id`, `annual_goal_id`
- **오늘자 데이터 쿼리 방법:**
  - ⚠️ **"오늘"에 직접 매핑되는 날짜 컬럼 없음.** 목표는 주/월 단위.
  - "오늘이 속한 주": `week_key`를 오늘 기준으로 계산해 `.eq('week_key', 현재주차)`
  - "이번 달": `month`를 `.eq('month', 'YYYY-MM')`
  - 완료율: `done = true` 비율
- **리포트에 보이면 좋을 정보:** 이번 주 목표 달성률(done/total), 미완료 주간 목표 텍스트, 이번 달 목표 진행 상황
- **결론:** "오늘"이라는 단위는 없고 **주/월 키로 간접 필터**해야 함.

---

## 추가 발견: 감정 기록 (mood_records)

회고와 별개로 **감정 전용 테이블**이 존재.

- **테이블명:** `mood_records`
- **주요 컬럼:** `date`(text yyyy-MM-dd), `time_of_day`, `body_signals`(text[]), `emotion_tags`(text[]), `energy_level`(int), `memo`
- **오늘자 쿼리:** `.eq('date', today)`
- **리포트 활용:** 오늘 기록한 감정 태그, 에너지 레벨, 메모

---

## 종합 결론

### "오늘자"를 깔끔하게 가져올 수 있는 카테고리 (text `date` 컬럼)
`todos`(PLAN/DO), `timeline_logs`, `food_records`, `self_care_records`, `review_records`, `question_answers`(answered_at), `mood_records` → 전부 `.eq('date'/'answered_at', today)` 한 줄로 가능. **현재 daily-report 함수의 todos/habits 방식과 동일하게 확장 가능.**

### 날짜 변환이 필요한 카테고리 (timestamptz)
`events`(`start_at`), `book_quotes`(`created_at`) → KST 하루를 UTC 범위로 변환해 `.gte/.lt` 필터 필요.

### "오늘" 개념이 약해 간접 필터가 필요한 카테고리
- **목표**(`weekly_goals`/`monthly_goals`): 주차/월 키 계산 필요.
- **독서**(`books`): 날짜별 진행 이력 컬럼 없음 → 완독일/시작일/인용구 작성일 정도만 오늘 기준 추출 가능.

### 존재하지 않는 카테고리
- 조사한 7개 카테고리 모두 대응 테이블이 **존재함**. 다만 위처럼 "오늘 단위 필터" 적합도는 카테고리마다 다름.
- 별도의 "운동 전용", "물 섭취 전용" 등의 독립 테이블은 없음 (자기관리/습관에 통합).

> 본 문서는 조사 결과만 기록하며, daily-report 함수 코드는 수정하지 않았습니다.
