import { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { TimePicker } from '../TimePicker';

// ─── Timeline Settings Modal ───
export function TimelineSettingsModal({ startHour, endHour, onSave, onClose }: {
  startHour: number; endHour: number;
  onSave: (s: number, e: number) => void; onClose: () => void;
}) {
  const { t } = useTheme();
  const toTimeStr = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const [startVal, setStartVal] = useState(toTimeStr(startHour));
  const [endVal, setEndVal] = useState(toTimeStr(endHour));

  const startH = parseInt(startVal.split(':')[0]);
  const endH = parseInt(endVal.split(':')[0]);
  const isNextDay = endH <= startH;

  const handleSave = () => {
    const sh = parseInt(startVal.split(':')[0]);
    const eh = parseInt(endVal.split(':')[0]);
    const finalEnd = eh <= sh ? eh + 24 : eh;
    onSave(sh, finalEnd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[340px]"
        style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>타임라인 시간 설정</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div style={{ fontSize: 12, color: t.textMuted, backgroundColor: t.bgSub, borderRadius: 10, padding: '8px 12px' }}>
            현재 설정: {toTimeStr(startHour)} – {toTimeStr(endHour)}{endHour >= 24 ? ' (다음날)' : ''}
          </div>
          <div>
            <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 6, display: 'block' }}>시작 시간</label>
            <TimePicker value={startVal} onChange={setStartVal} placeholder="시작 시간" size="md" minuteStep={1} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 6, display: 'block' }}>종료 시간</label>
            <TimePicker value={endVal} onChange={setEndVal} placeholder="종료 시간" size="md" minuteStep={1} />
            {isNextDay && (
              <span style={{ fontSize: 11, color: t.accent, marginTop: 4, display: 'block' }}>다음날 새벽으로 설정됩니다</span>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-5" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl"
            style={{ fontSize: 14, fontWeight: 500, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            취소
          </button>
          <button onClick={handleSave} className="flex-1 py-3 rounded-xl"
            style={{ fontSize: 14, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
