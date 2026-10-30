import {format,parseISO,addDays,differenceInCalendarDays} from 'date-fns';
import type {TodoTimeBlock} from '../app/store';
import {validActivityDate,validSnapshot} from './activityEntries';
import {SaveFailure} from './saveCoordinator';

const fail=(message:string):never=>{throw new SaveFailure(message,false);};
export function actualInterval(start?:string,end?:string){
 if(!start&&!end)return undefined;
 const valid=(value:string)=>validActivityDate(value.slice(0,10))&&/^\d{4}-\d\d-\d\dT([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)?$/.test(value);
 if(!start||!end||!valid(start)||!valid(end))return fail('실제 시작·종료 날짜와 시각을 함께 입력해주세요.');
 const a=Date.parse(start),b=Date.parse(end),seconds=(b-a)/1000;
 if(!Number.isFinite(seconds)||!Number.isInteger(seconds)||seconds<=0||seconds>86400)return fail('실제 종료는 시작 이후, 24시간 이내여야 해요. 자정 이후는 정확한 종료 날짜를 선택해주세요.');
 return {startedAt:new Date(a).toISOString(),endedAt:new Date(b).toISOString(),elapsedSec:seconds};
}
export function blockTimes(date:string,start?:string,end?:string):Pick<TodoTimeBlock,'start'|'end'>{
 const interval=actualInterval(start,end);if(!interval)return {start:undefined,end:undefined};
 const a=new Date(interval.startedAt),b=new Date(interval.endedAt);
 const recorded=parseISO(date),startHour=a.getHours()+differenceInCalendarDays(a,recorded)*24,endHour=b.getHours()+differenceInCalendarDays(b,recorded)*24;
 if(startHour<0||startHour>47||endHour>47)return fail('할 일 블록은 기록 날짜와 명시된 다음 날 범위의 실제 시각을 지원해요. 다른 날짜 귀속은 독립 활동을 사용해주세요.');
 return {start:`${String(startHour).padStart(2,'0')}:${format(a,'mm')}`,end:`${String(endHour).padStart(2,'0')}:${format(b,'mm')}`};
}
export function blockLocalTime(date:string,clock?:string){if(!clock||!/^\d\d:[0-5]\d$/.test(clock))return '';const h=Number(clock.slice(0,2));return `${format(addDays(parseISO(date),Math.floor(h/24)),'yyyy-MM-dd')}T${String(h%24).padStart(2,'0')}:${clock.slice(3)}`;}
export function validateActualBlock(block:TodoTimeBlock,preserveLegacyTiming=false){
 if(!validActivityDate(block.date)||!Number.isInteger(block.elapsedSec)||block.elapsedSec<1||block.elapsedSec>86400)fail('날짜와 1초~24시간의 실제 소요를 확인해주세요.');
 if(block.classificationSnapshot!=null&&!validSnapshot(block.classificationSnapshot))fail('기록 당시 분류 정보를 확인해주세요.');
 if(preserveLegacyTiming)return; // No rounding, repair, or inferred timestamps for existing measured sessions.
 if(block.start&&(!/^([0-3]\d|4[0-7]):[0-5]\d$/.test(block.start)||!/^([0-3]\d|4[0-7]):[0-5]\d$/.test(block.end??'')))fail('실제 시각은 기록 날짜부터 명시된 다음 날까지 입력해주세요.');
 if(!!block.start!==!!block.end)fail('실제 시작과 종료를 함께 입력하거나 모두 비워주세요.');
 if(block.start&&block.end){const interval=actualInterval(blockLocalTime(block.date,block.start),blockLocalTime(block.date,block.end));if(!interval||block.elapsedSec>interval.elapsedSec)fail('실제 소요가 시작·종료 간격보다 길 수 없어요.');}
}
/** Next timer adapter contract: sessionId is the stable row ID; paused seconds never become extra rows.
 * Date attribution is explicit. Metadata not supported by the current schema must stay in the timer controller. */
export interface ActualSession {sessionId:string;todoId:string;date:string;startedAt?:string;endedAt?:string;elapsedSec:number;pausedSec?:number}
export function timerSessionBlock(value:ActualSession):TodoTimeBlock{
 if(!value.sessionId||!value.todoId)fail('타이머 세션과 연결 TODO ID를 확인해주세요.');
 const interval=actualInterval(value.startedAt,value.endedAt);
 if(interval&&value.pausedSec!==undefined&&interval.elapsedSec-value.pausedSec!==value.elapsedSec)fail('타이머 실제 소요와 일시정지 시간을 확인해주세요.');
 const block={id:value.sessionId,todoId:value.todoId,date:value.date,elapsedSec:value.elapsedSec,...blockTimes(value.date,value.startedAt,value.endedAt)};
 validateActualBlock(block);return block;
}
