import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
/** Native date picker behind one calendar target, with a single visible range label. */
export function MoaRecordDateBar({ value, label, inputLabel, onChange, onPrevious, onNext, onToday, previousLabel='이전 기간', nextLabel='다음 기간', month=false }: {
 value:string; label:string; inputLabel:string; onChange:(value:string)=>void; onPrevious:()=>void; onNext:()=>void; onToday:()=>void; previousLabel?:string; nextLabel?:string; month?:boolean;
}) {
 return <div className="ma-record-datebar"><div className="ma-date-nav"><button aria-label={previousLabel} onClick={onPrevious}><ChevronLeft size={20}/></button><span>{label}</span><button aria-label={nextLabel} onClick={onNext}><ChevronRight size={20}/></button></div><label className="ma-date-input" title="날짜 선택"><CalendarDays size={19}/><input aria-label={inputLabel} type={month?'month':'date'} value={value} onChange={e=>{if(e.target.value)onChange(e.target.value);}} /></label><button onClick={onToday}>오늘</button></div>;
}
