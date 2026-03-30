import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './ThemeContext';
import { PlannerProvider } from './store';
import { GlobalFloatingTimer } from './components/GlobalFloatingTimer';
import { PWABanner, IOSInstallGuide } from './components/PWABanner';

export default function App() {
  return (
    <ThemeProvider>
      <PlannerProvider>
        <RouterProvider router={router} />
        <GlobalFloatingTimer />
        <PWABanner />
        <IOSInstallGuide />
      </PlannerProvider>
    </ThemeProvider>
  );
}