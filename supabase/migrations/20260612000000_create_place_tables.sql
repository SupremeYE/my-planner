-- 가고싶은 곳(Place) 모듈 — Stage 1: DB 스키마 토대
-- 목적: 장소 기능 전체가 얹힐 데이터 골격(폴더 · 장소 · 다대다 연결 · 방문 기록)을 만든다.
--       이 단계는 UI 가 없다. 콘솔/임시 호출로 CRUD 가 가능한 데이터 레이어만 완성한다.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션 — diary_entries / workout_* / mandalart_* 패턴 동일):
--  - 사용자 소유 테이블의 user_id 는 DEFAULT auth.uid() 로 자동 채운다(클라이언트 미전송).
--  - RLS 는 "로그인한 본인(소유자)만" 정책으로 select/insert/update/delete 통일.
--  - place_folder_items 는 user_id 컬럼이 없으므로 부모(place/folder)의 소유권을 EXISTS 로 확인.
--  - 색상은 디자인 토큰 "키 문자열"(gold/coral/green 등)만 저장한다. 하드코딩 hex 금지.
--  - region_code 는 기억 탭 한국 SVG 지도의 path id 와 1:1 일치하는 시도 코드(예: incheon).
--    좌표→시도 변환은 Stage 3(카카오 지오코딩, 저장 시점 1회)에서 채운다.
--
-- updated_at: 이 프로젝트엔 set_updated_at 트리거 컨벤션이 없다(diary_entries 도 앱 코드에서
--             updated_at 을 직접 갱신). places.updated_at 도 동일하게 db 레이어에서 갱신한다.

-- ── 1) place_folders — 폴더 = 테마 지도 ────────────────────────────────────────
create table if not exists public.place_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,                 -- 예: "카공지도", "가고싶은 카페"
  icon text,                          -- 이모지 (예: "💻")
  color text,                         -- 디자인 토큰 키만 (예: "coral"). 하드코딩 hex 금지
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.place_folders enable row level security;

drop policy if exists "Users can view their own place_folders"   on public.place_folders;
drop policy if exists "Users can insert their own place_folders" on public.place_folders;
drop policy if exists "Users can update their own place_folders" on public.place_folders;
drop policy if exists "Users can delete their own place_folders" on public.place_folders;

create policy "Users can view their own place_folders"
  on public.place_folders for select using (user_id = auth.uid());
create policy "Users can insert their own place_folders"
  on public.place_folders for insert with check (user_id = auth.uid());
create policy "Users can update their own place_folders"
  on public.place_folders for update using (user_id = auth.uid());
create policy "Users can delete their own place_folders"
  on public.place_folders for delete using (user_id = auth.uid());

create index if not exists place_folders_user_sort_idx
  on public.place_folders (user_id, sort_order);

-- ── 2) places — 저장 장소 ──────────────────────────────────────────────────────
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text,                      -- 예: "카페", "맛집·냉면"
  address text,                       -- 카카오 지오코딩 결과 (Stage 3)
  region_code text,                   -- 시도 코드 (예: "incheon"). 기억 히트맵 키
  lat double precision,               -- Stage 3 에서 채움
  lng double precision,
  kakao_place_id text,                -- 카카오 장소 id (평점·리뷰 연동용)
  source text,                        -- "instagram" / "youtube" / "직접 등록" 등
  source_url text,                    -- 원본 링크
  thumbnail_url text,
  memo text,
  concept text,                       -- 뽑기 분류: cafe/charge/date/friend/culture/food
  energy smallint,                    -- 1~3, 뽑기 가중치용
  rating numeric,                     -- 카카오 평점 캐시
  review_count int,                   -- 카카오 리뷰 수 캐시
  hours text,                         -- 영업시간
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.places enable row level security;

drop policy if exists "Users can view their own places"   on public.places;
drop policy if exists "Users can insert their own places" on public.places;
drop policy if exists "Users can update their own places" on public.places;
drop policy if exists "Users can delete their own places" on public.places;

create policy "Users can view their own places"
  on public.places for select using (user_id = auth.uid());
create policy "Users can insert their own places"
  on public.places for insert with check (user_id = auth.uid());
create policy "Users can update their own places"
  on public.places for update using (user_id = auth.uid());
create policy "Users can delete their own places"
  on public.places for delete using (user_id = auth.uid());

create index if not exists places_user_idx        on public.places (user_id);
create index if not exists places_region_code_idx on public.places (region_code);
create index if not exists places_concept_idx     on public.places (concept);

-- ── 3) place_folder_items — 장소 ↔ 폴더 다대다 ─────────────────────────────────
-- 한 장소가 "가고싶은 카페"와 "카공지도"에 동시에 들어갈 수 있어야 하므로 다대다.
create table if not exists public.place_folder_items (
  place_id uuid not null references public.places(id) on delete cascade,
  folder_id uuid not null references public.place_folders(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (place_id, folder_id)
);

alter table public.place_folder_items enable row level security;

drop policy if exists "Users can view their own place_folder_items"   on public.place_folder_items;
drop policy if exists "Users can insert their own place_folder_items" on public.place_folder_items;
drop policy if exists "Users can delete their own place_folder_items" on public.place_folder_items;

-- user_id 컬럼이 없으므로 부모(place + folder) 소유권을 EXISTS 로 확인한다.
-- 유효한 행은 내 place 와 내 folder 를 모두 가리키므로 둘 다 소유 확인(가장 엄격).
create policy "Users can view their own place_folder_items"
  on public.place_folder_items for select
  using (
    exists (select 1 from public.places p        where p.id = place_folder_items.place_id  and p.user_id = auth.uid())
    and exists (select 1 from public.place_folders f where f.id = place_folder_items.folder_id and f.user_id = auth.uid())
  );
create policy "Users can insert their own place_folder_items"
  on public.place_folder_items for insert
  with check (
    exists (select 1 from public.places p        where p.id = place_folder_items.place_id  and p.user_id = auth.uid())
    and exists (select 1 from public.place_folders f where f.id = place_folder_items.folder_id and f.user_id = auth.uid())
  );
create policy "Users can delete their own place_folder_items"
  on public.place_folder_items for delete
  using (
    exists (select 1 from public.places p        where p.id = place_folder_items.place_id  and p.user_id = auth.uid())
    and exists (select 1 from public.place_folders f where f.id = place_folder_items.folder_id and f.user_id = auth.uid())
  );

create index if not exists place_folder_items_folder_idx on public.place_folder_items (folder_id);

-- ── 4) place_visits — 방문 기록 (기억 탭의 원천) ───────────────────────────────
-- 저장 안 하고 그냥 다녀온 곳도 기록 가능해야 하므로 place_id 는 nullable +
-- 이름/지역을 비정규화 저장한다. place 가 삭제돼도 방문 기록은 보존(ON DELETE SET NULL).
create table if not exists public.place_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  name text not null,                 -- place 없이도 기록되게 비정규화 저장
  region_code text not null,          -- 시도 코드 — 히트맵 집계 키
  visited_on date not null,
  mood smallint,                      -- 1~10
  note text,
  -- diary_entries.id(uuid PK) 확인됨 → FK 연결(일기 삭제 시 방문 기록 보존).
  diary_entry_id uuid references public.diary_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.place_visits enable row level security;

drop policy if exists "Users can view their own place_visits"   on public.place_visits;
drop policy if exists "Users can insert their own place_visits" on public.place_visits;
drop policy if exists "Users can update their own place_visits" on public.place_visits;
drop policy if exists "Users can delete their own place_visits" on public.place_visits;

create policy "Users can view their own place_visits"
  on public.place_visits for select using (user_id = auth.uid());
create policy "Users can insert their own place_visits"
  on public.place_visits for insert with check (user_id = auth.uid());
create policy "Users can update their own place_visits"
  on public.place_visits for update using (user_id = auth.uid());
create policy "Users can delete their own place_visits"
  on public.place_visits for delete using (user_id = auth.uid());

create index if not exists place_visits_user_region_idx on public.place_visits (user_id, region_code);
create index if not exists place_visits_visited_on_idx  on public.place_visits (visited_on desc);

-- ── 5) Realtime publication 등록 (이미 등록된 경우 skip) ────────────────────────
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'place_folders','places','place_folder_items','place_visits'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
