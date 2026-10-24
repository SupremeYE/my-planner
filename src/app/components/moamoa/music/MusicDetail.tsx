import { useEffect, useMemo, useRef, useState } from 'react';
import type { MusicEntry } from '../../../../lib/musicRecords';
import { safeCultureUrl } from '../../../../lib/cultureRecords';
import type { MusicController } from '../../../hooks/useMusicRecords';
import { LpDisc } from '../../music/LpDisc';
import { StickerLayer } from '../../music/StickerEditor';
import { STICKER_EMOJIS, normalizeStickers } from '../../music/musicStickers';
import { MoaDialog } from '../MoaDialog';
import { CultureSaveFeedback } from '../culture/CultureSaveFeedback';

export function MusicDetail({record:r,controller,onClose,onEdit,onDelete}:{record:MusicEntry;controller:MusicController;onClose:()=>void;onEdit:()=>void;onDelete:()=>void}) {
  const audio=useRef<HTMLAudioElement>(null),playVersion=useRef(0);
  const [playing,setPlaying]=useState(false),[mediaError,setMediaError]=useState(''),[imageFailed,setImageFailed]=useState(false);
  const [decoration,setDecoration]=useState<{before:MusicEntry;raw:unknown[]}|null>(null);
  const state=controller.states.find(s=>s.key===`music:${r.id}`),busy=state?.status==='saving',locked=busy||state?.status==='error';
  const preview=safeCultureUrl(r.previewUrl), artwork=safeCultureUrl(r.artworkUrl);
  const raw=decoration?.raw ?? r.stickers ?? [];
  const stickers=useMemo(()=>raw.flatMap((item,index)=>normalizeStickers([item]).map(s=>({...s,id:String(index)}))),[raw]);
  useEffect(()=>{const node=audio.current;return()=>{playVersion.current++;node?.pause();if(node)node.removeAttribute('src');};},[preview]);
  useEffect(()=>{if(state?.status==='saved')setDecoration(null);},[state?.status]);
  function close(){if(busy)return;if(decoration&&!window.confirm('저장하지 않은 꾸미기를 닫을까요?'))return;if(state?.status==='error'){controller.dismiss(r.id);void controller.refresh();}playVersion.current++;audio.current?.pause();onClose();}
  async function play(){const node=audio.current;if(!node||!preview)return;if(!node.paused){playVersion.current++;node.pause();setPlaying(false);return;}const version=++playVersion.current;setMediaError('');try{await node.play();if(version===playVersion.current)setPlaying(true);else node.pause();}catch{if(version===playVersion.current){setPlaying(false);setMediaError('미리듣기를 재생하지 못했어요. 다시 시도하거나 음악 서비스에서 들어주세요.');}}}
  return <MoaDialog title="음악 기록 상세" description={r.artist||'나의 음악 기록'} onClose={close} saveKeys={[]} footer={<><CultureSaveFeedback state={state} onRetry={()=>void controller.retry(r.id)} onEdit={()=>controller.dismiss(r.id)}/><div className="mx-actions"><button disabled={busy} onClick={close}>닫기</button><button disabled={!!decoration||locked} onClick={()=>{playVersion.current++;audio.current?.pause();onEdit();}}>수정</button><button disabled={!!decoration||locked} onClick={()=>{playVersion.current++;audio.current?.pause();onDelete();}}>삭제</button></div></>}>
    <div className="mm-disc" onError={()=>setImageFailed(true)}><LpDisc artworkUrl={imageFailed?null:artwork} spinning={playing}><StickerLayer stickers={stickers} decorating={!!decoration&&!locked} onMove={(id,x,y)=>setDecoration(d=>d?{...d,raw:d.raw.map((v,i)=>i===Number(id)?{...(v as object),x,y}:v)}:d)} onRemove={id=>setDecoration(d=>d?{...d,raw:d.raw.filter((_,i)=>i!==Number(id))}:d)}/></LpDisc></div>
    {imageFailed&&<p className="mc-help">앨범 이미지를 불러오지 못했어요.</p>}
    <h2 className="mc-detail-title">{r.trackTitle}</h2><p className="mc-detail-facts">{[r.artist,r.album,r.genre,r.releaseYear,r.listenedDate].filter(Boolean).join(' · ')}</p>
    {preview&&<audio ref={audio} src={preview} preload="none" onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setMediaError('미리듣기를 불러오지 못했어요. 음악 서비스에서 들어주세요.');}}/>}
    <button className="mm-play" disabled={!preview||!!decoration} onClick={()=>void play()}>{!preview?'미리듣기 없음':playing?'미리듣기 정지':'30초 미리듣기'}</button>{mediaError&&<p role="alert">{mediaError}</p>}
    <div className="mc-tags">{r.mood.map(m=><span key={m}>#{m}</span>)}</div>{r.memo&&<div className="mc-detail-note"><h3>메모</h3><p>{r.memo}</p></div>}
    <a className="mc-external-link" href={safeCultureUrl(r.listenUrl)??`https://music.youtube.com/search?q=${encodeURIComponent(`${r.trackTitle} ${r.artist}`)}`} target="_blank" rel="noopener noreferrer">{safeCultureUrl(r.listenUrl)?'음악 서비스 열기':'YouTube Music에서 검색'} ↗</a>
    {!decoration?<button className="mc-options-toggle" disabled={locked} onClick={()=>{playVersion.current++;audio.current?.pause();setPlaying(false);setDecoration({before:structuredClone(r),raw:structuredClone(r.stickers??[])});}}>LP 꾸미기</button>:<section className="mm-decoration"><p>스티커를 끌어 옮기고, 두 번 누르면 지워져요. 저장 버튼으로 확정해요.</p><div className="mc-tabs">{STICKER_EMOJIS.map(emoji=><button key={emoji} aria-label={`${emoji} 스티커 추가`} disabled={locked} onClick={()=>setDecoration(d=>d?{...d,raw:[...d.raw,{emoji,x:50,y:50}]}:d)}>{emoji}</button>)}</div><button disabled={busy} onClick={()=>{if(state?.status==='error'){controller.dismiss(r.id);void controller.refresh();}setDecoration(null);}}>꾸미기 취소</button><button className="mx-primary" disabled={locked} onClick={()=>void controller.save({...decoration.before,stickers:decoration.raw},decoration.before)}>꾸미기 저장</button></section>}
  </MoaDialog>;
}
