-- 번쩍노트 '언젠가' (씨앗밭) — someday_seeds 테이블
-- 목적: "문득 든 삶의 방향·바람"을 정제 전 raw 한 줄(씨앗)로 던져두고, 일부를 목표/버킷으로
--       "키우기(승격)"한다. 씨앗밭 페이지(Theme H 전용)가 얹힐 데이터 골격.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션 — walk_sessions / places / diary_entries 패턴 동일):
--  - user_id 는 DEFAULT auth.uid() 로 자동 채운다(클라이언트 미전송).
--  - RLS 는 "로그인한 본인(소유자)만" 정책으로 select/insert/update/delete 통일.
--  - kind(결) = §3 카테고리와 다른 '새 축': none(미분류·기본) / do(해보고 싶은) / be(되고 싶은)
--    / build(만들고 싶은). CHECK 로 값 고정.
--  - status: seed(씨앗·기본) → grown(자람 = 목표/버킷으로 승격됨).
--  - grown_to: 승격 대상 종류. 'goal'(= annual_goals) 또는 'bucket'(버킷 페이지는 후속 라운드).
--    NULL = 아직 씨앗. 만다라트 등 목표 세부 종류 확장은 후속에 grown_ref_kind 로 (이번 범위 밖).
--  - grown_ref_id: 승격으로 생긴 대상의 id(annual_goals.id 는 text). grown_to 가 폴리모픽(goal|bucket,
--    bucket 은 아직 테이블 없음)이라 FK 를 걸지 않고 plain text 로 둔다. 대상 삭제 시 ref 는 dangling
--    이 될 수 있으나 status='grown' 표시엔 무해(전용 뷰에서 존재 확인). 'bucket' 은 마킹만 → ref NULL.
--
-- updated_at: 이 프로젝트엔 set_updated_at 트리거 컨벤션이 없다 → created_at 만 둔다(승격 마킹은
--             update 로 kind/status/grown_* 만 갱신, 별도 updated_at 미사용).

-- ── someday_seeds — 씨앗 한 줄 = 한 행 ─────────────────────────────────────────
create table if not exists public.someday_seeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  kind text not null default 'none' check (kind in ('none','do','be','build')),
  status text not null default 'seed' check (status in ('seed','grown')),
  grown_to text check (grown_to in ('goal','bucket')),   -- NULL = 아직 씨앗
  grown_ref_id text,                                     -- 승격 대상 id(annual_goals.id=text), 폴리모픽이라 FK 없음
  created_at timestamptz not null default now()
);

alter table public.someday_seeds enable row level security;

drop policy if exists "Users can view their own someday_seeds"   on public.someday_seeds;
drop policy if exists "Users can insert their own someday_seeds" on public.someday_seeds;
drop policy if exists "Users can update their own someday_seeds" on public.someday_seeds;
drop policy if exists "Users can delete their own someday_seeds" on public.someday_seeds;

create policy "Users can view their own someday_seeds"
  on public.someday_seeds for select using (user_id = auth.uid());
create policy "Users can insert their own someday_seeds"
  on public.someday_seeds for insert with check (user_id = auth.uid());
create policy "Users can update their own someday_seeds"
  on public.someday_seeds for update using (user_id = auth.uid());
create policy "Users can delete their own someday_seeds"
  on public.someday_seeds for delete using (user_id = auth.uid());

-- 최신순 목록 + 결/상태 필터 조회용
create index if not exists someday_seeds_user_created_idx
  on public.someday_seeds (user_id, created_at desc);
create index if not exists someday_seeds_user_kind_idx
  on public.someday_seeds (user_id, kind);
create index if not exists someday_seeds_user_status_idx
  on public.someday_seeds (user_id, status);

-- ── Realtime publication 등록 (이미 등록된 경우 skip) ──────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'someday_seeds'
  ) then
    execute 'alter publication supabase_realtime add table public.someday_seeds';
  end if;
end $$;
