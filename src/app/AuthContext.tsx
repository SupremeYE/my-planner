import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  updateName: (name: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // 비밀번호 재설정 메일 링크로 진입한 상태 (새 비밀번호 설정 화면 표시용)
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // 저장된 세션 복원
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // 로그인/로그아웃/토큰갱신 구독
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // 재설정 메일 링크 클릭 시 Supabase가 PASSWORD_RECOVERY 이벤트 발생
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateEmail = async (email: string) => {
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  // 표시 이름 변경 — Supabase 계정 메타데이터(user_metadata.name)에 영구 저장
  const updateName = async (name: string) => {
    const { data, error } = await supabase.auth.updateUser({ data: { name: name.trim() } });
    // updateUser 성공 시 갱신된 user를 즉시 세션에 반영 (다른 화면도 새 이름 사용)
    if (!error && data.user) {
      setSession(prev => (prev ? { ...prev, user: data.user } : prev));
    }
    return { error: error?.message ?? null };
  };

  // 비밀번호 찾기 — 재설정 링크를 이메일로 발송
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    return { error: error?.message ?? null };
  };

  const clearRecovery = () => setRecovery(false);

  return (
    <AuthContext.Provider
      value={{ session, loading, recovery, signIn, signOut, updateEmail, updatePassword, updateName, resetPassword, clearRecovery }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
