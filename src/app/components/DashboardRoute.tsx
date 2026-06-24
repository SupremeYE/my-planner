import { useMediaQuery } from '../hooks/useMediaQuery';
import { DashboardView } from './DashboardView';
import { QuickCaptureHome } from './QuickCaptureHome';

/**
 * `/dashboard` 진입점.
 *  · PC(≥1024px): 기존 DashboardView 그대로.
 *  · 모바일(<1024px): 빠른 기록 홈(QuickCaptureHome).
 *
 * CSS(`lg:hidden`) 분기가 아니라 조건부 렌더링이라, 매칭되지 않는 쪽은
 * 아예 마운트되지 않는다 — 모바일에서 DashboardView 의 Supabase 쿼리가 돌지 않음.
 */
export function DashboardRoute() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  return isDesktop ? <DashboardView /> : <QuickCaptureHome />;
}
