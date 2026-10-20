// Actual pages, shared seeded data, all backend modules mocked; no production connections.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('home, monthly goals and weekly review render the same goal progress', { timeout: 60000 }, async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'moamoa-goal-pages-'));
  const server = await createServer({
    root, cacheDir, configFile: false, logLevel: 'error',
    resolve: { alias: { '@': path.join(root, 'src') } },
    plugins: [{ name: 'isolated-goal-pages', enforce: 'pre',
      resolveId(source, importer) {
        if (source.includes('scripts/render/')) return;
        const bare = source.replace(/\.(t|j)sx?$/, '');
        const fromLib = importer?.replace(/\\/g, '/').includes('/src/lib/');
        const fromMoney = importer?.replace(/\\/g, '/').includes('/src/features/money/');
        const file = /(?:^|\/)lib\/supabase$/.test(bare) || (bare === './supabase' && fromLib) ? 'mock-supabase.ts'
          : /(?:^|\/)lib\/db$/.test(bare) || (bare === './db' && fromLib) ? 'mock-db.ts'
          : /(?:^|\/)features\/money\/db$/.test(bare) || (bare === './db' && fromMoney) ? 'mock-money-db.ts' : null;
        if (file) return path.join(root, 'scripts/render', file);
      },
      transform(code, id) {
        if (id.split('?')[0] !== path.join(root, 'scripts/render/mock-db.ts')) return;
        // A partial goal makes this a meaningful comparison rather than a 0/100-only smoke test.
        return code.replace('export const db: any', `SEED.todos.push({ ...SEED.todos[0], id: 'goal-test-active', status: 'active', isTop3: false });\nexport const db: any`);
      },
    }, react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 0, strictPort: true },
  });
  let browser;
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.HAON_CHROME || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const snapshot = () => page.locator('[data-goal-kind]').evaluateAll(elements => elements.map(el => ({
      kind: el.getAttribute('data-goal-kind'), id: el.getAttribute('data-goal-id'), pct: Number(el.getAttribute('data-goal-progress')),
    })));
    await page.goto(`${base}/dashboard`);
    await page.locator('[data-goal-kind="monthly"]').first().waitFor();
    const home = await snapshot();
    assert.ok(home.some(g => g.pct > 0 && g.pct < 100));
    await page.goto(`${base}/goals`);
    await page.getByRole('button', { name: '기간별', exact: true }).click();
    await page.locator('[data-goal-kind="monthly"]').first().waitFor();
    await page.locator('[data-goal-kind="weekly"]').first().waitFor();
    const goals = await snapshot();
    for (const goal of goals) {
      const same = home.filter(g => g.id === goal.id && g.kind === goal.kind);
      assert.ok(same.length > 0, `Goal missing from home: ${goal.id}`);
      assert.ok(same.every(g => g.pct === goal.pct), `Progress mismatch for ${goal.id}`);
    }
    const outputDir = path.join(root, 'scripts/render/output');
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, 'pc-goals-progress.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    // Layout mounts a separate mobile outlet; select its own tab after the breakpoint change.
    await page.getByRole('button', { name: '기간별', exact: true }).click();
    await page.getByRole('button', { name: /플래너 앱 일간 화면 정비/ }).click();
    await page.locator('[data-goal-kind="weekly"]:visible').first().waitFor();
    const mobile = await page.locator('[data-goal-kind]:visible').evaluateAll(elements => elements.map(el => ({
      kind: el.getAttribute('data-goal-kind'), id: el.getAttribute('data-goal-id'), pct: Number(el.getAttribute('data-goal-progress')),
    })));
    assert.ok(mobile.some(g => g.kind === 'weekly'));
    for (const goal of mobile) {
      assert.equal(goal.pct, home.find(g => g.id === goal.id && g.kind === goal.kind)?.pct);
    }
    await page.screenshot({ path: path.join(outputDir, 'mobile-goals-progress.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}/reviews`);
    await page.getByRole('button', { name: '주간', exact: true }).click();
    await page.locator('[data-goal-kind="weekly"]').first().waitFor();
    for (const goal of await snapshot()) {
      const same = home.find(g => g.id === goal.id && g.kind === goal.kind);
      assert.equal(goal.pct, same?.pct);
    }
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); await rm(cacheDir, { recursive: true, force: true }); }
});
