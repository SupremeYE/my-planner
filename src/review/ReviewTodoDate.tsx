import {usePlanner} from '../app/store';
import {useMoaToday} from '../app/components/moamoa/moaShared';
/** A date filter over the same Provider rows, never a second TODO collection. */
export function ReviewTodoDate(){const p=usePlanner(),today=useMoaToday(p.dayEndHour);return <div className="rp-todo-date"><label>할 일 기준 날짜<input type="date" aria-label="할 일 기준 날짜" value={p.selectedDate} onChange={e=>e.target.value&&p.setSelectedDate(e.target.value)}/></label><button onClick={()=>p.setSelectedDate(today)}>실제 오늘로</button></div>;}
