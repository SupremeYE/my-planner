-- 리뷰 & 기록 Stage 1 — 백필 (1회성, 비파괴, 멱등)
-- 기존 review_records.happiness(비어있지 않은 행) → happy_moments 로 1건씩 이관.
--   content     = review_records.happiness
--   date        = review_records.date
--   happened_at = NULL (과거 건은 시각 없음)
-- 멱등성: 동일 (date, content) 가 happy_moments 에 이미 있으면 스킵 → 재실행해도 중복 INSERT 없음.
-- 원본 review_records.happiness 는 삭제하지 않음(보존).

insert into public.happy_moments (content, date, happened_at)
select r.happiness, r.date, null
from public.review_records r
where r.happiness is not null
  and btrim(r.happiness) <> ''
  and not exists (
    select 1 from public.happy_moments h
    where h.content = r.happiness
      and h.date is not distinct from r.date
  );
