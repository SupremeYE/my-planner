import test from 'node:test';
import assert from 'node:assert/strict';
import {bookRepositories,completionBook,bookProgress,bookStatistics,validateBook,applyBookSuggestion,bookPhotoStorage,ensureBookPhoto,type BookRow,type QuoteRow} from './bookRecords';
import {SaveCoordinator} from './saveCoordinator';
import {memorySupabase} from '../../scripts/test/fixtures/memory-supabase';
import {memoryFoodStorage} from '../../scripts/test/fixtures/memory-food-storage';
const book:BookRow={id:'old-book',title:'기존 책',author:'저자',publisher:'출판사',thumbnail:'https://books.invalid/original?x=1',total_pages:300,current_page:10,status:'reading',start_date:'2026-10-01',finish_date:null,added_at:'2026-10-01'};
const quote:QuoteRow={id:'old-quote',book_id:book.id,text:'기존 문장',page:10,tags:['삶'],starred:true,created_at:'2026-10-01',note:'내 생각',image_url:'https://books.invalid/original-photo'};
test('book and quote patches retain identity, other-device metadata, photo/cover URLs and opaque columns',async()=>{
 const {supabase,controls}=memorySupabase({books:[{...book,author:'다른 기기',extra:'keep'}],book_quotes:[{...quote,note:'다른 생각',extra:'keep'}]});const repo=bookRepositories(supabase);
 assert.equal((await repo.books.save({...book,title:'제목 수정'},book)).author,'다른 기기');assert.deepEqual(controls.requests[0].payload,{title:'제목 수정'});
 const saved=await repo.quotes.save({...quote,starred:false},quote);assert.equal(saved.note,'다른 생각');assert.equal(saved.image_url,quote.image_url);assert.equal(controls.tables.book_quotes[0].extra,'keep');assert.deepEqual(controls.requests[1].payload,{starred:false});
});
test('book progress reuses completion and percentages; metadata-only callers need not change statuses; no fabricated time',()=>{
 assert.equal(bookProgress(book),3);assert.equal(bookProgress({...book,total_pages:0}),0);assert.equal(completionBook({...book,current_page:300},'2026-10-25').status,'done');assert.equal(completionBook({...book,current_page:300},'2026-10-25').finish_date,'2026-10-25');assert.equal(completionBook({...book,current_page:300,finish_date:'2026-10-22'},'2026-10-25').finish_date,'2026-10-22');
});
test('progress operation retains one log identity after lost acknowledgement; log-only retry does not revert new device changes',async()=>{
 const {supabase,controls}=memorySupabase({books:[book]});const repo=bookRepositories(supabase),execute=repo.progressOperation({...book,current_page:30},book,'operation-log','2026-10-25');
 controls.failNext('reading_logs',{status:0,afterCommit:true});await assert.rejects(execute(),/책 정보는 저장됐지만/);assert.equal(controls.tables.books[0].current_page,30);assert.equal(controls.tables.reading_logs.length,1);
 controls.tables.books[0].current_page=45;assert.equal((await execute()).current_page,45);assert.equal(controls.tables.books[0].current_page,45);assert.equal(controls.tables.reading_logs.length,1);assert.equal(controls.tables.reading_logs[0].duration_minutes,null);
});
test('unchanged current page adds no reading log; failed book save adds none',async()=>{
 const {supabase,controls}=memorySupabase({books:[book]});const repo=bookRepositories(supabase);await repo.progressOperation({...book,title:'수정'},book,'none','2026-10-25')();assert.equal(controls.tables.reading_logs?.length??0,0);
 controls.failNext('books',{status:503});await assert.rejects(repo.progressOperation({...book,current_page:30},book,'fail','2026-10-25')());assert.equal(controls.tables.reading_logs?.length??0,0);
});
test('title-only book creation, duplicate clicks and response-loss retry keep one stable ID',async()=>{
 const {supabase,controls}=memorySupabase({});const repo=bookRepositories(supabase),c=new SaveCoordinator();controls.failNext('books',{status:0,afterCommit:true});const r={...book,author:'',thumbnail:'',total_pages:0,current_page:0};const request={key:`books:${r.id}`,label:'책',intent:'same',execute:()=>repo.books.save(r),commit:()=>{}};const first=c.run(request);assert.equal(first,c.run(request));await first;await c.retry(request.key);assert.equal(controls.tables.books.length,1);
});
test('quote create, edit, delete and uncertain retry retain IDs and separate book_notes',async()=>{
 const {supabase,controls}=memorySupabase({book_notes:[{id:'note',book_id:book.id,type:'purpose',content:'보존'}]});const repo=bookRepositories(supabase);await repo.quotes.save(quote);await repo.quotes.save({...quote,text:'수정'},quote);controls.failNext('book_quotes',{status:0,afterCommit:true});await assert.rejects(repo.quotes.deleteConfirmed(quote.id));await repo.quotes.deleteConfirmed(quote.id);assert.equal(controls.tables.book_quotes.length,0);assert.equal(controls.tables.book_notes[0].content,'보존');
});
test('linked book deletion is blocked for each child table and read failure; unlinked deletion confirms absence',async()=>{
 for(const table of ['book_quotes','book_notes','reading_logs']){const {supabase,controls}=memorySupabase({books:[book],[table]:[{id:'child',book_id:book.id}]});await assert.rejects(bookRepositories(supabase).deleteBook(book.id),/연결/);assert.equal(controls.tables.books.length,1);}
 const {supabase,controls}=memorySupabase({books:[book]});controls.failNext('book_notes',{status:503,read:true});await assert.rejects(bookRepositories(supabase).deleteBook(book.id));assert.equal(controls.tables.books.length,1);await bookRepositories(supabase).deleteBook(book.id);assert.equal(controls.tables.books.length,0);
});
test('book notes preserve ID/type and concurrent other fields; no-op and read failures are verified',async()=>{
 const note={id:'old-note',book_id:book.id,type:'purpose',content:'처음'};const {supabase,controls}=memorySupabase({book_notes:[{...note,updated_at:'server'}]});const repo=bookRepositories(supabase);await repo.notes.save({...note,content:'수정'},note);assert.deepEqual(controls.requests[0].payload,{content:'수정'});assert.equal(controls.tables.book_notes[0].updated_at,'server');controls.failNext('books',{status:503,read:true});await assert.rejects(repo.books.fetchConfirmed());await assert.rejects(repo.books.save(book,book),/삭제/);
});
test('page and date validation rejects NaN negative fractional beyond-total inputs; legacy links unchanged',()=>{
 for(const current_page of [-1,1.5,301,NaN])assert.throws(()=>validateBook({...book,current_page}));for(const start_date of ['2026-02-30','bad'])assert.throws(()=>validateBook({...book,start_date}));assert.throws(()=>validateBook({...book,start_date:'2026-10-20',finish_date:'2026-10-01'}));assert.throws(()=>validateBook({...book,thumbnail:'javascript:x'}));const old={...book,thumbnail:'legacy'};validateBook({...old,title:'새 제목'},old);
});
test('statistics maintain legacy missing-completion-date fallback and never invent books',()=>{
 const rows=[{...book,status:'done' as const,finish_date:'2026-10-20'},{...book,id:'fallback',status:'done' as const,finish_date:null,added_at:'2026-09-01'}];const stats=bookStatistics(rows,'2026-10-25');assert.equal(stats.done,2);assert.equal(stats.month,1);assert.equal(stats.year,2);assert.equal(stats.months[8].count,1);assert.equal(bookStatistics([],'2026-10-25').total,0);
});
test('Kakao metadata fills blanks only, including no-cover result, manual input always remains',()=>{
 const next=applyBookSuggestion({...book,author:'',publisher:'',thumbnail:''},{title:'검색 제목',authors:['검색 저자'],publisher:'검색 출판사',thumbnail:''},new Set(['publisher']));assert.equal(next.title,book.title);assert.equal(next.author,'검색 저자');assert.equal(next.publisher,'');assert.equal(next.thumbnail,'');
});
test('book photo upload shares confirmed protocol in existing bucket; acknowledgement retry checks identical bytes, no overwrite/delete',async()=>{
 const memory=memoryFoodStorage([]);const client={storage:memory.storage};const file=new File(['image-content'],'quote.jpg',{type:'image/jpeg'}),session={file,operationId:'00000000-0000-4000-8000-000000000001'};
 memory.controls.failNext('upload',{afterCommit:true,status:0});await assert.rejects(ensureBookPhoto(client,quote.id,session));const url=await ensureBookPhoto(client,quote.id,session);assert.match(url,/book-photos/);assert.equal(memory.controls.objects.size,1);const count=memory.controls.requests.length;assert.equal(await ensureBookPhoto(client,quote.id,session),url);assert.equal(memory.controls.requests.length,count);assert.ok(memory.controls.requests.every(r=>r.kind!=='remove'));await assert.rejects(bookPhotoStorage(client).uploadConfirmed(new File(['different'],'quote.jpg',{type:'image/jpeg'}),quote.id,session.operationId),/다른 파일/);
});
test('books pagination orders by existing added_at, and timestamp serialization confirms legacy date-only creates',async()=>{
 const memory=memorySupabase({});const orders:Array<[string,string]>=[];
 const client={from(table:string){const query=memory.supabase.from(table);const proxy:any=new Proxy({}, {get(_,key){
  if(key==='then')return (resolve:any,reject:any)=>query.then((result:any)=>{if(result.data)for(const r of Array.isArray(result.data)?result.data:[result.data])for(const field of ['created_at','added_at'])if(typeof r[field]==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r[field]))r[field]+='T00:00:00+00:00';return result;}).then(resolve,reject);
  if(key==='order')return (field:string)=>{orders.push([table,field]);return proxy;};
  const value=query[key];return typeof value==='function'?(...args:any[])=>{const result=value(...args);return result===query?proxy:result;}:value;
 }});return proxy;}};
 const repo=bookRepositories(client);await repo.books.save(book);await repo.quotes.save(quote);await repo.books.fetchConfirmed();assert.ok(orders.some(([table,field])=>table==='books'&&field==='added_at'));assert.equal(orders.some(([table,field])=>table==='books'&&field==='created_at'),false);
});
