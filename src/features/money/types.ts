// 하온 머니 — 도메인 타입(camelCase). DB(snake_case) 매핑은 db.ts 에서 처리.

export type TxType = 'expense' | 'income';
export type TxSource = 'chat' | 'sms' | 'manual' | 'fixed';

export interface MoneyCategory {
  id: string;
  type: TxType;
  name: string;
  emoji: string | null;
  color: string | null;
  parentId: string | null;   // null=대분류, 값 있으면 소분류(대분류 id)
  isDefault: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface MoneyTransaction {
  id: string;
  type: TxType;
  amount: number;            // 원화 기준(원 단위) — 외화 거래도 환산 후 이 값으로 저장
  categoryId: string | null;
  memo: string | null;
  paymentMethod: string | null;
  spentAt: string;           // 'yyyy-MM-dd'
  source: TxSource;
  rawInput: string | null;
  emoji: string | null;      // 거래별 이모지(🍖 등). 없으면 카테고리 이모지로 폴백.
  // 외화 거래 보존(원화 amount 와 별도). 원화 거래는 currency='KRW', 나머지 null.
  originalAmount: number | null;  // 외화 원금($20 → 20)
  currency: Currency;             // 'KRW' 기본
  fxRate: number | null;          // 적용 환율(1 외화 = N KRW)
  fixedCostId: string | null;     // 고정비 자동 기록(source='fixed')이면 그 고정비 id
  createdAt?: string;
}

export type AccountType = 'deposit' | 'savings' | 'cash' | 'investment';
export type InvestKind = 'stock' | 'fund' | 'coin';   // 투자계좌 종목 구분

export interface MoneyAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: number;            // 일반 계좌=잔액 / 투자계좌=현재 평가액
  interestRate: number | null;
  icon: string | null;
  sortOrder: number;
  // 투자계좌(type='investment') 전용 — 그 외 계좌는 모두 null.
  investKind: InvestKind | null;  // 주식/펀드/코인
  principal: number | null;       // 매입원금(수익률 계산 기준). 없으면 등락률 미표시
  quantity: number | null;        // 보유수량
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
  // 외화 환율 추적(원화 고정비는 모두 null) — Frankfurter 결제일 직전 1회 갱신.
  fxRate: number | null;        // 직전 적용 1단위 환율(1 USD = N KRW)
  fxRateDate: string | null;    // 'yyyy-MM-dd' 그 환율 취득일(사이클 가드)
  fxChangePct: number | null;   // 직전 환율 대비 변동률(%)
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

// 월간 계획(Plan-Stage 1) — 기간별 1행. period_start 로 기간 식별.
//  · fixedCostTotal/availableAmount 는 계획 수립 시점 스냅샷(회고 비교 기준). 라이브 값은 런타임 재계산.
export interface MoneyPlan {
  id: string;
  periodStart: string;          // 'yyyy-MM-dd' (getMoneyPeriod().start)
  periodEnd: string;
  expectedIncome: number;       // 예상 수입(월급+부수입)
  fixedCostTotal: number;       // 고정 지출 합(월환산 고정비 + 대출 월상환) 스냅샷
  availableAmount: number;      // 예상수입 − 고정지출 가용 금액 스냅샷
  plannedSavings: number;       // 선저축 배분
  plannedInvestment: number;    // 투자 배분
  plannedLiving: number;        // 생활비(변동) 배분
  createdAt?: string;
}

// 회고(Plan-Stage 2) — 주간/월말. 대부분 자동 계산이라 저장은 최소(소감/조정만 사용자 입력).
//  · weekly: weekIndex = 주차(1-based). monthly: weekIndex = null.
//  · totalSpent 는 회고 시점 지출 스냅샷(표시/비교용. 라이브 값은 런타임 재계산).
export type ReviewType = 'weekly' | 'monthly';

export interface MoneyReview {
  id: string;
  type: ReviewType;
  periodStart: string;          // 'yyyy-MM-dd' (getMoneyPeriod().start)
  periodEnd: string;
  weekIndex: number | null;     // weekly: 주차 / monthly: null
  totalSpent: number;           // 회고 시점 지출 집계 스냅샷
  note: string | null;          // 한 줄 소감(선택)
  nextAdjustment: Record<string, unknown> | null;  // 다음 기간 조정 제안(선택)
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
  amount: number;                // currency 단위 금액(외화면 외화 단위: $20 → 20)
  currency: Currency;            // 'KRW' 기본. "달러/$"→USD 등
  category: string | null;       // 대분류 "이름"(클라가 id 로 해석)
  subcategory: string | null;    // 소분류 "이름"(대분류의 자식, 추론 애매하면 null)
  memo: string | null;
  paymentMethod: string | null;
  spentAt: string | null;        // 'yyyy-MM-dd' | null(없으면 오늘)
  emoji: string | null;
}
