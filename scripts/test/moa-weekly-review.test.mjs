import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { tables as baseTables } from './fixtures/moa-today-data.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'docs/screenshots/moamoa-weekly-review');
const fields = ['기억하고 싶은 일', '잘한 점 · KEEP', '아쉬웠던 점 · NOTICE', '다음에 시도할 점 · TRY', '다음 주 계획 · NEXT'];
const legacy = { id: 'legacy-week', week_key: '2027-W53', highlights: '가족과 함께 걸었던 겨울 산책', kpt_keep: '아침에 물 한 잔', notice: '쉬는 시간도 필요했다', kpt_try: '잠들기 전 휴대폰 내려놓기', next_week: '책 한 권 천천히 읽기', preserved_extra: '원본 보존' };
const tables = { ...structuredClone(baseTables), habits: [{ id: 'habit', name: '가벼운 스트레칭', checked_dates: ['2026-12-29', '2027-01-01'], habit_type: 'check' }],
  weekly_reviews: [legacy, { ...legacy, id: 'one-digit', week_key: '2026-W1', highlights: '지난해 첫 주 기억' }] };

test('Weekly review: isolated confirmed writes, history, Realtime, errors and responsive editor', { timeout: 240000 }, async t => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'moa-weekly-'));
  const server = await createServer({ root, cacheDir, logLevel: 'error', plugins: [{ name: 'isolated-weekly-review', enforce: 'pre',
    resolveId(source) { if (/(?:^\.\/supabase|\/lib\/supabase)$/.test(source)) return path.join(root, 'scripts/test/fixtures/moa-today-supabase.ts'); },
    transform(code, id) { if (id.endsWith('/src/app/hooks/useWeeklyReviews.ts')) return code.replace('return { records, loading,', 'window.__weeklyDebug = { records, loading, readError }; return { records, loading,'); },
    transformIndexHtml() { return [{ tag: 'div', attrs: { style: 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:30000;background:#354235;color:white;padding:2px 8px;font-size:10px;pointer-events:none;white-space:nowrap' }, children: '격리 검증 · 메모리 회고 · 운영 연결 없음', injectTo: 'body' }]; },
  }], server: { host: '127.0.0.1', port: 0 } });
  let browser; const errors = [], external = [], audit = [];
  try {
    await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.HAON_CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ timezoneId: 'Asia/Seoul', locale: 'ko-KR', serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== base || url.pathname.startsWith('/api/') || url.pathname.includes('/storage/')) { external.push(url.href); return route.abort(); } return route.continue(); });
    async function open(fixture = { tables }) {
      const page = await context.newPage(); page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(60000);
      await page.setViewportSize({ width: 1440, height: 1024 });
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2027-01-01T12:00:00+09:00') });
      await page.addInitScript(value => { window.__moaFixture = value; }, fixture);
      await page.goto(`${base}/__moamoa-weekly`);
      await page.getByRole('heading', { name: '주간 플래너', exact: true }).waitFor();
      await page.waitForFunction(() => window.__weeklyDebug && !window.__weeklyDebug.loading);
      return page;
    }
    const page = await open(); await mkdir(output, { recursive: true });
    const dialog = () => page.getByRole('dialog', { name: '주간 회고', exact: true });
    const input = index => dialog().getByLabel(fields[index], { exact: true });
    const launch = async () => { await page.getByRole('button', { name: '주간 회고', exact: true }).click(); await dialog().waitFor(); };
    const save = async () => { await dialog().getByRole('button', { name: '저장', exact: true }).click(); await dialog().waitFor({ state: 'hidden' }); };
    const writes = () => page.evaluate(() => window.testDb.requests.filter(r => r.table === 'weekly_reviews'));

    await t.test('legacy view, selected Mon–Sun period, unchanged goal/actual/habit reference', async () => {
      assert.match(await page.locator('time').innerText(), /2026.12.28.*2027.01.03/);
      assert.equal(await page.locator('[data-actual-minutes]').getAttribute('data-actual-minutes'), '45');
      assert.equal(await page.locator('[data-completed-todos]').getAttribute('data-completed-todos'), '1');
      assert.deepEqual(await page.locator('[data-goal-progress]').evaluateAll(els => els.map(el => el.getAttribute('data-goal-progress'))), ['33', '100']);
      assert.match(await page.locator('.mw-stats').innerText(), /2일 체크/);
      await launch(); for (let i = 0; i < fields.length; i++) assert.equal(await input(i).inputValue(), legacy[['highlights', 'kpt_keep', 'notice', 'kpt_try', 'next_week'][i]]);
      await dialog().getByRole('button', { name: '닫기', exact: true }).click(); assert.equal((await writes()).length, 0);
    });
    await t.test('390/768/1440 renders, all fields scroll and save remains reachable with reduced keyboard viewport', async () => {
      for (const [name, width, height] of [['mobile', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 1024]]) {
        await page.setViewportSize({ width, height }); await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(output, `${name}-planner.png`) }); await launch();
        await page.screenshot({ path: path.join(output, `${name}-editor.png`) });
        await input(4).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `${name}-editor-next.png`) });
        const box = await dialog().boundingBox(), button = await dialog().getByRole('button', { name: '저장', exact: true }).boundingBox();
        assert.ok(box.x >= -1 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1);
        assert.ok(button.y >= 0 && button.y + button.height <= height);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        audit.push({ name, width, height, dialog: box, save: button });
        await dialog().getByRole('button', { name: '닫기', exact: true }).click();
      }
      await page.setViewportSize({ width: 390, height: 844 }); await launch(); await input(4).focus();
      await page.setViewportSize({ width: 390, height: 400 });
      await page.waitForFunction(() => { const box = document.querySelector('.mw-dialog button[type="submit"]')?.getBoundingClientRect(); return box && box.bottom <= 400; });
      const saveBox = await dialog().getByRole('button', { name: '저장', exact: true }).boundingBox(); assert.ok(saveBox.y + saveBox.height <= 400);
      await page.screenshot({ path: path.join(output, 'mobile-keyboard-height.png') });
      await dialog().getByRole('button', { name: '닫기', exact: true }).click(); await page.setViewportSize({ width: 1440, height: 1024 });
    });
    await t.test('new week, one-field save, reopen and previous/next week navigation', async () => {
      await page.getByRole('button', { name: '다음 주', exact: true }).click(); await launch();
      for (let i = 0; i < fields.length; i++) assert.equal(await input(i).inputValue(), '');
      await input(0).fill('새해 첫 주의 기억'); await save();
      const created = (await writes()).at(-1).payload; assert.equal(created.week_key, '2027-W01'); assert.match(created.id, /^[a-f\d-]{36}$/);
      assert.equal(created.kpt_keep, ''); assert.equal(created.next_week, '');
      assert.equal(await page.locator('.mw-history strong').first().innerText(), '2027-W01', 'History sorts by interpreted week dates without rewriting legacy keys');
      await launch(); assert.equal(await input(0).inputValue(), '새해 첫 주의 기억'); await dialog().getByRole('button', { name: '닫기', exact: true }).click();
      await page.getByRole('button', { name: '이전 주', exact: true }).click(); await launch(); assert.equal(await input(0).inputValue(), legacy.highlights); await dialog().getByRole('button', { name: '닫기', exact: true }).click();
    });
    await t.test('edit multiple fields, explicit clear, untouched remote text and original ID/key survive', async () => {
      await launch(); await input(0).fill('수정한 겨울 산책'); await input(3).fill('');
      await page.evaluate(() => { window.testDb.tables.weekly_reviews[0].notice = '다른 기기의 발견'; window.testDb.emit('weekly_reviews'); });
      assert.equal(await input(2).inputValue(), legacy.notice); await save();
      assert.deepEqual((await writes()).at(-1).payload, { highlights: '수정한 겨울 산책', kpt_try: '' });
      const saved = await page.evaluate(() => window.testDb.tables.weekly_reviews.find(r => r.id === 'legacy-week'));
      assert.equal(saved.week_key, '2027-W53'); assert.equal(saved.notice, '다른 기기의 발견'); assert.equal(saved.preserved_extra, '원본 보존');
      await launch(); assert.equal(await input(2).inputValue(), '다른 기기의 발견'); assert.equal(await input(3).inputValue(), '');
      await dialog().getByRole('button', { name: '닫기', exact: true }).click();
    });
    await t.test('discard confirmation preserves draft when cancelled and does not write', async () => {
      const count = (await writes()).length; await launch(); await input(1).fill('저장하지 않은 KEEP');
      await dialog().getByRole('button', { name: '주간 회고 닫기', exact: true }).click();
      await dialog().getByRole('button', { name: '계속 작성', exact: true }).click(); assert.equal(await input(1).inputValue(), '저장하지 않은 KEEP');
      await page.keyboard.press('Escape'); await dialog().getByRole('button', { name: '입력 닫기', exact: true }).click();
      assert.equal((await writes()).length, count);
    });
    await t.test('failure preserves draft; explicit retry, duplicate clicks, pending close and Realtime isolation', async () => {
      await launch(); await input(1).fill('실패해도 남을 KEEP');
      await page.evaluate(() => window.testDb.failNext('weekly_reviews', { status: 503 }));
      await dialog().getByRole('button', { name: '저장', exact: true }).click(); await dialog().getByRole('button', { name: '재시도', exact: true }).waitFor();
      assert.equal(await input(1).inputValue(), '실패해도 남을 KEEP');
      await page.screenshot({ path: path.join(output, 'desktop-save-retry.png') });
      await page.evaluate(() => window.testDb.hold('weekly_reviews'));
      await dialog().getByRole('button', { name: '재시도', exact: true }).click();
      await dialog().getByRole('button', { name: '저장 중…', exact: true }).waitFor();
      await dialog().getByRole('button', { name: '주간 회고 닫기', exact: true }).click(); await page.keyboard.press('Escape'); assert.equal(await dialog().count(), 1);
      await page.evaluate(() => { window.testDb.tables.weekly_reviews[0].next_week = '실시간 다른 기기 계획'; window.testDb.emit('weekly_reviews'); });
      assert.equal(await input(4).inputValue(), legacy.next_week);
      await page.evaluate(() => window.testDb.release('weekly_reviews')); await dialog().waitFor({ state: 'hidden' });
      const saved = await page.evaluate(() => window.testDb.tables.weekly_reviews[0]); assert.equal(saved.kpt_keep, '실패해도 남을 KEEP'); assert.equal(saved.next_week, '실시간 다른 기기 계획');
      await page.getByRole('button', { name: '다음 주', exact: true }).click(); await page.getByRole('button', { name: '다음 주', exact: true }).click();
      await launch(); await input(0).fill('두 번 눌러도 하나');
      await page.evaluate(() => window.testDb.hold('weekly_reviews'));
      const count = (await writes()).length;
      await dialog().getByRole('button', { name: '저장', exact: true }).evaluate(button => { button.click(); button.click(); document.getElementById('weekly-review-form').requestSubmit(); });
      await page.waitForFunction(n => window.testDb.requests.filter(r => r.table === 'weekly_reviews').length === n + 1, count);
      assert.equal((await writes()).length, count + 1);
      await page.evaluate(() => window.testDb.release('weekly_reviews')); await dialog().waitFor({ state: 'hidden' });
    });
    await t.test('lost acknowledgement reconciles; one-digit history and coexisting aliases remain separately editable', async () => {
      await page.getByRole('button', { name: '다음 주', exact: true }).click(); await launch(); await input(4).fill('응답이 사라져도 같은 회고');
      const count = (await writes()).length; await page.evaluate(() => window.testDb.failNext('weekly_reviews', { status: 0, afterCommit: true })); await save();
      assert.equal((await writes()).length, count + 1);
      await page.getByLabel('주차 선택', { exact: true }).fill('2025-12-30'); await launch(); assert.equal(await input(0).inputValue(), '지난해 첫 주 기억');
      await input(1).fill('과거 KEEP'); await save();
      assert.equal(await page.evaluate(() => window.testDb.tables.weekly_reviews.find(r => r.id === 'one-digit').week_key), '2026-W1');
      await page.evaluate(() => { const source = window.testDb.tables.weekly_reviews[0]; window.testDb.tables.weekly_reviews.push({ ...source, id: 'canonical', week_key: '2026-W53', highlights: '정규 키 별도 회고' }); window.testDb.emit('weekly_reviews'); });
      await page.getByLabel('주차 선택', { exact: true }).fill('2027-01-01'); await page.locator('.mw-collisions').waitFor(); await launch(); assert.equal(await input(0).inputValue(), '정규 키 별도 회고');
      await dialog().getByRole('button', { name: '닫기', exact: true }).click();
      await page.getByRole('button', { name: /회고 \d+ · 2027-W53/ }).click(); assert.equal(await input(0).inputValue(), '수정한 겨울 산책'); await dialog().getByRole('button', { name: '닫기', exact: true }).click();
    });
    await t.test('read errors do not show absence and retry recovers; healthy Realtime does not replace dirty input', async () => {
      const failed = await open({ tables, faults: [{ table: 'weekly_reviews', read: true, status: 503 }, { table: 'weekly_reviews', read: true, status: 503 }] });
      await failed.getByRole('button', { name: '회고 다시 불러오기', exact: true }).waitFor();
      assert.equal(await failed.getByRole('button', { name: '주간 회고', exact: true }).isDisabled(), true);
      assert.equal(await failed.getByText('아직 작성한 회고가 없어요. 한 항목만 적어도 저장할 수 있어요.').count(), 0);
      await failed.getByRole('button', { name: '회고 다시 불러오기', exact: true }).click();
      await failed.waitForFunction(() => !window.__weeklyDebug.readError);
      assert.equal(await failed.getByRole('button', { name: '주간 회고', exact: true }).isDisabled(), false); await failed.close();
      await launch(); await input(1).fill('내 초안 그대로');
      await page.evaluate(() => { window.testDb.tables.weekly_reviews.find(r => r.id === 'canonical').kpt_keep = '원격 변경'; window.testDb.emit('weekly_reviews'); });
      await page.waitForFunction(() => window.__weeklyDebug.records.find(r => r.id === 'canonical').kptKeep === '원격 변경');
      assert.equal(await input(1).inputValue(), '내 초안 그대로');
      await dialog().getByRole('button', { name: '저장', exact: true }).click(); await dialog().getByRole('alert').waitFor(); assert.match(await dialog().getByRole('alert').innerText(), /같은 항목/);
      await dialog().getByRole('button', { name: '닫기', exact: true }).click(); await dialog().getByRole('button', { name: '입력 닫기', exact: true }).click();
    });
    await t.test('no operational requests, unchanged reference data and original /reviews remains usable', async () => {
      const unchanged = await page.evaluate(() => ({ todos: window.testDb.tables.todos, goals: window.testDb.tables.weekly_goals, blocks: window.testDb.tables.todo_time_blocks, habits: window.testDb.tables.habits }));
      assert.deepEqual(unchanged, { todos: tables.todos, goals: tables.weekly_goals, blocks: tables.todo_time_blocks, habits: tables.habits });
      assert.equal(await page.evaluate(() => window.testDb.requests.filter(r => r.table !== 'weekly_reviews').length), 0);
      await page.goto(`${base}/reviews`); await page.locator('main').last().waitFor({ state: 'attached' });
      assert.equal(await page.getByText('Application Error').count(), 0);
      assert.deepEqual(errors, []);
      assert.ok(external.every(url => /^https:\/\/(fonts.googleapis.com|fonts.gstatic.com|cdn.jsdelivr.net)\//.test(url)), 'Only existing font styles attempt external access; every request is aborted');
    });
    await writeFile(path.join(output, 'validation.json'), JSON.stringify({ audit, external, errors, physicalKeyboard: 'Chromium reduced viewport only; physical iOS/Android not tested' }, null, 2));
  } finally { await browser?.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
});
