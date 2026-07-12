// 하온 머니 — 모바일 셸. 헤더 + 기간바 + 4탭 + 본문 + 하단 고정 채팅 입력바(가계부 탭).
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { useMoney } from './useMoney';
import { MoneyTabBar, PeriodBar, MoneyTabPanel, ChatInputBar, SettingsSheet, type MoneyTab } from './MoneyShared';

export function MoneyMobile() {
  const m = useMoney();
  const { t } = useTheme();
  const [tab, setTab] = useState<MoneyTab>('budget');
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <div style={{ padding: '8px 20px 0' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between" style={{ paddingBottom: 8 }}>
          <span style={{ fontFamily: t.fontPageTitle, fontSize: 26, color: t.text }}>Money</span>{/* 페이지 브랜드 제목 */}
          <button onClick={() => setShowSettings(true)}
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: '50%', background: t.card, color: t.textSub, boxShadow: t.shadow }}>
            <Settings size={16} />
          </button>
        </div>
        <PeriodBar m={m} />
        <div style={{ marginTop: 8, marginBottom: 14 }}>
          <MoneyTabBar tab={tab} setTab={setTab} />
        </div>
      </div>

      {/* 본문 — 채팅바 높이만큼 여백 확보 */}
      <div style={{ padding: '0 20px', paddingBottom: tab === 'budget' ? 96 : 24 }}>
        {m.loading
          ? <div style={{ textAlign: 'center', padding: '40px 0', color: t.textMuted, fontSize: 13 }}>불러오는 중…</div>
          : <MoneyTabPanel tab={tab} m={m} />}
      </div>

      {/* 하단 고정 채팅 입력바 — 가계부 탭에서만(하단 네비 위) */}
      {tab === 'budget' && (
        <div className="fixed z-30" style={{ left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}>
          <ChatInputBar m={m} floating />
        </div>
      )}

      {showSettings && <SettingsSheet m={m} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
