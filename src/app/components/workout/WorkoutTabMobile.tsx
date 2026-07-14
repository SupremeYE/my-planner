import { Flame, Plus, ChevronRight, History as HistoryIcon, Pencil, TrendingUp } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { isHaon, solidCardStyle, solidRowStyle } from '../../styles/haonStyles';
import { HaonButton } from '../ui/HaonButton';
import { exerciseLabel } from '../../../lib/db';
import { ExerciseThumb } from './ExerciseThumb';
import { GrowthChart } from './GrowthChart';
import type { UseWorkout } from './useWorkout';
import { agoLabel, summarizeSets, MAIN_BODY_PARTS, BODY_PART_EMOJI } from './workoutUtils';


// Stage 1 모바일 레이아웃 — 단일 컬럼. 동작/디자인 무변경(상태만 useWorkout 훅에서 주입).
export function WorkoutTabMobile({ w }: { w: UseWorkout }) {
  const { t } = useTheme();
  const today = w.today;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 440, fontFamily: t.fontBody }}>
      <div className="space-y-3 pb-4">

        {/* 1) 스트릭/요약 히어로 */}
        <div style={{ background: `linear-gradient(135deg, ${t.accent} 0%, ${t.accentSoft} 100%)`, borderRadius: 18, padding: 16, color: '#fff' }}>
          <div className="flex items-center gap-2">
            <Flame size={20} color="#fff" />
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: t.fontStat, lineHeight: 1 }}>{w.streak}</span>
            <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.95 }}>일 연속</span>
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 6 }}>
            마지막 운동 · {w.lastWorkout ? agoLabel(w.lastWorkout) : '기록 없음'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 12px' }}>
            💡 {w.suggestion}
          </div>
        </div>

        {/* 2) 오늘의 루틴 카드 */}
        <Card>
          <CardHeader title="오늘의 루틴" action={
            <button onClick={() => w.setRoutineOpen(true)} className="flex items-center gap-0.5" style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
              <Pencil size={13} color={t.textSub} /> 루틴 편집
            </button>
          } />
          {w.todayRoutine ? (
            <div className="space-y-2 mt-2">
              {w.todayRoutine.exercises.map(re => re.exercise && (
                <div key={re.id} className="flex items-center gap-3">
                  <ExerciseThumb exercise={re.exercise} size={40} radius={9} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }} className="truncate">{exerciseLabel(re.exercise)}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{re.exercise.bodyPart} · {re.exercise.type}</div>
                  </div>
                  <HaonButton
                    variant="ghost"
                    onClick={() => w.setRecord({ exercise: re.exercise!, performedOn: today })}
                    className="flex-shrink-0"
                    style={{ borderRadius: 999 }}
                  >
                    기록 <ChevronRight size={14} />
                  </HaonButton>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => w.setRoutineOpen(true)} className="w-full mt-2" style={{ fontSize: 13, color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 10, padding: '14px 0' }}>
              오늘 루틴이 없어요 · 루틴 만들기
            </button>
          )}
        </Card>

        {/* 3) 부위별 마지막 운동 */}
        <Card>
          <CardHeader title="부위별 마지막 운동" />
          <div className="flex flex-wrap gap-2 mt-2">
            {MAIN_BODY_PARTS.map(part => {
              const date = w.lastByPart[part];
              const isRested = w.restedPart?.part === part;
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
          {w.strengthExercises.length === 0 ? (
            <div style={{ fontSize: 13, color: t.textMuted, padding: '14px 0' }}>근력 기록이 쌓이면 무게 추이가 보여요.</div>
          ) : (
            <>
              <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1" style={{ scrollbarWidth: 'none' }}>
                {w.strengthExercises.map(ex => {
                  const active = w.growthExId === ex.id;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => w.setGrowthExId(ex.id)}
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
              <GrowthChart data={w.growth} />
            </>
          )}
        </Card>

        {/* 5) 오늘의 운동 */}
        <Card>
          <CardHeader title="오늘의 운동" action={
            <button onClick={() => w.setHistoryOpen(true)} className="flex items-center gap-0.5" style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
              <HistoryIcon size={13} color={t.textSub} /> 지난 기록
            </button>
          } />
          {w.todayLogs.length > 0 ? (
            <div className="space-y-2 mt-2">
              {w.todayLogs.map(log => log.exercise && (
                <button
                  key={log.id}
                  onClick={() => w.setRecord({ exercise: log.exercise!, performedOn: log.performedOn, editingLog: log })}
                  className="w-full flex items-center gap-3 text-left"
                  style={{ ...(isHaon(t) ? solidRowStyle(t) : { backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }), borderRadius: 12, padding: 9 }}
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
          <HaonButton
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => w.setPicker(true)}
            className="w-full mt-2"
          >
            운동 추가
          </HaonButton>
        </Card>
      </div>
    </div>
  );
}

// ── 작은 빌딩 블록 ──
function Card({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div style={{ ...(isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.borderLight}` }), borderRadius: 16, padding: 14 }}>
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
