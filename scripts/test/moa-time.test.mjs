// Real App/Auth/PlannerProvider and codecs. Only transport is an isolated memory implementation.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {tables} from './fixtures/moa-time-data.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(root,'docs/screenshots/moamoa-time');

test('Moa time: independent and TODO recording, frozen categories, day/week/month and confirmed persistence', {timeout:300000}, async t=>{
 const cacheDir=await mkdtemp(path.join(tmpdir(),'moa-time-'));
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const server=await createServer({root,cacheDir,logLevel:'error',plugins:[{name:'isolated-time',enforce:'pre',
  transformIndexHtml(){return [{tag:'div',attrs:{style:'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:30000;background:#354235;color:#fffefb;padding:2px 8px;border-radius:0 0 8px 8px;font-size:10px;pointer-events:none;white-space:nowrap'},children:'격리 검증 · 메모리 샘플 · 운영 DB 연결 없음',injectTo:'body'}];},
  resolveId(source){if(/(?:^\.\/supabase|\/lib\/supabase)$/.test(source))return path.join(root,'scripts/test/fixtures/moa-today-supabase.ts');},
  transform(code,id){if(id.endsWith('/src/app/store.tsx'))return code.replace('return ctx;', 'window.__testPlanner = ctx; return ctx;');},
 }],server:{host:'127.0.0.1',port,strictPort:true}});
 let browser;const errors=[],external=[],shots=[];
 try{
  await server.listen();const base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({executablePath:process.env.HAON_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({timezoneId:'Asia/Seoul',serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',route=>{if(!route.request().url().startsWith(base)){external.push(route.request().url());return route.abort();}return route.continue();});
  const open=async(fixture={tables})=>{const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.setViewportSize({width:390,height:844});await page.clock.install({time:new Date('2027-01-01T12:00:00+09:00')});await page.addInitScript(value=>{window.__moaFixture=value;},fixture);await page.goto(`${base}/__moamoa-records`,{timeout:60000});await page.getByRole('heading',{name:'기록',exact:true}).waitFor();await page.waitForFunction(()=>window.__testPlanner&&!window.__testPlanner.isLoading&&window.__testPlanner.activityStorageStatus!=='loading');return page;};
  const page=await open();const dialog=name=>page.getByRole('dialog',{name,exact:true});const amount=()=>page.locator('[data-activity-minutes]');
  const sheet=()=>dialog('시간 빠르게 기록');const retry=name=>dialog(name).getByRole('button',{name:'재시도',exact:true});
  const record=id=>page.locator(`[data-activity-id="${id}"]`);
  await mkdir(output,{recursive:true});
  const capture=async (name,scrollSelector)=>{for(const [label,width,height] of [['mobile',390,844],['desktop',1440,1024]]){await page.setViewportSize({width,height});if(scrollSelector)await page.locator(scrollSelector).scrollIntoViewIfNeeded();const dim=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.ma-overview,.ma-toolbar,.ma-history,.mx-dialog')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>e.className)}));assert.equal(dim.document,width);assert.deepEqual(dim.overflow,[]);await page.screenshot({path:path.join(output,`${label}-${name}.png`)});shots.push({name:`${label}-${name}`,...dim});}await page.setViewportSize({width:390,height:844});if(scrollSelector)await page.locator('.mt-scroll').evaluate(el=>el.scrollTo(0,0));};
  const add=async name=>{await page.getByRole('button',{name:'시간 기록',exact:true}).click();await sheet().getByLabel('활동명',{exact:true}).fill(name);};
  const choose=async name=>{await sheet().getByRole('button',{name:'활동 카테고리 선택',exact:true}).click();await dialog('대표 시간 카테고리 선택').getByRole('radio',{name,exact:true}).click();await dialog('대표 시간 카테고리 선택').getByRole('button',{name:'선택 적용',exact:true}).click();};
  async function step(name,fn){let fail;await t.test(name,async()=>{try{await fn();}catch(e){fail=e;throw e;}});if(fail)throw fail;}
  let id;const initialTodos=await page.evaluate(()=>window.testDb.tables.todos.length);
  await step('real Provider records have no read writes, samples stay isolated, mobile and PC render',async()=>{
   assert.equal(await page.evaluate(()=>window.testDb.requests.length),0);assert.equal(await amount().getAttribute('data-activity-minutes'),'285');
   await capture('daily');await page.getByRole('button',{name:'주간',exact:true}).click();await capture('weekly');await capture('comparison','.ma-comparison');await capture('history','.ma-history');await page.getByRole('button',{name:'월간',exact:true}).click();await capture('monthly');await page.getByRole('button',{name:'일간',exact:true}).click();
  });
  await step('independent quick save preserves draft on failure, duplicate clicks and acknowledgement-loss retry create one row',async()=>{
   await add('저녁에 가볍게 산책');await sheet().getByRole('button',{name:'30분',exact:true}).click();await choose('생활');await capture('new-activity');
   await page.evaluate(()=>{window.testDb.hold('activity_entries');window.testDb.failNext('activity_entries',{status:0,afterCommit:true});});
   await sheet().locator('form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});await page.waitForFunction(()=>window.__testPlanner.saveStates.some(s=>s.status==='saving'));
   assert.equal(await amount().getAttribute('data-activity-minutes'),'285');await page.evaluate(()=>window.testDb.release('activity_entries'));await retry('시간 빠르게 기록').waitFor();await capture('save-failure');
   assert.equal(await sheet().getByLabel('활동명',{exact:true}).inputValue(),'저녁에 가볍게 산책');assert.equal(await page.evaluate(()=>window.__testPlanner.activityEntries.some(e=>e.name==='저녁에 가볍게 산책')),false);
   await retry('시간 빠르게 기록').click();await sheet().waitFor({state:'hidden'});
   const rows=await page.evaluate(()=>window.testDb.tables.activity_entries.filter(e=>e.name==='저녁에 가볍게 산책'));assert.equal(rows.length,1);id=rows[0].id;assert.equal(rows[0].operation_id,id);assert.equal(rows[0].started_at,null);assert.equal(rows[0].ended_at,null);assert.equal(await amount().getAttribute('data-activity-minutes'),'315');
   assert.equal(await page.evaluate(()=>window.testDb.tables.todos.length),initialTodos);assert.equal(await page.evaluate(()=>window.testDb.tables.todos.find(t=>t.id==='plain').status),'active');
  });
  await step('snapshot stays classified after current tag rename/role change and source TODO tag changes',async()=>{
   await page.evaluate(()=>{const tag=window.testDb.tables.tags.find(t=>t.id==='life');tag.name='현재 이름 변경';tag.track_time=false;window.testDb.emit('tags');});await page.waitForFunction(()=>window.__testPlanner.tags.some(t=>t.name==='현재 이름 변경'));
   assert.match(await record(id).innerText(),/생활/);assert.match(await record(id).innerText(),/당시 분류 보존/);
   await record(id).getByRole('button',{name:/기록 수정$/}).click();await dialog('활동 기록 수정').getByLabel('활동명',{exact:true}).fill('산책과 생각 정리');await capture('edit-activity');await dialog('활동 기록 수정').getByRole('button',{name:'기록 저장',exact:true}).click();await dialog('활동 기록 수정').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(id=>window.testDb.tables.activity_entries.find(e=>e.id===id).classification_snapshot.shares[0].name,id),'생활');
   await page.evaluate(()=>{Object.assign(window.testDb.tables.tags.find(t=>t.id==='life'),{name:'생활',track_time:true});window.testDb.emit('tags');});await page.waitForFunction(()=>window.__testPlanner.tags.some(t=>t.name==='생활'&&t.trackTime));
  });
  await step('unclassified and historical dates; actual intervals are optional and checked without invented start times',async()=>{
   await add('이름이 아주 긴 기록도 잘 읽히는 조용한 휴식 시간 '.repeat(4));await sheet().getByRole('button',{name:'15분',exact:true}).click();await sheet().getByRole('button',{name:'기록 저장',exact:true}).click();await sheet().waitFor({state:'hidden'});assert.equal(await page.locator('[data-unclassified-minutes]').getAttribute('data-unclassified-minutes'),'30');await capture('unclassified');const longId=await page.evaluate(()=>window.testDb.tables.activity_entries.find(e=>e.name.startsWith('이름이 아주 긴')).id);await capture('long-activity',`[data-activity-id="${longId}"]`);
   await add('지난해의 저녁 산책');await sheet().getByLabel('활동 날짜',{exact:true}).fill('2026-12-31');await sheet().getByRole('button',{name:'30분',exact:true}).click();await choose('생활');await sheet().getByRole('button',{name:'메모·실제 시각 추가',exact:true}).click();await sheet().getByLabel('활동 메모',{exact:true}).fill('자정을 넘어도 지정한 기록 날짜로');await sheet().getByLabel('실제 시작',{exact:true}).fill('2026-12-31T23:55');await sheet().getByLabel('실제 종료',{exact:true}).fill('2027-01-01T00:25');await capture('actual-times');await sheet().getByRole('button',{name:'기록 저장',exact:true}).click();await sheet().waitFor({state:'hidden'});
   await page.getByRole('button',{name:'이전 기간',exact:true}).click();assert.equal(await amount().getAttribute('data-activity-minutes'),'60');assert.match(await page.locator('summary').innerText(),/겹치는 기록/);await capture('overlap');await page.getByRole('button',{name:'다음 기간',exact:true}).click();assert.equal(await amount().getAttribute('data-activity-minutes'),'330');
  });
  await step('TODO-linked recording shares IDs and snapshots, no status/goal change, edit and delete refresh totals',async()=>{
   await page.getByRole('button',{name:'시간 기록',exact:true}).click();await sheet().getByRole('button',{name:'할 일 연결',exact:true}).click();await sheet().getByLabel('연결할 할 일',{exact:true}).selectOption('t1');await sheet().getByRole('button',{name:'60분',exact:true}).click();await capture('todo-linked');await sheet().getByRole('button',{name:'기록 저장',exact:true}).click();await sheet().waitFor({state:'hidden'});
   const blocks=await page.evaluate(()=>window.testDb.tables.todo_time_blocks.filter(b=>b.todo_id==='t1'));assert.equal(blocks.length,2);const block=blocks.find(b=>b.id!=='b1');assert.equal(block.classification_snapshot.shares[0].tagId,'work');assert.equal(block.start_time,null);assert.equal(await amount().getAttribute('data-activity-minutes'),'390');
   await page.evaluate(()=>{window.testDb.tables.todos.find(t=>t.id==='t1').tags=[];window.testDb.emit('todos');});await page.waitForFunction(()=>window.__testPlanner.todos.find(t=>t.id==='t1').tags.length===0);assert.match(await record(block.id).innerText(),/업무/);
   await record(block.id).getByRole('button',{name:/기록 수정$/}).click();await dialog('활동 기록 수정').getByLabel('활동 소요 시간 (분)',{exact:true}).fill('90');await dialog('활동 기록 수정').getByRole('button',{name:'기록 저장',exact:true}).click();await dialog('활동 기록 수정').waitFor({state:'hidden'});assert.equal(await amount().getAttribute('data-activity-minutes'),'420');
   await record(block.id).getByRole('button',{name:/기록 삭제$/}).click();await dialog('활동 기록 삭제').getByRole('button',{name:'삭제 확인',exact:true}).click();await dialog('활동 기록 삭제').waitFor({state:'hidden'});assert.equal(await amount().getAttribute('data-activity-minutes'),'330');
   assert.equal(await page.evaluate(()=>window.testDb.tables.todos.find(t=>t.id==='t1').status),'active');assert.equal(await page.evaluate(()=>window.testDb.tables.weekly_goals.find(g=>g.id==='w1').done),true);
  });
  await step('same period daily sums match week/month, category filters and day drilldown',async()=>{
   for(const mode of ['주간','월간']){await page.getByRole('button',{name:mode,exact:true}).click();const summary=await page.evaluate(async()=>{const {aggregateActivity}=await import('/src/lib/timeAggregation.ts');const {reportRange}=await import('/src/lib/activityReport.ts');const p=window.__testPlanner;const period=document.querySelector('.ma-toolbar .mx-tabs button[aria-pressed="true"]').textContent==='주간'?'week':'month';const r=reportRange('2027-01-01',period);const sum=(s,e)=>aggregateActivity(p.todos,p.reportEvents,p.tags,s,e,p.timeBlocks,p.activityEntries).coverage.recordedMinutes;return [sum(r.start,r.end),r.dates.reduce((n,d)=>n+sum(d,d),0)];});assert.equal(summary[0],summary[1]);assert.equal(Number(await amount().getAttribute('data-activity-minutes')),summary[0]);}
   await page.getByLabel('시간 카테고리 필터',{exact:true}).selectOption('growth');assert.equal(await amount().getAttribute('data-activity-minutes'),'90');await page.getByLabel('시간 카테고리 필터',{exact:true}).selectOption('all');await page.getByRole('button',{name:'주간',exact:true}).click();await page.getByRole('button',{name:'2027-01-01 일간 분석',exact:true}).click();assert.equal(await page.getByRole('button',{name:'일간',exact:true}).getAttribute('aria-pressed'),'true');
  });
  await step('delete failure and retry confirm absence without pretending success; saved rows survive Provider remount',async()=>{
   await record(id).getByRole('button',{name:/기록 삭제$/}).click();await page.evaluate(()=>window.testDb.failNext('activity_entries',{status:0,afterCommit:true}));await dialog('활동 기록 삭제').getByRole('button',{name:'삭제 확인',exact:true}).click();await retry('활동 기록 삭제').waitFor();assert.equal(await record(id).count(),1);await retry('활동 기록 삭제').click();await dialog('활동 기록 삭제').waitFor({state:'hidden'});assert.equal(await record(id).count(),0);
   const saved=await page.evaluate(()=>window.testDb.tables);await page.addInitScript(value=>{window.__moaFixture={tables:value};},saved);await page.reload();await amount().waitFor();await page.waitForFunction(()=>window.__testPlanner.activityStorageStatus==='ready');assert.equal(await amount().getAttribute('data-activity-minutes'),'300');assert.equal(await page.evaluate(()=>window.testDb.requests.length),0);
  });
  await step('Realtime reflects another-device write and failed reads preserve last confirmed records',async()=>{
   await page.evaluate(()=>{window.testDb.tables.activity_entries[0].name='다른 기기에서 바꾼 활동명';window.testDb.emit('activity_entries');});await page.getByText('다른 기기에서 바꾼 활동명',{exact:true}).waitFor();
   const count=await page.evaluate(()=>window.__testPlanner.activityEntries.length);await page.evaluate(()=>{window.testDb.failNext('activity_entries',{status:503,read:true});window.testDb.emit('activity_entries');});await page.waitForFunction(()=>window.__testPlanner.activityStorageStatus==='unavailable');assert.equal(await page.evaluate(()=>window.__testPlanner.activityEntries.length),count);await page.getByRole('button',{name:'기록 다시 불러오기',exact:true}).click();await page.waitForFunction(()=>window.__testPlanner.activityStorageStatus==='ready');
  });
  await step('home and records share actual totals, quick button opens time mode and original app navigation survives',async()=>{
   const before=await amount().getAttribute('data-activity-minutes');await page.getByRole('navigation',{name:'모바일 주요 메뉴'}).getByRole('link',{name:'오늘',exact:true}).click();await page.locator('.mt-greeting').waitFor();assert.equal(await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes'),before);await page.getByRole('button',{name:'빠른 기록',exact:true}).click();await page.getByRole('button',{name:'활동 시간 기록',exact:true}).click();await sheet().waitFor();await sheet().getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('navigation',{name:'모바일 주요 메뉴'}).getByRole('link',{name:'기록',exact:true}).click();await amount().waitFor();
  });
  await step('schema missing, empty data, offline draft and past event outside planner range are honest states',async()=>{
   const missing=await open({tables,faults:[{table:'activity_entries',status:404,code:'PGRST205',read:true}]});assert.match(await missing.locator('.ma-notice').first().innerText(),/スキーマ|스키마/);await missing.getByRole('button',{name:'시간 기록',exact:true}).click();await missing.getByLabel('활동명',{exact:true}).fill('저장하면 안 되는 기록');assert.equal(await missing.getByRole('button',{name:'기록 저장',exact:true}).isDisabled(),true);assert.equal(await missing.evaluate(()=>window.testDb.requests.length),0);await missing.screenshot({path:path.join(output,'mobile-schema-unavailable.png')});await missing.setViewportSize({width:1440,height:1024});await missing.screenshot({path:path.join(output,'desktop-schema-unavailable.png')});await missing.close();
   const coreFail=await open({tables,faults:[{table:'todos',status:503,read:true}]});assert.ok(await coreFail.evaluate(()=>window.__testPlanner.coreTimeReadError));await coreFail.getByRole('button',{name:'할 일·시간 기록 다시 불러오기',exact:true}).click();await coreFail.waitForFunction(()=>!window.__testPlanner.coreTimeReadError);assert.equal(await coreFail.locator('[data-activity-minutes]').getAttribute('data-activity-minutes'),'285');await coreFail.close();
   const eventFail=await open({tables,faults:[{table:'events',status:503,read:true}]});await eventFail.waitForFunction(()=>!!window.__testPlanner.activityEventsError);await eventFail.getByRole('button',{name:'일정 실적 다시 불러오기',exact:true}).click();await eventFail.waitForFunction(()=>!window.__testPlanner.activityEventsError);await eventFail.close();
   const empty=await open({tables:{}});assert.equal(await empty.locator('[data-activity-minutes]').getAttribute('data-activity-minutes'),'0');await empty.screenshot({path:path.join(output,'mobile-empty.png')});await empty.close();
   await page.context().setOffline(true);await add('오프라인 초안');await sheet().getByRole('button',{name:'기록 저장',exact:true}).click();await retry('시간 빠르게 기록').waitFor();assert.equal(await sheet().getByLabel('활동명',{exact:true}).inputValue(),'오프라인 초안');await capture('offline');await page.context().setOffline(false);await retry('시간 빠르게 기록').click();await sheet().waitFor({state:'hidden'});
   await page.getByLabel('분석 날짜',{exact:true}).fill('2015-01-01');assert.equal(await amount().getAttribute('data-activity-minutes'),'0');
   await page.evaluate(()=>{const e=window.testDb.tables.events.find(e=>e.id==='old-event');e.do_start='10:00';e.do_end='10:30';window.testDb.emit('events');});await page.waitForFunction(()=>document.querySelector('[data-activity-minutes]').getAttribute('data-activity-minutes')==='30');
  });
  assert.deepEqual(errors,[]);assert.ok(external.every(url=>/fonts|cdn\.jsdelivr/.test(url)));await writeFile(path.join(output,'validation.json'),JSON.stringify({viewports:[390,1440],shots,pageErrors:errors,externalAttempts:external,transport:'memory only; no production Supabase',fixedDate:'2027-01-01 Asia/Seoul'},null,2)+'\n');
 }finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}
});
