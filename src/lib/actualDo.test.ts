import test from 'node:test';import assert from 'node:assert/strict';
import {actualInterval,blockTimes,blockLocalTime,validateActualBlock,timerSessionBlock} from './actualDo';
import {actualWrites} from './actualWrites';import {memorySupabase} from '../../scripts/test/fixtures/memory-supabase';
import {aggregateActivity} from './timeAggregation';import {snapshotTags} from './activityEntries';
const interval=(a:string,b:string)=>actualInterval(`2027-01-01T${a}`,`2027-01-01T${b}`)!;
test('DO intervals calculate precise minutes and never infer reversed HH clocks',()=>{
 assert.equal(interval('20:30','21:00').elapsedSec,1800);assert.equal(interval('21:00','22:00').elapsedSec,3600);assert.equal(interval('21:30','23:00').elapsedSec,5400);
 assert.equal(actualInterval(),undefined);
 for(const [a,b]of [['23:00','01:00'],['12:00','12:00'],['25:00','26:00']])assert.throws(()=>interval(a,b));
 assert.throws(()=>actualInterval('2027-02-30T10:00','2027-03-01T11:00'));assert.throws(()=>actualInterval('2027-01-01T10:00'));
 const overnight=actualInterval('2027-01-01T23:30','2027-01-02T00:30')!;assert.equal(overnight.elapsedSec,3600);
 assert.deepEqual(blockTimes('2027-01-01','2027-01-01T23:30','2027-01-02T00:30'),{start:'23:30',end:'24:30'});
 assert.equal(blockLocalTime('2027-01-01','24:30'),'2027-01-02T00:30');
 assert.deepEqual(blockTimes('2027-01-01','2027-01-02T00:15','2027-01-02T00:45'),{start:'24:15',end:'24:45'});
 assert.throws(()=>blockTimes('2027-01-01','2027-01-03T00:15','2027-01-03T00:45'));
 assert.throws(()=>blockTimes('2027-01-02','2027-01-01T23:30','2027-01-02T00:30'));
});
test('timer session adapter preserves session ID and active/paused seconds without additional rows',()=>{
 const input={sessionId:'session',todoId:'t1',date:'2027-01-01',startedAt:'2027-01-01T21:00',endedAt:'2027-01-01T22:00',elapsedSec:3000,pausedSec:600};
 const b=timerSessionBlock(input);assert.equal(b.id,'session');assert.equal(b.elapsedSec,3000);assert.equal(b.start,'21:00');assert.equal(b.end,'22:00');
 assert.throws(()=>timerSessionBlock({...input,pausedSec:500}));assert.throws(()=>validateActualBlock({...b,end:undefined}));assert.throws(()=>validateActualBlock({...b,elapsedSec:4000}));
});
for(const table of ['activity_entries','todo_time_blocks'])test(`${table}: confirmed CRUD, duplicate stable IDs, lost response, CAS conflict and original field preservation`,async()=>{
 const row={id:'row',operation_id:'row',todo_id:'todo',date:'2027-01-01',name:'빨래',start_time:'20:30',end_time:'21:00',elapsed_sec:1800,classification_snapshot:{version:1,shares:[]}};
 const {supabase,controls}=memorySupabase({[table]:[]});const repo=actualWrites(supabase,table,(r:typeof row)=>r,r=>r as typeof row);
 controls.failNext(table,{status:503});await assert.rejects(repo.createConfirmed(row));assert.equal(controls.tables[table].length,0);
 controls.failNext(table,{status:503,afterCommit:true});await assert.rejects(repo.createConfirmed(row));await repo.createConfirmed(row);assert.equal(controls.tables[table].length,1);
 controls.tables[table][0].memo='다른 기기 메모';const updated={...row,start_time:'21:30',end_time:'22:00'};await repo.updateConfirmed(row,updated);assert.equal(controls.tables[table][0].memo,'다른 기기 메모');assert.deepEqual(Object.keys(controls.requests.at(-1).payload),['start_time','end_time']);
 controls.failNext(table,{status:503,afterCommit:true});const moved={...updated,date:'2027-01-02'};await repo.updateConfirmed(updated,moved);assert.equal(controls.tables[table][0].id,'row');
 controls.tables[table][0].elapsed_sec=900;await assert.rejects(repo.updateConfirmed(moved,{...moved,elapsed_sec:3600}));await assert.rejects(repo.deleteConfirmed('row',moved));
 const current=structuredClone(controls.tables[table][0]);await assert.rejects(repo.updateConfirmed(current,{...current,todo_id:'other'}));await assert.rejects(repo.updateConfirmed(current,{...current,operation_id:'other'}));controls.hold(table);const pending=repo.updateConfirmed(current,{...current,elapsed_sec:1200});while(!controls.requests.at(-1)?.payload?.elapsed_sec||controls.requests.at(-1).payload.elapsed_sec!==1200)await new Promise(r=>setTimeout(r,0));controls.tables[table][0].elapsed_sec=600;controls.release(table);await assert.rejects(pending);assert.equal(controls.tables[table][0].elapsed_sec,600);
 controls.failNext(table,{status:503,afterCommit:true});await assert.rejects(repo.deleteConfirmed('row',structuredClone(controls.tables[table][0])));await repo.deleteConfirmed('row');assert.equal(controls.tables[table].length,0);await repo.deleteConfirmed('row');
});
test('PLAN/DO remain independent, sessions count once and frozen classification survives TODO tag edits',()=>{
 const tags=[{id:'work',name:'업무',color:'#506c4c',trackTime:true}];const todo={id:'t',text:'운동',date:'2027-01-01',status:'active' as const,isTop3:false,tags:['work'],planStart:'19:00',planEnd:'20:00'};
 const blocks=[{id:'b',todoId:'t',date:todo.date,start:'21:00',end:'22:00',elapsedSec:3600,classificationSnapshot:snapshotTags(['work'],tags)}];
 const total=()=>aggregateActivity([todo],[],tags,'2027-01-01','2027-01-01',blocks).coverage.recordedMinutes;
 assert.equal(total(),60);assert.equal(todo.planStart,'19:00');todo.tags=[];assert.equal(total(),60);assert.equal(blocks[0].classificationSnapshot.shares[0].name,'업무');assert.equal(todo.status,'active');
 blocks.push({...blocks[0],id:'b2',start:'22:00',end:'22:30',elapsedSec:1800});assert.equal(total(),90);blocks.splice(0,1);assert.equal(total(),30);
});

test('unchanged legacy timer precision is preserved without fabricating or repairing clocks',()=>{const old={id:'old',todoId:'todo',date:'2027-01-01',start:'10:00',end:'10:00',elapsedSec:30};assert.throws(()=>validateActualBlock(old));assert.doesNotThrow(()=>validateActualBlock(old,true));});

test('activity acknowledgement accepts PostgreSQL timestamp spelling without changing instants or IDs',async()=>{
 const {activityRepository}=await import('./activityRepository');const entry={id:'a',operationId:'a',date:'2027-01-01',name:'실제',elapsedSec:1800,classificationSnapshot:{version:1 as const,shares:[]},startedAt:'2027-01-01T12:00:00.000Z',endedAt:'2027-01-01T12:30:00.000Z'};
 const{controls,supabase}=memorySupabase({activity_entries:[]});
 const client={from(table:string){const query=supabase.from(table);let proxy:any;proxy=new Proxy({}, {get(_,key){if(key==='then')return(resolve:any,reject:any)=>query.then((result:any)=>{for(const row of result.data??[]){if(row.started_at)row.started_at=row.started_at.replace('.000Z','+00:00');if(row.ended_at)row.ended_at=row.ended_at.replace('.000Z','+00:00');}return resolve(result);},reject);return(...args:any[])=>{query[key](...args);return proxy;};}});return proxy;}};
 const saved=await activityRepository(client).createConfirmed(entry);assert.equal(saved.id,'a');assert.equal(Date.parse(saved.startedAt!),Date.parse(entry.startedAt));assert.equal(controls.tables.activity_entries.length,1);
});
