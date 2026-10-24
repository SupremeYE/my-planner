import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {cultureRows, originalPoster} from './fixtures/moa-culture-data.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(root,'docs/screenshots/moamoa-culture');
const poster='<svg xmlns="http://www.w3.org/2000/svg" width="360" height="500" viewBox="0 0 360 500"><rect width="360" height="500" fill="#dce3d1"/><circle cx="255" cy="120" r="61" fill="#f6dfad"/><path d="M0 300 Q140 180 360 330 V500 H0" fill="#81997b"/><path d="M0 390 Q170 290 360 380 V500 H0" fill="#4e6b56"/><text x="26" y="65" fill="#354235" font-family="sans-serif" font-size="17" letter-spacing="3">SUMMER SCENES</text><text x="26" y="460" fill="#fffefb" font-family="sans-serif" font-size="13">ISOLATED TEST POSTER</text></svg>';

test('Moa culture: preserved records, confirmed writes, metadata fallbacks and responsive interactions', {timeout:240000}, async t => {
  const cacheDir=await mkdtemp(path.join(tmpdir(),'moa-culture-'));
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const server=await createServer({root,cacheDir,logLevel:'error',plugins:[{
    name:'isolated-culture',enforce:'pre',
    resolveId(source){if(/(?:^\.\/supabase|\/lib\/supabase)$/.test(source))return path.join(root,'scripts/test/fixtures/moa-today-supabase.ts');},
    transform(code,id){
      if(id.endsWith('/src/lib/tmdb.ts'))return code.replaceAll('import.meta.env.VITE_TMDB_API_TOKEN','(window.__moaFixture?.tmdbMissing ? undefined : "isolated-not-a-real-token")');
    },
    transformIndexHtml(){return [{tag:'div',attrs:{style:'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:30000;background:#354235;color:#fffefb;padding:2px 8px;font-size:10px;pointer-events:none;white-space:nowrap'},children:'격리 검증 · 샘플 문화 기록 · 운영 DB/API 연결 없음',injectTo:'body'}];},
  }],server:{host:'127.0.0.1',port,strictPort:true}});
  let browser;const errors=[],external=[],shots=[],apiCalls=[];
  try {
    await server.listen();const base=`http://127.0.0.1:${port}`;
    browser=await chromium.launch({executablePath:process.env.HAON_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
    const context=await browser.newContext({timezoneId:'Asia/Seoul',locale:'ko-KR',serviceWorkers:'block',reducedMotion:'reduce'});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='api.themoviedb.org') {
        apiCalls.push({kind:'tmdb',query:url.searchParams.get('query')});
        const q=url.searchParams.get('query');
        if(q==='느린 검색')await new Promise(r=>setTimeout(r,1500));
        return route.fulfill({status:q==='실패'?503:200,contentType:'application/json',body:JSON.stringify({results:q==='없음'?[]:[
          {id:701,media_type:'movie',title:'검색으로 찾은 영화',original_title:'A Movie',release_date:'2026-01-01',poster_path:'/movie.svg'},
          {id:702,media_type:'tv',name:'검색으로 찾은 드라마',original_name:'A Series',first_air_date:'2025-01-01',poster_path:'/series.svg'},
        ]})});
      }
      if(url.hostname==='www.youtube.com'&&url.pathname==='/oembed') {
        apiCalls.push({kind:'youtube',url:url.searchParams.get('url')});
        const fail=url.searchParams.get('url').includes('failure0000');
        return route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify({title:'영상에서 찾은 작은 쉼',author_name:'테스트 채널',thumbnail_url:'https://culture.example.invalid/youtube.svg'})});
      }
      if(url.hostname==='culture.example.invalid'||url.hostname==='image.tmdb.org') return route.fulfill({status:url.pathname.endsWith('missing.jpg')?404:200,contentType:'image/svg+xml',body:url.pathname.endsWith('missing.jpg')?'':poster});
      if(url.origin!==base){external.push(url.href);return route.abort();}
      return route.continue();
    });
    const open=async fixture=>{
      const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      await page.setViewportSize({width:390,height:844});
      await page.addInitScript(value=>{window.__moaFixture=value;},fixture??{tables:{culture_records:cultureRows}});
      await page.goto(`${base}/__moamoa-culture`,{timeout:60000});
      await page.getByRole('heading',{name:'문화 기록',exact:true}).waitFor();
      await page.getByText('문화 기록을 불러오고 있어요.',{exact:true}).waitFor({state:'hidden'});
      return page;
    };
    const page=await open();await mkdir(output,{recursive:true});
    const row=id=>page.locator(`[data-culture-id="${id}"]`);
    const dialog=name=>page.getByRole('dialog',{name,exact:true});
    const editor=()=>dialog('문화 기록 추가');
    const add=async title=>{await page.getByRole('button',{name:'문화 기록',exact:true}).click();await editor().getByLabel('작품명',{exact:true}).fill(title);};
    const closeDetail=async()=>{await dialog('문화 기록 상세').getByRole('button',{name:'닫기',exact:true}).click();};
    const submit=async form=>{await form.getByRole('button',{name:'저장',exact:true}).click();await form.waitFor({state:'hidden'});};
    async function capture(name) {
      for(const [label,width,height] of [['mobile',390,844],['desktop',1440,1024]]) {
        await page.setViewportSize({width,height});
        const dim=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,
          overflow:[...document.querySelectorAll('.mc-page,.mc-card,.mx-dialog,.mc-form')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>e.className)}));
        assert.equal(dim.document,width);assert.deepEqual(dim.overflow,[]);
        const main=await page.locator('.mt-scroll').boundingBox(),quick=await page.locator('.mt-quick').boundingBox();
        assert.ok(main.y+main.height<=quick.y,'content viewport stays above quick action');
        await page.screenshot({path:path.join(output,`${label}-${name}.png`)});shots.push({name:`${label}-${name}`,...dim});
      }
      await page.setViewportSize({width:390,height:844});
    }
    async function step(name,fn){let error;await t.test(name,async()=>{try{await fn();}catch(e){error=e;throw e;}});if(error)throw error;}
    let createdId;
    await step('read-only legacy list retains IDs/media/status/type/zero stars; broken images still show the record',async()=>{
      assert.equal(await page.evaluate(()=>window.testDb.requests.length),0);
      assert.equal(await page.evaluate(()=>window.testDb.storageRequests.length),0);
      assert.equal(apiCalls.length,0);assert.equal(await page.locator('[data-culture-id]').count(),5);
      assert.equal(await row('legacy-movie').locator('img').getAttribute('src'),originalPoster);
      await row('legacy-youtube').scrollIntoViewIfNeeded();await row('legacy-youtube').getByRole('img',{name:'이미지를 불러오지 못했어요'}).waitFor();
      assert.match(await row('legacy-youtube').innerText(),/★ 0/);
      assert.match(await row('legacy-anime').innerText(),/중단/);
      await page.locator('.mt-scroll').evaluate(e=>e.scrollTo(0,0));await capture('list');
      await row('legacy-movie').getByRole('button',{name:'상세 보기',exact:true}).click();
      assert.match(await dialog('문화 기록 상세').innerText(),/마지막 장면의 햇빛/);
      assert.equal(await dialog('문화 기록 상세').getByRole('link',{name:'작품 URL 열기 ↗'}).getAttribute('href'),'https://example.invalid/old-film');
      await capture('detail');await closeDetail();
      await row('legacy-youtube').getByRole('button',{name:'상세 보기',exact:true}).click();await dialog('문화 기록 상세').getByRole('img',{name:'이미지를 불러오지 못했어요'}).waitFor();
      const retriedImage=page.waitForRequest(request=>request.url()==='https://culture.example.invalid/missing.jpg');await dialog('문화 기록 상세').getByRole('button',{name:'이미지 다시 불러오기',exact:true}).click();await retriedImage;await dialog('문화 기록 상세').getByRole('img',{name:'이미지를 불러오지 못했어요'}).waitFor();await closeDetail();
    });
    await step('title-only create: duplicate submits, pending close guard and acknowledgement-loss retry create exactly one ID',async()=>{
      await add('제목만으로 남기는 기록');await capture('add');
      await page.evaluate(()=>{window.testDb.hold('culture_records');window.testDb.failNext('culture_records',{status:0,afterCommit:true});});
      await editor().locator('form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});
      await editor().getByText('저장 결과를 확인하고 있어요…',{exact:true}).waitFor();
      await page.keyboard.press('Escape');assert.equal(await editor().count(),1);
      assert.equal(await page.evaluate(()=>window.testDb.requests.filter(r=>r.table==='culture_records').length),1);
      await capture('saving');await page.evaluate(()=>window.testDb.release('culture_records'));
      await editor().getByRole('button',{name:'재시도',exact:true}).waitFor();await capture('save-failure');
      assert.equal(await editor().getByLabel('작품명',{exact:true}).inputValue(),'제목만으로 남기는 기록');
      assert.equal(await page.locator('[data-culture-id]').count(),5);
      await editor().getByRole('button',{name:'재시도',exact:true}).click();await editor().waitFor({state:'hidden'});
      const rows=await page.evaluate(()=>window.testDb.tables.culture_records.filter(r=>r.title==='제목만으로 남기는 기록'));
      assert.equal(rows.length,1);createdId=rows[0].id;assert.equal(rows[0].rating,null);assert.equal(rows[0].thumbnail_url,null);assert.equal(rows[0].status,'completed');
      assert.equal(apiCalls.length,0);await closeDetail();await row(createdId).waitFor();
    });
    await step('editing a title preserves old metadata and concurrent other-device review; no-op save confirms the latest row',async()=>{
      await row('legacy-movie').getByRole('button',{name:'여름이 남긴 장면들 수정',exact:true}).click();const edit=dialog('문화 기록 수정');await capture('edit');
      await edit.getByLabel('작품명',{exact:true}).fill('여름을 다시 꺼내 보는 날');
      await page.evaluate(()=>{window.testDb.tables.culture_records.find(r=>r.id==='legacy-movie').review='다른 기기에 적은 감상';window.testDb.emit('culture_records');});
      await page.waitForTimeout(80);await submit(edit);
      const saved=await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.id==='legacy-movie'));
      assert.equal(saved.review,'다른 기기에 적은 감상');assert.equal(saved.rating,4.5);assert.equal(saved.thumbnail_url,originalPoster);assert.equal(saved.external_id,'123');assert.equal(saved.legacy_extra,'never overwrite');
      const {updated_at,...patch}=await page.evaluate(()=>window.testDb.requests.filter(r=>r.table==='culture_records'&&r.kind==='update').at(-1).payload);assert.deepEqual(patch,{title:'여름을 다시 꺼내 보는 날'});assert.ok(Number.isFinite(Date.parse(updated_at)));
      await closeDetail();const before=await page.evaluate(()=>window.testDb.requests.length);
      await row('legacy-movie').getByRole('button',{name:'여름을 다시 꺼내 보는 날 수정',exact:true}).click();await submit(edit);assert.equal(await page.evaluate(()=>window.testDb.requests.length),before);await closeDetail();
    });
    await step('status changes wait for confirmation, failure retains the old status and retry preserves review/stars',async()=>{
      await page.evaluate(()=>window.testDb.failNext('culture_records',{status:503}));
      await row('legacy-movie').getByLabel('여름을 다시 꺼내 보는 날 상태 변경',{exact:true}).selectOption('watching');
      await row('legacy-movie').getByRole('button',{name:'재시도',exact:true}).waitFor();
      assert.equal(await row('legacy-movie').locator('select').inputValue(),'completed');
      await row('legacy-movie').getByRole('button',{name:'재시도',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-culture-id="legacy-movie"] select').value==='watching');
      const saved=await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.id==='legacy-movie'));
      assert.equal(saved.rating,4.5);assert.equal(saved.review,'다른 기기에 적은 감상');
    });
    await step('status/type/platform/tag filters and sorting operate on existing records, including dropped and legacy types',async()=>{
      await page.getByRole('group',{name:'감상 상태 필터',exact:true}).getByRole('button',{name:'보고 싶은',exact:true}).click();assert.equal(await page.locator('[data-culture-id]').count(),1);
      await page.getByRole('group',{name:'감상 상태 필터',exact:true}).getByRole('button',{name:'전체',exact:true}).click();
      await page.getByRole('group',{name:'콘텐츠 필터',exact:true}).getByRole('button',{name:'YouTube',exact:true}).click();assert.equal(await row('legacy-youtube').count(),1);
      await page.getByRole('group',{name:'콘텐츠 필터',exact:true}).getByRole('button',{name:'전체',exact:true}).click();
      await page.getByRole('button',{name:'필터·정렬',exact:true}).click();await page.getByLabel('플랫폼 필터',{exact:true}).selectOption('tving');assert.equal(await page.locator('[data-culture-id]').count(),1);
      await page.getByLabel('플랫폼 필터',{exact:true}).selectOption('all');await page.getByLabel('제목·태그 검색',{exact:true}).fill('쉼');assert.equal(await row('legacy-movie').count(),1);assert.equal(await page.locator('[data-culture-id]').count(),1);
      await page.getByLabel('제목·태그 검색',{exact:true}).fill('없는 단어');await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
      await page.getByLabel('문화 기록 정렬',{exact:true}).selectOption('rating');assert.equal(await page.locator('[data-culture-id]').first().getAttribute('data-culture-id'),'legacy-movie');
      await page.getByLabel('문화 기록 정렬',{exact:true}).selectOption('watched');assert.equal(await page.locator('[data-culture-id]').first().getAttribute('data-culture-id'),'legacy-movie');
      await page.getByText('기존 콘텐츠 유형 더 보기',{exact:true}).click();await page.getByRole('group',{name:'기존 콘텐츠 필터',exact:true}).getByRole('button',{name:'애니',exact:true}).click();assert.equal(await row('legacy-anime').count(),1);assert.equal(await page.locator('[data-culture-id]').count(),1);
      await page.getByRole('group',{name:'콘텐츠 필터',exact:true}).getByRole('button',{name:'전체',exact:true}).click();
    });
    await step('TMDB explicit requests are deduplicated/cached; selected metadata fills blanks without overwriting user text or rating',async()=>{
      await add('사용자가 직접 쓴 제목');await editor().getByRole('button',{name:'플랫폼·별점·감상평 추가',exact:true}).click();
      await editor().getByLabel('짧은 감상평',{exact:true}).fill('검색 전에 적은 감상');await editor().getByLabel('별점',{exact:true}).selectOption('3.5');
      await editor().getByRole('button',{name:'작품 검색',exact:true}).click();await editor().getByLabel('검색할 작품명',{exact:true}).fill('찾을 작품');
      const before=apiCalls.length;await editor().getByRole('button',{name:'검색',exact:true}).evaluate(b=>{b.click();b.click();});
      await editor().getByText('검색으로 찾은 드라마',{exact:true}).waitFor();assert.equal(apiCalls.length,before+1);
      await editor().getByRole('button',{name:'검색',exact:true}).click();await editor().getByText('검색으로 찾은 드라마',{exact:true}).waitFor();assert.equal(apiCalls.length,before+1);
      await capture('tmdb-results');await editor().locator('.mc-suggestion').filter({hasText:'검색으로 찾은 드라마'}).getByRole('button',{name:'입력에 사용',exact:true}).click();
      assert.equal(await editor().getByLabel('작품명',{exact:true}).inputValue(),'사용자가 직접 쓴 제목');assert.equal(await editor().getByLabel('콘텐츠 유형',{exact:true}).inputValue(),'drama');assert.equal(await editor().getByLabel('별점',{exact:true}).inputValue(),'3.5');
      await submit(editor());const r=await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.title==='사용자가 직접 쓴 제목'));
      assert.equal(r.external_source,'tmdb_tv');assert.equal(r.external_id,'702');assert.equal(r.thumbnail_url,'https://image.tmdb.org/t/p/w500/series.svg');assert.equal(r.review,'검색 전에 적은 감상');await closeDetail();
    });
    await step('API failures, empty results and cancelled stale searches leave manual registration available',async()=>{
      for(const query of ['실패','없음']) {
        await add(`수동 기록 ${query}`);await editor().getByRole('button',{name:'작품 검색',exact:true}).click();await editor().getByLabel('검색할 작품명',{exact:true}).fill(query);await editor().getByRole('button',{name:'검색',exact:true}).click();
        await editor().getByText(query==='실패'?'정보를 불러오지 못했어요. 주소·연결을 확인하거나 직접 입력해주세요.':'검색 결과가 없어요. 직접 입력으로 남길 수 있어요.',{exact:true}).waitFor();
        if(query==='실패')await capture('api-failure');await editor().getByRole('button',{name:'직접 입력',exact:true}).click();await submit(editor());await closeDetail();
      }
      await add('오래된 결과를 적용하지 않는 기록');await editor().getByRole('button',{name:'작품 검색',exact:true}).click();await editor().getByLabel('검색할 작품명',{exact:true}).fill('느린 검색');await editor().getByRole('button',{name:'검색',exact:true}).click();
      await editor().getByRole('button',{name:'직접 입력',exact:true}).click();await submit(editor());await closeDetail();
      assert.equal(await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.title==='오래된 결과를 적용하지 않는 기록').external_source),'manual');
    });
    await step('YouTube validates IDs/hosts, queries the existing oEmbed API, applies editable fields and falls back on failure',async()=>{
      await add('');await editor().getByRole('button',{name:'YouTube URL 입력',exact:true}).click();
      const before=apiCalls.length;await editor().getByLabel('YouTube URL',{exact:true}).fill('https://evil.invalid/watch?v=abcdefghijk');await editor().getByRole('button',{name:'영상 정보 가져오기',exact:true}).click();
      await editor().getByText('정보를 불러오지 못했어요. 주소·연결을 확인하거나 직접 입력해주세요.',{exact:true}).waitFor();assert.equal(apiCalls.length,before);
      await editor().getByLabel('YouTube URL',{exact:true}).fill('https://youtu.be/abcdefghijk');await editor().getByRole('button',{name:'영상 정보 가져오기',exact:true}).click();await editor().getByRole('button',{name:'입력에 사용',exact:true}).click();
      assert.equal(await editor().getByLabel('작품명',{exact:true}).inputValue(),'영상에서 찾은 작은 쉼');await editor().getByLabel('작품명',{exact:true}).fill('내가 바꾼 영상 제목');await capture('youtube');await submit(editor());
      const saved=await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.title==='내가 바꾼 영상 제목'));assert.equal(saved.external_id,'abcdefghijk');assert.equal(saved.content_type,'youtube_video');assert.equal(saved.platform,'youtube');assert.equal(saved.url,'https://youtu.be/abcdefghijk');await closeDetail();
      await add('조회 실패한 영상도 남기기');await editor().getByRole('button',{name:'YouTube URL 입력',exact:true}).click();await editor().getByLabel('YouTube URL',{exact:true}).fill('https://youtu.be/failure0000');await editor().getByRole('button',{name:'영상 정보 가져오기',exact:true}).click();await editor().getByText('정보를 불러오지 못했어요. 주소·연결을 확인하거나 직접 입력해주세요.',{exact:true}).waitFor();await editor().getByRole('button',{name:'URL만 입력에 사용',exact:true}).click();await submit(editor());await closeDetail();
      const manualVideo=await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.title==='조회 실패한 영상도 남기기'));assert.equal(manualVideo.url,'https://youtu.be/failure0000');assert.equal(manualVideo.external_id,'failure0000');assert.equal(manualVideo.thumbnail_url,null);assert.equal(manualVideo.content_type,'youtube_video');
    });
    await step('desktop buttons save optional dates, half stars, tags and notes, then edit zero stars without changing media or provenance',async()=>{
      await page.setViewportSize({width:1440,height:1024});await add('PC에서 남긴 자세한 감상');
      await editor().getByRole('button',{name:'플랫폼·별점·감상평 추가',exact:true}).click();
      await editor().getByLabel('플랫폼',{exact:true}).selectOption('theater');await editor().getByLabel('감상 날짜',{exact:true}).fill('2026-10-24');
      await editor().getByLabel('별점',{exact:true}).selectOption('4.5');await editor().getByLabel('짧은 감상평',{exact:true}).fill('PC에서 실제 입력한 감상');
      await editor().getByLabel('기억에 남는 내용',{exact:true}).fill('크레딧의 마지막 문장');await editor().getByLabel('태그',{exact:true}).fill('영화관, 토요일, 영화관');
      await editor().getByLabel('작품 URL',{exact:true}).fill('https://example.invalid/desktop');await editor().getByLabel('포스터·썸네일 URL',{exact:true}).fill(originalPoster);await submit(editor());
      const saved=await page.evaluate(()=>window.testDb.tables.culture_records.find(r=>r.title==='PC에서 남긴 자세한 감상'));
      assert.deepEqual(saved.tags,['영화관','토요일']);assert.equal(saved.watched_date,'2026-10-24');assert.equal(saved.rating,4.5);assert.equal(saved.insight,'크레딧의 마지막 문장');
      await dialog('문화 기록 상세').getByRole('button',{name:'수정',exact:true}).click();await dialog('문화 기록 수정').getByLabel('별점',{exact:true}).selectOption('0');await submit(dialog('문화 기록 수정'));
      assert.match(await dialog('문화 기록 상세').innerText(),/★ 0점/);assert.equal(await page.evaluate(id=>window.testDb.tables.culture_records.find(r=>r.id===id).thumbnail_url,saved.id),originalPoster);
      await dialog('문화 기록 상세').getByRole('button',{name:'삭제',exact:true}).click();await dialog('문화 기록 삭제').getByRole('button',{name:'삭제 확인',exact:true}).click();await dialog('문화 기록 삭제').waitFor({state:'hidden'});assert.equal(await row(saved.id).count(),0);await page.setViewportSize({width:390,height:844});
    });
    await step('delete requires absence confirmation, retry survives lost acknowledgement and never deletes media',async()=>{
      const before=await page.evaluate(()=>window.testDb.requests.length);await row(createdId).getByRole('button',{name:'제목만으로 남기는 기록 삭제',exact:true}).click();await dialog('문화 기록 삭제').getByRole('button',{name:'취소',exact:true}).click();assert.equal(await page.evaluate(()=>window.testDb.requests.length),before);assert.equal(await row(createdId).count(),1);
      await row(createdId).getByRole('button',{name:'제목만으로 남기는 기록 삭제',exact:true}).click();await capture('delete');
      await page.evaluate(()=>window.testDb.failNext('culture_records',{status:0,afterCommit:true}));await dialog('문화 기록 삭제').getByRole('button',{name:'삭제 확인',exact:true}).click();
      await dialog('문화 기록 삭제').getByRole('button',{name:'재시도',exact:true}).waitFor();assert.equal(await row(createdId).count(),1);
      await dialog('문화 기록 삭제').getByRole('button',{name:'재시도',exact:true}).click();await dialog('문화 기록 삭제').waitFor({state:'hidden'});assert.equal(await row(createdId).count(),0);assert.equal(await page.evaluate(()=>window.testDb.storageRequests.length),0);
    });
    await step('Realtime and failed reads preserve confirmed rows; reloading keeps IDs and metadata without writes',async()=>{
      await page.evaluate(()=>{window.testDb.tables.culture_records.find(r=>r.id==='legacy-drama').review='새 기기에서 남긴 문장';window.testDb.emit('culture_records');});await row('legacy-drama').getByText('새 기기에서 남긴 문장',{exact:true}).waitFor();
      const count=await page.locator('[data-culture-id]').count();await page.evaluate(()=>{window.testDb.failNext('culture_records',{status:503,read:true});window.testDb.emit('culture_records');});await page.getByRole('button',{name:'문화 기록 다시 불러오기',exact:true}).waitFor();assert.equal(await page.locator('[data-culture-id]').count(),count);await capture('read-failure');
      await page.getByRole('button',{name:'문화 기록 다시 불러오기',exact:true}).click();await page.getByRole('button',{name:'문화 기록 다시 불러오기',exact:true}).waitFor({state:'hidden'});
      const tables=await page.evaluate(()=>window.testDb.tables);await page.addInitScript(tables=>{window.__moaFixture={tables};},tables);await page.reload();await row('legacy-movie').waitFor();assert.equal(await page.evaluate(()=>window.testDb.requests.length),0);assert.equal(await row('legacy-movie').locator('img').getAttribute('src'),originalPoster);
      await page.getByRole('link',{name:'기존 문화·음악 화면 →',exact:true}).click();await page.waitForURL(`${base}/culture`);await page.getByRole('button',{name:'음악',exact:true}).waitFor();await page.goBack();await row('legacy-movie').waitFor();
    });
    await step('empty/load failure/offline/permanent denial keep drafts honest, keyboard focus and narrow tabs remain usable',async()=>{
      const loading=await context.newPage();await loading.setViewportSize({width:390,height:844});await loading.addInitScript(value=>{window.__moaFixture=value;},{tables:{culture_records:cultureRows},delay:1200});await loading.goto(`${base}/__moamoa-culture`);await loading.getByText('문화 기록을 불러오고 있어요.',{exact:true}).waitFor();await loading.screenshot({path:path.join(output,'mobile-loading.png')});await loading.locator('[data-culture-id="legacy-movie"]').waitFor();await loading.close();
      const empty=await open({tables:{}});await empty.getByRole('heading',{name:'첫 감상 기록을 남겨보세요',exact:true}).waitFor();await empty.screenshot({path:path.join(output,'mobile-empty.png')});await empty.close();
      const failed=await open({tables:{culture_records:cultureRows},faults:[{table:'culture_records',status:503,read:true}]});await failed.getByRole('button',{name:'문화 기록 다시 불러오기',exact:true}).waitFor();assert.equal(await failed.getByRole('heading',{name:'첫 감상 기록을 남겨보세요',exact:true}).count(),0);await failed.getByRole('button',{name:'문화 기록 다시 불러오기',exact:true}).click();await failed.locator('[data-culture-id="legacy-movie"]').waitFor();await failed.close();
      await add('오프라인 초안');await context.setOffline(true);await editor().getByRole('button',{name:'저장',exact:true}).click();await editor().getByRole('button',{name:'재시도',exact:true}).waitFor();await capture('offline');assert.equal(await editor().getByLabel('작품명',{exact:true}).inputValue(),'오프라인 초안');await context.setOffline(false);await editor().getByRole('button',{name:'재시도',exact:true}).click();await editor().waitFor({state:'hidden'});await closeDetail();
      await add('권한 실패 초안');await page.evaluate(()=>window.testDb.failNext('culture_records',{status:403}));await editor().getByRole('button',{name:'저장',exact:true}).click();await editor().getByText('로그인 또는 저장 권한을 확인해주세요.',{exact:true}).waitFor();assert.equal(await editor().getByRole('button',{name:'재시도',exact:true}).count(),0);await editor().getByRole('button',{name:'입력 다시 확인',exact:true}).click();assert.equal(await editor().getByLabel('작품명',{exact:true}).inputValue(),'권한 실패 초안');await editor().getByRole('button',{name:'취소',exact:true}).click();
      const tabs=await page.getByRole('group',{name:'감상 상태 필터',exact:true}).evaluate(e=>({wrap:getComputedStyle(e).flexWrap,client:e.clientWidth,scroll:e.scrollWidth}));assert.equal(tabs.wrap,'nowrap');assert.ok(tabs.scroll>=tabs.client);
      await page.getByRole('button',{name:'빠른 기록',exact:true}).click();assert.equal(await editor().getByLabel('작품명',{exact:true}).evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')),true);await page.keyboard.press('Escape');await editor().waitFor({state:'hidden'});
      await row('legacy-documentary').getByRole('button',{name:'상세 보기',exact:true}).click();assert.match(await dialog('문화 기록 상세').innerText(),/도시에 숨은 작은 정원과 사람들의 이야기/);await capture('long-title');await closeDetail();
    });
    await step('missing TMDB configuration makes no API request and still permits a manual record',async()=>{
      const missing=await open({tables:{},tmdbMissing:true});const before=apiCalls.length;
      await missing.getByRole('button',{name:'문화 기록',exact:true}).click();const form=missing.getByRole('dialog',{name:'문화 기록 추가',exact:true});
      await form.getByRole('button',{name:'작품 검색',exact:true}).click();await form.getByLabel('검색할 작품명',{exact:true}).fill('토큰 없는 검색');await form.getByRole('button',{name:'검색',exact:true}).click();
      await form.getByText('정보를 불러오지 못했어요. 주소·연결을 확인하거나 직접 입력해주세요.',{exact:true}).waitFor();assert.equal(apiCalls.length,before);
      await form.getByLabel('작품명',{exact:true}).fill('API 설정 없이 기록');await form.getByRole('button',{name:'저장',exact:true}).click();await form.waitFor({state:'hidden'});
      assert.equal(await missing.evaluate(()=>window.testDb.tables.culture_records[0].title),'API 설정 없이 기록');await missing.close();
    });
    assert.deepEqual(errors,[]);assert.ok(external.every(url=>/fonts|cdn\.jsdelivr/.test(url)));assert.equal(await page.evaluate(()=>window.testDb.storageRequests.length),0);
    await writeFile(path.join(output,'validation.json'),JSON.stringify({viewports:[390,1440],shots,pageErrors:errors,externalAttempts:external,apiCalls,transport:'existing isolated Auth/PlannerProvider, memory Supabase/Storage and intercepted TMDB/YouTube only'},null,2)+'\n');
  } finally {await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}
});
