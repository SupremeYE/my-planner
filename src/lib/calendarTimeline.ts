/** Read-only display geometry. Never creates timestamps or changes stored durations. */
export const TIMELINE_PX_PER_MINUTE = .8;
export const DISPLAY_ONLY_MINUTES = 30;
export function clockMinute(value?:string):number|null {
 if(!value)return null;
 const clock=value.match(/^(\d{1,2}):([0-5]\d)$/);
 if(clock){const h=+clock[1];return h<=47?h*60+Number(clock[2]):null;}
 if(!/^\d{4}-\d\d-\d\dT/.test(value))return null;
 const d=new Date(value);return Number.isFinite(d.getTime())?d.getHours()*60+d.getMinutes():null;
}
export interface TimelineSpan {start:number;end:number;displayOnlyEnd:boolean}
export function timelineSpan(start?:string,end?:string,durationMinutes?:number):TimelineSpan|null {
 const s=clockMinute(start);if(s===null)return null;
 let e=clockMinute(end);
 // Explicit ISO timestamps can prove a midnight boundary. HH:mm alone cannot.
 if(start?.includes('T')&&end?.includes('T')){const delta=(Date.parse(end)-Date.parse(start))/60000;if(delta>0)e=s+delta;}
 if(end&&(e===null||e<=s))return null;
 const displayOnlyEnd=!end;
 e??=s+(durationMinutes!==undefined?durationMinutes:DISPLAY_ONLY_MINUTES);
 if(!Number.isFinite(e)||e<=s||s>=2880)return null;
 return {start:s,end:Math.min(2880,e),displayOnlyEnd};
}
export interface TimelineInput extends TimelineSpan {key:string}
/** Greedy interval partitioning within connected overlap groups. Touching edges don't overlap. */
export function layoutTimeline<T extends TimelineInput>(items:readonly T[]):Array<T&{lane:number;lanes:number;top:number;height:number}>{
 const sorted=[...items].sort((a,b)=>a.start-b.start||a.end-b.end||a.key.localeCompare(b.key));
 const result:Array<T&{lane:number;lanes:number;top:number;height:number}>=[];let group:typeof result=[],ends:number[]=[],until=-1;
 const flush=()=>{for(const item of group){item.lanes=ends.length;result.push(item);}group=[];ends=[];until=-1;};
 for(const item of sorted){if(item.start>=until)flush();let lane=ends.findIndex(end=>end<=item.start);if(lane<0)lane=ends.length;ends[lane]=item.end;until=Math.max(until,item.end);group.push({...item,lane,lanes:0,top:item.start*TIMELINE_PX_PER_MINUTE,height:(item.end-item.start)*TIMELINE_PX_PER_MINUTE});}flush();return result;
}
export function minuteLabel(minute:number){return `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;}
