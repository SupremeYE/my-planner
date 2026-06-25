// My Planner - Service Worker
// v3: 모바일 viewport 줌-팬 수정 배포 — 옛 precache(`/` 셸 등) 강제 폐기용 버전 범프
const CACHE_NAME = 'my-planner-v3';
const STATIC_ASSETS = [
  '/',
  '/daily',
  '/weekly',
  '/monthly',
  '/calendar',
  '/backlog',
];

// ─── Install: 핵심 리소스 캐싱 ───
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: 이전 캐시 정리 ───
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch: Network-first, Cache fallback ───
self.addEventListener('fetch', (event) => {
  // 같은 origin의 GET 요청만 처리
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 유효한 응답이면 캐시에 저장
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 반환
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', event.request.url);
            return cachedResponse;
          }
          // 캐시도 없으면 오프라인 페이지 반환
          return caches.match('/');
        });
      })
  );
});

// ─── Background Sync (기본 구조) ───
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-planner-data') {
    console.log('[SW] Background sync triggered');
    // 실제 백엔드 연동 시 여기서 데이터 동기화
  }
});

// ─── Push Notification ───
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'My Planner';
  const options = {
    body: data.body || '새로운 알림이 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    tag: data.tag || undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click → Daily 뷰 해당 할일로 이동 ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열린 창이 있으면 포커스 후 navigate
      for (const client of clientList) {
        if ('navigate' in client) {
          return client.navigate(url).then((c) => c && c.focus());
        }
      }
      // 열린 창 없으면 새 창
      return clients.openWindow(url);
    })
  );
});
