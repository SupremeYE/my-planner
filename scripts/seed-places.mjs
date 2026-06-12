// scripts/seed-places.mjs
// 가고싶은 곳(Place) 모듈 Stage 1 — UI 테스트용 개발 seed
//
// 목적: Stage 2(보관함 UI) 개발/검증용 샘플 데이터.
//   - 폴더 5개
//   - 장소 6~8개(인천 기준) — 일부는 2개 폴더에 동시 소속(다대다 검증)
//   - 방문 5~6건(지역 다양하게: incheon 위주 + seoul/gyeonggi/busan/north-jeolla)
//
// 운영 데이터와 섞이지 않게 분리 + 재실행해도 중복 안 생기게(존재 체크 후 insert).
// 식별: 폴더는 (user_id, name), 장소는 (user_id, name) 기준 멱등.
//
// places/place_folders 는 user_id 가 NOT NULL DEFAULT auth.uid() 인 사용자 소유 행이라
// service_role 로 직접 insert 하려면 user_id 를 명시해야 한다(service_role 엔 auth.uid() 없음).
//
// 실행:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... [SEED_USER_ID=...] node scripts/seed-places.mjs
//   ※ SEED_USER_ID 미지정 시 auth.users 의 첫 사용자(솔로 앱)를 사용한다.

import { createClient } from '@supabase/supabase-js';

// ── 색은 디자인 토큰 키 문자열만 (하드코딩 hex 금지) ──────────────────────────
const FOLDERS = [
  { name: '가고싶은 카페', icon: '☕', color: 'gold',  sort_order: 0 },
  { name: '카공지도',     icon: '💻', color: 'coral', sort_order: 1 },
  { name: '데이트 코스',   icon: '🍷', color: 'coral', sort_order: 2 },
  { name: '혼밥·혼카페',   icon: '🌿', color: 'green', sort_order: 3 },
  { name: '맛집',         icon: '🍜', color: 'coral', sort_order: 4 },
];

// 장소 (인천 기준). folders = 소속 폴더 name 배열(다대다). 일부는 2곳 동시 소속.
const PLACES = [
  {
    name: '브라운핸즈 송도', category: '카페', region_code: 'incheon',
    source: 'instagram', concept: 'cafe', energy: 2,
    memo: '천장 높고 콘센트 많음. 작업하기 좋아.',
    folders: ['가고싶은 카페', '카공지도'], // 동시 소속(다대다 검증)
  },
  {
    name: '카페 알디프 송도', category: '카페', region_code: 'incheon',
    source: '직접 등록', concept: 'cafe', energy: 1,
    memo: '향수 만드는 카페. 조용함.',
    folders: ['가고싶은 카페', '혼밥·혼카페'], // 동시 소속(다대다 검증)
  },
  {
    name: '스타벅스 인천대공원R점', category: '카페', region_code: 'incheon',
    source: '직접 등록', concept: 'charge', energy: 1,
    memo: '공원 뷰. 혼자 충전하기 좋음.',
    folders: ['혼밥·혼카페'],
  },
  {
    name: '동인천 신포우리만두', category: '맛집·만두', region_code: 'incheon',
    source: 'youtube', concept: 'food', energy: 3,
    memo: '쫄면+만두 세트. 웨이팅 있음.',
    folders: ['맛집'],
  },
  {
    name: '월미도 라이브카페', category: '카페·바', region_code: 'incheon',
    source: 'instagram', concept: 'date', energy: 2,
    memo: '바다뷰 야경. 데이트 코스.',
    folders: ['데이트 코스'],
  },
  {
    name: '개항로 통닭집', category: '맛집·치킨', region_code: 'incheon',
    source: '직접 등록', concept: 'friend', energy: 3,
    memo: '레트로 분위기. 친구들이랑 맥주.',
    folders: ['맛집', '데이트 코스'], // 동시 소속(다대다 검증)
  },
  {
    name: '송도 트라이볼 전시', category: '문화·전시', region_code: 'incheon',
    source: 'instagram', concept: 'culture', energy: 1,
    memo: '가끔 기획전 함. 산책 겸.',
    folders: ['데이트 코스'],
  },
];

// 방문 기록 (지역 다양하게 — 히트맵 집계 확인용). place 연결은 이름으로 매칭(있으면).
const VISITS = [
  { name: '브라운핸즈 송도', region_code: 'incheon',     visited_on: '2026-06-01', mood: 8,  note: '작업 잘 됨' },
  { name: '동인천 신포우리만두', region_code: 'incheon',  visited_on: '2026-05-28', mood: 9,  note: '만두 최고' },
  { name: '연남동 산책', region_code: 'seoul',           visited_on: '2026-05-20', mood: 7,  note: '저장 안 한 곳도 기록' },
  { name: '수원 행궁동 카페거리', region_code: 'gyeonggi', visited_on: '2026-05-10', mood: 6,  note: null },
  { name: '광안리 해변', region_code: 'busan',           visited_on: '2026-04-25', mood: 10, note: '바다 좋았음' },
  { name: '전주 한옥마을', region_code: 'north-jeolla',   visited_on: '2026-04-12', mood: 8,  note: '비빔밥' },
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 대상 사용자 결정 (솔로 앱)
  let userId = process.env.SEED_USER_ID;
  if (!userId) {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    if (!users?.users?.length) { console.error('auth.users 에 사용자가 없습니다. SEED_USER_ID 를 지정하세요.'); process.exit(1); }
    userId = users.users[0].id;
  }
  console.log(`seed 대상 user_id: ${userId}`);

  // ── 폴더 멱등 생성 → name→id 맵 ──────────────────────────────────────────────
  const folderIdByName = {};
  for (const f of FOLDERS) {
    const { data: existing } = await supabase
      .from('place_folders').select('id')
      .eq('user_id', userId).eq('name', f.name).maybeSingle();
    if (existing?.id) { folderIdByName[f.name] = existing.id; continue; }
    const { data, error } = await supabase
      .from('place_folders')
      .insert({ user_id: userId, ...f })
      .select('id').single();
    if (error) throw error;
    folderIdByName[f.name] = data.id;
    console.log(`+ folder: ${f.name}`);
  }

  // ── 장소 멱등 생성 + 폴더 연결(다대다) ───────────────────────────────────────
  const placeIdByName = {};
  for (const p of PLACES) {
    const { folders, ...cols } = p;
    let placeId;
    const { data: existing } = await supabase
      .from('places').select('id')
      .eq('user_id', userId).eq('name', p.name).maybeSingle();
    if (existing?.id) {
      placeId = existing.id;
    } else {
      const { data, error } = await supabase
        .from('places')
        .insert({ user_id: userId, ...cols })
        .select('id').single();
      if (error) throw error;
      placeId = data.id;
      console.log(`+ place: ${p.name}`);
    }
    placeIdByName[p.name] = placeId;

    // 폴더 연결(이미 있으면 무시 — 복합 PK upsert ignoreDuplicates)
    const links = folders
      .map(fname => folderIdByName[fname])
      .filter(Boolean)
      .map(folder_id => ({ place_id: placeId, folder_id }));
    if (links.length) {
      const { error } = await supabase
        .from('place_folder_items')
        .upsert(links, { onConflict: 'place_id,folder_id', ignoreDuplicates: true });
      if (error) throw error;
    }
  }

  // ── 방문 멱등 생성 ((user_id, name, visited_on) 기준) ─────────────────────────
  for (const v of VISITS) {
    const { data: existing } = await supabase
      .from('place_visits').select('id')
      .eq('user_id', userId).eq('name', v.name).eq('visited_on', v.visited_on).maybeSingle();
    if (existing?.id) continue;
    const { error } = await supabase
      .from('place_visits')
      .insert({ user_id: userId, place_id: placeIdByName[v.name] ?? null, ...v });
    if (error) throw error;
    console.log(`+ visit: ${v.name} (${v.region_code}, ${v.visited_on})`);
  }

  console.log('seed 완료.');
}

main().catch((e) => { console.error(e); process.exit(1); });
