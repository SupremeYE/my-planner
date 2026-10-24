import type { SaveState } from '../../../../lib/saveCoordinator';
export function CultureSaveFeedback({state, onRetry, onEdit}: {state?: SaveState; onRetry: () => void; onEdit?: () => void}) {
  if (!state) return null;
  return <div className="mc-save-feedback" role={state.status === 'error' ? 'alert' : 'status'}>
    <p>{state.status === 'saving' ? '저장 결과를 확인하고 있어요…' : state.status === 'saved' ? '저장을 확인했어요.' : state.message}</p>
    {state.status === 'error' && <div className="mc-inline-actions">{state.retryable && <button type="button" onClick={onRetry}>재시도</button>}{!state.retryable && onEdit && <button type="button" onClick={onEdit}>입력 다시 확인</button>}</div>}
  </div>;
}
