-- 레시피 모듈 업데이트 A-1 — recipes 컬럼 확장 + 레시피 사진 Storage 버킷
-- 목적: 가벼운 추가 폼 + 목록 리서페이싱(셔플/먼지쌓인/태그필터) 대비.
--
-- 메모:
--  - thumbnail_url 은 이미 존재(자동 썸네일). my_photo_url = 내가 만든 사진.
--  - cover_source 로 대표 이미지 선택('thumbnail'|'my_photo').
--  - tags = 의도/상황 태그(text[]), main_ingredients = 주재료(냉장고 연결용, 별도 배열).
--  - cook_count/last_cooked_at = 먼지쌓인/자주해먹음 판별.
--  - 재료(recipe_ingredients)/순서(recipe_steps)는 이미 별도 테이블이라 0개여도 정상 저장됨(추가 변경 불필요).
--  - Storage: 앱의 기존 버킷(food-photos/moment-photos) 컨벤션(public read + getPublicUrl)에 맞춰
--    recipe-photos 버킷을 public 으로 두되, 쓰기(INSERT/UPDATE/DELETE)는 로그인 사용자(authenticated)
--    본인 객체로 제한한다. (읽기는 추측 불가한 uuid 경로의 public URL — 식단/모먼트 사진과 동일 포스처)

-- ── recipes 컬럼 추가 ────────────────────────────────────────────────────────
alter table public.recipes
  add column if not exists my_photo_url text,
  add column if not exists cover_source text not null default 'thumbnail',
  add column if not exists tags text[] not null default '{}',
  add column if not exists main_ingredients text[] not null default '{}',
  add column if not exists cook_count integer not null default 0,
  add column if not exists last_cooked_at timestamptz;

-- cover_source 허용값 제약 (이미 있으면 skip)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_cover_source_check') then
    alter table public.recipes
      add constraint recipes_cover_source_check check (cover_source in ('thumbnail','my_photo'));
  end if;
end $$;

-- ── Storage 버킷: recipe-photos ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

-- 쓰기 정책: 로그인 사용자만(본인 업로드). update/delete 는 본인 객체로 제한.
drop policy if exists "recipe-photos authenticated insert" on storage.objects;
drop policy if exists "recipe-photos owner update"        on storage.objects;
drop policy if exists "recipe-photos owner delete"        on storage.objects;

create policy "recipe-photos authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos');

create policy "recipe-photos owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'recipe-photos' and owner = auth.uid());

create policy "recipe-photos owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and owner = auth.uid());
