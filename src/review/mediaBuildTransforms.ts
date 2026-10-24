// Review-only adaptations. Feature files stay byte-identical to their verified commits.
function replace(code:string,from:string|RegExp,to:string){if(typeof from==='string'?!code.includes(from):!from.test(code))throw new Error(`Media review boundary changed: ${from}`);return code.replace(from,to);}
export function transformReviewMedia(code:string,id:string):string|undefined {
 if(id.endsWith('/MoaMusicRoute.tsx')){
  code="import {ReviewCultureNav} from '@/review/ReviewCultureNav';\nimport {ReviewMediaNav} from '@/review/ReviewMediaNav';\nimport {reviewMediaUrl} from '@/review/reviewMedia';\n"+code;
  code=replace(code,'<div className="mc-page mm-page">','<div className="mc-page mm-page"><ReviewCultureNav active="music"/><ReviewMediaNav kind="music"/>');
  return replace(replace(code,'safeCultureUrl(r.artworkUrl)','reviewMediaUrl(r.artworkUrl)'),'src={r.artworkUrl!}','src={reviewMediaUrl(r.artworkUrl)}');
 }
 if(id.endsWith('/music/MusicDetail.tsx')){
  code="import {reviewMediaUrl,reviewAudioUrl} from '@/review/reviewMedia';\n"+code;
  code=replace(replace(code,'safeCultureUrl(r.previewUrl)','reviewAudioUrl(r.previewUrl)'),'safeCultureUrl(r.artworkUrl)','reviewMediaUrl(r.artworkUrl)');
  code=replace(code,/<a className="mc-external-link"[\s\S]*?<\/a>/,'<p className="mc-help">{r.listenUrl ? <>보관한 샘플 링크: {r.listenUrl}<br/></> : null}외부 음악 서비스는 열지 않아요. 미리듣기는 로컬 샘플이에요.</p>');
  return replace(code,"'30초 미리듣기'","'3초 샘플 미리듣기'");
 }
 if(id.endsWith('/MoaBooksRoute.tsx')) return "import {ReviewMediaNav} from '@/review/ReviewMediaNav';\n"+replace(code,'<div className="mc-page mb-page">','<div className="mc-page mb-page"><ReviewMediaNav kind="books"/>');
 if(id.endsWith('/src/lib/bookRecords.ts')){
  code="import {reviewSearchBooks} from '@/review/mediaApi';\nimport {isReviewBlob} from '@/review/reviewMedia';\n"+code;
  code=replace(code,/export async function searchBooks\([\s\S]*?\nexport function applyBookSuggestion/,'export const searchBooks=reviewSearchBooks;\nexport function applyBookSuggestion');
  return replace(code,'!safeCultureUrl(r.image_url)','!safeCultureUrl(r.image_url)&&!isReviewBlob(r.image_url)');
 }
 if(id.endsWith('/books/QuoteEditor.tsx')){
  code=replace(code,"disabled={locked||photoBusy||ocrBusy||voice.status==='transcribing'}","disabled title=\"Preview에서는 음성 입력을 지원하지 않아요\"");
  code=replace(code,"'음성으로 입력'","'음성 입력 · Preview 미지원'");
  code=replace(code,'disabled={inputLocked} onClick={()=>void ocr()}','disabled title="Preview에서는 OCR을 지원하지 않아요"');
  code=replace(code,"'사진에서 글자 읽기 · 선택'","'OCR · Preview 미지원'");
  code=replace(code,'눌렀을 때 사진을 업로드하고 기존 AI 서비스로 전송해요. AI 없이 저장할 수 있어요.','Preview에서는 OCR·음성 변환을 사용하지 않아요. 사진과 직접 입력은 저장할 수 있어요.');
  return code;
 }
 if(id.endsWith('/music/MusicEditor.tsx')||id.endsWith('/books/BookEditor.tsx'))return replace(code,'<details','<p className="mc-help">로컬 샘플 검색이에요. 오류 / 없음으로 실패·빈 결과를 체험할 수 있어요.</p><details');
}
