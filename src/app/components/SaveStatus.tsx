import { usePlanner } from '../store';
import { useTheme } from '../ThemeContext';

/** Shared feedback for core writes across existing screens; no offline queue is implied. */
export function SaveStatus({ inline = false, onlyKeys }: { inline?: boolean; onlyKeys?: string[] } = {}) {
  const { saveStates, retrySave, dismissSave } = usePlanner();
  const { t } = useTheme();
  const visible = onlyKeys ? saveStates.filter(state => onlyKeys.includes(state.key)) : saveStates;
  if (!visible.length) return null;
  return (
    <div data-save-status={inline ? "inline" : "global"} className={inline ? "space-y-2" : "fixed top-3 right-3 z-[10000] space-y-2"} style={{ maxWidth: 'min(380px, calc(100vw - 24px))', maxHeight: '40vh', overflowY: 'auto' }}>
      {visible.map(state => (
        <div key={state.key} role={state.status === 'error' ? 'alert' : 'status'}
          className="rounded-xl border px-3 py-2 shadow-sm" style={{ backgroundColor: t.card, color: t.text, borderColor: t.border, fontSize: inline ? 14 : 12 }}>
          <div className="flex items-start gap-2">
            <span className="flex-1">{state.label} · {state.status === 'saving' ? '저장 중…' : state.status === 'saved' ? '저장됨' : state.message}</span>
            {state.status === 'error' && state.retryable && (
              <button type="button" onClick={() => retrySave(state.key)} style={{ color: inline ? t.text : t.accent, flexShrink: 0, minHeight: inline ? 44 : undefined, minWidth: inline ? 44 : undefined }}>재시도</button>
            )}
            {state.status !== 'saving' && (
              <button type="button" onClick={() => dismissSave(state.key)} aria-label="저장 알림 닫기" style={{ color: inline ? t.text : t.textMuted, flexShrink: 0, minHeight: inline ? 44 : undefined, minWidth: inline ? 44 : undefined }}>닫기</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
