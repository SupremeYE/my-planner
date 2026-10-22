// Actual App -> Auth -> PlannerProvider -> dev route. Only Supabase transport is substituted.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'docs/screenshots/moamoa-today');
import { tables } from './fixtures/moa-today-data.mjs';

test('Moa Today: real Auth/Provider, confirmed persistence and responsive rendering', { timeout: 240000 }, async t => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'moa-today-'));
  const port = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const n = socket.address().port; socket.close(() => resolve(n)); }); });
  const server = await createServer({ root, cacheDir, logLevel: 'error', plugins: [{ name: 'isolated-today-transport', enforce: 'pre',
    resolveId(source) { if (/(?:^\.\/supabase|\/lib\/supabase)$/.test(source)) return path.join(root, 'scripts/test/fixtures/moa-today-supabase.ts'); },
    transform(code, id) { if (id.endsWith('/src/app/store.tsx')) return code.replace('return ctx;', 'window.__testPlanner = ctx; return ctx;'); },
  }], server: { host: '127.0.0.1', port, strictPort: true } });
  let browser;
  const external = [], errors = [], modules = new Set(), audit = [];
  try {
    await server.listen(); const base = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ executablePath: process.env.HAON_CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ timezoneId: 'Asia/Seoul', serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => { const url = route.request().url(); if (!url.startsWith(base)) { external.push(url); return route.abort(); } modules.add(new URL(url).pathname); return route.continue(); });
    const open = async (fixture = { tables }, viewport = { width: 390, height: 844 }) => {
      const page = await context.newPage(); page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(60000); page.on('pageerror', e => errors.push(e.message));
      await page.setViewportSize(viewport); await page.clock.install({ time: new Date('2027-01-01T12:00:00+09:00') });
      await page.addInitScript(value => { window.__moaFixture = value; }, fixture);
      await page.goto(`${base}/__moamoa-today`); return page;
    };
    await mkdir(output, { recursive: true });
    const page = await open();
    await page.locator('[data-goal-id="w1"]').waitFor();
    const check = () => page.getByRole('checkbox', { name: `${tables.todos[0].text} 완료`, exact: true });
    const quick = () => page.getByRole('button', { name: '빠른 기록', exact: true });
    const input = () => page.getByLabel('무엇을 모아볼까요?', { exact: true });
    const retry = () => page.getByRole('dialog').getByRole('button', { name: '재시도', exact: true });
    await t.test('real data projection, common goal progress, ISO compatibility, recurring plan and actual-only time', async () => {
      assert.equal(await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress'), '33');
      assert.equal(await page.locator('[data-goal-id="w2"]').getAttribute('data-goal-progress'), '100');
      assert.equal(await page.locator('[data-todo-id]').count(), 3);
      assert.equal(await page.locator('.mt-duration').getAttribute('data-recorded-minutes'), '45');
      assert.match(await page.locator('.mt-time').innerText(), /미분류 15분/);
      assert.match(await page.locator('.mt-event').first().innerText(), /반복되는 아침 일정/);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), 0);
      assert.equal(await page.locator('time[datetime]').getAttribute('datetime'), '2027-01-01');
    });
    await t.test('390px/1440px real rendered home, weekly visibility, readable targets and no overflow', async () => {
      for (const [name, width, height] of [['mobile-today', 390, 844], ['desktop-today', 1440, 1024]]) {
        await page.setViewportSize({ width, height }); await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('.mt-greeting h1').innerText(), '오늘도, 힘내자!');
        assert.equal(await page.locator('.mt-greeting > div > p').last().innerText(), '작은 일부터 하나씩.');
        const menu = page.getByRole('navigation', { name: width === 390 ? '모바일 주요 메뉴' : '바로가기' });
        assert.deepEqual(await menu.getByRole('link').allTextContents(), ['오늘', '캘린더', '할 일', '기록', '나의 정원']);
        if (width === 390) {
          const title = await page.locator('.mt-greeting h1').boundingBox();
          const buddy = await page.locator('.mt-greeting .mo-buddy').boundingBox();
          const line = await page.locator('.mt-greeting h1').evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
          assert.ok(title.height <= line + 1, 'Mobile greeting stays on one line');
          assert.ok(title.x + title.width <= buddy.x, 'Greeting and buddy do not overlap');
        }
        const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth,
          scroll: document.querySelector('.mt-scroll').scrollWidth, client: document.querySelector('.mt-scroll').clientWidth,
          overflowing: [...document.querySelectorAll('.mt-card,.mt-todo')].filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.className) }));
        assert.equal(dimensions.document, width); assert.ok(dimensions.scroll <= dimensions.client + 1); assert.deepEqual(dimensions.overflowing, []);
        const dock = await quick().boundingBox();
        const scroll = await page.locator('.mt-scroll').boundingBox();
        assert.ok(scroll.y + scroll.height <= dock.y, 'Scroll content ends above the fixed record action');
        const goalBox = await page.locator('.mt-week').boundingBox(); assert.ok(goalBox.y + goalBox.height < height, 'Weekly card visible on first screen');
        const targets = await page.locator('.mt-check').evaluateAll(els => els.map(el => ({ width: el.offsetWidth, height: el.offsetHeight })));
        assert.ok(targets.every(b => b.width >= 44 && b.height >= 44));
        await page.screenshot({ path: path.join(output, `${name}.png`) }); audit.push({ name, ...dimensions });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.mt-time').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, 'mobile-time-and-review.png') });
      await page.evaluate(() => document.querySelector('.mt-scroll').scrollTo(0, 0));
    });
    await t.test('pending completion, rapid clicks, failed save, explicit retry and refresh share confirmed data', async () => {
      const before = await page.evaluate(() => window.testDb.requests.length);
      await page.evaluate(() => window.testDb.hold('todos')); await check().evaluate(el => { el.click(); el.click(); });
      await page.waitForFunction(() => window.__testPlanner.saveStates.some(s => s.status === 'saving'));
      assert.equal(await check().getAttribute('aria-checked'), 'false'); assert.equal(await check().isDisabled(), true);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), before + 1);
      await page.evaluate(() => window.testDb.release('todos'));
      await page.waitForFunction(() => window.__testPlanner.todos.find(t => t.id === 't1').status === 'done');
      assert.equal(await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress'), '67');
      await page.evaluate(() => window.testDb.failNext('todos', { status: 503 })); await check().click();
      await page.getByRole('alert').waitFor(); assert.equal(await check().getAttribute('aria-checked'), 'true');
      await page.screenshot({ path: path.join(output, 'mobile-completion-failure.png') });
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.__testPlanner.todos.find(t => t.id === 't1').status === 'active');
      assert.equal(await check().getAttribute('aria-checked'), 'false');
    });
    await t.test('quick TODO draft retained on close and failure; acknowledgement loss retries one identity', async () => {
      await quick().click(); await input().fill('제목만 적어서 새 할 일 저장');
      await page.getByRole('button', { name: '빠른 기록 닫기' }).click(); await quick().click();
      assert.equal(await input().inputValue(), '제목만 적어서 새 할 일 저장');
      await page.screenshot({ path: path.join(output, 'mobile-quick-todo.png') });
      await page.evaluate(() => window.testDb.failNext('todos', { status: 0, afterCommit: true }));
      await page.getByRole('button', { name: '할 일 저장', exact: true }).click();
      await retry().waitFor(); assert.equal(await input().inputValue(), '제목만 적어서 새 할 일 저장');
      assert.equal(await input().getAttribute('readonly'), '');
      await page.screenshot({ path: path.join(output, 'mobile-quick-failure.png') });
      // Keyboard retry remains inside Radix focus scope, not behind the modal.
      await retry().focus(); await page.keyboard.press('Enter');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const saved = await page.evaluate(() => window.testDb.tables.todos.filter(t => t.text === '제목만 적어서 새 할 일 저장'));
      assert.equal(saved.length, 1); assert.equal(saved[0].date, '2027-01-01'); assert.equal(saved[0].is_top3, false);
      await page.evaluate(() => window.testDb.emit('todos'));
      assert.equal(await page.locator('[data-todo-id]').count(), 3);
      // Actual browser reload receives the persisted isolated rows, not optimistic local UI.
      const persisted = await page.evaluate(() => window.testDb.tables);
      await page.addInitScript(value => { window.__moaFixture = { tables: value }; }, persisted);
      await page.reload(); await page.locator('[data-goal-id="w1"]').waitFor();
      assert.equal(await page.evaluate(() => window.__testPlanner.todos.filter(t => t.text === '제목만 적어서 새 할 일 저장').length), 1);
      assert.equal(await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress'), '33');
    });
    await t.test('quick creation is pending until confirmed; rapid submits write once and permanent rejection has no retry', async () => {
      await quick().click(); await input().fill('한 번만 만드는 할 일');
      const before = await page.evaluate(() => window.testDb.requests.length);
      await page.evaluate(() => window.testDb.hold('todos'));
      await page.getByRole('dialog').locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await page.getByRole('dialog').getByRole('button', { name: '저장 중…', exact: true }).waitFor();
      assert.equal(await input().inputValue(), '한 번만 만드는 할 일');
      assert.equal(await page.evaluate(() => window.__testPlanner.todos.some(t => t.text === '한 번만 만드는 할 일')), false);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), before + 1);
      await page.evaluate(() => window.testDb.release('todos')); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await quick().click(); await input().fill('권한 오류에서도 보존할 초안');
      await page.evaluate(() => window.testDb.failNext('todos', { status: 403, code: '42501' }));
      await page.getByRole('button', { name: '할 일 저장', exact: true }).click();
      await page.getByRole('dialog').getByRole('alert').waitFor();
      assert.equal(await retry().count(), 0); assert.equal(await input().inputValue(), '권한 오류에서도 보존할 초안');
      await page.getByRole('dialog').getByRole('button', { name: '저장 알림 닫기' }).click();
      await input().fill('권한 확인 뒤 수정한 초안');
      await page.getByRole('button', { name: '할 일 저장', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    });
    await t.test('recurring TODO completion uses one persisted exception and date navigation changes instances', async () => {
      const row = page.locator('[data-todo-id="repeat::2027-01-01"]');
      await row.getByRole('checkbox').click(); await page.waitForFunction(() => window.__testPlanner.todos.some(t => t.recurrenceParentId === 'repeat'));
      assert.equal(await page.evaluate(() => window.testDb.tables.todos.filter(t => t.recurrence_parent_id === 'repeat').length), 1);
      await page.getByRole('button', { name: '다음 날짜', exact: true }).click();
      assert.equal(await page.locator('[data-todo-id="repeat::2027-01-02"]').count(), 1);
      assert.equal(await page.locator('.mt-event').count(), 1); assert.equal(await page.locator('.mt-duration').getAttribute('data-recorded-minutes'), '0');
      await page.getByRole('button', { name: '오늘', exact: true }).click();
      assert.equal(await page.locator('[data-todo-id]').getByRole('checkbox', { checked: true }).count(), 2);
      await page.getByRole('button', { name: '하루 회고 열기' }).click();
      await page.getByText('🙏 감사한 것', { exact: true }).first().waitFor();
      // Entry only: legacy review persistence is intentionally unchanged in this step.
      await page.getByRole('button', { name: '닫기', exact: true }).last().click();
      await page.getByText('🙏 감사한 것', { exact: true }).waitFor({ state: 'hidden' });
    });
    await t.test('offline is explicitly unsaved and reconnection requires manual retry', async () => {
      await context.setOffline(true); await page.getByText(/오프라인이에요\. 새 기록/).waitFor();
      await page.screenshot({ path: path.join(output, 'mobile-offline.png') });
      await quick().click(); await input().fill('오프라인 초안');
      const count = await page.evaluate(() => window.testDb.requests.length);
      await page.getByRole('button', { name: '할 일 저장', exact: true }).click(); await retry().waitFor();
      assert.equal(await page.evaluate(() => window.testDb.requests.length), count);
      await context.setOffline(false); assert.equal(await page.evaluate(() => window.testDb.requests.length), count);
      await retry().click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    });
    await t.test('logical date follows settings and updates after midnight / focus', async () => {
      await page.clock.setSystemTime(new Date('2027-01-02T01:59:00+09:00')); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      assert.equal(await page.locator('time[datetime]').getAttribute('datetime'), '2027-01-01');
      await page.clock.setSystemTime(new Date('2027-01-02T02:01:00+09:00')); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => document.querySelector('time[datetime]').getAttribute('datetime') === '2027-01-02');
    });
    await page.close();
    await t.test('loading, empty and long titles render without fake records or overflow', async () => {
      const loading = await open({ tables: {}, delay: 1200 });
      await loading.getByRole('heading', { name: '나의 하루를 불러오고 있어요' }).waitFor();
      await loading.screenshot({ path: path.join(output, 'mobile-loading.png') });
      await loading.getByText('이번 주 목표를 하나 정해볼까요?').waitFor();
      assert.equal(await loading.locator('[data-todo-id]').count(), 0); assert.equal(await loading.locator('.mt-duration').innerText(), '0분');
      await loading.screenshot({ path: path.join(output, 'mobile-empty.png') }); await loading.close();
      const long = structuredClone(tables); long.todos[0].text = '아주긴제목'.repeat(45); long.weekly_goals[0].text = '긴 목표 제목 '.repeat(20);
      const longPage = await open({ tables: long }); await longPage.locator('[data-goal-id="w1"]').waitFor();
      assert.equal(await longPage.evaluate(() => document.documentElement.scrollWidth), 390);
      assert.ok(await longPage.locator('.mt-todo').first().evaluate(el => el.scrollWidth <= el.clientWidth));
      const box = await longPage.locator('.mt-week').boundingBox(); assert.ok(box.y + box.height < 844, 'Long goals remain compact above the fold');
      await longPage.getByRole('button', { name: /목표 자세히 보기/ }).click(); assert.equal(await longPage.getByRole('button', { name: '목표 간단히 보기' }).getAttribute('aria-expanded'), 'true');
      await longPage.screenshot({ path: path.join(output, 'mobile-long-titles.png') }); await longPage.close();
    });
    await t.test('same production auth gate and original home remain intact; product does not import prototype samples', async () => {
      const signedOut = await open({ tables, signedOut: true });
      await signedOut.getByRole('button', { name: '로그인', exact: true }).waitFor();
      assert.equal(await signedOut.locator('.mt-main').count(), 0); assert.equal(await signedOut.evaluate(() => window.testDb.reads.length), 0);
      await signedOut.close();
      assert.ok(![...modules].some(url => /src\/prototypes\/moamoa\/(sample|PrototypeState)/.test(url)));
      assert.ok(external.every(url => /^https:\/\/(fonts.googleapis.com|fonts.gstatic.com|cdn.jsdelivr.net)\//.test(url)), 'Only pre-existing font styles may attempt external access; all are aborted'); assert.deepEqual(errors, []);
    });
    await writeFile(path.join(output, 'validation.json'), JSON.stringify({ fixture: 'Isolated memory transport; Asia/Seoul 2027-01-01 ISO boundary', audit, errors, external }, null, 2));
  } finally { await browser?.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
});
