import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { supabase } from '../../lib/supabase';
import { calendarPlanRepository, type PlanTable, type PlanRow } from '../../lib/calendarPlanRepository';
import { mergeConfirmedRows, SaveCoordinator, saveIntent } from '../../lib/saveCoordinator';
import { useRealtimeSync } from './useRealtimeSync';
export function useCalendarPlans(table: PlanTable) {
  const [repository] = useState(()=>calendarPlanRepository(supabase,table));
  const [coordinator] = useState(()=>new SaveCoordinator());
  useSyncExternalStore(useCallback(fn=>coordinator.subscribe(fn),[coordinator]),()=>coordinator.revision);
  const [records,setRecords] = useState<PlanRow[]>([]), [error,setError] = useState(''), [loading,setLoading] = useState(true);
  const rows=useRef<PlanRow[]>([]), generation=useRef(0), mounted=useRef(true);
  const refresh=useCallback(async()=>{
    const ticket=++generation.current;
    try {const remote=await repository.fetch(); if(mounted.current && ticket===generation.current){rows.current=mergeConfirmedRows(remote,rows.current,coordinator.protectedIds(table));setRecords(rows.current);setError('');}}
    catch{if(mounted.current && ticket===generation.current)setError('계획 조회에 실패했어요. 마지막 확인 목록을 유지해요.');}
    finally{if(mounted.current && ticket===generation.current)setLoading(false);}
  },[repository,coordinator,table]);
  useEffect(()=>{mounted.current=true;void refresh();const visible=()=>{if(document.visibilityState!=='hidden')void refresh();};window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);return()=>{mounted.current=false;generation.current++;window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};},[refresh]);
  useRealtimeSync(table,refresh);
  const save=(target:PlanRow,before?:PlanRow,remove=false)=>{
    generation.current++;const value=structuredClone(target), original=before&&structuredClone(before);
    return coordinator.run({key:`${table}:${value.id}`,label:'계획 저장',intent:saveIntent({value,original,remove}),execute:async()=>({id:value.id,row:await repository.save(value,original,remove)}),commit:({id,row})=>{generation.current++;rows.current=[...rows.current.filter(r=>r.id!==id),...(row?[row]:[])];if(mounted.current)setRecords(rows.current);}});
  };
  return {records,error,loading,refresh,save,states:coordinator.snapshot(),retry:(id:string)=>{generation.current++;return coordinator.retry(`${table}:${id}`);},dismiss:(id:string)=>coordinator.dismiss(`${table}:${id}`)};
}
