import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { usePlanner, type Tag } from '../../store';
import { TIME_TAG_SUGGESTIONS } from '../../../lib/moaTodos';
import { DEFAULT_TAG_COLORS } from '../../../lib/tagPalette';
import { MoaDialog } from './MoaDialog';
export function MoaTagManager({ onClose, initialName = '', timeCategory = false }: { onClose: () => void; initialName?: string; timeCategory?: boolean }) {
  const { tags, saveStates, createTagConfirmed, editTagConfirmed, removeTagConfirmed } = usePlanner();
  const [draft, setDraft] = useState({ id: crypto.randomUUID(), name: initialName, color: '#506c4c', trackTime: timeCategory, edit: false });
  const [search, setSearch] = useState(''); const [attempted, setAttempted] = useState(false); const [message, setMessage] = useState('');
  const busyRef = useRef(false); const formRef = useRef<HTMLFormElement>(null);
  const state = saveStates.find(s => s.key === `tags:${draft.id}`);
  const busy = saveStates.some(s => s.key.startsWith('tags:') && s.status === 'saving');
  const locked = busy || state?.status === 'error';
  useEffect(() => { if (attempted && state?.status === 'saved') { setMessage('태그를 저장했어요.'); setAttempted(false); setDraft({ id: crypto.randomUUID(), name: '', color: '#506c4c', trackTime: false, edit: false }); } }, [state?.status, attempted]);
  function close() {
    if (busy) return;
    const original = tags.find(tag => tag.id === draft.id);
    const dirty = draft.edit ? !!original && (original.name !== draft.name || original.color !== draft.color || original.trackTime !== draft.trackTime) : !!draft.name.trim();
    if (dirty && !window.confirm('저장하지 않은 태그 입력을 닫을까요?')) return;
    onClose();
  }
  function fresh(name = '', trackTime = false) { setDraft({ id: crypto.randomUUID(), name, color: '#506c4c', trackTime, edit: false }); setAttempted(false); setMessage(''); formRef.current?.scrollIntoView({ block: 'nearest' }); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busyRef.current || locked || !draft.name.trim()) return;
    busyRef.current = true; setAttempted(true); setMessage('');
    try { const { id, edit, ...value } = draft; if (edit) await editTagConfirmed(id, value); else await createTagConfirmed(value, id); }
    finally { busyRef.current = false; }
  }
  function edit(tag: Tag) { setDraft({ ...tag, edit: true }); setAttempted(false); setMessage(''); formRef.current?.scrollIntoView({ block: 'nearest' }); }
  return <MoaDialog title="태그 관리" description="시간 카테고리와 일반 태그를 구분해요. 사용 중인 태그는 과거 기록 보호를 위해 삭제·용도 변경을 막아요." onClose={close} saveKeys={saveStates.filter(s => s.key.startsWith('tags:')).map(s => s.key)} footer={<div className="mx-actions"><button onClick={close} disabled={busy}>돌아가기</button><button type="submit" form="moa-tag-form" className="mx-primary" disabled={locked || !draft.name.trim()}>{busy ? '저장 중…' : '태그 저장'}</button></div>}>
    <div className="mx-section-head"><h3>내 태그</h3><button onClick={() => fresh()} disabled={busy}><Plus size={16} />새 태그</button></div>
    <input aria-label="관리할 태그 검색" placeholder="태그 검색" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="mx-manage-list">{tags.filter(tag => tag.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(tag => <div key={tag.id} data-tag-id={tag.id}><span className="mx-color-dot" style={{ background: tag.color }} /><div><strong>{tag.name}</strong><small>{tag.trackTime ? '시간 카테고리' : '일반 태그'}</small></div><button disabled={busy} onClick={() => edit(tag)} aria-label={`${tag.name} 태그 수정`}><Pencil size={17} /></button><button disabled={busy} aria-label={`${tag.name} 태그 삭제`} onClick={async () => { if (!window.confirm(`“${tag.name}” 태그를 삭제할까요? 사용 중이면 과거 기록 보호를 위해 삭제하지 않아요.`)) return; if (await removeTagConfirmed(tag.id)) setMessage('태그를 삭제했어요.'); }}><Trash2 size={17} /></button></div>)}</div>
    {!tags.length && <p className="mx-help">등록한 태그가 없어요. 필요한 태그부터 하나씩 만들어보세요.</p>}
    <form id="moa-tag-form" ref={formRef} onSubmit={save} className="mx-tag-form"><h3>{draft.edit ? '태그 수정' : '새 태그'}</h3><label>태그명<input aria-label="태그명" required value={draft.name} readOnly={locked} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label><label>태그 용도<select aria-label="태그 용도" value={draft.trackTime ? 'time' : 'normal'} disabled={locked} onChange={e => setDraft(d => ({ ...d, trackTime: e.target.value === 'time' }))}><option value="normal">일반 보조 태그</option><option value="time">시간 카테고리</option></select></label>
      <label>태그 색상<input aria-label="태그 색상" type="color" value={draft.color} disabled={locked} onChange={e => setDraft(d => ({ ...d, color: e.target.value }))} /></label><div className="mx-palette">{DEFAULT_TAG_COLORS.slice(0, 8).map(color => <button type="button" key={color} aria-label={`색상 ${color}`} disabled={locked} onClick={() => setDraft(d => ({ ...d, color }))}><span style={{ background: color }} /></button>)}</div>
    </form>
    {!draft.edit && <div className="mx-suggestions"><p className="mx-help">추천 시간 카테고리 · 눌러 이름을 채운 뒤 저장해주세요.</p>{TIME_TAG_SUGGESTIONS.filter(name => !tags.some(tag => tag.name === name)).map(name => <button key={name} onClick={() => fresh(name, true)} disabled={busy}>{name}</button>)}</div>}
    <p role="status" className="mx-help">{message}</p>
  </MoaDialog>;
}
