// Supabase Edge Function: daily-report
//
// pg_cron 이 정해진 시각(KST)에 이 함수를 호출하면,
// 오늘(KST) 기준 할일/습관 데이터를 조회해 Discord Webhook 으로 리포트를 전송한다.
//
// 사용 환경변수:
//   - SUPABASE_URL                (Edge Function 자동 주입)
//   - SUPABASE_SERVICE_ROLE_KEY   (Edge Function 자동 주입, RLS 우회 조회용)
//   - DISCORD_WEBHOOK_URL         (supabase secrets set 으로 등록)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// KST(UTC+9) 기준 yyyy-MM-dd 문자열과 요일(0=일~6=토)을 반환
function kstTodayInfo(): { date: string; dow: number } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, dow: kst.getUTCDay() };
}

// 앱의 isHabitApplicableOnDate 와 동일한 반복 규칙
function isHabitApplicableOnDow(
  repeat: string | null,
  repeatDays: number[] | null,
  dow: number,
): boolean {
  if (repeat === 'weekday') return dow >= 1 && dow <= 5;
  if (repeat === 'weekend') return dow === 0 || dow === 6;
  if (repeat === 'custom') return repeatDays?.includes(dow) ?? false;
  return true; // daily / null
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');

    if (!webhookUrl) {
      return new Response('DISCORD_WEBHOOK_URL is not set', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { date: today, dow } = kstTodayInfo();

    // ── 할일 조회 (오늘 날짜, cancelled 제외) ──
    const { data: todos, error: todoErr } = await supabase
      .from('todos')
      .select('text, status')
      .eq('date', today);
    if (todoErr) throw todoErr;

    const activeTodos = (todos ?? []).filter((t) => t.status !== 'cancelled');
    const doneCount = activeTodos.filter((t) => t.status === 'done').length;
    const totalCount = activeTodos.length;

    // ── 습관 조회 (오늘 요일에 해당하는 것만) ──
    const { data: habits, error: habitErr } = await supabase
      .from('habits')
      .select('name, checked_dates, repeat, repeat_days');
    if (habitErr) throw habitErr;

    const todayHabits = (habits ?? []).filter((h) =>
      isHabitApplicableOnDow(h.repeat ?? null, h.repeat_days ?? null, dow),
    );

    // ── 메시지 조립 ──
    const lines: string[] = [];
    lines.push(`📋 **오늘의 리포트 (${today})**`);

    if (totalCount > 0) {
      lines.push(`할일: ${doneCount}/${totalCount} 완료`);
    } else {
      lines.push('할일: 오늘 등록된 할일이 없어요');
    }

    lines.push(''); // 빈 줄
    lines.push('**습관 체크**');

    if (todayHabits.length > 0) {
      for (const h of todayHabits) {
        const checked = (h.checked_dates ?? []).includes(today);
        lines.push(`${checked ? '✅' : '⬜'} ${h.name}`);
      }
    } else {
      lines.push('오늘 예정된 습관이 없어요');
    }

    const text = lines.join('\n');

    // ── Discord 전송 ──
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Discord webhook failed:', res.status, body);
      return new Response(`Discord webhook failed: ${res.status}`, { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('daily-report error:', err);
    return new Response(`error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
});
