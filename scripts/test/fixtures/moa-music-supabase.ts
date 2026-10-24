// Test-only adapter: real itunes helper, mock Edge Function result; no socket or API key.
import {supabase as memory,controls} from './moa-today-supabase';
export const supabase=Object.assign(memory,{functions:{async invoke(name:string,{body}:{body:{term:string}}){
 const w=window as any;(w.musicApiCalls??=[]).push({name,term:body.term});
 if(body.term==='느림')await new Promise(r=>setTimeout(r,900));
 if(body.term==='실패')return {data:null,error:{message:'mock failure'}};
 return {data:{results:body.term==='없음'?[]:[{trackTitle:'검색된 노래',artist:'샘플 가수',album:'샘플 앨범',artworkUrl:'https://music.example.invalid/art.svg',releaseYear:2026,itunesTrackId:777,previewUrl:'https://music.example.invalid/preview.wav'}]},error:null};
}}});
export {controls};
