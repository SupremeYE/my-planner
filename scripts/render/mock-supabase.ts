/**
 * 렌더 하네스용 Supabase 스텁 클라이언트.
 * `src/lib/supabase` 를 이 파일로 리다이렉트(scripts/render/run.mjs 의 Vite 플러그인)해
 * 네트워크·인증 없이 실제 컴포넌트를 렌더한다.
 *
 * - auth: 항상 로그인된 가짜 세션을 돌려준다 (AppContent 가 앱 본체를 마운트하도록).
 * - realtime(channel): no-op.
 * - storage / functions / rpc: 안전한 빈 응답.
 * - 데이터: 대부분의 페이지는 `lib/db` → `mock-db.ts` 시드를 쓴다(이쪽 .from() 은 빈 결과).
 *   단, **머니 모듈은 `lib/db` 가 아니라 자체 `features/money/db.ts` 가 `lib/supabase` 를
 *   직접 호출**하므로, `money_*` 테이블에 한해 아래 MONEY_SEED 를 .from() 이 돌려준다.
 *   (그 외 테이블은 종전대로 빈 배열 → 다른 라우트 무영향.)
 */

// ── 머니 시드(snake_case, features/money/db.ts 매퍼가 camel 로 변환) ──────────────
// 날짜는 브라우저 '오늘' 기준 동적 생성 → 급여일(25) 기간 안에 들어오도록 최근 날짜로.
const _t = new Date();
const _iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const _dAgo = (n: number) => { const x = new Date(_t); x.setDate(x.getDate() - n); return _iso(x); };
// getMoneyPeriod(payday=25) 와 동일 규칙으로 현재 기간 시작/끝 계산(plan 탭 매칭용).
const _PAYDAY = 25;
const _periodStart = (() => {
  const y = _t.getFullYear(), m = _t.getMonth();
  return _t.getDate() >= _PAYDAY ? new Date(y, m, _PAYDAY) : new Date(y, m - 1, _PAYDAY);
})();
const _periodEnd = (() => {
  const s = _periodStart;
  return new Date(s.getFullYear(), s.getMonth() + 1, _PAYDAY - 1);
})();
const _P_START = _iso(_periodStart), _P_END = _iso(_periodEnd);

const MONEY_SEED: Record<string, any[]> = {
  money_settings: [
    { user_id: 'mock-user-0001', period_type: 'payday', payday: 25, monthly_budget: 1200000, currency: 'KRW', fx_alert_threshold: 3.0 },
  ],
  money_categories: [
    // 지출 대분류 11
    { id: 'c_food', type: 'expense', name: '식비', emoji: '🍚', color: '#D4735A', is_default: true, sort_order: 0, parent_id: null },
    { id: 'c_daily', type: 'expense', name: '생필품', emoji: '🧻', color: '#C4A882', is_default: true, sort_order: 1, parent_id: null },
    { id: 'c_transport', type: 'expense', name: '교통', emoji: '🚌', color: '#6BAA7A', is_default: true, sort_order: 2, parent_id: null },
    { id: 'c_cafe', type: 'expense', name: '카페', emoji: '☕', color: '#7A7265', is_default: true, sort_order: 3, parent_id: null },
    { id: 'c_shop', type: 'expense', name: '쇼핑', emoji: '🛍️', color: '#E8A84C', is_default: true, sort_order: 4, parent_id: null },
    { id: 'c_culture', type: 'expense', name: '문화', emoji: '🎬', color: '#8B7EC8', is_default: true, sort_order: 5, parent_id: null },
    { id: 'c_health', type: 'expense', name: '건강', emoji: '💊', color: '#5B9BD5', is_default: true, sort_order: 6, parent_id: null },
    { id: 'c_telco', type: 'expense', name: '통신', emoji: '📱', color: '#B8AD9E', is_default: true, sort_order: 7, parent_id: null },
    { id: 'c_subs', type: 'expense', name: '구독', emoji: '🔁', color: '#A88BC8', is_default: true, sort_order: 8, parent_id: null },
    { id: 'c_ins', type: 'expense', name: '보험', emoji: '🛡️', color: '#7BA8B8', is_default: true, sort_order: 9, parent_id: null },
    { id: 'c_home', type: 'expense', name: '주거', emoji: '🏠', color: '#C8956B', is_default: true, sort_order: 10, parent_id: null },
    // 식비 소분류 2(계층 렌더 확인용)
    { id: 'c_food_out', type: 'expense', name: '외식', emoji: '🍽️', color: null, is_default: true, sort_order: 0, parent_id: 'c_food' },
    { id: 'c_food_grocery', type: 'expense', name: '장보기', emoji: '🛒', color: null, is_default: true, sort_order: 1, parent_id: 'c_food' },
    // 수입 대분류 4
    { id: 'c_salary', type: 'income', name: '급여', emoji: '💰', color: '#4E9E6A', is_default: true, sort_order: 0, parent_id: null },
    { id: 'c_side', type: 'income', name: '부수입', emoji: '💵', color: '#7FB8A0', is_default: true, sort_order: 1, parent_id: null },
    { id: 'c_gift', type: 'income', name: '용돈/선물', emoji: '🎁', color: '#E091A8', is_default: true, sort_order: 2, parent_id: null },
    { id: 'c_invprofit', type: 'income', name: '투자수익', emoji: '📈', color: '#4FA3C7', is_default: true, sort_order: 3, parent_id: null },
  ],
  money_transactions: [
    { id: 't_salary', type: 'income', amount: 2800000, category_id: 'c_salary', memo: '8월 급여', payment_method: null, spent_at: _P_START, source: 'chat', raw_input: '급여 280만원', emoji: '💰', currency: 'KRW' },
    { id: 't1', type: 'expense', amount: 12000, category_id: 'c_food_out', memo: '점심 김치찌개', payment_method: '신한카드', spent_at: _dAgo(0), source: 'chat', raw_input: '점심 김치찌개 12000', emoji: '🍽️', currency: 'KRW' },
    { id: 't2', type: 'expense', amount: 4800, category_id: 'c_cafe', memo: '아메리카노', payment_method: '신한카드', spent_at: _dAgo(0), source: 'chat', raw_input: '카페 4800', emoji: '☕', currency: 'KRW' },
    { id: 't3', type: 'expense', amount: 1400, category_id: 'c_transport', memo: '버스', payment_method: null, spent_at: _dAgo(0), source: 'chat', raw_input: '버스 1400', emoji: '🚌', currency: 'KRW' },
    { id: 't4', type: 'expense', amount: 8900, category_id: 'c_daily', memo: '휴지·세제', payment_method: '신한카드', spent_at: _dAgo(1), source: 'manual', raw_input: null, emoji: '🧻', currency: 'KRW' },
    { id: 't5', type: 'expense', amount: 34000, category_id: 'c_shop', memo: '티셔츠', payment_method: '신한카드', spent_at: _dAgo(2), source: 'manual', raw_input: null, emoji: '🛍️', currency: 'KRW' },
    { id: 't6', type: 'expense', amount: 15000, category_id: 'c_culture', memo: '영화', payment_method: '신한카드', spent_at: _dAgo(3), source: 'manual', raw_input: null, emoji: '🎬', currency: 'KRW' },
    { id: 't7', type: 'income', amount: 50000, category_id: 'c_side', memo: '중고거래', payment_method: null, spent_at: _dAgo(4), source: 'manual', raw_input: null, emoji: '💵', currency: 'KRW' },
  ].sort((a, b) => (a.spent_at < b.spent_at ? 1 : -1)),
  money_accounts: [
    { id: 'a_main', name: '주거래통장', type: 'deposit', balance: 3200000, icon: '🏦', sort_order: 0, is_default: true, include_in_total: true },
    { id: 'a_save', name: '비상금통장', type: 'deposit', balance: 5000000, icon: '💵', sort_order: 1, is_default: false, include_in_total: true },
    { id: 'a_invest', name: '해외주식', type: 'investment', balance: 1800000, invest_kind: 'stock', principal: 1500000, quantity: 10, sort_order: 2, is_default: false, include_in_total: true },
  ],
  money_cards: [
    { id: 'card_shinhan', name: '신한카드', type: 'credit', color: '#5B9BD5', billing_day: 14, unpaid_amount: 240000, sort_order: 0, linked_account_id: 'a_main' },
  ],
  money_fixed_costs: [
    { id: 'f_netflix', name: '넷플릭스', amount: 17000, currency: 'KRW', cycle: 'monthly', billing_day: 20, payment_method: '신한카드', category_id: 'c_subs', is_variable: false, emoji: '🔁' },
    { id: 'f_rent', name: '월세', amount: 550000, currency: 'KRW', cycle: 'monthly', billing_day: 25, payment_method: null, category_id: 'c_home', is_variable: false, emoji: '🏠' },
  ],
  money_goals: [
    { id: 'g_travel', name: '여행 자금', emoji: '🏝️', target_amount: 3000000, current_amount: 1200000, deadline: null, type: 'savings', color: '#6BAA7A', sort_order: 0 },
  ],
  money_loans: [
    { id: 'l_student', name: '학자금대출', lender: '한국장학재단', repayment_type: 'equal', principal: 10000000, balance: 4200000, interest_rate: 2.5, monthly_payment: 300000, payment_day: 5, total_installments: 36, paid_installments: 18 },
  ],
  money_plans: [
    { id: 'p_cur', period_start: _P_START, period_end: _P_END, expected_income: 2800000, fixed_cost_total: 567000, available_amount: 2233000, planned_savings: 800000, planned_investment: 300000, planned_living: 1133000, living_limit: 1133000 },
  ],
  money_plan_allocations: [
    { id: 'al_living', plan_id: 'p_cur', name: '생활비', amount: 1133000, account_id: 'a_main', is_living: true, sort_order: 0 },
    { id: 'al_save', plan_id: 'p_cur', name: '저축', amount: 800000, account_id: 'a_save', is_living: false, sort_order: 1 },
    { id: 'al_invest', plan_id: 'p_cur', name: '투자', amount: 300000, account_id: 'a_invest', is_living: false, sort_order: 2 },
  ],
  money_reviews: [],
};

const FAKE_USER = {
  id: 'mock-user-0001',
  email: 'demo@haon.app',
  user_metadata: { name: '하온' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
};

const FAKE_SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: FAKE_USER,
};

// 체이닝 가능한 쿼리 빌더: 모든 메서드가 자기 자신을 반환하고,
// await 하면 { data: rows, error: null } 로 resolve 된다.
// rows 는 테이블 시드(money_*) 또는 빈 배열(그 외). order/eq 등 필터는 render 목적상 무시.
function makeQueryBuilder(rows: any[] = []) {
  const result = { data: rows, error: null };
  const single = { data: rows[0] ?? null, error: null };
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') {
        // thenable — await 지원
        return (resolve: any) => resolve(result);
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => Promise.resolve(single);
      }
      if (prop === 'csv' || prop === 'geojson') {
        return () => Promise.resolve({ data: '', error: null });
      }
      // 그 외 모든 메서드(select/insert/update/upsert/delete/eq/in/order/limit/...)
      // → 빌더 자신 반환(계속 체이닝)
      return () => proxy;
    },
  };
  const proxy: any = new Proxy({}, handler);
  return proxy;
}

const storageBucket = {
  createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }),
  createSignedUrls: async () => ({ data: [], error: null }),
  getPublicUrl: () => ({ data: { publicUrl: '' } }),
  upload: async () => ({ data: { path: '' }, error: null }),
  remove: async () => ({ data: [], error: null }),
  download: async () => ({ data: null, error: null }),
  list: async () => ({ data: [], error: null }),
};

const authApi = {
  getSession: async () => ({ data: { session: FAKE_SESSION }, error: null }),
  getUser: async () => ({ data: { user: FAKE_USER }, error: null }),
  onAuthStateChange: (cb: (event: string, session: any) => void) => {
    // 다음 tick 에 로그인 이벤트 통지 → AuthContext 가 세션을 세팅
    Promise.resolve().then(() => cb('INITIAL_SESSION', FAKE_SESSION));
    return { data: { subscription: { unsubscribe() {} } } };
  },
  signInWithPassword: async () => ({ data: { session: FAKE_SESSION, user: FAKE_USER }, error: null }),
  signOut: async () => ({ error: null }),
  updateUser: async () => ({ data: { user: FAKE_USER }, error: null }),
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
};

function makeChannel() {
  const ch: any = {
    on: () => ch,
    subscribe: (cb?: (status: string) => void) => {
      if (cb) Promise.resolve().then(() => cb('SUBSCRIBED'));
      return ch;
    },
    unsubscribe: async () => 'ok',
    send: async () => 'ok',
    track: async () => 'ok',
    untrack: async () => 'ok',
  };
  return ch;
}

const baseClient: any = {
  // money_* 테이블은 시드를 돌려주고, 그 외 테이블은 빈 배열(종전 동작 유지).
  from: (table?: string) => makeQueryBuilder(table ? MONEY_SEED[table] ?? [] : []),
  rpc: () => makeQueryBuilder(),
  auth: authApi,
  storage: { from: () => storageBucket },
  functions: { invoke: async () => ({ data: null, error: null }) },
  channel: () => makeChannel(),
  removeChannel: async () => 'ok',
  removeAllChannels: async () => 'ok',
  getChannels: () => [],
};

// 알 수 없는 최상위 프로퍼티 접근도 안전하게 흡수
export const supabase: any = new Proxy(baseClient, {
  get(target, prop) {
    if (prop in target) return (target as any)[prop];
    return () => makeQueryBuilder();
  },
});

export default supabase;
