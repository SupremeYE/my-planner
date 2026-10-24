-- REVIEW DRAFT ONLY. Not in supabase/migrations; never applied by this task.
-- Apply only after explicit approval and isolated PostgreSQL/RLS/concurrency tests.
begin;

create function public.moamoa_valid_classification(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; total numeric := 0; ids text[] := '{}';
begin
  if jsonb_typeof(value) is distinct from 'object' or value->>'version' is distinct from '1'
     or jsonb_typeof(value->'shares') is distinct from 'array' or jsonb_array_length(value->'shares') > 32 then return false; end if;
  for item in select * from jsonb_array_elements(value->'shares') loop
    if jsonb_typeof(item->'tagId') is distinct from 'string' or length(item->>'tagId') = 0
       or jsonb_typeof(item->'name') is distinct from 'string' or jsonb_typeof(item->'color') is distinct from 'string'
       or jsonb_typeof(item->'weight') is distinct from 'number' or (item->>'weight')::numeric <= 0
       or (item->>'tagId') = any(ids) then return false; end if;
    ids := array_append(ids, item->>'tagId'); total := total + (item->>'weight')::numeric;
  end loop;
  return jsonb_array_length(value->'shares') = 0 or abs(total - 1) < 0.00000001;
exception when others then return false;
end;
$$;

create table public.activity_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  operation_id uuid not null,
  date date not null,
  name text not null check (length(btrim(name)) between 1 and 500),
  elapsed_sec integer not null check (elapsed_sec between 1 and 86400),
  -- No FK to a mutable/deletable tag: snapshot remains authoritative after tag deletion.
  category_id text,
  classification_snapshot jsonb not null check (public.moamoa_valid_classification(classification_snapshot)),
  memo text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, operation_id),
  check (id = operation_id),
  check (jsonb_array_length(classification_snapshot->'shares') <= 1),
  check (category_id is not distinct from (classification_snapshot->'shares'->0->>'tagId')),
  check ((started_at is null and ended_at is null) or
    (started_at is not null and ended_at is not null and ended_at > started_at
     and abs(extract(epoch from ended_at - started_at) - elapsed_sec) <= 1))
);
create index activity_entries_owner_date_idx on public.activity_entries (user_id, date);
alter table public.activity_entries enable row level security;
revoke all on public.activity_entries from anon;
grant select, insert, update, delete on public.activity_entries to authenticated;
create policy activity_entries_select on public.activity_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy activity_entries_insert on public.activity_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_entries_update on public.activity_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy activity_entries_delete on public.activity_entries for delete to authenticated using ((select auth.uid()) = user_id);
create function public.moamoa_activity_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.operation_id <> old.operation_id or new.user_id <> old.user_id then
    raise exception 'Activity identity cannot change';
  end if;
  new.created_at := old.created_at; new.updated_at := now(); return new;
end;
$$;
create trigger activity_entries_updated_at before update on public.activity_entries
  for each row execute function public.moamoa_activity_updated_at();

-- NULL means legacy/current tags. Explicit {version:1,shares:[]} means frozen unclassified.
-- No UPDATE/backfill of past records.
alter table public.todo_time_blocks add column classification_snapshot jsonb
  check (classification_snapshot is null or public.moamoa_valid_classification(classification_snapshot));
create function public.moamoa_keep_block_classification() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.classification_snapshot is not null and new.classification_snapshot is distinct from old.classification_snapshot then
    raise exception 'Recorded classification cannot be replaced';
  end if;
  return new;
end;
$$;
create trigger todo_time_blocks_keep_classification before update on public.todo_time_blocks
  for each row execute function public.moamoa_keep_block_classification();

-- Existing TODO ownership policies are retained. Verify cross-owner todo_id protection separately.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_entries') then
    alter publication supabase_realtime add table public.activity_entries;
  end if;
end $$;
commit;
