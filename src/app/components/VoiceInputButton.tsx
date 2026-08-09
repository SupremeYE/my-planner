import { useEffect } from 'react';
import { Mic } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useVoiceInput } from '../hooks/useVoiceInput';

// ─── 음성 입력 버튼 (기존 useVoiceInput 재사용) ───
// ReviewsView(감사/KPT/주간/월간) 와 RetroSheet 가 같은 컴포넌트를 공유한다.
// (원래 ReviewsView 로컬 함수였으나 회고 시트 재사용 위해 공용 모듈로 추출 — 로직·색 픽셀 동일.)
export function VoiceInputButton({
  onResult,
  disabled,
}: {
  onResult: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  const { status, startRecording, stopRecording, text, setText } = useVoiceInput();
  const isRec = status === 'recording';
  const isBusy = status === 'transcribing';

  useEffect(() => {
    if (text) {
      onResult(text);
      setText('');
    }
  }, [text, onResult, setText]);

  const toggle = async () => {
    if (isBusy) return;
    if (isRec) await stopRecording();
    else await startRecording();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isBusy}
      title={isRec ? '녹음 중지' : '음성으로 입력'}
      className="flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
      style={{
        width: 30,
        height: 30,
        backgroundColor: isRec ? '#fee2e2' : t.surfaceMuted,
        border: `1px solid ${isRec ? '#fca5a5' : t.borderLight}`,
        color: isRec ? '#ef4444' : t.textMuted,
      }}
    >
      {isRec ? (
        <span
          className="animate-pulse rounded-full"
          style={{ width: 9, height: 9, backgroundColor: '#ef4444', display: 'block' }}
        />
      ) : (
        <Mic size={13} />
      )}
    </button>
  );
}

// label + VoiceInputButton을 한 줄에 나란히
export function LabelRow({ label, labelColor, onVoiceResult }: {
  label: string;
  labelColor?: string;
  onVoiceResult: (text: string) => void;
}) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between mb-1">
      <label style={{ fontSize: 11, color: labelColor ?? t.textSub, fontWeight: 600 }}>{label}</label>
      <VoiceInputButton onResult={onVoiceResult} />
    </div>
  );
}
