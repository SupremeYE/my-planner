import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
      <div
        className="rounded-2xl shadow-2xl w-[340px] max-w-[90vw]"
        style={{ backgroundColor: '#FAF8F5', border: '1px solid #E8E0D4' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: confirmDanger ? '#FDE8E8' : '#F0EBE3' }}
            >
              <AlertTriangle size={15} color={confirmDanger ? '#E05C5C' : '#C4A882'} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2D2D2D', lineHeight: 1.4 }}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-[#F0EBE3] flex-shrink-0 ml-2"
          >
            <X size={14} color="#888" />
          </button>
        </div>

        {/* 설명 */}
        {description && (
          <p className="px-5 pb-3" style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>
            {description}
          </p>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 px-5 pb-5 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: '#F0EBE3', color: '#666' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8E0D4')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#F0EBE3')}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
            }}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              backgroundColor: confirmDanger ? '#E05C5C' : '#C4A882',
              color: '#fff',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = confirmDanger ? '#cc4f4f' : '#b89570')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = confirmDanger ? '#E05C5C' : '#C4A882')}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
