import {useEffect,useRef,useState} from 'react';
import type {NoteRow} from '../../../../lib/bookRecords';
import type {BookController} from '../../../hooks/useBookRecords';
import {MoaDialog} from '../MoaDialog';
import {CultureSaveFeedback} from '../culture/CultureSaveFeedback';
export function BookNoteEditor({record,bookId,type,controller,onClose}:{record?:NoteRow;bookId:string;type:string;controller:BookController;onClose:()=>void}){
 const [initial]=useState<NoteRow>(()=>record?structuredClone(record):{id:`${bookId}__${type}`,book_id:bookId,type,content:''});const [content,setContent]=useState(initial.content),attempted=useRef(false),done=useRef(false);
 const state=controller.notes.states.find(s=>s.key===`book_notes:${initial.id}`),busy=state?.status==='saving',locked=busy||state?.status==='error';
 useEffect(()=>{if(attempted.current&&!done.current&&state?.status==='saved'){done.current=true;onClose();}},[state?.status,onClose]);
 function close(){if(busy)return;if(content!==initial.content&&!window.confirm('저장하지 않은 메모를 닫을까요?'))return;if(state?.status==='error'){controller.notes.dismiss(initial.id);void controller.notes.refresh();}onClose();}
 return <MoaDialog title="책 메모" description={type==='purpose'?'왜 이 책을 읽나요?':type==='output'?'읽고 나서 남기고 싶은 것':`기존 메모 · ${type}`} onClose={close} saveKeys={[]} footer={<><CultureSaveFeedback state={state} onRetry={()=>void controller.notes.retry(initial.id)} onEdit={()=>controller.notes.dismiss(initial.id)}/><div className="mx-actions"><button disabled={busy} onClick={close}>취소</button><button className="mx-primary" disabled={locked||!record&&!content.trim()} onClick={()=>{attempted.current=true;void controller.notes.save({...initial,content},record?initial:undefined);}}>저장</button></div></>}><div className="mc-form"><label>책 메모 내용<textarea autoFocus aria-label="책 메모 내용" value={content} readOnly={locked} onChange={e=>setContent(e.target.value)}/></label><p className="mc-help">구절의 ‘내 생각’과 별도 기록이에요. 기존 메모 ID를 유지해요.</p></div></MoaDialog>;
}
