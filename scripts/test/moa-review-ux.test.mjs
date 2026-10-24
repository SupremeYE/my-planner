import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const root=fileURLToPath(new URL('../../',import.meta.url));
const before=process.env.MOA_UX_BEFORE==='1';
const output=path.join(root,'docs/screenshots/moamoa-preview-ux',before?'before':'after');
test('Preview calendar untimed placement and understandable copy at 390/768/1440', {timeout:180000},async()=>{
  if(!before)execFileSync(process.execPath,['scripts/build-moa-review.mjs'],{cwd:root,stdio:'pipe'});
  const dist=path.join(root,'dist-review'),config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
  const server=http.createServer(async(req,res)=>{
    let file=path.join(dist,new URL(req.url,'http://localhost').pathname),data;
    try{data=await readFile(file);}catch{file=path.join(dist,'index.html');data=await readFile(file);}
    for(const [key,value] of Object.entries(config.routes[0].headers))res.setHeader(key,value);
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/html');res.end(data);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`,results=[];
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  await mkdir(output,{recursive:true});
  try{for(const [size,width,height] of [['mobile',390,844],['tablet',768,1024],['desktop',1440,1024]]){
    const page=await browser.newPage({viewport:{width,height},timezoneId:'Asia/Seoul',locale:'ko-KR',reducedMotion:'reduce'});
    const errors=[],outside=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
    await page.route('**/*',r=>{if(!r.request().url().startsWith(base)){outside.push(r.request().url());return r.abort();}return r.continue();});
    const btn=name=>page.getByRole('button',{name,exact:true});
    const nav=name=>page.getByRole('navigation',{name:width<768?'모바일 주요 메뉴':'주요 메뉴',exact:true}).getByRole('link',{name,exact:true}).click();
    const shots=[];const shot=async name=>{await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);const file=`${size}-${name}.png`;await page.screenshot({path:path.join(output,file)});shots.push(file);};
    await page.goto(base+'/calendar');await page.locator('.rc-schedule').waitFor();
    const date=await page.getByLabel('캘린더 날짜',{exact:true}).inputValue();
    const other=await page.evaluate(date=>{
      const db=window.testDb,t=db.tables.todos.find(t=>t.id==='t1');t.plan_start=null;t.plan_end=null;
      const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(d.getUTCDay()===0?-1:1));const other=d.toISOString().slice(0,10);
      for(let i=0;i<5;i++)db.tables.todos.push({id:`ux-more-${i}`,text:`시간 미지정 추가 ${i+1}`,date,status:'active',tags:[],is_top3:false});
      db.tables.todos.push({id:'ux-other-day',text:'다른 날짜 할 일',date:other,status:'active',tags:[],is_top3:false});
      db.tables.events.push({id:'ux-all-day',title:'종일 일정 확인',start_at:date+'T00:00:00+09:00',end_at:date+'T23:59:00+09:00',is_all_day:true,repeat_type:'none',tags:[]});
      db.tables.someday_seeds.push({id:'ux-grown',text:'완료된 버킷 문장 보존',status:'grown',kind:'do',created_at:new Date().toISOString()});
      db.emit('todos');db.emit('events');return other;
    },date);
    await page.waitForTimeout(400);
    await shot('calendar-week');
    const timed=page.locator('.rc-grid-scroll');await timed.evaluate(e=>e.scrollTop=e.scrollHeight);await shot('calendar-week-bottom');
    if(!before){
      const top=page.getByRole('region',{name:'시간 미지정 할 일 · 종일 일정',exact:true});await top.waitFor();
      assert.equal(await timed.locator('.rc-untimed, [data-todo-id]').count(),0);
      assert.equal(await top.locator('[data-todo-id="t1"]').count(),1);
      assert.equal(await page.locator('.rc-schedule [data-todo-id="undated"]').count(),0);
      assert.equal(await top.getByText('종일 일정 확인',{exact:true}).count(),1);
      const topBox=await top.boundingBox(),gridBox=await timed.boundingBox();assert.ok(topBox.y+topBox.height<=gridBox.y);
      assert.equal(await top.locator(`[data-untimed-date="${date}"]`).count(),1);
      if(width===1440)assert.equal(await top.locator(`[data-untimed-date="${other}"] [data-todo-id="ux-other-day"]`).count(),1);
      const more=top.locator(`[data-untimed-date="${date}"] details`);await more.locator('summary').click();
      await page.locator('[data-todo-id="ux-more-4"]').waitFor({state:'visible'});await shot('calendar-expanded');await more.locator('summary').click();
      await page.getByRole('region',{name:'시각 없이 기록한 실제 활동',exact:true}).waitFor();
      assert.equal(await page.locator('.rc-actual-untimed .rc-duration').count()>0,true);
      assert.equal(await page.locator('.rc-grid-scroll .rc-duration').count(),0);
      await page.locator('.mt-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
      const last=await page.locator('.rc-period-total').boundingBox(),fab=await page.locator('.mt-quick').boundingBox();
      assert.ok(last.y+last.height<fab.y,'calendar bottom content clears FAB and navigation');
      assert.equal(await page.locator('[data-todo-id="t1"]').count(),1,'no duplicate after scrolling both containers');
      await shot('calendar-page-bottom');
    }
    await btn('일간').click();await page.getByRole('region',{name:'일간 일정',exact:true}).waitFor();await page.locator('.mt-scroll').evaluate(e=>e.scrollTop=0);await shot('calendar-day');
    if(!before){
      assert.equal(await page.locator('[data-untimed-date]').count(),1);assert.equal(await page.locator('[data-todo-id="ux-other-day"]').count(),0);
      const summary=await page.locator('.rc-period-total').textContent();
      await btn('이전 기간').click();assert.notEqual(await page.getByLabel('캘린더 날짜',{exact:true}).inputValue(),date);await btn('다음 기간').click();
      assert.equal(await page.getByLabel('캘린더 날짜',{exact:true}).inputValue(),date);
      const original=await page.evaluate(()=>structuredClone(window.testDb.tables));
      await btn('주간').click();await btn('주간 플래너').click();const progress=await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress');
      const minutes=await page.locator('[data-calendar-minutes]').getAttribute('data-calendar-minutes');
      await btn('주간 일정').click();const check=page.locator('[data-todo-id="t1"] [role="checkbox"]');
      await page.evaluate(()=>window.testDb.failNext('todos',{status:503}));await check.click();await btn('재시도').waitFor();assert.equal(await check.getAttribute('aria-checked'),'false');
      await btn('재시도').click();await page.locator('[data-todo-id="t1"] [aria-checked="true"]').waitFor();
      await btn('주간 플래너').click();assert.notEqual(await page.locator('[data-goal-id="w1"]').getAttribute('data-goal-progress'),progress);
      assert.equal(await page.locator('[data-calendar-minutes]').getAttribute('data-calendar-minutes'),minutes);
      assert.equal(await page.locator('[data-todo-id="undated"]').count(),1);
      const changed=await page.evaluate(()=>window.testDb.tables);assert.deepEqual(changed.activity_entries,original.activity_entries);assert.deepEqual(changed.todo_time_blocks,original.todo_time_blocks);
      await btn('일간').click();assert.equal(await page.locator('.rc-period-total').textContent(),summary);
      // Restore the completion state so before/after screenshots use the same visible data.
      await page.locator('[data-todo-id="t1"] [role="checkbox"]').click();
      await page.locator('[data-todo-id="t1"] [aria-checked="false"]').waitFor();
      if(await btn('닫기').count())await btn('닫기').first().click();
    }
    await btn('주간').click();await btn('주간 플래너').click();await page.locator('.mt-scroll').evaluate(e=>e.scrollTop=0);await shot('planner');
    await btn(before?'주간 회고 열기':'주간 회고 보기').click();await page.getByRole('dialog',{name:'주간 회고',exact:true}).waitFor();await shot('weekly-review');
    if(!before){assert.equal(await page.getByRole('dialog').locator('textarea,input').count(),0);assert.match(await page.getByRole('dialog').textContent(),/작성·수정은 아직 지원하지 않아요/);}
    await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
    for(const [menu,slug] of [['나의 정원','garden'],['오늘','today'],['할 일','todos'],['기록','records']]){await nav(menu);await page.waitForTimeout(150);await shot(slug);if(menu==='나의 정원'){
      if(!before){await page.getByRole('heading',{name:'월간·연간 목표',exact:true}).waitFor();await page.getByRole('heading',{name:'버킷리스트',exact:true}).waitFor();assert.equal(await page.getByText('완료된 버킷 문장 보존',{exact:true}).count(),1);assert.equal(await page.getByText('기존 씨앗 데이터 조회',{exact:false}).count(),0);}
      await page.locator('.mt-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);await shot('garden-bottom');
      const last=await page.locator('.rg-highlights').boundingBox(),fab=await page.locator('.mt-quick').boundingBox();assert.ok(last.y+last.height<fab.y,'garden content clears FAB');
    }}
    await page.getByRole('navigation',{name:'기록 종류'}).getByRole('link',{name:'음식',exact:true}).click();await page.locator('.mf-page').waitFor();await shot('food');
    await nav('기록');await page.getByRole('navigation',{name:'기록 종류'}).getByRole('link',{name:'문화·음악',exact:true}).click();await page.locator('[data-culture-id]').first().waitFor();await shot('culture');
    if(!before){
      for(const url of ['/__moamoa-today','/__moamoa-todos','/__moamoa-records','/__moamoa-food','/culture/video','/profile','/calendar']){
        await page.goto(base+url);await page.locator('.mt-main').waitFor();await page.waitForTimeout(150);
        assert.equal(await page.locator('.mt-eyebrow').filter({hasText:/^[A-Z][A-Z ,'.]+$/}).count(),0,'decorative English removed');
      }
      await page.goto(base+'/calendar?period=day');await page.locator('.rc-schedule').waitFor();
      await page.evaluate(()=>{for(const table of ['todos','events','activity_entries','todo_time_blocks']){window.testDb.tables[table]=[];window.testDb.emit(table);}});
      await page.getByLabel('캘린더 날짜',{exact:true}).fill('2040-03-12');await page.waitForTimeout(100);
      assert.equal(await page.locator('.rc-untimed,.rc-actual-untimed').count(),0,'no empty untimed sections');
      await nav('나의 정원');await page.evaluate(()=>{window.testDb.tables.someday_seeds=[];window.testDb.emit('someday_seeds');});
      await page.getByText('등록한 버킷리스트가 없어요.',{exact:true}).waitFor();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);assert.ok(requests.every(r=>r.method==='GET'&&!/\/api\/|\/storage\//.test(r.url)));
    results.push({size,width,height,shots,errors,outside});await page.close();
  }
  await writeFile(path.join(output,'validation.json'),JSON.stringify({before,results},null,2)+'\n');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
