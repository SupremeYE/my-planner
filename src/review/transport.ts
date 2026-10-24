/** Review-only alias. No real Supabase client or credentials are imported. */
import { supabase as memory, controls } from '../../scripts/test/fixtures/moa-today-supabase';

const urls = new Map<string, string>();
const storage = memory.storage;
const sampleOnly = async () => ({ data: { user: null }, error: { message: '샘플 검토에서는 계정·외부 API를 변경하지 않아요.' } });
export const supabase = Object.assign(memory, {
  auth: {
    ...memory.auth,
    signInWithPassword: sampleOnly,
    updateUser: sampleOnly,
    resetPasswordForEmail: sampleOnly,
    signOut: async () => { window.alert('샘플 검토에는 실제 로그인이 없어요. 상단의 샘플 초기화를 이용해주세요.'); return { error: null }; },
  },
  storage: {
    from(bucket: string) {
      const value = storage.from(bucket);
      return {
        ...value,
        getPublicUrl(path: string) {
          const key = `${bucket}/${path}`;
          const blob = controls.storageObjects.get(key);
          if (!blob) return { data: { publicUrl: '' } };
          if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
          return { data: { publicUrl: urls.get(key) } };
        },
      };
    },
  },
  functions: { invoke: sampleOnly },
  rpc: sampleOnly,
});
