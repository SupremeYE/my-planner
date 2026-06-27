// 하온 머니 — 공용 프레젠테이션 조각(모바일/PC 공유). 레이아웃 셸만 Mobile/Desktop 에서 분기.
import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Send, Trash2, X } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import type { UseMoney } from './useMoney';
import {
  MONEY_PALETTE, resolveCategoryColor, categoryInitial, formatWon, formatManShort,
} from './tokens';
import type { MoneyCategory } from './types';

export type MoneyTab = 'budget' | 'asset' | 'invest' | 'plan';

export const MONEY_TABS: { key: MoneyTab; label: string }[] = [
  { key: 'budget', label: '가계부' },
  { key: 'asset', label: '자산' },
  { key: 'invest', label: '투자' },
  { key: 'plan', label: '계획' },
];

// 오늘 기준 매월 day 일까지 남은 일수(D-day). day 없으면 null.
function daysUntilDay(day: number | null): number | null {
  if (!day) return null;
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), day);
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }
  return Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
}

// ── 거래 아이콘(카테고리 이모지 > 색상점+첫글자) ──
// 거래 자체엔 이모지 컬럼이 없으므로 연결된 카테고리 이모지로 파생, 없으면 색상+첫글자 fallback.
function TxIcon({ cat }: { cat: MoneyCategory | null }) {
  const color = resolveCategoryColor(cat);
  const emoji = cat?.emoji;
  return (
    <div className="flex items-center justify-center flex-shrink-0"
      style={{ width: 38, height: 38, borderRadius: 11, background: `${color}20`, fontSize: 18 }}>
      {emoji ? emoji : (
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{categoryInitial(cat?.name)}</span>
      )}
    </div>
  );
}

// ── 메인 탭 바 ──
export function MoneyTabBar({ tab, setTab }: { tab: MoneyTab; setTab: (t: MoneyTab) => void }) {
  const { t } = useTheme();
  return (
    <div className="flex gap-1 px-1">
      {MONEY_TABS.map(({ key, label }) => {
        const active = tab === key;
        return (
          <button key={key} onClick={() => setTab(key)}
            className="flex-1 py-2.5 transition-all"
            style={{
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? t.text : t.textMuted,
              borderBottom: `2px solid ${active ? MONEY_PALETTE.gold : 'transparent'}`,
              background: 'transparent',
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── 기간 바 ──
export function PeriodBar({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const s = parseISO(m.period.start), e = parseISO(m.period.end);
  const basis = m.settings.periodType === 'payday' ? '급여일 기준' : '월 기준';
  return (
    <div className="flex items-center justify-between px-1 py-1">
      <span style={{ fontSize: 12, color: t.textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: MONEY_PALETTE.gold }}>●</span>
        {format(s, 'M/d')} – {format(e, 'M/d')} ({basis})
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{m.period.label}</span>
    </div>
  );
}

// ── 요약 3칸 ──
export function SummaryStrip({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const cell = (label: string, value: string, color: string) => (
    <div className="flex-1 text-center" style={{ background: t.card, borderRadius: 14, padding: '12px 10px', boxShadow: t.shadow }}>
      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
    </div>
  );
  return (
    <div className="flex gap-2">
      {cell('수입', `+${formatManShort(m.income)}`, MONEY_PALETTE.green)}
      {cell('지출', `-${formatManShort(m.expense)}`, MONEY_PALETTE.coral)}
      {cell('잔여', formatManShort(m.balance), t.text)}
    </div>
  );
}

// ── 예산 진행률 ──
export function BudgetBar({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const budget = m.settings.monthlyBudget || 0;
  const used = m.expense;
  const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
  const over = budget > 0 && used > budget;
  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: t.textSub }}>월 예산 {formatManShort(budget)}</span>
        <span style={{ color: t.textMuted }}>{used.toLocaleString('ko-KR')} / {budget.toLocaleString('ko-KR')}</span>
      </div>
      <div style={{ height: 8, background: t.bgSub, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: over ? MONEY_PALETTE.coral : MONEY_PALETTE.gold, transition: 'width 0.6s' }} />
      </div>
      <div style={{ fontSize: 11, color: over ? MONEY_PALETTE.coral : t.textMuted, marginTop: 6, textAlign: 'right' }}>
        {over ? `예산 ${formatManShort(used - budget)} 초과` : `${formatManShort(budget - used)} 남음`}
      </div>
    </div>
  );
}

// ── 카테고리별 지출 분석(스택 바 + 범례) ──
export function CategoryBreakdown({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const map = new Map<string, number>();
  m.periodTransactions.filter(x => x.type === 'expense').forEach(x => {
    const key = x.categoryId ?? '__none__';
    map.set(key, (map.get(key) ?? 0) + x.amount);
  });
  const rows = Array.from(map.entries())
    .map(([cid, amount]) => {
      const cat = cid === '__none__' ? null : m.categoryOf(cid);
      return { cat, amount, color: resolveCategoryColor(cat), name: cat?.name ?? '미분류' };
    })
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total === 0) return null;
  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>카테고리별 지출</div>
      <div className="flex" style={{ height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ width: `${(r.amount / total) * 100}%`, background: r.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="flex items-center gap-2" style={{ fontSize: 12, color: t.text }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
              {r.name}
            </span>
            <span style={{ fontSize: 12, color: t.textSub }}>
              {formatWon(r.amount)} <span style={{ color: t.textMuted }}>({Math.round((r.amount / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 거래 리스트 ──
export function TransactionList({ m, limit }: { m: UseMoney; limit?: number }) {
  const { t } = useTheme();
  const list = (limit ? m.transactions.slice(0, limit) : m.transactions);
  if (list.length === 0) {
    return <div style={{ textAlign: 'center', padding: '24px 0', color: t.textMuted, fontSize: 13 }}>아직 거래가 없어요. 아래에 입력해 보세요.</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {list.map(tx => {
        const cat = m.categoryOf(tx.categoryId);
        const isIncome = tx.type === 'income';
        return (
          <div key={tx.id} className="flex items-center gap-3 group"
            style={{ background: t.card, borderRadius: 14, padding: '11px 14px', boxShadow: t.shadow }}>
            <TxIcon cat={cat} />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.memo || cat?.name || (isIncome ? '수입' : '지출')}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
                {[cat?.name, tx.paymentMethod, format(parseISO(tx.spentAt), 'M.d')].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isIncome ? MONEY_PALETTE.green : t.text, whiteSpace: 'nowrap' }}>
              {isIncome ? '+' : '-'}{tx.amount.toLocaleString('ko-KR')}
            </div>
            <button onClick={() => m.deleteTransaction(tx.id)} title="삭제"
              className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: t.textMuted, padding: 4 }}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── 자산 패널 ──
export function AssetPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const card = (children: React.ReactNode, extra?: React.CSSProperties) =>
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, ...extra }}>{children}</div>;
  const sectionTitle = (txt: string) => <div style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: '4px 2px 8px' }}>{txt}</div>;
  return (
    <div className="flex flex-col gap-3">
      {/* 순자산 */}
      {card(
        <div className="text-center">
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>순자산</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: t.text }}>{formatWon(m.netWorth)}</div>
          <div className="flex gap-3 mt-3">
            <div className="flex-1" style={{ background: `${MONEY_PALETTE.green}18`, borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 10, color: t.textSub }}>+ 자산</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: MONEY_PALETTE.green }}>{m.assets.toLocaleString('ko-KR')}</div>
            </div>
            <div className="flex-1" style={{ background: `${MONEY_PALETTE.coral}14`, borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 10, color: t.textSub }}>− 카드 부채</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: MONEY_PALETTE.coral }}>{m.cardDebt.toLocaleString('ko-KR')}</div>
            </div>
          </div>
        </div>,
      )}

      {/* 통장·예금 */}
      <div>
        {sectionTitle('🏦 통장 · 예금')}
        <div className="flex flex-col gap-2">
          {m.accounts.filter(a => a.type !== 'investment').map(a => (
            <div key={a.id} className="flex items-center gap-3" style={{ background: t.card, borderRadius: 14, padding: 14, boxShadow: t.shadow }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${MONEY_PALETTE.green}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{a.icon || '🏦'}</div>
              <div className="flex-1">
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.name}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{a.type === 'savings' ? '적금' : a.type === 'cash' ? '현금' : '예금'}{a.interestRate != null ? ` · 연 ${a.interestRate}%` : ''}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.balance.toLocaleString('ko-KR')}</div>
            </div>
          ))}
          {m.accounts.filter(a => a.type !== 'investment').length === 0 && (
            <div style={{ fontSize: 12, color: t.textMuted, padding: 8 }}>등록된 통장이 없어요</div>
          )}
        </div>
      </div>

      {/* 신용카드 */}
      <div>
        {sectionTitle('💳 신용 · 체크카드')}
        <div className="flex flex-col gap-2">
          {m.cards.map(c => {
            const dday = daysUntilDay(c.billingDay);
            return (
              <div key={c.id} className="flex items-center gap-3" style={{ background: t.card, borderRadius: 14, padding: 14, boxShadow: t.shadow }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color || MONEY_PALETTE.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💳</div>
                <div className="flex-1">
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>미결제 {c.unpaidAmount.toLocaleString('ko-KR')}</div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 15, fontWeight: 700, color: MONEY_PALETTE.coral }}>-{c.unpaidAmount.toLocaleString('ko-KR')}</div>
                  {c.billingDay && <div style={{ fontSize: 10, color: t.textMuted }}>결제일 {c.billingDay}일{dday != null ? ` · D-${dday}` : ''}</div>}
                </div>
              </div>
            );
          })}
          {m.cards.length === 0 && <div style={{ fontSize: 12, color: t.textMuted, padding: 8 }}>등록된 카드가 없어요</div>}
        </div>
      </div>

      {/* 대출 요약 */}
      {m.loans.length > 0 && (
        <div>
          {sectionTitle('📋 대출')}
          <div className="flex flex-col gap-2">
            {m.loans.map(l => {
              const pct = l.totalInstallments ? Math.round((l.paidInstallments / l.totalInstallments) * 100) : 0;
              const dday = daysUntilDay(l.paymentDay);
              return (
                <div key={l.id} style={{ background: t.card, borderRadius: 14, padding: 16, boxShadow: t.shadow }}>
                  <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{[l.lender, l.repaymentType].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="text-right">
                      <div style={{ fontSize: 16, fontWeight: 700, color: MONEY_PALETTE.coral }}>{l.balance.toLocaleString('ko-KR')}</div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>원금 잔액</div>
                    </div>
                  </div>
                  <div className="flex justify-between" style={{ fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: t.textSub }}>상환 진행률 {l.paidInstallments}/{l.totalInstallments}회</span>
                    <span style={{ color: MONEY_PALETTE.green, fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: t.bgSub, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: MONEY_PALETTE.green }} />
                  </div>
                  {l.monthlyPayment != null && (
                    <div className="flex justify-between items-center" style={{ marginTop: 10, padding: 10, background: t.bgSub, borderRadius: 10 }}>
                      <span style={{ fontSize: 12, color: t.textSub }}>다음 상환 {dday != null ? `D-${dday}` : ''}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{l.monthlyPayment.toLocaleString('ko-KR')}원</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 투자 패널 ──
export function InvestPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const total = m.investments.reduce((s, a) => s + a.balance, 0);
  if (m.investments.length === 0) {
    return (
      <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📈</div>
        <div style={{ fontSize: 13, color: t.textSub }}>주식·펀드·코인 등<br />투자 내역을 추가해보세요</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>총 투자자산</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: t.text, marginTop: 4 }}>{formatWon(total)}</div>
      </div>
      <div className="flex flex-col gap-2">
        {m.investments.map(a => (
          <div key={a.id} className="flex items-center gap-3" style={{ background: t.card, borderRadius: 14, padding: 14, boxShadow: t.shadow }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: t.bgSub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{a.icon || '📈'}</div>
            <div className="flex-1"><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.name}</div></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.balance.toLocaleString('ko-KR')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 계획(목표) 패널 ──
export function PlanPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  if (m.goals.length === 0) {
    return <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, textAlign: 'center', fontSize: 13, color: t.textMuted }}>저축 목표를 추가해보세요 🎯</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      {m.goals.map(g => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
        const color = g.color || MONEY_PALETTE.green;
        return (
          <div key={g.id} style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, border: `1.5px solid ${t.borderLight}` }}>
            <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{g.emoji ? `${g.emoji} ` : ''}{g.name}</div>
                {g.deadline && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{format(parseISO(g.deadline), 'yyyy.MM.dd')}까지</div>}
              </div>
              <span style={{ fontSize: 18, fontWeight: 900, color }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: t.bgSub, borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: color }} />
            </div>
            <div className="flex justify-between" style={{ fontSize: 11, color: t.textMuted }}>
              <span><strong style={{ color: t.text }}>{g.currentAmount.toLocaleString('ko-KR')}</strong> 달성</span>
              <span>목표 {g.targetAmount.toLocaleString('ko-KR')}원</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 채팅형 자연어 입력바 (Stage 2 핵심) ──
export function ChatInputBar({ m, floating }: { m: UseMoney; floating?: boolean }) {
  const { t } = useTheme();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });

  const submit = async () => {
    const val = text.trim();
    if (!val || status.kind === 'loading') return;
    setStatus({ kind: 'loading' });
    const res = await m.parseAndAdd(val, 'chat');
    if (res.ok && res.parsed) {
      const p = res.parsed;
      const sign = p.type === 'income' ? '+' : '-';
      setStatus({ kind: 'ok', msg: `${p.category ?? '미분류'} ${sign}${p.amount.toLocaleString('ko-KR')}원 기록됨` });
      setText('');
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } else {
      setStatus({ kind: 'err', msg: res.error || '인식하지 못했어요' });
      setTimeout(() => setStatus({ kind: 'idle' }), 3000);
    }
  };

  return (
    <div style={floating ? undefined : { position: 'relative' }}>
      {status.kind !== 'idle' && status.kind !== 'loading' && (
        <div style={{
          fontSize: 12, fontWeight: 600, marginBottom: 6, textAlign: 'center',
          color: status.kind === 'ok' ? MONEY_PALETTE.green : MONEY_PALETTE.coral,
        }}>
          {status.kind === 'ok' ? '✓ ' : '⚠ '}{status.msg}
        </div>
      )}
      <div className="flex items-center gap-2"
        style={{ background: t.card, borderRadius: 16, padding: '6px 6px 6px 16px', boxShadow: '0 4px 20px rgba(58,53,46,0.12)', border: `1px solid ${t.borderLight}` }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={status.kind === 'loading' ? '기록 중…' : '예: 점심 김치찌개 8000'}
          disabled={status.kind === 'loading'}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: t.text, fontFamily: t.font }}
        />
        {text && (
          <button onClick={() => setText('')} style={{ color: t.textMuted, padding: 4 }}><X size={15} /></button>
        )}
        <button onClick={submit} disabled={status.kind === 'loading'}
          className="flex items-center justify-center"
          style={{ width: 34, height: 34, borderRadius: 10, background: MONEY_PALETTE.ink, color: '#FDFAF4', flexShrink: 0, opacity: status.kind === 'loading' ? 0.5 : 1 }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ── 탭 본문 라우팅(공유) ──
export function MoneyTabPanel({ tab, m }: { tab: MoneyTab; m: UseMoney }) {
  if (tab === 'asset') return <AssetPanel m={m} />;
  if (tab === 'invest') return <InvestPanel m={m} />;
  if (tab === 'plan') return <PlanPanel m={m} />;
  // budget
  return (
    <div className="flex flex-col gap-3">
      <SummaryStrip m={m} />
      <BudgetBar m={m} />
      <CategoryBreakdown m={m} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, marginLeft: 2 }}>최근 거래</div>
        <TransactionList m={m} limit={12} />
      </div>
    </div>
  );
}
