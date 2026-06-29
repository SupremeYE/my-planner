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

  return (
    <div className="h-full overflow-y-auto" style={{ background: t.bg }}>
      {/* 다른 페이지(건강 등)와 동일한 가로 여백 — 가운데 정렬 폭 제한 없이 px 24(lg:px-6)로 콘텐츠 영역을 꽉 채움 */}
      <div style={{ padding: '24px 24px 60px' }}>
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
