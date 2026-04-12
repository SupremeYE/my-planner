import { CalendarDays, ListTodo, Plus } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface AddEntryMenuProps {
  onAddTodo: () => void;
  onAddEvent: () => void;
  align?: 'start' | 'center' | 'end';
  fullWidth?: boolean;
}

export function AddEntryMenu({
  onAddTodo,
  onAddEvent,
  align = 'end',
  fullWidth = false,
}: AddEntryMenuProps) {
  const { t } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`px-2.5 py-1.5 lg:px-3 rounded-lg flex items-center justify-center gap-1 lg:gap-1.5${fullWidth ? ' w-full' : ''}`}
          style={{
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: t.accent,
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={13} /> 추가
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="min-w-[180px]"
        style={{ backgroundColor: t.card, borderColor: t.border }}
      >
        <DropdownMenuItem
          onClick={onAddTodo}
          className="cursor-pointer"
          style={{ color: t.text }}
        >
          <ListTodo size={14} color={t.accent} />
          할일 추가
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onAddEvent}
          className="cursor-pointer"
          style={{ color: t.text }}
        >
          <CalendarDays size={14} color={t.info} />
          일정 추가
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
