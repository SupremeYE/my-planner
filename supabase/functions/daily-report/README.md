# daily-report — 매일 Discord 리포트 전송

pg_cron 이 정해진 시각(KST)에 이 Edge Function 을 깨우고 →
Function 이 오늘(KST) 기준 할일/습관 데이터를 조회한 뒤 →
Discord Webhook 으로 "오늘의 리포트"를 전송합니다.

전송 메시지 예시:

```
📋 **오늘의 리포트 (2026-05-30)**
할일: 3/5 완료

**습관 체크**
✅ 물 2L 마시기
⬜ 30분 운동
✅ 독서
```

---

## 1. Discord Webhook URL 등록 (Secret)

Discord 채널 → 채널 설정 → 연동 → 웹후크 → "새 웹후크" 로 URL 을 만든 뒤,
아래 명령으로 Supabase 에 등록합니다. (값은 직접 채워 넣으세요)

```bash
supabase secrets set DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Edge Function 에 자동 주입되므로
> 별도로 등록할 필요가 없습니다.

---

## 2. Edge Function 배포

```bash
supabase functions deploy daily-report
```

---

## 3. 수동 테스트 (curl)

배포 후 함수가 정상 동작하는지 직접 호출해 봅니다.
`<여기에_ANON_KEY>` 자리에 프로젝트의 anon key 를 넣으세요.

```bash
curl -i -X POST \
  "https://kfvijixulsvxelmmqzpm.supabase.co/functions/v1/daily-report" \
  -H "Authorization: Bearer <여기에_ANON_KEY>" \
  -H "Content-Type: application/json"
```

성공하면 `ok` (HTTP 200) 가 반환되고, Discord 채널에 메시지가 도착합니다.

---

## 4. pg_cron 자동 실행 등록

Supabase 대시보드 → SQL Editor 에서 아래 SQL 을 실행합니다.

> 시간대 주의: pg_cron 은 **UTC** 기준입니다.
> - 저녁 22:00 KST = UTC 13:00 → `0 13 * * *`
> - 아침 08:00 KST = UTC 23:00 → `0 23 * * *`

```sql
-- 1) 필요한 확장 활성화
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) 저녁 22:00 KST (= UTC 13:00) 리포트 전송
select cron.schedule(
  'daily-report-evening',
  '0 13 * * *',
  $$
  select net.http_post(
    url     := 'https://kfvijixulsvxelmmqzpm.supabase.co/functions/v1/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <여기에_ANON_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 3) (선택) 아침 08:00 KST (= UTC 23:00) 리포트 — 필요하면 주석 해제 후 실행
-- select cron.schedule(
--   'daily-report-morning',
--   '0 23 * * *',
--   $$
--   select net.http_post(
--     url     := 'https://kfvijixulsvxelmmqzpm.supabase.co/functions/v1/daily-report',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <여기에_ANON_KEY>'
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
```

---

## 5. cron job 확인 / 삭제

```sql
-- 등록된 cron job 목록 확인
select * from cron.job;
```

```sql
-- 저녁 리포트 job 삭제
select cron.unschedule('daily-report-evening');

-- (아침 리포트를 등록했다면)
-- select cron.unschedule('daily-report-morning');
```
