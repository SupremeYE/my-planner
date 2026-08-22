/**
 * 렌더 하네스용 Supabase 스텁 클라이언트.
 * `src/lib/supabase` 를 이 파일로 리다이렉트(scripts/render/run.mjs 의 Vite 플러그인)해
 * 네트워크·인증 없이 실제 컴포넌트를 렌더한다.
 *
 * - auth: 항상 로그인된 가짜 세션을 돌려준다 (AppContent 가 앱 본체를 마운트하도록).
 * - realtime(channel): no-op.
 * - storage / functions / rpc: 안전한 빈 응답.
 * - from(table): 대부분 빈 결과. 단 BooksView 처럼 db 레이어를 거치지 않고
 *   supabase 를 직접 부르는 화면을 위해 books/book_quotes/book_notes 는 SUPA_SEED 를 돌려준다.
 *   (mock-db 와 동일 철학 — 필터/정렬은 무시하고 시드를 그대로 반환.)
 * 그 밖의 데이터는 `mock-db.ts` 가 담당한다.
 */

// ── 날짜 유틸: 브라우저 '오늘' 기준 동적 시드 ──────────────────────────────
const _now = new Date();
const _iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const _shift = (n: number) => { const x = new Date(_now); x.setDate(x.getDate() + n); return x; };
const TODAY = _iso(_now);
const THIS_MONTH_5 = _iso(_shift(-3));  // 이달의 문장(이번 달 즐겨찾기)용
const DONE_DATE = _iso(_shift(-20));    // 완독일(올해)

// ── 독서(BooksView) 시드 — 구절 여럿 + 완독/읽는중/읽고싶은 혼합 ──────────
// thumbnail 은 전부 '' → 표지 플레이스홀더(구 라벤더→surfaceMuted) 검증.
const SUPA_SEED: Record<string, any[]> = {
  books: [
    {
      id: 'bk-reading', title: '몰입의 즐거움', author: '미하이 칙센트미하이',
      publisher: '해냄', thumbnail: '', total_pages: 320, current_page: 128,
      status: 'reading', start_date: _iso(_shift(-14)), finish_date: null, added_at: _iso(_shift(-14)),
    },
    {
      id: 'bk-want', title: '달러구트 꿈 백화점', author: '이미예',
      publisher: '팩토리나인', thumbnail: '', total_pages: 0, current_page: 0,
      status: 'want', start_date: null, finish_date: null, added_at: _iso(_shift(-5)),
    },
    {
      id: 'bk-done', title: '코스모스', author: '칼 세이건',
      publisher: '사이언스북스', thumbnail: '', total_pages: 400, current_page: 400,
      status: 'done', start_date: _iso(_shift(-40)), finish_date: DONE_DATE, added_at: _iso(_shift(-40)),
    },
  ],
  book_quotes: [
    {
      id: 'q1', book_id: 'bk-reading',
      text: '즐거움은 목표를 향해 나아갈 때가 아니라, 그 과정에 온전히 몰입할 때 찾아온다.',
      page: 42, tags: ['성장', '몰입'], starred: true, created_at: THIS_MONTH_5,
      note: '결과보다 과정에 집중하자는 말. 요즘 나에게 딱 필요한 문장.', image_url: null,
    },
    {
      id: 'q2', book_id: 'bk-reading',
      text: '주의를 기울이는 방식이 곧 우리가 경험하는 삶의 질을 결정한다.',
      page: 88, tags: [], starred: false, created_at: _iso(_shift(-6)),
      note: null, image_url: null,
    },
    {
      id: 'q3', book_id: 'bk-reading',
      text: '명확한 목표와 즉각적인 피드백이 있을 때 우리는 가장 깊이 몰입한다.',
      page: 150, tags: ['플로우'], starred: true, created_at: _iso(_shift(-9)),
      note: '일할 때 피드백 루프를 짧게 만들 것.', image_url: null,
    },
  ],
  book_notes: [
    { book_id: 'bk-reading', type: 'purpose', content: '몰입의 조건을 이해하고 일과 공부에 적용하기.' },
    { book_id: 'bk-reading', type: 'output', content: '피드백 루프를 짧게, 목표를 구체적으로.' },
  ],
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
// await 하면 { data: SUPA_SEED[table] ?? [], error: null } 로 resolve 된다.
// (필터/정렬은 무시 — mock-db 와 동일 철학. 시드가 있는 테이블만 값을 돌려준다.)
function makeQueryBuilder(table?: string) {
  const data = (table && SUPA_SEED[table]) || [];
  const result = { data, error: null };
  const single = { data: data[0] ?? null, error: null };
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
  from: (table?: string) => makeQueryBuilder(table),
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
