import { useState } from 'react';
import { RefreshCw, Edit3, Check, X, Sparkles } from 'lucide-react';
import { usePlanner, DEFAULT_AFFIRMATIONS } from '../store';
import { useTheme } from '../ThemeContext';

function pickAffirmation(date: string, offset: number): string {
  let hash = 0;
  const key = date + String(offset);
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return DEFAULT_AFFIRMATIONS[hash % DEFAULT_AFFIRMATIONS.length];
}

export function AffirmationCard({ date }: { date: string }) {
  const { dailyAffirmations, setDailyAffirmation, appSettings } = usePlanner();
  const { t, theme } = useTheme();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [randomOffset, setRandomOffset] = useState(0);

  const isB = theme === 'B';
  const customText = dailyAffirmations[date];
  const displayText = customText || appSettings.globalAffirmation || pickAffirmation(date, randomOffset);

  // 테마별 색상 — B 테마는 피치 코랄 계열, 그 외는 디자인 시스템 accent
  const accentColor = isB ? '#E89568' : t.accent;
  const textColor = isB ? '#A0541E' : t.accent;
  const borderColor = isB ? 'rgba(244,165,130,0.22)' : t.planBorder;
  // 은은한 그라데이션 배경 (단색 → 입체감)
  const cardBg = isB
    ? 'linear-gradient(135deg, rgba(244,165,130,0.14) 0%, rgba(244,165,130,0.05) 100%)'
    : `linear-gradient(135deg, ${t.accentLight} 0%, ${t.card} 120%)`;
  const badgeBg = isB ? 'rgba(244,165,130,0.18)' : t.accentLight;

  if (editing) {
    return (
      <div
        className="flex items-center gap-2.5 rounded-2xl pl-2.5 pr-2 py-2"
        style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          boxShadow: `0 1px 3px ${isB ? 'rgba(160,84,30,0.08)' : 'rgba(196,168,130,0.12)'}`,
          fontFamily: "'Gowun Dodum', 'Pretendard', sans-serif",
        }}
      >
        <span
          className="flex items-center justify-center rounded-full"
          style={{ width: 24, height: 24, background: badgeBg, flexShrink: 0 }}
        >
          <Sparkles size={13} color={accentColor} />
        </span>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (draft.trim()) setDailyAffirmation(date, draft.trim());
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="나만의 확언을 적어보세요..."
          className="flex-1 outline-none bg-transparent"
          style={{
            fontSize: 13,
            color: t.text,
            fontFamily: "'Gowun Dodum', 'Pretendard', sans-serif",
          }}
        />
        <button
          onClick={() => {
            if (draft.trim()) setDailyAffirmation(date, draft.trim());
            setEditing(false);
          }}
          className="flex items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ width: 26, height: 26, background: accentColor, color: '#fff', flexShrink: 0 }}
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="flex items-center justify-center rounded-full transition-colors"
          style={{ width: 26, height: 26, color: t.textMuted, flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl pl-2.5 pr-2 py-2 group transition-all duration-200 hover:-translate-y-px"
      style={{
        background: cardBg,
        border: `1px solid ${borderColor}`,
        boxShadow: `0 1px 3px ${isB ? 'rgba(160,84,30,0.08)' : 'rgba(196,168,130,0.12)'}`,
        fontFamily: "'Gowun Dodum', 'Pretendard', sans-serif",
        minWidth: 0,
      }}
    >
      {/* 포인트 배지 안의 Sparkles 아이콘 */}
      <span
        className="flex items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105"
        style={{ width: 24, height: 24, background: badgeBg, flexShrink: 0 }}
      >
        <Sparkles size={13} color={accentColor} />
      </span>

      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: textColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: "'Gowun Dodum', 'Pretendard', sans-serif",
          letterSpacing: '-0.005em',
        }}
        title={displayText}
      >
        {displayText}
      </span>

      {/* action buttons — visible on hover */}
      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ flexShrink: 0 }}
      >
        <button
          onClick={() => {
            setDailyAffirmation(date, '');
            setRandomOffset(p => p + 1);
          }}
          title="다른 확언 보기"
          className="flex items-center justify-center rounded-full transition-colors hover:bg-black/5 active:scale-90"
          style={{ width: 26, height: 26, color: accentColor }}
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={() => {
            setDraft(displayText);
            setEditing(true);
          }}
          title="직접 쓰기"
          className="flex items-center justify-center rounded-full transition-colors hover:bg-black/5 active:scale-90"
          style={{ width: 26, height: 26, color: accentColor }}
        >
          <Edit3 size={13} />
        </button>
      </div>
    </div>
  );
}
