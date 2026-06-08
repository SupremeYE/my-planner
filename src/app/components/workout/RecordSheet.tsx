import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Youtube, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db, exerciseLabel } from '../../../lib/db';
import type { Exercise, WorkoutLog, WorkoutSet } from '../../../lib/db';
import { SheetShell } from './SheetShell';
import { ExerciseThumb } from './ExerciseThumb';
import ConfirmModal from '../ConfirmModal';

type EditSet = { weight: string; reps: string; durationMin: string; distanceKm: string; prefill: boolean };

interface Props {
  exercise: Exercise;
  performedOn: string;          // 기록 날짜 (편집은 원래 날짜 유지)
  editingLog?: WorkoutLog | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptySet = (): EditSet => ({ weight: '', reps: '', durationMin: '', distanceKm: '', prefill: false });

export function RecordSheet({ exercise, performedOn, editingLog, onClose, onSaved }: Props) {
  const { t } = useTheme();
  const isCardio = exercise.type === '유산소';
  const isEdit = !!editingLog;

  const [sets, setSets] = useState<EditSet[]>([emptySet()]);
  const [memo, setMemo] = useState(editingLog?.memo ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 초기 세트: 편집=기존 값 / 신규=직전 세션 prefill(회색)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (editingLog) {
        setSets(editingLog.sets.length
          ? editingLog.sets.map(s => ({
              weight: s.weight?.toString() ?? '', reps: s.reps?.toString() ?? '',
              durationMin: s.durationMin?.toString() ?? '', distanceKm: s.distanceKm?.toString() ?? '',
              prefill: false,
            }))
          : [emptySet()]);
        return;
      }
      const last = await db.workouts.lastSessionFor(exercise.id, performedOn);
      if (!alive) return;
      if (last && last.sets.length) {
        setSets(last.sets.map(s => ({
          weight: s.weight?.toString() ?? '', reps: s.reps?.toString() ?? '',
          durationMin: s.durationMin?.toString() ?? '', distanceKm: s.distanceKm?.toString() ?? '',
          prefill: true,   // 직전 기록은 회색으로 표시 → 포커스/수정 시 일반색
        })));
      } else {
        setSets([emptySet()]);
      }
    })();
    return () => { alive = false; };
  }, [exercise.id, performedOn, editingLog]);

  const update = (i: number, patch: Partial<EditSet>) =>
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch, prefill: false } : s));

  const addSet = () => setSets(prev => [...prev, emptySet()]);
  const removeSet = (i: number) => setSets(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const num = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const intNum = (v: string): number | null => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const buildSets = (): WorkoutSet[] => {
    const out: WorkoutSet[] = [];
    sets.forEach((s, i) => {
      if (isCardio) {
        const d = num(s.durationMin), dist = num(s.distanceKm);
        if (d != null || dist != null) out.push({ setNo: out.length + 1, weight: null, reps: null, durationMin: d, distanceKm: dist });
      } else {
        const w = num(s.weight), r = intNum(s.reps);
        if (w != null || r != null) out.push({ setNo: out.length + 1, weight: w, reps: r, durationMin: null, distanceKm: null });
      }
    });
    return out;
  };

  const canSave = useMemo(() => buildSets().length > 0, [sets, isCardio]); // 최소 1세트

  const handleSave = async () => {
    if (saving || !canSave) return;
    setSaving(true);
    try {
      const built = buildSets();
      const memoVal = memo.trim() || null;
      if (editingLog) {
        await db.workouts.updateLog(editingLog.id, { memo: memoVal, sets: built });
        // 편집은 XP 중복 적립 금지 — 적립 훅 호출하지 않음.
      } else {
        await db.workouts.createLog({ exerciseId: exercise.id, performedOn, memo: memoVal, sets: built });
        // TODO(XP): 신규 저장 시에만 '성장' 그룹 적립 훅 호출. (현재 앱에 명령형 XP 적립 훅 없음 — 도입 시 여기서 1회 호출)
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingLog) return;
    await db.workouts.deleteLog(editingLog.id);
    onSaved();
    onClose();
  };

  const inputStyle = (prefill: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'center', fontSize: 15, fontWeight: 600,
    color: prefill ? t.textMuted : t.text,
    backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 10,
    padding: '9px 6px', outline: 'none',
  });

  return (
    <SheetShell
      title={isEdit ? '기록 편집' : '운동 기록'}
      onClose={onClose}
      headerRight={
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            fontSize: 14, fontWeight: 700,
            color: canSave ? t.accent : t.textMuted,
            opacity: saving ? 0.6 : 1, padding: '4px 6px',
          }}
        >
          저장
        </button>
      }
      footer={
        isEdit ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-1.5"
            style={{ fontSize: 13, fontWeight: 600, color: t.danger, padding: '8px 0' }}
          >
            <Trash2 size={15} color={t.danger} /> 이 기록 삭제
          </button>
        ) : undefined
      }
    >
      <div className="px-4 py-4 space-y-5">
        {/* 종목 헤더 */}
        <div className="flex items-center gap-3">
          <ExerciseThumb exercise={exercise} size={56} />
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }} className="truncate">
              {exerciseLabel(exercise)}
            </div>
            {exercise.nameKo && (
              <div style={{ fontSize: 12, color: t.textMuted }} className="truncate">{exercise.nameEn}</div>
            )}
            <div className="flex gap-1.5 mt-1">
              <Tag text={exercise.bodyPart} bg={t.accentLight} fg={t.accent} />
              <Tag text={exercise.type} bg={t.bgSub} fg={t.textSub} />
            </div>
          </div>
        </div>

        {/* 자세 영상 */}
        {exercise.youtubeUrl && (
          <a
            href={exercise.youtubeUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5"
            style={{ fontSize: 13, fontWeight: 600, color: t.danger, padding: '7px 12px', borderRadius: 999, backgroundColor: t.dangerLight }}
          >
            <Youtube size={15} color={t.danger} /> 자세 영상 보기
          </a>
        )}

        {/* 세트 입력 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              {isCardio ? '유산소' : '세트'}
            </span>
            {!isEdit && sets.some(s => s.prefill) && (
              <span style={{ fontSize: 11, color: t.textMuted }}>직전 기록 · 탭하면 수정</span>
            )}
          </div>

          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, width: 18, textAlign: 'center' }}>
                {i + 1}
              </span>
              {isCardio ? (
                <>
                  <Field unit="분" value={s.durationMin} placeholder="시간" style={inputStyle(s.prefill)}
                    onChange={v => update(i, { durationMin: v })} />
                  <Field unit="km" value={s.distanceKm} placeholder="거리" style={inputStyle(s.prefill)}
                    onChange={v => update(i, { distanceKm: v })} />
                </>
              ) : (
                <>
                  <Field unit="kg" value={s.weight} placeholder="무게" style={inputStyle(s.prefill)}
                    onChange={v => update(i, { weight: v })} />
                  <span style={{ color: t.textMuted, fontSize: 14 }}>×</span>
                  <Field unit="회" value={s.reps} placeholder="횟수" style={inputStyle(s.prefill)}
                    onChange={v => update(i, { reps: v })} />
                </>
              )}
              <button onClick={() => removeSet(i)} className="p-1.5 rounded-lg flex-shrink-0" aria-label="세트 삭제">
                <X size={16} color={t.textMuted} />
              </button>
            </div>
          ))}

          <button
            onClick={addSet}
            className="w-full flex items-center justify-center gap-1.5"
            style={{ fontSize: 13, fontWeight: 600, color: t.accent, border: `1px dashed ${t.border}`, borderRadius: 10, padding: '9px 0' }}
          >
            <Plus size={15} color={t.accent} /> 세트 추가
          </button>
        </div>

        {/* 메모 */}
        <div className="space-y-1.5">
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>메모 <span style={{ color: t.textMuted, fontWeight: 400 }}>(선택)</span></span>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            rows={2}
            placeholder="컨디션, 느낀 점 등"
            style={{
              width: '100%', fontSize: 14, color: t.text, backgroundColor: t.bgSub,
              border: `1px solid ${t.borderLight}`, borderRadius: 10, padding: '9px 11px', outline: 'none', resize: 'none',
            }}
          />
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          message="이 기록을 삭제할까요?"
          description="세트 기록도 함께 삭제됩니다."
          confirmText="삭제" confirmDanger
          onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </SheetShell>
  );
}

function Tag({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: fg, backgroundColor: bg, padding: '2px 8px', borderRadius: 999 }}>
      {text}
    </span>
  );
}

function Field({ value, onChange, unit, placeholder, style }: {
  value: string; onChange: (v: string) => void; unit: string; placeholder: string; style: React.CSSProperties;
}) {
  const { t } = useTheme();
  return (
    <div className="relative flex-1">
      <input
        type="number" inputMode="decimal" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ ...style, paddingRight: 26 }}
      />
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: t.textMuted, pointerEvents: 'none' }}>
        {unit}
      </span>
    </div>
  );
}
