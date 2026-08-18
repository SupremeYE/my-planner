/**
 * 렌더 하네스용 머니 db 스텁 — `src/features/money/db.ts` 를 이 파일로 리다이렉트한다.
 * (mock-db.ts 가 `src/lib/db` 를 대신하는 것과 같은 역할. 머니는 feature-local db 라 파일을 분리한다.)
 *
 * useMoney 가 최초 로드에서 부르는 fetchAll/fetch 는 아래 SEED 를 돌려주고,
 * 그 밖의 호출(upsert/delete/replaceForPlan …)은 안전한 no-op 으로 흡수한다.
 *
 * 시드 날짜는 브라우저 런타임의 '오늘' 기준으로 동적 생성한다(mock-db.ts 와 동일 원칙).
 * 기간은 머니 기본 설정(급여일 25일 기준)을 그대로 계산해, 아래가 모두 화면에 나오도록 맞춘다.
 *  · 이번 기간 거래(같은 날짜 3건 = created_at 2차 정렬 확인용) + 지난 기간 거래
 *    → PeriodBar 로 기간을 옮기면 "최근 거래"·요약·카테고리별 지출이 함께 바뀐다.
 *  · 대분류/소분류 혼합 → 카테고리별 지출 드릴다운
 *  · 외화 거래·고정비 자동기록 거래 → 거래 행 메타(‘$12’, ‘🔁 고정’)
 *  · 통장·투자·카드·고정비·대출·목표 → 자산/투자 탭
 *  · 이번 기간 계획 + 분배 → 계획 배너("계획 완료")·예산바·계획 탭
 */

// ── 날짜 유틸 ──────────────────────────────────────────────────────────────
const now = new Date();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (n: number) => {
  const x = new Date(now);
  x.setDate(x.getDate() + n);
  return x;
};
const TODAY = iso(now);
// created_at 은 같은 날짜 안 2차 정렬 키 — 시각만 다르게 준다.
const at = (day: string, hour: number) => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;

// ── 기간 계산(급여일 25일 기준 — 아래 settings 와 동일 출처) ──────────────────
const PAYDAY = 25;
const clampDay = (y: number, m: number, day: number) => Math.min(day, new Date(y, m + 1, 0).getDate());
const paydayOf = (y: number, m: number) => new Date(y, m, clampDay(y, m, PAYDAY));
// 이번 기간 시작 = 오늘이 급여일 이후면 이번 달 급여일, 아니면 지난달 급여일.
const PERIOD_START =
  now.getDate() >= clampDay(now.getFullYear(), now.getMonth(), PAYDAY)
    ? paydayOf(now.getFullYear(), now.getMonth())
    : paydayOf(now.getFullYear(), now.getMonth() - 1);
const PREV_START = paydayOf(PERIOD_START.getFullYear(), PERIOD_START.getMonth() - 1);
// 기간 시작 + n일(단, 오늘을 넘기지 않음 — 미래 날짜 거래 방지)
const fromStart = (start: Date, n: number) => {
  const d = new Date(start);
  d.setDate(d.getDate() + n);
  return iso(d > now ? now : d);
};
const CUR = (n: number) => fromStart(PERIOD_START, n);
const PREV = (n: number) => fromStart(PREV_START, n);

// ── 카테고리(대분류 + 소분류) ───────────────────────────────────────────────
const cat = (
  id: string, name: string, emoji: string, color: string,
  sortOrder: number, parentId: string | null = null, type: 'expense' | 'income' = 'expense',
) => ({ id, type, name, emoji, color, parentId, isDefault: false, sortOrder });

const categories = [
  cat('mc-food', '식비', '🍚', '#D4735A', 1),
  cat('mc-food-out', '외식', '🍜', '#D4735A', 1, 'mc-food'),
  cat('mc-food-mart', '장보기', '🛒', '#D4735A', 2, 'mc-food'),
  cat('mc-transport', '교통', '🚌', '#8FB7C9', 2),
  cat('mc-shopping', '쇼핑', '🛍️', '#C4A882', 3),
  cat('mc-culture', '문화', '🎬', '#6BAA7A', 4),
  cat('mc-home', '주거', '🏠', '#A88FC9', 5),
  cat('mc-sub', '구독', '📺', '#8FB7C9', 6),
  cat('mc-salary', '월급', '💰', '#6BAA7A', 1, null, 'income'),
];

// ── 거래 ────────────────────────────────────────────────────────────────────
const tx = (o: Partial<any> & { id: string; amount: number; spentAt: string }) => ({
  type: 'expense' as const,
  categoryId: null, memo: null, paymentMethod: null,
  source: 'manual' as const, rawInput: null, emoji: null,
  originalAmount: null, currency: 'KRW' as const, fxRate: null, fixedCostId: null,
  createdAt: at(o.spentAt, 12),
  ...o,
});

const transactions = [
  // 이번 기간 — 오늘 3건은 spent_at 동률이라 created_at(2차 키) 순서로 내려와야 한다.
  tx({ id: 'mtx-1', amount: 4800, spentAt: TODAY, categoryId: 'mc-food-out', memo: '점심 김치찌개', paymentMethod: '삼성카드', emoji: '🍜', createdAt: at(TODAY, 20) }),
  tx({ id: 'mtx-2', amount: 12000, spentAt: TODAY, categoryId: 'mc-transport', memo: '택시', paymentMethod: '카카오페이', createdAt: at(TODAY, 13) }),
  tx({ id: 'mtx-3', amount: 3200, spentAt: TODAY, categoryId: 'mc-food-out', memo: '카페 라떼', paymentMethod: '체크카드', createdAt: at(TODAY, 9) }),
  tx({ id: 'mtx-4', amount: 16560, spentAt: CUR(9), categoryId: 'mc-sub', memo: 'Figma 구독', paymentMethod: '삼성카드', originalAmount: 12, currency: 'USD', fxRate: 1380 }),
  tx({ id: 'mtx-5', amount: 54000, spentAt: CUR(7), categoryId: 'mc-shopping', memo: '러닝화', paymentMethod: '삼성카드' }),
  tx({ id: 'mtx-6', amount: 38700, spentAt: CUR(5), categoryId: 'mc-food-mart', memo: '장보기', paymentMethod: '체크카드' }),
  tx({ id: 'mtx-7', amount: 15000, spentAt: CUR(3), categoryId: 'mc-culture', memo: '영화', paymentMethod: '삼성카드' }),
  tx({ id: 'mtx-8', amount: 9500, spentAt: CUR(2), categoryId: 'mc-food', memo: '편의점', paymentMethod: '현금' }),
  tx({ id: 'mtx-9', amount: 620000, spentAt: CUR(1), categoryId: 'mc-home', memo: '월세', paymentMethod: '자동이체', source: 'fixed', fixedCostId: 'mfc-rent', emoji: '🏠' }),
  tx({ id: 'mtx-10', type: 'income', amount: 3200000, spentAt: CUR(0), categoryId: 'mc-salary', memo: '8월 월급', paymentMethod: '급여통장', emoji: '💰' }),
  // 지난 기간 — 기간 이동 시 리스트/집계가 바뀌는지 확인용.
  tx({ id: 'mtx-11', amount: 27000, spentAt: PREV(16), categoryId: 'mc-food-out', memo: '친구 저녁', paymentMethod: '삼성카드' }),
  tx({ id: 'mtx-12', amount: 43000, spentAt: PREV(9), categoryId: 'mc-shopping', memo: '여름 티셔츠', paymentMethod: '삼성카드' }),
  tx({ id: 'mtx-13', amount: 8000, spentAt: PREV(2), categoryId: 'mc-transport', memo: '주유', paymentMethod: '체크카드' }),
];

// ── 자산(통장·투자) ─────────────────────────────────────────────────────────
const accounts = [
  { id: 'ma-1', name: '급여통장', type: 'deposit', balance: 2450000, interestRate: null, icon: '🏦', sortOrder: 1, investKind: null, principal: null, quantity: null },
  { id: 'ma-2', name: '비상금 적금', type: 'savings', balance: 5000000, interestRate: 3.4, icon: '🐖', sortOrder: 2, investKind: null, principal: null, quantity: null },
  { id: 'ma-3', name: '주식 계좌', type: 'investment', balance: 7350000, interestRate: null, icon: '📈', sortOrder: 3, investKind: 'stock', principal: 6800000, quantity: 42 },
  { id: 'ma-4', name: '코인', type: 'investment', balance: 1180000, interestRate: null, icon: '🪙', sortOrder: 4, investKind: 'coin', principal: 1400000, quantity: 0.03 },
];

const cards = [
  { id: 'mcd-1', name: '삼성카드', type: 'credit', color: '#3A352E', billingDay: 14, unpaidAmount: 180000, sortOrder: 1 },
  { id: 'mcd-2', name: '체크카드', type: 'check', color: '#6BAA7A', billingDay: null, unpaidAmount: 0, sortOrder: 2 },
];

// createdAt = 오늘 → settleFixedCosts 의 "생성일 이전 주기는 기록 안 함" 가드에 걸려
// 하네스 실행 중 거래가 자동 생성되지 않는다(시드 고정).
const fixedCosts = [
  { id: 'mfc-rent', name: '월세', amount: 620000, originalAmount: null, currency: 'KRW', cycle: 'monthly', billingDay: 1, paymentMethod: '자동이체', categoryId: 'mc-home', isVariable: false, emoji: '🏠', fxRate: null, fxRateDate: null, fxChangePct: null, createdAt: TODAY },
  { id: 'mfc-figma', name: 'Figma', amount: 16560, originalAmount: 12, currency: 'USD', cycle: 'monthly', billingDay: 9, paymentMethod: '삼성카드', categoryId: 'mc-sub', isVariable: false, emoji: '🎨', fxRate: 1380, fxRateDate: TODAY, fxChangePct: 1.2, createdAt: TODAY },
  { id: 'mfc-elec', name: '전기·가스', amount: 92000, originalAmount: null, currency: 'KRW', cycle: 'monthly', billingDay: 20, paymentMethod: '자동이체', categoryId: null, isVariable: true, emoji: '💡', fxRate: null, fxRateDate: null, fxChangePct: null, createdAt: TODAY },
];

const loans = [
  { id: 'ml-1', name: '전세자금대출', lender: '국민은행', repaymentType: '원리금균등', principal: 60000000, balance: 41200000, interestRate: 3.1, monthlyPayment: 480000, startDate: iso(shift(-700)), endDate: iso(shift(1400)), paymentDay: 20, totalInstallments: 60, paidInstallments: 23 },
];

const goals = [
  { id: 'mg-1', name: '여행 자금', emoji: '✈️', targetAmount: 3000000, currentAmount: 1250000, deadline: iso(shift(120)), type: 'travel', linkedAccountId: 'ma-2', color: '#C4A882', sortOrder: 1 },
  { id: 'mg-2', name: '비상금 6개월', emoji: '🛟', targetAmount: 12000000, currentAmount: 5000000, deadline: null, type: 'savings', linkedAccountId: 'ma-2', color: '#6BAA7A', sortOrder: 2 },
];

// ── 이번 기간 계획 + 분배(통장 쪼개기) ──────────────────────────────────────
const PLAN_ID = 'mp-current';
const plans = [
  {
    id: PLAN_ID,
    periodStart: iso(PERIOD_START),
    periodEnd: iso(new Date(paydayOf(PERIOD_START.getFullYear(), PERIOD_START.getMonth() + 1).getTime() - 86400000)),
    expectedIncome: 3200000,
    fixedCostTotal: 1208560,
    availableAmount: 1991440,
    plannedSavings: 600000,
    plannedInvestment: 300000,
    plannedLiving: 1200000,
    livingLimit: 1200000,
  },
];

const allocations = [
  { id: 'mpa-1', planId: PLAN_ID, name: '비상금', amount: 400000, accountId: 'ma-2', isLiving: false, sortOrder: 1 },
  { id: 'mpa-2', planId: PLAN_ID, name: '여행 저축', amount: 200000, accountId: 'ma-2', isLiving: false, sortOrder: 2 },
  { id: 'mpa-3', planId: PLAN_ID, name: '투자', amount: 300000, accountId: 'ma-3', isLiving: false, sortOrder: 3 },
  { id: 'mpa-4', planId: PLAN_ID, name: '생활비', amount: 1200000, accountId: 'ma-1', isLiving: true, sortOrder: 4 },
];

// 회고는 미작성 상태로 둔다 — 주/월 배너의 "회고하기" 유도 UI 를 그대로 검증.
const reviews: any[] = [];

const settings = {
  periodType: 'payday' as const,
  payday: PAYDAY,
  monthlyBudget: 1200000,
  currency: 'KRW' as const,
  fxAlertThreshold: 3.0,
};

// ── SEED 매핑 (useMoney 가 부르는 namespace.fetchAll → 시드) ─────────────────
const SEED: Record<string, any[]> = {
  categories, transactions, accounts, cards, fixedCosts, loans, goals, plans, allocations, reviews,
};

// ── namespace 프록시 ─────────────────────────────────────────────────────────
// fetchAll → 시드 배열, settings.fetch → 설정 객체, 그 밖(upsert/delete/replaceForPlan …)은 no-op.
function nsProxy(name: string): any {
  return new Proxy(
    {},
    {
      get(_t, method) {
        if (method === 'then') return undefined;
        const m = String(method);
        if (name === 'settings' && m === 'fetch') return async () => settings;
        if (m === 'fetchAll') return async () => SEED[name] ?? [];
        return async () => null;
      },
    }
  );
}

export const moneyDb: any = new Proxy(
  {},
  {
    get(_t, ns) {
      if (ns === 'then') return undefined;
      return nsProxy(String(ns));
    },
  }
);

export default moneyDb;
