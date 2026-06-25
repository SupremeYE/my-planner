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
  // iOS Safari/PWA 핀치줌 차단 — iOS 는 viewport 의 user-scalable=no 를 무시하므로
  // gesture* 이벤트를 JS 레벨에서 직접 막아야 visual viewport 줌-팬(화면 전체가 밀리는 버그)을
  // 완전히 차단할 수 있다. 항상 마운트되는 최상위에 전역 1회만 부착(로그인/스플래시 상태 무관).
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', block, { passive: false });
    document.addEventListener('gesturechange', block, { passive: false });
    document.addEventListener('gestureend', block, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('gestureend', block);
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
