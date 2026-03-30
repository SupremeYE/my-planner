-- period_records 테이블 생성 (생리 기록)
create table if not exists period_records (
  id          text        primary key,
  start_date  text        not null,                     -- 시작일 (yyyy-MM-dd)
  end_date    text,                                     -- 종료일 (yyyy-MM-dd), nullable
  symptoms    jsonb       not null default '[]'::jsonb, -- 증상 배열 ["두통","복통",...]
  flow_level  text,                                     -- 흘림양: light | medium | heavy
  memo        text,                                     -- 메모 (선택)
  created_at  timestamptz not null default now()
);
