// 하온 머니 — 고정비 관리 전용 화면(별도 시트).
//  · 월 고정비 합계 + 고정 vs 변동 도넛 + 외화 환율(Frankfurter) + 결제 일정(임박순).
//  · 변동 고정비(is_variable)는 카테고리 기준 최근 3개월 평균으로 월액 추정(데이터 없으면 등록액).
//  · 외화 구독은 진입 시 결제일 임박분만 자동 환율 갱신 + 수동 새로고침 버튼.
import React, { useEffect, useRef, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { X, Plus, RefreshCw } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { MONEY_PALETTE, resolveCategoryColor, categoryInitial, formatWon, formatManShort } from './tokens';
import { monthlyEquivalent, daysUntilDay, CURRENCY_SYMBOL } from './fx';
import type { UseMoney } from './useMoney';
import type { MoneyFixedCost } from './types';
import { FixedCostForm } from './MoneyForms';

// 변동 고정비의 최근 3개월(당월 포함) 카테고리 지출 평균 — 데이터 없으면 null.
function recent3moAvg(m: UseMoney, categoryId: string | null): number | null {
  if (!categoryId) return null;
  const now = new Date();
  const months = [0, 1, 2].map(i => format(subMonths(now, i), 'yyyy-MM'));
  const sums = new Map<string, number>(months.map(mo => [mo, 0]));
  for (const tx of m.transactions) {
    if (tx.type !== 'expense') continue;
    const root = m.rootCategoryOf(tx.categoryId);
    if (tx.categoryId === categoryId || root?.id === categoryId) {
      const mo = tx.spentAt.slice(0, 7);
      if (sums.has(mo)) sums.set(mo, (sums.get(mo) ?? 0) + tx.amount);
    }
  }
  const vals = [...sums.values()];
  if (!vals.some(v => v > 0)) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / 3);
}

// 고정 vs 변동 2색 도넛.
function Donut({ fixed, variable }: { fixed: number; variable: number }) {
  const total = fixed + variable;
  const r = 42, c = 2 * Math.PI * r;
  const fixFrac = total > 0 ? fixed / total : 0;
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      {/* 변동(배경 전체 원) */}
      <circle cx={60} cy={60} r={r} fill="none" stroke={MONEY_PALETTE.coral} strokeWidth={16} />
      {/* 고정(상단 시작 아크) */}
      {total > 0 && (
        <circle cx={60} cy={60} r={r} fill="none" stroke={MONEY_PALETTE.gold} strokeWidth={16}
          strokeDasharray={`${c * fixFrac} ${c}`} transform="rotate(-90 60 60)" strokeLinecap="butt" />
      )}
      <text x={60} y={56} textAnchor="middle" fontSize={11} fill="#A09889">월 합계</text>
      <text x={60} y={74} textAnchor="middle" fontSize={16} fontWeight={700} fill="#3A352E">{formatManShort(total)}</text>
    </svg>
  );
}

export function FixedCostManager({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const [editor, setEditor] = useState<{ item: MoneyFixedCost | null } | null>(null);
  const [fxStatus, setFxStatus] = useState<{ kind: 'idle' | 'loading' | 'done'; msg?: string }>({ kind: 'idle' });
  const autoRan = useRef(false);

  // 진입 시 1회 — 결제일 임박 외화 고정비만 자동 갱신(사이클 가드).
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    m.refreshFxRates().then(res => {
      if (res.updated > 0) setFxStatus({ kind: 'done', msg: `환율 ${res.updated}건 갱신됨${res.alerts.length ? ` · ⚠ ${res.alerts.join(', ')}` : ''}` });
    });
  }, [m]);

  const manualRefresh = async () => {
    if (fxStatus.kind === 'loading') return;
    setFxStatus({ kind: 'loading' });
    const res = await m.refreshFxRates({ force: true });
    setFxStatus({ kind: 'done', msg: res.updated > 0
      ? `환율 ${res.updated}건 갱신됨${res.alerts.length ? ` · ⚠ ${res.alerts.join(', ')}` : ''}`
      : '갱신할 외화 고정비가 없어요' });
  };

  // 월액(변동은 3개월 평균 우선) + 고정/변동 합계.
  const rows = m.fixedCosts.map(f => {
    const avg = f.isVariable ? recent3moAvg(m, f.categoryId) : null;
    const monthly = avg ?? monthlyEquivalent(f);
    return { f, monthly, avgUsed: avg != null, dday: daysUntilDay(f.billingDay) };
  });
  const fixedSum = rows.filter(r => !r.f.isVariable).reduce((s, r) => s + r.monthly, 0);
  const variableSum = rows.filter(r => r.f.isVariable).reduce((s, r) => s + r.monthly, 0);
  const total = fixedSum + variableSum;

  const foreign = rows.filter(r => r.f.currency !== 'KRW');
  // 결제 일정: 결제일 있는 것 임박순, 없는 것 뒤로.
  const schedule = [...rows].sort((a, b) => {
    if (a.dday == null && b.dday == null) return 0;
    if (a.dday == null) return 1;
    if (b.dday == null) return -1;
    return a.dday - b.dday;
  });

  const card = { background: t.card, borderRadius: 16, padding: 16, boxShadow: t.shadow } as React.CSSProperties;

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full lg:w-[480px] lg:max-w-[92vw] rounded-t-3xl lg:rounded-3xl"
        style={{ background: t.bg, padding: '20px 18px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>고정비 관리</span>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {m.fixedCosts.length === 0 ? (
          <button onClick={() => setEditor({ item: null })} className="w-full flex flex-col items-center justify-center"
            style={{ padding: '28px 12px', borderRadius: 16, border: `1.5px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 13, gap: 6 }}>
            <span>등록된 고정비가 없어요</span>
            <span style={{ color: MONEY_PALETTE.gold, fontWeight: 600, fontSize: 12 }}>+ 고정비 추가하기</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {/* 합계 + 도넛 */}
            <div className="flex items-center gap-4" style={card}>
              <Donut fixed={fixedSum} variable={variableSum} />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>월 고정비 합계</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: t.text }}>{formatWon(total)}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center justify-between" style={{ fontSize: 12 }}>
                    <span className="flex items-center gap-1.5" style={{ color: t.textSub }}><span style={{ width: 9, height: 9, borderRadius: 2, background: MONEY_PALETTE.gold }} />고정</span>
                    <span style={{ color: t.text, fontWeight: 600 }}>{formatWon(fixedSum)}</span>
                  </span>
                  <span className="flex items-center justify-between" style={{ fontSize: 12 }}>
                    <span className="flex items-center gap-1.5" style={{ color: t.textSub }}><span style={{ width: 9, height: 9, borderRadius: 2, background: MONEY_PALETTE.coral }} />변동</span>
                    <span style={{ color: t.text, fontWeight: 600 }}>{variableSum > 0 ? `~${formatWon(variableSum)}` : '0원'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 외화 환율 */}
            {foreign.length > 0 && (
              <div style={card}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>🌐 외화 구독 환율</span>
                  <button onClick={manualRefresh} disabled={fxStatus.kind === 'loading'}
                    className="flex items-center gap-1" style={{ fontSize: 11, color: MONEY_PALETTE.gold, fontWeight: 600, opacity: fxStatus.kind === 'loading' ? 0.5 : 1 }}>
                    <RefreshCw size={12} className={fxStatus.kind === 'loading' ? 'animate-spin' : ''} /> {fxStatus.kind === 'loading' ? '갱신 중' : '새로고침'}
                  </button>
                </div>
                <div className="flex flex-col gap-2.5">
                  {foreign.map(({ f }) => {
                    const sym = CURRENCY_SYMBOL[f.currency];
                    const alert = f.fxChangePct != null && Math.abs(f.fxChangePct) >= (m.settings.fxAlertThreshold || 0);
                    const up = (f.fxChangePct ?? 0) > 0;
                    return (
                      <div key={f.id} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>{f.emoji ? `${f.emoji} ` : ''}{f.name}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>
                            {sym}{f.originalAmount}{f.fxRate ? ` · 환율 ${f.fxRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : ' · 환율 갱신 전'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{formatWon(f.amount)}</div>
                          {f.fxChangePct != null && f.fxChangePct !== 0 && (
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: alert ? MONEY_PALETTE.coral : t.textMuted }}>
                              {up ? '▲' : '▼'}{Math.abs(f.fxChangePct).toFixed(1)}%{alert ? ' ⚠' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {fxStatus.kind === 'done' && fxStatus.msg && (
                  <div style={{ marginTop: 10, fontSize: 11, color: t.textSub, textAlign: 'center' }}>{fxStatus.msg}</div>
                )}
                <div style={{ marginTop: 10, fontSize: 10.5, color: t.textMuted, lineHeight: 1.5 }}>
                  환율은 결제일 직전에 자동 갱신돼요(Frankfurter). 변동률이 ±{m.settings.fxAlertThreshold}% 넘으면 ⚠ 표시.
                </div>
              </div>
            )}

            {/* 결제 일정 */}
            <div>
              <div className="flex items-center justify-between" style={{ margin: '4px 2px 8px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>📅 결제 일정</span>
                <button onClick={() => setEditor({ item: null })} className="flex items-center gap-1" style={{ fontSize: 12, color: MONEY_PALETTE.gold, fontWeight: 600 }}>
                  <Plus size={13} /> 추가
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {schedule.map(({ f, monthly, avgUsed, dday }) => {
                  const cat = m.categoryOf(f.categoryId);
                  const color = resolveCategoryColor(cat);
                  const imminent = dday != null && dday <= 3;
                  return (
                    <button key={f.id} onClick={() => setEditor({ item: f })}
                      className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={card}>
                      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, borderRadius: 10, background: `${color}20`, fontSize: 18 }}>
                        {f.emoji || cat?.emoji || <span style={{ fontSize: 13, fontWeight: 700, color }}>{categoryInitial(cat?.name)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{f.name}{f.isVariable ? ' (변동)' : ''}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>
                          {[f.cycle === 'weekly' ? '매주' : f.cycle === 'yearly' ? '매년' : '매월', f.billingDay ? `${f.billingDay}일` : null, f.paymentMethod].filter(Boolean).join(' · ')}
                          {avgUsed ? ' · 최근 3개월 평균' : ''}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{f.isVariable ? '~' : ''}{formatWon(monthly)}</div>
                        {dday != null && (
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: imminent ? MONEY_PALETTE.coral : t.textMuted }}>D-{dday}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* 추가/편집 시트(형제로 띄움 — 바깥 클릭 전파 방지) */}
    {editor && <FixedCostForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
    </>
  );
}
