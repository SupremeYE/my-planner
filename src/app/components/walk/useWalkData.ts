// 산책 공용 데이터 훅 — 산책 탭(자유/코스/내코스/완료 기록 카드)이 공유.
// walk_sessions 를 로드 + Realtime 구독(PC↔모바일 즉시 반영) + CRUD 래퍼 제공.
import { useCallback, useEffect, useState } from 'react';
import { db } from '../../../lib/db';
import type { WalkSession } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export interface WalkData {
  sessions: WalkSession[];        // 전체 세션(최신순)
  savedRoutes: WalkSession[];     // 저장해 둔 내 코스(is_saved_route)
  loading: boolean;
  refresh: () => Promise<void>;
  create: (input: Parameters<typeof db.walkSessions.create>[0]) => Promise<WalkSession | null>;
  update: (id: string, patch: Parameters<typeof db.walkSessions.update>[1]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useWalkData(): WalkData {
  const [sessions, setSessions] = useState<WalkSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await db.walkSessions.fetchAll();
    setSessions(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('walk_sessions', refresh);

  const create = useCallback<WalkData['create']>(async (input) => {
    const created = await db.walkSessions.create(input);
    await refresh();
    return created;
  }, [refresh]);

  const update = useCallback<WalkData['update']>(async (id, patch) => {
    await db.walkSessions.update(id, patch);
    await refresh();
  }, [refresh]);

  const remove = useCallback<WalkData['remove']>(async (id) => {
    await db.walkSessions.delete(id);
    await refresh();
  }, [refresh]);

  const savedRoutes = sessions.filter(s => s.isSavedRoute);

  return { sessions, savedRoutes, loading, refresh, create, update, remove };
}
