import test from 'node:test';import assert from 'node:assert/strict';
import {clockMinute,timelineSpan,layoutTimeline,TIMELINE_PX_PER_MINUTE as scale} from './calendarTimeline';
test('minute geometry gives shared 19:00 coordinates and precise 30/60/90 minute heights',()=>{
 const entries=[{key:'a',...timelineSpan('19:00','20:00')!},{key:'b',...timelineSpan('19:30','20:30')!},{key:'c',...timelineSpan('20:30','21:00')!},{key:'d',...timelineSpan('21:00','22:30')!}];const result=layoutTimeline(entries);
 assert.equal(result[0].top,1140*scale);assert.equal(result[1].top-result[0].top,30*scale);assert.deepEqual(result.map(v=>v.height),[60,60,30,90].map(v=>v*scale));
 for(let day=0;day<7;day++)assert.equal(layoutTimeline([{...entries[0],key:String(day)}])[0].top,result[0].top);
});
test('overlap partition separates every intersecting pair; touching endpoints reuse lanes',()=>{
 const items=[{key:'a',start:100,end:200,displayOnlyEnd:false},{key:'b',start:110,end:150,displayOnlyEnd:false},{key:'c',start:120,end:220,displayOnlyEnd:false},{key:'d',start:220,end:250,displayOnlyEnd:false}];const before=JSON.stringify(items);const result=layoutTimeline(items);
 for(const a of result)for(const b of result)if(a.key!==b.key&&a.start<b.end&&b.start<a.end)assert.notEqual(a.lane,b.lane);
 assert.deepEqual(result.map(v=>v.lanes),[3,3,3,1]);assert.equal(JSON.stringify(items),before);
});
test('missing end uses display-only length; absent/ambiguous clocks never acquire a made-up position',()=>{
 assert.equal(timelineSpan('19:00')?.displayOnlyEnd,true);assert.equal(timelineSpan('19:00')?.end,1170);
 assert.equal(timelineSpan(undefined,undefined,30),null);assert.equal(timelineSpan('23:00','01:00',120),null);assert.equal(clockMinute('55:00'),null);
 assert.equal(timelineSpan('24:10','25:00')?.start,1450);const iso=timelineSpan('2027-01-04T23:30:00+09:00','2027-01-05T01:00:00+09:00')!;assert.equal(iso.end-iso.start,90);
});
