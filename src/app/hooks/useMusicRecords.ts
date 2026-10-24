import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MusicEntry } from '../../lib/musicRecords';
import { supabase } from '../../lib/supabase';
import { musicRepository } from '../../lib/musicRecords';
import { mergeConfirmedRows, SaveCoordinator, saveIntent } from '../../lib/saveCoordinator';
import { useRealtimeSync } from './useRealtimeSync';

/** Feature-scoped confirmed state: keeps the legacy PlannerProvider and music UI untouched. */
export function useMusicRecords() {
  const [coordinator] = useState(() => new SaveCoordinator());
  const [repository] = useState(() => musicRepository(supabase));
  useSyncExternalStore(useCallback(cb => coordinator.subscribe(cb), [coordinator]), () => coordinator.revision);
  const [records, setRecords] = useState<MusicEntry[]>([]);
  const rows = useRef(records), sequence = useRef(0), mounted = useRef(true);
  const [loading, setLoading] = useState(true), [readError, setReadError] = useState('');
  const commit = useCallback((next: MusicEntry[]) => {
    sequence.current++; rows.current = next; if (mounted.current) setRecords(next);
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const remote = await repository.fetchConfirmed();
      if (!mounted.current || request !== sequence.current) return;
      const next = mergeConfirmedRows(remote, rows.current, coordinator.protectedIds('music'));
      rows.current = next; setRecords(next); setReadError('');
    } catch {
      if (mounted.current && request === sequence.current) setReadError('음악 기록을 불러오지 못했어요. 마지막으로 확인한 기록을 유지해요.');
    } finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, [repository, coordinator]);
  useEffect(() => {
    mounted.current = true; void refresh();
    const visible = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    window.addEventListener('online', visible); document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; sequence.current++; window.removeEventListener('online', visible); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useRealtimeSync('music_records', refresh);
  const save = (value: MusicEntry, baseline?: MusicEntry) => {
    const record = structuredClone(value), before = baseline ? structuredClone(baseline) : undefined;
    sequence.current++;
    return coordinator.run({ key: `music:${record.id}`, label: before ? '음악 기록 수정' : '음악 기록 등록',
      intent: saveIntent({record, before}), execute: () => repository.save(record, before),
      commit: confirmed => commit([...rows.current.filter(r => r.id !== confirmed.id), confirmed]),
    });
  };
  const remove = (id: string) => {
    sequence.current++;
    return coordinator.run({ key: `music:${id}`, label: '음악 기록 삭제', intent: 'delete',
      execute: async () => { await repository.deleteConfirmed(id); return id; },
      commit: deleted => commit(rows.current.filter(r => r.id !== deleted)),
    });
  };
  return { records, loading, readError, refresh, save, remove, states: coordinator.snapshot(),
    retry: (id: string) => coordinator.retry(`music:${id}`),
    dismiss: (id: string) => coordinator.dismiss(`music:${id}`),
  };
}
export type MusicController = ReturnType<typeof useMusicRecords>;
