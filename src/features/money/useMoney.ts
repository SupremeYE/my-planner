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
  expenseCategories: MoneyCategory[];
  incomeCategories: MoneyCategory[];
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
  noSpendStreak: number;       // 오늘 기준 연속 무지출 일수
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

  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);
  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const categoryOf = useCallback((id: string | null) => (id ? catById.get(id) ?? null : null), [catById]);

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

  // 오늘 기준 연속 무지출 일수(지출 0인 날을 거꾸로 카운트, 최대 60일).
  const noSpendStreak = useMemo(() => {
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if ((spendByDay.get(d)?.expense ?? 0) > 0) break;
      streak++;
    }
    return streak;
  }, [spendByDay]);

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

  // 카테고리 이름 → id 해석(type 일치). 없으면 null.
  const resolveCategoryId = useCallback((name: string | null, type: TxType): string | null => {
    if (!name) return null;
    const hit = categories.find(c => c.type === type && c.name === name);
    return hit?.id ?? null;
  }, [categories]);

  // 채팅/문자 자연어 → money-parse Edge Function → 거래 기록 (Stage 2 핵심)
  const parseAndAdd = useCallback(async (text: string, mode: 'chat' | 'sms') => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: '내용을 입력해 주세요' };
    const { data, error } = await supabase.functions.invoke('money-parse', {
      body: {
        text: trimmed, mode, today: today(),
        expense_categories: expenseCategories.map(c => c.name),
        income_categories: incomeCategories.map(c => c.name),
      },
    });
    if (error) { console.error('[money] parse invoke:', error.message); return { ok: false, error: '입력을 분석하지 못했어요' }; }
    if (!data?.ok || !data.tx) return { ok: false, error: data?.error || '인식하지 못했어요. 다시 입력해 보세요' };
    const p = data.tx as ParsedTx;
    await addTransaction({
      type: p.type, amount: p.amount,
      categoryId: resolveCategoryId(p.category, p.type),
      memo: p.memo ?? trimmed, paymentMethod: p.paymentMethod ?? null,
      spentAt: p.spentAt ?? today(), source: mode, rawInput: trimmed,
      emoji: p.emoji ?? null,
    });
    return { ok: true, parsed: p };
  }, [expenseCategories, incomeCategories, addTransaction, resolveCategoryId]);

  const addCategory = useCallback(async (c: Partial<MoneyCategory> & { type: TxType; name: string }) => {
    const maxOrder = categories.filter(x => x.type === c.type).reduce((m, x) => Math.max(m, x.sortOrder), -1);
    await moneyDb.categories.upsert({
      id: c.id ?? crypto.randomUUID(), type: c.type, name: c.name,
      emoji: c.emoji ?? null, color: c.color ?? null, isDefault: false, sortOrder: c.sortOrder ?? maxOrder + 1,
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

  return {
    loading, categories, expenseCategories, incomeCategories,
    transactions, periodTransactions, accounts, investments, cards, fixedCosts, loans, goals, settings,
    period, income, expense, balance, fixedTotal, assets, cardDebt, loanDebt, netWorth,
    daysLeft, dailyAllowance, noSpendStreak, spendByDay,
    categoryOf, refresh,
    addTransaction, deleteTransaction, parseAndAdd, addCategory, deleteCategory, updateSettings,
  };
}
