-- 타이머 완료 시 실제 경과 시간(초). 앱 Todo.doElapsedSec ↔ do_elapsed_sec
alter table public.todos add column if not exists do_elapsed_sec integer;

comment on column public.todos.do_elapsed_sec is 'DO 타이머로 기록된 실제 소요 시간(초). 타임라인 do_start/do_end는 분 단위 막대용';
