import {confirmedWrites} from './confirmedWrites';
import {SaveFailure,saveFailure,saveIntent} from './saveCoordinator';

/** Confirmed actual-record writes with readback and optimistic concurrency, never optimistic UI. */
export function actualWrites<T extends {id:string}, Row extends {id:string}>(client:{from:(table:string)=>any},table:string,encode:(record:T)=>Row,decode:(row:Row)=>T){
 const base=confirmedWrites(client,table,encode,decode);
 const normal=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():v??null;
 const equal=(a:unknown,b:unknown)=>saveIntent(normal(a))===saveIntent(normal(b));
 const same=(a:T,b:T)=>Object.entries(encode(a)).every(([key,value])=>equal(value,(encode(b) as any)[key]));
 return {...base,
  async updateConfirmed(before:T,after:T):Promise<T>{
   if(before.id!==after.id)throw new SaveFailure('원본 기록 ID를 변경할 수 없어요.',false);
   const old=encode(before),next=encode(after);
   if(['todo_id','operation_id'].some(k=>k in old&&!equal((old as any)[k],(next as any)[k])))throw new SaveFailure('연결 TODO와 원본 요청 ID는 변경할 수 없어요.',false);
   const keys=Object.keys(next).filter(k=>k!=='id'&&!equal((old as any)[k],(next as any)[k]));
   const latest=await base.getConfirmed(before.id);
   if(!latest)throw new SaveFailure('수정할 실제 기록이 없어요. 다시 확인해주세요.',false);
   const current=encode(latest);
   if(['todo_id','operation_id'].some(k=>k in old&&!equal((old as any)[k],(current as any)[k])))throw new SaveFailure('기록의 연결 대상이 변경됐어요. 다시 확인해주세요.',false);
   if(keys.every(k=>equal((current as any)[k],(next as any)[k])))return latest;
   if(keys.some(k=>!equal((current as any)[k],(old as any)[k])&&!equal((current as any)[k],(next as any)[k])))throw new SaveFailure('다른 화면에서 같은 기록을 변경했어요. 초안을 보관하고 다시 확인해주세요.',false);
   let query=client.from(table).update(Object.fromEntries(keys.map(k=>[k,(next as any)[k]??null]))).eq('id',before.id);
   query=guard(query,current);
   try{const result=await query.select('*');if(result.error)throw saveFailure(result.error,result.status);
    if(!Array.isArray(result.data)||result.data.length!==1)throw new SaveFailure('저장 중 실제 기록이 변경됐어요. 초안을 유지하고 다시 확인해주세요.',false);
    const saved=decode(result.data[0]);if(!keys.every(k=>equal((encode(saved)as any)[k],(next as any)[k])))throw new SaveFailure('실제 기록 저장 결과를 확인하지 못했어요.',true);return saved;
   }catch(error){try{const found=await base.getConfirmed(before.id);if(found&&keys.every(k=>equal((encode(found)as any)[k],(next as any)[k])))return found;}catch{/* Explicit retry only. */}throw error;}
  },
  async deleteConfirmed(id:string,before?:T):Promise<void>{
   const latest=await base.getConfirmed(id);if(!latest)return;
   if(before&&!same(before,latest))throw new SaveFailure('삭제할 기록이 다른 화면에서 변경됐어요. 다시 확인해주세요.',false);
   const result=await guard(client.from(table).delete().eq('id',id),encode(latest)).select('*');if(result.error)throw saveFailure(result.error,result.status);
    if(!Array.isArray(result.data)||result.data.length!==1)throw new SaveFailure('삭제 중 실제 기록이 변경됐어요. 다시 확인해주세요.',false);
    if(await base.getConfirmed(id))throw new SaveFailure('실제 기록 삭제를 확인하지 못했어요.',true);
   // An uncertain deletion stays pending until explicit same-ID retry verifies absence.
  },
 };
 function guard(query:any,row:Row){for(const[key,value]of Object.entries(row)){if(key==='id')continue;query=value==null?query.is(key,null):query.eq(key,typeof value==='object'?JSON.stringify(value):value);}return query;}
}
