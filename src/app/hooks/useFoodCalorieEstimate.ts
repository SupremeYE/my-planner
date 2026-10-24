import { useCallback, useEffect, useRef, useState } from 'react';
/** Optional same-origin proxy, explicit clicks only. Stale responses cannot overwrite a new draft. */
export function useFoodCalorieEstimate(input: string) {
  const normalized = input.trim();
  const [loading,setLoading] = useState(false), [estimate,setEstimate] = useState<number|null>(null), [error,setError] = useState('');
  const cache = useRef(new Map<string,number>()), controller=useRef<AbortController|null>(null), sequence=useRef(0), busy=useRef(false);
  useEffect(()=>{sequence.current++;controller.current?.abort();busy.current=false;setLoading(false);setEstimate(null);setError('');return()=>{sequence.current++;controller.current?.abort();};},[normalized]);
  const request = useCallback(async()=>{
    if (!normalized || busy.current) return;
    if (cache.current.has(normalized)) {setEstimate(cache.current.get(normalized)!);setError('');return;}
    const generation=++sequence.current;const abort=new AbortController();controller.current=abort;busy.current=true;setLoading(true);setError('');
    try {
      const response=await fetch(`/api/food-calorie?input=${encodeURIComponent(normalized)}`,{signal:abort.signal});
      const data=await response.json();
      if(generation!==sequence.current)return;
      if(!response.ok || typeof data?.calories!=='number' || !Number.isFinite(data.calories) || data.calories<0) throw new Error('estimate unavailable');
      cache.current.set(normalized,data.calories);setEstimate(data.calories);
    }catch {if(generation===sequence.current&&!abort.signal.aborted)setError('AI 추정을 불러오지 못했어요. 칼로리를 직접 입력하거나 비워두고 저장할 수 있어요.');}
    finally {if(generation===sequence.current){busy.current=false;setLoading(false);}}
  },[normalized]);
  return {loading,estimate,error,request};
}
