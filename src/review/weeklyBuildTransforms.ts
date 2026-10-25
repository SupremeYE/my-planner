/** Preview-only wiring: one confirmed controller supplies both PlannerProvider and the editor. */
export function transformReviewWeekly(code: string, id: string): string | undefined {
  if (!id.endsWith('/src/app/store.tsx')) return;
  const replace = (before: string, after: string) => {
    if (code.split(before).length !== 2) throw new Error(`Weekly review store boundary changed: ${before}`);
    code = code.replace(before, after);
  };
  replace('export function PlannerProvider({ children, development = false }: { children: React.ReactNode; development?: boolean }) {',
    'export function PlannerProvider({ children, development = false }: { children: React.ReactNode; development?: boolean }) {\n  const reviewWeekly = useWeeklyReviews();');
  // The old optimistic reader is not used alongside the confirmed controller in Preview.
  replace('db.weeklyReviews.fetchAll(),', 'Promise.resolve([]),');
  replace('      weekly_reviews:    async () => setWeeklyReviews(await db.weeklyReviews.fetchAll()),', '');
  replace('reviewRecords, weeklyReviews, monthlyReviews,', 'reviewRecords, weeklyReviews: reviewWeekly.records, reviewWeekly, monthlyReviews,');
  return "import { useWeeklyReviews } from './hooks/useWeeklyReviews';\n" + code;
}
