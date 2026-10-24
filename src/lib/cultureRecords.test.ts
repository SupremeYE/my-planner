import test from 'node:test';
import assert from 'node:assert/strict';
import type { CultureRecord } from '../app/store';
import { cultureRepository, fromCultureRecord, toCultureRecord, filterCultureRecords, safeCultureUrl, validateCultureRecord } from './cultureRecords';
import { applyCultureSuggestion, cultureYouTubeId } from './cultureMetadata';
import { SaveCoordinator } from './saveCoordinator';
import { memorySupabase } from '../../scripts/test/fixtures/memory-supabase';

const record: CultureRecord = {id:'old-id', title:'오래 간직한 영화', platform:'netflix', contentType:'movie', status:'completed',
  rating:4.5, review:'나의 원래 감상', insight:'마지막 장면', tags:['주말','쉼'], thumbnailUrl:'https://media.example.invalid/old.jpg?original=1',
  url:'https://example.invalid/movie', externalSource:'tmdb_movie', externalId:'123', watchedDate:'2026-10-01', createdAt:'2026-10-01T00:00:00Z'};

test('culture codec preserves ID, original media URLs, legacy fields, zero rating and null provenance', () => {
  const row = {...fromCultureRecord(record), created_at:record.createdAt, rating:0, external_source:null};
  const decoded = toCultureRecord(row);
  assert.deepEqual(fromCultureRecord(decoded), {...fromCultureRecord(record), rating:0, external_source:null});
  assert.equal(decoded.createdAt, record.createdAt);
});
test('confirmed culture updates send only changed columns and retain other-device fields and unknown server columns', async () => {
  const {supabase, controls} = memorySupabase({culture_records:[{...fromCultureRecord(record), review:'다른 기기의 감상', legacy_extra:'keep', user_id:'owner'}]});
  const repo = cultureRepository(supabase);
  const saved = await repo.save({...record, title:'수정한 제목'}, record);
  assert.equal(saved.review, '다른 기기의 감상');
  const {updated_at, ...patch} = controls.requests[0].payload;
  assert.deepEqual(patch, {title:'수정한 제목'});
  assert.ok(Number.isFinite(Date.parse(updated_at)));
  assert.equal(controls.tables.culture_records[0].legacy_extra,'keep');
  assert.equal(saved.thumbnailUrl,record.thumbnailUrl);
  assert.equal(saved.externalId,'123');
  assert.equal(saved.rating,4.5);
});
test('no-op edit verifies current row and cannot claim a deleted record was saved', async () => {
  const {supabase, controls} = memorySupabase({culture_records:[{...fromCultureRecord(record),review:'fresh'}]});
  const repo=cultureRepository(supabase);
  assert.equal((await repo.save(record,record)).review,'fresh');
  assert.equal(controls.requests.length,0);
  controls.tables.culture_records=[];
  await assert.rejects(repo.save(record,record),/기록이 삭제/);
});
test('create acknowledgement loss and explicit retry keep one stable ID, duplicate clicks share a request', async () => {
  const {supabase, controls}=memorySupabase({culture_records:[]});
  const repo=cultureRepository(supabase), coordinator=new SaveCoordinator();
  controls.failNext('culture_records',{status:0,afterCommit:true});
  let confirmed: CultureRecord | null=null;
  const request={key:'culture:old-id',label:'등록',intent:'same',execute:()=>repo.save(record),commit:(r:CultureRecord)=>{confirmed=r;}};
  const first=coordinator.run(request), duplicate=coordinator.run(request);
  assert.equal(first,duplicate); assert.equal(await first,null); assert.equal(confirmed,null);
  assert.equal(controls.tables.culture_records.length,1);
  assert.equal((await coordinator.retry('culture:old-id'))?.id,record.id);
  assert.equal(controls.tables.culture_records.length,1);
});
test('same create ID with a changed payload never overwrites the committed row', async () => {
  const {supabase,controls}=memorySupabase({culture_records:[fromCultureRecord(record)]});
  await assert.rejects(cultureRepository(supabase).save({...record,title:'different'}),/다른 내용/);
  assert.equal(controls.tables.culture_records[0].title,record.title);
});
test('delete requires an absence read; a failed absence read is not success and retry is idempotent', async () => {
  const {supabase,controls}=memorySupabase({culture_records:[fromCultureRecord(record)]});
  const repo=cultureRepository(supabase);
  controls.failNext('culture_records',{status:503,read:true});
  await assert.rejects(repo.deleteConfirmed(record.id));
  assert.equal(controls.tables.culture_records.length,0);
  await repo.deleteConfirmed(record.id);
  assert.deepEqual(controls.tables.culture_records,[]);
});
test('read errors reject rather than returning an empty culture library', async () => {
  const {supabase,controls}=memorySupabase({culture_records:[fromCultureRecord(record)]});
  controls.failNext('culture_records',{status:503,read:true});
  await assert.rejects(cultureRepository(supabase).fetchConfirmed());
  assert.equal((await cultureRepository(supabase).fetchConfirmed()).length,1);
});
test('filters preserve dropped and legacy content types, search tags, and rank recorded zero above absent ratings', () => {
  const dropped={...record,id:'dropped',contentType:'anime' as const,status:'dropped' as const};
  const filter={search:'',status:'all' as const,type:'all' as const,platform:'all' as const,sort:'rating' as const};
  assert.equal(filterCultureRecords([record,dropped],filter).length,2);
  assert.deepEqual(filterCultureRecords([record,dropped],{...filter,status:'dropped'}).map(r=>r.id),['dropped']);
  assert.equal(filterCultureRecords([record],{...filter,search:'쉼'}).length,1);
  assert.equal(filterCultureRecords([record],{...filter,type:'drama'}).length,0);
  assert.equal(filterCultureRecords([{...record,id:'null',rating:null},{...record,id:'zero',rating:0}],filter)[0].id,'zero');
});
test('input validation allows title-only and rejects malformed dates, ratings and new unsafe links without rewriting legacy URLs', () => {
  validateCultureRecord({...record,rating:null,watchedDate:null,url:null,thumbnailUrl:null});
  assert.throws(()=>validateCultureRecord({...record,title:'  '}));
  for (const rating of [-1,5.5,1.2,NaN]) assert.throws(()=>validateCultureRecord({...record,rating}));
  for (const watchedDate of ['2026-02-30','bad']) assert.throws(()=>validateCultureRecord({...record,watchedDate}));
  assert.throws(()=>validateCultureRecord({...record,url:'javascript:alert(1)'}));
  assert.equal(safeCultureUrl('javascript:alert(1)'),undefined);
  const old={...record,url:'legacy-text'};validateCultureRecord({...old,title:'changed'},old);
});
test('YouTube validation rejects spoofed hosts, unsupported paths and truncated IDs', () => {
  for(const value of ['https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk','https://m.youtube.com/shorts/abcdefghijk','https://youtube.com/embed/abcdefghijk']) assert.equal(cultureYouTubeId(value),'abcdefghijk');
  for(const value of ['https://evil.invalid/?v=abcdefghijk','https://youtube.com.evil.invalid/watch?v=abcdefghijk','https://youtu.be/abcdefghijkl','javascript:youtube.com/watch?v=abcdefghijk','https://youtube.com/other?v=abcdefghijk']) assert.equal(cultureYouTubeId(value),null);
});
test('metadata selection preserves written review, rating, tags, title, image, explicit types and intentional cleared fields', () => {
  const suggestion={title:'제안 제목',thumbnailUrl:'https://example.invalid/new.jpg',contentType:'drama' as const,externalSource:'tmdb_tv' as const,externalId:'999'};
  const next=applyCultureSuggestion(record,suggestion,new Set(['contentType']));
  for(const field of ['title','thumbnailUrl','review','insight','rating','tags','contentType'] as const) assert.deepEqual(next[field],record[field]);
  assert.equal(next.externalId,'999');
  const blank={...record,title:'',thumbnailUrl:null};
  assert.equal(applyCultureSuggestion(blank,suggestion,new Set()).title,'제안 제목');
  assert.equal(applyCultureSuggestion(blank,suggestion,new Set(['title','thumbnailUrl'])).title,'');
  assert.equal(applyCultureSuggestion(blank,suggestion,new Set(['thumbnailUrl'])).thumbnailUrl,null);
});
