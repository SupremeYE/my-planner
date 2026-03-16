import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './ThemeContext';
import { PlannerProvider } from './store';
import { PWABanner, IOSInstallGuide } from './components/PWABanner';

export default function App() {
  return (
    <ThemeProvider>
      <PlannerProvider>
        <RouterProvider router={router} />
        <PWABanner />
        <IOSInstallGuide />
      </PlannerProvider>
    </ThemeProvider>
  );
}