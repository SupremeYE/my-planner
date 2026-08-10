-- 컨디션 기록 재설계 Stage 1 — 스키마 마이그레이션
-- 배경: "컨디션 기록" 화면이 한 칸에 세 가지(스트레스/시점/증상)를 뭉쳐 혼란. 마지막 기록 2026-07-20에서 끊김.
-- 목적: 컨디션(몸 상태)을 독립 축으로 신설하고, 시점(slot)을 도입하며, 스트레스를 선택으로 완화한다.
-- 데이터: 마이그레이션 시점 8행(2026-06-03 ~ 2026-07-20, 전부 서로 다른 날짜, 하루 1행). 저위험.

-- ① condition (몸 상태) — 신규. 4단계 (1=나쁨, 2=보통, 3=좋음, 4=아주 좋음).
--   nullable: 기존 8행은 NULL(역산 금지 — 스트레스와 다른 축이라 추정은 데이터 오염). NULL 은 CHECK 통과.
--   프로젝트 관례(weight_records.slot, monthly_goals.retro_status, mandalart_cells.color) = CHECK in/BETWEEN.
alter table public.condition_records
  add column if not exists condition smallint;

alter table public.condition_records
  drop constraint if exists condition_records_condition_check;
alter table public.condition_records
  add constraint condition_records_condition_check
  check (condition between 1 and 4);

-- ② slot (시점) — 신규. 아침/낮/저녁.
--   ⚠️ 값 체계 정합: weight_records.slot 은 한글 '아침'/'저녁'/'기타'(주간 리뷰의 동일 slot 비교에 쓰임).
--   앱 안에 시점 체계가 둘로 갈라지지 않도록 한글 라벨을 쓰고, 비교 앵커인 '아침'/'저녁'을 그대로 재사용한다.
--   차이: 세 번째 값만 다르다 — weight 는 '기타'(스케줄 밖 측정용 캐치올), condition 은 '낮'(실재하는 한낮 컨디션).
--   컨디션엔 '기타'가 의미 없고(한낮 상태는 캐치올이 아님), 몸무게엔 '낮'이 의미 없다(정해진 시점 측정) → 세 번째만 도메인별로 갈린다.
--   nullable: 기존 8행은 시점 불명이라 NULL(억지 추정 금지). NULL 은 CHECK 통과.
alter table public.condition_records
  add column if not exists slot text;

alter table public.condition_records
  drop constraint if exists condition_records_slot_check;
alter table public.condition_records
  add constraint condition_records_slot_check
  check (slot in ('아침', '낮', '저녁'));

-- ③ stress 를 nullable 로 완화 — 매일 스트레스를 평가하는 것은 부담. 몸 상태만 찍고 넘어갈 수 있어야 기록이 이어진다.
alter table public.condition_records
  alter column stress drop not null;

-- ④ 하루 여러 건 허용 — date UNIQUE → (date, slot) UNIQUE 로 교체.
--   "아침엔 괜찮았는데 저녁에 무너졌다"를 담으려면 같은 날 시점별 여러 행이 필요하다.
--   NULLS DISTINCT(기본): 기존 8행은 slot=NULL 이고 날짜가 전부 다르므로 충돌 없음.
--   신규 기록은 slot 이 비어있지 않아(아침/낮/저녁) 같은 (날짜,시점) 재기록만 덮어쓰기로 동작한다.
alter table public.condition_records
  drop constraint if exists condition_records_date_key;
alter table public.condition_records
  drop constraint if exists condition_records_date_slot_key;
alter table public.condition_records
  add constraint condition_records_date_slot_key unique (date, slot);
