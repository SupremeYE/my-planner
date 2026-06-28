// 하온 머니 — Plan-Stage 2B: 월말 종합 회고.
//  한 달 마무리 의식 — 계획 대비 실제 + 자산 변화 + 수입 분배(계획 vs 실제) + 다음 달 조정.
//  · MonthBanner : 가계부 탭 배너. 기간 종료 임박(≤3일)/종료 시 강조, 회고 완료 시 요약, 평상시 저키 진입.
//  · MonthReviewSheet : ① 계획 대비 실제 ② 자산 변화 ③ 수입 분배(계획↔실제 도넛) ④ 다음 달 조정(메모 선택).
//  · 계획(money_plans)이 없으면 비교 섹션은 "계획 없음" 안내로 graceful 대체. 색은 tokens 경유, PC 레이아웃 불변.
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../app/ThemeContext';
import type { UseMoney } from './useMoney';
import type { MoneyReview } from './types';
import { MONEY_PALETTE, formatWon, formatManShort, resolveCategoryColor } from './tokens';
import { DistributionDonut } from './MoneyPlanSheet';

// 분배 세그먼트 색(계획 도넛과 동일 의미론) — 고정=골드, 저축/여력=그린, 생활비=뮤트.
const SEG = { fixed: MONEY_PALETTE.gold, save: MONEY_PALETTE.green, living: MONEY_PALETTE.mute };

// 실제 집계(이번 기간) — 고정 자동기록 / 변동 지출 / 저축 여력.
function useMonthActuals(m: UseMoney) {
  return useMemo(() => {
    const fixedActual = m.periodTransactions
      .filter(t => t.type === 'expense' && t.source === 'fixed').reduce((s, t) => s + t.amount, 0);
    const livingActual = Math.max(0, m.expense - fixedActual);
    const savingRoom = Math.max(0, m.income - m.expense);   // 실제 남은 돈 = 저축 여력
    const netWorth = m.assets - m.cardDebt - m.loanDebt;    // 현재 순자산(투자 평가액은 assets 에 포함)
    return { fixedActual, livingActual, savingRoom, netWorth };
  }, [m.periodTransactions, m.expense, m.income, m.assets, m.cardDebt, m.loanDebt]);
}

// 이번 기간 monthly 회고(있으면).
const monthlyReviewOf = (m: UseMoney): MoneyReview | null =>
  m.reviews.find(r => r.type === 'monthly' && r.periodStart === m.period.start) ?? null;

// 직전 기간 monthly 회고(순자산 델타용) — period.start 보다 이른 것 중 가장 최근.
const prevMonthlyReview = (m: UseMoney): MoneyReview | null =>
  m.reviews
    .filter(r => r.type === 'monthly' && r.periodStart < m.period.start)
    .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0] ?? null;

// ── 가계부 탭 배너 ──
export function MonthBanner({ m, onOpen }: { m: UseMoney; onOpen: () => void }) {
  const { t } = useTheme();
  const reviewed = monthlyReviewOf(m);
  const nearEnd = m.daysLeft <= 3;   // 기간 종료 임박/당일

  // 회고 완료 → 요약 카드
  if (reviewed) {
    return (
      <button onClick={onOpen} className="w-full active:scale-[0.99] transition-transform"
        style={{ background: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, padding: '12px 16px', boxShadow: t.shadow }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>
            <span style={{ color: MONEY_PALETTE.green }}>✓</span> 이번 달 회고 완료
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textSub }}>다시 보기 ›</span>
        </div>
      </button>
    );
  }

  // 기간 종료 임박 → 강조 배너
  if (nearEnd) {
    return (
      <button onClick={onOpen} className="w-full flex items-center justify-between active:scale-[0.99] transition-transform"
        style={{ background: `${MONEY_PALETTE.coral}1a`, border: `1.5px solid ${MONEY_PALETTE.coral}55`, borderRadius: 16, padding: '14px 16px' }}>
        <div className="text-left">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>📊 이번 달 회고할 시간이에요</div>
          <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 2 }}>계획 대비 실제 · 자산 변화 · 다음 달 조정</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: MONEY_PALETTE.coral, flexShrink: 0 }}>회고하기 ›</span>
      </button>
    );
  }

  // 평상시 → 저키 진입(미리보기)
  return (
    <button onClick={onOpen} className="w-full flex items-center justify-between active:scale-[0.99] transition-transform"
      style={{ background: 'transparent', border: `1.5px dashed ${t.border}`, borderRadius: 16, padding: '11px 16px' }}>
      <span style={{ fontSize: 12, color: t.textSub }}>📊 이번 달 회고 미리보기</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textMuted }}>보기 ›</span>
    </button>
  );
}

// 비교 행(계획 → 실제 + 차이 배지)
function CompareRow({ label, planned, actual, t, goodWhenUnder = true }:
  { label: string; planned: number; actual: number; t: any; goodWhenUnder?: boolean }) {
  const diff = actual - planned;
  const over = diff > 0;
  // goodWhenUnder: 지출성(적게 쓰면 좋음) → 초과=코랄. false(수입/저축성: 많을수록 좋음) → 미달=코랄.
  const bad = goodWhenUnder ? over : diff < 0;
  const badgeColor = Math.abs(diff) < planned * 0.02 || planned === 0 ? t.textMuted : (bad ? MONEY_PALETTE.coral : MONEY_PALETTE.green);
  const badgeText = planned === 0 ? '계획 없음'
    : Math.abs(diff) < planned * 0.02 ? '계획대로'
    : `${over ? '+' : '−'}${formatManShort(Math.abs(diff))}`;
  return (
    <div className="flex items-center justify-between" style={{ padding: '2px 0' }}>
      <span style={{ fontSize: 12.5, color: t.textSub, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: t.textMuted, width: 78, textAlign: 'right' }}>{formatManShort(planned)}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: t.text, width: 84, textAlign: 'right' }}>{formatManShort(actual)}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: badgeColor, width: 64, textAlign: 'right' }}>{badgeText}</span>
    </div>
  );
}

// ── 월말 회고 시트 ──
export function MonthReviewSheet({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const plan = m.currentPlan;
  const { fixedActual, livingActual, savingRoom, netWorth } = useMonthActuals(m);
  const saved = monthlyReviewOf(m);
  const prev = prevMonthlyReview(m);
  const [note, setNote] = useState(saved?.note ?? '');

  const periodLabel = useMemo(() => {
    const s = parseISO(m.period.start), e = parseISO(m.period.end);
    return `${format(s, 'M.d')} – ${format(e, 'M.d')}`;
  }, [m.period.start, m.period.end]);

  const deficit = m.expense > m.income && m.income > 0;
  // 직전 회고 순자산 스냅샷(델타).
  const prevNet = typeof prev?.nextAdjustment?.netWorth === 'number' ? prev.nextAdjustment.netWorth as number : null;
  const netDelta = prevNet != null ? netWorth - prevNet : null;

  // 카테고리별 실제 지출(롤업) top — "어디에 썼나".
  const catRows = useMemo(() => {
    const totals = new Map<string | null, number>();
    for (const tx of m.periodTransactions) {
      if (tx.type !== 'expense') continue;
      const root = m.rootCategoryOf(tx.categoryId);
      const key = root?.id ?? null;
      totals.set(key, (totals.get(key) ?? 0) + tx.amount);
    }
    return [...totals.entries()]
      .map(([id, amount]) => {
        const cat = id ? m.categoryOf(id) : null;
        return { name: cat?.name ?? '미분류', color: resolveCategoryColor(cat), amount };
      })
      .sort((a, b) => b.amount - a.amount).slice(0, 4);
  }, [m.periodTransactions, m.rootCategoryOf, m.categoryOf]);

  const livingOver = plan ? livingActual > plan.plannedLiving : false;

  // 분배 도넛 — 계획(예상수입 기준) vs 실제(실제수입 기준).
  const planDonut = plan ? [
    { label: '고정 지출', value: plan.fixedCostTotal, color: SEG.fixed },
    { label: '저축+투자', value: plan.plannedSavings + plan.plannedInvestment, color: SEG.save },
    { label: '생활비', value: plan.plannedLiving, color: SEG.living },
  ] : [];
  const actualDonut = [
    { label: '고정 지출', value: fixedActual, color: SEG.fixed },
    { label: '생활비', value: livingActual, color: SEG.living },
    { label: '남은 돈', value: savingRoom, color: SEG.save },
  ];

  const save = async () => {
    await m.saveReview({
      type: 'monthly', weekIndex: null, totalSpent: m.expense,
      note: note.trim() || null,
      nextAdjustment: { netWorth, income: m.income, expense: m.expense, livingActual },
    });
    onClose();
  };

  const card = { background: t.bgSub, borderRadius: 14, padding: 14 };

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full lg:w-[500px] lg:max-w-[92vw] rounded-t-3xl lg:rounded-3xl"
        style={{ background: t.card, padding: '20px 20px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-start" style={{ marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>이번 달 회고</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{m.period.label} · {periodLabel}</div>
          </div>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {/* ① 계획 대비 실제 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>① 계획 대비 실제</div>
          {plan ? (
            <div style={card}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, color: t.textMuted, flex: 1 }}>항목</span>
                <span style={{ fontSize: 10.5, color: t.textMuted, width: 78, textAlign: 'right' }}>계획</span>
                <span style={{ fontSize: 10.5, color: t.textMuted, width: 84, textAlign: 'right' }}>실제</span>
                <span style={{ fontSize: 10.5, color: t.textMuted, width: 64, textAlign: 'right' }}>차이</span>
              </div>
              <CompareRow label="수입" planned={plan.expectedIncome} actual={m.income} t={t} goodWhenUnder={false} />
              <div style={{ height: 1, background: t.borderLight, margin: '6px 0' }} />
              <CompareRow label="고정 지출" planned={plan.fixedCostTotal} actual={fixedActual} t={t} />
              <CompareRow label="생활비(변동)" planned={plan.plannedLiving} actual={livingActual} t={t} />
              <CompareRow label="저축 여력" planned={plan.plannedSavings + plan.plannedInvestment} actual={savingRoom} t={t} goodWhenUnder={false} />
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', fontSize: 12, color: t.textMuted }}>
              월초 계획이 없어 비교할 수 없어요. 다음 달엔 계획을 세워보세요.
            </div>
          )}
          {/* 어디에 썼나 */}
          {catRows.length > 0 && (
            <div style={{ ...card, marginTop: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: t.textSub, marginBottom: 8 }}>어디에 썼나 (Top {catRows.length})</div>
              <div className="flex flex-col gap-2">
                {catRows.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-2" style={{ fontSize: 12.5, color: t.textSub }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block' }} />
                      {c.name}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{formatWon(c.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ② 이번 달 자산 변화 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>② 이번 달 자산 변화</div>
          <div className="flex gap-2">
            <div className="flex-1" style={{ ...card, padding: '13px 14px' }}>
              <div style={{ fontSize: 11, color: t.textSub }}>이번 달 모은 돈</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: m.balance >= 0 ? MONEY_PALETTE.green : MONEY_PALETTE.coral, marginTop: 2 }}>
                {m.balance >= 0 ? '+' : '−'}{formatManShort(Math.abs(m.balance))}
              </div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>수입 − 지출</div>
            </div>
            <div className="flex-1" style={{ ...card, padding: '13px 14px' }}>
              <div style={{ fontSize: 11, color: t.textSub }}>현재 순자산</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: t.text, marginTop: 2 }}>{formatManShort(netWorth)}</div>
              <div style={{ fontSize: 10, color: netDelta == null ? t.textMuted : (netDelta >= 0 ? MONEY_PALETTE.green : MONEY_PALETTE.coral), marginTop: 1 }}>
                {netDelta == null ? '자산−부채' : `전월 대비 ${netDelta >= 0 ? '+' : '−'}${formatManShort(Math.abs(netDelta))}`}
              </div>
            </div>
          </div>
          {deficit && (
            <div style={{ fontSize: 11.5, color: MONEY_PALETTE.coral, marginTop: 6, textAlign: 'center' }}>
              ⚠ 이번 달은 수입보다 지출이 많았어요.
            </div>
          )}
        </div>

        {/* ③ 수입 분배 회고 (계획 ↔ 실제) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>③ 수입 분배: 계획 vs 실제</div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex-1" style={{ ...card }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 8, textAlign: 'center' }}>계획</div>
              {plan
                ? <DistributionDonut segments={planDonut} total={plan.expectedIncome} />
                : <div style={{ fontSize: 11.5, color: t.textMuted, textAlign: 'center', padding: '20px 0' }}>계획 없음</div>}
            </div>
            <div className="flex-1" style={{ ...card }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 8, textAlign: 'center' }}>실제</div>
              {m.income > 0
                ? <DistributionDonut segments={actualDonut} total={m.income} />
                : <div style={{ fontSize: 11.5, color: t.textMuted, textAlign: 'center', padding: '20px 0' }}>수입 기록 없음</div>}
            </div>
          </div>
        </div>

        {/* ④ 다음 달 조정 */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>④ 다음 달 조정 <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>(선택)</span></div>
          <div style={{
            background: livingOver || deficit ? `${MONEY_PALETTE.coral}12` : `${MONEY_PALETTE.green}12`,
            borderRadius: 12, padding: '11px 14px', marginBottom: 10,
          }}>
            <span style={{ fontSize: 12, color: livingOver || deficit ? MONEY_PALETTE.coral : t.textSub }}>
              {!plan
                ? '다음 달엔 월초 계획을 세우면 이 비교가 더 정확해져요.'
                : livingOver
                  ? '생활비가 계획을 넘었어요. 다음 달 생활비 예산을 조금 늘리거나 지출을 점검해 볼까요?'
                  : deficit
                    ? '지출이 수입을 넘었어요. 다음 달은 고정비부터 점검해 봐요.'
                    : '계획 안에서 잘 지냈어요. 다음 달도 이대로 가요 👍'}
            </span>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="한 줄 소감 (예: 외식이 많았던 달 / 보너스로 저축 늘림)"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${t.border}`, fontSize: 13, color: t.text, background: 'transparent', outline: 'none', resize: 'none', fontFamily: t.font }} />
        </div>

        <button onClick={save} className="w-full"
          style={{ padding: 14, borderRadius: 12, background: MONEY_PALETTE.ink, color: '#FDFAF4', fontSize: 14, fontWeight: 700 }}>
          {saved ? '회고 수정' : '이번 달 회고 저장'}
        </button>
      </div>
    </div>
  );
}
