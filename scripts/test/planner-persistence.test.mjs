// Real provider + real DB codecs/confirmed writers against a socket-free memory transport.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tables = {
  user_settings: [{ id: 'default', day_start_hour: 4, day_end_hour: 26 }],
  todos: [
    { id: 't1', text: 'Undated linked todo', date: null, status: 'active', is_top3: false, weekly_goal_id: 'w1', tags: [] },
    { id: 't2', text: 'Done todo', date: '2026-12-31', status: 'done', is_top3: false, weekly_goal_id: 'w1', tags: [] },
  ],
  weekly_goals: [
    { id: 'w1', text: 'Linked week', done: true, week_key: '2027-W53', monthly_goal_id: 'm1' },
    { id: 'w2', text: 'Manual week', done: false, week_key: '2026-W53', monthly_goal_id: 'm1' },
  ],
  brainstorm_items: [{ id: 'brain-1', text: 'Retain source until saved', date: '2026-12-31' }],
  monthly_goals: [{ id: 'm1', text: 'Month', month: '2026-12', retro_status: 'done' }],
};

test('core persistence: confirmation, failure, retry, deduplication and reload', { timeout: 60000 }, async (t) => {
  const { outputFiles } = await build({
    absWorkingDir: root, write: false, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', alias: { '@': `${root}src` },
    define: { 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { PlannerProvider, usePlanner } from './src/app/store';
      import { ThemeProvider } from './src/app/ThemeContext';
      import { SaveStatus } from './src/app/components/SaveStatus';
      import { TodoModal } from './src/app/components/TodoModal';
      import { weeklyRollup, monthlyRollup } from './src/app/components/period/periodProgress';
      import { getWeekKey, weekKeysMatch } from './src/lib/weekKeys';
      import { controls } from './src/lib/supabase';
      window.testDb = controls;
      function Probe() {
        const planner = usePlanner(); window.planner = planner;
        const [showModal, setShowModal] = React.useState(false);
        window.openTodoModal = () => { window.modalClosed = 0; setShowModal(true); };
        window.progress = {
          weeks: planner.weeklyGoals.map(g => ({ id: g.id, ...weeklyRollup(g, planner.todos) })),
          months: planner.monthlyGoals.map(g => ({ id: g.id, ...monthlyRollup(g, planner.weeklyGoals, planner.todos) })),
          boundaryGoals: planner.weeklyGoals.filter(g => weekKeysMatch(g.weekKey, getWeekKey(new Date(2027, 0, 1, 12)))).map(g => g.id),
        };
        return React.createElement(React.Fragment, null, React.createElement(SaveStatus),
          showModal ? React.createElement(TodoModal, { onClose: () => { window.modalClosed++; setShowModal(false); } }) : null);
      }
      createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider, null,
        React.createElement(PlannerProvider, null, React.createElement(Probe))));
    ` },
    plugins: [{ name: 'isolated-supabase', setup(build) {
      build.onResolve({ filter: /(?:^\.\/supabase|\/lib\/supabase)$/ }, () => ({ path: 'transport', namespace: 'memory' }));
      build.onLoad({ filter: /.*/, namespace: 'memory' }, () => ({ resolveDir: root, contents: `
        import { memorySupabase } from ${JSON.stringify(`${root}scripts/test/fixtures/memory-supabase.ts`)};
        const instance = memorySupabase(window.__testTables ?? ${JSON.stringify(tables)});
        export const supabase = instance.supabase;
        export const controls = instance.controls;
      ` }));
    } }],
  });
  const browser = await chromium.launch({ executablePath: process.env.HAON_CHROME || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    t.afterEach(async () => { await page.evaluate(() => { window.testDb.release('todos'); window.testDb.release('weekly_goals'); }); });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === 'http://localhost/'
      ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort());
    await page.goto('http://localhost/');
    await page.addScriptTag({ content: outputFiles[0].text });
    await page.waitForFunction(() => window.planner && !window.planner.isLoading);

    await t.test('links and legacy ISO boundary lookup are preserved; manual flags do not override children', async () => {
      const progress = await page.evaluate(() => window.progress);
      assert.equal(progress.weeks.find(g => g.id === 'w1').pct, 50);
      assert.equal(progress.months[0].pct, 33); // 1/2 + manual 0/1
      assert.deepEqual(progress.boundaryGoals, ['w1', 'w2']);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), 0);
    });

    await t.test('pending completion keeps confirmed state; double click writes once', async () => {
      await page.evaluate(() => {
        window.testDb.hold('todos');
        window.first = window.planner.updateTodo('t1', { status: 'done' });
        window.second = window.planner.updateTodo('t1', { status: 'done' });
      });
      await page.waitForFunction(() => window.planner.saveStates.some(s => s.status === 'saving'));
      assert.equal(await page.evaluate(() => window.planner.todos.find(t => t.id === 't1').status), 'active');
      assert.match(await page.getByRole('status').innerText(), /저장 중/);
      await page.evaluate(() => window.testDb.release('todos'));
      assert.deepEqual(await page.evaluate(() => Promise.all([window.first, window.second])), [true, true]);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), 1);
      await page.waitForFunction(() => window.progress.weeks.find(g => g.id === 'w1').pct === 100);
      assert.equal(await page.evaluate(() => window.progress.months[0].pct), 67);
    });

    await t.test('cancel and manual goal changes follow the common progress rules', async () => {
      assert.equal(await page.evaluate(() => window.planner.updateTodo('t2', { status: 'cancelled' })), true);
      assert.equal(await page.evaluate(() => window.planner.updateTodo('t1', { status: 'active' })), true);
      await page.waitForFunction(() => window.progress.weeks.find(g => g.id === 'w1').total === 1);
      assert.equal(await page.evaluate(() => window.progress.weeks.find(g => g.id === 'w1').pct), 0);
      const count = await page.evaluate(() => window.testDb.requests.length);
      assert.equal(await page.evaluate(() => window.planner.toggleWeeklyGoal('w1')), false);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), count);
      assert.equal(await page.evaluate(() => window.planner.toggleWeeklyGoal('w2')), true);
      await page.waitForFunction(() => window.progress.weeks.find(g => g.id === 'w2').completed);
    });

    await t.test('temporary failure preserves the screen; explicit retry sends the same absolute patch', async () => {
      await page.evaluate(() => window.testDb.failNext('todos', { status: 503 }));
      assert.equal(await page.evaluate(() => window.planner.updateTodo('t1', { status: 'done' })), false);
      assert.equal(await page.evaluate(() => window.planner.todos.find(t => t.id === 't1').status), 'active');
      assert.match(await page.getByRole('alert').innerText(), /저장 확인에 실패/);
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.todos.find(t => t.id === 't1').status === 'done');
      const attempts = await page.evaluate(() => window.testDb.requests.slice(-2));
      assert.deepEqual(attempts.map(a => a.payload), [{ status: 'done' }, { status: 'done' }]);
    });

    await t.test('lost acknowledgement + retry + form resubmit creates exactly one TODO', async () => {
      await page.evaluate(() => window.testDb.failNext('todos', { status: 0, afterCommit: true }));
      assert.equal(await page.evaluate(() => window.planner.addTodo({ text: 'One draft', date: null, status: 'active', isTop3: false }, 'draft-id')), null);
      assert.equal(await page.evaluate(() => window.planner.todos.some(t => t.id === 'draft-id')), false);
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.todos.some(t => t.id === 'draft-id'));
      assert.equal(await page.evaluate(() => window.planner.addTodo({ text: 'One draft', date: null, status: 'active', isTop3: false }, 'draft-id')), 'draft-id');
      assert.equal(await page.evaluate(() => window.testDb.tables.todos.filter(t => t.id === 'draft-id').length), 1);
    });

    await t.test('weekly/monthly create and edit are confirmed and duplicate creation is coalesced', async () => {
      await page.evaluate(() => {
        window.testDb.hold('weekly_goals');
        window.first = window.planner.addWeeklyGoal('New weekly', 'm1', '2026-W53', 'new-week');
        window.second = window.planner.addWeeklyGoal('New weekly', 'm1', '2026-W53', 'new-week');
      });
      assert.equal(await page.evaluate(() => window.planner.weeklyGoals.some(g => g.id === 'new-week')), false);
      await page.evaluate(() => window.testDb.release('weekly_goals'));
      assert.deepEqual(await page.evaluate(() => Promise.all([window.first, window.second])), ['new-week', 'new-week']);
      assert.equal(await page.evaluate(() => window.planner.updateWeeklyGoal('new-week', { text: 'Edited weekly', done: true })), true);
      assert.equal(await page.evaluate(() => window.planner.addMonthlyGoal('New monthly', '2027-01', undefined, undefined, 'new-month')), 'new-month');
      assert.equal(await page.evaluate(() => window.planner.updateMonthlyGoal('new-month', { text: 'Edited monthly', retroStatus: 'done' })), true);
      await page.waitForFunction(() => window.progress.months.find(g => g.id === 'new-month').pct === 100);
      assert.equal(await page.evaluate(() => window.testDb.tables.weekly_goals.filter(g => g.id === 'new-week').length), 1);
    });

    await t.test('permanent rejection offers no retry and never reports a successful edit', async () => {
      await page.evaluate(() => window.testDb.failNext('monthly_goals', { status: 403, code: '42501' }));
      assert.equal(await page.evaluate(() => window.planner.updateMonthlyGoal('new-month', { text: 'Rejected' })), false);
      assert.equal(await page.evaluate(() => window.planner.monthlyGoals.find(g => g.id === 'new-month').text), 'Edited monthly');
      assert.equal(await page.getByRole('button', { name: '재시도', exact: true }).count(), 0);
      assert.match(await page.getByRole('alert').innerText(), /권한/);
    });

    await t.test('other-device refresh updates unprotected records; a failed read does not erase data', async () => {
      await page.evaluate(() => {
        window.testDb.tables.todos.find(t => t.id === 't1').status = 'active';
        window.testDb.emit('todos');
      });
      await page.waitForFunction(() => window.planner.todos.find(t => t.id === 't1').status === 'active');
      const count = await page.evaluate(() => window.planner.todos.length);
      await page.evaluate(async () => {
        window.testDb.failNext('todos', { status: 503, read: true }); window.testDb.emit('todos');
        await new Promise(resolve => setTimeout(resolve, 30));
      });
      assert.equal(await page.evaluate(() => window.planner.todos.length), count);
    });

    await t.test('offline means unsaved; reconnect does not auto-retry', async () => {
      await context.setOffline(true);
      const count = await page.evaluate(() => window.testDb.requests.length);
      assert.equal(await page.evaluate(() => window.planner.addTodo({ text: 'Offline draft', date: null, status: 'active', isTop3: false }, 'offline-draft')), null);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), count);
      assert.equal(await page.evaluate(() => window.planner.todos.some(t => t.id === 'offline-draft')), false);
      await context.setOffline(false);
      assert.equal(await page.evaluate(() => window.testDb.requests.length), count);
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.todos.some(t => t.id === 'offline-draft'));
    });

    await t.test('the actual TODO form keeps its draft on failure and does not duplicate after global retry', async () => {
      await page.evaluate(() => window.openTodoModal());
      const input = page.getByPlaceholder('할 일을 입력하세요', { exact: true });
      await input.fill('Retained modal draft');
      await page.evaluate(() => window.testDb.failNext('todos', { status: 503 }));
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '저장 확인에 실패' }).waitFor();
      assert.equal(await input.inputValue(), 'Retained modal draft');
      assert.equal(await page.evaluate(() => window.modalClosed), 0);
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.todos.some(t => t.text === 'Retained modal draft'));
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForFunction(() => window.modalClosed === 1);
      assert.equal(await page.evaluate(() => window.testDb.tables.todos.filter(t => t.text === 'Retained modal draft').length), 1);
    });

    await t.test('brainstorm conversion preserves its source on failure and uses one stable TODO on retry', async () => {
      await page.evaluate(() => window.testDb.failNext('todos', { status: 503 }));
      await page.evaluate(() => window.planner.brainstormToTodo('brain-1'));
      assert.equal(await page.evaluate(() => window.planner.brainstormItems.some(b => b.id === 'brain-1')), true);
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.todos.some(t => t.id === 'brainstorm-brain-1'));
      await page.evaluate(() => window.planner.brainstormToTodo('brain-1'));
      await page.waitForFunction(() => !window.planner.brainstormItems.some(b => b.id === 'brain-1'));
      assert.equal(await page.evaluate(() => window.testDb.tables.todos.filter(t => t.id === 'brainstorm-brain-1').length), 1);
    });

    await t.test('a failed recurring TODO completion does not materialize a false completed exception', async () => {
      await page.evaluate(() => window.planner.addTodo({ text: 'Recurring', date: '2026-12-31', status: 'active', isTop3: false,
        weeklyGoalId: 'w1', recurrenceRule: 'daily' }, 'recurring-parent'));
      await page.evaluate(() => window.testDb.failNext('todos', { status: 503 }));
      assert.equal(await page.evaluate(() => window.planner.updateTodo('recurring-parent::2027-01-01', { status: 'done' })), false);
      assert.equal(await page.evaluate(() => window.planner.todos.filter(t => t.recurrenceParentId === 'recurring-parent').length), 0);
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.todos.some(t => t.recurrenceParentId === 'recurring-parent' && t.status === 'done'));
      assert.equal(await page.evaluate(() => window.planner.todos.filter(t => t.recurrenceParentId === 'recurring-parent').length), 1);
      assert.equal(await page.evaluate(() => window.planner.todos.find(t => t.recurrenceParentId === 'recurring-parent').weeklyGoalId), 'w1');
    });

    await t.test('timer start waits for a confirmed status and preserves the previous status on failure', async () => {
      await page.evaluate(() => window.testDb.failNext('todos', { status: 503 }));
      await page.evaluate(() => window.planner.startTimer('draft-id'));
      assert.equal(await page.evaluate(() => window.planner.activeTimer), null);
      assert.equal(await page.evaluate(() => window.planner.todos.find(t => t.id === 'draft-id').status), 'active');
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.todos.find(t => t.id === 'draft-id').status === 'inProgress');
      assert.equal(await page.evaluate(() => window.planner.activeTimer), null); // no silent timer start on retry
    });

    await t.test('timer completion retries the same block after a partial save and retains an unsaved paused session', async () => {
      const now = Date.now();
      await page.evaluate(({ startedAt, pauseStartedAt }) => {
        localStorage.setItem('planner-active-focus-timer', JSON.stringify({ taskId: 't2', sessionId: 'da0dbdb5-9791-4cdf-8a75-56c7b19cb888',
          mode: 'stopwatch', startedAt, startHHMM: '10:00', pausedDuration: 0, isPaused: true, pauseStartedAt }));
        document.dispatchEvent(new Event('visibilitychange'));
      }, { startedAt: now - 60000, pauseStartedAt: now });
      await page.waitForFunction(() => window.planner.activeTimer?.todoId === 't2');
      await page.evaluate(async () => { await window.planner.updateTodo('t2', { status: 'active' }); window.testDb.failNext('todos', { status: 503 }); window.planner.finishActiveTimer(); });
      await page.waitForFunction(() => window.planner.saveStates.some(s => s.label === '타이머 기록' && s.status === 'error'));
      assert.equal(await page.evaluate(() => window.planner.todos.find(t => t.id === 't2').status), 'active');
      assert.equal(await page.evaluate(() => window.planner.activeTimer.isPaused), true);
      assert.equal(await page.evaluate(() => window.testDb.tables.todo_time_blocks.length), 1);
      await page.getByRole('button', { name: '재시도', exact: true }).click();
      await page.waitForFunction(() => window.planner.activeTimer === null);
      assert.equal(await page.evaluate(() => window.planner.todos.find(t => t.id === 't2').status), 'done');
      assert.equal(await page.evaluate(() => window.testDb.tables.todo_time_blocks.length), 1);
      assert.equal(await page.evaluate(() => window.testDb.tables.todo_time_blocks[0].elapsed_sec), 60);
      assert.equal(await page.evaluate(() => localStorage.getItem('planner-active-focus-timer')), null);
    });

    await t.test('reload reads saved results from the isolated server state, not local optimistic state', async () => {
      const persisted = await page.evaluate(() => window.testDb.tables);
      await page.reload();
      await page.evaluate(value => { window.__testTables = value; }, persisted);
      await page.addScriptTag({ content: outputFiles[0].text });
      await page.waitForFunction(() => window.planner && !window.planner.isLoading);
      assert.equal(await page.evaluate(() => window.planner.todos.filter(t => t.id === 'draft-id').length), 1);
      assert.equal(await page.evaluate(() => window.planner.monthlyGoals.find(g => g.id === 'new-month').text), 'Edited monthly');
      assert.equal(await page.evaluate(() => window.planner.weeklyGoals.find(g => g.id === 'w1').weekKey), '2027-W53');
      assert.equal(await page.evaluate(() => window.testDb.requests.length), 0);
    });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
