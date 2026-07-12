import { Flame, Plus, ChevronRight, History as HistoryIcon, Pencil, TrendingUp, Calendar } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { exerciseLabel } from '../../../lib/db';
import type { WorkoutLog } from '../../../lib/db';
import { ExerciseThumb } from './ExerciseThumb';
import { GrowthChart } from './GrowthChart';
import type { UseWorkout } from './useWorkout';
import { agoLabel, summarizeSets, isoToShortLabel, MAIN_BODY_PARTS, BODY_PART_EMOJI } from './workoutUtils';

const SERIF = "'DM Serif Display', serif";

// ── PC 전용 대시보드 레이아웃 ───────────────────────────────────────────────────
// 가로 공간을 채우는 별도 레이아웃: 상단 히어로 배너(전체폭 1줄) + 2단 대시보드.
// 데이터/CRUD 는 useWorkout 훅을 그대로 공유한다(레이아웃만 분리).
export function WorkoutTabDesktop({ w }: { w: UseWorkout }) {
  const { t } = useTheme();
  return (
    <div className="w-full" style={{ fontFamily: t.fontBody }}>
      <HeroBanner w={w} />

      {/* 2단 대시보드: 좌(넓게 ~1.5fr) / 우(~1fr) */}
      <div className="grid gap-4 mt-4 items-start" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <div className="space-y-4 min-w-0">
          <TodayRoutineCard w={w} />
          <TodayWorkoutCard w={w} />
        </div>
        <div className="space-y-4 min-w-0">
          <GrowthCard w={w} />
          <RecentHistoryCard w={w} />
        </div>
      </div>
    </div>
  );
}

// ── 1) 상단 히어로 배너 (전체폭 1줄) ──────────────────────────────────────────────
function HeroBanner({ w }: { w: UseWorkout }) {
  const { t } = useTheme();
  return (
    <div
      style={{
        background: `linear-gradient(120deg, ${t.accent} 0%, ${t.accentSoft} 100%)`,
        borderRadius: 22, padding: '20px 26px', color: '#fff',
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
      }}
    >
      <div className="flex items-center gap-6">
        {/* 스트릭 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Flame size={26} color="#fff" />
          <span style={{ fontSize: 38, fontWeight: 800, fontFamily: SERIF, lineHeight: 1 }}>{w.streak}</span>
          <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.95, marginLeft: 2 }}>일 연속</span>
        </div>

        <HeroDivider />

        {/* 마지막 운동일 */}
        <div className="flex-shrink-0">
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>마지막 운동</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            {w.lastWorkout ? agoLabel(w.lastWorkout) : '기록 없음'}
          </div>
        </div>

        <HeroDivider />

        {/* 오늘 뭐하지 제안 */}
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>오늘 뭐하지?</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }} className="truncate">💡 {w.suggestion}</div>
        </div>

        {/* 부위별 휴식 칩 */}
        <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0" style={{ maxWidth: 360 }}>
          {MAIN_BODY_PARTS.map(part => {
            const date = w.lastByPart[part];
            const isRested = w.restedPart?.part === part;
            return (
              <div
                key={part}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  backgroundColor: '#fff',
                  border: `1px solid ${isRested ? t.danger : 'rgba(255,255,255,0.6)'}`,
                  borderRadius: 999, padding: '5px 11px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <span style={{ fontSize: 13 }} aria-hidden>{BODY_PART_EMOJI[part]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: isRested ? t.danger : t.text }}>{part}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: isRested ? t.danger : t.textMuted }}>
                  {date ? agoLabel(date) : '휴식'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeroDivider() {
  return <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.28)', minHeight: 40 }} />;
}

// ── 2-좌-상) 오늘의 루틴 ──────────────────────────────────────────────────────────
function TodayRoutineCard({ w }: { w: UseWorkout }) {
  const { t } = useTheme();
  return (
    <DCard>
      <DCardHeader
        title="오늘의 루틴"
        action={
          <button onClick={() => w.setRoutineOpen(true)} className="flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}>
            <Pencil size={14} color={t.textSub} /> 주간 루틴 편집
          </button>
        }
      />
      {w.todayRoutine ? (
        <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {w.todayRoutine.exercises.map(re => re.exercise && (
            <div
              key={re.id}
              className="flex items-center gap-3"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 9 }}
            >
              <ExerciseThumb exercise={re.exercise} size={42} radius={9} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }} className="truncate">{exerciseLabel(re.exercise)}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{re.exercise.bodyPart} · {re.exercise.type}</div>
              </div>
              <button
                onClick={() => w.setRecord({ exercise: re.exercise!, performedOn: w.today })}
                className="flex items-center gap-0.5 flex-shrink-0"
                style={{ fontSize: 12.5, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, borderRadius: 999, padding: '6px 12px' }}
              >
                기록 <ChevronRight size={14} color={t.accent} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <button onClick={() => w.setRoutineOpen(true)} className="w-full mt-3" style={{ fontSize: 13.5, color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 12, padding: '20px 0' }}>
          오늘 루틴이 없어요 · 주간 루틴 만들기
        </button>
      )}
    </DCard>
  );
}

// ── 2-좌-하) 오늘의 운동 ──────────────────────────────────────────────────────────
function TodayWorkoutCard({ w }: { w: UseWorkout }) {
  const { t } = useTheme();
  return (
    <DCard>
      <DCardHeader
        title="오늘의 운동"
        action={
          <button
            onClick={() => w.setPicker(true)}
            className="flex items-center gap-1.5"
            style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: t.accent, borderRadius: 999, padding: '7px 14px' }}
          >
            <Plus size={15} color="#fff" /> 운동 추가
          </button>
        }
      />
      {w.todayLogs.length > 0 ? (
        <div className="space-y-2 mt-3">
          {w.todayLogs.map(log => log.exercise && (
            <button
              key={log.id}
              onClick={() => w.setRecord({ exercise: log.exercise!, performedOn: log.performedOn, editingLog: log })}
              className="group w-full flex items-center gap-3 text-left"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 10 }}
            >
              <ExerciseThumb exercise={log.exercise} size={46} radius={10} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text }} className="truncate">{exerciseLabel(log.exercise)}</div>
                <div style={{ fontSize: 12, color: t.textSub }} className="truncate">{summarizeSets(log.exercise.type, log.sets)}</div>
              </div>
              {/* hover 시 "편집" 라벨 (모바일엔 없음) */}
              <span
                className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0"
                style={{ fontSize: 12, fontWeight: 700, color: t.accent, transition: 'opacity 0.15s ease' }}
              >
                <Pencil size={13} color={t.accent} /> 편집
              </span>
              <ChevronRight size={18} color={t.textMuted} />
            </button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, color: t.textMuted, padding: '24px 0', textAlign: 'center', border: `1px dashed ${t.borderLight}`, borderRadius: 12, marginTop: 12 }}>
          오늘 기록한 운동이 없어요. 위 "운동 추가"로 시작해보세요.
        </div>
      )}
    </DCard>
  );
}

// ── 2-우-상) 종목별 성장 ──────────────────────────────────────────────────────────
function GrowthCard({ w }: { w: UseWorkout }) {
  const { t } = useTheme();
  return (
    <DCard>
      <DCardHeader
        title="종목별 성장"
        action={
          <span className="flex items-center gap-1" style={{ fontSize: 11.5, color: t.textMuted }}>
            <TrendingUp size={13} color={t.textMuted} /> 최근 한 달
          </span>
        }
      />
      {w.strengthExercises.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted, padding: '18px 0' }}>근력 기록이 쌓이면 무게 추이가 보여요.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {w.strengthExercises.map(ex => {
              const active = w.growthExId === ex.id;
              return (
                <button
                  key={ex.id}
                  onClick={() => w.setGrowthExId(ex.id)}
                  style={{
                    fontSize: 12, fontWeight: 700,
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
    </DCard>
  );
}

// ── 2-우-하) 지난 기록 (최근 세션 인라인 + 전체 보기 모달) ─────────────────────────
function RecentHistoryCard({ w }: { w: UseWorkout }) {
  const { t } = useTheme();
  const recent: WorkoutLog[] = w.logs.slice(0, 6); // listAll 은 performed_on 내림차순
  return (
    <DCard>
      <DCardHeader
        title="지난 기록"
        action={
          w.logs.length > 0 ? (
            <button onClick={() => w.setHistoryOpen(true)} className="flex items-center gap-0.5" style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}>
              <HistoryIcon size={13} color={t.textSub} /> 전체 보기
            </button>
          ) : undefined
        }
      />
      {recent.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted, padding: '18px 0' }}>아직 운동 기록이 없어요.</div>
      ) : (
        <div className="space-y-2 mt-3">
          {recent.map(log => log.exercise && (
            <button
              key={log.id}
              onClick={() => w.setRecord({ exercise: log.exercise!, performedOn: log.performedOn, editingLog: log })}
              className="w-full flex items-center gap-3 text-left"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, borderRadius: 12, padding: 9 }}
            >
              <ExerciseThumb exercise={log.exercise} size={40} radius={9} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }} className="truncate">{exerciseLabel(log.exercise)}</div>
                <div style={{ fontSize: 11.5, color: t.textSub }} className="truncate">{summarizeSets(log.exercise.type, log.sets)}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 11, color: t.textMuted }}>
                <Calendar size={12} color={t.textMuted} /> {isoToShortLabel(log.performedOn)}
              </div>
            </button>
          ))}
        </div>
      )}
    </DCard>
  );
}

// ── PC 카드 빌딩 블록 ──
function DCard({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 18, padding: 18 }}>
      {children}
    </div>
  );
}

function DCardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{title}</span>
      {action}
    </div>
  );
}
