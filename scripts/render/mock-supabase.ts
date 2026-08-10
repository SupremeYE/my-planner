/**
 * 렌더 하네스용 Supabase 스텁 클라이언트.
 * `src/lib/supabase` 를 이 파일로 리다이렉트(scripts/render/run.mjs 의 Vite 플러그인)해
 * 네트워크·인증 없이 실제 컴포넌트를 렌더한다.
 *
 * - auth: 항상 로그인된 가짜 세션을 돌려준다 (AppContent 가 앱 본체를 마운트하도록).
 * - realtime(channel): no-op.
 * - storage / functions / rpc: 안전한 빈 응답.
 * 데이터 자체는 `mock-db.ts` 가 담당한다(이 스텁의 .from() 은 빈 결과만 준다).
 */

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
// await 하면 { data: [], error: null } 로 resolve 된다.
function makeQueryBuilder() {
  const result = { data: [], error: null };
  const single = { data: null, error: null };
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
  from: () => makeQueryBuilder(),
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
