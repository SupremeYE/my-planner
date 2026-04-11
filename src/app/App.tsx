import { RouterProvider } from 'react-router';
import { useEffect, useState } from 'react';
import { router } from './routes';
import { ThemeProvider } from './ThemeContext';
import { PlannerProvider } from './store';
import { GlobalFloatingTimer } from './components/GlobalFloatingTimer';
import { PWABanner, IOSInstallGuide } from './components/PWABanner';
import SplashScreen from '../components/SplashScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOutSplash, setFadeOutSplash] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setFadeOutSplash(true);
    }, 1400);

    const hideTimer = window.setTimeout(() => {
      setShowSplash(false);
    }, 1800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <ThemeProvider>
      <PlannerProvider>
        {showSplash ? (
          <SplashScreen isFadingOut={fadeOutSplash} />
        ) : (
          <>
            <RouterProvider router={router} />
            <GlobalFloatingTimer />
            <PWABanner />
            <IOSInstallGuide />
          </>
        )}
      </PlannerProvider>
    </ThemeProvider>
  );
}