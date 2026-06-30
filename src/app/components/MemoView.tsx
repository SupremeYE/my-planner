import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { usePlanner, type Memo } from '../store';
import { useTheme } from '../ThemeContext';
import { useMemos } from '../hooks/useMemos';
import ConfirmModal from './ConfirmModal';

// 메모 페이지 (일간 리디자인 Stage 5) — 작성/수정/삭제/"확인" 처리/태그 필터.
// 모바일: 입력·필터 상단 스택 → 목록. PC(lg:): 좌 320px(입력+필터 sticky) + 우 목록 2단.
const fmtDate = (d: string | null): string => {
  if (!d) return '날짜 없음';
  const parts = d.split('-');
  if (parts.length < 3) return d;
  return `${Number(parts[1])}월 ${Number(parts[2])}일`;
};

export function MemoView() {
  const { t } = useTheme();
  const { tags } = usePlanner();
  const { memos, addMemo, updateMemo, toggleConfirmed, deleteMemo } = useMemos();

  const [draft, setDraft] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null); // null = 전체
  const [hideConfirmed, setHideConfirmed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null);

  const tagById = useMemo(() => Object.fromEntries(tags.map(tg => [tg.id, tg])), [tags]);

  const visible = useMemo(
    () => memos.filter(m => {
      if (filterTag && !m.tags.includes(filterTag)) return false;
      if (hideConfirmed && m.confirmed) return false;
      return true;
    }),
    [memos, filterTag, hideConfirmed],
  );

  const toggleIn = (arr: string[], id: string, set: (v: string[]) => void) =>
    set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  const submit = () => {
    if (!draft.trim()) return;
    addMemo(draft, { tags: draftTags });
    setDraft('');
    setDraftTags([]);
  };
  const startEdit = (m: Memo) => { setEditingId(m.id); setEditText(m.content); setEditTags(m.tags); };
  const saveEdit = () => {
    if (editingId && editText.trim()) updateMemo(editingId, { content: editText.trim(), tags: editTags });
    setEditingId(null);
  };

  const TagToggle = ({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tg => {
        const on = selected.includes(tg.id);
        return (
          <button key={tg.id} type="button" onClick={() => onToggle(tg.id)}
            className="px-2.5 py-1 rounded-full transition-all"
            style={{ fontSize: 11, fontWeight: on ? 700 : 500, backgroundColor: on ? `${tg.color}22` : t.bgSub, color: on ? tg.color : t.textSub, border: `1.5px solid ${on ? tg.color : t.border}` }}>
            {tg.name}
          </button>
        );
      })}
      {tags.length === 0 && <span style={{ fontSize: 11, color: t.textMuted }}>태그가 없습니다 (설정에서 추가)</span>}
    </div>
  );

  const inputPanel = (
    <div className="rounded-2xl p-3 lg:p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="메모를 적어두세요…" rows={3}
        className="w-full resize-none rounded-xl px-3 py-2 outline-none"
        style={{ fontSize: 13, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }} />
      <div className="mt-2"><TagToggle selected={draftTags} onToggle={id => toggleIn(draftTags, id, setDraftTags)} /></div>
      <button type="button" onClick={submit} disabled={!draft.trim()}
        className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all"
        style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: draft.trim() ? t.accent : t.border, cursor: draft.trim() ? 'pointer' : 'default' }}>
        <Plus size={15} /> 메모 추가
      </button>
    </div>
  );

  const filterPanel = (
    <div className="rounded-2xl p-3 lg:p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub }}>태그 필터</span>
        <button type="button" onClick={() => setHideConfirmed(v => !v)} style={{ fontSize: 11, fontWeight: 600, color: hideConfirmed ? t.accent : t.textMuted }}>
          {hideConfirmed ? '확인한 메모 숨김 ✓' : '확인한 메모 표시'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setFilterTag(null)} className="px-2.5 py-1 rounded-full transition-all"
          style={{ fontSize: 11, fontWeight: filterTag === null ? 700 : 500, backgroundColor: filterTag === null ? t.accent : t.bgSub, color: filterTag === null ? '#fff' : t.textSub, border: `1.5px solid ${filterTag === null ? t.accent : t.border}` }}>
          전체
        </button>
        {tags.map(tg => {
          const on = filterTag === tg.id;
          return (
            <button key={tg.id} type="button" onClick={() => setFilterTag(on ? null : tg.id)} className="px-2.5 py-1 rounded-full transition-all"
              style={{ fontSize: 11, fontWeight: on ? 700 : 500, backgroundColor: on ? `${tg.color}22` : t.bgSub, color: on ? tg.color : t.textSub, border: `1.5px solid ${on ? tg.color : t.border}` }}>
              {tg.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderCard = (m: Memo) => {
    const editing = editingId === m.id;
    return (
      <div key={m.id} className="rounded-2xl p-3" style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, opacity: m.confirmed && !editing ? 0.6 : 1 }}>
        {editing ? (
          <>
            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
              className="w-full resize-none rounded-xl px-3 py-2 outline-none"
              style={{ fontSize: 13, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }} />
            <div className="mt-2"><TagToggle selected={editTags} onToggle={id => toggleIn(editTags, id, setEditTags)} /></div>
            <div className="flex gap-3 mt-2 justify-end">
              <button type="button" onClick={() => setEditingId(null)} style={{ fontSize: 12, color: t.textMuted }}>취소</button>
              <button type="button" onClick={saveEdit} style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>저장</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => toggleConfirmed(m.id)}
                className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                style={{ border: m.confirmed ? 'none' : `2px solid ${t.border}`, backgroundColor: m.confirmed ? t.checkDone : 'transparent' }}
                title={m.confirmed ? '확인 취소' : '확인'} aria-label={m.confirmed ? '확인 취소' : '확인'}>
                {m.confirmed && <Check size={11} color="#fff" strokeWidth={3} />}
              </button>
              <p className="flex-1 min-w-0" style={{ fontSize: 13, color: t.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textDecoration: m.confirmed ? 'line-through' : 'none' }}>
                {m.content}
              </p>
              <div className="flex gap-1 flex-shrink-0">
                <button type="button" onClick={() => startEdit(m)} className="p-1.5 rounded-lg" style={{ color: t.textMuted, backgroundColor: t.bgSub }} title="수정"><Pencil size={13} /></button>
                <button type="button" onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg" style={{ color: t.danger, backgroundColor: t.bgSub }} title="삭제"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap pl-7">
              {m.date && <span style={{ fontSize: 10, color: t.textMuted }}>{fmtDate(m.date)}</span>}
              {m.tags.map(id => {
                const tg = tagById[id];
                if (!tg) return null;
                return <span key={id} className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 600, backgroundColor: `${tg.color}1A`, color: tg.color }}>{tg.name}</span>;
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="relative" style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: t.bg }}>
      <div className="px-3 py-3 lg:px-4 lg:py-4 flex-shrink-0" style={{ backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2">
          <StickyNote size={18} color={t.accent} />
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>메모</span>
          <span style={{ fontSize: 12, color: t.textMuted }}>{visible.length}개</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 lg:px-4 lg:py-4" style={{ minHeight: 0 }}>
        <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-4">
          <div className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
            {inputPanel}
            {filterPanel}
          </div>
          <div className="flex flex-col gap-2 mt-3 lg:mt-0">
            {visible.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: t.card, border: `1px dashed ${t.border}`, color: t.textMuted, fontSize: 13 }}>
                {memos.length === 0 ? '아직 메모가 없어요. 왼쪽에서 첫 메모를 남겨보세요.' : '조건에 맞는 메모가 없어요.'}
              </div>
            ) : visible.map(renderCard)}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message="메모를 삭제할까요?"
          description={deleteTarget.content.slice(0, 60)}
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { deleteMemo(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
