// Supabase Edge Function: migrate-exercise-images
//
// 운동 모듈 Stage 3 — 종목 이미지를 GitHub raw 핫링크 → Supabase Storage(exercise-images)로 이관.
// 일회성/멱등 작업. UI 로직 변경 없음 — exercises.image_url 만 갱신한다.
//
// 동작(배치):
//  - source='free-exercise-db' 이고 image_url 이 아직 GitHub raw 핫링크인 행만 대상(멱등성).
//  - 이미지 다운로드 → exercise-images 버킷의 {source_id}/0.jpg 로 업로드(upsert) → image_url 을 공개 URL 로 UPDATE.
//  - 실패 항목은 failed 로 반환하고 핫링크 유지(앱이 깨지지 않게).
//  - ?adoptedOnly=true: 채택된 종목(name_ko not null 또는 logs/routines 등장)만 우선 이관.
//  - ?limit=N: 한 번에 처리할 개수(full 모드 배치, 기본 60·최대 200). remaining 이 0 이 될 때까지 반복 호출.
//
// 인증: 일회성 관리 작업이라 verify_jwt=false + 토큰 파라미터(?token=)로 가드.
// 환경변수 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 Edge Function 에 자동 주입(RLS 우회 쓰기).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const BUCKET = 'exercise-images';
const RAW_PREFIX = 'https://raw.githubusercontent.com/';
const TOKEN = 'EXIMG_MIGRATE_2026'; // 일회성 가드 토큰

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('token') !== TOKEN) return json({ error: 'unauthorized' }, 401);

  const adoptedOnly = url.searchParams.get('adoptedOnly') === 'true';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '60', 10) || 60, 1), 200);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const publicBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

  // 후보: 아직 GitHub raw 핫링크인 free-exercise-db 행
  const selectLimit = adoptedOnly ? 2000 : limit;
  const { data: rows, error } = await supabase
    .from('exercises')
    .select('id, source_id, image_url, name_ko')
    .eq('source', 'free-exercise-db')
    .like('image_url', `${RAW_PREFIX}%`)
    .order('id', { ascending: true })
    .limit(selectLimit);
  if (error) return json({ error: error.message }, 500);

  let candidates = rows ?? [];
  if (adoptedOnly) {
    const [logRes, rtRes] = await Promise.all([
      supabase.from('workout_logs').select('exercise_id'),
      supabase.from('routine_exercises').select('exercise_id'),
    ]);
    const used = new Set<string>([
      ...((logRes.data ?? []).map((r: any) => r.exercise_id)),
      ...((rtRes.data ?? []).map((r: any) => r.exercise_id)),
    ]);
    candidates = candidates.filter((r: any) => r.name_ko != null || used.has(r.id)).slice(0, limit);
  }

  const failed: { id: string; source_id: string | null; error: string }[] = [];
  let uploaded = 0;

  for (const row of candidates as any[]) {
    try {
      if (!row.source_id) { failed.push({ id: row.id, source_id: null, error: 'no source_id' }); continue; }
      const res = await fetch(row.image_url);
      if (!res.ok) { failed.push({ id: row.id, source_id: row.source_id, error: `fetch ${res.status}` }); continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `${row.source_id}/0.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (up.error) { failed.push({ id: row.id, source_id: row.source_id, error: `upload ${up.error.message}` }); continue; }
      const upd = await supabase.from('exercises').update({ image_url: publicBase + path }).eq('id', row.id);
      if (upd.error) { failed.push({ id: row.id, source_id: row.source_id, error: `update ${upd.error.message}` }); continue; }
      uploaded++;
    } catch (e) {
      failed.push({ id: row.id, source_id: row.source_id, error: String(e) });
    }
  }

  // 남은 핫링크 개수(배치 반복 종료 판단용)
  const { count: remaining } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'free-exercise-db')
    .like('image_url', `${RAW_PREFIX}%`);

  return json({ adoptedOnly, processed: candidates.length, uploaded, failed, remaining: remaining ?? null });
});
