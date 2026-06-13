-- 산책(Walk) 모듈 — Phase 0: walk_sessions 테이블 토대
-- 목적: 걸은 길을 기록하고(자유/코스/내코스) 완료 시 사진·경로·손글씨 메모로 기록 카드를 남기는
--       기능 전체가 얹힐 데이터 골격을 만든다. 이 단계는 UI 가 비어 있어도 라우팅/CRUD 가 가능한
--       데이터 레이어만 완성한다.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션 — places / diary_entries / workout_* 패턴 동일):
--  - 사용자 소유 테이블의 user_id 는 DEFAULT auth.uid() 로 자동 채운다(클라이언트 미전송).
--  - RLS 는 "로그인한 본인(소유자)만" 정책으로 select/insert/update/delete 통일.
--  - region_code 는 가고싶은 곳의 시도 코드(예: "incheon")와 1:1 — 기억/지도 연동 여지(시작점 기준).
--    좌표→시도 변환은 후속 단계(카카오 지오코딩)에서 채운다. Phase 0 에선 null 허용.
--  - path/planned_route 는 jsonb 좌표 배열. path = 실제 걸은 좌표 [{lat,lng,t}],
--    planned_route = 코스/내코스 모드의 목표 경로(자유 모드는 null).
--  - 거리(distance_m)·시간(duration_s)·평균 페이스(avg_pace_s_per_km)는 클라이언트(하버사인)에서
--    계산해 저장한다(조회 시 재계산 불필요).
--
-- updated_at: 이 프로젝트엔 set_updated_at 트리거 컨벤션이 없다 → 앱 db 레이어에서 갱신하지 않고
--             created_at 만 둔다(완료 후 메모/사진 수정은 update 로 처리, 별도 updated_at 미사용).

-- ── walk_sessions — 산책 세션(한 번의 산책 = 한 행) ─────────────────────────────
create table if not exists public.walk_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode text not null default 'free' check (mode in ('free','course','repeat')),
  started_at timestamptz,
  ended_at timestamptz,
  distance_m int not null default 0,            -- 총 이동 거리(미터)
  duration_s int not null default 0,            -- 총 소요 시간(초)
  avg_pace_s_per_km int,                        -- 평균 페이스(초/km), 계산해 저장
  path jsonb not null default '[]'::jsonb,       -- 실제 걸은 좌표 [{lat,lng,t}]
  planned_route jsonb,                          -- 코스/내코스 목표 경로(있으면)
  start_lat numeric,                            -- 시작점 좌표(기억/지도 연동 여지)
  start_lng numeric,
  region_code text,                             -- 시작점 시도 코드(예: "incheon"), 후속 단계에서 채움
  photo_url text,                               -- 완료 카드 사진(walk-photos 버킷)
  memo text,                                    -- 손글씨 메모(거의 일기 같은 기록)
  route_name text,                              -- "내 코스 다시" 저장용 코스 이름
  is_saved_route boolean not null default false, -- 재사용 가능한 내 코스 여부
  created_at timestamptz not null default now()
);

alter table public.walk_sessions enable row level security;

drop policy if exists "Users can view their own walk_sessions"   on public.walk_sessions;
drop policy if exists "Users can insert their own walk_sessions" on public.walk_sessions;
drop policy if exists "Users can update their own walk_sessions" on public.walk_sessions;
drop policy if exists "Users can delete their own walk_sessions" on public.walk_sessions;

create policy "Users can view their own walk_sessions"
  on public.walk_sessions for select using (user_id = auth.uid());
create policy "Users can insert their own walk_sessions"
  on public.walk_sessions for insert with check (user_id = auth.uid());
create policy "Users can update their own walk_sessions"
  on public.walk_sessions for update using (user_id = auth.uid());
create policy "Users can delete their own walk_sessions"
  on public.walk_sessions for delete using (user_id = auth.uid());

create index if not exists walk_sessions_user_started_idx
  on public.walk_sessions (user_id, started_at desc);
create index if not exists walk_sessions_saved_route_idx
  on public.walk_sessions (user_id, is_saved_route);
create index if not exists walk_sessions_region_code_idx
  on public.walk_sessions (region_code);

-- ── Realtime publication 등록 (이미 등록된 경우 skip) ──────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'walk_sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.walk_sessions';
  end if;
end $$;
