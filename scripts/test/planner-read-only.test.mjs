// Run: node --test scripts/test/planner-read-only.test.mjs
// Mount the real provider; all persistence and network modules are replaced in-memory.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = {
  monthlyGoals: [
    { id: 'unlinked', text: 'No automatic parent', month: '2026-10' },
    { id: 'linked', text: 'Keep chosen parent', month: '2026-10', annualGoalId: 'a2' },
  ],
  annualGoals: [
    { id: 'a1', year: 2026, text: 'First annual', done: false },
    { id: 'a2', year: 2026, text: 'Chosen annual', done: false },
  ],
};

test('PlannerProvider reads never persist goal corrections; explicit edits still save', async (t) => {
  const { outputFiles } = await build({
    absWorkingDir: root, write: false, bundle: true, format: 'iife', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"test"' },
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { PlannerProvider, usePlanner } from './src/app/store';
      import { writes, refreshers } from './src/lib/db';
      function Probe() { window.planner = usePlanner(); return null; }
      window.writes = writes;
      window.refreshers = refreshers;
      createRoot(document.getElementById('root')).render(
        React.createElement(PlannerProvider, null, React.createElement(Probe))
      );
    `, resolveDir: root },
    plugins: [{ name: 'no-real-persistence', setup(build) {
      build.onResolve({ filter: /(?:^|\/)lib\/(?:db|supabase)$/ }, args =>
        ({ path: args.path.endsWith('/db') ? 'db' : 'supabase', namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: path === 'db' ? `
        export const writes = [];
        export const refreshers = {};
        const fixtures = ${JSON.stringify(fixtures)};
        export const db = new Proxy({}, { get: (_, table) => ({
          fetchAll: async () => structuredClone(fixtures[table] ?? []),
          fetch: async () => ({ dayStartHour: 4, dayEndHour: 26, appSettings: {} }),
          upsert: async (...args) => { writes.push({ table, args }); },
          insert: async (...args) => { writes.push({ table, args }); },
          update: async (...args) => { writes.push({ table, args }); },
          delete: async (...args) => { writes.push({ table, args }); },
        }) });
      ` : `
        import { refreshers } from 'db';
        export const supabase = {
          channel: () => ({
            on(_, config, callback) { refreshers[config.table] = callback; return this; },
            subscribe() { return this; },
          }),
          removeChannel() {},
        };
      ` }));
      build.onResolve({ filter: /^db$/, namespace: 'mock' }, () => ({ path: 'db', namespace: 'mock' }));
    } }],
  });
  const browser = await chromium.launch({
    executablePath: process.env.HAON_CHROME || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === 'http://planner.test/'
      ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
      : route.abort());
    await page.goto('http://planner.test/');
    await page.addScriptTag({ content: outputFiles[0].text });
    await page.waitForFunction(() => window.planner && !window.planner.isLoading);

    await t.test('initial load preserves both unlinked and explicitly linked goals without writes', async () => {
      assert.deepEqual(await page.evaluate(() => window.writes), []);
      assert.deepEqual(await page.evaluate(() => window.planner.monthlyGoals), fixtures.monthlyGoals);
    });
    await t.test('Realtime refresh and returning to a visible page remain read-only', async () => {
      await page.evaluate(async () => {
        window.refreshers.monthly_goals();
        window.refreshers.annual_goals();
        window.refreshers.user_settings();
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForFunction(() => window.planner.monthlyGoals.length === 2);
      assert.deepEqual(await page.evaluate(() => window.writes), []);
      assert.deepEqual(await page.evaluate(() => window.planner.monthlyGoals), fixtures.monthlyGoals);
    });
    await t.test('only an explicit edit saves and preserves unrelated fields and links', async () => {
      await page.evaluate(() => window.planner.updateMonthlyGoal('linked', { text: 'Edited explicitly' }));
      await page.waitForFunction(() => window.writes.length > 0);
      const writes = await page.evaluate(() => window.writes);
      assert.equal(writes.length, 1);
      assert.deepEqual(writes[0], {
        table: 'monthlyGoals', args: [{ ...fixtures.monthlyGoals[1], text: 'Edited explicitly' }],
      });
      assert.deepEqual(await page.evaluate(() => window.planner.monthlyGoals[0]), fixtures.monthlyGoals[0]);
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
