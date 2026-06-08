import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db, exerciseLabel } from '../../../lib/db';
import type { WorkoutLog } from '../../../lib/db';
import { SheetShell } from './SheetShell';
import { ExerciseThumb } from './ExerciseThumb';
import { RecordSheet } from './RecordSheet';
import { isoToShortLabel, summarizeSets, totalVolume } from './workoutUtils';

interface Props {
  onClose: () => void;
  onChanged: () => void;   // 오늘의 운동/스트릭 갱신
}

export function HistorySheet({ onClose, onChanged }: Props) {
  const { t } = useTheme();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WorkoutLog | null>(null);

  const refresh = useCallback(async () => {
    const list = await db.workouts.listAll();
    setLogs(list);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // performed_on 내림차순 날짜 그룹
  const groups = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const log of logs) {
      const arr = map.get(log.performedOn) ?? [];
      arr.push(log);
      map.set(log.performedOn, arr);
    }
    return Array.from(map.entries()); // listAll 이 이미 내림차순 → 자연 정렬 유지
  }, [logs]);

  return (
    <SheetShell title="지난 기록" onClose={onClose}>
      <div className="px-4 py-4 space-y-5">
        {loading ? (
          <div style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '24px 0' }}>불러오는 중…</div>
        ) : groups.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '32px 0' }}>
            아직 운동 기록이 없어요.
          </div>
        ) : (
          groups.map(([date, dayLogs]) => {
            const dayVolume = dayLogs.reduce((sum, l) => sum + totalVolume(l.sets), 0);
            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{isoToShortLabel(date)}</span>
                  {dayVolume > 0 && (
                    <span style={{ fontSize: 11, color: t.textMuted }}>총 {dayVolume.toLocaleString()}kg</span>
                  )}
                </div>
                {dayLogs.map(log => (
                  <button
                    key={log.id}
                    onClick={() => setEditing(log)}
                    className="w-full flex items-center gap-3 text-left"
                    style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 9 }}
                  >
                    {log.exercise && <ExerciseThumb exercise={log.exercise} size={42} radius={9} />}
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }} className="truncate">
                        {log.exercise ? exerciseLabel(log.exercise) : '종목'}
                      </div>
                      <div style={{ fontSize: 11.5, color: t.textSub }} className="truncate">
                        {summarizeSets(log.exercise?.type ?? '근력', log.sets)}
                      </div>
                      {log.memo && (
                        <div style={{ fontSize: 11, color: t.textMuted }} className="truncate">{log.memo}</div>
                      )}
                    </div>
                    <ChevronRight size={18} color={t.textMuted} />
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>

      {editing && editing.exercise && (
        <RecordSheet
          exercise={editing.exercise}
          performedOn={editing.performedOn}
          editingLog={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { refresh(); onChanged(); }}
        />
      )}
    </SheetShell>
  );
}
