import { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { MonthlyView } from './MonthlyView';
import { MandalartView } from './mandalart/MandalartView';

type GoalsMode = 'mandalart' | 'periodic';

export function GoalsHubView() {
  const { t } = useTheme();
  const [mode, setMode] = useState<GoalsMode>('mandalart');

  return (
    <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, backgroundColor: t.bg }}>
      {/* eyebrow + 제목 + 모드 탭 */}
      <div className="px-4 lg:px-8 pt-6 lg:pt-9">
        <div
          style={{
            fontFamily: "'Nanum Pen Script', cursive",
            fontSize: 20,
            color: t.accent,
            lineHeight: 1,
          }}
        >
          structure your dream
        </div>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 34,
            lineHeight: 1,
            marginTop: 4,
            color: t.text,
          }}
        >
          목표
        </h1>

        {/* 모드 탭 (만다라트 / 기간별) */}
        <div
          className="flex gap-1 mt-4"
          style={{ borderBottom: `1px solid ${t.borderLight}` }}
        >
          {([
            { key: 'mandalart', label: '만다라트' },
            { key: 'periodic',  label: '기간별' },
          ] as { key: GoalsMode; label: string }[]).map(({ key, label }) => {
            const on = mode === key;
            return (
              <button
                key={key}
                onClick={() => setMode(key)}
                className="relative px-4 py-2.5"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: on ? t.text : t.textMuted,
                }}
              >
                {label}
                {on && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 12, right: 12, bottom: -1,
                      height: 2,
                      backgroundColor: t.accent,
                      borderRadius: 2,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 모드 본문 */}
      {mode === 'mandalart' ? <MandalartView /> : <MonthlyView />}
    </div>
  );
}
