import type {MusicSearchResult} from '../lib/itunes';
import type {BookSuggestion} from '../lib/bookRecords';
const pause=()=>new Promise<void>(r=>setTimeout(r,120));
export async function searchMusic(query:string):Promise<MusicSearchResult[]>{
 await pause();if(['오류','실패'].includes(query.trim()))throw new Error('로컬 샘플 검색 오류');if(!query.trim()||query.trim()==='없음')return [];
 return [{trackTitle:'샘플 검색곡 · 작은 오후',artist:'모아 밴드',album:'샘플 앨범',artworkUrl:'https://music.example.invalid/art.svg',releaseYear:2026,itunesTrackId:777,previewUrl:'https://music.example.invalid/preview.wav'}];
}
export async function reviewSearchBooks(query:string,signal?:AbortSignal):Promise<BookSuggestion[]>{
 await pause();if(signal?.aborted)throw new DOMException('Aborted','AbortError');if(['오류','실패'].includes(query.trim()))throw new Error('로컬 샘플 검색 오류');if(!query.trim()||query.trim()==='없음')return [];
 return [{title:'샘플 검색책 · 한 페이지의 쉼',authors:['모아 작가'],publisher:'샘플 출판사',thumbnail:query.trim()==='표지없음'?'':'https://books.example.invalid/old-cover.svg?original=1'}];
}
