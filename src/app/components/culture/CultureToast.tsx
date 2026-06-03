import { useCallback, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

export type ToastType = 'info' | 'success' | 'error';
export interface ToastItem { id: number; message: string; type: ToastType; }
export type Notify = (message: string, type?: ToastType) => void;

/** 문화 기록 페이지 전용 경량 토스트 (전역 토스트 인프라 없이 자체 호스팅) */
export function useToasts(): { toasts: ToastItem[]; notify: Notify } {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const notify = useCallback<Notify>((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, message, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 2600);
  }, []);
  return { toasts, notify };
}

export function ToastHost({ toasts }: { toasts: ToastItem[] }) {
  const { t } = useTheme();
  if (toasts.length === 0) return null;

  const colorFor = (type: ToastType) =>
    type === 'success' ? t.success : type === 'error' ? t.danger : t.accent;
  const IconFor = (type: ToastType) =>
    type === 'success' ? CheckCircle2 : type === 'error' ? AlertTriangle : Info;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2"
      style={{ bottom: 24 }}>
      {toasts.map(toast => {
        const Icon = IconFor(toast.type);
        return (
          <div key={toast.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{
              backgroundColor: t.card,
              border: `1px solid ${t.border}`,
              boxShadow: t.shadow,
              maxWidth: '90vw',
            }}>
            <Icon size={16} color={colorFor(toast.type)} />
            <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
