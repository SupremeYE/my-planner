import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Event } from '../store';
import { getActualEventsConfirmed } from '../../api/events';
import { supabase } from '../../lib/supabase';
import { activityRepository } from '../../lib/activityRepository';
import { validateActivity, type ActivityEntry } from '../../lib/activityEntries';
import { mergeConfirmedRows, SaveCoordinator, SaveFailure, saveIntent } from '../../lib/saveCoordinator';

const repository = activityRepository(supabase);
export function useActivityStorage(coordinator: SaveCoordinator, events: Event[], development = false) {
  const [activityEntries, setEntries] = useState<ActivityEntry[]>([]);
  const [historicalEvents, setHistoricalEvents] = useState<Event[] | null>(null);
  const [activityEventsError, setEventsError] = useState('');
  const rows = useRef<ActivityEntry[]>([]);
  const [activityStorageStatus, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(development ? 'loading' : 'unavailable');
  const [activityStorageError, setError] = useState('');
  const ready = useRef(false);
  const refreshActivityEntries = useCallback(async (): Promise<void> => {
    const revision = coordinator.revision;
    try {
      await repository.checkSchema();
      const remote = await repository.fetchConfirmed();
      if (revision !== coordinator.revision) { queueMicrotask(() => void refreshActivityEntries()); return; }
      rows.current = mergeConfirmedRows(remote, rows.current, coordinator.protectedIds('activityEntries'));
      setEntries(rows.current); ready.current = true; setStatus('ready'); setError('');
    } catch (error) {
      ready.current = false; setStatus('unavailable');
      setError(error instanceof SaveFailure ? error.message : '기록을 불러오지 못했어요. 연결을 확인하고 다시 불러와주세요.');
      // Keep the last confirmed rows on a failed refresh.
    }
  }, [coordinator]);
  const refreshReportEvents = useCallback(async () => {
    try { setHistoricalEvents(await getActualEventsConfirmed()); setEventsError(''); }
    catch { setEventsError('과거 일정 실적을 확인하지 못했어요. 현재 합계가 전체 실적과 다를 수 있어요.'); }
  }, []);
  useEffect(() => {
    if (!development) return; // Product entry remains unchanged until this feature is approved.
    let active = true;
    const refresh = () => { if (active && document.visibilityState !== 'hidden') void refreshActivityEntries(); };
    const refreshEvents = () => { if (active && document.visibilityState !== 'hidden') void refreshReportEvents(); };
    refreshEvents();
    refresh();
    const channel = supabase.channel('moamoa:activity_entries').on('postgres_changes' as any, { event: '*', schema: 'public', table: 'activity_entries' }, refresh).subscribe();
    const eventChannel = supabase.channel('moamoa:actual_events').on('postgres_changes' as any, { event: '*', schema: 'public', table: 'events' }, () => void refreshEvents()).subscribe();
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refreshEvents); document.addEventListener('visibilitychange', refreshEvents);
    return () => { active = false; supabase.removeChannel(channel); supabase.removeChannel(eventChannel); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refreshEvents); document.removeEventListener('visibilitychange', refreshEvents); };
  }, [development, refreshActivityEntries, refreshReportEvents]);
  const persistActivity = useCallback(async (value: ActivityEntry, editing = false) => {
    const record = structuredClone(value);
    const before = rows.current.find(row => row.id === record.id);
    const saved = await coordinator.run({ key: `activityEntries:${record.id}`, label: editing ? '활동 수정' : '활동 기록', intent: saveIntent(record),
      execute: async () => {
        if (!ready.current) throw new SaveFailure('기록 저장을 사용할 수 없어요. 스키마와 연결 상태를 확인해주세요.', false);
        validateActivity(record);
        if (editing) {
          if (!before || !await repository.getConfirmed(record.id)) throw new SaveFailure('수정할 기록이 없어요. 다시 불러와 확인해주세요.', false);
          return repository.updateConfirmed(before, record);
        }
        if (record.id !== record.operationId) throw new SaveFailure('기록 요청 ID를 확인해주세요.', false);
        return repository.createConfirmed(record);
      }, commit: confirmed => { rows.current = [...rows.current.filter(row => row.id !== confirmed.id), confirmed]; setEntries(rows.current); } });
    return saved !== null;
  }, [coordinator]);
  const removeActivity = useCallback(async (id: string) => {
    const saved = await coordinator.run({ key: `activityEntries:${id}`, label: '활동 삭제', intent: 'delete', execute: async () => {
      if (!ready.current) throw new SaveFailure('기록 저장을 사용할 수 없어요. 다시 불러와주세요.', false);
      await repository.deleteConfirmed(id); return id;
    }, commit: deleted => { rows.current = rows.current.filter(row => row.id !== deleted); setEntries(rows.current); } });
    return saved !== null;
  }, [coordinator]);
  const reportEvents = useMemo(() => historicalEvents == null ? events : [...events.filter(e => !historicalEvents.some(h => h.id === e.id)), ...historicalEvents], [events, historicalEvents]);
  return { reportEvents, refreshReportEvents, activityEventsError, activityEntries, activityStorageStatus, activityStorageError, refreshActivityEntries, persistActivity, removeActivity };
}
