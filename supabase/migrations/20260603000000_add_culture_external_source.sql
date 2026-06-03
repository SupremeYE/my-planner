-- 문화 기록(culture_records): 외부 출처 식별 컬럼 추가
-- 목적: Stage 2의 TMDB/유튜브 자동 검색 연동 대비.
--  - Stage 1 에서는 external_source = 'manual' 로만 저장됨.
--  - Stage 2 에서 자동 검색이 붙으면 'tmdb_movie'|'tmdb_tv'|'youtube' 로 채워지고,
--    external_id 에 해당 출처의 콘텐츠 ID(TMDB id, YouTube video id 등)를 저장한다.
-- 비고: 20260602000000_create_culture_records.sql 의 정의에도 동일 컬럼을 반영했으나,
--       해당 테이블이 이미 운영 DB에 존재하므로(create if not exists) 별도 ALTER 로 추가한다.

alter table public.culture_records
  add column if not exists external_source text,
  add column if not exists external_id text;

-- external_source 허용값 제약 (이미 있으면 skip)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'culture_records_external_source_check'
  ) then
    alter table public.culture_records
      add constraint culture_records_external_source_check
      check (external_source in ('tmdb_movie','tmdb_tv','youtube','manual'));
  end if;
end $$;
