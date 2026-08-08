import { Layout } from './Layout';

// 테마 H 단일화 — 항상 사이드바 레이아웃(Layout). (구 theme C 전용 topnav/LayoutC 폐지)
// PlannerProvider 는 App.tsx(RouterProvider 상위)에 있어 모든 라우트에서 사용 가능.
export function RootLayout() {
  return <Layout />;
}
