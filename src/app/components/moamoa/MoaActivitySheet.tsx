import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePlanner, type TodoTimeBlock } from '../../store';
import { snapshotTags, type ActivityEntry } from '../../../lib/activityEntries';
import { timeTagLabel } from '../../../lib/moaTodos';
import { MoaDialog } from './MoaDialog';
import { MoaTagPicker } from './MoaPickers';
import './todos.css';
import './time.css';

export function MoaActivitySheet({ date: initialDate, entry, block, onClose, onSaved }: {
  date: string; entry?: ActivityEntry; block?: TodoTimeBlock; onClose: () => void; onSaved: () => void;
}) {
  const p = usePlanner();
  const [id] = useState(() => entry?.id ?? block?.id ?? crypto.randomUUID());
  const [mode, setMode] = useState<'activity' | 'todo'>(block ? 'todo' : 'activity');
  const [name, setName] = useState(entry?.name ?? '');
  const [minutes, setMinutes] = useState(String((entry?.elapsedSec ?? block?.elapsedSec ?? 1800) / 60));
  const [date, setDate] = useState(entry?.date ?? block?.date ?? initialDate);
  const [category, setCategory] = useState(entry?.categoryId ?? '');
  const [memo, setMemo] = useState(entry?.memo ?? '');
  const localTime = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); const pad = (v: number) => String(v).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const [start, setStart] = useState(localTime(entry?.startedAt)), [end, setEnd] = useState(localTime(entry?.endedAt));
  const [todoId, setTodoId] = useState(block?.todoId ?? '');
  const [picker, setPicker] = useState(false), [options, setOptions] = useState(!!entry?.memo || !!entry?.startedAt);
  const attempted = useRef(false), sending = useRef(false), completed = useRef(false);
  const key = `${mode === 'activity' ? 'activityEntries' : 'timeBlocks'}:${id}`;
  const state = p.saveStates.find(s => s.key === key);
  const busy = state?.status === 'saving'; const locked = busy || state?.status === 'error';
  const todo = p.todos.find(t => t.id === todoId);
  const ready = p.activityStorageStatus === 'ready';
  const title = entry || block ? '활동 기록 수정' : '시간 빠르게 기록';
  const [error, setError] = useState('');
  useEffect(() => { if (attempted.current && !completed.current && state?.status === 'saved') { completed.current = true; onSaved(); } }, [state?.status, onSaved]);
  const close = () => { if (!busy && (!name && !todoId && !memo && minutes === '30' || window.confirm('저장하지 않은 활동 입력을 닫을까요?'))) onClose(); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (locked || sending.current || !ready) return;
    sending.current = true; setError('');
    try {
      const seconds = Math.round(Number(minutes) * 60);
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400) { setError('실제 소요를 1초~24시간 범위로 입력해주세요.'); return; }
      if (mode === 'activity') {
        const actualStart = start ? entry?.startedAt && start === localTime(entry.startedAt) ? entry.startedAt : new Date(start).toISOString() : undefined;
        const actualEnd = end ? entry?.endedAt && end === localTime(entry.endedAt) ? entry.endedAt : new Date(end).toISOString() : undefined;
        if (!name.trim() || !!start !== !!end || start && (!Number.isFinite(Date.parse(start)) || Date.parse(actualEnd!) <= Date.parse(actualStart!) || Math.abs((Date.parse(actualEnd!) - Date.parse(actualStart!)) / 1000 - seconds) > 1)) {
          setError('활동명과 실제 시각을 확인해주세요. 시작·종료를 입력했다면 소요와 일치해야 해요.'); return;
        }
        const snapshot = entry && category === (entry.categoryId ?? '') ? entry.classificationSnapshot : snapshotTags(category ? [category] : [], p.tags);
        const value: ActivityEntry = { id, operationId: entry?.operationId ?? id, name: name.trim(), date, elapsedSec: seconds, categoryId: category || undefined,
          classificationSnapshot: snapshot, memo: memo.trim() || undefined, startedAt: actualStart, endedAt: actualEnd };
        attempted.current = true; await p.persistActivity(value, !!entry);
      } else if (block) {
        attempted.current = true; await p.amendTimeBlockConfirmed(id, { date, elapsedSec: seconds });
      } else if (todo) {
        if (!Number.isInteger(Number(minutes))) { setError('할 일 연결 기록은 정수 분으로 입력해주세요.'); return; }
        attempted.current = true; await p.addManualTimeConfirmed(todo.id, date, Number(minutes), id, snapshotTags(todo.tags ?? [], p.tags));
      } else setError('연결할 할 일을 선택해주세요.');
    } finally { sending.current = false; }
  }
  return <><MoaDialog title={title} description="실제 활동만 기록해요. 완료 체크나 목표 진행률은 바꾸지 않아요." onClose={close} saveKeys={[key]} footer={<div className="mx-actions"><button type="button" onClick={close} disabled={busy}>취소</button><button form="moa-activity-form" className="mx-primary" type="submit" disabled={locked || !ready || mode === 'activity' && !name.trim() || mode === 'todo' && !todoId}>{busy ? '저장 중…' : '기록 저장'}</button></div>}>
    {!entry && !block && <div className="mx-tabs ma-modes" role="group" aria-label="시간 기록 방식"><button disabled={locked} aria-pressed={mode === 'activity'} onClick={() => setMode('activity')}>독립 활동</button><button disabled={locked} aria-pressed={mode === 'todo'} onClick={() => setMode('todo')}>할 일 연결</button></div>}
    {!ready && <div className="ma-notice" role="status">{p.activityStorageStatus === 'loading' ? '저장 환경을 확인하고 있어요.' : p.activityStorageError || '저장 환경을 사용할 수 없어요.'} 실제 서버 저장은 완료되지 않았어요.<button onClick={() => void p.refreshActivityEntries()}>저장 환경 다시 확인</button></div>}
    <form id="moa-activity-form" className="mx-time-form" onSubmit={submit}>
      {mode === 'activity' ? <><label>활동명<input autoFocus aria-label="활동명" placeholder="어떤 활동을 모았나요?" maxLength={500} value={name} readOnly={locked} onChange={e => setName(e.target.value)} required /></label><button type="button" className="ma-category" aria-label="활동 카테고리 선택" disabled={locked} onClick={() => setPicker(true)}><span>대표 카테고리</span><strong>{entry && category === (entry.categoryId ?? '') ? entry.classificationSnapshot.shares[0]?.name ?? '미분류' : p.tags.find(t => t.id === category)?.name ?? '미분류'} ▾</strong></button></> : <><label>연결할 할 일<select aria-label="연결할 할 일" value={todoId} disabled={locked || !!block} onChange={e => setTodoId(e.target.value)} required><option value="">할 일을 선택해주세요</option>{p.todos.map(t => <option key={t.id} value={t.id}>{t.text}</option>)}</select></label><p className="mx-help">대표 카테고리 · {todo ? timeTagLabel(todo, p.tags) : '할 일 선택 후 확인'}{block?.classificationSnapshot && ' · 기존 기록 당시 분류 유지'}</p></>}
      <label>소요 시간 (분)<input aria-label="활동 소요 시간 (분)" type="number" min="0.016666666666666666" max="1440" step="any" inputMode="decimal" value={minutes} readOnly={locked} onChange={e => setMinutes(e.target.value)} required /></label><div className="mx-time-presets">{[15,30,60,90].map(n => <button key={n} type="button" aria-pressed={Number(minutes) === n} disabled={locked} onClick={() => setMinutes(String(n))}>{n}분</button>)}</div>
      <label>기록 날짜<input aria-label="활동 날짜" type="date" value={date} readOnly={locked} onChange={e => setDate(e.target.value)} required /></label>
      {mode === 'activity' && <><button type="button" className="mx-add-row" aria-expanded={options} onClick={() => setOptions(v => !v)}>메모·실제 시각 {options ? '접기' : '추가'}</button>{options && <><label>메모<textarea aria-label="활동 메모" value={memo} readOnly={locked} onChange={e => setMemo(e.target.value)} /></label><p className="mx-help">모르면 비워두세요. 자정을 넘어도 선택한 기록 날짜에 소요 전체를 귀속해요.</p><label>실제 시작<input aria-label="실제 시작" type="datetime-local" value={start} readOnly={locked} onChange={e => setStart(e.target.value)} /></label><label>실제 종료<input aria-label="실제 종료" type="datetime-local" value={end} readOnly={locked} onChange={e => setEnd(e.target.value)} /></label></>}</>}
    </form>{error && <p role="alert" className="mx-error">{error}</p>}<p className="mx-help">시각을 모르면 소요만 저장해요. 미분류도 실제 총시간에 포함돼요. 오프라인 저장은 지원하지 않아요.</p>
  </MoaDialog>{picker && <MoaTagPicker kind="time" value={category ? [category] : []} onChange={ids => setCategory(ids[0] ?? '')} onClose={() => setPicker(false)} />}</>;
}
