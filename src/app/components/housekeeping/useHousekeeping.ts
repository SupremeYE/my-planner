// 살림 공용 데이터 훅 (Stage 2) — 재고 + 소모품 교체주기 + 청소구역을 로드/구독하고
// 파생값(저재고·소진 카운트, 주기 상태, 구역 경과일)을 메모이즈해 노출한다.
// useWalkData / FridgeTab 의 Realtime 패턴을 그대로 따른다. (UI 의존 0)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { db } from '../../../lib/db';
import { daysSince, careStatus, isLowStock, isDepleted, type CareStatus } from '../../../lib/careUtils';
import type { HouseholdItem, ConsumableCycle, CleaningZone } from '../../store';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export interface CycleDerived extends ConsumableCycle {
  daysSince: number | null;
  status: CareStatus;
}

export interface ZoneDerived extends CleaningZone {
  daysSince: number | null;
}

export interface UseHousekeeping {
  items: HouseholdItem[];
  lowStockItems: HouseholdItem[];   // 곧 떨어져요
  depletedItems: HouseholdItem[];   // 소진(0개)
  lowStockCount: number;
  depletedCount: number;
  cycles: CycleDerived[];
  zones: ZoneDerived[];
  loading: boolean;
  refresh: () => Promise<void>;
  // 재고 액션
  addItem: (item: HouseholdItem) => Promise<void>;
  editItem: (item: HouseholdItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, delta: number) => Promise<void>;
  refill: (id: string, amount?: number) => Promise<void>;
  uploadItemPhoto: (recordId: string, file: File) => Promise<string | null>;
  // 소모품 교체주기 액션
  addCycle: (item: ConsumableCycle) => Promise<void>;
  editCycle: (item: ConsumableCycle) => Promise<void>;
  deleteCycle: (id: string) => Promise<void>;
  replaceConsumable: (id: string) => Promise<void>;
  setCycle: (id: string, days: number) => Promise<void>;
  // 청소구역 액션
  addZone: (item: CleaningZone) => Promise<void>;
  editZone: (item: CleaningZone) => Promise<void>;
  deleteZone: (id: string) => Promise<void>;
  markCleaned: (id: string) => Promise<void>;
}

export function useHousekeeping(): UseHousekeeping {
  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [cyclesRaw, setCyclesRaw] = useState<ConsumableCycle[]>([]);
  const [zonesRaw, setZonesRaw] = useState<CleaningZone[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [i, c, z] = await Promise.all([
      db.householdItems.fetchAll(),
      db.consumableCycles.fetchAll(),
      db.cleaningZones.fetchAll(),
    ]);
    setItems(i);
    setCyclesRaw(c);
    setZonesRaw(z);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('household_items', refresh);
  useRealtimeSync('consumable_cycles', refresh);
  useRealtimeSync('cleaning_zones', refresh);

  const lowStockItems = useMemo(() => items.filter(isLowStock), [items]);
  const depletedItems = useMemo(() => items.filter(isDepleted), [items]);

  const cycles = useMemo<CycleDerived[]>(() => cyclesRaw.map(c => {
    const ds = daysSince(c.replacedDates);
    return { ...c, daysSince: ds, status: careStatus(ds, c.cycleDays) };
  }), [cyclesRaw]);

  const zones = useMemo<ZoneDerived[]>(() => zonesRaw.map(z => ({
    ...z, daysSince: daysSince(z.cleanedDates),
  })), [zonesRaw]);

  // ── 재고 액션 ──
  const addItem = useCallback(async (item: HouseholdItem) => {
    await db.householdItems.upsert(item); await refresh();
  }, [refresh]);
  const editItem = useCallback(async (item: HouseholdItem) => {
    await db.householdItems.upsert(item); await refresh();
  }, [refresh]);
  const deleteItem = useCallback(async (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id)); // optimistic
    await db.householdItems.delete(id); await refresh();
  }, [refresh]);
  const updateQuantity = useCallback(async (id: string, delta: number) => {
    setItems(prev => prev.map(p => // optimistic, 0 미만 금지 (fridge 동일)
      p.id === id ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p));
    await db.householdItems.updateQuantity(id, delta);
  }, []);
  const refill = useCallback(async (id: string, amount?: number) => {
    setItems(prev => prev.map(p => // optimistic
      p.id === id ? { ...p, quantity: amount ?? p.thresholdQty } : p));
    await db.householdItems.refill(id, amount); await refresh();
  }, [refresh]);
  const uploadItemPhoto = useCallback(
    (recordId: string, file: File) => db.householdItems.uploadPhoto(recordId, file),
    [],
  );

  // ── 소모품 교체주기 액션 ──
  const addCycle = useCallback(async (item: ConsumableCycle) => {
    await db.consumableCycles.upsert(item); await refresh();
  }, [refresh]);
  const editCycle = useCallback(async (item: ConsumableCycle) => {
    await db.consumableCycles.upsert(item); await refresh();
  }, [refresh]);
  const deleteCycle = useCallback(async (id: string) => {
    setCyclesRaw(prev => prev.filter(c => c.id !== id)); // optimistic
    await db.consumableCycles.delete(id); await refresh();
  }, [refresh]);
  const replaceConsumable = useCallback(async (id: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setCyclesRaw(prev => prev.map(c => // optimistic (같은 날 중복 무시)
      c.id === id && !c.replacedDates.includes(today)
        ? { ...c, replacedDates: [...c.replacedDates, today] } : c));
    await db.consumableCycles.replace(id, today); await refresh();
  }, [refresh]);
  const setCycle = useCallback(async (id: string, days: number) => {
    setCyclesRaw(prev => prev.map(c => (c.id === id ? { ...c, cycleDays: days } : c))); // optimistic
    await db.consumableCycles.setCycle(id, days); await refresh();
  }, [refresh]);

  // ── 청소구역 액션 ──
  const addZone = useCallback(async (item: CleaningZone) => {
    await db.cleaningZones.upsert(item); await refresh();
  }, [refresh]);
  const editZone = useCallback(async (item: CleaningZone) => {
    await db.cleaningZones.upsert(item); await refresh();
  }, [refresh]);
  const deleteZone = useCallback(async (id: string) => {
    setZonesRaw(prev => prev.filter(z => z.id !== id)); // optimistic
    await db.cleaningZones.delete(id); await refresh();
  }, [refresh]);
  const markCleaned = useCallback(async (id: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setZonesRaw(prev => prev.map(z => // optimistic (같은 날 중복 무시)
      z.id === id && !z.cleanedDates.includes(today)
        ? { ...z, cleanedDates: [...z.cleanedDates, today] } : z));
    await db.cleaningZones.markCleaned(id, today); await refresh();
  }, [refresh]);

  return {
    items, lowStockItems, depletedItems,
    lowStockCount: lowStockItems.length, depletedCount: depletedItems.length,
    cycles, zones, loading, refresh,
    addItem, editItem, deleteItem, updateQuantity, refill, uploadItemPhoto,
    addCycle, editCycle, deleteCycle, replaceConsumable, setCycle,
    addZone, editZone, deleteZone, markCleaned,
  };
}
