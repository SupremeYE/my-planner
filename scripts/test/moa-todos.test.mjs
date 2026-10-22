// Real application/Auth/Provider/codecs; only the transport is in-memory.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { tables } from './fixtures/moa-todos-data.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'docs/screenshots/moamoa-todos');


test('Moa TODOs: CRUD, categories/tags, goal links, manual actuals and confirmed retries', { timeout: 360000 }, async t => {
 const cacheDir = await mkdtemp(path.join(tmpdir(), 'moa-todos-'));
 const port = await new Promise(resolve => { const sock=net.createServer(); sock.listen(0,'127.0.0.1',()=>{const p=sock.address().port;sock.close(()=>resolve(p));}); });
 const server = await createServer({root,cacheDir,logLevel:'error',plugins:[{name:'isolated-moa-todos',enforce:'pre',
  resolveId(source){if (/(?:^\.\/supabase|\/lib\/supabase)$/.test(source)) return path.join(root,'scripts/test/fixtures/moa-today-supabase.ts');},
  transform(code,id){if(id.endsWith('/src/app/store.tsx'))return code.replace('return ctx;', 'window.__testPlanner = ctx; return ctx;');},
 }],server:{host:'127.0.0.1',port,strictPort:true}});
 let browser;const errors=[],external=[],shots=[];
 try {
  await server.listen();const base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({executablePath:process.env.HAON_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({timezoneId:'Asia/Seoul',serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(base)){external.push(url);return route.abort();}return route.continue();});
  const open=async (fixture=tables)=>{const page=await context.newPage();page.setDefaultTimeout(7000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.setViewportSize({width:390,height:844});await page.clock.install({time:new Date('2027-01-01T12:00:00+09:00')});await page.addInitScript(value=>{window.__moaFixture={tables:value};},fixture);await page.goto(`${base}/__moamoa-todos`);await page.locator('.mx-list-card').waitFor();await page.waitForFunction(()=>window.__testPlanner&&!window.__testPlanner.isLoading);return page;};
  await mkdir(output,{recursive:true});const page=await open();
  const dialog=name=>page.getByRole('dialog',{name,exact:true});
  const row=id=>page.locator(`[data-todo-id="${id}"]`);
  const retry=name=>dialog(name).getByRole('button',{name:'재시도',exact:true});
  const title=()=>dialog('할 일 추가').getByLabel('할 일 제목',{exact:true});
  async function shotsFor(name){for(const [label,width,height] of [['mobile',390,844],['desktop',1440,1024]]){await page.setViewportSize({width,height});const dim=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth,overflowing:[...document.querySelectorAll('.mx-list-card,.mx-todo-row,.mx-dialog')].filter(el=>el.clientWidth&&el.scrollWidth>el.clientWidth+2).map(el=>el.className)}));assert.equal(dim.document,width);assert.deepEqual(dim.overflowing,[]);await page.screenshot({path:path.join(output,`${label}-${name}.png`)});shots.push({name:`${label}-${name}`,width,height,...dim});}await page.setViewportSize({width:390,height:844});}
  async function addTitle(text){await page.getByRole('button',{name:'할 일 추가',exact:true}).first().click();await title().fill(text);}
  async function openEdit(id){await row(id).getByRole('button',{name:/상세 보기$/}).click();await dialog('할 일 상세').getByRole('button',{name:'수정',exact:true}).click();}
  async function saveEdit(){await dialog('할 일 수정').getByRole('button',{name:'저장',exact:true}).click();await dialog('할 일 수정').waitFor({state:'hidden'});}
  async function step(name, fn) {
    let failure;
    await t.test(name, async () => { try { await fn(); } catch (error) { failure = error; throw error; } });
    if (failure) throw failure;
  }
  let createdId;
  await step('responsive real data list, small visual checks with 44px hit targets, combined filters',async()=>{
   assert.equal(await page.getByRole('heading',{name:'할 일',exact:true}).count(),1);
   assert.equal(await page.evaluate(()=>window.testDb.requests.length),0);
   await shotsFor('list');
   const targets=await page.locator('.mx-check-hit').evaluateAll(els=>els.map(el=>({w:el.offsetWidth,h:el.offsetHeight,visual:el.firstElementChild.offsetWidth})));
   assert.ok(targets.every(t=>t.w>=44&&t.h>=44&&t.visual>=24&&t.visual<=28));
   await page.getByRole('button',{name:'필터',exact:true}).click();
   await page.getByLabel('태그 필터',{exact:true}).selectOption('work');await page.getByLabel('목표 필터',{exact:true}).selectOption('w1');await page.getByLabel('상태 필터',{exact:true}).selectOption('open');
   assert.equal(await page.locator('[data-todo-id]').count(),1);assert.equal(await row('t1').count(),1);
   await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
  });
  await step('today/week/undated tabs use the same records and missing week assignments are not invented',async()=>{
   await page.getByRole('button',{name:'이번 주',exact:true}).click();assert.equal(await row('undated').count(),1);
   await page.getByRole('button',{name:'날짜 미정',exact:true}).click();assert.equal(await row('undated').count(),1);assert.equal(await row('t1').count(),0);
   await page.getByRole('button',{name:'오늘',exact:true}).click();assert.equal(await row('t1').count(),1);assert.equal(await page.evaluate(()=>window.testDb.requests.length),0);
  });
  await step('title-only create waits for confirmation; duplicate submits and lost acknowledgement retry create one row',async()=>{
   await addTitle('블로그 후기 작성');await shotsFor('add');
   await page.evaluate(()=>{window.testDb.hold('todos');window.testDb.failNext('todos',{status:0,afterCommit:true});});
   await dialog('할 일 추가').locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
   await page.waitForFunction(()=>window.__testPlanner.saveStates.some(s=>s.status==='saving'));
   assert.equal(await title().inputValue(),'블로그 후기 작성');assert.equal(await page.evaluate(()=>window.__testPlanner.todos.some(t=>t.text==='블로그 후기 작성')),false);
   await page.evaluate(()=>window.testDb.release('todos'));await retry('할 일 추가').waitFor();await shotsFor('save-failure');
   await retry('할 일 추가').click();await dialog('할 일 추가').waitFor({state:'hidden'});
   const created=await page.evaluate(()=>window.testDb.tables.todos.filter(t=>t.text==='블로그 후기 작성'));assert.equal(created.length,1);createdId=created[0].id;
   assert.equal(created[0].date,'2027-01-01');assert.deepEqual(created[0].tags,[]);assert.equal(created[0].weekly_goal_id,null);assert.equal(created[0].status,'active');
  });
  await step('edit selects one time category, multiple normal tags, optional goal and planned times',async()=>{
   await openEdit(createdId);let edit=dialog('할 일 수정');
   await edit.getByRole('button',{name:'대표 카테고리 선택',exact:true}).click();
   await dialog('대표 시간 카테고리 선택').getByRole('radio',{name:'업무',exact:true}).click();await shotsFor('time-category');await dialog('대표 시간 카테고리 선택').getByRole('button',{name:'선택 적용',exact:true}).click();
   await edit.getByRole('button',{name:'태그',exact:true}).click();
   await dialog('추가 태그 선택').getByRole('checkbox',{name:'블로그',exact:true}).click();await dialog('추가 태그 선택').getByRole('checkbox',{name:'독서',exact:true}).click();await shotsFor('tag-picker');
   await dialog('추가 태그 선택').getByRole('button',{name:'선택 적용',exact:true}).click();
   await edit.getByRole('button',{name:'연결 목표 선택',exact:true}).click();await dialog('목표 연결').getByRole('radio',{name:/나의 속도로 프로젝트/}).click();await shotsFor('goal-picker');await dialog('목표 연결').getByRole('button',{name:'목표 선택 적용',exact:true}).click();
   await edit.getByLabel('할 일 구분',{exact:true}).selectOption('project');
   await edit.getByRole('button',{name:'예정 시간',exact:true}).click();await edit.getByLabel('시작 예정 시간',{exact:true}).fill('10:00');await edit.getByLabel('종료 예정 시간',{exact:true}).fill('11:00');
   await shotsFor('edit');await saveEdit();
   const record=await page.evaluate(id=>window.testDb.tables.todos.find(t=>t.id===id),createdId);
   assert.deepEqual(new Set(record.tags),new Set(['work','blog','read']));assert.equal(record.weekly_goal_id,'w1');assert.equal(record.category,'project');assert.equal(record.plan_start,'10:00');assert.equal(record.do_start,null);
   assert.equal(await row(createdId).locator('[data-goal-progress]').getAttribute('data-goal-progress'),'25');
  });
  await step('normal completion and linked completion change rollups without creating any duration',async()=>{
   const before=await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes');
   await page.evaluate(()=>window.testDb.failNext('todos',{status:503}));await row('plain').getByRole('checkbox').click();await page.getByRole('alert').waitFor();assert.equal(await row('plain').getByRole('checkbox').getAttribute('aria-checked'),'false');await page.getByRole('button',{name:'재시도',exact:true}).click();await page.waitForFunction(()=>window.__testPlanner.todos.find(t=>t.id==='plain').status==='done');
   await row(createdId).getByRole('checkbox').click();await page.waitForFunction(id=>window.__testPlanner.todos.find(t=>t.id===id).status==='done',createdId);
   assert.equal(await row(createdId).locator('[data-goal-progress]').getAttribute('data-goal-progress'),'50');
   assert.equal(await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes'),before);
   await row(createdId).getByRole('checkbox').click();await page.waitForFunction(id=>window.__testPlanner.todos.find(t=>t.id===id).status==='active',createdId);
  });
  await step('manual 90 minutes stores no clock times, keeps status and updates the shared aggregation exactly once',async()=>{
   const before=Number(await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes'));
   await row(createdId).getByRole('button',{name:/상세 보기$/}).click();await dialog('할 일 상세').getByRole('button',{name:'시간 기록',exact:true}).click();
   await dialog('실제 시간 기록').getByRole('button',{name:'60분',exact:true}).click();await dialog('실제 시간 기록').getByLabel('소요 시간 (분)',{exact:true}).fill('90');await shotsFor('time-record');
   await page.evaluate(()=>window.testDb.failNext('todo_time_blocks',{status:0,afterCommit:true}));
   await dialog('실제 시간 기록').getByRole('button',{name:'시간 저장',exact:true}).click();await retry('실제 시간 기록').waitFor();
   assert.equal(Number(await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes')),before);
   await retry('실제 시간 기록').click();await dialog('실제 시간 기록').waitFor({state:'hidden'});
   const records=await page.evaluate(id=>window.testDb.tables.todo_time_blocks.filter(b=>b.todo_id===id),createdId);assert.equal(records.length,1);assert.equal(records[0].elapsed_sec,5400);assert.equal(records[0].start_time,null);assert.equal(records[0].end_time,null);
   assert.equal(Number(await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes')),before+90);assert.equal(await page.evaluate(id=>window.__testPlanner.todos.find(t=>t.id===id).status,createdId),'active');
  });
  await step('tag create/edit/delete are real confirmed actions; used tags and out-of-range event references are protected',async()=>{
   await page.getByRole('button',{name:'태그 관리',exact:true}).click();const manager=dialog('태그 관리');
   await manager.getByLabel('태그명',{exact:true}).fill('틈틈탐색기');await manager.getByLabel('태그 색상',{exact:true}).fill('#887755');await shotsFor('tag-management');
   await page.evaluate(()=>window.testDb.failNext('tags',{status:503}));await manager.getByRole('button',{name:'태그 저장',exact:true}).click();await retry('태그 관리').waitFor();
   assert.equal(await manager.getByLabel('태그명',{exact:true}).inputValue(),'틈틈탐색기');assert.equal(await page.evaluate(()=>window.__testPlanner.tags.some(t=>t.name==='틈틈탐색기')),false);
   await retry('태그 관리').click();await page.waitForFunction(()=>window.__testPlanner.tags.some(t=>t.name==='틈틈탐색기'));
   await manager.getByRole('button',{name:'틈틈탐색기 태그 수정',exact:true}).click();await manager.getByLabel('태그명',{exact:true}).fill('탐색 기록');await manager.getByLabel('태그 용도',{exact:true}).selectOption('time');await manager.getByRole('button',{name:'태그 저장',exact:true}).click();await page.waitForFunction(()=>window.__testPlanner.tags.some(t=>t.name==='탐색 기록'&&t.trackTime));
   await manager.getByRole('button',{name:'탐색 기록 태그 삭제',exact:true}).click();await page.waitForFunction(()=>!window.__testPlanner.tags.some(t=>t.name==='탐색 기록'));
   const before=await page.evaluate(()=>window.testDb.requests.length);
   await manager.getByRole('button',{name:'업무 태그 삭제',exact:true}).click();await manager.getByRole('alert').waitFor();assert.equal(await retry('태그 관리').count(),0);assert.equal(await page.evaluate(()=>window.testDb.requests.length),before);
   await manager.getByRole('button',{name:'저장 알림 닫기',exact:true}).click();
   await manager.getByRole('button',{name:'옛 일정 태그 태그 삭제',exact:true}).click();await manager.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.__testPlanner.tags.some(t=>t.id==='old-event-tag')),true);
   await manager.getByRole('button',{name:'저장 알림 닫기',exact:true}).click();
   await manager.getByRole('button',{name:'업무 태그 수정',exact:true}).click();await manager.getByLabel('태그 용도',{exact:true}).selectOption('normal');await manager.getByRole('button',{name:'태그 저장',exact:true}).click();await manager.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.__testPlanner.tags.find(t=>t.id==='work').trackTime),true);
   await manager.getByRole('button',{name:'저장 알림 닫기',exact:true}).click();await manager.getByRole('button',{name:'돌아가기',exact:true}).click();
  });
  await step('tag and goal removal are independent; legacy multi-tag editing preserves the split array',async()=>{
   await openEdit(createdId);const edit=dialog('할 일 수정');
   await edit.getByRole('button',{name:'독서 태그 선택 해제',exact:true}).click();await edit.getByRole('button',{name:'연결 목표 선택',exact:true}).click();await dialog('목표 연결').getByRole('radio',{name:'연결 안 함',exact:true}).click();await dialog('목표 연결').getByRole('button',{name:'목표 선택 적용',exact:true}).click();await saveEdit();
   let record=await page.evaluate(id=>window.testDb.tables.todos.find(t=>t.id===id),createdId);assert.deepEqual(new Set(record.tags),new Set(['work','blog']));assert.equal(record.weekly_goal_id,null);
   const beforeTotal=await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes');await openEdit(createdId);await dialog('할 일 수정').getByRole('button',{name:'대표 카테고리 선택',exact:true}).click();await dialog('대표 시간 카테고리 선택').getByRole('radio',{name:'선택 안 함 · 미분류',exact:true}).click();await dialog('대표 시간 카테고리 선택').getByRole('button',{name:'선택 적용',exact:true}).click();await saveEdit();assert.deepEqual(await page.evaluate(id=>window.testDb.tables.todos.find(t=>t.id===id).tags,createdId),['blog']);assert.equal(await page.locator('[data-recorded-minutes]').getAttribute('data-recorded-minutes'),beforeTotal);assert.match(await page.locator('.mx-summary').innerText(),/미분류 1시간 45분/);
   await openEdit('legacy-split');assert.match(await dialog('할 일 수정').innerText(),/기존 2개 · 균등 분할/);await dialog('할 일 수정').getByLabel('할 일 제목',{exact:true}).fill('기존 분할을 보존한 할 일');await saveEdit();
   assert.deepEqual(await page.evaluate(()=>window.testDb.tables.todos.find(t=>t.id==='legacy-split').tags),['work','life']);
  });
  await step('first manual block preserves legacy duration, does not invent new clock times and matches daily/week totals',async()=>{
   await row('legacy-clock').getByRole('button',{name:/상세 보기$/}).click();await dialog('할 일 상세').getByRole('button',{name:'시간 기록',exact:true}).click();await dialog('실제 시간 기록').getByRole('button',{name:'15분',exact:true}).click();await dialog('실제 시간 기록').getByLabel('시간 기록 날짜',{exact:true}).fill('2027-01-02');await dialog('실제 시간 기록').getByRole('button',{name:'시간 저장',exact:true}).click();await dialog('실제 시간 기록').waitFor({state:'hidden'});
   const blocks=await page.evaluate(()=>window.testDb.tables.todo_time_blocks.filter(b=>b.todo_id==='legacy-clock'));assert.equal(blocks.length,2);assert.equal(blocks.find(b=>b.date==='2027-01-01').elapsed_sec,3600);assert.equal(blocks.find(b=>b.date==='2027-01-02').start_time,null);
   const values=await page.evaluate(async()=>{const {aggregateActivity}=await import('/src/lib/timeAggregation.ts');const p=window.__testPlanner;const args=[p.todos.filter(t=>t.id==='legacy-clock'),[],p.tags];const blocks=p.timeBlocks.filter(b=>b.todoId==='legacy-clock');return ['2027-01-01','2027-01-02'].map(date=>aggregateActivity(...args,date,date,blocks).coverage.recordedMinutes).concat(aggregateActivity(...args,'2026-12-28','2027-01-03',blocks).coverage.recordedMinutes);});assert.deepEqual(values,[60,15,75]);
  });
  await step('safe TODO delete confirms absence/retries; recorded tasks retain their blocks when archived',async()=>{
   await addTitle('삭제 검증 할 일');await dialog('할 일 추가').getByRole('button',{name:'저장',exact:true}).click();await dialog('할 일 추가').waitFor({state:'hidden'});const id=await page.evaluate(()=>window.__testPlanner.todos.find(t=>t.text==='삭제 검증 할 일').id);
   await row(id).getByRole('button',{name:/상세 보기$/}).click();await dialog('할 일 상세').getByRole('button',{name:'삭제',exact:true}).click();await page.evaluate(()=>window.testDb.failNext('todos',{status:0,afterCommit:true}));await dialog('할 일 삭제 확인').getByRole('button',{name:'삭제 확인',exact:true}).click();await retry('할 일 삭제 확인').waitFor();assert.equal(await row(id).count(),1);await retry('할 일 삭제 확인').click();await dialog('할 일 삭제 확인').waitFor({state:'hidden'});assert.equal(await row(id).count(),0);
   await row(createdId).getByRole('button',{name:/상세 보기$/}).click();await dialog('할 일 상세').getByRole('button',{name:'삭제',exact:true}).click();await dialog('할 일 삭제 확인').getByRole('button',{name:'취소 상태로 보관',exact:true}).click();await dialog('할 일 삭제 확인').waitFor({state:'hidden'});assert.equal(await page.evaluate(id=>window.testDb.tables.todo_time_blocks.filter(b=>b.todo_id===id).length,createdId),1);assert.equal(await page.evaluate(id=>window.__testPlanner.todos.find(t=>t.id===id).status,createdId),'cancelled');
  });
  await step('realtime reads preserve failed records, refresh rereads persisted rows and same TODO opens on Today',async()=>{
   await page.evaluate(()=>{window.testDb.tables.todos.find(t=>t.id==='plain').text='다른 기기에서 수정';window.testDb.emit('todos');});await row('plain').getByRole('button',{name:'다른 기기에서 수정',exact:true}).waitFor();
   const tagCount=await page.evaluate(()=>window.__testPlanner.tags.length);await page.evaluate(()=>{window.testDb.failNext('tags',{status:503,read:true});window.testDb.emit('tags');});await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>window.__testPlanner.tags.length),tagCount);
   const persisted=await page.evaluate(()=>window.testDb.tables);await page.addInitScript(value=>{window.__moaFixture={tables:value};},persisted);await page.reload();await page.locator('.mx-list-card').waitFor();await page.getByRole('button',{name:'필터',exact:true}).click();await page.getByLabel('상태 필터',{exact:true}).selectOption('all');await row(createdId).waitFor();assert.equal(await page.evaluate(()=>window.testDb.requests.length),0);
   await page.getByRole('navigation',{name:'모바일 주요 메뉴'}).getByRole('link',{name:'오늘',exact:true}).click();await page.locator('.mt-greeting').waitFor();assert.equal(await page.locator('[data-todo-id="t1"]').count(),1);await page.getByRole('navigation',{name:'모바일 주요 메뉴'}).getByRole('link',{name:'할 일',exact:true}).click();await row('plain').waitFor();
  });
  await step('an edit after another-device deletion keeps its draft and never reports a successful save',async()=>{
   const stale=await open(tables);await stale.locator('[data-todo-id="plain"]').getByRole('button',{name:/상세 보기$/}).click();await stale.getByRole('dialog',{name:'할 일 상세',exact:true}).getByRole('button',{name:'수정',exact:true}).click();
   const edit=stale.getByRole('dialog',{name:'할 일 수정',exact:true});await edit.getByLabel('할 일 제목',{exact:true}).fill('다른 기기 삭제 뒤 보존할 초안');
   await stale.evaluate(()=>{window.testDb.tables.todos=window.testDb.tables.todos.filter(t=>t.id!=='plain');window.testDb.emit('todos');});await stale.waitForFunction(()=>!window.__testPlanner.todos.some(t=>t.id==='plain'));
   await edit.getByRole('button',{name:'저장',exact:true}).click();await edit.getByRole('alert').waitFor();assert.equal(await edit.getByLabel('할 일 제목',{exact:true}).inputValue(),'다른 기기 삭제 뒤 보존할 초안');assert.equal(await stale.evaluate(()=>window.testDb.tables.todos.some(t=>t.id==='plain')),false);await stale.close();
  });
  await step('empty/offline feedback and long titles render with no seeded records or horizontal clipping',async()=>{
   const empty=await open({});assert.equal(await empty.locator('[data-todo-id]').count(),0);assert.equal(await empty.evaluate(()=>window.testDb.requests.length),0);await empty.screenshot({path:path.join(output,'mobile-empty.png')});
   await context.setOffline(true);await empty.getByText(/오프라인이에요/).waitFor();await empty.screenshot({path:path.join(output,'mobile-offline.png')});await context.setOffline(false);await empty.close();
   const long=structuredClone(tables);long.todos[0].text='길고 긴 할 일 제목을 안전하게 표시해요 '.repeat(18);const longPage=await open(long);
   assert.equal(await longPage.evaluate(()=>document.documentElement.scrollWidth),390);assert.ok(await longPage.locator('[data-todo-id="t1"]').evaluate(el=>el.scrollWidth<=el.clientWidth));
   await longPage.screenshot({path:path.join(output,'mobile-long-title.png')});await longPage.close();
  });
  assert.ok(external.every(url=>/^https:\/\/(fonts.googleapis.com|fonts.gstatic.com|cdn.jsdelivr.net)\//.test(url)));assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'validation.json'),JSON.stringify({fixture:'Isolated memory transport; Asia/Seoul 2027-01-01',shots,errors,blockedExternalFonts:[...new Set(external)]},null,2));
 }finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}
});
