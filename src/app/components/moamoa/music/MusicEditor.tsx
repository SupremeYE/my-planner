import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getLogicalToday } from '../../../store';
import { applyMusicSuggestion, type MusicEntry } from '../../../../lib/musicRecords';
import { searchMusic, type MusicSearchResult } from '../../../../lib/itunes';
import { saveIntent } from '../../../../lib/saveCoordinator';
import type { MusicController } from '../../../hooks/useMusicRecords';
import { MOOD_OPTIONS } from '../../music/musicMoods';
import { MoaDialog } from '../MoaDialog';
import { CultureSaveFeedback } from '../culture/CultureSaveFeedback';

export function MusicEditor({record,controller,onClose,onSaved}:{record?:MusicEntry;controller:MusicController;onClose:()=>void;onSaved:(r:MusicEntry)=>void}) {
  const [initial]=useState<MusicEntry>(()=>record ? structuredClone(record) : {id:crypto.randomUUID(),trackTitle:'',artist:'',mood:[],stickers:[],listenedDate:getLogicalToday()});
  const [draft,setDraft]=useState(initial),[options,setOptions]=useState(!!record);
  const [query,setQuery]=useState(''),[results,setResults]=useState<MusicSearchResult[]>([]),[searching,setSearching]=useState(false),[searchMessage,setSearchMessage]=useState('');
  const touched=useRef(new Set<keyof MusicEntry>()), searchVersion=useRef(0), attempted=useRef(false),done=useRef(false),submitting=useRef(false);
  const state=controller.states.find(s=>s.key===`music:${initial.id}`),busy=state?.status==='saving',locked=busy||state?.status==='error';
  useEffect(()=>()=>{searchVersion.current++;},[]);
  useEffect(()=>{if(attempted.current&&!done.current&&state?.status==='saved'){const saved=controller.records.find(r=>r.id===initial.id);if(saved){done.current=true;onSaved(saved);}}},[state?.status,controller.records,initial.id,onSaved]);
  function change<K extends keyof MusicEntry>(key:K,value:MusicEntry[K]) {touched.current.add(key);setDraft(r=>({...r,[key]:value}));}
  function close(){if(busy||submitting.current)return;if(saveIntent(initial)!==saveIntent(draft)&&!window.confirm('저장하지 않은 음악 입력을 닫을까요?'))return;if(state?.status==='error'){controller.dismiss(initial.id);void controller.refresh();}onClose();}
  async function search(){const version=++searchVersion.current;setSearching(true);setResults([]);setSearchMessage('');try{const rows=await searchMusic(query);if(version===searchVersion.current){setResults(rows);setSearchMessage(rows.length?'빈 항목만 채워요. 입력한 내용은 유지해요.':'검색 결과가 없어요. 직접 입력할 수 있어요.');}}catch{if(version===searchVersion.current)setSearchMessage('검색하지 못했어요. 직접 입력하거나 다시 검색해주세요.');}finally{if(version===searchVersion.current)setSearching(false);}}
  async function submit(e:FormEvent){e.preventDefault();if(locked||submitting.current||!draft.trackTitle.trim())return;submitting.current=true;attempted.current=true;searchVersion.current++;setSearching(false);try{await controller.save({...draft,trackTitle:touched.current.has('trackTitle')||!record?draft.trackTitle.trim():draft.trackTitle},record?initial:undefined);}finally{submitting.current=false;}}
  return <MoaDialog title={record?'음악 기록 수정':'음악 기록 추가'} description="곡명만으로 남겨도 좋아요. 검색과 나머지 정보는 선택이에요." onClose={close} saveKeys={[]} footer={<><CultureSaveFeedback state={state} onRetry={()=>void controller.retry(initial.id)} onEdit={()=>controller.dismiss(initial.id)}/><div className="mx-actions"><button disabled={busy} onClick={close}>취소</button><button form="music-form" type="submit" className="mx-primary" disabled={locked||!draft.trackTitle.trim()}>{busy?'저장 중…':'저장'}</button></div></>}>
    <form id="music-form" className="mc-form" onSubmit={submit}>
      <details className="mm-search"><summary>iTunes 곡 검색 · 선택 사항</summary><div className="mc-search-input"><label>검색어<input aria-label="iTunes 검색어" value={query} disabled={locked} onChange={e=>{searchVersion.current++;setSearching(false);setResults([]);setQuery(e.target.value);}}/></label><button type="button" disabled={locked||searching||!query.trim()} onClick={()=>void search()}>{searching?'검색 중…':'검색'}</button></div><p role="status" className="mc-help">{searchMessage}</p><div className="mc-search-results">{results.map((r,i)=><button className="mm-result" type="button" key={`${r.itunesTrackId}:${i}`} disabled={locked} onClick={()=>{setDraft(d=>applyMusicSuggestion(d,r,touched.current));setResults([]);setSearchMessage('곡 정보를 선택했어요. 입력을 확인해주세요.');}}>{r.trackTitle} · {r.artist}<small>{r.album}</small></button>)}</div></details>
      <label>곡명 · 필수<input autoFocus aria-label="곡명" required value={draft.trackTitle} readOnly={locked} onChange={e=>change('trackTitle',e.target.value)}/></label>
      <label>아티스트<input aria-label="아티스트" value={draft.artist} readOnly={locked} onChange={e=>change('artist',e.target.value)}/></label>
      <label>들은 날짜<input aria-label="들은 날짜" type="date" value={draft.listenedDate??''} readOnly={locked} onChange={e=>change('listenedDate',e.target.value||null)}/></label>
      <fieldset disabled={locked}><legend>무드·상황</legend><div className="mc-tabs">{[...new Set([...MOOD_OPTIONS,...draft.mood])].map(m=><button type="button" key={m} aria-pressed={draft.mood.includes(m)} onClick={()=>change('mood',draft.mood.includes(m)?draft.mood.filter(v=>v!==m):[...draft.mood,m])}>{m}</button>)}</div></fieldset>
      <label>메모<textarea aria-label="메모" value={draft.memo??''} readOnly={locked} onChange={e=>change('memo',e.target.value||null)}/></label>
      <button type="button" className="mc-options-toggle" aria-expanded={options} onClick={()=>setOptions(v=>!v)}>앨범·이미지·장르·듣기 링크 {options?'접기':'추가'}</button>
      {options&&<>{(['album','genre','artworkUrl','listenUrl'] as const).map((key,i)=><label key={key}>{['앨범','장르','앨범 이미지 URL','음악 서비스 링크'][i]}<input aria-label={['앨범','장르','앨범 이미지 URL','음악 서비스 링크'][i]} value={draft[key]??''} readOnly={locked} onChange={e=>change(key,e.target.value||null)}/></label>)}<label>발매 연도<input aria-label="발매 연도" type="number" min="1" max="9999" value={draft.releaseYear??''} readOnly={locked} onChange={e=>change('releaseYear',e.target.value?Number(e.target.value):null)}/></label></>}
      {draft.itunesTrackId!=null&&<p className="mc-help">iTunes 연결 곡 · {draft.itunesTrackId}. 기존 곡의 연결 ID와 미리듣기는 보존해요.</p>}
    </form>
  </MoaDialog>;
}
