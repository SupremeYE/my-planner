import test from 'node:test';
import assert from 'node:assert/strict';
import {musicRepository,fromMusicRecord,toMusicRecord,validateMusic,applyMusicSuggestion,filterMusic,type MusicEntry} from './musicRecords';
import {SaveCoordinator} from './saveCoordinator';
import {memorySupabase} from '../../scripts/test/fixtures/memory-supabase';
const record:MusicEntry={id:'old-music',trackTitle:'오래 간직한 노래',artist:'아티스트',album:'앨범',artworkUrl:'https://media.invalid/art?original=1',releaseYear:2000,itunesTrackId:123,previewUrl:'https://media.invalid/preview',mood:['위로','나만의 무드'],genre:'pop',memo:'처음 메모',listenUrl:'https://media.invalid/listen',stickers:[{emoji:'🌿',x:40,y:60,extra:'keep'},{legacy:'unknown'}],listenedDate:'2026-10-20',createdAt:'2026-10-21T00:00:00Z'};
test('music codec retains IDs, original URLs, all metadata, unknown sticker objects and existing listened_date',()=>{
 const row={...fromMusicRecord(record),created_at:record.createdAt};assert.deepEqual(toMusicRecord(row),record);
 const {listened_date,...legacy}=row;assert.equal('listened_date' in fromMusicRecord(toMusicRecord(legacy)),false);
});
test('music patch protects other-device fields, stickers, original URLs and unknown server columns',async()=>{
 const {supabase,controls}=memorySupabase({music_records:[{...fromMusicRecord(record),memo:'다른 기기의 메모',unknown:'keep'}]});
 const saved=await musicRepository(supabase).save({...record,trackTitle:'제목 수정'},record);
 assert.equal(saved.memo,'다른 기기의 메모');assert.deepEqual(controls.requests[0].payload,{track_title:'제목 수정'});assert.equal(controls.tables.music_records[0].unknown,'keep');assert.deepEqual(saved.stickers,record.stickers);assert.equal(saved.artworkUrl,record.artworkUrl);
});
test('title-only manual song, no-op verifies remote and deleted row cannot be reported saved',async()=>{
 const {supabase,controls}=memorySupabase({});const repo=musicRepository(supabase);
 const manual={id:'manual',trackTitle:'직접 입력',artist:'',mood:[]};await repo.save(manual);assert.equal(controls.tables.music_records[0].artist,'');
 assert.equal((await repo.save(manual,manual)).trackTitle,'직접 입력');controls.tables.music_records=[];await assert.rejects(repo.save(manual,manual),/삭제/);
});
test('music creation acknowledgement loss and duplicate clicks reuse ID; explicit retry creates one row',async()=>{
 const {supabase,controls}=memorySupabase({});const repo=musicRepository(supabase),c=new SaveCoordinator();controls.failNext('music_records',{status:0,afterCommit:true});let committed=false;
 const req={key:`music:${record.id}`,label:'음악',intent:'same',execute:()=>repo.save(record),commit:()=>{committed=true;}};
 const first=c.run(req);assert.equal(first,c.run(req));assert.equal(await first,null);assert.equal(committed,false);assert.equal(controls.tables.music_records.length,1);await c.retry(req.key);assert.equal(committed,true);assert.equal(controls.tables.music_records.length,1);
});
test('same iTunes track cannot create a new row or replace another track; failed duplicate lookup blocks write',async()=>{
 const {supabase,controls}=memorySupabase({music_records:[fromMusicRecord(record)]});const repo=musicRepository(supabase);
 await assert.rejects(repo.save({...record,id:'different'}),/이미 기록/);assert.equal(controls.requests.length,0);
 controls.failNext('music_records',{status:503,read:true});await assert.rejects(repo.save({...record,id:'new',itunesTrackId:999}));assert.equal(controls.requests.length,0);
 await assert.rejects(repo.save({...record,trackTitle:'changed'}),/다른 내용/);assert.equal(controls.tables.music_records[0].track_title,record.trackTitle);
});
test('music delete absence check and acknowledgement loss are retryable without Storage calls',async()=>{
 const {supabase,controls}=memorySupabase({music_records:[fromMusicRecord(record)]});const repo=musicRepository(supabase);
 controls.failNext('music_records',{status:0,afterCommit:true});await assert.rejects(repo.deleteConfirmed(record.id));await repo.deleteConfirmed(record.id);assert.equal(controls.tables.music_records.length,0);
});
test('music read failure rejects; no empty-success fallback',async()=>{
 const {supabase,controls}=memorySupabase({music_records:[fromMusicRecord(record)]});controls.failNext('music_records',{status:503,read:true});await assert.rejects(musicRepository(supabase).fetchConfirmed());assert.equal((await musicRepository(supabase).fetchConfirmed()).length,1);
});
test('music filters combine date, mood, search and deterministic ordering',()=>{
 const rows=[record,{...record,id:'second',trackTitle:'가나다',listenedDate:'2027-01-01',mood:['집중']}];
 assert.equal(filterMusic(rows,'','all','title','')[0].id,'second');assert.equal(filterMusic(rows,'앨범','위로','created','2026-10-20')[0].id,record.id);assert.equal(filterMusic(rows,'','집중','listened','2026-10-20').length,0);
});
test('search fills only blank untouched metadata and preserves memo, date, moods, links and existing iTunes identity',()=>{
 const suggestion={trackTitle:'추천',artist:'검색 가수',album:'검색 앨범',artworkUrl:'https://new.invalid/art',releaseYear:2026,itunesTrackId:555,previewUrl:'https://new.invalid/audio'};
 assert.deepEqual(applyMusicSuggestion(record,suggestion,new Set()),record);
 const manual={id:'manual',trackTitle:'내 제목',artist:'',mood:['위로'],memo:'내 메모',artworkUrl:null};const next=applyMusicSuggestion(manual,suggestion,new Set(['artworkUrl']));assert.equal(next.trackTitle,'내 제목');assert.equal(next.artist,'검색 가수');assert.equal(next.artworkUrl,null);assert.equal(next.memo,'내 메모');assert.equal(next.itunesTrackId,555);
});
test('invalid dates and links rejected, unchanged legacy URLs preserved, no fabricated dates',()=>{
 for(const listenedDate of ['2026-02-30','bad'])assert.throws(()=>validateMusic({...record,listenedDate}));
 assert.throws(()=>validateMusic({...record,trackTitle:' '}));assert.throws(()=>validateMusic({...record,listenUrl:'javascript:x'}));
 const old={...record,listenUrl:'legacy-text'};validateMusic({...old,memo:'new'},old);validateMusic({...record,listenedDate:null});
});
