-- daily-report cron 발송 시각 변경: 밤 23:00 → 23:59 (KST)
--
-- 배경: daily-report Edge Function 은 pg_cron job 'daily-report-evening' 이
--       정해진 시각에 호출한다. 기존 스케줄은 '0 14 * * *' 였다.
-- 주의: pg_cron 스케줄은 UTC 기준이다. 한국시간(KST, UTC+9)에서 9시간을 빼야 한다.
--       원하는 시각 23:59 KST = 14:59 UTC → '59 14 * * *'.
-- 멱등성: job 의 command(함수 URL·인증 헤더 등 시크릿 포함)는 건드리지 않고
--         스케줄만 갱신한다. job 이 없으면 아무것도 하지 않는다(다른 환경 안전).
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'daily-report-evening';
  if jid is not null then
    perform cron.alter_job(jid, schedule => '59 14 * * *');
  end if;
end $$;
