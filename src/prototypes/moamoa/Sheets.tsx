import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, Clock3, Feather, Heart, Moon, Plus, Sprout, X } from 'lucide-react';
import { Feedback } from './Feedback';
import { useMoa } from './PrototypeState';
import { categories, TODAY, weeklyGoals } from './sample';

export function Sheets() {
  const { sheet, setSheet, restoreFocus, busy } = useMoa();
  if (!sheet) return null;
  const titles = { quick: '지금, 작은 조각 모으기', 'review-day': '오늘의 나에게 한 줄', 'review-week': '이번 주의 나에게', 'review-month': '이번 달의 나에게', mood: '지금 내 마음은', sleep: '잘 쉬었나요?', options: '시안을 가볍게 둘러보세요' };
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) setSheet(null); }}>
    <Dialog.Portal container={document.getElementById('moamoa-prototype')}>
      <Dialog.Overlay className="mo-overlay" />
      <Dialog.Content onCloseAutoFocus={event => { event.preventDefault(); requestAnimationFrame(restoreFocus); }} className={`mo-dialog ${sheet === 'options' ? 'mo-options-dialog' : sheet === 'quick' ? 'mo-quick-dialog' : ''}`} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <div className="mo-sheet-handle" /><header className="mo-dialog-header"><span className="mo-sheet-icon">{typeof sheet === 'object' ? <Clock3 size={20} /> : sheet === 'quick' ? <Plus size={22} /> : sheet === 'sleep' ? <Moon size={20} /> : sheet === 'mood' ? <Heart size={20} /> : <Feather size={20} />}</span><Dialog.Close className="mo-icon-button" disabled={busy} aria-label="시트 닫기"><X size={21} /></Dialog.Close></header>
        <Dialog.Title className="mo-dialog-title">{typeof sheet === 'object' ? '계획을 가볍게 옮기기' : titles[sheet]}</Dialog.Title>
        <Dialog.Description className="mo-dialog-description">{sheet === 'options' ? '운영 데이터와 연결되지 않는 독립적인 디자인 시안이에요.' : '완벽하게 적지 않아도 괜찮아요. 떠오른 만큼만 남겨요.'}</Dialog.Description>
        <Feedback inside />
        {typeof sheet === 'object' ? <EditPlan kind={sheet.recordKind} id={sheet.id} /> : sheet === 'quick' ? <QuickSheet /> : sheet === 'options' ? <Options /> : <LifeNote kind={sheet} />}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
function QuickSheet() {
  const { quickDate, quickMode, todos, blocks, addTodo, addBlock, setSheet, busy } = useMoa();
  const [mode, setMode] = useState<'todo' | 'time'>(quickMode);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(quickDate ?? '');
  const [category, setCategory] = useState('life');
  const [goal, setGoal] = useState('');
  const [todoId, setTodoId] = useState(todos[0].id);
  const [minutes, setMinutes] = useState('30');
  const [memo, setMemo] = useState('');
  const [source, setSource] = useState('linked');
  const [creationId] = useState(() => crypto.randomUUID());
  const confirmed = mode === 'todo' ? todos.some(todo => todo.id === creationId) : blocks.some(block => block.id === creationId);
  const linkedTodo = todos.find(todo => todo.id === todoId);
  const linkedCategory = categories.find(item => linkedTodo?.tags?.includes(item.id));
  const valid = mode === 'todo' ? title.trim().length > 0 : source === 'linked' && !!linkedTodo && !!date && Number(minutes) > 0 && Number(minutes) <= 1440 && Number.isInteger(Number(minutes));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (confirmed) { setSheet(null); return; } if (!valid || busy) return;
    const saved = mode === 'todo' ? await addTodo({ id: creationId, text: title.trim(), date: date || null, status: 'active', isTop3: false, tags: [category], weeklyGoalId: goal || undefined })
      : await addBlock({ id: creationId, todoId, date, elapsedSec: Number(minutes) * 60 }, memo.trim());
    if (saved) setSheet(null);
  };
  return <form className="mo-quick-form" onSubmit={submit}>
    <div className="mo-quick-fields">
    <div className="mo-segment mo-capture-tabs" aria-label="빠른 기록 종류"><button type="button" aria-pressed={mode === 'todo'} onClick={() => setMode('todo')} disabled={busy || confirmed}><Check size={16} />할 일</button><button type="button" aria-pressed={mode === 'time'} onClick={() => { setMode('time'); if (!date) setDate(TODAY); }} disabled={busy || confirmed}><Clock3 size={16} />시간</button></div>
    <fieldset disabled={busy || confirmed}>
      {mode === 'todo' ? <label className="mo-field">할 일 <span>제목만 있어도 충분해요</span><input autoFocus placeholder="어떤 작은 일을 모아볼까요?" value={title} onChange={event => setTitle(event.target.value)} required maxLength={180} /></label> : <>
        <div className="mo-source-toggle"><button type="button" aria-pressed={source === 'linked'} onClick={() => setSource('linked')}>할 일에 연결</button><button type="button" aria-pressed={source === 'independent'} onClick={() => setSource('independent')}>독립 활동 <small>후속 설계</small></button></div>
        {source === 'independent' ? <div className="mo-future-note"><Sprout size={25} /><strong>자유로운 활동 기록은 준비 중이에요.</strong><p>지금은 할 일에 연결한 시간만 시연할 수 있어요. 독립 활동은 저장되지 않아요.</p></div> : <>
          <label className="mo-field">활동명 · 연결할 할 일<select value={todoId} onChange={event => setTodoId(event.target.value)}>{todos.map(todo => <option key={todo.id} value={todo.id}>{todo.text}</option>)}</select></label>
          <label className="mo-field">소요 시간<div className="mo-duration-input"><input type="number" value={minutes} onChange={event => setMinutes(event.target.value)} min={1} max={1440} step={1} inputMode="numeric" required /><span>분</span></div></label>
          <div className="mo-duration-presets">{[15, 30, 60].map(value => <button key={value} type="button" aria-pressed={Number(minutes) === value} onClick={() => setMinutes(String(value))}>{value}분</button>)}</div>
          <div className="mo-linked-category"><span>대표 카테고리</span><span><i style={{ background: linkedCategory?.color }} />{linkedCategory?.name ?? '미분류'}</span><small>연결한 할 일의 태그를 그대로 사용해요.</small></div>
        </>}
      </>}
      {!(mode === 'time' && source === 'independent') && <>
        <div className="mo-quick-date"><span>날짜</span><button type="button" aria-pressed={date === TODAY} onClick={() => setDate(TODAY)}>오늘 · 10.20</button>{date && date !== TODAY && <span className="mo-pill">{Number(date.slice(5, 7))}.{Number(date.slice(8))}</span>}{mode === 'todo' && <button type="button" aria-pressed={!date} onClick={() => setDate('')}>날짜 미정</button>}</div>
        <details className="mo-capture-details"><summary>조금 더 자세히 <ChevronDown size={16} /></summary>
          <label className="mo-field">다른 날짜<input type="date" value={date} onChange={event => setDate(event.target.value)} required={mode === 'time'} /></label>
          {mode === 'todo' ? <><label className="mo-field">카테고리<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="mo-field">연결할 주간 목표 <span>선택</span><select value={goal} onChange={event => setGoal(event.target.value)}><option value="">연결하지 않음</option>{weeklyGoals.map(item => <option key={item.id} value={item.id}>{item.text}</option>)}</select></label></> : <label className="mo-field">한 줄 메모 <span>선택 · 시안</span><input value={memo} onChange={event => setMemo(event.target.value)} placeholder="이 시간은 어떤 느낌이었나요?" maxLength={280} /></label>}
        </details>
      </>}
    </fieldset>
    </div><div className="mo-sheet-actions">
    <button className="mo-primary mo-submit" type="submit" disabled={busy || (!valid && !confirmed)}>{busy ? '샘플에 반영 중…' : confirmed ? '완료 · 시트 닫기' : mode === 'todo' ? '할 일 모아두기' : source === 'independent' ? '독립 활동은 후속 설계예요' : `${minutes || '0'}분 모아두기`}</button>
    <p className="mo-sheet-footnote">샘플에만 반영돼요. 새로고침하면 처음으로 돌아가요.</p>
    </div>
  </form>;
}
function EditPlan({ kind, id }: { kind: 'todo' | 'event'; id: string }) {
  const { todos, events, editPlan, setSheet, busy } = useMoa();
  const todo = kind === 'todo' ? todos.find(row => row.id === id) : undefined;
  const event = kind === 'event' ? events.find(row => row.id === id) : undefined;
  const [date, setDate] = useState(todo?.date ?? event?.date ?? TODAY);
  const [start, setStart] = useState(todo?.planStart ?? event?.startTime ?? '09:00');
  const [end, setEnd] = useState(todo?.planEnd ?? event?.endTime ?? '10:00');
  const actualDateLocked = !!(event?.doStart || event?.doEnd);
  const invalid = !date || (!!start && (!end || end <= start));
  return <form onSubmit={async event => { event.preventDefault(); if (!invalid && await editPlan(kind, id, date, start, end)) setSheet(null); }}><p className="mo-edit-title">{todo?.text ?? event?.title}</p><fieldset disabled={busy}>
    <label className="mo-field">날짜<input type="date" required disabled={actualDateLocked} value={date} onChange={event => setDate(event.target.value)} /></label>
    <div className="mo-field-pair"><label className="mo-field">계획 시작<input type="time" value={start} onChange={event => setStart(event.target.value)} /></label><label className="mo-field">계획 종료<input type="time" value={end} onChange={event => setEnd(event.target.value)} /></label></div>
  </fieldset>{actualDateLocked && <p className="mo-section-hint">실제 기록이 있는 일정은 날짜를 유지해요. 날짜를 따로 옮기는 기능은 후속 설계가 필요해요.</p>}<p className="mo-section-hint">계획을 옮겨도 실제 활동 기록의 날짜와 시간은 그대로예요.</p>{invalid && <p className="mo-validation">종료 시간은 시작 시간보다 늦게 정해주세요.</p>}<button className="mo-primary mo-submit" disabled={invalid || busy}>계획 옮기기</button></form>;
}
function LifeNote({ kind }: { kind: 'review-day' | 'review-week' | 'review-month' | 'mood' | 'sleep' }) {
  const { notes, saveNote, setSheet, busy, weekStart } = useMoa();
  const key = `${kind}:${kind === 'review-week' ? weekStart : kind === 'review-month' ? TODAY.slice(0, 7) : TODAY}`;
  const [text, setText] = useState(notes[key] ?? '');
  const [mood, setMood] = useState('편안해요');
  const [bed, setBed] = useState('23:30');
  const [wake, setWake] = useState('07:00');
  return <form onSubmit={async event => { event.preventDefault(); const value = kind === 'sleep' ? `${bed}–${wake}` : kind === 'mood' ? `${mood} ${text}` : text.trim(); if (value && await saveNote(key, value)) setSheet(null); }}><fieldset disabled={busy}>
    {kind === 'mood' && <div className="mo-mood-picker">{['편안해요', '활기차요', '그저 그래요', '조금 지쳐요'].map((label, i) => <button type="button" aria-pressed={mood === label} key={label} onClick={() => setMood(label)}><span>{['☺', '☀', '◡', '☁'][i]}</span>{label}</button>)}</div>}
    {kind === 'sleep' ? <div className="mo-field-pair"><label className="mo-field">잠든 시각<input type="time" required value={bed} onChange={event => setBed(event.target.value)} /></label><label className="mo-field">일어난 시각<input type="time" required value={wake} onChange={event => setWake(event.target.value)} /></label></div> : <label className="mo-field">{kind === 'mood' ? '덧붙이고 싶은 마음' : kind === 'review-week' ? '이번 주, 고마웠던 작은 순간은?' : kind === 'review-month' ? '이번 달, 나에게 남은 것은?' : '오늘, 기억하고 싶은 순간은?'}<textarea value={text} onChange={event => setText(event.target.value)} placeholder="한 문장, 단어 하나도 좋아요." rows={4} required={kind !== 'mood'} maxLength={2000} /></label>}
    {kind === 'sleep' && <p className="mo-section-hint">수면은 생활 기록으로만 남고 활동 시간에 더하지 않아요.</p>}
  </fieldset><button className="mo-primary mo-submit" disabled={busy || (kind.startsWith('review') && !text.trim())}>작은 기록 남기기</button><p className="mo-sheet-footnote">생활 기록 입력의 시연이에요. 실제 데이터는 저장하지 않아요.</p></form>;
}
function Options() {
  const { failOnce, reset, busy } = useMoa();
  return <div className="mo-options"><p>탭을 바꾸어도 같은 샘플 할 일과 진행률을 보여줘요. 완료 체크, 할 일 추가, 시간 기록, 습관 체크, 계획 이동을 눌러보세요.</p><button className="mo-secondary" onClick={failOnce} disabled={busy}>다음 반영 실패 시연</button><p className="mo-section-hint">다음 동작을 실패 처리해 입력 유지와 재시도를 확인해요.</p><button className="mo-secondary" onClick={reset} disabled={busy}>샘플 처음으로</button><small>현재 화면의 샘플 상태만 초기화해요. 운영 데이터·인증·저장소에는 접근하지 않아요.</small></div>;
}
