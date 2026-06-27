// 하온 머니 — 데이터 액세스(독립 모듈 db 헬퍼). beauty/db.ts 패턴 동일:
//  · row(snake_case) ↔ domain(camelCase) 매핑
//  · insert/upsert 시 user_id 는 컬럼 default auth.uid() 에 위임(명시 안 함)
//  · 에러는 콘솔 로깅 후 graceful(빈 배열/무시)
import { supabase } from '../../lib/supabase';
import type {
  MoneyCategory, MoneyTransaction, MoneyAccount, MoneyCard,
  MoneyFixedCost, MoneyLoan, MoneyGoal, MoneySettings, Currency, PeriodType,
} from './types';

const num = (v: any): number | null => (v != null ? Number(v) : null);

// ── categories ──
const categories = {
  fetchAll: async (): Promise<MoneyCategory[]> => {
    const { data, error } = await supabase
      .from('money_categories').select('*').order('sort_order', { ascending: true });
    if (error) console.error('[money] categories fetch:', error.message);
    return (data ?? []).map((r: any): MoneyCategory => ({
      id: r.id, type: r.type, name: r.name, emoji: r.emoji ?? null, color: r.color ?? null,
      isDefault: r.is_default ?? false, sortOrder: r.sort_order ?? 0, createdAt: r.created_at ?? undefined,
    }));
  },
  upsert: async (item: MoneyCategory) => {
    const { error } = await supabase.from('money_categories').upsert({
      id: item.id, type: item.type, name: item.name, emoji: item.emoji ?? null,
      color: item.color ?? null, is_default: item.isDefault ?? false, sort_order: item.sortOrder ?? 0,
    }, { onConflict: 'id' });
    if (error) console.error('[money] categories upsert:', error.message);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('money_categories').delete().eq('id', id);
    if (error) console.error('[money] categories delete:', error.message);
  },
};

// ── transactions ──
const transactions = {
  fetchAll: async (): Promise<MoneyTransaction[]> => {
    const { data, error } = await supabase
      .from('money_transactions').select('*').order('spent_at', { ascending: false });
    if (error) console.error('[money] transactions fetch:', error.message);
    return (data ?? []).map((r: any): MoneyTransaction => ({
      id: r.id, type: r.type, amount: Number(r.amount), categoryId: r.category_id ?? null,
      memo: r.memo ?? null, paymentMethod: r.payment_method ?? null, spentAt: r.spent_at,
      source: r.source ?? 'manual', rawInput: r.raw_input ?? null, emoji: r.emoji ?? null,
      createdAt: r.created_at ?? undefined,
    }));
  },
  upsert: async (item: MoneyTransaction) => {
    const { error } = await supabase.from('money_transactions').upsert({
      id: item.id, type: item.type, amount: item.amount, category_id: item.categoryId ?? null,
      memo: item.memo ?? null, payment_method: item.paymentMethod ?? null, spent_at: item.spentAt,
      source: item.source ?? 'manual', raw_input: item.rawInput ?? null, emoji: item.emoji ?? null,
    }, { onConflict: 'id' });
    if (error) console.error('[money] transactions upsert:', error.message);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('money_transactions').delete().eq('id', id);
    if (error) console.error('[money] transactions delete:', error.message);
  },
};

// ── accounts ──
const accounts = {
  fetchAll: async (): Promise<MoneyAccount[]> => {
    const { data, error } = await supabase
      .from('money_accounts').select('*').order('sort_order', { ascending: true });
    if (error) console.error('[money] accounts fetch:', error.message);
    return (data ?? []).map((r: any): MoneyAccount => ({
      id: r.id, name: r.name, type: r.type, balance: Number(r.balance ?? 0),
      interestRate: num(r.interest_rate), icon: r.icon ?? null, sortOrder: r.sort_order ?? 0,
      createdAt: r.created_at ?? undefined,
    }));
  },
  upsert: async (item: MoneyAccount) => {
    const { error } = await supabase.from('money_accounts').upsert({
      id: item.id, name: item.name, type: item.type, balance: item.balance,
      interest_rate: item.interestRate ?? null, icon: item.icon ?? null, sort_order: item.sortOrder ?? 0,
    }, { onConflict: 'id' });
    if (error) console.error('[money] accounts upsert:', error.message);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('money_accounts').delete().eq('id', id);
    if (error) console.error('[money] accounts delete:', error.message);
  },
};

// ── cards ──
const cards = {
  fetchAll: async (): Promise<MoneyCard[]> => {
    const { data, error } = await supabase
      .from('money_cards').select('*').order('sort_order', { ascending: true });
    if (error) console.error('[money] cards fetch:', error.message);
    return (data ?? []).map((r: any): MoneyCard => ({
      id: r.id, name: r.name, type: r.type, color: r.color ?? null,
      billingDay: num(r.billing_day), unpaidAmount: Number(r.unpaid_amount ?? 0),
      sortOrder: r.sort_order ?? 0, createdAt: r.created_at ?? undefined,
    }));
  },
  upsert: async (item: MoneyCard) => {
    const { error } = await supabase.from('money_cards').upsert({
      id: item.id, name: item.name, type: item.type, color: item.color ?? null,
      billing_day: item.billingDay ?? null, unpaid_amount: item.unpaidAmount ?? 0, sort_order: item.sortOrder ?? 0,
    }, { onConflict: 'id' });
    if (error) console.error('[money] cards upsert:', error.message);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('money_cards').delete().eq('id', id);
    if (error) console.error('[money] cards delete:', error.message);
  },
};

// ── fixed_costs ──
const fixedCosts = {
  fetchAll: async (): Promise<MoneyFixedCost[]> => {
    const { data, error } = await supabase
      .from('money_fixed_costs').select('*').order('billing_day', { ascending: true });
    if (error) console.error('[money] fixed_costs fetch:', error.message);
    return (data ?? []).map((r: any): MoneyFixedCost => ({
      id: r.id, name: r.name, amount: Number(r.amount), originalAmount: num(r.original_amount),
      currency: (r.currency ?? 'KRW') as Currency, cycle: r.cycle ?? 'monthly',
      billingDay: num(r.billing_day), paymentMethod: r.payment_method ?? null,
      categoryId: r.category_id ?? null, isVariable: r.is_variable ?? false,
      emoji: r.emoji ?? null, createdAt: r.created_at ?? undefined,
    }));
  },
  upsert: async (item: MoneyFixedCost) => {
    const { error } = await supabase.from('money_fixed_costs').upsert({
      id: item.id, name: item.name, amount: item.amount, original_amount: item.originalAmount ?? null,
      currency: item.currency, cycle: item.cycle, billing_day: item.billingDay ?? null,
      payment_method: item.paymentMethod ?? null, category_id: item.categoryId ?? null,
      is_variable: item.isVariable ?? false, emoji: item.emoji ?? null,
    }, { onConflict: 'id' });
    if (error) console.error('[money] fixed_costs upsert:', error.message);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('money_fixed_costs').delete().eq('id', id);
    if (error) console.error('[money] fixed_costs delete:', error.message);
  },
};

// ── loans ──
const loans = {
  fetchAll: async (): Promise<MoneyLoan[]> => {
    const { data, error } = await supabase
      .from('money_loans').select('*').order('created_at', { ascending: false });
    if (error) console.error('[money] loans fetch:', error.message);
    return (data ?? []).map((r: any): MoneyLoan => ({
      id: r.id, name: r.name, lender: r.lender ?? null, repaymentType: r.repayment_type ?? null,
      principal: num(r.principal), balance: Number(r.balance ?? 0), interestRate: num(r.interest_rate),
      monthlyPayment: num(r.monthly_payment), startDate: r.start_date ?? null, endDate: r.end_date ?? null,
      paymentDay: num(r.payment_day), totalInstallments: num(r.total_installments),
      paidInstallments: Number(r.paid_installments ?? 0), createdAt: r.created_at ?? undefined,
    }));
  },
  upsert: async (item: MoneyLoan) => {
    const { error } = await supabase.from('money_loans').upsert({
      id: item.id, name: item.name, lender: item.lender ?? null, repayment_type: item.repaymentType ?? null,
      principal: item.principal ?? null, balance: item.balance, interest_rate: item.interestRate ?? null,
      monthly_payment: item.monthlyPayment ?? null, start_date: item.startDate ?? null, end_date: item.endDate ?? null,
      payment_day: item.paymentDay ?? null, total_installments: item.totalInstallments ?? null,
      paid_installments: item.paidInstallments ?? 0,
    }, { onConflict: 'id' });
    if (error) console.error('[money] loans upsert:', error.message);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('money_loans').delete().eq('id', id);
    if (error) console.error('[money] loans delete:', error.message);
  },
};

// ── goals ──
const goals = {
  fetchAll: async (): Promise<MoneyGoal[]> => {
    const { data, error } = await supabase
      .from('money_goals').select('*').order('sort_order', { ascending: true });
    if (error) console.error('[money] goals fetch:', error.message);
    return (data ?? []).map((r: any): MoneyGoal => ({
      id: r.id, name: r.name, emoji: r.emoji ?? null, targetAmount: Number(r.target_amount),
      currentAmount: Number(r.current_amount ?? 0), deadline: r.deadline ?? null, type: r.type ?? 'savings',
      linkedAccountId: r.linked_account_id ?? null, color: r.color ?? null,
      sortOrder: r.sort_order ?? 0, createdAt: r.created_at ?? undefined,
    }));
  },
  upsert: async (item: MoneyGoal) => {
    const { error } = await supabase.from('money_goals').upsert({
      id: item.id, name: item.name, emoji: item.emoji ?? null, target_amount: item.targetAmount,
      current_amount: item.currentAmount ?? 0, deadline: item.deadline ?? null, type: item.type,
      linked_account_id: item.linkedAccountId ?? null, color: item.color ?? null, sort_order: item.sortOrder ?? 0,
    }, { onConflict: 'id' });
    if (error) console.error('[money] goals upsert:', error.message);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('money_goals').delete().eq('id', id);
    if (error) console.error('[money] goals delete:', error.message);
  },
};

const DEFAULT_SETTINGS: MoneySettings = {
  periodType: 'payday', payday: 25, monthlyBudget: 1200000, currency: 'KRW', fxAlertThreshold: 3.0,
};

// ── settings (user_id PK, 1행) ──
const settings = {
  fetch: async (): Promise<MoneySettings> => {
    const { data, error } = await supabase.from('money_settings').select('*').maybeSingle();
    if (error) console.error('[money] settings fetch:', error.message);
    if (!data) return DEFAULT_SETTINGS;
    return {
      periodType: (data.period_type ?? 'payday') as PeriodType,
      payday: Number(data.payday ?? 25),
      monthlyBudget: Number(data.monthly_budget ?? 1200000),
      currency: (data.currency ?? 'KRW') as Currency,
      fxAlertThreshold: Number(data.fx_alert_threshold ?? 3.0),
    };
  },
  upsert: async (s: MoneySettings) => {
    // user_id 는 default auth.uid() 로 자동 — 하지만 PK upsert 충돌 해소를 위해 명시 조회 후 update/insert.
    const { data: me } = await supabase.auth.getUser();
    const uid = me?.user?.id;
    const row: any = {
      period_type: s.periodType, payday: s.payday, monthly_budget: s.monthlyBudget,
      currency: s.currency, fx_alert_threshold: s.fxAlertThreshold,
    };
    if (uid) row.user_id = uid;
    const { error } = await supabase.from('money_settings').upsert(row, { onConflict: 'user_id' });
    if (error) console.error('[money] settings upsert:', error.message);
  },
};

export const moneyDb = {
  categories, transactions, accounts, cards, fixedCosts, loans, goals, settings,
};
