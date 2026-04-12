-- Events v2 schema for planner schedule CRUD.
-- Compatibility note:
-- - `project_id` keeps `text` FK because existing `projects.id` is text-based in this app.
-- - If a legacy `events` table already exists, this migration adds the new columns safely.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'events'
  ) then
    create table public.events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
      title text not null,
      is_all_day boolean not null default false,
      start_at timestamptz not null,
      end_at timestamptz not null,
      location text,
      link_url text,
      repeat_type text not null default 'none' check (repeat_type in ('none', 'daily', 'weekly', 'monthly')),
      repeat_end_date date,
      alert_minutes int check (alert_minutes in (0, 10, 30, 60)),
      memo text,
      project_id text references public.projects(id) on delete set null,
      color text,
      created_at timestamptz not null default now()
    );
  else
    alter table public.events
      add column if not exists user_id uuid references auth.users(id) on delete cascade,
      add column if not exists is_all_day boolean not null default false,
      add column if not exists start_at timestamptz,
      add column if not exists end_at timestamptz,
      add column if not exists link_url text,
      add column if not exists repeat_type text not null default 'none',
      add column if not exists repeat_end_date date,
      add column if not exists alert_minutes int,
      add column if not exists project_id text,
      add column if not exists color text,
      add column if not exists created_at timestamptz not null default now();

    alter table public.events
      drop constraint if exists events_repeat_type_check;

    alter table public.events
      add constraint events_repeat_type_check
      check (repeat_type in ('none', 'daily', 'weekly', 'monthly'));

    alter table public.events
      drop constraint if exists events_alert_minutes_check;

    alter table public.events
      add constraint events_alert_minutes_check
      check (alert_minutes in (0, 10, 30, 60) or alert_minutes is null);

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'date'
    ) then
      update public.events
      set start_at = coalesce(
            start_at,
            (
              (date::text || ' ' || coalesce(start_time, '00:00'))::timestamp
              at time zone 'UTC'
            )
          ),
          end_at = coalesce(
            end_at,
            (
              (date::text || ' ' || coalesce(end_time, start_time, '23:59'))::timestamp
              at time zone 'UTC'
            )
          )
      where start_at is null or end_at is null;
    end if;

    alter table public.events
      alter column start_at set default now(),
      alter column end_at set default now(),
      alter column repeat_type set default 'none';
  end if;
end $$;

create index if not exists idx_events_user_start_at on public.events(user_id, start_at);
create index if not exists idx_events_repeat_end_date on public.events(repeat_end_date);

alter table public.events enable row level security;

drop policy if exists "Users can view own events" on public.events;
create policy "Users can view own events"
  on public.events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own events" on public.events;
create policy "Users can insert own events"
  on public.events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own events" on public.events;
create policy "Users can update own events"
  on public.events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own events" on public.events;
create policy "Users can delete own events"
  on public.events
  for delete
  using (auth.uid() = user_id);
