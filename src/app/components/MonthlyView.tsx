import { GoalsMonthlyBoard } from './period/GoalsMonthlyBoard';

// 목표 페이지 "기간별" 탭 — 월간 중심 재구성(DESIGN.md §5 "목표 페이지 — 기간별(월간 중심)").
// 구 연간→월간→주간 캐스케이드 3컬럼(PeriodCascadePC/Mobile)은 폐기하고 월간 중심 보드로 교체.
export function MonthlyView() {
  return <GoalsMonthlyBoard />;
}
