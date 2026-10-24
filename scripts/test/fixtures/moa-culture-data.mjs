export const originalPoster = 'https://culture.example.invalid/legacy-poster.svg?original=1';
export const cultureRows = [
  {id:'legacy-movie', title:'여름이 남긴 장면들', platform:'netflix', content_type:'movie', status:'completed',
    rating:4.5, review:'별일 없는 하루에도 오래 기억할 장면이 있다는 것. 다시 보고 싶은 따뜻한 이야기.',
    insight:'마지막 장면의 햇빛과 함께 나누던 짧은 대화.', tags:['주말','쉼'], watched_date:'2026-10-20',
    thumbnail_url:originalPoster, url:'https://example.invalid/old-film', external_source:'tmdb_movie', external_id:'123',
    created_at:'2026-10-20T10:00:00Z', updated_at:'2026-10-20T10:00:00Z', user_id:'isolated-user', legacy_extra:'never overwrite'},
  {id:'legacy-drama', title:'천천히 걷는 우리', platform:'tving', content_type:'drama', status:'watching',
    rating:null, review:'한 회씩, 잠들기 전에.', insight:null, tags:['밤'], thumbnail_url:null, external_source:null, external_id:null,
    created_at:'2026-10-22T10:00:00Z'},
  {id:'legacy-youtube', title:'비 오는 날의 작은 작업실', platform:'youtube', content_type:'youtube_video', status:'watchlist',
    rating:0, review:'영상 속 음악과 풍경이 궁금해요.', tags:['작업실'], thumbnail_url:'https://culture.example.invalid/missing.jpg',
    url:'https://www.youtube.com/watch?v=abcdefghijk', external_source:'youtube', external_id:'abcdefghijk', created_at:'2026-10-21T10:00:00Z'},
  {id:'legacy-anime', title:'다음 계절에 이어 보기', platform:'watcha', content_type:'anime', status:'dropped',
    rating:3, review:'중단해도 남겨두고 싶은 감상.', tags:['나중에'], thumbnail_url:null, external_source:'manual', created_at:'2026-10-19T10:00:00Z'},
  {id:'legacy-documentary', title:'아주 긴 작품명도 빠짐없이 남기는 문화 기록 — 도시에 숨은 작은 정원과 사람들의 이야기', platform:'other', content_type:'documentary', status:'completed',
    rating:null, review:'이름 없는 꽃도 각자의 계절을 살아간다.', tags:['정원'], thumbnail_url:originalPoster, external_source:null,
    created_at:'2026-10-18T10:00:00Z'},
];
