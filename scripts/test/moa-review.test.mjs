import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'docs/screenshots/moamoa-navigation/after');
function runBuild(env) {
  return new Promise((resolve, reject) => {
    let log = '';
    const child = spawn(process.execPath, ['scripts/build-moa-review.mjs'], { cwd: root, env: { ...process.env, ...env } });
    child.stdout.on('data', data => log += data);
    child.stderr.on('data', data => log += data);
    child.on('error', reject);
    child.on('close', code => resolve({ code, log }));
  });
}

test('review build refuses Production and other Vercel branches', async () => {
  for (const env of [
    { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'codex/moamoa-review-preview' },
    { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main' },
  ]) {
    const result = await runBuild(env);
    assert.notEqual(result.code, 0);
    assert.match(result.log, /forbidden|Only the review branch/);
  }
});

test('static Preview uses isolated samples: routes, quick record, local photo, retry and reset', { timeout: 180000 }, async () => {
  const canary = 'MOA_REVIEW_SYNTHETIC_ENV_NOT_A_SECRET';
  const built = await runBuild({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'codex/moamoa-review-preview', VITE_SUPABASE_URL: `https://${canary}.invalid`, VITE_SUPABASE_ANON_KEY: canary });
  assert.equal(built.code, 0, built.log.slice(-2500));
  const dist = path.join(root, 'dist-review');
  const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
  assert.deepEqual(config.builds, [{ src: 'package.json', use: '@vercel/static-build', config: { distDir: 'dist-review' } }]);
  assert.equal(config.functions, undefined);
  const files = await readdir(dist);
  assert.ok(!files.includes('sw.js') && !files.includes('manifest.json'));
  for (const name of await readdir(path.join(dist, 'assets'))) {
    if (!/\.(js|css)$/.test(name)) continue;
    const text = await readFile(path.join(dist, 'assets', name), 'utf8');
    assert.ok(!text.includes(canary), `Vite environment leaked into ${name}`);
    assert.doesNotMatch(text, /supabaseUrl is required/);
    if (name.endsWith('.css')) assert.doesNotMatch(text, /@import\s*["']https?:/);
  }
  const headers = config.routes[0].headers;
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      let target = path.join(dist, pathname === '/' ? 'index.html' : pathname);
      if (pathname.startsWith('/api/')) { target = path.join(dist, 'review-disabled.json'); res.statusCode = 503; }
      let data;
      try { data = await readFile(target); } catch { target = path.join(dist, 'index.html'); data = await readFile(target); }
      for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
      res.setHeader('Content-Type', types[path.extname(target)] ?? 'text/html');
      res.end(data);
    } catch { res.statusCode = 500; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const outside = [], errors = [], requests = [], shots = [];
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.HAON_CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR', reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    page.on('request', req => requests.push({ url: req.url(), method: req.method() }));
    await page.route('**/*', route => {
      if (!route.request().url().startsWith(base)) { outside.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const nav = async name => {
      if (name === '음식') { await nav('기록'); await page.getByRole('navigation',{name:'기록 종류'}).getByRole('link',{name:'음식',exact:true}).click(); return; }
      const label = page.viewportSize().width < 768 ? '모바일 주요 메뉴' : '주요 메뉴';
      const link=page.getByRole('navigation', { name: label, exact:true }).getByRole('link', { name, exact: true });
      const href=await link.getAttribute('href');await link.click();
      await page.locator(`nav[aria-label="${label}"] a[aria-current="page"][href="${href}"]`).waitFor();
    };
    const capture = async name => {
      for (const [size, width, height] of [['mobile', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 1024]]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(100);
        if(name.endsWith('-bottom'))await page.locator('.mt-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
        assert.equal(await page.locator('#moa-review-banner').count(),0);
        assert.equal(await page.locator('nav[aria-label="주요 메뉴"]').isVisible(),width>=768);
        assert.equal(await page.locator('nav[aria-label="모바일 주요 메뉴"]').isVisible(),width<768);
        assert.equal(await page.getByRole('link',{name:/기존 홈|기존 음식 화면/}).count(),0);
        assert.equal(await page.locator('nav[aria-label="주요 메뉴"] a').count(),5);
        const docks=await page.locator('div.mt-root:not(.mt-sheet)').evaluateAll(els=>els.map(e=>getComputedStyle(e,'::after').content));
        assert.ok(docks.every(value=>value==='none'), 'no fixed backdrop dock');
        const scroll=await page.locator('.mt-scroll').boundingBox(), content=await page.locator('.mr-content').boundingBox();
        assert.ok(Math.abs(scroll.y+scroll.height-content.y-content.height)<2,'content uses full available height');
        assert.ok(Number(await page.locator('.mt-main').evaluate(e=>parseFloat(getComputedStyle(e).paddingBottom)))>=100);

        if(name.endsWith('-bottom')) {
          const last=await page.locator('.mt-main').evaluate(e=>{const node=[...e.children].reverse().find(v=>v.textContent.trim()&&v.getBoundingClientRect().height>0);return node.getBoundingClientRect().bottom;});
          assert.ok(last<=(await page.locator('.mt-quick').boundingBox()).y,'last content can scroll clear of the floating action');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${size}-${name}: horizontal overflow`);
        const heading = page.getByRole('dialog').locator('h2');
        if (await heading.count()) assert.ok((await heading.first().boundingBox()).y >= 0, `${size}-${name}: dialog title hidden behind banner`);
        await page.screenshot({ path: path.join(output, `${size}-${name}.png`) });
        shots.push(`${size}-${name}.png`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    };
    await mkdir(output, { recursive: true });
    await page.goto(base);
    await page.locator('.mt-greeting').waitFor();
    await page.locator('[data-goal-id]').first().waitFor();
    assert.equal(await page.evaluate(() => window.testDb.requests.length), 0, 'initial load must be read only');
    const goalBox = await page.locator('#mt-week-title').boundingBox();
    assert.ok(goalBox && goalBox.y >= 0 && goalBox.y + goalBox.height <= 844, 'weekly goals visible on mobile');
    await capture('today');
    await page.locator('.mt-quick').click();
    await page.locator('#mt-draft').fill('검토용 빠른 할 일');
    await capture('quick-todo');
    await page.getByRole('button', { name: '할 일 저장', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.testDb.tables.todos.filter(r => r.text === '검토용 빠른 할 일').length), 1);
    for (const [name, selector] of [['캘린더', '.rc-schedule'], ['할 일', '.mx-page-heading'], ['기록', '[data-activity-minutes]'], ['나의 정원', '[data-garden-xp]'], ['음식', '.mf-page']]) {
      await nav(name);
      await page.locator(selector).first().waitFor();
      await page.waitForTimeout(250);
      await capture({ '캘린더': 'calendar', '할 일': 'todos', '기록': 'records', '나의 정원': 'garden', '음식': 'food' }[name]);
    }
    await page.setViewportSize({width:1440,height:1024});
    await nav('캘린더');
    const currentUrl=page.url(), expandedWidth=(await page.locator('.mr-content').boundingBox()).width;
    await page.getByRole('button',{name:'사이드바 접기',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'사이드바 펼치기',exact:true}).getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('.mr-sidebar').evaluate(e=>Math.round(e.getBoundingClientRect().width)),76);
    assert.equal(page.url(),currentUrl);
    assert.ok((await page.locator('.mr-content').boundingBox()).width>expandedWidth+130);
    await nav('나의 정원');
    assert.equal(await page.getByRole('navigation',{name:'주요 메뉴',exact:true}).getByRole('link',{name:'나의 정원',exact:true}).getAttribute('aria-current'),'page');
    await page.screenshot({path:path.join(output,'desktop-sidebar-collapsed.png')});shots.push('desktop-sidebar-collapsed.png');
    await page.setViewportSize({width:768,height:1024});await page.screenshot({path:path.join(output,'tablet-sidebar-collapsed.png')});shots.push('tablet-sidebar-collapsed.png');await page.setViewportSize({width:1440,height:1024});
    const expand=page.getByRole('button',{name:'사이드바 펼치기',exact:true});await expand.focus();await page.keyboard.press('Space');
    assert.equal(await page.locator('.mr-sidebar').evaluate(e=>Math.round(e.getBoundingClientRect().width)),216);
    assert.equal(await page.locator('[data-garden-xp]').count(),1);
    await page.setViewportSize({width:390,height:844});
    await nav('캘린더');
    await page.getByRole('button',{name:'월간',exact:true}).click();await page.locator('.rc-month').waitFor();await capture('calendar-month');
    const chosenDate=await page.getByLabel('캘린더 날짜',{exact:true}).inputValue();
    await page.getByRole('button',{name:`${chosenDate} 일간 보기`,exact:true}).click();await page.getByRole('region',{name:'일간 일정',exact:true}).waitFor();await capture('calendar-day');
    await page.getByRole('button',{name:'주간',exact:true}).click();await page.getByRole('button',{name:'주간 플래너',exact:true}).click();
    await page.getByRole('region',{name:'요일별 할 일과 일정',exact:true}).waitFor();
    await capture('calendar-planner');
    assert.equal(await page.getByText('날짜 미정 연결 할 일',{exact:true}).count(),1);
    const initialProgress=await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress');
    const todo=page.locator('[data-todo-id="t1"] [role="checkbox"]');
    await todo.click();await page.locator('[data-todo-id="t1"] [role="checkbox"][aria-checked="true"]').waitFor();assert.equal(await todo.getAttribute('aria-checked'),'true');
    const newProgress=await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress');assert.notEqual(newProgress,initialProgress);
    await page.evaluate(()=>window.testDb.failNext('todos',{status:503}));
    await todo.click();await page.getByRole('button',{name:'재시도',exact:true}).waitFor();
    assert.equal(await todo.getAttribute('aria-checked'),'true');assert.equal(await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress'),newProgress);
    await page.getByRole('button',{name:'재시도',exact:true}).click();await page.locator('[data-todo-id="t1"] [role="checkbox"][aria-checked="false"]').waitFor();
    await todo.click();await page.locator('[data-todo-id="t1"] [role="checkbox"][aria-checked="true"]').waitFor();
    await capture('calendar-planner-bottom');
    await nav('오늘');assert.equal(await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress'),newProgress);
    await capture('today-bottom');
    assert.equal(await page.locator('[data-todo-id="t1"] [role="checkbox"]').getAttribute('aria-checked'),'true');
    await nav('할 일');assert.equal(await page.locator('[data-todo-id="t1"] [role="checkbox"]').getAttribute('aria-checked'),'true');
    await nav('나의 정원');assert.equal(await page.locator('[data-month-goal-id="m1"]').getAttribute('data-goal-progress'),newProgress);
    await page.getByText('작은 책방에서 하루 보내기',{exact:true}).waitFor();
    await capture('garden-bottom');
    for(const name of ['나의 정원','캘린더']) {
      await nav(name);await page.locator('.mt-quick').click();
      const form=page.getByRole('dialog',{name:'할 일 추가',exact:true});await form.getByLabel('할 일 제목',{exact:true}).fill(`${name} 빠른 기록 검증`);
      await capture(name==='캘린더'?'calendar-quick':'garden-quick');
      await form.getByRole('button',{name:'저장',exact:true}).click();await form.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(name=>window.testDb.tables.todos.filter(t=>t.text===`${name} 빠른 기록 검증`).length,name),1);
    }
    await nav('캘린더');await page.getByRole('button',{name:'주간 플래너',exact:true}).click();
    await page.getByRole('button',{name:'주간 회고 열기',exact:true}).click();await page.getByRole('dialog',{name:'주간 회고',exact:true}).waitFor();
    await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
    await page.getByRole('button',{name:'주간 일정',exact:true}).click();
    await page.locator('.rc-schedule').waitFor();
    await page.getByRole('button',{name:'이전 기간',exact:true}).click();await page.getByRole('button',{name:'다음 기간',exact:true}).click();
    assert.equal(await page.getByLabel('캘린더 날짜',{exact:true}).inputValue(),chosenDate);
    await nav('음식');
    await nav('기록');await page.getByRole('navigation',{name:'기록 종류'}).getByRole('link',{name:'문화·음악',exact:true}).click();
    await page.getByRole('heading',{name:'문화·음악',exact:true}).waitFor();assert.equal(await page.locator('.mr-placeholder').count(),1);
    await nav('음식');
    await page.getByRole('button', { name: '음식 기록', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '음식 기록 추가', exact: true });
    const [camera] = await Promise.all([page.waitForEvent('filechooser'), editor.getByRole('button', { name: '사진 촬영', exact: true }).click()]);
    assert.equal(await camera.element().getAttribute('accept'), 'image/*');
    assert.equal(await camera.element().getAttribute('capture'), 'environment');
    await camera.setFiles([]);
    const [album] = await Promise.all([page.waitForEvent('filechooser'), editor.getByRole('button', { name: '앨범에서 선택', exact: true }).click()]);
    assert.equal(await album.element().getAttribute('capture'), null);
    await album.setFiles(path.join(root, 'scripts/test/fixtures/food/meal-b.png'));
    await editor.locator('img').waitFor();
    await editor.getByLabel('음식명', { exact: true }).fill('샘플 사진과 음식');
    assert.equal(await editor.getByRole('button', { name: 'AI 칼로리 제안', exact: true }).isDisabled(), true);
    await capture('camera-album-preview');
    await page.evaluate(() => window.testDb.failNextStorage('upload', { status: 503 }));
    await editor.getByRole('button', { name: '저장', exact: true }).click();
    await editor.getByRole('button', { name: '재시도', exact: true }).waitFor();
    assert.equal(await editor.getByLabel('음식명', { exact: true }).inputValue(), '샘플 사진과 음식');
    await capture('photo-retry');
    await editor.getByRole('button', { name: '재시도', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    const saved = await page.evaluate(() => window.testDb.tables.food_records.filter(r => r.food_name === '샘플 사진과 음식'));
    assert.equal(saved.length, 1);
    assert.match(saved[0].photo_url, /^blob:/);
    const image = page.locator(`[data-food-id="${saved[0].id}"] img`);
    await image.waitFor();
    await page.waitForFunction(id => document.querySelector(`[data-food-id="${id}"] img`)?.naturalWidth > 0, saved[0].id);
    await nav('오늘'); await nav('음식'); await image.waitFor();
    await nav('기록');
    const before = Number(await page.locator('[data-activity-minutes]').getAttribute('data-activity-minutes'));
    await page.locator('.mt-quick').click();
    await page.getByLabel('활동명', { exact: true }).fill('샘플 산책');
    await capture('activity-entry');
    await page.getByRole('button', { name: '15분', exact: true }).click();
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(Number(await page.locator('[data-activity-minutes]').getAttribute('data-activity-minutes')), before + 15);
    await page.getByRole('button', { name: '주간', exact: true }).click();
    await page.getByRole('button', { name: '월간', exact: true }).click();
    assert.equal(await page.evaluate(async () => (await fetch('/api/food-calorie')).status), 503);
    assert.ok(!requests.some(r => r.method !== 'GET' || r.url.includes('/api/') || r.url.includes('/storage/')), 'no DB, Storage or API request may leave the page');
    await page.getByRole('button', { name: '샘플 초기화', exact: true }).click();
    await page.locator('[data-activity-minutes]').waitFor();
    assert.equal(await page.evaluate(() => window.testDb.tables.activity_entries.some(r => r.name === '샘플 산책')), false);
    assert.equal(await page.evaluate(() => window.testDb.tables.todos.some(r => r.text === '검토용 빠른 할 일')), false);
    assert.equal(await page.evaluate(() => window.testDb.tables.food_records.some(r => r.food_name === '샘플 사진과 음식')), false);
    assert.deepEqual(outside, []);
    assert.deepEqual(errors, []);
    await writeFile(path.join(output, 'validation.json'), JSON.stringify({ viewports: [390, 768, 1440], shots, errors, outside, sampleReset: true, localPhotoRetry: true, unifiedNavigation: true, sidebarKeyboardToggle: true, sharedCalendarCompletionAndRetry: true, noFixedDock: true, bottomContentReachable: true, transport: 'memory only; no network DB/Storage/API', physicalIphone: 'not tested' }, null, 2) + '\n');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
