import { useWorkout, useIsDesktop } from './useWorkout';
import { WorkoutTabMobile } from './WorkoutTabMobile';
import { WorkoutTabDesktop } from './WorkoutTabDesktop';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { RecordSheet } from './RecordSheet';
import { RoutineSheet } from './RoutineSheet';
import { RoutineWeekModal } from './RoutineWeekModal';
import { HistorySheet } from './HistorySheet';

// 운동 탭 셸 — 로직(useWorkout)은 한 벌, 레이아웃만 뷰포트로 분기.
//  · 본문: Tailwind lg: 로 모바일/PC 트리 분기 (PC 레이아웃은 별도, 모바일 Stage 1 그대로)
//  · 시트/모달: 공유 폼 본체를 1회만 렌더 — 표현만 다르게(모바일=바텀시트 / PC=중앙 모달),
//    주간 루틴만 모바일=단일 요일 / PC=7일 그리드로 에디터를 분기.
export function WorkoutTab() {
  const w = useWorkout();
  const isDesktop = useIsDesktop();

  return (
    <>
      {/* 레이아웃 분기 — 한쪽을 고쳐도 다른 쪽 무영향 */}
      <div className="lg:hidden">
        <WorkoutTabMobile w={w} />
      </div>
      <div className="hidden lg:block">
        <WorkoutTabDesktop w={w} />
      </div>

      {/* 공유 시트(폼 본체 공유, 표현은 SheetShell 이 모바일/PC 자동 분기) */}
      {w.picker && (
        <ExercisePickerSheet
          wide={isDesktop}
          loggedExerciseIds={w.loggedExerciseIds}
          onClose={() => w.setPicker(false)}
          onPick={w.openRecordNew}
        />
      )}
      {w.record && (
        <RecordSheet
          exercise={w.record.exercise}
          performedOn={w.record.performedOn}
          editingLog={w.record.editingLog}
          onClose={() => w.setRecord(null)}
          onSaved={w.refresh}
        />
      )}
      {w.historyOpen && (
        <HistorySheet onClose={() => w.setHistoryOpen(false)} onChanged={w.refresh} />
      )}

      {/* 주간 루틴 — PC 는 7일 그리드 모달, 모바일은 단일 요일 시트 */}
      {w.routineOpen && (
        isDesktop ? (
          <RoutineWeekModal
            loggedExerciseIds={w.loggedExerciseIds}
            onClose={() => w.setRoutineOpen(false)}
            onChanged={w.refresh}
          />
        ) : (
          <RoutineSheet
            loggedExerciseIds={w.loggedExerciseIds}
            onClose={() => w.setRoutineOpen(false)}
            onChanged={w.refresh}
          />
        )
      )}
    </>
  );
}
