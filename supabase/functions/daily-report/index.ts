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
    // 주의: 운영 DB 의 events.start_at 은 timestamptz 가 아니라
    //       "yyyy-MM-ddTHH:mm:ss" 형태의 KST 벽시계 text 다(src/api/events.ts 의 toDateTime 참고).
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

// ── 식단 (food_records) ──
type FoodRow = {
  meal_type: string;
  food_name: string;
  calories: number | null;
  amount: number | null;
};

const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
const MEAL_LABEL: Record<string, string> = {
  breakfast: '🌅 아침',
  lunch: '☀️ 점심',
  dinner: '🌙 저녁',
  snack: '🍪 간식',
};

async function buildFoodSection(supabase: SupabaseLike, today: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('food_records')
      .select('meal_type, food_name, calories, amount')
      .eq('date', today);
    if (error) throw error;
    const rows = (data ?? []) as FoodRow[];
    if (rows.length === 0) return ['**식단** — 오늘 기록 없음'];

    rows.sort((a, b) => (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99));
    const calSum = Math.round(rows.reduce((s, r) => s + (r.calories ?? 0), 0));
    const amtSum = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

    const parts = [`${rows.length}끼`];
    if (calSum > 0) parts.push(`총 ${calSum} kcal`);
    if (amtSum > 0) parts.push(`${amtSum}원`);

    const lines: string[] = [`**식단** — ${parts.join(' · ')}`];
    for (const r of rows) {
      const label = MEAL_LABEL[r.meal_type] ?? '🍽️';
      lines.push(`${label} ${r.food_name}`);
    }
    return lines;
  } catch (err) {
    console.error('food section error:', err);
    return ['**식단** — 데이터 불러오기 실패'];
  }
}

// ── 감정 (mood_records) ──
type MoodRow = {
  time_of_day: string | null;
  energy_level: number | null;
  emotion_tags: string[] | null;
};

function moodTagStr(tags: string[] | null): string {
  const arr = tags ?? [];
  return arr.length > 0 ? arr.map((t) => `#${t}`).join(' ') : '';
}

async function buildMoodSection(supabase: SupabaseLike, today: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('mood_records')
      .select('time_of_day, energy_level, emotion_tags')
      .eq('date', today);
    if (error) throw error;
    const rows = (data ?? []) as MoodRow[];
    if (rows.length === 0) return ['**감정** — 오늘 기록 없음'];

    const lines: string[] = ['**감정**'];
    if (rows.length === 1) {
      const r = rows[0];
      const tags = moodTagStr(r.emotion_tags);
      lines.push(`에너지 ${r.energy_level ?? '-'}/5${tags ? ` · ${tags}` : ''}`);
    } else {
      for (const r of rows) {
        const tags = moodTagStr(r.emotion_tags);
        lines.push(
          `🕘 ${r.time_of_day ?? '기록'} · 에너지 ${r.energy_level ?? '-'}/5${tags ? ` · ${tags}` : ''}`,
        );
      }
    }
    return lines;
  } catch (err) {
    console.error('mood section error:', err);
    return ['**감정** — 데이터 불러오기 실패'];
  }
}

// ── 독서 (reading_logs + books) ──
type ReadingLogRow = { book_id: string; page: number };
type BookRow = {
  id: string;
  title: string;
  total_pages: number | null;
  current_page: number | null;
};

async function buildReadingSection(supabase: SupabaseLike, today: string): Promise<string[]> {
  try {
    // 1) 오늘 로그 → book_id 별 오늘 max page
    const { data: todayData, error: todayErr } = await supabase
      .from('reading_logs')
      .select('book_id, page')
      .eq('date', today);
    if (todayErr) throw todayErr;
    const todayRows = (todayData ?? []) as ReadingLogRow[];
    if (todayRows.length === 0) return ['**독서** — 오늘 기록 없음'];

    const todayMax = new Map<string, number>();
    for (const r of todayRows) {
      todayMax.set(r.book_id, Math.max(todayMax.get(r.book_id) ?? 0, r.page));
    }

    // 2) 책별 delta = 오늘 max − (오늘 이전 max, 없으면 0). delta > 0 인 책만 표시
    const deltas: { bookId: string; delta: number }[] = [];
    for (const [bookId, maxToday] of todayMax) {
      const { data: prevData, error: prevErr } = await supabase
        .from('reading_logs')
        .select('page')
        .eq('book_id', bookId)
        .lt('date', today);
      if (prevErr) throw prevErr;
      const prevRows = (prevData ?? []) as { page: number }[];
      const prevMax = prevRows.reduce((m, r) => Math.max(m, r.page), 0);
      const delta = maxToday - prevMax;
      if (delta > 0) deltas.push({ bookId, delta });
    }
    if (deltas.length === 0) return ['**독서** — 오늘 기록 없음'];

    // 3) 표시 대상 책들의 메타데이터 일괄 조회
    const { data: bookData, error: bookErr } = await supabase
      .from('books')
      .select('id, title, total_pages, current_page')
      .in(
        'id',
        deltas.map((d) => d.bookId),
      );
    if (bookErr) throw bookErr;
    const bookMap = new Map(((bookData ?? []) as BookRow[]).map((b) => [b.id, b]));

    const lines: string[] = ['**독서**'];
    deltas.forEach((d, idx) => {
      const b = bookMap.get(d.bookId);
      const title = b?.title ?? '제목 없음';
      const cur = b?.current_page ?? 0;
      const total = b?.total_pages ?? 0;
      if (idx > 0) lines.push('');
      lines.push(`오늘 +${d.delta}p`);
      lines.push(`📖 〈${title}〉 ${cur}/${total}p`);
    });
    return lines;
  } catch (err) {
    console.error('reading section error:', err);
    return ['**독서** — 데이터 불러오기 실패'];
  }
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
    const { date: today, dow, hhmm } = kstNowInfo();
    const weekdayKr = WEEKDAY_KR[dow];

    // ── 할일 조회 (오늘 날짜, cancelled 제외) ──
    const { data: todos, error: todoErr } = await supabase
      .from('todos')
      .select('text, status')
      .eq('date', today);
    if (todoErr) throw todoErr;

    const activeTodos = (todos ?? []).filter((t) => t.status !== 'cancelled');
    const doneCount = activeTodos.filter((t) => t.status === 'done').length;
    const totalCount = activeTodos.length;
    const undoneTodos = activeTodos.filter((t) => t.status !== 'done');

    // ── 습관 조회 (오늘 요일에 해당하는 것만) ──
    const { data: habits, error: habitErr } = await supabase
      .from('habits')
      .select('name, checked_dates, repeat, repeat_days');
    if (habitErr) throw habitErr;

    const todayHabits = (habits ?? []).filter((h) =>
      isHabitApplicableOnDow(h.repeat ?? null, h.repeat_days ?? null, dow),
    );
    const habitDone = todayHabits.filter((h) => (h.checked_dates ?? []).includes(today)).length;
    const habitTotal = todayHabits.length;

    // ── 메시지 조립 ──
    const lines: string[] = [];
    lines.push(`📋 **오늘의 리포트 (${today} ${weekdayKr})**`);
    lines.push(`🕘 ${hhmm} 기준`);
    lines.push('');

    // 할일 요약 + 미완료 목록
    if (totalCount > 0) {
      lines.push(`**할일** — ${doneCount}/${totalCount} 완료`);
      if (undoneTodos.length > 0) {
        lines.push('아직 남은 할일:');
        for (const t of undoneTodos) {
          lines.push(`✖️ ${t.text}`);
        }
      } else {
        lines.push('오늘 할일을 모두 끝냈어요! 🎉');
      }
    } else {
      lines.push('**할일** — 오늘 등록된 할일이 없어요');
    }

    lines.push('');

    // 습관 요약 + 체크 목록
    if (habitTotal > 0) {
      lines.push(`**습관 체크** — ${habitDone}/${habitTotal} 완료`);
      for (const h of todayHabits) {
        const checked = (h.checked_dates ?? []).includes(today);
        lines.push(`${checked ? '✔️' : '✖️'} ${h.name}`);
      }
    } else {
      lines.push('**습관 체크** — 오늘 예정된 습관이 없어요');
    }

    // ── 신규 카테고리 섹션 (각 섹션 내부에서 try/catch — 한 섹션 실패가 다른 섹션에 영향 없음) ──
    const [eventLines, foodLines, moodLines, readingLines] = await Promise.all([
      buildEventsSection(supabase, today),
      buildFoodSection(supabase, today),
      buildMoodSection(supabase, today),
      buildReadingSection(supabase, today),
    ]);

    lines.push('');
    lines.push(...eventLines);
    lines.push('');
    lines.push(...foodLines);
    lines.push('');
    lines.push(...moodLines);
    lines.push('');
    lines.push(...readingLines);

    // 응원 문구
    lines.push('');
    lines.push('오늘도 수고했어요 🌙');

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
