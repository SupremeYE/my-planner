/** Preview completion changes status only. It never invents execution clock times. */
export * from '../lib/todoDoDuration';
import type {Todo,TodoStatus} from '../app/store';
export function completionMarkerPatch(_todo:Pick<Todo,'date'|'status'|'doStart'|'doEnd'|'doElapsedSec'>,_nextStatus:TodoStatus,_nowHHMM:string):Partial<Todo>{return {};}
