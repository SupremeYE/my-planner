import { tables as source } from '../../scripts/test/fixtures/moa-food-data.mjs';
import meal from '../../scripts/test/fixtures/food/meal-a.png';
import { format, addDays, getISOWeek, getISOWeekYear } from 'date-fns';
import './review.css';
import { sampleMediaTables } from './mediaSamples';
import './media.css';
import { sampleCultureRows } from './cultureSamples';
async function bootstrap(){
document.body.classList.add('moa-review');
const tables=structuredClone(source);
const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(now.getHours()<2?1:0),12);
const shift=(value:any):any=>{
 if(Array.isArray(value))return value.map(shift);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,shift(v)]));
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)){const day=new Date(value.slice(0,10)+'T12:00:00Z');const offset=(day.getTime()-Date.UTC(2027,0,1,12))/86400000;return format(addDays(today,offset),'yyyy-MM-dd')+value.slice(10);}
 return value;
};
const data=shift(tables);
data.culture_records=structuredClone(sampleCultureRows);
Object.assign(data,structuredClone(sampleMediaTables));
for(const row of data.food_records)if(row.photo_url)row.photo_url=meal;
for(const row of data.weekly_goals)row.week_key=`${getISOWeekYear(today)}-W${String(getISOWeek(today)).padStart(2,'0')}`;
data.monthly_goals[0].month=format(today,'yyyy-MM');

// Additional review rows use the same memory DB/Provider, never a second prototype store.
data.todos.find((row:any) => row.id === 't1').plan_start='09:00';
data.todos.find((row:any) => row.id === 't1').plan_end='10:00';
data.annual_goals=[{id:'review-year',year:today.getFullYear(),text:'좋아하는 것들로 나만의 일상 만들기',done:false}];
data.monthly_goals[0].annual_goal_id='review-year';
data.habits=[{id:'review-walk',name:'잠깐의 산책',checked_dates:[format(addDays(today,-1),'yyyy-MM-dd'),format(today,'yyyy-MM-dd')],repeat:'daily',habit_type:'check',daily_progress:{},daily_memos:{}}];
data.someday_seeds=[
 {id:'review-seed-bookshop',text:'작은 책방에서 하루 보내기',kind:'do',status:'seed',created_at:today.toISOString()},
 {id:'review-seed-build',text:'나만의 작은 서비스 완성하기',kind:'build',status:'seed',created_at:today.toISOString()},
];
(window as any).__moaFixture={tables:data};
// All runtime fetches (including paid same-origin APIs) are disabled. Assets use normal browser loading.
window.fetch=async()=>new Response(JSON.stringify({error:'샘플 검토에서는 서버/API 요청을 하지 않아요.'}),{status:503,headers:{'Content-Type':'application/json'}});
if(navigator.serviceWorker)navigator.serviceWorker.register=async()=>{throw new Error('Review does not register service workers');};
if(location.pathname==='/')history.replaceState(null,'','/__moamoa-today');
await import('../main');
}
void bootstrap();
