import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { DashboardView } from './components/DashboardView';
import { DailyView } from './components/DailyView';
import { CalendarView } from './components/CalendarView';
import { MonthlyView } from './components/MonthlyView';
import { TodosView } from './components/TodosView';
import { ProjectsView, ProjectDetailView } from './components/ProjectView';
import { HabitsView } from './components/HabitsView';
import { SelfCareView } from './components/SelfCareView';
import { HealthView } from './components/HealthView';
import { ReviewsView } from './components/ReviewsView';
import { SettingsView } from './components/SettingsView';
import { FoodView } from './components/FoodView';
import { BooksView } from './components/BooksView';
import { MoodView } from './components/MoodView';
import { MomentView } from './components/MomentView';
import { QuestionJournalView } from './components/QuestionJournalView';

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
      { path: 'goals',        Component: MonthlyView },
      { path: 'projects',     Component: ProjectsView },
      { path: 'projects/:id', Component: ProjectDetailView },
      { path: 'habits',       Component: HabitsView },
      { path: 'routines',     element: <Navigate to="/habits" replace /> },
      { path: 'health',       Component: HealthView },
      { path: 'time-report',  Component: SelfCareView },
      { path: 'selfcare',     element: <Navigate to="/time-report" replace /> },
      { path: 'reviews',      Component: ReviewsView },
      { path: 'settings',     Component: SettingsView },
      { path: 'food',         Component: FoodView },
      { path: 'books',        Component: BooksView },
      { path: 'mood',         Component: MoodView },
      { path: 'moments',           Component: MomentView },
      { path: 'question-journal', Component: QuestionJournalView },
    ],
  },
]);
