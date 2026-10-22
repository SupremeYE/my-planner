import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Clock3 } from 'lucide-react';
import { usePlanner, type Todo } from '../../store';
import { timeTagLabel } from '../../../lib/moaTodos';
import { MoaDialog } from './MoaDialog';
export function MoaTimeSheet({ todo, today, id, onClose, onSaved }: { todo: Todo; today: string; id: string; onClose: () => void; onSaved: () => void }) {
  const { tags, saveStates, addManualTimeConfirmed } = usePlanner(); const [date, setDate] = useState(today); const [minutes, setMinutes] = useState('30');
  const attempted = useRef(false), busyRef = useRef(false), done = useRef(false);
  const state = saveStates.find(s => s.key === `timeBlocks:${id}`); const busy = state?.status === 'saving'; const locked = busy || state?.status === 'error';
  useEffect(() => { if (attempted.current && !done.current && state?.status === 'saved') { done.current = true; onSaved(); } }, [state?.status, onSaved]);
  async function save(event: FormEvent) { event.preventDefault(); if (locked || busyRef.current) return; busyRef.current = true; attempted.current = true;
    try { await addManualTimeConfirmed(todo.id, date, Number(minutes), id); } finally { busyRef.current = false; } }
  return <MoaDialog title="실제 시간 기록" description="시작·종료 시각은 만들지 않고, 실제 사용한 소요만 저장해요." onClose={() => { if (!busy && window.confirm('저장하지 않은 시간 입력을 닫을까요?')) onClose(); }} saveKeys={[`timeBlocks:${id}`]} footer={<button form="moa-time-form" type="submit" className="mx-primary" disabled={locked || !date || !(Number(minutes) > 0)}>{busy ? '저장 중…' : '시간 저장'}</button>}>
    <div className="mx-time-task"><Clock3 size={22} /><strong>{todo.text}</strong></div><p className="mx-help">대표 카테고리 · {timeTagLabel(todo, tags)}</p>
    <form id="moa-time-form" onSubmit={save} className="mx-time-form"><label>기록 날짜<input aria-label="시간 기록 날짜" type="date" value={date} disabled={locked} onChange={e => setDate(e.target.value)} required /></label><label>소요 시간 (분)<input aria-label="소요 시간 (분)" type="number" min="1" max="1440" step="1" value={minutes} readOnly={locked} onChange={e => setMinutes(e.target.value)} required /></label><div className="mx-time-presets">{[15, 30, 60].map(value => <button type="button" key={value} disabled={locked} aria-pressed={Number(minutes) === value} onClick={() => setMinutes(String(value))}>{value}분</button>)}</div></form>
    <p className="mx-help">완료 여부는 바꾸지 않아요. 카테고리가 없으면 미분류로 집계해요. 기존 레거시 실적이 있으면 작업 블록으로 함께 보존해요.</p>
  </MoaDialog>;
}
