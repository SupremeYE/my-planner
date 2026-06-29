-- music_records 에 listened_date 추가 — 일간 "오늘 기록" 칩 집약(summaryForDate) 용 (Stage 2.5)
-- 배경: 기존엔 created_at 만 있어 "그날 들은 음악"을 날짜로 조회할 수 없었다.
-- 컨벤션: 다른 기록 테이블(condition/food/place_visits 등)의 date 컬럼과 동일하게
--         "그날 집약 키"로 사용한다. KST(Asia/Seoul) 기준 날짜.

alter table public.music_records
  add column if not exists listened_date date default ((now() at time zone 'Asia/Seoul')::date);

-- 기존 행 백필: 생성 시각(KST)의 날짜로 채워 과거 기록도 그날 칩에 노출되게.
update public.music_records
  set listened_date = ((created_at at time zone 'Asia/Seoul')::date)
  where listened_date is null;

-- 그날 음악 조회용 인덱스
create index if not exists music_records_user_listened_idx
  on public.music_records (user_id, listened_date);

-- RLS / Realtime 은 테이블 단위라 컬럼 추가만으로 그대로 적용된다(추가 작업 없음).
