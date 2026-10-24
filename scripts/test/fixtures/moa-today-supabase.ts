/** Only resolved by moa-today.test.mjs. Real codecs/Provider/Auth, socket-free transport. */
import { memoryFoodStorage } from './memory-food-storage';
import { memorySupabase } from './memory-supabase';
const fixture = (window as any).__moaFixture ?? { tables: {} };
const instance = memorySupabase(fixture.tables);
for (const fault of fixture.faults ?? []) instance.controls.failNext(fault.table, fault);
const photoMemory = memoryFoodStorage(fixture.storage ?? []);
export const controls = { ...instance.controls, reads: [] as string[], storageObjects: photoMemory.controls.objects, storageRequests: photoMemory.controls.requests, failNextStorage: photoMemory.controls.failNext, holdStorage: photoMemory.controls.hold, releaseStorage: photoMemory.controls.release };
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
  storage: fixture.localPhotoReview ? {
    from(bucket: string) {
      const storage = photoMemory.storage.from(bucket);
      return { ...storage,
        async upload(path: string, file: File, options: any) {
          try {
            const response = await fetch(`/__moa-memory-photo/${encodeURIComponent(path)}`, { method: 'POST', body: file });
            if (!response.ok) return { data: null, error: { statusCode: String(response.status), code: response.status === 409 ? 'Duplicate' : 'TEST', message: 'isolated photo mirror failed' } };
          } catch { return { data: null, error: { statusCode: '0', message: 'isolated photo mirror unavailable' } }; }
          return storage.upload(path, file, options);
        },
        getPublicUrl(path: string) { return { data: { publicUrl: `${window.location.origin}/storage/v1/object/public/${bucket}/${path}` } }; },
      };
    },
  } : photoMemory.storage,
  auth: {
    getSession: async () => ({ data: { session: fixture.signedOut ? null : { user: { id: 'isolated-user', user_metadata: { name: '테스트 사용자' } }, access_token: 'isolated-test-session' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
});
