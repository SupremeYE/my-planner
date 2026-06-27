// 하온 머니 — 수정/삭제 폼 시트(추가·편집 겸용). 모바일 바텀시트 / PC 중앙 모달(lg:).
// 패턴 통일: 항목 탭 = 편집 시트 열기 / 시트 안에 저장 + 삭제(인라인 확인). 추가 = 같은 폼 빈 값.
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { MONEY_PALETTE, CUSTOM_PALETTE } from './tokens';
import type { UseMoney } from './useMoney';
import type {
  MoneyTransaction, MoneyAccount, MoneyCard, MoneyFixedCost, MoneyLoan, MoneyGoal,
  TxType, AccountType, CardType, FixedCycle, Currency, GoalType,
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
export function FormSheet({ title, onClose, onSave, onDelete, canSave = true, children }: {
  title: string; onClose: () => void; onSave: () => void; onDelete?: () => void; canSave?: boolean; children: React.ReactNode;
}) {
  const { t } = useTheme();
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full lg:w-[460px] lg:max-w-[92vw] rounded-t-3xl lg:rounded-3xl"
        style={{ background: t.card, padding: '20px 20px 28px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 18 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{title}</span>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {children}

        {confirmDel ? (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: `${MONEY_PALETTE.coral}12`, border: `1px solid ${MONEY_PALETTE.coral}40` }}>
            <div style={{ fontSize: 13, color: t.text, marginBottom: 10, fontWeight: 600 }}>정말 삭제할까요? 되돌릴 수 없어요.</div>
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
      </div>
    </div>
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
export function TransactionForm({ m, item, onClose }: { m: UseMoney; item: MoneyTransaction | null; onClose: () => void }) {
  const [type, setType] = useState<TxType>(item?.type ?? 'expense');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  // categoryId 는 대분류(parentId) + 소분류(subId)로 분리 편집. 저장 시 subId가 있으면 소분류 id, 없으면 대분류 id.
  const initCat = m.categoryOf(item?.categoryId ?? null);
  const [parentId, setParentId] = useState(initCat ? (initCat.parentId ?? initCat.id) : '');
  const [subId, setSubId] = useState(initCat?.parentId ? initCat.id : '');
  const [spentAt, setSpentAt] = useState(item?.spentAt ?? new Date().toISOString().slice(0, 10));
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
  const save = () => {
    m.saveAccount({ id: item?.id ?? uuid(), name: name.trim(), type, balance: intVal(balance), interestRate: numOrNull(rate), icon: icon.trim() || null, sortOrder: item?.sortOrder ?? 0 });
    onClose();
  };
  return (
    <FormSheet title={item ? '자산 수정' : '자산 추가'} onClose={onClose} onSave={save} onDelete={item ? () => m.deleteAccount(item.id) : undefined} canSave={!!name.trim()}>
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder="예: 카뱅 저금통" /></Field>
      <Field label="종류"><SelectInput value={type} onChange={setType} options={[{ value: 'deposit', label: '예금' }, { value: 'savings', label: '적금' }, { value: 'cash', label: '현금' }, { value: 'investment', label: '투자' }]} /></Field>
      <Field label="잔액"><TextInput value={balance} onChange={setBalance} placeholder="잔액(원)" type="number" /></Field>
      <Field label="연이율"><TextInput value={rate} onChange={setRate} placeholder="% (선택)" type="number" /></Field>
      <Field label="이모지"><TextInput value={icon} onChange={setIcon} placeholder="🏦 (선택)" /></Field>
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
      <Field label="미결제액"><TextInput value={unpaid} onChange={setUnpaid} placeholder="원" type="number" /></Field>
      {type === 'credit' && <Field label="결제일"><TextInput value={billingDay} onChange={setBillingDay} placeholder="매월 N일" type="number" /></Field>}
      <Field label="색상"><ColorPicker value={color} onChange={setColor} /></Field>
    </FormSheet>
  );
}

// ── 4) 고정비 ──
export function FixedCostForm({ m, item, onClose }: { m: UseMoney; item: MoneyFixedCost | null; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [currency, setCurrency] = useState<Currency>(item?.currency ?? 'KRW');
  const [original, setOriginal] = useState(item?.originalAmount != null ? String(item.originalAmount) : '');
  const [cycle, setCycle] = useState<FixedCycle>(item?.cycle ?? 'monthly');
  const [billingDay, setBillingDay] = useState(item?.billingDay != null ? String(item.billingDay) : '');
  const [pm, setPm] = useState(item?.paymentMethod ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [isVariable, setIsVariable] = useState(item?.isVariable ?? false);
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const save = () => {
    m.saveFixedCost({ id: item?.id ?? uuid(), name: name.trim(), amount: intVal(amount), originalAmount: currency === 'KRW' ? null : numOrNull(original), currency, cycle, billingDay: numOrNull(billingDay), paymentMethod: pm.trim() || null, categoryId: categoryId || null, isVariable, emoji: emoji.trim() || null });
    onClose();
  };
  return (
    <FormSheet title={item ? '고정비 수정' : '고정비 추가'} onClose={onClose} onSave={save} onDelete={item ? () => m.deleteFixedCost(item.id) : undefined} canSave={!!name.trim() && intVal(amount) > 0}>
      <Field label="이름"><TextInput value={name} onChange={setName} placeholder="예: 넷플릭스" /></Field>
      <Field label="금액"><TextInput value={amount} onChange={setAmount} placeholder="원화 환산(원)" type="number" /></Field>
      <Field label="통화"><SelectInput value={currency} onChange={setCurrency} options={[{ value: 'KRW', label: '₩ 원' }, { value: 'USD', label: '$ 달러' }, { value: 'EUR', label: '€ 유로' }, { value: 'JPY', label: '¥ 엔' }]} /></Field>
      {currency !== 'KRW' && <Field label="외화 원금"><TextInput value={original} onChange={setOriginal} placeholder="예: 13.99" type="number" /></Field>}
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
