// Optional local review only: actual App/Auth/Provider with the test memory transport.
// No credentials, production database, backend network or persistent sample records.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { format, getISOWeek, getISOWeekYear, subDays } from 'date-fns';
import { createServer } from 'vite';
import { tables } from './fixtures/moa-food-data.mjs';
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
const originalPhoto = await readFile(path.join(root, 'scripts/test/fixtures/food/meal-a.png'));
const photos = new Map([['legacy-original.jpg', { bytes: originalPhoto, type: 'image/png' }]]);
fixture.weekly_goals.forEach(row => { row.week_key = `${getISOWeekYear(today)}-W${String(getISOWeek(today)).padStart(2, '0')}`; });
fixture.monthly_goals[0].month = format(today, 'yyyy-MM');
const server = await createServer({ root, cacheDir, plugins: [{
  name: 'isolated-moa-today-review', enforce: 'pre',
  configureServer(vite) { vite.middlewares.use(async (req,res,next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/food-calorie') { res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Isolated review: no external API call'}));return; }
    const prefix='/storage/v1/object/public/food-photos/';
    if(url.pathname.startsWith(prefix)){const value=photos.get(decodeURIComponent(url.pathname.slice(prefix.length)));res.statusCode=value?200:404;if(value)res.setHeader('Content-Type',value.type);res.end(value?.bytes);return;}
    const uploadPrefix='/__moa-memory-photo/';
    if(!url.pathname.startsWith(uploadPrefix))return next();
    if(req.method!=='POST'){res.statusCode=405;res.end();return;}
    const name=decodeURIComponent(url.pathname.slice(uploadPrefix.length));
    if(!/^[a-zA-Z0-9_.-]+$/.test(name)){res.statusCode=400;res.end();return;}
    let size=0;const chunks=[];
    try { for await(const chunk of req){size+=chunk.length;if(size>10*1024*1024){res.statusCode=413;res.end();return;}chunks.push(chunk);} }
    catch {res.statusCode=400;res.end();return;}
    const bytes=Buffer.concat(chunks),existing=photos.get(name);
    if(existing&&!existing.bytes.equals(bytes)){res.statusCode=409;res.end();return;}
    if(!existing)photos.set(name,{bytes,type:req.headers['content-type']||'image/png'});
    res.statusCode=200;res.end();
  }); },
  resolveId(source) { if (/(?:^\.\/supabase|\/lib\/supabase)$/.test(source)) return path.join(root, 'scripts/test/fixtures/moa-today-supabase.ts'); },
  transformIndexHtml() { return [
    { tag: 'script', children: `const sample = ${JSON.stringify(fixture)}; for (const row of sample.food_records || []) { if (row.photo_url) row.photo_url = window.location.origin + new URL(row.photo_url).pathname + new URL(row.photo_url).search; } window.__moaFixture = { tables: sample, localPhotoReview: true, storage: [{ bucket: 'food-photos', path: 'legacy-original.jpg', base64: ${JSON.stringify(originalPhoto.toString('base64'))}, type: 'image/png' }] };`, injectTo: 'head-prepend' },
    { tag: 'div', attrs: { style: 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:30000;background:#354235;color:#fffefb;padding:3px 9px;border-radius:0 0 8px 8px;font-size:11px;pointer-events:none;white-space:nowrap' }, children: '격리 시연 · 메모리 샘플 · 새로고침 시 초기화', injectTo: 'body' },
  ]; },
}], server: { host: '0.0.0.0', port: reviewPort, strictPort: true } });
await server.listen();
console.log(`Isolated review: http://localhost:${reviewPort}/__moamoa-todos and /__moamoa-today and /__moamoa-records and /__moamoa-food`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); await rm(cacheDir, { recursive: true, force: true }); process.exit(0); });
