-- habits 테이블에 reason 컬럼 추가 (이 습관을 하려는 이유)
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- habit_monthly_memos 테이블 신규 생성
-- habit_id = '__review__' 는 전체 월간 회고용 특수 레코드
CREATE TABLE IF NOT EXISTS habit_monthly_memos (
  id              TEXT        PRIMARY KEY,
  habit_id        TEXT        NOT NULL,
  year            INTEGER     NOT NULL,
  month           INTEGER     NOT NULL,        -- 1 ~ 12
  memo            TEXT        NOT NULL DEFAULT '',
  what_worked     TEXT        NOT NULL DEFAULT '',
  what_didnt_work TEXT        NOT NULL DEFAULT '',
  next_month      TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, year, month)
);
