// Supabase Edge Function: morning-report
//
// pg_cron 이 아침 시각(KST 07:30)에 이 함수를 호출하면,
// 오늘(KST) 기준 일정/할일/습관을 조회해 "아침 어젠다"를 Discord 로 전송한다.
// (저녁 daily-report 는 회고 톤, 이 함수는 어젠다 톤 — 별도 채널/웹훅 사용)
//
// 사용 환경변수:
//   - SUPABASE_URL                  (Edge Function 자동 주입)
//   - SUPABASE_SERVICE_ROLE_KEY     (Edge Function 자동 주입, RLS 우회 조회용)
//   - DISCORD_MORNING_WEBHOOK_URL   (supabase secrets set 으로 등록 — 저녁과 다른 채널)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// 미타입 Supabase 클라이언트(자동 생성 Database 타입 미사용)이므로 헬퍼에 넘길 최소 타입만 정의
type SupabaseLike = ReturnType<typeof createClient>;

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

// KST(UTC+9) 기준 오늘 정보 반환
function kstNowInfo(): { date: string; dow: number; hhmm: string } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, dow: kst.getUTCDay(), hhmm: `${hh}:${min}` };
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

// today(yyyy-MM-dd, KST) 의 다음날 yyyy-MM-dd 반환
function kstTomorrow(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── 오늘 일정 (events) ──
type EventRow = {
  title: string;
  start_at: string;
  is_all_day: boolean | null;
  location: string | null;
};

async function buildEventsSection(supabase: SupabaseLike, today: string): Promise<string[]> {
  try {
    const tomorrow = kstTomorrow(today);
    // 주의: 운영 DB 의 events.start_at 은 "yyyy-MM-ddTHH:mm:ss" 형태의 KST 벽시계 text 다
    //       (src/api/events.ts 의 toDateTime 참고, daily-report 와 동일 처리).
    //       따라서 같은 고정폭 ISO 형식의 문자열 범위로 비교하면 KST 하루(00:00~다음날 00:00)가 정확히 잡힌다.
    // TODO: repeat_type !== 'none' 반복 일정 전개는 이번 작업 범위 밖 — 단순 범위 쿼리만 수행한다.
    const { data, error } = await supabase
      .from('events')
      .select('title, start_at, is_all_day, location')
      .gte('start_at', `${today}T00:00:00`)
      .lt('start_at', `${tomorrow}T00:00:00`)
      .order('start_at', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as EventRow[];

    const lines: string[] = ['**오늘 일정**'];
    if (rows.length === 0) {
      lines.push('오늘 일정이 없어요');
      return lines;
    }
    for (const e of rows) {
      const time = e.is_all_day ? '종일' : e.start_at.slice(11, 16);
      let line = `🕘 ${time} ${e.title}`;
      if (e.location) line += ` · ${e.location}`;
      lines.push(line);
    }
    return lines;
  } catch (err) {
    console.error('events section error:', err);
    return ['**오늘 일정** — 데이터 불러오기 실패'];
  }
}

// ── 오늘 할일 (todos) ──
type TodoRow = {
  text: string;
  status: string;
  is_top3: boolean | null;
};

async function buildTodosSection(supabase: SupabaseLike, today: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('todos')
      .select('text, status, is_top3')
      .eq('date', today)
      .order('is_top3', { ascending: false });
    if (error) throw error;
    const rows = ((data ?? []) as TodoRow[]).filter((t) => t.status !== 'cancelled');

    if (rows.length === 0) return ['**오늘 할일** — 오늘 등록된 할일이 없어요'];

    const lines: string[] = [`**오늘 할일** — ${rows.length}개`];
    for (const t of rows) {
      lines.push(`${t.status === 'done' ? '✔️' : '□'} ${t.text}`);
    }
    return lines;
  } catch (err) {
    console.error('todos section error:', err);
    return ['**오늘 할일** — 데이터 불러오기 실패'];
  }
}

// ── 오늘 체크할 습관 (habits) ──
type HabitRow = {
  name: string;
  checked_dates: string[] | null;
  repeat: string | null;
  repeat_days: number[] | null;
};

async function buildHabitsSection(
  supabase: SupabaseLike,
  today: string,
  dow: number,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('habits')
      .select('name, checked_dates, repeat, repeat_days');
    if (error) throw error;
    const rows = ((data ?? []) as HabitRow[]).filter((h) =>
      isHabitApplicableOnDow(h.repeat ?? null, h.repeat_days ?? null, dow),
    );

    if (rows.length === 0) return ['**오늘 체크할 습관** — 오늘 예정된 습관이 없어요'];

    const lines: string[] = [`**오늘 체크할 습관** — ${rows.length}개`];
    for (const h of rows) {
      const checked = (h.checked_dates ?? []).includes(today);
      lines.push(`${checked ? '✔️' : '□'} ${h.name}`);
    }
    return lines;
  } catch (err) {
    console.error('habits section error:', err);
    return ['**오늘 체크할 습관** — 데이터 불러오기 실패'];
  }
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookUrl = Deno.env.get('DISCORD_MORNING_WEBHOOK_URL');

    if (!webhookUrl) {
      return new Response('DISCORD_MORNING_WEBHOOK_URL is not set', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { date: today, dow } = kstNowInfo();
    const weekdayKr = WEEKDAY_KR[dow];

    // ── 각 섹션 조회 (섹션별 try/catch — 한 섹션 실패가 다른 섹션에 영향 없음) ──
    const [eventLines, todoLines, habitLines] = await Promise.all([
      buildEventsSection(supabase, today),
      buildTodosSection(supabase, today),
      buildHabitsSection(supabase, today, dow),
    ]);

    // ── 메시지 조립 (섹션 사이 빈 줄 1개) ──
    const lines: string[] = [];
    lines.push(`☀️ **좋은 아침이에요 (${today} ${weekdayKr})**`);
    lines.push('');
    lines.push(...eventLines);
    lines.push('');
    lines.push(...todoLines);
    lines.push('');
    lines.push(...habitLines);
    lines.push('');
    lines.push('오늘도 화이팅 ✨');

    const text = lines.join('\n');

    // ── Discord 전송 (아침 전용 웹훅) ──
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
    console.error('morning-report error:', err);
    return new Response(`error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
});
