import { useCallback, useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { getLogicalToday, type Memo } from '../store';
import { useRealtimeSync } from './useRealtimeSync';

// 메모 페이지 전용 훅 (일간 리디자인 Stage 5).
// db.memos.* 를 감싸 fetchAll + 낙관적 CRUD + Realtime 재조회를 제공한다.
// 전역 store 에 두지 않는 독립 도메인(스펙: View → mobile/PC split → useMemos + db.memos.*).
export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    db.memos.fetchAll().then(rows => { setMemos(rows); setLoading(false); });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  // 변경 시 PC↔모바일 즉시 반영
  useRealtimeSync('memos', refresh);

  // 작성 — 기본 귀속일은 논리상 오늘(하루 경계 단일 소스). opts.date 로 명시 가능(null=무날짜).
  const addMemo = useCallback((content: string, opts?: { date?: string | null; tags?: string[] }) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const memo: Memo = {
      id: crypto.randomUUID(),
      content: trimmed,
      date: opts && 'date' in opts ? opts.date ?? null : getLogicalToday(),
      tags: opts?.tags ?? [],
      confirmed: false,
    };
    setMemos(prev => [memo, ...prev]); // optimistic
    db.memos.upsert(memo);
  }, []);

  const updateMemo = useCallback((id: string, patch: Partial<Pick<Memo, 'content' | 'tags' | 'date' | 'confirmed'>>) => {
    const cur = memos.find(m => m.id === id);
    if (!cur) return;
    const next: Memo = { ...cur, ...patch };
    setMemos(prev => prev.map(m => (m.id === id ? next : m)));
    db.memos.upsert(next);
  }, [memos]);

  const toggleConfirmed = useCallback((id: string) => {
    const cur = memos.find(m => m.id === id);
    if (!cur) return;
    setMemos(prev => prev.map(m => (m.id === id ? { ...m, confirmed: !m.confirmed } : m)));
    db.memos.setConfirmed(id, !cur.confirmed);
  }, [memos]);

  const deleteMemo = useCallback((id: string) => {
    setMemos(prev => prev.filter(m => m.id !== id));
    db.memos.delete(id);
  }, []);

  return { memos, loading, addMemo, updateMemo, toggleConfirmed, deleteMemo, refresh };
}
