#!/usr/bin/env node
/**
 * 렌더 하네스 (상주) — `npm run render:check`
 *
 * 실제 컴포넌트를 Vite dev 서버로 띄우되 `lib/supabase`·`lib/db` 를
 * scripts/render/mock-*.ts 로 리다이렉트해 네트워크/인증 없이 시드 데이터로 렌더한다.
 * 사전 설치된 Chromium(Playwright)으로 라우트×뷰포트별 스크린샷을 저장하고,
 * 라벤더 잔여 / 요소 클리핑·뷰포트 이탈 / 주요 영역 0-높이 붕괴를 수치로 리포트한다.
 *
 * 산출물: scripts/render/output/<viewport>-<route>.png, report.json
 * 사용법: node scripts/render/run.mjs [--route=daily,todos] [--open]
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, 'output');
const MOCK_SUPABASE = path.resolve(__dirname, 'mock-supabase.ts');
const MOCK_DB = path.resolve(__dirname, 'mock-db.ts');
const MOCK_MONEY_DB = path.resolve(__dirname, 'mock-money-db.ts');
const CHROME = process.env.HAON_CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// ── 대상 라우트 / 서브뷰 ─────────────────────────────────────────────────────
const ALL_ROUTES = [
  // openMenu: 최하단 항목의 '…' 메뉴를 열어 클리핑/뷰포트 이탈을 검출(Stage 3 실증)
  {
    // openEventModal: 일정 편집 모달을 열어 태그 선택 UI 를 검출(일정 모달 태그 검증)
    slug: 'daily', path: '/daily', openMenu: true, openEventModal: true,
    // modalFlows: 시드 일정/할일의 수정 모달을 열어 모달 정합(DateField·반복 칩·색 스와치),
    // 종일 토글 시 시간 필드 숨김, 할일 "반복 종료" 3옵션을 실제 렌더로 검출.
    // 각 플로우는 라우트를 새로 로드→steps 텍스트를 순서대로 클릭→스크린샷.
    modalFlows: [
      { name: 'event-edit', steps: ['팀 스탠드업'] },                       // 일정 수정 모달(정합)
      { name: 'event-allday', steps: ['팀 스탠드업', '종일'] },             // 종일 → 시간 필드 숨김
      { name: 'todo-recur', steps: ['할일 메뉴', '편집', '직접 설정', 'N회 후'] }, // 반복 종료 3옵션
    ],
  },
  { slug: 'todos', path: '/todos', openMenu: true },
  // 캡처 인박스 — 서버 분류 제안 카드(event/todo/money/seed/미확정) 스와이프 승인 UI.
  // 시드는 mock-supabase.ts 의 CAPTURE_INBOX_SEED(5건, seed 는 confidence 0.7 저확신 마커).
  { slug: 'inbox', path: '/inbox' },
  // 시간 리포트 — 일정 태그 집계가 나타나는지(주간 리뷰 시간 스트립과 같은 소스)
  { slug: 'time-report', path: '/time-report' },
  {
    slug: 'calendar', path: '/calendar',
    subs: [
      { name: 'week', text: ['주별', '주간', '주'] },
      { name: 'month', text: ['월별', '월간', '월'] },
    ],
  },
  {
    slug: 'reviews', path: '/reviews',
    subs: [
      { name: 'weekly', text: ['주간'] },
      { name: 'monthly', text: ['월간'] },
    ],
  },
  { slug: 'goals', path: '/goals' },
  // 습관 & 루틴 — Theme H 마이그레이션 검증. 3개 탭(습관 실행 기본 + 트래커·루틴 설정 서브),
  // 습관 추가 모달(글래스 표면·파스텔 스와치·세그먼트) 플로우.
  {
    slug: 'habits', path: '/habits',
    subs: [
      { name: 'tracker', text: ['습관 트래커'] },
      { name: 'routines', text: ['루틴 설정'] },
    ],
    modalFlows: [
      { name: 'add', steps: ['습관 추가'] },
    ],
  },
  // 컨디션 재설계(condition·slot 축) 검증 — 통계 카드·요일 셀·기록 리스트를 시드로 렌더.
  { slug: 'health-condition', path: '/health?tab=condition' },
  // 머니 — 기본(가계부) + 나머지 3탭. 시드는 mock-money-db.ts.
  {
    slug: 'money', path: '/money',
    subs: [
      { name: 'asset', text: ['자산'] },
      { name: 'invest', text: ['투자'] },
      { name: 'plan', text: ['계획'] },
    ],
  },
];

const VIEWPORTS = [
  { name: 'pc', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

// CLI: --route=daily,todos 로 일부만
const routeArg = process.argv.find((a) => a.startsWith('--route='));
const wanted = routeArg ? routeArg.split('=')[1].split(',') : null;
const ROUTES = wanted ? ALL_ROUTES.filter((r) => wanted.includes(r.slug)) : ALL_ROUTES;

// ── 페이지 내 자동 검사 (page.evaluate 로 주입) ───────────────────────────────
function pageAudit() {
  const W = window.innerWidth, H = window.innerHeight;
  const parseRGB = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    if (p[3] !== undefined && p[3] < 0.1) return null;
    return { r: p[0], g: p[1], b: p[2] };
  };
  // 기존 기준 재사용: B>R && B>G && (B-G)>=8 && 모든 채널>220
  const isLav = (c) => c && c.r > 220 && c.g > 220 && c.b > 220 && c.b > c.r && c.b > c.g && (c.b - c.g) >= 8;
  const selOf = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cls) s += '.' + cls;
    }
    return s;
  };
  const all = Array.from(document.querySelectorAll('body *'));
  const lav = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const bg = parseRGB(cs.backgroundColor);
    if (isLav(bg)) lav.push({ sel: selOf(el), prop: 'bg', rgb: bg });
  }
  const overflowClips = (el) => {
    let p = el.parentElement;
    const r = el.getBoundingClientRect();
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      const clipsX = ['hidden', 'auto', 'scroll'].includes(cs.overflowX);
      const clipsY = ['hidden', 'auto', 'scroll'].includes(cs.overflowY);
      if (clipsX || clipsY) {
        const pr = p.getBoundingClientRect();
        if ((clipsY && (r.top < pr.top - 1 || r.bottom > pr.bottom + 1)) ||
            (clipsX && (r.left < pr.left - 1 || r.right > pr.right + 1))) {
          return { ancestor: selOf(p), overflow: cs.overflowX + '/' + cs.overflowY };
        }
      }
      p = p.parentElement;
    }
    return null;
  };
  const popSel = '[role=menu],[role=listbox],[role=dialog],[role=tooltip],[data-radix-popper-content-wrapper],[data-radix-popover-content],[data-radix-menu-content],[data-radix-dropdown-menu-content]';
  const clippedPopovers = [], offViewport = [];
  for (const el of Array.from(document.querySelectorAll(popSel))) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const clip = overflowClips(el);
    if (clip) clippedPopovers.push({ sel: selOf(el), ...clip });
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1)
      offViewport.push({ sel: selOf(el), rect: { t: Math.round(r.top), l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom) } });
  }
  const bodyHorizontalOverflow = document.documentElement.scrollWidth > W + 1;
  // 이 앱은 PC/모바일 이중 트리(hidden lg:block / lg:hidden)라 숨은 <main> 은 높이 0 이다.
  // → 보이는(높이>0) main 을 고르고, 전체 렌더 여부는 #root scrollHeight 로 판단한다.
  const mains = Array.from(document.querySelectorAll('main,[role=main]'));
  const visibleMain = mains.find((m) => m.getBoundingClientRect().height > 0);
  const rootEl = document.getElementById('root') || document.body;
  const mainEl = visibleMain || rootEl;
  const mainHeight = Math.round(mainEl.getBoundingClientRect().height);
  const rootScroll = Math.round(rootEl.scrollHeight);
  const collapsedRegions = [];
  for (const el of Array.from(mainEl.children)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue; // 숨은 트리 제외
    const r = el.getBoundingClientRect();
    if (r.width > 40 && r.height === 0 && el.children.length > 0) collapsedRegions.push(selOf(el));
  }
  return {
    lavenderCount: lav.length,
    lavenderSamples: lav.slice(0, 12),
    bodyHorizontalOverflow,
    clippedPopovers,
    offViewport: offViewport.slice(0, 12),
    mainHeight,
    rootScroll,
    collapsedRegions: collapsedRegions.slice(0, 10),
  };
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
async function freePort() {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => res(p));
    });
  });
}

function mockRedirectPlugin() {
  return {
    name: 'render-harness-mocks',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.includes('scripts/render/')) return null;
      const bare = source.replace(/\.(t|j)sx?$/, '');
      const fromLib = !!importer && importer.replace(/\\/g, '/').includes('/src/lib/');
      const isSup = bare === '@/lib/supabase' || /(^|\/)lib\/supabase$/.test(bare) || (bare === './supabase' && fromLib);
      if (isSup) return MOCK_SUPABASE;
      const isDb = bare === '@/lib/db' || /(^|\/)lib\/db$/.test(bare) || (bare === './db' && fromLib);
      if (isDb) return MOCK_DB;
      // 머니는 feature-local db(src/features/money/db.ts) — 전역 db 와 별도 시드.
      const fromMoney = !!importer && importer.replace(/\\/g, '/').includes('/src/features/money/');
      const isMoneyDb = bare === '@/features/money/db' || /(^|\/)features\/money\/db$/.test(bare) || (bare === './db' && fromMoney);
      if (isMoneyDb) return MOCK_MONEY_DB;
      return null;
    },
  };
}

function verdict(a) {
  const fails = [];
  const warns = [];
  if ((a.rootScroll ?? 0) < 200) fails.push(`화면 붕괴(root ${a.rootScroll}px)`);
  if (a.clippedPopovers.length) fails.push(`팝오버 클리핑 ${a.clippedPopovers.length}건`);
  if (a.collapsedRegions.length) warns.push(`0-높이 영역 ${a.collapsedRegions.length}건`);
  if (a.lavenderCount > 8) warns.push(`라벤더 ${a.lavenderCount}건`);
  else if (a.lavenderCount > 0) warns.push(`라벤더 ${a.lavenderCount}건(경미)`);
  if (a.bodyHorizontalOverflow) warns.push('가로 오버플로우');
  if (a.offViewport.length) warns.push(`뷰포트 이탈 ${a.offViewport.length}건`);
  return { status: fails.length ? 'FAIL' : warns.length ? 'WARN' : 'PASS', fails, warns };
}

async function settle(page) {
  await page.waitForTimeout(2600); // 스플래시(1.8s) + 인증 + 초기 로드
  try { await page.waitForSelector('main', { timeout: 8000 }); } catch {}
  try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
  await page.waitForTimeout(500);
}

// 내부 스크롤 컨테이너를 끝까지 내린다(이 앱은 body 가 아니라 컨테이너가 스크롤).
async function scrollToBottom(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) {
        el.scrollTop = el.scrollHeight;
      }
    }
    (document.scrollingElement || document.documentElement).scrollTop = 1e6;
  });
  await page.waitForTimeout(500);
}

async function tryClickText(page, candidates) {
  const attempts = [];
  for (const t of candidates) {
    attempts.push(() => page.getByRole('tab', { name: t, exact: true }).first());
    attempts.push(() => page.getByRole('menuitem', { name: t, exact: true }).first());
    attempts.push(() => page.getByRole('button', { name: t, exact: true }).first());
    attempts.push(() => page.getByText(t, { exact: true }).first());
    attempts.push(() => page.getByText(t, { exact: false }).first());
  }
  for (const make of attempts) {
    try {
      const loc = make();
      if (await loc.count()) {
        await loc.click({ timeout: 1200 });
        await page.waitForTimeout(700);
        return true;
      }
    } catch {}
  }
  return false;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(CHROME)) {
    console.error(`✗ Chromium 바이너리를 찾을 수 없습니다: ${CHROME}\n  HAON_CHROME 환경변수로 경로를 지정하세요.`);
    process.exit(2);
  }

  const port = await freePort();
  console.log('▶ Vite dev 서버 기동…');
  const server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    plugins: [mockRedirectPlugin(), react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(ROOT, 'src') } },
    server: { port, host: '127.0.0.1', strictPort: true },
    optimizeDeps: { entries: ['src/main.tsx'] },
  });
  await server.listen();
  const base = `http://127.0.0.1:${port}`;
  console.log(`  ${base}`);

  console.log('▶ Chromium 기동…');
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const report = [];
  const shots = [];
  try {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log(`   [pageerror ${vp.name}] ${String(e).slice(0, 160)}` + (process.env.HAON_STACK ? `\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}` : '')));

      for (const route of ROUTES) {
        const url = base + route.path;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        } catch (e) {
          console.log(`   ✗ goto 실패 ${route.slug}: ${e.message}`);
        }
        await settle(page);

        const doShot = async (subName) => {
          const label = subName ? `${vp.name}-${route.slug}-${subName}` : `${vp.name}-${route.slug}`;
          const file = path.join(OUT, `${label}.png`);
          await page.screenshot({ path: file, fullPage: true });
          const audit = await page.evaluate(pageAudit).catch((e) => ({ error: String(e) }));
          const v = verdict(audit);
          report.push({ viewport: vp.name, route: route.slug, sub: subName || null, audit, verdict: v });
          shots.push(path.relative(ROOT, file));
          const tag = v.status === 'FAIL' ? '✗' : v.status === 'WARN' ? '△' : '✓';
          console.log(`   ${tag} ${label.padEnd(24)} main=${audit.mainHeight ?? '?'}px  라벤더=${audit.lavenderCount ?? '?'}  ${[...v.fails, ...v.warns].join(', ')}`);
        };

        await doShot(null);
        if (route.slug === 'reviews') {
          // 일간 탭 하단(오늘의 숫자·조각·오늘 한 일)까지 담기 위해 스크롤 컨테이너를 끝까지 내린다.
          const scrollBottom = () => {
            for (const el of document.querySelectorAll('*')) {
              const cs = getComputedStyle(el);
              if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) el.scrollTop = el.scrollHeight;
            }
            (document.scrollingElement || document.documentElement).scrollTop = 1e6;
          };
          await page.evaluate(scrollBottom);
          await page.waitForTimeout(500);
          await doShot('day-full');
          // 주간/월간 탭 클릭 전 스크롤을 위로 되돌린다(서브 캡처가 상단부터 보이도록).
          await page.evaluate(() => {
            for (const el of document.querySelectorAll('*')) {
              const cs = getComputedStyle(el);
              if (/(auto|scroll)/.test(cs.overflowY)) el.scrollTop = 0;
            }
            (document.scrollingElement || document.documentElement).scrollTop = 0;
          });
          await page.waitForTimeout(200);
        }
        if (route.slug === 'health-condition') {
          // 통계 카드 아래 '기록 리스트'(컨디션·시점 뱃지)까지 담기 위해 스크롤 컨테이너를 끝까지 내린다.
          await scrollToBottom(page);
          await doShot('list');
        }
        for (const sub of route.subs || []) {
          const ok = await tryClickText(page, sub.text);
          if (ok) { await doShot(sub.name); }
          else console.log(`   · ${route.slug}:${sub.name} 탭 못 찾음(스킵)`);
        }
        // 모달 정합 검증: 각 플로우마다 라우트를 새로 로드→steps 클릭→스크린샷(모달 캡처).
        for (const flow of route.modalFlows || []) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await settle(page);
            let ok = true;
            for (const step of flow.steps) {
              const clicked = await tryClickText(page, [step]);
              if (!clicked) { ok = false; console.log(`   · ${route.slug}:${flow.name} "${step}" 못 찾음(스킵)`); break; }
            }
            if (ok) { await page.waitForTimeout(300); await doShot(flow.name); }
          } catch (e) {
            console.log(`   · ${route.slug}:${flow.name} 실패(스킵): ${e.message.split('\n')[0]}`);
          }
        }

        if (route.slug === 'money') {
          // 기간 연동 검증 — PeriodBar ‹ 로 지난 기간을 열면 요약·카테고리별 지출·최근 거래가
          // 함께 그 기간 값으로 바뀌어야 한다(리스트만 전체 거래를 보여주던 회귀 방지).
          // 서브탭 순회로 '계획' 탭이 열려 있으므로 가계부 탭으로 되돌린 뒤 기간을 옮긴다.
          try {
            await tryClickText(page, ['가계부']);
            const prev = page.locator('button[title="이전 기간"]:visible').first();
            if (await prev.count()) {
              await prev.click({ timeout: 2000 });
              await page.waitForTimeout(500);
              // 최근 거래 블록은 모바일에서 화면 아래 — 끝까지 내려 리스트가 프레임에 들어오게 한다.
              await scrollToBottom(page);
              await doShot('prev');
            } else {
              console.log(`   · ${route.slug}:prev 기간바 못 찾음(스킵)`);
            }
          } catch (e) {
            console.log(`   · ${route.slug}:prev 이동 실패(스킵): ${e.message.split('\n')[0]}`);
          }
        }
        // Stage 3 실증: 최하단 항목의 '…' 메뉴를 열어 포털/flip 이 클리핑을 막는지 검출
        if (route.openMenu) {
          try {
            const btns = page.locator('button[aria-label="할일 메뉴"]:visible');
            const n = await btns.count();
            if (n > 0) {
              const last = btns.last();
              await last.scrollIntoViewIfNeeded();
              await last.click({ timeout: 2000 });
              await page.waitForTimeout(400);
              await doShot('menu');
            } else {
              console.log(`   · ${route.slug}:menu 트리거 못 찾음(스킵)`);
            }
          } catch (e) {
            console.log(`   · ${route.slug}:menu 열기 실패(스킵): ${e.message.split('\n')[0]}`);
          }
        }
        // 일정 모달 태그 검증: 일정 편집 모달을 열어(editEvent 디스패치) 태그 선택 UI 를 스샷
        if (route.openEventModal) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await settle(page);
            const opened = await page.evaluate(() => {
              const d = new Date();
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              window.dispatchEvent(new CustomEvent('editEvent', {
                detail: {
                  id: 'e1', title: '팀 스탠드업', date: iso, startDate: iso, endDate: iso,
                  startTime: '09:30', endTime: '10:00', isAllDay: false, tags: ['tag-work'], color: '#C4A882',
                },
              }));
              return true;
            });
            if (opened) {
              await page.waitForTimeout(600);
              await doShot('eventmodal');
            }
          } catch (e) {
            console.log(`   · ${route.slug}:eventmodal 열기 실패(스킵): ${e.message.split('\n')[0]}`);
          }
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  // ── 리포트 저장 ──
  const summary = {
    generatedAt: new Date().toISOString(),
    totals: {
      shots: report.length,
      fail: report.filter((r) => r.verdict.status === 'FAIL').length,
      warn: report.filter((r) => r.verdict.status === 'WARN').length,
      pass: report.filter((r) => r.verdict.status === 'PASS').length,
    },
    results: report,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(summary, null, 2));

  console.log('\n── 요약 ───────────────────────────────');
  console.log(`  스크린샷 ${summary.totals.shots}장 → ${path.relative(ROOT, OUT)}/`);
  console.log(`  PASS ${summary.totals.pass} · WARN ${summary.totals.warn} · FAIL ${summary.totals.fail}`);
  console.log(`  리포트: ${path.relative(ROOT, path.join(OUT, 'report.json'))}`);

  if (summary.totals.fail > 0 && !process.argv.includes('--no-fail')) {
    console.log('\n✗ FAIL 항목이 있습니다.');
    process.exit(1);
  }
  console.log('\n✓ 완료');
}

main().catch((e) => {
  console.error('render:check 실패:', e);
  process.exit(1);
});
