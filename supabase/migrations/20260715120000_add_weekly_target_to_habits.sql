-- 매주 N회 반복(요일 무관 주간 횟수 목표). 앱 Habit.weeklyTarget ↔ weekly_target
alter table public.habits add column if not exists weekly_target integer;

comment on column public.habits.weekly_target is '반복 유형이 weekly일 때 주간 목표 횟수(요일 무관). 예: 매주 3회 운동';
