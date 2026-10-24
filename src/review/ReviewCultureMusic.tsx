import { Link } from 'react-router';
import { MoaFrame } from './ReviewFrame';
import { ReviewCultureNav } from './ReviewCultureNav';

export function Component() {
  return <MoaFrame pageTitle="문화·음악" onQuick={() => {}} quickDisabled>
    <ReviewCultureNav active="music"/>
    <section className="mt-card mr-placeholder"><p className="mt-eyebrow">COMING NEXT</p><h1>음악 기록은 준비 중이에요</h1>
      <p>앨범·곡 정보, 감상과 태그를 모아두는 새로운 화면은 다음 단계에서 만날 수 있어요.</p>
      <p>이번 샘플 Preview에서는 음악 조회·입력과 외부 서비스 연결을 제공하지 않아요.</p>
      <Link className="mr-inline-link" to="/culture/video">영상 기록으로 돌아가기</Link>
    </section>
  </MoaFrame>;
}
