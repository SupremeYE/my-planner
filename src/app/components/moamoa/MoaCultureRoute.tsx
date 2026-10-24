import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Film, Plus, Search } from 'lucide-react';
import type { CultureRecord, CultureStatus } from '../../store';
import { useCultureRecords } from '../../hooks/useCultureRecords';
import { cultureStatusLabels, filterCultureRecords, safeCultureUrl, type CultureFilter } from '../../../lib/cultureRecords';
import { CONTENT_TYPE_META, CONTENT_TYPE_ORDER, PLATFORM_META, PLATFORM_ORDER, SORT_LABELS } from '../culture/cultureMeta';
import { MoaFrame } from './MoaFrame';
import { MoaDialog } from './MoaDialog';
import { CultureEditor } from './culture/CultureEditor';
import { CultureImage } from './culture/CultureImage';
import { CultureSaveFeedback } from './culture/CultureSaveFeedback';
import './todos.css';
import './culture/culture.css';

const defaultFilter: CultureFilter = {search: '', status: 'all', type: 'all', platform: 'all', sort: 'created'};
export function Component() {
  const controller = useCultureRecords();
  const [filter, setFilter] = useState(defaultFilter), [notice, setNotice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editor, setEditor] = useState<{record?: CultureRecord} | null>(null);
  const [detail, setDetail] = useState<string | null>(null), [deleting, setDeleting] = useState<CultureRecord | null>(null);
  const attemptedDelete = useRef(false);
  const selected = controller.records.find(r => r.id === detail);
  const deleteState = controller.states.find(s => s.key === `culture:${deleting?.id}`);
  const records = filterCultureRecords(controller.records, filter);
  useEffect(() => {
    if (deleting && attemptedDelete.current && deleteState?.status === 'saved') {
      setDeleting(null); setDetail(null); setNotice('기록 삭제를 확인했어요. 이미지 원본은 그대로 보관해요.');
    }
  }, [deleting, deleteState?.status]);
  function openDelete(record: CultureRecord) {attemptedDelete.current = false; setDetail(null); setDeleting(record);}
  function closeDelete() {
    if (deleteState?.status === 'saving') return;
    if (deleteState?.status === 'error' && deleting) {controller.dismiss(deleting.id); void controller.refresh();}
    setDeleting(null);
  }
  const set = <K extends keyof CultureFilter>(key: K, value: CultureFilter[K]) => setFilter(v => ({...v, [key]: value}));
  const saved = (record: CultureRecord) => {setEditor(null); setFilter(defaultFilter); setDetail(record.id); setNotice('문화 기록을 저장했어요.');};
  return <MoaFrame pageTitle="문화 기록" onQuick={() => setEditor({})} quickDisabled={controller.loading}>
    <div className="mc-page">
      <header className="mx-page-heading"><div><p className="mt-eyebrow">MOMENTS WORTH KEEPING</p><h1>문화 기록</h1><p>보고 느낀 순간들을 모아두는 공간</p></div><button className="mx-primary" disabled={controller.loading} onClick={() => setEditor({})}><Plus size={18}/>문화 기록</button></header>
      <div className="mc-section-label"><span><Film size={17}/>영상</span><Link to="/culture">기존 문화·음악 화면 →</Link><Link to="/books">독서 →</Link></div>
      <div className="mc-tabs" role="group" aria-label="감상 상태 필터"><button aria-pressed={filter.status === 'all'} onClick={() => set('status', 'all')}>전체</button>{Object.entries(cultureStatusLabels).map(([value, label]) => <button key={value} aria-pressed={filter.status === value} onClick={() => set('status', value as CultureStatus)}>{label}</button>)}</div>
      <div className="mc-tabs mc-types" role="group" aria-label="콘텐츠 필터"><button aria-pressed={filter.type === 'all'} onClick={() => set('type', 'all')}>전체</button>{['movie', 'drama', 'youtube_video'].map(type => <button key={type} aria-pressed={filter.type === type} onClick={() => set('type', type as CultureFilter['type'])}>{type === 'youtube_video' ? 'YouTube' : CONTENT_TYPE_META[type as 'movie' | 'drama'].label}</button>)}</div>
      <div className="mc-toolbar"><label className="mc-find"><Search size={17}/><input aria-label="제목·태그 검색" placeholder="제목·태그 검색" value={filter.search} onChange={e => set('search', e.target.value)}/></label><button className="mc-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}>필터·정렬{filter.platform !== 'all' || !['all', 'movie', 'drama', 'youtube_video'].includes(filter.type) ? ' · 적용 중' : ''}</button></div>
      {filtersOpen && <div className="mc-filter-panel">
        <div className="mc-fields"><label>플랫폼<select aria-label="플랫폼 필터" value={filter.platform} onChange={e => set('platform', e.target.value as CultureFilter['platform'])}><option value="all">전체 플랫폼</option>{PLATFORM_ORDER.map(key => <option key={key} value={key}>{PLATFORM_META[key].label}</option>)}</select></label><label>정렬<select aria-label="문화 기록 정렬" value={filter.sort} onChange={e => set('sort', e.target.value as CultureFilter['sort'])}>{Object.entries(SORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <details className="mc-legacy-types"><summary>기존 콘텐츠 유형 더 보기</summary><div className="mc-tabs" role="group" aria-label="기존 콘텐츠 필터">{CONTENT_TYPE_ORDER.filter(key => !['movie', 'drama', 'youtube_video'].includes(key)).map(key => <button key={key} aria-pressed={filter.type === key} onClick={() => set('type', key)}>{CONTENT_TYPE_META[key].label}</button>)}</div></details>
      </div>}
      {controller.readError && <div className="mc-read-error" role="alert"><p>{controller.readError}</p><button onClick={() => void controller.refresh()}>문화 기록 다시 불러오기</button></div>}
      {controller.loading ? <p role="status" className="mc-empty">문화 기록을 불러오고 있어요.</p> : <>
        <p className="mc-count">{records.length}개의 기록</p>
        {!records.length ? <div className="mc-empty mt-card"><Film size={28}/><h2>{controller.readError ? '기록 확인이 필요해요' : controller.records.length ? '조건에 맞는 기록이 없어요' : '첫 감상 기록을 남겨보세요'}</h2><p>{controller.readError ? '다시 불러오면 기존 기록을 확인할 수 있어요.' : '작품명 한 줄이면 충분해요.'}</p>{controller.records.length > 0 && <button onClick={() => setFilter(defaultFilter)}>필터 초기화</button>}</div>
          : <div className="mc-grid">{records.map(record => {
            const state = controller.states.find(s => s.key === `culture:${record.id}`);
            const locked = state?.status === 'saving' || state?.status === 'error';
            return <article className="mc-card mt-card" key={record.id} data-culture-id={record.id}>
              <button className={`mc-poster ${record.contentType === 'youtube_video' ? 'mc-video' : ''}`} aria-label={`${record.title} 상세 보기`} onClick={() => setDetail(record.id)}><CultureImage url={record.thumbnailUrl} title={record.title}/></button>
              <div className="mc-card-content"><div className="mc-card-meta"><small>{CONTENT_TYPE_META[record.contentType]?.label ?? record.contentType}</small><span className="mc-status">{cultureStatusLabels[record.status] ?? record.status}</span></div><h2 title={record.title}>{record.title}</h2><p className="mc-card-facts">{PLATFORM_META[record.platform]?.label ?? record.platform}{record.rating != null && <span aria-label={`별점 ${record.rating}점`}>★ {record.rating}</span>}{record.watchedDate && <time>{record.watchedDate}</time>}</p>{record.review && <p className="mc-review-preview">{record.review}</p>}
                <div className="mc-card-actions"><button onClick={() => setDetail(record.id)}>상세 보기</button><button aria-label={`${record.title} 수정`} disabled={locked} onClick={() => setEditor({record})}>수정</button><button aria-label={`${record.title} 삭제`} disabled={locked} onClick={() => openDelete(record)}>삭제</button></div>
                <label className="mc-quick-status">상태 변경<select aria-label={`${record.title} 상태 변경`} value={record.status} disabled={locked} onChange={e => void controller.save({...record, status: e.target.value as CultureStatus}, record)}>{Object.entries(cultureStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <CultureSaveFeedback state={state} onRetry={() => void controller.retry(record.id)} onEdit={() => {controller.dismiss(record.id); void controller.refresh();}}/>
              </div>
            </article>;
          })}</div>}
      </>}
      <p className="mc-notice" role="status">{notice}</p>
      {editor && <CultureEditor key={editor.record?.id ?? 'new'} record={editor.record} controller={controller} onClose={() => setEditor(null)} onSaved={saved}/>}
      {selected && <CultureDetail record={selected} onClose={() => setDetail(null)} onEdit={() => {setDetail(null); setEditor({record: selected});}} onDelete={() => openDelete(selected)}/>}
      {deleting && <MoaDialog title="문화 기록 삭제" description="이 기록만 삭제해요. 포스터·썸네일 원본 파일은 삭제하지 않아요." onClose={closeDelete} saveKeys={[]} footer={<><CultureSaveFeedback state={deleteState} onRetry={() => void controller.retry(deleting.id)}/><div className="mx-actions"><button disabled={deleteState?.status === 'saving'} onClick={closeDelete}>취소</button><button className="mx-primary" disabled={deleteState?.status === 'saving' || deleteState?.status === 'error'} onClick={() => {attemptedDelete.current = true; void controller.remove(deleting.id);}}>삭제 확인</button></div></>}><h2 className="mc-detail-title">{deleting.title}</h2><p>삭제를 확인한 뒤 목록에서 지워요.</p></MoaDialog>}
    </div>
  </MoaFrame>;
}

function CultureDetail({record: r, onClose, onEdit, onDelete}: {record: CultureRecord; onClose: () => void; onEdit: () => void; onDelete: () => void}) {
  const [retry, setRetry] = useState(0);
  const link = safeCultureUrl(r.url);
  return <MoaDialog title="문화 기록 상세" description={`${CONTENT_TYPE_META[r.contentType]?.label ?? r.contentType} · ${cultureStatusLabels[r.status] ?? r.status}`} onClose={onClose} saveKeys={[]} footer={<div className="mx-actions"><button onClick={onClose}>닫기</button><button onClick={onEdit}>수정</button><button className="mx-primary" onClick={onDelete}>삭제</button></div>}>
    <div className="mc-detail-image"><CultureImage url={r.thumbnailUrl} title={r.title} retry={retry}/></div>{r.thumbnailUrl && <button className="mc-retry-image" onClick={() => setRetry(v => v + 1)}>이미지 다시 불러오기</button>}
    <h2 className="mc-detail-title">{r.title}</h2><p className="mc-detail-facts">{PLATFORM_META[r.platform]?.label ?? r.platform}{r.rating != null && ` · ★ ${r.rating}점`}{r.watchedDate && ` · ${r.watchedDate}`}</p>
    {r.review && <section className="mc-detail-note"><h3>짧은 감상평</h3><p>{r.review}</p></section>}{r.insight && <section className="mc-detail-note"><h3>기억에 남는 내용</h3><p>{r.insight}</p></section>}
    <div className="mc-tags">{r.tags.map((tag, i) => <span key={`${tag}:${i}`}>#{tag}</span>)}</div>
    {link && <a className="mc-external-link" href={link} target="_blank" rel="noopener noreferrer">작품 URL 열기 ↗</a>}
  </MoaDialog>;
}
