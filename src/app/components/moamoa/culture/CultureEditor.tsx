import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CultureRecord } from '../../../store';
import type { CultureController } from '../../../hooks/useCultureRecords';
import { applyCultureSuggestion } from '../../../../lib/cultureMetadata';
import { cultureStatusLabels } from '../../../../lib/cultureRecords';
import { saveIntent } from '../../../../lib/saveCoordinator';
import { CONTENT_TYPE_META, CONTENT_TYPE_ORDER, PLATFORM_META, PLATFORM_ORDER } from '../../culture/cultureMeta';
import { MoaDialog } from '../MoaDialog';
import { CultureImage } from './CultureImage';
import { CultureMetadataSearch } from './CultureMetadataSearch';
import { CultureSaveFeedback } from './CultureSaveFeedback';

export function CultureEditor({record, controller, onClose, onSaved}: {
  record?: CultureRecord; controller: CultureController; onClose: () => void; onSaved: (record: CultureRecord) => void;
}) {
  const [initial] = useState<CultureRecord>(() => record ? structuredClone(record) : {
    id: crypto.randomUUID(), title: '', contentType: 'movie', platform: 'other', status: 'completed',
    tags: [], externalSource: 'manual', externalId: null,
  });
  const [draft, setDraft] = useState(initial), [options, setOptions] = useState(!!record);
  const [tagText, setTagText] = useState(initial.tags.join(', '));
  const touched = useRef(new Set<keyof CultureRecord>(record ? ['contentType', 'platform'] : []));
  const submitting = useRef(false), attempted = useRef(false), done = useRef(false);
  const state = controller.states.find(s => s.key === `culture:${initial.id}`);
  const busy = state?.status === 'saving', locked = busy || state?.status === 'error';
  const title = record ? '문화 기록 수정' : '문화 기록 추가';
  const dirty = saveIntent(draft) !== saveIntent(initial) || tagText !== initial.tags.join(', ');
  useEffect(() => {
    if (attempted.current && !done.current && state?.status === 'saved') {
      const saved = controller.records.find(r => r.id === initial.id);
      if (saved) { done.current = true; onSaved(saved); }
    }
  }, [state?.status, controller.records, initial.id, onSaved]);
  function change<K extends keyof CultureRecord>(key: K, value: CultureRecord[K]) {
    touched.current.add(key); setDraft(previous => ({...previous, [key]: value}));
  }
  function close() {
    if (busy || submitting.current) return;
    if ((dirty || state?.status === 'error') && !window.confirm(state?.status === 'error'
      ? '저장 결과가 불확실해요. 재시도를 권해요. 입력을 닫고 목록을 다시 확인할까요?'
      : '저장하지 않은 문화 기록 입력을 닫을까요?')) return;
    if (state?.status === 'error') {controller.dismiss(initial.id); void controller.refresh();}
    onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked || submitting.current || !draft.title.trim()) return;
    submitting.current = true; attempted.current = true;
    const value = {...draft, title: touched.current.has('title') || !record ? draft.title.trim() : draft.title,
      tags: touched.current.has('tags') ? [...new Set(tagText.split(',').map(t => t.trim()).filter(Boolean))] : draft.tags};
    try { await controller.save(value, record ? initial : undefined); }
    finally {submitting.current = false;}
  }
  return <MoaDialog title={title} description="작품명만으로도 남길 수 있어요. 나머지는 천천히 채워주세요." onClose={close} saveKeys={[]}
    footer={<><CultureSaveFeedback state={state} onRetry={() => void controller.retry(initial.id)} onEdit={() => controller.dismiss(initial.id)}/><div className="mx-actions"><button type="button" disabled={busy} onClick={close}>취소</button><button type="submit" form="moa-culture-form" className="mx-primary" disabled={locked || !draft.title.trim()}>{busy ? '저장 중…' : '저장'}</button></div></>}>
    <form id="moa-culture-form" className="mc-form" onSubmit={submit}>
      <CultureMetadataSearch disabled={!!locked} onSelect={suggestion => setDraft(value => applyCultureSuggestion(value, suggestion, touched.current))}/>
      {draft.thumbnailUrl && <div className="mc-editor-poster"><CultureImage url={draft.thumbnailUrl} title={draft.title}/></div>}
      <label>작품명 <small>필수</small><input autoFocus aria-label="작품명" required placeholder="오늘 마음에 남은 작품" value={draft.title} readOnly={locked} onChange={e => change('title', e.target.value)}/></label>
      <div className="mc-fields"><label>콘텐츠 유형<select aria-label="콘텐츠 유형" value={draft.contentType} disabled={locked} onChange={e => change('contentType', e.target.value as CultureRecord['contentType'])}>
        {CONTENT_TYPE_ORDER.filter(key => ['movie', 'drama', 'youtube_video'].includes(key) || key === initial.contentType).map(key => <option key={key} value={key}>{key === 'youtube_video' ? 'YouTube' : CONTENT_TYPE_META[key].label}</option>)}
      </select></label><label>감상 상태<select aria-label="감상 상태" value={draft.status} disabled={locked} onChange={e => change('status', e.target.value as CultureRecord['status'])}>{Object.entries(cultureStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <button type="button" className="mc-options-toggle" aria-expanded={options} onClick={() => setOptions(v => !v)}>플랫폼·별점·감상평 {options ? '접기' : '추가'}</button>
      {options && <>
        <div className="mc-fields"><label>플랫폼<select aria-label="플랫폼" value={draft.platform} disabled={locked} onChange={e => change('platform', e.target.value as CultureRecord['platform'])}>{PLATFORM_ORDER.map(key => <option key={key} value={key}>{key === 'other' ? '미지정 / 기타' : PLATFORM_META[key].label}</option>)}</select></label><label>감상 날짜<input aria-label="감상 날짜" type="date" value={draft.watchedDate ?? ''} readOnly={locked} onChange={e => change('watchedDate', e.target.value || null)}/></label></div>
        <label>별점<select aria-label="별점" disabled={locked} value={draft.rating == null ? '' : String(draft.rating)} onChange={e => change('rating', e.target.value === '' ? null : Number(e.target.value))}><option value="">기록 안 함</option>{Array.from({length: 11}, (_, i) => i / 2).map(value => <option value={value} key={value}>{value}점</option>)}</select></label>
        <label>짧은 감상평<textarea aria-label="짧은 감상평" placeholder="어떤 순간이 좋았나요?" value={draft.review ?? ''} readOnly={locked} onChange={e => change('review', e.target.value || null)}/></label>
        <label>기억에 남는 내용<textarea aria-label="기억에 남는 내용" value={draft.insight ?? ''} readOnly={locked} onChange={e => change('insight', e.target.value || null)}/></label>
        <label>태그<input aria-label="태그" placeholder="쉼, 주말, 다시 보고 싶은 (쉼표로 구분)" value={tagText} readOnly={locked} onChange={e => {touched.current.add('tags'); setTagText(e.target.value);}}/></label>
        <label>작품 URL<input aria-label="작품 URL" type="text" inputMode="url" placeholder="https://" value={draft.url ?? ''} readOnly={locked} onChange={e => change('url', e.target.value || null)}/></label>
        <label>포스터·썸네일 URL<input aria-label="포스터·썸네일 URL" type="text" inputMode="url" placeholder="선택 사항" value={draft.thumbnailUrl ?? ''} readOnly={locked} onChange={e => change('thumbnailUrl', e.target.value || null)}/></label>
      </>}
      <p className="mc-help">검색 없이 직접 저장할 수 있어요. 이미 적은 감상과 이미지는 자동으로 덮어쓰지 않아요.</p>
    </form>
  </MoaDialog>;
}
