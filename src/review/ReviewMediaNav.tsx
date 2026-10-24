import {useState} from 'react';
import {Link} from 'react-router';
import {controls} from '../../scripts/test/fixtures/moa-today-supabase';
export function ReviewMediaNav({kind}:{kind:'music'|'books'}){
 const [notice,setNotice]=useState('');
 function fail(mode:string){const table=kind==='music'?'music_records':mode==='partial'?'reading_logs':'books';if(mode==='photo')controls.failNextStorage('upload',{status:503});else if(mode==='quote')controls.failNext('book_quotes',{status:503});else controls.failNext(table,{status:503,afterCommit:mode==='partial'});setNotice('실패 체험을 준비했어요. 다음 해당 저장에서 오류가 표시되면 재시도해주세요.');}
 return <section className="mrm-note" aria-label="음악·독서 샘플 안내">
  {kind==='books'&&<Link to="/__moamoa-records">기록으로 돌아가기</Link>}
  <p>샘플 {kind==='music'?'음악':'독서'} · 현재 탭에만 저장돼요. 새로고침·샘플 초기화 시 원래 샘플로 돌아가요.</p>
  <details><summary>검색·저장 실패 체험 방법</summary><p>검색은 로컬 샘플이에요. ‘오류’ 또는 ‘없음’을 검색해 실패·빈 결과를 확인해보세요.{kind==='books'&&' ‘표지없음’ 검색도 가능해요.'} {kind==='music'?'미리듣기는 직접 만든 3초 샘플 소리예요.':'OCR·음성 입력은 이 Preview에서 지원하지 않아요.'}</p>
   <button onClick={()=>fail('save')}>다음 {kind==='music'?'음악':'책'} 저장 실패 체험</button>
   {kind==='books'&&<><button onClick={()=>fail('partial')}>다음 독서 이력 부분 실패 체험</button><button onClick={()=>fail('quote')}>다음 구절 저장 실패 체험</button><button onClick={()=>fail('photo')}>다음 사진 업로드 실패 체험</button></>}
   <p role="status">{notice}</p>
  </details>
 </section>;
}
