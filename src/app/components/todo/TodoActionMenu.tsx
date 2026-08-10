import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, Clock, Play, Pause, Ban, Trash2, ArrowRight } from 'lucide-react';
import { usePlanner, Todo } from '../../store';
import { useTheme } from '../../ThemeContext';
import { useMenuPosition } from '../../hooks/useMenuPosition';
import ConfirmModal from '../ConfirmModal';

/**
 * 할일 액션 메뉴 — 일간(DailyView)·할일 목록(TodosView) 공용.
 *
 * 화면별 노출 방식(인라인 아이콘 vs '…' 메뉴)은 달라도, **가능한 액션 집합은 동일**하게
 * 맞추기 위한 공용 컴포넌트. body 포털 + 측정 기반 flip(useMenuPosition) 으로 어떤
 * overflow/transform 조상에도 갇히지 않는다.
 *
 * 동작은 전부 콜백으로 주입한다(부모가 편집 모달·미루기 모달·상태변경·포커스 타이머를 소유).
 * 삭제만 onDelete 미지정 시 기본 deleteTodo 로 폴백한다.
 */
export interface TodoActionMenuProps {
  todo: Todo;
  position: { x: number; y: number };
  onClose: () => void;
  /** 편집(모달 열기) */
  onEdit: () => void;
  /** 미루기(일간=날짜 선택 모달 / 목록=다음날 이동 등, 부모가 결정) */
  onSnooze: () => void;
  /** 상태 변경 — 예정('active') / 취소('cancelled'). 같은 상태 재선택 시 해제는 부모가 처리. */
  onSetStatus?: (status: 'active' | 'cancelled') => void;
  /** 포커스 시작(타이머). 없으면 항목 숨김. */
  onFocus?: () => void;
  /** 삭제 override(반복 분기 등). 없으면 기본 deleteTodo. */
  onDelete?: () => void;
  deleteMessage?: string;
  /** 'block' = 타임라인 블록/우클릭 공통(편집·미루기·삭제만) */
  variant?: 'list' | 'block';
}

type MenuItem =
  | { divider: true }
  | { label: string; icon: any; action: 'edit' | 'focus' | 'snooze' | 'delete'; danger?: boolean }
  | { label: string; icon: any; action: 'status'; status: 'active' | 'cancelled' };

export function TodoActionMenu({
  todo, position, onClose, onEdit, onSnooze, onSetStatus, onFocus, onDelete, deleteMessage, variant = 'list',
}: TodoActionMenuProps) {
  const { deleteTodo } = usePlanner();
  const { t } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuPos = useMenuPosition(position, ref, onClose);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // ConfirmModal 이 떠 있는 동안엔 바깥 클릭으로 닫지 않음(모달 버튼 클릭 유실 방지).
      if (showDeleteConfirm) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, showDeleteConfirm]);

  const menuItems: MenuItem[] = variant === 'block'
    ? [
        { label: '편집', icon: Edit3, action: 'edit' },
        { divider: true },
        { label: '미루기', icon: ArrowRight, action: 'snooze' },
        { divider: true },
        { label: '삭제', icon: Trash2, action: 'delete', danger: true },
      ]
    : [
        { label: '편집', icon: Edit3, action: 'edit' },
        { divider: true },
        { label: '예정', icon: Clock, action: 'status', status: 'active' },
        ...(onFocus ? [{ label: '포커스 시작', icon: Play, action: 'focus' } as MenuItem] : []),
        { label: '미루기', icon: Pause, action: 'snooze' },
        { label: '취소', icon: Ban, action: 'status', status: 'cancelled' },
        { divider: true },
        { label: '삭제', icon: Trash2, action: 'delete', danger: true },
      ];

  return createPortal(
    <>
      <div ref={ref} role="menu" className="fixed z-50 rounded-xl py-1.5 min-w-[140px]"
        style={{
          top: menuPos.y,
          left: menuPos.x,
          backgroundColor: t.card,
          border: `1px solid ${t.border}`,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
        }}>
        {menuItems.map((item, i) => {
          if ('divider' in item) {
            return <div key={i} className="my-1" style={{ borderBottom: `1px solid ${t.border}` }} />;
          }
          const Icon = item.icon;
          const isActive = item.action === 'status' && todo.status === item.status;
          return (
            <button key={i}
              className="w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left"
              style={{
                fontSize: 12,
                color: 'danger' in item && item.danger ? '#DC2626' : isActive ? t.accent : t.text,
                backgroundColor: isActive ? t.accentLight : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'danger' in item && item.danger ? '#FEE2E2' : t.lavenderHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = isActive ? t.accentLight : 'transparent')}
              onClick={() => {
                if (item.action === 'edit') { onClose(); onEdit(); }
                else if (item.action === 'focus') { onFocus?.(); onClose(); }
                else if (item.action === 'snooze') { onClose(); onSnooze(); }
                else if (item.action === 'delete') { setShowDeleteConfirm(true); }
                else if (item.action === 'status') { onSetStatus?.(item.status); onClose(); }
              }}>
              {Icon && <Icon size={13} />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      {showDeleteConfirm && (
        <ConfirmModal
          message={deleteMessage ?? '이 할일을 삭제할까요?'}
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            if (onDelete) onDelete();
            else deleteTodo(todo.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>,
    document.body,
  );
}
