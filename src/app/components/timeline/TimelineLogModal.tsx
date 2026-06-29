import { useState } from 'react';
import { Plus, Trash2, X, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import { TimelineLog } from '../../store';
import { useTheme } from '../../ThemeContext';
import { TimePicker } from '../TimePicker';
import { LOG_COLORS } from './timelineConstants';

// ─── Timeline Log Modal (생각/감정 로그) ───
export function TimelineLogModal({ date, logs, onAdd, onDelete, onClose }: {
  date: string; logs: TimelineLog[]; onAdd: (log: TimelineLog) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const { t } = useTheme();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [text, setText] = useState('');
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [selectedColor, setSelectedColor] = useState(LOG_COLORS[0]);
  const [icon, setIcon] = useState('');

  const handleSave = () => {
    if (!text.trim()) return;
    onAdd({
      id: Math.random().toString(36).slice(2, 9),
      date, time,
      text: text.trim(),
      color: selectedColor,
      icon: icon.trim() || undefined,
    });
    setText('');
    setIcon('');
    setMode('list');
  };

  const dateLogs = logs.filter(l => l.date === date).sort((a, b) => a.time.localeCompare(b.time));

  // Format time display
  const formatTimeDisplay = (t24: string) => {
    const [h, m] = t24.split(':').map(Number);
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${ampm} ${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Add mode - matches the screenshot design
  if (mode === 'add') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <div className="rounded-2xl w-[440px]"
          style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
            <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              <span style={{ fontSize: 18 }}>🔮</span>
              생각 / 감정 로그
            </h3>
            <button onClick={() => setMode('list')} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
              타임라인 특정 시간에 그때의 생각이나 감정을 기록해요. 타임라인에 컬러 마커로 표시됩니다.
            </p>

            {/* Time */}
            <div>
              <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>시간</label>
              <TimePicker value={time} onChange={setTime} placeholder="시간 선택" size="md" />
            </div>

            {/* Color + Icon */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>색상</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {LOG_COLORS.map(c => (
                    <button key={c} onClick={() => setSelectedColor(c)}
                      className="w-6 h-6 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        outline: selectedColor === c ? `2.5px solid ${c}` : 'none',
                        outlineOffset: 2,
                        transform: selectedColor === c ? 'scale(1.15)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>아이콘</label>
                <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🎯"
                  className="rounded-xl px-3 py-2.5 outline-none text-center"
                  style={{ border: `1px solid ${t.border}`, fontSize: 16, width: 52, backgroundColor: t.bgSub, color: t.text }} />
              </div>
            </div>

            {/* Content */}
            <div>
              <label style={{ fontSize: 13, color: t.textSub, fontWeight: 500, marginBottom: 8, display: 'block' }}>내용</label>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder="지금 이 순간 드는 생각, 감정, 인사이트를 자유롭게..."
                className="w-full rounded-xl px-4 py-3 outline-none resize-none"
                style={{
                  border: `1px solid ${t.border}`, fontSize: 14, backgroundColor: t.bgSub, color: t.text,
                  minHeight: 120, lineHeight: 1.6,
                }} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-5" style={{ borderTop: `1px solid ${t.border}` }}>
            <button onClick={handleSave} className="flex-1 py-3 rounded-xl"
              style={{ fontSize: 14, fontWeight: 600, backgroundColor: selectedColor, color: '#fff' }}>
              저장
            </button>
            <button onClick={() => setMode('list')} className="flex-1 py-3 rounded-xl"
              style={{ fontSize: 14, fontWeight: 500, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl w-[440px] max-h-[70vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h3 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              <span style={{ fontSize: 18 }}>🔮</span>
              생각 / 감정 로그
            </h3>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>타임라인에 기록된 생각과 감정</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {dateLogs.length === 0 && (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: t.bgSub }}>
                <Edit3 size={18} style={{ color: t.textMuted }} />
              </div>
              <p style={{ fontSize: 13, color: t.textMuted }}>아직 기록이 없습니다</p>
              <p style={{ fontSize: 12, color: t.textMuted, opacity: 0.7, marginTop: 4 }}>새 기록을 추가해보세요</p>
            </div>
          )}
          {dateLogs.length > 0 && (
            <div className="relative" style={{ paddingLeft: 24 }}>
              <div className="absolute top-2 bottom-2" style={{ left: 7, width: 2, backgroundColor: t.border, borderRadius: 1 }} />
              <div className="space-y-3">
                {dateLogs.map(log => {
                  const logColor = log.color || t.info;
                  return (
                    <div key={log.id} className="relative flex items-start gap-3 group">
                      <div className="absolute flex-shrink-0 w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: logColor, left: -24, top: 5, border: `2.5px solid ${t.card}` }} />
                      <div className="flex-1 rounded-xl px-4 py-3" style={{ backgroundColor: logColor + '10', border: `1px solid ${logColor}20` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full"
                            style={{ fontSize: 10, color: logColor, backgroundColor: logColor + '18', fontWeight: 600 }}>
                            {formatTimeDisplay(log.time)}
                          </span>
                          {log.icon && <span style={{ fontSize: 13 }}>{log.icon}</span>}
                          <div className="flex-1" />
                          <button onClick={() => onDelete(log.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                            style={{ color: t.textMuted }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <p style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{log.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add button */}
        <div className="px-6 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={() => setMode('add')} className="w-full py-3 rounded-xl flex items-center justify-center gap-2"
            style={{ fontSize: 14, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            <Plus size={15} />
            새 기록 추가
          </button>
        </div>
      </div>
    </div>
  );
}
