import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Service Worker 코드를 Blob으로 생성 (MIME 타입 문제 우회)
const SW_CODE = `
const CACHE_NAME = 'my-planner-v1';
const STATIC_ASSETS = ['/', '/daily', '/weekly', '/monthly', '/calendar', '/backlog'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-planner-data') {
    console.log('[SW] Background sync triggered');
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'My Planner', {
      body: data.body || '새로운 알림이 있습니다.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
      tag: data.tag || undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client) {
          return client.navigate(url).then((c) => c && c.focus());
        }
      }
      return clients.openWindow(url);
    })
  );
});
`;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const blob = new Blob([SW_CODE], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);

    navigator.serviceWorker
      .register(swUrl, { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker registered via Blob');
        // Blob URL은 일회용이므로 등록 후 해제
        URL.revokeObjectURL(swUrl);
      })
      .catch((err) => {
        URL.revokeObjectURL(swUrl);
        // Blob scope 제한 시 /sw.js 파일로 폴백
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then(() => console.log('[PWA] Service Worker registered via /sw.js'))
          .catch(() => console.info('[PWA] Service Worker not available in this environment'));
      });
  } catch (err) {
    console.info('[PWA] Service Worker setup skipped');
  }
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // ── PWA 메타 태그 동적 주입 ──
    const injectMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      const existing = document.querySelector(`meta[${attr}="${name}"]`);
      if (existing) {
        existing.setAttribute('content', content);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    };

    // Manifest 링크
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    document.title = 'My Planner';
    injectMeta('application-name', 'My Planner');
    injectMeta('description', '나만의 생산성 플래너');
    injectMeta('theme-color', '#515f74');
    injectMeta('msapplication-TileColor', '#515f74');
    // apple-mobile-web-app-capable / status-bar-style 는 index.html 정적 태그로 이전
    // (iOS standalone 콜드런치 시점에 읽혀야 safe-area inset 이 올바르게 계산됨)
    injectMeta('apple-mobile-web-app-title', 'My Planner');
    injectMeta('mobile-web-app-capable', 'yes');
    // viewport-fit=cover 제거: status-bar-style=default 기기에서 inset이 0으로 보고되면
    // cover가 웹뷰를 상태바 밑까지 풀블리드로 깔아 전역 탑바가 가려짐.
    // cover를 빼면 iOS가 웹뷰를 상태바 아래·홈인디케이터 위로 자동 inset 처리함.
    injectMeta(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    );

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/icons/icon-192x192.png';
      document.head.appendChild(icon);
    }

    // ── Service Worker 등록 ──
    registerServiceWorker();
    setSwRegistered(true);

    // ── 설치 프롬프트 이벤트 캡처 ──
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
    return outcome === 'accepted';
  };

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    isOnline,
    swRegistered,
    promptInstall,
  };
}