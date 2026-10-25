import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const root=fileURLToPath(new URL('../../',import.meta.url)),before=process.env.MOA_SIDEBAR_BEFORE==='1';
test('sidebar icon: geometry, keyboard, retained route and responsive navigation',{timeout:90000},async()=>{
 if(!before)execFileSync(process.execPath,['scripts/build-moa-review.mjs'],{cwd:root,stdio:'pipe'});
 const dist=path.join(root,'dist-review'),config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
 const server=http.createServer(async(req,res)=>{let file=path.join(dist,new URL(req.url,'http://localhost').pathname),data;try{data=await readFile(file);}catch{file=path.join(dist,'index.html');data=await readFile(file);}for(const[k,v]of Object.entries(config.routes[0].headers))res.setHeader(k,v);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'text/html');res.end(data);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const out=path.join(root,'docs/screenshots/moamoa-sidebar',before?'before':'after');await mkdir(out,{recursive:true});
 try{for(const[size,width,height]of [['desktop',1440,1024],['tablet',768,1024],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height},locale:'ko-KR'}),errors=[],outside=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(!r.request().url().startsWith(base)){outside.push(r.request().url());return r.abort();}return r.continue();});await page.goto(base+'/calendar');await page.locator('.rc-schedule').waitFor();
 const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:path.join(out,`${size}-${name}.png`)});};await shot('expanded');
 const nav=page.getByRole('navigation',{name:width<768?'모바일 주요 메뉴':'주요 메뉴',exact:true});assert.equal(await nav.getByRole('link').count(),5);
 if(width>=768){const sidebar=page.locator('.mr-sidebar'),toggle=page.getByRole('button',{name:'사이드바 접기',exact:true});assert.equal((await sidebar.boundingBox()).width,216);
 if(!before){const box=await toggle.boundingBox(),brand=await sidebar.locator('.mr-brand').boundingBox();assert.equal(box.width,44);assert.equal(box.height,44);assert.ok(box.x>=brand.x+brand.width);assert.ok(Math.abs((box.y+box.height/2)-(brand.y+brand.height/2))<=1);assert.equal(await toggle.innerText(),'');assert.equal(await toggle.locator('svg.lucide-menu').count(),1);assert.equal(await toggle.evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');}
 const url=page.url();await toggle.focus();await page.keyboard.press('Enter');assert.equal(page.url(),url);const expand=page.getByRole('button',{name:'사이드바 펼치기',exact:true});assert.equal(await expand.getAttribute('aria-expanded'),'false');assert.equal((await sidebar.boundingBox()).width,76);await expand.evaluate(e=>e.blur());await shot('collapsed');await expand.focus();await page.keyboard.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(page.url(),url);
 }else{assert.equal(await page.locator('.mr-sidebar').isVisible(),false);}
 for(const[name,heading]of [['할 일','할 일'],['나의 정원','나의 정원'],['기록','기록'],['오늘',null]]){await nav.getByRole('link',{name,exact:true}).click();if(name==='기록')await page.getByRole('navigation',{name:'기록 종류'}).waitFor();else if(heading)await page.getByRole('heading',{name:heading,exact:true}).waitFor();else await page.locator('.mt-greeting').waitFor();assert.equal(await nav.getByRole('link',{name,exact:true}).getAttribute('aria-current'),'page');}
 assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);await page.close();}
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
