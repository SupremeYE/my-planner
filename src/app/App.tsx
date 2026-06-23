import { RouterProvider } from 'react-router';
import { useEffect, useState } from 'react';
import { router } from './routes';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider, useAuth } from './AuthContext';
import { PlannerProvider } from './store';
import { FabProvider } from './FabContext';
import { TimerProvider } from './timers/TimerProvider';
import { GlobalFloatingTimer } from './components/GlobalFloatingTimer';
import { CookingTimers } from './components/CookingTimers';
import { PWABanner, IOSInstallGuide } from './components/PWABanner';
import { LoginView } from './components/LoginView';
import { ResetPasswordView } from './components/ResetPasswordView';
import SplashScreen from '../components/SplashScreen';

function AppContent() {
  const { session, loading, recovery } = useAuth();
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

  // 비밀번호 재설정 메일 링크로 진입 → 새 비밀번호 설정 화면
  if (recovery) {
    return <ResetPasswordView />;
  }

  // 비로그인 → 로그인 화면 (PlannerProvider 미마운트 → Supabase 조회 안 함)
  if (!session) {
    return <LoginView />;
  }

  // 로그인 됨 → 앱 본체
  return (
    <PlannerProvider>
      <TimerProvider>
        <FabProvider>
          <RouterProvider router={router} />
        </FabProvider>
        <GlobalFloatingTimer />
        <CookingTimers />
        <PWABanner />
        <IOSInstallGuide />
      </TimerProvider>
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
