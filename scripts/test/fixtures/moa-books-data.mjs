export const cover='https://books.example.invalid/old-cover.svg?original=1';
export const photo='https://books.example.invalid/old-quote.svg?original=1';
export const bookTables={
 books:[
  {id:'book-old',title:'천천히 읽는 하루',author:'모아 작가',publisher:'작은 출판사',thumbnail:cover,total_pages:200,current_page:40,status:'reading',start_date:'2026-10-01',finish_date:null,added_at:'2026-10-01',extra:'keep'},
  {id:'book-want',title:'아주 긴 책 제목도 잃어버리지 않도록 — 조용한 일상 속에서 발견한 작은 이야기',author:'산책자',publisher:'',thumbnail:null,total_pages:0,current_page:0,status:'want',start_date:null,finish_date:null,added_at:'2026-10-21'},
  {id:'book-done',title:'정원을 돌보는 마음',author:'초록',publisher:'',thumbnail:'https://books.example.invalid/missing.jpg',total_pages:120,current_page:120,status:'done',start_date:'2026-09-01',finish_date:'2026-10-20',added_at:'2026-09-01'},
 ],
 book_quotes:[{id:'quote-old',book_id:'book-old',text:'작은 걸음도 나의 길이 된다.',page:24,tags:['삶','기억'],starred:true,created_at:'2026-10-20',note:'오늘의 나에게 필요한 문장.',image_url:photo,extra:'keep'}],
 book_notes:[{id:'note-original-id',book_id:'book-old',type:'purpose',content:'천천히 읽고 싶어서',created_at:'2026-10-01',updated_at:'2026-10-02'},{id:'note-custom',book_id:'book-old',type:'reread',content:'다시 읽을 때도 보존'}],
 reading_logs:[{id:'log-old',book_id:'book-old',page:40,date:'2026-10-20',duration_minutes:25,note:'퇴근 후 독서'}],
};
