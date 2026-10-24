import {confirmedWrites} from './confirmedWrites';
import {readAllRows} from './readAllRows';
import {SaveFailure,saveFailure,saveIntent} from './saveCoordinator';
import {safeCultureUrl} from './cultureRecords';
import {foodPhotoStorage} from './foodPhotos';
export type BookRow={id:string;title:string;author:string|null;publisher:string|null;thumbnail:string|null;total_pages:number;current_page:number;status:'want'|'reading'|'done';start_date:string|null;finish_date:string|null;added_at:string};
export type QuoteRow={id:string;book_id:string;text:string;page:number|null;tags:string[];starred:boolean;created_at:string;note:string|null;image_url:string|null};
export type NoteRow={id:string;book_id:string;type:string;content:string};
export type ReadingRow={id:string;book_id:string;page:number;date:string;duration_minutes:number|null;note:string|null;created_at?:string};
export const bookLabels={want:'읽고 싶은 책',reading:'읽는 중',done:'완독'};
const pick=<T extends {id:string}>(row:T,keys:string[]):T=>Object.fromEntries(keys.filter(k=>(row as any)[k]!==undefined).map(k=>[k,(row as any)[k]])) as T;
const bookKeys=['id','title','author','publisher','thumbnail','total_pages','current_page','status','start_date','finish_date','added_at'];
const quoteKeys=['id','book_id','text','page','tags','starred','created_at','note','image_url'];
const noteKeys=['id','book_id','type','content'];
const logKeys=['id','book_id','page','date','duration_minutes','note'];
function dateValid(date:string|null){return !date||(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date);}
export function validateBook(r:BookRow,before?:BookRow){
 if(!r.title.trim())throw new SaveFailure('책 제목을 입력해주세요.',false);
 if(![r.total_pages,r.current_page].every(v=>Number.isSafeInteger(v)&&v>=0)||r.total_pages>0&&r.current_page>r.total_pages)throw new SaveFailure('페이지는 0 이상의 정수로, 전체 페이지 이내로 입력해주세요.',false);
 if(!dateValid(r.start_date)||!dateValid(r.finish_date)||r.start_date&&r.finish_date&&r.finish_date<r.start_date)throw new SaveFailure('읽기 시작일과 완독일을 확인해주세요.',false);
 if(!(r.status in bookLabels))throw new SaveFailure('독서 상태를 확인해주세요.',false);
 if(r.thumbnail&&r.thumbnail!==before?.thumbnail&&!safeCultureUrl(r.thumbnail))throw new SaveFailure('표지는 http(s) 주소로 입력해주세요.',false);
}
export function bookProgress(r:BookRow){return r.total_pages>0?Math.min(100,Math.round(r.current_page/r.total_pages*100)):0;}
export function completionBook(r:BookRow,today:string):BookRow {
 const status=r.current_page>0&&r.total_pages>0&&r.current_page>=r.total_pages?'done':r.status;
 return {...r,status,finish_date:status==='done'&&!r.finish_date?today:r.finish_date};
}
export function bookStatistics(books:BookRow[],today:string){
 const done=books.filter(b=>b.status==='done');
 // Preserve legacy complete-date fallback, visibly labelled by the new UI.
 const finish=(b:BookRow)=>b.finish_date??b.added_at;
 return {total:books.length,done:done.length,year:done.filter(b=>finish(b).startsWith(today.slice(0,4))).length,month:done.filter(b=>finish(b).startsWith(today.slice(0,7))).length,
 months:Array.from({length:12},(_,i)=>({month:i+1,count:done.filter(b=>finish(b).startsWith(`${today.slice(0,4)}-${String(i+1).padStart(2,'0')}`)).length}))};
}
function repository<T extends {id:string}>(client:{from:(table:string)=>any},table:string,keys:string[],validate:(r:T,b?:T)=>void,decode:(r:T)=>T=r=>r){
 // Legacy inputs are date-only; PostgREST may serialize a midnight timestamp instead.
 const encode=(r:T)=>{const value=pick(r,keys);for(const key of ['added_at','created_at','start_date','finish_date']){const date=(value as any)[key];if(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}[T ]00:00:00(?:\.0+)?(?:Z|\+00:00)$/.test(date))(value as any)[key]=date.slice(0,10);}return value;};
 const writes=confirmedWrites<T,T>(client,table,encode,decode);
 return {...writes,fetchConfirmed:async()=> (await readAllRows<T>(client,table,table==='books'?'added_at':'created_at')).map(decode),async save(r:T,before?:T){validate(r,before);if(before&&before.id!==r.id)throw new SaveFailure('기록 ID가 일치하지 않아요.',false);if(!before)return writes.createConfirmed(r);
 const old=encode(before),next=encode(r),changed=Object.keys(next).filter(k=>k!=='id'&&saveIntent((old as any)[k])!==saveIntent((next as any)[k]));
 const saved=changed.length?await writes.updateConfirmed(before,r):await writes.getConfirmed(r.id);if(!saved)throw new SaveFailure('기록이 삭제되었거나 조회할 수 없어요.',false);
 if(changed.some(k=>saveIntent((encode(saved) as any)[k])!==saveIntent((next as any)[k])))throw new SaveFailure('저장 결과를 확인하지 못했어요.',false);return saved;
 }};
}
export function bookRepositories(client:{from:(table:string)=>any}){
 const books=repository<BookRow>(client,'books',bookKeys,validateBook,r=>({...r,total_pages:r.total_pages??0,current_page:r.current_page??0}));
 const quotes=repository<QuoteRow>(client,'book_quotes',quoteKeys,(r,b)=>{if(!r.text.trim())throw new SaveFailure('구절을 입력해주세요.',false);if(r.page!=null&&(!Number.isSafeInteger(r.page)||r.page<1))throw new SaveFailure('구절 페이지는 1 이상의 정수로 입력해주세요.',false);if(b&&r.book_id!==b.book_id)throw new SaveFailure('구절의 책 연결을 변경할 수 없어요.',false);if(r.image_url&&r.image_url!==b?.image_url&&!safeCultureUrl(r.image_url))throw new SaveFailure('사진 주소를 확인해주세요.',false);},r=>({...r,tags:r.tags??[],starred:r.starred??false,note:r.note??null,image_url:r.image_url??null}));
 const notes=repository<NoteRow>(client,'book_notes',noteKeys,(r,b)=>{if(b&&(r.book_id!==b.book_id||r.type!==b.type))throw new SaveFailure('기존 메모 연결을 보존해주세요.',false);});
 const logs=repository<ReadingRow>(client,'reading_logs',logKeys,()=>{});
 return {books,quotes,notes,logs,
  // A stable operation owns one log ID. Cache confirmed book on log-only retry.
  progressOperation(record:BookRow,before:BookRow|undefined,logId:string,date:string){
   let saved:BookRow|undefined;const hasLog=!!before&&record.current_page!==before.current_page;
   return async()=>{if(!saved)saved=await books.save(record,before);if(hasLog){try{await logs.save({id:logId,book_id:record.id,page:record.current_page,date,duration_minutes:null,note:null});}catch(error){const failure=saveFailure(error);throw new SaveFailure(`책 정보는 저장됐지만 독서 이력을 확인하지 못했어요. ${failure.message}`,failure.retryable);}}const current=await books.getConfirmed(record.id);if(!current)throw new SaveFailure('책이 삭제되었거나 조회할 수 없어요.',false);return current;};
  },
  async deleteBook(id:string){
   for(const table of ['book_quotes','book_notes','reading_logs']){const result=await client.from(table).select('id').eq('book_id',id);if(result.error)throw saveFailure(result.error,result.status);if(!Array.isArray(result.data))throw new SaveFailure('연결 기록을 확인하지 못했어요.',false);if(result.data.length)throw new SaveFailure('구절·메모·독서 이력이 연결된 책은 여기서 삭제하지 않아요. 기존 기록을 보존해요.',false);}
   await books.deleteConfirmed(id);
  }
 };
}
export interface BookSuggestion{title:string;authors:string[];publisher:string;thumbnail:string}
export async function searchBooks(query:string,signal?:AbortSignal):Promise<BookSuggestion[]>{const response=await fetch(`/api/kakao-books?query=${encodeURIComponent(query.trim())}`,{signal});if(!response.ok)throw new Error('book search failed');const data=await response.json();if(!Array.isArray(data.documents))throw new Error('invalid book search');return data.documents.filter((r:any)=>typeof r.title==='string').map((r:any)=>({title:r.title,authors:Array.isArray(r.authors)?r.authors.filter((s:any)=>typeof s==='string'):[],publisher:typeof r.publisher==='string'?r.publisher:'',thumbnail:typeof r.thumbnail==='string'?r.thumbnail:''}));}
export function applyBookSuggestion(r:BookRow,s:BookSuggestion,touched:Set<keyof BookRow>){const next={...r};const values={title:s.title,author:s.authors.join(', '),publisher:s.publisher,thumbnail:s.thumbnail};for(const key of Object.keys(values) as (keyof typeof values)[])if(!next[key]&&!touched.has(key))next[key]=values[key];return next;}
// Reuse the already verified upload protocol; route it to the existing book-photos bucket.
// Unique flat paths, upsert:false, byte-verified retries. Never remove old objects.
export function bookPhotoStorage(client:{storage:{from:(bucket:string)=>any}}){return foodPhotoStorage({storage:{from:()=>client.storage.from('book-photos')}});}
export interface BookPhotoSession {file:File;operationId:string;url?:string;pending?:Promise<string>}
export async function ensureBookPhoto(client:{storage:{from:(bucket:string)=>any}},id:string,session:BookPhotoSession):Promise<string>{
 if(session.url)return session.url;if(session.pending)return session.pending;
 session.pending=bookPhotoStorage(client).uploadConfirmed(session.file,id,session.operationId).then(url=>{session.url=url;return url;});
 try{return await session.pending;}finally{session.pending=undefined;}
}
