import { useEffect, useRef, useState } from 'react';
import { Music2, Plus } from 'lucide-react';
import { filterMusic, type MusicEntry } from '../../../lib/musicRecords';
import { safeCultureUrl } from '../../../lib/cultureRecords';
import { useMusicRecords } from '../../hooks/useMusicRecords';
import { MOOD_OPTIONS } from '../music/musicMoods';
import { MoaFrame } from './MoaFrame';
import { MoaDialog } from './MoaDialog';
import { MusicEditor } from './music/MusicEditor';
import { MusicDetail } from './music/MusicDetail';
import { CultureSaveFeedback } from './culture/CultureSaveFeedback';
import './todos.css';
import './culture/culture.css';
import './music/music.css';

function Artwork({record:r}:{record:MusicEntry}) {
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[r.artworkUrl]);
  return safeCultureUrl(r.artworkUrl)&&!failed?<img src={r.artworkUrl!} alt={`${r.trackTitle} 앨범아트`} loading="lazy" onError={()=>setFailed(true)}/>:<span className="mc-image-fallback" role="img" aria-label={r.artworkUrl?'앨범 이미지를 불러오지 못했어요':'앨범 이미지 없음'}><Music2 size={30}/><small>음악이 머문 자리</small></span>;
}
export function Component(){
  const controller=useMusicRecords();
  const [search,setSearch]=useState(''),[mood,setMood]=useState('all'),[sort,setSort]=useState('created'),[date,setDate]=useState('');
  const [filters,setFilters]=useState(false),[editor,setEditor]=useState<{record?:MusicEntry}|null>(null),[detail,setDetail]=useState<string|null>(null),[deleting,setDeleting]=useState<MusicEntry|null>(null),[notice,setNotice]=useState('');
  const attemptedDelete=useRef(false),deleteState=controller.states.find(s=>s.key===`music:${deleting?.id}`);
  useEffect(()=>{if(attemptedDelete.current&&deleteState?.status==='saved'){attemptedDelete.current=false;setDeleting(null);setDetail(null);setNotice('음악 기록을 삭제했어요. 미디어 원본은 유지해요.');}},[deleteState?.status]);
  const selected=controller.records.find(r=>r.id===detail),records=filterMusic(controller.records,search,mood,sort,date);
  function closeDelete(){if(deleteState?.status==='saving')return;if(deleteState?.status==='error'){controller.dismiss(deleting!.id);void controller.refresh();}attemptedDelete.current=false;setDeleting(null);}
  return <MoaFrame pageTitle="음악 기록" onQuick={()=>setEditor({})} quickDisabled={controller.loading||!!controller.readError}><div className="mc-page mm-page">
    <div className="mx-page-heading"><div><p className="mt-eyebrow">MUSIC DIARY</p><h1>음악 기록</h1><p>오늘 마음에 머문 음악을 모아요.</p></div><button className="mx-primary" disabled={controller.loading||!!controller.readError} onClick={()=>setEditor({})}><Plus size={18}/>음악 기록</button></div>
    <div className="mc-toolbar"><label className="mc-find"><input aria-label="음악 검색" placeholder="곡명·아티스트·무드 검색" value={search} onChange={e=>setSearch(e.target.value)}/></label><button aria-expanded={filters} onClick={()=>setFilters(v=>!v)}>날짜·정렬</button></div>
    <div className="mc-tabs" role="group" aria-label="무드 필터">{['all',...new Set([...MOOD_OPTIONS,...controller.records.flatMap(r=>r.mood)])].map(m=><button key={m} aria-pressed={mood===m} onClick={()=>setMood(m)}>{m==='all'?'전체':m}</button>)}</div>
    {filters&&<div className="mc-filter-panel mc-form"><div className="mc-fields"><label>들은 날짜 필터<input aria-label="들은 날짜 필터" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>정렬<select aria-label="음악 정렬" value={sort} onChange={e=>setSort(e.target.value)}><option value="created">최근 등록순</option><option value="listened">들은 날짜순</option><option value="title">곡명순</option></select></label></div><button onClick={()=>{setSearch('');setDate('');setMood('all');setSort('created');}}>필터 초기화</button></div>}
    {controller.readError&&<div role="alert" className="mc-read-error"><p>{controller.readError}</p><button onClick={()=>void controller.refresh()}>음악 기록 다시 불러오기</button></div>}
    {controller.loading?<p role="status" className="mc-empty">음악 기록을 불러오고 있어요.</p>:<><p className="mc-count">{records.length}곡의 기억</p>{records.length?<div className="mm-grid">{records.map(r=><article className="mt-card mm-card" data-music-id={r.id} key={r.id}><button className="mm-artwork" aria-label={`${r.trackTitle} 상세 보기`} onClick={()=>setDetail(r.id)}><Artwork record={r}/></button><div className="mm-card-text"><h2>{r.trackTitle}</h2>{r.artist&&<p>{r.artist}</p>}<div className="mc-tags">{r.mood.map(m=><span key={m}>#{m}</span>)}</div>{r.listenedDate&&<time>{r.listenedDate}</time>}<button onClick={()=>setDetail(r.id)}>상세 보기</button></div></article>)}</div>:<div className="mc-empty mt-card"><Music2/><h2>{controller.readError?'기록 확인이 필요해요':controller.records.length?'조건에 맞는 음악이 없어요':'첫 음악을 남겨보세요'}</h2><p>곡명 한 줄이면 충분해요.</p></div>}</>}
    <p className="mc-notice" role="status">{notice}</p>
    {editor&&<MusicEditor record={editor.record} controller={controller} onClose={()=>setEditor(null)} onSaved={r=>{setEditor(null);setDetail(r.id);setNotice('음악 기록 저장을 확인했어요.');}}/>}
    {selected&&!editor&&!deleting&&<MusicDetail key={selected.id} record={selected} controller={controller} onClose={()=>setDetail(null)} onEdit={()=>setEditor({record:selected})} onDelete={()=>setDeleting(selected)}/>}
    {deleting&&<MoaDialog title="음악 기록 삭제" description="이 기록만 삭제해요. 앨범아트와 오디오 원본은 삭제하지 않아요." saveKeys={[]} onClose={closeDelete} footer={<><CultureSaveFeedback state={deleteState} onRetry={()=>void controller.retry(deleting.id)} onEdit={()=>controller.dismiss(deleting.id)}/><div className="mx-actions"><button disabled={deleteState?.status==='saving'} onClick={closeDelete}>취소</button><button className="mx-primary" disabled={deleteState?.status==='saving'||deleteState?.status==='error'} onClick={()=>{attemptedDelete.current=true;void controller.remove(deleting.id);}}>삭제 확인</button></div></>}><h2 className="mc-detail-title">{deleting.trackTitle}</h2></MoaDialog>}
  </div></MoaFrame>;
}
