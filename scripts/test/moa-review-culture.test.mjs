import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'docs/screenshots/moamoa-preview-culture');
const sizes = [['mobile',390,844],['tablet',768,1024],['desktop',1440,1024]];

test('culture Preview: isolated samples, CRUD, metadata failure, navigation and reload at three widths', {timeout:240000}, async t => {
  const canary = 'CULTURE_REVIEW_SYNTHETIC_CANARY';
  const built = await new Promise((resolve, reject) => {
    let log = '';
    const child = spawn(process.execPath, ['scripts/build-moa-review.mjs'], {cwd:root, env:{...process.env,
      VERCEL:'1', VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:'codex/moamoa-review-preview',
      VITE_SUPABASE_URL:`https://${canary}.invalid`, VITE_SUPABASE_ANON_KEY:canary, VITE_TMDB_API_TOKEN:canary}});
    child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
    child.on('error', reject); child.on('close', code => resolve({code,log}));
  });
  assert.equal(built.code,0,built.log.slice(-3000));
  const dist = path.join(root,'dist-review');
  for (const file of await readdir(path.join(dist,'assets'))) {
    if (!/\.(js|css)$/.test(file)) continue;
    const source = await readFile(path.join(dist,'assets',file),'utf8');
    assert.ok(!source.includes(canary), `environment leak: ${file}`);
    assert.doesNotMatch(source,/supabaseUrl is required|api\.themoviedb\.org|youtube\.com\/oembed|image\.tmdb\.org/);
  }
  const config = JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
  assert.match(config.routes[0].headers['Content-Security-Policy'],/connect-src 'none'/);
  const server = http.createServer(async (req,res) => {
    let file = path.join(dist,new URL(req.url,'http://localhost').pathname);
    let data;
    try {data = await readFile(file);} catch {file=path.join(dist,'index.html');data=await readFile(file);}
    for(const [key,value] of Object.entries(config.routes[0].headers)) res.setHeader(key,value);
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)] || 'text/html');
    res.end(data);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:process.env.HAON_CHROME || '/usr/bin/chromium',args:['--no-sandbox']});
  const results=[];
  await mkdir(output,{recursive:true});
  try {
    for(const [size,width,height] of sizes) await t.test(`${size}: ${width}px`,async()=>{
      const page=await browser.newPage({viewport:{width,height},timezoneId:'Asia/Seoul',locale:'ko-KR',reducedMotion:'reduce'});
      page.setDefaultTimeout(10000);
      const outside=[],requests=[],errors=[],sockets=[],shots=[];
      page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
      page.on('websocket',s=>sockets.push(s.url()));
      page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
      await page.route('**/*',route=>{
        if(!route.request().url().startsWith(base)) {outside.push(route.request().url());return route.abort();}
        return route.continue();
      });
      const nav=page.getByRole('navigation',{name:width<768?'모바일 주요 메뉴':'주요 메뉴',exact:true});
      const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
      const label=(name,scope=page)=>scope.getByLabel(name,{exact:true});
      const dialog=()=>page.getByRole('dialog');
      const close=async()=>{await button('닫기',dialog()).click();await dialog().waitFor({state:'hidden'});};
      const shot=async name=>{
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`${name}: overflow`);
        const modal=dialog();
        if(await modal.count()) {
          const box=await modal.boundingBox();assert.ok(box.y>=0 && box.y+box.height<=height+1,`${name}: dialog bounds`);
          const footer=modal.locator('.mx-actions').last();
          if(await footer.count()) {const b=await footer.boundingBox();assert.ok(b.y+b.height<=height,`${name}: footer reachable`);}
        }
        const file=`${size}-${name}.png`;await page.screenshot({path:path.join(output,file)});shots.push(file);
      };
      const enter=async()=>{
        await nav.getByRole('link',{name:'기록',exact:true}).click();
        await page.getByRole('navigation',{name:'기록 종류'}).getByRole('link',{name:'문화·음악',exact:true}).click();
        await page.locator('[data-culture-id]').first().waitFor();
      };
      const create=async title=>{await button('문화 기록').click();await label('작품명',dialog()).fill(title);};
      const save=async()=>{await button('저장',dialog()).click();await page.getByRole('dialog',{name:'문화 기록 상세',exact:true}).waitFor();};
      const stored=title=>page.evaluate(title=>window.testDb.tables.culture_records.filter(r=>r.title===title),title);
      try {
        await page.goto(base);await page.locator('.mt-greeting').waitFor();await enter();
        assert.equal(new URL(page.url()).pathname,'/culture/video');assert.equal(await nav.getByRole('link').count(),5);
        assert.equal(await nav.getByRole('link',{name:'기록',exact:true}).getAttribute('aria-current'),'page');
        assert.equal(await page.locator('[data-culture-id]').count(),5);
        await page.waitForFunction(()=>[...document.querySelectorAll('.mc-poster img')].every(i=>i.complete && i.naturalWidth>0));
        assert.equal(await page.locator('.mc-poster img').count(),3);
        assert.equal(await page.getByLabel('별점 0점',{exact:true}).count(),1);
        assert.equal(await page.getByRole('link',{name:/기존 문화|My Planner|작품 URL 열기/}).count(),0);
        await shot('list');
        await create('수동 문화 기록');await shot('manual-add');await save();await shot('detail');await close();
        const [created]=await stored('수동 문화 기록');assert.ok(created.id);assert.equal((await stored('수동 문화 기록')).length,1);
        const card=page.locator(`[data-culture-id="${created.id}"]`);
        await label('수동 문화 기록 상태 변경',card).selectOption('watching');
        await page.waitForFunction(id=>window.testDb.tables.culture_records.find(r=>r.id===id).status==='watching',created.id);
        await button('수동 문화 기록 수정',card).click();
        await label('별점',dialog()).selectOption('4.5');await label('감상 날짜',dialog()).fill('2026-10-24');
        await label('짧은 감상평',dialog()).fill('직접 남긴 감상');await label('태그',dialog()).fill('휴식, 검증');
        await label('작품 URL',dialog()).fill('https://external.example.invalid/watch');
        await label('포스터·썸네일 URL',dialog()).fill('https://external.example.invalid/image.png');
        await shot('edit');await save();
        assert.equal(await dialog().locator('a[href^="http"]').count(),0);
        await close();const [edited]=await stored('수동 문화 기록');
        assert.equal(edited.id,created.id);assert.equal(edited.rating,4.5);assert.equal(edited.review,'직접 남긴 감상');
        assert.equal(edited.thumbnail_url,'https://external.example.invalid/image.png');
        await label('제목·태그 검색').fill('검증');assert.equal(await page.locator('[data-culture-id]').count(),1);
        await label('제목·태그 검색').fill('존재하지 않는 제목');await page.getByRole('heading',{name:'조건에 맞는 기록이 없어요',exact:true}).waitFor();
        await button('필터 초기화').click();
        await page.getByRole('group',{name:'감상 상태 필터',exact:true}).getByRole('button',{name:'보는 중',exact:true}).click();
        assert.equal(await page.locator('[data-culture-id]').count(),2);
        await page.getByRole('group',{name:'감상 상태 필터',exact:true}).getByRole('button',{name:'전체',exact:true}).click();
        await page.getByRole('group',{name:'콘텐츠 필터',exact:true}).getByRole('button',{name:'YouTube',exact:true}).click();
        assert.equal(await page.locator('[data-culture-id]').count(),1);
        await page.getByRole('group',{name:'콘텐츠 필터',exact:true}).getByRole('button',{name:'전체',exact:true}).click();
        await button('필터·정렬').click();await label('플랫폼 필터').selectOption('tving');assert.equal(await page.locator('[data-culture-id]').count(),1);
        await label('플랫폼 필터').selectOption('all');await label('문화 기록 정렬').selectOption('rating');await shot('filters');
        await nav.getByRole('link',{name:'오늘',exact:true}).click();await enter();await card.waitFor();
        assert.equal((await stored('수동 문화 기록')).length,1,'navigation keeps memory');
        await button('수동 문화 기록 삭제',card).click();await button('취소',dialog()).click();assert.equal((await stored('수동 문화 기록')).length,1);
        await button('수동 문화 기록 삭제',card).click();await shot('delete');await button('삭제 확인',dialog()).click();
        await dialog().waitFor({state:'hidden'});assert.equal((await stored('수동 문화 기록')).length,0);

        await create('실패 후 직접 입력');await button('작품 검색',dialog()).click();
        await label('검색할 작품명',dialog()).fill('오류');await button('검색',dialog()).click();
        await dialog().getByText('정보를 불러오지 못했어요. 주소·연결을 확인하거나 직접 입력해주세요.',{exact:true}).waitFor();
        await shot('search-failure');assert.equal(await label('작품명',dialog()).inputValue(),'실패 후 직접 입력');
        await button('직접 입력',dialog()).click();
        await page.evaluate(()=>window.testDb.failNext('culture_records',{status:503}));
        await button('저장',dialog()).click();await button('재시도',dialog()).waitFor();
        assert.equal(await label('작품명',dialog()).inputValue(),'실패 후 직접 입력');await shot('save-retry');
        await button('재시도',dialog()).click();await page.getByRole('dialog',{name:'문화 기록 상세',exact:true}).waitFor();await close();
        assert.equal((await stored('실패 후 직접 입력')).length,1);

        await button('문화 기록').click();await button('작품 검색',dialog()).click();
        await label('검색할 작품명',dialog()).fill('없음');await button('검색',dialog()).click();
        await dialog().getByText('검색 결과가 없어요. 직접 입력으로 남길 수 있어요.',{exact:true}).waitFor();
        await label('검색할 작품명',dialog()).fill('샘플');await button('검색',dialog()).click();
        await dialog().locator('.mc-suggestion').first().waitFor();assert.equal(await dialog().locator('.mc-suggestion').count(),2);
        await shot('tmdb-sample');await button('입력에 사용',dialog()).first().click();await save();await close();
        const [movie]=await stored('로컬 샘플 영화 · 여름의 장면');assert.equal(movie.external_id,'900001');assert.equal(movie.external_source,'tmdb_movie');
        await button('문화 기록').click();await button('YouTube URL 입력',dialog()).click();
        await label('YouTube URL',dialog()).fill('https://youtu.be/sample00001');await button('영상 정보 가져오기',dialog()).click();
        await dialog().locator('.mc-suggestion').waitFor();await shot('youtube-sample');await button('입력에 사용',dialog()).click();await save();await close();
        const [video]=await stored('로컬 샘플 영상 · 작은 작업실');assert.equal(video.external_id,'sample00001');
        await create('YouTube 실패 직접 입력');await button('YouTube URL 입력',dialog()).click();
        await label('YouTube URL',dialog()).fill('https://youtu.be/failure0000');await button('영상 정보 가져오기',dialog()).click();
        await dialog().getByText('정보를 불러오지 못했어요. 주소·연결을 확인하거나 직접 입력해주세요.',{exact:true}).waitFor();
        await button('URL만 입력에 사용',dialog()).click();await save();await close();
        const [fallback]=await stored('YouTube 실패 직접 입력');assert.equal(fallback.url,'https://youtu.be/failure0000');assert.equal(fallback.content_type,'youtube_video');

        await page.getByRole('navigation',{name:'문화·음악 종류'}).getByRole('link',{name:'음악',exact:true}).click();
        await page.getByRole('heading',{name:'음악 기록은 준비 중이에요',exact:true}).waitFor();await shot('music');
        assert.equal(await page.getByRole('link',{name:/기존 문화|My Planner/}).count(),0);
        await page.getByRole('link',{name:'영상 기록으로 돌아가기',exact:true}).click();
        assert.equal((await stored('실패 후 직접 입력')).length,1);
        await page.getByRole('link',{name:'기록으로 돌아가기',exact:true}).click();
        await page.getByRole('navigation',{name:'기록 종류'}).waitFor();await enter();
        await page.reload();await page.locator('[data-culture-id]').first().waitFor();
        assert.equal(await page.locator('[data-culture-id]').count(),5);assert.equal((await stored('실패 후 직접 입력')).length,0);
        assert.equal(await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.id==='review-culture-drama').status),'watching');
        assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);
        assert.ok(requests.every(r=>r.method==='GET' && !/\/api\/|\/storage\//.test(r.url)),'no API/DB/Storage HTTP');
        results.push({size,width,height,shots,outside,errors,sockets,crud:true,retry:true,localMetadata:true,reloadReset:true});
      } finally {await page.close();}
    });
    await writeFile(path.join(output,'validation.json'),JSON.stringify({results,productionCredentials:'synthetic canaries only',transport:'memory; no external requests',physicalDevices:'not tested'},null,2)+'\n');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
