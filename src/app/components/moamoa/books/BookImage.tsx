import {useEffect,useState} from 'react';
import {BookOpen} from 'lucide-react';
import {safeCultureUrl} from '../../../../lib/cultureRecords';
export function BookImage({url,title}:{url?:string|null;title:string}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[url]);return safeCultureUrl(url)&&!failed?<img src={url!} alt={title} loading="lazy" onError={()=>setFailed(true)}/>:<span className="mc-image-fallback" role="img" aria-label={url?'이미지를 불러오지 못했어요':'표지 없음'}><BookOpen size={24}/><small>{url?'기록은 그대로 있어요':'나의 작은 책장'}</small></span>;}
