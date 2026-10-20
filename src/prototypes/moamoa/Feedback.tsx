import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useMoa } from './PrototypeState';
export function Feedback({ inside = false }: { inside?: boolean }) {
  const { feedback, retry, dismiss, busy } = useMoa();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (inside && feedback?.status === 'error') ref.current?.scrollIntoView({ block: 'nearest' }); }, [inside, feedback]);
  if (!feedback) return null;
  return <div ref={ref} className={`mo-feedback mo-feedback-${feedback.status} ${inside ? 'mo-feedback-in-sheet' : ''}`} role={feedback.status === 'error' ? 'alert' : 'status'} aria-live="polite">
    <span className={busy ? 'mo-spinner' : ''}>{busy ? '◌' : feedback.status === 'success' ? '✓' : '!'}</span>
    <div><strong>{feedback.status === 'saving' ? '샘플에 반영 중…' : feedback.status === 'error' ? '아직 반영하지 못했어요' : feedback.label}</strong><small>{feedback.status === 'error' ? '실패 시연 · 입력과 이전 상태를 유지했어요.' : '샘플 데이터만 변경돼요'}</small></div>
    {feedback.status === 'error' && <button className="mo-text-button" onClick={retry}>재시도</button>}
    {!busy && <button className="mo-icon-button" aria-label="반영 알림 닫기" onClick={dismiss}><X size={16} /></button>}
  </div>;
}
