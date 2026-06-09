const DEFAULT_ICON = '/logo.png';
const SW_VERSION = 'pingme-pwa-v1';
const APP_SHELL_CACHE = `${SW_VERSION}-shell`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

const shouldRuntimeCache = (request) => {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname === '/pingme-sw.js') return false;
  if (url.pathname.startsWith('/api')) return false;

  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    ['script', 'style', 'font', 'image'].includes(request.destination)
  );
};

const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }

  return response;
};

const networkFirstNavigation = async (request) => {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match('/index.html')) ||
      (await caches.match('/')) ||
      new Response('PingMe dang ngoai tuyen. Vui long thu lai khi co mang.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('pingme-pwa-') && !cacheName.startsWith(SW_VERSION))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (shouldRuntimeCache(request)) {
    event.respondWith(cacheFirst(request));
  }
});

const broadcastDebugEvent = async (eventName, detail = {}) => {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  clientList.forEach((client) => {
    client.postMessage({
      type: 'PINGME_PUSH_DEBUG',
      eventName,
      detail,
      timestamp: Date.now(),
    });
  });
};

const getNotificationOptions = (payload = {}) => ({
  body: payload.body || 'Ban co thong bao moi',
  icon: payload.icon || DEFAULT_ICON,
  badge: payload.badge || DEFAULT_ICON,
  tag: payload.tag || `pingme-${Date.now()}`,
  timestamp: payload.timestamp || Date.now(),
  renotify: true,
  requireInteraction: Boolean(payload.requireInteraction),
  data: payload.data || {},
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'PingMe',
      body: event.data?.text() || 'Ban co thong bao moi',
    };
  }

  const title = payload.title || 'PingMe';

  event.waitUntil(
    (async () => {
      await broadcastDebugEvent('push_received', {
        title,
        body: payload.body || '',
        hasPayload: Boolean(event.data),
        tag: payload.tag || '',
        conversationId: payload.data?.conversationId || '',
        messageId: payload.data?.messageId || '',
      });

      await self.registration.showNotification(title, getNotificationOptions(payload));

      await broadcastDebugEvent('notification_shown_from_push', {
        title,
        tag: payload.tag || '',
      });
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PINGME_SHOW_TEST_NOTIFICATION') return;

  event.waitUntil(
    self.registration.showNotification(
      event.data.title || 'PingMe Service Worker test',
      getNotificationOptions({
        body: event.data.body || 'Neu thay thong bao nay thi Service Worker notification hien duoc.',
        tag: `pingme-sw-test-${Date.now()}`,
        data: {
          type: 'test',
          url: '/chat',
        },
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const conversationId = data.conversationId || '';
  const targetUrl = data.url || (conversationId ? `/chat?conversationId=${conversationId}` : '/chat');
  const targetHref = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const sameOriginClient = clientList.find((client) => client.url.startsWith(self.location.origin));

      if (sameOriginClient) {
        const chatClient = sameOriginClient.url.includes('/chat')
          ? sameOriginClient
          : await sameOriginClient.navigate(targetHref);

        chatClient?.postMessage({
          type: 'PINGME_OPEN_CONVERSATION',
          conversationId,
          callId: data.callId || '',
        });
        return chatClient?.focus();
      }

      return self.clients.openWindow(targetHref);
    }),
  );
});
