import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckSquare, Plus } from 'lucide-react';
import { useTheme } from '../ThemeContext';

interface FloatingAddFabProps {
  onAddTodo: () => void;
  onAddEvent: () => void;
  mobileBottomClassName?: string;
  desktopBottomClassName?: string;
}

export function FloatingAddFab({
  onAddTodo,
  onAddEvent,
  mobileBottomClassName = 'bottom-20',
  desktopBottomClassName = 'lg:bottom-6',
}: FloatingAddFabProps) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`fixed lg:absolute right-4 lg:right-6 z-30 ${mobileBottomClassName} ${desktopBottomClassName}`}
    >
      <div
        className="absolute right-0 bottom-[58px] flex flex-col items-end gap-2 transition-all duration-200 ease-out"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
          pointerEvents: open ? 'auto' : 'none',
          transformOrigin: 'bottom right',
        }}
      >
        <button
          onClick={() => {
            onAddEvent();
            setOpen(false);
          }}
          className="px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap"
          style={{
            minWidth: 112,
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            color: t.text,
            boxShadow: '0 8px 18px rgba(38,52,61,0.08)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <CalendarDays size={14} color={t.info} />
          <span>일정 추가</span>
        </button>
        <button
          onClick={() => {
            onAddTodo();
            setOpen(false);
          }}
          className="px-3 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap"
          style={{
            minWidth: 112,
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            color: t.text,
            boxShadow: '0 8px 18px rgba(38,52,61,0.08)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <CheckSquare size={14} color={t.accent} />
          <span>할일 추가</span>
        </button>
      </div>

      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center justify-center rounded-full"
        style={{
          width: 46,
          height: 46,
          backgroundColor: t.accent,
          color: '#fff',
          boxShadow: '0 10px 24px rgba(38,52,61,0.16)',
        }}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
