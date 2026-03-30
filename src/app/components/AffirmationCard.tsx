import { useState, useEffect } from 'react';
import { RefreshCw, Edit3, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { usePlanner, DEFAULT_AFFIRMATIONS } from '../store';
import { useTheme } from '../ThemeContext';

// Deterministic pick based on date string
function pickAffirmation(date: string): string {
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  }
  return DEFAULT_AFFIRMATIONS[hash % DEFAULT_AFFIRMATIONS.length];
}

export function AffirmationCard({ date }: { date: string }) {
  const { dailyAffirmations, setDailyAffirmation } = usePlanner();
  const { t, theme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [randomOffset, setRandomOffset] = useState(0);

  const customText = dailyAffirmations[date];
  const baseAffirmation = pickAffirmation(date + randomOffset);
  const displayText = customText || baseAffirmation;

  const handleEdit = () => {
    setDraft(displayText);
    setEditing(true);
  };

  const handleSave = () => {
    if (draft.trim()) setDailyAffirmation(date, draft.trim());
    setEditing(false);
  };

  const handleRandom = () => {
    setDailyAffirmation(date, ''); // clear custom
    setRandomOffset(prev => prev + 1);
  };

  const handleClearCustom = () => {
    setDailyAffirmation(date, '');
  };

  // Design B gets a distinct glassy/gradient treatment
  const isB = theme === 'B';

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
        style={{
          backgroundColor: t.accentLight,
          border: `1px solid ${t.border}`,
        }}
      >
        <Sparkles size={12} color={t.accent} />
        <span style={{ fontSize: 12, color: t.accent, flex: 1, textAlign: 'left', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayText}
        </span>
        <ChevronDown size={12} color={t.textMuted} />
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl px-5 py-4 relative"
      style={{
        background: isB
          ? `linear-gradient(135deg, #1C1B30 0%, #252350 100%)`
          : `linear-gradient(135deg, ${t.accentLight} 0%, ${t.accentSoft} 100%)`,
        border: `1px solid ${isB ? '#3A3870' : t.planBorder}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} color={t.accent} />
          <span style={{
            fontSize: 10,
            color: t.accent,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            오늘의 확언
          </span>
          {customText && (
            <span className="px-1.5 py-0.5 rounded"
              style={{ fontSize: 9, backgroundColor: t.accentLight, color: t.accent }}>
              나만의
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <>
              {customText && (
                <button
                  onClick={handleClearCustom}
                  title="랜덤으로 초기화"
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: t.textMuted }}
                >
                  <RefreshCw size={11} />
                </button>
              )}
              <button
                onClick={handleRandom}
                title="다른 확언 보기"
                className="p-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: t.accentLight, color: t.accent }}
              >
                <RefreshCw size={12} />
              </button>
              <button
                onClick={handleEdit}
                className="p-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: t.accentLight, color: t.accent }}
                title="직접 쓰기"
              >
                <Edit3 size={12} />
              </button>
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-lg"
                style={{ color: t.textMuted }}
              >
                <ChevronUp size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="나만의 확언을 적어보세요..."
            className="w-full rounded-xl px-3 py-2.5 border outline-none resize-none"
            style={{
              borderColor: t.border,
              fontSize: 14,
              backgroundColor: t.card,
              color: t.text,
              lineHeight: 1.6,
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 12, fontWeight: 600 }}
            >
              <Check size={11} /> 저장
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 12 }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <p style={{
          fontSize: 14,
          color: isB ? '#C8C5F8' : '#8B6B3D',
          lineHeight: 1.65,
          fontStyle: 'italic',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>
          "{displayText}"
        </p>
      )}
    </div>
  );
}
