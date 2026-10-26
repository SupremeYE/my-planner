import { confirmedWrites } from './confirmedWrites';
import { readAllRows } from './readAllRows';
import { SaveFailure, saveFailure, saveIntent } from './saveCoordinator';
export type PlanTable = 'todos' | 'events';
export type PlanRow = { id: string; [key: string]: any };
const fields = {
  todos: ['text','is_top3','date','end_date','plan_start','plan_end','tags','category','weekly_goal_id','project_id','recurrence_rule','recurrence_days'],
  events: ['title','is_all_day','start_at','end_at','project_id','repeat_type','recurrence_freq','recurrence_interval','recurrence_byday','recurrence_preset'],
};
export const repeatedPlan = (row: PlanRow) => !!(row.recurrence_rule || row.recurrence_freq || row.recurrence_parent_id || row.parent_event_id || row.is_exception || (row.repeat_type && row.repeat_type !== 'none'));
const normalized=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v)&&!isNaN(Date.parse(v))?new Date(v).toISOString():v??null;
const equal = (a: unknown,b: unknown,key?:string) => saveIntent(key==='start_at'||key==='end_at'?normalized(a):a??null) === saveIntent(key==='start_at'||key==='end_at'?normalized(b):b??null);
/** Independent confirmed PLAN path. Raw rows preserve every unknown/legacy column. */
export function calendarPlanRepository(client: { from: (table: string) => any }, table: PlanTable) {
  const writer = confirmedWrites<PlanRow,PlanRow>(client,table,r=>r,r=>r);
  async function save(target: PlanRow, before?: PlanRow, remove = false) {
    if(table==='events'){target={...target};delete target.tags;}
    if (before && (target.id !== before.id || repeatedPlan(before))) throw new SaveFailure('반복 계획의 수정·삭제는 아직 지원하지 않아요. 기존 기록은 유지돼요.',false);
    const changed = fields[table].filter(key=>!before || !equal(target[key],before[key],key));
    const matches = (row: PlanRow | null) => !!row && changed.every(key=>equal(row[key],target[key],key));
    const latest = await writer.getConfirmed(target.id);
    if (remove && !latest) return null;
    if (!remove && matches(latest)) return latest;
    if (before && !latest) throw new SaveFailure('기존 계획을 확인할 수 없어요.',false);
    if (before && repeatedPlan(latest!)) throw new SaveFailure('반복 설정이 바뀌었어요. 다시 조회해주세요.',false);
    if (before && changed.some(key=>!equal(latest![key],before[key],key) && !equal(latest![key],target[key],key))) throw new SaveFailure('같은 항목이 다른 화면에서 변경됐어요. 초안을 보관하고 다시 조회해주세요.',false);
    if (before && !remove) {
      let hasActual = !!(latest!.do_start || latest!.do_end || latest!.do_elapsed_sec);
      if (table === 'todos') {
        const linked = await client.from('todo_time_blocks').select('id').eq('todo_id',target.id);
        if (linked.error) throw saveFailure(linked.error,linked.status);
        if (!Array.isArray(linked.data)) throw new SaveFailure('연결된 실제 활동 조회에 실패했어요.',false);
        hasActual ||= linked.data.length > 0;
      }
      if (hasActual && (changed.some(key=>['tags','category','date','end_date'].includes(key))
        || (table === 'events' && changed.some(key=>['start_at','end_at'].includes(key)&&new Date(target[key]).toDateString()!==new Date(latest![key]).toDateString())))) {
        throw new SaveFailure('실제 활동의 기록 날짜와 분류를 보존하기 위해 날짜·태그·카테고리 변경은 제한돼요. 제목과 예정 시간은 수정할 수 있어요.',false);
      }
    }
    try {
      if (!before) return await writer.createConfirmed(target);
      if (remove) {
        if (latest!.do_start || latest!.do_end || latest!.do_elapsed_sec || latest!.completed || latest!.status === 'done') throw new SaveFailure('실제 수행 기록 또는 완료 기록이 연결되어 삭제할 수 없어요.',false);
        if (table === 'todos') {
          const blocks = await client.from('todo_time_blocks').select('id').eq('todo_id',target.id);
          if (blocks.error) throw saveFailure(blocks.error,blocks.status);
          if (!Array.isArray(blocks.data) || blocks.data.length) throw new SaveFailure('연결된 실제 활동을 보호하기 위해 삭제할 수 없어요.',false);
        }
      }
      let query = remove ? client.from(table).delete() : client.from(table).update(Object.fromEntries(changed.map(key=>[key,target[key] ?? null])));
      query = query.eq('id',target.id);
      const guards = remove ? Object.keys(latest!).filter(key=>key!=='id') : [...new Set([...changed,'recurrence_rule','recurrence_freq','repeat_type','is_exception','do_start','do_end','do_elapsed_sec','completed','status','date','end_date','tags','category'].filter(key=>key in latest!))];
      for (const key of guards) query = latest![key] == null ? query.is(key,null) : query.eq(key,Array.isArray(latest![key]) ? `{${latest![key].map((v:unknown)=>JSON.stringify(v)).join(',')}}` : latest![key]);
      const result = await query.select('*');
      if (result.error) throw saveFailure(result.error,result.status);
      if (!Array.isArray(result.data) || result.data.length !== 1) throw new SaveFailure('저장 중 계획이 변경됐어요. 초안을 유지하고 다시 확인해주세요.',false);
      if (remove) { if (await writer.getConfirmed(target.id)) throw new SaveFailure('삭제를 확인하지 못했어요.',true); return null; }
      if (!matches(result.data[0])) throw new SaveFailure('저장 내용을 확인하지 못했어요.',true);
      return result.data[0];
    } catch(error) {
      try { const row = await writer.getConfirmed(target.id); if (remove ? !row : matches(row)) return row; } catch { /* Retain exact request for explicit retry. */ }
      throw error;
    }
  }
  return { fetch:()=>readAllRows<PlanRow>(client,table), save };
}
