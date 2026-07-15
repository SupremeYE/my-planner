-- 눈바디 전용 PRIVATE 버킷 — 기존 public 버킷 관용구를 복사하지 않는다(민감 사진).
-- public=false + 4개 정책(select/insert/update/delete) 모두 owner uid 게이트. 공개 read 정책 없음.
insert into storage.buckets (id, name, public)
values ('body-photos', 'body-photos', false)
on conflict (id) do nothing;

drop policy if exists "body_photos owner select" on storage.objects;
drop policy if exists "body_photos owner insert" on storage.objects;
drop policy if exists "body_photos owner update" on storage.objects;
drop policy if exists "body_photos owner delete" on storage.objects;

create policy "body_photos owner select" on storage.objects
  for select using (bucket_id = 'body-photos' and auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde');
create policy "body_photos owner insert" on storage.objects
  for insert with check (bucket_id = 'body-photos' and auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde');
create policy "body_photos owner update" on storage.objects
  for update using (bucket_id = 'body-photos' and auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde');
create policy "body_photos owner delete" on storage.objects
  for delete using (bucket_id = 'body-photos' and auth.uid() = '8451b11f-76ed-4dcb-a9ec-bd8283fa1cde');
