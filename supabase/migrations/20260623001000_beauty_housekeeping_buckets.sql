-- 하온 / 뷰티 케어 · 살림 — Stage 1 (Storage 버킷)
-- 목적: 제품/재고 사진 + 사진 AI 인식(vision-extract) 입력용 public 버킷 2개.
--
-- 설계 메모:
--  - scrap-thumbs / vision-board / moment-photos / food-photos 와 동일한
--    public 버킷 + 인증 사용자 RLS 패턴 그대로 복제.
--  - public read: 그리드 카드에서 단순 <img src> 로 표시 가능하게.
--  - insert/update/delete: 로그인한 사용자만 (auth.role() = 'authenticated').

-- ── 버킷 생성 ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('beauty-photos', 'beauty-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('household-photos', 'household-photos', true)
on conflict (id) do nothing;

-- ── beauty-photos RLS ────────────────────────────────────────────────────────
drop policy if exists "Beauty photos public read"  on storage.objects;
drop policy if exists "Beauty photos owner insert"  on storage.objects;
drop policy if exists "Beauty photos owner update"  on storage.objects;
drop policy if exists "Beauty photos owner delete"  on storage.objects;

create policy "Beauty photos public read"
  on storage.objects for select
  using (bucket_id = 'beauty-photos');

create policy "Beauty photos owner insert"
  on storage.objects for insert
  with check (bucket_id = 'beauty-photos' and auth.role() = 'authenticated');

create policy "Beauty photos owner update"
  on storage.objects for update
  using (bucket_id = 'beauty-photos' and auth.role() = 'authenticated');

create policy "Beauty photos owner delete"
  on storage.objects for delete
  using (bucket_id = 'beauty-photos' and auth.role() = 'authenticated');

-- ── household-photos RLS ─────────────────────────────────────────────────────
drop policy if exists "Household photos public read"  on storage.objects;
drop policy if exists "Household photos owner insert"  on storage.objects;
drop policy if exists "Household photos owner update"  on storage.objects;
drop policy if exists "Household photos owner delete"  on storage.objects;

create policy "Household photos public read"
  on storage.objects for select
  using (bucket_id = 'household-photos');

create policy "Household photos owner insert"
  on storage.objects for insert
  with check (bucket_id = 'household-photos' and auth.role() = 'authenticated');

create policy "Household photos owner update"
  on storage.objects for update
  using (bucket_id = 'household-photos' and auth.role() = 'authenticated');

create policy "Household photos owner delete"
  on storage.objects for delete
  using (bucket_id = 'household-photos' and auth.role() = 'authenticated');
