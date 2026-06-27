// 하온 머니 — 모바일 셸. 헤더 + 기간바 + 4탭 + 본문 + 하단 고정 채팅 입력바(가계부 탭).
import React, { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { useMoney, type UseMoney } from './useMoney';
import { MoneyTabBar, PeriodBar, MoneyTabPanel, ChatInputBar, type MoneyTab } from './MoneyShared';
import { MONEY_PALETTE } from './tokens';
import type { PeriodType } from './types';

// 머니 설정 바텀시트(예산 기간/급여일/월 예산)
function SettingsSheet({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const [periodType, setPeriodType] = useState<PeriodType>(m.settings.periodType);
  const [payday, setPayday] = useState(String(m.settings.payday));
  const [budgetMan, setBudgetMan] = useState(String(Math.round(m.settings.monthlyBudget / 10000)));

  const save = async () => {
    await m.updateSettings({
      ...m.settings,
      periodType,
      payday: Math.min(Math.max(parseInt(payday) || 1, 1), 31),
      monthlyBudget: (parseInt(budgetMan) || 0) * 10000,
    });
    onClose();
  };

  const opt = (active: boolean) => ({
    flex: 1, padding: 10, borderRadius: 12, textAlign: 'center' as const, fontSize: 13, cursor: 'pointer',
    border: `1.5px solid ${active ? MONEY_PALETTE.gold : t.border}`,
    background: active ? `${MONEY_PALETTE.gold}18` : 'transparent',
    color: active ? t.text : t.textSub, fontWeight: active ? 600 : 400,
  });
  const input = { width: 80, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${t.border}`, fontSize: 15, fontWeight: 700, textAlign: 'center' as const, color: t.text, background: 'transparent', outline: 'none' };

  return (
    <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', width: '100%' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>머니 설정</span>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>예산 기간 기준</div>
          <div className="flex gap-2">
            <button style={opt(periodType === 'calendar')} onClick={() => setPeriodType('calendar')}>1일 ~ 말일</button>
            <button style={opt(periodType === 'payday')} onClick={() => setPeriodType('payday')}>급여일 기준</button>
          </div>
        </div>
        {periodType === 'payday' && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>급여일 (매월)</div>
            <div className="flex items-center gap-2">
              <input type="number" value={payday} onChange={e => setPayday(e.target.value)} min={1} max={31} style={{ ...input, width: 60 }} />
              <span style={{ fontSize: 13, color: t.textSub }}>일</span>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>월 예산</div>
          <div className="flex items-center gap-2">
            <input type="number" value={budgetMan} onChange={e => setBudgetMan(e.target.value)} style={input} />
            <span style={{ fontSize: 13, color: t.textSub }}>만 원</span>
          </div>
        </div>
        <button onClick={save} className="w-full" style={{ padding: 13, borderRadius: 12, background: MONEY_PALETTE.ink, color: '#FDFAF4', fontSize: 14, fontWeight: 600 }}>저장</button>
      </div>
    </div>
  );
}

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
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: t.text }}>Money</span>
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
