// 하온 머니 — 도메인 타입(camelCase). DB(snake_case) 매핑은 db.ts 에서 처리.

export type TxType = 'expense' | 'income';
export type TxSource = 'chat' | 'sms' | 'manual' | 'fixed';

export interface MoneyCategory {
  id: string;
  type: TxType;
  name: string;
  emoji: string | null;
  color: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface MoneyTransaction {
  id: string;
  type: TxType;
  amount: number;            // 원화 기준(원 단위)
  categoryId: string | null;
  memo: string | null;
  paymentMethod: string | null;
  spentAt: string;           // 'yyyy-MM-dd'
  source: TxSource;
  rawInput: string | null;
  createdAt?: string;
}

export type AccountType = 'deposit' | 'savings' | 'cash' | 'investment';

export interface MoneyAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  interestRate: number | null;
  icon: string | null;
  sortOrder: number;
  createdAt?: string;
}

export type CardType = 'credit' | 'check';

export interface MoneyCard {
  id: string;
  name: string;
  type: CardType;
  color: string | null;
  billingDay: number | null;
  unpaidAmount: number;
  sortOrder: number;
  createdAt?: string;
}

export type FixedCycle = 'monthly' | 'weekly' | 'yearly';
export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY';

export interface MoneyFixedCost {
  id: string;
  name: string;
  amount: number;                 // 원화 환산 금액
  originalAmount: number | null;  // 외화 원금액
  currency: Currency;
  cycle: FixedCycle;
  billingDay: number | null;
  paymentMethod: string | null;
  categoryId: string | null;
  isVariable: boolean;
  emoji: string | null;
  createdAt?: string;
}

export interface MoneyLoan {
  id: string;
  name: string;
  lender: string | null;
  repaymentType: string | null;
  principal: number | null;
  balance: number;
  interestRate: number | null;
  monthlyPayment: number | null;
  startDate: string | null;
  endDate: string | null;
  paymentDay: number | null;
  totalInstallments: number | null;
  paidInstallments: number;
  createdAt?: string;
}

export type GoalType = 'savings' | 'networth' | 'travel' | 'custom';

export interface MoneyGoal {
  id: string;
  name: string;
  emoji: string | null;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  type: GoalType;
  linkedAccountId: string | null;
  color: string | null;
  sortOrder: number;
  createdAt?: string;
}

export type PeriodType = 'calendar' | 'payday';

export interface MoneySettings {
  periodType: PeriodType;
  payday: number;
  monthlyBudget: number;
  currency: Currency;
  fxAlertThreshold: number;
}

// money-parse Edge Function 파싱 결과(클라이언트 ↔ 함수 계약)
export interface ParsedTx {
  type: TxType;
  amount: number;
  category: string | null;       // 카테고리 "이름"(클라가 id 로 해석)
  memo: string | null;
  paymentMethod: string | null;
  spentAt: string | null;        // 'yyyy-MM-dd' | null(없으면 오늘)
  emoji: string | null;
}
