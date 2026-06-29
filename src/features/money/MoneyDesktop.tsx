// 하온 머니 — PC 셸. 중앙 정렬 단일 컬럼. useMoney 로직 공유, 레이아웃만 분기.
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { useMoney } from './useMoney';
import { MoneyTabBar, PeriodBar, MoneyTabPanel, ChatInputBar, SettingsSheet, type MoneyTab } from './MoneyShared';

export function MoneyDesktop() {
  const m = useMoney();
  const { t } = useTheme();
  const [tab, setTab] = useState<MoneyTab>('budget');
  const [showSettings, setShowSettings] = useState(false);

  // 가계부 탭은 2단 레이아웃이라 넓게(1080), 그 외 단일 컬럼 탭은 가독 폭(760)으로 — 화면 폭 최적화.
  const maxWidth = tab === 'budget' ? 1080 : 760;

  return (
    <div className="h-full overflow-y-auto" style={{ background: t.bg }}>
      <div style={{ maxWidth, margin: '0 auto', padding: '28px 28px 60px', transition: 'max-width 0.25s ease' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: t.text }}>Money</span>
          <button onClick={() => setShowSettings(true)}
            className="flex items-center justify-center"
            style={{ width: 38, height: 38, borderRadius: '50%', background: t.card, color: t.textSub, boxShadow: t.shadow }}>
            <Settings size={17} />
          </button>
        </div>
        <PeriodBar m={m} />
        <div style={{ marginTop: 12, marginBottom: 20, borderBottom: `1px solid ${t.borderLight}` }}>
          <MoneyTabBar tab={tab} setTab={setTab} />
        </div>

        {/* 가계부 탭: 입력바를 본문 상단에 인라인 배치(PC는 고정 바 대신 인라인) */}
        {tab === 'budget' && (
          <div style={{ marginBottom: 16 }}>
            <ChatInputBar m={m} />
          </div>
        )}

        {m.loading
          ? <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted, fontSize: 14 }}>불러오는 중…</div>
          : <MoneyTabPanel tab={tab} m={m} desktop />}
      </div>

      {showSettings && <SettingsSheet m={m} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
