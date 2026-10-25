import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuickEntry} from './quickParse';
import {calendarPlanRepository} from './calendarPlanRepository';
import {memorySupabase} from '../../scripts/test/fixtures/memory-supabase';
const now=new Date(2026,11,31,9);
for(const [input,title,date,start,end] of [
 ['다음주 월요일 운동가기','운동가기','2027-01-04',undefined,undefined],
 ['다음주 월요일 운동가기 #자기계발 19:00~20:00','운동가기','2027-01-04','19:00','20:00'],
 ['18:00 퇴근','퇴근','2026-12-31','18:00',undefined],
 ['내일 오후 3시 병원','병원','2027-01-01','15:00',undefined],
 ['빨래개기 #집안일','빨래개기',null,undefined,undefined],
 ['이번 주 월요일 운동','운동','2026-12-28',undefined,undefined],
] as const)test(`PLAN parse ${input}`,()=>{const r=parseQuickEntry(input,now);assert.equal(r.title,title);assert.equal(r.date,date);assert.equal(r.startTime,start);assert.equal(r.endTime,end);});
test('invalid times, midnight and repeat/type/tag remain explicit',()=>{
 for(const input of ['25:00 운동','오후 13시 운동','19:99~20:00 운동','19:00~19:00 운동']){const p=parseQuickEntry(input,now);assert.ok(p.issues?.length);assert.equal(p.startTime,undefined);}
 assert.equal(parseQuickEntry('23:00~01:00 야간',now).crossesMidnight,true);
 assert.equal(parseQuickEntry('일정 내일 10시 회의',now).typeHint,'event');
 assert.equal(parseQuickEntry('매주 월요일 운동',now).date,'2027-01-04');
 assert.deepEqual(parseQuickEntry('운동 #자기계발',now).tags,['자기계발']);
});
for(const table of ['todos','events'] as const)test(`${table}: confirmed CRUD, partial CAS, failure, lost response and DO protection`,async()=>{
 const row={id:'stable',text:'계획',title:'계획',date:'2027-01-01',plan_start:'18:00',plan_end:'19:00',start_at:'2027-01-01T18:00:00+09:00',end_at:'2027-01-01T19:00:00+09:00',tags:[],do_start:null,do_end:null,extra:'보존'};
 const {supabase,controls}=memorySupabase({[table]:[],todo_time_blocks:[]});const repo=calendarPlanRepository(supabase,table);
 controls.failNext(table,{status:503});await assert.rejects(repo.save(row));assert.equal(controls.tables[table].length,0);
 controls.failNext(table,{status:503,afterCommit:true});await repo.save(row);assert.equal(controls.tables[table].length,1);await repo.save(row);assert.equal(controls.tables[table].length,1);
 const target={...row,text:'수정',title:'수정'};controls.tables[table][0].extra='외부 변경';const saved=await repo.save(target,row);assert.equal(saved!.extra,'외부 변경');assert.equal(saved!.do_start,null);
 const concurrent={...target,text:'다시',title:'다시'};controls.tables[table][0][table==='todos'?'text':'title']='충돌';await assert.rejects(repo.save(concurrent,target));
 const current=structuredClone(controls.tables[table][0]);controls.tables[table][0].do_start='19:00';await assert.rejects(repo.save(current,current,true));controls.tables[table][0].do_start=null;
 if(table==='todos'){controls.tables.todo_time_blocks.push({id:'actual',todo_id:'stable'});await assert.rejects(repo.save(current,current,true));controls.tables.todo_time_blocks=[];}
 controls.failNext(table,{status:503,afterCommit:true});await repo.save(current,current,true);assert.equal(controls.tables[table].length,0);
});
test('recurrence master cannot be rewritten or deleted',async()=>{const row={id:'repeat',text:'반복',recurrence_rule:'daily'};const {supabase}=memorySupabase({todos:[row]});const repo=calendarPlanRepository(supabase,'todos');await assert.rejects(repo.save({...row,text:'수정'},row));await assert.rejects(repo.save(row,row,true));});

test('time-only uses selected date while explicit tomorrow follows logical today',()=>{assert.equal(parseQuickEntry('18:00 퇴근',now,{selectedDate:'2027-02-02'}).date,'2027-02-02');assert.equal(parseQuickEntry('내일 회의',now,{selectedDate:'2027-02-02'}).date,'2027-01-01');});

test('existing actual attribution cannot move dates or classification but planned time can change',async()=>{const row={id:'actual',text:'기록',date:'2027-01-01',tags:['old'],do_start:'10:00',do_end:'11:00',plan_start:'09:00'};const {supabase,controls}=memorySupabase({todos:[row],todo_time_blocks:[]});const repo=calendarPlanRepository(supabase,'todos');await assert.rejects(repo.save({...row,date:'2027-01-02'},row));await assert.rejects(repo.save({...row,tags:['new']},row));await repo.save({...row,plan_start:'08:00'},row);assert.equal(controls.tables.todos[0].do_start,'10:00');});

test('PLAN CRUD cannot increase actual aggregation',async()=>{
 const {aggregateActivity}=await import('./timeAggregation');const {toTodo}=await import('./todoCodec');
 const existing={id:'actual',text:'실제',date:'2027-01-01',status:'active',is_top3:false,tags:[],do_start:'10:00',do_end:'11:00'};
 const {supabase,controls}=memorySupabase({todos:[existing],todo_time_blocks:[]});const repo=calendarPlanRepository(supabase,'todos');
 const total=()=>aggregateActivity(controls.tables.todos.map(r=>toTodo(r as any)),[],[],'2027-01-01','2027-01-01',[],[]).coverage.recordedMinutes;
 const before=total();assert.equal(before,60);const plan={id:'plan',text:'예정',date:'2027-01-01',status:'active',is_top3:false,tags:[],plan_start:'18:00',plan_end:'20:00'};
 await repo.save(plan);assert.equal(total(),before);await repo.save({...plan,plan_start:'15:00'},plan);assert.equal(total(),before);await repo.save({...existing,plan_start:'09:00'},existing);assert.equal(total(),before);
});
