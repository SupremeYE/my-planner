import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { solidCardStyle } from '../styles/haonStyles';
import { HaonButton } from './ui/HaonButton';

interface ConfirmModalProps {
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  message,
  description,
  confirmText = '확인',
  cancelText = '취소',
  confirmDanger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTheme();

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onCancel}
    >
      {/* 표면: §1 기본인 solid-card recipe. 확인 모달은 작고 텍스트 위주라 가독성 우선(솔리드),
          glassBarStyle 은 바(하단 보더)용이라 카드 프레이밍에 부적합해 solidCardStyle 채택. */}
      <div
        className="rounded-2xl shadow-2xl w-[340px] max-w-[90vw]"
        style={solidCardStyle(t)}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: confirmDanger ? t.dangerLight : t.accentLight }}
            >
              <AlertTriangle size={15} color={confirmDanger ? t.danger : t.accent} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text, lineHeight: 1.4 }}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg flex-shrink-0 ml-2 transition-colors"
            aria-label="닫기"
          >
            <X size={14} color={t.textMuted} />
          </button>
        </div>

        {/* 설명 */}
        {description && (
          <p className="px-5 pb-3" style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>
            {description}
          </p>
        )}

        {/* 버튼 — §5 위계: 취소=secondary, 확인=primary(일반)/dangerSolid(파괴). 상호작용은 .haon-btn */}
        <div className="flex gap-2 px-5 pb-5 pt-1">
          <HaonButton variant="secondary" onClick={onCancel} className="flex-1 text-sm">
            {cancelText}
          </HaonButton>
          <HaonButton
            variant={confirmDanger ? 'dangerSolid' : 'primary'}
            onClick={onConfirm}
            className="flex-1 text-sm"
          >
            {confirmText}
          </HaonButton>
        </div>
      </div>
    </div>
  );
}
