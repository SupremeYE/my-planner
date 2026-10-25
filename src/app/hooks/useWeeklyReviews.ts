import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { WeeklyReview } from '../store';
import { supabase } from '../../lib/supabase';
import { weeklyReviewRepository } from '../../lib/weeklyReviewRepository';
import { mergeConfirmedRows, SaveCoordinator, saveIntent } from '../../lib/saveCoordinator';
import { useRealtimeSync } from './useRealtimeSync';

/** Feature-local confirmed state: legacy /reviews and its optimistic store are not changed. */
export function useWeeklyReviews() {
  const [repository] = useState(() => weeklyReviewRepository(supabase));
  const [coordinator] = useState(() => new SaveCoordinator());
  useSyncExternalStore(useCallback(fn => coordinator.subscribe(fn), [coordinator]), () => coordinator.revision);
  const [records, setRecords] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true), [readError, setReadError] = useState('');
  const rows = useRef<WeeklyReview[]>([]), generation = useRef(0), mounted = useRef(true);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const remote = await repository.fetchConfirmed();
      if (!mounted.current || request !== generation.current) return;
      rows.current = mergeConfirmedRows(remote, rows.current, coordinator.protectedIds('weeklyReviews'));
      setRecords(rows.current); setReadError('');
    } catch {
      if (mounted.current && request === generation.current) setReadError('주간 회고를 불러오지 못했어요. 회고가 없는 것으로 판단하지 않고 마지막 확인 결과를 유지해요.');
    } finally { if (mounted.current && request === generation.current) setLoading(false); }
  }, [repository, coordinator]);
  useEffect(() => {
    mounted.current = true; void refresh();
    const visible = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    window.addEventListener('online', visible); document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; generation.current++; window.removeEventListener('online', visible); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useRealtimeSync('weekly_reviews', refresh);
  const save = (value: WeeklyReview, before?: WeeklyReview) => {
    generation.current++;
    const target = structuredClone(value), original = before && structuredClone(before);
    return coordinator.run({ key: `weeklyReviews:${value.id}`, label: '주간 회고', intent: saveIntent({ target, original }),
      execute: () => repository.save(target, original), commit: record => {
        generation.current++;
        rows.current = [...rows.current.filter(row => row.id !== record.id), record];
        if (mounted.current) setRecords(rows.current);
      } });
  };
  return { records, loading, readError, refresh, save, states: coordinator.snapshot(),
    retry: (id: string) => { generation.current++; return coordinator.retry(`weeklyReviews:${id}`); },
    dismiss: (id: string) => coordinator.dismiss(`weeklyReviews:${id}`) };
}
export type WeeklyReviewController = ReturnType<typeof useWeeklyReviews>;
