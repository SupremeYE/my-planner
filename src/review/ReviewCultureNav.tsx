import { Link } from 'react-router';
import './culture.css';

export function ReviewCultureNav({active}: {active:'video'|'music'}) {
  return <section className="mrc-navigation" aria-label="문화·음악 탐색">
    <div className="mrc-breadcrumb"><Link to="/__moamoa-records">기록으로 돌아가기</Link><span>문화·음악</span></div>
    <nav className="mc-tabs" aria-label="문화·음악 종류">
      <Link to="/culture/video" aria-current={active==='video'?'page':undefined}>영상</Link>
      <Link to="/culture/music" aria-current={active==='music'?'page':undefined}>음악</Link>
    </nav>
    {active==='video' && <p className="mrc-sample-note">샘플 문화 기록 · 입력은 현재 탭에만 저장돼요. 새로고침하면 초기화되며 실제 서비스에 연결하지 않아요.</p>}
  </section>;
}

export function ReviewCultureSearchNote() {
  return <aside className="mrc-search-note" aria-label="로컬 검색 샘플 안내">
    <strong>로컬 샘플 검색 · 실제 API 호출 없음</strong>
    <details><summary>검색·실패 체험 방법</summary><p>TMDB 검색은 입력어와 관계없이 같은 영화·드라마 샘플을 보여줘요. <b>오류</b> 또는 <b>없음</b>을 검색하면 실패·빈 결과를 체험할 수 있어요.</p>
      <p>YouTube 샘플: <code>https://youtu.be/sample00001</code><br/>조회 실패 샘플: <code>https://youtu.be/failure0000</code></p></details>
  </aside>;
}
