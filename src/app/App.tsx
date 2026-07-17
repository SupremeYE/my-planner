import { RouterProvider } from 'react-router';
import { useEffect, useState } from 'react';
import { router } from './routes';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider, useAuth } from './AuthContext';
import { PlannerProvider } from './store';
import { FabProvider } from './FabContext';
import { TimerProvider } from './timers/TimerProvider';
import { GlobalFloatingTimer } from './components/GlobalFloatingTimer';
import { Top3NoticeHost } from './components/Top3NoticeHost';
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
        <Top3NoticeHost />
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

    // iOS body-scroll-lock — CSS(overflow:hidden·#root 고정)만으로는 일부 iOS 버전에서
    // visual viewport 가 손으로 밀리는(문서 전체 패닝) 현상이 남는다. touchmove 를 JS 로 직접
    // 가로채서, 터치 지점이 '실제로 스크롤 가능한 컨테이너' 안이면 허용하고(세로 main·가로 주간
    // 스트립·모달·textarea 등), 그 외 영역의 패닝은 preventDefault 로 원천 차단한다.
    // 멀티터치(핀치)도 차단. 입력 요소는 통과시켜 커서/선택을 보존.
    const isScrollable = (el: Element, axis: 'x' | 'y'): boolean => {
      const cs = getComputedStyle(el);
      const o = axis === 'x' ? cs.overflowX : cs.overflowY;
      if (o !== 'auto' && o !== 'scroll') return false;
      return axis === 'x'
        ? el.scrollWidth > el.clientWidth
        : el.scrollHeight > el.clientHeight;
    };
    const touchStart = { x: 0, y: 0 };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStart.x = e.touches[0].clientX;
        touchStart.y = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) { e.preventDefault(); return; }  // 핀치/멀티터치 차단
      const dx = Math.abs(e.touches[0].clientX - touchStart.x);
      const dy = Math.abs(e.touches[0].clientY - touchStart.y);
      const axis: 'x' | 'y' = dx > dy ? 'x' : 'y';
      let el: Element | null = e.target as Element | null;
      while (el && el !== document.body && el !== document.documentElement) {
        // 입력/편집 영역과 contenteditable 은 항상 통과(텍스트 조작 보존)
        const tag = el.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || (el as HTMLElement).isContentEditable) return;
        // 커스텀 제스처를 직접 처리하는 요소(touch-action:none/pan-*/pinch-* — 카카오맵·
        // 만다라트·DnD·비전보드·마인드맵·스티커 등)는 통과시켜 드래그/팬을 보존
        const ta = getComputedStyle(el).touchAction;
        if (ta && ta !== 'auto' && ta !== 'manipulation') return;
        if (isScrollable(el, axis)) return;   // 해당 방향 스크롤 가능한 컨테이너 안 → 허용
        el = el.parentElement;
      }
      // 스크롤 가능한 컨테이너를 못 찾음 → 문서/visual viewport 패닝 시도이므로 차단
      e.preventDefault();
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('gestureend', block);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
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
