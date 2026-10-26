import {CalendarTimeline,type CalendarDay} from './CalendarTimeline';
import {aggregateActivity} from '../../../lib/timeAggregation';
import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO, startOfISOWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, getLogicalToday, type Todo } from '../../store';
import { toTodo, fromTodo } from '../../../lib/todoCodec';
import { toLegacyEvent, toRowPayload, getRepeatedEvents } from '../../../api/events';
import { moaTodayData } from '../../../lib/moaToday';
import { parseQuickEntry } from '../../../lib/quickParse';
import { repeatedPlan, type PlanRow, type PlanTable } from '../../../lib/calendarPlanRepository';
import { useCalendarPlans } from '../../hooks/useCalendarPlans';
import { MoaFrame } from './MoaFrame';
import { MoaDialog } from './MoaDialog';
import { saveIntent } from '../../../lib/saveCoordinator';
import './todos.css';
import './weekly/weekly.css';
import './calendarPlan.css';
const stamp=(d:Date)=>format(d,'yyyy-MM-dd');
export function Component(){
 const p=usePlanner();
 const [date,setDate]=useState(()=>getLogicalToday()),[period,setPeriod]=useState('week'),[editing,setEditing]=useState<{table:PlanTable;row?:PlanRow;date:string;time?:string}|null>(null);
 const monday=startOfISOWeek(parseISO(date)), days=period==='day'?[date]:Array.from({length:7},(_,i)=>stamp(addDays(monday,i)));
 const todos=useCalendarPlans('todos'),events=useCalendarPlans('events',days[0],days.at(-1)!);
 const expanded=getRepeatedEvents(events.records as any,days[0],days.at(-1)!);
 const models=days.map(day=>({date:day,...moaTodayData(day,todos.records.map(r=>toTodo(r as any)),p.weeklyGoals,expanded,p.tags,p.timeBlocks,p.activityEntries,p.reportEvents)}));
 const openTodo=(id:string)=>{const row=todos.records.find(r=>r.id===id);if(row)setEditing({table:'todos',row,date:row.date??date});};
 const actual=aggregateActivity(p.todos,p.reportEvents,p.tags,days[0],days.at(-1)!,p.timeBlocks,p.activityEntries);
 const timelineDays:CalendarDay[]=models.map(day=>{
   const edit=(table:PlanTable,id:string,title:string)=>()=>{const source=(table==='todos'?todos:events).records.find(r=>r.id===id);setEditing({table,row:source??{id,recurrence_parent_id:'virtual',text:title},date:day.date});};
   return {date:day.date,entries:[
     ...day.dayTodos.map(t=>({key:`todo:${t.id}`,title:t.text,date:day.date,kind:'plan' as const,start:t.planStart,end:t.planEnd,edit:edit('todos',t.id,t.text)})),
     ...day.dayEvents.map(e=>({key:`event:${e.id}`,title:e.title,date:day.date,kind:'plan' as const,start:e.startTime,end:e.endTime,all:!!e.isAllDay,edit:edit('events',e.sourceEventId??e.id,e.title)})),
     ...actual.records.filter(r=>r.date===day.date).map(r=>({key:`actual:${r.kind}:${r.id}`,title:r.name,date:r.date,kind:'actual' as const,start:r.start,end:r.end,minutes:r.minutes})),
     ...actual.coverage.unresolvedItems.filter(r=>r.date===day.date).map(r=>({key:`unresolved:${r.kind}:${r.id}`,title:`${r.name} · 시각 확인 필요`,date:r.date,kind:'actual' as const})),
   ]};
 });
 return <MoaFrame className="cp-frame" pageTitle="캘린더 PLAN" quickDisabled={p.isLoading||!!todos.error||!!events.error} onQuick={()=>setEditing({table:'todos',date})}><div className="cp-page">
 <section className="mt-card"><h1>캘린더 PLAN</h1><p>예정된 일정과 할 일을 관리해요. PLAN은 예정, DO는 실제 기록이에요. 실제 기록은 읽기 전용으로 비교해요.</p>
 <div className="cp-toolbar"><button onClick={()=>setDate(stamp(addDays(parseISO(date),period==='week'?-7:-1)))}>이전</button><input aria-label="선택 날짜" type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/><button onClick={()=>setDate(stamp(addDays(parseISO(date),period==='week'?7:1)))}>다음</button><button aria-pressed={period==='week'} onClick={()=>setPeriod('week')}>주간</button><button aria-pressed={period==='day'} onClick={()=>setPeriod('day')}>일간</button><button disabled={p.isLoading||!!todos.error||!!events.error} onClick={()=>setEditing({table:'events',date})}>일정 추가</button><button disabled={p.isLoading||!!todos.error||!!events.error} onClick={()=>setEditing({table:'todos',date})}>할 일 추가·빠른 입력</button></div>
 {(todos.loading||events.loading)&&<p role="status">계획을 불러오고 있어요.</p>}{(todos.error||events.error)&&<div role="alert">{todos.error||events.error}<button onClick={()=>{void todos.refresh();void events.refresh();}}>다시 조회</button></div>}
 </section>
 <section className="mt-card"><h2>날짜 미정 할 일</h2>{todos.records.filter(r=>!r.date).map(r=><button className="cp-item" key={r.id} onClick={()=>openTodo(r.id)}>{r.text}</button>)}{!todos.records.some(r=>!r.date)&&<p>날짜 미정 할 일이 없어요.</p>}</section>
 <CalendarTimeline days={timelineDays} selected={date} today={getLogicalToday()} period={period} onSelect={setDate} onAdd={(day,time)=>setEditing({table:'todos',date:day,time})}/>
 </div>{editing&&<PlanEditor key={editing.row?.id??'new'} initial={editing} todos={todos} events={events} onClose={()=>setEditing(null)}/>}</MoaFrame>;
}
function PlanEditor({initial,todos,events,onClose}:{initial:{table:PlanTable;row?:PlanRow;date:string;time?:string};todos:ReturnType<typeof useCalendarPlans>;events:ReturnType<typeof useCalendarPlans>;onClose:()=>void}){
 const p=usePlanner(),[id]=useState(()=>initial.row?.id??crypto.randomUUID()),[table,setTable]=useState(initial.table),manual=useRef(initial.table==='events');
 const decoded=initial.row?(initial.table==='todos'?toTodo(initial.row as any):toLegacyEvent(initial.row as any)):undefined;
 const [title,setTitle]=useState(()=>decoded?('text'in decoded?decoded.text:decoded.title):''),[date,setDate]=useState(()=>decoded?.date??(initial.time?initial.date:'')),[start,setStart]=useState(()=>decoded?('planStart'in decoded?decoded.planStart:('startTime'in decoded?decoded.startTime:''))??'':initial.time??''),[end,setEnd]=useState(()=>decoded?('planEnd'in decoded?decoded.planEnd:('endTime'in decoded?decoded.endTime:''))??'':''),[all,setAll]=useState(()=>!!(decoded&&'isAllDay'in decoded&&decoded.isAllDay)),[recurrence,setRecurrence]=useState(''),[tags,setTags]=useState<string[]>(()=>decoded?.tags??[]),[goal,setGoal]=useState(()=>initial.row?.weekly_goal_id??''),[project,setProject]=useState(()=>initial.row?.project_id??''),[category,setCategory]=useState(()=>initial.row?.category??''),[quick,setQuick]=useState(''),[parseInvalid,setParseInvalid]=useState(false),[message,setMessage]=useState(''),[discard,setDiscard]=useState(false),[deleting,setDeleting]=useState(false),[viewport,setViewport]=useState<CSSProperties>({});
 const controller=table==='todos'?todos:events,state=controller.states.find(s=>s.key===`${table}:${id}`),busy=state?.status==='saving',locked=busy||state?.status==='error',flight=useRef(false),[baseline]=useState(()=>saveIntent({title,date,start,end,all,tags,goal,project,category,recurrence}));
 const dirty=!!quick.trim()||baseline!==saveIntent({title,date,start,end,all,tags,goal,project,category,recurrence}),repeated=!!initial.row&&repeatedPlan(initial.row);
 useEffect(()=>{const view=window.visualViewport;const resize=()=>{if(!view)return;const mobile=window.innerWidth<768;setViewport({maxHeight:view.height-16,bottom:'auto',top:mobile?view.offsetTop+view.height-8:view.offsetTop+view.height/2,left:mobile?0:'50%',transform:mobile?'translateY(-100%)':'translate(-50%, -50%)'});};resize();view?.addEventListener('resize',resize);view?.addEventListener('scroll',resize);return()=>{view?.removeEventListener('resize',resize);view?.removeEventListener('scroll',resize);};},[]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty||busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,busy]);
 function close(){if(busy||flight.current)return;if(dirty||state?.status==='error')setDiscard(true);else onClose();}
 function interpret(){const parsed=parseQuickEntry(quick,parseISO(getLogicalToday()),{selectedDate:initial.date});setTitle(parsed.title==='(제목 없음)'?'':parsed.title);setDate(parsed.date??'');setStart(parsed.startTime??'');setEnd(parsed.endTime??'');const parsedTable=!manual.current&&parsed.typeHint?(parsed.typeHint==='event'?'events':'todos'):table;setTags(parsedTable==='events'?(initial.row?.tags??[]):parsed.tags.map(name=>p.tags.find(t=>t.name===name)?.id??name));setRecurrence(parsed.recurrenceRule??'');if(!manual.current&&parsed.typeHint)setTable(parsed.typeHint==='event'?'events':'todos');setParseInvalid(!!parsed.issues?.length&&!parsed.startTime);setMessage((parsed.issues??[]).join(' ')||(parsed.projectName&&!p.projects.some(v=>v.name===parsed.projectName)?'프로젝트 이름을 확인해주세요.':''));if(parsed.projectName)setProject(p.projects.find(v=>v.name===parsed.projectName)?.id??'');}
 const unknown=tags.filter(id=>!p.tags.some(t=>t.id===id)&&!initial.row?.tags?.includes(id));
 async function submit(remove=false,retry=false){if(flight.current||busy||repeated||(!retry&&locked))return;setMessage('');if(!retry&&!remove){if(parseInvalid){setMessage('해석하지 못한 시간을 수정하거나 예정 시간 해제로 확인해주세요.');return;}if(!title.trim()||(table==='events'&&(!date||(!all&&(!start||!end))))||(recurrence&&!date)||((start||end)&&!date)||(!all&&end&&!start)){setMessage('제목·날짜·예정 시간을 확인해주세요.');return;}if(!all&&[start,end].some(v=>v&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))){setMessage('시간은 00:00~23:59 범위예요.');return;}if(!all&&end&&start>=end){setMessage('종료는 시작 이후로 입력해주세요. 자정을 넘는 계획은 날짜별로 나눠주세요.');return;}if(table==='todos'&&unknown.length){setMessage('인식하지 못한 태그를 기존 태그로 선택하거나 해제해주세요.');return;}}
 flight.current=true;
 try{let result;if(retry)result=await controller.retry(id);else{
 let target:PlanRow;
 if(table==='todos'){target=fromTodo({...decoded,id,text:title,date:date||null,status:initial.row?.status??'active',isTop3:initial.row?.is_top3??false,planStart:start||undefined,planEnd:end||undefined,tags,weeklyGoalId:goal||undefined,projectId:project||undefined,category:category||undefined, ...(!initial.row?{recurrenceRule:recurrence==='weekday'?'weekdays':recurrence||undefined}: {})} as Todo) as any;if(initial.row?.end_date&&initial.row.date)target.end_date=date?stamp(addDays(parseISO(date),differenceInCalendarDays(parseISO(initial.row.end_date),parseISO(initial.row.date)))):null;}
 else target={...toRowPayload({id,title,date,startDate:date,endDate:initial.row?stamp(addDays(parseISO(date),differenceInCalendarDays(parseISO((decoded as any)?.endDate??date),parseISO((decoded as any)?.startDate??date)))):date,isAllDay:all,startTime:start||undefined,endTime:end||undefined,recurrenceFreq:!initial.row&&recurrence?(recurrence==='weekday'?'weekly':recurrence as any):undefined,recurrencePreset:recurrence==='weekday'?'weekday':undefined,recurrenceByday:recurrence==='weekly'?[parseISO(date).getDay()]:undefined,projectId:project||undefined}),title,tags};
 result=await controller.save(target,initial.row,remove);}
 if(result)onClose();
 }finally{flight.current=false;}}
 return <MoaDialog title={initial.row?'계획 보기·수정':'계획 추가'} description="PLAN은 예정 시간만 저장해요. 실제 활동과 완료 상태는 유지해요." className="mw-dialog cp-dialog" style={viewport} onClose={close} saveKeys={[]} footer={discard?<div role="alert"><p>저장하지 않은 입력을 닫을까요? 확인 실패한 요청은 반영됐을 수 있어요.</p><button onClick={()=>setDiscard(false)}>계속 작성</button><button onClick={()=>{controller.dismiss(id);void controller.refresh();onClose();}}>입력 닫기</button></div>:deleting?<div role="alert"><p>이 계획을 삭제할까요? 연결된 실제 기록이 있으면 삭제하지 않아요.</p><button onClick={()=>setDeleting(false)}>취소</button><button disabled={locked} onClick={()=>{setDeleting(false);void submit(true);}}>삭제 확인</button></div>:<>{state&&<div role={state.status==='error'?'alert':'status'}><p>{busy?'저장 결과 확인 중…':state.message}</p>{state.status==='error'&&(state.retryable?<button onClick={()=>void submit(false,true)}>재시도</button>:<button onClick={()=>controller.dismiss(id)}>입력 다시 확인</button>)}</div>}<div className="mx-actions">{initial.row&&<button disabled={locked||repeated} onClick={()=>setDeleting(true)}>삭제</button>}<button disabled={busy} onClick={close}>닫기</button><button disabled={locked||repeated} className="mx-primary" onClick={()=>void submit()}>저장</button></div></>}>
 {repeated&&<p role="status">반복 계획의 수정·삭제 범위 선택은 아직 지원하지 않아요. 기존 마스터·회차·예외는 유지돼요.</p>}
 <div className="mw-form"><fieldset disabled={locked||repeated}>
 {!initial.row&&<><label>자연어 빠른 입력<input aria-label="자연어 빠른 입력" value={quick} onChange={e=>setQuick(e.target.value)} placeholder="다음주 월요일 운동가기 #자기계발 19:00~20:00"/></label><button onClick={interpret}>해석 확인</button></>}
 <label>종류<select aria-label="종류" value={table} disabled={!!initial.row} onChange={e=>{manual.current=true;setAll(false);setTable(e.target.value as PlanTable);if(e.target.value==='events')setTags(initial.row?.tags??[]);}}><option value="todos">할 일</option><option value="events">일정</option></select></label>
 <label>제목<input aria-label="제목" value={title} onChange={e=>setTitle(e.target.value)}/></label><label>날짜<input aria-label="날짜" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={()=>setDate(initial.date)}>선택 날짜로 지정</button>{table==='todos'&&<button onClick={()=>{setDate('');setStart('');setEnd('');}}>날짜 미정</button>}
 {table==='events'&&<label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>종일</label>}
 {!all&&<div className="mx-two-fields"><label>시작 예정<input aria-label="시작 예정" type="time" value={start} onChange={e=>{setStart(e.target.value);setParseInvalid(false);}}/></label><label>종료 예정<input aria-label="종료 예정" type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}<button onClick={()=>{setStart('');setEnd('');setParseInvalid(false);}}>예정 시간 해제</button>
 {!initial.row&&<label>반복<select aria-label="반복" value={recurrence} onChange={e=>{setRecurrence(e.target.value);if(e.target.value&&!date)setDate(initial.date);}}><option value="">반복 없음</option><option value="daily">매일</option><option value="weekly">매주 · 시작일 요일</option><option value="weekday">평일</option></select></label>}
 <label>태그<select disabled={table==='events'} aria-label="태그 추가" value="" onChange={e=>e.target.value&&setTags(v=>[...new Set([...v,e.target.value])])}><option value="">태그 선택</option>{p.tags.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><div>{tags.map(t=><button disabled={table==='events'} key={t} onClick={()=>setTags(v=>v.filter(id=>id!==t))}>{p.tags.find(v=>v.id===t)?.name??t} ×</button>)}</div>{table==='events'&&<p>일정 태그는 저장소 스키마 확인 전까지 편집하지 않아요. 기존 값은 보존해요.</p>}{table==='todos'&&unknown.length>0&&<p>알 수 없는 태그예요. 기존 태그를 선택하거나 해제해주세요. 태그 생성은 이 화면에서 지원하지 않아요.</p>}
 {table==='todos'&&<><label>카테고리<input aria-label="카테고리" value={category} onChange={e=>setCategory(e.target.value)}/></label><label>주간 목표<select aria-label="주간 목표" value={goal} onChange={e=>setGoal(e.target.value)}><option value="">연결 없음</option>{p.weeklyGoals.map(g=><option key={g.id} value={g.id}>{g.text}</option>)}</select></label></>}
 <label>프로젝트<select aria-label="프로젝트" value={project} onChange={e=>setProject(e.target.value)}><option value="">연결 없음</option>{p.projects.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label></fieldset>{message&&<p role="alert">{message}</p>}</div>
 </MoaDialog>;
}
