import summer from './culture-assets/summer.svg';
import evening from './culture-assets/evening.svg';
import studio from './culture-assets/studio.svg';

// Virtual saved URLs are never requested. ReviewCultureImage maps only this allowlist to bundled assets.
export const cultureImages: Record<string, string> = {
  'https://moamoa-culture.example.invalid/summer': summer,
  'https://moamoa-culture.example.invalid/evening': evening,
  'https://moamoa-culture.example.invalid/studio': studio,
};
export const sampleCultureRows = [
  {id:'review-culture-film',title:'여름이 남긴 장면들',platform:'theater',content_type:'movie',status:'completed',rating:4.5,
    review:'평범한 하루에도 오래 기억할 장면이 있다는 것. 샘플 감상을 수정해보세요.',insight:'마지막 장면의 햇빛과 짧은 대화.',tags:['주말','쉼'],
    thumbnail_url:'https://moamoa-culture.example.invalid/summer',url:null,external_source:'manual',external_id:null,
    watched_date:'2026-10-20',created_at:'2026-10-22T12:00:00Z',updated_at:'2026-10-22T12:00:00Z'},
  {id:'review-culture-drama',title:'천천히 걷는 우리',platform:'tving',content_type:'drama',status:'watching',rating:null,
    review:'한 회씩, 잠들기 전에 남기는 샘플 기록.',insight:null,tags:['밤'],thumbnail_url:'https://moamoa-culture.example.invalid/evening',
    url:null,external_source:'manual',external_id:null,created_at:'2026-10-21T12:00:00Z'},
  {id:'review-culture-video',title:'비 오는 날의 작은 작업실',platform:'youtube',content_type:'youtube_video',status:'watchlist',rating:null,
    review:'보고 싶은 영상도 샘플로 남겨두어요.',insight:null,tags:['작업실'],thumbnail_url:'https://moamoa-culture.example.invalid/studio',
    url:'https://youtu.be/sample00001',external_source:'youtube',external_id:'sample00001',created_at:'2026-10-20T12:00:00Z'},
  {id:'review-culture-no-poster',title:'포스터 없이 남긴 감상',platform:'other',content_type:'movie',status:'completed',rating:0,
    review:'이미지가 없어도 제목과 감상은 남아요.',insight:null,tags:['직접 입력'],thumbnail_url:null,url:null,external_source:'manual',external_id:null,created_at:'2026-10-19T12:00:00Z'},
  {id:'review-culture-dropped',title:'다음 계절에 이어 보기',platform:'watcha',content_type:'anime',status:'dropped',rating:3,
    review:'기존 중단 상태도 그대로 표시하는 샘플이에요.',insight:null,tags:['나중에'],thumbnail_url:'https://moamoa-culture.example.invalid/unavailable',
    url:null,external_source:'manual',external_id:null,created_at:'2026-10-18T12:00:00Z'},
];
