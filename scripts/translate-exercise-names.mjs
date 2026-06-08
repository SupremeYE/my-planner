// scripts/translate-exercise-names.mjs
// 운동 종목 영어 이름(name_en) → 한글(name_ko) 일괄 채움 — seed 성격의 1회 배치 작업.
//
// 런타임 번역 금지: 이 스크립트는 "한 번 돌려 DB를 채우는" 용도다. 앱 페이지 진입/조회마다
// 번역을 호출하는 코드는 절대 만들지 않는다. (앱의 검색/표시는 저장된 name_ko/name_en 만 읽는다.)
//
// 동작:
//  - exercises 중 name_ko IS NULL 인 행만 대상(멱등 — 이미 채워진 행은 재번역 안 함).
//  - 30~50개씩 묶어 Claude Haiku(claude-haiku-4-5)에 JSON in/out 으로 번역 요청.
//  - 받은 [{id, name_ko}] 로 exercises.name_ko 를 id 기준 UPDATE.
//  - 마지막에 검수 리스트(실패/미번역/라틴 잔존/길이 이상치) 출력.
//
// 실행:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... node scripts/translate-exercise-names.mjs
//   ※ name_ko=null 카탈로그 행은 공용(user_id=null)이라 RLS 우회 위해 service_role 키 필요.
//
// ※ 참고: 2026-06-08 실제 적용분은 동일 지침으로 생성한 결과를 scripts/exercise-name-ko.seed.json
//   에 기록하고 멱등 UPDATE 로 반영했다(네트워크/키 제약 환경 대비). 이 스크립트는 재현·갱신용.

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
const CHUNK = 40;

const SYSTEM = `너는 한국 헬스 트레이너다. 운동 종목의 영어 이름을 한국 헬스장에서 실제로 쓰는 자연스러운 한글 종목명으로 바꾼다.
규칙:
- 한국 피트니스 용어는 대부분 영어 외래어 음차다. 그 관례를 따른다.
  예) Barbell→바벨, Dumbbell→덤벨, Cable→케이블, Machine→머신, Smith→스미스, Incline→인클라인,
      Decline→디클라인, Seated→시티드, Standing→스탠딩, Wide→와이드, Close-grip→클로즈그립,
      Squat→스쿼트, Deadlift→데드리프트, Bench Press→벤치프레스, Row→로우, Curl→컬, Press→프레스,
      Raise→레이즈, Extension→익스텐션, Fly→플라이, Lunge→런지, Pulldown→풀다운
- 군더더기 설명·괄호 설명 금지. 종목명만.
- 약어(SMR, TRX, EZ바, V바 등)는 음차하지 말고 그대로 둔다.
- 입력은 [{id, name_en}] 배열. 출력은 정확히 [{id, name_ko}] JSON 배열만. 마크다운/주석/코드펜스 없이 JSON 만.`;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function translateChunk(client, rows) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(rows.map(r => ({ id: r.id, name_en: r.name_en }))) }],
  });
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();
  const json = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(json); // [{id, name_ko}]
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !anthropicKey) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const client = new Anthropic({ apiKey: anthropicKey });

  // 멱등: name_ko IS NULL 인 것만
  const { data: targets, error } = await supabase
    .from('exercises').select('id, name_en').is('name_ko', null).order('name_en');
  if (error) { console.error('select 실패:', error.message); process.exit(1); }
  console.log(`대상: ${targets.length}개`);

  let filled = 0;
  for (const part of chunk(targets, CHUNK)) {
    let pairs;
    try { pairs = await translateChunk(client, part); }
    catch (e) { console.error('번역/파싱 실패, 이 청크 건너뜀:', String(e)); continue; }
    for (const { id, name_ko } of pairs) {
      if (!id || !name_ko) continue;
      const { error: uErr } = await supabase.from('exercises')
        .update({ name_ko }).eq('id', id).is('name_ko', null);
      if (!uErr) filled++;
    }
    console.log(`  진행: ${filled}/${targets.length}`);
  }

  // ── 검수 리스트 ──
  const { data: all } = await supabase.from('exercises').select('name_en, name_ko');
  const stillNull = (all ?? []).filter(r => !r.name_ko);
  const eq = (all ?? []).filter(r => r.name_ko && r.name_ko === r.name_en);
  const latin = (all ?? []).filter(r => r.name_ko && /[A-Za-z].*[A-Za-z].*[A-Za-z]/.test(r.name_ko));
  const lenBad = (all ?? []).filter(r => r.name_ko && (r.name_ko.length > 30 || r.name_ko.trim().length === 0));
  console.log('\n===== 검수 리스트 =====');
  console.log('번역 실패(null):', stillNull.length, stillNull.map(r => r.name_en));
  console.log('name_ko == name_en:', eq.length, eq.map(r => r.name_en));
  console.log('라틴 3자+ 잔존(약어 확인):', latin.length, latin.map(r => `${r.name_ko} ← ${r.name_en}`));
  console.log('길이 이상치:', lenBad.length, lenBad.map(r => `${r.name_ko} ← ${r.name_en}`));
  console.log(`\n완료: ${filled}개 채움.`);
}

main().catch(e => { console.error(e); process.exit(1); });
