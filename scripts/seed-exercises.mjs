// scripts/seed-exercises.mjs
// 운동 모듈 Stage 0 — free-exercise-db → exercises 카탈로그 import (seed)
//
// 데이터 원칙(매우 중요):
//  - 운동 데이터는 "DB에 한 번 저장 → 이후엔 읽기만" 구조다.
//  - 영어 이름의 한글화(name_ko)는 이 seed 시점 또는 종목을 "내 운동"으로 채택하는
//    시점에 1회만 일어나고 결과를 name_ko 컬럼에 저장한다.
//  - 런타임 번역 금지: 운동 페이지를 볼 때마다 번역 API를 호출하는 동작은
//    어떤 경우에도 만들지 않는다. 여기서도 번역 API를 호출하지 않는다 —
//    name_ko 는 미리 정해둔 스타터 매핑 텍스트만 넣고, 나머지는 null(카탈로그)로 둔다.
//
// 출처: yuhonas/free-exercise-db (퍼블릭 도메인, 약 800+ 종목)
//   JSON  : https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
//   이미지: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<id>/0.jpg
//           (각 항목 images[0] === `${id}/0.jpg` 임을 확인함 → Stage 0 은 GitHub raw 핫링크 사용.
//            Supabase Storage 이관은 Stage 3 에서 별도로.)
//
// 실행:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-exercises.mjs
//   ※ exercises 카탈로그 행은 user_id=null 공용 행이라 RLS 를 우회하는 service_role 키가 필요하다.
//   ※ source_id 기준 멱등(이미 있으면 skip). 이미 production 에 적용 완료된 1회성 스크립트이며,
//      재현/문서화를 위해 리포에 보관한다.

import { createClient } from '@supabase/supabase-js';

const RAW_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const SRC_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

// ── 매핑 딕셔너리 (원본 분류 → 우리 enum) ──────────────────────────────────
const mapType = (category) => (category === 'cardio' ? '유산소' : '근력');

const BODY_PART = {
  // 하체
  quadriceps: '하체', hamstrings: '하체', glutes: '하체', calves: '하체',
  abductors: '하체', adductors: '하체',
  // 가슴
  chest: '가슴',
  // 등
  lats: '등', 'middle back': '등', 'lower back': '등', traps: '등',
  // 어깨
  shoulders: '어깨', neck: '어깨',
  // 팔
  biceps: '팔', triceps: '팔', forearms: '팔',
  // 코어
  abdominals: '코어', abs: '코어',
};
function mapBodyPart(type, primaryMuscles) {
  if (type === '유산소') return '유산소'; // type 이 유산소면 body_part 강제
  const m = (primaryMuscles && primaryMuscles[0]) || '';
  return BODY_PART[m] || '전신'; // 전신성/판단 불가 → 전신
}

// ── 스타터 한글 종목 (name_en 매칭으로 name_ko UPDATE) ──────────────────────
//   정확히 매칭되는 항목이 없으면 가장 가까운 항목에 매핑.
//   free-exercise-db 에 없는 종목(요가)은 custom 으로 직접 insert.
const STARTERS = [
  ['Barbell Squat', '바벨 스쿼트'],
  ['Romanian Deadlift', '루마니안 데드리프트'],
  ['Barbell Hip Thrust', '바벨 힙쓰러스트'],
  ['Wide-Grip Lat Pulldown', '랫풀다운'],            // 'Lat Pulldown' 정확 매칭 없음 → 가장 가까운 항목
  ['Barbell Bench Press - Medium Grip', '벤치프레스'], // 'Bench Press' 정확 매칭 없음 → 가장 가까운 항목
  ['Barbell Shoulder Press', '숄더프레스'],
  ['Running, Treadmill', '러닝'],                     // 'Running' 정확 매칭 없음 → 가장 가까운 항목
  ['Bicycling', '사이클'],                            // 'Cycling' 정확 매칭 없음 → 가장 가까운 항목
];
const CUSTOM_STARTERS = [
  // free-exercise-db 에 매칭 항목 없음 → custom 공용 카탈로그(user_id=null)로 직접 insert
  { name_ko: '요가', name_en: 'Yoga', type: '유산소', body_part: '전신', source: 'custom' },
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const raw = await fetch(SRC_URL).then((r) => r.json());
  console.log(`free-exercise-db 항목: ${raw.length}`);

  const rows = raw.map((e) => {
    const type = mapType(e.category);
    return {
      user_id: null, // 전체 공용 카탈로그
      name_ko: null, // import 시엔 모두 null (= 카탈로그, 일괄 번역하지 않음)
      name_en: e.name,
      type,
      body_part: mapBodyPart(type, e.primaryMuscles),
      equipment: e.equipment ?? null,
      primary_muscles: e.primaryMuscles ?? [],
      image_url: e.images && e.images.length ? RAW_BASE + e.images[0] : null,
      source: 'free-exercise-db',
      source_id: e.id,
    };
  });

  // 멱등 import: 이미 있는 source_id 는 건너뛴다
  const { data: existing } = await supabase
    .from('exercises')
    .select('source_id')
    .eq('source', 'free-exercise-db');
  const have = new Set((existing ?? []).map((r) => r.source_id));
  const toInsert = rows.filter((r) => !have.has(r.source_id));

  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await supabase.from('exercises').insert(chunk);
    if (error) throw error;
    console.log(`inserted ${i + chunk.length}/${toInsert.length}`);
  }

  // 스타터 한글화 (정해진 텍스트 1회성, 번역 API 미사용)
  for (const [name_en, name_ko] of STARTERS) {
    await supabase.from('exercises').update({ name_ko })
      .eq('source', 'free-exercise-db').eq('name_en', name_en);
  }
  for (const c of CUSTOM_STARTERS) {
    const { data: dup } = await supabase.from('exercises')
      .select('id').eq('name_en', c.name_en).eq('source', 'custom').is('user_id', null).maybeSingle();
    if (!dup) await supabase.from('exercises').insert(c);
  }

  console.log('seed 완료.');
}

main().catch((e) => { console.error(e); process.exit(1); });
