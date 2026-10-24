import { createBrowserRouter, Link, Navigate, useLocation } from 'react-router';
import { ReviewShell } from './ReviewShell';
import { MoaFrame } from './ReviewFrame';
import { useReviewQuick, ReviewQuickSheet } from './ReviewQuick';

function Unavailable() {
  const location = useLocation();
  const quick = useReviewQuick();
  const title = ({ '/reviews': '회고·일기', '/culture': '문화·음악', '/books': '독서', '/health': '건강' } as Record<string,string>)[location.pathname] ?? '준비 중인 화면';
  return <MoaFrame pageTitle={title} onQuick={quick.open}><section className="mt-card mr-placeholder"><h1>{title}</h1><p>모아모아 검토 화면을 준비하고 있어요. 이 화면의 입력·편집은 아직 지원하지 않아요.</p><p>다른 기능은 주요 메뉴나 기록 메뉴에서 이용할 수 있어요.</p><Link className="mr-inline-link" to="/__moamoa-records">시간 분석으로 돌아가기</Link></section><ReviewQuickSheet {...quick} /></MoaFrame>;
}
export const router = createBrowserRouter([{ element: <ReviewShell />, children: [
  { path: '/', element: <Navigate to="/__moamoa-today" replace /> },
  { path: '/__moamoa-today', lazy: () => import('../app/components/moamoa/MoaTodayRoute') },
  { path: '/__moamoa-food', lazy: () => import('../app/components/moamoa/MoaFoodRoute') },
  { path: '/__moamoa-records', lazy: () => import('../app/components/moamoa/MoaTimeAnalysisRoute') },
  { path: '/__moamoa-todos', lazy: () => import('../app/components/moamoa/MoaTodosRoute') },
  { path: '/culture', element: <Navigate to="/culture/video" replace /> },
  { path: '/__moamoa-culture', element: <Navigate to="/culture/video" replace /> },
  { path: '/culture/video', lazy: () => import('../app/components/moamoa/MoaCultureRoute') },
  { path: '/culture/music', lazy: () => import('../app/components/moamoa/MoaMusicRoute') },
  { path: '/books', lazy: () => import('../app/components/moamoa/MoaBooksRoute') },
  { path: '/__moamoa-music', element: <Navigate to="/culture/music" replace /> },
  { path: '/__moamoa-books', element: <Navigate to="/books" replace /> },
  { path: '/calendar', lazy: () => import('./ReviewCalendar') },
  { path: '/profile', lazy: () => import('./ReviewGarden') },
  ...Object.entries({ '/dashboard': '/__moamoa-today', '/todos': '/__moamoa-todos', '/food': '/__moamoa-food', '/goals': '/profile', '/time-report': '/__moamoa-records', '/daily': '/calendar?period=day' }).map(([path,to]) => ({ path, element: <Navigate to={to} replace /> })),
  { path: '*', Component: Unavailable },
]}]);
