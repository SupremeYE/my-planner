// 하온 머니 — 공용 프레젠테이션 조각(모바일/PC 공유). 레이아웃 셸만 Mobile/Desktop 에서 분기.
import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Send, X, Plus } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import type { UseMoney } from './useMoney';
import {
  MONEY_PALETTE, resolveCategoryColor, categoryInitial, formatWon, formatManShort,
} from './tokens';
import type { MoneyCategory, MoneyAccount, MoneyCard, MoneyLoan, MoneyGoal, MoneyFixedCost } from './types';
import { TransactionForm, AccountForm, CardForm, FixedCostForm, LoanForm, GoalForm } from './MoneyForms';

// 섹션 헤더(+ 추가 버튼 포함)
function SectionHead({ title, onAdd }: { title: string; onAdd?: () => void }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between" style={{ margin: '4px 2px 8px' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{title}</span>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1" style={{ fontSize: 12, color: MONEY_PALETTE.gold, fontWeight: 600 }}>
          <Plus size={13} /> 추가
        </button>
      )}
    </div>
  );
}
// 빈 상태 + 추가 유도
function EmptyAdd({ text, onAdd }: { text: string; onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <button onClick={onAdd} className="w-full flex flex-col items-center justify-center"
      style={{ padding: '20px 12px', borderRadius: 16, border: `1.5px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 13, gap: 4 }}>
      <span>{text}</span>
      <span style={{ color: MONEY_PALETTE.gold, fontWeight: 600, fontSize: 12 }}>+ 추가하기</span>
    </button>
  );
}

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

// ── 거래 아이콘(거래 이모지 > 카테고리 이모지 > 색상점+첫글자) ──
function TxIcon({ emoji, cat }: { emoji: string | null; cat: MoneyCategory | null }) {
  const color = resolveCategoryColor(cat);
  const icon = emoji || cat?.emoji;
  return (
    <div className="flex items-center justify-center flex-shrink-0"
      style={{ width: 38, height: 38, borderRadius: 11, background: `${color}20`, fontSize: 18 }}>
      {icon ? icon : (
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{categoryInitial(cat?.name)}</span>
      )}
    </div>
  );
}

// ── 무지출 아이콘(₩ 위 사선, 골드) ──
function NoSpendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={MONEY_PALETTE.gold} strokeWidth="1.5" />
      <line x1="7" y1="7" x2="17" y2="17" stroke={MONEY_PALETTE.gold} strokeWidth="1.5" strokeLinecap="round" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill={MONEY_PALETTE.gold}>₩</text>
    </svg>
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
      <div className="flex justify-between items-center" style={{ marginTop: 6 }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          D-{m.daysLeft} · 하루 {m.dailyAllowance.toLocaleString('ko-KR')}원 사용 가능
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: over ? MONEY_PALETTE.coral : t.textSub }}>
          {over ? `${formatManShort(used - budget)} 초과` : `${formatManShort(budget - used)} 남음`}
        </span>
      </div>
    </div>
  );
}

// ── 지출 캘린더(기간 단위 그리드 + 무지출/지출/수입 마킹 + 스트릭) ──
export function SpendCalendar({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 기간(start~end)을 날짜 배열로 펼친 뒤, 시작 요일만큼 앞에 빈칸을 채워 주별 그리드 정렬.
  const days: string[] = [];
  for (let d = new Date(m.period.startDate); d <= m.period.endDate; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(format(d, 'yyyy-MM-dd'));
  }
  const leadEmpty = m.period.startDate.getDay(); // 0(일)~6(토)
  const cells: (string | null)[] = [...Array(leadEmpty).fill(null), ...days];

  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>지출 캘린더</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${MONEY_PALETTE.green}20`, color: MONEY_PALETTE.green }}>
          {m.noSpendStreak}일 무지출 🔥
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['일', '월', '화', '수', '목', '금', '토'].map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{w}</div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} style={{ aspectRatio: '1' }} />;
          const agg = m.spendByDay.get(date);
          const hasExpense = (agg?.expense ?? 0) > 0;
          const hasIncome = (agg?.income ?? 0) > 0;
          const isToday = date === todayStr;
          const isFuture = date > todayStr;
          const dayNum = parseInt(date.slice(8, 10), 10);
          return (
            <div key={i} className="relative flex flex-col items-center justify-center"
              style={{
                aspectRatio: '1', borderRadius: 12, gap: 1,
                background: isToday ? MONEY_PALETTE.ink : hasExpense ? 'transparent' : (!isFuture ? '#F0EBE2' : 'transparent'),
              }}>
              {hasIncome && (
                <span className="absolute" style={{ top: 3, right: 3, width: 4, height: 4, borderRadius: '50%', background: MONEY_PALETTE.green }} />
              )}
              {!hasExpense && !isFuture && !isToday && <NoSpendIcon size={16} />}
              <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1, color: isToday ? '#FDFAF4' : isFuture ? t.textMuted : t.text }}>
                {dayNum}
              </span>
              {hasExpense && (
                <span style={{ fontSize: 7, fontWeight: 700, lineHeight: 1, color: isToday ? MONEY_PALETTE.gold : MONEY_PALETTE.coral }}>
                  -{formatManShort(agg!.expense)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex justify-center" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="flex items-center" style={{ gap: 4, fontSize: 10, color: t.textMuted }}><NoSpendIcon size={13} /> 무지출</span>
        <span className="flex items-center" style={{ gap: 4, fontSize: 10, color: t.textMuted }}><span style={{ width: 8, height: 8, borderRadius: 3, background: MONEY_PALETTE.coral }} /> 지출</span>
        <span className="flex items-center" style={{ gap: 4, fontSize: 10, color: t.textMuted }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: MONEY_PALETTE.green }} /> 수입</span>
      </div>

      {/* 스트릭 카운터(Nanum Pen Script) */}
      {m.noSpendStreak > 0 && (
        <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.borderLight}` }}>
          <div style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 28, color: MONEY_PALETTE.gold, lineHeight: 1 }}>
            {m.noSpendStreak}일 연속 무지출!
          </div>
          <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>한 푼도 안 쓴 날을 이어가고 있어요 ✨</div>
        </div>
      )}
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

// ── 거래 리스트 (행 탭 = 수정) ──
export function TransactionList({ m, limit, onEdit }: { m: UseMoney; limit?: number; onEdit: (tx: any) => void }) {
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
          <button key={tx.id} onClick={() => onEdit(tx)} className="flex items-center gap-3 text-left w-full transition-transform active:scale-[0.99]"
            style={{ background: t.card, borderRadius: 14, padding: '11px 14px', boxShadow: t.shadow }}>
            <TxIcon emoji={tx.emoji} cat={cat} />
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
          </button>
        );
      })}
    </div>
  );
}

// ── 자산 패널 (항목 탭=수정 / 섹션 +추가) ──
type AssetEditor =
  | { kind: 'account'; item: MoneyAccount | null }
  | { kind: 'card'; item: MoneyCard | null }
  | { kind: 'fixed'; item: MoneyFixedCost | null }
  | { kind: 'loan'; item: MoneyLoan | null }
  | null;

export function AssetPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [editor, setEditor] = useState<AssetEditor>(null);
  const banks = m.accounts.filter(a => a.type !== 'investment');
  const rowBtn = { background: t.card, borderRadius: 14, padding: 14, boxShadow: t.shadow } as React.CSSProperties;

  return (
    <div className="flex flex-col gap-3">
      {/* 순자산 */}
      <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
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
        </div>
      </div>

      {/* 통장·예금 */}
      <div>
        <SectionHead title="🏦 통장 · 예금" onAdd={() => setEditor({ kind: 'account', item: null })} />
        <div className="flex flex-col gap-2">
          {banks.map(a => (
            <button key={a.id} onClick={() => setEditor({ kind: 'account', item: a })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={rowBtn}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${MONEY_PALETTE.green}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{a.icon || '🏦'}</div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.name}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{a.type === 'savings' ? '적금' : a.type === 'cash' ? '현금' : '예금'}{a.interestRate != null ? ` · 연 ${a.interestRate}%` : ''}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.balance.toLocaleString('ko-KR')}</div>
            </button>
          ))}
          {banks.length === 0 && <EmptyAdd text="등록된 통장이 없어요" onAdd={() => setEditor({ kind: 'account', item: null })} />}
        </div>
      </div>

      {/* 신용·체크카드 */}
      <div>
        <SectionHead title="💳 신용 · 체크카드" onAdd={() => setEditor({ kind: 'card', item: null })} />
        <div className="flex flex-col gap-2">
          {m.cards.map(c => {
            const dday = daysUntilDay(c.billingDay);
            return (
              <button key={c.id} onClick={() => setEditor({ kind: 'card', item: c })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={rowBtn}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color || MONEY_PALETTE.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💳</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{c.type === 'check' ? '체크' : '신용'} · 미결제 {c.unpaidAmount.toLocaleString('ko-KR')}</div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 15, fontWeight: 700, color: MONEY_PALETTE.coral }}>-{c.unpaidAmount.toLocaleString('ko-KR')}</div>
                  {c.billingDay && <div style={{ fontSize: 10, color: t.textMuted }}>결제일 {c.billingDay}일{dday != null ? ` · D-${dday}` : ''}</div>}
                </div>
              </button>
            );
          })}
          {m.cards.length === 0 && <EmptyAdd text="등록된 카드가 없어요" onAdd={() => setEditor({ kind: 'card', item: null })} />}
        </div>
      </div>

      {/* 고정비 */}
      <div>
        <SectionHead title={`🔁 고정비 · 월 ${m.fixedTotal.toLocaleString('ko-KR')}원`} onAdd={() => setEditor({ kind: 'fixed', item: null })} />
        <div className="flex flex-col gap-2">
          {m.fixedCosts.map(f => {
            const cat = m.categoryOf(f.categoryId);
            const dday = daysUntilDay(f.billingDay);
            return (
              <button key={f.id} onClick={() => setEditor({ kind: 'fixed', item: f })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={rowBtn}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${resolveCategoryColor(cat)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{f.emoji || cat?.emoji || '🔁'}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{f.name}{f.isVariable ? ' (변동)' : ''}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{[f.paymentMethod, f.billingDay ? `매월 ${f.billingDay}일` : null, dday != null ? `D-${dday}` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{f.isVariable ? '~' : ''}{f.amount.toLocaleString('ko-KR')}</div>
                  {f.currency !== 'KRW' && f.originalAmount != null && <div style={{ fontSize: 10, color: t.textMuted }}>{f.currency} {f.originalAmount}</div>}
                </div>
              </button>
            );
          })}
          {m.fixedCosts.length === 0 && <EmptyAdd text="등록된 고정비가 없어요" onAdd={() => setEditor({ kind: 'fixed', item: null })} />}
        </div>
      </div>

      {/* 대출 */}
      <div>
        <SectionHead title="📋 대출" onAdd={() => setEditor({ kind: 'loan', item: null })} />
        <div className="flex flex-col gap-2">
          {m.loans.map(l => {
            const pct = l.totalInstallments ? Math.round((l.paidInstallments / l.totalInstallments) * 100) : 0;
            const dday = daysUntilDay(l.paymentDay);
            return (
              <button key={l.id} onClick={() => setEditor({ kind: 'loan', item: l })} className="text-left w-full active:scale-[0.99] transition-transform" style={{ background: t.card, borderRadius: 14, padding: 16, boxShadow: t.shadow }}>
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
                {l.totalInstallments != null && (
                  <>
                    <div className="flex justify-between" style={{ fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: t.textSub }}>상환 진행률 {l.paidInstallments}/{l.totalInstallments}회</span>
                      <span style={{ color: MONEY_PALETTE.green, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 8, background: t.bgSub, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: MONEY_PALETTE.green }} />
                    </div>
                  </>
                )}
                {l.monthlyPayment != null && (
                  <div className="flex justify-between items-center" style={{ marginTop: 10, padding: 10, background: t.bgSub, borderRadius: 10 }}>
                    <span style={{ fontSize: 12, color: t.textSub }}>다음 상환 {dday != null ? `D-${dday}` : ''}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{l.monthlyPayment.toLocaleString('ko-KR')}원</span>
                  </div>
                )}
              </button>
            );
          })}
          {m.loans.length === 0 && <EmptyAdd text="등록된 대출이 없어요" onAdd={() => setEditor({ kind: 'loan', item: null })} />}
        </div>
      </div>

      {editor?.kind === 'account' && <AccountForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'card' && <CardForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'fixed' && <FixedCostForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'loan' && <LoanForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
    </div>
  );
}

// ── 투자 패널 (투자계좌 = accounts.type==='investment') ──
export function InvestPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [editor, setEditor] = useState<{ item: MoneyAccount | null } | null>(null);
  const total = m.investments.reduce((s, a) => s + a.balance, 0);
  return (
    <div className="flex flex-col gap-3">
      {m.investments.length === 0 ? (
        <div style={{ background: t.card, borderRadius: 20, padding: 24, boxShadow: t.shadow, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📈</div>
          <div style={{ fontSize: 13, color: t.textSub, marginBottom: 14 }}>주식·펀드·코인 등<br />투자 내역을 추가해보세요</div>
          <button onClick={() => setEditor({ item: null })} style={{ padding: '8px 20px', borderRadius: 10, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 13, fontWeight: 500 }}>+ 투자 추가</button>
        </div>
      ) : (
        <>
          <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: t.textMuted }}>총 투자자산</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: t.text, marginTop: 4 }}>{formatWon(total)}</div>
          </div>
          <SectionHead title="📈 포트폴리오" onAdd={() => setEditor({ item: null })} />
          <div className="flex flex-col gap-2">
            {m.investments.map(a => (
              <button key={a.id} onClick={() => setEditor({ item: a })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={{ background: t.card, borderRadius: 14, padding: 14, boxShadow: t.shadow }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: t.bgSub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{a.icon || '📈'}</div>
                <div className="flex-1 min-w-0"><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.name}</div></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.balance.toLocaleString('ko-KR')}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {editor && <AccountForm m={m} item={editor.item} onClose={() => setEditor(null)} defaultType="investment" />}
    </div>
  );
}

// ── 계획(목표) 패널 (항목 탭=수정 / +추가) ──
export function PlanPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [editor, setEditor] = useState<{ item: MoneyGoal | null } | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <SectionHead title="🎯 저축 목표" onAdd={() => setEditor({ item: null })} />
      {m.goals.length === 0 && <EmptyAdd text="저축 목표가 없어요" onAdd={() => setEditor({ item: null })} />}
      {m.goals.map(g => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
        const color = g.color || MONEY_PALETTE.green;
        return (
          <button key={g.id} onClick={() => setEditor({ item: g })} className="text-left w-full active:scale-[0.99] transition-transform" style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, border: `1.5px solid ${t.borderLight}` }}>
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
          </button>
        );
      })}
      {editor && <GoalForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
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

// ── 가계부 패널(요약·예산·캘린더·분석·거래, 거래 탭=수정) ──
export function BudgetPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [editTx, setEditTx] = useState<{ item: any } | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <SummaryStrip m={m} />
      <BudgetBar m={m} />
      <SpendCalendar m={m} />
      <CategoryBreakdown m={m} />
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 10, marginLeft: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>최근 거래</span>
          <button onClick={() => setEditTx({ item: null })} className="flex items-center gap-1" style={{ fontSize: 12, color: MONEY_PALETTE.gold, fontWeight: 600 }}>
            <Plus size={13} /> 직접 추가
          </button>
        </div>
        <TransactionList m={m} limit={20} onEdit={(tx) => setEditTx({ item: tx })} />
      </div>
      {editTx && <TransactionForm m={m} item={editTx.item} onClose={() => setEditTx(null)} />}
    </div>
  );
}

// ── 탭 본문 라우팅(공유) ──
export function MoneyTabPanel({ tab, m }: { tab: MoneyTab; m: UseMoney }) {
  if (tab === 'asset') return <AssetPanel m={m} />;
  if (tab === 'invest') return <InvestPanel m={m} />;
  if (tab === 'plan') return <PlanPanel m={m} />;
  return <BudgetPanel m={m} />;
}
