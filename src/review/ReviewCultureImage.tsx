import { useState } from 'react';
import { Film } from 'lucide-react';
import { cultureImages } from './cultureSamples';

/** User-supplied external URLs stay in memory but can never become an image request. */
export function CultureImage({url,title,retry=0}: {url?:string|null;title:string;retry?:number}) {
  const [failed, setFailed] = useState('');
  const key = `${url}:${retry}`;
  const local = url ? cultureImages[url] : undefined;
  return local && failed !== key
    ? <img key={key} src={local} alt={`${title} 로컬 샘플 이미지`} loading="lazy" onError={() => setFailed(key)}/>
    : <span className="mc-image-fallback" role="img" aria-label={url ? '샘플 이미지 없음' : '이미지 없음'}><Film size={24}/><small>{url ? '로컬 샘플 이미지만 표시해요' : '감상 기록'}</small></span>;
}
