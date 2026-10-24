import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {supabase} from '../../lib/supabase';
import {bookRepositories,ensureBookPhoto,type BookPhotoSession,type BookRow,type QuoteRow} from '../../lib/bookRecords';
import {mergeConfirmedRows,SaveCoordinator,saveIntent} from '../../lib/saveCoordinator';
import {useRealtimeSync} from './useRealtimeSync';
import {getLogicalToday} from '../store';
type Repository<T>={fetchConfirmed:()=>Promise<T[]>;save:(r:T,before?:T)=>Promise<T>;deleteConfirmed:(id:string)=>Promise<void>};
function useBookCollection<T extends {id:string}>(table:string,label:string,repo:Repository<T>){
 const [coordinator]=useState(()=>new SaveCoordinator());useSyncExternalStore(useCallback(cb=>coordinator.subscribe(cb),[coordinator]),()=>coordinator.revision);
 const [records,setRecords]=useState<T[]>([]),[loading,setLoading]=useState(true),[readError,setReadError]=useState('');
 const rows=useRef<T[]>([]),sequence=useRef(0),mounted=useRef(true);
 const commit=useCallback((next:T[])=>{sequence.current++;rows.current=next;if(mounted.current)setRecords(next);},[]);
 const refresh=useCallback(async()=>{const request=++sequence.current;try{const remote=await repo.fetchConfirmed();if(!mounted.current||request!==sequence.current)return;const next=mergeConfirmedRows(remote,rows.current,coordinator.protectedIds(table));rows.current=next;setRecords(next);setReadError('');}catch{if(mounted.current&&request===sequence.current)setReadError(`${label}을 불러오지 못했어요. 마지막 확인 결과를 유지해요.`);}finally{if(mounted.current&&request===sequence.current)setLoading(false);}},[repo,table,label,coordinator]);
 useEffect(()=>{mounted.current=true;void refresh();const visible=()=>{if(document.visibilityState!=='hidden')void refresh();};window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);return()=>{mounted.current=false;sequence.current++;window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};},[refresh]);useRealtimeSync(table,refresh);
 const run=(id:string,intent:string,execute:()=>Promise<T>)=>{sequence.current++;return coordinator.run({key:`${table}:${id}`,label,intent,execute,commit:r=>commit([...rows.current.filter(x=>x.id!==r.id),r])});};
 const save=(r:T,before?:T)=>{const value=structuredClone(r),old=before?structuredClone(before):undefined;return run(r.id,saveIntent({value,old}),()=>repo.save(value,old));};
 const remove=(id:string,execute=()=>repo.deleteConfirmed(id))=>{sequence.current++;return coordinator.run({key:`${table}:${id}`,label:`${label} 삭제`,intent:'delete',execute:async()=>{await execute();return id;},commit:removed=>commit(rows.current.filter(x=>x.id!==removed))});};
 return {records,loading,readError,refresh,save,run,remove,states:coordinator.snapshot(),retry:(id:string)=>coordinator.retry(`${table}:${id}`),dismiss:(id:string)=>coordinator.dismiss(`${table}:${id}`)};
}
export function useBookRecords(){
 const [repo]=useState(()=>bookRepositories(supabase));
 const books=useBookCollection('books','책 기록',repo.books),quotes=useBookCollection('book_quotes','구절',repo.quotes),notes=useBookCollection('book_notes','책 메모',repo.notes),logs=useBookCollection('reading_logs','독서 이력',repo.logs);
 return {books,quotes,notes,logs,
  saveBook:(r:BookRow,before?:BookRow)=>{const value=structuredClone(r),old=before?structuredClone(before):undefined;return books.run(r.id,saveIntent({value,old}),repo.progressOperation(value,old,crypto.randomUUID(),getLogicalToday()));},
  saveQuote:(r:QuoteRow,before?:QuoteRow,photo?:BookPhotoSession)=>{const value=structuredClone(r),old=before?structuredClone(before):undefined;return quotes.run(r.id,saveIntent({value,old,photo:photo?.operationId}),async()=>{const image_url=photo?await ensureBookPhoto(supabase,r.id,photo):value.image_url;return repo.quotes.save({...value,image_url},old);});},
  deleteBook:(id:string)=>books.remove(id,()=>repo.deleteBook(id)),
 };
}
export type BookController=ReturnType<typeof useBookRecords>;
