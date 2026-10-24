import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { DashboardRoute } from './components/DashboardRoute';
import { DailyView } from './components/DailyView';
import { CalendarView } from './components/CalendarView';
import { GoalsHubView } from './components/GoalsHubView';
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
import { DiaryView } from './components/DiaryView';
import { CultureRecordView } from './components/CultureRecordView';
import { RecipeView } from './components/RecipeView';
import { ProfileView } from './components/ProfileView';
import { VisionBoardView } from './components/VisionBoardView';
import { ScrapView } from './components/ScrapView';
import { SomedayView } from './components/SomedayView';
import { InboxView } from './components/InboxView';
import { PlacesView } from './components/PlacesView';
import { WalkView } from './components/WalkView';
import { BeautyCareView } from './components/beauty/BeautyCareView';
import { HousekeepingView } from './components/housekeeping/HousekeepingView';
import { MoneyView } from '../features/money/MoneyView';

export const router = createBrowserRouter([
  // Explicit development entry; Auth/PlannerProvider still wrap this route in App.
  // Vite removes the import and its styles from production builds.
  ...(import.meta.env.DEV ? [{ path: '/__moamoa-today', lazy: () => import('./components/moamoa/MoaTodayRoute') },
    { path: '/__moamoa-food', lazy: () => import('./components/moamoa/MoaFoodRoute') },
    { path: '/__moamoa-music', lazy: () => import('./components/moamoa/MoaMusicRoute') },
    { path: '/__moamoa-culture', lazy: () => import('./components/moamoa/MoaCultureRoute') },
    { path: '/__moamoa-records', lazy: () => import('./components/moamoa/MoaTimeAnalysisRoute') },
    { path: '/__moamoa-todos', lazy: () => import('./components/moamoa/MoaTodosRoute') }] : []),
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',    Component: DashboardRoute },
      { path: 'daily',        Component: DailyView },
      { path: 'calendar',     Component: CalendarView },
      { path: 'todos',        Component: TodosView },
      { path: 'inbox',        Component: InboxView },
      { path: 'goals',        Component: GoalsHubView },
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
      { path: 'diary',            Component: DiaryView },
      { path: 'question-journal', element: <Navigate to="/diary" replace /> },
      { path: 'culture',          Component: CultureRecordView },
      { path: 'recipes',          Component: RecipeView },
      { path: 'vision',           Component: VisionBoardView },
      { path: 'scraps',           Component: ScrapView },
      { path: 'someday',          Component: SomedayView },
      { path: 'places',           Component: PlacesView },
      { path: 'walk',             Component: WalkView },
      { path: 'beauty-care',      Component: BeautyCareView },
      { path: 'housekeeping',     Component: HousekeepingView },
      { path: 'money',            Component: MoneyView },
      { path: 'profile',          Component: ProfileView },
    ],
  },
]);
