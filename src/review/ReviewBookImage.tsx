import {useState} from 'react';
import {BookOpen} from 'lucide-react';
import {reviewMediaUrl} from './reviewMedia';
export function BookImage({url,title}:{url?:string|null;title:string}){const [failed,setFailed]=useState<string>();const local=reviewMediaUrl(url);return local&&failed!==local?<img src={local} alt={title} loading="lazy" onError={()=>setFailed(local)}/>:<span className="mc-image-fallback" role="img" aria-label={url?'샘플 이미지 없음':'표지 없음'}><BookOpen size={24}/><small>{url?'로컬 이미지만 표시해요':'나의 작은 책장'}</small></span>;}
