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

  // ── 승격(키우기) ──────────────────────────────────────────────────────────
  // 결정(A안): '목표로' = annual_goals 에 시드에서 직접 insert(goal id 는 client 생성 —
  // annual_goals.id 는 text PK), year 는 올해 자동(연도 선택 UI 없음), grownTo='goal'.
  // 만다라트 등 목표 세부 종류 확장은 후속에 grown_ref_kind 로(이번 범위 밖).
  const growToGoal = useCallback(async (seed: SomedaySeed) => {
    if (seed.status === 'grown') return null;
    const goalId = crypto.randomUUID();
    const year = new Date().getFullYear();
    // 승격 대상 목표 먼저 생성(annual_goals). 실패해도 시드는 건드리지 않는다.
    await db.annualGoals.upsert({ id: goalId, year, text: seed.text, done: false });
    setSeeds(prev => prev.map(s => (s.id === seed.id
      ? { ...s, status: 'grown', grownTo: 'goal', grownRefId: goalId } : s)));
    await db.somedaySeeds.update(seed.id, { status: 'grown', grownTo: 'goal', grownRefId: goalId });
    return goalId;
  }, []);

  // '버킷으로' = 전용 뷰가 아직 없으므로 마킹만(grownTo='bucket', ref 없음). 데이터는 안 깨지게.
  const growToBucket = useCallback(async (seed: SomedaySeed) => {
    if (seed.status === 'grown') return;
    setSeeds(prev => prev.map(s => (s.id === seed.id
      ? { ...s, status: 'grown', grownTo: 'bucket', grownRefId: null } : s)));
    await db.somedaySeeds.update(seed.id, { status: 'grown', grownTo: 'bucket', grownRefId: null });
  }, []);

  // 되돌리기 — 시드만 씨앗으로 복귀. ⚠️ 이미 만든 annual_goal 은 삭제하지 않는다(목표 페이지에서
  // 수정됐을 수 있음 → 시드만 seed 로 복귀, 목표는 목표 페이지에 그대로 남는다).
  const revertSeed = useCallback(async (seed: SomedaySeed) => {
    if (seed.status !== 'grown') return;
    setSeeds(prev => prev.map(s => (s.id === seed.id
      ? { ...s, status: 'seed', grownTo: null, grownRefId: null } : s)));
    await db.somedaySeeds.update(seed.id, { status: 'seed', grownTo: null, grownRefId: null });
  }, []);

  return { seeds, loading, refresh, addSeed, setSeedKind, deleteSeed, growToGoal, growToBucket, revertSeed };
}
