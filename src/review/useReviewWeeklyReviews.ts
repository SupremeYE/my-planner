import { usePlanner } from '../app/store';
import type { WeeklyReviewController } from '../app/hooks/useWeeklyReviews';

/** Injected only by the guarded Preview build transform; no second local save state. */
export function useReviewWeeklyReviews(): WeeklyReviewController {
  const planner = usePlanner() as ReturnType<typeof usePlanner> & { reviewWeekly?: WeeklyReviewController };
  if (!planner.reviewWeekly) throw new Error('Preview weekly review controller is missing');
  return planner.reviewWeekly;
}
