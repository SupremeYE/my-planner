import { tables as source } from '../../scripts/test/fixtures/moa-food-data.mjs';
import meal from '../../scripts/test/fixtures/food/meal-a.png';
import { format, addDays, getISOWeek, getISOWeekYear } from 'date-fns';
import './review.css';
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
for(const row of data.food_records)if(row.photo_url)row.photo_url=meal;
for(const row of data.weekly_goals)row.week_key=`${getISOWeekYear(today)}-W${String(getISOWeek(today)).padStart(2,'0')}`;
data.monthly_goals[0].month=format(today,'yyyy-MM');
(window as any).__moaFixture={tables:data};
// All runtime fetches (including paid same-origin APIs) are disabled. Assets use normal browser loading.
window.fetch=async()=>new Response(JSON.stringify({error:'샘플 검토에서는 서버/API 요청을 하지 않아요.'}),{status:503,headers:{'Content-Type':'application/json'}});
if(navigator.serviceWorker)navigator.serviceWorker.register=async()=>{throw new Error('Review does not register service workers');};
if(location.pathname==='/')history.replaceState(null,'','/__moamoa-today');
const banner=document.createElement('aside');banner.id='moa-review-banner';
banner.innerHTML='<div><strong>샘플 · 서버 저장 없음 · 새로고침 시 초기화</strong><button id="review-reset">샘플 초기화</button></div><nav aria-label="검토 화면"><a href="/__moamoa-today">오늘</a><a href="/calendar">캘린더</a><a href="/__moamoa-todos">할 일</a><a href="/__moamoa-records">기록</a><a href="/__moamoa-food">음식</a><a href="/profile">나의 정원</a></nav>';
document.body.prepend(banner);
banner.querySelector('strong')!.title='사진·입력은 브라우저 메모리에만 남고 새로고침하면 초기화됩니다. 실제 개인정보를 입력하지 마세요.';
banner.querySelector('button')!.addEventListener('click',()=>location.reload());
await import('../main');
const {router}=await import('../app/routes');
for(const anchor of banner.querySelectorAll('a'))anchor.addEventListener('click',event=>{event.preventDefault();router.navigate(anchor.getAttribute('href')!);});

}
void bootstrap();
