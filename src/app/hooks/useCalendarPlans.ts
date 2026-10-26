import {useCallback,useEffect,useMemo} from 'react';
import {usePlanner} from '../store';
import {fromTodo} from '../../lib/todoCodec';
import {toRowPayload} from '../../api/events';
import type {PlanRow,PlanTable} from '../../lib/calendarPlanRepository';
/** Views project the same Provider records. No second store or coordinator. */
export function useCalendarPlans(table:PlanTable,start?:string,end?:string){
 const p=usePlanner();
 const records=useMemo<PlanRow[]>(()=>table==='todos'?p.todos.map(t=>fromTodo(t) as PlanRow):
  [...new Map(p.events.map(e=>{const id=e.sourceEventId??e.id;const row={...toRowPayload({...e,id,startDate:e.startDate??e.date,endDate:e.endDate??e.date}),id,tags:e.tags??[]};return [id,row] as const;})).values()], [table,p.todos,p.events]);
 const refresh=useCallback(()=>p.refreshCalendarPlans(table,start,end),[table,start,end,p.refreshCalendarPlans]);
 useEffect(()=>{void refresh();const visible=()=>{if(document.visibilityState!=='hidden')void refresh();};window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);return()=>{window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};},[refresh]);
 return {records,error:p.planReadErrors[table],loading:p.isLoading,refresh,
  save:(target:PlanRow,before?:PlanRow,remove=false)=>p.saveCalendarPlan(table,target,before,remove),
  states:p.saveStates.filter(s=>s.key.startsWith(`${table}:`)),retry:(id:string)=>p.retryCalendarPlan(`${table}:${id}`),dismiss:(id:string)=>p.dismissSave(`${table}:${id}`)};
}
