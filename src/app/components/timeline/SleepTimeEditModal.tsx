import { useState } from 'react';
import { X } from 'lucide-react';
import { SelfCareRecord } from '../../store';
import { useTheme } from '../../ThemeContext';
import { TimePicker } from '../TimePicker';

// ─── Sleep Time Edit Modal ───
export function SleepTimeEditModal({ record, onClose, onConfirm }: {
  record: SelfCareRecord;
  onClose: () => void;
  onConfirm: (sleepStart: string, sleepEnd: string) => void;
}) {
  const { t } = useTheme();
  const [start, setStart] = useState(record.sleepStart ?? '');
  const [end, setEnd] = useState(record.sleepEnd ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[320px] overflow-hidden"
        style={{ backgroundColor: t.card, border: `1px solid ${t.border}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>🌙 수면 시간 수정</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <label style={{ fontSize: 12, color: t.textSub, width: 48, flexShrink: 0 }}>취침</label>
            <TimePicker value={start} onChange={setStart} placeholder="취침 시간" minuteStep={30} />
          </div>
          <div className="flex items-center gap-3">
            <label style={{ fontSize: 12, color: t.textSub, width: 48, flexShrink: 0 }}>기상</label>
            <TimePicker value={end} onChange={setEnd} placeholder="기상 시간" minuteStep={30} />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button onClick={() => { if (start && end) onConfirm(start, end); }}
            disabled={!start || !end}
            className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: start && end ? '#94A3B8' : t.bgSub, color: start && end ? '#fff' : t.textMuted }}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
