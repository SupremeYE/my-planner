// 라일락 드리프트 검증 하네스 (A-0)
// 사용법: node scan-harness.mjs <route> <label>
//   예: node scan-harness.mjs /reviews stage2-after
// 동작: 테마 H + 가짜 세션 주입 → 인증 라우트 렌더 → 스크린샷 + 라벤더 색 스캔.
// 주의: Supabase 네트워크는 차단되어 데이터 fetch는 실패한다. UI 표면 구조 렌더 확인/색 판정 용도.
import { chromium } from 'playwright';

// 라일락 클린업 검증용 개발 도구(런타임 앱과 무관). 저장소에 커밋되지만 앱 번들에는 포함되지 않는다.
// 사용법: node scan-harness.mjs <route> <label>   예) node scan-harness.mjs "/health?tab=condition" cond
// 출력 위치는 SCAN_OUT 환경변수로 바꿀 수 있다(기본 ./scan-out). 대상 dev 서버 URL은 SCAN_BASE.
// 프로젝트 ref는 .env.local 의 VITE_SUPABASE_URL 에서 자동 추출(하드코딩 안 함).
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

const route = process.argv[2] || '/reviews';
const label = process.argv[3] || 'scan';
const OUT_DIR = process.env.SCAN_OUT || './scan-out';
const BASE = process.env.SCAN_BASE || 'http://localhost:5173';
// .env.local 에서 Supabase 프로젝트 ref 추출 (가짜 세션 주입용 storage key 구성에 필요)
const REF = (() => {
  try {
    const env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
    const m = env.match(/VITE_SUPABASE_URL=https?:\/\/([a-z0-9]+)\.supabase\.co/i);
    return m ? m[1] : 'localproject';
  } catch { return 'localproject'; }
})();
mkdirSync(OUT_DIR, { recursive: true });

// 먼 미래(2099) 만료의 가짜 세션 — getSession()이 네트워크 없이 로컬에서 반환하게 한다.
const fakeSession = {
  access_token: 'harness.fake.jwt',
  refresh_token: 'harness-fake-refresh',
  expires_at: 4070908800, // 2099-01-01
  expires_in: 999999999,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-0000-0000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'harness@local.test',
    user_metadata: { name: '검증' },
    app_metadata: { provider: 'email' },
    created_at: '2026-01-01T00:00:00Z',
  },
};

const lavenderScan = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const out = [];
  const els = document.querySelectorAll('*');
  for (const el of els) {
    const cs = getComputedStyle(el);
    const bg = parse(cs.backgroundColor);
    if (!bg || bg.a < 0.5) continue;
    const { r, g, b } = bg;
    // 라벤더 판정: B우세 + 채도 + 밝은 표면대
    if (b > r && b > g && (b - g) >= 8 && r > 220 && g > 220 && b > 220) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue; // 안 보이는 요소 스킵
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '',
        color: `rgb(${r},${g},${b})`,
        bMinusG: b - g,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        x: Math.round(rect.x), y: Math.round(rect.y),
        w: Math.round(rect.width), h: Math.round(rect.height),
      });
    }
  }
  return out;
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 3200 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  // 1) origin 확보 위해 최초 로드
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 2) 테마 H + 가짜 세션 주입
  await page.evaluate(({ ref, sess }) => {
    localStorage.setItem('haon.theme', 'H');
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
  }, { ref: REF, sess: fakeSession });
  // 3) 목표 라우트로 리로드 (세션 복원 → 인증 렌더)
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 스플래시(1.8s) + 데이터 fetch 실패 정착 대기
  await page.waitForTimeout(5000);

  const title = await page.title();
  const rootLen = await page.$eval('#root', el => el.innerHTML.length).catch(() => -1);
  const isLogin = await page.evaluate(() => !!document.body.innerText.match(/로그인|다시 만나서/));
  const bodySample = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200));
  const candidates = await page.evaluate(lavenderScan);

  await page.screenshot({ path: `${OUT_DIR}/${label}.png`, fullPage: false });

  console.log(JSON.stringify({
    route, label, title, rootLen, isLogin, bodySample,
    lavenderCandidateCount: candidates.length,
    candidates: candidates.slice(0, 40),
    pageErrors: pageErrors.slice(0, 5),
  }, null, 2));

  await browser.close();
};

run().catch(e => { console.error('HARNESS_ERROR:', e.message); process.exit(1); });
