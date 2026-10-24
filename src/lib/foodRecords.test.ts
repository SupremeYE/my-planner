import test from 'node:test';
import assert from 'node:assert/strict';
import {toFoodRecord,fromFoodRecord,validateFoodRecord,foodDateRecords,foodMonthGallery} from './foodRecords';
import {foodPhotoStorage,foodPhotoPath} from './foodPhotos';
import {confirmedWrites} from './confirmedWrites';
import {memorySupabase} from '../../scripts/test/fixtures/memory-supabase';
import {memoryFoodStorage} from '../../scripts/test/fixtures/memory-food-storage';
import type {FoodRecord} from '../app/store';
const oldUrl='https://example.invalid/storage/v1/object/public/food-photos/old.jpg?original=1';
const record:FoodRecord={id:'original',date:'2027-01-01',mealType:'lunch',foodName:'기록',amount:0,photoUrl:oldUrl,memo:'메모',calories:null,carbs:22,protein:10,fat:4,diningType:'home',tasteRating:'good',tasteMemo:'이전 맛 메모',isFasting:false};
const operation='11111111-1111-4111-8111-111111111111';
test('food codec roundtrips existing IDs, URL bytes, macros, notes, fasting and nullable values',()=>{
 assert.deepEqual(toFoodRecord(fromFoodRecord(record)),record);
 assert.equal(fromFoodRecord({...record,foodName:'수정'}).photo_url,oldUrl);
 assert.equal(toFoodRecord(fromFoodRecord({...record,isFasting:true})).isFasting,true);
});
test('title-only meals are valid without inventing a photo/name; invalid dates and numbers rejected',()=>{
 validateFoodRecord({...record,photoUrl:null});
 for(const patch of [{foodName:' '},{date:'2027-02-30'},{amount:-1},{calories:NaN},{amount:1.5}])assert.throws(()=>validateFoodRecord({...record,...patch}));
 assert.equal(foodDateRecords([record,{...record,id:'next',date:'2027-01-02'}],record.date).length,1);
 assert.deepEqual(foodMonthGallery([record,{...record,id:'none',photoUrl:null},{...record,id:'past',date:'2026-12-31'}],'2027-01').map(r=>r.id),['original']);
});
test('unique photo path never overwrites originals; acknowledged-lost upload retries verify the same bytes',async()=>{
 const memory=memoryFoodStorage();const client={storage:memory.storage};const api=foodPhotoStorage(client);const file=new File(['photo-original-bytes'],'photo.png',{type:'image/png'});
 memory.controls.objects.set('food-photos/original.png',new Blob(['preserve']));
 memory.controls.failNext('upload',{status:0,afterCommit:true});await assert.rejects(()=>api.uploadConfirmed(file,record.id,operation));
 const url=await api.uploadConfirmed(file,record.id,operation);assert.match(url,new RegExp(operation));assert.equal(memory.controls.objects.size,2);
 assert.ok(memory.controls.requests.filter(r=>r.kind==='upload').every(r=>r.upsert===false));assert.equal(await memory.controls.objects.get('food-photos/original.png')!.text(),'preserve');assert.equal(memory.controls.requests.filter(r=>r.kind==='remove').length,0);
});
test('duplicate path with different bytes fails without replacing either object; download failures safely retry',async()=>{
 const memory=memoryFoodStorage(),api=foodPhotoStorage({storage:memory.storage});const first=new File(['one'],'one.png',{type:'image/png'}),other=new File(['two'],'two.png',{type:'image/png'});
 await api.uploadConfirmed(first,'r',operation);await assert.rejects(()=>api.uploadConfirmed(other,'r',operation),/다른 파일/);
 memory.controls.failNext('download',{status:503});await assert.rejects(()=>api.uploadConfirmed(first,'r',operation));await api.uploadConfirmed(first,'r',operation);
 assert.equal(memory.controls.objects.size,1);assert.equal(await [...memory.controls.objects.values()][0].text(),'one');
});
test('photo validation rejects unsupported/empty/oversized files before any storage write',()=>{
 for(const file of [new File(['x'],'x.svg',{type:'image/svg+xml'}),new File([],'x.png',{type:'image/png'}),new File([new Uint8Array(10*1024*1024+1)],'x.png',{type:'image/png'})])assert.throws(()=>foodPhotoPath('r',{file,operationId:operation}));
});
test('confirmed food CRUD preserves unknown server columns and original photos through failures/retries',async()=>{
 const memory=memorySupabase({food_records:[{...fromFoodRecord(record),legacy_extra:'keep'}]});const api=confirmedWrites(memory.supabase,'food_records',fromFoodRecord,toFoodRecord);
 memory.controls.failNext('food_records',{status:503});await assert.rejects(()=>api.updateConfirmed(record,{...record,foodName:'new'}));assert.equal((await api.getConfirmed('original'))?.foodName,'기록');
 await api.updateConfirmed(record,{...record,foodName:'new'});assert.equal(memory.controls.tables.food_records[0].legacy_extra,'keep');assert.equal(memory.controls.tables.food_records[0].photo_url,oldUrl);
 const created={...record,id:'new'};memory.controls.failNext('food_records',{status:0,afterCommit:true});await assert.rejects(()=>api.createConfirmed(created));await api.createConfirmed(created);assert.equal(memory.controls.tables.food_records.length,2);
 memory.controls.failNext('food_records',{status:0,afterCommit:true});await assert.rejects(()=>api.deleteConfirmed('new'));await api.deleteConfirmed('new');assert.equal(memory.controls.tables.food_records.length,1);
});
test('camera/album HEIC and HEIF use the same non-overwriting path and preserve original bytes; decoding is not claimed',async()=>{
 for(const type of ['image/heic','image/heif']){
  const memory=memoryFoodStorage(),file=new File(['isolated format transport fixture'],`phone.${type.split('/')[1]}`,{type});
  const path=foodPhotoPath('meal',{file,operationId:operation});assert.ok(path.endsWith('.'+type.split('/')[1]));
  await foodPhotoStorage({storage:memory.storage}).uploadConfirmed(file,'meal',operation);
  const stored=memory.controls.objects.get('food-photos/'+path)!;assert.equal(stored.type,type);assert.deepEqual(await stored.arrayBuffer(),await file.arrayBuffer());
 }
 const limit=new File([new Uint8Array(10*1024*1024)],'limit.jpg',{type:'image/jpeg'});assert.ok(foodPhotoPath('meal',{file:limit,operationId:operation}));
 assert.throws(()=>foodPhotoPath('meal',{file:new File(['x'],'phone.heic',{type:''}),operationId:operation}),/사진/);
});
