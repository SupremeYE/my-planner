import { useEffect } from 'react';
import { Check, Play, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { solidCardStyle, progressCheckboxStyle, type TodoProgressState } from '../styles/haonStyles';
import type { Todo, TodoStatus } from '../store';

// 수동 상태 선택 시트 (체크박스 롱프레스 진입) — 안시작/진행중/완료 3값.
// 짧은 탭=완료는 소비처(체크박스 onClick)가 유지하고, 이 시트는 롱프레스로만 연다.
// progressCheckboxStyle(Stage 1 등록)을 그대로 소비해 목록 체크박스와 동일한 3상태 표현을 쓴다.
const OPTIONS: { status: TodoProgressState; label: string; desc: string }[] = [
  { status: 'active', label: '안 시작', desc: '아직 시작 전' },
  { status: 'inProgress', label: '진행 중', desc: '이어서 하는 중 (타이머 없이도)' },
  { status: 'done', label: '완료', desc: '끝냈어요' },
];

interface Props {
  todo: Todo;
  onSelect: (status: TodoStatus) => void;
  onClose: () => void;
}

export default function StatusSheet({ todo, onSelect, onClose }: Props) {
  const { t } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const current: TodoProgressState =
    todo.status === 'done' ? 'done' : todo.status === 'inProgress' ? 'inProgress' : 'active';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="w-full lg:w-[340px] max-w-[100vw] lg:max-w-[90vw] rounded-t-2xl lg:rounded-2xl shadow-2xl"
        style={solidCardStyle(t)}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>상태 바꾸기</p>
          <button onClick={onClose} aria-label="닫기" className="p-1.5">
            <X size={14} color={t.textMuted} />
          </button>
        </div>
        <p
          className="px-5 pb-2"
          style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {todo.text}
        </p>
        <div className="px-3 pb-4 pt-1 flex flex-col gap-1">
          {OPTIONS.map(opt => {
            const active = current === opt.status;
            return (
              <button
                key={opt.status}
                onClick={() => onSelect(opt.status)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                style={{ backgroundColor: active ? t.accentLight : 'transparent' }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={progressCheckboxStyle(t, opt.status, t.accent)}
                >
                  {opt.status === 'done' && <Check size={11} color="#fff" strokeWidth={3} />}
                  {opt.status === 'inProgress' && <Play size={9} color={t.success} fill={t.success} />}
                </span>
                <span className="min-w-0">
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: t.text }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: t.textMuted }}>{opt.desc}</span>
                </span>
                {active && <Check size={15} color={t.accent} className="ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
