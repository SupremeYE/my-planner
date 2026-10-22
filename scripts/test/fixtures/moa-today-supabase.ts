/** Only resolved by moa-today.test.mjs. Real codecs/Provider/Auth, socket-free transport. */
import { memorySupabase } from './memory-supabase';
const fixture = (window as any).__moaFixture ?? { tables: {} };
const instance = memorySupabase(fixture.tables);
export const controls = { ...instance.controls, reads: [] as string[] };
(window as any).testDb = controls;
const originalFrom = instance.supabase.from;
export const supabase = Object.assign(instance.supabase, {
  from(table: string) {
    controls.reads.push(table);
    const query = originalFrom(table);
    if (!fixture.delay) return query;
    // Delay initial loading only; do not replace the real DB/Provider read pipeline.
    const delayed: any = new Proxy({}, { get(_, prop) {
      if (prop === 'then') return (resolve: any, reject: any) => new Promise(r => setTimeout(r, fixture.delay)).then(() => query.then(resolve, reject));
      const value = query[prop];
      return typeof value === 'function' ? (...args: any[]) => { const result = value(...args); return result === query ? delayed : result; } : value;
    } });
    return delayed;
  },
  auth: {
    getSession: async () => ({ data: { session: fixture.signedOut ? null : { user: { id: 'isolated-user', user_metadata: { name: '테스트 사용자' } }, access_token: 'isolated-test-session' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
});
