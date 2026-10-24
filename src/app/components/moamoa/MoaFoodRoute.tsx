import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { addDays, addMonths, format, parseISO } from 'date-fns';
import { Camera, LayoutGrid, List, Plus, Utensils } from 'lucide-react';
import { usePlanner, type FoodRecord, type MealType } from '../../store';
import { foodDateRecords, foodMonthGallery } from '../../../lib/foodRecords';
import { MEAL_LABELS, MEAL_ICONS, DINING_LABELS } from '../../../constants/foodIcons';
import { MoaFrame } from './MoaFrame';
import { MoaRecordsNav } from './MoaRecordsNav';
import { MoaRecordDateBar } from './MoaRecordDateBar';
import { MoaFoodEditor } from './MoaFoodEditor';
import { MoaFoodImage } from './MoaFoodImage';
import { MoaDialog } from './MoaDialog';
import { useMoaToday } from './moaShared';
import './todos.css';
import './time.css';
import './food.css';
const tastes={good:'맛있었어요',normal:'괜찮았어요',bad:'조금 아쉬웠어요'};
export function Component() {
 const p=usePlanner();const today=useMoaToday(p.dayEndHour);
 const [picked,setPicked]=useState<string|null>(null),date=picked??today;
 const [gallery,setGallery]=useState(false),[meal,setMeal]=useState<'all'|MealType>('all');
 const [editor,setEditor]=useState<{record?:FoodRecord}|null>(null),[detail,setDetail]=useState<string|null>(null),[deleting,setDeleting]=useState<FoodRecord|null>(null),[notice,setNotice]=useState('');
 const attemptedDelete=useRef(false);const deleteState=p.saveStates.find(s=>s.key===`foodRecords:${deleting?.id}`);
 const selected=detail?p.foodRecords.find(r=>r.id===detail):undefined;
 const records=foodDateRecords(p.foodRecords,date).filter(r=>meal==='all'||r.mealType===meal);
 const photos=foodMonthGallery(p.foodRecords,date.slice(0,7)).filter(r=>meal==='all'||r.mealType===meal);
 const days=[...new Set(photos.map(r=>r.date))];
 const mealRows=records.filter(r=>!r.isFasting),cost=mealRows.reduce((n,r)=>n+r.amount,0),calories=mealRows.reduce((n,r)=>n+(r.calories??0),0);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState!=='hidden')void p.refreshFoodRecords();};window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};},[p.refreshFoodRecords]);
 useEffect(()=>{if(deleting&&attemptedDelete.current&&deleteState?.status==='saved'){setDeleting(null);setDetail(null);setNotice('기록 삭제를 확인했어요. 사진 원본은 그대로 보관해요.');}},[deleteState?.status,deleting]);
 function openDelete(record:FoodRecord){attemptedDelete.current=false;setDeleting(record);setDetail(null);}
 async function remove(){if(!deleting||deleteState?.status==='saving'||deleteState?.status==='error')return;attemptedDelete.current=true;await p.deleteFoodRecordConfirmed(deleting.id);}
 function saved(record:FoodRecord){setEditor(null);setPicked(record.date);setMeal('all');setGallery(false);setNotice('음식 기록을 저장했어요. 사진 원본은 안전하게 보관해요.');}
 const openDetail=(record:FoodRecord)=>setDetail(record.id);
 const card=(record:FoodRecord)=><article className="mf-food-card mt-card" key={record.id} data-food-id={record.id}><button className="mf-photo" aria-label={`${record.foodName} 사진 상세 보기`} onClick={()=>openDetail(record)}><MoaFoodImage url={record.photoUrl} name={record.foodName}/>{record.isFasting&&<span className="mf-fasting">단식 기록</span>}</button><div className="mf-card-body"><small className="mf-meal-label">{MEAL_ICONS[record.mealType]} {MEAL_LABELS[record.mealType]}</small><h3>{record.foodName||'이름 없는 기록'}</h3><FoodFacts record={record}/><div className="mf-card-actions"><button onClick={()=>openDetail(record)}>상세 보기</button><button aria-label={`${record.foodName} 수정`} disabled={record.isFasting} title={record.isFasting?'단식 기록 편집은 기존 음식 화면에서 지원해요.':undefined} onClick={()=>setEditor({record})}>수정</button><button aria-label={`${record.foodName} 삭제`} onClick={()=>openDelete(record)}>삭제</button></div></div></article>;
 return <MoaFrame pageTitle="기록" onQuick={()=>setEditor({})} quickDisabled={p.isLoading}><div className="mf-page">
  <div className="mx-page-heading"><div><p className="mt-eyebrow">A LITTLE TASTE OF TODAY</p><h1>음식 기록</h1><p>맛있는 순간을, 한 장씩 모아요.</p></div><button className="mx-primary" disabled={p.isLoading} onClick={()=>setEditor({})}><Plus size={18}/>음식 기록</button></div>
  <MoaRecordsNav active="food"/>
  <div className="mf-toolbar"><MoaRecordDateBar value={gallery?date.slice(0,7):date} label={gallery?format(parseISO(date),'yyyy년 M월'):date} inputLabel={gallery?'갤러리 월':'음식 조회 날짜'} month={gallery} onChange={value=>setPicked(gallery?`${value}-01`:value)} onPrevious={()=>setPicked(format(gallery?addMonths(parseISO(date),-1):addDays(parseISO(date),-1),'yyyy-MM-dd'))} onNext={()=>setPicked(format(gallery?addMonths(parseISO(date),1):addDays(parseISO(date),1),'yyyy-MM-dd'))} onToday={()=>setPicked(null)} previousLabel={gallery?'이전 달':'이전 날짜'} nextLabel={gallery?'다음 달':'다음 날짜'}/><button className="mf-view-toggle" aria-label={gallery?'목록 보기':'갤러리 보기'} title={gallery?'목록 보기':'갤러리 보기'} aria-pressed={gallery} onClick={()=>setGallery(v=>!v)}>{gallery?<List size={17}/>:<LayoutGrid size={17}/>}<span className="mf-view-label">{gallery?'목록 보기':'갤러리 보기'}</span></button></div>
  <div className="mf-meal-filter" role="group" aria-label="식사 필터"><button aria-pressed={meal==='all'} onClick={()=>setMeal('all')}>전체</button>{Object.entries(MEAL_LABELS).map(([key,label])=><button key={key} aria-pressed={meal===key} onClick={()=>setMeal(key as MealType)}>{label}</button>)}</div>
  {p.foodReadError&&<div className="ma-notice" role="status">{p.foodReadError}<button onClick={()=>void p.refreshFoodRecords()}>음식 기록 다시 불러오기</button></div>}
  {p.isLoading?<div className="mf-empty" role="status">음식 기록을 불러오고 있어요.</div>:gallery?<><div className="mf-gallery-intro"><h2><Camera size={18}/>한 달의 맛있는 장면</h2><small>사진 있는 기록 {photos.length}개</small></div>{!photos.length?p.foodReadError?<p role="status" className="mx-help">기록을 확인한 뒤 사진을 보여드릴게요.</p>:<div className="mf-empty mt-card"><Camera size={28}/><h2>이번 달 사진 기록이 없어요</h2><p>사진 없이 남긴 기록은 목록에서 확인할 수 있어요.</p><button onClick={()=>setGallery(false)}>목록 보기</button></div>:days.map(day=><section className="mf-gallery-day" key={day}><h2>{day}</h2><div className="mf-gallery-grid">{photos.filter(r=>r.date===day).map(r=><button className="mf-gallery-tile" key={r.id} data-food-id={r.id} onClick={()=>openDetail(r)} aria-label={`${r.foodName} 상세 보기`}><div className="mf-photo"><MoaFoodImage url={r.photoUrl} name={r.foodName}/></div><span>{r.foodName||'이름 없는 기록'}</span><small>{MEAL_LABELS[r.mealType]}</small></button>)}</div></section>)}</>:<>
   {records.length>0&&<div className="mf-summary"><span>기록 {records.length}개</span>{cost>0&&<span>입력한 식비 {cost.toLocaleString()}원</span>}{mealRows.some(r=>r.calories!=null)&&<span>입력한 칼로리 {calories.toLocaleString()} kcal</span>}</div>}
   {!records.length?p.foodReadError?<p role="status" className="mx-help">기록을 확인한 뒤 목록을 보여드릴게요.</p>:<div className="mf-empty mt-card"><Utensils size={30}/><h2>아직 남긴 음식이 없어요</h2><p>사진 없이 음식명만 적어도 괜찮아요.</p><button className="mx-primary" onClick={()=>setEditor({})}><Plus size={17}/>첫 음식 기록</button></div>:<div className="mf-day-layout">{Object.entries(MEAL_LABELS).filter(([key])=>records.some(r=>r.mealType===key)).map(([key,label])=><section className="mf-meal-section" key={key}><h2>{label} <small>{records.filter(r=>r.mealType===key).length}개</small></h2><div className="mf-food-grid">{records.filter(r=>r.mealType===key).map(card)}</div></section>)}</div>}
  </>}
  <p role="status" className="mx-notice">{notice}</p><Link className="mf-legacy-link" to="/food">기존 음식 화면·통계 열기 →</Link>
  {editor&&<MoaFoodEditor key={editor.record?.id??'new'} record={editor.record} date={date} initialMeal={meal==='all'?undefined:meal} onClose={()=>setEditor(null)} onSaved={saved}/>}
  {selected&&<MoaFoodDetail record={selected} onClose={()=>setDetail(null)} onEdit={()=>{setDetail(null);setEditor({record:selected});}} onDelete={()=>openDelete(selected)}/>}
  {deleting&&<MoaDialog title="음식 기록 삭제" description="음식 기록만 삭제해요. 사진 원본 파일은 보관해 다른 기록의 사진을 보호해요." onClose={()=>{if(deleteState?.status!=='saving')setDeleting(null);}} saveKeys={[`foodRecords:${deleting.id}`]} footer={<div className="mx-actions"><button disabled={deleteState?.status==='saving'} onClick={()=>setDeleting(null)}>취소</button><button className="mx-primary" disabled={deleteState?.status==='saving'||deleteState?.status==='error'} onClick={()=>void remove()}>삭제 확인</button></div>}><p>{deleting.foodName}</p><p className="mx-help">삭제 실패 시 목록을 유지하고 같은 요청으로 재시도해요.</p></MoaDialog>}
 </div></MoaFrame>;
}
function FoodFacts({record:r}:{record:FoodRecord}){return <div className="mf-facts">{r.diningType&&<span>{DINING_LABELS[r.diningType]??r.diningType}</span>}{r.amount>0&&<span>{r.amount.toLocaleString()}원</span>}{r.calories!=null&&!r.isFasting&&<span>{r.calories.toLocaleString()} kcal</span>}{r.tasteRating&&<span>{tastes[r.tasteRating]??r.tasteRating}</span>}</div>;}
function MoaFoodDetail({record:r,onClose,onEdit,onDelete}:{record:FoodRecord;onClose:()=>void;onEdit:()=>void;onDelete:()=>void}){
 const [retry,setRetry]=useState(0);
 return <MoaDialog title="음식 기록 상세" description={`${r.date} · ${MEAL_LABELS[r.mealType]}`} onClose={onClose} saveKeys={[]} footer={<div className="mx-actions"><button onClick={onClose}>닫기</button><button onClick={onEdit} disabled={r.isFasting}>수정</button><button className="mx-primary" onClick={onDelete}>삭제</button></div>}><div className="mf-detail-photo mf-photo"><MoaFoodImage url={r.photoUrl} name={r.foodName} retry={retry}/></div>{r.photoUrl&&<button className="mx-add-row" onClick={()=>setRetry(v=>v+1)}>사진 다시 불러오기</button>}<h2 className="mf-detail-title">{r.foodName||'이름 없는 기록'}</h2><FoodFacts record={r}/>{r.memo&&<p className="mf-note">{r.memo}</p>}{r.tasteMemo&&<p className="mf-note">맛 메모 · {r.tasteMemo}</p>}{[r.carbs,r.protein,r.fat].some(v=>v!=null)&&<p className="mx-help">기존 영양 기록 · {[['탄수화물',r.carbs],['단백질',r.protein],['지방',r.fat]].filter(([,v])=>v!=null).map(([label,v])=>`${label} ${v}g`).join(' · ')}</p>}{r.isFasting&&<p className="mx-help">기존 단식 기록이에요. 편집은 기존 음식 화면에서 지원해요.</p>}</MoaDialog>;
}
