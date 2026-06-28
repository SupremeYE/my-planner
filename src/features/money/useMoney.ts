// 하온 머니 — 공용 데이터 훅. 8개 테이블 로드/Realtime 구독 + 파생값 메모이즈 + 액션.
// beauty/useBeauty 패턴 동일(UI 의존 0). 핵심: 채팅형 자연어 입력 → money-parse → 거래 기록.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../app/hooks/useRealtimeSync';
import { moneyDb } from './db';
import { getMoneyPeriod, daysLeftInPeriod, type MoneyPeriod } from './period';
import { fetchFxRate, fetchFxRateOn, needsFxRefresh } from './fx';
import type {
  MoneyCategory, MoneyTransaction, MoneyAccount, MoneyCard,
  MoneyFixedCost, MoneyLoan, MoneyGoal, MoneySettings, ParsedTx, TxType, Currency,
} from './types';

const today = () => format(new Date(), 'yyyy-MM-dd');

// 결제수단명 정규화(공백 제거·소문자) — 카드 태그 매칭용.
const normName = (s: string) => s.replace(/\s/g, '').toLowerCase();

// 매월 day 일 기준, 오늘 이전(<=오늘)에 지나간 가장 최근 결제일 → 'yyyy-MM-dd'.
//  · 이 날 "이후"에 쓴 카드 거래가 "미청구"(다음 결제일에 청구될 금액).
function lastBillingDateStr(day: number, base = new Date()): string {
  const y = base.getFullYear(), mo = base.getMonth(), d = base.getDate();
  let last = new Date(y, mo, day);
  if (last.getTime() > new Date(y, mo, d).getTime()) last = new Date(y, mo - 1, day);
  return format(last, 'yyyy-MM-dd');
}

export interface DayAgg { expense: number; income: number; }
export interface CatBreakdown { category: MoneyCategory | null; amount: number; color: string; }

export interface UseMoney {
  loading: boolean;
  categories: MoneyCategory[];
  expenseCategories: MoneyCategory[];   // 대분류만(parentId=null)
  incomeCategories: MoneyCategory[];    // 대분류만(parentId=null)
  subcategoriesOf: (parentId: string | null) => MoneyCategory[];  // 대분류의 소분류 목록
  rootCategoryOf: (id: string | null) => MoneyCategory | null;    // 소분류 → 대분류 롤업(대분류면 자기 자신)
  transactions: MoneyTransaction[];
  periodTransactions: MoneyTransaction[];
  accounts: MoneyAccount[];
  investments: MoneyAccount[];
  cards: MoneyCard[];
  fixedCosts: MoneyFixedCost[];
  loans: MoneyLoan[];
  goals: MoneyGoal[];
  settings: MoneySettings;
  period: MoneyPeriod;
  // 파생 합계
  income: number;
  expense: number;
  balance: number;
  fixedTotal: number;
  assets: number;
  cardDebt: number;
  loanDebt: number;
  netWorth: number;
  // 투자 요약 — 평가액 합/수익금/수익률(원금 있는 종목 기준). 원금 없으면 returnPct=null.
  investTotal: number;        // 총 투자자산(모든 투자계좌 평가액 합)
  investPrincipal: number;    // 원금 합(principal 입력된 종목만)
  investReturn: number;       // 평가손익(원금 있는 종목의 평가액-원금)
  investReturnPct: number | null;
  // 기간/캘린더 파생
  daysLeft: number;            // 기간 종료까지 남은 일수(D-day)
  dailyAllowance: number;      // 남은 예산 / 남은 일수(오늘 포함)
  noSpendStreak: number;       // 어제 기준 연속 무지출 일수(기록 시작일 이후만)
  trackingStartDate: string | null; // 머니 기록 시작일(첫 거래일). 없으면 null
  spendByDay: Map<string, DayAgg>;  // 'yyyy-MM-dd' → {expense, income}
  categoryOf: (id: string | null) => MoneyCategory | null;
  // 카드 미청구(미결제) — 카드명으로 태그된 거래 중 마지막 결제일 이후 합 + 기준 이월액.
  cardUnpaid: (card: MoneyCard) => number;
  cardUnbilledTxs: (card: MoneyCard) => MoneyTransaction[];
  refresh: () => Promise<void>;
  // 액션
  addTransaction: (tx: Partial<MoneyTransaction> & { type: TxType; amount: number }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  parseAndAdd: (text: string, mode: 'chat' | 'sms') => Promise<{ ok: boolean; error?: string; parsed?: ParsedTx }>;
  addCategory: (c: Partial<MoneyCategory> & { type: TxType; name: string }) => Promise<void>;
  saveCategory: (c: MoneyCategory) => Promise<void>;   // 편집용 전체 upsert(isDefault/sortOrder/parentId 보존)
  deleteCategory: (id: string) => Promise<void>;
  updateSettings: (s: MoneySettings) => Promise<void>;
  // 자산/카드/고정비/대출/목표 — 수정(upsert)/삭제. id 있으면 수정, 없으면 추가.
  saveAccount: (a: MoneyAccount) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  saveCard: (c: MoneyCard) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  saveFixedCost: (f: MoneyFixedCost) => Promise<void>;
  deleteFixedCost: (id: string) => Promise<void>;
  // 외화 고정비 환율 갱신(Frankfurter). force=true 면 사이클 가드 무시(수동 새로고침).
  refreshFxRates: (opts?: { force?: boolean }) => Promise<{ updated: number; alerts: string[] }>;
  // 결제일 도래한 고정비를 그날 환율로 환산해 지출 거래(source='fixed')로 자동 기록(멱등). 생성 건수 반환.
  settleFixedCosts: () => Promise<number>;
  saveLoan: (l: MoneyLoan) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  saveGoal: (g: MoneyGoal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

export function useMoney(): UseMoney {
  const [categories, setCategories] = useState<MoneyCategory[]>([]);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [cards, setCards] = useState<MoneyCard[]>([]);
  const [fixedCosts, setFixedCosts] = useState<MoneyFixedCost[]>([]);
  const [loans, setLoans] = useState<MoneyLoan[]>([]);
  const [goals, setGoals] = useState<MoneyGoal[]>([]);
  const [settings, setSettings] = useState<MoneySettings>({
    periodType: 'payday', payday: 25, monthlyBudget: 1200000, currency: 'KRW', fxAlertThreshold: 3.0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [cat, tx, acc, crd, fx, ln, gl, st] = await Promise.all([
      moneyDb.categories.fetchAll(), moneyDb.transactions.fetchAll(), moneyDb.accounts.fetchAll(),
      moneyDb.cards.fetchAll(), moneyDb.fixedCosts.fetchAll(), moneyDb.loans.fetchAll(),
      moneyDb.goals.fetchAll(), moneyDb.settings.fetch(),
    ]);
    setCategories(cat); setTransactions(tx); setAccounts(acc); setCards(crd);
    setFixedCosts(fx); setLoans(ln); setGoals(gl); setSettings(st);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('money_categories', refresh);
  useRealtimeSync('money_transactions', refresh);
  useRealtimeSync('money_accounts', refresh);
  useRealtimeSync('money_cards', refresh);
  useRealtimeSync('money_fixed_costs', refresh);
  useRealtimeSync('money_loans', refresh);
  useRealtimeSync('money_goals', refresh);
  useRealtimeSync('money_settings', refresh);

  // 최초 로드 후 1회 — 결제일 도래한 고정비 자동 정산(거래 생성). 멱등이라 중복 없음.
  const settledRef = useRef(false);
  useEffect(() => {
    if (loading || settledRef.current) return;
    settledRef.current = true;
    settleFixedCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // 대분류만 노출(parentId=null) — 파싱 후보·거래폼·고정비폼 모두 대분류 기준.
  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense' && !c.parentId), [categories]);
  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income' && !c.parentId), [categories]);
  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const categoryOf = useCallback((id: string | null) => (id ? catById.get(id) ?? null : null), [catById]);

  // 대분류 id → 소분류 목록(sortOrder 순)
  const subsByParent = useMemo(() => {
    const map = new Map<string, MoneyCategory[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const arr = map.get(c.parentId) ?? [];
      arr.push(c);
      map.set(c.parentId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [categories]);
  const subcategoriesOf = useCallback((parentId: string | null) => (parentId ? subsByParent.get(parentId) ?? [] : []), [subsByParent]);
  // 소분류면 부모 대분류로, 대분류면 자기 자신으로 롤업(1단계). 미분류는 null.
  const rootCategoryOf = useCallback((id: string | null) => {
    const c = id ? catById.get(id) ?? null : null;
    if (!c) return null;
    return c.parentId ? catById.get(c.parentId) ?? c : c;
  }, [catById]);

  const period = useMemo(() => getMoneyPeriod(settings), [settings]);

  const periodTransactions = useMemo(
    () => transactions.filter(t => t.spentAt >= period.start && t.spentAt <= period.end),
    [transactions, period],
  );

  const income = useMemo(
    () => periodTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [periodTransactions],
  );
  const expense = useMemo(
    () => periodTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [periodTransactions],
  );
  const balance = income - expense;
  const fixedTotal = useMemo(() => fixedCosts.reduce((s, f) => s + f.amount, 0), [fixedCosts]);
  const assets = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts]);
  const investments = useMemo(() => accounts.filter(a => a.type === 'investment'), [accounts]);
  // 투자 요약: 평가액 합 + (원금 입력된 종목만) 손익/수익률. 시세 자동연동은 후순위 — 평가액은 수동 입력.
  const investTotal = useMemo(() => investments.reduce((s, a) => s + a.balance, 0), [investments]);
  const investPrincipal = useMemo(
    () => investments.reduce((s, a) => s + (a.principal != null ? a.principal : 0), 0), [investments]);
  const investReturn = useMemo(
    () => investments.reduce((s, a) => s + (a.principal != null ? a.balance - a.principal : 0), 0), [investments]);
  const investReturnPct = useMemo(
    () => (investPrincipal > 0 ? (investReturn / investPrincipal) * 100 : null), [investReturn, investPrincipal]);
  // 카드별 미청구 거래(신용카드만) — 카드명 매칭 + 마지막 결제일 이후(결제일 없으면 전체).
  const cardUnbilledTxs = useCallback((card: MoneyCard): MoneyTransaction[] => {
    if (card.type === 'check') return [];   // 체크는 즉시 출금 — 미청구 개념 없음
    const target = normName(card.name);
    const matches = transactions.filter(tx => tx.type === 'expense' && tx.paymentMethod && normName(tx.paymentMethod) === target);
    if (!card.billingDay) return matches;
    const lastBill = lastBillingDateStr(card.billingDay);
    return matches.filter(tx => tx.spentAt > lastBill);
  }, [transactions]);

  // 카드 미결제액 = 기준 이월액(card.unpaidAmount) + 미청구 거래 합. 체크카드는 0.
  const cardUnpaid = useCallback((card: MoneyCard): number => {
    if (card.type === 'check') return 0;
    return (card.unpaidAmount || 0) + cardUnbilledTxs(card).reduce((s, tx) => s + tx.amount, 0);
  }, [cardUnbilledTxs]);

  const cardDebt = useMemo(() => cards.reduce((s, c) => s + cardUnpaid(c), 0), [cards, cardUnpaid]);
  const loanDebt = useMemo(() => loans.reduce((s, l) => s + l.balance, 0), [loans]);
  const netWorth = assets - cardDebt;  // 목업 기준(대출은 별도 표시)

  // 일별 집계(전체 거래 — 캘린더/스트릭 공용). 'yyyy-MM-dd' → {expense, income}
  const spendByDay = useMemo(() => {
    const map = new Map<string, DayAgg>();
    for (const t of transactions) {
      const cur = map.get(t.spentAt) ?? { expense: 0, income: 0 };
      if (t.type === 'expense') cur.expense += t.amount; else cur.income += t.amount;
      map.set(t.spentAt, cur);
    }
    return map;
  }, [transactions]);

  // D-day & 하루 사용 가능액(남은 예산 / 남은 일수, 오늘 포함)
  const daysLeft = useMemo(() => daysLeftInPeriod(period), [period]);
  const dailyAllowance = useMemo(() => {
    const remainBudget = Math.max(0, (settings.monthlyBudget || 0) - expense);
    const remainDays = daysLeft + 1; // 오늘 포함
    return remainDays > 0 ? Math.floor(remainBudget / remainDays) : 0;
  }, [settings.monthlyBudget, expense, daysLeft]);

  // 머니 기록 시작일 = 가장 이른 거래일. 거래가 0건이면 null(아직 기록 전).
  // 이 날 이전은 "기록을 안 한 날"이므로 무지출 판정에서 완전히 제외한다.
  const trackingStartDate = useMemo(() => {
    if (transactions.length === 0) return null;
    let min = transactions[0].spentAt;
    for (const t of transactions) if (t.spentAt < min) min = t.spentAt;
    return min;
  }, [transactions]);

  // 무지출 스트릭: 기록 시작일 이후 ~ 어제까지 연속으로 지출 0건인 날 수.
  //  · 오늘은 하루가 안 끝났으므로 카운트하지 않음(어제부터 거꾸로).
  //  · 기록 시작일 이전 날짜는 세지 않음 → 신규 사용자 허수(60일 등) 제거.
  //  · 거래가 0건이면 0(UI에서 배지/카운터 숨김).
  const noSpendStreak = useMemo(() => {
    if (!trackingStartDate) return 0;
    let streak = 0;
    for (let i = 1; i <= 366; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if (d < trackingStartDate) break;            // 기록 시작 전 → 중단
      if ((spendByDay.get(d)?.expense ?? 0) > 0) break; // 지출 있는 날 → 중단
      streak++;
    }
    return streak;
  }, [spendByDay, trackingStartDate]);

  // ── 액션 ──
  const addTransaction = useCallback(async (input: Partial<MoneyTransaction> & { type: TxType; amount: number }) => {
    const tx: MoneyTransaction = {
      id: input.id ?? crypto.randomUUID(),
      type: input.type, amount: input.amount,
      categoryId: input.categoryId ?? null, memo: input.memo ?? null,
      paymentMethod: input.paymentMethod ?? null, spentAt: input.spentAt ?? today(),
      source: input.source ?? 'manual', rawInput: input.rawInput ?? null,
      emoji: input.emoji ?? null,
      originalAmount: input.originalAmount ?? null, currency: input.currency ?? 'KRW',
      fxRate: input.fxRate ?? null, fixedCostId: input.fixedCostId ?? null,
    };
    await moneyDb.transactions.upsert(tx);
    await refresh();
  }, [refresh]);

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id)); // optimistic
    await moneyDb.transactions.delete(id);
    await refresh();
  }, [refresh]);

  // 대분류 이름 → id 해석(type 일치, parentId=null). 없으면 null.
  const resolveCategoryId = useCallback((name: string | null, type: TxType): string | null => {
    if (!name) return null;
    const hit = categories.find(c => c.type === type && !c.parentId && c.name === name);
    return hit?.id ?? null;
  }, [categories]);

  // (대분류 id, 소분류 이름) → 소분류 id. 부모의 자식 중 이름 일치. 없으면 null.
  const resolveSubcategoryId = useCallback((parentId: string | null, name: string | null): string | null => {
    if (!parentId || !name) return null;
    const hit = categories.find(c => c.parentId === parentId && c.name === name);
    return hit?.id ?? null;
  }, [categories]);

  // 파싱된 결제수단(raw) → 등록된 카드/통장명으로 매칭. 실패 시 null(라벨만, 잔고 차감 없음 — Stage 5).
  //  · 공백·대소문자 무시, 정확 일치 우선 → 포함 관계(긴 이름 우선).
  const matchPaymentMethod = useCallback((raw: string | null): string | null => {
    if (!raw || !raw.trim()) return null;
    const norm = (s: string) => s.replace(/\s/g, '').toLowerCase();
    const r = norm(raw);
    const names = [...cards.map(c => c.name), ...accounts.map(a => a.name)];
    const exact = names.find(n => norm(n) === r);
    if (exact) return exact;
    const partial = names
      .filter(n => { const nn = norm(n); return nn.includes(r) || r.includes(nn); })
      .sort((a, b) => b.length - a.length)[0];
    return partial ?? null;
  }, [cards, accounts]);

  // 채팅/문자 자연어 → money-parse Edge Function → 거래 기록 (Stage 2 핵심)
  const parseAndAdd = useCallback(async (text: string, mode: 'chat' | 'sms') => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: '내용을 입력해 주세요' };
    // 대분류별 소분류 목록(이름) — 파서가 그 중에서 소분류 추론.
    const subMap: Record<string, string[]> = {};
    for (const p of expenseCategories) {
      const subs = subcategoriesOf(p.id);
      if (subs.length) subMap[p.name] = subs.map(s => s.name);
    }
    const { data, error } = await supabase.functions.invoke('money-parse', {
      body: {
        text: trimmed, mode, today: today(),
        expense_categories: expenseCategories.map(c => c.name),
        income_categories: incomeCategories.map(c => c.name),
        subcategories: subMap,
      },
    });
    if (error) { console.error('[money] parse invoke:', error.message); return { ok: false, error: '입력을 분석하지 못했어요' }; }
    if (!data?.ok || !data.tx) return { ok: false, error: data?.error || '인식하지 못했어요. 다시 입력해 보세요' };
    const p = data.tx as ParsedTx;
    // 대분류 해석 → 그 안에서 소분류 해석. 소분류 매칭되면 소분류 id, 아니면 대분류 id(진입장벽 유지).
    const parentId = resolveCategoryId(p.category, p.type);
    const subId = resolveSubcategoryId(parentId, p.subcategory ?? null);
    // 외화 입력("클로드 20달러")은 입력 시점 환율로 원화 환산해 저장(외화 원금/통화/환율 보존).
    const cur = (p.currency ?? 'KRW') as Currency;
    let amount = p.amount;
    let originalAmount: number | null = null;
    let fxRate: number | null = null;
    if (cur !== 'KRW') {
      const rate = await fetchFxRate(cur);
      if (rate != null) {
        originalAmount = p.amount;
        fxRate = rate;
        amount = Math.round(p.amount * rate);
      } else {
        // 환율 실패 시: 원금/통화는 보존하되 환산 불가 → 외화 단위 그대로 저장(사용자 수정 유도).
        originalAmount = p.amount;
      }
    }
    await addTransaction({
      type: p.type, amount,
      categoryId: subId ?? parentId,
      memo: p.memo ?? trimmed, paymentMethod: matchPaymentMethod(p.paymentMethod ?? null),
      spentAt: p.spentAt ?? today(), source: mode, rawInput: trimmed,
      emoji: p.emoji ?? null,
      originalAmount, currency: cur, fxRate,
    });
    return { ok: true, parsed: p };
  }, [expenseCategories, incomeCategories, subcategoriesOf, addTransaction, resolveCategoryId, resolveSubcategoryId, matchPaymentMethod]);

  const addCategory = useCallback(async (c: Partial<MoneyCategory> & { type: TxType; name: string }) => {
    const parentId = c.parentId ?? null;
    // 같은 레벨(동일 부모, 동일 type) 안에서 sortOrder 증가.
    const siblings = categories.filter(x => x.type === c.type && (x.parentId ?? null) === parentId);
    const maxOrder = siblings.reduce((m, x) => Math.max(m, x.sortOrder), -1);
    await moneyDb.categories.upsert({
      id: c.id ?? crypto.randomUUID(), type: c.type, name: c.name,
      emoji: c.emoji ?? null, color: c.color ?? null, parentId, isDefault: false, sortOrder: c.sortOrder ?? maxOrder + 1,
    });
    await refresh();
  }, [categories, refresh]);

  // 기존 카테고리 편집 — 전체 필드 그대로 upsert(addCategory 와 달리 isDefault/sortOrder 보존).
  const saveCategory = useCallback(async (c: MoneyCategory) => {
    await moneyDb.categories.upsert(c);
    await refresh();
  }, [refresh]);

  const deleteCategory = useCallback(async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id)); // optimistic
    await moneyDb.categories.delete(id);
    await refresh();
  }, [refresh]);

  const updateSettings = useCallback(async (s: MoneySettings) => {
    setSettings(s); // optimistic
    await moneyDb.settings.upsert(s);
    await refresh();
  }, [refresh]);

  // ── 자산/카드/고정비/대출/목표 upsert + delete (id 채워서 호출) ──
  const saveAccount = useCallback(async (a: MoneyAccount) => { await moneyDb.accounts.upsert(a); await refresh(); }, [refresh]);
  const deleteAccount = useCallback(async (id: string) => {
    setAccounts(prev => prev.filter(x => x.id !== id)); await moneyDb.accounts.delete(id); await refresh();
  }, [refresh]);
  const saveCard = useCallback(async (c: MoneyCard) => { await moneyDb.cards.upsert(c); await refresh(); }, [refresh]);
  const deleteCard = useCallback(async (id: string) => {
    setCards(prev => prev.filter(x => x.id !== id)); await moneyDb.cards.delete(id); await refresh();
  }, [refresh]);
  const saveFixedCost = useCallback(async (f: MoneyFixedCost) => { await moneyDb.fixedCosts.upsert(f); await refresh(); }, [refresh]);
  const deleteFixedCost = useCallback(async (id: string) => {
    setFixedCosts(prev => prev.filter(x => x.id !== id)); await moneyDb.fixedCosts.delete(id); await refresh();
  }, [refresh]);

  // 외화 고정비 환율 갱신 — 대상별 Frankfurter 호출 → amount(원화환산)·fxRate·변동률 저장, 임계 초과는 알림 수집.
  const refreshFxRates = useCallback(async (opts?: { force?: boolean }) => {
    const t = today();
    const targets = fixedCosts.filter(f => needsFxRefresh(f, t, opts?.force ?? false));
    if (targets.length === 0) return { updated: 0, alerts: [] as string[] };
    let updated = 0;
    const alerts: string[] = [];
    for (const f of targets) {
      const rate = await fetchFxRate(f.currency);
      if (rate == null || f.originalAmount == null) continue;
      const newAmount = Math.round(f.originalAmount * rate);
      const changePct = f.fxRate ? ((rate - f.fxRate) / f.fxRate) * 100 : 0;
      await moneyDb.fixedCosts.upsert({ ...f, amount: newAmount, fxRate: rate, fxRateDate: t, fxChangePct: changePct });
      updated++;
      if (f.fxRate && Math.abs(changePct) >= (settings.fxAlertThreshold || 0)) {
        alerts.push(`${f.name} ${changePct > 0 ? '▲' : '▼'}${Math.abs(changePct).toFixed(1)}%`);
      }
    }
    if (updated > 0) await refresh();
    return { updated, alerts };
  }, [fixedCosts, settings.fxAlertThreshold, refresh]);

  // 결제일이 도래한 고정비 → 그날 환율로 환산해 지출 거래(source='fixed') 1회 자동 기록.
  //  · 월간 + 고정 금액만(변동/주간/연간 제외). (fixedCostId, spentAt) 멱등 — 이미 있으면 skip.
  //  · 외화는 결제일 당일/직전 영업일 환율(Frankfurter historical). 환율 실패 시 이번엔 skip(다음 진입 재시도).
  //  · 고정비 생성일 이전 주기는 기록하지 않음(과거 소급 방지).
  const settleFixedCosts = useCallback(async (): Promise<number> => {
    const base = new Date();
    let created = 0;
    for (const f of fixedCosts) {
      if (f.isVariable || f.cycle !== 'monthly' || !f.billingDay) continue;
      const billStr = lastBillingDateStr(f.billingDay, base);   // ≤오늘 가장 최근 결제일
      const createdDay = f.createdAt ? f.createdAt.slice(0, 10) : null;
      if (createdDay && billStr < createdDay) continue;
      if (transactions.some(tx => tx.fixedCostId === f.id && tx.spentAt === billStr)) continue;
      let amount = f.amount;
      let originalAmount: number | null = null;
      let fxRate: number | null = null;
      if (f.currency !== 'KRW' && f.originalAmount != null) {
        const rate = await fetchFxRateOn(billStr, f.currency);
        if (rate == null) continue;
        originalAmount = f.originalAmount; fxRate = rate;
        amount = Math.round(f.originalAmount * rate);
      }
      await moneyDb.transactions.upsert({
        id: crypto.randomUUID(), type: 'expense', amount,
        categoryId: f.categoryId ?? null, memo: f.name,
        paymentMethod: f.paymentMethod ?? null, spentAt: billStr,
        source: 'fixed', rawInput: null, emoji: f.emoji ?? null,
        originalAmount, currency: f.currency, fxRate, fixedCostId: f.id,
      });
      created++;
    }
    if (created > 0) await refresh();
    return created;
  }, [fixedCosts, transactions, refresh]);

  const saveLoan = useCallback(async (l: MoneyLoan) => { await moneyDb.loans.upsert(l); await refresh(); }, [refresh]);
  const deleteLoan = useCallback(async (id: string) => {
    setLoans(prev => prev.filter(x => x.id !== id)); await moneyDb.loans.delete(id); await refresh();
  }, [refresh]);
  const saveGoal = useCallback(async (g: MoneyGoal) => { await moneyDb.goals.upsert(g); await refresh(); }, [refresh]);
  const deleteGoal = useCallback(async (id: string) => {
    setGoals(prev => prev.filter(x => x.id !== id)); await moneyDb.goals.delete(id); await refresh();
  }, [refresh]);

  return {
    loading, categories, expenseCategories, incomeCategories, subcategoriesOf, rootCategoryOf,
    transactions, periodTransactions, accounts, investments, cards, fixedCosts, loans, goals, settings,
    period, income, expense, balance, fixedTotal, assets, cardDebt, loanDebt, netWorth,
    investTotal, investPrincipal, investReturn, investReturnPct,
    daysLeft, dailyAllowance, noSpendStreak, trackingStartDate, spendByDay,
    categoryOf, cardUnpaid, cardUnbilledTxs, refresh,
    addTransaction, deleteTransaction, parseAndAdd, addCategory, saveCategory, deleteCategory, updateSettings,
    saveAccount, deleteAccount, saveCard, deleteCard, saveFixedCost, deleteFixedCost, refreshFxRates, settleFixedCosts,
    saveLoan, deleteLoan, saveGoal, deleteGoal,
  };
}
