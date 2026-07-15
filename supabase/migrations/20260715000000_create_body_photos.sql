-- 눈바디 갤러리 v1 — 몸 사진 기록(민감 정보).
-- 비공개 저장 전용: 테이블 RLS = owner(auth.uid()=user_id). 스토리지는 별도 private 버킷(다음 마이그레이션).
-- weight_records.id 는 text → weight_record_id FK 도 text (nullable, 삭제 시 set null).
create table public.body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date text not null,                 -- yyyy-MM-dd
  photo_path text not null,           -- 스토리지 경로만 저장(서명 URL 저장 금지 — 만료됨)
  weight_record_id text references public.weight_records(id) on delete set null,
  created_at timestamptz default now()
);
create index body_photos_user_date_idx on public.body_photos (user_id, date desc);
alter table public.body_photos enable row level security;
create policy "body_photos owner only" on public.body_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.body_photos;
