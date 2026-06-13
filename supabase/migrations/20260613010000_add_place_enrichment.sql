-- 가고싶은 곳 Stage 3B — places 인리치먼트 컬럼 (additive)
-- 저장 시점 1회 enrich-place Edge Function 이 채운다. 이후 읽기만.
--  - blog_reviews: 네이버 블로그 후기 캐시(최대 5)
--  - ai_summary:   Haiku 요약(선택)
--  - enriched_at:  인리치먼트 성공 시각(null = 아직/실패 → 재시도 가능)
-- (Stage 1 의 rating/review_count 는 구글 별점 미사용 결정에 따라 건드리지 않음)
alter table public.places
  add column if not exists blog_reviews jsonb not null default '[]'::jsonb,
  add column if not exists ai_summary   text,
  add column if not exists enriched_at  timestamptz;
