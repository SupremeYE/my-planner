# morning-report — 매일 아침 어젠다 Discord 알림

pg_cron 이 아침 시각(KST 07:30)에 이 Edge Function 을 깨우고 →
Function 이 오늘(KST) 기준 **일정 · 할일 · 습관** 을 조회한 뒤 →
**아침 전용 Discord 채널**(별도 웹훅)로 "오늘의 어젠다"를 전송합니다.

> 저녁 `daily-report`(회고 톤)와 **다른 함수 · 다른 채널**입니다.
> 저녁은 `DISCORD_WEBHOOK_URL`, 아침은 `DISCORD_MORNING_WEBHOOK_URL` 을 사용합니다.

전송 메시지 예시:

```
☀️ **좋은 아침이에요 (2026-06-04 목)**

**오늘 일정**
🕘 09:00 팀 스탠드업 · 회의실 A
🕘 종일 워크숍

**오늘 할일** — 3개
□ 기획서 초안 작성
✔️ 메일 회신
□ 운동 1시간

**오늘 체크할 습관** — 2개
□ 물 2L 마시기
□ 30분 독서

오늘도 화이팅 ✨
```

---

## 1. 사전 준비 — Discord 새 채널 + 새 웹훅

1. Discord 에서 **아침 알림용 새 채널**을 만듭니다(예: `#아침-어젠다`).
2. 채널 설정 → 연동 → 웹후크 → "새 웹후크" 로 URL 을 만든 뒤,
3. 아래 명령으로 Supabase 시크릿에 등록합니다. (값은 직접 채워 넣으세요)

```bash
supabase secrets set DISCORD_MORNING_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Edge Function 에 자동 주입되므로
> 별도로 등록할 필요가 없습니다.
> ⚠️ 저녁 리포트의 `DISCORD_WEBHOOK_URL` 은 건드리지 마세요. (서로 다른 시크릿)

---

## 2. Edge Function 배포

```bash
supabase functions deploy morning-report
```

---

## 3. 수동 테스트 (curl)

배포 후 함수가 정상 동작하는지 직접 호출해 봅니다.
`<여기에_PUBLISHABLE_KEY>` 자리에 프로젝트의 publishable(anon) key 를 넣으세요.

```bash
curl -i -X POST \
  "https://kfvijixulsvxelmmqzpm.supabase.co/functions/v1/morning-report" \
  -H "Authorization: Bearer <여기에_PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json"
```

성공하면 `ok` (HTTP 200) 가 반환되고, 아침 채널에 메시지가 도착합니다.

---

## 4. pg_cron 자동 실행 등록

Supabase 대시보드 → SQL Editor 에서 아래 SQL 을 실행합니다.

> 시간대 주의: pg_cron 은 **UTC** 기준입니다.
> - 아침 07:30 KST = UTC 22:30 → `30 22 * * *`

```sql
-- 필요한 확장(이미 활성화돼 있으면 무시됨)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 아침 07:30 KST (= UTC 22:30) 어젠다 전송
select cron.schedule(
  'morning-report',
  '30 22 * * *',
  $$
  select net.http_post(
    url     := 'https://kfvijixulsvxelmmqzpm.supabase.co/functions/v1/morning-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <여기에_PUBLISHABLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

---

## 5. cron job 확인

```sql
select * from cron.job;
```

---

## 6. cron job 삭제

```sql
select cron.unschedule('morning-report');
```
