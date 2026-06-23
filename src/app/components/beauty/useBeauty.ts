// 뷰티 케어 공용 데이터 훅 (Stage 2) — 보유함 + 스페셜케어를 로드/구독하고
// 파생값(셀프케어 게이지·케어별 경과일/상태·최근 7일)을 메모이즈해 노출한다.
// useWalkData / FridgeTab 의 Realtime 패턴을 그대로 따른다. (UI 의존 0)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { db } from '../../../lib/db';
import { daysSince, careStatus, selfCareScore, type CareStatus } from '../../../lib/careUtils';
import type { BeautyProduct, BeautySpecialCare } from '../../store';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export interface CareDerived extends BeautySpecialCare {
  daysSince: number | null;
  status: CareStatus;
}

export interface UseBeauty {
  products: BeautyProduct[];
  activeProducts: BeautyProduct[];   // is_active = true (사용 중)
  archivedProducts: BeautyProduct[]; // is_active = false (다 쓴 보관)
  specialCares: CareDerived[];
  selfCareScore: number;             // 하트% 게이지 (0~100)
  recentCareCount: number;           // 롤링 7일(오늘-6~오늘) 케어 수행 횟수
  careSpark: number[];               // 길이 7, 과거→오늘 일별 수행 횟수(스파크용)
  loading: boolean;
  refresh: () => Promise<void>;
  // 액션
  addProduct: (item: BeautyProduct) => Promise<void>;
  editProduct: (item: BeautyProduct) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  repurchase: (product: BeautyProduct) => Promise<void>;
  setProductActive: (id: string, active: boolean) => Promise<void>;
  uploadProductPhoto: (recordId: string, file: File) => Promise<string | null>;
  addCare: (item: BeautySpecialCare) => Promise<void>;
  editCare: (item: BeautySpecialCare) => Promise<void>;
  deleteCare: (id: string) => Promise<void>;
  markCareDone: (id: string) => Promise<void>;
}

export function useBeauty(): UseBeauty {
  const [products, setProducts] = useState<BeautyProduct[]>([]);
  const [specialCares, setSpecialCares] = useState<BeautySpecialCare[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [p, c] = await Promise.all([
      db.beautyProducts.fetchAll(),
      db.beautySpecialCare.fetchAll(),
    ]);
    setProducts(p);
    setSpecialCares(c);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('beauty_products', refresh);
  useRealtimeSync('beauty_special_care', refresh);

  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
  const archivedProducts = useMemo(() => products.filter(p => !p.isActive), [products]);

  const caresDerived = useMemo<CareDerived[]>(() => specialCares.map(c => {
    const ds = daysSince(c.doneDates);
    return { ...c, daysSince: ds, status: careStatus(ds, c.cycleDays) };
  }), [specialCares]);

  const score = useMemo(() => selfCareScore(specialCares), [specialCares]);

  // 게이지와 별개 레이어: 롤링 7일(오늘-6 ~ 오늘) 일별 수행 횟수.
  const careSpark = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));
    return days.map(d => specialCares.reduce((n, c) => n + (c.doneDates.includes(d) ? 1 : 0), 0));
  }, [specialCares]);
  const recentCareCount = useMemo(() => careSpark.reduce((a, b) => a + b, 0), [careSpark]);

  // ── 액션 (낙관적 업데이트 후 db → realtime 으로 재동기화) ──
  const addProduct = useCallback(async (item: BeautyProduct) => {
    await db.beautyProducts.upsert(item); await refresh();
  }, [refresh]);
  const editProduct = useCallback(async (item: BeautyProduct) => {
    await db.beautyProducts.upsert(item); await refresh();
  }, [refresh]);
  const deleteProduct = useCallback(async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id)); // optimistic
    await db.beautyProducts.delete(id); await refresh();
  }, [refresh]);
  const repurchase = useCallback(async (product: BeautyProduct) => {
    await db.beautyProducts.repurchase(product); await refresh();
  }, [refresh]);
  const setProductActive = useCallback(async (id: string, active: boolean) => {
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, isActive: active } : p))); // optimistic
    await db.beautyProducts.setActive(id, active); await refresh();
  }, [refresh]);
  const uploadProductPhoto = useCallback(
    (recordId: string, file: File) => db.beautyProducts.uploadPhoto(recordId, file),
    [],
  );

  const addCare = useCallback(async (item: BeautySpecialCare) => {
    await db.beautySpecialCare.upsert(item); await refresh();
  }, [refresh]);
  const editCare = useCallback(async (item: BeautySpecialCare) => {
    await db.beautySpecialCare.upsert(item); await refresh();
  }, [refresh]);
  const deleteCare = useCallback(async (id: string) => {
    setSpecialCares(prev => prev.filter(c => c.id !== id)); // optimistic
    await db.beautySpecialCare.delete(id); await refresh();
  }, [refresh]);
  const markCareDone = useCallback(async (id: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setSpecialCares(prev => prev.map(c => // optimistic (같은 날 중복 무시)
      c.id === id && !c.doneDates.includes(today)
        ? { ...c, doneDates: [...c.doneDates, today] } : c));
    await db.beautySpecialCare.markDone(id, today);
    await refresh();
  }, [refresh]);

  return {
    products, activeProducts, archivedProducts,
    specialCares: caresDerived,
    selfCareScore: score, recentCareCount, careSpark,
    loading, refresh,
    addProduct, editProduct, deleteProduct, repurchase, setProductActive, uploadProductPhoto,
    addCare, editCare, deleteCare, markCareDone,
  };
}
