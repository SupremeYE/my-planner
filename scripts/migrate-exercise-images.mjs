// scripts/migrate-exercise-images.mjs
// 운동 모듈 Stage 3 — 종목 이미지 GitHub raw 핫링크 → Supabase Storage(exercise-images) 이관.
//
// 일회성·멱등 스크립트. UI 로직은 건드리지 않고 exercises.image_url 만 갱신한다.
//  - source='free-exercise-db' 이고 image_url 이 아직 GitHub raw 핫링크인 행만 대상(멱등성).
//  - 이미지 다운로드 → exercise-images 버킷의 {source_id}/0.jpg 로 업로드(upsert)
//    → image_url 을 Storage 공개 URL 로 UPDATE.
//  - 실패 항목은 로그로 남기고 핫링크 유지(앱이 깨지지 않게).
//  - 이미 Storage URL 인 행은 건너뜀(재실행 안전).
//  - --adopted-only : 채택된 종목(name_ko not null 또는 logs/routines 등장)만 우선 이관.
//
// 실행(서비스롤 키 필요 — 공용 버킷 쓰기 + RLS 우회):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-exercise-images.mjs [--adopted-only]
//
// ※ 참고: 동일 로직을 Edge Function `migrate-exercise-images` 로도 배포해 두었다.
//   (네트워크 송신이 제한된 환경에서는 Edge Function 을 호출해 서버 측에서 이관)

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'exercise-images';
const RAW_PREFIX = 'https://raw.githubusercontent.com/';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }
  const adoptedOnly = process.argv.includes('--adopted-only');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const publicBase = `${url}/storage/v1/object/public/${BUCKET}/`;

  // 아직 핫링크인 free-exercise-db 행
  const { data: rows, error } = await supabase
    .from('exercises')
    .select('id, source_id, image_url, name_ko')
    .eq('source', 'free-exercise-db')
    .like('image_url', `${RAW_PREFIX}%`)
    .order('id', { ascending: true });
  if (error) { console.error('select 실패:', error.message); process.exit(1); }

  let candidates = rows ?? [];
  if (adoptedOnly) {
    const [{ data: logIds }, { data: rtIds }] = await Promise.all([
      supabase.from('workout_logs').select('exercise_id'),
      supabase.from('routine_exercises').select('exercise_id'),
    ]);
    const used = new Set([...(logIds ?? []).map(r => r.exercise_id), ...(rtIds ?? []).map(r => r.exercise_id)]);
    candidates = candidates.filter(r => r.name_ko != null || used.has(r.id));
  }
  console.log(`이관 대상: ${candidates.length}개${adoptedOnly ? ' (채택 종목만)' : ''}`);

  let uploaded = 0;
  const failed = [];
  for (const row of candidates) {
    try {
      if (!row.source_id) { failed.push({ id: row.id, error: 'no source_id' }); continue; }
      const res = await fetch(row.image_url);
      if (!res.ok) { failed.push({ id: row.id, source_id: row.source_id, error: `fetch ${res.status}` }); continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `${row.source_id}/0.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (up.error) { failed.push({ id: row.id, source_id: row.source_id, error: `upload ${up.error.message}` }); continue; }
      const upd = await supabase.from('exercises').update({ image_url: publicBase + path }).eq('id', row.id);
      if (upd.error) { failed.push({ id: row.id, source_id: row.source_id, error: `update ${upd.error.message}` }); continue; }
      uploaded++;
      if (uploaded % 50 === 0) console.log(`  ${uploaded}/${candidates.length} 업로드…`);
    } catch (e) {
      failed.push({ id: row.id, source_id: row.source_id, error: String(e) });
    }
  }

  console.log(`완료: ${uploaded} 업로드, ${failed.length} 실패`);
  if (failed.length) console.log('실패 목록(핫링크 유지):', JSON.stringify(failed, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
