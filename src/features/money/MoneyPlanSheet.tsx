// 하온 머니 — Plan-Stage 1.5-A: 월초 "이번 달 계획하기" + 통장 쪼개기(자유 분배) + 생활비 한도.
//  흐름: 예상 수입 → 고정 지출 자동 차감(고정비+대출) → 가용 금액 → ④ 통장 쪼개기(자유 항목) → 생활비 한도 → 확인 도넛.
//  · ④ 분배: 고정 3칸(저축/투자/생활비)이 아니라, 사용자가 항목 자유 추가(월세/비상금/교정자금…). 항목마다 (선택) 연동 통장.
//  · 생활비 = "이번 달 생활비 한도". 자동(가용 − 다른 항목) 또는 직접 입력. 직접 입력 시 남는 건 "여유분".
//  · 통장 연결 시 "그 통장에 N원 보내기" 안내 생성(통장 쪼개기). 연결은 선택.
//  · 저장 시 money_plans 스냅샷 + money_plan_allocations(분배 항목) 통째 교체. 레거시 필드(저축/투자/생활비)도 롤업 보존.
import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../app/ThemeContext';
import { useMediaQuery } from '../../app/hooks/useMediaQuery';
import { MoneySheet } from './MoneySheet';
import type { UseMoney, AllocationInput } from './useMoney';
import type { MoneyAccount } from './types';
import { MONEY_PALETTE, formatWon, formatManShort, paletteColor } from './tokens';

// 도넛/리스트 고정 색(전부 토큰 경유 — 하드코딩 금지). 분배 항목은 paletteColor(index) 순환.
const SEG = {
  fixed: MONEY_PALETTE.gold,    // 고정비
  loan: MONEY_PALETTE.coral,    // 대출 상환
  living: MONEY_PALETTE.mute,   // 생활비(한도)
  surplus: MONEY_PALETTE.green, // 여유분(직접입력 시 남는 돈)
};

const uid = () => crypto.randomUUID();

// ── 수입 분배 확인 도넛(SVG 링) ── (월말 회고에서도 재사용 — 계획 vs 실제 비교)
//  · size 로 지름 조절(기본 128). PC 계획하기에서는 크게.
export function DistributionDonut({ segments, total, size = 128 }: { segments: { label: string; value: number; color: string }[]; total: number; size?: number }) {
  const { t } = useTheme();
  const r = size * 0.406, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r, sw = size * 0.125;
  const labelFont = Math.round(size / 11.6), valueFont = Math.round(size / 9.1);
  const active = segments.filter(s => s.value > 0);
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.bgSub} strokeWidth={sw} />
        {total > 0 && active.map((s, i) => {
          const frac = Math.min(1, s.value / total);
          const len = frac * C;
          const dash = `${len} ${C - len}`;
          const off = -acc;
          acc += len;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={dash} strokeDashoffset={off}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          );
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: labelFont, fill: t.textMuted }}>예상 수입</text>
        <text x={cx} y={cy + valueFont} textAnchor="middle" style={{ fontSize: valueFont, fontWeight: 700, fill: t.text }}>{formatManShort(total)}</text>
      </svg>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between" style={{ fontSize: 12 }}>
            <span className="flex items-center gap-2 min-w-0" style={{ color: t.textSub }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            </span>
            <span style={{ color: t.text, fontWeight: 600, flexShrink: 0 }}>
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

type Row = { key: string; name: string; amount: string; accountId: string | null };

export function MoneyPlanSheet({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');  // PC에서만 도넛 확대(레이아웃은 lg: 클래스)
  const plan = m.currentPlan;

  // ── 초기 분배 항목(시트 열릴 때 1회 스냅샷) — 저장된 allocations > 레거시 계획 필드 > 기본 시드 ──
  const initial = useMemo(() => {
    const saved = m.currentAllocations;
    const others = saved.filter(a => !a.isLiving);
    const livingA = saved.find(a => a.isLiving) ?? null;
    if (saved.length > 0) {
      return {
        rows: others.map(a => ({ key: a.id, name: a.name, amount: String(a.amount || ''), accountId: a.accountId } as Row)),
        livingName: livingA?.name ?? '생활비', livingAccountId: livingA?.accountId ?? null,
        savedLiving: livingA?.amount ?? 0, hadSaved: true,
      };
    }
    if (plan) {
      // 레거시(분배 항목 없던 기존 계획) — 저축/투자 금액에서 시드.
      const rows: Row[] = [];
      if (plan.plannedSavings > 0) rows.push({ key: uid(), name: '저축', amount: String(plan.plannedSavings), accountId: null });
      if (plan.plannedInvestment > 0) rows.push({ key: uid(), name: '투자', amount: String(plan.plannedInvestment), accountId: null });
      if (rows.length === 0) rows.push({ key: uid(), name: '저축', amount: '', accountId: null });
      return { rows, livingName: '생활비', livingAccountId: null, savedLiving: plan.plannedLiving, hadSaved: false };
    }
    // 신규 — 저축/투자 빈 칸 시드(나머지는 +항목 추가).
    return {
      rows: [
        { key: uid(), name: '저축', amount: '', accountId: null },
        { key: uid(), name: '투자', amount: '', accountId: null },
      ] as Row[],
      livingName: '생활비', livingAccountId: null, savedLiving: 0, hadSaved: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [income, setIncome] = useState(String(plan?.expectedIncome ?? ''));
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [livingName, setLivingName] = useState(initial.livingName);
  const [livingAccountId, setLivingAccountId] = useState<string | null>(initial.livingAccountId);
  const [livingDirect, setLivingDirect] = useState(initial.savedLiving ? String(initial.savedLiving) : '');
  // 생활비 한도 모드 — 저장된 한도가 (가용−다른항목)과 다르면 "직접 입력"으로 시작(자동 덮어쓰기 방지).
  const [mode, setMode] = useState<'auto' | 'direct'>(() => {
    if (!initial.hadSaved && !plan) return 'auto';
    const othersSum = initial.rows.reduce((s, r) => s + Math.max(0, Math.round(Number(r.amount) || 0)), 0);
    const avail = plan ? plan.availableAmount : 0;
    const auto = Math.max(0, avail - othersSum);
    return initial.savedLiving > 0 && Math.abs(initial.savedLiving - auto) > 1 ? 'direct' : 'auto';
  });

  const fixedMonthly = m.fixedMonthly;
  const loanMonthly = m.loanMonthly;
  const fixedCostTotal = fixedMonthly + loanMonthly;

  const incomeNum = Math.max(0, Math.round(Number(income) || 0));
  const available = incomeNum - fixedCostTotal;
  const overFixed = incomeNum > 0 && available < 0;          // 고정 지출이 수입 초과

  const rowNums = rows.map(r => Math.max(0, Math.round(Number(r.amount) || 0)));
  const othersSum = rowNums.reduce((s, n) => s + n, 0);
  const overSplit = !overFixed && othersSum > available;     // 분배 항목 합이 가용 초과
  const remainForLiving = available - othersSum;             // 생활비로 쓸 수 있는 최대
  const livingAuto = Math.max(0, remainForLiving);
  const livingDirectNum = Math.max(0, Math.round(Number(livingDirect) || 0));
  const living = mode === 'auto' ? livingAuto : livingDirectNum;
  const overLiving = mode === 'direct' && livingDirectNum > remainForLiving;
  const surplus = mode === 'direct' && !overLiving ? Math.max(0, remainForLiving - living) : 0;

  const canSave = incomeNum > 0 && !overFixed && !overSplit && !overLiving;

  // 레거시 호환 롤업 — plannedInvestment = '투자' 항목 합, plannedSavings = 나머지 비생활비 항목 합.
  const investSum = rows.reduce((s, r, i) => s + (r.name.trim() === '투자' ? rowNums[i] : 0), 0);
  const savingsSum = othersSum - investSum;

  const accountName = (id: string | null) => m.accounts.find(a => a.id === id)?.name ?? null;
  // 통장 연결된 항목 → "그 통장에 N원 보내기" 안내(통장 쪼개기).
  const transfers = useMemo(() => {
    const list = [
      ...rows.map((r, i) => ({ amount: rowNums[i], accountId: r.accountId })),
      { amount: living, accountId: livingAccountId },
    ];
    return list
      .map(x => ({ amount: x.amount, account: accountName(x.accountId) }))
      .filter(x => x.account && x.amount > 0) as { amount: number; account: string }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowNums, living, livingAccountId, m.accounts]);

  const periodLabel = useMemo(() => {
    const s = parseISO(m.period.start), e = parseISO(m.period.end);
    return `${format(s, 'M.d')} – ${format(e, 'M.d')}`;
  }, [m.period.start, m.period.end]);

  const save = async () => {
    if (!canSave) return;
    const allocs: AllocationInput[] = [];
    rows.forEach((r, i) => {
      if (r.name.trim() && rowNums[i] > 0) {
        allocs.push({ name: r.name.trim(), amount: rowNums[i], accountId: r.accountId, isLiving: false, sortOrder: i });
      }
    });
    allocs.push({ name: livingName.trim() || '생활비', amount: living, accountId: livingAccountId, isLiving: true, sortOrder: rows.length });
    await m.savePlan({
      expectedIncome: incomeNum,
      fixedCostTotal,
      availableAmount: Math.max(0, available),
      plannedSavings: savingsSum,
      plannedInvestment: investSum,
      plannedLiving: living,
      livingLimit: living,
      allocations: allocs,
    });
    onClose();
  };

  const updateRow = (key: string, patch: Partial<Row>) => setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));
  const addRow = () => setRows(prev => [...prev, { key: uid(), name: '', amount: '', accountId: null }]);

  const input = {
    width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${t.border}`,
    fontSize: 18, fontWeight: 700, color: t.text, background: 'transparent', outline: 'none', textAlign: 'right' as const,
  };
  const card = { background: t.bgSub, borderRadius: 14, padding: 14 };
  const toggleBtn = (active: boolean) => ({
    padding: '4px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    background: active ? t.card : 'transparent', color: active ? t.text : t.textMuted,
    boxShadow: active ? t.shadow : 'none', border: 'none',
  });

  const donutSegments = [
    { label: '고정비', value: fixedMonthly, color: SEG.fixed },
    { label: '대출 상환', value: loanMonthly, color: SEG.loan },
    ...rows.map((r, i) => ({ label: r.name.trim() || `항목 ${i + 1}`, value: overFixed ? 0 : rowNums[i], color: paletteColor(i) })),
    { label: livingName.trim() || '생활비', value: overFixed ? 0 : living, color: SEG.living },
    { label: '여유분', value: overFixed ? 0 : surplus, color: SEG.surplus },
  ].filter(s => s.value > 0 || s.label === (livingName.trim() || '생활비'));

  return (
    <MoneySheet onClose={onClose} size="wide">
        {/* 헤더 */}
        <div className="flex justify-between items-start" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>이번 달 계획하기</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{m.period.label} · {periodLabel}</div>
          </div>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {/* PC: 좌(수입·고정·가용) + 우(분배·도넛) 2단 / 모바일: 단일 컬럼(순서 동일) */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-7 lg:items-start">
        {/* ── 좌측: 입력(수입·고정·가용) ── */}
        <div className="lg:min-w-0">
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
        </div>{/* ── /좌측 ── */}

        {/* ── 우측: 분배 + 도넛(메인) ── */}
        <div className="lg:min-w-0">
        {/* 4. 통장 쪼개기(자유 분배) */}
        <div style={{ marginBottom: 16, opacity: overFixed ? 0.45 : 1, pointerEvents: overFixed ? 'none' : 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>④ 통장 쪼개기 (분배)</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>나갈 돈·저축을 먼저 떼고, 남는 게 이번 달 생활비 한도예요.</div>
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <AllocRow key={r.key} row={r} color={paletteColor(i)} accounts={m.accounts} t={t}
                onName={v => updateRow(r.key, { name: v })}
                onAmount={v => updateRow(r.key, { amount: v })}
                onAccount={v => updateRow(r.key, { accountId: v })}
                onRemove={() => removeRow(r.key)} />
            ))}
            <button onClick={addRow} className="flex items-center justify-center gap-1.5"
              style={{ padding: 10, borderRadius: 12, border: `1.5px dashed ${t.border}`, color: t.textSub, fontSize: 12.5, fontWeight: 600, background: 'transparent' }}>
              <Plus size={14} /> 항목 추가 (월세 · 비상금 · 교정자금 등)
            </button>

            {/* 생활비 한도 */}
            <div style={{ background: `${MONEY_PALETTE.gold}14`, border: `1px solid ${MONEY_PALETTE.gold}40`, borderRadius: 14, padding: '12px 14px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: SEG.living, display: 'inline-block' }} />
                  생활비 한도
                </span>
                <div className="flex" style={{ background: t.bgSub, borderRadius: 9, padding: 2 }}>
                  <button onClick={() => setMode('auto')} style={toggleBtn(mode === 'auto')}>자동</button>
                  <button onClick={() => setMode('direct')} style={toggleBtn(mode === 'direct')}>직접</button>
                </div>
              </div>
              {mode === 'auto' ? (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: t.textMuted }}>가용 − 분배 항목 = 자동</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: overSplit ? MONEY_PALETTE.coral : t.text }}>{formatWon(living)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 justify-end">
                  <input type="number" inputMode="numeric" value={livingDirect} onChange={e => setLivingDirect(e.target.value)} placeholder="0"
                    style={{ width: 150, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${overLiving ? MONEY_PALETTE.coral : t.border}`, fontSize: 16, fontWeight: 700, color: t.text, background: t.card, outline: 'none', textAlign: 'right' }} />
                  <span style={{ fontSize: 12, color: t.textMuted }}>원</span>
                </div>
              )}
              {m.accounts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <AccountSelect value={livingAccountId} accounts={m.accounts} t={t} onChange={setLivingAccountId} />
                </div>
              )}
            </div>
          </div>

          {overSplit && (
            <div style={{ fontSize: 11.5, color: MONEY_PALETTE.coral, marginTop: 6, textAlign: 'center' }}>
              ⚠ 분배 항목 합이 가용 금액을 초과했어요. 금액을 줄여 주세요.
            </div>
          )}
          {overLiving && (
            <div style={{ fontSize: 11.5, color: MONEY_PALETTE.coral, marginTop: 6, textAlign: 'center' }}>
              ⚠ 생활비 한도가 남은 금액({formatWon(Math.max(0, remainForLiving))})을 초과했어요.
            </div>
          )}
          {surplus > 0 && (
            <div style={{ fontSize: 11.5, color: MONEY_PALETTE.green, marginTop: 6, textAlign: 'center' }}>
              여유분 {formatWon(surplus)} — 저축에 더 넣거나 다음 달로 남겨둘 수 있어요.
            </div>
          )}
        </div>

        {/* 통장별 보내기 안내(통장 쪼개기) */}
        {!overFixed && transfers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>📮 통장별 보내기 안내</div>
            <div style={card}>
              {transfers.map((x, i) => (
                <div key={i} className="flex items-center justify-between" style={{ padding: '3px 0', fontSize: 12.5 }}>
                  <span style={{ color: t.textSub }}>{x.account} 통장으로</span>
                  <span style={{ color: t.text, fontWeight: 700 }}>{formatWon(x.amount)} 보내기</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. 수입 분배 확인 도넛 */}
        {incomeNum > 0 && !overFixed && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>⑤ 수입 분배 확인</div>
            <div style={{ ...card, padding: 16 }}>
              <DistributionDonut segments={donutSegments} total={incomeNum} size={isDesktop ? 176 : 128} />
            </div>
          </div>
        )}
        </div>{/* ── /우측 ── */}
        </div>{/* ── /2단 그리드 ── */}

      <button onClick={save} disabled={!canSave} className="w-full"
        style={{ padding: 14, borderRadius: 12, background: canSave ? MONEY_PALETTE.ink : t.border, color: '#FDFAF4', fontSize: 14, fontWeight: 700, opacity: canSave ? 1 : 0.7 }}>
        {plan ? '계획 수정하기' : '이번 달 계획 저장'}
      </button>
    </MoneySheet>
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

// 분배 항목 행(이름 + 금액 + 삭제 + (선택) 연동 통장)
function AllocRow({ row, color, accounts, t, onName, onAmount, onAccount, onRemove }: {
  row: Row; color: string; accounts: MoneyAccount[]; t: any;
  onName: (v: string) => void; onAmount: (v: string) => void; onAccount: (v: string | null) => void; onRemove: () => void;
}) {
  return (
    <div style={{ background: t.bgSub, borderRadius: 14, padding: '10px 12px' }}>
      <div className="flex items-center gap-2">
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0 }} />
        <input value={row.name} onChange={e => onName(e.target.value)} placeholder="항목명 (예: 월세)"
          style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 8, border: `1.5px solid ${t.border}`, fontSize: 13, color: t.text, background: t.card, outline: 'none' }} />
        <input type="number" inputMode="numeric" value={row.amount} onChange={e => onAmount(e.target.value)} placeholder="0"
          style={{ width: 108, padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.text, background: t.card, outline: 'none', textAlign: 'right' }} />
        <button onClick={onRemove} style={{ color: t.textMuted, flexShrink: 0, padding: 2 }}><Trash2 size={15} /></button>
      </div>
      {accounts.length > 0 && (
        <div style={{ marginTop: 7 }}>
          <AccountSelect value={row.accountId} accounts={accounts} t={t} onChange={onAccount} />
        </div>
      )}
    </div>
  );
}

// 연동 통장 선택(선택) — 등록된 통장 있을 때만 노출.
function AccountSelect({ value, accounts, t, onChange }: {
  value: string | null; accounts: MoneyAccount[]; t: any; onChange: (v: string | null) => void;
}) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}
      style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${t.border}`, fontSize: 12, color: value ? t.text : t.textMuted, background: t.card, outline: 'none' }}>
      <option value="">연동 통장 없음</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} 통장으로 보내기</option>)}
    </select>
  );
}
