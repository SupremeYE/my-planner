import { useCallback, useEffect, useState } from 'react';
import { db, type SomedaySeed, type SeedKind } from '../../lib/db';
import { useRealtimeSync } from './useRealtimeSync';

/**
 * 번쩍노트 '언젠가' (씨앗밭) 데이터 훅 — 하온 표준 패턴(로컬 state + Realtime 구독).
 *
 * 씨앗 목록 fetch + Supabase Realtime 구독(PC↔모바일 즉시 반영) + 기본 CRUD 를 캡슐화한다.
 * 승격(키우기) 흐름(목표/버킷)은 Stage 4 에서 이 훅 위에 얹는다 — 여기선 순수 데이터 레이어만.
 *
 * user_id 는 DB DEFAULT auth.uid() 가 자동 충전하므로 클라이언트는 보내지 않는다(walk/scrap 패턴).
 */
export function useSomedaySeeds() {
  const [seeds, setSeeds] = useState<SomedaySeed[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    db.somedaySeeds.fetchAll().then(rows => {
      setSeeds(rows);
      setLoading(false);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('someday_seeds', refresh);

  // 씨앗 던지기 — text(필수) + kind(기본 none). 생성 행을 낙관적으로 앞에 반영.
  const addSeed = useCallback(async (text: string, kind: SeedKind = 'none') => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const created = await db.somedaySeeds.create({ text: trimmed, kind, status: 'seed' });
    if (created) setSeeds(prev => (prev.some(s => s.id === created.id) ? prev : [created, ...prev]));
    return created;
  }, []);

  // 결(kind) 변경 — 낙관적 갱신 후 DB 반영.
  const setSeedKind = useCallback(async (id: string, kind: SeedKind) => {
    setSeeds(prev => prev.map(s => (s.id === id ? { ...s, kind } : s)));
    await db.somedaySeeds.update(id, { kind });
  }, []);

  const deleteSeed = useCallback(async (id: string) => {
    setSeeds(prev => prev.filter(s => s.id !== id));
    await db.somedaySeeds.delete(id);
  }, []);

  return { seeds, loading, refresh, addSeed, setSeedKind, deleteSeed };
}
