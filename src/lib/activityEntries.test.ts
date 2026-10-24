import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotTags, validateActivity, validSnapshot, type ActivityEntry } from './activityEntries';
import { activityRepository } from './activityRepository';
import { aggregateActivity, toTagRows } from './timeAggregation';
import { reportRange, moveReportDate, activityOverlaps } from './activityReport';
import { memorySupabase } from '../../scripts/test/fixtures/memory-supabase';
import { SaveCoordinator, saveIntent } from './saveCoordinator';
import { getWeekKey } from './weekKeys';
const tags = [{ id:'work',name:'자기계발',color:'#78936a',trackTime:true }, { id:'life',name:'생활',color:'#baab84',trackTime:true },{ id:'aux',name:'독서',color:'#aaa',trackTime:false }];
const id = '11111111-1111-4111-8111-111111111111';
const entry = (changes:Partial<ActivityEntry> = {}):ActivityEntry => ({ id,operationId:id,name:'독서',date:'2027-01-01',elapsedSec:1800,categoryId:'work',classificationSnapshot:snapshotTags(['work'],tags),...changes });
const todo = { id:'todo',text:'할 일',date:'2027-01-01',status:'active' as const,isTop3:false,tags:['work','life','aux'],doElapsedSec:3600 };

test('activity snapshot is frozen after TODO/category edits, deletion and role changes', () => {
 const e=entry(); const frozen=structuredClone(e);
 const changed=tags.map(t=>({...t,name:'변경',color:'#000',trackTime:false}));
 const a=aggregateActivity([],[],changed,e.date,e.date,[],[e]);
 assert.equal(a.coverage.recordedMinutes,30);assert.equal(a.byTag.get('work')?.minutes,30);
 assert.equal(toTagRows(a,[])[0].tagName,'자기계발');assert.equal(toTagRows(a,[])[0].tagColor,'#78936a');assert.deepEqual(e,frozen);
 const b={id:'block',todoId:'todo',date:e.date,elapsedSec:600,classificationSnapshot:snapshotTags(['life'],tags)};
 assert.equal(aggregateActivity([{...todo,tags:[]}],[],[],e.date,e.date,[b]).byTag.get('life')?.minutes,10);
});
test('explicit unclassified snapshot stays unclassified; malformed snapshot is diagnosed, never inferred',()=>{
 for (const snap of [{version:1,shares:[]}, {}, {version:1,shares:[null]}]) {
  const a=aggregateActivity([],[],tags,'2027-01-01','2027-01-01',[],[entry({categoryId:undefined,classificationSnapshot:snap as any})]);
  assert.equal(a.totalMinutes,0); assert.equal(a.coverage.unclassifiedMinutes,30);
 }
 assert.equal(validSnapshot({version:1,shares:[{tagId:'work',name:'a',color:'b',weight:2}]}),false);
});
test('independent + TODO blocks + split legacy + actual event; plans, auxiliary tags and legacy duplicate excluded',()=>{
 const blocks=[{id:'b1',todoId:'todo',date:todo.date,elapsedSec:600},{id:'b2',todoId:'todo',date:todo.date,elapsedSec:1200}];
 const events=[{id:'plan',title:'계획',date:todo.date,startTime:'09:00',endTime:'10:00'}, {id:'actual',title:'실제',date:todo.date,startTime:'09:00',endTime:'10:00',doStart:'09:00',doEnd:'09:30',tags:['work']}];
 const a=aggregateActivity([todo,{...todo,id:'legacy'}],events,tags,todo.date,todo.date,blocks,[entry()]);
 assert.equal(a.coverage.recordedMinutes,150);assert.equal(a.byTag.get('work')?.minutes,105);assert.equal(a.byTag.get('life')?.minutes,45);assert.equal(a.byTag.has('aux'),false);
 assert.equal(a.records.filter(r=>r.id==='todo').length,0);assert.equal(a.records.length,5);
});
test('manual durations need no invented times; bad dates and mismatched real intervals rejected',()=>{
 validateActivity(entry());assert.equal(entry().startedAt,undefined);
 for (const bad of [{date:'2027-02-30'},{elapsedSec:-1},{elapsedSec:Infinity},{name:' '},{startedAt:'2026-12-31T23:50:00Z'},{startedAt:'2026-12-31T23:50:00Z',endedAt:'2027-01-01T00:10:00Z'}]) assert.throws(()=>validateActivity(entry(bad)));
 validateActivity(entry({elapsedSec:1200,startedAt:'2026-12-31T23:50:00Z',endedAt:'2027-01-01T00:10:00Z'}));
});
test('day/week/month sums use recorded date at midnight, ISO year and month boundaries; no synthetic split',()=>{
 assert.equal(getWeekKey(new Date('2027-01-01T12:00:00')),'2026-W53');
 const activities=[entry({date:'2026-12-31',elapsedSec:1200,startedAt:'2026-12-31T23:50:00Z',endedAt:'2027-01-01T00:10:00Z'}),entry({id:'other',date:'2027-01-01',elapsedSec:1800}),entry({id:'past',date:'2020-01-01',elapsedSec:600})];
 const sum=(start:string,end:string)=>aggregateActivity([],[],tags,start,end,[],activities).coverage.recordedMinutes;
 assert.equal(sum('2026-12-31','2026-12-31'),20);assert.equal(sum('2027-01-01','2027-01-01'),30);assert.equal(sum('2026-12-28','2027-01-03'),50);
 for(const period of ['week','month'] as const){const r=reportRange('2027-01-01',period);assert.equal(r.dates.reduce((n,d)=>n+sum(d,d),0),sum(r.start,r.end));}
 assert.equal(reportRange('2027-01-01','day').dates.length,1);assert.equal(reportRange('2027-03-01','month').dates.length,31);assert.equal(moveReportDate('2027-01-01','week',-1),'2026-12-25');assert.equal(sum('2020-01-01','2020-01-01'),10);
});
test('known real intervals identify overlap without removing or merging durations; unknown intervals remain unknown',()=>{
 const entries=[entry({elapsedSec:1800,startedAt:'2027-01-01T09:00:00Z',endedAt:'2027-01-01T09:30:00Z'}),entry({id:'two',startedAt:'2027-01-01T09:15:00Z',endedAt:'2027-01-01T09:45:00Z'}),entry({id:'manual'})];
 const a=aggregateActivity([],[],tags,'2027-01-01','2027-01-01',[],entries);
 assert.equal(a.coverage.recordedMinutes,90);assert.equal(activityOverlaps(a.records).length,1);assert.equal(activityOverlaps(a.records)[0].minutes,15);
 const cross=aggregateActivity([],[],tags,'2026-12-31','2027-01-01',[],[entry({date:'2026-12-31',elapsedSec:1800,startedAt:'2026-12-31T23:50:00Z',endedAt:'2027-01-01T00:20:00Z'}),entry({id:'next',date:'2027-01-01',elapsedSec:1800,startedAt:'2027-01-01T00:00:00Z',endedAt:'2027-01-01T00:30:00Z'})]);
 assert.equal(activityOverlaps(cross.records)[0].minutes,20);
});
test('stable operation retries confirm one row; failed updates/deletes retain confirmed values, reload preserves snapshot',async()=>{
 const {supabase,controls}=memorySupabase({activity_entries:[]});const repo=activityRepository(supabase);const coordinator=new SaveCoordinator();let rows:ActivityEntry[]=[];const value=entry();
 controls.failNext('activity_entries',{status:0,afterCommit:true});
 const run=()=>coordinator.run({key:`activityEntries:${id}`,label:'記録',intent:saveIntent(value),execute:()=>repo.createConfirmed(value),commit:a=>rows=[a]});
 await Promise.all([run(),run()]);assert.equal(rows.length,0);assert.equal(controls.tables.activity_entries.length,1);
 await coordinator.retry(`activityEntries:${id}`);assert.equal(rows.length,1);assert.equal(controls.tables.activity_entries.length,1);assert.equal((await repo.fetchConfirmed())[0].classificationSnapshot.shares[0].name,'자기계발');
 controls.failNext('activity_entries',{status:503});await assert.rejects(()=>repo.updateConfirmed(value,entry({name:'수정'})));assert.equal((await repo.getConfirmed(id))?.name,'독서');
 const updated=await repo.updateConfirmed(value,entry({name:'수정'}));assert.equal(updated.name,'수정');
 controls.failNext('activity_entries',{status:0,afterCommit:true});await assert.rejects(()=>repo.deleteConfirmed(id));await repo.deleteConfirmed(id);assert.equal((await repo.fetchConfirmed()).length,0);
});
test('missing activity table or snapshot column is unavailable, not a successful empty save',async()=>{
 for (const table of ['activity_entries','todo_time_blocks']){
  const {supabase,controls}=memorySupabase({});controls.failNext(table,{status:404,code:table==='activity_entries'?'PGRST205':'42703',read:true});
  await assert.rejects(()=>activityRepository(supabase).checkSchema(),/스키마/);assert.equal(controls.requests.length,0);
 }
});
test('JSONB key order normalization does not reject a confirmed snapshot or create a duplicate', async()=>{
 const {supabase,controls}=memorySupabase({activity_entries:[]});const repo=activityRepository(supabase);const value=entry();await repo.createConfirmed(value);
 controls.tables.activity_entries[0].classification_snapshot={shares:[{weight:1,color:'#78936a',name:'자기계발',tagId:'work'}],version:1};
 await repo.createConfirmed(value);assert.equal(controls.tables.activity_entries.length,1);
});
test('paged confirmed history includes records beyond the REST default limit and errors never return partial success',async()=>{
 const initial=Array.from({length:1201},(_,i)=>({...entry({id:String(i),operationId:String(i)}),elapsed_sec:1800,operation_id:String(i),classification_snapshot:entry().classificationSnapshot}));
 const {supabase,controls}=memorySupabase({activity_entries:initial});assert.equal((await activityRepository(supabase).fetchConfirmed()).length,1201);
 let queries=0;const failing={from(table:string){if(++queries===2)controls.failNext(table,{status:503,read:true});return supabase.from(table);}};
 await assert.rejects(()=>activityRepository(failing).fetchConfirmed());
});
