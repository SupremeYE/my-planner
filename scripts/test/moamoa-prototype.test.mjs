// Actual dev-only entry and interactions. No mocked production entry or external backend is loaded.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'docs/prototypes/moamoa');

test('MoaMoa development prototype: responsive views, shared data and isolated interactions', { timeout: 120000 }, async t => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'moamoa-prototype-'));
  const port = await new Promise(resolve => {
    const reservation = net.createServer(); reservation.listen(0, '127.0.0.1', () => {
      const port = reservation.address().port; reservation.close(() => resolve(port));
    });
  });
  const server = await createServer({ root, cacheDir, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
  let browser;
  const audit = [];
  const errors = [];
  const external = [];
  const modules = new Set();
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.HAON_CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = route.request().url();
      if (!url.startsWith(base)) { external.push(url); return route.abort(); }
      modules.add(new URL(url).pathname); return route.continue();
    });
    context.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(8000); });
    await mkdir(output, { recursive: true });
    const snapshots = [
      ['mobile-today', 390, 844, ''],
      ['desktop-today', 1440, 1140, ''],
      ['desktop-week-schedule', 1440, 1140, '?screen=calendar&period=week&view=schedule'],
      ['desktop-week-planner', 1440, 1140, '?screen=calendar&period=week&view=planner'],
      ['mobile-week-planner', 390, 844, '?screen=calendar&period=week&view=planner'],
      ['mobile-quests', 390, 844, '?screen=quests'],
      ['mobile-records', 390, 844, '?screen=records'],
      ['desktop-garden', 1440, 1140, '?screen=garden'],
      ['mobile-month', 390, 844, '?screen=calendar&period=month'],
      ['mobile-day', 390, 844, '?screen=calendar&period=day'],
      ['mobile-week-schedule', 390, 844, '?screen=calendar&period=week&view=schedule'],
      ['mobile-garden', 390, 844, '?screen=garden'],
      ['desktop-quests', 1440, 1140, '?screen=quests'],
      ['desktop-records', 1440, 1140, '?screen=records'],
    ];
    await t.test('required layouts render at 1440px/390px without horizontal overflow', async () => {
      for (const [name, width, height, query] of snapshots) {
        const page = await context.newPage(); await page.setViewportSize({ width, height });
        await page.goto(`${base}/__moamoa/${query}`); await page.locator('.mo-page h1').waitFor();
        const dimensions = await page.evaluate(() => {
          const main = document.querySelector('.mo-main');
          const overflows = Array.from(document.querySelectorAll('.mo-card, .mo-todo-row, .mo-calendar-toolbar, .mo-dialog')).filter(el => el.clientWidth && el.scrollWidth > el.clientWidth + 2).map(el => el.className);
          return { document: document.documentElement.scrollWidth, main: main.scrollWidth, viewport: innerWidth, mainWidth: main.clientWidth, overflows };
        });
        assert.equal(dimensions.document, width, name);
        assert.ok(dimensions.main <= dimensions.mainWidth + 1, `${name} main overflow`);
        assert.deepEqual(dimensions.overflows, [], name);
        if (name === 'mobile-today') {
          const bounds = await page.locator('.mo-week-card').boundingBox();
          assert.ok(bounds.y + bounds.height < height - 65, 'Weekly goals visible without scrolling');
          assert.equal(await page.locator('.mo-today-quests [data-todo-id]').count(), 3);
          assert.ok(await page.locator('.mo-mobile-essentials').isVisible());
        }
        await page.screenshot({ path: path.join(output, `${name}.png`) });
        audit.push({ screen: name, width, height, ...dimensions });
        if (name === 'mobile-week-planner') {
          await page.locator('.mo-habits-card').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, 'mobile-week-planner-habits.png') });
          const targets = await page.locator('.mo-habit-row button').evaluateAll(els => els.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
          assert.ok(targets.every(target => target.width >= 43 && target.height >= 44), 'Mobile habits have touch-sized cells');
        }
        await page.close();
      }
    });
    const page = await context.newPage(); await page.setViewportSize({ width: 390, height: 844 });
    const go = async screen => { await page.locator(`.mo-bottom-nav [data-nav="${screen}"]`).click(); };
    const todoCheck = () => page.getByRole('checkbox', { name: '모아모아 홈 아이디어 정리 완료', exact: true });
    await page.goto(`${base}/__moamoa/`); await page.locator('.mo-week-card').waitFor();
    await t.test('one TODO updates Today, Quests and weekly planner through the same shared progress calculation', async () => {
      assert.equal(await page.getByTestId('home-progress').innerText(), '33%');
      await todoCheck().click();
      assert.equal(await todoCheck().getAttribute('aria-checked'), 'false');
      await page.getByRole('status').filter({ hasText: '작은 한 걸음' }).waitFor();
      assert.equal(await todoCheck().getAttribute('aria-checked'), 'true');
      assert.equal(await page.locator('[data-goal-id="week-work"]').getAttribute('data-goal-progress'), '50');
      await go('quests'); assert.equal(await todoCheck().getAttribute('aria-checked'), 'true');
      await go('calendar'); await page.getByRole('button', { name: '주간 플래너', exact: true }).click();
      assert.equal(await todoCheck().getAttribute('aria-checked'), 'true');
      assert.equal(await page.locator('[data-goal-id="week-work"]').getAttribute('data-goal-progress'), '50');
      const bounds = await todoCheck().boundingBox();
      assert.ok(bounds.width >= 44 && bounds.height >= 44);
    });
    await t.test('quick record is a focus-trapped bottom sheet; a title is the only required TODO field', async () => {
      await page.getByRole('button', { name: '빠른 기록 열기' }).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      await dialog.getByPlaceholder('어떤 작은 일을 모아볼까요?').fill('샘플 한 조각');
      await page.screenshot({ path: path.join(output, 'mobile-quick-todo.png') });
      await dialog.getByRole('button', { name: '할 일 모아두기', exact: true }).dblclick();
      await dialog.waitFor({ state: 'hidden' });
      await go('quests'); assert.equal(await page.getByRole('checkbox', { name: '샘플 한 조각 완료', exact: true }).count(), 1);
      await page.getByRole('button', { name: '빠른 기록 열기' }).click();
      await page.keyboard.press('Tab');
      assert.ok(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement)));
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '빠른 기록 열기');
    });
    await t.test('time records use existing TODO blocks; independent activity is explicitly unavailable', async () => {
      await page.getByRole('button', { name: '빠른 기록 열기' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: '시간', exact: true }).click();
      const submitBounds = await dialog.getByRole('button', { name: '30분 모아두기', exact: true }).boundingBox();
      assert.ok(submitBounds.y >= 0 && submitBounds.y + submitBounds.height <= 844, 'Quick time submit stays visible');
      await page.screenshot({ path: path.join(output, 'mobile-quick-record.png') });
      await dialog.getByRole('button', { name: /독립 활동/ }).click();
      assert.equal(await dialog.getByRole('button', { name: '독립 활동은 후속 설계예요', exact: true }).isDisabled(), true);
      assert.ok(await dialog.getByText('독립 활동은 저장되지 않아요.', { exact: false }).isVisible());
      await dialog.getByRole('button', { name: '할 일에 연결', exact: true }).click();
      await dialog.getByRole('button', { name: '30분 모아두기', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await go('today'); assert.equal(await page.getByTestId('today-actual-time').innerText(), '2시간 35분');
      await go('records'); assert.equal(await page.getByTestId('records-actual-time').innerText(), '2시간 35분');
      await page.getByRole('button', { name: '주간', exact: true }).click();
      assert.equal(await page.getByTestId('records-actual-time').innerText(), '3시간');
      await page.getByRole('button', { name: '월간', exact: true }).click();
      assert.equal(await page.getByTestId('records-actual-time').innerText(), '3시간');
    });
    await t.test('failed confirmation preserves the draft and old state; explicit retry cannot create a second TODO', async () => {
      await page.getByRole('button', { name: /새로고침하면 처음으로/ }).click();
      await page.getByRole('button', { name: '다음 반영 실패 시연', exact: true }).click();
      await page.getByRole('button', { name: '빠른 기록 열기' }).click();
      const input = page.getByPlaceholder('어떤 작은 일을 모아볼까요?'); await input.fill('재시도해도 한 조각');
      await page.getByRole('button', { name: '할 일 모아두기', exact: true }).click();
      await page.getByRole('alert').waitFor(); assert.equal(await input.inputValue(), '재시도해도 한 조각');
      await page.screenshot({ path: path.join(output, 'mobile-save-failure.png') });
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.getByRole('button', { name: '완료 · 시트 닫기', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await go('quests'); assert.equal(await page.getByRole('checkbox', { name: '재시도해도 한 조각 완료', exact: true }).count(), 1);
    });
    await t.test('moving a plan changes only its date and plan time; actual time stays unchanged', async () => {
      await go('today'); await page.getByRole('button', { name: /10:30.*팀 체크인/ }).click();
      assert.equal(await page.getByLabel('날짜', { exact: true }).isDisabled(), true);
      await page.keyboard.press('Escape');
      await go('quests');
      await page.getByRole('button', { name: '모아모아 홈 아이디어 정리 계획 편집', exact: true }).click();
      await page.getByLabel('날짜', { exact: true }).fill('2026-10-21');
      await page.getByLabel('계획 시작', { exact: true }).fill('11:30');
      await page.getByLabel('계획 종료', { exact: true }).fill('12:30');
      await page.getByRole('button', { name: '계획 옮기기', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await go('today'); assert.equal(await page.getByTestId('today-actual-time').innerText(), '2시간 35분');
      await go('calendar'); await page.getByRole('button', { name: '주간 일정', exact: true }).click();
      await page.setViewportSize({ width: 1440, height: 1140 });
      assert.ok(await page.getByRole('button', { name: /11:30.*모아모아 홈 아이디어 정리/ }).isVisible());
    });
    await t.test('month/day navigation, habit checks and review entry work without creating backend traffic', async () => {
      await page.getByRole('button', { name: '월간', exact: true }).click();
      await page.getByRole('button', { name: '2026-10-20 일간 보기', exact: true }).click();
      assert.equal(await page.locator('.mo-time-day').count(), 1);
      await page.getByRole('button', { name: '주간', exact: true }).click();
      await page.getByRole('button', { name: '주간 플래너', exact: true }).click();
      const habit = page.getByRole('button', { name: '책 펼치기 2026-10-20', exact: true });
      await habit.click(); await page.getByRole('status').filter({ hasText: '나를 챙긴 순간' }).waitFor();
      assert.equal(await habit.getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: /이번 주, 어떤 순간을 모았나요/ }).click();
      await page.getByRole('textbox').fill('비어 있는 시간도 소중했던 한 주.');
      await page.getByRole('button', { name: '작은 기록 남기기', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.locator('.mo-sidebar [data-nav="garden"]').click();
      const seed = page.getByRole('button', { name: /작은 책방에서 하루 보내기/ });
      await seed.click(); await page.getByRole('status').filter({ hasText: '언젠가의 작은 씨앗' }).waitFor();
      await page.locator('.mo-sidebar [data-nav="today"]').click();
      await page.locator('.mo-sidebar [data-nav="garden"]').click();
      assert.equal(await seed.getAttribute('aria-pressed'), 'true');
    });
    await t.test('refresh resets only the sample; the product application and Supabase were never imported', async () => {
      await page.goto(`${base}/__moamoa/`); await page.locator('.mo-week-card').waitFor();
      assert.equal(await page.getByTestId('home-progress').innerText(), '33%');
      assert.equal(await page.getByTestId('today-actual-time').innerText(), '2시간 5분');
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
      assert.ok(![...modules].some(url => /\/src\/(?:lib\/(?:supabase|db)|app\/(?:App|AuthContext|store))\./.test(url)), 'No product bootstrap or backend module loaded');
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    });
    await writeFile(path.join(output, 'validation.json'), JSON.stringify({ date: new Date().toISOString(), externalRequests: external.length, runtimeErrors: errors, interactionScreenshots: ['mobile-quick-todo.png', 'mobile-quick-record.png', 'mobile-week-planner-habits.png', 'mobile-save-failure.png'], screens: audit }, null, 2) + '\n');
  } finally { await browser?.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
});
