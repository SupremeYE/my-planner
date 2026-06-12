import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db, exerciseLabel } from '../../../lib/db';
import type { RoutineDay } from '../../../lib/db';
import { ExerciseThumb } from './ExerciseThumb';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { WEEKDAYS, todayDow } from './workoutUtils';

interface Props {
  loggedExerciseIds: Set<string>;
  onClose: () => void;
  onChanged: () => void;
}

// ── PC 전용 주간 루틴 편집 모달 ─────────────────────────────────────────────────
// 월~일 7일을 7열 그리드로 한 화면에 펼쳐 편집(PC 강점). 오늘 요일 컬럼 강조.
// CRUD 는 모바일 RoutineSheet 와 동일한 db.workouts 메서드 공유.
export function RoutineWeekModal({ loggedExerciseIds, onClose, onChanged }: Props) {
  const { t } = useTheme();
  const [isIn, setIsIn] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setIsIn(true)); }, []);
  const close = useCallback(() => { setIsIn(false); setTimeout(onClose, 200); }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const [days, setDays] = useState<RoutineDay[]>([]);
  const refresh = useCallback(async () => { setDays(await db.workouts.listRoutineDays()); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // 종목 추가 대상 요일 (Picker 오픈)
  const [pickerDow, setPickerDow] = useState<number | null>(null);
  const today = todayDow();

  const addExercise = async (exerciseId: string) => {
    if (pickerDow == null) return;
    await db.workouts.addRoutineExercise(pickerDow, exerciseId);
    setPickerDow(null);
    await refresh();
    onChanged();
  };
  const removeExercise = async (id: string) => {
    await db.workouts.removeRoutineExercise(id);
    await refresh();
    onChanged();
  };
  const saveLabel = async (dow: number, label: string, prev: string | null) => {
    const next = label.trim() || null;
    if (next === prev) return;
    await db.workouts.setRoutineLabel(dow, next);
    await refresh();
    onChanged();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', opacity: isIn ? 1 : 0, transition: 'opacity 0.2s ease', padding: 20 }}
        onClick={close}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="flex flex-col overflow-hidden"
          style={{
            width: 'min(1160px, 95vw)', maxHeight: '90vh',
            backgroundColor: t.card, borderRadius: 20,
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            transform: isIn ? 'translateY(0)' : 'translateY(16px)',
            transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: t.border }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>주간 루틴</div>
              <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 2 }}>요일별 루틴 이름과 종목을 한눈에 편집하세요.</div>
            </div>
            <button onClick={close} className="p-1.5 rounded-lg" aria-label="닫기"><X size={22} color={t.text} /></button>
          </div>

          {/* 7열 그리드 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {WEEKDAYS.map(wd => {
                const day = days.find(d => d.dayOfWeek === wd.dow) ?? null;
                const isToday = wd.dow === today;
                return (
                  <DayColumn
                    key={wd.dow}
                    label={wd.label}
                    isToday={isToday}
                    day={day}
                    onLabelSave={(text) => saveLabel(wd.dow, text, day?.label ?? null)}
                    onAdd={() => setPickerDow(wd.dow)}
                    onRemove={removeExercise}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 종목 선택 (별도 오버레이 — 루틴 모달 스크림과 분리) */}
      {pickerDow != null && (
        <ExercisePickerSheet
          title="루틴에 추가"
          wide
          loggedExerciseIds={loggedExerciseIds}
          onClose={() => setPickerDow(null)}
          onPick={ex => addExercise(ex.id)}
        />
      )}
    </>
  );
}

// ── 요일 컬럼 ──
function DayColumn({
  label, isToday, day, onLabelSave, onAdd, onRemove,
}: {
  label: string;
  isToday: boolean;
  day: RoutineDay | null;
  onLabelSave: (text: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTheme();
  const [draft, setDraft] = useState(day?.label ?? '');
  // 다른 기기/탭에서 라벨 갱신 시 동기화(편집 중이 아닐 때)
  useEffect(() => { setDraft(day?.label ?? ''); }, [day?.label]);

  const exercises = day?.exercises ?? [];

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: isToday ? t.accentLight : t.bgSub,
        border: `1.5px solid ${isToday ? t.accent : t.borderLight}`,
        borderRadius: 14, padding: 10, minHeight: 240,
      }}
    >
      {/* 요일 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 14, fontWeight: 800, color: isToday ? t.accent : t.text }}>
          {label}{isToday && <span style={{ fontSize: 10.5, fontWeight: 700, marginLeft: 4 }}>오늘</span>}
        </span>
      </div>

      {/* 루틴 이름 */}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => onLabelSave(draft)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="루틴 이름"
        style={{
          width: '100%', fontSize: 12.5, fontWeight: 600, color: t.text,
          backgroundColor: t.card, border: `1px solid ${t.borderLight}`,
          borderRadius: 9, padding: '7px 9px', outline: 'none', marginBottom: 8,
        }}
      />

      {/* 종목 목록 */}
      <div className="flex-1 space-y-1.5">
        {exercises.length === 0 ? (
          <div style={{ fontSize: 11.5, color: t.textMuted, textAlign: 'center', padding: '12px 0' }}>휴식 / 없음</div>
        ) : (
          exercises.map(re => (
            <div
              key={re.id}
              className="flex items-center gap-2"
              style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 9, padding: 6 }}
            >
              {re.exercise && <ExerciseThumb exercise={re.exercise} size={28} radius={7} />}
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 11.5, fontWeight: 600, color: t.text, lineHeight: 1.2 }} className="line-clamp-2">
                  {re.exercise ? exerciseLabel(re.exercise) : '종목'}
                </div>
              </div>
              <button onClick={() => onRemove(re.id)} className="p-0.5 rounded flex-shrink-0" aria-label="삭제">
                <X size={13} color={t.textMuted} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 종목 추가 */}
      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-1 mt-2"
        style={{ fontSize: 12, fontWeight: 600, color: t.accent, border: `1px dashed ${t.border}`, borderRadius: 9, padding: '8px 0' }}
      >
        <Plus size={14} color={t.accent} /> 종목
      </button>
    </div>
  );
}
