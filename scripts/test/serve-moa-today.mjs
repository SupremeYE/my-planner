// Optional local review only: actual App/Auth/Provider with the test memory transport.
// No credentials, production database, backend network or persistent sample records.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { format, getISOWeek, getISOWeekYear, subDays } from 'date-fns';
import { createServer } from 'vite';
import { tables } from './fixtures/moa-time-data.mjs';
const reviewPort = Number(process.env.MOA_REVIEW_PORT || 5175);
if (!Number.isInteger(reviewPort) || reviewPort < 1024 || reviewPort > 65535) throw new Error('Invalid review port');
const root = fileURLToPath(new URL('../../', import.meta.url));
const cacheDir = await mkdtemp(path.join(tmpdir(), 'moa-today-review-'));
const now = new Date();
const today = now.getHours() < 2 ? subDays(now, 1) : now;
const shiftDates = value => {
  if (Array.isArray(value)) return value.map(shiftDates);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v)]));
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const delta = (Date.UTC(y, m - 1, d) - Date.UTC(2027, 0, 1)) / 86400000;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta, 12);
  return format(date, 'yyyy-MM-dd') + value.slice(10);
};
const fixture = shiftDates(tables);
fixture.weekly_goals.forEach(row => { row.week_key = `${getISOWeekYear(today)}-W${String(getISOWeek(today)).padStart(2, '0')}`; });
fixture.monthly_goals[0].month = format(today, 'yyyy-MM');
const server = await createServer({ root, cacheDir, plugins: [{
  name: 'isolated-moa-today-review', enforce: 'pre',
  resolveId(source) { if (/(?:^\.\/supabase|\/lib\/supabase)$/.test(source)) return path.join(root, 'scripts/test/fixtures/moa-today-supabase.ts'); },
  transformIndexHtml() { return [
    { tag: 'script', children: `window.__moaFixture = ${JSON.stringify({ tables: fixture })};`, injectTo: 'head-prepend' },
    { tag: 'div', attrs: { style: 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:30000;background:#354235;color:#fffefb;padding:3px 9px;border-radius:0 0 8px 8px;font-size:11px;pointer-events:none;white-space:nowrap' }, children: '격리 시연 · 메모리 샘플 · 새로고침 시 초기화', injectTo: 'body' },
  ]; },
}], server: { host: '0.0.0.0', port: reviewPort, strictPort: true } });
await server.listen();
console.log(`Isolated review: http://localhost:${reviewPort}/__moamoa-todos and /__moamoa-today and /__moamoa-records`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); await rm(cacheDir, { recursive: true, force: true }); process.exit(0); });
