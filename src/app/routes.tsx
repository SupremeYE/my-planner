import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { DashboardView } from './components/DashboardView';
import { DailyView } from './components/DailyView';
import { CalendarView } from './components/CalendarView';
import { WeeklyView } from './components/WeeklyView';
import { MonthlyView } from './components/MonthlyView';
import { BacklogView } from './components/BacklogView';
import { ProjectsView, ProjectDetailView } from './components/ProjectView';
import { BrainstormView } from './components/BrainstormView';
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
      { path: 'weekly',       Component: WeeklyView },
      { path: 'monthly',      Component: MonthlyView },
      { path: 'backlog',      Component: BacklogView },
      { path: 'projects',     Component: ProjectsView },
      { path: 'projects/:id', Component: ProjectDetailView },
      { path: 'brainstorm',   Component: BrainstormView },
      { path: 'habits',       Component: HabitsView },
      { path: 'selfcare',     Component: SelfCareView },
      { path: 'reviews',      Component: ReviewsView },
    ],
  },
]);
