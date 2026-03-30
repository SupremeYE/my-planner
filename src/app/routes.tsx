import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { DashboardView } from './components/DashboardView';
import { DailyView } from './components/DailyView';
import { CalendarView } from './components/CalendarView';
import { WeeklyView } from './components/WeeklyView';
import { MonthlyView } from './components/MonthlyView';
import { TodosView } from './components/TodosView';
import { ProjectsView, ProjectDetailView } from './components/ProjectView';
import { HabitsView } from './components/HabitsView';
import { SelfCareView } from './components/SelfCareView';
import { ReviewsView } from './components/ReviewsView';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',    Component: DashboardView },
      { path: 'daily',        Component: DailyView },
      { path: 'calendar',     Component: CalendarView },
      { path: 'todos',        Component: TodosView },
      { path: 'weekly',       Component: WeeklyView },
      { path: 'goals',        Component: MonthlyView },
      { path: 'projects',     Component: ProjectsView },
      { path: 'projects/:id', Component: ProjectDetailView },
      { path: 'habits',       Component: HabitsView },
      { path: 'routines',     element: <Navigate to="/habits" replace /> },
      { path: 'selfcare',     Component: SelfCareView },
      { path: 'reviews',      Component: ReviewsView },
    ],
  },
]);
