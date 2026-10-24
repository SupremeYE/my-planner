import { useEffect, useState } from 'react';
import { ImageOff, Utensils } from 'lucide-react';
export function MoaFoodImage({ url, name, retry=0 }: { url?:string|null; name:string; retry?:number }) {
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[url,retry]);
 return url&&!failed ? <img key={`${url}:${retry}`} src={url} alt={name||'음식 사진'} onError={()=>setFailed(true)}/> : <span className="mf-photo-empty" role="img" aria-label={url?'사진을 불러오지 못했어요':'사진 없음'}>{url?<ImageOff size={25}/>:<Utensils size={25}/>}<small>{url?'사진을 불러오지 못했어요':'사진 없이 남긴 기록'}</small></span>;
}
