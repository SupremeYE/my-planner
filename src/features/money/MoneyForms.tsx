// 하온 머니 — 수정/삭제 폼 시트(추가·편집 겸용). 모바일 바텀시트 / PC 중앙 모달(lg:).
// 패턴 통일: 항목 탭 = 편집 시트 열기 / 시트 안에 저장 + 삭제(인라인 확인). 추가 = 같은 폼 빈 값.
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { MoneySheet } from './MoneySheet';
import { MONEY_PALETTE, CUSTOM_PALETTE } from './tokens';
import { fetchFxRate, CURRENCY_SYMBOL } from './fx';
import type { UseMoney } from './useMoney';
import type {
  MoneyCategory, MoneyTransaction, MoneyAccount, MoneyCard, MoneyFixedCost, MoneyLoan, MoneyGoal,
  TxType, AccountType, InvestKind, CardType, FixedCycle, Currency, GoalType,
} from './types';

const uuid = () => crypto.randomUUID();
const numOrNull = (s: string): number | null => { const n = Number(s.replace(/,/g, '')); return s.trim() && Number.isFinite(n) ? n : null; };
const intVal = (s: string): number => { const n = Math.round(Number(s.replace(/,/g, ''))); return Number.isFinite(n) ? n : 0; };

// ── 필드 키트 ──
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: t.textSub, minWidth: 64, flexShrink: 0 }}>{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
function inputStyle(t: any): React.CSSProperties {
  return { width: '100%', padding: '9px 12px', border: `1.5px solid ${t.border}`, borderRadius: 10, fontSize: 13, color: t.text, background: 'transparent', outline: 'none', fontFamily: t.font };
}
function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const { t } = useTheme();
  return <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
    onFocus={e => (e.currentTarget.style.borderColor = MONEY_PALETTE.gold)}
    onBlur={e => (e.currentTarget.style.borderColor = t.border)}
    style={inputStyle(t)} />;
}
function SelectInput<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const { t } = useTheme();
  return (
    <select value={value} onChange={e => onChange(e.target.value as T)} style={{ ...inputStyle(t), background: t.card, cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const { t } = useTheme();
  return (
    <div className="flex gap-1">
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, cursor: 'pointer', fontFamily: t.font,
              border: `1.5px solid ${active ? MONEY_PALETTE.gold : t.border}`,
              background: active ? `${MONEY_PALETTE.gold}18` : 'transparent',
              color: active ? t.text : t.textSub, fontWeight: active ? 600 : 400 }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
function ColorPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {CUSTOM_PALETTE.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
            border: value === c ? `2px solid ${MONEY_PALETTE.ink}` : '2px solid transparent' }} />
      ))}
    </div>
  );
}

// ── 시트 셸(저장 + 삭제[인라인 확인]) ──
export function FormSheet({ title, onClose, onSave, onDelete, canSave = true, deleteWarning, children }: {
  title: string; onClose: () => void; onSave: () => void; onDelete?: () => void; canSave?: boolean;
  deleteWarning?: string; children: React.ReactNode;
}) {
  const { t } = useTheme();
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <MoneySheet onClose={onClose} variant="side" size="md" maxVh={88}>
        <div className="flex justify-between items-center" style={{ marginBottom: 18 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{title}</span>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {children}

        {confirmDel ? (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: `${MONEY_PALETTE.coral}12`, border: `1px solid ${MONEY_PALETTE.coral}40` }}>
            <div style={{ fontSize: 13, color: t.text, marginBottom: 10, fontWeight: 600 }}>{deleteWarning ?? '정말 삭제할까요? 되돌릴 수 없어요.'}</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: 10, borderRadius: 10, background: t.bgSub, color: t.textSub, fontSize: 13, fontWeight: 600 }}>취소</button>
              <button onClick={() => { onDelete?.(); onClose(); }} style={{ flex: 1, padding: 10, borderRadius: 10, background: MONEY_PALETTE.coral, color: '#fff', fontSize: 13, fontWeight: 600 }}>삭제</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2" style={{ marginTop: 16 }}>
            {onDelete && (
              <button onClick={() => setConfirmDel(true)}
                style={{ padding: '12px 16px', borderRadius: 12, background: 'transparent', border: `1.5px solid ${MONEY_PALETTE.coral}`, color: MONEY_PALETTE.coral, fontSize: 14, fontWeight: 600 }}>
                삭제
              </button>
            )}
            <button onClick={onSave} disabled={!canSave}
              style={{ flex: 1, padding: 12, borderRadius: 12, background: MONEY_PALETTE.ink, color: '#FDFAF4', fontSize: 14, fontWeight: 600, opacity: canSave ? 1 : 0.4 }}>
              저장
            </button>
          </div>
        )}
    </MoneySheet>
  );
}

// 결제수단 입력 — 등록된 카드/통장이 있으면 드롭다운, 없으면 자유 입력(graceful).
// 채팅에서 매칭 안 됐어도 여기서 수동 지정 가능. 현재 값이 목록에 없으면 그 값도 옵션으로 보존.
function PaymentMethodField({ m, value, onChange }: { m: UseMoney; value: string; onChange: (v: string) => void }) {
  const methods = [
    ...m.cards.map(c => ({ value: c.name, label: `💳 ${c.name}` })),
    ...m.accounts.map(a => ({ value: a.name, label: `🏦 ${a.name}` })),
  ];
  if (methods.length === 0) {
    return <TextInput value={value} onChange={onChange} placeholder="자산 탭에서 카드/통장 등록 시 선택 가능" />;
  }
  const known = methods.some(o => o.value === value);
  const options = [
    { value: '', label: '없음' },
    ...methods,
    ...(value && !known ? [{ value, label: value }] : []),
  ];
  return <SelectInput value={value} onChange={onChange} options={options} />;
}

// ── 1) 거래 ──
export function TransactionForm({ m, item, presetDate, onClose }: { m: UseMoney; item: MoneyTransaction | null; presetDate?: string; onClose: () => void }) {
  const [type, setType] = useState<TxType>(item?.type ?? 'expense');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  // categoryId 는 대분류(parentId) + 소분류(subId)로 분리 편집. 저장 시 subId가 있으면 소분류 id, 없으면 대분류 id.
  const initCat = m.categoryOf(item?.categoryId ?? null);
  const [parentId, setParentId] = useState(initCat ? (initCat.parentId ?? initCat.id) : '');
  const [subId, setSubId] = useState(initCat?.parentId ? initCat.id : '');
  // 날짜 기본값: 편집=기존 날짜 / 신규=지정 날짜(캘린더 탭 등) / 그 외=오늘.
  const [spentAt, setSpentAt] = useState(item?.spentAt ?? presetDate ?? new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState(item?.memo ?? '');
  const [pm, setPm] = useState(item?.paymentMethod ?? '');
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const cats = type === 'expense' ? m.expenseCategories : m.incomeCategories;
  const subs = m.subcategoriesOf(parentId || null);

  const save = () => {
    m.addTransaction({
      id: item?.id, type, amount: intVal(amount), categoryId: subId || parentId || null,
      memo: memo.trim() || null, paymentMethod: pm.trim() || null, spentAt,
      emoji: emoji.trim() || null, source: item?.source ?? 'manual', rawInput: item?.rawInput ?? null,
    });
    onClose();
  };
  return (
    <FormSheet title={item ? '거래 수정' : '거래 추가'} onClose={onClose} onSave={save}
      onDelete={item ? () => m.deleteTransaction(item.id) : undefined} canSave={intVal(amount) > 0}>
      <Field label="유형"><Seg value={type} onChange={(v) => { setType(v); setParentId(''); setSubId(''); }} options={[{ value: 'expense', label: '지출' }, { value: 'income', label: '수입' }]} /></Field>
      <Field label="금액"><TextInput value={amount} onChange={setAmount} placeholder="금액(원)" type="number" /></Field>
      <Field label="카테고리"><SelectInput value={parentId} onChange={(v) => { setParentId(v); setSubId(''); }} options={[{ value: '', label: '미분류' }, ...cats.map(c => ({ value: c.id, label: `${c.emoji ?? ''} ${c.name}`.trim() }))]} /></Field>
      {subs.length > 0 && (
        <Field label="소분류"><SelectInput value={subId} onChange={setSubId} options={[{ value: '', label: '전체(대분류)' }, ...subs.map(s => ({ value: s.id, label: s.name }))]} /></Field>
      )}
      <Field label="날짜"><TextInput value={spentAt} onChange={setSpentAt} type="date" /></Field>
      <Field label="메모"><TextInput value={memo} onChange={setMemo} placeholder="예: 갈비 사먹음" /></Field>
      <Field label="결제수단"><PaymentMethodField m={m} value={pm} onChange={setPm} /></Field>
      <Field label="이모지"><TextInput value={emoji} onChange={setEmoji} placeholder="🍖 (선택)" /></Field>
    </FormSheet>
  );
}

// ── 2) 통장/자산 ──
export function AccountForm({ m, item, onClose, defaultType = 'deposit' }: { m: UseMoney; item: MoneyAccount | null; onClose: () => void; defaultType?: AccountType }) {
  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<AccountType>(item?.type ?? defaultType);
  const [balance, setBalance] = useState(item ? String(item.balance) : '');
  const [rate, setRate] = useState(item?.interestRate != null ? String(item.interestRate) : '');
  const [icon, setIcon] = useState(item?.icon ?? '');
  // 투자계좌 전용 필드
  const [investKind, setInvestKind] = useState<InvestKind>(item?.investKind ?? 'stock');
  const [principal, setPrincipal] = useState(item?.principal != null ? String(item.principal) : '');
  const [quantity, setQuantity] = useState(item?.quantity != null ? String(item.quantity) : '');
  const isInvest = type === 'investment';
  const save = () => {
    m.saveAccount({
      id: item?.id ?? uuid(), name: name.trim(), type, balance: intVal(balance),
      interestRate: isInvest ? null : numOrNull(rate), icon: icon.trim() || null, sortOrder: item?.sortOrder ?? 0,
      investKind: isInvest ? investKind : null,
      principal: isInvest ? numOrNull(principal) : null,
      quantity: isInvest ? numOrNull(quantity) : null,
    });
    onClose();
  };
  return (
    <FormSheet title={item ? '자산 수정' : '자산 추가'} onClose={onClose} onSave={save} onDelete={item ? () => m.deleteAccount(item.id) : undefined} canSave={!!name.trim()}>
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder={isInvest ? '예: 삼성전자' : '예: 카뱅 저금통'} /></Field>
      <Field label="종류"><SelectInput value={type} onChange={setType} options={[{ value: 'deposit', label: '예금' }, { value: 'savings', label: '적금' }, { value: 'cash', label: '현금' }, { value: 'investment', label: '투자' }]} /></Field>
      {isInvest && (
        <Field label="종목구분"><Seg value={investKind} onChange={setInvestKind} options={[{ value: 'stock', label: '주식' }, { value: 'fund', label: '펀드' }, { value: 'coin', label: '코인' }]} /></Field>
      )}
      <Field label={isInvest ? '평가액' : '잔액'}><TextInput value={balance} onChange={setBalance} placeholder={isInvest ? '현재 평가액(원)' : '잔액(원)'} type="number" /></Field>
      {isInvest ? (
        <>
          <Field label="매입원금"><TextInput value={principal} onChange={setPrincipal} placeholder="투자 원금(원) · 수익률 기준" type="number" /></Field>
          <Field label="보유수량"><TextInput value={quantity} onChange={setQuantity} placeholder="주/구좌/개 (선택)" type="number" /></Field>
        </>
      ) : (
        <Field label="연이율"><TextInput value={rate} onChange={setRate} placeholder="% (선택)" type="number" /></Field>
      )}
      <Field label="이모지"><TextInput value={icon} onChange={setIcon} placeholder={isInvest ? '📈 (선택)' : '🏦 (선택)'} /></Field>
    </FormSheet>
  );
}

// ── 3) 카드 ──
export function CardForm({ m, item, onClose }: { m: UseMoney; item: MoneyCard | null; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<CardType>(item?.type ?? 'credit');
  const [unpaid, setUnpaid] = useState(item ? String(item.unpaidAmount) : '');
  const [billingDay, setBillingDay] = useState(item?.billingDay != null ? String(item.billingDay) : '');
  const [color, setColor] = useState<string | null>(item?.color ?? null);
  const save = () => {
    m.saveCard({ id: item?.id ?? uuid(), name: name.trim(), type, color, billingDay: numOrNull(billingDay), unpaidAmount: intVal(unpaid), sortOrder: item?.sortOrder ?? 0 });
    onClose();
  };
  return (
    <FormSheet title={item ? '카드 수정' : '카드 추가'} onClose={onClose} onSave={save} onDelete={item ? () => m.deleteCard(item.id) : undefined} canSave={!!name.trim()}>
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder="예: 삼성카드" /></Field>
      <Field label="종류"><Seg value={type} onChange={setType} options={[{ value: 'credit', label: '신용' }, { value: 'check', label: '체크' }]} /></Field>
      {type === 'credit' && (
        <>
          <Field label="기준 미결제액"><TextInput value={unpaid} onChange={setUnpaid} placeholder="이월액(선택) · 0" type="number" /></Field>
          <Field label="결제일"><TextInput value={billingDay} onChange={setBillingDay} placeholder="매월 N일" type="number" /></Field>
          <div style={{ fontSize: 11, color: MONEY_PALETTE.mute, margin: '-4px 0 12px', paddingLeft: 76 }}>
            실제 미결제액 = 기준 이월액 + 이 카드로 태그된 미청구 거래 합(자동)
          </div>
        </>
      )}
      <Field label="색상"><ColorPicker value={color} onChange={setColor} /></Field>
    </FormSheet>
  );
}

// ── 4) 고정비 ──
//  · 외화 선택 시: "외화 원금"만 입력 → 현재 환율(Frankfurter)로 원화 자동 환산(수동 입력 불필요).
//    실제 결제일엔 그날 환율로 거래가 자동 기록(useMoney.settleFixedCosts). 여기 표시는 "현재 환율 기준 예상".
export function FixedCostForm({ m, item, onClose }: { m: UseMoney; item: MoneyFixedCost | null; onClose: () => void }) {
  const { t } = useTheme();
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');   // KRW 직접입력 / 외화 환율실패 폴백
  const [currency, setCurrency] = useState<Currency>(item?.currency ?? 'KRW');
  const [original, setOriginal] = useState(item?.originalAmount != null ? String(item.originalAmount) : '');
  const [cycle, setCycle] = useState<FixedCycle>(item?.cycle ?? 'monthly');
  const [billingDay, setBillingDay] = useState(item?.billingDay != null ? String(item.billingDay) : '');
  const [pm, setPm] = useState(item?.paymentMethod ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [isVariable, setIsVariable] = useState(item?.isVariable ?? false);
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  // 외화 현재 환율(원화 환산 미리보기용). 통화 바뀔 때마다 1회 조회.
  const [rate, setRate] = useState<number | null>(item && item.currency !== 'KRW' ? item.fxRate : null);
  const [rateStatus, setRateStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>(item?.fxRate ? 'ok' : 'idle');
  const isForeign = currency !== 'KRW';

  useEffect(() => {
    if (currency === 'KRW') { setRateStatus('idle'); return; }
    let alive = true;
    setRateStatus('loading');
    fetchFxRate(currency).then(r => {
      if (!alive) return;
      if (r != null) { setRate(r); setRateStatus('ok'); } else setRateStatus('error');
    });
    return () => { alive = false; };
  }, [currency]);

  const origNum = numOrNull(original);
  const previewKrw = isForeign && rate != null && origNum ? Math.round(origNum * rate) : null;
  const canSave = !!name.trim() && (isForeign
    ? !!origNum && origNum > 0 && (rate != null || intVal(amount) > 0)   // 환율 실패 시 수동금액 폴백 허용
    : intVal(amount) > 0);

  const save = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let outAmount: number, outOriginal: number | null, outRate: number | null, outRateDate: string | null, outChange: number | null;
    if (!isForeign) {
      outAmount = intVal(amount); outOriginal = null; outRate = null; outRateDate = null; outChange = null;
    } else {
      outOriginal = origNum;
      if (rate != null) {
        outAmount = Math.round((origNum ?? 0) * rate);
        outRate = rate; outRateDate = todayStr;
        outChange = item?.fxRate ? ((rate - item.fxRate) / item.fxRate) * 100 : (item?.fxChangePct ?? null);
      } else {
        outAmount = intVal(amount);   // 폴백
        outRate = item?.fxRate ?? null; outRateDate = item?.fxRateDate ?? null; outChange = item?.fxChangePct ?? null;
      }
    }
    m.saveFixedCost({ id: item?.id ?? uuid(), name: name.trim(), amount: outAmount, originalAmount: outOriginal, currency, cycle, billingDay: numOrNull(billingDay), paymentMethod: pm.trim() || null, categoryId: categoryId || null, isVariable, emoji: emoji.trim() || null, fxRate: outRate, fxRateDate: outRateDate, fxChangePct: outChange });
    onClose();
  };

  return (
    <FormSheet title={item ? '고정비 수정' : '고정비 추가'} onClose={onClose} onSave={save} onDelete={item ? () => m.deleteFixedCost(item.id) : undefined} canSave={canSave}>
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder="예: 넷플릭스 · 클로드 구독" /></Field>
      <Field label="통화"><SelectInput value={currency} onChange={setCurrency} options={[{ value: 'KRW', label: '₩ 원' }, { value: 'USD', label: '$ 달러' }, { value: 'EUR', label: '€ 유로' }, { value: 'JPY', label: '¥ 엔' }]} /></Field>
      {isForeign ? (
        <>
          <Field label="외화 원금"><TextInput value={original} onChange={setOriginal} placeholder={`예: 20 (${CURRENCY_SYMBOL[currency]})`} type="number" /></Field>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, margin: '-4px 0 12px', paddingLeft: 76, color: t.textSub }}>
            {rateStatus === 'loading' && <span style={{ color: t.textMuted }}>현재 환율 불러오는 중…</span>}
            {rateStatus === 'ok' && rate != null && (
              <>
                <span>현재 {CURRENCY_SYMBOL[currency]}1 ≈ <strong style={{ color: t.text }}>{rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원</strong></span>
                {previewKrw != null && <span style={{ color: MONEY_PALETTE.gold, fontWeight: 700 }}> → 예상 {previewKrw.toLocaleString('ko-KR')}원</span>}
                <br /><span style={{ color: t.textMuted }}>실제 결제일엔 그날 환율로 자동 기록돼요.</span>
              </>
            )}
            {rateStatus === 'error' && <span style={{ color: MONEY_PALETTE.coral }}>환율을 못 불러왔어요. 아래에 원화 금액을 직접 입력해 주세요.</span>}
          </div>
          {rateStatus === 'error' && <Field label="원화 금액"><TextInput value={amount} onChange={setAmount} placeholder="원화 환산(원)" type="number" /></Field>}
        </>
      ) : (
        <Field label="금액"><TextInput value={amount} onChange={setAmount} placeholder="금액(원)" type="number" /></Field>
      )}
      <Field label="주기"><Seg value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: '매월' }, { value: 'weekly', label: '매주' }, { value: 'yearly', label: '매년' }]} /></Field>
      <Field label="결제일"><TextInput value={billingDay} onChange={setBillingDay} placeholder="매월 N일" type="number" /></Field>
      <Field label="결제수단"><TextInput value={pm} onChange={setPm} placeholder="예: 자동이체 (선택)" /></Field>
      <Field label="카테고리"><SelectInput value={categoryId} onChange={setCategoryId} options={[{ value: '', label: '미분류' }, ...m.expenseCategories.map(c => ({ value: c.id, label: `${c.emoji ?? ''} ${c.name}`.trim() }))]} /></Field>
      <Field label="변동여부"><Seg value={isVariable ? 'y' : 'n'} onChange={(v) => setIsVariable(v === 'y')} options={[{ value: 'n', label: '고정 금액' }, { value: 'y', label: '변동 금액' }]} /></Field>
      <Field label="이모지"><TextInput value={emoji} onChange={setEmoji} placeholder="🎬 (선택)" /></Field>
    </FormSheet>
  );
}

// ── 5) 대출 ──
export function LoanForm({ m, item, onClose }: { m: UseMoney; item: MoneyLoan | null; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [lender, setLender] = useState(item?.lender ?? '');
  const [repaymentType, setRepaymentType] = useState(item?.repaymentType ?? '');
  const [balance, setBalance] = useState(item ? String(item.balance) : '');
  const [principal, setPrincipal] = useState(item?.principal != null ? String(item.principal) : '');
  const [rate, setRate] = useState(item?.interestRate != null ? String(item.interestRate) : '');
  const [monthly, setMonthly] = useState(item?.monthlyPayment != null ? String(item.monthlyPayment) : '');
  const [paymentDay, setPaymentDay] = useState(item?.paymentDay != null ? String(item.paymentDay) : '');
  const [total, setTotal] = useState(item?.totalInstallments != null ? String(item.totalInstallments) : '');
  const [paid, setPaid] = useState(String(item?.paidInstallments ?? ''));
  const [start, setStart] = useState(item?.startDate ?? '');
  const [end, setEnd] = useState(item?.endDate ?? '');
  const save = () => {
    m.saveLoan({ id: item?.id ?? uuid(), name: name.trim(), lender: lender.trim() || null, repaymentType: repaymentType.trim() || null, principal: numOrNull(principal), balance: intVal(balance), interestRate: numOrNull(rate), monthlyPayment: numOrNull(monthly), startDate: start || null, endDate: end || null, paymentDay: numOrNull(paymentDay), totalInstallments: numOrNull(total), paidInstallments: intVal(paid) });
    onClose();
  };
  return (
    <FormSheet title={item ? '대출 수정' : '대출 추가'} onClose={onClose} onSave={save} onDelete={item ? () => m.deleteLoan(item.id) : undefined} canSave={!!name.trim()}>
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder="예: 학자금 대출" /></Field>
      <Field label="기관"><TextInput value={lender} onChange={setLender} placeholder="예: 한국장학재단 (선택)" /></Field>
      <Field label="상환방식"><TextInput value={repaymentType} onChange={setRepaymentType} placeholder="예: 원리금균등 (선택)" /></Field>
      <Field label="원금 잔액"><TextInput value={balance} onChange={setBalance} placeholder="원" type="number" /></Field>
      <Field label="최초 원금"><TextInput value={principal} onChange={setPrincipal} placeholder="원 (선택)" type="number" /></Field>
      <Field label="이자율"><TextInput value={rate} onChange={setRate} placeholder="% (선택)" type="number" /></Field>
      <Field label="월 상환액"><TextInput value={monthly} onChange={setMonthly} placeholder="원 (선택)" type="number" /></Field>
      <Field label="상환일"><TextInput value={paymentDay} onChange={setPaymentDay} placeholder="매월 N일 (선택)" type="number" /></Field>
      <Field label="총 회차"><TextInput value={total} onChange={setTotal} placeholder="회 (선택)" type="number" /></Field>
      <Field label="납입 회차"><TextInput value={paid} onChange={setPaid} placeholder="회 (선택)" type="number" /></Field>
      <Field label="시작일"><TextInput value={start} onChange={setStart} type="date" /></Field>
      <Field label="종료일"><TextInput value={end} onChange={setEnd} type="date" /></Field>
    </FormSheet>
  );
}

// ── 6) 목표 ──
export function GoalForm({ m, item, onClose }: { m: UseMoney; item: MoneyGoal | null; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const [target, setTarget] = useState(item ? String(item.targetAmount) : '');
  const [current, setCurrent] = useState(String(item?.currentAmount ?? ''));
  const [deadline, setDeadline] = useState(item?.deadline ?? '');
  const [type, setType] = useState<GoalType>(item?.type ?? 'savings');
  const [color, setColor] = useState<string | null>(item?.color ?? MONEY_PALETTE.green);
  const save = () => {
    m.saveGoal({ id: item?.id ?? uuid(), name: name.trim(), emoji: emoji.trim() || null, targetAmount: intVal(target), currentAmount: intVal(current), deadline: deadline || null, type, linkedAccountId: item?.linkedAccountId ?? null, color, sortOrder: item?.sortOrder ?? 0 });
    onClose();
  };
  return (
    <FormSheet title={item ? '목표 수정' : '목표 추가'} onClose={onClose} onSave={save} onDelete={item ? () => m.deleteGoal(item.id) : undefined} canSave={!!name.trim() && intVal(target) > 0}>
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder="예: 비상금 1000만원" /></Field>
      <Field label="이모지"><TextInput value={emoji} onChange={setEmoji} placeholder="🎯 (선택)" /></Field>
      <Field label="목표 금액"><TextInput value={target} onChange={setTarget} placeholder="원" type="number" /></Field>
      <Field label="현재 금액"><TextInput value={current} onChange={setCurrent} placeholder="원" type="number" /></Field>
      <Field label="마감일"><TextInput value={deadline} onChange={setDeadline} type="date" /></Field>
      <Field label="유형"><SelectInput value={type} onChange={setType} options={[{ value: 'savings', label: '저축' }, { value: 'networth', label: '순자산' }, { value: 'travel', label: '여행' }, { value: 'custom', label: '기타' }]} /></Field>
      <Field label="색상"><ColorPicker value={color} onChange={setColor} /></Field>
    </FormSheet>
  );
}

// ── 7) 카테고리 (대분류/소분류 공용 add·edit) ──
//  · item 있으면 수정(type/parentId/isDefault/sortOrder 보존), 없으면 추가.
//  · parentId=null → 대분류(색상 선택 노출), 값 있으면 소분류(색은 대분류 명도변형 자동 → 색상 입력 생략).
export function CategoryForm({ m, item, type, parentId, parentName, onClose }: {
  m: UseMoney; item: MoneyCategory | null; type: TxType; parentId: string | null; parentName?: string; onClose: () => void;
}) {
  const effType: TxType = item?.type ?? type;
  const effParentId = item ? item.parentId : parentId;
  const isSub = effParentId !== null;
  const [name, setName] = useState(item?.name ?? '');
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const [color, setColor] = useState<string | null>(item?.color ?? null);

  // 삭제 경고 — 대분류는 소분류 동반 삭제, 거래는 미분류 전환을 명시.
  const subCount = item && !isSub ? m.subcategoriesOf(item.id).length : 0;
  const delWarning = item
    ? (subCount > 0
        ? `이 대분류와 소분류 ${subCount}개가 함께 삭제돼요. 해당 거래는 '미분류'로 바뀝니다.`
        : "삭제하면 이 카테고리의 거래는 '미분류'로 바뀌어요. 되돌릴 수 없어요.")
    : undefined;

  const save = () => {
    if (item) {
      m.saveCategory({ ...item, name: name.trim(), emoji: emoji.trim() || null, color: isSub ? item.color : color });
    } else {
      m.addCategory({ type: effType, name: name.trim(), emoji: emoji.trim() || null, color: isSub ? null : color, parentId: effParentId });
    }
    onClose();
  };

  const levelLabel = isSub ? '소분류' : '대분류';
  const title = `${levelLabel} ${item ? '수정' : '추가'}`;
  return (
    <FormSheet title={title} onClose={onClose} onSave={save}
      onDelete={item ? () => m.deleteCategory(item.id) : undefined} deleteWarning={delWarning}
      canSave={!!name.trim()}>
      {isSub && parentName && (
        <div style={{ fontSize: 12, color: MONEY_PALETTE.gold, fontWeight: 600, marginBottom: 12 }}>↳ {parentName} 의 소분류</div>
      )}
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder={isSub ? '예: 배달' : '예: 식비'} /></Field>
      <Field label="이모지"><TextInput value={emoji} onChange={setEmoji} placeholder={isSub ? '🛵 (선택)' : '🍽 (선택)'} /></Field>
      {!isSub && <Field label="색상"><ColorPicker value={color} onChange={setColor} /></Field>}
    </FormSheet>
  );
}
