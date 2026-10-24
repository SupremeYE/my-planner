// Test-only Edge adapter; production hooks and helper still execute against memory.
import {supabase as memory,controls} from './moa-today-supabase';
export const supabase=Object.assign(memory,{functions:{async invoke(name:string,options:any){
 const w=window as any;(w.bookApiCalls??=[]).push({name});
 if(w.failBookApi)return {data:null,error:{message:'mock failure'}};
 return name==='vision-extract'?{data:{ok:true,sentences:['사진에서 읽은 문장 하나.','내 속도로 읽어도 괜찮아.'],page:32},error:null}:{data:{text:'목소리로 남긴 구절.'},error:null};
}}});
export {controls};
