import { tables as base } from './moa-todos-data.mjs';
export const tables = structuredClone(base);
tables.tags.push({id:'growth',name:'자기계발',color:'#c6ae7b',track_time:true});
const snapshot = (id,name,color) => ({version:1,shares:[{tagId:id,name,color,weight:1}]});
tables.activity_entries = [
 {id:'11111111-1111-4111-8111-111111111111',operation_id:'11111111-1111-4111-8111-111111111111',name:'블로그에 오늘의 생각 모으기',date:'2027-01-01',elapsed_sec:5400,category_id:'growth',classification_snapshot:snapshot('growth','자기계발','#c6ae7b'),memo:'차분하게 쓴 시간',started_at:null,ended_at:null},
 {id:'22222222-2222-4222-8222-222222222222',operation_id:'22222222-2222-4222-8222-222222222222',name:'한 해를 마무리하는 산책',date:'2026-12-31',elapsed_sec:1800,category_id:'life',classification_snapshot:snapshot('life','생활','#afc5a0'),memo:null,started_at:'2026-12-31T23:50:00+09:00',ended_at:'2027-01-01T00:20:00+09:00'},
];
