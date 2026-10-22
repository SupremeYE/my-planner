import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronDown, Clock3, Plus, Settings2, Tag as TagIcon, Target, X } from 'lucide-react';
import { usePlanner, type Todo } from '../../store';
import { MOA_CATEGORIES, selectedTimeTags } from '../../../lib/moaTodos';
import { MoaDialog } from './MoaDialog';
import { MoaTagPicker, MoaGoalPicker } from './MoaPickers';
import { MoaTagManager } from './MoaTagManager';

function fields(todo?: Todo, defaultDate: string | null = null) {
  return { text: todo?.text ?? '', date: todo ? todo.date : defaultDate, endDate: todo?.endDate ?? todo?.date ?? defaultDate ?? undefined,
    planStart: todo?.planStart, planEnd: todo?.planEnd, category: todo?.category, tags: todo?.tags ?? [], weeklyGoalId: todo?.weeklyGoalId,
    recurrenceRule: todo?.recurrenceRule, recurrenceEndDate: todo?.recurrenceEndDate };
}
export function MoaTodoEditor({ todo, defaultDate, id, onClose, onSaved }: { todo?: Todo; defaultDate: string | null; id: string; onClose: () => void; onSaved: () => void }) {
  const { addTodo, updateTodo, tags, weeklyGoals, saveStates } = usePlanner();
  const [original] = useState(() => fields(todo, defaultDate)); const [draft, setDraft] = useState(original);
  const [dateOpen, setDateOpen] = useState(false); const [timeOpen, setTimeOpen] = useState(false);
  const [picker, setPicker] = useState<'time' | 'normal' | 'goal' | null>(null); const [manager, setManager] = useState(false);
  const [error, setError] = useState(''); const attempted = useRef(false); const busyRef = useRef(false); const done = useRef(false);
  const state = saveStates.find(s => s.key === `todos:${id}`);
  const busy = state?.status === 'saving'; const locked = busy || state?.status === 'error';
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const primary = selectedTimeTags(draft.tags, tags); const auxiliary = tags.filter(tag => !tag.trackTime && draft.tags.includes(tag.id));
  const goal = weeklyGoals.find(g => g.id === draft.weeklyGoalId);
  useEffect(() => { if (attempted.current && !done.current && state?.status === 'saved') { done.current = true; onSaved(); } }, [state?.status, onSaved]);
  function close() { if (busy) return; if (dirty && !window.confirm('저장하지 않은 내용을 취소할까요?')) return; onClose(); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft.text.trim() || locked || busyRef.current) return;
    if (draft.recurrenceRule && !draft.date) { setError('반복할 일의 시작 날짜를 선택해주세요.'); return; }
    if (draft.date && draft.endDate && draft.endDate < draft.date) { setError('종료 날짜를 시작 날짜 이후로 선택해주세요.'); return; }
    if (draft.tags.some(tagId => !tags.some(tag => tag.id === tagId)) && draft.tags.some(tagId => !original.tags.includes(tagId))) { setError('태그 목록이 바뀌었어요. 선택을 다시 확인해주세요.'); return; }
    if (draft.weeklyGoalId && draft.weeklyGoalId !== original.weeklyGoalId && !weeklyGoals.some(g => g.id === draft.weeklyGoalId)) { setError('목표 목록이 바뀌었어요. 다시 선택해주세요.'); return; }
    busyRef.current = true; attempted.current = true; setError('');
    const value = { ...draft, text: draft.text.trim(), endDate: draft.date ? draft.recurrenceRule ? undefined : draft.endDate ?? draft.date : undefined };
    try {
      if (todo) {
        const changes = Object.fromEntries(Object.entries(value).filter(([key, v]) => JSON.stringify(v) !== JSON.stringify(original[key as keyof typeof original])));
        if (!await updateTodo(todo.id, changes)) setError('저장을 확인하지 못했어요. 초안을 유지했어요. 저장 알림이나 다른 기기의 변경을 확인해주세요.');
      } else if (!await addTodo({ ...value, status: 'active', isTop3: false }, id)) setError('저장을 확인하지 못했어요. 초안을 유지했어요. 저장 알림을 확인해주세요.');
    } finally { busyRef.current = false; }
  }
  function changePrimary(ids: string[]) {
    if (todo && primary.length > 1 && !window.confirm('대표 카테고리를 선택하면 기존 균등 분할 연결을 바꾸고 과거 시간도 재분류해요. 변경할까요?')) return;
    const tracked = new Set(tags.filter(tag => tag.trackTime).map(tag => tag.id));
    setDraft(d => ({ ...d, tags: [...d.tags.filter(tagId => !tracked.has(tagId)), ...ids] }));
  }
  const extraUnknownCategory = draft.category && !MOA_CATEGORIES.some(c => c.id === draft.category);
  return <><MoaDialog title={todo ? '할 일 수정' : '할 일 추가'} description="제목만 적어도 괜찮아요. 나머지는 필요할 때 선택해요." onClose={close} saveKeys={[`todos:${id}`]} footer={<div className="mx-actions"><button onClick={close} disabled={busy}>취소</button><button form="moa-todo-form" type="submit" className="mx-primary" disabled={!draft.text.trim() || locked}>{busy ? '저장 중…' : '저장'}</button></div>}>
    <form id="moa-todo-form" onSubmit={save} className="mx-editor">
      <label className="mx-title-field">할 일 제목<textarea aria-label="할 일 제목" autoFocus required rows={2} placeholder="무엇을 해볼까요?" value={draft.text} readOnly={locked} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} /></label>
      <div className="mx-option-chips"><button type="button" onClick={() => setDateOpen(v => !v)} disabled={locked} aria-expanded={dateOpen}><CalendarDays size={16} />{draft.date ?? '날짜 미정'}</button><button type="button" onClick={() => setTimeOpen(v => !v)} disabled={locked} aria-expanded={timeOpen}><Clock3 size={16} />{draft.planStart ? `${draft.planStart} 예정` : '예정 시간'}</button></div>
      {dateOpen && <div className="mx-two-fields"><label>날짜<input aria-label="할 일 날짜" type="date" value={draft.date ?? ''} disabled={locked} onChange={e => setDraft(d => ({ ...d, date: e.target.value || null, endDate: e.target.value || undefined }))} /></label><label>종료 날짜<input aria-label="할 일 종료 날짜" type="date" value={draft.endDate ?? ''} min={draft.date ?? undefined} disabled={locked || !draft.date || !!draft.recurrenceRule} onChange={e => setDraft(d => ({ ...d, endDate: e.target.value || undefined }))} /></label><button type="button" onClick={() => setDraft(d => ({ ...d, date: null, endDate: undefined }))} disabled={locked}>날짜 지정 해제</button></div>}
      {timeOpen && <div className="mx-two-fields"><label>시작 예정<input aria-label="시작 예정 시간" placeholder="09:00" inputMode="numeric" pattern="(?:[0-3]?[0-9]|4[0-7]):[0-5][0-9]" value={draft.planStart ?? ''} readOnly={locked} onChange={e => setDraft(d => ({ ...d, planStart: e.target.value || undefined }))} /></label><label>종료 예정<input aria-label="종료 예정 시간" placeholder="10:00" inputMode="numeric" pattern="(?:[0-3]?[0-9]|4[0-7]):[0-5][0-9]" value={draft.planEnd ?? ''} readOnly={locked} onChange={e => setDraft(d => ({ ...d, planEnd: e.target.value || undefined }))} /></label><p className="mx-help">계획만 저장하며 실제 시간에는 합산하지 않아요. HH:mm 형식이에요.</p></div>}
      <label className="mx-inline-field">구분<select aria-label="할 일 구분" value={draft.category ?? ''} disabled={locked} onChange={e => setDraft(d => ({ ...d, category: e.target.value || undefined }))}><option value="">선택 안 함</option>{MOA_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}{extraUnknownCategory && <option value={draft.category}>기존: {draft.category}</option>}</select></label>
      <div className="mx-inline-field"><span>대표 카테고리</span><button type="button" disabled={locked} onClick={() => setPicker('time')} aria-label="대표 카테고리 선택"><TagIcon size={16} />{primary.length > 1 ? `기존 ${primary.length}개 · 균등 분할` : primary[0]?.name ?? '선택 안 함'}<ChevronDown size={15} /></button></div>
      {primary.length > 1 && <p className="mx-help">기존 다중 시간 태그는 그대로 유지해요. 대표 선택을 바꿀 때만 분할 연결을 변경해요.</p>}
      <div className="mx-inline-field"><span>추가 태그</span><div className="mx-chips">{auxiliary.map(tag => <button type="button" key={tag.id} disabled={locked} className="mx-tag-chip" onClick={() => setDraft(d => ({ ...d, tags: d.tags.filter(id => id !== tag.id) }))} aria-label={`${tag.name} 태그 선택 해제`}>#{tag.name}<X size={12} /></button>)}<button type="button" disabled={locked} onClick={() => setPicker('normal')}><Plus size={15} />태그</button></div></div>
      <div className="mx-inline-field"><span>목표 연결</span><button type="button" disabled={locked} onClick={() => setPicker('goal')} aria-label="연결 목표 선택"><Target size={16} />{goal?.text ?? (draft.weeklyGoalId ? '기존 연결 목표' : '연결 안 함')}<ChevronDown size={15} /></button></div>
      <details className="mx-more-options"><summary>추가 옵션</summary><label>반복 설정<select aria-label="반복 설정" value={draft.recurrenceRule ?? ''} disabled={locked || !!todo} onChange={e => setDraft(d => ({ ...d, recurrenceRule: e.target.value as Todo['recurrenceRule'] || undefined }))}><option value="">반복 안 함</option><option value="daily">매일</option><option value="weekdays">평일</option><option value="weekly">매주 같은 요일</option></select></label><p className="mx-help">반복은 새 할 일에서 설정할 수 있어요. 기존 반복의 편집·삭제·수동 시간 기록은 이 화면에서 지원하지 않아요.</p><label>메모<textarea disabled placeholder="기존 TODO에 메모 저장 필드가 없어 후속 모델 검토가 필요해요." rows={2} /></label></details>
      <button type="button" className="mx-add-row" disabled={locked} onClick={() => setManager(true)}><Settings2 size={16} />태그 관리</button>
      <p className="mx-help">태그 선택은 목표와 독립적이에요. 태그를 바꾸면 기존 작업 시간의 분류도 바뀔 수 있어요.</p>{error && <p role="alert" className="mx-error">{error}</p>}
    </form>
  </MoaDialog>
  {picker === 'time' && <MoaTagPicker kind="time" value={primary.map(tag => tag.id)} onChange={changePrimary} onClose={() => setPicker(null)} />}
  {picker === 'normal' && <MoaTagPicker kind="normal" value={auxiliary.map(tag => tag.id)} onChange={ids => { const auxIds = new Set(tags.filter(tag => !tag.trackTime).map(tag => tag.id)); setDraft(d => ({ ...d, tags: [...d.tags.filter(id => !auxIds.has(id)), ...ids] })); }} onClose={() => setPicker(null)} />}
  {picker === 'goal' && <MoaGoalPicker value={draft.weeklyGoalId} onChange={weeklyGoalId => setDraft(d => ({ ...d, weeklyGoalId }))} onClose={() => setPicker(null)} />}
  {manager && <MoaTagManager onClose={() => setManager(false)} />}</>;
}
