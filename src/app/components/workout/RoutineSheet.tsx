import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db, exerciseLabel } from '../../../lib/db';
import type { RoutineDay } from '../../../lib/db';
import { SheetShell } from './SheetShell';
import { ExerciseThumb } from './ExerciseThumb';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { WEEKDAYS, todayDow } from './workoutUtils';

interface Props {
  loggedExerciseIds: Set<string>;
  onClose: () => void;
  onChanged: () => void;   // 부모(오늘의 루틴) 갱신
}

export function RoutineSheet({ loggedExerciseIds, onClose, onChanged }: Props) {
  const { t } = useTheme();
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [selectedDow, setSelectedDow] = useState<number>(todayDow());
  const [labelDraft, setLabelDraft] = useState('');
  const [picker, setPicker] = useState(false);

  const refresh = useCallback(async () => {
    const list = await db.workouts.listRoutineDays();
    setDays(list);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const current = days.find(d => d.dayOfWeek === selectedDow) ?? null;

  // 선택 요일 바뀌면 라벨 입력칸 동기화
  useEffect(() => { setLabelDraft(current?.label ?? ''); }, [selectedDow, current?.label]);

  const saveLabel = async () => {
    const next = labelDraft.trim() || null;
    if (next === (current?.label ?? null)) return;
    await db.workouts.setRoutineLabel(selectedDow, next);
    await refresh();
    onChanged();
  };

  const addExercise = async (exerciseId: string) => {
    await db.workouts.addRoutineExercise(selectedDow, exerciseId);
    setPicker(false);
    await refresh();
    onChanged();
  };

  const removeExercise = async (id: string) => {
    await db.workouts.removeRoutineExercise(id);
    await refresh();
    onChanged();
  };

  return (
    <SheetShell title="주간 루틴" onClose={onClose}>
      <div className="px-4 py-4 space-y-4">
        {/* 요일 선택 */}
        <div className="flex gap-1.5 justify-between">
          {WEEKDAYS.map(w => {
            const active = selectedDow === w.dow;
            const has = days.find(d => d.dayOfWeek === w.dow && d.exercises.length > 0);
            return (
              <button
                key={w.dow}
                onClick={() => setSelectedDow(w.dow)}
                className="relative flex-1 flex flex-col items-center"
                style={{
                  fontSize: 14, fontWeight: 700,
                  color: active ? '#fff' : t.textSub,
                  backgroundColor: active ? t.accent : t.bgSub,
                  border: `1px solid ${active ? t.accent : t.borderLight}`,
                  borderRadius: 12, padding: '9px 0',
                }}
              >
                {w.label}
                {has && (
                  <span style={{
                    position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 999,
                    backgroundColor: active ? '#fff' : t.accent,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* 라벨 편집 */}
        <div className="space-y-1.5">
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>루틴 이름</label>
          <input
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder="예: 하체 + 코어"
            style={{
              width: '100%', fontSize: 14, color: t.text, backgroundColor: t.bgSub,
              border: `1px solid ${t.borderLight}`, borderRadius: 10, padding: '10px 12px', outline: 'none',
            }}
          />
        </div>

        {/* 종목 목록 */}
        <div className="space-y-2">
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>종목</span>
          {!current || current.exercises.length === 0 ? (
            <div style={{ fontSize: 13, color: t.textMuted, padding: '14px 0' }}>아직 등록된 종목이 없어요.</div>
          ) : (
            current.exercises.map(re => (
              <div
                key={re.id}
                className="flex items-center gap-3"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 8 }}
              >
                {re.exercise && <ExerciseThumb exercise={re.exercise} size={40} radius={9} />}
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }} className="truncate">
                    {re.exercise ? exerciseLabel(re.exercise) : '종목'}
                  </div>
                  {re.exercise && (
                    <div style={{ fontSize: 11, color: t.textMuted }}>{re.exercise.bodyPart} · {re.exercise.type}</div>
                  )}
                </div>
                <button onClick={() => removeExercise(re.id)} className="p-1.5 rounded-lg" aria-label="삭제">
                  <X size={16} color={t.textMuted} />
                </button>
              </div>
            ))
          )}

          <button
            onClick={() => setPicker(true)}
            className="w-full flex items-center justify-center gap-1.5"
            style={{ fontSize: 13, fontWeight: 600, color: t.accent, border: `1px dashed ${t.border}`, borderRadius: 12, padding: '11px 0' }}
          >
            <Plus size={16} color={t.accent} /> 종목 추가
          </button>
        </div>
      </div>

      {picker && (
        <ExercisePickerSheet
          title="루틴에 추가"
          loggedExerciseIds={loggedExerciseIds}
          onClose={() => setPicker(false)}
          onPick={ex => addExercise(ex.id)}
        />
      )}
    </SheetShell>
  );
}
