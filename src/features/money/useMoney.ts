// 하온 머니 — 공용 데이터 훅. 8개 테이블 로드/Realtime 구독 + 파생값 메모이즈 + 액션.
// beauty/useBeauty 패턴 동일(UI 의존 0). 핵심: 채팅형 자연어 입력 → money-parse → 거래 기록.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../../app/hooks/useRealtimeSync';
import { moneyDb } from './db';
import { getMoneyPeriod, daysLeftInPeriod, type MoneyPeriod } from './period';
import type {
  MoneyCategory, MoneyTransaction, MoneyAccount, MoneyCard,
  MoneyFixedCost, MoneyLoan, MoneyGoal, MoneySettings, ParsedTx, TxType,
} from './types';

const today = () => format(new Date(), 'yyyy-MM-dd');

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
  // 기간/캘린더 파생
  daysLeft: number;            // 기간 종료까지 남은 일수(D-day)
  dailyAllowance: number;      // 남은 예산 / 남은 일수(오늘 포함)
  noSpendStreak: number;       // 어제 기준 연속 무지출 일수(기록 시작일 이후만)
  trackingStartDate: string | null; // 머니 기록 시작일(첫 거래일). 없으면 null
  spendByDay: Map<string, DayAgg>;  // 'yyyy-MM-dd' → {expense, income}
  categoryOf: (id: string | null) => MoneyCategory | null;
  refresh: () => Promise<void>;
  // 액션
  addTransaction: (tx: Partial<MoneyTransaction> & { type: TxType; amount: number }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  parseAndAdd: (text: string, mode: 'chat' | 'sms') => Promise<{ ok: boolean; error?: string; parsed?: ParsedTx }>;
  addCategory: (c: Partial<MoneyCategory> & { type: TxType; name: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSettings: (s: MoneySettings) => Promise<void>;
  // 자산/카드/고정비/대출/목표 — 수정(upsert)/삭제. id 있으면 수정, 없으면 추가.
  saveAccount: (a: MoneyAccount) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  saveCard: (c: MoneyCard) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  saveFixedCost: (f: MoneyFixedCost) => Promise<void>;
  deleteFixedCost: (id: string) => Promise<void>;
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
  const cardDebt = useMemo(() => cards.reduce((s, c) => s + c.unpaidAmount, 0), [cards]);
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
    await addTransaction({
      type: p.type, amount: p.amount,
      categoryId: subId ?? parentId,
      memo: p.memo ?? trimmed, paymentMethod: matchPaymentMethod(p.paymentMethod ?? null),
      spentAt: p.spentAt ?? today(), source: mode, rawInput: trimmed,
      emoji: p.emoji ?? null,
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
    daysLeft, dailyAllowance, noSpendStreak, trackingStartDate, spendByDay,
    categoryOf, refresh,
    addTransaction, deleteTransaction, parseAndAdd, addCategory, deleteCategory, updateSettings,
    saveAccount, deleteAccount, saveCard, deleteCard, saveFixedCost, deleteFixedCost,
    saveLoan, deleteLoan, saveGoal, deleteGoal,
  };
}
