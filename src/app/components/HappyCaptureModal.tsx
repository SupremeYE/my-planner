import { useEffect, useState } from 'react';
import { X, Mic } from 'lucide-react';
import { usePlanner, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { useVoiceInput } from '../hooks/useVoiceInput';


/**
 * ✨ 행복한 순간 캡처 — 모바일 FAB 스피드다이얼 / 돌아보기 버튼 공용 입력 모달.
 * 저장 시 happy_moments insert: content / date(오늘) / happened_at = 현재 시각(now).
 * 음성 입력(useVoiceInput) 재사용. 저장 후 onSaved 콜백(토스트는 호출부가 노출).
 */
export function HappyCaptureModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { addHappyMoment } = usePlanner();
  const { t } = useTheme();
  const [content, setContent] = useState('');
  const { status, startRecording, stopRecording, text, setText } = useVoiceInput();
  const isRec = status === 'recording';
  const isBusy = status === 'transcribing';

  // 음성 결과를 본문에 이어붙임
  useEffect(() => {
    if (text) {
      setContent(prev => (prev ? `${prev} ${text}` : text));
      setText('');
    }
  }, [text, setText]);

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleVoice = async () => {
    if (isBusy) return;
    if (isRec) await stopRecording();
    else await startRecording();
  };

  const save = () => {
    const v = content.trim();
    if (!v) return;
    addHappyMoment(v, getLogicalToday(), new Date().toISOString());
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        className="relative w-full lg:w-[420px] rounded-t-2xl lg:rounded-2xl p-4"
        style={{
          backgroundColor: t.card,
          border: `1px solid ${t.border}`,
          boxShadow: '0 -8px 28px rgba(0,0,0,0.18)',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text }}>✨ 지금 행복한 순간</h3>
          <button type="button" onClick={onClose} style={{ color: t.textMuted }} aria-label="닫기"><X size={18} /></button>
        </div>

        <div className="flex items-start gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            autoFocus
            rows={2}
            placeholder="어떤 순간이 행복했나요?"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}
            className="flex-1 rounded-lg px-3 py-2 border outline-none resize-none min-w-0"
            style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 14, fontFamily: t.fontBody }}
          />
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isBusy}
            title={isRec ? '녹음 중지' : '음성으로 입력'}
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 38, height: 38,
              backgroundColor: isRec ? '#fee2e2' : t.bgSub,
              border: `1px solid ${isRec ? '#fca5a5' : t.borderLight}`,
              color: isRec ? '#ef4444' : t.textMuted,
            }}
          >
            {isRec ? (
              <span className="animate-pulse rounded-full" style={{ width: 10, height: 10, backgroundColor: '#ef4444', display: 'block' }} />
            ) : (
              <Mic size={15} />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!content.trim()}
          className="w-full mt-3 py-2.5 rounded-xl transition-colors"
          style={{ fontSize: 14, fontWeight: 600, backgroundColor: t.danger, color: '#fff', opacity: content.trim() ? 1 : 0.5 }}
        >
          기록하기
        </button>
      </div>
    </div>
  );
}
