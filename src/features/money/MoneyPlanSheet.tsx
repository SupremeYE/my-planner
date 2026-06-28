// 하온 머니 — Plan-Stage 1: 월초 "이번 달 계획하기" 화면(오버레이 시트).
//  흐름: 예상 수입 → 고정 지출 자동 차감(고정비+대출) → 가용 금액 → 선저축 분배(저축/투자/생활비) → 확인 도넛.
//  · 고정비/대출은 라이브 파생(m.fixedMonthly/m.loanMonthly) — 입력 불필요, 자동 표시.
//  · 저축/투자만 입력하고 생활비는 자동(가용 − 저축 − 투자) = "선저축 후지출".
//  · 저장 시 스냅샷(fixedCostTotal/availableAmount)까지 persist(회고 단계 비교 기준).
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../app/ThemeContext';
import type { UseMoney } from './useMoney';
import { MONEY_PALETTE, formatWon, formatManShort, INVEST_KIND_META } from './tokens';

// 분배 세그먼트 색(전부 토큰/의미론 상수 경유 — 하드코딩 금지).
const SEG = {
  fixed: MONEY_PALETTE.gold,                 // 고정비
  loan: MONEY_PALETTE.coral,                 // 대출 상환
  savings: MONEY_PALETTE.green,              // 저축
  invest: INVEST_KIND_META.stock.color,      // 투자(주식 식별색 재사용)
  living: MONEY_PALETTE.mute,                // 생활비(변동)
};

// ── 수입 분배 확인 도넛(SVG 링) ──
function DistributionDonut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const { t } = useTheme();
  const r = 52, cx = 64, cy = 64, C = 2 * Math.PI * r;
  const active = segments.filter(s => s.value > 0);
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={128} height={128} viewBox="0 0 128 128" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.bgSub} strokeWidth={16} />
        {total > 0 && active.map((s, i) => {
          const frac = Math.min(1, s.value / total);
          const len = frac * C;
          const dash = `${len} ${C - len}`;
          const off = -acc;
          acc += len;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={16}
              strokeDasharray={dash} strokeDashoffset={off}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          );
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: 11, fill: t.textMuted }}>예상 수입</text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: t.text }}>{formatManShort(total)}</text>
      </svg>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between" style={{ fontSize: 12 }}>
            <span className="flex items-center gap-2" style={{ color: t.textSub }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block' }} />
              {s.label}
            </span>
            <span style={{ color: t.text, fontWeight: 600 }}>
              {formatManShort(s.value)}
              <span style={{ color: t.textMuted, fontWeight: 400, marginLeft: 5 }}>
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MoneyPlanSheet({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const plan = m.currentPlan;
  // 입력 상태(원 단위). 기존 계획 있으면 프리필.
  const [income, setIncome] = useState(String(plan?.expectedIncome ?? ''));
  const [savings, setSavings] = useState(String(plan?.plannedSavings ?? ''));
  const [invest, setInvest] = useState(String(plan?.plannedInvestment ?? ''));

  const fixedMonthly = m.fixedMonthly;
  const loanMonthly = m.loanMonthly;
  const fixedCostTotal = fixedMonthly + loanMonthly;

  const incomeNum = Math.max(0, Math.round(Number(income) || 0));
  const savingsNum = Math.max(0, Math.round(Number(savings) || 0));
  const investNum = Math.max(0, Math.round(Number(invest) || 0));
  const available = incomeNum - fixedCostTotal;
  const overFixed = incomeNum > 0 && available < 0;          // 고정 지출이 수입 초과
  const livingRaw = available - savingsNum - investNum;
  const living = Math.max(0, livingRaw);
  const overSplit = !overFixed && livingRaw < 0;             // 저축+투자가 가용 초과

  const canSave = incomeNum > 0 && !overSplit;

  const periodLabel = useMemo(() => {
    const s = parseISO(m.period.start), e = parseISO(m.period.end);
    return `${format(s, 'M.d')} – ${format(e, 'M.d')}`;
  }, [m.period.start, m.period.end]);

  const save = async () => {
    if (!canSave) return;
    await m.savePlan({
      expectedIncome: incomeNum,
      fixedCostTotal,
      availableAmount: Math.max(0, available),
      plannedSavings: overFixed ? 0 : savingsNum,
      plannedInvestment: overFixed ? 0 : investNum,
      plannedLiving: overFixed ? 0 : living,
    });
    onClose();
  };

  const input = {
    width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${t.border}`,
    fontSize: 18, fontWeight: 700, color: t.text, background: 'transparent', outline: 'none', textAlign: 'right' as const,
  };
  const card = { background: t.bgSub, borderRadius: 14, padding: 14 };

  const donutSegments = [
    { label: '고정비', value: fixedMonthly, color: SEG.fixed },
    { label: '대출 상환', value: loanMonthly, color: SEG.loan },
    { label: '저축', value: overFixed ? 0 : savingsNum, color: SEG.savings },
    { label: '투자', value: overFixed ? 0 : investNum, color: SEG.invest },
    { label: '생활비', value: overFixed ? 0 : living, color: SEG.living },
  ].filter(s => s.value > 0 || s.label === '생활비');

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full lg:w-[480px] lg:max-w-[92vw] rounded-t-3xl lg:rounded-3xl"
        style={{ background: t.card, padding: '20px 20px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-start" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>이번 달 계획하기</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{m.period.label} · {periodLabel}</div>
          </div>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {/* 1. 예상 수입 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>① 이번 달 예상 수입</div>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" value={income} onChange={e => setIncome(e.target.value)}
              placeholder="0" style={input} />
            <span style={{ fontSize: 14, color: t.textSub, flexShrink: 0 }}>원</span>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5, textAlign: 'right' }}>
            {incomeNum > 0 ? `${formatManShort(incomeNum)}원 · 월급 + 부수입 합산` : '월급 + 부수입을 합쳐 입력'}
          </div>
        </div>

        {/* 2. 고정 지출 자동 차감 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>② 고정 지출 (자동 차감)</div>
          <div style={card}>
            <Row label="고정비 (구독·통신·보험·주거)" sub={`월 환산 ${m.fixedCosts.length}건`} value={fixedMonthly} t={t} color={SEG.fixed} />
            <div style={{ height: 1, background: t.borderLight, margin: '10px 0' }} />
            <Row label="대출 월 상환" sub={`${m.loans.length}건`} value={loanMonthly} t={t} color={SEG.loan} />
            <div style={{ height: 1, background: t.borderLight, margin: '10px 0' }} />
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>어쩔 수 없이 나갈 돈</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{formatWon(fixedCostTotal)}</span>
            </div>
          </div>
        </div>

        {/* 3. 가용 금액 */}
        <div style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between" style={{
            background: overFixed ? `${MONEY_PALETTE.coral}14` : `${MONEY_PALETTE.gold}14`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div>
              <div style={{ fontSize: 12, color: t.textSub }}>③ 이번 달 가용 금액</div>
              <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>예상 수입 − 고정 지출</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: overFixed ? MONEY_PALETTE.coral : MONEY_PALETTE.gold }}>
              {formatWon(available)}
            </div>
          </div>
          {overFixed && (
            <div style={{ fontSize: 11.5, color: MONEY_PALETTE.coral, marginTop: 6, textAlign: 'center' }}>
              ⚠ 고정 지출이 예상 수입을 초과해요. 수입을 확인하거나 고정비를 점검해 보세요.
            </div>
          )}
        </div>

        {/* 4. 선저축 후지출 분배 */}
        <div style={{ marginBottom: 16, opacity: overFixed ? 0.45 : 1, pointerEvents: overFixed ? 'none' : 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>④ 선저축 후지출 분배</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>저축·투자를 먼저 떼고, 남는 게 생활비예요.</div>
          <div className="flex flex-col gap-2">
            <SplitInput label="저축" color={SEG.savings} value={savings} onChange={setSavings} t={t} />
            <SplitInput label="투자" color={SEG.invest} value={invest} onChange={setInvest} t={t} />
            <div className="flex items-center justify-between" style={{ ...card, padding: '12px 14px' }}>
              <span className="flex items-center gap-2" style={{ fontSize: 13, color: t.textSub }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: SEG.living, display: 'inline-block' }} />
                생활비 <span style={{ fontSize: 10.5, color: t.textMuted }}>(자동)</span>
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: overSplit ? MONEY_PALETTE.coral : t.text }}>{formatWon(living)}</span>
            </div>
          </div>
          {overSplit && (
            <div style={{ fontSize: 11.5, color: MONEY_PALETTE.coral, marginTop: 6, textAlign: 'center' }}>
              ⚠ 저축+투자가 가용 금액을 초과했어요. 금액을 줄여 주세요.
            </div>
          )}
        </div>

        {/* 5. 수입 분배 확인 도넛 */}
        {incomeNum > 0 && !overFixed && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>⑤ 수입 분배 확인</div>
            <div style={{ ...card, padding: 16 }}>
              <DistributionDonut segments={donutSegments} total={incomeNum} />
            </div>
          </div>
        )}

        <button onClick={save} disabled={!canSave} className="w-full"
          style={{ padding: 14, borderRadius: 12, background: canSave ? MONEY_PALETTE.ink : t.border, color: '#FDFAF4', fontSize: 14, fontWeight: 700, opacity: canSave ? 1 : 0.7 }}>
          {plan ? '계획 수정하기' : '이번 달 계획 저장'}
        </button>
      </div>
    </div>
  );
}

// 고정비/대출 행
function Row({ label, sub, value, t, color }: { label: string; sub: string; value: number; t: any; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 min-w-0">
        <span style={{ width: 9, height: 9, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0 }} />
        <span className="min-w-0">
          <span style={{ fontSize: 12.5, color: t.textSub, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <span style={{ fontSize: 10.5, color: t.textMuted }}>{sub}</span>
        </span>
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: t.text, flexShrink: 0 }}>{formatWon(value)}</span>
    </div>
  );
}

// 저축/투자 입력 행
function SplitInput({ label, color, value, onChange, t }: { label: string; color: string; value: string; onChange: (v: string) => void; t: any }) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ background: t.bgSub, borderRadius: 14, padding: '10px 14px' }}>
      <span className="flex items-center gap-2 flex-shrink-0" style={{ fontSize: 13, color: t.textSub }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <input type="number" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder="0"
          style={{ width: 130, padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${t.border}`, fontSize: 15, fontWeight: 700, color: t.text, background: t.card, outline: 'none', textAlign: 'right' }} />
        <span style={{ fontSize: 12, color: t.textMuted }}>원</span>
      </div>
    </div>
  );
}
