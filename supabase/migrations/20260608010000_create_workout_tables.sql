-- 운동(Workout) 모듈 — Stage 0: 스키마 토대
-- 목적: 운동 탭의 데이터 토대를 만든다. 종목 카탈로그 + 세션/세트 기록 + 요일별 루틴.
--
-- 데이터 원칙(전 스테이지 공통, 중요):
--  - 운동 데이터는 "DB에 한 번 저장 → 이후엔 읽기만" 구조다.
--  - 영어 이름의 한글화(name_ko)는 seed 시점 또는 종목을 "내 운동"으로 채택하는
--    시점에 1회만 일어나고 결과를 name_ko 컬럼에 저장한다.
--  - 운동 페이지를 볼 때마다 번역 API를 호출하는 동작(런타임 번역)은 어떤 경우에도
--    만들지 않는다. name_ko 가 null 이면 "아직 채택 안 한 카탈로그 항목"으로 취급한다.
--
-- 설계 메모(이 앱의 단일 사용자 Auth 컨벤션 — vision_*, culture_records, mandalart_* 패턴):
--  - 사용자 소유 테이블의 user_id 는 DEFAULT auth.uid() 로 자동 채운다(클라이언트 미전송).
--  - exercises 는 카탈로그(공용) + 내 커스텀 종목을 함께 담는다:
--    user_id IS NULL 이면 전체 공용(free-exercise-db 카탈로그), user_id 가 있으면 내 커스텀.

-- ── 1) exercises — 종목 마스터 / 카탈로그 ──────────────────────────────────
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = 전체 공용 카탈로그
  name_ko text,                 -- null 이면 "아직 채택 안 한 카탈로그 항목"
  name_en text not null,
  type text not null check (type in ('근력','유산소')),
  body_part text not null check (body_part in ('하체','등','가슴','어깨','팔','코어','전신','유산소','기타')),
  equipment text,
  primary_muscles text[],       -- 검색·표시용
  youtube_url text,
  image_url text,
  source text default 'custom',  -- 'free-exercise-db' | 'custom'
  source_id text,                -- free-exercise-db 의 원본 id
  created_at timestamptz default now()
);

alter table public.exercises enable row level security;

drop policy if exists "Anyone can view catalog and own exercises" on public.exercises;
drop policy if exists "Users can insert their own exercises"      on public.exercises;
drop policy if exists "Users can update their own exercises"      on public.exercises;
drop policy if exists "Users can delete their own exercises"      on public.exercises;

-- 공용 카탈로그(user_id is null) + 내 커스텀(user_id = auth.uid()) 둘 다 조회 가능
create policy "Anyone can view catalog and own exercises"
  on public.exercises for select
  using (user_id is null or user_id = auth.uid());
-- 내 행만 변경 가능 (공용 카탈로그는 클라이언트에서 수정 불가)
create policy "Users can insert their own exercises"
  on public.exercises for insert
  with check (user_id = auth.uid());
create policy "Users can update their own exercises"
  on public.exercises for update
  using (user_id = auth.uid());
create policy "Users can delete their own exercises"
  on public.exercises for delete
  using (user_id = auth.uid());

-- 이름 검색용 (한글/영어 검색 대비)
create index if not exists exercises_name_ko_idx on public.exercises (name_ko);
create index if not exists exercises_name_en_idx on public.exercises (name_en);
create index if not exists exercises_body_part_idx on public.exercises (body_part);

-- ── 2) workout_logs — 한 날 / 한 종목 세션 ─────────────────────────────────
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  performed_on date not null default current_date,
  memo text,
  created_at timestamptz default now()
);

alter table public.workout_logs enable row level security;

drop policy if exists "Users can view their own workout_logs"   on public.workout_logs;
drop policy if exists "Users can insert their own workout_logs" on public.workout_logs;
drop policy if exists "Users can update their own workout_logs" on public.workout_logs;
drop policy if exists "Users can delete their own workout_logs" on public.workout_logs;

create policy "Users can view their own workout_logs"
  on public.workout_logs for select using (user_id = auth.uid());
create policy "Users can insert their own workout_logs"
  on public.workout_logs for insert with check (user_id = auth.uid());
create policy "Users can update their own workout_logs"
  on public.workout_logs for update using (user_id = auth.uid());
create policy "Users can delete their own workout_logs"
  on public.workout_logs for delete using (user_id = auth.uid());

create index if not exists workout_logs_user_performed_idx
  on public.workout_logs (user_id, performed_on desc);
-- 지난 기록 prefill + 성장 그래프
create index if not exists workout_logs_exercise_performed_idx
  on public.workout_logs (exercise_id, performed_on desc);

-- ── 3) workout_sets — 세트(근력) 또는 유산소 1행 ───────────────────────────
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.workout_logs(id) on delete cascade,
  set_no int not null,
  weight numeric,        -- 근력: 무게
  reps int,              -- 근력: 횟수
  duration_min numeric,  -- 유산소: 시간(분)
  distance_km numeric    -- 유산소: 거리(km)
);

alter table public.workout_sets enable row level security;

drop policy if exists "Users can view their own workout_sets"   on public.workout_sets;
drop policy if exists "Users can insert their own workout_sets" on public.workout_sets;
drop policy if exists "Users can update their own workout_sets" on public.workout_sets;
drop policy if exists "Users can delete their own workout_sets" on public.workout_sets;

-- 부모 log 소유자 기준(EXISTS)
create policy "Users can view their own workout_sets"
  on public.workout_sets for select
  using (exists (select 1 from public.workout_logs l where l.id = workout_sets.log_id and l.user_id = auth.uid()));
create policy "Users can insert their own workout_sets"
  on public.workout_sets for insert
  with check (exists (select 1 from public.workout_logs l where l.id = workout_sets.log_id and l.user_id = auth.uid()));
create policy "Users can update their own workout_sets"
  on public.workout_sets for update
  using (exists (select 1 from public.workout_logs l where l.id = workout_sets.log_id and l.user_id = auth.uid()));
create policy "Users can delete their own workout_sets"
  on public.workout_sets for delete
  using (exists (select 1 from public.workout_logs l where l.id = workout_sets.log_id and l.user_id = auth.uid()));

create index if not exists workout_sets_log_idx on public.workout_sets (log_id);

-- ── 4) routine_days — 요일별 루틴 헤더 ─────────────────────────────────────
create table if not exists public.routine_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),  -- 1=월 … 7=일
  label text,
  unique (user_id, day_of_week)
);

alter table public.routine_days enable row level security;

drop policy if exists "Users can view their own routine_days"   on public.routine_days;
drop policy if exists "Users can insert their own routine_days" on public.routine_days;
drop policy if exists "Users can update their own routine_days" on public.routine_days;
drop policy if exists "Users can delete their own routine_days" on public.routine_days;

create policy "Users can view their own routine_days"
  on public.routine_days for select using (user_id = auth.uid());
create policy "Users can insert their own routine_days"
  on public.routine_days for insert with check (user_id = auth.uid());
create policy "Users can update their own routine_days"
  on public.routine_days for update using (user_id = auth.uid());
create policy "Users can delete their own routine_days"
  on public.routine_days for delete using (user_id = auth.uid());

-- ── 5) routine_exercises ───────────────────────────────────────────────────
create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references public.routine_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  sort_order int not null default 0
);

alter table public.routine_exercises enable row level security;

drop policy if exists "Users can view their own routine_exercises"   on public.routine_exercises;
drop policy if exists "Users can insert their own routine_exercises" on public.routine_exercises;
drop policy if exists "Users can update their own routine_exercises" on public.routine_exercises;
drop policy if exists "Users can delete their own routine_exercises" on public.routine_exercises;

-- 부모 routine_day 소유자 기준(EXISTS)
create policy "Users can view their own routine_exercises"
  on public.routine_exercises for select
  using (exists (select 1 from public.routine_days d where d.id = routine_exercises.routine_day_id and d.user_id = auth.uid()));
create policy "Users can insert their own routine_exercises"
  on public.routine_exercises for insert
  with check (exists (select 1 from public.routine_days d where d.id = routine_exercises.routine_day_id and d.user_id = auth.uid()));
create policy "Users can update their own routine_exercises"
  on public.routine_exercises for update
  using (exists (select 1 from public.routine_days d where d.id = routine_exercises.routine_day_id and d.user_id = auth.uid()));
create policy "Users can delete their own routine_exercises"
  on public.routine_exercises for delete
  using (exists (select 1 from public.routine_days d where d.id = routine_exercises.routine_day_id and d.user_id = auth.uid()));

create index if not exists routine_exercises_day_sort_idx
  on public.routine_exercises (routine_day_id, sort_order);

-- ── 6) Realtime publication 등록 ───────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises','workout_logs','workout_sets','routine_days','routine_exercises'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
