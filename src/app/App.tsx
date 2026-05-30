import { RouterProvider } from 'react-router';
import { useEffect, useState } from 'react';
import { router } from './routes';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider, useAuth } from './AuthContext';
import { PlannerProvider } from './store';
import { GlobalFloatingTimer } from './components/GlobalFloatingTimer';
import { PWABanner, IOSInstallGuide } from './components/PWABanner';
import { LoginView } from './components/LoginView';
import { AccountWidget } from './components/AccountWidget';
import SplashScreen from '../components/SplashScreen';

function AppContent() {
  const { session, loading } = useAuth();
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

  // 스플래시 또는 세션 복원 중
  if (showSplash || loading) {
    return <SplashScreen isFadingOut={fadeOutSplash} />;
  }

  // 비로그인 → 로그인 화면 (PlannerProvider 미마운트 → Supabase 조회 안 함)
  if (!session) {
    return <LoginView />;
  }

  // 로그인 됨 → 앱 본체
  return (
    <PlannerProvider>
      <RouterProvider router={router} />
      <GlobalFloatingTimer />
      <PWABanner />
      <IOSInstallGuide />
      <AccountWidget />
    </PlannerProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
