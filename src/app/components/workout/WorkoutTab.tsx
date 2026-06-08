import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Plus, ChevronRight, History as HistoryIcon, Pencil, TrendingUp } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db, exerciseLabel } from '../../../lib/db';
import type { Exercise, WorkoutLog, RoutineDay } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { ExerciseThumb } from './ExerciseThumb';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { RecordSheet } from './RecordSheet';
import { RoutineSheet } from './RoutineSheet';
import { HistorySheet } from './HistorySheet';
import {
  todayISO, todayDow, isoNDaysAgo, agoLabel, summarizeSets,
  calcStreak, lastTrainedByBodyPart, MAIN_BODY_PARTS, BODY_PART_EMOJI,
} from './workoutUtils';

const SERIF = "'DM Serif Display', serif";

export function WorkoutTab() {
  const { t } = useTheme();
  const today = todayISO();

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>([]);
  const [growthExId, setGrowthExId] = useState<string | null>(null);
  const [growth, setGrowth] = useState<{ date: string; weight: number }[]>([]);

  // 시트 상태
  const [picker, setPicker] = useState(false);
  const [record, setRecord] = useState<{ exercise: Exercise; performedOn: string; editingLog?: WorkoutLog } | null>(null);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [allLogs, days] = await Promise.all([db.workouts.listAll(), db.workouts.listRoutineDays()]);
    setLogs(allLogs);
    setRoutineDays(days);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Realtime — PC↔모바일 즉시 반영
  useRealtimeSync('workout_logs', refresh);
  useRealtimeSync('workout_sets', refresh);
  useRealtimeSync('routine_days', refresh);
  useRealtimeSync('routine_exercises', refresh);

  // ── 파생값 ──
  const loggedExerciseIds = useMemo(() => new Set(logs.map(l => l.exerciseId)), [logs]);
  const performedDates = useMemo(() => Array.from(new Set(logs.map(l => l.performedOn))), [logs]);
  const streak = useMemo(() => calcStreak(performedDates), [performedDates]);
  const lastWorkout = performedDates.length ? performedDates.reduce((a, b) => (a > b ? a : b)) : null;
  const todayLogs = useMemo(() => logs.filter(l => l.performedOn === today), [logs, today]);
  const lastByPart = useMemo(() => lastTrainedByBodyPart(logs), [logs]);

  const todayRoutine = routineDays.find(d => d.dayOfWeek === todayDow() && d.exercises.length > 0) ?? null;

  // 제안: 오늘 루틴 우선, 없으면 가장 오래 쉰 부위 추천
  const restedPart = useMemo(() => {
    let best: { part: string; date: string | null } | null = null;
    for (const part of MAIN_BODY_PARTS) {
      const date = lastByPart[part] ?? null;
      if (!best) { best = { part, date }; continue; }
      // 한 번도 안 한 부위(null)가 최우선, 그 다음 가장 오래된 날짜
      if (date === null && best.date !== null) { best = { part, date }; }
      else if (date !== null && best.date !== null && date < best.date) { best = { part, date }; }
    }
    return best;
  }, [lastByPart]);

  const suggestion = todayRoutine
    ? `오늘 루틴은 ${todayRoutine.label || '운동'}`
    : restedPart
      ? `${restedPart.part} 운동할 때가 됐어요`
      : '오늘 첫 운동을 기록해보세요';

  // 성장 그래프 대상: 근력 종목 중 기록 있는 것들
  const strengthExercises = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const l of logs) {
      if (l.exercise && l.exercise.type === '근력' && !map.has(l.exerciseId)) map.set(l.exerciseId, l.exercise);
    }
    return Array.from(map.values());
  }, [logs]);

  useEffect(() => {
    if (!growthExId && strengthExercises.length) setGrowthExId(strengthExercises[0].id);
  }, [strengthExercises, growthExId]);

  useEffect(() => {
    if (!growthExId) { setGrowth([]); return; }
    db.workouts.growthSeries(growthExId, isoNDaysAgo(30)).then(setGrowth);
  }, [growthExId, logs]);

  const openRecordNew = (exercise: Exercise) => { setPicker(false); setRecord({ exercise, performedOn: today }); };

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 440, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="space-y-3 pb-4">

        {/* 1) 스트릭/요약 히어로 */}
        <div style={{ background: `linear-gradient(135deg, ${t.accent} 0%, ${t.accentSoft} 100%)`, borderRadius: 18, padding: 16, color: '#fff' }}>
          <div className="flex items-center gap-2">
            <Flame size={20} color="#fff" />
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: SERIF, lineHeight: 1 }}>{streak}</span>
            <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.95 }}>일 연속</span>
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 6 }}>
            마지막 운동 · {lastWorkout ? agoLabel(lastWorkout) : '기록 없음'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 12px' }}>
            💡 {suggestion}
          </div>
        </div>

        {/* 2) 오늘의 루틴 카드 */}
        <Card>
          <CardHeader title="오늘의 루틴" action={
            <button onClick={() => setRoutineOpen(true)} className="flex items-center gap-0.5" style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
              <Pencil size={13} color={t.textSub} /> 루틴 편집
            </button>
          } />
          {todayRoutine ? (
            <div className="space-y-2 mt-2">
              {todayRoutine.exercises.map(re => re.exercise && (
                <div key={re.id} className="flex items-center gap-3">
                  <ExerciseThumb exercise={re.exercise} size={40} radius={9} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }} className="truncate">{exerciseLabel(re.exercise)}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{re.exercise.bodyPart} · {re.exercise.type}</div>
                  </div>
                  <button
                    onClick={() => setRecord({ exercise: re.exercise!, performedOn: today })}
                    className="flex items-center gap-0.5 flex-shrink-0"
                    style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, borderRadius: 999, padding: '6px 12px' }}
                  >
                    기록 <ChevronRight size={14} color={t.accent} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => setRoutineOpen(true)} className="w-full mt-2" style={{ fontSize: 13, color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 10, padding: '14px 0' }}>
              오늘 루틴이 없어요 · 루틴 만들기
            </button>
          )}
        </Card>

        {/* 3) 부위별 마지막 운동 */}
        <Card>
          <CardHeader title="부위별 마지막 운동" />
          <div className="flex flex-wrap gap-2 mt-2">
            {MAIN_BODY_PARTS.map(part => {
              const date = lastByPart[part];
              const isRested = restedPart?.part === part;
              return (
                <div
                  key={part}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    backgroundColor: isRested ? t.dangerLight : t.bgSub,
                    border: `1px solid ${isRested ? t.danger : t.borderLight}`,
                    borderRadius: 999, padding: '5px 11px',
                  }}
                >
                  <span style={{ fontSize: 13 }} aria-hidden>{BODY_PART_EMOJI[part]}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isRested ? t.danger : t.text }}>{part}</span>
                  <span style={{ fontSize: 11, color: isRested ? t.danger : t.textMuted }}>
                    {date ? agoLabel(date) : '기록 없음'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 4) 종목별 성장 */}
        <Card>
          <CardHeader title="종목별 성장" action={
            <span className="flex items-center gap-1" style={{ fontSize: 11, color: t.textMuted }}>
              <TrendingUp size={13} color={t.textMuted} /> 최근 한 달
            </span>
          } />
          {strengthExercises.length === 0 ? (
            <div style={{ fontSize: 13, color: t.textMuted, padding: '14px 0' }}>근력 기록이 쌓이면 무게 추이가 보여요.</div>
          ) : (
            <>
              <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1" style={{ scrollbarWidth: 'none' }}>
                {strengthExercises.map(ex => {
                  const active = growthExId === ex.id;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => setGrowthExId(ex.id)}
                      style={{
                        flexShrink: 0, fontSize: 12, fontWeight: 700,
                        color: active ? '#fff' : t.textSub,
                        backgroundColor: active ? t.accent : t.bgSub,
                        border: `1px solid ${active ? t.accent : t.borderLight}`,
                        padding: '5px 11px', borderRadius: 999,
                      }}
                    >
                      {exerciseLabel(ex)}
                    </button>
                  );
                })}
              </div>
              <GrowthChart data={growth} />
            </>
          )}
        </Card>

        {/* 5) 오늘의 운동 */}
        <Card>
          <CardHeader title="오늘의 운동" action={
            <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-0.5" style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
              <HistoryIcon size={13} color={t.textSub} /> 지난 기록
            </button>
          } />
          {todayLogs.length > 0 ? (
            <div className="space-y-2 mt-2">
              {todayLogs.map(log => log.exercise && (
                <button
                  key={log.id}
                  onClick={() => setRecord({ exercise: log.exercise!, performedOn: log.performedOn, editingLog: log })}
                  className="w-full flex items-center gap-3 text-left"
                  style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 9 }}
                >
                  <ExerciseThumb exercise={log.exercise} size={42} radius={9} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }} className="truncate">{exerciseLabel(log.exercise)}</div>
                    <div style={{ fontSize: 11.5, color: t.textSub }} className="truncate">{summarizeSets(log.exercise.type, log.sets)}</div>
                  </div>
                  <ChevronRight size={18} color={t.textMuted} />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: t.textMuted, padding: '10px 0 4px' }}>오늘 기록한 운동이 없어요.</div>
          )}
          <button
            onClick={() => setPicker(true)}
            className="w-full flex items-center justify-center gap-1.5 mt-2"
            style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', backgroundColor: t.accent, borderRadius: 12, padding: '11px 0' }}
          >
            <Plus size={16} color="#fff" /> 운동 추가
          </button>
        </Card>
      </div>

      {/* 시트 */}
      {picker && (
        <ExercisePickerSheet
          loggedExerciseIds={loggedExerciseIds}
          onClose={() => setPicker(false)}
          onPick={openRecordNew}
        />
      )}
      {record && (
        <RecordSheet
          exercise={record.exercise}
          performedOn={record.performedOn}
          editingLog={record.editingLog}
          onClose={() => setRecord(null)}
          onSaved={refresh}
        />
      )}
      {routineOpen && (
        <RoutineSheet
          loggedExerciseIds={loggedExerciseIds}
          onClose={() => setRoutineOpen(false)}
          onChanged={refresh}
        />
      )}
      {historyOpen && (
        <HistorySheet onClose={() => setHistoryOpen(false)} onChanged={refresh} />
      )}
    </div>
  );
}

// ── 작은 빌딩 블록 ──
function Card({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, padding: 14 }}>
      {children}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</span>
      {action}
    </div>
  );
}

// 무게 추이 라인 그래프 (의존성 없는 인라인 SVG)
function GrowthChart({ data }: { data: { date: string; weight: number }[] }) {
  const { t } = useTheme();
  if (data.length < 2) {
    return (
      <div style={{ fontSize: 12.5, color: t.textMuted, padding: '18px 0', textAlign: 'center' }}>
        데이터가 더 쌓이면 그래프가 나타나요.
      </div>
    );
  }
  const W = 300, H = 110, padX = 8, padY = 14;
  const weights = data.map(d => d.weight);
  const min = Math.min(...weights), max = Math.max(...weights);
  const range = max - min || 1;
  const stepX = (W - padX * 2) / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (d.weight - min) / range) * (H - padY * 2);
    return { x, y, w: d.weight };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="mt-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={t.success} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={`${line} L${pts[pts.length - 1].x},${H - padY} L${pts[0].x},${H - padY} Z`} fill={t.success} opacity={0.1} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={t.success} />
        ))}
      </svg>
      <div className="flex justify-between" style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
        <span>{min}kg</span>
        <span style={{ fontWeight: 700, color: t.success }}>최고 {max}kg</span>
      </div>
    </div>
  );
}
