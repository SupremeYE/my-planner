import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
const root=fileURLToPath(new URL('../../',import.meta.url)), output=path.join(root,'docs/screenshots/moamoa-preview-weekly');
const labels=['기억하고 싶은 일','잘한 점 · KEEP','아쉬웠던 점 · NOTICE','다음에 시도할 점 · TRY','다음 주 계획 · NEXT'];
test('Preview weekly review: one confirmed store, ISO history, failures, reset and isolation',{timeout:240000},async t=>{
 execFileSync(process.execPath,['scripts/build-moa-review.mjs'],{cwd:root,stdio:'pipe'});
 const temp=await mkdtemp(path.join(tmpdir(),'weekly-reference-'));
 await build({stdin:{contents:"export {moaTodayData} from './src/lib/moaToday'; export {aggregateActivity} from './src/lib/timeAggregation';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:path.join(temp,'reference.mjs'),logLevel:'silent'});
 const expected=await import(pathToFileURL(path.join(temp,'reference.mjs')).href);
 const dist=path.join(root,'dist-review'),config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
 const server=http.createServer(async(req,res)=>{let file=path.join(dist,new URL(req.url,'http://localhost').pathname),data;try{data=await readFile(file);}catch{file=path.join(dist,'index.html');data=await readFile(file);}for(const[k,v]of Object.entries(config.routes[0].headers))res.setHeader(k,v);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav'})[path.extname(file)]||'text/html');res.end(data);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.HAON_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1024},timezoneId:'Asia/Seoul',locale:'ko-KR',reducedMotion:'reduce',serviceWorkers:'block'});
 page.setDefaultTimeout(12000); const errors=[],outside=[],requests=[],sockets=[],shots=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('websocket',s=>sockets.push(s.url()));
 await page.route('**/*',r=>{if(!r.request().url().startsWith(base)){outside.push(r.request().url());return r.abort();}return r.continue();});
 await page.clock.install({time:new Date('2027-01-01T12:00:00+09:00')});
 // Test-only inspection of the current React tree; no diagnostics are inserted into shipped code.
 await page.addInitScript(()=>{window.__reviewPlanner=()=>{const node=document.getElementById('root');const key=Object.keys(node??{}).find(k=>k.startsWith('__reactContainer$'));const host=key&&node[key];const stack=[host?.stateNode?.current];while(stack.length){const f=stack.pop();if(!f)continue;if(f.memoizedProps?.value?.reviewWeekly)return f.memoizedProps.value;stack.push(f.child,f.sibling);}return null;};});
 const btn=name=>page.getByRole('button',{name,exact:true}), dialog=()=>page.getByRole('dialog',{name:'주간 회고',exact:true}), input=i=>dialog().getByLabel(labels[i],{exact:true});
 const nav=async name=>page.getByRole('navigation',{name:page.viewportSize().width<768?'모바일 주요 메뉴':'주요 메뉴',exact:true}).getByRole('link',{name,exact:true}).click();
 const writes=()=>page.evaluate(()=>window.testDb.requests.filter(r=>r.table==='weekly_reviews'));
 const open=async()=>{await page.getByRole('button',{name:/^주간 회고 (작성|보기·수정)$/}).click();await dialog().waitFor();};
 const close=()=>dialog().getByRole('button',{name:'닫기',exact:true}).click();
 const save=async()=>{await dialog().getByRole('button',{name:'저장',exact:true}).click();await dialog().waitFor({state:'hidden'});};
 const shot=async name=>{await page.screenshot({path:path.join(output,name+'.png')});shots.push(name+'.png');};
 const sync=()=>page.waitForFunction(()=>{const p=window.__reviewPlanner();return p&&!p.reviewWeekly.loading&&!p.reviewWeekly.readError&&p.weeklyReviews===p.reviewWeekly.records;});
 const week=()=>page.locator('[data-review-week]').getAttribute('data-review-week');
 async function step(name,fn){let failure;await t.test(name,async()=>{try{await fn();}catch(e){failure=e;throw e;}});if(failure)throw failure;}
 let baseline,currentId;
 try{
  await mkdir(output,{recursive:true});await page.goto(base+'/calendar?period=week&view=planner');await sync();await btn('주간 회고 작성').waitFor();
  baseline=await page.evaluate(()=>structuredClone(window.testDb.tables));
  await step('same selected week and feature reference values; 390/768/1440 editor and keyboard scroll',async()=>{
   assert.equal(await week(),'2026-W53');
   const p=await page.evaluate(()=>{const p=window.__reviewPlanner();return {todos:p.todos,weeklyGoals:p.weeklyGoals,events:p.events,tags:p.tags,timeBlocks:p.timeBlocks,activityEntries:p.activityEntries,reportEvents:p.reportEvents,habits:p.habits};});
   const dates=['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'];
   const days=dates.map(d=>expected.moaTodayData(d,p.todos,p.weeklyGoals,p.events,p.tags,p.timeBlocks,p.activityEntries,p.reportEvents));
   const minutes=expected.aggregateActivity(p.todos,p.reportEvents,p.tags,dates[0],dates[6],p.timeBlocks,p.activityEntries).coverage.recordedMinutes;
   const done=new Set(days.flatMap(d=>d.dayTodos.filter(x=>x.status==='done').map(x=>x.id))).size;
   for(const[size,width,height]of[['mobile',390,844],['tablet',768,1024],['desktop',1440,1024]]){
    await page.setViewportSize({width,height});await page.locator('.mt-scroll').evaluate(e=>e.scrollTop=0);await shot(size+'-planner-before');await open();
    assert.match(await dialog().innerText(),/2026-12-28.*2027-01-03/);assert.equal(await dialog().locator('textarea').count(),5);await shot(size+'-editor');
    await dialog().locator('.mw-reference summary').click();
    assert.equal(await dialog().locator('[data-review-minutes]').getAttribute('data-review-minutes'),String(minutes));
    assert.equal(await dialog().locator('[data-review-completed]').getAttribute('data-review-completed'),String(done));
    assert.deepEqual(await dialog().locator('[data-review-progress]').evaluateAll(els=>els.map(el=>Number(el.dataset.reviewProgress))),days[0].weeks.map(r=>r.progress.pct));
    for(const habit of p.habits)assert.equal(await dialog().locator(`[data-review-habit="${habit.id}"]`).innerText(),`${new Set(habit.checkedDates.filter(d=>d>=dates[0]&&d<=dates[6])).size}일 체크`);
    await shot(size+'-reference');await dialog().locator('.mw-reference summary').click();
    await input(4).fill('긴 회고도 스크롤해서 작성해요.\n'.repeat(20));await input(4).scrollIntoViewIfNeeded();await shot(size+'-editor-next');
    const b=await dialog().boundingBox(),s=await dialog().getByRole('button',{name:'저장',exact:true}).boundingBox();assert.ok(b.x>=-1&&b.x+b.width<=width+1&&s.y+s.height<=height);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    await close();await btn('계속 작성').click();assert.match(await input(4).inputValue(),/긴 회고/);await page.keyboard.press('Escape');await btn('입력 닫기').click();
   }
   await page.setViewportSize({width:390,height:844});await open();await input(4).focus();await page.setViewportSize({width:390,height:400});await page.waitForFunction(()=>document.querySelector('.mw-dialog button[type="submit"]').getBoundingClientRect().bottom<=400);await shot('mobile-keyboard-height');await close();await page.setViewportSize({width:1440,height:1024});assert.equal((await writes()).length,0);
  });
  await step('one-field create, label/summary and PlannerProvider agree, reopen and empty optional fields',async()=>{
   await open();await input(0).fill('이번 주 직접 쓴 회고');await save();await sync();await btn('주간 회고 보기·수정').waitFor();assert.equal(await page.locator('[data-weekly-review-summary]').innerText(),'이번 주 직접 쓴 회고');
   const saved=(await writes()).at(-1).payload;currentId=saved.id;assert.equal(saved.week_key,'2026-W53');assert.match(currentId,/^[a-f\d-]{36}$/);assert.equal(saved.next_week,'');
   assert.equal(await page.evaluate(()=>window.__reviewPlanner().weeklyReviews.find(r=>r.weekKey==='2026-W53').highlights),'이번 주 직접 쓴 회고');
   await open();assert.equal(await input(0).inputValue(),'이번 주 직접 쓴 회고');for(let i=1;i<5;i++)assert.equal(await input(i).inputValue(),'');await close();
   await btn('다음 기간').click();assert.equal(await week(),'2027-W01');await open();await save();await sync();assert.equal(await page.locator('[data-weekly-review-summary]').innerText(),'내용이 비어 있는 회고예요.');await btn('이전 기간').click();
  });
  await step('partial edit and explicit clear preserve unrelated Realtime changes, original IDs/keys and reference state',async()=>{
   await open();await input(0).fill('');await input(1).fill('꾸준히 해낸 작은 일');
   await page.evaluate(id=>{const row=window.testDb.tables.weekly_reviews.find(r=>r.id===id);row.notice='다른 화면의 발견';row.extra='보존';window.testDb.emit('weekly_reviews');},currentId);
   assert.equal(await input(2).inputValue(),'');await save();await sync();assert.deepEqual((await writes()).at(-1).payload,{highlights:'',kpt_keep:'꾸준히 해낸 작은 일'});
   const r=await page.evaluate(id=>window.testDb.tables.weekly_reviews.find(r=>r.id===id),currentId);assert.equal(r.notice,'다른 화면의 발견');assert.equal(r.week_key,'2026-W53');assert.equal(r.extra,'보존');
   await open();assert.equal(await input(0).inputValue(),'');assert.equal(await input(2).inputValue(),'다른 화면의 발견');await close();
   for(const[size,width,height]of[['mobile',390,844],['tablet',768,1024],['desktop',1440,1024]]){await page.setViewportSize({width,height});await page.locator('.rw-entry').scrollIntoViewIfNeeded();await shot(size+'-saved-summary');}
  });
  await step('past sample, one-digit and canonical/legacy coexistence stay separately editable across ISO boundary',async()=>{
   await btn('이전 기간').click();await open();assert.equal(await input(0).inputValue(),baseline.weekly_reviews[0].highlights);await input(2).fill('과거 회고 수정');await save();await sync();
   assert.equal((await writes()).at(-1).payload.notice,'과거 회고 수정');assert.equal(await page.locator('[data-weekly-review-summary]').getAttribute('data-review-id'),'review-weekly-past');
   await page.evaluate(()=>{window.testDb.tables.weekly_reviews.push({id:'legacy-alias',week_key:'2027-W53',highlights:'레거시 별도 기록',kpt_keep:null,notice:null,kpt_try:null,next_week:''},{id:'one-digit',week_key:'2026-W1',highlights:'한 자리 주차 기억',kpt_keep:null,notice:null,kpt_try:null,next_week:''});window.testDb.emit('weekly_reviews');});
   await btn('다음 기간').click();await page.locator('.rw-collisions').waitFor();await open();assert.equal(await input(1).inputValue(),'꾸준히 해낸 작은 일');await close();
   await page.getByRole('button',{name:/회고 \d+ · 2027-W53/}).click();assert.equal(await input(0).inputValue(),'레거시 별도 기록');await input(2).fill('별칭 회고만 수정');await save();await sync();
   const legacy=await page.evaluate(()=>window.testDb.tables.weekly_reviews.find(r=>r.id==='legacy-alias'));assert.equal(legacy.week_key,'2027-W53');assert.equal(legacy.notice,'별칭 회고만 수정');
   await page.getByLabel('캘린더 날짜',{exact:true}).fill('2025-12-30');assert.equal(await week(),'2026-W01');await open();assert.equal(await input(0).inputValue(),'한 자리 주차 기억');await input(4).fill('새 계획');await save();await sync();assert.equal(await page.evaluate(()=>window.testDb.tables.weekly_reviews.find(r=>r.id==='one-digit').week_key),'2026-W1');
   await page.getByLabel('캘린더 날짜',{exact:true}).fill('2027-01-01');
  });
  await step('failed write keeps draft, blocks double clicks/close and retries without optimistic success',async()=>{
   await open();await input(3).fill('재시도할 TRY');const count=(await writes()).length;
   await page.evaluate(()=>{window.testDb.hold('weekly_reviews');window.testDb.failNext('weekly_reviews',{status:503});});
   await dialog().getByRole('button',{name:'저장',exact:true}).evaluate(b=>{b.click();b.click();document.getElementById('weekly-review-form').requestSubmit();});
   await page.waitForFunction(n=>window.testDb.requests.filter(r=>r.table==='weekly_reviews').length===n+1,count);await btn('주간 회고 닫기').click();await page.keyboard.press('Escape');assert.equal(await dialog().count(),1);
   assert.notEqual(await page.evaluate(id=>window.__reviewPlanner().weeklyReviews.find(r=>r.id===id).kptTry,currentId),'재시도할 TRY');
   await page.evaluate(()=>window.testDb.release('weekly_reviews'));await btn('재시도').waitFor();assert.equal(await input(3).inputValue(),'재시도할 TRY');await shot('desktop-save-failure');
   await btn('재시도').click();await dialog().waitFor({state:'hidden'});await sync();assert.equal(await page.evaluate(id=>window.__reviewPlanner().weeklyReviews.find(r=>r.id===id).kptTry,currentId),'재시도할 TRY');
  });
  await step('lost response and failed readback protect both stores; retry same UUID; memory unique and atomic conflict',async()=>{
   await btn('다음 기간').click();await btn('다음 기간').click();assert.equal(await week(),'2027-W02');await open();await input(0).fill('응답 유실에도 한 번만');
   const count=(await writes()).length;await page.evaluate(()=>{window.testDb.hold('weekly_reviews');window.testDb.failNext('weekly_reviews',{status:0,afterCommit:true});});
   await dialog().getByRole('button',{name:'저장',exact:true}).click();await page.waitForFunction(n=>window.testDb.requests.filter(r=>r.table==='weekly_reviews').length===n+1,count);
   await page.evaluate(()=>{window.testDb.failNext('weekly_reviews',{read:true,status:503});window.testDb.failNext('weekly_reviews',{read:true,status:503});window.testDb.release('weekly_reviews');});
   await btn('재시도').waitFor();const id=(await writes()).at(-1).payload.id;
   assert.equal(await page.evaluate(id=>window.testDb.tables.weekly_reviews.filter(r=>r.id===id).length,id),1);
   assert.equal(await page.evaluate(id=>window.__reviewPlanner().weeklyReviews.some(r=>r.id===id),id),false,'No unconfirmed global success');
   await btn('재시도').click();await dialog().waitFor({state:'hidden'});await sync();assert.equal((await writes()).length,count+1);assert.equal(await page.locator('[data-weekly-review-summary]').getAttribute('data-review-id'),id);
   await open();await input(1).fill('조건부 수정');await page.evaluate(()=>window.testDb.hold('weekly_reviews'));const c=(await writes()).length;await dialog().getByRole('button',{name:'저장',exact:true}).click();await page.waitForFunction(n=>window.testDb.requests.filter(r=>r.table==='weekly_reviews').length===n+1,c);
   await page.evaluate(id=>{window.testDb.tables.weekly_reviews.find(r=>r.id===id).kpt_keep='다른 기기의 KEEP';window.testDb.release('weekly_reviews');},id);
   await dialog().getByRole('alert').waitFor();assert.match(await dialog().getByRole('alert').innerText(),/저장 중 회고가 변경/);assert.equal(await input(1).inputValue(),'조건부 수정');await close();await btn('입력 닫기').click();await sync();
   // Force a duplicate response through the same sample controller, bypassing the UI preflight only at transport level.
   await page.evaluate(()=>window.testDb.failNext('weekly_reviews',{status:409,code:'23505'}));await open();await input(4).fill('중복 거부 모의');await dialog().getByRole('button',{name:'저장',exact:true}).click();await dialog().getByRole('alert').waitFor();assert.equal(await btn('재시도').count(),0);await close();await btn('입력 닫기').click();await sync();
  });
  await step('read failure is distinct from absence; navigation remount preserves confirmed rows and calendar state',async()=>{
   await page.evaluate(()=>{window.testDb.failNext('weekly_reviews',{read:true,status:503});window.testDb.emit('weekly_reviews');});await btn('회고 다시 불러오기').waitFor();assert.equal(await btn('주간 회고 보기·수정').isDisabled(),true);await btn('회고 다시 불러오기').click();await sync();
   const records=await page.evaluate(()=>window.__reviewPlanner().weeklyReviews);
   await nav('기록');await page.getByRole('heading',{name:'시간 분석',exact:true}).first().waitFor();await nav('캘린더');await btn('주간 플래너').click();await sync();
   assert.deepEqual(await page.evaluate(()=>window.__reviewPlanner().weeklyReviews),records);assert.equal(await week(),'2026-W53');await open();assert.equal(await input(1).inputValue(),'꾸준히 해낸 작은 일');await close();
   const untouched=await page.evaluate(()=>{const t=window.testDb.tables;return {todos:t.todos,weekly_goals:t.weekly_goals,todo_time_blocks:t.todo_time_blocks,activity_entries:t.activity_entries,habits:t.habits};});
   assert.deepEqual(untouched,Object.fromEntries(Object.keys(untouched).map(k=>[k,baseline[k]])));
  });
  await step('refresh and sample reset restore every original review and all other media samples',async()=>{
   await page.reload();await sync();await btn('주간 플래너').click();assert.deepEqual(await page.evaluate(()=>window.testDb.tables.weekly_reviews),baseline.weekly_reviews);await btn('주간 회고 작성').waitFor();
   await open();await input(0).fill('초기화할 기록');await save();await sync();await page.getByRole('button',{name:'샘플 초기화',exact:true}).filter({visible:true}).click();await page.waitForLoadState();await sync();
   assert.deepEqual(await page.evaluate(()=>window.testDb.tables.weekly_reviews),baseline.weekly_reviews);
   for(const table of ['books','music_records','culture_records','food_records'])assert.deepEqual(await page.evaluate(t=>window.testDb.tables[t],table),baseline[table]);
   await open();await input(0).fill('주차 경계에서도 선택한 주에 저장');await dialog().locator('.mw-reference summary').click();
   const minutes=await dialog().locator('[data-review-minutes]').getAttribute('data-review-minutes');
   await page.clock.setSystemTime(new Date('2027-01-04T03:00:00+09:00'));await page.clock.runFor(15001);
   assert.equal(await week(),'2027-W01');assert.match(await dialog().innerText(),/2026-12-28.*2027-01-03/);
   assert.equal(await dialog().locator('[data-review-minutes]').getAttribute('data-review-minutes'),minutes);await save();await sync();
   assert.equal((await writes()).at(-1).payload.week_key,'2026-W53');
  });
  await step('CSP, disabled API/Storage, no actual SDK or service worker and sidebar navigation retained',async()=>{
   const csp=config.routes[0].headers['Content-Security-Policy'];assert.match(csp,/connect-src 'none'/);assert.match(csp,/form-action 'none'/);
   assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);assert.ok(requests.every(r=>r.method==='GET'&&!/\/api\/|\/storage\//.test(r.url)));
   assert.equal(await page.evaluate(()=>navigator.serviceWorker.getRegistrations().then(r=>r.length)),0);
   assert.equal(await page.locator('.mr-collapse .lucide-menu').count(),1);
   assert.equal(await page.getByRole('button',{name:'사이드바 접기',exact:true}).getAttribute('aria-expanded'),'true');
  });
  await writeFile(path.join(output,'validation.json'),JSON.stringify({shots,viewports:[390,768,1440],errors,outside,sockets,httpRequests:requests.length,featureReferenceMatches:true,sharedConfirmedStore:true,reset:true,physicalKeyboard:'not tested; focused viewport resize only'},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
});
