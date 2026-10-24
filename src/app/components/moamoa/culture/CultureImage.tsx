import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { safeCultureUrl } from '../../../../lib/cultureRecords';

export function CultureImage({url, title, retry = 0}: {url?: string | null; title: string; retry?: number}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url, retry]);
  const safe = safeCultureUrl(url);
  return safe && !failed
    ? <img key={`${url}:${retry}`} src={safe} alt={`${title} 포스터 또는 썸네일`} loading="lazy" onError={() => setFailed(true)}/>
    : <span className="mc-image-fallback" role="img" aria-label={url ? '이미지를 불러오지 못했어요' : '이미지 없음'}><Film size={24}/><small>{url ? '이미지 대신 기록을 읽어요' : '나만의 감상 기록'}</small></span>;
}
