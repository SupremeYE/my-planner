import { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { MonthlyView } from './MonthlyView';
import { MandalartView } from './mandalart/MandalartView';

type GoalsMode = 'mandalart' | 'periodic';

export function GoalsHubView() {
  const { t } = useTheme();
  const [mode, setMode] = useState<GoalsMode>('mandalart');

  return (
    <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, backgroundColor: t.bg }}>
      {/* 제목(아이콘 + 목표) + 모드 탭 */}
      <div className="px-4 lg:px-8 pt-6 lg:pt-9">
        <div className="flex items-center gap-2">
          <BarChart2 size={22} strokeWidth={2.2} color={t.accent} style={{ flexShrink: 0 }} />
          <h1
            style={{
              fontFamily: t.fontPageTitle, // 페이지 최상위 제목 (건강 페이지와 동일 규격)
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1,
              color: t.text,
            }}
          >
            목표
          </h1>
        </div>

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
